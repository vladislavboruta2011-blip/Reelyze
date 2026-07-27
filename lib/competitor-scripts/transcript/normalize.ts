import { isValidYouTubeVideoId } from "@/lib/competitor-scripts/youtube-url";
import {
  createTranscriptError,
  type NormalizeTranscriptInput,
  type RawTranscriptSegment,
  type TranscriptProviderResult,
  type TranscriptSegment,
} from "@/lib/competitor-scripts/transcript/types";

// Conservative internal safety limits — no new dependencies. Exceeding
// any of these means the provider response is treated as untrustworthy
// as a whole (invalid_provider_response), never silently truncated.
export const MAX_SEGMENTS = 5000;
export const MAX_SEGMENT_TEXT_LENGTH = 2000;
export const MAX_TRANSCRIPT_TEXT_LENGTH = 100_000;
export const MAX_LANGUAGE_CODE_LENGTH = 35;

const HTML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|#39|apos|nbsp);/g;
const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

// Requires a letter (optionally preceded by "/") immediately after "<",
// so this only matches things shaped like an actual tag — "<b>",
// "</b>", "<br>", "<div class=\"x\">". It deliberately does NOT match a
// bare "<" followed by a space or digit, which is what lets ordinary
// text such as "5 < 10 and 10 > 5" survive untouched instead of being
// misread as a malformed tag.
const TAG_PATTERN = /<\/?[a-zA-Z][^<>]*>/g;

// script/style elements are removed as a whole block — tag delimiters
// AND their inner content — so code like "<script>alert(1)</script>"
// can never leave its payload behind as visible transcript text. This
// only matches a *closed* block; see the module-level comment on
// normalizeSegmentText for the documented behavior of an unclosed one.
const SCRIPT_OR_STYLE_BLOCK_PATTERN = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

function stripHtml(value: string): string {
  return value.replace(SCRIPT_OR_STYLE_BLOCK_PATTERN, " ").replace(TAG_PATTERN, " ");
}

// A small, fixed entity set is decoded — not a general HTML parser — so
// this stays dependency-free and can never execute or interpret markup.
// This is a single bounded pass: entities are not decoded recursively,
// so a double-encoded sequence like "&amp;lt;b&amp;gt;" decodes only one
// level (to the literal text "&lt;b&gt;") and is never fully unwrapped
// into a real "<b>" tag.
function decodeHtmlEntities(value: string): string {
  return value.replace(HTML_ENTITY_PATTERN, (match) => HTML_ENTITY_MAP[match] ?? match);
}

type TextNormalizationResult =
  | { kind: "invalid" }
  | { kind: "text"; text: string };

// Tags are stripped BOTH before and after entity decoding. Stripping
// only before decoding is not sufficient: an encoded sequence such as
// "&lt;script&gt;" contains no literal "<" or ">" characters, so a
// pre-decode-only strip leaves it untouched, and decoding it afterward
// would reintroduce literal markup ("<script>") into text that was
// already supposed to be sanitized. Running stripHtml a second time,
// after decoding, guarantees any markup that only existed in encoded
// form is removed too — while the earlier pre-decode pass still handles
// literal markup that was never encoded at all (and pass/fail identical
// script/style content in either order).
//
// A bare "<" or ">" that never combines with its counterpart into a
// complete tag-shaped sequence is left as literal text. This is what
// allows ordinary text like "5 < 10 and 10 > 5" to survive unchanged;
// the accepted tradeoff is that a genuinely malformed/unclosed tag
// fragment (e.g. "<b world" with no closing ">") is also preserved as
// inert text rather than guessed at and removed — this module does not
// attempt general-purpose HTML sanitization.
function normalizeSegmentText(value: unknown): TextNormalizationResult {
  if (typeof value !== "string") {
    return { kind: "invalid" };
  }

  const strippedBeforeDecode = stripHtml(value);
  const decoded = decodeHtmlEntities(strippedBeforeDecode);
  const strippedAfterDecode = stripHtml(decoded);
  const collapsed = strippedAfterDecode.replace(/\s+/g, " ").trim();

  return { kind: "text", text: collapsed };
}

function normalizeTimestampMs(value: unknown): number | null {
  if (typeof value !== "number") {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  if (value < 0) {
    return null;
  }

  const rounded = Math.round(value);

  if (!Number.isSafeInteger(rounded)) {
    return null;
  }

  return rounded;
}

// Documented rule: a language code that is missing, null, or blank after
// trimming is all treated identically as "unknown" (null) — not as an
// error. Only a non-blank code that is too long is rejected.
function normalizeLanguageCode(
  value: unknown
): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false };
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }

  if (trimmed.length > MAX_LANGUAGE_CODE_LENGTH) {
    return { ok: false };
  }

  return { ok: true, value: trimmed };
}

function normalizeIsAutoGenerated(
  value: unknown
): { ok: true; value: boolean | null } | { ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== "boolean") {
    return { ok: false };
  }

  return { ok: true, value };
}

type SegmentOutcome =
  | { kind: "keep"; segment: TranscriptSegment; end: number | null }
  | { kind: "omit" }
  | { kind: "reject" };

// Documented rule: structural/type violations (wrong types, out-of-range
// numbers, over-length text) reject the *entire* response, since they
// indicate the provider payload as a whole cannot be trusted. Only
// content that is a valid string but normalizes down to nothing (pure
// whitespace or HTML-only) is silently omitted as a single segment.
function parseRawSegment(raw: unknown): SegmentOutcome {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { kind: "reject" };
  }

  const candidate = raw as RawTranscriptSegment;

  const textResult = normalizeSegmentText(candidate.text);

  if (textResult.kind === "invalid") {
    return { kind: "reject" };
  }

  const startMs = normalizeTimestampMs(candidate.startMs);

  if (startMs === null) {
    return { kind: "reject" };
  }

  let durationMs: number | null = null;

  if (candidate.durationMs !== undefined && candidate.durationMs !== null) {
    const parsedDuration = normalizeTimestampMs(candidate.durationMs);

    if (parsedDuration === null) {
      return { kind: "reject" };
    }

    durationMs = parsedDuration;
  }

  let end: number | null = null;

  if (durationMs !== null) {
    const sum = startMs + durationMs;

    if (!Number.isSafeInteger(sum)) {
      return { kind: "reject" };
    }

    end = sum;
  }

  if (textResult.text.length === 0) {
    return { kind: "omit" };
  }

  if (textResult.text.length > MAX_SEGMENT_TEXT_LENGTH) {
    return { kind: "reject" };
  }

  return {
    kind: "keep",
    segment: { text: textResult.text, startMs, durationMs },
    end,
  };
}

function invalidResponse(): TranscriptProviderResult {
  return { ok: false, error: createTranscriptError("invalid_provider_response") };
}

// Never throws. Every rejection — structural or limit-based — returns a
// typed invalid_provider_response result instead. This function never
// mutates `input.segments`; it only reads from it by index.
export function normalizeTranscript(
  input: NormalizeTranscriptInput
): TranscriptProviderResult {
  // Guard the top-level shape itself before touching any property — a
  // caller passing something other than an object (null, a primitive,
  // an array) must still get a typed result, never a thrown TypeError.
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return invalidResponse();
  }

  if (typeof input.videoId !== "string" || !isValidYouTubeVideoId(input.videoId)) {
    return invalidResponse();
  }

  const languageCodeResult = normalizeLanguageCode(input.languageCode);

  if (!languageCodeResult.ok) {
    return invalidResponse();
  }

  const isAutoGeneratedResult = normalizeIsAutoGenerated(input.isAutoGenerated);

  if (!isAutoGeneratedResult.ok) {
    return invalidResponse();
  }

  if (!Array.isArray(input.segments)) {
    return invalidResponse();
  }

  if (input.segments.length === 0) {
    return invalidResponse();
  }

  if (input.segments.length > MAX_SEGMENTS) {
    return invalidResponse();
  }

  const kept: Array<{ segment: TranscriptSegment; end: number | null }> = [];

  for (const rawSegment of input.segments) {
    const outcome = parseRawSegment(rawSegment);

    if (outcome.kind === "reject") {
      return invalidResponse();
    }

    if (outcome.kind === "omit") {
      continue;
    }

    kept.push({ segment: outcome.segment, end: outcome.end });
  }

  if (kept.length === 0) {
    return invalidResponse();
  }

  // Array.prototype.sort is a stable sort, so segments sharing the same
  // startMs automatically keep their original input order.
  kept.sort((a, b) => a.segment.startMs - b.segment.startMs);

  const seenKeys = new Set<string>();
  const finalSegments: TranscriptSegment[] = [];
  let durationMs: number | null = null;

  for (const entry of kept) {
    // Documented rule: exact duplicates (identical normalized text,
    // startMs, and durationMs) are removed, keeping only the first
    // occurrence in chronological order.
    const key = `${entry.segment.startMs}|${entry.segment.durationMs}|${entry.segment.text}`;

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    finalSegments.push(entry.segment);

    if (entry.end !== null && (durationMs === null || entry.end > durationMs)) {
      durationMs = entry.end;
    }
  }

  const text = finalSegments.map((segment) => segment.text).join(" ");

  if (text.length > MAX_TRANSCRIPT_TEXT_LENGTH) {
    return invalidResponse();
  }

  return {
    ok: true,
    transcript: {
      videoId: input.videoId,
      languageCode: languageCodeResult.value,
      isAutoGenerated: isAutoGeneratedResult.value,
      segments: finalSegments,
      text,
      durationMs,
    },
  };
}
