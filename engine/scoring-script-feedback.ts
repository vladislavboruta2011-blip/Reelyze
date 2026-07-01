import type { UniversalSignals } from "./scoring-evaluation";
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

type Weakness =
  | "weak-hook" | "weak-payoff" | "weak-middle" | "weak-stakes"
  | "weak-specificity" | "weak-mystery" | "weak-consequence"
  | "repetitive" | "excellent-hook" | "excellent-payoff" | "balanced-strong" | "balanced-weak";

function hashPick<T>(seed: string, options: T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return options[h % options.length];
}

const TAKEAWAY_TEMPLATES: Record<Weakness, string[]> = {
  "weak-hook": [
    "The opening is the bottleneck here — everything after it is wasted if viewers swipe in the first two seconds.",
    "This script's biggest leak is at the very top. Fix the first line and the rest of the structure holds up.",
    "Strong material is buried behind a slow opening. Lead with it instead of working up to it.",
  ],
  "weak-payoff": [
    "The setup earns attention, but the ending doesn't cash it in. Viewers reach the end with no clear reward.",
    "This script builds tension well but resolves it too vaguely — the payoff needs a concrete result.",
    "Everything before the ending works. The last line is where retention quietly leaks out.",
  ],
  "weak-middle": [
    "The hook and ending both work — it's the middle that goes flat and risks losing viewers mid-watch.",
    "Strong bookends, soft middle. Add one more turn or contrast halfway through to hold attention.",
  ],
  "weak-stakes": [
    "Nothing in this script is clearly at risk. Add a consequence — what's lost, threatened, or on the line.",
  ],
  "weak-specificity": [
    "This script stays general throughout. A number, name, date, or measurable detail would ground it.",
  ],
  "weak-mystery": [
    "There's no unanswered question pulling viewers forward — consider an unresolved detail early on.",
  ],
  "weak-consequence": [
    "The script states what happened but not what it changed. Add a clear consequence to the outcome.",
  ],
  "repetitive": [
    "Several lines restate the same idea without adding new information — tighten for pace.",
  ],
  "excellent-hook": [
    "The opening does real work here — it creates a gap viewers want closed before they swipe away.",
  ],
  "excellent-payoff": [
    "The ending lands a real consequence, which is what makes this feel worth the watch time.",
  ],
  "balanced-strong": [
    "The script has a clear opening, progression, and payoff. No major structural issue stands out.",
  ],
  "balanced-weak": [
    "No single part is broken, but nothing is strong enough yet either — sharpen the hook, stakes, or payoff.",
  ],
};

function classifyPrimaryWeakness(
  hookScore: number, payoffStrength: number, retentionRisk: number,
  signals: UniversalSignals, structures: ScriptStructures
): Weakness {
  if (hookScore >= 85) return "excellent-hook";
  if (payoffStrength >= 80) return "excellent-payoff";
  if (signals.genericPenalty >= 25) return "repetitive";
  if (hookScore < 50) return "weak-hook";
  if (payoffStrength < 35 && !structures.hasConsequencePayoff) return "weak-payoff";
  if (retentionRisk >= 60 && hookScore >= 65) return "weak-middle";
  if (signals.stakesScore < 12) return "weak-stakes";
  if (signals.specificityScore < 12) return "weak-specificity";
  if (signals.curiosityScore < 12) return "weak-mystery";
  if (signals.consequenceScore < 12) return "weak-consequence";
  return "balanced-weak";
}

export function buildMainTakeaway(
  script: string, hookScore: number, payoffStrength: number, retentionRisk: number,
  signals: UniversalSignals, structures: ScriptStructures, issueTitles: string[] = []
): string {
  const issueText = issueTitles.join(" ").toLowerCase();

  if (issueTitles.length === 0) {
    const strength: Weakness =
      structures.hasConsequencePayoff && payoffStrength >= 60
        ? "excellent-payoff"
        : hookScore >= 75
          ? "excellent-hook"
          : "balanced-strong";

    return hashPick(script + strength, TAKEAWAY_TEMPLATES[strength]);
  }

  // Keep the headline aligned with the concrete feedback shown below it.
  // A detected genericness issue takes priority over a secondary weak hook.
  const weakness: Weakness =
    /script feels too generic|repetitive|generic script/.test(issueText)
      ? "repetitive"
      : /strong payoff appears too late|weak opening|hook needs|curiosity gap/.test(issueText)
        ? "weak-hook"
        : /weak or generic payoff|payoff could be stronger|weak payoff/.test(issueText)
          ? "weak-payoff"
          : /middle|momentum/.test(issueText)
            ? "weak-middle"
            : classifyPrimaryWeakness(
                hookScore,
                payoffStrength,
                retentionRisk,
                signals,
                structures,
              );

  return hashPick(script + weakness, TAKEAWAY_TEMPLATES[weakness]);
}
