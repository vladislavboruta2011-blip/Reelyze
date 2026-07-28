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
import {
  createOpenAICompetitorAnalysisModelCaller,
  runCompetitorScriptAnalysis,
  type CompetitorAnalysisModelCaller,
} from "@/lib/competitor-scripts/analysis/provider";
import type {
  AnalysisLocale,
  CompetitorScriptAnalysis,
} from "@/lib/competitor-scripts/analysis/types";
import { getServerLocale } from "@/lib/server-locale";

// Validates and normalizes a submitted YouTube URL, retrieves and
// normalizes its transcript via the Supadata provider, then — once a
// transcript is available — runs the merged competitor analysis provider
// over it. A transcript-stage failure (bad request, provider error, rate
// limit) never reaches the analysis stage; a transcript success always
// returns its transcript even if analysis itself degrades (oversized
// transcript, invalid model output, or an unavailable/misconfigured
// analysis provider) — analysis is additive, never a reason to discard an
// already-successful transcript fetch.
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

// The exact three provider-level failure codes from
// lib/competitor-scripts/analysis/provider.ts's CompetitorAnalysisProviderResult,
// reused verbatim rather than re-mapped — a missing/blank OPENAI_API_KEY is
// deliberately also reported as "analysis_unavailable" (see
// resolveDefaultAnalysisModelCaller below), the same safe code a genuine
// runtime provider failure produces, so the client never learns whether
// the cause was configuration or a transient failure.
type AnalysisErrorCode =
  | "transcript_too_long_for_analysis"
  | "analysis_invalid_response"
  | "analysis_unavailable";

// analysis/analysisError are additive and mutually exclusive by
// construction (see runAnalysisStage below) — the existing PR9 frontend's
// isValidSuccessPayload only inspects ok/input/transcript and ignores
// unknown fields, so this never breaks its parsing. status stays
// "transcript_ready" for every case where analysis isn't a real validated
// result (including every analysisError case) and only becomes
// "analysis_ready" when `analysis` is genuinely populated.
type AnalyzeSuccessResponse = {
  ok: true;
  input: {
    videoId: string;
    canonicalUrl: string;
    sourceFormat: YouTubeUrlSourceFormat;
  };
  transcript: TranscriptResponseDTO;
  analysis: CompetitorScriptAnalysis | null;
  analysisError: AnalysisErrorCode | null;
  status: "transcript_ready" | "analysis_ready";
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

// Same composition boundary/shape as resolveDefaultTranscriptProvider
// above, for OPENAI_API_KEY instead — the second and only other env var
// this module reads. Never instantiates a second custom OpenAI flow: the
// only thing this does is compose PR 10B's own factory with a resolved
// key, exactly as PR 10B's provider.ts intended when it deliberately kept
// env access out of itself.
function resolveDefaultAnalysisModelCaller(): CompetitorAnalysisModelCaller | null {
  const rawKey = process.env.OPENAI_API_KEY;

  if (typeof rawKey !== "string") {
    return null;
  }

  const apiKey = rawKey.trim();

  if (apiKey.length === 0) {
    return null;
  }

  return createOpenAICompetitorAnalysisModelCaller({ apiKey });
}

// Analysis locale is resolved from the request/application locale, never
// guessed from the transcript's own language. An explicit body `locale`
// field (validated to exactly "en" or "ru") takes priority when present;
// otherwise falls back to the app-wide locale cookie already used
// elsewhere (lib/server-locale.ts), which itself only ever resolves to
// "en" or "ru" today (normalizeApiLocale defaults to LAUNCHED_LOCALES).
// An invalid/unsupported body value is silently ignored, never a request
// rejection — matching how every other unrecognized body field already
// behaves in this route.
function resolveExplicitAnalysisLocale(rawLocale: unknown): AnalysisLocale | null {
  return rawLocale === "en" || rawLocale === "ru" ? rawLocale : null;
}

function toAnalysisLocale(locale: string): AnalysisLocale {
  return locale === "ru" ? "ru" : "en";
}

// getServerLocale() reads next/headers's cookies(), which Next.js only
// provides inside a real request scope — always true for a genuine HTTP
// request dispatched to this Route Handler by Next.js itself, so this
// uses the framework's supported API directly with no special-casing.
async function resolveApplicationAnalysisLocale(): Promise<AnalysisLocale> {
  return toAnalysisLocale(await getServerLocale());
}

// The locale for a request is either an already-resolved value (the
// common case in tests, and whenever the request body specified one
// explicitly) or a resolver invoked lazily. Laziness matters: resolving
// the application locale has a real cost (a cookie read) that should
// only ever happen once analysis is actually about to run — exactly
// mirroring how modelCaller/OPENAI_API_KEY resolution below is already
// deferred until after a successful transcript, never attempted for a
// request that fails earlier (bad input, no SUPADATA_API_KEY, rate
// limited, a transcript provider error). This also means a test that
// only cares about transcript-stage behavior never needs to supply a
// working locale resolver at all.
type AnalysisLocaleInput = AnalysisLocale | (() => Promise<AnalysisLocale>);

async function resolveAnalysisLocaleInput(input: AnalysisLocaleInput): Promise<AnalysisLocale> {
  return typeof input === "function" ? input() : input;
}

// The one seam between a successful transcript and the analysis provider.
// Called at most once per request, exactly once per successful transcript
// — never looped or retried at this layer; PR 10B's provider owns its own
// bounded (<=2 call) retry internally. A missing/unconfigured analysis
// model caller short-circuits to the same "analysis_unavailable" outcome
// a real provider failure would produce, without ever invoking the model.
async function runAnalysisStage(
  transcript: NormalizedTranscript,
  localeInput: AnalysisLocaleInput,
  modelCaller: CompetitorAnalysisModelCaller | null
): Promise<{ analysis: CompetitorScriptAnalysis | null; analysisError: AnalysisErrorCode | null }> {
  if (!modelCaller) {
    return { analysis: null, analysisError: "analysis_unavailable" };
  }

  const locale = await resolveAnalysisLocaleInput(localeInput);
  const outcome = await runCompetitorScriptAnalysis({ transcript, locale, modelCaller });

  if (outcome.ok) {
    return { analysis: outcome.analysis, analysisError: null };
  }

  return { analysis: null, analysisError: outcome.code };
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

// The one seam between request validation and transcript retrieval (and,
// once a transcript succeeds, analysis). transcriptProvider/modelCaller
// each default to the real, env-configured composition — tests inject
// fakes to cover success/error mapping with zero network access, while
// the missing-config and default-composition paths are exercised by
// calling this with no override and manipulating process.env directly.
// A transcript-stage failure returns before modelCaller — or `locale`, if
// it was given as a resolver function — is ever invoked: analysis never
// runs, no OPENAI_API_KEY read happens, and no locale resolution happens,
// for any request that never reaches a successful transcript.
export async function runCompetitorScriptsAnalyze(
  videoId: string,
  canonicalUrl: string,
  sourceFormat: YouTubeUrlSourceFormat,
  locale: AnalysisLocaleInput = "en",
  transcriptProvider?: TranscriptProvider,
  modelCaller?: CompetitorAnalysisModelCaller
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

  const { analysis, analysisError } = await runAnalysisStage(
    result.transcript,
    locale,
    modelCaller ?? resolveDefaultAnalysisModelCaller()
  );

  return {
    status: 200,
    body: {
      ok: true,
      input: { videoId, canonicalUrl, sourceFormat },
      transcript: toTranscriptResponseDTO(result.transcript),
      analysis,
      analysisError,
      status: analysis ? "analysis_ready" : "transcript_ready",
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

    // The application-locale resolver is passed as a lazily-invoked
    // function, not called here — it only actually runs (and only then
    // reads the locale cookie) if the transcript succeeds and analysis is
    // about to happen, exactly like modelCaller/OPENAI_API_KEY resolution
    // below.
    const analysisLocale: AnalysisLocaleInput =
      resolveExplicitAnalysisLocale(rawBody.locale) ?? resolveApplicationAnalysisLocale;

    const outcome = await runCompetitorScriptsAnalyze(
      result.videoId,
      result.canonicalUrl,
      result.sourceFormat,
      analysisLocale
    );

    return jsonResponse(outcome.body, outcome.status);
  } catch (error) {
    console.error("Competitor Scripts analyze: unexpected error", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return errorResponse("internal_error", 500);
  }
}
