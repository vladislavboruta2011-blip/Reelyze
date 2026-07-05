import type { RiskyPart } from "./scoring-result-helpers";
import type { ScriptStructures } from "./scoring-structures";
import { createTimeRange } from "./scoring-timing";

// Body-focused script feedback analysis.
// Keep short-script, opening, generic, and payoff feedback in their own modules.

type OpenLoopFeedback = {
  middleHasConcreteContent: boolean;
  riskyPart: RiskyPart | null;
};

export function analyzeOpenLoopFeedback({
  lines,
  openLoopScore,
  curiosityScore,
  contrastScore,
  wordCount,
  overallScore,
  hasStructuredEscalation,
  isViralOrGiveaway,
  isEmotionalStory,
  duration,
}: {
  lines: string[];
  openLoopScore: number;
  curiosityScore: number;
  contrastScore: number;
  wordCount: number;
  overallScore: number;
  hasStructuredEscalation: boolean;
  isViralOrGiveaway: boolean;
  isEmotionalStory: boolean;
  duration: number;
}): OpenLoopFeedback {
  const totalLines = lines.length;

  const middleSectionText = lines
    .slice(
      Math.floor(totalLines * 0.25),
      Math.floor(totalLines * 0.75),
    )
    .join(" ");

  const middleHasConcreteContent =
    /\d/.test(middleSectionText) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(
      middleSectionText,
    ) ||
    /\b(feet|miles|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|billion|million|thousand|degrees)\b/i.test(
      middleSectionText,
    ) ||
    /\b(would|could) (disappear|fit|vanish|be hidden|be buried|be submerged|still have)\b/i.test(
      middleSectionText,
    ) ||
    /\bmore than (a mile|a kilometer|a foot|a meter|a year)\b/i.test(
      middleSectionText,
    ) ||
    hasStructuredEscalation;

  const shouldCreateRiskyPart =
    openLoopScore === 0 &&
    curiosityScore < 12 &&
    contrastScore < 15 &&
    wordCount >= 35 &&
    overallScore < 58 &&
    !hasStructuredEscalation &&
    !middleHasConcreteContent &&
    !isViralOrGiveaway &&
    !isEmotionalStory;

  return {
    middleHasConcreteContent,
    riskyPart: shouldCreateRiskyPart
      ? {
          time: createTimeRange(
            0.3,
            0.6,
            duration,
          ),
          title:
            "No reason to keep watching.",
          description:
            "The script may not give viewers enough curiosity or unresolved tension before the payoff.",
        }
      : null,
  };
}

type FillerFeedback = {
  hasFillerPhrases: boolean;
  riskyPart: RiskyPart | null;
};

export function analyzeFillerFeedback({
  lower,
  duration,
}: {
  lower: string;
  duration: number;
}): FillerFeedback {
  const fillerPhrases = [
    "basically",
    "as you can see",
    "i just want to",
    "this is very important",
    "let's talk about",
    "i'm going to explain",
    "really important",
  ];

  const hasFillerPhrases =
    fillerPhrases.some((phrase) =>
      lower.includes(phrase),
    );

  if (!hasFillerPhrases) {
    return {
      hasFillerPhrases: false,
      riskyPart: null,
    };
  }

  return {
    hasFillerPhrases: true,
    riskyPart: {
      time: createTimeRange(
        0.3,
        0.6,
        duration,
      ),
      title: "Possible filler phrases.",
      description:
        "Some lines may sound like setup instead of real value.",
    },
  };
}

type LengthFeedback = {
  riskyPart: RiskyPart | null;
};

export function analyzeLengthFeedback({
  charCount,
  duration,
}: {
  charCount: number;
  duration: number;
}): LengthFeedback {
  if (charCount <= 850) {
    return {
      riskyPart: null,
    };
  }

  return {
    riskyPart: {
      time: createTimeRange(
        0.55,
        0.85,
        duration,
      ),
      title: "Script may be too long.",
      description:
        "Viewers may lose focus before the ending.",
    },
  };
}

type FlatMiddleFeedback = {
  riskyPart: RiskyPart | null;
  riskyLineIndex: number | null;
};

export function analyzeFlatMiddleFeedback({
  lines,
  structures,
  isGoodScript,
  retentionRisk,
  duration,
  existingRiskyTitles,
}: {
  lines: string[];
  structures: ScriptStructures;
  isGoodScript: boolean;
  retentionRisk: number;
  duration: number;
  existingRiskyTitles: string[];
}): FlatMiddleFeedback {
  const totalLines = lines.length;

  if (totalLines < 5) {
    return {
      riskyPart: null,
      riskyLineIndex: null,
    };
  }

  const middleLines = lines.slice(
    Math.floor(totalLines * 0.33),
    Math.floor(totalLines * 0.66),
  );

  const middleText =
    middleLines.join(" ").toLowerCase();

  const middleHasContrastSignal = [
    "but",
    "however",
    "then",
    "suddenly",
    "except",
    "actually",
    "the problem",
    "real problem",
    "if it",
    "that is why",
    "result",
  ].some((phrase) =>
    middleText.includes(phrase),
  );

  const middleIsStructured =
    structures.hasListBuildup ||
    structures.hasMysteryClueBuildup ||
    structures.hasContradictionReversal;

  const shortLineCount =
    middleLines.filter(
      (line) =>
        line.split(/\s+/).length <= 7,
    ).length;

  const hasListBuildupPattern =
    shortLineCount >= 2;

  const postMiddleLines = lines.slice(
    Math.floor(totalLines * 0.66),
  );

  const postMiddleText =
    postMiddleLines.join(" ").toLowerCase();

  const hasPostEscalation =
    postMiddleText.includes("now imagine") ||
    postMiddleText.includes("now think") ||
    postMiddleText.includes("millions") ||
    postMiddleText.includes("permanent") ||
    postMiddleText.includes("once it") ||
    postMiddleText.includes("everyone") ||
    postMiddleText.includes("the scary part") ||
    postMiddleText.includes("that is what") ||
    postMiddleText.includes("that is why");

  const middleFlat =
    !middleHasContrastSignal &&
    !hasListBuildupPattern &&
    !hasPostEscalation &&
    !middleIsStructured;

  if (
    !middleFlat ||
    isGoodScript ||
    retentionRisk < 35
  ) {
    return {
      riskyPart: null,
      riskyLineIndex: null,
    };
  }

  const alreadyHasMiddleFeedback =
    existingRiskyTitles.includes(
      "Script feels too generic.",
    ) ||
    existingRiskyTitles.includes(
      "Middle may lose momentum.",
    );

  const hasMystery =
    structures.hasMysteryClueBuildup;

  return {
    riskyPart: alreadyHasMiddleFeedback
      ? null
      : {
          time: createTimeRange(
            0.35,
            0.65,
            duration,
          ),
          title: "Middle may lose momentum.",
          description: hasMystery
            ? "The mystery buildup works, but the strongest clue could appear earlier to create a faster curiosity gap."
            : "No contrast, escalation, or new tension was found in the middle section.",
        },
    riskyLineIndex:
      Math.floor(totalLines / 2),
  };
}
