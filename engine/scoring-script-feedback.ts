import { hasPrizeStake } from "./scoring-script-preprocessing";
import type { RiskyPart } from "./scoring-result-helpers";
import type { ScriptStructures } from "./scoring-structures";
import { createTimeRange } from "./scoring-timing";

// Aligned script feedback analysis.
// Keep preprocessing, score calculation, result assembly, and UI concerns outside this module.

type ShortScriptFeedback = {
  riskyPart: RiskyPart | null;
  fixes: string[];
};

export function analyzeShortScriptFeedback({
  charCount,
  isStructurallyCompleteShort,
  isPrimaryWeakShort,
  duration,
}: {
  charCount: number;
  isStructurallyCompleteShort: boolean;
  isPrimaryWeakShort: boolean;
  duration: number;
}): ShortScriptFeedback {
  if (
    charCount >= 180 ||
    isStructurallyCompleteShort
  ) {
    return {
      riskyPart: null,
      fixes: [],
    };
  }

  const riskyPart: RiskyPart = {
    time: createTimeRange(
      0.1,
      0.8,
      duration,
    ),
    title: "Script may be too short.",
    description:
      "The idea may not feel developed enough before the ending.",
  };

  const fixes = isPrimaryWeakShort
    ? [
        "Add one stronger example, specific detail, or consequence before the final payoff.",
        "Include a number, result, or named reference to make the script feel grounded.",
        "Expand the payoff — state clearly what changes, what was lost, or what the viewer should take away.",
      ]
    : [];

  return {
    riskyPart,
    fixes,
  };
}

type OpeningFeedbackAnalysis = {
  riskyParts: RiskyPart[];
  riskyLineIndexes: number[];
  warningLineIndexes: number[];
};

export function analyzeOpeningFeedback({
  normalizedText,
  firstSentence,
  isViralOrGiveaway,
  hookNeedsWork,
  effectiveHookScore,
  isGenericMotivationalEnding,
  structures,
  hasScenarioOpener,
  scenarioHasStakes,
  curiosityScore,
  duration,
}: {
  normalizedText: string;
  firstSentence: string;
  isViralOrGiveaway: boolean;
  hookNeedsWork: boolean;
  effectiveHookScore: number;
  isGenericMotivationalEnding: boolean;
  structures: ScriptStructures;
  hasScenarioOpener: boolean;
  scenarioHasStakes: boolean;
  curiosityScore: number;
  duration: number;
}): OpeningFeedbackAnalysis {
  const riskyParts: RiskyPart[] = [];
  const riskyLineIndexes: number[] = [];
  const warningLineIndexes: number[] = [];

  const viralHasClearPremise =
    isViralOrGiveaway &&
    (
      hasPrizeStake(normalizedText) ||
      /\b(wherever|whatever|whichever).{0,40}(lands?|wins?|gets?|keep)\b/i.test(
        normalizedText.toLowerCase(),
      ) ||
      /\b(bet|challenge|impossible|can you)\b/i.test(
        firstSentence.toLowerCase(),
      )
    );

  if (
    hookNeedsWork &&
    effectiveHookScore < 45 &&
    !viralHasClearPremise
  ) {
    if (
      !isGenericMotivationalEnding &&
      !structures.hasListBuildup &&
      (
        structures.hasStrongPayoffLate ||
        structures.hasConsequencePayoff
      )
    ) {
      riskyParts.push({
        time: createTimeRange(
          0,
          0.25,
          duration,
        ),
        title: "Strong payoff appears too late.",
        description:
          "The opening announces the topic instead of leading with the strongest consequence or detail from the script.",
      });
    } else {
      const isLowStakesScenario =
        hasScenarioOpener &&
        !scenarioHasStakes;

      riskyParts.push({
        time: createTimeRange(
          0,
          0.25,
          duration,
        ),
        title: isLowStakesScenario
          ? "Opening lacks stakes or consequence."
          : "Weak opening.",
        description: isLowStakesScenario
          ? "The scenario creates an image but does not give viewers a strong reason to care. Add a consequence, mystery, or specific strange result."
          : "The first line may not stop viewers from swiping. It needs more curiosity, contrast, or a clear result.",
      });
    }

    riskyLineIndexes.push(0);
  } else if (
    hookNeedsWork &&
    effectiveHookScore < 65
  ) {
    warningLineIndexes.push(0);
  }

  if (
    hookNeedsWork &&
    curiosityScore < 12 &&
    effectiveHookScore < 55
  ) {
    const alreadyHasOpeningIssue =
      riskyParts.some(
        (part) =>
          part.title === "Weak opening." ||
          part.title ===
            "Strong payoff appears too late.",
      );

    if (!alreadyHasOpeningIssue) {
      riskyParts.push({
        time: createTimeRange(
          0,
          0.3,
          duration,
        ),
        title: "No clear curiosity gap.",
        description:
          "The opening explains the topic but does not create enough tension or an unanswered question.",
      });

      if (!riskyLineIndexes.includes(0)) {
        riskyLineIndexes.push(0);
      }
    }
  }

  return {
    riskyParts,
    riskyLineIndexes,
    warningLineIndexes,
  };
}

type GenericFeedback = {
  riskyPart: RiskyPart | null;
  riskyLineIndex: number | null;
  warningLineIndex: number | null;
};

export function analyzeGenericFeedback({
  lines,
  hasScenarioOpener,
  genericPenalty,
  overallScore,
  duration,
}: {
  lines: string[];
  hasScenarioOpener: boolean;
  genericPenalty: number;
  overallScore: number;
  duration: number;
}): GenericFeedback {
  if (
    genericPenalty < 12 ||
    overallScore >= 72
  ) {
    return {
      riskyPart: null,
      riskyLineIndex: null,
      warningLineIndex: null,
    };
  }

  const hasScenarioStructure =
    hasScenarioOpener ||
    /^(imagine|what if|picture this)\b/i.test(
      lines[0] ?? "",
    );

  const midIdx = Math.floor(
    lines.length / 2,
  );

  return {
    riskyPart: {
      time: createTimeRange(
        0.2,
        0.7,
        duration,
      ),
      title: hasScenarioStructure
        ? "Scenario lacks stakes or consequence."
        : "Script feels too generic.",
      description: hasScenarioStructure
        ? "The scenario creates an image but the lines do not build toward a strong consequence, mystery, or specific tension."
        : "The lines repeat obvious ideas without a concrete example, number, twist, or consequence.",
    },
    riskyLineIndex: midIdx,
    warningLineIndex:
      lines.length > 3
        ? midIdx - 1
        : null,
  };
}
