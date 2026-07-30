// Deterministic, dependency-free grounding and safety checks scoped to
// Compare, over already-generated candidate text. No NLP library, no
// network access — every function here is a pure string/regex check
// against the two real sources or a fixed pattern list. Used by
// validate.ts; never calls OpenAI itself.
//
// A few checks here duplicate the *technique* used by
// lib/competitor-scripts/analysis/grounding.ts (number-token extraction,
// grounded-timing-token collection, the quoted-span pattern) rather than
// importing it, because the underlying private helpers in that module
// are not exported and Compare's versions are source-aware (checked
// against a union of two real sources with asymmetric timing
// availability, not one NormalizedTranscript). Small, explicit
// duplication here is preferred over reaching into Analyze's internals
// or building a "clever" reuse trick a reviewer can't verify at a
// glance. findPerformanceClaimViolation, containsHtmlMarkup, and
// containsMarkdownCodeBlock genuinely are reused unchanged — see
// validate.ts's imports.

import type { NormalizedTranscript } from "../transcript/types";
import {
  MIN_COPY_DETECTION_CHARACTERS,
  MIN_COPY_DETECTION_WORDS,
} from "./constants";

// ── Numeric grounding across both sources ─────────────────────────────
// Same token shape as Analyze's extractNumberTokens (digit sequences,
// optional decimal, optional %, commas stripped for comparison).
function extractNumberTokens(value: string): string[] {
  return (value.match(/\d+(?:[.,]\d+)?%?/g) ?? []).map((token) =>
    token.replace(/,/g, "")
  );
}

// Timing-derived grounded tokens only ever come from the competitor
// side — the user script has no segments or duration, so it can never
// contribute a timing-grounded number. This mirrors Analyze's
// collectGroundedTimingTokens exactly (three representations per real
// millisecond value; ms === 0 excluded as degenerate/uninformative —
// see the equivalent comment in lib/competitor-scripts/analysis/grounding.ts
// for the full rationale).
function collectGroundedTimingTokens(
  competitorTranscript: NormalizedTranscript
): Set<string> {
  const millisecondValues = new Set<number>();

  for (const segment of competitorTranscript.segments) {
    millisecondValues.add(segment.startMs);
    if (segment.durationMs !== null) {
      millisecondValues.add(segment.startMs + segment.durationMs);
    }
  }

  if (competitorTranscript.durationMs !== null) {
    millisecondValues.add(competitorTranscript.durationMs);
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

export function findUnsupportedNumericClaimAcrossSources(
  text: string,
  userScript: string,
  competitorTranscript: NormalizedTranscript
): string | null {
  const userNumbers = new Set(extractNumberTokens(userScript));
  const competitorNumbers = new Set(extractNumberTokens(competitorTranscript.text));
  const groundedTimingTokens = collectGroundedTimingTokens(competitorTranscript);

  for (const token of extractNumberTokens(text)) {
    if (
      !userNumbers.has(token) &&
      !competitorNumbers.has(token) &&
      !groundedTimingTokens.has(token)
    ) {
      return token;
    }
  }

  return null;
}

// ── Quoted-span grounding across both sources ──────────────────────────
// Same narrow, deliberate scope as Analyze's DOUBLE_QUOTED_SPAN_PATTERN:
// only explicit double-quoted spans (straight or curly), 2-180 chars.
// A quote is only a violation if found in NEITHER real source.
const DOUBLE_QUOTED_SPAN_PATTERN = /["“]([^"“”]{2,180})["”]/g;

export function findUnsupportedQuotedSpanAcrossSources(
  text: string,
  userScript: string,
  competitorTranscript: NormalizedTranscript
): string | null {
  for (const match of text.matchAll(DOUBLE_QUOTED_SPAN_PATTERN)) {
    const quoted = match[1];
    if (quoted && !userScript.includes(quoted) && !competitorTranscript.text.includes(quoted)) {
      return quoted;
    }
  }
  return null;
}

// ── Production/visual claim guardrail ──────────────────────────────────
// Neither a user script nor a transcript carries any visual, editing, or
// audio-production signal — only spoken/written words. Any assertion
// about editing, camera work, visuals, thumbnails, music, sound design,
// vocal delivery, or facial expression is therefore always ungrounded by
// construction, regardless of how plausible it sounds. Scoped to
// specific, low-ambiguity phrases (e.g. "jump cut" and "cutaway" rather
// than a bare "cut", which collides with ordinary narrative language
// like "cut the fluff").
const PRODUCTION_CLAIM_PATTERNS: RegExp[] = [
  /\bediting\b/i,
  /\bjump\s*cuts?\b/i,
  /\bcutaways?\b/i,
  /\bcamera\s*(work|angle|movement|shot)?\b/i,
  /\b(b-?roll|thumbnails?)\b/i,
  /\bon-?screen\s+(text|graphics|captions)\b/i,
  /\bmusic\b/i,
  /\bsound\s*(design|effects?)\b/i,
  /\bvocal\s+delivery\b/i,
  /\btone\s+of\s+voice\b/i,
  /\bfacial\s+expressions?\b/i,
  /\bbody\s+language\b/i,
];

export function findUnsupportedProductionClaim(text: string): string | null {
  for (const pattern of PRODUCTION_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

// ── Creator-intent claim guardrail ──────────────────────────────────────
// A script or transcript is evidence of what was said, never evidence of
// why — a claim about the competitor creator's personal motive or
// internal mental state is always an inference the text alone cannot
// support. Deliberately scoped to person-directed phrasing ("they
// wanted", "their intention") so it never catches legitimate
// technique-level craft reasoning ("this creates curiosity", "delaying
// the reveal keeps tension"), which the Constitution explicitly allows
// as interpretation.
const INTENT_CLAIM_PATTERNS: RegExp[] = [
  /\bthey\s+(wanted|intended|were\s+trying|chose\s+this\s+because|did\s+this\s+because)\b/i,
  /\b(their|the\s+creator'?s)\s+(intention|intent|motivation|goal\s+was)\b/i,
  /\bdeliberately\s+(trying|attempting|manipulating)\b/i,
  /\bin\s+order\s+to\s+(manipulate|trick|trap)\b/i,
];

export function findUnsupportedIntentClaim(text: string): string | null {
  for (const pattern of INTENT_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

// ── Causal claim guardrail ───────────────────────────────────────────────
// Compare can prove a choice is real. It can never prove a choice caused
// a result — docs/product/compare/CONSTITUTION.md, "Never imply
// causality or performance we cannot prove." Separate from
// findPerformanceClaimViolation (reused unchanged from Analyze, which
// guards fabricated audience/metric facts): this guards specifically
// against language connecting a choice to an outcome.
const CAUSAL_CLAIM_PATTERNS: RegExp[] = [
  /\b(caused|leads?\s+to|led\s+to|results?\s+in|resulted\s+in)\s+(more|better|higher|increased)\b/i,
  /\bthis\s+is\s+why\s+(it|the\s+video|this)\s+(worked|succeeded|performed)\b/i,
  /\bmade\s+the\s+video\s+(succeed|work|perform)\b/i,
  /\bwill\s+(increase|improve|boost)\s+(your\s+)?(results|views|retention|performance)\b/i,
];

export function findCausalClaimViolation(text: string): string | null {
  for (const pattern of CAUSAL_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

// ── Ranking/winner claim guardrail ───────────────────────────────────────
// Compare has no winner (Constitution — "Compare creative decisions, not
// people... there are no winners"). Mapped to the same
// unsupported_performance_claim failure code as
// findPerformanceClaimViolation, per approved scope: one code, two
// complementary pattern lists.
const RANKING_CLAIM_PATTERNS: RegExp[] = [
  /\bwinner\b/i,
  /\b(wins|won)\b/i,
  /\bbetter-?performing\b/i,
  /\boutperforms?\b/i,
  /\bperforms?\s+better\b/i,
];

export function findRankingClaimViolation(text: string): string | null {
  for (const pattern of RANKING_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

// ── Strong-contrast language guardrail (similar findings only) ─────────
// Deliberately a separate, milder pattern list from RANKING_CLAIM_PATTERNS
// and PERFORMANCE_CLAIM_PATTERNS (which validateProseField already runs
// unconditionally on every prose field, so anything they catch is never
// reachable here). This list exists specifically for the one remaining
// gap: prose that overstates a "similar" finding without using outright
// ranking/performance words — "far better", "much stronger" — never
// flagged elsewhere, only checked here, only when strongerSide is
// "similar".
const STRONG_CONTRAST_PATTERNS: RegExp[] = [
  /\bfar\s+(better|stronger|superior|ahead|more\s+effective)\b/i,
  /\bmuch\s+(better|stronger|weaker)\b/i,
  /\bdramatically\s+(better|stronger|weaker|different)\b/i,
  /\bclearly\s+superior\b/i,
  /\bvastly\s+(better|superior)\b/i,
  /\ba\s+huge\s+(gap|advantage|difference)\b/i,
];

export function findStrongContrastLanguage(text: string): string | null {
  for (const pattern of STRONG_CONTRAST_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

// ── Verbatim competitor-copy guardrail ───────────────────────────────────
// Applies only to instructional prose fields (competitorPrinciple,
// howToApply) — never to the evidence excerpt itself, which is expected
// and required to be an exact competitor quote. Flags a field only when
// BOTH thresholds are met on the same contiguous phrase: at least
// MIN_COPY_DETECTION_WORDS consecutive words AND at least
// MIN_COPY_DETECTION_CHARACTERS normalized characters. Case-insensitive
// and whitespace-normalized (so a model that merely re-cases a copied
// phrase can't dodge detection); deliberately no punctuation stripping,
// stemming, or fuzzy/edit-distance matching — a plain contiguous-word-run
// substring check only, per the approved scope.
//
// Testing every exactly-MIN_COPY_DETECTION_WORDS-word sliding window is
// sufficient, not just a heuristic shortcut: if any longer contiguous
// run also matched the transcript, every MIN_COPY_DETECTION_WORDS-word
// sub-window within that longer run would independently match too, so
// nothing is missed by not also checking longer windows directly.
function normalizeForCopyCheck(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findVerbatimCompetitorCopy(
  field: string,
  competitorTranscript: NormalizedTranscript
): string | null {
  const normalizedTranscript = normalizeForCopyCheck(competitorTranscript.text);
  const words = normalizeForCopyCheck(field)
    .split(" ")
    .filter((word) => word.length > 0);

  for (let start = 0; start + MIN_COPY_DETECTION_WORDS <= words.length; start += 1) {
    const window = words.slice(start, start + MIN_COPY_DETECTION_WORDS).join(" ");
    if (
      window.length >= MIN_COPY_DETECTION_CHARACTERS &&
      normalizedTranscript.includes(window)
    ) {
      return window;
    }
  }

  return null;
}
