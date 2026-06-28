import OpenAI from "openai";

import { ANALYSIS_V2_JSON_SCHEMA } from "@/engine/analysis-v2-json-schema";
import {
  buildAnalysisV2SystemPrompt,
  buildAnalysisV2UserPrompt,
} from "@/engine/analysis-v2-prompt";
import {
  ANALYSIS_V2_LIMITS,
  type AnalysisV2ErrorResponse,
  type AnalysisV2SuccessResponse,
} from "@/engine/analysis-v2-schema";
import {
  parseAnalysisV2Json,
  validateAnalysisV2Input,
  validateAnalysisV2Result,
} from "@/engine/analysis-v2-validation";

const ANALYSIS_V2_MODEL =
  process.env.ANALYSIS_V2_MODEL?.trim() ||
  "gpt-4.1-mini";
const ANALYSIS_V2_TIMEOUT_MS = 20_000;
const ANALYSIS_V2_RATE_LIMIT_MAX_REQUESTS = 10;
const ANALYSIS_V2_RATE_LIMIT_WINDOW_MS = 60_000;
const ANALYSIS_V2_RATE_LIMIT_MAX_ENTRIES = 10_000;

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

type AnalysisV2ModelOutput = {
  raw: string;
  modelUsed: string;
};

export type AnalysisV2ModelCaller = (
  systemPrompt: string,
  userPrompt: string
) => Promise<AnalysisV2ModelOutput>;

export type AnalysisV2RunResult =
  | {
      ok: true;
      status: 200;
      response: AnalysisV2SuccessResponse;
    }
  | {
      ok: false;
      status: 400 | 502 | 503;
      response: AnalysisV2ErrorResponse;
    };

const rateLimitEntries = new Map<string, RateLimitEntry>();

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

function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedClient = forwardedFor
    ?.split(",")[0]
    ?.trim();

  return (
    forwardedClient ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown-client"
  );
}

function consumeAnalysisV2RateLimit(
  clientIdentifier: string,
  now = Date.now()
): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  for (const [key, entry] of rateLimitEntries) {
    if (
      now - entry.windowStartedAt >=
      ANALYSIS_V2_RATE_LIMIT_WINDOW_MS
    ) {
      rateLimitEntries.delete(key);
    }
  }

  const existing = rateLimitEntries.get(clientIdentifier);

  if (
    !existing ||
    now - existing.windowStartedAt >=
      ANALYSIS_V2_RATE_LIMIT_WINDOW_MS
  ) {
    if (
      !existing &&
      rateLimitEntries.size >=
        ANALYSIS_V2_RATE_LIMIT_MAX_ENTRIES
    ) {
      const oldestKey = rateLimitEntries.keys().next().value;

      if (oldestKey !== undefined) {
        rateLimitEntries.delete(oldestKey);
      }
    }

    rateLimitEntries.set(clientIdentifier, {
      count: 1,
      windowStartedAt: now,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (
    existing.count >=
    ANALYSIS_V2_RATE_LIMIT_MAX_REQUESTS
  ) {
    const remainingMilliseconds =
      ANALYSIS_V2_RATE_LIMIT_WINDOW_MS -
      (now - existing.windowStartedAt);

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(remainingMilliseconds / 1000)
      ),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

async function readJsonBodyWithLimit(
  request: Request
): Promise<unknown> {
  const contentLength =
    request.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);

    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes >
        ANALYSIS_V2_LIMITS.maxRequestBodyBytes
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

      if (done) {
        break;
      }

      receivedBytes += value.byteLength;

      if (
        receivedBytes >
        ANALYSIS_V2_LIMITS.maxRequestBodyBytes
      ) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }

      rawBody += decoder.decode(value, {
        stream: true,
      });
    }

    rawBody += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return JSON.parse(rawBody);
}

export async function defaultAnalysisV2ModelCaller(
  systemPrompt: string,
  userPrompt: string
): Promise<AnalysisV2ModelOutput> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  const openai = new OpenAI({
    apiKey,
    timeout: ANALYSIS_V2_TIMEOUT_MS,
    maxRetries: 0,
  });

  const completion =
    await openai.chat.completions.create({
      model: ANALYSIS_V2_MODEL,
      temperature: 0.2,
      max_tokens: 1_400,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reelyze_analysis_v2",
          description:
            "A grounded, type-aware YouTube Shorts script analysis.",
          strict: true,
          schema: ANALYSIS_V2_JSON_SCHEMA,
        },
      },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

  const raw =
    completion.choices[0]?.message?.content?.trim() ??
    "";

  if (raw.length === 0) {
    throw new EmptyModelResponseError();
  }

  return {
    raw,
    modelUsed:
      completion.model || ANALYSIS_V2_MODEL,
  };
}

function buildAnalysisV2RetryUserPrompt(
  originalUserPrompt: string,
  validationReason: string
): string {
  const specificGuidance =
    validationReason.includes(
      "unrevealed specific opening promise"
    )
      ? [
          "Specific correction:",
          "If the opening promises one hidden setting, secret, cause, reason, or mechanism but the script never names it, treat this as a material hook/payoff problem.",
          "Do not use hookDecision keep.",
          "Do not call the hook clear and specific.",
          "Keep overall at 65 or lower unless the script reveals the promised item.",
          "Use a grounded riskyPart excerpt from the opening promise and a required fix that asks to reveal or remove the promise.",
        ]
      : [];

  return [
    originalUserPrompt,
    "",
    "Correction required:",
    `The previous response failed deterministic validation: ${validationReason}`,
    ...specificGuidance,
    "Generate a new complete analysis from the original script.",
    "Correct the validation problem without inventing facts, excerpts, numbers, entities, or promises.",
    "Return only JSON that follows the required schema.",
  ].join("\n");
}

export async function runAnalysisV2(
  script: unknown,
  title: unknown,
  modelCaller: AnalysisV2ModelCaller =
    defaultAnalysisV2ModelCaller
): Promise<AnalysisV2RunResult> {
  const inputValidation =
    validateAnalysisV2Input(script, title);

  if (!inputValidation.ok) {
    return {
      ok: false,
      status: 400,
      response: {
        status: "error",
        reason: inputValidation.reason,
      },
    };
  }

  const systemPrompt =
    buildAnalysisV2SystemPrompt();
  const userPrompt = buildAnalysisV2UserPrompt(
    inputValidation.script,
    inputValidation.title
  );

  let currentUserPrompt = userPrompt;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let modelOutput: AnalysisV2ModelOutput;

    try {
      modelOutput = await modelCaller(
        systemPrompt,
        currentUserPrompt
      );
    } catch (error) {
      if (error instanceof MissingApiKeyError) {
        return {
          ok: false,
          status: 503,
          response: {
            status: "error",
            reason:
              "Analysis V2 is temporarily unavailable.",
          },
        };
      }

      const upstreamStatus =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status ===
          "number"
          ? (error as { status: number }).status
          : undefined;

      if (
        upstreamStatus === 401 ||
        upstreamStatus === 403 ||
        upstreamStatus === 429 ||
        (upstreamStatus !== undefined &&
          upstreamStatus >= 500) ||
        error instanceof OpenAI.APIConnectionError
      ) {
        return {
          ok: false,
          status: 503,
          response: {
            status: "error",
            reason:
              "Analysis V2 is temporarily unavailable.",
          },
        };
      }

      return {
        ok: false,
        status: 503,
        response: {
          status: "error",
          reason:
            "Analysis V2 could not complete this request.",
        },
      };
    }

    const parsed = parseAnalysisV2Json(
      modelOutput.raw
    );

    if (parsed === null) {
      return {
        ok: false,
        status: 502,
        response: {
          status: "error",
          reason:
            "Analysis V2 returned an unusable response.",
        },
      };
    }

    const resultValidation =
      validateAnalysisV2Result(
        parsed,
        inputValidation.script
      );

    if (!resultValidation.ok) {
      if (attempt === 0) {
        currentUserPrompt =
          buildAnalysisV2RetryUserPrompt(
            userPrompt,
            resultValidation.reason
          );
        continue;
      }

      return {
        ok: false,
        status: 502,
        response: {
          status: "error",
          reason:
            "Analysis V2 returned an invalid analysis.",
        },
      };
    }

    return {
      ok: true,
      status: 200,
      response: {
        status: "ok",
        result: resultValidation.value,
        modelUsed: modelOutput.modelUsed,
      },
    };
  }

  return {
    ok: false,
    status: 502,
    response: {
      status: "error",
      reason:
        "Analysis V2 returned an invalid analysis.",
    },
  };
}

export async function POST(
  request: Request
): Promise<Response> {
  const contentType =
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() ?? "";

  if (contentType !== "application/json") {
    return Response.json(
      {
        status: "error",
        reason:
          "Unsupported Content-Type. Use application/json.",
      } satisfies AnalysisV2ErrorResponse,
      {
        status: 415,
      }
    );
  }

  let body: unknown;

  try {
    body = await readJsonBodyWithLimit(request);
  } catch (error) {
    if (
      error instanceof RequestBodyTooLargeError
    ) {
      return Response.json(
        {
          status: "error",
          reason: "Request body is too large.",
        } satisfies AnalysisV2ErrorResponse,
        {
          status: 413,
        }
      );
    }

    return Response.json(
      {
        status: "error",
        reason: "Invalid JSON request body.",
      } satisfies AnalysisV2ErrorResponse,
      {
        status: 400,
      }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return Response.json(
      {
        status: "error",
        reason: "Request body must be an object.",
      } satisfies AnalysisV2ErrorResponse,
      {
        status: 400,
      }
    );
  }

  const record = body as Record<string, unknown>;

  const inputValidation =
    validateAnalysisV2Input(
      record.script,
      record.title
    );

  if (!inputValidation.ok) {
    return Response.json(
      {
        status: "error",
        reason: inputValidation.reason,
      } satisfies AnalysisV2ErrorResponse,
      {
        status: 400,
      }
    );
  }

  const rateLimit = consumeAnalysisV2RateLimit(
    getClientIdentifier(request)
  );

  if (!rateLimit.allowed) {
    return Response.json(
      {
        status: "error",
        reason:
          "Too many Analysis V2 requests. Please try again later.",
      } satisfies AnalysisV2ErrorResponse,
      {
        status: 429,
        headers: {
          "Retry-After": String(
            rateLimit.retryAfterSeconds
          ),
        },
      }
    );
  }

  const result = await runAnalysisV2(
    inputValidation.script,
    inputValidation.title
  );

  return Response.json(result.response, {
    status: result.status,
  });
}
