import { dedupeFixes } from "./scoring-fixes";
import type { FinalizedScoringFeedback } from "./scoring-risk-finalization";
import { dedupeRiskyParts } from "./scoring-result-helpers";
import { createTimeRange } from "./scoring-timing";

// Enforces minimum feedback coverage after initial feedback finalization.
// Keep warning collection and initial normalization outside this module.

export function enforceScoringFeedbackMinimums({
  uniqueRiskyParts,
  uniqueFixes,
  uniqueRiskyIndexes,
  uniqueWarningIndexes,
  overallScore,
  effectiveHookScore,
  hasStructuredEscalation,
  isStructurallyCompleteShort,
  hookNeedsWork,
  hasConsequencePayoff,
  contrastScore,
  payoffScore,
  consequenceScore,
  openLoopScore,
  genericPenalty,
  payoffStrength,
  lastLineIsStrong,
  totalLines,
  duration,
}: FinalizedScoringFeedback & {
  overallScore: number;
  effectiveHookScore: number;
  hasStructuredEscalation: boolean;
  isStructurallyCompleteShort: boolean;
  hookNeedsWork: boolean;
  hasConsequencePayoff: boolean;
  contrastScore: number;
  payoffScore: number;
  consequenceScore: number;
  openLoopScore: number;
  genericPenalty: number;
  payoffStrength: number;
  lastLineIsStrong: boolean;
  totalLines: number;
  duration: number;
}): FinalizedScoringFeedback {
  let nextRiskyParts = [...uniqueRiskyParts];
  let nextFixes = [...uniqueFixes];

  const nextRiskyIndexes = [
    ...uniqueRiskyIndexes,
  ];

  const nextWarningIndexes = [
    ...uniqueWarningIndexes,
  ];

  if (overallScore < 58) {
    const alreadyHasOpeningPart =
      nextRiskyParts.some(
        (part) =>
          part.title
            .toLowerCase()
            .includes("weak opening") ||
          part.title
            .toLowerCase()
            .includes("hook needs") ||
          part.title
            .toLowerCase()
            .includes("curiosity gap") ||
          part.title
            .toLowerCase()
            .includes("too short") ||
          part.title
            .toLowerCase()
            .includes("strong payoff appears"),
      );

    if (
      nextRiskyParts.length < 2 &&
      effectiveHookScore < 65 &&
      !alreadyHasOpeningPart
    ) {
      nextRiskyParts.push({
        time: createTimeRange(
          0,
          0.25,
          duration,
        ),
        title: "Hook needs more work.",
        description:
          "The opening does not clearly create curiosity, contrast, or a reason to stay.",
      });

      if (!nextRiskyIndexes.includes(0)) {
        nextRiskyIndexes.push(0);
      }
    }

    if (
      nextRiskyParts.length < 2 &&
      !hasStructuredEscalation
    ) {
      nextRiskyParts.push({
        time: createTimeRange(
          0.35,
          0.65,
          duration,
        ),
        title: "Middle may lose momentum.",
        description:
          "The script may need a stronger turn, contrast, or new piece of information.",
      });

      nextRiskyIndexes.push(
        Math.max(
          1,
          Math.floor(totalLines / 2),
        ),
      );
    }

    if (
      nextFixes.length < 4 &&
      !isStructurallyCompleteShort
    ) {
      const hasOpeningFix =
        nextFixes.some((fix) => {
          const lower = fix.toLowerCase();

          return (
            lower.includes("rewrite") ||
            lower.includes("sharpen") ||
            lower.includes("opening line") ||
            lower.includes("lead with")
          );
        });

      if (
        hookNeedsWork &&
        effectiveHookScore < 65 &&
        !hasOpeningFix
      ) {
        nextFixes.push(
          "Rewrite the opening line — lead with the strongest consequence, contrast, or specific detail from your script.",
        );
      } else if (
        !hasConsequencePayoff &&
        !nextFixes.some((fix) => {
          const lower = fix.toLowerCase();

          return (
            lower.includes("sharpen") ||
            lower.includes("tighten") ||
            lower.includes("payoff")
          );
        })
      ) {
        nextFixes.push(
          "Make the payoff more specific so the viewer feels rewarded.",
        );
      }

      if (
        contrastScore < 20 &&
        !hasStructuredEscalation &&
        !nextFixes.some((fix) =>
          fix
            .toLowerCase()
            .includes("contrast"),
        )
      ) {
        nextFixes.push(
          "Add a contrast or pattern interrupt in the middle section.",
        );
      }

      if (
        payoffScore < 20 &&
        consequenceScore < 15 &&
        !hasConsequencePayoff &&
        !nextFixes.some((fix) =>
          fix
            .toLowerCase()
            .includes("payoff"),
        )
      ) {
        nextFixes.push(
          "Make the payoff more specific so the viewer feels rewarded.",
        );
      }

      if (nextFixes.length < 4) {
        nextFixes.push(
          "Make each line earn its place — cut any sentence that does not add new information or tension.",
        );
      }
    }

    nextRiskyParts =
      dedupeRiskyParts(nextRiskyParts);

    nextFixes =
      dedupeFixes(nextFixes).slice(0, 5);
  } else if (overallScore < 75) {
    const alreadyHasOpeningPart =
      nextRiskyParts.some(
        (part) =>
          part.title
            .toLowerCase()
            .includes("weak opening") ||
          part.title
            .toLowerCase()
            .includes("hook needs") ||
          part.title
            .toLowerCase()
            .includes("curiosity gap") ||
          part.title
            .toLowerCase()
            .includes("strong payoff appears"),
      );

    if (
      nextRiskyParts.length < 1 &&
      nextFixes.length > 0
    ) {
      if (
        effectiveHookScore < 65 &&
        !alreadyHasOpeningPart
      ) {
        nextRiskyParts.push({
          time: createTimeRange(
            0,
            0.25,
            duration,
          ),
          title: "Hook needs more work.",
          description:
            "The opening does not clearly create curiosity, contrast, or a reason to stay.",
        });

        if (!nextRiskyIndexes.includes(0)) {
          nextRiskyIndexes.push(0);
        }
      } else if (genericPenalty >= 12) {
        nextRiskyParts.push({
          time: createTimeRange(
            0.2,
            0.7,
            duration,
          ),
          title: "Script feels too generic.",
          description:
            "The lines repeat obvious ideas without a concrete example, number, or consequence.",
        });
      } else if (
        payoffStrength < 35 &&
        !lastLineIsStrong
      ) {
        nextRiskyParts.push({
          time: createTimeRange(
            0.75,
            1,
            duration,
          ),
          title: "Payoff could be stronger.",
          description:
            "The ending may not feel rewarding. A clearer result or consequence would help.",
        });

        nextRiskyIndexes.push(
          Math.max(0, totalLines - 1),
        );
      }
    }

    if (nextFixes.length < 2) {
      const hasOpeningFix =
        nextFixes.some((fix) => {
          const lower = fix.toLowerCase();

          return (
            lower.includes("sharpen") ||
            lower.includes("rewrite") ||
            lower.includes("lead with")
          );
        });

      if (
        hookNeedsWork &&
        effectiveHookScore < 68 &&
        !hasOpeningFix
      ) {
        nextFixes.push(
          "Sharpen the first line with a stronger curiosity gap or clearer contrast.",
        );
      }

      if (
        contrastScore < 15 &&
        openLoopScore < 15 &&
        !hasStructuredEscalation &&
        !nextFixes.some((fix) => {
          const lower = fix.toLowerCase();

          return (
            lower.includes("contrast") ||
            lower.includes("turn")
          );
        })
      ) {
        nextFixes.push(
          "Add a contrast or unexpected turn in the middle section.",
        );
      }

      if (
        payoffScore < 20 &&
        consequenceScore < 15 &&
        !lastLineIsStrong &&
        !nextFixes.some((fix) => {
          const lower = fix.toLowerCase();

          return (
            lower.includes("payoff") ||
            lower.includes("result")
          );
        })
      ) {
        nextFixes.push(
          "End with a specific result, consequence, or unresolved detail the viewer will remember.",
        );
      }

      if (nextFixes.length < 2) {
        nextFixes.push(
          "Make each line earn its place — cut any sentence that does not add new information or tension.",
        );
      }
    }

    nextRiskyParts =
      dedupeRiskyParts(nextRiskyParts);

    nextFixes =
      dedupeFixes(nextFixes).slice(0, 5);
  }

  if (
    nextRiskyParts.length === 0 &&
    overallScore >= 80
  ) {
    nextFixes.length = 0;
    nextRiskyIndexes.length = 0;
    nextWarningIndexes.length = 0;
  }

  if (
    nextRiskyParts.length > 0 &&
    nextFixes.length === 0
  ) {
    const hasPayoffIssue =
      nextRiskyParts.some((part) => {
        const lower =
          part.title.toLowerCase();

        return (
          lower.includes("payoff") ||
          lower.includes("generic payoff") ||
          lower.includes("weak or generic")
        );
      });

    const hasHookIssue =
      nextRiskyParts.some((part) => {
        const lower =
          part.title.toLowerCase();

        return (
          lower.includes("hook") ||
          lower.includes("opening") ||
          lower.includes("curiosity gap")
        );
      });

    const hasMiddleIssue =
      nextRiskyParts.some((part) => {
        const lower =
          part.title.toLowerCase();

        return (
          lower.includes("middle") ||
          lower.includes("momentum")
        );
      });

    if (hasPayoffIssue) {
      nextFixes.push(
        "Replace the final line with a specific consequence, result, or unresolved detail that rewards viewers for watching.",
      );
    }

    if (
      hasHookIssue &&
      !nextFixes.some((fix) => {
        const lower = fix.toLowerCase();

        return (
          lower.includes("opening") ||
          lower.includes("hook")
        );
      })
    ) {
      nextFixes.push(
        "Sharpen the opening line with a stronger curiosity gap, contrast, or concrete detail.",
      );
    }

    if (
      hasMiddleIssue &&
      !nextFixes.some((fix) => {
        const lower = fix.toLowerCase();

        return (
          lower.includes("middle") ||
          lower.includes("tension")
        );
      })
    ) {
      nextFixes.push(
        "Tighten the middle section — each line should add new information or tension.",
      );
    }

    if (nextFixes.length === 0) {
      nextFixes.push(
        "Make each line earn its place — cut any sentence that does not add new information or tension.",
      );
    }
  }

  nextFixes =
    dedupeFixes(nextFixes).slice(0, 5);

  return {
    uniqueRiskyParts: nextRiskyParts,
    uniqueFixes: nextFixes,
    uniqueRiskyIndexes: nextRiskyIndexes,
    uniqueWarningIndexes: nextWarningIndexes,
  };
}
