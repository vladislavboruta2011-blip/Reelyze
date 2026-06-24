import {
  ANALYSIS_V2_FIX_TARGETS,
  ANALYSIS_V2_HOOK_DECISIONS,
  ANALYSIS_V2_LIMITS,
  ANALYSIS_V2_SCENE_STATUSES,
  ANALYSIS_V2_SCRIPT_TYPES,
  ANALYSIS_V2_SEVERITIES,
  ANALYSIS_V2_VERDICTS,
} from "./analysis-v2-schema";

export const ANALYSIS_V2_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "scriptType",
    "verdict",
    "scores",
    "hookDecision",
    "hookAssessment",
    "suggestedHook",
    "riskyParts",
    "suggestedFixes",
    "scenes",
    "mainTakeaway",
  ],
  properties: {
    scriptType: {
      type: "string",
      enum: [...ANALYSIS_V2_SCRIPT_TYPES],
    },
    verdict: {
      type: "string",
      enum: [...ANALYSIS_V2_VERDICTS],
    },
    scores: {
      type: "object",
      additionalProperties: false,
      required: [
        "overall",
        "hook",
        "retentionRisk",
      ],
      properties: {
        overall: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
        hook: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
        retentionRisk: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
      },
    },
    hookDecision: {
      type: "string",
      enum: [...ANALYSIS_V2_HOOK_DECISIONS],
    },
    hookAssessment: {
      type: "string",
      minLength: 1,
      maxLength:
        ANALYSIS_V2_LIMITS.maxHookAssessmentCharacters,
    },
    suggestedHook: {
      type: [
        "string",
        "null",
      ],
      maxLength:
        ANALYSIS_V2_LIMITS.maxSuggestedHookCharacters,
    },
    riskyParts: {
      type: "array",
      maxItems:
        ANALYSIS_V2_LIMITS.maxRiskyParts,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "excerpt",
          "reason",
          "severity",
        ],
        properties: {
          excerpt: {
            type: "string",
            minLength: 1,
            maxLength:
              ANALYSIS_V2_LIMITS.maxScriptCharacters,
          },
          reason: {
            type: "string",
            minLength: 1,
            maxLength:
              ANALYSIS_V2_LIMITS.maxRiskReasonCharacters,
          },
          severity: {
            type: "string",
            enum: [...ANALYSIS_V2_SEVERITIES],
          },
        },
      },
    },
    suggestedFixes: {
      type: "array",
      maxItems:
        ANALYSIS_V2_LIMITS.maxSuggestedFixes,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "target",
          "suggestion",
          "optional",
        ],
        properties: {
          target: {
            type: "string",
            enum: [...ANALYSIS_V2_FIX_TARGETS],
          },
          suggestion: {
            type: "string",
            minLength: 1,
            maxLength:
              ANALYSIS_V2_LIMITS.maxFixSuggestionCharacters,
          },
          optional: {
            type: "boolean",
          },
        },
      },
    },
    scenes: {
      type: "array",
      minItems: 1,
      maxItems:
        ANALYSIS_V2_LIMITS.maxScenes,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "excerpt",
          "label",
          "status",
        ],
        properties: {
          excerpt: {
            type: "string",
            minLength: 1,
            maxLength:
              ANALYSIS_V2_LIMITS.maxScriptCharacters,
          },
          label: {
            type: "string",
            minLength: 1,
            maxLength:
              ANALYSIS_V2_LIMITS.maxSceneLabelCharacters,
          },
          status: {
            type: "string",
            enum: [...ANALYSIS_V2_SCENE_STATUSES],
          },
        },
      },
    },
    mainTakeaway: {
      type: "string",
      minLength: 1,
      maxLength:
        ANALYSIS_V2_LIMITS.maxMainTakeawayCharacters,
    },
  },
} as const;
