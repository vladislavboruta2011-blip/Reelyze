import { isValidYouTubeVideoId } from "@/lib/competitor-scripts/youtube-url";
import { normalizeTranscript } from "@/lib/competitor-scripts/transcript/normalize";
import {
  createTranscriptError,
  type NormalizeTranscriptInput,
  type TranscriptErrorCode,
  type TranscriptProvider,
  type TranscriptProviderResult,
} from "@/lib/competitor-scripts/transcript/types";

// Server-only Supadata transcript adapter. This module never reads
// process.env itself — the API key is always supplied explicitly by a
// caller (a future composition layer), so importing this file can never
// fail or behave differently based on environment state, and it can
// never accidentally end up in a client bundle expecting a
// NEXT_PUBLIC_* value.
//
// Endpoint and contract verified directly against Supadata's official
// docs (docs.supadata.ai) at implementation time — see the PR report for
// the full verified request/response/error contract and the documented
// differences from the original task summary (notably: transcript
// unavailability is HTTP 206, not a 4xx/5xx; videos over ~20 minutes
// return an HTTP 202 job id instead of a synchronous result).

const SUPADATA_TRANSCRIPT_ENDPOINT = "https://api.supadata.ai/v1/transcript";

const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 10_000;

// Conservative response-body cap. Mirrors this repo's existing request-
// body-limit convention (read fully, then check actual byte length)
// rather than introducing a new streaming-reader pattern this codebase
// doesn't otherwise use. A Content-Length pre-check avoids buffering an
// obviously-oversized body at all when the header is present and honest.
const MAX_RESPONSE_BYTES = 1_500_000;

export type SupadataProviderConfig = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function resolveTimeoutMs(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(timeoutMs)));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResult(code: TranscriptErrorCode): TranscriptProviderResult {
  return { ok: false, error: createTranscriptError(code) };
}

type BodyReadResult = { ok: true; json: unknown } | { ok: false };

// Applies the same Content-Type / size / parse discipline to every
// response, success or error, so a malformed or oversized body can never
// be reflected, and so error-status mapping (see mapErrorStatus) never
// actually depends on this succeeding — status code alone drives that
// decision, this is only used to build a normalizer input on success.
async function readJsonBodySafely(response: Response): Promise<BodyReadResult> {
  const contentType =
    response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";

  if (contentType !== "application/json") {
    return { ok: false };
  }

  const contentLengthHeader = response.headers.get("content-length");

  if (contentLengthHeader !== null) {
    const declaredLength = Number(contentLengthHeader);

    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      return { ok: false };
    }
  }

  let text: string;

  try {
    text = await response.text();
  } catch {
    return { ok: false };
  }

  if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) {
    return { ok: false };
  }

  if (text.length === 0) {
    return { ok: false };
  }

  try {
    return { ok: true, json: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

// Every currently-documented Supadata error code maps to one fixed HTTP
// status, so branching on status alone is equivalent to branching on the
// documented error code — and unlike code-based branching, it still
// produces a correct, safe classification even if the error body is
// malformed, HTML, or unparseable, since the body is never required.
//
// 401/403 (unauthorized/forbidden) and 402 (upgrade-required) all map to
// provider_unavailable — this never reveals to a caller that a key is
// invalid or a plan needs upgrading, which are operator-facing concerns,
// not something to surface as a specific user-facing error.
function mapErrorStatus(status: number): TranscriptErrorCode {
  switch (status) {
    case 401:
    case 402:
    case 403:
      return "provider_unavailable";
    case 404:
      return "video_unavailable";
    case 429:
      return "provider_rate_limited";
    case 400:
      return "invalid_provider_response";
    default:
      return status >= 500 ? "provider_unavailable" : "invalid_provider_response";
  }
}

// Maps one raw Supadata content chunk into the shape normalizeTranscript
// expects. This performs no validation of its own — it only renames
// fields (offset -> startMs, duration -> durationMs) and never throws,
// even for a completely malformed chunk. All real validation (types,
// ranges, HTML stripping, limits) happens inside normalizeTranscript,
// which is the single place that logic is allowed to live.
function toRawSegment(chunk: unknown): { text: unknown; startMs: unknown; durationMs: unknown } {
  if (!isPlainObject(chunk)) {
    return { text: undefined, startMs: undefined, durationMs: undefined };
  }

  return {
    text: chunk.text,
    startMs: chunk.offset,
    durationMs: chunk.duration,
  };
}

function buildNormalizerInput(videoId: string, json: unknown): NormalizeTranscriptInput {
  const content = isPlainObject(json) ? json.content : undefined;
  const languageCode = isPlainObject(json) && typeof json.lang === "string" ? json.lang : undefined;

  return {
    videoId,
    languageCode,
    // Supadata's response schema has no field indicating whether a
    // caption is YouTube's own auto-generated track or a manually
    // authored one — mode=native only tells us it isn't AI-generated by
    // Supadata itself, which is a different distinction. Left null
    // because this cannot be determined unambiguously from the data we
    // receive.
    isAutoGenerated: null,
    segments: Array.isArray(content) ? content.map(toRawSegment) : content,
  };
}

export function createSupadataTranscriptProvider(
  config: SupadataProviderConfig
): TranscriptProvider {
  if (typeof config.apiKey !== "string" || config.apiKey.trim().length === 0) {
    throw new Error("createSupadataTranscriptProvider requires a non-empty apiKey.");
  }

  const apiKey = config.apiKey.trim();
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const timeoutMs = resolveTimeoutMs(config.timeoutMs);

  return {
    async getTranscript({ videoId }): Promise<TranscriptProviderResult> {
      if (typeof videoId !== "string" || !isValidYouTubeVideoId(videoId)) {
        return errorResult("invalid_provider_response");
      }

      const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

      const requestUrl = new URL(SUPADATA_TRANSCRIPT_ENDPOINT);
      requestUrl.searchParams.set("url", canonicalUrl);
      // Chunked, timestamped output (not plain text) — required to
      // populate TranscriptSegment.startMs/durationMs.
      requestUrl.searchParams.set("text", "false");
      // Disables Supadata's own AI-generation fallback: only an
      // existing (native) caption track is ever returned. See the PR
      // report for what this does and does not tell us about the
      // caption's origin.
      requestUrl.searchParams.set("mode", "native");
      // A fixed provider-internal default, never derived from either
      // product's own UI locale (Compare's en/ru output-language toggle
      // has no relationship to a competitor video's spoken language).
      // Supadata falls back gracefully to its own "first available
      // language" behavior when no English track exists for a video, so
      // this never introduces a new failure mode — it only fixes which
      // language is chosen when multiple official tracks exist (e.g. a
      // professionally multi-captioned video whose "first available"
      // track is not the original English one).
      requestUrl.searchParams.set("lang", "en");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        let response: Response;

        try {
          response = await fetchImpl(requestUrl.toString(), {
            method: "GET",
            headers: {
              "x-api-key": apiKey,
              Accept: "application/json",
            },
            signal: controller.signal,
            // Never follow a redirect: Supadata redirecting this request
            // would otherwise carry the x-api-key header to an
            // unintended origin. "error" makes fetch reject instead,
            // which is handled by the catch block below like any other
            // transport failure.
            redirect: "error",
          });
        } catch {
          // We never inspect the caught error's type or message (never
          // logged, never reflected) — only whether OUR timer is what
          // aborted the request. That is the only source of abort this
          // function ever triggers, so any other abort/rejection is
          // treated conservatively as a generic transport failure
          // rather than assumed to be a timeout.
          if (controller.signal.aborted) {
            return errorResult("provider_timeout");
          }

          return errorResult("provider_unavailable");
        }

        if (response.status === 206) {
          return errorResult("transcript_unavailable");
        }

        if (response.status === 202) {
          // Async job flow (videos over ~20 minutes) is not implemented
          // in this PR — see the PR report. provider_unavailable is a
          // retryable, honest "cannot answer synchronously" signal.
          return errorResult("provider_unavailable");
        }

        if (!response.ok) {
          return errorResult(mapErrorStatus(response.status));
        }

        const body = await readJsonBodySafely(response);

        if (!body.ok) {
          return errorResult("invalid_provider_response");
        }

        return normalizeTranscript(buildNormalizerInput(videoId, body.json));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
