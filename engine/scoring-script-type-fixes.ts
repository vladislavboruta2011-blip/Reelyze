// Script-type-specific suggested-fix builder helpers.

export function buildScriptTypeFixes({
  isViralOrGiveaway,
  isEmotionalStory,
  normalizedText,
  normalizedLines,
  payoffStrength,
  hasConsequencePayoff,
  wordCount,
  hookNeedsWork,
  effectiveHookScore,
  specificityScore,
}: {
  isViralOrGiveaway: boolean;
  isEmotionalStory: boolean;
  normalizedText: string;
  normalizedLines: readonly string[];
  payoffStrength: number;
  hasConsequencePayoff: boolean;
  wordCount: number;
  hookNeedsWork: boolean;
  effectiveHookScore: number;
  specificityScore: number;
}): string[] {
  const fixes: string[] = [];

  if (isViralOrGiveaway) {
    const lowerNorm =
      normalizedText.toLowerCase();

    const hasCTAInterrupt =
      /\b(subscribe|follow|hit subscribe|smash subscribe)\b/i.test(
        lowerNorm,
      ) &&
      normalizedLines.length >= 4 &&
      normalizedLines
        .slice(
          0,
          Math.floor(
            normalizedLines.length * 0.8,
          ),
        )
        .some((line) =>
          /\b(subscribe|follow)\b/i.test(
            line.toLowerCase(),
          ),
        );

    if (hasCTAInterrupt) {
      fixes.push(
        "Move the subscribe CTA to after the payoff — placing it before the challenge resolves may cause viewers to drop.",
      );
    }

    if (payoffStrength < 40) {
      fixes.push(
        "Add one clear consequence: what happens if the challenge fails or succeeds?",
      );
    }

    if (
      !hasConsequencePayoff &&
      wordCount > 30
    ) {
      fixes.push(
        "Make the challenge outcome clearer before any CTA — viewers need to know if it worked.",
      );
    }
  }

  if (isEmotionalStory) {
    if (payoffStrength < 35) {
      fixes.push(
        "Make the emotional payoff more specific — what exactly changed, and how does the viewer feel the impact?",
      );
    }

    if (
      hookNeedsWork &&
      effectiveHookScore < 65
    ) {
      fixes.push(
        "Open with the most emotional or unexpected moment from the story — not just the setup.",
      );
    }

    if (specificityScore < 20) {
      fixes.push(
        "Add one specific named detail, place, or action to make the story feel real rather than general.",
      );
    }
  }

  return fixes;
}
