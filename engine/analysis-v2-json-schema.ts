import {
  ANALYSIS_V2_FIX_TARGETS,
  ANALYSIS_V2_HOOK_DECISIONS,
  ANALYSIS_V2_LIMITS,
  ANALYSIS_V2_SCENE_STATUSES,
  ANALYSIS_V2_SCORE_COMPONENT_KEYS,
  ANALYSIS_V2_SCRIPT_TYPES,
  ANALYSIS_V2_SEVERITIES,
  ANALYSIS_V2_VERDICTS,
} from "./analysis-v2-schema";

function buildScoreComponentProperties(
  keys: readonly string[]
): Record<
  string,
  {
    type: "integer";
    minimum: 0;
    maximum: 25;
  }
> {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      {
        type: "integer" as const,
        minimum: 0 as const,
        maximum: 25 as const,
      },
    ])
  );
}

export const ANALYSIS_V2_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "scriptType",
    "verdict",
    "scoreComponents",
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
    scoreComponents: {
      type: "object",
      additionalProperties: false,
      required: [
        "overall",
        "hook",
        "retentionRisk",
      ],
      properties: {
        overall: {
          type: "object",
          additionalProperties: false,
          required: [
            ...ANALYSIS_V2_SCORE_COMPONENT_KEYS.overall,
          ],
          properties:
            buildScoreComponentProperties(
              ANALYSIS_V2_SCORE_COMPONENT_KEYS.overall
            ),
        },
        hook: {
          type: "object",
          additionalProperties: false,
          required: [
            ...ANALYSIS_V2_SCORE_COMPONENT_KEYS.hook,
          ],
          properties:
            buildScoreComponentProperties(
              ANALYSIS_V2_SCORE_COMPONENT_KEYS.hook
            ),
        },
        retentionRisk: {
          type: "object",
          additionalProperties: false,
          required: [
            ...ANALYSIS_V2_SCORE_COMPONENT_KEYS.retentionRisk,
          ],
          properties:
            buildScoreComponentProperties(
              ANALYSIS_V2_SCORE_COMPONENT_KEYS.retentionRisk
            ),
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
