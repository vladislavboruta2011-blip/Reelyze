import { dedupeFixes } from "./scoring-fixes";
import {
  dedupeRiskyParts,
  type RiskyPart,
} from "./scoring-result-helpers";

// Warning-line detection and final normalization of legacy scoring feedback.
// Keep score calculation and feedback generation outside this module.

export type FinalizedScoringFeedback = {
  uniqueRiskyParts: RiskyPart[];
  uniqueFixes: string[];
  uniqueRiskyIndexes: number[];
  uniqueWarningIndexes: number[];
};

export function collectWarningLineIndexes(
  lines: string[],
  riskyLineIndexes: number[],
  genericPenalty: number,
): number[] {
  const warningLineIndexes: number[] = [];

  lines.forEach((line, index) => {
    if (riskyLineIndexes.includes(index)) return;

    const lower = line.toLowerCase();
    const isMediumLength =
      line.length > 110 && line.length <= 200;

    const isVague =
      (
        lower.includes("viewers") ||
        lower.includes("creators") ||
        lower.includes("retention")
      ) &&
      !lower.includes("?") &&
      !lower.includes("but") &&
      !lower.includes("real problem");

    const hasWarningPhrase = [
      "most people think",
      "most creators think",
      "the problem is",
      "step by step",
      "every line should",
      "add one line",
      "start with",
    ].some((phrase) => lower.includes(phrase));

    const isGenericLine =
      genericPenalty >= 12 &&
      [
        "you should",
        "you need to",
        "this will help",
        "make sure",
        "try to",
        "get better",
        "improve your",
      ].some((phrase) => lower.includes(phrase));

    if (
      isMediumLength ||
      isVague ||
      hasWarningPhrase ||
      isGenericLine
    ) {
      warningLineIndexes.push(index);
    }
  });

  return warningLineIndexes;
}

function getStartSeconds(time: string): number {
  const match = time.match(/(\d+):(\d+)/);

  return match
    ? parseInt(match[1]) * 60 + parseInt(match[2])
    : 0;
}

export function finalizeScoringFeedback({
  riskyParts,
  fixes,
  riskyLineIndexes,
  warningLineIndexes,
  totalLines,
}: {
  riskyParts: RiskyPart[];
  fixes: string[];
  riskyLineIndexes: number[];
  warningLineIndexes: number[];
  totalLines: number;
}): FinalizedScoringFeedback {
  riskyParts.sort(
    (a, b) =>
      getStartSeconds(a.time) -
      getStartSeconds(b.time),
  );

  const mergedRiskyParts: RiskyPart[] = [];

  for (const part of riskyParts) {
    const partStart = getStartSeconds(part.time);

    const overlapping = mergedRiskyParts.findIndex(
      (existing) => {
        const existingStart =
          getStartSeconds(existing.time);

        return Math.abs(
          partStart - existingStart,
        ) <= 3;
      },
    );

    if (overlapping === -1) {
      mergedRiskyParts.push(part);
      continue;
    }

    const existing = mergedRiskyParts[overlapping];

    if (
      part.title.length >
      (existing?.title.length ?? 0)
    ) {
      mergedRiskyParts[overlapping] = part;
    }
  }

  const uniqueRiskyParts =
    dedupeRiskyParts(mergedRiskyParts);

  const uniqueFixes =
    dedupeFixes(fixes).slice(0, 5);

  const uniqueRiskyIndexes = [
    ...new Set(riskyLineIndexes),
  ]
    .filter(
      (index) =>
        index >= 0 && index < totalLines,
    )
    .sort((a, b) => a - b);

  const uniqueWarningIndexes = [
    ...new Set(warningLineIndexes),
  ]
    .filter(
      (index) =>
        index >= 0 &&
        index < totalLines &&
        !uniqueRiskyIndexes.includes(index),
    )
    .sort((a, b) => a - b);

  return {
    uniqueRiskyParts,
    uniqueFixes,
    uniqueRiskyIndexes,
    uniqueWarningIndexes,
  };
}
