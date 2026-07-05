import type { UniversalSignals } from "./scoring-evaluation";
import type { ScriptStructures } from "./scoring-structures";

// Pure retention-risk calculation.
// Keep signal extraction, hook scoring, and payoff evaluation in their own modules.

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
