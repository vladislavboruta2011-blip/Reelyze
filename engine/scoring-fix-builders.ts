// Context-aware suggested-fix builders used by the scoring feedback pipeline.

// Keep fix deduplication and feedback orchestration outside this module.

import type { ScriptStructures } from "./scoring-structures";

export { buildScriptTypeFixes } from "./scoring-script-type-fixes";

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
