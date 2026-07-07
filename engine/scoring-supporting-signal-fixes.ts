// Supporting-signal-specific suggested-fix builder helpers.

export function buildSupportingSignalFixes({
  hookNeedsWork,
  curiosityScore,
  effectiveHookScore,
  contrastScore,
  openLoopScore,
  hasStructuredEscalation,
  wordCount,
  overallScore,
  genericPenalty,
  stakesScore,
  consequenceScore,
  specificityScore,
}: {
  hookNeedsWork: boolean;
  curiosityScore: number;
  effectiveHookScore: number;
  contrastScore: number;
  openLoopScore: number;
  hasStructuredEscalation: boolean;
  wordCount: number;
  overallScore: number;
  genericPenalty: number;
  stakesScore: number;
  consequenceScore: number;
  specificityScore: number;
}): string[] {
  const fixes: string[] = [];

  if (
    hookNeedsWork &&
    curiosityScore < 12 &&
    effectiveHookScore < 55
  ) {
    fixes.push(
      "Open with an unanswered question, a missing detail, or a surprising consequence.",
    );
  }

  if (
    contrastScore < 12 &&
    openLoopScore < 12 &&
    !hasStructuredEscalation &&
    wordCount > 20 &&
    overallScore < 58
  ) {
    fixes.push(
      'Add a contrast line mid-script — something like: "But that is not the real problem."',
    );
  }

  if (
    genericPenalty >= 12 &&
    overallScore < 72
  ) {
    fixes.push(
      "Add one specific detail, number, named reference, or real-world example to make the script feel grounded.",
    );
  }

  if (
    stakesScore < 12 &&
    consequenceScore < 10 &&
    wordCount >= 25 &&
    overallScore < 62
  ) {
    fixes.push(
      "Raise the stakes: what is at risk, what was lost, or what changes if this is ignored?",
    );
  }

  if (
    specificityScore < 10 &&
    wordCount >= 20 &&
    overallScore < 70
  ) {
    fixes.push(
      "Add a more concrete detail, example, consequence, or measurable result to make the script feel grounded.",
    );
  }

  return fixes;
}
