// Deterministic, dependency-free grounding and safety checks over already-
// generated candidate text. No NLP library, no network access — every
// function here is a pure string/regex check against the real transcript
// or a fixed pattern list. Used by validate.ts; never calls OpenAI itself.

import type { NormalizedTranscript } from "../transcript/types";

// ── Performance-claim guardrail ───────────────────────────────────────────
// Prohibited: any assertion presented as an observed fact about real
// viewer/audience behavior or measured platform performance. The word
// "retention" itself is never blocked — the product already uses it as a
// score label; only claims of *observed* performance are prohibited.
// Allowed: hedged, structural language ("may create drop-off risk",
// "creates curiosity", "delays the payoff").
const PERFORMANCE_CLAIM_PATTERNS: RegExp[] = [
  /\b(viewers?|audience)\s+(?:actually\s+)?(watched|left|dropped|stayed|retained|abandoned)\b/i,
  /\bwent\s+viral\b/i,
  /\b\d[\d,.]*\s*[km]?\+?\s*(views?|likes?|comments?|subscribers?|shares?)\b/i,
  /\balgorithm\s+(rewarded|favou?red|pushed|boosted|recommended)\b/i,
  /\b(ctr|click-?through(?:\s+rate)?)\s+(improved|increased|rose|grew|jumped|went\s+up)\b/i,
  /\b(improved|increased|boosted|drove\s+up)\s+(the\s+)?(ctr|click-?through(?:\s+rate)?)\b/i,
  /\bretained\s+\d+\s*%/i,
  /\bthis\s+(got|received|earned|generated)\s+\d/i,
  /\b(unlike|better\s+than|compared\s+to|more\s+than)\s+(most|typical|other)\b/i,
  /\bwatch\s*time\b/i,
  /\bdrop-?off\s+(?:actually\s+)?occurred\b/i,
];

export function findPerformanceClaimViolation(text: string): string | null {
  for (const pattern of PERFORMANCE_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

// ── Numeric grounding ──────────────────────────────────────────────────────
// Same token shape as engine/analysis-v2-validation.ts's extractNumberTokens
// (digit sequences, optional decimal, optional %, commas stripped for
// comparison) — reused verbatim rather than reinvented. Scoped by call site
// (validate.ts only calls this on free-text prose fields, never on scores,
// timestamps, or schemaVersion), not by anything inside this function.
function extractNumberTokens(value: string): string[] {
  return (value.match(/\d+(?:[.,]\d+)?%?/g) ?? []).map((token) =>
    token.replace(/,/g, "")
  );
}

// A number in prose is also grounded when it's a deterministic timing
// value derived from the transcript's own segment/duration metadata —
// bake-off evidence showed models legitimately citing real timestamps
// ("arrives at 16200ms", "16.2 seconds", "16 seconds", a video's real
// "32 second" duration) that would otherwise be flagged as invented facts
// purely because timestamps never appear as literal digits in
// transcript.text (spoken words only). Every value here traces back to a
// real segment.startMs, segment.startMs + durationMs, or
// transcript.durationMs from the INPUT transcript — never the candidate's
// own claimed evidence (that would be a circular, self-validating
// loophole), never an arbitrary tolerance/rounding window.
//
// Exactly three representations per real millisecond value:
//   - the millisecond value itself ("16200")
//   - an exact one-decimal-second conversion, only when the millisecond
//     value is a multiple of 100 — never an approximation ("16.2")
//   - a floored whole-second value, matching how elapsed time is
//     normally spoken/displayed (a video player showing "0:16" at
//     16200ms) ("16")
// Deliberately not also adding a rounded whole-second value: floor alone
// already covers every observed bake-off case, and adding a second
// rounding strategy would needlessly widen the accepted set.
//
// ms === 0 is excluded entirely: the first segment's startMs is almost
// always 0, and both its exact-ms and floor-seconds representations
// collapse to the literal digit "0" — treating that as universally
// grounded would make the single most common bare digit in ordinary
// English prose ("0 percent", "starts from 0", etc.) pass unconditionally
// in nearly every transcript. A "0 seconds" timing citation is
// degenerate/uninformative, so excluding it costs nothing real.
function collectGroundedTimingTokens(transcript: NormalizedTranscript): Set<string> {
  const millisecondValues = new Set<number>();

  for (const segment of transcript.segments) {
    millisecondValues.add(segment.startMs);
    if (segment.durationMs !== null) {
      millisecondValues.add(segment.startMs + segment.durationMs);
    }
  }

  if (transcript.durationMs !== null) {
    millisecondValues.add(transcript.durationMs);
  }

  const tokens = new Set<string>();

  for (const ms of millisecondValues) {
    if (ms === 0) {
      continue;
    }

    tokens.add(String(ms));

    if (ms % 100 === 0) {
      tokens.add((ms / 1000).toFixed(1));
    }

    tokens.add(String(Math.floor(ms / 1000)));
  }

  return tokens;
}

export function findUnsupportedNumericClaim(
  text: string,
  transcript: NormalizedTranscript
): string | null {
  const transcriptNumbers = new Set(extractNumberTokens(transcript.text));
  const groundedTimingTokens = collectGroundedTimingTokens(transcript);

  for (const token of extractNumberTokens(text)) {
    if (!transcriptNumbers.has(token) && !groundedTimingTokens.has(token)) {
      return token;
    }
  }

  return null;
}

// ── Quoted-span grounding ──────────────────────────────────────────────────
// Deliberately narrow: only explicit double-quoted spans (straight or
// curly), 2-180 chars. Single quotes are excluded on purpose — contractions
// and possessives ("don't", "the model's choice") would make a single-quote
// check false-positive-heavy for no real grounding benefit. Not a natural-
// language parser; a conservative, low-risk deterministic check only.
const DOUBLE_QUOTED_SPAN_PATTERN = /["“]([^"“”]{2,180})["”]/g;

export function findUnsupportedQuotedSpan(
  text: string,
  transcriptText: string
): string | null {
  for (const match of text.matchAll(DOUBLE_QUOTED_SPAN_PATTERN)) {
    const quoted = match[1];
    if (quoted && !transcriptText.includes(quoted)) {
      return quoted;
    }
  }
  return null;
}

// ── Named-entity audit (NON-BLOCKING, informational only) ─────────────────
// Deliberately NOT wired into validate.ts's pass/fail logic. A bare "any
// capitalized word not at the start of a sentence" rule is exactly the
// false-positive-heavy heuristic this was designed to avoid (it fires on
// ordinary capitalized nouns, mid-sentence proper adjectives, and — for
// RU/EN-mixed prose — transliterated terms). Instead this only flags
// multi-word capitalized phrases (a much stronger signal of an actual
// proper noun/named entity than a single capitalized word) that don't
// appear anywhere in the transcript. Exported for PR 10B+ to optionally
// log/monitor; calling code must not treat its output as a hard rejection
// in this phase. Known limitation: single-word names (e.g. "Ronaldo") are
// not caught — under-catching is the deliberately preferred failure mode
// over false-positiving good analysis. See PR 10A report for detail.
const MULTI_WORD_PROPER_NOUN_PATTERN =
  /\b\p{Lu}[\p{L}'-]*(?:\s+\p{Lu}[\p{L}'-]*)+\b/gu;

export function auditUnsupportedNamedEntities(
  text: string,
  transcriptText: string
): string[] {
  const candidates = new Set(
    Array.from(text.matchAll(MULTI_WORD_PROPER_NOUN_PATTERN), (match) => match[0])
  );

  return Array.from(candidates).filter(
    (candidate) => !transcriptText.includes(candidate)
  );
}

// ── Plain-text / presentation safety ───────────────────────────────────────
export function containsHtmlMarkup(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

export function containsMarkdownCodeBlock(text: string): boolean {
  return text.includes("```");
}
