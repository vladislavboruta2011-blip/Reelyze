import OpenAI from "openai";

import {
  buildAskClimpySystemPrompt,
  buildAskClimpyUserPrompt,
} from "@/engine/ask-climpy-prompt";
import {
  ASK_CLIMPY_LIMITS,
  ASK_CLIMPY_REWRITE_ASSESSMENTS,
  buildAskClimpySafeRefusalFallback,
  parseAskClimpyJson,
  validateAskClimpyModelResult,
  validateAskClimpyRequest,
  type AskClimpyErrorResponse,
  type AskClimpyRequest,
  type AskClimpyResponse,
} from "@/engine/ask-climpy-validation";
import {
  delay,
  getUpstreamErrorStatus,
  isTransientUpstreamError,
} from "@/lib/ai-transient-retry";

const ASK_CLIMPY_MODEL =
  process.env.ASK_CLIMPY_MODEL?.trim() || "gpt-4.1-mini";
const ASK_CLIMPY_TIMEOUT_MS = 15_000;
const ASK_CLIMPY_TRANSIENT_RETRY_DELAY_MS = 250;
const ASK_CLIMPY_RATE_LIMIT_MAX_REQUESTS = 8;
const ASK_CLIMPY_RATE_LIMIT_WINDOW_MS = 60_000;
const ASK_CLIMPY_RATE_LIMIT_MAX_ENTRIES = 10_000;

// Two separate request-type-specific structured-output schemas, selected by
// requestRewrite (see defaultAskClimpyModelCaller below) — replacing a
// single broad schema that allowed the model to legally combine fields in
// semantically invalid ways for a given request type (e.g. a plain
// explanation question answered with cannotSafelyRewrite: true, or
// rewrite-oriented example content, which validateAskClimpyModelResult
// would then have to reject after the fact, burning the one approved
// retry). Neither schema changes the approved public AskClimpyResponse
// TypeScript type (see engine/ask-climpy-validation.ts) — both are purely
// internal OpenAI request shapes; action/example stay nullable rather than
// omittable because OpenAI's strict structured-output mode requires every
// listed property to appear in "required", and validateAskClimpyModelResult
// converts a null (or, after Phase 3's normalization, an empty/whitespace-
// only) action/example into an omitted field on the public type.

// EXPLANATION (requestRewrite: false) — cannotSafelyRewrite is constrained
// to the literal `false` at the schema level (not merely requested in
// prose), and there is no rewriteAssessment field at all: a plain
// explanation answer has no rewrite to self-audit. "example" remains
// optional — an illustrative example of a possible fix is allowed, but
// never a claimed rewrite of a specific validated fragment (see
// engine/ask-climpy-prompt.ts's REQUEST MODE: EXPLANATION instructions).
const ASK_CLIMPY_EXPLANATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "action", "example", "cannotSafelyRewrite"],
  properties: {
    answer: {
      type: "string",
    },
    action: {
      type: ["string", "null"],
    },
    example: {
      type: ["string", "null"],
    },
    cannotSafelyRewrite: {
      type: "boolean",
      enum: [false],
    },
  },
} as const;

// LOCAL_REWRITE (requestRewrite: true) — cannotSafelyRewrite may
// legitimately be true (safe refusal) or false (successful rewrite); OpenAI's
// strict structured-output mode has no clean way to express "example is
// required only when cannotSafelyRewrite is false" across a flat object
// schema, so that specific pairing continues to be enforced in
// validateAskClimpyModelResult, exactly as before. rewriteAssessment is an
// internal-only self-audit field (see buildAskClimpySystemPrompt's
// EDITORIAL VALUE section) that never appears on the public
// AskClimpyResponse — validateAskClimpyModelResult reads it purely to
// decide whether a proposed rewrite is accepted or normalized into a safe
// refusal, then discards it. Required here (strict mode) but parsed
// leniently by the validator, so it is never a source of a hard validation
// failure on its own.
const ASK_CLIMPY_REWRITE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "answer",
    "action",
    "example",
    "cannotSafelyRewrite",
    "rewriteAssessment",
  ],
  properties: {
    answer: {
      type: "string",
    },
    action: {
      type: ["string", "null"],
    },
    example: {
      type: ["string", "null"],
    },
    cannotSafelyRewrite: {
      type: "boolean",
    },
    rewriteAssessment: {
      type: ["string", "null"],
      enum: [...ASK_CLIMPY_REWRITE_ASSESSMENTS, null],
    },
  },
} as const;

class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body is too large.");
    this.name = "RequestBodyTooLargeError";
  }
}

class MissingApiKeyError extends Error {
  constructor() {
    super("Missing API key.");
    this.name = "MissingApiKeyError";
  }
}

class EmptyModelResponseError extends Error {
  constructor() {
    super("Empty model response.");
    this.name = "EmptyModelResponseError";
  }
}

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

const rateLimitEntries = new Map<string, RateLimitEntry>();

function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedClient = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedClient ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown-client"
  );
}

function consumeAskClimpyRateLimit(
  clientIdentifier: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  for (const [key, entry] of rateLimitEntries) {
    if (now - entry.windowStartedAt >= ASK_CLIMPY_RATE_LIMIT_WINDOW_MS) {
      rateLimitEntries.delete(key);
    }
  }

  const existing = rateLimitEntries.get(clientIdentifier);

  if (!existing || now - existing.windowStartedAt >= ASK_CLIMPY_RATE_LIMIT_WINDOW_MS) {
    if (!existing && rateLimitEntries.size >= ASK_CLIMPY_RATE_LIMIT_MAX_ENTRIES) {
      const oldestKey = rateLimitEntries.keys().next().value;
      if (oldestKey !== undefined) {
        rateLimitEntries.delete(oldestKey);
      }
    }

    rateLimitEntries.set(clientIdentifier, { count: 1, windowStartedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= ASK_CLIMPY_RATE_LIMIT_MAX_REQUESTS) {
    const remainingMilliseconds =
      ASK_CLIMPY_RATE_LIMIT_WINDOW_MS - (now - existing.windowStartedAt);

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMilliseconds / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

async function readJsonBodyWithLimit(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);

    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > ASK_CLIMPY_LIMITS.maxRequestBodyBytes
    ) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) {
    return JSON.parse("");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let rawBody = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      receivedBytes += value.byteLength;

      if (receivedBytes > ASK_CLIMPY_LIMITS.maxRequestBodyBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }

      rawBody += decoder.decode(value, { stream: true });
    }

    rawBody += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return JSON.parse(rawBody);
}

type AskClimpyModelOutput = {
  raw: string;
};

// requestRewrite selects which of the two structured-output schemas above
// is sent to the model for this call — an explicit, request-type-specific
// contract rather than one broad schema both request types shared.
export type AskClimpyModelCaller = (
  systemPrompt: string,
  userPrompt: string,
  requestRewrite: boolean
) => Promise<AskClimpyModelOutput>;

export async function defaultAskClimpyModelCaller(
  systemPrompt: string,
  userPrompt: string,
  requestRewrite: boolean
): Promise<AskClimpyModelOutput> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  const openai = new OpenAI({
    apiKey,
    timeout: ASK_CLIMPY_TIMEOUT_MS,
    maxRetries: 0,
  });

  const completion = await openai.chat.completions.create({
    model: ASK_CLIMPY_MODEL,
    temperature: 0.3,
    max_tokens: 500,
    response_format: {
      type: "json_schema",
      json_schema: requestRewrite
        ? {
            name: "ask_climpy_rewrite_response",
            description:
              "A grounded rewrite (or honest refusal) of one validated risky script fragment.",
            strict: true,
            schema: ASK_CLIMPY_REWRITE_JSON_SCHEMA,
          }
        : {
            name: "ask_climpy_explanation_response",
            description:
              "A short, grounded explanation about the current Analysis V2 result — never a rewrite.",
            strict: true,
            schema: ASK_CLIMPY_EXPLANATION_JSON_SCHEMA,
          },
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";

  if (raw.length === 0) {
    throw new EmptyModelResponseError();
  }

  return { raw };
}

function errorResponse(reason: string): AskClimpyErrorResponse {
  return { reason };
}

export type AskClimpyRunResult =
  | { ok: true; status: 200; response: AskClimpyResponse }
  | { ok: false; status: 502 | 503; response: AskClimpyErrorResponse };

// Exactly one bounded, sequential retry, total — covering a transient
// infrastructure failure (network/timeout/429/5xx) OR a single malformed/
// contract-violating structured model response (unparseable JSON, or a
// response that fails validateAskClimpyModelResult, e.g. a non-rewrite
// request answered with cannotSafelyRewrite: true). Both failure kinds share
// this same one-retry budget — never two independent retry allowances — so
// "at most one model retry" always holds regardless of which stage failed.
// MissingApiKeyError and non-transient upstream errors are never retried:
// retrying would not help and only wastes the one allowed attempt.
const ASK_CLIMPY_MAX_ATTEMPTS = 2;

// The core model-call → parse → validate pipeline, factored out of POST so
// it can be exercised directly with an injected modelCaller in tests
// (mirrors app/api/analyze-v2/route.ts's runAnalysisV2). POST itself still
// owns body parsing, Content-Type/size checks, and rate limiting — none of
// which belong in a function tests call directly with an already-validated
// AskClimpyRequest.
export async function runAskClimpy(
  askClimpyRequest: AskClimpyRequest,
  modelCaller: AskClimpyModelCaller = defaultAskClimpyModelCaller
): Promise<AskClimpyRunResult> {
  const systemPrompt = buildAskClimpySystemPrompt(askClimpyRequest.locale);
  const userPrompt = buildAskClimpyUserPrompt(askClimpyRequest);

  for (let attempt = 0; attempt < ASK_CLIMPY_MAX_ATTEMPTS; attempt += 1) {
    const isLastAttempt = attempt === ASK_CLIMPY_MAX_ATTEMPTS - 1;

    if (attempt > 0) {
      await delay(ASK_CLIMPY_TRANSIENT_RETRY_DELAY_MS);
    }

    let modelOutput: AskClimpyModelOutput;

    try {
      modelOutput = await modelCaller(
        systemPrompt,
        userPrompt,
        askClimpyRequest.requestRewrite
      );
    } catch (error) {
      if (error instanceof MissingApiKeyError || !isTransientUpstreamError(error)) {
        return {
          ok: false,
          status: 503,
          response: errorResponse(
            error instanceof MissingApiKeyError
              ? "Ask Climpy is temporarily unavailable."
              : "Ask Climpy could not complete this request."
          ),
        };
      }

      if (isLastAttempt) {
        const upstreamStatus = getUpstreamErrorStatus(error);
        const status =
          upstreamStatus === 429 || (upstreamStatus !== undefined && upstreamStatus >= 500)
            ? 503
            : 502;

        return {
          ok: false,
          status,
          response: errorResponse("Ask Climpy is temporarily unavailable."),
        };
      }

      continue;
    }

    const parsed = parseAskClimpyJson(modelOutput.raw);

    if (parsed === null) {
      if (isLastAttempt) {
        return {
          ok: false,
          status: 502,
          response: errorResponse("Ask Climpy returned an unusable response."),
        };
      }

      continue;
    }

    const resultValidation = validateAskClimpyModelResult(parsed, askClimpyRequest);

    if (!resultValidation.ok) {
      console.error("[ask-climpy] validation failed:", resultValidation.reason);

      if (isLastAttempt) {
        // The model produced a well-formed response on both attempts, but
        // our own grounding heuristics rejected the proposed rewrite both
        // times (no-op / unfulfilled-promise — see safeRefusalEligible).
        // That is a normal editorial outcome ("this fragment genuinely
        // can't be safely rewritten"), not an infrastructure failure, so it
        // gets the same valid 200 a model-originated refusal would get —
        // never a generic 502. Scoped to requestRewrite only: a non-rewrite
        // question has no equivalent "safe refusal" concept (see the
        // approved AskClimpyResponse contract).
        if (askClimpyRequest.requestRewrite && resultValidation.safeRefusalEligible) {
          return {
            ok: true,
            status: 200,
            response: buildAskClimpySafeRefusalFallback(askClimpyRequest.locale),
          };
        }

        return {
          ok: false,
          status: 502,
          response: errorResponse("Ask Climpy returned an invalid response."),
        };
      }

      continue;
    }

    return { ok: true, status: 200, response: resultValidation.value };
  }

  // Unreachable — the loop above always returns on its final iteration.
  return {
    ok: false,
    status: 502,
    response: errorResponse("Ask Climpy could not complete this request."),
  };
}

export async function POST(request: Request): Promise<Response> {
  const contentType =
    request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";

  if (contentType !== "application/json") {
    return Response.json(
      errorResponse("Unsupported Content-Type. Use application/json."),
      { status: 415 }
    );
  }

  let body: unknown;

  try {
    body = await readJsonBodyWithLimit(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(errorResponse("Request body is too large."), {
        status: 413,
      });
    }

    return Response.json(errorResponse("Invalid JSON request body."), {
      status: 400,
    });
  }

  const requestValidation = validateAskClimpyRequest(body);

  if (!requestValidation.ok) {
    return Response.json(errorResponse(requestValidation.reason), {
      status: 400,
    });
  }

  const rateLimit = consumeAskClimpyRateLimit(getClientIdentifier(request));

  if (!rateLimit.allowed) {
    return Response.json(
      errorResponse("Too many Ask Climpy requests. Please try again later."),
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const result = await runAskClimpy(requestValidation.value);

  return Response.json(result.response, { status: result.status });
}
