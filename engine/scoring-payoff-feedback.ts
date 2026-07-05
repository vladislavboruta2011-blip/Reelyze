import type { RiskyPart } from "./scoring-result-helpers";
import { createTimeRange } from "./scoring-timing";

// Payoff-focused script feedback analysis.
// Keep opening, middle, filler, and length feedback in their own module.

type PayoffFeedback = {
  riskyPart: RiskyPart | null;
  riskyLineIndex: number | null;
};

export function analyzePayoffFeedback({
  payoffStrength,
  consequenceScore,
  wordCount,
  isGoodScript,
  lastLineIsStrong,
  isGenericMotivationalEnding,
  totalLines,
  duration,
}: {
  payoffStrength: number;
  consequenceScore: number;
  wordCount: number;
  isGoodScript: boolean;
  lastLineIsStrong: boolean;
  isGenericMotivationalEnding: boolean;
  totalLines: number;
  duration: number;
}): PayoffFeedback {
  if (
    !(
      (
        payoffStrength < 28 &&
        consequenceScore < 15 &&
        wordCount >= 20 &&
        !isGoodScript &&
        !lastLineIsStrong
      ) ||
      (
        isGenericMotivationalEnding &&
        !isGoodScript
      )
    )
  ) {
    return {
      riskyPart: null,
      riskyLineIndex: null,
    };
  }

  return {
    riskyPart: {
      time: createTimeRange(
        0.75,
        1.0,
        duration,
      ),
      title: isGenericMotivationalEnding
        ? "Weak or generic payoff."
        : "Payoff could be stronger.",
      description: isGenericMotivationalEnding
        ? "The ending is too vague to feel rewarding. Replace it with a specific consequence, result, or unresolved detail."
        : "The ending may not feel rewarding. A clearer result or consequence would help.",
    },
    riskyLineIndex: Math.max(
      0,
      totalLines - 1,
    ),
  };
}

type PayoffPlacementFeedback = {
  replacement:
    | {
        title: string;
        description: string;
      }
    | null;
};

export function analyzePayoffPlacementFeedback({
  isGenericMotivationalEnding,
  hasListBuildup,
  lastLineIsStrong,
  hookNeedsWork,
  effectiveHookScore,
  alreadyHasStrongPayoffLateFeedback,
}: {
  isGenericMotivationalEnding: boolean;
  hasListBuildup: boolean;
  lastLineIsStrong: boolean;
  hookNeedsWork: boolean;
  effectiveHookScore: number;
  alreadyHasStrongPayoffLateFeedback: boolean;
}): PayoffPlacementFeedback {
  if (
    isGenericMotivationalEnding ||
    hasListBuildup ||
    !lastLineIsStrong ||
    !hookNeedsWork ||
    effectiveHookScore >= 55 ||
    alreadyHasStrongPayoffLateFeedback
  ) {
    return {
      replacement: null,
    };
  }

  return {
    replacement: {
      title: "Strong payoff appears too late.",
      description:
        "The strongest consequence is at the end but not in the opening. Move it earlier to stop the scroll.",
    },
  };
}
