// Pure type definitions for the Compare contract — shapes only, no
// OpenAI, no network, no process.env. Mirrors the style of
// lib/competitor-scripts/analysis/types.ts but is deliberately its own,
// fully independent module: Compare and Analyze must stay two separate
// validators with zero type-level coupling (see
// docs/product/compare/CONSTITUTION.md — "Relationship to Analyze").
// See lib/competitor-scripts/comparison/validate.ts for the runtime
// validator that enforces these shapes against untrusted model output.

export type ComparisonLocale = "en" | "ru";

// Fixed, deterministic order — every valid comparison presents its four
// dimensions in exactly this sequence. The model is never free to
// reorder them.
export const COMPARISON_DIMENSIONS = [
  "hook",
  "structure",
  "momentum",
  "payoff_clarity",
] as const;
export type ComparisonDimension = (typeof COMPARISON_DIMENSIONS)[number];

export const STRONGER_SIDES = ["user", "competitor", "similar"] as const;
export type StrongerSide = (typeof STRONGER_SIDES)[number];

export const GAP_LEVELS = ["small", "meaningful", "large"] as const;
export type GapLevel = (typeof GAP_LEVELS)[number];

// User-script evidence carries no timing fields at all — not a nullable
// timestamp, no timestamp property exists on this variant. An invented
// user timestamp is therefore structurally impossible to construct, not
// merely rejected at runtime. This is why Compare does not reuse
// Analyze's EvidenceRef (which has nullable startMs/endMs on every use,
// including ones with no real timing source).
export type UserScriptEvidence = {
  source: "user";
  excerpt: string;
};

export type CompetitorTranscriptEvidence = {
  source: "competitor";
  excerpt: string;
  startMs: number;
  endMs: number | null;
};

export type ComparisonEvidence = UserScriptEvidence | CompetitorTranscriptEvidence;

export type DimensionFinding = {
  dimension: ComparisonDimension;
  strongerSide: StrongerSide;
  // Required property, present (non-null) iff strongerSide !== "similar".
  // See validate.ts for the exact rule.
  gap: GapLevel | null;
  conclusion: string;
  userObservation: string;
  competitorObservation: string;
  // Every dimension finding must compare both sources directly — both
  // sides are mandatory, never null, for all four dimensions.
  evidence: {
    user: UserScriptEvidence;
    competitor: CompetitorTranscriptEvidence;
  };
};

export type Priority = {
  rank: number;
  problem: string;
  competitorPrinciple: string;
  howToApply: string;
  // Both sides mandatory, never null, for phase 1 — see the Compare
  // product-contract discussion: no priority.basis discriminant, no
  // evidence exemption. Simplicity over theoretical validator strength.
  evidence: {
    user: UserScriptEvidence;
    competitor: CompetitorTranscriptEvidence;
  };
};

// user is a required property (never omitted) that may be null — the
// one canonical strict shape, chosen so it translates cleanly to a
// future structured-output JSON schema (strict mode requires every
// property to be listed in `required`; nullability is expressed via a
// type union, never by omission).
export type Caution = {
  whatNotToCopy: string;
  reason: string;
  evidence: {
    competitor: CompetitorTranscriptEvidence;
    user: UserScriptEvidence | null;
  };
};

export type ComparisonSummary = {
  headline: string;
  mainTakeaway: string;
};

export type CompetitorScriptComparison = {
  schemaVersion: 1;
  locale: ComparisonLocale;
  comparisonSummary: ComparisonSummary;
  dimensionFindings: DimensionFinding[];
  priorities: Priority[];
  cautions: Caution[];
};

// Every failure a candidate model response can produce. Internal-only —
// never exposed to end users directly; a future API layer maps these to
// a small set of safe public error codes, the same pattern Analyze
// already uses for AnalysisValidationFailureCode.
export const COMPARISON_VALIDATION_FAILURE_CODES = [
  "invalid_shape",
  "invalid_schema_version",
  "invalid_locale",
  "invalid_dimension_set",
  "invalid_dimension_order",
  "invalid_stronger_side",
  "invalid_gap",
  "invalid_priority_count",
  "invalid_priority_rank",
  "invalid_caution_count",
  "field_too_long",
  "empty_field",
  "invalid_evidence_source",
  "user_excerpt_not_found",
  "competitor_excerpt_not_found",
  "invalid_competitor_timestamp",
  "competitor_evidence_not_segment_grounded",
  "unsupported_quote",
  "unsupported_numeric_claim",
  "unsupported_performance_claim",
  "unsupported_production_claim",
  "unsupported_intent_claim",
  "unsupported_causal_claim",
  "duplicate_content",
  "generic_feedback",
  "copy_instruction",
] as const;
export type ComparisonValidationFailureCode =
  (typeof COMPARISON_VALIDATION_FAILURE_CODES)[number];

export type ComparisonValidationFailure = {
  code: ComparisonValidationFailureCode;
  // Internal diagnostic detail for logs/tests — never provider output,
  // never shown to end users.
  reason: string;
};

export type CompetitorScriptComparisonResult =
  | { ok: true; comparison: CompetitorScriptComparison }
  | { ok: false; failure: ComparisonValidationFailure };
