// Script classification and transcript normalization.
// Keep feedback analysis, score calculation, and UI concerns outside this module.

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
