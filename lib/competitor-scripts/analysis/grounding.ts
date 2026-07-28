// Deterministic, dependency-free grounding and safety checks over already-
// generated candidate text. No NLP library, no network access — every
// function here is a pure string/regex check against the real transcript
// or a fixed pattern list. Used by validate.ts; never calls OpenAI itself.

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

export function findUnsupportedNumericClaim(
  text: string,
  transcriptText: string
): string | null {
  const transcriptNumbers = new Set(extractNumberTokens(transcriptText));

  for (const token of extractNumberTokens(text)) {
    if (!transcriptNumbers.has(token)) {
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
