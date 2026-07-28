import type { AnalysisScores, AnalysisVerdict } from "./types";
import {
  POOR_SCORE_BAND_MAX,
  STRONG_HOOK_MIN,
  STRONG_OVERALL_MIN,
  STRONG_STRUCTURE_MIN,
  WEAK_OVERALL_MAX,
} from "./constants";

function isPoorScore(score: number): boolean {
  return score <= POOR_SCORE_BAND_MAX;
}

// The single deterministic source of truth for verdict. A model-provided
// verdict is never trusted on its own — validate.ts always recomputes this
// from the scores and rejects any candidate whose stated verdict disagrees.
//
//   strong: overallScore >= 70 AND hookScore >= 55 AND structureScore >= 55
//   weak:   overallScore <= 39 OR at least 2 of {hook, momentum, structure}
//           are in the poor band (<= 39)
//   mixed:  otherwise
export function deriveAnalysisVerdict(scores: AnalysisScores): AnalysisVerdict {
  const { overallScore, hookScore, structureScore, momentumScore } = scores;

  if (
    overallScore >= STRONG_OVERALL_MIN &&
    hookScore >= STRONG_HOOK_MIN &&
    structureScore >= STRONG_STRUCTURE_MIN
  ) {
    return "strong";
  }

  const poorComponentCount = [hookScore, momentumScore, structureScore].filter(
    isPoorScore
  ).length;

  if (overallScore <= WEAK_OVERALL_MAX || poorComponentCount >= 2) {
    return "weak";
  }

  return "mixed";
}
