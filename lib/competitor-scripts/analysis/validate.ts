import type {
  NormalizedTranscript,
  TranscriptSegment,
} from "../transcript/types";
import {
  ANALYSIS_VERDICTS,
  SCORE_KEYS,
  SEVERITIES,
  STRUCTURE_BEAT_LABELS,
  type ActionableLesson,
  type AnalysisLocale,
  type AnalysisScores,
  type AnalysisSizeCheckResult,
  type AnalysisValidationFailureCode,
  type CautionItem,
  type CompetitorScriptAnalysis,
  type CompetitorScriptAnalysisResult,
  type EvidenceRef,
  type RetentionRisk,
  type ScoreReason,
  type Severity,
  type StructureBeat,
  type StructureBeatLabel,
  type Strength,
  type Weakness,
} from "./types";
import {
  MAX_ANALYSIS_TRANSCRIPT_CHARACTERS,
  MAX_ACTIONABLE_LESSONS,
  MAX_BEAT_PURPOSE_LENGTH,
  MAX_CAUTION_ITEMS,
  MAX_CONCISE_LABEL_LENGTH,
  MAX_EVIDENCE_EXCERPT_LENGTH,
  MAX_EXPLANATION_LENGTH,
  MAX_MAIN_TAKEAWAY_LENGTH,
  MAX_RETENTION_RISKS,
  MAX_SCORE_CONSISTENCY_DEVIATION,
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
import { deriveAnalysisVerdict } from "./verdict";
import {
  containsHtmlMarkup,
  containsMarkdownCodeBlock,
  findPerformanceClaimViolation,
  findUnsupportedNumericClaim,
  findUnsupportedQuotedSpan,
} from "./grounding";

// ── Transcript-size precondition ──────────────────────────────────────────
// Run before any model call is ever attempted. A transcript that's too
// long can never be fixed by retrying, so this is intentionally a
// separate function from validateCompetitorScriptAnalysis below, not one
// of its retry-worthy failure codes.
export function checkAnalysisTranscriptSize(
  transcript: NormalizedTranscript
): AnalysisSizeCheckResult {
  const actualCharacters = transcript.text.length;

  if (actualCharacters > MAX_ANALYSIS_TRANSCRIPT_CHARACTERS) {
    return {
      ok: false,
      code: "transcript_too_long_for_analysis",
      maxCharacters: MAX_ANALYSIS_TRANSCRIPT_CHARACTERS,
      actualCharacters,
    };
  }

  return { ok: true };
}

// ── Small local type guards ───────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isEnumMember<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): value is T {
  return typeof value === "string" && (allowedValues as readonly string[]).includes(value);
}

function normalizeForComparison(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasNormalizedDuplicate(values: string[]): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    const key = normalizeForComparison(value);
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
}

function segmentEndMs(segment: TranscriptSegment): number {
  return segment.durationMs !== null
    ? segment.startMs + segment.durationMs
    : segment.startMs;
}

function intersectsAnySegment(
  startMs: number,
  endMs: number | null,
  segments: TranscriptSegment[]
): boolean {
  const rangeEnd = endMs ?? startMs;

  return segments.some((segment) => {
    const segStart = segment.startMs;
    const segEnd = segmentEndMs(segment);
    return startMs <= segEnd && rangeEnd >= segStart;
  });
}

// ── Result helpers ─────────────────────────────────────────────────────────

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; code: AnalysisValidationFailureCode; reason: string };
type Checked<T> = Ok<T> | Err;

function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

function err(code: AnalysisValidationFailureCode, reason: string): Err {
  return { ok: false, code, reason };
}

function toResult(failure: Err): CompetitorScriptAnalysisResult {
  return { ok: false, failure: { code: failure.code, reason: failure.reason } };
}

// ── Evidence ───────────────────────────────────────────────────────────────
// The one canonical grounding check, reused for every EvidenceRef in the
// contract (structure beats, strengths, weaknesses, retention risks,
// lessons, caution). Excerpts are never rewritten to "fix" them — an
// exact mismatch is always a hard validation failure.
function validateEvidence(
  candidate: unknown,
  transcript: NormalizedTranscript,
  fieldPath: string,
  allowNull: boolean
): Checked<EvidenceRef | null> {
  if (candidate === null) {
    if (allowNull) {
      return ok(null);
    }
    return err("invalid_evidence", `${fieldPath} is null but evidence is required here`);
  }

  if (!isPlainObject(candidate)) {
    return err("invalid_evidence", `${fieldPath} is not an object`);
  }

  const { excerpt, startMs, endMs } = candidate;

  if (typeof excerpt !== "string" || excerpt.trim().length === 0) {
    return err("invalid_evidence", `${fieldPath}.excerpt is missing or empty`);
  }

  if (excerpt.length > MAX_EVIDENCE_EXCERPT_LENGTH) {
    return err("excessive_content", `${fieldPath}.excerpt exceeds ${MAX_EVIDENCE_EXCERPT_LENGTH} characters`);
  }

  if (!transcript.text.includes(excerpt)) {
    return err(
      "invalid_evidence",
      `${fieldPath}.excerpt is not an exact substring of the transcript`
    );
  }

  if (startMs !== null && !isFiniteNonNegativeInteger(startMs)) {
    return err("invalid_timestamp", `${fieldPath}.startMs is not null or a finite non-negative integer`);
  }

  if (endMs !== null && !isFiniteNonNegativeInteger(endMs)) {
    return err("invalid_timestamp", `${fieldPath}.endMs is not null or a finite non-negative integer`);
  }

  if (startMs !== null && endMs !== null && (endMs as number) < (startMs as number)) {
    return err("invalid_timestamp", `${fieldPath}.endMs is before ${fieldPath}.startMs`);
  }

  if (transcript.durationMs !== null) {
    if (startMs !== null && (startMs as number) > transcript.durationMs) {
      return err("invalid_timestamp", `${fieldPath}.startMs exceeds the transcript's known duration`);
    }
    if (endMs !== null && (endMs as number) > transcript.durationMs) {
      return err("invalid_timestamp", `${fieldPath}.endMs exceeds the transcript's known duration`);
    }
  }

  if (startMs !== null && transcript.segments.length > 0) {
    if (!intersectsAnySegment(startMs as number, endMs as number | null, transcript.segments)) {
      return err(
        "invalid_timestamp",
        `${fieldPath}.startMs does not intersect any real transcript segment`
      );
    }
  }

  return ok({
    excerpt,
    startMs: startMs === null ? null : (startMs as number),
    endMs: endMs === null ? null : (endMs as number),
  });
}

// ── Prose fields ───────────────────────────────────────────────────────────
// Every free-text explanation field goes through this: bounded length, no
// HTML/markdown-code-block artifacts, no prohibited performance claim, no
// unsupported number, no unsupported quoted span. Excerpts (checked via
// validateEvidence above) are exempt — they have their own exact-substring
// rule and are never run through the performance-claim/numeric checks.
function validateProseField(
  candidate: unknown,
  maxLength: number,
  transcript: NormalizedTranscript,
  fieldPath: string
): Checked<string> {
  if (typeof candidate !== "string") {
    return err("invalid_shape", `${fieldPath} is not a string`);
  }

  const trimmed = candidate.trim();

  if (trimmed.length === 0) {
    return err("invalid_shape", `${fieldPath} is empty`);
  }

  if (candidate.length > maxLength) {
    return err("excessive_content", `${fieldPath} exceeds ${maxLength} characters`);
  }

  if (containsHtmlMarkup(candidate)) {
    return err("excessive_content", `${fieldPath} contains HTML markup`);
  }

  if (containsMarkdownCodeBlock(candidate)) {
    return err("excessive_content", `${fieldPath} contains a markdown code block`);
  }

  const claim = findPerformanceClaimViolation(candidate);
  if (claim) {
    return err(
      "unsupported_performance_claim",
      `${fieldPath} contains a prohibited performance claim: "${claim}"`
    );
  }

  const badNumber = findUnsupportedNumericClaim(candidate, transcript.text);
  if (badNumber) {
    return err(
      "unsupported_numeric_claim",
      `${fieldPath} contains a number not present in the transcript: "${badNumber}"`
    );
  }

  const badQuote = findUnsupportedQuotedSpan(candidate, transcript.text);
  if (badQuote) {
    return err(
      "invalid_evidence",
      `${fieldPath} contains a quoted span not found in the transcript: "${badQuote}"`
    );
  }

  return ok(candidate);
}

function validateSeverity(candidate: unknown, fieldPath: string): Checked<Severity> {
  if (!isEnumMember(candidate, SEVERITIES)) {
    return err("invalid_shape", `${fieldPath} is not a valid severity`);
  }
  return ok(candidate);
}

// ── Scores ─────────────────────────────────────────────────────────────────

function validateScores(candidate: unknown): Checked<AnalysisScores> {
  if (!isPlainObject(candidate)) {
    return err("invalid_shape", "scores is not an object");
  }

  const { overallScore, hookScore, structureScore, momentumScore } = candidate;

  for (const [key, value] of Object.entries({
    overallScore,
    hookScore,
    structureScore,
    momentumScore,
  })) {
    if (!isIntegerInRange(value, 0, 100)) {
      return err("invalid_score", `scores.${key} must be an integer between 0 and 100`);
    }
  }

  const scores: AnalysisScores = {
    overallScore: overallScore as number,
    hookScore: hookScore as number,
    structureScore: structureScore as number,
    momentumScore: momentumScore as number,
  };

  const componentMean =
    (scores.hookScore + scores.momentumScore + scores.structureScore) / 3;

  if (Math.abs(scores.overallScore - componentMean) > MAX_SCORE_CONSISTENCY_DEVIATION) {
    return err(
      "inconsistent_scores",
      `overallScore (${scores.overallScore}) deviates from the component mean (${componentMean.toFixed(2)}) by more than ${MAX_SCORE_CONSISTENCY_DEVIATION}`
    );
  }

  return ok(scores);
}

function validateVerdict(
  candidate: unknown,
  scores: AnalysisScores
): Checked<CompetitorScriptAnalysis["verdict"]> {
  if (!isEnumMember(candidate, ANALYSIS_VERDICTS)) {
    return err("invalid_verdict", "verdict is not one of strong/mixed/weak");
  }

  const derived = deriveAnalysisVerdict(scores);

  if (candidate !== derived) {
    return err(
      "invalid_verdict",
      `verdict "${candidate}" does not match the deterministically derived verdict "${derived}"`
    );
  }

  return ok(derived);
}

function validateScoreReasons(
  candidate: unknown,
  transcript: NormalizedTranscript
): Checked<ScoreReason[]> {
  if (!Array.isArray(candidate) || candidate.length !== REQUIRED_SCORE_REASONS) {
    return err(
      "invalid_shape",
      `scoreReasons must contain exactly ${REQUIRED_SCORE_REASONS} entries`
    );
  }

  const reasons: ScoreReason[] = [];

  for (let index = 0; index < candidate.length; index += 1) {
    const item = candidate[index];
    if (!isPlainObject(item)) {
      return err("invalid_shape", `scoreReasons[${index}] is not an object`);
    }
    if (!isEnumMember(item.score, SCORE_KEYS)) {
      return err("invalid_shape", `scoreReasons[${index}].score is not a valid score key`);
    }
    const driver = validateProseField(
      item.driver,
      MAX_EXPLANATION_LENGTH,
      transcript,
      `scoreReasons[${index}].driver`
    );
    if (!driver.ok) {
      return driver;
    }
    reasons.push({ score: item.score, driver: driver.value });
  }

  const keys = reasons.map((reason) => reason.score);
  const uniqueKeys = new Set(keys);

  if (uniqueKeys.size !== SCORE_KEYS.length || !SCORE_KEYS.every((key) => uniqueKeys.has(key))) {
    return err(
      "invalid_shape",
      "scoreReasons must contain exactly one entry for each of overallScore/hookScore/structureScore/momentumScore, with no duplicates"
    );
  }

  return ok(reasons);
}

// ── Structure ──────────────────────────────────────────────────────────────

function validateStructure(
  candidate: unknown,
  transcript: NormalizedTranscript
): Checked<StructureBeat[]> {
  if (
    !Array.isArray(candidate) ||
    candidate.length < MIN_STRUCTURE_BEATS ||
    candidate.length > MAX_STRUCTURE_BEATS
  ) {
    return err(
      "invalid_shape",
      `structure must contain between ${MIN_STRUCTURE_BEATS} and ${MAX_STRUCTURE_BEATS} beats`
    );
  }

  const beats: StructureBeat[] = [];

  for (let index = 0; index < candidate.length; index += 1) {
    const item = candidate[index];
    if (!isPlainObject(item)) {
      return err("invalid_shape", `structure[${index}] is not an object`);
    }

    const label = item.label;
    if (!isEnumMember<StructureBeatLabel>(label, STRUCTURE_BEAT_LABELS)) {
      return err("invalid_shape", `structure[${index}].label is not a valid structure beat label`);
    }

    const evidence = validateEvidence(
      item.evidence,
      transcript,
      `structure[${index}].evidence`,
      false
    );
    if (!evidence.ok) {
      return evidence;
    }

    const purpose = validateProseField(
      item.purpose,
      MAX_BEAT_PURPOSE_LENGTH,
      transcript,
      `structure[${index}].purpose`
    );
    if (!purpose.ok) {
      return purpose;
    }

    const analysis = validateProseField(
      item.analysis,
      MAX_EXPLANATION_LENGTH,
      transcript,
      `structure[${index}].analysis`
    );
    if (!analysis.ok) {
      return analysis;
    }

    beats.push({
      label,
      evidence: evidence.value as EvidenceRef,
      purpose: purpose.value,
      analysis: analysis.value,
    });
  }

  // Chronological only when timestamps are actually available — a beat
  // with a null startMs never blocks this check, it's simply skipped.
  let previousStartMs: number | null = null;
  for (let index = 0; index < beats.length; index += 1) {
    const startMs = beats[index].evidence.startMs;
    if (startMs !== null) {
      if (previousStartMs !== null && startMs < previousStartMs) {
        return err(
          "invalid_timestamp",
          `structure[${index}] is out of chronological order`
        );
      }
      previousStartMs = startMs;
    }
  }

  if (hasNormalizedDuplicate(beats.map((beat) => beat.evidence.excerpt))) {
    return err("duplicate_content", "structure contains an exact duplicate evidence excerpt");
  }

  return ok(beats);
}

// ── Strengths / Weaknesses / Retention risks / Lessons / Caution ──────────

function validateStrengths(
  candidate: unknown,
  transcript: NormalizedTranscript
): Checked<Strength[]> {
  if (!Array.isArray(candidate) || candidate.length < MIN_STRENGTHS || candidate.length > MAX_STRENGTHS) {
    return err("invalid_shape", `strengths must contain between ${MIN_STRENGTHS} and ${MAX_STRENGTHS} items`);
  }

  const items: Strength[] = [];

  for (let index = 0; index < candidate.length; index += 1) {
    const item = candidate[index];
    if (!isPlainObject(item)) {
      return err("invalid_shape", `strengths[${index}] is not an object`);
    }

    const title = validateProseField(
      item.title,
      MAX_CONCISE_LABEL_LENGTH,
      transcript,
      `strengths[${index}].title`
    );
    if (!title.ok) return title;

    const evidence = validateEvidence(item.evidence, transcript, `strengths[${index}].evidence`, false);
    if (!evidence.ok) return evidence;

    const whyItWorks = validateProseField(
      item.whyItWorks,
      MAX_EXPLANATION_LENGTH,
      transcript,
      `strengths[${index}].whyItWorks`
    );
    if (!whyItWorks.ok) return whyItWorks;

    items.push({
      title: title.value,
      evidence: evidence.value as EvidenceRef,
      whyItWorks: whyItWorks.value,
    });
  }

  if (
    hasNormalizedDuplicate(items.map((item) => item.title)) ||
    hasNormalizedDuplicate(items.map((item) => item.evidence.excerpt))
  ) {
    return err("duplicate_content", "strengths contains an exact duplicate title or evidence excerpt");
  }

  return ok(items);
}

function validateWeaknesses(
  candidate: unknown,
  transcript: NormalizedTranscript
): Checked<Weakness[]> {
  if (!Array.isArray(candidate) || candidate.length < MIN_WEAKNESSES || candidate.length > MAX_WEAKNESSES) {
    return err("invalid_shape", `weaknesses must contain between ${MIN_WEAKNESSES} and ${MAX_WEAKNESSES} items`);
  }

  const items: Weakness[] = [];

  for (let index = 0; index < candidate.length; index += 1) {
    const item = candidate[index];
    if (!isPlainObject(item)) {
      return err("invalid_shape", `weaknesses[${index}] is not an object`);
    }

    const issue = validateProseField(
      item.issue,
      MAX_CONCISE_LABEL_LENGTH,
      transcript,
      `weaknesses[${index}].issue`
    );
    if (!issue.ok) return issue;

    const evidence = validateEvidence(item.evidence, transcript, `weaknesses[${index}].evidence`, false);
    if (!evidence.ok) return evidence;

    const whyItMatters = validateProseField(
      item.whyItMatters,
      MAX_EXPLANATION_LENGTH,
      transcript,
      `weaknesses[${index}].whyItMatters`
    );
    if (!whyItMatters.ok) return whyItMatters;

    const severity = validateSeverity(item.severity, `weaknesses[${index}].severity`);
    if (!severity.ok) return severity;

    items.push({
      issue: issue.value,
      evidence: evidence.value as EvidenceRef,
      whyItMatters: whyItMatters.value,
      severity: severity.value,
    });
  }

  if (
    hasNormalizedDuplicate(items.map((item) => item.issue)) ||
    hasNormalizedDuplicate(items.map((item) => item.evidence.excerpt))
  ) {
    return err("duplicate_content", "weaknesses contains an exact duplicate issue or evidence excerpt");
  }

  return ok(items);
}

function validateRetentionRisks(
  candidate: unknown,
  transcript: NormalizedTranscript
): Checked<RetentionRisk[]> {
  if (
    !Array.isArray(candidate) ||
    candidate.length < MIN_RETENTION_RISKS ||
    candidate.length > MAX_RETENTION_RISKS
  ) {
    return err(
      "invalid_shape",
      `retentionRisks must contain between ${MIN_RETENTION_RISKS} and ${MAX_RETENTION_RISKS} items`
    );
  }

  const items: RetentionRisk[] = [];

  for (let index = 0; index < candidate.length; index += 1) {
    const item = candidate[index];
    if (!isPlainObject(item)) {
      return err("invalid_shape", `retentionRisks[${index}] is not an object`);
    }

    const evidence = validateEvidence(item.evidence, transcript, `retentionRisks[${index}].evidence`, false);
    if (!evidence.ok) return evidence;

    // The highest-risk field in the whole contract for an accidental
    // performance claim — it goes through the exact same prose check as
    // everything else, no special-casing, but is called out here so the
    // reason its gets particular scrutiny in review is explicit.
    const risk = validateProseField(
      item.risk,
      MAX_EXPLANATION_LENGTH,
      transcript,
      `retentionRisks[${index}].risk`
    );
    if (!risk.ok) return risk;

    const reason = validateProseField(
      item.reason,
      MAX_EXPLANATION_LENGTH,
      transcript,
      `retentionRisks[${index}].reason`
    );
    if (!reason.ok) return reason;

    const severity = validateSeverity(item.severity, `retentionRisks[${index}].severity`);
    if (!severity.ok) return severity;

    items.push({
      evidence: evidence.value as EvidenceRef,
      risk: risk.value,
      reason: reason.value,
      severity: severity.value,
    });
  }

  if (hasNormalizedDuplicate(items.map((item) => item.evidence.excerpt))) {
    return err("duplicate_content", "retentionRisks contains an exact duplicate evidence excerpt");
  }

  return ok(items);
}

function validateActionableLessons(
  candidate: unknown,
  transcript: NormalizedTranscript
): Checked<ActionableLesson[]> {
  if (
    !Array.isArray(candidate) ||
    candidate.length < MIN_ACTIONABLE_LESSONS ||
    candidate.length > MAX_ACTIONABLE_LESSONS
  ) {
    return err(
      "invalid_shape",
      `actionableLessons must contain between ${MIN_ACTIONABLE_LESSONS} and ${MAX_ACTIONABLE_LESSONS} items`
    );
  }

  const items: ActionableLesson[] = [];

  for (let index = 0; index < candidate.length; index += 1) {
    const item = candidate[index];
    if (!isPlainObject(item)) {
      return err("invalid_shape", `actionableLessons[${index}] is not an object`);
    }

    const principle = validateProseField(
      item.principle,
      MAX_CONCISE_LABEL_LENGTH,
      transcript,
      `actionableLessons[${index}].principle`
    );
    if (!principle.ok) return principle;

    const sourceEvidence = validateEvidence(
      item.sourceEvidence,
      transcript,
      `actionableLessons[${index}].sourceEvidence`,
      false
    );
    if (!sourceEvidence.ok) return sourceEvidence;

    const application = validateProseField(
      item.application,
      MAX_EXPLANATION_LENGTH,
      transcript,
      `actionableLessons[${index}].application`
    );
    if (!application.ok) return application;

    items.push({
      principle: principle.value,
      sourceEvidence: sourceEvidence.value as EvidenceRef,
      application: application.value,
    });
  }

  if (hasNormalizedDuplicate(items.map((item) => item.principle))) {
    return err("duplicate_content", "actionableLessons contains an exact duplicate principle");
  }

  return ok(items);
}

function validateCaution(
  candidate: unknown,
  transcript: NormalizedTranscript
): Checked<CautionItem[]> {
  if (
    !Array.isArray(candidate) ||
    candidate.length < MIN_CAUTION_ITEMS ||
    candidate.length > MAX_CAUTION_ITEMS
  ) {
    return err(
      "invalid_shape",
      `caution must contain between ${MIN_CAUTION_ITEMS} and ${MAX_CAUTION_ITEMS} items`
    );
  }

  const items: CautionItem[] = [];

  for (let index = 0; index < candidate.length; index += 1) {
    const item = candidate[index];
    if (!isPlainObject(item)) {
      return err("invalid_shape", `caution[${index}] is not an object`);
    }

    const whatNotToCopy = validateProseField(
      item.whatNotToCopy,
      MAX_CONCISE_LABEL_LENGTH,
      transcript,
      `caution[${index}].whatNotToCopy`
    );
    if (!whatNotToCopy.ok) return whatNotToCopy;

    const reason = validateProseField(
      item.reason,
      MAX_EXPLANATION_LENGTH,
      transcript,
      `caution[${index}].reason`
    );
    if (!reason.ok) return reason;

    const evidenceRaw = item.evidence === undefined ? null : item.evidence;
    const evidence = validateEvidence(evidenceRaw, transcript, `caution[${index}].evidence`, true);
    if (!evidence.ok) return evidence;

    items.push({
      whatNotToCopy: whatNotToCopy.value,
      reason: reason.value,
      evidence: evidence.value,
    });
  }

  if (hasNormalizedDuplicate(items.map((item) => item.whatNotToCopy))) {
    return err("duplicate_content", "caution contains an exact duplicate whatNotToCopy");
  }

  return ok(items);
}

// ── Top-level validator ────────────────────────────────────────────────────

export type ValidateCompetitorScriptAnalysisInput = {
  candidate: unknown;
  transcript: NormalizedTranscript;
  expectedLocale: AnalysisLocale;
};

// Never throws for ordinary invalid model output — always returns a typed
// result. Deep, deterministic, order-independent of how a future PR 10B
// decides to retry: every failure carries a stable code plus an internal
// diagnostic reason (never shown to end users, never provider output).
export function validateCompetitorScriptAnalysis(
  input: ValidateCompetitorScriptAnalysisInput
): CompetitorScriptAnalysisResult {
  const { candidate, transcript, expectedLocale } = input;

  if (!isPlainObject(candidate)) {
    return toResult(err("invalid_shape", "candidate is not an object"));
  }

  if (candidate.schemaVersion !== 1) {
    return toResult(err("invalid_shape", "schemaVersion must be exactly 1"));
  }

  if (candidate.locale !== "en" && candidate.locale !== "ru") {
    return toResult(err("invalid_shape", "locale must be \"en\" or \"ru\""));
  }

  if (candidate.locale !== expectedLocale) {
    return toResult(
      err(
        "locale_mismatch",
        `candidate locale "${candidate.locale}" does not match expected locale "${expectedLocale}"`
      )
    );
  }

  const scores = validateScores(candidate.scores);
  if (!scores.ok) return toResult(scores);

  const verdict = validateVerdict(candidate.verdict, scores.value);
  if (!verdict.ok) return toResult(verdict);

  const mainTakeaway = validateProseField(
    candidate.mainTakeaway,
    MAX_MAIN_TAKEAWAY_LENGTH,
    transcript,
    "mainTakeaway"
  );
  if (!mainTakeaway.ok) return toResult(mainTakeaway);

  const scoreReasons = validateScoreReasons(candidate.scoreReasons, transcript);
  if (!scoreReasons.ok) return toResult(scoreReasons);

  const structure = validateStructure(candidate.structure, transcript);
  if (!structure.ok) return toResult(structure);

  const strengths = validateStrengths(candidate.strengths, transcript);
  if (!strengths.ok) return toResult(strengths);

  const weaknesses = validateWeaknesses(candidate.weaknesses, transcript);
  if (!weaknesses.ok) return toResult(weaknesses);

  const retentionRisks = validateRetentionRisks(candidate.retentionRisks, transcript);
  if (!retentionRisks.ok) return toResult(retentionRisks);

  const actionableLessons = validateActionableLessons(candidate.actionableLessons, transcript);
  if (!actionableLessons.ok) return toResult(actionableLessons);

  const caution = validateCaution(candidate.caution, transcript);
  if (!caution.ok) return toResult(caution);

  return {
    ok: true,
    analysis: {
      schemaVersion: 1,
      locale: expectedLocale,
      verdict: verdict.value,
      scores: scores.value,
      mainTakeaway: mainTakeaway.value,
      scoreReasons: scoreReasons.value,
      structure: structure.value,
      strengths: strengths.value,
      weaknesses: weaknesses.value,
      retentionRisks: retentionRisks.value,
      actionableLessons: actionableLessons.value,
      caution: caution.value,
    },
  };
}
