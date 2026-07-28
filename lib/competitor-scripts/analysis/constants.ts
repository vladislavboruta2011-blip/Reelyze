// Every numeric bound for the analysis contract in one place, so a future
// PR 10B (prompt/retry) and this validator can never silently drift apart
// by duplicating the same number twice.

// ── Transcript-size precondition (checked before any model call) ─────────
export const MAX_ANALYSIS_TRANSCRIPT_CHARACTERS = 6000;

// ── Score bands / verdict thresholds ──────────────────────────────────────
export const POOR_SCORE_BAND_MAX = 39; // 0-39 inclusive is "poor"
export const STRONG_OVERALL_MIN = 70;
export const STRONG_HOOK_MIN = 55;
export const STRONG_STRUCTURE_MIN = 55;
export const WEAK_OVERALL_MAX = 39;
export const MAX_SCORE_CONSISTENCY_DEVIATION = 20;

// ── Array bounds ───────────────────────────────────────────────────────────
export const MIN_STRUCTURE_BEATS = 2;
export const MAX_STRUCTURE_BEATS = 8;
export const MIN_STRENGTHS = 1;
export const MAX_STRENGTHS = 5;
export const MIN_WEAKNESSES = 0;
export const MAX_WEAKNESSES = 5;
export const MIN_RETENTION_RISKS = 0;
export const MAX_RETENTION_RISKS = 5;
export const MIN_ACTIONABLE_LESSONS = 2;
export const MAX_ACTIONABLE_LESSONS = 5;
export const MIN_CAUTION_ITEMS = 0;
export const MAX_CAUTION_ITEMS = 3;
export const REQUIRED_SCORE_REASONS = 4;

// ── Text bounds ────────────────────────────────────────────────────────────
// Excerpts stay short — a phrase, never a paragraph.
export const MAX_EVIDENCE_EXCERPT_LENGTH = 180;
// One or two sentences.
export const MAX_MAIN_TAKEAWAY_LENGTH = 240;
// Concise labels: Strength.title, Weakness.issue, ActionableLesson.principle,
// CautionItem.whatNotToCopy.
export const MAX_CONCISE_LABEL_LENGTH = 100;
// StructureBeat.purpose — "what this beat is doing," one short clause.
export const MAX_BEAT_PURPOSE_LENGTH = 120;
// Everything else: analysis / whyItWorks / whyItMatters / risk / reason /
// application / driver — a couple of explanatory sentences.
export const MAX_EXPLANATION_LENGTH = 320;
