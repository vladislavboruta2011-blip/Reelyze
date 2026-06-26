import type {
  AnalysisV2HookDecision,
  AnalysisV2Result,
  AnalysisV2ScriptType,
  AnalysisV2SuccessResponse,
  AnalysisV2Verdict,
} from "./analysis-v2-schema";
import { validateAnalysisV2Result } from "./analysis-v2-validation";

export const ANALYSIS_V2_STORAGE_KEY = "reelyze-analysis-v2";

export type AnalysisV2UiScoreData = {
  score: number;
  label: string;
  color: string;
  ringColor: string;
  description: string;
};

export type AnalysisV2UiRiskyPart = {
  time: string;
  title: string;
  description: string;
};

export type AnalysisV2UiSceneSegment = {
  label: string;
  color: string;
  width: number;
};

export type AnalysisV2UiResult = {
  overall: AnalysisV2UiScoreData;
  hook: AnalysisV2UiScoreData;
  risk: AnalysisV2UiScoreData;
  riskyParts: AnalysisV2UiRiskyPart[];
  fixes: string[];
  riskyLineIndexes: number[];
  warningLineIndexes: number[];
  sceneSegments: AnalysisV2UiSceneSegment[];
  mainTakeaway: string;
  hookAssessment: string;
  hookDecision: AnalysisV2HookDecision;
  suggestedHook: string;
  scriptType: AnalysisV2ScriptType;
  verdict: AnalysisV2Verdict;
  modelUsed: string;
};

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function isAnalysisV2SuccessResponse(
  value: unknown,
  script: string
): value is AnalysisV2SuccessResponse {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    value.status !== "ok" ||
    typeof value.modelUsed !== "string" ||
    value.modelUsed.trim().length === 0
  ) {
    return false;
  }

  const validation = validateAnalysisV2Result(
    value.result,
    script
  );

  return validation.ok;
}

export function parseStoredAnalysisV2(
  raw: string,
  script: string
): AnalysisV2SuccessResponse | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return isAnalysisV2SuccessResponse(parsed, script)
    ? parsed
    : null;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getOverallLabel(
  score: number,
  verdict: AnalysisV2Verdict
): string {
  if (verdict === "strong") {
    return score >= 85 ? "Very Strong" : "Strong";
  }

  if (verdict === "mixed") {
    return "Mixed";
  }

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

function getPositiveScoreColor(score: number): string {
  if (score >= 75) return "#22C55E";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

function getOverallColor(
  verdict: AnalysisV2Verdict
): string {
  if (verdict === "strong") return "#22C55E";
  if (verdict === "mixed") return "#F59E0B";
  return "#EF4444";
}

function getRiskColor(score: number): string {
  if (score >= 65) return "#EF4444";
  if (score >= 45) return "#F59E0B";
  return "#22C55E";
}

function getRiskDescription(result: AnalysisV2Result): string {
  const firstRisk = result.riskyParts[0];

  if (firstRisk) {
    return firstRisk.reason;
  }

  if (result.scores.retentionRisk <= 25) {
    return "Low retention risk. The script stays focused and maintains a clear progression.";
  }

  if (result.scores.retentionRisk <= 45) {
    return "The script is structurally sound, with only minor opportunities to tighten the pacing.";
  }

  if (result.scores.retentionRisk <= 64) {
    return "Some sections may lose attention before the script reaches its payoff.";
  }

  return "High retention risk. Important sections need stronger pacing, specificity, or escalation.";
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function createExcerptTimeRange(
  script: string,
  excerpt: string,
  duration: number
): string {
  const startIndex = script.indexOf(excerpt);
  const safeDuration = Math.max(1, duration);

  if (startIndex < 0 || script.length === 0) {
    return `0:00–${formatTime(safeDuration)}`;
  }

  const endIndex = startIndex + excerpt.length;
  const startSeconds =
    (startIndex / script.length) * safeDuration;
  const endSeconds =
    (endIndex / script.length) * safeDuration;

  return `${formatTime(startSeconds)}–${formatTime(
    Math.max(startSeconds + 1, endSeconds)
  )}`;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function findExcerptLineIndexes(
  scriptLines: string[],
  excerpt: string
): number[] {
  const normalizedExcerpt = normalizeText(excerpt);

  if (!normalizedExcerpt) {
    return [];
  }

  const normalizedLines = scriptLines.map(normalizeText);
  const joined = normalizedLines.join(" ");
  const excerptStart = joined.indexOf(normalizedExcerpt);

  if (excerptStart < 0) {
    return normalizedLines
      .map((line, index) => {
        const overlaps =
          line.includes(normalizedExcerpt) ||
          normalizedExcerpt.includes(line);

        return overlaps ? index : -1;
      })
      .filter((index) => index >= 0);
  }

  const excerptEnd =
    excerptStart + normalizedExcerpt.length;
  const indexes: number[] = [];
  let cursor = 0;

  normalizedLines.forEach((line, index) => {
    const lineStart = cursor;
    const lineEnd = lineStart + line.length;

    if (
      excerptStart < lineEnd &&
      excerptEnd > lineStart
    ) {
      indexes.push(index);
    }

    cursor = lineEnd + 1;
  });

  return indexes;
}

function uniqueSortedIndexes(indexes: number[]): number[] {
  return [...new Set(indexes)].sort(
    (left, right) => left - right
  );
}

function getRiskTitle(
  severity: "low" | "medium" | "high"
): string {
  if (severity === "high") {
    return "High-risk section.";
  }

  if (severity === "medium") {
    return "Potential drop-off point.";
  }

  return "Minor retention risk.";
}

function getSceneColor(
  status: "strong" | "average" | "risky"
): string {
  if (status === "strong") return "#22C55E";
  if (status === "average") return "#F59E0B";
  return "#EF4444";
}

function createSceneSegments(
  result: AnalysisV2Result
): AnalysisV2UiSceneSegment[] {
  const totalWidth = 1110;
  const weights = result.scenes.map((scene) =>
    Math.max(1, normalizeText(scene.excerpt).length)
  );
  const totalWeight = weights.reduce(
    (sum, weight) => sum + weight,
    0
  );

  let assignedWidth = 0;

  return result.scenes.map((scene, index) => {
    const isLast = index === result.scenes.length - 1;
    const width = isLast
      ? totalWidth - assignedWidth
      : Math.max(
          1,
          Math.round(
            (weights[index] / totalWeight) * totalWidth
          )
        );

    assignedWidth += width;

    return {
      label: scene.label,
      color: getSceneColor(scene.status),
      width,
    };
  });
}

export function adaptAnalysisV2ForResults(
  response: AnalysisV2SuccessResponse,
  script: string,
  scriptLines: string[],
  estimatedDuration: number
): AnalysisV2UiResult {
  const result = response.result;
  const overallScore = clampScore(result.scores.overall);
  const hookScore = clampScore(result.scores.hook);
  const retentionRisk = clampScore(
    result.scores.retentionRisk
  );

  const riskyLineIndexes: number[] = [];
  const warningLineIndexes: number[] = [];

  result.riskyParts.forEach((part) => {
    const indexes = findExcerptLineIndexes(
      scriptLines,
      part.excerpt
    );

    if (part.severity === "low") {
      warningLineIndexes.push(...indexes);
    } else {
      riskyLineIndexes.push(...indexes);
    }
  });

  const uniqueRiskyLineIndexes =
    uniqueSortedIndexes(riskyLineIndexes);
  const riskySet = new Set(uniqueRiskyLineIndexes);

  const uniqueWarningLineIndexes = uniqueSortedIndexes(
    warningLineIndexes
  ).filter((index) => !riskySet.has(index));

  const overallColor =
    getOverallColor(result.verdict);
  const hookColor = getPositiveScoreColor(hookScore);
  const riskColor = getRiskColor(retentionRisk);

  return {
    overall: {
      score: overallScore,
      label: getOverallLabel(
        overallScore,
        result.verdict
      ),
      color: overallColor,
      ringColor: overallColor,
      description: result.mainTakeaway,
    },
    hook: {
      score: hookScore,
      label: getHookLabel(hookScore),
      color: hookColor,
      ringColor: hookColor,
      description: result.hookAssessment,
    },
    risk: {
      score: retentionRisk,
      label: getRiskLabel(retentionRisk),
      color: riskColor,
      ringColor: riskColor,
      description: getRiskDescription(result),
    },
    riskyParts: result.riskyParts.map((part) => ({
      time: createExcerptTimeRange(
        script,
        part.excerpt,
        estimatedDuration
      ),
      title: getRiskTitle(part.severity),
      description: part.reason,
    })),
    fixes: result.suggestedFixes.map(
      (fix) => fix.suggestion
    ),
    riskyLineIndexes: uniqueRiskyLineIndexes,
    warningLineIndexes: uniqueWarningLineIndexes,
    sceneSegments: createSceneSegments(result),
    mainTakeaway: result.mainTakeaway,
    hookAssessment: result.hookAssessment,
    hookDecision: result.hookDecision,
    suggestedHook: result.suggestedHook ?? "",
    scriptType: result.scriptType,
    verdict: result.verdict,
    modelUsed: response.modelUsed,
  };
}
