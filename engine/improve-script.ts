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

const FALLBACK_DIAGNOSTIC_SCRIPT =
  "Add one concrete example, result, number, visual moment, or clear payoff before generating a full rewrite.";

const FALLBACK_DIAGNOSTIC_REASON =
  "The script is too broad to rewrite safely without inventing unsupported facts or a stronger payoff.";
const PRESERVE_SCRIPT_REASON =
  "The generated rewrite did not make a meaningful editorial improvement, so Climpy preserved the original script.";

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

export function buildImproveScriptDiagnosticResponse(
  reason = FALLBACK_DIAGNOSTIC_REASON
): ImproveScriptResult {
  return {
    status: "diagnostic",
    improvedScript: FALLBACK_DIAGNOSTIC_SCRIPT,
    changes: [
      "No full rewrite was generated because the script needs more concrete source material first.",
    ],
    reason,
    missingMaterial: [
      "A specific example",
      "A concrete visual moment",
      "A clear payoff",
      "A number, result, or consequence",
    ],
  };
}

export function buildImproveScriptPreserveResponse(
  originalScript: string
): ImproveScriptResult {
  return {
    status: "preserve",
    improvedScript: originalScript.trim(),
    changes: [],
    reason: PRESERVE_SCRIPT_REASON,
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
  result: ImproveScriptResult
): ImproveScriptResult {
  return {
    status: result.status,
    improvedScript: truncateText(
      result.improvedScript || FALLBACK_DIAGNOSTIC_SCRIPT,
      MAX_IMPROVED_SCRIPT_LENGTH
    ),
    changes:
      result.status === "preserve"
        ? []
        : normalizeStringList(
            result.changes,
            ["The rewrite was cleaned up for clarity and pacing."],
            MAX_CHANGES,
            MAX_CHANGE_LENGTH
          ),
    reason: truncateText(
      result.reason || "Climpy generated a safer script improvement.",
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
  refinedHook = ""
): ImproveScriptResult {
  const script = originalScript.trim();
  const approvedRefinedHook = refinedHook.trim();

  if (shouldDiagnoseImproveScript(script)) {
    return buildImproveScriptDiagnosticResponse();
  }

  const parsed = extractJsonObject(raw);
  const editorialDecision = parseEditorialDecision(
    parsed.editorialDecision,
    script
  );

  if (editorialDecision.strategy === "preserve") {
    return boundImproveScriptResult(
      buildImproveScriptPreserveResponse(script)
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

  if (
    !candidateAudit.resolvedPrimaryProblem ||
    !candidateAudit.candidateMateriallyBetter ||
    candidateAudit.regressionIntroduced
  ) {
    return boundImproveScriptResult(
      buildImproveScriptPreserveResponse(script)
    );
  }

  if (
    approvedRefinedHook &&
    !improvedScript.startsWith(approvedRefinedHook)
  ) {
    throw new UnusableAIResponseError();
  }

  if (
    !approvedRefinedHook &&
    (editorialDecision.primaryProblemScope === "body" ||
      editorialDecision.primaryProblemScope === "payoff") &&
    !preservesOriginalOpeningExactly(script, improvedScript)
  ) {
    return boundImproveScriptResult(
      buildImproveScriptPreserveResponse(script)
    );
  }

  if (hasOnlySurfaceChanges(script, improvedScript)) {
    throw new UnusableAIResponseError();
  }

  if (usesUnsupportedNumberWithUnit(script, improvedScript)) {
    return buildImproveScriptDiagnosticResponse(
      "The generated rewrite introduced a number or measurement that was not supported by the original script."
    );
  }

  if (changesSupportedExplicitCause(script, improvedScript)) {
    return buildImproveScriptDiagnosticResponse(
      "The generated rewrite changed who or what caused a supported event from the original script."
    );
  }

  if (
    isLightParaphraseWithoutEditorialImprovement(
      script,
      improvedScript
    )
  ) {
    return boundImproveScriptResult(
      buildImproveScriptPreserveResponse(script)
    );
  }

  const result: ImproveScriptResult = {
    status: "improved",
    improvedScript,
    editorialDecision,
    changes: normalizeStringList(
      parsed.changes,
      ["The rewrite improves clarity, pacing, and payoff delivery."],
      MAX_CHANGES,
      MAX_CHANGE_LENGTH
    ),
    reason:
      typeof parsed.reason === "string" && parsed.reason.trim().length > 0
        ? parsed.reason.trim()
        : "The script was rewritten using only the original material while improving clarity and pacing.",
  };

  return boundImproveScriptResult(result);
}
