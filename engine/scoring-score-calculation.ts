import {
  calculatePayoffStrength,
  calculateRetentionStructure,
  extractOpeningWindow,
  extractUniversalSignals,
  scoreOpeningWindow,
  type UniversalSignals,
} from "./scoring-evaluation";
import { calculateHookStrength } from "./scoring-hook-evaluation";
import { calibrateScoringScores } from "./scoring-calibration";
import { clampScore } from "./scoring-result-helpers";
import {
  detectScriptType,
  normalizeAutoCaptionScript,
} from "./scoring-script-feedback";
import {
  detectScriptStructures,
  type ScriptStructures,
} from "./scoring-structures";
import { createScriptLines } from "./scoring-timing";

type ScriptType = ReturnType<typeof detectScriptType>;

export type ScoringCalculationState = {
  scriptType: ScriptType;
  normalizedText: string;
  normalizedLines: string[];
  firstSentence: string;
  signals: UniversalSignals;
  structures: ScriptStructures;
  openingWindowSignals: ReturnType<typeof scoreOpeningWindow>;
  hasStructuredEscalation: boolean;
  hookScore: number;
  payoffStrength: number;
  retentionRisk: number;
  charCount: number;
  isVeryShort: boolean;
  isStructurallyCompleteShort: boolean;
  effectiveHookScore: number;
  hookNeedsWork: boolean;
  hookIsAcceptable: boolean;
  calibratedHookScore: number;
  overallScore: number;
};

// Pure score preparation used before feedback and fix generation.
export function calculateScoringState(
  text: string,
  lines: string[],
): ScoringCalculationState {
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

  const calibratedScores = calibrateScoringScores({
    scriptType,
    firstSentence,
    normalizedText,
    text,
    displayHookScore,
    overallScore,
    retentionRisk,
    signals,
  });

  const calibratedHookScore =
    calibratedScores.calibratedHookScore;

  overallScore = calibratedScores.overallScore;
  retentionRisk = calibratedScores.retentionRisk;

  return {
    scriptType,
    normalizedText,
    normalizedLines,
    firstSentence,
    signals,
    structures,
    openingWindowSignals,
    hasStructuredEscalation,
    hookScore,
    payoffStrength,
    retentionRisk,
    charCount,
    isVeryShort,
    isStructurallyCompleteShort,
    effectiveHookScore,
    hookNeedsWork,
    hookIsAcceptable,
    calibratedHookScore,
    overallScore,
  };
}
