// Deliberately decoupled from lib/i18n.ts's Locale (which also covers
// unlaunched locales) — the engine stays self-contained and only needs the
// two locales Analysis V2 actually writes explanations in.
export type AnalysisV2Locale = "en" | "ru";

export const ANALYSIS_V2_SCRIPT_TYPES = [
  "explanation",
  "how_to",
  "warning",
  "narrative_event",
  "mystery",
  "list_escalation",
  "comparison",
  "advertorial",
  "generic_advice",
  "other",
] as const;

export type AnalysisV2ScriptType =
  (typeof ANALYSIS_V2_SCRIPT_TYPES)[number];

export const ANALYSIS_V2_VERDICTS = [
  "strong",
  "mixed",
  "weak",
] as const;

export type AnalysisV2Verdict =
  (typeof ANALYSIS_V2_VERDICTS)[number];

export const ANALYSIS_V2_HOOK_DECISIONS = [
  "keep",
  "refine",
  "rewrite",
  "diagnostic",
] as const;

export type AnalysisV2HookDecision =
  (typeof ANALYSIS_V2_HOOK_DECISIONS)[number];

export const ANALYSIS_V2_SEVERITIES = [
  "low",
  "medium",
  "high",
] as const;

export type AnalysisV2Severity =
  (typeof ANALYSIS_V2_SEVERITIES)[number];

export const ANALYSIS_V2_FIX_TARGETS = [
  "hook",
  "middle",
  "payoff",
  "clarity",
] as const;

export type AnalysisV2FixTarget =
  (typeof ANALYSIS_V2_FIX_TARGETS)[number];

export const ANALYSIS_V2_SCENE_STATUSES = [
  "strong",
  "average",
  "risky",
] as const;

export type AnalysisV2SceneStatus =
  (typeof ANALYSIS_V2_SCENE_STATUSES)[number];

export type AnalysisV2Scores = {
  overall: number;
  hook: number;
  retentionRisk: number;
};

export type AnalysisV2ScoreBreakdown = {
  overall: {
    premiseAppeal: number;
    openingPromise: number;
    progression: number;
    payoff: number;
  };
  hook: {
    immediacy: number;
    specificity: number;
    viewerPull: number;
    deliveryAlignment: number;
  };
  retentionRisk: {
    openingFriction: number;
    progressionRisk: number;
    predictabilityRisk: number;
    payoffRisk: number;
  };
};

export const ANALYSIS_V2_SCORE_COMPONENT_KEYS = {
  overall: [
    "premiseAppeal",
    "openingPromise",
    "progression",
    "payoff",
  ],
  hook: [
    "immediacy",
    "specificity",
    "viewerPull",
    "deliveryAlignment",
  ],
  retentionRisk: [
    "openingFriction",
    "progressionRisk",
    "predictabilityRisk",
    "payoffRisk",
  ],
} as const;

export type AnalysisV2RiskyPart = {
  excerpt: string;
  reason: string;
  severity: AnalysisV2Severity;
};

export type AnalysisV2SuggestedFix = {
  target: AnalysisV2FixTarget;
  suggestion: string;
  optional: boolean;
};

export type AnalysisV2Scene = {
  excerpt: string;
  label: string;
  status: AnalysisV2SceneStatus;
};

export type AnalysisV2Result = {
  scriptType: AnalysisV2ScriptType;
  verdict: AnalysisV2Verdict;
  scores: AnalysisV2Scores;
  scoreBreakdown?: AnalysisV2ScoreBreakdown;
  hookDecision: AnalysisV2HookDecision;
  hookAssessment: string;
  suggestedHook?: string;
  riskyParts: AnalysisV2RiskyPart[];
  suggestedFixes: AnalysisV2SuggestedFix[];
  scenes: AnalysisV2Scene[];
  mainTakeaway: string;
};

export type AnalysisV2SuccessResponse = {
  status: "ok";
  result: AnalysisV2Result;
  modelUsed: string;
  // The UI locale the explanations were generated in. Persisted alongside
  // the result so /results can tell whether a saved analysis matches the
  // current UI locale without re-running the AI. Optional — old saved
  // analyses have no locale field and must be treated as "en".
  locale?: AnalysisV2Locale;
};

export type AnalysisV2ErrorResponse = {
  status: "error";
  reason: string;
};

export type AnalysisV2Response =
  | AnalysisV2SuccessResponse
  | AnalysisV2ErrorResponse;

export const ANALYSIS_V2_LIMITS = {
  maxScriptCharacters: 1000,
  maxTitleCharacters: 200,
  maxRequestBodyBytes: 16_384,
  maxRiskyParts: 2,
  maxSuggestedFixes: 2,
  maxScenes: 6,
  maxHookAssessmentCharacters: 500,
  maxSuggestedHookCharacters: 240,
  maxRiskReasonCharacters: 500,
  maxFixSuggestionCharacters: 500,
  maxSceneLabelCharacters: 120,
  maxMainTakeawayCharacters: 500,
} as const;
