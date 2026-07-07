// Body-and-length-specific suggested-fix builder helpers.

type PrimaryWeakArea =
  | "hook"
  | "short"
  | "payoff"
  | "generic"
  | "middle"
  | "none";

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
