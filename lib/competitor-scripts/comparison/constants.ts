// Every numeric bound for the Compare contract in one place, so the
// validator (and any future prompt/schema PR) can never silently drift
// apart by duplicating the same number twice. Mirrors the structure of
// lib/competitor-scripts/analysis/constants.ts but is a fully separate
// module — Compare and Analyze bounds are allowed to diverge
// independently.

// ── Input/source bounds ─────────────────────────────────────────────────
// Preserves the existing Compare landing form's script cap
// (app/competitor-scripts/compare/compare-input-form.tsx) and Analyze's
// competitor-transcript cap (MAX_ANALYSIS_TRANSCRIPT_CHARACTERS). No
// separate combined cap: the sum of the two (7000 chars) is already the
// de facto ceiling. No precondition-check function is defined here yet
// (mirroring Analyze's checkAnalysisTranscriptSize) — its only caller
// would be the future provider, which is out of scope for this PR.
export const MAX_COMPARISON_USER_SCRIPT_CHARACTERS = 1000;
export const MAX_COMPARISON_COMPETITOR_TRANSCRIPT_CHARACTERS = 6000;

// ── Array bounds ───────────────────────────────────────────────────────
export const REQUIRED_DIMENSION_COUNT = 4;
export const MIN_PRIORITIES = 1;
export const MAX_PRIORITIES = 3;
export const MIN_CAUTIONS = 0;
export const MAX_CAUTIONS = 3;

// ── Text bounds ────────────────────────────────────────────────────────
export const MAX_HEADLINE_LENGTH = 140;
export const MAX_MAIN_TAKEAWAY_LENGTH = 240;
export const MAX_DIMENSION_CONCLUSION_LENGTH = 200;
export const MAX_DIMENSION_OBSERVATION_LENGTH = 220;
// Excerpts stay short — a phrase, never a paragraph. Same bound as
// Analyze's MAX_EVIDENCE_EXCERPT_LENGTH, defined independently here.
export const MAX_EVIDENCE_EXCERPT_LENGTH = 180;
export const MAX_PRIORITY_PROBLEM_LENGTH = 280;
export const MAX_PRIORITY_COMPETITOR_PRINCIPLE_LENGTH = 280;
export const MAX_PRIORITY_HOW_TO_APPLY_LENGTH = 280;
export const MAX_CAUTION_WHAT_NOT_TO_COPY_LENGTH = 100;
export const MAX_CAUTION_REASON_LENGTH = 280;

// ── Verbatim competitor-copy detection ────────────────────────────────
// Both thresholds must be satisfied on the same contiguous phrase — see
// findVerbatimCompetitorCopy in grounding.ts.
export const MIN_COPY_DETECTION_WORDS = 8;
export const MIN_COPY_DETECTION_CHARACTERS = 40;
