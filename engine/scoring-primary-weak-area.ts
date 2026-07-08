// Primary weak-area classifier for scoring feedback.

export type PrimaryWeakArea =
  | "hook"
  | "short"
  | "payoff"
  | "generic"
  | "middle"
  | "none";

export function determinePrimaryWeakArea({
  isVeryShort,
  charCount,
  isStructurallyCompleteShort,
  hookNeedsWork,
  effectiveHookScore,
  genericPenalty,
  payoffStrength,
  consequenceScore,
}: {
  isVeryShort: boolean;
  charCount: number;
  isStructurallyCompleteShort: boolean;
  hookNeedsWork: boolean;
  effectiveHookScore: number;
  genericPenalty: number;
  payoffStrength: number;
  consequenceScore: number;
}): PrimaryWeakArea {
  if (
    (isVeryShort || charCount < 180) &&
    !isStructurallyCompleteShort
  ) {
    return "short";
  }

  if (
    hookNeedsWork &&
    effectiveHookScore < 45
  ) {
    return "hook";
  }

  if (genericPenalty >= 20) {
    return "generic";
  }

  if (
    payoffStrength < 28 &&
    consequenceScore < 15
  ) {
    return "payoff";
  }

  if (
    hookNeedsWork &&
    effectiveHookScore < 65
  ) {
    return "hook";
  }

  // If hookIsAcceptable, never classify the primary weakness as "hook".
  return "none";
}
