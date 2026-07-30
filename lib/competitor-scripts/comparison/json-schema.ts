// The OpenAI Responses API structured-output schema for the Compare
// contract. Mirrors lib/competitor-scripts/comparison/types.ts
// (CompetitorScriptComparison) field-for-field, sourcing every bound from
// constants.ts — never a duplicated naked number. Strict mode requires
// every property to be listed in "required" (nullability is expressed via
// a `type` array or an `anyOf` with `{ type: "null" }`, never by
// omission) and `additionalProperties: false` everywhere. Follows the
// exact same two nullability idioms already proven by
// lib/competitor-scripts/analysis/json-schema.ts (`nullableInteger()` for
// a plain nullable scalar, an `anyOf`-with-null wrapper for a nullable
// object) rather than inventing a third pattern.
//
// This schema constrains *shape* only. It is not a substitute for the real
// semantic validator (validate.ts) — grounding, the gap/strongerSide
// correlation, evidence exact-substring matching, and quote/number/
// performance-claim checks are enforced only there, after a
// structurally-valid response comes back.

import { COMPARISON_DIMENSIONS, GAP_LEVELS, STRONGER_SIDES } from "./types";
import {
  MAX_CAUTION_REASON_LENGTH,
  MAX_CAUTION_WHAT_NOT_TO_COPY_LENGTH,
  MAX_CAUTIONS,
  MAX_DIMENSION_CONCLUSION_LENGTH,
  MAX_DIMENSION_OBSERVATION_LENGTH,
  MAX_EVIDENCE_EXCERPT_LENGTH,
  MAX_HEADLINE_LENGTH,
  MAX_MAIN_TAKEAWAY_LENGTH,
  MAX_PRIORITIES,
  MAX_PRIORITY_COMPETITOR_PRINCIPLE_LENGTH,
  MAX_PRIORITY_HOW_TO_APPLY_LENGTH,
  MAX_PRIORITY_PROBLEM_LENGTH,
  MIN_CAUTIONS,
  MIN_PRIORITIES,
  REQUIRED_DIMENSION_COUNT,
} from "./constants";

type JsonSchema = { [key: string]: unknown };

function proseField(maxLength: number): JsonSchema {
  return { type: "string", maxLength };
}

function nullableInteger(): JsonSchema {
  return { type: ["integer", "null"] };
}

// { source: "user", excerpt } — no timing fields exist on this shape at
// all, mirroring UserScriptEvidence in types.ts exactly.
function userScriptEvidenceSchema(): JsonSchema {
  return {
    type: "object",
    properties: {
      source: { type: "string", enum: ["user"] },
      excerpt: { type: "string", maxLength: MAX_EVIDENCE_EXCERPT_LENGTH },
    },
    required: ["source", "excerpt"],
    additionalProperties: false,
  };
}

function competitorTranscriptEvidenceSchema(): JsonSchema {
  return {
    type: "object",
    properties: {
      source: { type: "string", enum: ["competitor"] },
      excerpt: { type: "string", maxLength: MAX_EVIDENCE_EXCERPT_LENGTH },
      startMs: { type: "integer" },
      endMs: nullableInteger(),
    },
    required: ["source", "excerpt", "startMs", "endMs"],
    additionalProperties: false,
  };
}

// Required, nullable object property — same anyOf-with-null idiom as
// Analyze's nullableEvidenceSchema(), used here for Caution.evidence.user
// (UserScriptEvidence | null in types.ts).
function nullableUserScriptEvidenceSchema(): JsonSchema {
  return { anyOf: [userScriptEvidenceSchema(), { type: "null" }] };
}

// Required, nullable enum property — same anyOf-with-null idiom, applied
// to DimensionFinding.gap (GapLevel | null in types.ts). Deliberately not
// `{ type: ["string", "null"], enum: [...GAP_LEVELS, null] }`: that
// combination is not exercised anywhere else in this codebase, while the
// anyOf-with-null wrapper is already proven working strict-schema output
// (Analyze's nullableEvidenceSchema), so it is reused here rather than
// introducing an untested pattern.
function nullableGapSchema(): JsonSchema {
  return { anyOf: [{ type: "string", enum: [...GAP_LEVELS] }, { type: "null" }] };
}

function dimensionEvidenceSchema(): JsonSchema {
  return {
    type: "object",
    properties: {
      user: userScriptEvidenceSchema(),
      competitor: competitorTranscriptEvidenceSchema(),
    },
    required: ["user", "competitor"],
    additionalProperties: false,
  };
}

const DIMENSION_FINDING_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    dimension: { type: "string", enum: [...COMPARISON_DIMENSIONS] },
    strongerSide: { type: "string", enum: [...STRONGER_SIDES] },
    gap: nullableGapSchema(),
    conclusion: proseField(MAX_DIMENSION_CONCLUSION_LENGTH),
    userObservation: proseField(MAX_DIMENSION_OBSERVATION_LENGTH),
    competitorObservation: proseField(MAX_DIMENSION_OBSERVATION_LENGTH),
    evidence: dimensionEvidenceSchema(),
  },
  required: [
    "dimension",
    "strongerSide",
    "gap",
    "conclusion",
    "userObservation",
    "competitorObservation",
    "evidence",
  ],
  additionalProperties: false,
};

const PRIORITY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    // Bounded to the static 1..MAX_PRIORITIES range; the exact
    // 1..n-with-no-gaps sequencing rule is enforced only by the real
    // validator (validate.ts), the same division of responsibility the
    // header comment above describes.
    rank: { type: "integer", minimum: MIN_PRIORITIES, maximum: MAX_PRIORITIES },
    problem: proseField(MAX_PRIORITY_PROBLEM_LENGTH),
    competitorPrinciple: proseField(MAX_PRIORITY_COMPETITOR_PRINCIPLE_LENGTH),
    howToApply: proseField(MAX_PRIORITY_HOW_TO_APPLY_LENGTH),
    evidence: {
      type: "object",
      properties: {
        user: userScriptEvidenceSchema(),
        competitor: competitorTranscriptEvidenceSchema(),
      },
      required: ["user", "competitor"],
      additionalProperties: false,
    },
  },
  required: ["rank", "problem", "competitorPrinciple", "howToApply", "evidence"],
  additionalProperties: false,
};

const CAUTION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    whatNotToCopy: proseField(MAX_CAUTION_WHAT_NOT_TO_COPY_LENGTH),
    reason: proseField(MAX_CAUTION_REASON_LENGTH),
    evidence: {
      type: "object",
      properties: {
        competitor: competitorTranscriptEvidenceSchema(),
        user: nullableUserScriptEvidenceSchema(),
      },
      required: ["competitor", "user"],
      additionalProperties: false,
    },
  },
  required: ["whatNotToCopy", "reason", "evidence"],
  additionalProperties: false,
};

export const COMPARISON_JSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    locale: { type: "string", enum: ["en", "ru"] },
    comparisonSummary: {
      type: "object",
      properties: {
        headline: proseField(MAX_HEADLINE_LENGTH),
        mainTakeaway: proseField(MAX_MAIN_TAKEAWAY_LENGTH),
      },
      required: ["headline", "mainTakeaway"],
      additionalProperties: false,
    },
    dimensionFindings: {
      type: "array",
      items: DIMENSION_FINDING_SCHEMA,
      minItems: REQUIRED_DIMENSION_COUNT,
      maxItems: REQUIRED_DIMENSION_COUNT,
    },
    priorities: {
      type: "array",
      items: PRIORITY_SCHEMA,
      minItems: MIN_PRIORITIES,
      maxItems: MAX_PRIORITIES,
    },
    cautions: {
      type: "array",
      items: CAUTION_SCHEMA,
      minItems: MIN_CAUTIONS,
      maxItems: MAX_CAUTIONS,
    },
  },
  required: [
    "schemaVersion",
    "locale",
    "comparisonSummary",
    "dimensionFindings",
    "priorities",
    "cautions",
  ],
  additionalProperties: false,
};
