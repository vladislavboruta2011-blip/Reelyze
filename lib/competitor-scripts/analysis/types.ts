// Pure type definitions for the Competitor Scripts analysis contract —
// shapes only, no OpenAI, no network, no process.env. Mirrors how
// lib/competitor-scripts/transcript/types.ts defines its contract with
// zero side effects. See lib/competitor-scripts/analysis/validate.ts for
// the runtime validator that actually enforces these shapes against
// untrusted model output.

export type AnalysisLocale = "en" | "ru";

export const ANALYSIS_VERDICTS = ["strong", "mixed", "weak"] as const;
export type AnalysisVerdict = (typeof ANALYSIS_VERDICTS)[number];

// Function-based, not a fixed required sequence — a script is never
// forced into a specific stage order or count. "other" exists so the
// model is never pressured to mislabel a beat that doesn't fit cleanly.
export const STRUCTURE_BEAT_LABELS = [
  "hook",
  "setup",
  "context",
  "escalation",
  "reveal",
  "payoff",
  "cta",
  "digression",
  "recap",
  "other",
] as const;
export type StructureBeatLabel = (typeof STRUCTURE_BEAT_LABELS)[number];

export const SEVERITIES = ["minor", "moderate", "major"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SCORE_KEYS = [
  "overallScore",
  "hookScore",
  "structureScore",
  "momentumScore",
] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];

// momentumScore is transcript-level pacing/momentum only — never a
// measurement of actual viewer retention. The UI label stays "Retention"
// (see lib/messages.ts); this field name exists specifically so no future
// engineer reading the type mistakes it for a measured stat. Never rename
// to actualRetention / retentionRate / viewerRetention.
export type AnalysisScores = {
  overallScore: number;
  hookScore: number;
  structureScore: number;
  momentumScore: number;
};

// The one canonical evidence representation, reused everywhere a claim
// needs grounding (structure beats, strengths, weaknesses, retention
// risks, lessons, caution) — never a second parallel shape.
export type EvidenceRef = {
  excerpt: string;
  startMs: number | null;
  endMs: number | null;
};

export type StructureBeat = {
  label: StructureBeatLabel;
  evidence: EvidenceRef;
  purpose: string;
  analysis: string;
};

export type Strength = {
  title: string;
  evidence: EvidenceRef;
  whyItWorks: string;
};

export type Weakness = {
  issue: string;
  evidence: EvidenceRef;
  whyItMatters: string;
  severity: Severity;
};

export type RetentionRisk = {
  evidence: EvidenceRef;
  risk: string;
  reason: string;
  severity: Severity;
};

export type ActionableLesson = {
  principle: string;
  sourceEvidence: EvidenceRef;
  application: string;
};

// evidence is nullable — a pattern-level caution ("this only works
// because of this creator's existing audience familiarity") may not tie
// to one excerpt.
export type CautionItem = {
  whatNotToCopy: string;
  reason: string;
  evidence: EvidenceRef | null;
};

export type ScoreReason = {
  score: ScoreKey;
  driver: string;
};

export type CompetitorScriptAnalysis = {
  schemaVersion: 1;
  locale: AnalysisLocale;
  verdict: AnalysisVerdict;
  scores: AnalysisScores;
  mainTakeaway: string;
  scoreReasons: ScoreReason[];
  structure: StructureBeat[];
  strengths: Strength[];
  weaknesses: Weakness[];
  retentionRisks: RetentionRisk[];
  actionableLessons: ActionableLesson[];
  caution: CautionItem[];
};

// A precondition check on the transcript itself, run before any model
// call would be attempted — distinct from validating a model's response.
// Retrying an oversized transcript can never fix it, so this is never
// folded into the retry-worthy failure taxonomy below.
export type AnalysisSizeCheckResult =
  | { ok: true }
  | {
      ok: false;
      code: "transcript_too_long_for_analysis";
      maxCharacters: number;
      actualCharacters: number;
    };

// Every failure a candidate model response can produce. Internal-only —
// never exposed to end users directly; a future API layer maps these to
// the same small set of safe public error codes the rest of Competitor
// Scripts already uses.
export const ANALYSIS_VALIDATION_FAILURE_CODES = [
  "invalid_shape",
  "invalid_score",
  "inconsistent_scores",
  "invalid_verdict",
  "invalid_evidence",
  "invalid_timestamp",
  "unsupported_performance_claim",
  "unsupported_numeric_claim",
  "duplicate_content",
  "excessive_content",
  "locale_mismatch",
] as const;
export type AnalysisValidationFailureCode =
  (typeof ANALYSIS_VALIDATION_FAILURE_CODES)[number];

export type AnalysisValidationFailure = {
  code: AnalysisValidationFailureCode;
  // Internal diagnostic detail for logs / PR 10B retry-prompt construction
  // — never provider output, never shown to end users.
  reason: string;
};

export type CompetitorScriptAnalysisResult =
  | { ok: true; analysis: CompetitorScriptAnalysis }
  | { ok: false; failure: AnalysisValidationFailure };
