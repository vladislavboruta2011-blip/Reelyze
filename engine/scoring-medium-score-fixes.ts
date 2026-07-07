// Medium-score suggested-fix builder helpers.

type PrimaryWeakArea =
  | "hook"
  | "short"
  | "payoff"
  | "generic"
  | "middle"
  | "none";

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
