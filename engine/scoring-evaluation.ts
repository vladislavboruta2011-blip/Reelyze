// Pure universal signal extraction and score calculation.
// Keep orchestration, presentation labels, and UI concerns outside this module.

export {
  extractOpeningWindow,
  scoreOpeningWindow,
  type OpeningWindowSignals,
} from "./scoring-opening-window";

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
