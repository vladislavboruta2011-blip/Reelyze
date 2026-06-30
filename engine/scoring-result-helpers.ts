import type { ScriptStructures } from "./scoring-structures";

// Result contracts, score presentation metadata, and scene construction.
// Keep script evaluation, orchestration, and UI components outside this module.

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

export function createSceneSegments(
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

export function dedupeRiskyParts(parts: RiskyPart[]): RiskyPart[] {
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

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getOverallLabel(score: number): string {
  if (score >= 85) return "Very Strong";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Average";
  if (score >= 40) return "Needs Work";
  return "Weak";
}

export function getHookLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Good";
  if (score >= 55) return "Average";
  return "Weak";
}

export function getRiskLabel(score: number): string {
  if (score >= 65) return "High";
  if (score >= 45) return "Medium";
  if (score >= 26) return "Low-Medium";
  return "Low";
}

export function getHookColor(score: number): string {
  if (score >= 75) return "#22C55E";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

export function getRiskColor(score: number): string {
  if (score >= 65) return "#EF4444";
  if (score >= 45) return "#F59E0B";
  return "#22C55E";
}

export function getHookDescription(score: number, issues: string[], structures?: ScriptStructures): string {
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

export function getRiskDescription(score: number, issues: string[], structures?: ScriptStructures, genericPenalty?: number): string {
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
