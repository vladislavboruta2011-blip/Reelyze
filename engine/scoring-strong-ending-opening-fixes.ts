// Strong-ending-as-opening suggested-fix builder helpers.

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
