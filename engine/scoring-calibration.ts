import { clampScore } from "./scoring-result-helpers";

// Type-aware score floors and final score boundaries.
// Keep signal extraction and feedback generation outside this module.

type CalibrationSignals = {
  genericPenalty: number;
  stakesScore: number;
};

export type CalibratedScoringScores = {
  calibratedHookScore: number;
  overallScore: number;
  retentionRisk: number;
};

export function calibrateScoringScores({
  scriptType,
  firstSentence,
  normalizedText,
  text,
  displayHookScore,
  overallScore,
  retentionRisk,
  signals,
}: {
  scriptType: string;
  firstSentence: string;
  normalizedText: string;
  text: string;
  displayHookScore: number;
  overallScore: number;
  retentionRisk: number;
  signals: CalibrationSignals;
}): CalibratedScoringScores {
  let calibratedHookScore = displayHookScore;
  let calibratedOverallScore = overallScore;
  let calibratedRetentionRisk = retentionRisk;

  if (
    scriptType === "viral_challenge" ||
    scriptType === "giveaway_or_prize"
  ) {
    const firstLower = firstSentence.toLowerCase();

    const hasStakeInFirst =
      /\$[\d,]+|\b\d[\d,]* (dollars?|bucks|usd)\b/i.test(
        firstSentence,
      ) ||
      /\b(iphone|ipad|ps5|xbox|car|prize|giveaway|bet)\b/i.test(
        firstLower,
      ) ||
      /\b(can you|impossible|wherever|whatever|whichever)\b/i.test(
        firstLower,
      );

    if (hasStakeInFirst && calibratedHookScore < 62) {
      calibratedHookScore = 62;
    }

    const normalizedLower = normalizedText.toLowerCase();

    const hasChallengePremise =
      /\$[\d,]+|\b\d[\d,]* (dollars?|bucks|usd)\b/i.test(
        normalizedText,
      ) ||
      /\b(iphone|ipad|ps5|xbox|car|prize|giveaway)\b/i.test(
        normalizedLower,
      ) ||
      /\b(wherever|whatever|whichever).{3,40}\b(subscriber|person|country|city|name)\b/i.test(
        normalizedLower,
      ) ||
      /\b(bet|challenge|impossible|can you)\b/i.test(
        normalizedLower,
      );

    if (hasChallengePremise && calibratedOverallScore < 58) {
      calibratedOverallScore = 58;
    }

    if (
      hasChallengePremise &&
      calibratedHookScore >= 55 &&
      calibratedOverallScore < 65
    ) {
      calibratedOverallScore = Math.max(
        calibratedOverallScore,
        63,
      );
    }
  }

  if (scriptType === "emotional_story") {
    if (
      calibratedOverallScore < 52 &&
      signals.stakesScore >= 10
    ) {
      calibratedOverallScore = 52;
    }

    const hasNamedPersonAndArc =
      /\b[A-Z][a-z]{2,}\b/.test(text) &&
      /\b(years later|after becoming|changed (his|her|their) life|never forgot|went back|returned)\b/i.test(
        normalizedText.toLowerCase(),
      );

    if (
      hasNamedPersonAndArc &&
      calibratedOverallScore < 55
    ) {
      calibratedOverallScore = 55;
    }
  }

  if (
    scriptType === "auto_caption_transcript" &&
    calibratedOverallScore < 50 &&
    signals.genericPenalty < 42
  ) {
    calibratedOverallScore = Math.max(
      calibratedOverallScore,
      50,
    );
  }

  calibratedOverallScore = clampScore(
    calibratedOverallScore,
  );

  if (text.length > 0) {
    calibratedOverallScore = Math.max(
      15,
      calibratedOverallScore,
    );

    calibratedRetentionRisk = Math.min(
      90,
      calibratedRetentionRisk,
    );
  }

  return {
    calibratedHookScore,
    overallScore: calibratedOverallScore,
    retentionRisk: calibratedRetentionRisk,
  };
}
