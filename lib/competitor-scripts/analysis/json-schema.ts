// The OpenAI Responses API structured-output schema for the Competitor
// Scripts analysis contract. Mirrors lib/competitor-scripts/analysis/types.ts
// (CompetitorScriptAnalysis) field-for-field, sourcing every bound from
// constants.ts — never a duplicated naked number. Strict mode requires
// every property to be listed in "required" (nullability is expressed via
// a `type` array, not by omission) and `additionalProperties: false`
// everywhere.
//
// This schema constrains *shape* only. It is not a substitute for the real
// semantic validator (validate.ts) — grounding, verdict/score consistency,
// evidence exact-substring matching, and quote/number/performance-claim
// checks are enforced only there, after a structurally-valid response
// comes back.

import {
  ANALYSIS_VERDICTS,
  SCORE_KEYS,
  SEVERITIES,
  STRUCTURE_BEAT_LABELS,
} from "./types";
import {
  MAX_ACTIONABLE_LESSONS,
  MAX_BEAT_PURPOSE_LENGTH,
  MAX_CAUTION_ITEMS,
  MAX_CONCISE_LABEL_LENGTH,
  MAX_EVIDENCE_EXCERPT_LENGTH,
  MAX_EXPLANATION_LENGTH,
  MAX_MAIN_TAKEAWAY_LENGTH,
  MAX_RETENTION_RISKS,
  MAX_STRENGTHS,
  MAX_STRUCTURE_BEATS,
  MAX_WEAKNESSES,
  MIN_ACTIONABLE_LESSONS,
  MIN_CAUTION_ITEMS,
  MIN_RETENTION_RISKS,
  MIN_STRENGTHS,
  MIN_STRUCTURE_BEATS,
  MIN_WEAKNESSES,
  REQUIRED_SCORE_REASONS,
} from "./constants";

type JsonSchema = { [key: string]: unknown };

function nullableInteger(): JsonSchema {
  return { type: ["integer", "null"] };
}

function evidenceSchema(): JsonSchema {
  return {
    type: "object",
    properties: {
      excerpt: { type: "string", maxLength: MAX_EVIDENCE_EXCERPT_LENGTH },
      startMs: nullableInteger(),
      endMs: nullableInteger(),
    },
    required: ["excerpt", "startMs", "endMs"],
    additionalProperties: false,
  };
}

function nullableEvidenceSchema(): JsonSchema {
  const base = evidenceSchema();
  return { anyOf: [base, { type: "null" }] };
}

function proseField(maxLength: number): JsonSchema {
  return { type: "string", maxLength };
}

const SCORE_REASON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    score: { type: "string", enum: [...SCORE_KEYS] },
    driver: proseField(MAX_EXPLANATION_LENGTH),
  },
  required: ["score", "driver"],
  additionalProperties: false,
};

const STRUCTURE_BEAT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    label: { type: "string", enum: [...STRUCTURE_BEAT_LABELS] },
    evidence: evidenceSchema(),
    purpose: proseField(MAX_BEAT_PURPOSE_LENGTH),
    analysis: proseField(MAX_EXPLANATION_LENGTH),
  },
  required: ["label", "evidence", "purpose", "analysis"],
  additionalProperties: false,
};

const STRENGTH_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    title: proseField(MAX_CONCISE_LABEL_LENGTH),
    evidence: evidenceSchema(),
    whyItWorks: proseField(MAX_EXPLANATION_LENGTH),
  },
  required: ["title", "evidence", "whyItWorks"],
  additionalProperties: false,
};

const WEAKNESS_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    issue: proseField(MAX_CONCISE_LABEL_LENGTH),
    evidence: evidenceSchema(),
    whyItMatters: proseField(MAX_EXPLANATION_LENGTH),
    severity: { type: "string", enum: [...SEVERITIES] },
  },
  required: ["issue", "evidence", "whyItMatters", "severity"],
  additionalProperties: false,
};

const RETENTION_RISK_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    evidence: evidenceSchema(),
    risk: proseField(MAX_EXPLANATION_LENGTH),
    reason: proseField(MAX_EXPLANATION_LENGTH),
    severity: { type: "string", enum: [...SEVERITIES] },
  },
  required: ["evidence", "risk", "reason", "severity"],
  additionalProperties: false,
};

const ACTIONABLE_LESSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    principle: proseField(MAX_CONCISE_LABEL_LENGTH),
    sourceEvidence: evidenceSchema(),
    application: proseField(MAX_EXPLANATION_LENGTH),
  },
  required: ["principle", "sourceEvidence", "application"],
  additionalProperties: false,
};

const CAUTION_ITEM_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    whatNotToCopy: proseField(MAX_CONCISE_LABEL_LENGTH),
    reason: proseField(MAX_EXPLANATION_LENGTH),
    evidence: nullableEvidenceSchema(),
  },
  required: ["whatNotToCopy", "reason", "evidence"],
  additionalProperties: false,
};

export const COMPETITOR_ANALYSIS_JSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    locale: { type: "string", enum: ["en", "ru"] },
    verdict: { type: "string", enum: [...ANALYSIS_VERDICTS] },
    scores: {
      type: "object",
      properties: {
        overallScore: { type: "integer", minimum: 0, maximum: 100 },
        hookScore: { type: "integer", minimum: 0, maximum: 100 },
        structureScore: { type: "integer", minimum: 0, maximum: 100 },
        momentumScore: { type: "integer", minimum: 0, maximum: 100 },
      },
      required: ["overallScore", "hookScore", "structureScore", "momentumScore"],
      additionalProperties: false,
    },
    mainTakeaway: proseField(MAX_MAIN_TAKEAWAY_LENGTH),
    scoreReasons: {
      type: "array",
      items: SCORE_REASON_SCHEMA,
      minItems: REQUIRED_SCORE_REASONS,
      maxItems: REQUIRED_SCORE_REASONS,
    },
    structure: {
      type: "array",
      items: STRUCTURE_BEAT_SCHEMA,
      minItems: MIN_STRUCTURE_BEATS,
      maxItems: MAX_STRUCTURE_BEATS,
    },
    strengths: {
      type: "array",
      items: STRENGTH_SCHEMA,
      minItems: MIN_STRENGTHS,
      maxItems: MAX_STRENGTHS,
    },
    weaknesses: {
      type: "array",
      items: WEAKNESS_SCHEMA,
      minItems: MIN_WEAKNESSES,
      maxItems: MAX_WEAKNESSES,
    },
    retentionRisks: {
      type: "array",
      items: RETENTION_RISK_SCHEMA,
      minItems: MIN_RETENTION_RISKS,
      maxItems: MAX_RETENTION_RISKS,
    },
    actionableLessons: {
      type: "array",
      items: ACTIONABLE_LESSON_SCHEMA,
      minItems: MIN_ACTIONABLE_LESSONS,
      maxItems: MAX_ACTIONABLE_LESSONS,
    },
    caution: {
      type: "array",
      items: CAUTION_ITEM_SCHEMA,
      minItems: MIN_CAUTION_ITEMS,
      maxItems: MAX_CAUTION_ITEMS,
    },
  },
  required: [
    "schemaVersion",
    "locale",
    "verdict",
    "scores",
    "mainTakeaway",
    "scoreReasons",
    "structure",
    "strengths",
    "weaknesses",
    "retentionRisks",
    "actionableLessons",
    "caution",
  ],
  additionalProperties: false,
};
