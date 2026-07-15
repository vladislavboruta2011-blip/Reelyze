import {
  ANALYSIS_V2_HOOK_STRONG_THRESHOLD,
  type AnalysisV2HookDecision,
  type AnalysisV2Locale,
  type AnalysisV2Result,
  type AnalysisV2ScriptType,
  type AnalysisV2SuccessResponse,
  type AnalysisV2Verdict,
} from "./analysis-v2-schema";
import { validateAnalysisV2Result } from "./analysis-v2-validation";
import { dedupeFixes } from "./scoring-fixes";

export const ANALYSIS_V2_STORAGE_KEY = "reelyze-analysis-v2";

export type AnalysisV2UiScoreData = {
  score: number;
  label: string;
  color: string;
  ringColor: string;
  description: string;
};

export type AnalysisV2UiScoreBreakdownItem = {
  label: string;
  score: number;
  maxScore: number;
  description: string;
};

export type AnalysisV2UiScoreBreakdownGroup = {
  title: string;
  total: number;
  direction:
    | "higher-is-better"
    | "higher-is-riskier";
  items: AnalysisV2UiScoreBreakdownItem[];
};

export type AnalysisV2UiScoreBreakdown = {
  overall: AnalysisV2UiScoreBreakdownGroup;
  hook: AnalysisV2UiScoreBreakdownGroup;
  risk: AnalysisV2UiScoreBreakdownGroup;
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
  scoreBreakdown?: AnalysisV2UiScoreBreakdown;
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

  // The response's own declared locale must be used here: several
  // validation rules (e.g. the below-80 mainTakeaway check) are
  // locale-gated, so re-validating a genuine ru response under the "en"
  // default rejects it outright — the explanatory text is Russian, so
  // it never matches the English-only term tables.
  const locale: AnalysisV2Locale =
    value.locale === "ru" ? "ru" : "en";

  const validation = validateAnalysisV2Result(
    value.result,
    script,
    locale
  );

  return validation.ok;
}

// Machine-readable reasons a /api/analyze-v2 response fails the frontend
// contract check. Used only for diagnostics (console logging) — never
// shown to the user and never used to change the analysis result itself.
export type AnalysisV2ResponseContractReason =
  | "invalid-json"
  | "payload-not-object"
  | "missing-status"
  | "invalid-success-shape"
  | "invalid-error-shape";

export type AnalysisV2ResponseContractResult =
  | { valid: true; payload: AnalysisV2SuccessResponse }
  | { valid: false; reason: AnalysisV2ResponseContractReason };

// Classifies an already-parsed payload against the expected /api/analyze-v2
// contract. Delegates the actual success-shape check to
// isAnalysisV2SuccessResponse — this does not reimplement or loosen that
// guard, it only adds a machine-readable reason for why a payload was
// rejected, for safe diagnostic logging.
export function checkAnalysisV2ResponseContract(
  payload: unknown,
  script: string
): AnalysisV2ResponseContractResult {
  if (!isPlainObject(payload)) {
    return { valid: false, reason: "payload-not-object" };
  }

  if (typeof payload.status !== "string") {
    return { valid: false, reason: "missing-status" };
  }

  if (payload.status === "error") {
    // A 200 OK response body must never declare itself an error — that is
    // itself a contract violation, distinct from a malformed success body.
    return { valid: false, reason: "invalid-error-shape" };
  }

  if (payload.status !== "ok") {
    return { valid: false, reason: "missing-status" };
  }

  if (!isAnalysisV2SuccessResponse(payload, script)) {
    return { valid: false, reason: "invalid-success-shape" };
  }

  return { valid: true, payload };
}

// Convenience wrapper for callers that still hold the raw response text
// (e.g. tests exercising the "invalid-json" reason directly).
export function parseAnalysisV2ResponseContract(
  rawJsonText: string,
  script: string
): AnalysisV2ResponseContractResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawJsonText);
  } catch {
    return { valid: false, reason: "invalid-json" };
  }

  return checkAnalysisV2ResponseContract(parsed, script);
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

  if (!isPlainObject(parsed)) {
    return null;
  }

  if (
    parsed.status !== "ok" ||
    typeof parsed.modelUsed !== "string" ||
    parsed.modelUsed.trim().length === 0
  ) {
    return null;
  }

  // Older saved analyses have no `locale` field, and an unrecognized value
  // must not be trusted — both cases fall back to "en" for the declared
  // field below. But the validation call itself must still use this same
  // fallback (not the validator's own separate "en" default) so a stored
  // ru analysis is checked against its own locale-gated rules instead of
  // being rejected outright.
  const declaredLocale =
    parsed.locale === "en" || parsed.locale === "ru"
      ? parsed.locale
      : undefined;

  const validation = validateAnalysisV2Result(
    parsed.result,
    script,
    declaredLocale ?? "en"
  );

  if (!validation.ok) {
    return null;
  }

  return {
    status: "ok",
    modelUsed: parsed.modelUsed,
    result: validation.value,
    ...(declaredLocale ? { locale: declaredLocale } : {}),
  };
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
  if (score >= ANALYSIS_V2_HOOK_STRONG_THRESHOLD)
    return "Strong";
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

// Deterministic fallback sentences, used only when there are no riskyParts
// to quote from (in which case AI content already carries the locale via
// the Analysis V2 prompt). Centralized here rather than as an inline UI
// condition — matches the same pattern as the score-label tables.
const RISK_DESCRIPTION_FALLBACKS: Record<
  AnalysisV2Locale,
  { low: string; lowMedium: string; medium: string; high: string }
> = {
  en: {
    low: "Low retention risk. The script stays focused and maintains a clear progression.",
    lowMedium:
      "The script is structurally sound, with only minor opportunities to tighten the pacing.",
    medium:
      "Some sections may lose attention before the script reaches its payoff.",
    high: "High retention risk. Important sections need stronger pacing, specificity, or escalation.",
  },
  ru: {
    low: "Низкий риск удержания. Сценарий остаётся сфокусированным и сохраняет чёткое развитие.",
    lowMedium:
      "Сценарий структурно крепкий, есть лишь небольшие возможности улучшить темп.",
    medium:
      "Некоторые части могут терять внимание зрителя до того, как сценарий дойдёт до развязки.",
    high: "Высокий риск удержания. Важным частям нужен более сильный темп, конкретность или нарастание.",
  },
};

function getRiskDescription(
  result: AnalysisV2Result,
  locale: AnalysisV2Locale = "en"
): string {
  const firstRisk = result.riskyParts[0];

  if (firstRisk) {
    return firstRisk.reason;
  }

  const fallbacks = RISK_DESCRIPTION_FALLBACKS[locale];

  if (result.scores.retentionRisk <= 25) {
    return fallbacks.low;
  }

  if (result.scores.retentionRisk <= 45) {
    return fallbacks.lowMedium;
  }

  if (result.scores.retentionRisk <= 64) {
    return fallbacks.medium;
  }

  return fallbacks.high;
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

const RISKY_PART_TITLES: Record<
  AnalysisV2Locale,
  { high: string; medium: string; low: string }
> = {
  en: {
    high: "High-risk section.",
    medium: "Potential drop-off point.",
    low: "Minor retention risk.",
  },
  ru: {
    high: "Рискованный момент.",
    medium: "Возможная точка оттока.",
    low: "Незначительный риск удержания.",
  },
};

function getRiskTitle(
  severity: "low" | "medium" | "high",
  locale: AnalysisV2Locale = "en"
): string {
  return RISKY_PART_TITLES[locale][severity];
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

function adaptScoreBreakdown(
  result: AnalysisV2Result
): AnalysisV2UiScoreBreakdown | undefined {
  const breakdown = result.scoreBreakdown;

  if (!breakdown) {
    return undefined;
  }

  return {
    overall: {
      title: "Overall Score",
      total: result.scores.overall,
      direction: "higher-is-better",
      items: [
        {
          label: "Premise Appeal",
          score:
            breakdown.overall.premiseAppeal,
          maxScore: 25,
          description:
            "How interesting and rewarding the underlying idea is.",
        },
        {
          label: "Opening Promise",
          score:
            breakdown.overall.openingPromise,
          maxScore: 25,
          description:
            "How clearly the opening promises value that the script delivers.",
        },
        {
          label: "Progression",
          score: breakdown.overall.progression,
          maxScore: 25,
          description:
            "How well each beat adds another reason to keep watching.",
        },
        {
          label: "Payoff",
          score: breakdown.overall.payoff,
          maxScore: 25,
          description:
            "How strongly the ending completes the promised value.",
        },
      ],
    },
    hook: {
      title: "Hook Score",
      total: result.scores.hook,
      direction: "higher-is-better",
      items: [
        {
          label: "Immediacy",
          score: breakdown.hook.immediacy,
          maxScore: 25,
          description:
            "How quickly the script reaches its concrete premise.",
        },
        {
          label: "Specificity",
          score: breakdown.hook.specificity,
          maxScore: 25,
          description:
            "How concrete and easy to understand the opening is.",
        },
        {
          label: "Viewer Pull",
          score: breakdown.hook.viewerPull,
          maxScore: 25,
          description:
            "How much curiosity, relevance, contrast, or stakes the opening creates.",
        },
        {
          label: "Delivery Alignment",
          score:
            breakdown.hook.deliveryAlignment,
          maxScore: 25,
          description:
            "How accurately the hook matches what the script delivers.",
        },
      ],
    },
    risk: {
      title: "Retention Risk",
      total: result.scores.retentionRisk,
      direction: "higher-is-riskier",
      items: [
        {
          label: "Opening Friction",
          score:
            breakdown.retentionRisk
              .openingFriction,
          maxScore: 25,
          description:
            "Delay, filler, or confusion before the premise begins.",
        },
        {
          label: "Progression Risk",
          score:
            breakdown.retentionRisk
              .progressionRisk,
          maxScore: 25,
          description:
            "Repetition, stalled development, or low information density.",
        },
        {
          label: "Predictability Risk",
          score:
            breakdown.retentionRisk
              .predictabilityRisk,
          maxScore: 25,
          description:
            "How easily viewers can predict the script's next beats.",
        },
        {
          label: "Payoff Risk",
          score:
            breakdown.retentionRisk.payoffRisk,
          maxScore: 25,
          description:
            "Risk that the ending feels weak, incomplete, or contradictory.",
        },
      ],
    },
  };
}

export function adaptAnalysisV2ForResults(
  response: AnalysisV2SuccessResponse,
  script: string,
  scriptLines: string[],
  estimatedDuration: number
): AnalysisV2UiResult {
  const result = response.result;
  // Adapts using the language the analysis was actually generated in, not
  // necessarily the live UI locale (they usually match, but a stale saved
  // analysis viewed after a UI language switch should keep its own
  // language rather than silently mixing in the other one).
  const locale: AnalysisV2Locale = response.locale ?? "en";
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
      description: getRiskDescription(result, locale),
    },
    scoreBreakdown: adaptScoreBreakdown(result),
    riskyParts: result.riskyParts.map((part) => ({
      time: createExcerptTimeRange(
        script,
        part.excerpt,
        estimatedDuration
      ),
      title: getRiskTitle(part.severity, locale),
      description: part.reason,
    })),
      fixes: dedupeFixes(
        result.suggestedFixes.map(
          (fix) => fix.suggestion
        )
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
