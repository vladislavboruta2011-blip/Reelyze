// Pure, framework-free classification for Ask Climpy's bounded local
// conversation layer — deliberately NOT a fuzzy/broad classifier. Both
// functions below use normalized exact/near-exact matching only, against a
// small fixed EN/RU phrase set, so a real analysis question that happens to
// contain a greeting word (e.g. "Hi, why is my hook weak?") never matches —
// only a message that IS one of these phrases, after normalization, matches.

export type AskClimpyLocalIntent =
  | "greeting"
  | "thanks"
  | "acknowledgement"
  | "farewell"
  | "capability";

// trim -> lowercase -> drop harmless trailing punctuation -> collapse
// repeated whitespace. Shared by both the local-intent and error-reference
// matchers below, and applied to the stored phrase constants themselves (via
// normalizedSet) so a phrase like "what can you do?" is stored/compared in
// exactly the same normalized form as the user's raw input.
export function normalizeAskClimpyUtterance(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedSet(phrases: readonly string[]): Set<string> {
  return new Set(phrases.map((phrase) => normalizeAskClimpyUtterance(phrase)));
}

const GREETING_PHRASES = normalizedSet([
  "hi",
  "hello",
  "hey",
  "привет",
  "здравствуйте",
  "добрый день",
]);

const THANKS_PHRASES = normalizedSet([
  "thanks",
  "thank you",
  "got it, thanks",
  "спасибо",
  "благодарю",
  "понятно, спасибо",
]);

const ACKNOWLEDGEMENT_PHRASES = normalizedSet([
  "okay",
  "ok",
  "got it",
  "understood",
  "хорошо",
  "ок",
  "понятно",
  "понял",
]);

const FAREWELL_PHRASES = normalizedSet([
  "bye",
  "goodbye",
  "see you",
  "пока",
  "до свидания",
]);

const CAPABILITY_PHRASES = normalizedSet([
  "what can you do?",
  "how can you help?",
  "who are you?",
  "что ты умеешь?",
  "чем ты можешь помочь?",
  "кто ты?",
]);

// Checked in this fixed order — the sets are disjoint after normalization
// (approved MVP phrase lists never overlap), so order only matters as a
// deterministic tie-break in case that ever changes.
const LOCAL_INTENT_PHRASE_SETS: ReadonlyArray<
  readonly [AskClimpyLocalIntent, Set<string>]
> = [
  ["greeting", GREETING_PHRASES],
  ["thanks", THANKS_PHRASES],
  ["acknowledgement", ACKNOWLEDGEMENT_PHRASES],
  ["farewell", FAREWELL_PHRASES],
  ["capability", CAPABILITY_PHRASES],
];

// Returns null for anything that is not an exact/near-exact match of the
// approved phrase set — including a real analysis question that merely
// contains a greeting word, any starter question, and any contextual
// follow-up. Callers must treat null as "not a local intent, handle
// normally".
export function classifyAskClimpyLocalIntent(
  raw: string
): AskClimpyLocalIntent | null {
  const normalized = normalizeAskClimpyUtterance(raw);
  if (normalized.length === 0) return null;

  for (const [intent, phrases] of LOCAL_INTENT_PHRASE_SETS) {
    if (phrases.has(normalized)) return intent;
  }

  return null;
}

// A short, explicit reference to "what just happened" (Phase 3) — only ever
// consulted by the caller when the immediately preceding visible message is
// a technical error with no successful assistant answer after it. Kept as
// its own fixed phrase set (not merged into the local-intent set above)
// because these same phrases ("Why?", "Почему?") are ALSO valid contextual
// follow-up questions when they instead follow a successful answer — the
// caller decides which behavior applies based on conversation state, not
// this function.
const ERROR_REFERENCE_PHRASES = normalizedSet([
  "why?",
  "why not?",
  "what happened?",
  "почему?",
  "почему нет?",
  "что случилось?",
]);

export function isAskClimpyErrorReferencePhrase(raw: string): boolean {
  return ERROR_REFERENCE_PHRASES.has(normalizeAskClimpyUtterance(raw));
}

// The one approved typed rewrite intent — recognizes the creator TYPING the
// same core action the "Rewrite the riskiest part" starter button already
// offers, so they are not required to click only the button for this
// specific action. Deliberately a small, fixed phrase set (normalized
// exact/near-exact matching only, same normalizeAskClimpyUtterance as
// everything else in this module) — NOT a broad fuzzy rewrite-request
// classifier, and it never selects an arbitrary fragment: the caller
// (page.tsx's handleSendAskClimpy) always resolves this to the SAME
// deterministic riskiest risky-part index the starter button uses (see
// findRiskiestRiskyPartIndex/isRiskyPartRewriteEligible in
// engine/ask-climpy-validation.ts), never a fragment chosen from the
// question text itself.
export type AskClimpyRewriteIntent = "rewriteRiskiestPart";

const REWRITE_RISKIEST_PART_PHRASES = normalizedSet([
  "rewrite the riskiest part without adding facts",
  "rewrite the riskiest part",
  "rewrite this risky part without adding facts",
  "перепиши самый рискованный момент, не добавляя фактов",
  "перепиши самый рискованный момент",
  "перепиши этот рискованный фрагмент, не добавляя фактов",
]);

export function classifyAskClimpyRewriteIntent(
  raw: string
): AskClimpyRewriteIntent | null {
  const normalized = normalizeAskClimpyUtterance(raw);
  if (normalized.length === 0) return null;

  return REWRITE_RISKIEST_PART_PHRASES.has(normalized)
    ? "rewriteRiskiestPart"
    : null;
}
