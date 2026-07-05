export { createHookRewrite, getHookRewriteReason } from "./scoring-rewrite";

import { calculateScoringState } from "./scoring-score-calculation";
import { buildScoringFeedbackPipeline } from "./scoring-feedback-pipeline";
import { buildMainTakeaway } from "./scoring-main-takeaway";

export {
  createScriptLines,
  estimateDuration,
  formatTime,
} from "./scoring-timing";

import {
  createSceneSegments,
  getHookColor,
  getHookDescription,
  getHookLabel,
  getOverallLabel,
  getRiskColor,
  getRiskDescription,
  getRiskLabel,
  type AnalysisResult,
} from "./scoring-result-helpers";

export type {
  AnalysisResult,
  RiskyPart,
  SceneSegment,
  ScoreData,
} from "./scoring-result-helpers";

export {
  detectNarrativeArc,
  detectScriptStructures,
} from "./scoring-structures";

// Canonical pure scoring engine for the Results experience.
// Keep this file UI-free so production and regression tests use identical logic.

export function analyzeScript(
  script: string,
  duration: number,
  scriptLines: string[]
): AnalysisResult {
  const text = script.trim();
  const lines = scriptLines;
  const scoringState = calculateScoringState(text, lines);

  const {
    signals,
    structures,
    payoffStrength,
    retentionRisk,
    effectiveHookScore,
    calibratedHookScore,
    overallScore,
  } = scoringState;

  const {
    uniqueRiskyParts,
    uniqueFixes,
    uniqueRiskyIndexes,
    uniqueWarningIndexes,
  } = buildScoringFeedbackPipeline({
    text,
    lines,
    duration,
    scoringState,
  });

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
