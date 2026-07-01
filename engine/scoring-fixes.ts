import type { ScriptStructures } from "./scoring-structures";

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

type PrimaryWeakArea =
  | "hook"
  | "short"
  | "payoff"
  | "generic"
  | "middle"
  | "none";

export function buildPrimaryWeaknessFixes({
  primaryWeak,
  hookNeedsWork,
  effectiveHookScore,
  structures,
  lines,
}: {
  primaryWeak: PrimaryWeakArea;
  hookNeedsWork: boolean;
  effectiveHookScore: number;
  structures: ScriptStructures;
  lines: readonly string[];
}): string[] {
  const fixes: string[] = [];

  if (
    primaryWeak === "hook" &&
    hookNeedsWork &&
    effectiveHookScore < 65
  ) {
    if (
      !structures.hasListBuildup &&
      (
        structures.hasStrongPayoffLate ||
        structures.hasConsequencePayoff
      )
    ) {
      fixes.push(
        "Lead with the consequence: move your strongest final line to the very beginning.",
      );
    } else if (
      structures.hasMysteryClueBuildup
    ) {
      const strongestMysteryClue =
        lines.slice(1).find((line) => {
          const lower = line.toLowerCase();
          const clueWordCount =
            line.split(/\s+/).length;

          return (
            clueWordCount >= 5 &&
            clueWordCount <= 18 &&
            (
              lower.includes("still") ||
              lower.includes("untouched") ||
              lower.includes("left behind") ||
              lower.includes("no signs") ||
              lower.includes("nothing was") ||
              lower.includes("everything was") ||
              lower.includes("appeared") ||
              lower.includes("looked like") ||
              lower.includes("seemed")
            )
          );
        });

      if (strongestMysteryClue) {
        fixes.push(
          `Open with the most specific physical detail: "${strongestMysteryClue
            .replace(/[.!?]+$/, "")
            .trim()}" creates more tension than announcing the topic.`,
        );
      } else {
        fixes.push(
          "Open with the most specific clue or physical detail from the script instead of announcing the topic.",
        );
      }
    } else {
      fixes.push(
        "Rewrite the opening line — it should lead with the strongest detail, consequence, or contrast from your script, not just announce the topic.",
      );
    }
  }

  if (primaryWeak === "generic") {
    fixes.push(
      "Replace generic advice lines with a single concrete example, number, or real consequence.",
    );
    fixes.push(
      "Cut any sentence that could apply to any video — only keep lines specific to this topic.",
    );
  }

  if (primaryWeak === "payoff") {
    fixes.push(
      "Make the final payoff more specific — state the result, consequence, or unresolved mystery clearly.",
    );
  }

  return fixes;
}

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
