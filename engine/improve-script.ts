import {
  UnusableAIResponseError,
  hasAnyConcreteAnchor,
  isVeryGenericScript,
} from "./improve-hook";

export type ImproveScriptPrimaryProblemScope =
  | "hook"
  | "body"
  | "payoff"
  | "whole_script";

export type ImproveScriptEditorialDecision = {
  strategy: "rewrite";
  primaryProblemScope: ImproveScriptPrimaryProblemScope;
  primaryProblem: string;
  primaryProblemEvidence: string;
};

type ImproveScriptCandidateAudit = {
  resolvedPrimaryProblem: boolean;
  candidateMateriallyBetter: boolean;
  regressionIntroduced: boolean;
};

type ParsedImproveScriptEditorialDecision =
  | ImproveScriptEditorialDecision
  | {
      strategy: "preserve";
    };

export type ImproveScriptResult = {
  status: "improved" | "diagnostic" | "preserve" | "error";
  improvedScript: string;
  changes: string[];
  reason: string;
  editorialDecision?: ImproveScriptEditorialDecision;
  missingMaterial?: string[];
};

// Kept local and decoupled from lib/i18n.ts, matching this module's existing
// independence from the rest of the app. Only used for deterministic
// diagnostic/preserve/fallback text — never for improvedScript itself, which
// must always stay in the original script's language.
export type ImproveScriptLocale = "en" | "ru";

const FALLBACK_DIAGNOSTIC_SCRIPT: Record<ImproveScriptLocale, string> = {
  en: "Add one concrete example, result, number, visual moment, or clear payoff before generating a full rewrite.",
  ru: "Добавьте конкретный пример, результат, число, визуальный момент или ясную развязку, прежде чем создавать полную версию сценария.",
};

const FALLBACK_DIAGNOSTIC_REASON: Record<ImproveScriptLocale, string> = {
  en: "The script is too broad to rewrite safely without inventing unsupported facts or a stronger payoff.",
  ru: "Этот сценарий слишком общий, чтобы безопасно переписать его без выдумывания фактов или более сильной развязки.",
};
// Only ever reached when the original itself needs no change — either the
// model chose "preserve" directly, or a rewrite attempt's own candidate
// regressed an existing strength (see parseImproveScriptResponse). Must
// read as "the original already works," never as "the model failed" —
// every OTHER failed-candidate case is a diagnostic outcome instead.
const PRESERVE_SCRIPT_REASON: Record<ImproveScriptLocale, string> = {
  en: "Climpy kept your original script — it already works well, and a rewrite would not add meaningful value.",
  ru: "Climpy сохранил ваш исходный сценарий — он уже работает хорошо, и переписывание не добавило бы значимой ценности.",
};

const CHANGES_FALLBACK: Record<ImproveScriptLocale, string> = {
  en: "The rewrite was cleaned up for clarity and pacing.",
  ru: "Версия была доработана для ясности и темпа.",
};

const REASON_FALLBACK: Record<ImproveScriptLocale, string> = {
  en: "Climpy generated a safer script improvement.",
  ru: "Climpy сгенерировал более безопасное улучшение сценария.",
};

const NO_FULL_REWRITE_CHANGE: Record<ImproveScriptLocale, string> = {
  en: "No full rewrite was generated because the script needs more concrete source material first.",
  ru: "Полная версия не была создана, потому что сценарию сначала нужно больше конкретного исходного материала.",
};

const MISSING_MATERIAL_ITEMS: Record<ImproveScriptLocale, string[]> = {
  en: [
    "A specific example",
    "A concrete visual moment",
    "A clear payoff",
    "A number, result, or consequence",
  ],
  ru: [
    "Конкретный пример",
    "Конкретный визуальный момент",
    "Ясную развязку",
    "Число, результат или последствие",
  ],
};

const UNSUPPORTED_NUMBER_REASON: Record<ImproveScriptLocale, string> = {
  en: "The generated rewrite introduced a number or measurement that was not supported by the original script.",
  ru: "Сгенерированная версия ввела число или измерение, не подтверждённое исходным сценарием.",
};

const CHANGED_CAUSE_REASON: Record<ImproveScriptLocale, string> = {
  en: "The generated rewrite changed who or what caused a supported event from the original script.",
  ru: "Сгенерированная версия изменила, кто или что стало причиной подтверждённого события из исходного сценария.",
};

const WEAKENED_CERTAINTY_REASON: Record<ImproveScriptLocale, string> = {
  en: "The generated rewrite stated an approximate or uncertain detail from the original script as if it were exact or certain.",
  ru: "Сгенерированная версия представила приблизительную или неопределённую деталь исходного сценария как точную или достоверную.",
};

// Distinct from the "source lacks material" diagnostic (buildImproveScriptDiagnosticResponse
// below) — used when the ORIGINAL script already contains adequate concrete
// material (see containsHardAnchorMaterial) but this specific candidate
// still failed a safety/quality check. Telling the user their script
// "needs a concrete fact/comparison/event/payoff" would be false in this
// case — the material is visibly present, Climpy's attempt just wasn't
// good enough this time. No missingMaterial: there is nothing to "add".
const CANDIDATE_QUALITY_REASON: Record<ImproveScriptLocale, string> = {
  en: "Climpy generated a version, but it wasn't a meaningfully stronger improvement this time — even though the script already has enough material to work with.",
  ru: "Climpy создал версию, но в этот раз она не стала заметно сильнее — хотя в сценарии уже достаточно материала для работы.",
};

const CANDIDATE_QUALITY_HINT: Record<ImproveScriptLocale, string> = {
  en: "Try running Improve Script again for another attempt.",
  ru: "Попробуйте запустить улучшение сценария ещё раз.",
};

// A non-empty placeholder, not []: boundImproveScriptResult's changes
// normalization treats an empty array as "no changes were supplied" and
// substitutes CHANGES_FALLBACK ("cleaned up for clarity and pacing" —
// misleading here, since nothing was actually cleaned up or accepted).
const CANDIDATE_QUALITY_CHANGE: Record<ImproveScriptLocale, string> = {
  en: "No rewrite was accepted this time.",
  ru: "На этот раз версия не была принята.",
};

const DEFAULT_CHANGES_FALLBACK: Record<ImproveScriptLocale, string> = {
  en: "The rewrite improves clarity, pacing, and payoff delivery.",
  ru: "Версия улучшает ясность, темп и подачу развязки.",
};

const DEFAULT_REASON_FALLBACK: Record<ImproveScriptLocale, string> = {
  en: "The script was rewritten using only the original material while improving clarity and pacing.",
  ru: "Сценарий был переписан с использованием только исходного материала, с улучшением ясности и темпа.",
};

const MAX_IMPROVED_SCRIPT_LENGTH = 1_400;
const MAX_REASON_LENGTH = 600;
const MAX_PRIMARY_PROBLEM_LENGTH = 400;
const MAX_PRIMARY_PROBLEM_EVIDENCE_LENGTH = 500;
const MAX_CHANGE_LENGTH = 220;
const MAX_CHANGES = 6;
const MAX_MISSING_MATERIAL_ITEMS = 5;

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function normalizeStringList(
  value: unknown,
  fallback: string[],
  maxItems: number,
  maxItemLength: number
): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => truncateText(item, maxItemLength))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);

  return items.length > 0 ? items : fallback;
}

function parseEditorialDecision(
  value: unknown,
  originalScript: string
): ParsedImproveScriptEditorialDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UnusableAIResponseError();
  }

  const decision = value as Record<string, unknown>;

  if (decision.strategy === "preserve") {
    return {
      strategy: "preserve",
    };
  }

  const primaryProblemScope =
    decision.primaryProblemScope === "hook" ||
    decision.primaryProblemScope === "body" ||
    decision.primaryProblemScope === "payoff" ||
    decision.primaryProblemScope === "whole_script"
      ? decision.primaryProblemScope
      : null;
  const primaryProblem =
    typeof decision.primaryProblem === "string"
      ? decision.primaryProblem.trim()
      : "";
  const primaryProblemEvidence =
    typeof decision.primaryProblemEvidence === "string"
      ? decision.primaryProblemEvidence.trim()
      : "";

  if (
    decision.strategy !== "rewrite" ||
    !primaryProblemScope ||
    !primaryProblem ||
    !primaryProblemEvidence
  ) {
    throw new UnusableAIResponseError();
  }

  const normalizedScript =
    normalizeScriptForSurfaceComparison(originalScript);
  const normalizedEvidence =
    normalizeScriptForSurfaceComparison(primaryProblemEvidence);

  if (
    !normalizedEvidence ||
    !normalizedScript.includes(normalizedEvidence)
  ) {
    throw new UnusableAIResponseError();
  }

  return {
    strategy: "rewrite",
    primaryProblemScope,
    primaryProblem: truncateText(
      primaryProblem,
      MAX_PRIMARY_PROBLEM_LENGTH
    ),
    primaryProblemEvidence: truncateText(
      primaryProblemEvidence,
      MAX_PRIMARY_PROBLEM_EVIDENCE_LENGTH
    ),
  };
}

function parseCandidateAudit(
  value: unknown
): ImproveScriptCandidateAudit {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UnusableAIResponseError();
  }

  const audit = value as Record<string, unknown>;

  if (
    typeof audit.resolvedPrimaryProblem !== "boolean" ||
    typeof audit.candidateMateriallyBetter !== "boolean" ||
    typeof audit.regressionIntroduced !== "boolean"
  ) {
    throw new UnusableAIResponseError();
  }

  return {
    resolvedPrimaryProblem: audit.resolvedPrimaryProblem,
    candidateMateriallyBetter: audit.candidateMateriallyBetter,
    regressionIntroduced: audit.regressionIntroduced,
  };
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new UnusableAIResponseError();
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new UnusableAIResponseError();
    }

    return parsed as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new UnusableAIResponseError();
    }

    const extracted = trimmed.slice(start, end + 1);
    const parsed = JSON.parse(extracted);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new UnusableAIResponseError();
    }

    return parsed as Record<string, unknown>;
  }
}

function normalizeScriptForSurfaceComparison(
  value: string
): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hasOnlySurfaceChanges(
  originalScript: string,
  improvedScript: string
): boolean {
  return (
    normalizeScriptForSurfaceComparison(originalScript) ===
    normalizeScriptForSurfaceComparison(improvedScript)
  );
}

function splitScriptSentences(value: string): string[] {
  return (
    value
      .replace(/\n+/g, " ")
      .match(/[^.!?]+[.!?]?/g) ?? []
  )
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function preservesOriginalOpeningExactly(
  originalScript: string,
  improvedScript: string
): boolean {
  const originalOpening = splitScriptSentences(originalScript)[0] ?? "";
  const improvedOpening = splitScriptSentences(improvedScript)[0] ?? "";

  return (
    originalOpening.length > 0 &&
    improvedOpening === originalOpening
  );
}

// Diagnosed live: an approved refined hook is often itself awkward (e.g. a
// single overloaded sentence — see the Ronaldo hook regression), so a
// genuinely better candidate legitimately compresses/reorders it rather
// than repeating it verbatim. Requiring an exact opening match rejected
// good, grounded candidates outright. This replaces that exact-match
// requirement with two narrower, targeted checks:
//   1. never allow a question to silently replace a non-question hook (the
//      original historical concern — an invented "Did you know...?" tease)
//   2. otherwise require the candidate's opening to still substantially
//      reuse the SAME grounded material the approved hook describes (a high
//      token-overlap coefficient), so a candidate that abandons the
//      approved hook's content entirely for something unrelated is still
//      rejected.
function abandonsApprovedRefinedHook(
  approvedRefinedHook: string,
  improvedScript: string
): boolean {
  const candidateOpening = splitScriptSentences(improvedScript)[0] ?? "";

  const approvedIsQuestion = approvedRefinedHook.trim().endsWith("?");
  const candidateIsQuestion = candidateOpening.trim().endsWith("?");

  if (candidateIsQuestion && !approvedIsQuestion) {
    return true;
  }

  return (
    calculateTokenOverlapCoefficient(
      approvedRefinedHook,
      candidateOpening
    ) < 0.6
  );
}

// ── Uncertainty/hedge preservation ───────────────────────────────────────
// Diagnosed live: the model reliably combined grounded measurements into a
// single sentence but just as reliably dropped the hedge words attached to
// them ("might reach" collapsing into a bare noun phrase; "roughly"/
// "about"/"around" occasionally left stranded on the wrong number after
// reordering) — silently strengthening an approximate, uncertain original
// claim into unqualified certainty. This is a safety concern (see
// UNSUPPORTED_NUMBER_REASON/CHANGED_CAUSE_REASON above for the same
// pattern), not an editorial-value judgment call.
const HEDGE_ADVERB_PATTERN =
  /\b(?:around|about|roughly|approximately|nearly|almost)\b/i;
// Excludes "could not"/"might not" via the negative lookahead — those
// express NEGATED ABILITY ("they could not get out"), not epistemic
// uncertainty about a fact or measurement, and must never be mistaken for
// a hedge worth preserving.
const MODAL_HEDGE_VERB_PATTERN = /\b(?:might|could)\s+(?!not\b)(\w+)/gi;

// Positional: a number/measurement that was adverbially hedged in the
// original (e.g. "around 9 feet 7 inches") must still have SOME hedge word
// within a short window before it wherever it reappears in the candidate —
// it does not need to be the exact same hedge word, just an equivalent one.
function dropsAdverbialHedgeFromNumber(
  originalScript: string,
  improvedScript: string
): boolean {
  const originalLower = originalScript.toLowerCase();
  const improvedLower = improvedScript.toLowerCase();

  for (const numberUnit of collectNumbersWithUnits(originalScript)) {
    const originalIndex = originalLower.indexOf(numberUnit);
    if (originalIndex === -1) continue;

    const wasHedged = HEDGE_ADVERB_PATTERN.test(
      originalLower.slice(Math.max(0, originalIndex - 24), originalIndex)
    );
    if (!wasHedged) continue;

    const improvedIndex = improvedLower.indexOf(numberUnit);
    if (improvedIndex === -1) continue; // number dropped entirely — a different concern, not this check

    const stillHedged = HEDGE_ADVERB_PATTERN.test(
      improvedLower.slice(Math.max(0, improvedIndex - 24), improvedIndex)
    );

    if (!stillHedged) {
      return true;
    }
  }

  return false;
}

function collectModalHedgeVerbs(text: string): Set<string> {
  return new Set(
    Array.from(
      text.matchAll(new RegExp(MODAL_HEDGE_VERB_PATTERN, "gi")),
      (match) => match[1].toLowerCase()
    )
  );
}

// Whole-script: a modal hedge ("might reach", "could be") is often lost
// entirely when a clause is compressed into a noun phrase (e.g. "an average
// person might reach about X" becoming "the average person's jump of X") —
// no single number position captures this loss, so this checks for the
// modal-hedge vocabulary vanishing from the script altogether (coarse by
// design — it does not require the exact same verb to survive, only that
// SOME epistemic "might/could" hedge remains somewhere).
function dropsModalHedge(
  originalScript: string,
  improvedScript: string
): boolean {
  if (collectModalHedgeVerbs(originalScript).size === 0) return false;

  return collectModalHedgeVerbs(improvedScript).size === 0;
}

function weakensHedgedCertainty(
  originalScript: string,
  improvedScript: string
): boolean {
  return (
    dropsAdverbialHedgeFromNumber(originalScript, improvedScript) ||
    dropsModalHedge(originalScript, improvedScript)
  );
}

function tokenizeScriptForComparison(value: string): string[] {
  return (
    value
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

function calculateTokenOverlapCoefficient(
  first: string,
  second: string
): number {
  const firstTokens = new Set(
    tokenizeScriptForComparison(first)
  );
  const secondTokens = new Set(
    tokenizeScriptForComparison(second)
  );

  if (firstTokens.size === 0 || secondTokens.size === 0) {
    return 0;
  }

  let sharedTokens = 0;

  for (const token of firstTokens) {
    if (secondTokens.has(token)) {
      sharedTokens += 1;
    }
  }

  return (
    sharedTokens /
    Math.min(firstTokens.size, secondTokens.size)
  );
}

function isLightParaphraseWithoutEditorialImprovement(
  originalScript: string,
  improvedScript: string
): boolean {
  const originalSentences =
    splitScriptSentences(originalScript);
  const improvedSentences =
    splitScriptSentences(improvedScript);

  if (
    originalSentences.length < 3 ||
    originalSentences.length !== improvedSentences.length
  ) {
    return false;
  }

  const bestMatches = improvedSentences.map(
    (improvedSentence) => {
      let bestOriginalIndex = 0;
      let bestOverlap = 0;

      for (
        let originalIndex = 0;
        originalIndex < originalSentences.length;
        originalIndex += 1
      ) {
        const overlap =
          calculateTokenOverlapCoefficient(
            originalSentences[originalIndex],
            improvedSentence
          );

        if (overlap > bestOverlap) {
          bestOriginalIndex = originalIndex;
          bestOverlap = overlap;
        }
      }

      return {
        originalIndex: bestOriginalIndex,
        overlap: bestOverlap,
      };
    }
  );

  const preservesSentenceOrder = bestMatches.every(
    (match, index) =>
      index === 0 ||
      match.originalIndex >=
        bestMatches[index - 1].originalIndex
  );

  const finalMatch =
    bestMatches[bestMatches.length - 1];

  const preservesFinalOutcome =
    finalMatch.originalIndex ===
    originalSentences.length - 1;

  const everySentenceRetainsOriginalMaterial =
    bestMatches.every((match) => match.overlap >= 0.4);

  const originalTokens =
    tokenizeScriptForComparison(originalScript);
  const improvedTokens =
    tokenizeScriptForComparison(improvedScript);

  if (
    originalTokens.length === 0 ||
    improvedTokens.length === 0
  ) {
    return false;
  }

  const originalTokenSet = new Set(originalTokens);

  const retainedImprovedTokens = improvedTokens.filter(
    (token) => originalTokenSet.has(token)
  ).length;

  const improvedToOriginalLengthRatio =
    improvedTokens.length / originalTokens.length;

  const retainedImprovedTokenRatio =
    retainedImprovedTokens / improvedTokens.length;

  const replacesManyWordsWithoutEditorialChange =
    improvedToOriginalLengthRatio >= 0.9 &&
    retainedImprovedTokenRatio < 0.65;

  const closelyCopiesEverySentence =
    improvedToOriginalLengthRatio >= 0.8 &&
    retainedImprovedTokenRatio >= 0.75 &&
    bestMatches.every((match) => match.overlap >= 0.7);

  return (
    preservesSentenceOrder &&
    preservesFinalOutcome &&
    everySentenceRetainsOriginalMaterial &&
    (replacesManyWordsWithoutEditorialChange ||
      closelyCopiesEverySentence)
  );
}

function collectNumbersWithUnits(text: string): Set<string> {
  const matches = text.matchAll(
    /\b\d+(?:[.,]\d+)?\s?(?:%|percent|seconds?|minutes?|hours?|days?|weeks?|months?|years?|feet|foot|ft|inches?|mph|miles?|km|kilometers?|metres?|meters?|cm|centimeters?|mm|millimeters?|degrees?|billion|million|thousand)\b/gi
  );

  return new Set(
    Array.from(matches, (match) =>
      match[0].toLowerCase().replace(/\s+/g, " ").trim()
    )
  );
}

// A fabricated measurement is just as much an invention when it is
// word-quantified ("almost a foot higher", "half a meter", "several
// inches") as when it uses a digit ("12 seconds") — collectNumbersWithUnits
// alone misses these because it requires \d. Diagnosed live: the model
// introduced "almost a foot higher than the average person" for a script
// that never states any height difference at all, and the digit-only check
// let it through as an "improved" result.
function collectWordQuantifiedMeasurements(text: string): Set<string> {
  const matches = text.matchAll(
    /\b(?:a|an|half(?:\s+a)?|several|a\s+few|a\s+couple(?:\s+of)?|many|almost\s+an?|nearly\s+an?|about\s+an?|roughly\s+an?)\s+(?:%|percent|seconds?|minutes?|hours?|days?|weeks?|months?|years?|feet|foot|ft|inch|inches|mph|miles?|mile|km|kilometers?|metres?|meters?|meter|cm|centimeters?|mm|millimeters?|degrees?)\b/gi
  );

  return new Set(
    Array.from(matches, (match) =>
      match[0].toLowerCase().replace(/\s+/g, " ").trim()
    )
  );
}

function usesUnsupportedNumberWithUnit(
  originalScript: string,
  improvedScript: string
): boolean {
  const originalNumbers = collectNumbersWithUnits(originalScript);
  const improvedNumbers = collectNumbersWithUnits(improvedScript);

  for (const number of improvedNumbers) {
    if (!originalNumbers.has(number)) {
      return true;
    }
  }

  const originalWordMeasurements =
    collectWordQuantifiedMeasurements(originalScript);
  const improvedWordMeasurements =
    collectWordQuantifiedMeasurements(improvedScript);

  for (const measurement of improvedWordMeasurements) {
    if (!originalWordMeasurements.has(measurement)) {
      return true;
    }
  }

  return false;
}

type ExplicitCausalRelation = {
  connector: string;
  cause: string;
  effect: string;
};

function normalizeCausalConnector(value: string): string {
  const lower = value.toLowerCase().replace(/\s+/g, " ").trim();

  if (/^forc/.test(lower)) return "force";
  if (/^caus/.test(lower)) return "cause";
  if (/^trigger/.test(lower)) return "trigger";
  if (/^(?:make|makes|made)$/.test(lower)) return "make";
  if (/^(?:lead|leads|led) to$/.test(lower)) return "lead-to";
  if (/^(?:result|results|resulted) in$/.test(lower)) {
    return "result-in";
  }
  if (/^prevent/.test(lower)) return "prevent";
  if (/^enable/.test(lower)) return "enable";

  return lower;
}

function getCausalRelationKind(
  connector: string
): "cause" | "prevent" | "enable" {
  if (connector === "prevent") {
    return "prevent";
  }

  if (connector === "enable") {
    return "enable";
  }

  return "cause";
}

function extractExplicitCausalRelations(
  script: string
): ExplicitCausalRelation[] {
  const relations: ExplicitCausalRelation[] = [];

  for (const sentence of splitScriptSentences(script)) {
    const match = sentence.match(
      /^(.+?)\b(causes?|caused|forces?|forced|triggers?|triggered|makes?|made|leads?\s+to|led\s+to|results?\s+in|resulted\s+in|prevents?|prevented|enables?|enabled)\b(.+)$/i
    );

    if (!match) {
      continue;
    }

    const rawCause = match[1].trim();
    const rawEffect = match[3].trim();

    const causeSegments = rawCause.split(
      /\b(?:before|after|when|while|because|since|as|and|but)\b|[,;:—]/i
    );
    const effectSegments = rawEffect.split(/[,;:—]/);

    const cause =
      causeSegments[causeSegments.length - 1]?.trim() ?? rawCause;
    const effect = effectSegments[0]?.trim() ?? rawEffect;

    if (!cause || !effect) {
      continue;
    }

    relations.push({
      connector: normalizeCausalConnector(match[2]),
      cause,
      effect,
    });
  }

  return relations;
}

function changesSupportedExplicitCause(
  originalScript: string,
  improvedScript: string
): boolean {
  const originalRelations =
    extractExplicitCausalRelations(originalScript);
  const improvedRelations =
    extractExplicitCausalRelations(improvedScript);

  for (const improvedRelation of improvedRelations) {
    const matchingOriginalEffects = originalRelations.filter(
      (originalRelation) =>
        calculateTokenOverlapCoefficient(
          originalRelation.effect,
          improvedRelation.effect
        ) >= 0.75
    );

    if (matchingOriginalEffects.length === 0) {
      continue;
    }

    const preservesSupportedCause = matchingOriginalEffects.some(
      (originalRelation) =>
        getCausalRelationKind(originalRelation.connector) ===
          getCausalRelationKind(improvedRelation.connector) &&
        calculateTokenOverlapCoefficient(
          originalRelation.cause,
          improvedRelation.cause
        ) >= 0.5
    );

    if (!preservesSupportedCause) {
      return true;
    }
  }

  return false;
}

// Deliberately narrow, targeted backstop — NOT a full semantic judge (see
// engine/ask-climpy-validation.ts's rewriteLacksMaterialImprovement, which
// established the same principle: a diagnosed vagueness/specificity
// problem is not solved by reordering or rephrasing the same vague claim,
// only by introducing genuinely new concrete material). Diagnosed live: the
// model reworded "the most surprising part is how much higher he could jump
// than an average person" into a "Did you know...?" question opener for a
// script with zero concrete material anywhere — sentence-count and
// sentence-order stayed the same, so isLightParaphraseWithoutEditorialImprovement's
// matching missed it (the model pulled content thematically forward,
// confusing the best-match/order-preservation heuristic), and the
// candidateAudit is the model's own self-report, which is not always honest.
// This only fires when the ORIGINAL script has zero hard-anchor material
// anywhere AND the candidate still adds none — i.e. the diagnosed
// vagueness problem is provably, deterministically still unresolved.
// A bare unit word ("feet", "seconds", "percent"...) with no actual number
// attached is not a concrete quantity — "he could jump several feet" is as
// vague as "he could jump much higher." /\d/ below already covers every
// genuine number+unit pair (and any other bare digit), so this only needs
// to catch a unit word specifically anchored to a digit.
const IMPROVE_SCRIPT_HARD_ANCHOR_PATTERNS: readonly RegExp[] = [
  /\d/,
  /\b(?:because|therefore|as a result|which means|led to|resulted in|caused|triggered|due to|consequently)\b/i,
];

function containsHardAnchorMaterial(text: string): boolean {
  return IMPROVE_SCRIPT_HARD_ANCHOR_PATTERNS.some((pattern) =>
    pattern.test(text)
  );
}

const VAGUENESS_PROBLEM_SIGNAL_PATTERNS: readonly RegExp[] = [
  /\bgeneric\b/i,
  /\bvague\b/i,
  /\btoo broad\b/i,
  /\bnot specific\b/i,
  /\bspecificity\b/i,
  /\bno concrete\b/i,
  /\bunsupported\b/i,
];

function candidateStillLacksSpecificity(
  // The model doesn't consistently phrase the vagueness diagnosis in
  // primaryProblem itself — it just as often surfaces there in "reason"
  // ("the original opening was too generic...") or "changes" ("Replaced
  // the generic opening..."). Scanning all three the model actually wrote
  // catches this regardless of which field it chose to word it in.
  explanationText: string,
  originalScript: string,
  improvedScript: string
): boolean {
  const isVaguenessProblem = VAGUENESS_PROBLEM_SIGNAL_PATTERNS.some(
    (pattern) => pattern.test(explanationText)
  );

  if (!isVaguenessProblem) return false;

  return (
    !containsHardAnchorMaterial(originalScript) &&
    !containsHardAnchorMaterial(improvedScript)
  );
}

export function buildImproveScriptDiagnosticResponse(
  locale: ImproveScriptLocale = "en",
  reason?: string
): ImproveScriptResult {
  return {
    status: "diagnostic",
    improvedScript: FALLBACK_DIAGNOSTIC_SCRIPT[locale],
    changes: [NO_FULL_REWRITE_CHANGE[locale]],
    reason: reason ?? FALLBACK_DIAGNOSTIC_REASON[locale],
    missingMaterial: MISSING_MATERIAL_ITEMS[locale],
  };
}

// See CANDIDATE_QUALITY_REASON above: a candidate-failed-but-material-was-
// adequate outcome. Same public "diagnostic" status (no schema change —
// see Phase 6 of the task this responds to), but never claims material is
// missing: no missingMaterial field, and a neutral "try again" hint instead
// of the source-insufficiency advice text.
export function buildImproveScriptCandidateQualityDiagnosticResponse(
  locale: ImproveScriptLocale = "en"
): ImproveScriptResult {
  return {
    status: "diagnostic",
    improvedScript: CANDIDATE_QUALITY_HINT[locale],
    changes: [CANDIDATE_QUALITY_CHANGE[locale]],
    reason: CANDIDATE_QUALITY_REASON[locale],
  };
}

// Used by the safety-violation checks (unsupported number, changed cause,
// weakened certainty). These usually mean the model HAD adequate material
// and still mishandled it — but not always: a genuinely anchor-free
// original can also provoke a fabricated number (see the Finding A
// regression — the model invented "78 centimeters" for a script with no
// measurement anywhere). Whether the source itself has adequate material
// must be checked here too, exactly like buildFailedCandidateDiagnosticResponse
// does for an audit-based rejection, so a vague original still reaches the
// honest "add material" bucket instead of a false "you have enough
// material, try again." The specific, accurate explanation of what the
// candidate did wrong is preserved either way via the caller-supplied reason.
function buildSafetyViolationDiagnosticResponse(
  originalScript: string,
  locale: ImproveScriptLocale,
  reason: string
): ImproveScriptResult {
  if (!containsHardAnchorMaterial(originalScript)) {
    return buildImproveScriptDiagnosticResponse(locale, reason);
  }

  return {
    status: "diagnostic",
    improvedScript: CANDIDATE_QUALITY_HINT[locale],
    changes: [CANDIDATE_QUALITY_CHANGE[locale]],
    reason,
  };
}

// Dispatches a failed-candidate outcome to the correct diagnostic bucket:
// when the original script genuinely has no concrete anchor material
// anywhere, the source really is insufficient (existing copy, with
// missingMaterial); when it does, this specific candidate simply wasn't
// good enough — never tell the user facts are missing when they visibly
// are not (see Phase 4 of the task this responds to).
function buildFailedCandidateDiagnosticResponse(
  originalScript: string,
  locale: ImproveScriptLocale
): ImproveScriptResult {
  if (containsHardAnchorMaterial(originalScript)) {
    return buildImproveScriptCandidateQualityDiagnosticResponse(locale);
  }

  return buildImproveScriptDiagnosticResponse(locale);
}

export function buildImproveScriptPreserveResponse(
  originalScript: string,
  locale: ImproveScriptLocale = "en"
): ImproveScriptResult {
  return {
    status: "preserve",
    improvedScript: originalScript.trim(),
    changes: [],
    reason: PRESERVE_SCRIPT_REASON[locale],
  };
}

export function shouldDiagnoseImproveScript(script: string): boolean {
  const trimmedScript = script.trim();

  if (trimmedScript.length === 0) {
    return true;
  }

  if (!hasAnyConcreteAnchor(trimmedScript)) {
    return true;
  }

  return isVeryGenericScript(trimmedScript).isGeneric;
}

export function boundImproveScriptResult(
  result: ImproveScriptResult,
  locale: ImproveScriptLocale = "en"
): ImproveScriptResult {
  return {
    status: result.status,
    improvedScript: truncateText(
      result.improvedScript || FALLBACK_DIAGNOSTIC_SCRIPT[locale],
      MAX_IMPROVED_SCRIPT_LENGTH
    ),
    changes:
      result.status === "preserve"
        ? []
        : normalizeStringList(
            result.changes,
            [CHANGES_FALLBACK[locale]],
            MAX_CHANGES,
            MAX_CHANGE_LENGTH
          ),
    reason: truncateText(
      result.reason || REASON_FALLBACK[locale],
      MAX_REASON_LENGTH
    ),
    ...(result.editorialDecision
      ? {
          editorialDecision: {
            strategy: result.editorialDecision.strategy,
            primaryProblemScope:
              result.editorialDecision.primaryProblemScope,
            primaryProblem: truncateText(
              result.editorialDecision.primaryProblem,
              MAX_PRIMARY_PROBLEM_LENGTH
            ),
            primaryProblemEvidence: truncateText(
              result.editorialDecision.primaryProblemEvidence,
              MAX_PRIMARY_PROBLEM_EVIDENCE_LENGTH
            ),
          },
        }
      : {}),
    ...(result.missingMaterial
      ? {
          missingMaterial: normalizeStringList(
            result.missingMaterial,
            [],
            MAX_MISSING_MATERIAL_ITEMS,
            MAX_CHANGE_LENGTH
          ),
        }
      : {}),
  };
}

export function parseImproveScriptResponse(
  raw: string,
  originalScript: string,
  refinedHook = "",
  skipLegacyDiagnostic = false,
  locale: ImproveScriptLocale = "en"
): ImproveScriptResult {
  const script = originalScript.trim();
  const approvedRefinedHook = refinedHook.trim();

  if (
    !skipLegacyDiagnostic &&
    shouldDiagnoseImproveScript(script)
  ) {
    return buildImproveScriptDiagnosticResponse(locale);
  }

  const parsed = extractJsonObject(raw);
  const editorialDecision = parseEditorialDecision(
    parsed.editorialDecision,
    script
  );

  if (editorialDecision.strategy === "preserve") {
    return boundImproveScriptResult(
      buildImproveScriptPreserveResponse(script, locale),
      locale
    );
  }

  const improvedScript =
    typeof parsed.improvedScript === "string"
      ? parsed.improvedScript.trim()
      : "";

  if (!improvedScript) {
    throw new UnusableAIResponseError();
  }

  const candidateAudit = parseCandidateAudit(
    parsed.candidateAudit
  );

  // The model itself chose "rewrite" — meaning it already identified a real
  // primaryProblem/primaryProblemEvidence in the ORIGINAL — so once past
  // this point, a failed candidate can no longer mean "the original is
  // fine" (that is only true of the direct editorialDecision.strategy ===
  // "preserve" branch above, which by construction never carries a
  // primaryProblem). See engine/improve-script.ts's module-level note below
  // for the preserve/diagnostic split this implies.
  //
  // EXCEPTION: regressionIntroduced === true means the candidate actively
  // made something WORSE than the original (broke an existing strength) —
  // that specifically indicates the original was fine in that respect and
  // the attempted fix backfired, so protecting the original via preserve is
  // the safer, more honest outcome than telling the user their script lacks
  // material. Every OTHER failure mode below means the diagnosed weakness
  // remains genuinely unresolved — a diagnostic outcome, never presented as
  // "the original is already effective" and never returning the unchanged
  // original inside an "improved" result.
  if (candidateAudit.regressionIntroduced) {
    return boundImproveScriptResult(
      buildImproveScriptPreserveResponse(script, locale),
      locale
    );
  }

  if (
    !candidateAudit.resolvedPrimaryProblem ||
    !candidateAudit.candidateMateriallyBetter
  ) {
    return boundImproveScriptResult(
      buildFailedCandidateDiagnosticResponse(script, locale),
      locale
    );
  }

  if (
    approvedRefinedHook &&
    abandonsApprovedRefinedHook(approvedRefinedHook, improvedScript)
  ) {
    // The candidate abandoned the already-approved hook's content entirely
    // (or silently swapped in a riskier question-style opener) rather than
    // reusing/restructuring the same grounded material — see
    // abandonsApprovedRefinedHook's own comment. A candidate that merely
    // compresses or reorders the approved hook's facts is accepted below,
    // not rejected here.
    return boundImproveScriptResult(
      buildFailedCandidateDiagnosticResponse(script, locale),
      locale
    );
  }

  if (
    !approvedRefinedHook &&
    (editorialDecision.primaryProblemScope === "body" ||
      editorialDecision.primaryProblemScope === "payoff") &&
    !preservesOriginalOpeningExactly(script, improvedScript)
  ) {
    // The diagnosed problem was in the body/payoff, not the hook, but the
    // candidate changed the hook anyway — an unsafe candidate for a real,
    // diagnosed body/payoff weakness, not proof the original needs no work.
    return boundImproveScriptResult(
      buildFailedCandidateDiagnosticResponse(script, locale),
      locale
    );
  }

  if (hasOnlySurfaceChanges(script, improvedScript)) {
    // A rewrite that only changes casing/punctuation/whitespace made no
    // material change at all — the diagnosed primaryProblem is still
    // unresolved, not proof the original was already fine.
    return boundImproveScriptResult(
      buildFailedCandidateDiagnosticResponse(script, locale),
      locale
    );
  }

  if (usesUnsupportedNumberWithUnit(script, improvedScript)) {
    // A safety violation — the candidate fabricated something beyond the
    // source. Usually the model had adequate material and mishandled it,
    // but buildSafetyViolationDiagnosticResponse still checks the original
    // script itself, since a genuinely anchor-free original can also
    // provoke a fabricated number.
    return buildSafetyViolationDiagnosticResponse(
      script,
      locale,
      UNSUPPORTED_NUMBER_REASON[locale]
    );
  }

  if (changesSupportedExplicitCause(script, improvedScript)) {
    return buildSafetyViolationDiagnosticResponse(
      script,
      locale,
      CHANGED_CAUSE_REASON[locale]
    );
  }

  if (weakensHedgedCertainty(script, improvedScript)) {
    // Stating an approximate/uncertain original claim as if it were exact
    // is the same class of safety violation as inventing a number or
    // changing a cause — never presented as "improved", regardless of how
    // much adequate source material exists.
    return buildSafetyViolationDiagnosticResponse(
      script,
      locale,
      WEAKENED_CERTAINTY_REASON[locale]
    );
  }

  if (
    isLightParaphraseWithoutEditorialImprovement(
      script,
      improvedScript
    )
  ) {
    // A light paraphrase (or a closely-copied candidate — see
    // closelyCopiesEverySentence inside this check) hides the same
    // diagnosed weakness behind reworded text rather than solving it.
    return boundImproveScriptResult(
      buildFailedCandidateDiagnosticResponse(script, locale),
      locale
    );
  }

  const rawExplanationText = [
    editorialDecision.primaryProblem,
    typeof parsed.reason === "string" ? parsed.reason : "",
    Array.isArray(parsed.changes) ? parsed.changes.join(" ") : "",
  ].join(" ");

  if (
    candidateStillLacksSpecificity(
      rawExplanationText,
      script,
      improvedScript
    )
  ) {
    // The diagnosed problem was vagueness/genericness, the original had no
    // concrete material anywhere to begin with, and the candidate still
    // adds none — a reworded or reordered restatement of the same vague
    // claim, not a genuinely stronger, more specific version.
    return boundImproveScriptResult(
      buildImproveScriptDiagnosticResponse(locale),
      locale
    );
  }

  const result: ImproveScriptResult = {
    status: "improved",
    improvedScript,
    editorialDecision,
    changes: normalizeStringList(
      parsed.changes,
      [DEFAULT_CHANGES_FALLBACK[locale]],
      MAX_CHANGES,
      MAX_CHANGE_LENGTH
    ),
    reason:
      typeof parsed.reason === "string" && parsed.reason.trim().length > 0
        ? parsed.reason.trim()
        : DEFAULT_REASON_FALLBACK[locale],
  };

  return boundImproveScriptResult(result, locale);
}
