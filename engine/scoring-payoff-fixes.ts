// Payoff-specific suggested-fix builder helpers.

type PrimaryWeakArea =
  | "hook"
  | "short"
  | "payoff"
  | "generic"
  | "middle"
  | "none";

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
