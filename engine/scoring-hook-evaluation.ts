import {
  detectAnomalySequence,
  detectCapabilityViolation,
  detectConsequenceProgression,
  detectNarrativeArc,
  detectPersistenceArc,
  hasSpecificQuantity,
} from "./scoring-structures";
import type { UniversalSignals } from "./scoring-evaluation";

// Pure hook-score calculation.
// Keep signal extraction, retention, and payoff evaluation in their own modules.

export function calculateHookStrength(
  firstSentence: string,
  signals: UniversalSignals,
  script: string = ""
): number {
  const lower = firstSentence.toLowerCase();
  const wordCount = firstSentence.split(/\s+/).filter(Boolean).length;

  let score = 38;

// ── Tier-0: paradox / contradiction / mechanism hooks ─────────────────────
  // Detects "wins before he even leaves", "starts before defenders react",
  // "already ... before", "not because ... but because", "sounds strange but",
  // "the real reason is", etc. Universal — no hardcoded topics.
  //
  // Rules:
  // 1. First line matches a paradox/contrast/mechanism pattern.
  // 2. First line contains a concrete subject+action (not just the pattern).
  // 3. At least 2 body lines develop the mechanism (not just restate).
  const PARADOX_PATTERNS: RegExp[] = [
    /\bbefore (he|she|they|it) even\b/i,
    /\bbefore (he|she|they|it) (leaves?|left|jumps?|jumped|lands?|landed|reacts?|reacted|realizes?|realized|notices?|noticed)\b/i,
    /\bbefore (defenders?|people|anyone|everyone|viewers?)\b/i,
    /\balready .{2,40} before\b/i,
    /\bstarts? before\b/i,
    /\bwins? .{2,30} before\b/i,
    /\bnot because .{2,60} but because\b/i,
    /\bnot just .{2,40} but\b/i,
    /\bmost people think .{2,60} but\b/i,
    /\bsounds? (strange|odd|impossible|wrong|counterintuitive) but\b/i,
    /\bthe (strange|scary|real|hidden|surprising|counterintuitive) (part|reason|truth) is\b/i,
    /\bbefore (it even|they even|the ball|the cross|the pass|the shot)\b/i,
  ];
  const hasParadoxPattern = PARADOX_PATTERNS.some(p => p.test(firstSentence));

  // Concrete subject: named entity OR subject+verb with a physical/action noun
  const hasConcreteSubject =
    /\b[A-Z][a-z]{2,}\b/.test(firstSentence) ||
    /\b(jump|jumps|win|wins|score|scores|shoot|shoots|land|lands|react|reacts|move|moves|start|starts|reach|reaches|leave|leaves|defend|defends)\b/i.test(firstSentence) ||
    /\b(header|shot|pass|ball|defender|ground|air|cross|body)\b/i.test(firstSentence);

  // Mechanism development: body lines explain HOW/WHY, not just repeat
  const bodyForParadox = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean).slice(1);
  const mechanismLineCount = bodyForParadox.filter(line => {
    const ll = line.toLowerCase();
    return (
      /\b(because|which means|that means|as a result|the reason|so that|therefore|this means|which causes|in order to|due to|that is why|before the|while the|when the)\b/i.test(ll) ||
      /\b(body|force|timing|position|space|angle|balance|momentum|control|load|transfer|plant|explode|drive|push|reach|attack|create|set up)\b/i.test(ll) ||
      (ll.includes(" before ") && !ll.includes("before the script")) ||
      (ll.includes("not just") || ll.includes("it is not about") || ll.includes("but his") || ll.includes("but her") || ll.includes("but their"))
    );
  }).length;

  // Detect flat generic claims regardless of topic or subject name.
  const flatCopulaClaim =
    /^(?:[a-z][a-z'-]*)(?:\s+[a-z][a-z'-]*){0,3}\s+(is|are|was|were)\s+(very |extremely |really |so |quite |always |often )?(dangerous|important|key|essential|hard|easy|powerful|possible|incredible|amazing|necessary|needed|useful|real|true|common|rare|unique|special|good|bad|great|terrible|best|worst|only|enough)\.?$/i.test(
      firstSentence.trim()
    );

  const flatPerformanceClaim =
    /^(?:[A-Z][A-Za-z'-]*)(?:\s+[A-Z][A-Za-z'-]*){0,2}\s+[a-z]+s\s+(high|fast|well|hard|great|amazingly?)\s+(because\s+(he|she|they|it)\s+(is|are)|because of\s+(his|her|their|its))\s+(powerful|strong|fast|quick|talented|gifted|hard.?working|dedicated|focused|the best|the greatest)\.?$/i.test(
      firstSentence.trim()
    );

  const isGenericTopicAnnouncement =
    flatCopulaClaim || flatPerformanceClaim;

  let paradoxBonus = 0;
  if (hasParadoxPattern && hasConcreteSubject && !isGenericTopicAnnouncement) {
    paradoxBonus += 22; // base paradox bonus
    if (mechanismLineCount >= 2) paradoxBonus += 12; // script develops the mechanism
    if (mechanismLineCount >= 4) paradoxBonus += 8;  // deep mechanism development
  }
  score += paradoxBonus;

  // ── Generic topic announcement penalty ────────────────────────────────────
  // Penalizes hooks that just state a broad topic without consequence/contrast.
  // Only fires when NO paradox/curiosity signal rescued it.
  if (isGenericTopicAnnouncement && paradoxBonus === 0) {
    score -= 22;
  }

  // ── Tier-1: direct curiosity / pattern-interrupt openers ──────────────────
  const tier1Hooks = [
    "what if", "did you know", "have you ever", "what really",
    "the real reason", "nobody knows", "no one knows", "you won't believe",
    "the truth about", "most people don't", "disappeared", "vanished",
    "still a mystery", "unsolved",
  ];
  const tier1Hits = tier1Hooks.filter(p => lower.includes(p)).length;
  score += tier1Hits * 18;

  // ── Tier-2: belief-contrast and soft curiosity openers ────────────────────
  const tier2Hooks = [
    "most creators think", "most people think", "everyone thinks",
    "you probably think", "most think",
    "turns out", "here's the thing", "what no one", "but the real",
    "what most", "the secret", "the real problem",
  ];
  const tier2Hits = tier2Hooks.filter(p => lower.includes(p)).length;
  score += tier2Hits * 10;

  // ── Tier-3: narrative / story-driven openers ───────────────────────────────
  // Story hooks that do not use explicit curiosity phrases but still create
  // tension through mystery setup, action, or implicit contrast
  const tier3Hooks = [
    // mystery/event openers
    "a woman", "a man", "a teenager", "a student", "a player",
    "one day", "it started when", "it began when",
    "for weeks", "for months", "nobody knew",
    // action/event openers
    "on her way", "on his way", "on their way",
    "they found", "police found", "investigators found",
    // comparison/contrast openers (sports, brand, business)
    "at first it sounds", "at first it looked", "at first it seemed",
    "sounds impossible", "looks impossible",
    // personal/social hooks
    "what if your", "imagine if your", "what if you",
  ];
  const tier3Hits = tier3Hooks.filter(p => lower.includes(p)).length;
  score += tier3Hits * 13;

  // ── Tier-4: visual scale / comparative fact hooks ─────────────────────────
  // Hooks that state a surprising scale comparison, physical fact, or
  // counterintuitive consequence — without a question mark or "imagine".
  // Examples: "The ocean is so deep that Mount Everest could disappear inside it."
  //           "Ronaldo would jump over 20 feet high on the Moon."
  //           "You are moving over 1,000 miles per hour right now."
  const hasVisualScaleComparison =
    // "so [adj] that [something unexpected]" — universal scale comparison
    /\bso (deep|tall|fast|slow|heavy|large|small|big|wide|far|long|short|hot|cold|dense|thin|strong|weak)\b.{3,40}\bthat\b/i.test(firstSentence) ||
    // "could disappear / could fit / could be hidden" — scale consequence
    /\bcould (disappear|fit|be hidden|vanish|be buried|be swallowed|be submerged)\b/i.test(firstSentence) ||
    // "[named subject] would [action] [measurement]" — hypothetical numeric
    /\b\w+ would (jump|reach|travel|move|fall|rise|grow|shrink|expand|stretch)\b/i.test(firstSentence) ||
    // "feels [adj] before it even [verb]" — conceptual curiosity (elevator-style)
    /\bfeels? .{3,30} before it even\b/i.test(firstSentence) ||
    // "can feel [adj/adv] before" — same pattern
    /\bcan feel .{2,25} before\b/i.test(firstSentence) ||
    // "[noun] can change the way you [verb]" — consequence hook
    /\bcan change (the way|how) you\b/i.test(firstSentence) ||
    // "[noun] changes how/what you" — behavioral consequence
    /\b(changes|changed) (how|what|who|the way) you\b/i.test(firstSentence);

  if (hasVisualScaleComparison) score += 22;

  // ── Tier-5: contrast/consequence statement hooks ───────────────────────────
  // Strong statement hooks that use "not X, but Y" or "not in X, but in Y"
  // These are strong even without a question mark.
  // Example: "Most people lose money not in one big mistake, but in tiny decisions."
  const hasContrastStatementHook =
    // "not in X, but in Y" — universal contrast pattern
    /\bnot in .{3,60}, but in\b/i.test(firstSentence) ||
    // "not X, but Y" — universal "not A but B" reversal (any length)
    /\bnot .{3,60}, but \b/i.test(firstSentence) ||
    // "not in one X but in Y" — catches "not in one big mistake but in tiny decisions"
    /\bnot in one .{3,40} but\b/i.test(firstSentence) ||
    // "not X but Y" without comma
    /\bnot [a-z].{3,40} but [a-z]/i.test(firstSentence) ||
    // "X does not sell Y, it sells Z" — identity/status reversal
    /\bdoes not (sell|make|create|build|teach|earn|give|offer)\b.{2,30}\bit (sells|makes|creates|builds|teaches|earns|gives|offers)\b/i.test(firstSentence) ||
    // "cheap/expensive X can beat/outperform Y" — comparative reversal
    /\b(cheap|expensive|simple|complex|small|large|old|new) .{2,25} (can|could) (beat|outperform|outsell|win|replace)\b/i.test(firstSentence) ||
    // "most people lose/fail/miss X not because of Y but because of Z"
    /\bmost people (lose|fail|miss|struggle|spend|waste).{3,60}\bnot\b/i.test(firstSentence);

  if (hasContrastStatementHook) score += 20;

// ── Challenge / bet / stunt hooks ─────────────────────────────────────────
  // "Can you X?", "I bet $Y he couldn't", "Is it possible to X?" are strong
  // viral hook patterns that the general scoring misses.
  const isChallengeQuestion =
    /^(can you|could you|is it possible|would you|what if you)\b/i.test(lower) ||
    /\b(slice|cut|break|survive|catch|dodge|beat|outrun)\b.{0,30}\?/i.test(firstSentence);
  if (isChallengeQuestion) score += 22;

  const hasBetOrStake =
    /\$[\d,]+/.test(firstSentence) ||
    /\b\d[\d,]* (dollars?|bucks)\b/i.test(firstSentence) ||
    /\b(bet|wager|i don'?t believe|he couldn'?t|she couldn'?t|they couldn'?t)\b/i.test(lower);
  if (hasBetOrStake) score += 18;

  // Do not award extra hook points for a closed list of familiar objects.
  // The challenge structure itself is already rewarded above.

// ── Question mark in first sentence ───────────────────────────────────────
  // Questions are one valid hook type but NOT the only one.
  // Statement hooks with specificity can be equally strong.
  if (firstSentence.includes("?")) score += 8;

// ── Scenario / imagination hooks ──────────────────────────────────────────
  // "Imagine..." and "Imagine if..." create mental images and stakes.
  // These should not be penalized just because they are not questions.
  const scenarioHookPhrases = [
    "imagine someone", "imagine if", "imagine you", "imagine a ",
    "picture this", "what if your", "what if you woke",
  ];
  const isScenarioHook = scenarioHookPhrases.some(p => lower.startsWith(p) || lower.includes(p));
  if (isScenarioHook) score += 18;

  // ── Scenario hook with personal stakes bonus ──────────────────────────────
  // A scenario hook that also addresses the viewer directly with private/personal
  // language earns an additional bonus. This covers hooks like:
  // "Imagine someone was about to play back everything you said today."
  // which have: concrete scenario + "you" + private/personal stakes + time anchor.
  const hasPersonalStakeLanguage =
    (lower.includes(" you ") || lower.includes(" your ") || lower.startsWith("you ")) &&
    (lower.includes("private") || lower.includes("said") || lower.includes("wrote") ||
     lower.includes("sent") || lower.includes("thought") || lower.includes("today") ||
     lower.includes("play back") || lower.includes("replay") || lower.includes("heard") ||
     lower.includes("record") || lower.includes("message") || lower.includes("joke"));
  if (isScenarioHook && hasPersonalStakeLanguage) score += 10;

  // ── Specific numeric / measurement hooks ──────────────────────────────────
  // A hook with a specific number + named subject + unusual scenario is strong
  // without needing a question. "Ronaldo would jump over 20 feet" = strong.
  const hasNumber = /\d/.test(firstSentence);
  const hasUnit = /\b(inch(?:es)?|feet|foot|miles|km|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|kilograms|pounds|degrees|times|billion|million|thousand)\b/i.test(firstSentence);
  const hasNamedSubject = /\b[A-Z][a-z]{2,}\b/.test(firstSentence);
  const hasSpecificQuantityWord = hasSpecificQuantity(firstSentence);
  if (hasNumber && hasUnit) score += 16;
  else if (hasSpecificQuantityWord) score += 14; // spelled-out duration/quantity, e.g. "six years"
  else if (hasNumber) score += 8;
  if (hasNamedSubject && (hasNumber || hasSpecificQuantityWord)) score += 8;

  // ── Direct viewer address ─────────────────────────────────────────────────
  if (lower.includes(" your ") || lower.startsWith("your ")) score += 8;
  if (lower.includes(" you ") && !lower.startsWith("you ")) score += 4;

  // ── Contrast words in first sentence ─────────────────────────────────────
  const contrastPhrases = [
    "but the real", "but actually", "not what", "most creators",
    "the problem is", "the real problem", "however",
    "not the real", "that is not", "it is not about",
  ];
  const contrastHits = contrastPhrases.filter(p => lower.includes(p)).length;
  if (contrastHits >= 1) score += 10 + Math.min(contrastHits - 1, 2) * 5;
  if (contrastHits === 0 && lower.includes("but")) score += 4;

  // ── Numeric / money specificity ───────────────────────────────────────────
  if (/\d/.test(firstSentence)) score += 8;
  if (/\$|million|billion/.test(lower)) score += 5;

  // ── Stakes / tension words in first sentence ──────────────────────────────
  const stakesPhrases = [
    "lost", "destroyed", "cost", "danger", "changed",
    "forever", "collapse", "killed", "losing",
    "darker", "disappeared", "vanished", "impossible",
  ];
  const stakesHits = stakesPhrases.filter(p => lower.includes(p)).length;
  score += Math.min(stakesHits, 2) * 7;

  // ── Narrative specificity from first sentence ─────────────────────────────
  // Universal: detect concrete physical/event details structurally, not by topic.
  // These patterns work for any niche: crime, science, sports, business, etc.
  const hasConcreteAction =
    // physical state or location detail (universal)
    /\b(stopped|found|discovered|disappeared|arrived|recording|captured|caught|revealed)\b/i.test(firstSentence) ||
    // sensory or physical object detail (universal)
    /\b(footage|camera|recording|message|image|photo|signal|trace)\b/i.test(firstSentence) ||
    // comparative/competitive framing (universal)
    /\b(outjump|outsell|outperform|beats|beat|versus|compared to|vs\.?)\b/i.test(firstSentence) ||
    // functional vs symbolic framing (universal)
    /\b(tell time|keep time|measure|track|mark)\b/i.test(firstSentence);
  if (hasConcreteAction) score += Math.min(2, 1) * 8;

  // ── Open loop support from full script ────────────────────────────────────
  if (signals.openLoopScore >= 20) score += 7;

  // ── Clarity bonus ─────────────────────────────────────────────────────────
  if (wordCount >= 5 && wordCount <= 22) score += 8;
  else if (wordCount > 30) score -= 10;

  // ── Penalties ─────────────────────────────────────────────────────────────
  const hardWeakStarts = [
    "welcome back", "hey guys", "hello everyone",
    "today we are going to", "today i want to",
    "before we start", "before we begin",
    "in today's video", "let me explain",
  ];
  if (hardWeakStarts.some(p => lower.startsWith(p))) score -= 28;
  if (lower.startsWith("in this video")) score -= 18;

  const vagueStarts = [
    "this is about", "this video is about", "this is a story about",
    "i want to talk about", "let's talk about", "so basically",
    "i will talk about", "i will explain",
  ];
  if (vagueStarts.some(p => lower.startsWith(p) || lower.includes(p))) score -= 14;

  // No curiosity/contrast/narrative/scenario/numeric signal — soft penalty only
  // Do NOT penalize numeric hooks or scenario hooks even if they lack question marks.
  const hasScenarioSignal = scenarioHookPhrases.some(p => lower.startsWith(p) || lower.includes(p));
  const hasNumericSignal = (hasNumber && (hasUnit || hasNamedSubject)) || hasSpecificQuantityWord;
  // Only apply no-signal penalty if NONE of the structural hook signals fired.
  // hasVisualScaleComparison and hasContrastStatementHook are declared above.
  if (
    tier1Hits === 0 && tier2Hits === 0 && tier3Hits === 0 &&
    !firstSentence.includes("?") && contrastHits === 0 &&
    !hasScenarioSignal && !hasNumericSignal &&
    !hasVisualScaleComparison && !hasContrastStatementHook
  ) {
    score -= 6;
  }

  // ── Generic hook penalty ──────────────────────────────────────────────────
  // Applies when the hook is a vague abstract claim with no concrete detail,
  // no consequence, no contrast, and no specific image.
  const genericHookPhrases = [
    "is very important", "is important in", "is something everyone",
    "is possible for anyone", "many people want", "everyone wants",
    "we all want", "is the key to", "takes hard work",
    "need to work hard", "never give up", "stay focused",
    "can reach your goals", "success is", "failure is",
    "time is ", "life is ", "people are ",
  ];
  const isGenericHook = genericHookPhrases.some(p => lower.includes(p)) || isGenericTopicAnnouncement;
  // Only penalize if no structural signal rescued it
  if (
    isGenericHook &&
    paradoxBonus === 0 &&
    tier1Hits === 0 && tier2Hits === 0 && tier3Hits === 0 &&
    !hasVisualScaleComparison && !hasContrastStatementHook &&
    !hasScenarioSignal && !hasNumericSignal
  ) {
    score -= 20;
  }
  const hasPersonalConcreteOpener =
    /^(her|his|their|my|our)\s+\w+(\s+\w+){0,3}\s+(had|was|were|did|would|never|always|hadn'?t|wasn'?t)\b/i.test(firstSentence);
  if (hasPersonalConcreteOpener) score += 12;

  const linesForArc = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean);
  const arcCheck = detectNarrativeArc(linesForArc);
  const persistenceCheck = detectPersistenceArc(linesForArc);
  const capabilityCheck = detectCapabilityViolation(linesForArc);
  const anomalyCheck = detectAnomalySequence(linesForArc);
  const progressionCheck = detectConsequenceProgression(linesForArc);

  const hasAnyUniversalNarrative =
    (arcCheck.hasNarrativeArc && arcCheck.arcIsEarly) ||
    persistenceCheck.has || capabilityCheck.has ||
    anomalyCheck.has || progressionCheck.has;

  if (hasAnyUniversalNarrative && !isGenericTopicAnnouncement) {
    score += 18;
    if (hasPersonalConcreteOpener || hasNamedSubject) score += 6;
  }

  // A confirmed impossible-skill contradiction is inherently a strong
  // curiosity hook. Prevent generic opener heuristics from leaving it
  // below the strong-hook threshold, without inflating stronger cases.
  if (capabilityCheck.has && !isGenericTopicAnnouncement) {
    score = Math.max(score, 75);
  }

  const signalFamiliesFired = [
    hasParadoxPattern || hasContrastStatementHook,
    hasNumber && hasUnit,
    tier1Hits > 0 || lower.includes("nobody") || lower.includes("no one") || lower.includes("disappeared"),
    stakesHits > 0,
    hasVisualScaleComparison,
    hasPersonalConcreteOpener || hasAnyUniversalNarrative,
  ].filter(Boolean).length;

  let eliteBonus = 0;
  if (signalFamiliesFired >= 4) eliteBonus = 14;
  else if (signalFamiliesFired === 3) eliteBonus = 8;
  else if (signalFamiliesFired === 2) eliteBonus = 3;

  score += eliteBonus;

  const hasStrongSpecificity = signals.specificityScore >= 30;
  const cap =
    signalFamiliesFired >= 3 ? 100 :
    hasStrongSpecificity ? 92 :
    88;

  return Math.min(cap, Math.max(0, Math.round(score)));
}
