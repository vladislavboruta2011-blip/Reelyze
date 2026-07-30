import {
  normalizeYouTubeVideoUrl,
  type YouTubeUrlErrorCode,
} from "@/lib/competitor-scripts/youtube-url";
import { createSupadataTranscriptProvider } from "@/lib/competitor-scripts/transcript/supadata-provider";
import type {
  TranscriptErrorCode,
  TranscriptProvider,
} from "@/lib/competitor-scripts/transcript/types";
import {
  createOpenAICompetitorComparisonModelCaller,
  runCompetitorScriptComparison,
  type CompetitorComparisonModelCaller,
  type CompetitorComparisonProviderResult,
} from "@/lib/competitor-scripts/comparison/provider";
import type {
  ComparisonLocale,
  CompetitorScriptComparison,
} from "@/lib/competitor-scripts/comparison/types";
import { getServerLocale } from "@/lib/server-locale";

// Validates a submitted competitor YouTube URL and the caller's own script,
// retrieves and normalizes the competitor transcript via the Supadata
// provider, then — once a transcript is available — runs the merged
// Compare provider (lib/competitor-scripts/comparison/provider.ts) over
// both real sources. Unlike Analyze, there is no independently valuable
// partial payload here (no transcript is ever returned to the caller), so
// a comparison-stage failure is a full request failure, not an additive
// degradation folded into a 200 — the one deliberate architectural
// difference from app/api/competitor-scripts/analyze/route.ts, chosen
// because Compare's only useful output is the comparison itself.
export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_URL_LENGTH = 2048;

// Stable, provider-agnostic error codes exposed to API callers. Never the
// same taxonomy as TranscriptErrorCode/CompetitorComparisonProviderResult's
// own codes — the transcript codes are mapped explicitly below (mirroring
// Analyze's own mapping exactly) and the provider's four failure codes are
// reused verbatim (mirroring how Analyze reuses AnalysisErrorCode).
type PublicTranscriptErrorCode =
  | "transcript_not_found"
  | "transcript_unavailable"
  | "video_unavailable"
  | "transcript_rate_limited"
  | "transcript_timeout"
  | "transcript_service_unavailable"
  | "invalid_transcript_response";

// The exact four provider-level failure codes from
// CompetitorComparisonProviderResult, reused verbatim rather than
// re-mapped — neither carries a free-text reason, so nothing internal
// (validator detail, raw model output) can leak through this union.
type ComparisonErrorCode = Exclude<
  CompetitorComparisonProviderResult,
  { ok: true }
>["code"];

type CompareRequestErrorCode =
  | "invalid_content_type"
  | "body_too_large"
  | "invalid_json"
  | "invalid_body"
  | "missing_user_script"
  | "user_script_not_string"
  | "empty_user_script"
  | "missing_url"
  | "url_not_string"
  | "url_too_long"
  | "internal_error"
  | "rate_limited"
  | YouTubeUrlErrorCode
  | PublicTranscriptErrorCode;

type CompareErrorCode = CompareRequestErrorCode | ComparisonErrorCode;

// sourceMeta is assembled entirely from route-known, deterministic values
// (the validated URL result, the transcript's own durationMs, and the
// original submitted script length) — never model-generated. The full
// transcript is never included here or anywhere else in this response.
type CompareSuccessResponse = {
  ok: true;
  comparison: CompetitorScriptComparison;
  sourceMeta: {
    videoId: string;
    canonicalUrl: string;
    durationMs: number | null;
    userScriptCharacterCount: number;
  };
};

type CompareErrorResponse = {
  ok: false;
  error: {
    code: CompareErrorCode;
    message: string;
  };
};

const ERROR_MESSAGES: Record<CompareErrorCode, string> = {
  invalid_content_type: "Unsupported content type. Use application/json.",
  body_too_large: "Request body is too large.",
  invalid_json: "Request body is not valid JSON.",
  invalid_body: "Request body must be a JSON object.",
  missing_user_script: "Your own script is required.",
  user_script_not_string: "Your own script must be text.",
  empty_user_script: "Paste your own script to continue.",
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
  user_script_too_long_for_comparison: "Your script is too long to compare. Please shorten it.",
  competitor_transcript_too_long_for_comparison:
    "The competitor video's transcript is too long to compare.",
  comparison_invalid_response: "We couldn't generate a comparison right now. Please try again.",
  comparison_unavailable: "Comparison isn't available right now. Please try again shortly.",
};

class RequestBodyTooLargeError extends Error {}

// Local, per-instance abuse/cost guard — same shape, same client-identifier
// derivation, same bounding/cleanup, same Retry-After convention as the
// sibling analyze route (and the four other routes it itself documents
// copying from). A sixth copy of the same proven shape rather than a new
// design.
const COMPARE_RATE_LIMIT_MAX_REQUESTS = 10;
const COMPARE_RATE_LIMIT_WINDOW_MS = 60_000;
const COMPARE_RATE_LIMIT_MAX_ENTRIES = 10_000;

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

const compareRateLimitEntries = new Map<string, RateLimitEntry>();

function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedClient = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedClient ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown-client"
  );
}

function consumeCompareRateLimit(
  clientIdentifier: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  for (const [key, entry] of compareRateLimitEntries) {
    if (now - entry.windowStartedAt >= COMPARE_RATE_LIMIT_WINDOW_MS) {
      compareRateLimitEntries.delete(key);
    }
  }

  const existing = compareRateLimitEntries.get(clientIdentifier);

  if (!existing || now - existing.windowStartedAt >= COMPARE_RATE_LIMIT_WINDOW_MS) {
    if (!existing && compareRateLimitEntries.size >= COMPARE_RATE_LIMIT_MAX_ENTRIES) {
      const oldestKey = compareRateLimitEntries.keys().next().value;

      if (oldestKey !== undefined) {
        compareRateLimitEntries.delete(oldestKey);
      }
    }

    compareRateLimitEntries.set(clientIdentifier, { count: 1, windowStartedAt: now });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= COMPARE_RATE_LIMIT_MAX_REQUESTS) {
    const remainingMs = COMPARE_RATE_LIMIT_WINDOW_MS - (now - existing.windowStartedAt);

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
  body: CompareSuccessResponse | CompareErrorResponse,
  status: number
): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(code: CompareErrorCode, status: number): Response {
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

// Same composition boundary as Analyze's resolveDefaultTranscriptProvider —
// reads process.env fresh per call, never caches a singleton, never
// reveals to the caller whether "unavailable" means missing config or a
// real upstream failure.
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

// Same composition boundary, for OPENAI_API_KEY instead — composes the
// Compare provider's own factory with a resolved key. Never instantiates a
// second custom OpenAI flow.
function resolveDefaultCompareModelCaller(): CompetitorComparisonModelCaller | null {
  const rawKey = process.env.OPENAI_API_KEY;

  if (typeof rawKey !== "string") {
    return null;
  }

  const apiKey = rawKey.trim();

  if (apiKey.length === 0) {
    return null;
  }

  return createOpenAICompetitorComparisonModelCaller({ apiKey });
}

// Locale resolution is identical to Analyze's, deliberately — no
// Compare-specific behavior. An explicit body `locale` field (exactly "en"
// or "ru") takes priority when present; otherwise falls back to the
// app-wide locale cookie. An invalid/unsupported body value is silently
// ignored, never a request rejection, matching how every other
// unrecognized body field already behaves in this route.
function resolveExplicitCompareLocale(rawLocale: unknown): ComparisonLocale | null {
  return rawLocale === "en" || rawLocale === "ru" ? rawLocale : null;
}

function toCompareLocale(locale: string): ComparisonLocale {
  return locale === "ru" ? "ru" : "en";
}

async function resolveApplicationCompareLocale(): Promise<ComparisonLocale> {
  return toCompareLocale(await getServerLocale());
}

// Mirrors Analyze's AnalysisLocaleInput exactly: either an already-resolved
// value or a resolver invoked lazily, so the locale cookie is only ever
// read once a transcript has actually succeeded and comparison is about to
// run — never for a request that fails earlier.
type CompareLocaleInput = ComparisonLocale | (() => Promise<ComparisonLocale>);

async function resolveCompareLocaleInput(input: CompareLocaleInput): Promise<ComparisonLocale> {
  return typeof input === "function" ? input() : input;
}

function serviceUnavailableResult(): { status: number; body: CompareErrorResponse } {
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
// compile-time error, not a silent fallthrough. Identical mapping to
// Analyze's own — duplicated rather than imported, since Analyze's route
// does not export it.
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

// Every currently-defined comparison failure code is handled explicitly
// (no default branch), same discipline as mapTranscriptErrorCode above.
// Neither too-long code is retryable by definition; comparison_invalid_
// response and comparison_unavailable are the same two-outcome collapse
// the provider itself already makes (malformed JSON, empty output, and
// validator rejection all become comparison_invalid_response; a missing
// key or transient upstream failure both become comparison_unavailable).
function comparisonErrorStatus(code: ComparisonErrorCode): number {
  switch (code) {
    case "user_script_too_long_for_comparison":
      return 400;
    case "competitor_transcript_too_long_for_comparison":
      return 422;
    case "comparison_invalid_response":
      return 502;
    case "comparison_unavailable":
      return 503;
  }
}

// The one seam between request validation and transcript retrieval (and,
// once a transcript succeeds, comparison). transcriptProvider/modelCaller
// each default to the real, env-configured composition — tests inject
// fakes to cover success/error mapping with zero network access. userScript
// is passed through exactly as submitted (never trimmed) — trimming is
// only ever used to detect a missing/blank script at the request-parsing
// layer, never to alter what is validated against the 1000-character cap
// (enforced solely by the comparison provider's own checkComparisonInputSize
// — no second source of truth for that limit lives in this route) or sent
// to the model. A transcript-stage failure returns before modelCaller — or
// `locale`, if given as a resolver function — is ever invoked: comparison
// never runs, no OPENAI_API_KEY read happens, and no locale resolution
// happens, for any request that never reaches a successful transcript.
export async function runCompetitorScriptsCompare(
  userScript: string,
  videoId: string,
  canonicalUrl: string,
  locale: CompareLocaleInput = "en",
  transcriptProvider?: TranscriptProvider,
  modelCaller?: CompetitorComparisonModelCaller
): Promise<{ status: number; body: CompareSuccessResponse | CompareErrorResponse }> {
  const provider = transcriptProvider ?? resolveDefaultTranscriptProvider();

  if (!provider) {
    return serviceUnavailableResult();
  }

  let result: Awaited<ReturnType<TranscriptProvider["getTranscript"]>>;

  try {
    result = await provider.getTranscript({ videoId });
  } catch {
    // The provider contract promises it never throws, but this boundary
    // stays defensive regardless — any unexpected throw is treated exactly
    // like an unreachable service, never reflecting the exception back to
    // the caller.
    return serviceUnavailableResult();
  }

  if (!result.ok) {
    const mapped = mapTranscriptErrorCode(result.error.code);
    return {
      status: mapped.status,
      body: { ok: false, error: { code: mapped.code, message: ERROR_MESSAGES[mapped.code] } },
    };
  }

  const caller = modelCaller ?? resolveDefaultCompareModelCaller();

  if (!caller) {
    return {
      status: comparisonErrorStatus("comparison_unavailable"),
      body: {
        ok: false,
        error: { code: "comparison_unavailable", message: ERROR_MESSAGES.comparison_unavailable },
      },
    };
  }

  const resolvedLocale = await resolveCompareLocaleInput(locale);

  const outcome = await runCompetitorScriptComparison({
    userScript,
    competitorTranscript: result.transcript,
    locale: resolvedLocale,
    modelCaller: caller,
  });

  if (!outcome.ok) {
    return {
      status: comparisonErrorStatus(outcome.code),
      body: { ok: false, error: { code: outcome.code, message: ERROR_MESSAGES[outcome.code] } },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      comparison: outcome.comparison,
      sourceMeta: {
        videoId,
        canonicalUrl,
        durationMs: result.transcript.durationMs,
        // The original submitted length, not the trimmed length — trimming
        // is only ever used to detect a missing/blank script, never to
        // redefine what "the submitted script" means for this count.
        userScriptCharacterCount: userScript.length,
      },
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

    // Unknown properties on the body are silently ignored, matching the
    // sibling analyze route's own convention (it only ever inspects `url`
    // and `locale` on an otherwise-unvalidated object).
    const { userScript, competitorUrl } = rawBody;

    if (userScript === undefined || userScript === null) {
      return errorResponse("missing_user_script", 400);
    }

    if (typeof userScript !== "string") {
      return errorResponse("user_script_not_string", 400);
    }

    if (userScript.trim().length === 0) {
      return errorResponse("empty_user_script", 400);
    }

    if (competitorUrl === undefined || competitorUrl === null) {
      return errorResponse("missing_url", 400);
    }

    if (typeof competitorUrl !== "string") {
      return errorResponse("url_not_string", 400);
    }

    if (competitorUrl.length > MAX_URL_LENGTH) {
      return errorResponse("url_too_long", 400);
    }

    const urlResult = normalizeYouTubeVideoUrl(competitorUrl);

    if (!urlResult.ok) {
      return errorResponse(urlResult.code, 400);
    }

    // Safe, structural logging only — the raw submitted URL and the raw
    // user script are never logged, only the already-validated, non-
    // sensitive derived id/format and a plain character count.
    console.info("Competitor Scripts compare: request validated", {
      videoId: urlResult.videoId,
      sourceFormat: urlResult.sourceFormat,
      userScriptCharacterCount: userScript.length,
    });

    // Rate limit only after cheap validation, and strictly before any
    // SUPADATA_API_KEY/OPENAI_API_KEY resolution or provider construction —
    // an invalid request never consumes a client's quota, and a
    // rate-limited request never reaches (or reads keys for) either paid
    // provider call below.
    const rateLimit = consumeCompareRateLimit(getClientIdentifier(request));

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

    // The application-locale resolver is passed as a lazily-invoked
    // function, not called here — see resolveCompareLocaleInput above.
    const compareLocale: CompareLocaleInput =
      resolveExplicitCompareLocale(rawBody.locale) ?? resolveApplicationCompareLocale;

    const outcome = await runCompetitorScriptsCompare(
      userScript,
      urlResult.videoId,
      urlResult.canonicalUrl,
      compareLocale
    );

    return jsonResponse(outcome.body, outcome.status);
  } catch (error) {
    console.error("Competitor Scripts compare: unexpected error", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return errorResponse("internal_error", 500);
  }
}
