import type { RiskyPart } from "./scoring-result-helpers";
import type { ScriptStructures } from "./scoring-structures";
import { createTimeRange } from "./scoring-timing";

// Script classification, transcript normalization, and aligned summary feedback.
// Keep score calculation, result assembly, and UI concerns outside this module.

type ScriptType =
  | "viral_challenge"
  | "giveaway_or_prize"
  | "emotional_story"
  | "educational_explainer"
  | "auto_caption_transcript"
  | "generic_advice"
  | "general";

export function detectScriptType(text: string): ScriptType {
  const lower = text.toLowerCase();

  // Auto-caption: messy transcript markers
  if (
    lower.includes("[music]") ||
    lower.includes(">>") ||
    (text.split(/\n/).filter(l => l.trim().length > 0).length >= 4 &&
      text.split(/[.!?]/).filter(Boolean).length < 3 &&
      lower === lower) // all lowercase signal
  ) {
    return "auto_caption_transcript";
  }

  // Viral challenge: impossible test + money/object stake
  const hasChallengeVerb =
    /\b(slice|cut|break|survive|smash|destroy|catch|dodge|block|stop|open|find|lift|throw|eat|drink|hold|beat|outrun|outlast|endure|withstand)\b/i.test(text) ||
    /\b(put it to the test|let's try|only one chance|one shot|final attempt|last try)\b/i.test(lower);
  // "wins/win" alone is too broad (e.g. "junk food wins") — require actual money/prize context
  const hasMoneySake =
    /\$[\d,]+|\b\d[\d,]* (dollars|dollar|bucks|usd)\b/i.test(text) ||
    /\b(bet|wager|prize|reward|keep it|gets to keep)\b/i.test(lower) ||
    (/\b(win|won|wins)\b/i.test(lower) && /\b(subscriber|challenge|prize|cash|giveaway|money|bet)\b/i.test(lower));
  // Structural viral-challenge signals.
  // Do not depend on a closed catalog of familiar objects.
  const hasDirectChallengeQuestion =
    /^(can you|could you|is it possible)\b/i.test(text.trim()) &&
    hasChallengeVerb;

  const hasAttemptSignal =
    /\b(test|tested|testing|attempt|attempted|try|tried|trying|final attempt|last try|finally began)\b/i.test(lower) ||
    /\bput .{0,30} to the test\b/i.test(lower);
  const hasImpossiblePremise =
    /\b(can you|could you|is it possible|sounds impossible|nobody thought|no one believed|they said it couldn't)\b/i.test(lower) ||
    /\b(impossible|unbreakable|unkillable|unbeatable|unstoppable|unsliceable)\b/i.test(lower);
  const hasSubscriberChallenge =
    /\b(subscriber|sub|subscribers)\b/i.test(lower) &&
    /\b(gets?|wins?|keeps?|chose|chosen|selected|picked|random)\b/i.test(lower);

  if (
    (hasChallengeVerb && hasMoneySake) ||
    (hasImpossiblePremise && hasMoneySake) ||
    (hasDirectChallengeQuestion && hasAttemptSignal)
  ) {
    return "viral_challenge";
  }

  // Giveaway / prize: subscriber reward or prize drop
  const hasGiveawaySignal =
    /\b(giveaway|give away|giving away|giving a|handed|handing out)\b/i.test(lower);
  const hasPrizeObject =
    /\b(iphone|ipad|ps5|xbox|car|truck|cash|money|\$[\d,]+|\d[\d,]* dollars?|laptop|macbook|drone|watch|airpods|tv|television)\b/i.test(lower);
  const hasRandomWinner =
    /\b(wherever|whatever|whichever|random|randomly|lands on|spins|points to|drops on|falls on)\b/i.test(lower) &&
    /\b(subscriber|person|winner|country|city|name)\b/i.test(lower);
  const hasPrizeCTA =
    /\b(subscribe|hit subscribe|smash subscribe)\b/i.test(lower) &&
    hasPrizeObject;

  if (
    (hasGiveawaySignal && hasPrizeObject) ||
    hasRandomWinner ||
    (hasSubscriberChallenge && hasPrizeObject) ||
    hasPrizeCTA
  ) {
    return "giveaway_or_prize";
  }

  // Emotional story: human relationship + stakes + transformation
  const hasEmotionalMarker =
    /\b(cried|crying|tears|sobbed|broke down|emotional|moved|touched)\b/i.test(lower) ||
    /\b(father|mother|dad|mom|parent|son|daughter|family|brother|sister|friend|wife|husband)\b/i.test(lower) ||
    /\b(poor|struggled|homeless|starving|hungry|hardship|difficult life|grew up without)\b/i.test(lower);
  const hasStoryArc =
    /\b(years later|after becoming|changed (his|her|their|my) life|never forgot|always remembered|went back|returned|finally|one day when)\b/i.test(lower) ||
    /\b(kindness|helped (him|her|them|me)|believed in (him|her|them|me)|gave (him|her|them|me))\b/i.test(lower);
  const hasNamedPerson =
    /\b[A-Z][a-z]{2,}\b/.test(text) &&
    (hasEmotionalMarker || hasStoryArc);

  if ((hasEmotionalMarker && hasStoryArc) || (hasNamedPerson && hasEmotionalMarker)) {
    return "emotional_story";
  }

  // Educational explainer: fact + mechanism + consequence
  const hasFactualPremise =
    /\b(did you know|the reason|the real reason|here's why|this is why|scientists|researchers|studies show|research shows|according to)\b/i.test(lower) ||
    /\d[\d,]*\s*(miles|km|feet|meters|percent|%|seconds|minutes|hours|days|years|degrees|mph|kph|billion|million|thousand)/i.test(lower);
  const hasMechanismExplain =
    /\b(because|which means|that means|as a result|the reason is|this happens|this causes|what happens|how this works)\b/i.test(lower);

  if (hasFactualPremise && hasMechanismExplain) {
    return "educational_explainer";
  }

  // Generic advice: mostly platitudes, no concrete anchor
  const genericPhrases = [
    "motivation is", "discipline is", "success is", "failure is",
    "never give up", "work hard", "stay focused", "believe in yourself",
    "is the key to", "is very important", "everyone wants", "most people want",
    "you can do it", "keep going", "keep working", "is possible for anyone",
  ];
  const genericHits = genericPhrases.filter(p => lower.includes(p)).length;
  const hasConcreteAnchor =
    /\d/.test(text) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(text) ||
    /\b(found|went|came|gave|took|saw|ran|broke|drove|won|built|caught|heard)\b/i.test(lower);

  if (genericHits >= 2 && !hasConcreteAnchor) {
    return "generic_advice";
  }

  return "general";
}

export function normalizeAutoCaptionScript(text: string): string {
  return text
    .replace(/\[music\]/gi, "")
    .replace(/^>>\s*/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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
      /\$[\d,]+|\b\d[\d,]* (dollars?|bucks|usd)\b/i.test(
        normalizedText,
      ) ||
      /\b(iphone|ipad|ps5|xbox|car|giveaway|wherever|whatever|whichever).{0,40}(lands?|wins?|gets?|keep)\b/i.test(
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
