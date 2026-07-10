import OpenAI from "openai";

import {
  UnusableAIResponseError,
} from "../../../engine/improve-hook";
import {
  boundImproveScriptResult,
  buildImproveScriptDiagnosticResponse,
  parseImproveScriptResponse,
  shouldDiagnoseImproveScript,
  type ImproveScriptResult,
} from "../../../engine/improve-script";

export type {
  ImproveScriptResult,
} from "../../../engine/improve-script";

const MAX_REQUEST_BODY_BYTES = 16_384;
const AI_RATE_LIMIT_MAX_REQUESTS = 10;
const AI_RATE_LIMIT_WINDOW_MS = 60_000;
const AI_RATE_LIMIT_MAX_ENTRIES = 10_000;

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

const aiRateLimitEntries = new Map<string, RateLimitEntry>();

class RequestBodyTooLargeError extends Error {}

function buildErrorResponse(reason: string): ImproveScriptResult {
  return {
    status: "error",
    improvedScript: "AI script improvement is unavailable right now.",
    changes: [],
    reason,
  };
}

function getClientIdentifier(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const forwardedClient = forwardedFor
    ?.split(",")[0]
    ?.trim();

  return (
    forwardedClient ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown-client"
  );
}

function consumeAIRateLimit(
  clientIdentifier: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  for (const [key, entry] of aiRateLimitEntries) {
    if (now - entry.windowStartedAt >= AI_RATE_LIMIT_WINDOW_MS) {
      aiRateLimitEntries.delete(key);
    }
  }

  const existing = aiRateLimitEntries.get(clientIdentifier);

  if (
    !existing ||
    now - existing.windowStartedAt >= AI_RATE_LIMIT_WINDOW_MS
  ) {
    if (
      !existing &&
      aiRateLimitEntries.size >= AI_RATE_LIMIT_MAX_ENTRIES
    ) {
      const oldestKey = aiRateLimitEntries.keys().next().value;

      if (oldestKey !== undefined) {
        aiRateLimitEntries.delete(oldestKey);
      }
    }

    aiRateLimitEntries.set(clientIdentifier, {
      count: 1,
      windowStartedAt: now,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= AI_RATE_LIMIT_MAX_REQUESTS) {
    const remainingMs =
      AI_RATE_LIMIT_WINDOW_MS - (now - existing.windowStartedAt);

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

async function readJsonBodyWithLimit(req: Request): Promise<unknown> {
  const contentLength = req.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);

    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > MAX_REQUEST_BODY_BYTES
    ) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!req.body) {
    return JSON.parse("");
  }

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let rawBody = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      receivedBytes += value.byteLength;

      if (receivedBytes > MAX_REQUEST_BODY_BYTES) {
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

export async function POST(req: Request): Promise<Response> {
  const contentType =
    req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";

  if (contentType !== "application/json") {
    return Response.json(
      buildErrorResponse("Unsupported Content-Type. Use application/json."),
      { status: 415 }
    );
  }

  let body: unknown;

  try {
    body = await readJsonBodyWithLimit(req);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        buildErrorResponse("Request body is too large."),
        { status: 413 }
      );
    }

    return Response.json(
      buildErrorResponse("Invalid JSON request body."),
      { status: 400 }
    );
  }

  try {
    if (
      !body ||
      typeof body !== "object" ||
      !("script" in body) ||
      typeof (body as Record<string, unknown>).script !== "string"
    ) {
      return Response.json(
        buildErrorResponse("No script was provided."),
        { status: 400 }
      );
    }

    const requestBody = body as Record<string, unknown>;

    if ("title" in requestBody && typeof requestBody.title !== "string") {
      return Response.json(
        buildErrorResponse("Title must be a string."),
        { status: 400 }
      );
    }

    const script = (requestBody.script as string).trim();
    const title =
      typeof requestBody.title === "string"
        ? requestBody.title.trim()
        : "";

    if (script.length === 0) {
      return Response.json(
        buildErrorResponse("A non-empty script must be provided."),
        { status: 400 }
      );
    }

    if (script.length > 1000) {
      return Response.json(
        buildErrorResponse(
          "Script is too long. Keep it to 1,000 characters or less."
        ),
        { status: 400 }
      );
    }

    if (title.length > 200) {
      return Response.json(
        buildErrorResponse(
          "Title is too long. Keep it to 200 characters or less."
        ),
        { status: 400 }
      );
    }

    if (shouldDiagnoseImproveScript(script)) {
      return Response.json(buildImproveScriptDiagnosticResponse());
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return Response.json(
        buildErrorResponse(
          "AI script improvement is temporarily unavailable."
        ),
        { status: 503 }
      );
    }

    const rateLimit = consumeAIRateLimit(getClientIdentifier(req));

    if (!rateLimit.allowed) {
      return Response.json(
        buildErrorResponse(
          "Too many script improvement requests. Please try again later."
        ),
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const systemPrompt = `You are a YouTube Shorts script editor for Climpy.

Your task is to improve the entire script, not only the first line.

Use only information already present in the original script or title.
Do not invent facts, numbers, measurements, people, outcomes, causes, examples, or claims.
Do not add unsupported context.

Improve the script using these rules:
- Make the opening visual, simple, concrete, and immediately understandable.
- Treat the first 1–2 seconds like the thumbnail of the Short.
- Confirm the expectation created by the title and opening.
- Preserve the original topic, facts, scope, uncertainty, and meaning.
- Build clear context, stakes or payoff, and a curiosity gap.
- Use rehooks or open loops only when supported by the original material.
- Do not reveal the payoff too early if the rest would become filler.
- Remove filler, repetition, slow setup, generic claims, and unnecessary CTA lines.
- Keep the script natural, concise, and easy to say aloud.
- Prefer short sentences and simple words.
- Keep the rewrite suitable for a YouTube Short.
- Do not merely rewrite the hook. Improve the complete structure and delivery.
- Never fabricate a stronger story when the source material does not support one.

Return only valid JSON, with no markdown or code fences.

Return exactly this shape:
{
  "improvedScript": "<the complete rewritten script>",
  "changes": [
    "<specific change made>",
    "<specific change made>"
  ],
  "reason": "<specific explanation of why this full rewrite is stronger while preserving the original material>"
}`;

    const userPrompt = `Improve this complete YouTube Shorts script.

${title ? `Video title / topic:\n${title}\n\n` : ""}Original script:
${script}

Rewrite the full script using only the material above.
Do not invent any new facts, numbers, measurements, examples, causes, or outcomes.
Return only valid JSON matching the required schema.`;

    const openai = new OpenAI({
      apiKey,
      timeout: 15_000,
      maxRetries: 0,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 1_200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const result = parseImproveScriptResponse(raw, script);

    return Response.json(boundImproveScriptResult(result));
  } catch (error) {
    const upstreamStatus =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : undefined;

    if (error instanceof UnusableAIResponseError) {
      console.error("[improve-script] AI response was unusable.");

      return Response.json(
        buildErrorResponse(
          "Climpy could not generate a valid script improvement right now."
        ),
        { status: 502 }
      );
    }

    if (upstreamStatus === 401 || upstreamStatus === 403) {
      console.error("[improve-script] AI provider authentication failed.");

      return Response.json(
        buildErrorResponse(
          "AI script improvement is temporarily unavailable."
        ),
        { status: 503 }
      );
    }

    if (
      upstreamStatus === 429 ||
      (upstreamStatus !== undefined && upstreamStatus >= 500) ||
      error instanceof OpenAI.APIConnectionError
    ) {
      console.error("[improve-script] AI provider temporarily unavailable.");

      return Response.json(
        buildErrorResponse(
          "AI script improvement is temporarily unavailable."
        ),
        { status: 503 }
      );
    }

    console.error("[improve-script] request failed.");

    return Response.json(
      buildErrorResponse(
        "Climpy could not generate a custom script improvement right now."
      ),
      { status: 500 }
    );
  }
}
