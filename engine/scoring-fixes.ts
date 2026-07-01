// Suggested-fix semantic grouping and deduplication.
// Keep scoring orchestration and mutable fix collection outside this module.

export function getFixSemanticKey(value: string): string {
  const lower = value.toLowerCase();

  if (/opening|first line|open with|rewrite the opening|lead with|sharpen the first/.test(lower)) {
    return "opening";
  }
  if (/payoff|final line|end with|outcome clearer|challenge outcome|viewer feels rewarded|viewer feels clearly rewarded/.test(lower)) {
    return "payoff";
  }
  if (/include a number|specific detail|named reference|real-world example|make the script feel grounded|make it feel grounded/.test(lower)) {
    return "specificity";
  }
  if (/raise the stakes|what is at risk|what was lost/.test(lower)) {
    return "stakes";
  }
  if (/middle section|pattern interrupt|unexpected turn|add a contrast|contrast line/.test(lower)) {
    return "middle";
  }
  if (/cut repeated|make each line earn|tighten any line|cut any sentence/.test(lower)) {
    return "tighten";
  }

  return lower
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

export function dedupeFixes(values: string[]): string[] {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = getFixSemanticKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
