// Context-aware suggested-fix builders used by the scoring feedback pipeline.

// Keep fix deduplication and feedback orchestration outside this module.

export { buildScriptTypeFixes } from "./scoring-script-type-fixes";

type PrimaryWeakArea =
  | "hook"
  | "short"
  | "payoff"
  | "generic"
  | "middle"
  | "none";

export { buildPrimaryWeaknessFixes } from "./scoring-primary-weakness-fixes";

export { buildSupportingSignalFixes } from "./scoring-supporting-signal-fixes";

export function buildBodyAndLengthFixes({
  hookNeedsWork,
  openLoopScore,
  curiosityScore,
  contrastScore,
  hasStructuredEscalation,
  middleHasConcreteContent,
  wordCount,
  overallScore,
  hasFluffPhrases,
  charCount,
  isStructurallyCompleteShort,
  primaryWeak,
}: {
  hookNeedsWork: boolean;
  openLoopScore: number;
  curiosityScore: number;
  contrastScore: number;
  hasStructuredEscalation: boolean;
  middleHasConcreteContent: boolean;
  wordCount: number;
  overallScore: number;
  hasFluffPhrases: boolean;
  charCount: number;
  isStructurallyCompleteShort: boolean;
  primaryWeak: PrimaryWeakArea;
}): string[] {
  const fixes: string[] = [];

  if (
    hookNeedsWork &&
    openLoopScore === 0 &&
    curiosityScore < 12 &&
    contrastScore < 15 &&
    !hasStructuredEscalation &&
    !middleHasConcreteContent &&
    wordCount >= 35 &&
    overallScore < 58
  ) {
    fixes.push(
      "Add an unanswered question or a delayed reveal to keep viewers engaged through the middle.",
    );
  }

  if (hasFluffPhrases) {
    fixes.push(
      "Replace filler phrases with a specific example, concrete consequence, or direct insight.",
    );
  }

  if (
    charCount < 180 &&
    !isStructurallyCompleteShort &&
    primaryWeak !== "short"
  ) {
    fixes.push(
      "Add one stronger example or consequence before the final payoff.",
    );
  }

  if (charCount > 850) {
    fixes.push(
      "Cut repeated explanations and keep only the strongest points.",
    );
  }

  return fixes;
}

export function buildPayoffFixes({
  payoffStrength,
  consequenceScore,
  wordCount,
  isGoodScript,
  lastLineIsStrong,
  primaryWeak,
}: {
  payoffStrength: number;
  consequenceScore: number;
  wordCount: number;
  isGoodScript: boolean;
  lastLineIsStrong: boolean;
  primaryWeak: PrimaryWeakArea;
}): string[] {
  const fixes: string[] = [];

  if (
    payoffStrength < 28 &&
    consequenceScore < 15 &&
    wordCount >= 20 &&
    !isGoodScript &&
    !lastLineIsStrong &&
    primaryWeak !== "payoff"
  ) {
    fixes.push(
      "Make the final payoff more specific — state the result, consequence, or unresolved mystery clearly.",
    );
  }

  return fixes;
}

export function buildStrongEndingOpeningFixes({
  lastLineIsStrong,
  effectiveHookScore,
  hasLeadWithFix,
}: {
  lastLineIsStrong: boolean;
  effectiveHookScore: number;
  hasLeadWithFix: boolean;
}): string[] {
  const fixes: string[] = [];

  if (
    lastLineIsStrong &&
    effectiveHookScore < 55 &&
    !hasLeadWithFix
  ) {
    fixes.push(
      "Lead with your strongest consequence: the final line of your script would make a more powerful opening.",
    );
  }

  return fixes;
}

export function buildMediumScoreFixes({
  hookNeedsWork,
  effectiveHookScore,
  primaryWeak,
  hasOpeningFix,
  hookIsAcceptable,
  isGoodScript,
  retentionRisk,
}: {
  hookNeedsWork: boolean;
  effectiveHookScore: number;
  primaryWeak: PrimaryWeakArea;
  hasOpeningFix: boolean;
  hookIsAcceptable: boolean;
  isGoodScript: boolean;
  retentionRisk: number;
}): string[] {
  const fixes: string[] = [];

  if (
    hookNeedsWork &&
    effectiveHookScore < 65 &&
    primaryWeak !== "hook" &&
    !hasOpeningFix
  ) {
    fixes.push(
      "Rewrite the opening line — lead with the strongest consequence, number, or contradiction from the script.",
    );
  } else if (
    hookIsAcceptable &&
    effectiveHookScore < 75 &&
    !isGoodScript &&
    retentionRisk > 35
  ) {
    fixes.push(
      "Tighten the middle section — each line should add new information or tension.",
    );
  }

  return fixes;
}

export function buildOptionalImprovementFixes({
  isGoodScript,
  isStrongScript,
  hasExistingFixes,
  hookScore,
  retentionRisk,
  specificityScore,
}: {
  isGoodScript: boolean;
  isStrongScript: boolean;
  hasExistingFixes: boolean;
  hookScore: number;
  retentionRisk: number;
  specificityScore: number;
}): string[] {
  const fixes: string[] = [];

  if (
    !isGoodScript ||
    isStrongScript ||
    hasExistingFixes
  ) {
    return fixes;
  }

  if (
    hookScore >= 65 &&
    retentionRisk <= 35
  ) {
    fixes.push(
      "Add one more specific example, number, or concrete detail to make the payoff feel more earned.",
    );
    fixes.push(
      "Make the payoff more specific so the viewer feels clearly rewarded.",
    );
    fixes.push(
      "Tighten any line that does not add new information or tension.",
    );
  } else {
    if (hookScore < 75) {
      fixes.push(
        "Sharpen the first line with a stronger curiosity gap or clearer contrast.",
      );
    }

    if (specificityScore < 30) {
      fixes.push(
        "Add one more specific detail to make the payoff feel even more concrete.",
      );
    }

    if (fixes.length === 0) {
      fixes.push(
        "Tighten any line that does not add new information or tension.",
      );
    }
  }

  return fixes;
}
