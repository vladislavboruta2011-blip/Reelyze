import {
  ANALYSIS_V2_FIX_TARGETS,
  ANALYSIS_V2_HOOK_DECISIONS,
  ANALYSIS_V2_LIMITS,
  ANALYSIS_V2_SCORE_COMPONENT_KEYS,
  ANALYSIS_V2_SCRIPT_TYPES,
  ANALYSIS_V2_SEVERITIES,
  ANALYSIS_V2_VERDICTS,
  type AnalysisV2FixTarget,
  type AnalysisV2HookDecision,
  type AnalysisV2Locale,
  type AnalysisV2Result,
  type AnalysisV2RiskyPart,
  type AnalysisV2ScoreBreakdown,
  type AnalysisV2ScriptType,
  type AnalysisV2Severity,
  type AnalysisV2SuggestedFix,
  type AnalysisV2Verdict,
} from "./analysis-v2-schema";

export const ASK_CLIMPY_LIMITS = {
  maxQuestionCharacters: 400,
  maxHistoryMessages: 8,
  maxHistoryMessageCharacters: 900,
  maxAnswerCharacters: 900,
  maxActionCharacters: 200,
  maxExampleCharacters: 400,
  // The excerpt being rewritten must already be short (it is a single risky
  // moment, never the whole script) — approved MVP bound, exactly 200.
  maxRewriteFragmentCharacters: 200,
  maxRequestBodyBytes: 24_576,
  // A slot is consumed only once a valid, successful Ask Climpy answer is
  // accepted (see app/results/page.tsx's handleSendAskClimpy) — network
  // failures, timeouts, 400s, 429s, aborted requests, responses that fail
  // validation, and requests superseded by an analysis change never count
  // against this cap.
  maxSuccessfulAnswersPerAnalysis: 6,
} as const;

export type AskClimpyChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function isScoreComponentValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 25
  );
}

function validateScoreComponentGroup(
  raw: unknown,
  requiredKeys: readonly string[]
): boolean {
  if (!isPlainObject(raw) || !hasOnlyKeys(raw, requiredKeys)) {
    return false;
  }

  return requiredKeys.every((key) => isScoreComponentValue(raw[key]));
}

function isValidScoreBreakdown(raw: unknown): raw is AnalysisV2ScoreBreakdown {
  return (
    isPlainObject(raw) &&
    hasOnlyKeys(raw, ["overall", "hook", "retentionRisk"]) &&
    validateScoreComponentGroup(raw.overall, ANALYSIS_V2_SCORE_COMPONENT_KEYS.overall) &&
    validateScoreComponentGroup(raw.hook, ANALYSIS_V2_SCORE_COMPONENT_KEYS.hook) &&
    validateScoreComponentGroup(
      raw.retentionRisk,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.retentionRisk
    )
  );
}

// Narrowed, serializable summary of the validated Analysis V2 result that is
// actually sent to the model — only the approved fields, nothing else.
// Includes a compact scoreBreakdown (just numbers — it lets Ask Climpy
// explain *why* a score is what it is) but deliberately excludes scenes,
// suggestedHook, and any database/saved-analysis metadata (id, title).
// scenes[].excerpt is exact-substring-validated the same way
// riskyParts[].excerpt is, but scenes are kept out of this narrowed context
// entirely, so — combined with SelectedContext below — riskyParts[].excerpt
// ends up the only rewrite-eligible source in the MVP. analysisLocale is the
// language the analysis's own prose (hookAssessment, mainTakeaway, etc.) was
// generated in — distinct from AskClimpyRequest.locale, which is always the
// current interface locale the answer itself must be written in.
export type AskClimpyAnalysisContext = {
  scriptType: AnalysisV2ScriptType;
  verdict: AnalysisV2Verdict;
  scores: AnalysisV2Result["scores"];
  scoreBreakdown?: AnalysisV2ScoreBreakdown;
  hookDecision: AnalysisV2HookDecision;
  hookAssessment: string;
  mainTakeaway: string;
  riskyParts: AnalysisV2RiskyPart[];
  suggestedFixes: AnalysisV2SuggestedFix[];
  analysisLocale: AnalysisV2Locale;
};

export function buildAskClimpyAnalysisContext(
  result: AnalysisV2Result,
  analysisLocale: AnalysisV2Locale
): AskClimpyAnalysisContext {
  return {
    scriptType: result.scriptType,
    verdict: result.verdict,
    scores: result.scores,
    ...(result.scoreBreakdown ? { scoreBreakdown: result.scoreBreakdown } : {}),
    hookDecision: result.hookDecision,
    hookAssessment: result.hookAssessment,
    mainTakeaway: result.mainTakeaway,
    riskyParts: result.riskyParts,
    suggestedFixes: result.suggestedFixes,
    analysisLocale,
  };
}

// What part of the analysis a question is anchored to. Only "riskyPart" is
// ever rewrite-eligible (see AskClimpyAnalysisContext's comment above) — the
// UI uses this same union to decide which starter questions to offer.
export type SelectedContext =
  | { type: "general" }
  | { type: "hookScore" }
  | { type: "riskyPart"; index: number }
  | { type: "suggestedFix"; index: number };

export type AskClimpyRequest = {
  script: string;
  locale: AnalysisV2Locale;
  analysisContext: AskClimpyAnalysisContext;
  selectedContext: SelectedContext;
  question: string;
  history: AskClimpyChatMessage[];
  requestRewrite: boolean;
  rewriteFragment?: string;
};

// The exact approved public response contract — a 200 response body is
// exactly this shape, nothing more. There is deliberately no "rewrite"
// object and no "status" discriminant: errors are communicated purely via
// HTTP status codes (see AskClimpyErrorResponse / route.ts), never by a
// field inside this type. The client already knows the original fragment
// from its own request (selectedContext + the validated riskyPart excerpt),
// so the server never needs to echo it back.
export type AskClimpyResponse = {
  answer: string;
  action?: string;
  example?: string;
  cannotSafelyRewrite: boolean;
};

export type AskClimpyErrorResponse = {
  reason: string;
};

// Locally synthesized (never model-generated) fallback used only when a
// rewrite request's model output twice failed one of the safeRefusalEligible
// checks (no-op, unfulfilled-promise, unsupported audience reaction, the
// model's own "not meaningful" self-audit, or the material-improvement
// backstop — see route.ts's runAskClimpy). This is a normal, valid product
// outcome (the model genuinely could not produce a meaningfully stronger,
// safe rewrite twice in a row), not an infrastructure failure, so it is
// returned as an ordinary 200 AskClimpyResponse rather than a 502. This is
// deliberately generic (never mentions any specific topic/script) — the
// PRIMARY path for a rich, script-specific refusal explanation is the model
// itself following buildAskClimpySystemPrompt's EDITORIAL VALUE instructions
// on its own first or second attempt; this text is only the worst-case
// backstop when even that failed twice. Never populates example.
const ASK_CLIMPY_SAFE_REFUSAL_FALLBACK_ANSWER: Record<AnalysisV2Locale, string> = {
  en: "Climpy can make this opening cleaner, but the script doesn't contain enough concrete information (a specific number, comparison, record, or explanation) to turn it into a meaningfully stronger hook without inventing something.",
  ru: "Climpy может сделать это начало чище, но в сценарии недостаточно конкретной информации (числа, сравнения, рекорда или объяснения), чтобы превратить его в по-настоящему сильный хук, не выдумывая что-то новое.",
};

const ASK_CLIMPY_SAFE_REFUSAL_FALLBACK_ACTION: Record<AnalysisV2Locale, string> = {
  en: "Add one verified concrete detail — a measurement, a named comparison, or the specific fact the script will reveal — then ask Climpy to rewrite it again.",
  ru: "Добавьте одну проверенную конкретную деталь — измерение, названное сравнение или конкретный факт, который раскроет сценарий — и снова попросите Climpy переписать это.",
};

export function buildAskClimpySafeRefusalFallback(
  locale: AnalysisV2Locale
): AskClimpyResponse {
  return {
    answer: ASK_CLIMPY_SAFE_REFUSAL_FALLBACK_ANSWER[locale],
    action: ASK_CLIMPY_SAFE_REFUSAL_FALLBACK_ACTION[locale],
    cannotSafelyRewrite: true,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isNonEmptyBoundedString(
  value: unknown,
  maxCharacters: number
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxCharacters
  );
}

function isEnumMember<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): value is T {
  return (
    typeof value === "string" &&
    (allowedValues as readonly string[]).includes(value)
  );
}

function isExactScriptSubstring(excerpt: string, script: string): boolean {
  return excerpt.length > 0 && script.includes(excerpt);
}

function isFiniteScoreValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

// Bilingual (the only two AskClimpyRequest.locale/AnalysisV2Locale values)
// backstop for the approved "action must be concrete, not a repeat of
// 'improve the hook'" rule — see buildAskClimpySystemPrompt's OUTPUT/
// EDITORIAL QUALITY instructions, which are the primary defense. This is a
// deliberately narrow exact-phrase match (not a broad "mentions hook"
// filter): it only catches the model literally repeating one of the banned
// generic labels verbatim, which is exactly the diagnosed regression (the
// Russian answer's action was just "улучшить хук скрипта" — "improve the
// script's hook" — with no concrete operation attached).
const GENERIC_ACTION_PATTERNS: readonly RegExp[] = [
  /^improve the hook\.?$/i,
  /^make it more engaging\.?$/i,
  /^add more details?\.?$/i,
  /^improve the script\.?$/i,
  /^улучшить хук( сценария| скрипта)?\.?$/i,
  // [а-яё]* rather than \w+ (see the Cyrillic-\b note above — the same
  // ASCII-only-\w gap applies to \w+ consuming a Cyrillic word's ending).
  /^сделать (это |её |его )?более (увлекательн[а-яё]*|интересн[а-яё]*)\.?$/i,
  /^добавить больше деталей\.?$/i,
];

function isGenericAction(action: string): boolean {
  const normalized = action.trim();
  return GENERIC_ACTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

// Semantic (not blind-phrase-ban) anti-unfulfilled-promise backstop for
// rewrites — see buildAskClimpySystemPrompt's ANTI-UNFULFILLED-PROMISE
// RULES section, which is the primary defense (the model is told the rule
// and given the Ronaldo example). This is a deterministic safety net behind
// that prompt instruction, not a replacement for it: a teaser phrase alone
// is not rejected (e.g. a script that DOES deliver its "why" may safely say
// "here's why") — it is only rejected when the analysis itself has already
// flagged, in its own words, that the script leaves that promise
// unresolved. Keyed off analysisContext.hookAssessment/mainTakeaway/
// riskyParts[].reason (already-validated, human-legible prose in either
// English or Russian) rather than the raw script text, so this generalizes
// across script types instead of overfitting to one phrase or one topic.
const UNFULFILLED_PROMISE_TEASER_PATTERNS: readonly RegExp[] = [
  /\bhere'?s why\b/i,
  /\bhere'?s how\b/i,
  /\bwhat happened next\b/i,
  /\bbut the real reason\b/i,
  /\bwait until you see\b/i,
  // No \b around these — JS's default \w is ASCII-only, so \b never matches
  // at a boundary between Cyrillic text and whitespace/punctuation (both
  // sides read as non-word), silently failing to match at all.
  /вот почему/i,
  /вот как/i,
  /что случилось дальше/i,
  // Deliberately NOT "ends with a question mark" — diagnosed as too broad:
  // a rhetorical question that merely restates a fact the script already
  // states (e.g. "Did you know Cristiano Ronaldo can jump much higher than
  // an average person?") is a perfectly safe, self-contained rewrite. This
  // analysis's own hookAssessment/mainTakeaway/riskyPart reasons legitimately
  // mention a weak/unresolved payoff (the separate, still-unexplained "why"/
  // "how much" claim) REGARDLESS of what any given rewrite attempt says —
  // that text does not change per-attempt — so pairing a bare "?" with it
  // rejected every question-phrased rewrite for this script, not just ones
  // that actually tease something unsupported. Only the explicit
  // promise-of-a-forthcoming-explanation phrases above are strong enough
  // signals on their own to warrant rejection.
];

const UNRESOLVED_PAYOFF_SIGNAL_PATTERNS: readonly RegExp[] = [
  /does not (?:explain|provide|deliver|elaborate|support)/i,
  /\bno explanation\b/i,
  /without (?:explanation|explaining)/i,
  /lacks? (?:an? )?explanation/i,
  /\bweak payoff\b/i,
  /\bunresolved\b/i,
  /\bunfulfilled\b/i,
  /не объясня/i,
  /без объяснени/i,
  /не раскрыв/i,
  /не подкреплен/i,
  // [а-яё]* rather than \w+ — same ASCII-only-\w reason as the teaser list
  // above; \w+ would silently fail to consume Cyrillic suffix letters.
  /слаб[а-яё]* (?:пейоф[а-яё]*|развязк[а-яё]*|концовк[а-яё]*)/i,
];

export function rewriteRisksUnfulfilledPromise(
  example: string,
  analysisContext: Pick<
    AskClimpyAnalysisContext,
    "hookAssessment" | "mainTakeaway" | "riskyParts"
  >
): boolean {
  const hasTeaser = UNFULFILLED_PROMISE_TEASER_PATTERNS.some((pattern) =>
    pattern.test(example)
  );

  if (!hasTeaser) return false;

  const analysisProse = [
    analysisContext.hookAssessment,
    analysisContext.mainTakeaway,
    ...analysisContext.riskyParts.map((part) => part.reason),
  ].join(" ");

  return UNRESOLVED_PAYOFF_SIGNAL_PATTERNS.some((pattern) =>
    pattern.test(analysisProse)
  );
}

// ── Meaningful-rewrite decision (superseding correction) ────────────────
//
// A rewrite that only cleans up wording is not automatically a stronger
// hook — see buildAskClimpySystemPrompt's EDITORIAL VALUE section, which is
// the primary defense (the model is asked to self-report rewriteAssessment
// and told the exact distinction: "I can make this clearer" is not the same
// claim as "I can make this meaningfully stronger"). The checks below are a
// deterministic backstop behind that prompt instruction, catching the
// OBVIOUS failure shapes rather than acting as a full semantic judge:
//   - the model's own honest self-audit says the rewrite is not meaningful
//     (rewriteAssessment === "clarification_only" | "insufficient_grounding")
//   - the rewrite invents an unsupported audience/viewer/fan reaction
//   - the selected riskyPart's own reason says specificity/evidence/payoff/
//     explanation is missing, and the rewrite adds no hard-anchor material
//     to address that — i.e. it is still just as vague, only relocated
//
// Deliberately reuses the PRINCIPLE already established by Improve Script's
// candidateAudit (a model self-audit with {resolvedPrimaryProblem,
// candidateMateriallyBetter, regressionIntroduced} that a deterministic
// preserve-fallback backs up — see engine/improve-script.ts) and its
// light-paraphrase token-overlap backstop, WITHOUT importing or coupling to
// that module's full response schema — Ask Climpy operates on a single
// short fragment, not a whole script, so a smaller, fragment-scoped version
// of the same idea is reimplemented here rather than reused directly.

export const ASK_CLIMPY_REWRITE_ASSESSMENTS = [
  "meaningful_rewrite",
  "clarification_only",
  "insufficient_grounding",
] as const;

// Internal-only decision the model self-reports on a rewrite attempt —
// NEVER part of the public AskClimpyResponse contract (see that type above,
// which stays exactly {answer, action?, example?, cannotSafelyRewrite}).
// Used only to decide, server-side, whether a proposed "safe rewrite" is
// actually accepted or normalized into a safe refusal.
export type AskClimpyRewriteAssessment =
  (typeof ASK_CLIMPY_REWRITE_ASSESSMENTS)[number];

// Signals that the selected riskyPart's OWN reason (not the whole analysis)
// describes a specificity/genericness problem — as distinct from a pure
// wording/filler/clarity problem, for which a plain compression or
// reordering rewrite legitimately IS meaningful (see Phase 2's filler
// exception). Combined with UNRESOLVED_PAYOFF_SIGNAL_PATTERNS below (already
// used by rewriteRisksUnfulfilledPromise) to also cover a missing-payoff/
// missing-explanation diagnosis, which is the same underlying "nothing
// concrete to build on" problem from a different angle.
// Deliberately EXCLUDES "unclear" — this app's own analysis engine uses
// that word for plain wording/sequencing issues too (e.g. "This step is
// unclear without the surrounding context", a pure flow problem, not a
// missing-specificity one), so it is not a reliable enough signal on its
// own to distinguish the two categories Phase 2 draws.
const VAGUE_OR_GENERIC_PROBLEM_SIGNAL_PATTERNS: readonly RegExp[] = [
  /\bgeneric\b/i,
  /\bvague\b/i,
  /\btoo broad\b/i,
  /\bnot specific\b/i,
  /\blacks? specificity\b/i,
  /\bno concrete\b/i,
  /\babstract\b/i,
  // No \b around these (same ASCII-only-\w gap noted above for Cyrillic).
  /общ(ий|ая|ее|ие|его|ей|их)/i,
  /неконкретн/i,
  /нет конкрет/i,
  /расплывчат/i,
  /неясн/i,
];

function isSpecificityOrPayoffProblem(riskyPartReason: string): boolean {
  return (
    VAGUE_OR_GENERIC_PROBLEM_SIGNAL_PATTERNS.some((pattern) =>
      pattern.test(riskyPartReason)
    ) ||
    UNRESOLVED_PAYOFF_SIGNAL_PATTERNS.some((pattern) =>
      pattern.test(riskyPartReason)
    )
  );
}

// Deliberately narrow: digits, measurement units, and strong causal
// connectors only — NOT a "capitalized two-word name" heuristic (unlike
// engine/improve-hook.ts's lineHasHardAnchor). A bare name that is already
// present in the script (e.g. "Cristiano Ronaldo") is not NEW specificity —
// it is exactly the kind of already-known, still-vague material the
// diagnosed regression showed being reshuffled and mistaken for a stronger
// hook. Digits/units/causal connectors are much stronger, harder-to-fake
// signals of genuinely new concrete material for a single short fragment.
const HARD_ANCHOR_PATTERNS: readonly RegExp[] = [
  /\d/,
  /\b(?:percent|%|miles?|foot|feet|meters?|km|kilometers?|pounds?|kg|kilograms?|seconds?|minutes?|hours?|degrees?|mph|kph|billion|million|thousand|dollars?|euros?|cents?)\b/i,
  /\b(?:because|therefore|as a result|which means|led to|resulted in|caused|triggered|due to|consequently)\b/i,
  /(?:потому что|поэтому|в результате|это означает|привело к|вызвал|из-за|благодаря)/i,
];

function containsHardAnchorMaterial(text: string): boolean {
  return HARD_ANCHOR_PATTERNS.some((pattern) => pattern.test(text));
}

// The deterministic half of the "clarification, not a stronger hook"
// backstop: only fires when (a) the selected riskyPart's own reason
// diagnosed a specificity/payoff-type problem, AND (b) the rewrite still
// contains none of the narrow hard-anchor signals above. A rewrite that
// merely relocates the same vague claim (e.g. "Cristiano Ronaldo can jump
// much higher than an average person.") trips this; one that pulls in an
// existing number, measurement, or explicit cause from elsewhere in the
// script does not — regardless of a bare name being present either way.
export function rewriteLacksMaterialImprovement(
  example: string,
  selectedRiskyPartReason: string | undefined
): boolean {
  if (!selectedRiskyPartReason) return false;
  if (!isSpecificityOrPayoffProblem(selectedRiskyPartReason)) return false;

  return !containsHardAnchorMaterial(example);
}

// Safety rule (not an editorial judgment call) — inventing how real
// viewers/fans/the audience reacted is a new, unsupported claim about the
// world, exactly like inventing a number or a name. Always checked,
// regardless of the selected riskyPart's reason. Catches the diagnosed
// regression output "...and that's what surprises everyone." verbatim.
const UNSUPPORTED_AUDIENCE_REACTION_PATTERNS: readonly RegExp[] = [
  /\beveryone (?:was|is|were)\s+(?:so\s+)?(?:surprised|shocked|amazed|stunned)\b/i,
  /\bsurprises everyone\b/i,
  /\bshocks everyone\b/i,
  /\bviewers?(?:'|’)? (?:couldn'?t|could not|can'?t) believe\b/i,
  /\bpeople (?:couldn'?t|could not|can'?t) believe\b/i,
  /\bfans? (?:went|goes|go) crazy\b/i,
  /\bshocked (?:the )?(?:world|fans|viewers)\b/i,
  /\bwent viral\b/i,
  /все были (?:удивлены|шокированы|поражены)/i,
  /удивляет всех/i,
  /зрители не (?:могли|могут) поверить/i,
  /фанаты сошли с ума/i,
];

export function introducesUnsupportedAudienceReaction(
  example: string
): boolean {
  return UNSUPPORTED_AUDIENCE_REACTION_PATTERNS.some((pattern) =>
    pattern.test(example)
  );
}

function getSelectedRiskyPartReason(request: {
  selectedContext?: SelectedContext;
  analysisContext?: Pick<AskClimpyAnalysisContext, "riskyParts">;
}): string | undefined {
  if (!request.analysisContext || !request.selectedContext) return undefined;
  if (request.selectedContext.type !== "riskyPart") return undefined;

  return request.analysisContext.riskyParts[request.selectedContext.index]
    ?.reason;
}

export function parseAskClimpyJson(raw: string): unknown | null {
  const normalized = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

type Validation<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: string;
      // Set only by validateAskClimpyModelResult's two rewrite-content
      // grounding checks (no-op rewrite, unfulfilled-promise) — see route.ts's
      // runAskClimpy. Marks "the response was well-formed, but our own
      // grounding heuristic rejected THIS specific proposed rewrite" as
      // distinct from a genuine schema/parse/infra failure, so that if BOTH
      // attempts land here, the caller can degrade to a valid, localized
      // cannotSafelyRewrite: true answer instead of a generic 502 — an
      // editorial refusal is a normal, useful outcome, not an error.
      // Undefined everywhere else (including every other Validation<T> use
      // in this file), which callers must treat the same as false.
      safeRefusalEligible?: boolean;
    };

function validateRiskyPart(
  raw: unknown,
  script: string
): Validation<AnalysisV2RiskyPart> {
  if (!isPlainObject(raw) || !hasOnlyKeys(raw, ["excerpt", "reason", "severity"])) {
    return { ok: false, reason: "A risky part in analysisContext is malformed." };
  }

  if (
    !isNonEmptyBoundedString(raw.excerpt, ANALYSIS_V2_LIMITS.maxScriptCharacters) ||
    !isExactScriptSubstring(raw.excerpt, script)
  ) {
    return {
      ok: false,
      reason:
        "A risky-part excerpt in analysisContext is not an exact substring of the script.",
    };
  }

  if (!isNonEmptyBoundedString(raw.reason, ANALYSIS_V2_LIMITS.maxRiskReasonCharacters)) {
    return { ok: false, reason: "A risky-part reason in analysisContext is invalid." };
  }

  if (!isEnumMember<AnalysisV2Severity>(raw.severity, ANALYSIS_V2_SEVERITIES)) {
    return { ok: false, reason: "A risky-part severity in analysisContext is invalid." };
  }

  return {
    ok: true,
    value: { excerpt: raw.excerpt, reason: raw.reason, severity: raw.severity },
  };
}

function validateSuggestedFix(raw: unknown): Validation<AnalysisV2SuggestedFix> {
  if (!isPlainObject(raw) || !hasOnlyKeys(raw, ["target", "suggestion", "optional"])) {
    return { ok: false, reason: "A suggested fix in analysisContext is malformed." };
  }

  if (!isEnumMember<AnalysisV2FixTarget>(raw.target, ANALYSIS_V2_FIX_TARGETS)) {
    return { ok: false, reason: "A suggested-fix target in analysisContext is invalid." };
  }

  if (
    !isNonEmptyBoundedString(
      raw.suggestion,
      ANALYSIS_V2_LIMITS.maxFixSuggestionCharacters
    )
  ) {
    return { ok: false, reason: "A suggested-fix suggestion in analysisContext is invalid." };
  }

  if (typeof raw.optional !== "boolean") {
    return { ok: false, reason: "A suggested fix in analysisContext is malformed." };
  }

  return {
    ok: true,
    value: { target: raw.target, suggestion: raw.suggestion, optional: raw.optional },
  };
}

export function validateAskClimpyAnalysisContext(
  raw: unknown,
  script: string
): Validation<AskClimpyAnalysisContext> {
  if (
    !isPlainObject(raw) ||
    !hasOnlyKeys(raw, [
      "scriptType",
      "verdict",
      "scores",
      "scoreBreakdown",
      "hookDecision",
      "hookAssessment",
      "mainTakeaway",
      "riskyParts",
      "suggestedFixes",
      "analysisLocale",
    ])
  ) {
    return { ok: false, reason: "analysisContext is malformed." };
  }

  if (!isEnumMember<AnalysisV2ScriptType>(raw.scriptType, ANALYSIS_V2_SCRIPT_TYPES)) {
    return { ok: false, reason: "analysisContext.scriptType is invalid." };
  }

  if (!isEnumMember<AnalysisV2Verdict>(raw.verdict, ANALYSIS_V2_VERDICTS)) {
    return { ok: false, reason: "analysisContext.verdict is invalid." };
  }

  if (
    !isPlainObject(raw.scores) ||
    !hasOnlyKeys(raw.scores, ["overall", "hook", "retentionRisk"]) ||
    !isFiniteScoreValue(raw.scores.overall) ||
    !isFiniteScoreValue(raw.scores.hook) ||
    !isFiniteScoreValue(raw.scores.retentionRisk)
  ) {
    return { ok: false, reason: "analysisContext.scores is invalid." };
  }

  if (raw.scoreBreakdown !== undefined && !isValidScoreBreakdown(raw.scoreBreakdown)) {
    return { ok: false, reason: "analysisContext.scoreBreakdown is invalid." };
  }

  if (!isEnumMember<AnalysisV2HookDecision>(raw.hookDecision, ANALYSIS_V2_HOOK_DECISIONS)) {
    return { ok: false, reason: "analysisContext.hookDecision is invalid." };
  }

  if (
    !isNonEmptyBoundedString(
      raw.hookAssessment,
      ANALYSIS_V2_LIMITS.maxHookAssessmentCharacters
    )
  ) {
    return { ok: false, reason: "analysisContext.hookAssessment is invalid." };
  }

  if (raw.analysisLocale !== "en" && raw.analysisLocale !== "ru") {
    return { ok: false, reason: "analysisContext.analysisLocale is invalid." };
  }

  if (
    !isNonEmptyBoundedString(raw.mainTakeaway, ANALYSIS_V2_LIMITS.maxMainTakeawayCharacters)
  ) {
    return { ok: false, reason: "analysisContext.mainTakeaway is invalid." };
  }

  if (!Array.isArray(raw.riskyParts) || raw.riskyParts.length > ANALYSIS_V2_LIMITS.maxRiskyParts) {
    return { ok: false, reason: "analysisContext.riskyParts is invalid." };
  }

  const riskyParts: AnalysisV2RiskyPart[] = [];
  for (const rawPart of raw.riskyParts) {
    const partValidation = validateRiskyPart(rawPart, script);
    if (!partValidation.ok) return partValidation;
    riskyParts.push(partValidation.value);
  }

  if (
    !Array.isArray(raw.suggestedFixes) ||
    raw.suggestedFixes.length > ANALYSIS_V2_LIMITS.maxSuggestedFixes
  ) {
    return { ok: false, reason: "analysisContext.suggestedFixes is invalid." };
  }

  const suggestedFixes: AnalysisV2SuggestedFix[] = [];
  for (const rawFix of raw.suggestedFixes) {
    const fixValidation = validateSuggestedFix(rawFix);
    if (!fixValidation.ok) return fixValidation;
    suggestedFixes.push(fixValidation.value);
  }

  return {
    ok: true,
    value: {
      scriptType: raw.scriptType,
      verdict: raw.verdict,
      scores: { overall: raw.scores.overall, hook: raw.scores.hook, retentionRisk: raw.scores.retentionRisk },
      ...(raw.scoreBreakdown !== undefined
        ? { scoreBreakdown: raw.scoreBreakdown as AnalysisV2ScoreBreakdown }
        : {}),
      hookDecision: raw.hookDecision,
      hookAssessment: raw.hookAssessment,
      mainTakeaway: raw.mainTakeaway,
      riskyParts,
      suggestedFixes,
      analysisLocale: raw.analysisLocale,
    },
  };
}

export function validateSelectedContext(
  raw: unknown,
  analysisContext: AskClimpyAnalysisContext
): Validation<SelectedContext> {
  if (!isPlainObject(raw) || typeof raw.type !== "string") {
    return { ok: false, reason: "selectedContext is malformed." };
  }

  if (raw.type === "general" || raw.type === "hookScore") {
    if (!hasOnlyKeys(raw, ["type"])) {
      return { ok: false, reason: "selectedContext is malformed." };
    }
    return { ok: true, value: { type: raw.type } };
  }

  if (raw.type === "riskyPart") {
    if (
      !hasOnlyKeys(raw, ["type", "index"]) ||
      typeof raw.index !== "number" ||
      !Number.isInteger(raw.index) ||
      raw.index < 0 ||
      raw.index >= analysisContext.riskyParts.length
    ) {
      return { ok: false, reason: "selectedContext.index for riskyPart is out of range." };
    }
    return { ok: true, value: { type: "riskyPart", index: raw.index } };
  }

  if (raw.type === "suggestedFix") {
    if (
      !hasOnlyKeys(raw, ["type", "index"]) ||
      typeof raw.index !== "number" ||
      !Number.isInteger(raw.index) ||
      raw.index < 0 ||
      raw.index >= analysisContext.suggestedFixes.length
    ) {
      return { ok: false, reason: "selectedContext.index for suggestedFix is out of range." };
    }
    return { ok: true, value: { type: "suggestedFix", index: raw.index } };
  }

  return { ok: false, reason: "selectedContext.type is invalid." };
}

function validateHistory(raw: unknown): Validation<AskClimpyChatMessage[]> {
  if (!Array.isArray(raw) || raw.length > ASK_CLIMPY_LIMITS.maxHistoryMessages) {
    return { ok: false, reason: "history is invalid." };
  }

  const history: AskClimpyChatMessage[] = [];

  for (const rawMessage of raw) {
    if (
      !isPlainObject(rawMessage) ||
      !hasOnlyKeys(rawMessage, ["role", "content"]) ||
      (rawMessage.role !== "user" && rawMessage.role !== "assistant") ||
      !isNonEmptyBoundedString(
        rawMessage.content,
        ASK_CLIMPY_LIMITS.maxHistoryMessageCharacters
      )
    ) {
      return { ok: false, reason: "A history message is malformed." };
    }

    history.push({ role: rawMessage.role, content: rawMessage.content });
  }

  return { ok: true, value: history };
}

export function validateAskClimpyRequest(
  raw: unknown
): Validation<AskClimpyRequest> {
  if (
    !isPlainObject(raw) ||
    !hasOnlyKeys(raw, [
      "script",
      "locale",
      "analysisContext",
      "selectedContext",
      "question",
      "history",
      "requestRewrite",
      "rewriteFragment",
    ])
  ) {
    return { ok: false, reason: "Request body is malformed." };
  }

  if (
    !isNonEmptyBoundedString(raw.script, ANALYSIS_V2_LIMITS.maxScriptCharacters)
  ) {
    return { ok: false, reason: "script is invalid." };
  }

  if (raw.locale !== "en" && raw.locale !== "ru") {
    return { ok: false, reason: "locale is invalid." };
  }

  const analysisContextValidation = validateAskClimpyAnalysisContext(
    raw.analysisContext,
    raw.script
  );
  if (!analysisContextValidation.ok) return analysisContextValidation;

  const selectedContextValidation = validateSelectedContext(
    raw.selectedContext,
    analysisContextValidation.value
  );
  if (!selectedContextValidation.ok) return selectedContextValidation;

  if (!isNonEmptyBoundedString(raw.question, ASK_CLIMPY_LIMITS.maxQuestionCharacters)) {
    return { ok: false, reason: "question is invalid." };
  }

  const historyValidation = validateHistory(raw.history);
  if (!historyValidation.ok) return historyValidation;

  if (typeof raw.requestRewrite !== "boolean") {
    return { ok: false, reason: "requestRewrite is invalid." };
  }

  if (!raw.requestRewrite) {
    if (raw.rewriteFragment !== undefined) {
      return { ok: false, reason: "rewriteFragment must be omitted when requestRewrite is false." };
    }

    return {
      ok: true,
      value: {
        script: raw.script,
        locale: raw.locale,
        analysisContext: analysisContextValidation.value,
        selectedContext: selectedContextValidation.value,
        question: raw.question,
        history: historyValidation.value,
        requestRewrite: false,
      },
    };
  }

  if (selectedContextValidation.value.type !== "riskyPart") {
    return {
      ok: false,
      reason: "requestRewrite is only allowed when selectedContext.type is riskyPart.",
    };
  }

  const eligibleExcerpt =
    analysisContextValidation.value.riskyParts[selectedContextValidation.value.index]
      ?.excerpt;

  if (
    !isNonEmptyBoundedString(
      raw.rewriteFragment,
      ASK_CLIMPY_LIMITS.maxRewriteFragmentCharacters
    ) ||
    raw.rewriteFragment !== eligibleExcerpt
  ) {
    return {
      ok: false,
      reason:
        "rewriteFragment must exactly match the selected risky part's excerpt.",
    };
  }

  return {
    ok: true,
    value: {
      script: raw.script,
      locale: raw.locale,
      analysisContext: analysisContextValidation.value,
      selectedContext: selectedContextValidation.value,
      question: raw.question,
      history: historyValidation.value,
      requestRewrite: true,
      rewriteFragment: raw.rewriteFragment,
    },
  };
}

// Validates the model's raw structured-output JSON against the approved
// public contract (answer/action/example/cannotSafelyRewrite — see
// AskClimpyResponse above) and enforces rewrite grounding:
// - a non-rewrite request must come back with cannotSafelyRewrite: false and
//   no example
// - a rewrite refusal (cannotSafelyRewrite: true) must have no example (a
//   populated example alongside true is NORMALIZED away — see below — not
//   treated as a contract violation)
// - a safe rewrite (cannotSafelyRewrite: false, requestRewrite: true) must
//   have a non-empty example that actually differs from the requested
//   fragment (rejects a disguised no-op "rewrite") and must not introduce an
//   unfulfilled promise the analysis has already flagged as unresolved
export function validateAskClimpyModelResult(
  raw: unknown,
  request: Pick<AskClimpyRequest, "requestRewrite" | "rewriteFragment"> & {
    // Optional so existing call sites/tests that only exercise the
    // requestRewrite/rewriteFragment contract (not this specific
    // analysis-aware check) keep compiling unchanged — route.ts's real call
    // site always passes the full AskClimpyRequest, which already satisfies
    // this structurally. Omitting it simply skips the unfulfilled-promise/
    // meaningful-rewrite checks below (never a false positive/negative from
    // a caller that doesn't have an analysisContext to check against).
    analysisContext?: Pick<
      AskClimpyAnalysisContext,
      "hookAssessment" | "mainTakeaway" | "riskyParts"
    >;
    selectedContext?: SelectedContext;
  }
): Validation<AskClimpyResponse> {
  if (
    !isPlainObject(raw) ||
    !hasOnlyKeys(raw, [
      "answer",
      "action",
      "example",
      "cannotSafelyRewrite",
      "rewriteAssessment",
    ])
  ) {
    return { ok: false, reason: "Model result is malformed." };
  }

  if (!isNonEmptyBoundedString(raw.answer, ASK_CLIMPY_LIMITS.maxAnswerCharacters)) {
    return { ok: false, reason: "Model answer is invalid." };
  }

  if (typeof raw.cannotSafelyRewrite !== "boolean") {
    return { ok: false, reason: "Model cannotSafelyRewrite is invalid." };
  }

  let action: string | undefined;
  if (raw.action !== undefined && raw.action !== null) {
    if (typeof raw.action !== "string" || raw.action.length > ASK_CLIMPY_LIMITS.maxActionCharacters) {
      return { ok: false, reason: "Model action is invalid." };
    }

    const trimmedAction = raw.action.trim();

    // An empty/whitespace-only action (e.g. the model emits "" instead of
    // the JSON null literal when it has nothing concise to add) is
    // NORMALIZED to "no action" — same treatment as a generic action below
    // — rather than failing the whole response: the "answer" (and, on a
    // rewrite, "example") can still be a perfectly safe, grounded, useful
    // result on their own. Diagnosed root cause of the rewrite-starter
    // regression: a fully valid, grounded rewrite was discarded on both
    // attempts (a hard 502) purely because "action" came back as "" rather
    // than null, burning the one approved retry on an otherwise-unusable
    // optional field instead of reserving it for genuinely unusable output.
    if (trimmedAction.length === 0 || isGenericAction(trimmedAction)) {
      action = undefined;
    } else {
      action = raw.action;
    }
  }

  // "example" is REQUIRED only for a successful rewrite (requestRewrite:
  // true AND cannotSafelyRewrite: false) — every other case (a plain
  // explanation, or a rewrite refusal) treats it as optional, and an empty/
  // whitespace-only value there is normalized to "omitted" exactly like
  // "action" above (a model emitting "" instead of null). A REQUIRED
  // example must never be silently normalized away — an empty string there
  // falls straight through to "Model example is invalid.", never treated as
  // merely absent, so a genuinely missing rewrite can never masquerade as a
  // valid one.
  const isRewriteSuccessCandidate =
    request.requestRewrite && raw.cannotSafelyRewrite === false;

  let example: string | undefined;
  if (raw.example !== undefined && raw.example !== null) {
    if (typeof raw.example !== "string" || raw.example.length > ASK_CLIMPY_LIMITS.maxExampleCharacters) {
      return { ok: false, reason: "Model example is invalid." };
    }

    const trimmedExample = raw.example.trim();

    if (trimmedExample.length === 0) {
      if (isRewriteSuccessCandidate) {
        return { ok: false, reason: "Model example is invalid." };
      }
      example = undefined;
    } else {
      example = raw.example;
    }
  }

  // Internal-only self-audit — never part of the public response (built
  // below without this field). Parsed leniently: an absent, null, or
  // unrecognized value is simply treated as "not reported" rather than a
  // validation failure, so existing/mocked callers that don't send it are
  // unaffected — the deterministic backstops still apply independently.
  const rewriteAssessment: AskClimpyRewriteAssessment | undefined =
    isEnumMember<AskClimpyRewriteAssessment>(
      raw.rewriteAssessment,
      ASK_CLIMPY_REWRITE_ASSESSMENTS
    )
      ? raw.rewriteAssessment
      : undefined;

  if (!request.requestRewrite) {
    // The structured-output schema for a non-rewrite request already
    // constrains cannotSafelyRewrite to the literal `false` at the schema
    // level (see app/api/ask-climpy/route.ts's ASK_CLIMPY_EXPLANATION_
    // JSON_SCHEMA) — this is a defense-in-depth re-check, not the primary
    // defense. Unlike the prior contract, a populated "example" is now
    // ALLOWED here (an illustrative example of a possible fix, never a
    // claimed rewrite of a specific validated fragment) — see Phase 2's
    // approved non-rewrite response shape.
    if (raw.cannotSafelyRewrite !== false) {
      return {
        ok: false,
        reason: "Model returned cannotSafelyRewrite: true for a non-rewrite request.",
      };
    }

    return {
      ok: true,
      value: {
        answer: raw.answer,
        ...(action !== undefined ? { action } : {}),
        ...(example !== undefined ? { example } : {}),
        cannotSafelyRewrite: false,
      },
    };
  }

  if (raw.cannotSafelyRewrite) {
    // A populated example alongside cannotSafelyRewrite: true is a common,
    // harmless model slip (it tries to show a partial/hedged attempt while
    // still flagging the refusal) — diagnosed as one cause of the rewrite
    // path exhausting its one approved retry on an otherwise-fine refusal.
    // NORMALIZE it away (never surface it) rather than failing validation:
    // this is strictly more conservative than accepting the example would
    // be, so it never weakens grounding, and it is not "allowing unvalidated
    // prose" — the example is discarded, never used.
    return {
      ok: true,
      value: {
        answer: raw.answer,
        ...(action !== undefined ? { action } : {}),
        cannotSafelyRewrite: true,
      },
    };
  }

  if (example === undefined) {
    return { ok: false, reason: "example is required for a safe rewrite." };
  }

  if (example.trim() === request.rewriteFragment?.trim()) {
    return {
      ok: false,
      reason: "example must differ from the original fragment (no-op rewrite).",
      safeRefusalEligible: true,
    };
  }

  if (
    request.analysisContext &&
    rewriteRisksUnfulfilledPromise(example, request.analysisContext)
  ) {
    return {
      ok: false,
      reason:
        "example introduces a teased payoff/explanation the analysis already flags as unresolved by the script.",
      safeRefusalEligible: true,
    };
  }

  if (introducesUnsupportedAudienceReaction(example)) {
    return {
      ok: false,
      reason:
        "example introduces an unsupported audience/viewer/fan reaction not present in the script.",
      safeRefusalEligible: true,
    };
  }

  // The model's own honest self-audit: a cleaner paraphrase is not the same
  // claim as a meaningfully stronger hook (see buildAskClimpySystemPrompt's
  // EDITORIAL VALUE section). Trust it exactly like Improve Script trusts
  // candidateAudit — a "no" here is a normal, valid editorial outcome, not
  // an error, so it is safeRefusalEligible rather than an outright failure.
  if (
    rewriteAssessment === "clarification_only" ||
    rewriteAssessment === "insufficient_grounding"
  ) {
    return {
      ok: false,
      reason: `Model's own rewriteAssessment ("${rewriteAssessment}") reports this is not a meaningful rewrite.`,
      safeRefusalEligible: true,
    };
  }

  // Deterministic backstop for when the model over-claims meaningfulness
  // (or omits rewriteAssessment): the selected riskyPart's own reason
  // diagnosed a specificity/payoff-type problem, but the rewrite still adds
  // no hard-anchor material — i.e. it only relocated the same vague claim.
  if (
    rewriteLacksMaterialImprovement(
      example,
      getSelectedRiskyPartReason(request)
    )
  ) {
    return {
      ok: false,
      reason:
        "example does not add any concrete material to the specificity/payoff problem diagnosed on the selected riskyPart — a cleaner paraphrase, not a meaningfully stronger hook.",
      safeRefusalEligible: true,
    };
  }

  return {
    ok: true,
    value: {
      answer: raw.answer,
      ...(action !== undefined ? { action } : {}),
      example,
      cannotSafelyRewrite: false,
    },
  };
}

const RISKY_PART_SEVERITY_RANK: Record<AnalysisV2Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// The single risky part Ask Climpy treats as "the riskiest part" — the
// highest-severity entry, first occurrence on a tie. Shared by both
// riskiest-part starter questions (explain / rewrite) so they always refer
// to the same part.
export function findRiskiestRiskyPartIndex(
  riskyParts: readonly AnalysisV2RiskyPart[]
): number | null {
  if (riskyParts.length === 0) return null;

  let bestIndex = 0;
  for (let index = 1; index < riskyParts.length; index += 1) {
    if (
      RISKY_PART_SEVERITY_RANK[riskyParts[index].severity] <
      RISKY_PART_SEVERITY_RANK[riskyParts[bestIndex].severity]
    ) {
      bestIndex = index;
    }
  }

  return bestIndex;
}

// Rewrite eligibility for a specific risky part: non-empty, no more than the
// approved 200-character bound, and an exact substring of the script. In
// practice a riskyPart sourced from a validated AnalysisV2Result already
// satisfies the substring check (analysis-v2-validation.ts enforces it at
// analysis time), but this is checked again here defensively — the same
// grounding rule the server independently re-enforces.
export function isRiskyPartRewriteEligible(
  part: AnalysisV2RiskyPart | undefined,
  script: string
): boolean {
  if (!part) return false;

  return (
    part.excerpt.length > 0 &&
    part.excerpt.length <= ASK_CLIMPY_LIMITS.maxRewriteFragmentCharacters &&
    script.includes(part.excerpt)
  );
}
