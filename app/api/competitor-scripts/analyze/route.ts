import {
  normalizeYouTubeVideoUrl,
  type YouTubeUrlErrorCode,
  type YouTubeUrlSourceFormat,
} from "@/lib/competitor-scripts/youtube-url";
import { createSupadataTranscriptProvider } from "@/lib/competitor-scripts/transcript/supadata-provider";
import type {
  NormalizedTranscript,
  TranscriptErrorCode,
  TranscriptProvider,
} from "@/lib/competitor-scripts/transcript/types";

// Validates and normalizes a submitted YouTube URL, then retrieves and
// normalizes its transcript via the Supadata provider. Does not analyze,
// score, or run AI over the transcript in any way — that is a future PR.
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4 * 1024;
const MAX_URL_LENGTH = 2048;

// Stable, provider-agnostic error codes exposed to API callers. Never the
// same taxonomy as TranscriptErrorCode — mapped explicitly below so an
// internal provider concept (e.g. an HTTP 202/206 distinction) never
// leaks into the public contract.
type PublicTranscriptErrorCode =
  | "transcript_not_found"
  | "transcript_unavailable"
  | "video_unavailable"
  | "transcript_rate_limited"
  | "transcript_timeout"
  | "transcript_service_unavailable"
  | "invalid_transcript_response";

type AnalyzeRequestErrorCode =
  | "invalid_content_type"
  | "body_too_large"
  | "invalid_json"
  | "invalid_body"
  | "missing_url"
  | "url_not_string"
  | "url_too_long"
  | "internal_error"
  | "rate_limited"
  | YouTubeUrlErrorCode
  | PublicTranscriptErrorCode;

// The approved transcript fields returned to a caller. videoId is
// intentionally omitted — input.videoId is already the canonical
// identity, so this avoids returning it twice.
type TranscriptResponseDTO = Omit<NormalizedTranscript, "videoId">;

type AnalyzeSuccessResponse = {
  ok: true;
  input: {
    videoId: string;
    canonicalUrl: string;
    sourceFormat: YouTubeUrlSourceFormat;
  };
  transcript: TranscriptResponseDTO;
  status: "transcript_ready";
};

type AnalyzeErrorResponse = {
  ok: false;
  error: {
    code: AnalyzeRequestErrorCode;
    message: string;
  };
};

const ERROR_MESSAGES: Record<AnalyzeRequestErrorCode, string> = {
  invalid_content_type: "Unsupported content type. Use application/json.",
  body_too_large: "Request body is too large.",
  invalid_json: "Request body is not valid JSON.",
  invalid_body: "Request body must be a JSON object.",
  missing_url: "A competitor video URL is required.",
  url_not_string: "The competitor video URL must be a string.",
  url_too_long: "The competitor video URL is too long.",
  empty: "Paste a competitor video URL to continue.",
  invalid_url: "That doesn't look like a valid URL.",
  unsupported_host: "This doesn't look like a public YouTube link.",
  unsupported_path: "This doesn't look like a public YouTube video or Shorts link.",
  missing_video_id: "This link is missing a video id.",
  invalid_video_id: "This link's video id doesn't look valid.",
  internal_error: "Something went wrong. Please try again.",
  transcript_not_found: "This video doesn't appear to have a transcript.",
  transcript_unavailable: "The transcript isn't available right now.",
  video_unavailable: "This video isn't available.",
  transcript_rate_limited: "Too many requests right now. Please try again shortly.",
  transcript_timeout: "The transcript request took too long. Please try again.",
  transcript_service_unavailable: "Transcript service is temporarily unavailable.",
  invalid_transcript_response: "The transcript data returned was invalid.",
  rate_limited: "Too many requests. Please try again shortly.",
};

class RequestBodyTooLargeError extends Error {}

// Local, per-instance abuse/cost guard for a route that now makes a
// paid/limited external call. Mirrors the identical pattern already used
// by app/api/analyze-v2/route.ts, app/api/ask-climpy/route.ts,
// app/api/improve/route.ts, and app/api/improve-script/route.ts — same
// Map shape, same client-identifier derivation, same bounding/cleanup, same
// Retry-After convention. No shared helper exists for this in the repo
// (each of those four routes duplicates it independently), so this is a
// fifth copy of the same proven shape rather than a new design.
//
// This is best-effort, per-server-instance protection only — the Map is
// local process memory, not a globally distributed quota. A deployment
// running multiple instances effectively multiplies the limit by the
// instance count, and the counters reset on every restart/deploy. That is
// an accepted, already-established tradeoff in this codebase (see the
// four sibling routes above), not a gap unique to this route.
const ANALYZE_RATE_LIMIT_MAX_REQUESTS = 10;
const ANALYZE_RATE_LIMIT_WINDOW_MS = 60_000;
const ANALYZE_RATE_LIMIT_MAX_ENTRIES = 10_000;

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

const analyzeRateLimitEntries = new Map<string, RateLimitEntry>();

// Never trusts a client-supplied JSON field for identity — only network-
// level proxy headers, exactly like the four sibling routes.
function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedClient = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedClient ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown-client"
  );
}

function consumeAnalyzeRateLimit(
  clientIdentifier: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  for (const [key, entry] of analyzeRateLimitEntries) {
    if (now - entry.windowStartedAt >= ANALYZE_RATE_LIMIT_WINDOW_MS) {
      analyzeRateLimitEntries.delete(key);
    }
  }

  const existing = analyzeRateLimitEntries.get(clientIdentifier);

  if (!existing || now - existing.windowStartedAt >= ANALYZE_RATE_LIMIT_WINDOW_MS) {
    if (!existing && analyzeRateLimitEntries.size >= ANALYZE_RATE_LIMIT_MAX_ENTRIES) {
      const oldestKey = analyzeRateLimitEntries.keys().next().value;

      if (oldestKey !== undefined) {
        analyzeRateLimitEntries.delete(oldestKey);
      }
    }

    analyzeRateLimitEntries.set(clientIdentifier, { count: 1, windowStartedAt: now });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= ANALYZE_RATE_LIMIT_MAX_REQUESTS) {
    const remainingMs = ANALYZE_RATE_LIMIT_WINDOW_MS - (now - existing.windowStartedAt);

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    };
  }

  existing.count += 1;

  return { allowed: true, retryAfterSeconds: 0 };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(
  body: AnalyzeSuccessResponse | AnalyzeErrorResponse,
  status: number
): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(code: AnalyzeRequestErrorCode, status: number): Response {
  return jsonResponse(
    { ok: false, error: { code, message: ERROR_MESSAGES[code] } },
    status
  );
}

async function readJsonBodyWithLimit(request: Request): Promise<unknown> {
  const body = await request.text();

  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    throw new RequestBodyTooLargeError();
  }

  return JSON.parse(body) as unknown;
}

// Server-side composition boundary: the only place in this module that
// reads process.env. Evaluated fresh per request (never cached at module
// load), so this never becomes a stale singleton. A missing, empty, or
// whitespace-only key resolves to null — the caller never learns the env
// var's name or that configuration (vs. an upstream failure) is at fault.
function resolveDefaultTranscriptProvider(): TranscriptProvider | null {
  const rawKey = process.env.SUPADATA_API_KEY;

  if (typeof rawKey !== "string") {
    return null;
  }

  const apiKey = rawKey.trim();

  if (apiKey.length === 0) {
    return null;
  }

  return createSupadataTranscriptProvider({ apiKey });
}

function serviceUnavailableResult(): { status: number; body: AnalyzeErrorResponse } {
  return {
    status: 503,
    body: {
      ok: false,
      error: {
        code: "transcript_service_unavailable",
        message: ERROR_MESSAGES.transcript_service_unavailable,
      },
    },
  };
}

// Every currently-defined TranscriptErrorCode is handled explicitly (no
// default branch) so adding a new one without updating this mapping is a
// compile-time error, not a silent fallthrough.
function mapTranscriptErrorCode(
  code: TranscriptErrorCode
): { code: PublicTranscriptErrorCode; status: number } {
  switch (code) {
    case "transcript_not_found":
      return { code: "transcript_not_found", status: 404 };
    case "transcript_disabled":
    case "transcript_unavailable":
    case "unsupported_language":
      return { code: "transcript_unavailable", status: 422 };
    case "video_unavailable":
      return { code: "video_unavailable", status: 404 };
    case "provider_rate_limited":
      return { code: "transcript_rate_limited", status: 429 };
    case "provider_timeout":
      return { code: "transcript_timeout", status: 504 };
    case "provider_unavailable":
      return { code: "transcript_service_unavailable", status: 503 };
    case "invalid_provider_response":
      return { code: "invalid_transcript_response", status: 502 };
  }
}

function toTranscriptResponseDTO(transcript: NormalizedTranscript): TranscriptResponseDTO {
  return {
    languageCode: transcript.languageCode,
    isAutoGenerated: transcript.isAutoGenerated,
    segments: transcript.segments,
    text: transcript.text,
    durationMs: transcript.durationMs,
  };
}

// The one seam between request validation and transcript retrieval.
// transcriptProvider defaults to the real, env-configured provider — tests
// inject a fake one to cover success/error mapping with zero network
// access, while the missing-config and default-composition paths are
// exercised by calling this with no override and manipulating
// process.env directly.
export async function runCompetitorScriptsAnalyze(
  videoId: string,
  canonicalUrl: string,
  sourceFormat: YouTubeUrlSourceFormat,
  transcriptProvider?: TranscriptProvider
): Promise<{ status: number; body: AnalyzeSuccessResponse | AnalyzeErrorResponse }> {
  const provider = transcriptProvider ?? resolveDefaultTranscriptProvider();

  if (!provider) {
    return serviceUnavailableResult();
  }

  let result: Awaited<ReturnType<TranscriptProvider["getTranscript"]>>;

  try {
    result = await provider.getTranscript({ videoId });
  } catch {
    // The provider contract promises it never throws, but this boundary
    // stays defensive regardless — any unexpected throw is treated
    // exactly like an unreachable service, never reflecting the
    // exception back to the caller.
    return serviceUnavailableResult();
  }

  if (!result.ok) {
    const mapped = mapTranscriptErrorCode(result.error.code);
    return {
      status: mapped.status,
      body: { ok: false, error: { code: mapped.code, message: ERROR_MESSAGES[mapped.code] } },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      input: { videoId, canonicalUrl, sourceFormat },
      transcript: toTranscriptResponseDTO(result.transcript),
      status: "transcript_ready",
    },
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const contentType =
      request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ??
      "";

    if (contentType !== "application/json") {
      return errorResponse("invalid_content_type", 415);
    }

    let rawBody: unknown;

    try {
      rawBody = await readJsonBodyWithLimit(request);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return errorResponse("body_too_large", 413);
      }
      return errorResponse("invalid_json", 400);
    }

    if (!isPlainObject(rawBody)) {
      return errorResponse("invalid_body", 400);
    }

    const { url } = rawBody;

    if (url === undefined || url === null) {
      return errorResponse("missing_url", 400);
    }

    if (typeof url !== "string") {
      return errorResponse("url_not_string", 400);
    }

    if (url.length > MAX_URL_LENGTH) {
      return errorResponse("url_too_long", 400);
    }

    const result = normalizeYouTubeVideoUrl(url);

    if (!result.ok) {
      return errorResponse(result.code, 400);
    }

    // Safe, structural logging only — the raw submitted URL is never
    // logged, only the already-validated, non-sensitive derived id.
    console.info("Competitor Scripts analyze: request validated", {
      videoId: result.videoId,
      sourceFormat: result.sourceFormat,
    });

    // Rate limit only after cheap validation, and strictly before any
    // SUPADATA_API_KEY resolution or provider construction — an invalid
    // request never consumes a client's quota, and a rate-limited request
    // never reaches (or reads the key for) the paid provider call below.
    const rateLimit = consumeAnalyzeRateLimit(getClientIdentifier(request));

    if (!rateLimit.allowed) {
      return Response.json(
        {
          ok: false,
          error: { code: "rate_limited", message: ERROR_MESSAGES.rate_limited },
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const outcome = await runCompetitorScriptsAnalyze(
      result.videoId,
      result.canonicalUrl,
      result.sourceFormat
    );

    return jsonResponse(outcome.body, outcome.status);
  } catch (error) {
    console.error("Competitor Scripts analyze: unexpected error", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return errorResponse("internal_error", 500);
  }
}
