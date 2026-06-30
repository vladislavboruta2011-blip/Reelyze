import {
  detectAnomalySequence,
  detectCapabilityViolation,
  detectConsequenceProgression,
  detectNarrativeArc,
  detectPersistenceArc,
  hasSpecificQuantity,
  hasStrongOutcomePayoff,
  type ScriptStructures,
} from "./scoring-structures";

// Pure signal extraction and score calculation.
// Keep orchestration, presentation labels, and UI concerns outside this module.

export interface OpeningWindowSignals {
  // True if the window contains a structural reveal after a setup
  hasSetupReveal: boolean;
  // True if the window contains a concrete size/scale/measurement comparison
  hasConcreteComparison: boolean;
  // True if the window contains a causal connector leading to a consequence
  hasCausalConsequence: boolean;
  // True if window has a specific number with a unit
  hasNumericDetail: boolean;
  // True if window has a scenario opener (imagine / what if)
  hasScenarioOpener: boolean;
  // True if window scenario has any stakes / consequence / mystery
  scenarioHasStakes: boolean;
  // Structural strength 0–100 of the two-line opening
  windowStrength: number;
}

export function extractOpeningWindow(scriptLines: string[]): string {
  // Take the first 2 lines, capped at ~35 words total
  const candidates = scriptLines.slice(0, 2);
  const joined = candidates.join(" ").trim();
  const words = joined.split(/\s+/).filter(Boolean);
  return words.slice(0, 35).join(" ");
}

export function scoreOpeningWindow(openingWindow: string): OpeningWindowSignals {
  const lower = openingWindow.toLowerCase();

  // ── Concrete comparison (scale/size/distance/quantity) ──────────────────
  // Universal: any sentence that creates a visual by comparing scale.
  // Detected by structural patterns: "would disappear", "could fit",
  // "so [adj] that", "[subject] would [action]", etc.
  const hasConcreteComparison =
    /\bcould (disappear|fit|vanish|be buried|be swallowed|be hidden|be submerged)\b/i.test(openingWindow) ||
    /\bwould (disappear|fit|vanish|be hidden|still have|be buried)\b/i.test(openingWindow) ||
    /\bso (deep|tall|fast|slow|large|small|heavy|wide|far|long|short|hot|cold|dense|strong|weak)\b.{2,40}\bthat\b/i.test(openingWindow) ||
    /\b(more than|over|above|below|under|nearly|almost) (a mile|a kilometer|a foot|a meter|a year|a century|a billion|a million|a thousand)\b/i.test(openingWindow) ||
    /\b\w+ would (jump|reach|travel|move|fall|rise|grow|cover|span|stretch|sink)\b/i.test(openingWindow);

  // ── Causal consequence (something causes or reveals something else) ──────
  // Universal: "but [something unexpected]", "and it [verb consequence]"
  const hasCausalConsequence =
    /\b(but|however|yet)\b.{3,60}\b(would|could|can|will|does|is|was|disappeared|vanished|killed|destroyed|changed)\b/i.test(openingWindow) ||
    /\bif .{3,40}, (it|they|everything|the|your|that)\b/i.test(openingWindow) ||
    /\b(what happens|what would happen|the result|as a result|which means)\b/i.test(openingWindow);

  // ── Setup + reveal structure (line 1 = calm/normal, line 2 = contrast) ──
  // Universal: the window starts with an observation then contradicts it.
  const hasSetupReveal =
    (hasCausalConsequence || hasConcreteComparison) &&
    (lower.includes("but") || lower.includes("however") || lower.includes("yet") ||
     lower.includes("if ") || lower.includes("would") || lower.includes("could"));

  // ── Numeric detail ───────────────────────────────────────────────────────
  const hasNumericDetail =
    /\d/.test(openingWindow) &&
    /\b(percent|%|mile|foot|feet|meter|second|minute|hour|day|year|degree|kg|km|mph|kph|billion|million|thousand|\$)\b/i.test(lower);

  // ── Scenario opener ──────────────────────────────────────────────────────
  const hasScenarioOpener =
    /^(imagine|what if|picture this)\b/i.test(lower);

  // ── Scenario stakes: does the scenario have consequence/mystery? ─────────
  // A scenario opener alone is weak. It needs something to care about.
  const scenarioHasStakes =
    hasScenarioOpener && (
      hasCausalConsequence ||
      hasConcreteComparison ||
      hasNumericDetail ||
      // specific unresolved consequence or mystery after scenario
      /\b(terrifying|strange|impossible|wrong|wrong|dark|silent|gone|dead|broken|failed|changed|disappeared|nobody|no one|lost|destroyed)\b/i.test(lower)
    );

  // ── Window strength score ────────────────────────────────────────────────
  let windowStrength = 0;
  if (hasConcreteComparison) windowStrength += 30;
  if (hasCausalConsequence) windowStrength += 25;
  if (hasSetupReveal) windowStrength += 20;
  if (hasNumericDetail) windowStrength += 20;
  if (hasScenarioOpener && scenarioHasStakes) windowStrength += 15;
  else if (hasScenarioOpener && !scenarioHasStakes) windowStrength += 5;
  windowStrength = Math.min(windowStrength, 100);

  return {
    hasSetupReveal,
    hasConcreteComparison,
    hasCausalConsequence,
    hasNumericDetail,
    hasScenarioOpener,
    scenarioHasStakes,
    windowStrength,
  };
}

export interface UniversalSignals {
  curiosityScore: number;
  contrastScore: number;
  stakesScore: number;
  specificityScore: number;
  openLoopScore: number;
  payoffScore: number;
  clarityScore: number;
  escalationScore: number;
  consequenceScore: number;
  genericPenalty: number;
}

export function extractUniversalSignals(text: string): UniversalSignals {
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // ── Curiosity score ────────────────────────────────────────────────────────
  let curiosityScore = 0;
  const curiosityPhrases = [
    "what if", "did you know", "have you ever", "what really",
    "the real reason", "nobody knows", "no one knows",
    "still a mystery", "unsolved", "turns out", "the truth about",
    "most people don't", "most people do not", "disappeared", "vanished",
    "secret", "hidden", "what no one", "but the real",
  ];
  for (const p of curiosityPhrases) {
    if (lower.includes(p)) curiosityScore += 14;
  }
  if (text.includes("?")) curiosityScore += 10;
  curiosityScore = Math.min(curiosityScore, 100);

  // ── Contrast score ─────────────────────────────────────────────────────────
  let contrastScore = 0;
  const contrastPhrases = [
    " but ", "however", "not what", "most creators think",
    "most people think", "everyone thinks", "you probably think",
    "the problem is", "the real problem", "actually", "in reality",
    "it is not", "it's not", "not really", "does not", "doesn't",
    "at first", "turns out", "instead",
  ];
  for (const p of contrastPhrases) {
    if (lower.includes(p)) contrastScore += 12;
  }
  contrastScore = Math.min(contrastScore, 100);

  // ── Stakes score ───────────────────────────────────────────────────────────
  let stakesScore = 0;
  const stakesPhrases = [
    "lost", "destroyed", "cost", "danger", "changed", "forever",
    "collapse", "killed", "losing", "darker", "disappeared", "vanished",
    "impossible", "risk", "fail", "failure", "ruined", "dead", "died",
    "never recovered", "permanent", "consequences", "price",
  ];
  for (const p of stakesPhrases) {
    if (lower.includes(p)) stakesScore += 10;
  }
  // Emotional story stakes — human relationship + transformation signals
  const emotionalStakePhrases = [
    "cried", "crying", "tears", "sobbed", "broke down",
    "struggled", "starving", "hungry", "hardship", "poor",
    "never forgot", "changed her life", "changed his life", "changed their life",
    "years later", "after becoming", "kindness", "helped him", "helped her",
    "believed in him", "believed in her",
  ];
  for (const p of emotionalStakePhrases) {
    if (lower.includes(p)) stakesScore += 8;
  }
  stakesScore = Math.min(stakesScore, 100);

  // ── Specificity score ──────────────────────────────────────────────────────
  let specificityScore = 0;
  // Numbers
  const numberMatches = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  specificityScore += Math.min(numberMatches.length * 10, 30);
  // Units
  if (/\b(inch(?:es)?|feet|miles|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|kilograms|pounds|degrees|billion|million|thousand)\b/i.test(text)) {
    specificityScore += 20;
  }
  // Named entities
  if (/\b[A-Z][a-z]{2,}\b/.test(text)) specificityScore += 10;
  // Dollar amounts
  if (/\$\d/.test(text)) specificityScore += 15;
  specificityScore = Math.min(specificityScore, 100);

  // ── Open loop score ────────────────────────────────────────────────────────
  let openLoopScore = 0;
  const openLoopPhrases = [
    "but why", "the reason", "here is why", "here's why",
    "and that is", "and that's", "which means", "that means",
    "so what", "the question is", "the answer", "find out",
    "keep watching", "stay until", "before i explain",
  ];
  for (const p of openLoopPhrases) {
    if (lower.includes(p)) openLoopScore += 15;
  }
  if (text.includes("?")) openLoopScore += 10;
  openLoopScore = Math.min(openLoopScore, 100);

  // ── Payoff score ───────────────────────────────────────────────────────────
  let payoffScore = 0;
  const payoffPhrases = [
    "that is why", "that's why", "the result", "changed everything",
    "changed history", "never recovered", "to this day", "years later",
    "the aftermath", "what followed", "that decision", "it worked",
    "it failed", "turns out", "the answer", "the reason was",
    "it turned out", "turned out", "the truth was",
  ];
  for (const p of payoffPhrases) {
    if (lower.includes(p)) payoffScore += 14;
  }
  payoffScore = Math.min(payoffScore, 100);

  // ── Clarity score ──────────────────────────────────────────────────────────
  // Simple proxy: shorter sentences = clearer. Penalize very long word runs.
  let clarityScore = 60;
  if (wordCount > 0 && wordCount <= 80) clarityScore += 20;
  else if (wordCount > 120) clarityScore -= 15;
  const avgWordLength = text.replace(/\s+/g, "").length / Math.max(wordCount, 1);
  if (avgWordLength > 7) clarityScore -= 10;
  clarityScore = Math.min(Math.max(clarityScore, 0), 100);

  // ── Escalation score ───────────────────────────────────────────────────────
  let escalationScore = 0;
  const escalationPhrases = [
    "now imagine", "but then", "and then", "suddenly", "until",
    "and that is when", "then they found", "something was off",
    "one detail", "except", "but it gets", "it gets worse",
    "what followed", "and it gets",
  ];
  for (const p of escalationPhrases) {
    if (lower.includes(p)) escalationScore += 16;
  }
  escalationScore = Math.min(escalationScore, 100);

  // ── Consequence score ──────────────────────────────────────────────────────
  // Universal consequence signals — behavioral, causal, identity, or temporal outcomes.
  // No topic-specific phrases (no "brain", "online", "symbol", "shapes the next").
  let consequenceScore = 0;
  const consequencePhrases = [
    // behavioral outcome (universal)
    "trains your", "training your", "rewires", "builds the habit",
    // control / permanence (universal)
    "you do not control", "you lose control", "become permanent", "once it becomes",
    // continuation / unstoppable force (universal — any subject)
    "keeps going", "keeps moving", "keeps building", "keeps compounding",
    // causal wrap-up (universal)
    "that is why", "that is what makes", "that is what changes",
    // identity / social consequence (universal)
    "says about you", "says something about", "how people see", "proof that you",
    "what you become", "version of you",
    // temporal consequence (universal)
    "by the time", "too late", "before it starts", "shapes what comes next",
    // mechanism outcome (universal)
    "change how", "changes how", "changes what", "changes who",
    // stakes / loss (universal)
    "one moment can", "one decision can", "cost you",
  ];
  for (const p of consequencePhrases) {
    if (lower.includes(p)) consequenceScore += 14;
  }
  consequenceScore = Math.min(consequenceScore, 100);

  // ── Generic penalty — structural, not vocabulary-based ───────────────────
  // Instead of matching a phrase list, we score each sentence structurally:
  // abstract lines (broad claims, no grounding) raise the penalty,
  // concrete lines (numbers, events, causal structure) lower it.
  // This generalizes to any topic without needing to add new phrases.
  let genericPenalty = 0;

  const scriptSentences = text
    .split(/[.!?]/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).filter(Boolean).length >= 3);

  if (scriptSentences.length >= 2) {
    let abstractCount = 0;
    let concreteCount = 0;

    for (const sentence of scriptSentences) {
      const sl = sentence.toLowerCase();
      const sw = sl.split(/\s+/).filter(Boolean);

      // ── Concrete signals (structural, not vocabulary) ────────────────────
      const sentHasNumber = /\d/.test(sentence);
      const sentHasUnit = /\b(percent|%|mile|foot|feet|meter|second|minute|hour|day|week|year|degree|kg|km|mph|kph|billion|million|thousand|dollar|\$)\b/i.test(sl);
      const sentHasMidCapital = /[a-z,]\s+[A-Z][a-z]{2,}/.test(sentence);
      // Past-tense morphology: regular -ed verbs OR irregular past tense (closed class)
      const sentHasEvent =
        /\b\w+ed\b/.test(sl) ||
        /\b(found|lost|went|came|got|gave|took|made|saw|ran|fell|grew|flew|broke|drove|woke|won|built|caught|said|sent|spoke|stood|wrote|heard|kept|knew|left|met|paid|read|told|threw|thought)\b/i.test(sl);
      // Causal connectors (small, universal, grammar-level)
      const sentHasCausal = /\b(because|therefore|as a result|which means|that means|which caused|led to|resulted in|due to|consequently)\b/i.test(sl);
      // Contrast connectors (small, universal)
      const sentHasContrast = /\b(but|however|instead|yet|although|though|while|whereas|despite|even though)\b/i.test(sl);

      const isConcrete = sentHasNumber || sentHasUnit || sentHasMidCapital || sentHasEvent || sentHasCausal;

      // ── Abstract signals (structural patterns, not topic vocabulary) ─────
      // "X is [evaluative adjective]" with no grounding
      const isAbstractClaim =
        /^[a-z\s]+ (is|are|was|were) (very |extremely |really |so |quite )?(important|key|essential|crucial|critical|necessary|needed|useful|possible|impossible|hard|easy|powerful|valuable|effective|amazing|real|true|good|bad|great|terrible|wrong|right|different|better|worse|best|worst|enough)\.?$/i.test(sl);

      // Broad universal generalization with no example
      const isGeneralization =
        /^(many|most|all|everyone|everybody|people|nobody|no one|anyone|we|they|you) (want|need|think|believe|know|feel|can|should|must|have to|will|do|are|were|is|was)\b/i.test(sl) &&
        !isConcrete;

      // Generic imperative advice
      const isGenericAdvice =
        /^(you|we) (should|must|need to|have to|can|could|try to|want to) [a-z]/i.test(sl) &&
        !isConcrete;

      // Very short with no grounding (motivational fragment).
      // Exception: short parallel fragments that follow a scenario/scene-setting opener
      // (e.g. "No cars. No planes.") — these are cinematic buildup, not generic filler.
      // Detect: line starts with "no ", "not ", or a negation that describes a scene.
      const isCinematicNegation = /^(no |not a |not one |without |no one |nobody )/i.test(sl);
      const isShortFragment = sw.length <= 6 && !isConcrete && !sentHasContrast && !isCinematicNegation;

      const isAbstract = !isConcrete && (isAbstractClaim || isGeneralization || isGenericAdvice || isShortFragment);

      // Cinematic negation lines ("No cars.", "No planes.") are scene-builders,
      // not generic filler — count them as concrete to prevent false generic penalty.
      if (isConcrete || isCinematicNegation) concreteCount++;
      else if (isAbstract) abstractCount++;
    }

    const totalSentences = scriptSentences.length;
    const abstractRatio = abstractCount / totalSentences;
    const concreteRatio = concreteCount / totalSentences;

    // Scale penalty by how abstract the script is relative to how concrete it is
    if (concreteCount === 0 && abstractRatio >= 0.7) {
      genericPenalty = 55; // fully abstract, no grounding at all
    } else if (concreteCount === 0 && abstractRatio >= 0.5) {
      genericPenalty = 42;
    } else if (concreteRatio < 0.15 && abstractRatio >= 0.6) {
      genericPenalty = 35;
    } else if (concreteRatio < 0.25 && abstractRatio >= 0.5) {
      genericPenalty = 22;
    } else if (concreteRatio >= 0.3) {
      genericPenalty = 0; // script has real grounding — no penalty
    }

    // Reduce if strong contrast or specificity is already detected
    if (specificityScore >= 30) genericPenalty = Math.max(0, genericPenalty - 15);
    else if (specificityScore >= 15) genericPenalty = Math.max(0, genericPenalty - 8);
    if (contrastScore >= 30) genericPenalty = Math.max(0, genericPenalty - 10);
  }

  genericPenalty = Math.min(genericPenalty, 65);

  return {
    curiosityScore,
    contrastScore,
    stakesScore,
    specificityScore,
    openLoopScore,
    payoffScore,
    clarityScore,
    escalationScore,
    consequenceScore,
    genericPenalty,
  };
}

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

export function calculateRetentionStructure(
  lines: string[],
  signals: UniversalSignals,
  structures?: ScriptStructures
): number {
  let risk = 42;

  const totalLines = lines.length;
  if (totalLines === 0) return 85;

  const fullText = lines.join(" ").toLowerCase();
  const charCount = fullText.length;

  // ── Positive reductions ────────────────────────────────────────────────────
  if (signals.curiosityScore >= 40) risk -= 7;
  else if (signals.curiosityScore >= 20) risk -= 4;

  if (signals.contrastScore >= 40) risk -= 6;
  else if (signals.contrastScore >= 20) risk -= 4;

  if (signals.openLoopScore >= 40) risk -= 7;
  else if (signals.openLoopScore >= 15) risk -= 4;

  if (signals.payoffScore >= 40) risk -= 6;
  else if (signals.payoffScore >= 15) risk -= 3;

  if (signals.consequenceScore >= 30) risk -= 5;
  else if (signals.consequenceScore >= 15) risk -= 2;

  if (signals.escalationScore >= 30) risk -= 5;
  else if (signals.escalationScore >= 15) risk -= 2;

  if (signals.stakesScore >= 30) risk -= 4;
  else if (signals.stakesScore >= 15) risk -= 2;

  if (signals.specificityScore >= 35) risk -= 4;
  else if (signals.specificityScore >= 18) risk -= 2;

  if (charCount >= 200 && charCount <= 750) risk -= 3;

  // ── Structure-based reductions (universal, not niche-specific) ─────────────
  if (structures) {
    // List buildup is a valid escalation structure — reduces risk meaningfully
    if (structures.hasListBuildup) risk -= 9;

    // Mystery clue buildup counts as structured escalation
    if (structures.hasMysteryClueBuildup) risk -= 8;

    // Contradiction/reversal structure is a strong retention signal
    if (structures.hasContradictionReversal) risk -= 7;

    // Consequence payoff in last third means the script has a destination
    if (structures.hasConsequencePayoff) risk -= 6;

    // Numeric premise + mechanism = structured explanation, not random info
    if (structures.hasNumericPremise) risk -= 5;

    // Explanation chain (premise → mechanism → consequence) = valid retention structure
    if (structures.hasExplanationChain) risk -= 7;

   // Narrative arc (setup → turn → consequence) = universal story structure
    if (structures.hasNarrativeArc) risk -= 8;
    if (structures.hasNarrativeArc && structures.narrativeArcIsEarly) risk -= 4;

    // Four narrow universal narrative structures
    if (structures.hasPersistenceArc) risk -= 8;
    if (structures.hasCapabilityViolation) risk -= 8;
    if (structures.hasAnomalySequence) risk -= 8;
    if (structures.hasConsequenceProgression) risk -= 8;
  }

  // ── Existing narrative structure bonuses ──────────────────────────────────
  const hasAtFirstBut =
    fullText.includes("at first") && (fullText.includes(" but ") || fullText.includes("however"));
  if (hasAtFirstBut) risk -= 5;

  const hasMostPeopleReversal =
    (fullText.includes("most people think") || fullText.includes("most creators think")) &&
    (fullText.includes(" but ") || fullText.includes("however") || fullText.includes("actually"));
  if (hasMostPeopleReversal) risk -= 5;

  // Universal mystery/reveal escalation: any clue-then-contrast sequence
  const hasMysterySequence =
    (fullText.includes("one detail") || fullText.includes("did not fit") ||
     fullText.includes("something was") || fullText.includes("something seemed") ||
     fullText.includes("nobody knew") || fullText.includes("no one knew") ||
     fullText.includes("then they found") || fullText.includes("then it turned out")) &&
    (fullText.includes("but") || fullText.includes("suddenly") || fullText.includes("until"));
  if (hasMysterySequence) risk -= 6;

  // Universal comparison escalation: any "but still X" or "but harder/bigger/deeper"
  const hasComparisonEscalation =
    fullText.includes("but") && fullText.includes("still") &&
    (fullText.includes("harder") || fullText.includes("bigger") || fullText.includes("deeper") ||
     fullText.includes("further") || fullText.includes("more than") || fullText.includes("gap"));
  if (hasComparisonEscalation) risk -= 4;

  // Universal soft consequence: any identity/social/behavioral implication at end
  const hasSoftConsequence =
    /that might be enough|proof that (you|it|they)|says (about|something) (you|them)/.test(fullText) ||
    /how (everyone|people|others) (see|look|judge)|version of (you|them|it)/.test(fullText) ||
    /much (harder|bigger|deeper|stranger|darker) (to|than)/.test(fullText) ||
    /competing with (a |the )?(symbol|status|identity|idea|concept)/.test(fullText);
  if (hasSoftConsequence) risk -= 4;

  // ── Flat middle penalty — ONLY fires when structure detection says it's flat ─
  if (totalLines >= 5) {
    const midStart = Math.floor(totalLines * 0.33);
    const midEnd = Math.floor(totalLines * 0.66);
    const middleText = lines.slice(midStart, midEnd).join(" ").toLowerCase();

    const middleHasSignal = [
      "but", "however", "then", "suddenly", "except", "actually",
      "the problem", "real problem", "if it", "that is why", "result",
      "at first", "one detail", "the scary part", "the truth",
    ].some(p => middleText.includes(p));

    // Only penalize if structure detection also says escalation is weak
    const structureIsFlat = !structures ||
      (structures.escalationQuality === "flat" || structures.escalationQuality === "none");

    if (!middleHasSignal && structureIsFlat) risk += 7;
  }

  if (signals.openLoopScore === 0) risk += 8;
  if (signals.payoffScore === 0 && signals.consequenceScore === 0) risk += 10;
  if (signals.contrastScore === 0) risk += 6;
  if (signals.curiosityScore === 0) risk += 6;
  if (signals.specificityScore === 0) risk += 5;

  const fluffPhrases = [
    "basically", "as you can see", "i just want to", "this is very important",
    "i'm going to explain", "really important", "just to summarize",
  ];
  const fluffHits = fluffPhrases.filter(p => fullText.includes(p)).length;
  risk += fluffHits * 7;

  if (charCount < 180) risk += 10;
  if (charCount > 850) risk += 8;

 if (signals.genericPenalty >= 42) risk += 30;
  else if (signals.genericPenalty >= 28) risk += 22;
  else if (signals.genericPenalty >= 20) risk += 15;
  else if (signals.genericPenalty >= 12) risk += 8;
  else if (signals.genericPenalty >= 6) risk += 3;

  // ── Dynamic floor ─────────────────────────────────────────────────────────
  const positiveSignalCount = [
    signals.curiosityScore >= 20,
    signals.contrastScore >= 20,
    signals.openLoopScore >= 15,
    signals.payoffScore >= 15,
    signals.escalationScore >= 15,
    signals.specificityScore >= 18,
    signals.stakesScore >= 15,
    signals.consequenceScore >= 15,
  ].filter(Boolean).length;

  const narrativeBonusCount = [
    hasAtFirstBut, hasMostPeopleReversal, hasMysterySequence,
    hasComparisonEscalation, hasSoftConsequence,
    structures?.hasListBuildup ?? false,
    structures?.hasMysteryClueBuildup ?? false,
    structures?.hasContradictionReversal ?? false,
    structures?.hasConsequencePayoff ?? false,
    structures?.hasNarrativeArc ?? false,
    structures?.hasPersistenceArc ?? false,
    structures?.hasCapabilityViolation ?? false,
    structures?.hasAnomalySequence ?? false,
    structures?.hasConsequenceProgression ?? false,
  ].filter(Boolean).length;

  const combinedStrength = positiveSignalCount + narrativeBonusCount;

  const floor = combinedStrength >= 9 ? 18
    : combinedStrength >= 7 ? 22
    : combinedStrength >= 6 ? 25
    : combinedStrength >= 5 ? 28
    : combinedStrength >= 4 ? 32
    : combinedStrength >= 3 ? 35
    : 38;

  return Math.min(100, Math.max(floor, Math.round(risk)));
}

export function calculatePayoffStrength(
  lines: string[],
  signals: UniversalSignals
): number {
  let strength = 25;

  const lastThird = lines.slice(Math.floor(lines.length * 0.6)).join(" ").toLowerCase();
  const fullText = lines.join(" ").toLowerCase();
  const anomaly = detectAnomalySequence(lines);

  // Strong explicit payoff phrases in the last third
  const payoffPhrases = [
    "that's why", "the result", "changed everything", "changed history",
    "never recovered", "years later", "lost their lives",
    "ended forever", "the aftermath", "what followed",
    "that decision", "it worked", "it failed",
  ];
  const payoffHits = payoffPhrases.filter(p => lastThird.includes(p)).length;
  strength += payoffHits * 14;

  // Unresolved-mystery language is rewarding only when the script contains
  // a concrete anomaly and evidence, not merely a vague mystery claim.
  const mysteryPayoffPhrases = [
    "to this day", "still remains", "was never found", "were never found",
    "never explained", "remains a mystery", "no one ever found",
    "nobody ever found", "no one knows", "nobody knows",
  ];
  const mysteryPayoffHits = anomaly.has
    ? mysteryPayoffPhrases.filter((phrase) => lastThird.includes(phrase)).length
    : 0;
  strength += mysteryPayoffHits * 14;

  // Resolution phrases
  const resolutionPhrases = [
    "that is why", "that's why", "here's what happened", "the answer",
    "the reason", "it turned out", "turned out", "the truth was",
  ];
  const resolutionHits = resolutionPhrases.filter(p => lastThird.includes(p)).length;
  strength += resolutionHits * 10;

  // Weak payoff phrases
  const weakPayoffPhrases = [
    "entire result", "can change", "that is why one", "viewers stay longer",
    "one stronger",
  ];
  const weakPayoffHits = weakPayoffPhrases.filter(p => lastThird.includes(p)).length;
  strength += weakPayoffHits * 5;

  // ── Universal narrative / consequence / transformation endings ────────────
  // Detected via structural pattern, not topic-specific phrases.
  // Works for mystery, science, business, sports, psychology, or any niche.
  let narrativePayoffScore = 0;

  // Quantified outcomes and extreme-state transformations are resolved payoffs.
  if (hasStrongOutcomePayoff(lastThird)) narrativePayoffScore += 13;

  // Sudden reveal / transformation (universal)
  if (/suddenly (became|turned|changed|revealed|showed)/.test(lastThird)) narrativePayoffScore += 13;
  // "much [adjective] than" — any comparative escalation at end
  if (/much (harder|bigger|deeper|stranger|darker|worse|better|more) (to|than|for)/.test(lastThird)) narrativePayoffScore += 13;
  // Identity / social consequence (universal subject)
  if (/proof that (you|it|they|this)|says (about|something about) (you|them|it)/.test(lastThird)) narrativePayoffScore += 13;
  if (/how (everyone|people|others) (see|look|view|judge)/.test(lastThird)) narrativePayoffScore += 13;
  // Mystery resolution requires a concrete anomaly elsewhere in the script.
  if (
    anomaly.has &&
    /(was|were|has been|have been) never (found|solved|explained|identified|recovered)/.test(lastThird)
  ) {
    narrativePayoffScore += 13;
  }
  if (
    anomaly.has &&
    /(the case|the investigation|the inquiry) (remains|is still|has never)/.test(lastThird)
  ) {
    narrativePayoffScore += 10;
  }
  // Consequence threshold / "might be enough" (universal)
  if (/that might be enough|might be enough to|just enough to/.test(lastThird)) narrativePayoffScore += 13;
  // Competing with / surpassing a concept (universal)
  if (/competing with (a |the )?(symbol|concept|idea|status|identity|image)/.test(lastThird)) narrativePayoffScore += 13;
  // Personal version / transformation (universal)
  if (/version of (you|them|it|this)|change (how|who|what) (you|they|everyone|people)/.test(lastThird)) narrativePayoffScore += 13;
  // General transformation ending (universal)
  if (/(changes|changed) (everything|the whole|how|what|who)/.test(lastThird)) narrativePayoffScore += 10;
  // Explanation-chain conclusion (universal — any topic)
  if (/that is (why|what makes|how|the reason)/.test(lastThird) && !/that is why one/.test(lastThird)) narrativePayoffScore += 10;

  strength += Math.min(narrativePayoffScore, 26); // cap so one script can't double-dip

  // Numeric specificity in ending
  if (/\d/.test(lastThird)) strength += 8;

  // Consequence present
  if (signals.consequenceScore >= 20) strength += 10;
  else if (signals.consequenceScore >= 8) strength += 5;

  // Escalation support
  if (signals.escalationScore >= 20) strength += 6;

  // Stakes support
  if (signals.stakesScore >= 20) strength += 5;

  // Weak ending penalty
  const weakEndingPhrases = [
    "let me know", "comment below", "what do you think", "share this",
    "follow for more", "like and subscribe", "stay tuned",
  ];
  const weakEndingHits = weakEndingPhrases.filter(p => fullText.includes(p)).length;
  strength -= weakEndingHits * 8;

  // No resolution at all
  if (
    payoffHits === 0 && mysteryPayoffHits === 0 && resolutionHits === 0 &&
    weakPayoffHits === 0 && narrativePayoffScore === 0 &&
    signals.consequenceScore === 0
  ) {
    strength -= 14;
  }

if (signals.genericPenalty >= 42) strength -= 22;
  else if (signals.genericPenalty >= 28) strength -= 16;
  else if (signals.genericPenalty >= 20) strength -= 12;
  else if (signals.genericPenalty >= 10) strength -= 6;

  return Math.min(100, Math.max(0, Math.round(strength)));
}
