export { createHookRewrite, getHookRewriteReason } from "./scoring-rewrite";

import {
  detectScriptStructures,
  type ScriptStructures,
} from "./scoring-structures";

import {
  calculateHookStrength,
  calculatePayoffStrength,
  calculateRetentionStructure,
  extractOpeningWindow,
  extractUniversalSignals,
  scoreOpeningWindow,
  type UniversalSignals,
} from "./scoring-evaluation";

export {
  detectNarrativeArc,
  detectScriptStructures,
} from "./scoring-structures";

// Canonical pure scoring engine for the Results experience.
// Keep this file UI-free so production and regression tests use identical logic.

export type ScoreData = {
  score: number;
  label: string;
  color: string;
  ringColor: string;
  description: string;
};

export type RiskyPart = {
  time: string;
  title: string;
  description: string;
};

export type SceneSegment = {
  label: string;
  color: string;
  width: number;
};

export type AnalysisResult = {
  overall: ScoreData;
  hook: ScoreData;
  risk: ScoreData;
  riskyParts: RiskyPart[];
  fixes: string[];
  riskyLineIndexes: number[];
  warningLineIndexes: number[];
  sceneSegments: SceneSegment[];
};

export function createScriptLines(script: string) {
  const cleaned = script.trim().replace(/\s+/g, " ");

  if (!cleaned) {
    return [];
  }

  const sentenceParts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (sentenceParts.length >= 2) {
    return sentenceParts;
  }

  const words = cleaned.split(" ");

  if (words.length <= 12) {
    return [cleaned];
  }

  const lines: string[] = [];
  const wordsPerLine = 10;

  for (let i = 0; i < words.length; i += wordsPerLine) {
    const line = words.slice(i, i + wordsPerLine).join(" ");

    if (line) {
      lines.push(line);
    }
  }

  return lines;
}

export function estimateDuration(script: string) {
  const cleaned = script.trim().replace(/\s+/g, " ");

  if (cleaned.length === 0) {
    return 0;
  }

  const seconds = Math.ceil(cleaned.length / 16.5);

  return Math.max(4, seconds);
}

function createTimeRange(
  startPercent: number,
  endPercent: number,
  duration: number
) {
  const start = Math.floor(duration * startPercent);
  const end = Math.max(start + 1, Math.floor(duration * endPercent));

  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

type ScriptType =
  | "viral_challenge"
  | "giveaway_or_prize"
  | "emotional_story"
  | "educational_explainer"
  | "auto_caption_transcript"
  | "generic_advice"
  | "general";

function detectScriptType(text: string): ScriptType {
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

function normalizeAutoCaptionScript(text: string): string {
  return text
    .replace(/\[music\]/gi, "")
    .replace(/^>>\s*/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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

function buildMainTakeaway(
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

export function analyzeScript(
  script: string,
  duration: number,
  scriptLines: string[]
): AnalysisResult {
  const text = script.trim();
  const lines = scriptLines;
  const totalLines = lines.length;

  const scriptType = detectScriptType(text);

  // Normalize auto-caption transcripts before scoring
  const normalizedText = scriptType === "auto_caption_transcript"
    ? normalizeAutoCaptionScript(text)
    : text;
  const normalizedLines = scriptType === "auto_caption_transcript"
    ? createScriptLines(normalizedText)
    : lines;

  const firstSentence = normalizedText.split(/[.!?]/)[0]?.trim() ?? normalizedText.trim();
  const signals = extractUniversalSignals(normalizedText);
  const structures = detectScriptStructures(normalizedLines, normalizedText);

  const firstLower = firstSentence.toLowerCase();
  const bodyAfterHook = normalizedLines.slice(1).join(" ").toLowerCase();

  const hasVisualMysteryOpening =
    /\b(ship|boat|plane|camera|room|city|house|car|train|building|door|table|food|cargo|message|signal|footage)\b/i.test(firstSentence) &&
    /\b(found|discovered|drifting|empty|abandoned|open|untouched|still|gone|missing|disappeared|vanished|no signs|no emergency|no clear reason)\b/i.test(normalizedText) &&
    (
      /\b(still|untouched|gone|missing|disappeared|vanished|no signs|no emergency|no clear reason|every person|nobody|no one)\b/i.test(bodyAfterHook) ||
      /\bwith .{0,70} still\b/i.test(firstLower)
    );

  let hookScore = text.length > 0
    ? Math.max(18, clampScore(calculateHookStrength(firstSentence, signals, normalizedText)))
    : 0;

  if (hasVisualMysteryOpening && hookScore < 82) {
    hookScore = 82;
  }
  const structureRisk = calculateRetentionStructure(lines, signals, structures);
  const payoffStrength = calculatePayoffStrength(lines, signals);

  const payoffReduction = Math.min(payoffStrength * 0.10, 8);
  let retentionRisk = clampScore(Math.round(structureRisk - payoffReduction));

  if (structures.hasCapabilityViolation) {
    retentionRisk = Math.max(20, retentionRisk - 2);
  }

  if (structures.hasConsequenceProgression) {
    retentionRisk = Math.max(20, retentionRisk - 6);
  }

  if (retentionRisk < 20) retentionRisk = 20;

  // ── Hook + structure bonus: if hook is strong and escalation is detected,
  //    retention risk should not be High (≥65) ─────────────────────────────
const hasStructuredEscalation =
    structures.hasListBuildup ||
    structures.hasMysteryClueBuildup ||
    structures.hasContradictionReversal ||
    structures.hasConsequencePayoff ||
    structures.hasNumericPremise ||
    structures.hasExplanationChain ||
    structures.hasNarrativeArc ||
    structures.hasPersistenceArc ||
    structures.hasCapabilityViolation ||
    structures.hasAnomalySequence ||
    structures.hasConsequenceProgression;

  if (hookScore >= 70 && hasStructuredEscalation && retentionRisk >= 65) {
    retentionRisk = Math.min(retentionRisk, 58);
  }
  // Even with a decent hook (55+) and any buildup, cap at Medium
  if (hookScore >= 55 && hasStructuredEscalation && retentionRisk >= 65) {
    retentionRisk = Math.min(retentionRisk, 62);
  }

  const charCount = text.length;
  const hasNumericSpecificity = signals.specificityScore >= 30;
  const isShortSimple = charCount < 350 && totalLines <= 5;
  const isVeryShort = charCount < 130;
  const isStructurallyCompleteShort =
    charCount < 180 &&
    totalLines >= 4 &&
    hasStructuredEscalation &&
    structures.hasConsequencePayoff;

  const shortScriptSignalCount = [
    /\d/.test(text) && /\b(feet|miles|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|billion|million|thousand|degrees|\$)\b/i.test(text),
    structures.hasContradictionReversal || /\bbut\b|\bhowever\b|\bnot\b/i.test(text),
    signals.stakesScore >= 10,
    signals.consequenceScore >= 10 || structures.hasConsequencePayoff,
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(text),
  ].filter(Boolean).length;

  const isDenseDespiteShort = isVeryShort && shortScriptSignalCount >= 3;

 // Structure quality bonus — reward scripts that have valid escalation even if hook is weak.
  // This prevents a well-structured explanation chain or mystery from scoring very low
  // purely because the filler intro drags hook score down.
  const hasFillerOpener =
    structures.hasFillerIntro ||
    /^(today i|in this video|i will|i want to|let's talk|so today|hey guys|welcome|this video)/i.test(firstSentence);

  const hasGenericHookOpener =
    /\b(is very important|is important in|is possible for anyone|many people want|everyone wants|we all want|is the key to|takes hard work|success is|failure is|time is |life is )\b/i.test(firstSentence);

  const openingWindowText = extractOpeningWindow(lines);
  const openingWindowSignals = scoreOpeningWindow(openingWindowText);

  const openingWindowBonus =
    !hasFillerOpener && !hasGenericHookOpener
      ? Math.round(openingWindowSignals.windowStrength * 0.4)
      : 0;

  const effectiveHookScore = Math.min(88, hookScore + openingWindowBonus);

    const hookNeedsWork =
    !hasVisualMysteryOpening &&
    (
      effectiveHookScore < 58 ||
      hasFillerOpener ||
      hasGenericHookOpener ||
      (openingWindowSignals.hasScenarioOpener && !openingWindowSignals.scenarioHasStakes && effectiveHookScore < 55)
    );

  const hookIsAcceptable = !hookNeedsWork;

  const displayHookScore = effectiveHookScore;

  const structureBonus =
    (structures.hasExplanationChain ? 6 : 0) +
    (structures.hasNumericPremise ? 4 : 0) +
    (structures.hasListBuildup ? 5 : 0) +
    (structures.hasMysteryClueBuildup ? 4 : 0) +
    (structures.hasContradictionReversal ? 4 : 0) +
    (structures.hasConsequencePayoff ? 3 : 0) +
    (structures.hasCapabilityViolation ? 4 : 0) +
    (structures.hasConsequenceProgression ? 4 : 0);
  // Cap bonus so it can't inflate a weak hook script into "Very Strong"
  const cappedStructureBonus = Math.min(structureBonus, 12);

  let overallScore = clampScore(
    Math.round(effectiveHookScore * 0.55 + (100 - retentionRisk) * 0.45 + cappedStructureBonus)
  );

  if (!hasNumericSpecificity && overallScore > 85) overallScore = 85;
  if (isShortSimple && !isDenseDespiteShort && overallScore > 82) overallScore = 82;
  if (isVeryShort && !isDenseDespiteShort && overallScore > 55) overallScore = 55;
  if (retentionRisk > 30 && overallScore > 88) overallScore = 88;
  if (payoffStrength < 40 && overallScore > 85) overallScore = 85;

  if (signals.genericPenalty >= 42) overallScore = Math.min(overallScore, 42);
  else if (signals.genericPenalty >= 28) overallScore = Math.min(overallScore, 52);
  else if (signals.genericPenalty >= 20) overallScore = Math.min(overallScore, 62);
  else if (signals.genericPenalty >= 12) overallScore = Math.min(overallScore, 72);

  // Keep extremely generic scripts weak, but avoid unusable edge scores.
  if (signals.genericPenalty >= 42) {
    overallScore = Math.max(overallScore, 15);
    retentionRisk = Math.min(retentionRisk, 90);
  }

  overallScore = clampScore(overallScore);

    if (hasVisualMysteryOpening) {
    if (overallScore < 72) overallScore = 72;
    if (retentionRisk > 45) retentionRisk = 45;
  }

  // ── Script-type calibration boosts ────────────────────────────────────────
  // These run AFTER the main score is computed and apply type-aware floors.

  // Viral challenge / giveaway: floor hook and overall when premise is clear.
  let calibratedHookScore = displayHookScore;

  if (scriptType === "viral_challenge" || scriptType === "giveaway_or_prize") {
    const firstLower2 = firstSentence.toLowerCase();
    const hasStakeInFirst =
      /\$[\d,]+|\b\d[\d,]* (dollars?|bucks|usd)\b/i.test(firstSentence) ||
      /\b(iphone|ipad|ps5|xbox|car|prize|giveaway|bet)\b/i.test(firstLower2) ||
      /\b(can you|impossible|wherever|whatever|whichever)\b/i.test(firstLower2);

    // If the first line has a clear challenge/stake signal, floor hook at 62
    if (hasStakeInFirst && calibratedHookScore < 62) {
      calibratedHookScore = 62;
    }

    const hasChallengePremise =
      /\$[\d,]+|\b\d[\d,]* (dollars?|bucks|usd)\b/i.test(normalizedText) ||
      /\b(iphone|ipad|ps5|xbox|car|prize|giveaway)\b/i.test(normalizedText.toLowerCase()) ||
      /\b(wherever|whatever|whichever).{3,40}\b(subscriber|person|country|city|name)\b/i.test(normalizedText.toLowerCase()) ||
      /\b(bet|challenge|impossible|can you)\b/i.test(normalizedText.toLowerCase());

    if (hasChallengePremise && overallScore < 58) {
      overallScore = 58;
    }
    if (hasChallengePremise && calibratedHookScore >= 55 && overallScore < 65) {
      overallScore = Math.max(overallScore, 63);
    }
  }

  // Emotional story: floor overall at 52 when emotional arc signals are present.
  // (stakesScore threshold lowered to 10 so emotional phrases from Patch 2 count)
  if (scriptType === "emotional_story") {
    if (overallScore < 52 && signals.stakesScore >= 10) {
      overallScore = 52;
    }
    // If the story has a clear named person + payoff arc, push to 55
    const hasNamedPersonAndArc =
      /\b[A-Z][a-z]{2,}\b/.test(text) &&
      /\b(years later|after becoming|changed (his|her|their) life|never forgot|went back|returned)\b/i.test(normalizedText.toLowerCase());
    if (hasNamedPersonAndArc && overallScore < 55) {
      overallScore = 55;
    }
  }

  // Auto-caption: reduce generic penalty impact (messy transcripts look generic)
  if (scriptType === "auto_caption_transcript") {
    if (overallScore < 50 && signals.genericPenalty < 42) {
      overallScore = Math.max(overallScore, 50);
    }
  }

  overallScore = clampScore(overallScore);

  // Final safety boundaries for non-empty scripts.
  if (text.length > 0) {
    overallScore = Math.max(15, overallScore);
    retentionRisk = Math.min(90, retentionRisk);
  }


  // ── Hook status flags — drive risky parts, fixes, button label, scene breakdown ─
  // hookNeedsWork: the hook is weak enough that it should be the primary feedback.
  // hookIsAcceptable: the hook is decent; feedback should focus on middle/payoff.

  const isGoodScript = overallScore >= 70 && hookScore >= 65 && retentionRisk <= 35;
  const isStrongScript = overallScore >= 80;
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  type WeakArea = "hook" | "short" | "payoff" | "generic" | "middle" | "none";
  let primaryWeak: WeakArea = "none";
  if ((isVeryShort || charCount < 180) && !isStructurallyCompleteShort) {
    primaryWeak = "short";
  } else if (hookNeedsWork && effectiveHookScore < 45) {
    primaryWeak = "hook";
  } else if (signals.genericPenalty >= 20) {
    primaryWeak = "generic";
  } else if (payoffStrength < 28 && signals.consequenceScore < 15) {
    primaryWeak = "payoff";
  } else if (hookNeedsWork && effectiveHookScore < 65) {
    primaryWeak = "hook";
  }
  // If hookIsAcceptable, never set primaryWeak to "hook"

  const riskyParts: RiskyPart[] = [];
  const fixes: string[] = [];
  const riskyLineIndexes: number[] = [];
  const warningLineIndexes: number[] = [];

  function getFixSemanticKey(value: string): string {
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

  function dedupeFixes(values: string[]): string[] {
    const seen = new Set<string>();

    return values.filter((value) => {
      const key = getFixSemanticKey(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const fixKeys = new Set<string>();
  function addFix(text: string) {
    const key = getFixSemanticKey(text);
    if (!fixKeys.has(key)) {
      fixKeys.add(key);
      fixes.push(text);
    }
  }

  // ── Script-type context for risky parts ───────────────────────────────────
  const isViralOrGiveaway = scriptType === "viral_challenge" || scriptType === "giveaway_or_prize";
  const isEmotionalStory = scriptType === "emotional_story";

  // ── 1. Very short script ────────────────────────────────────────────────────
  if (charCount < 180 && !isStructurallyCompleteShort) {
    riskyParts.push({
      time: createTimeRange(0.1, 0.8, duration),
      title: "Script may be too short.",
      description: "The idea may not feel developed enough before the ending.",
    });
    if (primaryWeak === "short") {
      addFix("Add one stronger example, specific detail, or consequence before the final payoff.");
      addFix("Include a number, result, or named reference to make the script feel grounded.");
      addFix("Expand the payoff — state clearly what changes, what was lost, or what the viewer should take away.");
    }
  }

  // Detect generic motivational endings before any risky part logic that depends on it.
  const lastLine = lines[totalLines - 1] ?? "";
  const lastLineLower = lastLine.toLowerCase();
 const lastLineWordCount2 = lastLine.split(/\s+/).filter(Boolean).length;
  const lastLineHasConcrete =
    /\d/.test(lastLine) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(lastLine) ||
    /\b\w+ed\b/i.test(lastLineLower) ||
    /\b(found|lost|went|came|got|gave|took|made|saw|ran|fell|grew|flew|broke|drove|woke|won|built|caught|said|sent|spoke|stood|wrote|heard|kept|knew|left|told|threw|thought)\b/i.test(lastLineLower);
  const lastLineIsStructurallyGeneric =
    !lastLineHasConcrete &&
    lastLineWordCount2 <= 12 &&
    /\b(is|are|will be|can be|was|were)\b/i.test(lastLineLower) &&
    /\b(possible|important|key|essential|necessary|real|true|good|great|better|best|amazing|powerful|possible|valuable|needed)\b/i.test(lastLineLower);

  const isGenericMotivationalEnding =
    /\b(possible for anyone|reach your goals|never give up|stay focused|hard work pays|believe in yourself|you can do it|keep working|keep going|just believe|work (hard|smart)|success takes|success is possible|everyone can|anyone can)\b/i.test(lastLineLower) ||
    (/\b(success|failure|life|time|things|people)\b/i.test(lastLineLower) &&
     /\b(is|are|will be|can be)\b/i.test(lastLineLower) &&
     !(/\d/.test(lastLine)) &&
     lastLine.split(/\s+/).length <= 10) ||
    lastLineIsStructurallyGeneric;

 // For viral/giveaway scripts with a clear premise, don't mark opening as weak
  const viralHasClearPremise =
    isViralOrGiveaway && (
      /\$[\d,]+|\b\d[\d,]* (dollars?|bucks|usd)\b/i.test(normalizedText) ||
      /\b(iphone|ipad|ps5|xbox|car|giveaway|wherever|whatever|whichever).{0,40}(lands?|wins?|gets?|keep)\b/i.test(normalizedText.toLowerCase()) ||
      /\b(bet|challenge|impossible|can you)\b/i.test(firstSentence.toLowerCase())
    );

 if (hookNeedsWork && effectiveHookScore < 45 && !viralHasClearPremise) {
    // Check if the script has a strong payoff/consequence that should be the hook
    // Do NOT label as "strong payoff" if the ending is generic/motivational — it is not a payoff worth moving
    if (
      !isGenericMotivationalEnding &&
      !structures.hasListBuildup &&
      (structures.hasStrongPayoffLate || structures.hasConsequencePayoff)
    ) {
      riskyParts.push({
        time: createTimeRange(0, 0.25, duration),
        title: "Strong payoff appears too late.",
        description: "The opening announces the topic instead of leading with the strongest consequence or detail from the script.",
      });
    } else {
      const isLowStakesScenario = openingWindowSignals.hasScenarioOpener && !openingWindowSignals.scenarioHasStakes;
      riskyParts.push({
        time: createTimeRange(0, 0.25, duration),
        title: isLowStakesScenario ? "Opening lacks stakes or consequence." : "Weak opening.",
        description: isLowStakesScenario
          ? "The scenario creates an image but does not give viewers a strong reason to care. Add a consequence, mystery, or specific strange result."
          : "The first line may not stop viewers from swiping. It needs more curiosity, contrast, or a clear result.",
      });
    }
    riskyLineIndexes.push(0);
  } else if (hookNeedsWork && effectiveHookScore < 65) {
    warningLineIndexes.push(0);
  }
  // If hookIsAcceptable: never mark line 0 as risky or warning

  // No curiosity gap — only when hook is clearly weak (not just acceptable)
  if (hookNeedsWork && signals.curiosityScore < 12 && effectiveHookScore < 55) {
    if (!riskyParts.some(p => p.title === "Weak opening." || p.title === "Strong payoff appears too late.")) {
      riskyParts.push({
        time: createTimeRange(0, 0.3, duration),
        title: "No clear curiosity gap.",
        description: "The opening explains the topic but does not create enough tension or an unanswered question.",
      });
      if (!riskyLineIndexes.includes(0)) riskyLineIndexes.push(0);
    }
  }

  // ── 3. Generic/filler script ────────────────────────────────────────────────
  // Do not call a scenario-building script "generic" — use a more precise label.
  const hasScenarioStructure =
    openingWindowSignals.hasScenarioOpener ||
    /^(imagine|what if|picture this)\b/i.test(lines[0] ?? "");
  const genericLabel = hasScenarioStructure
    ? "Scenario lacks stakes or consequence."
    : "Script feels too generic.";
  const genericDescription = hasScenarioStructure
    ? "The scenario creates an image but the lines do not build toward a strong consequence, mystery, or specific tension."
    : "The lines repeat obvious ideas without a concrete example, number, twist, or consequence.";

  if (signals.genericPenalty >= 12 && overallScore < 72) {
    riskyParts.push({
      time: createTimeRange(0.2, 0.7, duration),
      title: genericLabel,
      description: genericDescription,
    });
    const midIdx = Math.floor(totalLines / 2);
    if (!riskyLineIndexes.includes(midIdx)) riskyLineIndexes.push(midIdx);
    if (totalLines > 3 && !riskyLineIndexes.includes(midIdx - 1)) {
      warningLineIndexes.push(midIdx - 1);
    }
  }

  // ── 4. Flat middle — only when structure detection confirms it ──────────────
  if (totalLines >= 5) {
    const middleLines = lines.slice(
      Math.floor(totalLines * 0.33),
      Math.floor(totalLines * 0.66)
    );
    const middleText = middleLines.join(" ").toLowerCase();
    const middleHasContrastSignal = [
      "but", "however", "then", "suddenly", "except", "actually",
      "the problem", "real problem", "if it", "that is why", "result",
    ].some(p => middleText.includes(p));

    // Use structure detection: list buildup and mystery buildup are NOT flat middle
    const middleIsStructured =
      structures.hasListBuildup ||
      structures.hasMysteryClueBuildup ||
      structures.hasContradictionReversal;

    const shortLineCount = middleLines.filter(l => l.split(/\s+/).length <= 7).length;
    const hasListBuildupPattern = shortLineCount >= 2;

    const postMiddleLines = lines.slice(Math.floor(totalLines * 0.66));
    const postMiddleText = postMiddleLines.join(" ").toLowerCase();
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

if (middleFlat && !isGoodScript && retentionRisk >= 35) {
      if (!riskyParts.some(p =>
        p.title === "Script feels too generic." ||
        p.title === "Middle may lose momentum."
      )) {
        // Give a more specific description based on what IS in the script
        const hasMystery = structures.hasMysteryClueBuildup;
        const description = hasMystery
          ? "The mystery buildup works, but the strongest clue could appear earlier to create a faster curiosity gap."
          : "No contrast, escalation, or new tension was found in the middle section.";

        riskyParts.push({
          time: createTimeRange(0.35, 0.65, duration),
          title: "Middle may lose momentum.",
          description,
        });
      }
      const midI = Math.floor(totalLines / 2);
      if (!riskyLineIndexes.includes(midI)) riskyLineIndexes.push(midI);
    }
  }

  // ── 5. Payoff / ending ──────────────────────────────────────────────────────
  // IMPORTANT: If the last line IS a strong consequence, don't call it weak payoff.
  // Instead, check if the issue is placement (strong payoff but hook was weak).
  // lastLine, lastLineLower, and isGenericMotivationalEnding are already declared above.

  const lastLineIsStrong =
    !isGenericMotivationalEnding && (
    // consequence / behavioral outcome (universal)
    /training your (brain|mind|body)|controls (your|how)|permanent/.test(lastLineLower) ||
    /you do not control|you lose control|once it (is|becomes|goes)/.test(lastLineLower) ||
    // continuation / unstoppable force (universal)
    /keeps (going|moving|running|working|growing|building|compounding)/.test(lastLineLower) ||
    // identity / social consequence (universal)
    /says (about|something about) (you|them|us)|how (people|everyone|others) (see|look|judge)/.test(lastLineLower) ||
    /what you (are|become|represent)|proof that (you|they|it)/.test(lastLineLower) ||
    // explanation chain endings (universal)
    /it is not (just|only|about)|the (real|actual|true) (reason|problem|issue|point)/.test(lastLineLower) ||
    /the (scary|strange|crazy|interesting|surprising|remarkable) part/.test(lastLineLower) ||
    /the whole (point|story|picture|idea)/.test(lastLineLower) ||
    // causal wrap-up (universal)
    /that is (why|what|how|when) (it|this|the|your|everything)/.test(lastLineLower) ||
    /not for the reason|not (what|how|why) (most|many|you)/.test(lastLineLower) ||
    // structure-level confirmation (only when not generic motivational)
    structures.hasConsequencePayoff
    );

  if (
    (payoffStrength < 28 && signals.consequenceScore < 15 && wordCount >= 20 && !isGoodScript && !lastLineIsStrong) ||
    (isGenericMotivationalEnding && !isGoodScript)
  ) {
    riskyParts.push({
      time: createTimeRange(0.75, 1.0, duration),
      title: isGenericMotivationalEnding ? "Weak or generic payoff." : "Payoff could be stronger.",
      description: isGenericMotivationalEnding
        ? "The ending is too vague to feel rewarding. Replace it with a specific consequence, result, or unresolved detail."
        : "The ending may not feel rewarding. A clearer result or consequence would help.",
    });
    riskyLineIndexes.push(Math.max(0, totalLines - 1));
  }

  // If hook needs work but ending IS strong: label as placement issue
  // Do NOT run when the ending is generic/motivational — isGenericMotivationalEnding already
  // sets lastLineIsStrong to false, but guard explicitly here for clarity and safety.
  if (
    !isGenericMotivationalEnding &&
    !structures.hasListBuildup &&
    lastLineIsStrong &&
    hookNeedsWork &&
    effectiveHookScore < 55 &&
    !riskyParts.some(p => p.title === "Strong payoff appears too late.")
  ) {
    // Replace generic "Weak opening" with placement-specific feedback
    const weakOpeningIdx = riskyParts.findIndex(p => p.title === "Weak opening.");
    if (weakOpeningIdx >= 0) {
      riskyParts[weakOpeningIdx] = {
        time: riskyParts[weakOpeningIdx].time,
        title: "Strong payoff appears too late.",
        description: "The strongest consequence is at the end but not in the opening. Move it earlier to stop the scroll.",
      };
    }
  }

// ── 6. No open loop (very weak scripts only, and only when no valid structure) ──
  // Also suppress when the middle contains concrete scale, named references,
  // or explanatory content — these are not "no reason to keep watching".
  const middleSectionText = lines.slice(
    Math.floor(totalLines * 0.25),
    Math.floor(totalLines * 0.75)
  ).join(" ");
  const middleHasConcreteContent =
    /\d/.test(middleSectionText) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(middleSectionText) ||
    /\b(feet|miles|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|billion|million|thousand|degrees)\b/i.test(middleSectionText) ||
    /\b(would|could) (disappear|fit|vanish|be hidden|be buried|be submerged|still have)\b/i.test(middleSectionText) ||
    /\bmore than (a mile|a kilometer|a foot|a meter|a year)\b/i.test(middleSectionText) ||
    hasStructuredEscalation;

  if (
    signals.openLoopScore === 0 &&
    signals.curiosityScore < 12 &&
    signals.contrastScore < 15 &&
    wordCount >= 35 &&
    overallScore < 58 &&
    !hasStructuredEscalation &&
    !middleHasConcreteContent &&
    !isViralOrGiveaway &&
    !isEmotionalStory
  ) {
    if (!riskyParts.some(p => p.title === "No reason to keep watching.")) {
      riskyParts.push({
        time: createTimeRange(0.3, 0.6, duration),
        title: "No reason to keep watching.",
        description: "The script may not give viewers enough curiosity or unresolved tension before the payoff.",
      });
    }
  }

  // ── 7. Filler phrases ────────────────────────────────────────────────────────
  const fluffPhrases = [
    "basically", "as you can see", "i just want to", "this is very important",
    "let's talk about", "i'm going to explain", "really important",
  ];
  if (fluffPhrases.some(p => lower.includes(p))) {
    if (!riskyParts.some(p => p.title === "Script feels too generic." || p.title === "Possible filler phrases.")) {
      riskyParts.push({
        time: createTimeRange(0.3, 0.6, duration),
        title: "Possible filler phrases.",
        description: "Some lines may sound like setup instead of real value.",
      });
    }
  }

  // ── 8. Script too long ──────────────────────────────────────────────────────
  if (charCount > 850) {
    riskyParts.push({
      time: createTimeRange(0.55, 0.85, duration),
      title: "Script may be too long.",
      description: "Viewers may lose focus before the ending.",
    });
  }

  // ── Build fixes — context-aware, not generic ────────────────────────────────

  // Script-type-specific fixes (prepended before generic logic)
  if (isViralOrGiveaway) {
    const lowerNorm = normalizedText.toLowerCase();
    const hasCTAInterrupt =
      /\b(subscribe|follow|hit subscribe|smash subscribe)\b/i.test(lowerNorm) &&
      normalizedLines.length >= 4 &&
      normalizedLines.slice(0, Math.floor(normalizedLines.length * 0.8)).some(l =>
        /\b(subscribe|follow)\b/i.test(l.toLowerCase())
      );
    if (hasCTAInterrupt) {
      addFix("Move the subscribe CTA to after the payoff — placing it before the challenge resolves may cause viewers to drop.");
    }
    if (payoffStrength < 40) {
      addFix("Add one clear consequence: what happens if the challenge fails or succeeds?");
    }
    if (!structures.hasConsequencePayoff && wordCount > 30) {
      addFix("Make the challenge outcome clearer before any CTA — viewers need to know if it worked.");
    }
  }

  if (isEmotionalStory) {
    if (payoffStrength < 35) {
      addFix("Make the emotional payoff more specific — what exactly changed, and how does the viewer feel the impact?");
    }
    if (hookNeedsWork && effectiveHookScore < 65) {
      addFix("Open with the most emotional or unexpected moment from the story — not just the setup.");
    }
    if (signals.specificityScore < 20) {
      addFix("Add one specific named detail, place, or action to make the story feel real rather than general.");
    }
  }

  // Primary weakness fix — only add hook rewrites when hook actually needs work
  if (primaryWeak === "hook" && hookNeedsWork && effectiveHookScore < 65) {
    if (
      !structures.hasListBuildup &&
      (structures.hasStrongPayoffLate || structures.hasConsequencePayoff)
    ) {
      // The consequence exists — just needs to move forward
      addFix("Lead with the consequence: move your strongest final line to the very beginning.");
   } else if (structures.hasMysteryClueBuildup) {
      // Universal: mystery/clue script — find the most concrete physical detail line
      const strongestMysteryClue = lines.slice(1).find(l => {
        const ll = l.toLowerCase();
        const wordCount = l.split(/\s+/).length;
        // A good clue line: concrete object/state + not too long + not a vague summary
        return wordCount >= 5 && wordCount <= 18 &&
          (ll.includes("still") || ll.includes("untouched") || ll.includes("left behind") ||
           ll.includes("no signs") || ll.includes("nothing was") || ll.includes("everything was") ||
           ll.includes("appeared") || ll.includes("looked like") || ll.includes("seemed"));
      });
      if (strongestMysteryClue) {
        addFix(`Open with the most specific physical detail: "${strongestMysteryClue.replace(/[.!?]+$/, "").trim()}" creates more tension than announcing the topic.`);
      } else {
        addFix("Open with the most specific clue or physical detail from the script instead of announcing the topic.");
      }
    } else {
      addFix("Rewrite the opening line — it should lead with the strongest detail, consequence, or contrast from your script, not just announce the topic.");
    }
  }
  if (primaryWeak === "generic") {
    addFix("Replace generic advice lines with a single concrete example, number, or real consequence.");
    addFix("Cut any sentence that could apply to any video — only keep lines specific to this topic.");
  }
  if (primaryWeak === "payoff") {
    addFix("Make the final payoff more specific — state the result, consequence, or unresolved mystery clearly.");
  }

  // Supporting fixes — only add hook-focused fixes when hook needs work
  if (hookNeedsWork && signals.curiosityScore < 12 && effectiveHookScore < 55) {
    addFix("Open with an unanswered question, a missing detail, or a surprising consequence.");
  }

  // Only suggest "add contrast" if the script truly lacks contrast AND escalation
  if (
    signals.contrastScore < 12 &&
    signals.openLoopScore < 12 &&
    !hasStructuredEscalation &&
    wordCount > 20 &&
    overallScore < 58
  ) {
    addFix('Add a contrast line mid-script — something like: "But that is not the real problem."');
  }

  if (signals.genericPenalty >= 12 && overallScore < 72) {
    addFix("Add one specific detail, number, named reference, or real-world example to make the script feel grounded.");
  }
  if (
    signals.stakesScore < 12 &&
    signals.consequenceScore < 10 &&
    wordCount >= 25 &&
    overallScore < 62
  ) {
    addFix("Raise the stakes: what is at risk, what was lost, or what changes if this is ignored?");
  }
  if (signals.specificityScore < 10 && wordCount >= 20 && overallScore < 70) {
    addFix("Add a more concrete detail, example, consequence, or measurable result to make the script feel grounded.");
  }

  // Payoff fix — only if last line is NOT already a strong consequence
  if (
    payoffStrength < 28 &&
    signals.consequenceScore < 15 &&
    wordCount >= 20 &&
    !isGoodScript &&
    !lastLineIsStrong &&
    primaryWeak !== "payoff"
  ) {
    addFix("Make the final payoff more specific — state the result, consequence, or unresolved mystery clearly.");
  }

  // If the last line IS strong but hook is weak — suggest moving it
  if (lastLineIsStrong && effectiveHookScore < 55 && !fixes.some(f => f.toLowerCase().includes("lead with"))) {
    addFix("Lead with your strongest consequence: the final line of your script would make a more powerful opening.");
  }

 if (
    hookNeedsWork &&
    signals.openLoopScore === 0 &&
    signals.curiosityScore < 12 &&
    signals.contrastScore < 15 &&
    !hasStructuredEscalation &&
    !middleHasConcreteContent &&
    wordCount >= 35 &&
    overallScore < 58
  ) {
    addFix("Add an unanswered question or a delayed reveal to keep viewers engaged through the middle.");
  }
  if (fluffPhrases.some(p => lower.includes(p))) {
    addFix("Replace filler phrases with a specific example, concrete consequence, or direct insight.");
  }
  if (
    charCount < 180 &&
    !isStructurallyCompleteShort &&
    primaryWeak !== "short"
  ) {
    addFix("Add one stronger example or consequence before the final payoff.");
  }
  if (charCount > 850) {
    addFix("Cut repeated explanations and keep only the strongest points.");
  }

 // Hook fix for medium-score scripts — only when hook actually needs work
  if (hookNeedsWork && effectiveHookScore < 65 && primaryWeak !== "hook" && !fixes.some(f => f.toLowerCase().includes("rewrite") || f.toLowerCase().includes("opening line") || f.toLowerCase().includes("lead with"))) {
    addFix("Rewrite the opening line — lead with the strongest consequence, number, or contradiction from the script.");
  } else if (hookIsAcceptable && effectiveHookScore < 75 && !isGoodScript && retentionRisk > 35) {
    addFix("Tighten the middle section — each line should add new information or tension.");
  }

  // Optional improvements for good-but-not-great scripts
  if (isGoodScript && !isStrongScript) {
    if (fixes.length === 0) {
      if (hookScore >= 65 && retentionRisk <= 35) {
        addFix("Add one more specific example, number, or concrete detail to make the payoff feel more earned.");
        addFix("Make the payoff more specific so the viewer feels clearly rewarded.");
        addFix("Tighten any line that does not add new information or tension.");
      } else {
        if (hookScore < 75) addFix("Sharpen the first line with a stronger curiosity gap or clearer contrast.");
        if (signals.specificityScore < 30) addFix("Add one more specific detail to make the payoff feel even more concrete.");
        if (fixes.length === 0) addFix("Tighten any line that does not add new information or tension.");
      }
    }
  }

  // ── Warning line indexes ───────────────────────────────────────────────────
  lines.forEach((line, index) => {
    if (riskyLineIndexes.includes(index)) return;
    const ll = line.toLowerCase();
    const isMediumLength = line.length > 110 && line.length <= 200;
    const isVague =
      (ll.includes("viewers") || ll.includes("creators") || ll.includes("retention")) &&
      !ll.includes("?") && !ll.includes("but") && !ll.includes("real problem");
    const hasWarningPhrase = [
      "most people think", "most creators think", "the problem is",
      "step by step", "every line should", "add one line", "start with",
    ].some(p => ll.includes(p));
    const isGenericLine = signals.genericPenalty >= 12 && [
      "you should", "you need to", "this will help", "make sure",
      "try to", "get better", "improve your",
    ].some(p => ll.includes(p));
    if (isMediumLength || isVague || hasWarningPhrase || isGenericLine) {
      warningLineIndexes.push(index);
    }
  });

  // ── Deduplicate + sort ─────────────────────────────────────────────────────
  riskyParts.sort((a, b) => {
    const getStart = (timeStr: string) => {
      const match = timeStr.match(/(\d+):(\d+)/);
      return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
    };
    return getStart(a.time) - getStart(b.time);
  });

  function getStartSeconds(timeStr: string): number {
    const match = timeStr.match(/(\d+):(\d+)/);
    return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
  }

  const mergedRiskyParts: RiskyPart[] = [];
  for (const part of riskyParts) {
    const partStart = getStartSeconds(part.time);
    const overlapping = mergedRiskyParts.findIndex(existing => {
      const existingStart = getStartSeconds(existing.time);
      return Math.abs(partStart - existingStart) <= 3;
    });
    if (overlapping === -1) {
      mergedRiskyParts.push(part);
    } else {
      const existing = mergedRiskyParts[overlapping];
      if (part.title.length > (existing?.title.length ?? 0)) {
        mergedRiskyParts[overlapping] = part;
      }
    }
  }

  let uniqueRiskyParts = dedupeRiskyParts(mergedRiskyParts);
  let uniqueFixes = dedupeFixes(fixes).slice(0, 5);
  const uniqueRiskyIndexes = [...new Set(riskyLineIndexes)]
    .filter(i => i >= 0 && i < totalLines)
    .sort((a, b) => a - b);
  const uniqueWarningIndexes = [...new Set(warningLineIndexes)]
    .filter(i => i >= 0 && i < totalLines && !uniqueRiskyIndexes.includes(i))
    .sort((a, b) => a - b);

  // ── Enforce minimums for weak scripts ─────────────────────────────────────
  if (overallScore < 58) {
    const alreadyHasOpeningPart = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("weak opening") ||
      p.title.toLowerCase().includes("hook needs") ||
      p.title.toLowerCase().includes("curiosity gap") ||
      p.title.toLowerCase().includes("too short") ||
      p.title.toLowerCase().includes("strong payoff appears")
    );
    if (uniqueRiskyParts.length < 2 && effectiveHookScore < 65 && !alreadyHasOpeningPart) {
      uniqueRiskyParts.push({
        time: createTimeRange(0, 0.25, duration),
        title: "Hook needs more work.",
        description: "The opening does not clearly create curiosity, contrast, or a reason to stay.",
      });
      if (!uniqueRiskyIndexes.includes(0)) uniqueRiskyIndexes.push(0);
    }
    if (uniqueRiskyParts.length < 2 && !hasStructuredEscalation) {
      uniqueRiskyParts.push({
        time: createTimeRange(0.35, 0.65, duration),
        title: "Middle may lose momentum.",
        description: "The script may need a stronger turn, contrast, or new piece of information.",
      });
      uniqueRiskyIndexes.push(Math.max(1, Math.floor(totalLines / 2)));
    }
    if (uniqueFixes.length < 4 && !isStructurallyCompleteShort) {
      if (hookNeedsWork && effectiveHookScore < 65 && !uniqueFixes.some(f => f.toLowerCase().includes("rewrite") || f.toLowerCase().includes("sharpen") || f.toLowerCase().includes("opening line") || f.toLowerCase().includes("lead with"))) {
        uniqueFixes.push("Rewrite the opening line — lead with the strongest consequence, contrast, or specific detail from your script.");
      } else if (
        !structures.hasConsequencePayoff &&
        !uniqueFixes.some(f =>
          f.toLowerCase().includes("sharpen") ||
          f.toLowerCase().includes("tighten") ||
          f.toLowerCase().includes("payoff")
        )
      ) {
        uniqueFixes.push("Make the payoff more specific so the viewer feels rewarded.");
      }
      if (
        signals.contrastScore < 20 &&
        !hasStructuredEscalation &&
        !uniqueFixes.some(f => f.toLowerCase().includes("contrast"))
      ) {
        uniqueFixes.push("Add a contrast or pattern interrupt in the middle section.");
      }
      if (
        signals.payoffScore < 20 &&
        signals.consequenceScore < 15 &&
        !structures.hasConsequencePayoff &&
        !uniqueFixes.some(f => f.toLowerCase().includes("payoff"))
      ) {
        uniqueFixes.push("Make the payoff more specific so the viewer feels rewarded.");
      }
      if (uniqueFixes.length < 4) {
        uniqueFixes.push("Make each line earn its place — cut any sentence that does not add new information or tension.");
      }
    }
    uniqueRiskyParts = dedupeRiskyParts(uniqueRiskyParts);
    uniqueFixes = dedupeFixes(uniqueFixes).slice(0, 5);
  } else if (overallScore < 75) {
    const alreadyHasOpeningPartMid = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("weak opening") ||
      p.title.toLowerCase().includes("hook needs") ||
      p.title.toLowerCase().includes("curiosity gap") ||
      p.title.toLowerCase().includes("strong payoff appears")
    );
    if (uniqueRiskyParts.length < 1 && uniqueFixes.length > 0) {
      if (effectiveHookScore < 65 && !alreadyHasOpeningPartMid) {
        uniqueRiskyParts.push({
          time: createTimeRange(0, 0.25, duration),
          title: "Hook needs more work.",
          description: "The opening does not clearly create curiosity, contrast, or a reason to stay.",
        });
        if (!uniqueRiskyIndexes.includes(0)) uniqueRiskyIndexes.push(0);
      } else if (signals.genericPenalty >= 12) {
        uniqueRiskyParts.push({
          time: createTimeRange(0.2, 0.7, duration),
          title: "Script feels too generic.",
          description: "The lines repeat obvious ideas without a concrete example, number, or consequence.",
        });
      } else if (payoffStrength < 35 && !lastLineIsStrong) {
        uniqueRiskyParts.push({
          time: createTimeRange(0.75, 1.0, duration),
          title: "Payoff could be stronger.",
          description: "The ending may not feel rewarding. A clearer result or consequence would help.",
        });
        uniqueRiskyIndexes.push(Math.max(0, totalLines - 1));
      }
    }
    if (uniqueFixes.length < 2) {
      if (hookNeedsWork && effectiveHookScore < 68 && !uniqueFixes.some(f => f.toLowerCase().includes("sharpen") || f.toLowerCase().includes("rewrite") || f.toLowerCase().includes("lead with"))) {
        uniqueFixes.push("Sharpen the first line with a stronger curiosity gap or clearer contrast.");
      }
      if (
        signals.contrastScore < 15 &&
        signals.openLoopScore < 15 &&
        !hasStructuredEscalation &&
        !uniqueFixes.some(f => f.toLowerCase().includes("contrast") || f.toLowerCase().includes("turn"))
      ) {
        uniqueFixes.push("Add a contrast or unexpected turn in the middle section.");
      }
      if (signals.payoffScore < 20 && signals.consequenceScore < 15 && !lastLineIsStrong && !uniqueFixes.some(f => f.toLowerCase().includes("payoff") || f.toLowerCase().includes("result"))) {
        uniqueFixes.push("End with a specific result, consequence, or unresolved detail the viewer will remember.");
      }
      if (uniqueFixes.length < 2) {
        uniqueFixes.push("Make each line earn its place — cut any sentence that does not add new information or tension.");
      }
    }
    uniqueRiskyParts = dedupeRiskyParts(uniqueRiskyParts);
    uniqueFixes = dedupeFixes(uniqueFixes).slice(0, 5);
  }

 if (uniqueRiskyParts.length === 0 && overallScore >= 80) {
    uniqueFixes.length = 0;
    uniqueRiskyIndexes.length = 0;
    uniqueWarningIndexes.length = 0;
  }

  // If risky parts exist but fixes are empty, add at least one specific fix.
  // This prevents "No fixes needed" from appearing alongside risky parts.
  if (uniqueRiskyParts.length > 0 && uniqueFixes.length === 0) {
    const hasPayoffIssue = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("payoff") ||
      p.title.toLowerCase().includes("generic payoff") ||
      p.title.toLowerCase().includes("weak or generic")
    );
    const hasHookIssue = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("hook") ||
      p.title.toLowerCase().includes("opening") ||
      p.title.toLowerCase().includes("curiosity gap")
    );
    const hasMiddleIssue = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("middle") ||
      p.title.toLowerCase().includes("momentum")
    );
    if (hasPayoffIssue) {
      uniqueFixes.push("Replace the final line with a specific consequence, result, or unresolved detail that rewards viewers for watching.");
    }
    if (hasHookIssue && !uniqueFixes.some(f => f.toLowerCase().includes("opening") || f.toLowerCase().includes("hook"))) {
      uniqueFixes.push("Sharpen the opening line with a stronger curiosity gap, contrast, or concrete detail.");
    }
    if (hasMiddleIssue && !uniqueFixes.some(f => f.toLowerCase().includes("middle") || f.toLowerCase().includes("tension"))) {
      uniqueFixes.push("Tighten the middle section — each line should add new information or tension.");
    }
    if (uniqueFixes.length === 0) {
      uniqueFixes.push("Make each line earn its place — cut any sentence that does not add new information or tension.");
    }
  }

  uniqueFixes = dedupeFixes(uniqueFixes).slice(0, 5);

  const hasEndingFlagged = uniqueRiskyParts.some(p =>
    p.title.toLowerCase().includes("payoff") ||
    p.title.toLowerCase().includes("too long") ||
    p.title.toLowerCase().includes("drop-off")
  );

  const sceneSegments = createSceneSegments(
    effectiveHookScore,
    retentionRisk,
    overallScore,
    uniqueRiskyParts.length > 0,
    hasEndingFlagged,
    uniqueFixes.length,
    payoffStrength,
    structures,
  );

  const issueTitles = uniqueRiskyParts.map(p => p.title.toLowerCase());
  const mainTakeaway = buildMainTakeaway(
    text,
    calibratedHookScore,
    payoffStrength,
    retentionRisk,
    signals,
    structures,
    issueTitles,
  );

  return {
    overall: {
      score: overallScore,
      label: getOverallLabel(overallScore),
      color: "#FFFFFF",
      ringColor: overallScore >= 75 ? "#22C55E" : overallScore >= 60 ? "#F59E0B" : "#EF4444",
      description: mainTakeaway,
    },
    hook: {
      score: calibratedHookScore,
      label: getHookLabel(calibratedHookScore),
      color: getHookColor(calibratedHookScore),
      ringColor: getHookColor(calibratedHookScore),
      description: getHookDescription(calibratedHookScore, issueTitles, structures),
    },
    risk: {
      score: retentionRisk,
      label: getRiskLabel(retentionRisk),
      color: getRiskColor(retentionRisk),
      ringColor: getRiskColor(retentionRisk),
      description: getRiskDescription(retentionRisk, issueTitles, structures, signals.genericPenalty),
    },
    riskyParts: uniqueRiskyParts.slice(0, 4),
    fixes: uniqueFixes.slice(0, 5),
    riskyLineIndexes: uniqueRiskyIndexes,
    warningLineIndexes: uniqueWarningIndexes,
    sceneSegments,
  };
}

function createSceneSegments(
  hookScore: number,
  riskScore: number,
  overallScore: number,
  hasRiskyParts: boolean,
  hasEndingFlagged: boolean,
  fixCount: number,
  payoffStrength: number,
  structures?: ScriptStructures,
): SceneSegment[] {
  const totalWidth = 1110;

  // ── Opening segment color ─────────────────────────────────────────────────
  // Use 70 as the threshold for green ("Strong hook") so that a score of 60
  // (Average) shows yellow ("Average hook") instead of green, keeping the
  // scene breakdown consistent with the hook score card.
  const hookAcceptableForScene = hookScore >= 70 && !(structures?.hasFillerIntro ?? false);

  const openingColor: string =
    hookAcceptableForScene ? "#22C55E"
    : hookScore < 50 ? "#EF4444"
    : "#F59E0B";

  // ── Middle segment color ──────────────────────────────────────────────────
  // If structure detection shows valid escalation (list buildup, mystery clue
  // buildup, or contradiction), do not color middle as risky even if riskScore
  // is elevated. The elevated risk comes from the hook, not the middle.
  const hasValidMiddleStructure =
    structures?.hasListBuildup ||
    structures?.hasMysteryClueBuildup ||
    structures?.hasContradictionReversal ||
    structures?.hasNumericPremise ||
    structures?.hasExplanationChain ||
    structures?.hasNarrativeArc ||
    structures?.hasPersistenceArc ||
    structures?.hasCapabilityViolation ||
    structures?.hasAnomalySequence ||
    structures?.hasConsequenceProgression;

  const effectiveMiddleRisk = hasValidMiddleStructure
    ? Math.min(riskScore, 44)  // cap middle color at "Average" if structure is valid
    : riskScore;

  const middleColor: string =
    effectiveMiddleRisk >= 60 ? "#EF4444"
    : effectiveMiddleRisk >= 35 ? "#F59E0B"
    : "#22C55E";

  // ── Ending segment color ──────────────────────────────────────────────────
  const endingColor: string =
    hasEndingFlagged && riskScore >= 45 ? "#EF4444"
    : hasEndingFlagged || (overallScore < 75 && fixCount > 0) || payoffStrength < 40 ? "#F59E0B"
    : overallScore >= 75 && riskScore < 35 && !hasRiskyParts ? "#22C55E"
    : "#F59E0B";

  // ── Labels — use distinct names to prevent duplicate legend entries ────────
  // Opening: Hook / Average Hook / Weak Hook
  const openingLabel =
    openingColor === "#EF4444" ? "Weak hook"
    : openingColor === "#F59E0B" ? "Average hook"
    : "Strong hook";

  const middleLabel =
    middleColor === "#EF4444" ? "Risky middle"
    : middleColor === "#F59E0B"
      ? (structures?.hasExplanationChain || structures?.hasNumericPremise
          ? "Explanation"
          : hasValidMiddleStructure
          ? "Buildup"
          : "Average middle")
      : (structures?.hasExplanationChain || structures?.hasNumericPremise
          ? "Explanation"
          : hasValidMiddleStructure
          ? "Buildup"
          : "Strong middle");

  const endingLabel =
    endingColor === "#EF4444" ? "Drop-off risk"
    : endingColor === "#F59E0B" ? "Average ending"
    : "Strong ending";

  const openingRatio = hookScore < 45 ? 0.38 : hookScore < 75 ? 0.33 : 0.30;
  const endingRatio  = 0.25;
  const middleRatio  = 1 - openingRatio - endingRatio;

  return withWidths(
    [
      { label: openingLabel, color: openingColor },
      { label: middleLabel,  color: middleColor  },
      { label: endingLabel,  color: endingColor  },
    ],
    [openingRatio, middleRatio, endingRatio],
    totalWidth
  );
}

function withWidths(
  segments: Omit<SceneSegment, "width">[],
  ratios: number[],
  totalWidth: number
): SceneSegment[] {
  let usedWidth = 0;
  return segments.map((segment, index) => {
    const isLast = index === segments.length - 1;
    const width = isLast
      ? totalWidth - usedWidth
      : Math.round(totalWidth * ratios[index]);
    usedWidth += width;
    return { ...segment, width };
  });
}

function dedupeRiskyParts(parts: RiskyPart[]): RiskyPart[] {
  const seen = new Set<string>();
  let hasOpeningIssue = false;
  const openingKeywords = ["weak opening", "hook needs", "curiosity gap", "no clear curiosity", "opening does not"];
  return parts.filter(part => {
    const key = part.title.toLowerCase();
    const isOpeningIssue = openingKeywords.some(k => key.includes(k));
    if (isOpeningIssue) {
      if (hasOpeningIssue) return false;
      hasOpeningIssue = true;
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getOverallLabel(score: number): string {
  if (score >= 85) return "Very Strong";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Average";
  if (score >= 40) return "Needs Work";
  return "Weak";
}

function getHookLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Good";
  if (score >= 55) return "Average";
  return "Weak";
}

function getRiskLabel(score: number): string {
  if (score >= 65) return "High";
  if (score >= 45) return "Medium";
  if (score >= 26) return "Low-Medium";
  return "Low";
}

function getHookColor(score: number): string {
  if (score >= 75) return "#22C55E";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

function getRiskColor(score: number): string {
  if (score >= 65) return "#EF4444";
  if (score >= 45) return "#F59E0B";
  return "#22C55E";
}

function getHookDescription(score: number, issues: string[], structures?: ScriptStructures): string {
  if (issues.some(i => i.includes("strong payoff appears too late"))) {
    return "The opening announces the topic instead of leading with the strongest consequence. Move the payoff earlier.";
  }
  if (score < 45 && issues.some(i => i.includes("weak opening") || i.includes("hook needs"))) {
    return "The opening feels too slow. Replace it with a question, contrast, or clear result.";
  }
  if (score < 65 && issues.some(i => i.includes("curiosity gap"))) {
    return "The hook is understandable, but it does not create enough curiosity yet.";
  }
  if (score >= 80) return "Strong opening. It creates curiosity and gives viewers a clear reason to keep watching.";
  if (score >= 65) {
    if (structures?.hasFillerIntro) {
      return "The script has strong content, but the opening still announces the topic instead of leading with it.";
    }
    return "The hook is clear, but it could create a slightly stronger curiosity gap or contrast.";
  }
  if (score >= 45) return "The opening is understandable, but may not stop viewers from scrolling fast enough.";
  return "The first line needs a stronger question, contrast, or promise to earn attention.";
}

function getRiskDescription(score: number, issues: string[], structures?: ScriptStructures, genericPenalty?: number): string {
  // Generic override — fires FIRST when the script is clearly filler/repetitive.
  // This prevents structure labels like "buildup escalates well" for generic scripts.
  const isGenericScript = (genericPenalty ?? 0) >= 20 ||
    issues.some(i => i.includes("generic") || i.includes("filler phrases"));

  if (isGenericScript) {
    if (score >= 65) {
      return "High risk. The script repeats obvious ideas, lacks concrete examples, and does not build enough tension or payoff.";
    }
    if (score >= 45) {
      return "Medium risk. The script relies on general statements. Adding a specific example or concrete consequence would lower the risk.";
    }
    return "Moderate risk. The ideas are too vague to hold attention. Replace generic lines with specific details or consequences.";
  }

  // Structure-aware descriptions — only reached when script is NOT generic
  if (structures?.hasExplanationChain || structures?.hasNumericPremise) {
    if (score >= 45) {
      return "The explanation is clear, but the middle or payoff may need to build more tension before the ending.";
    }
    if (score >= 26) {
      return "Moderate risk. The mechanism and consequence are clear but the script could escalate more before the payoff.";
    }
    return "Low retention risk. The script builds a clear chain from premise to consequence.";
  }
  if (structures?.hasListBuildup || structures?.hasMysteryClueBuildup) {
    if (score >= 45) {
      return "The buildup escalates well, but the script may still lose viewers before the payoff arrives.";
    }
    if (score >= 26) {
      return "Moderate risk. The escalation structure is solid but could carry more tension through the middle.";
    }
    return "Low retention risk. The script escalates clearly toward the payoff.";
  }
  if (structures?.hasContradictionReversal) {
    if (score >= 45) {
      return "The reversal structure creates contrast, but the opening could deliver the insight faster.";
    }
    return "The reversal structure works well. Viewers who reach the contrast are likely to stay.";
  }
  // Issue-driven overrides
  if (issues.some(i => i.includes("middle may lose"))) {
    return "The middle may feel flat. Add a new turn or contrast to restart attention.";
  }
  if (issues.some(i => i.includes("no reason to keep"))) {
    return "The script may lose momentum because it does not build enough unanswered curiosity.";
  }
  // Score-based fallback
  if (score >= 65) {
    return "Several drop-off points were detected. The structure may not hold attention through the middle and payoff.";
  }
  if (score >= 45) return "Some sections may slow viewers down, especially where the script explains without building tension.";
  if (score >= 26) return "Moderate risk. The structure mostly works but a few moments could be tightened.";
  return "Low retention risk. The script stays focused and moves clearly from hook to payoff.";
}
