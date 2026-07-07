// Context-aware suggested-fix builders used by the scoring feedback pipeline.

// Keep fix deduplication and feedback orchestration outside this module.

export { buildScriptTypeFixes } from "./scoring-script-type-fixes";

export { buildPrimaryWeaknessFixes } from "./scoring-primary-weakness-fixes";

export { buildSupportingSignalFixes } from "./scoring-supporting-signal-fixes";

export { buildBodyAndLengthFixes } from "./scoring-body-length-fixes";

export { buildPayoffFixes } from "./scoring-payoff-fixes";

export { buildStrongEndingOpeningFixes } from "./scoring-strong-ending-opening-fixes";

export { buildMediumScoreFixes } from "./scoring-medium-score-fixes";

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
