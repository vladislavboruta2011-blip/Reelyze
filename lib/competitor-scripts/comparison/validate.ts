import type {
  NormalizedTranscript,
  TranscriptSegment,
} from "../transcript/types";
import {
  COMPARISON_DIMENSIONS,
  GAP_LEVELS,
  STRONGER_SIDES,
  type Caution,
  type ComparisonDimension,
  type ComparisonLocale,
  type ComparisonSummary,
  type ComparisonValidationFailureCode,
  type CompetitorScriptComparison,
  type CompetitorScriptComparisonResult,
  type CompetitorTranscriptEvidence,
  type DimensionFinding,
  type GapLevel,
  type Priority,
  type StrongerSide,
  type UserScriptEvidence,
} from "./types";
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
import {
  findCausalClaimViolation,
  findRankingClaimViolation,
  findStrongContrastLanguage,
  findUnsupportedIntentClaim,
  findUnsupportedNumericClaimAcrossSources,
  findUnsupportedProductionClaim,
  findUnsupportedQuotedSpanAcrossSources,
  findVerbatimCompetitorCopy,
} from "./grounding";
// The only cross-import from Analyze: three pure, side-effect-free,
// unchanged functions. One-directional and read-only — Compare depends
// on Analyze's grounding primitives, Analyze is never touched or aware
// of Compare. See docs/product/compare/CONSTITUTION.md.
import {
  containsHtmlMarkup,
  containsMarkdownCodeBlock,
  findPerformanceClaimViolation,
} from "../analysis/grounding";

// ── Small local type guards ───────────────────────────────────────────────
// Duplicated from lib/competitor-scripts/analysis/validate.ts, which
// does not export these — small, safe duplication rather than reaching
// into Analyze's internals.

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

// Strict-shape helper: every object in the contract is checked against
// its exact expected key set — an unexpected property is always a hard
// validation failure, never silently ignored.
function hasOnlyExpectedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

// ── Result helpers ─────────────────────────────────────────────────────────

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; code: ComparisonValidationFailureCode; reason: string };
type Checked<T> = Ok<T> | Err;

function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

function err(code: ComparisonValidationFailureCode, reason: string): Err {
  return { ok: false, code, reason };
}

function toResult(failure: Err): CompetitorScriptComparisonResult {
  return { ok: false, failure: { code: failure.code, reason: failure.reason } };
}

// ── Evidence ───────────────────────────────────────────────────────────────

const USER_SCRIPT_EVIDENCE_KEYS = ["source", "excerpt"] as const;

function validateUserScriptEvidence(
  candidate: unknown,
  userScript: string,
  fieldPath: string
): Checked<UserScriptEvidence> {
  if (!isPlainObject(candidate)) {
    return err("invalid_shape", `${fieldPath} is not an object`);
  }

  if (!hasOnlyExpectedKeys(candidate, USER_SCRIPT_EVIDENCE_KEYS)) {
    return err("invalid_shape", `${fieldPath} has unexpected properties`);
  }

  if (candidate.source !== "user") {
    return err("invalid_evidence_source", `${fieldPath}.source must be "user"`);
  }

  const { excerpt } = candidate;

  if (typeof excerpt !== "string" || excerpt.trim().length === 0) {
    return err("empty_field", `${fieldPath}.excerpt is missing or empty`);
  }

  if (excerpt.length > MAX_EVIDENCE_EXCERPT_LENGTH) {
    return err(
      "field_too_long",
      `${fieldPath}.excerpt exceeds ${MAX_EVIDENCE_EXCERPT_LENGTH} characters`
    );
  }

  if (!userScript.includes(excerpt)) {
    return err(
      "user_excerpt_not_found",
      `${fieldPath}.excerpt is not an exact substring of the user script`
    );
  }

  return ok({ source: "user", excerpt });
}

const COMPETITOR_TRANSCRIPT_EVIDENCE_KEYS = ["source", "excerpt", "startMs", "endMs"] as const;

function validateCompetitorTranscriptEvidence(
  candidate: unknown,
  competitorTranscript: NormalizedTranscript,
  fieldPath: string
): Checked<CompetitorTranscriptEvidence> {
  if (!isPlainObject(candidate)) {
    return err("invalid_shape", `${fieldPath} is not an object`);
  }

  if (!hasOnlyExpectedKeys(candidate, COMPETITOR_TRANSCRIPT_EVIDENCE_KEYS)) {
    return err("invalid_shape", `${fieldPath} has unexpected properties`);
  }

  if (candidate.source !== "competitor") {
    return err("invalid_evidence_source", `${fieldPath}.source must be "competitor"`);
  }

  const { excerpt, startMs, endMs } = candidate;

  if (typeof excerpt !== "string" || excerpt.trim().length === 0) {
    return err("empty_field", `${fieldPath}.excerpt is missing or empty`);
  }

  if (excerpt.length > MAX_EVIDENCE_EXCERPT_LENGTH) {
    return err(
      "field_too_long",
      `${fieldPath}.excerpt exceeds ${MAX_EVIDENCE_EXCERPT_LENGTH} characters`
    );
  }

  if (!competitorTranscript.text.includes(excerpt)) {
    return err(
      "competitor_excerpt_not_found",
      `${fieldPath}.excerpt is not an exact substring of the competitor transcript`
    );
  }

  if (!isFiniteNonNegativeInteger(startMs)) {
    return err(
      "invalid_competitor_timestamp",
      `${fieldPath}.startMs must be a finite non-negative integer`
    );
  }

  if (endMs !== null && !isFiniteNonNegativeInteger(endMs)) {
    return err(
      "invalid_competitor_timestamp",
      `${fieldPath}.endMs must be null or a finite non-negative integer`
    );
  }

  if (endMs !== null && (endMs as number) < startMs) {
    return err(
      "invalid_competitor_timestamp",
      `${fieldPath}.endMs is before ${fieldPath}.startMs`
    );
  }

  if (competitorTranscript.durationMs !== null) {
    if (startMs > competitorTranscript.durationMs) {
      return err(
        "invalid_competitor_timestamp",
        `${fieldPath}.startMs exceeds the transcript's known duration`
      );
    }
    if (endMs !== null && (endMs as number) > competitorTranscript.durationMs) {
      return err(
        "invalid_competitor_timestamp",
        `${fieldPath}.endMs exceeds the transcript's known duration`
      );
    }
  }

  if (competitorTranscript.segments.length > 0) {
    if (!intersectsAnySegment(startMs, endMs === null ? null : (endMs as number), competitorTranscript.segments)) {
      return err(
        "competitor_evidence_not_segment_grounded",
        `${fieldPath}.startMs does not intersect any real transcript segment`
      );
    }
  }

  return ok({
    source: "competitor",
    excerpt,
    startMs,
    endMs: endMs === null ? null : (endMs as number),
  });
}

// ── Prose fields ───────────────────────────────────────────────────────────
// Every free-text field goes through this: bounded length, no
// HTML/markdown-code-block artifacts, no prohibited performance/ranking/
// causal/production/intent claim, no unsupported number, no unsupported
// quoted span. Excerpts (checked via the evidence validators above) are
// exempt — they have their own exact-substring rule.
function validateProseField(
  candidate: unknown,
  maxLength: number,
  userScript: string,
  competitorTranscript: NormalizedTranscript,
  fieldPath: string
): Checked<string> {
  if (typeof candidate !== "string") {
    return err("invalid_shape", `${fieldPath} is not a string`);
  }

  const trimmed = candidate.trim();

  if (trimmed.length === 0) {
    return err("empty_field", `${fieldPath} is empty`);
  }

  if (candidate.length > maxLength) {
    return err("field_too_long", `${fieldPath} exceeds ${maxLength} characters`);
  }

  if (containsHtmlMarkup(candidate)) {
    return err("invalid_shape", `${fieldPath} contains HTML markup`);
  }

  if (containsMarkdownCodeBlock(candidate)) {
    return err("invalid_shape", `${fieldPath} contains a markdown code block`);
  }

  const performanceClaim = findPerformanceClaimViolation(candidate);
  if (performanceClaim) {
    return err(
      "unsupported_performance_claim",
      `${fieldPath} contains a prohibited performance claim: "${performanceClaim}"`
    );
  }

  const rankingClaim = findRankingClaimViolation(candidate);
  if (rankingClaim) {
    return err(
      "unsupported_performance_claim",
      `${fieldPath} contains prohibited ranking/winner language: "${rankingClaim}"`
    );
  }

  const causalClaim = findCausalClaimViolation(candidate);
  if (causalClaim) {
    return err(
      "unsupported_causal_claim",
      `${fieldPath} contains a prohibited causal claim: "${causalClaim}"`
    );
  }

  const productionClaim = findUnsupportedProductionClaim(candidate);
  if (productionClaim) {
    return err(
      "unsupported_production_claim",
      `${fieldPath} contains an unsupported production/visual claim: "${productionClaim}"`
    );
  }

  const intentClaim = findUnsupportedIntentClaim(candidate);
  if (intentClaim) {
    return err(
      "unsupported_intent_claim",
      `${fieldPath} contains an unsupported creator-intent claim: "${intentClaim}"`
    );
  }

  const badNumber = findUnsupportedNumericClaimAcrossSources(candidate, userScript, competitorTranscript);
  if (badNumber) {
    return err(
      "unsupported_numeric_claim",
      `${fieldPath} contains a number not grounded in either source: "${badNumber}"`
    );
  }

  const badQuote = findUnsupportedQuotedSpanAcrossSources(candidate, userScript, competitorTranscript);
  if (badQuote) {
    return err(
      "unsupported_quote",
      `${fieldPath} contains a quoted span not found in either source: "${badQuote}"`
    );
  }

  return ok(candidate);
}

// Instructional prose (competitorPrinciple, howToApply only) additionally
// goes through the verbatim-copy guardrail — never applied to any other
// field, and never to the evidence excerpt itself.
function validateInstructionalProseField(
  candidate: unknown,
  maxLength: number,
  userScript: string,
  competitorTranscript: NormalizedTranscript,
  fieldPath: string
): Checked<string> {
  const base = validateProseField(candidate, maxLength, userScript, competitorTranscript, fieldPath);
  if (!base.ok) {
    return base;
  }

  const copiedPhrase = findVerbatimCompetitorCopy(base.value, competitorTranscript);
  if (copiedPhrase) {
    return err(
      "copy_instruction",
      `${fieldPath} reproduces a long verbatim competitor phrase: "${copiedPhrase}"`
    );
  }

  return ok(base.value);
}

// Deliberately narrow, bare-phrase-only match — never a substring scan
// across longer prose, per the "no fragile NLP heuristics" instruction.
// Scoped to priorities.problem and priorities.howToApply only, where a
// lazy, ungrounded instruction would most plausibly appear.
const GENERIC_FEEDBACK_PHRASES = [
  "make it more engaging",
  "improve the hook",
  "make it better",
  "add more emotion",
];

function isGenericFeedback(value: string): boolean {
  const normalized = normalizeForComparison(value).replace(/[.!?]+$/, "");
  return GENERIC_FEEDBACK_PHRASES.includes(normalized);
}

// ── Comparison summary ──────────────────────────────────────────────────────

const COMPARISON_SUMMARY_KEYS = ["headline", "mainTakeaway"] as const;

function validateComparisonSummary(
  candidate: unknown,
  userScript: string,
  competitorTranscript: NormalizedTranscript
): Checked<ComparisonSummary> {
  if (!isPlainObject(candidate)) {
    return err("invalid_shape", "comparisonSummary is not an object");
  }

  if (!hasOnlyExpectedKeys(candidate, COMPARISON_SUMMARY_KEYS)) {
    return err("invalid_shape", "comparisonSummary has unexpected properties");
  }

  const headline = validateProseField(
    candidate.headline,
    MAX_HEADLINE_LENGTH,
    userScript,
    competitorTranscript,
    "comparisonSummary.headline"
  );
  if (!headline.ok) return headline;

  const mainTakeaway = validateProseField(
    candidate.mainTakeaway,
    MAX_MAIN_TAKEAWAY_LENGTH,
    userScript,
    competitorTranscript,
    "comparisonSummary.mainTakeaway"
  );
  if (!mainTakeaway.ok) return mainTakeaway;

  if (normalizeForComparison(headline.value) === normalizeForComparison(mainTakeaway.value)) {
    return err(
      "duplicate_content",
      "comparisonSummary.mainTakeaway must not be a normalized duplicate of headline"
    );
  }

  return ok({ headline: headline.value, mainTakeaway: mainTakeaway.value });
}

// ── Dimension findings ───────────────────────────────────────────────────

const DIMENSION_FINDING_KEYS = [
  "dimension",
  "strongerSide",
  "gap",
  "conclusion",
  "userObservation",
  "competitorObservation",
  "evidence",
] as const;

const DIMENSION_EVIDENCE_KEYS = ["user", "competitor"] as const;

function validateDimensionFindings(
  candidate: unknown,
  userScript: string,
  competitorTranscript: NormalizedTranscript
): Checked<DimensionFinding[]> {
  if (!Array.isArray(candidate) || candidate.length !== REQUIRED_DIMENSION_COUNT) {
    return err(
      "invalid_dimension_set",
      `dimensionFindings must contain exactly ${REQUIRED_DIMENSION_COUNT} entries`
    );
  }

  // Set check first (catches missing/duplicate dimensions together),
  // independent of position.
  const rawDimensions = candidate.map((item) =>
    isPlainObject(item) && typeof item.dimension === "string" ? item.dimension : null
  );
  const uniqueDimensions = new Set(rawDimensions);
  const isValidSet =
    uniqueDimensions.size === REQUIRED_DIMENSION_COUNT &&
    COMPARISON_DIMENSIONS.every((dimension) => uniqueDimensions.has(dimension));

  if (!isValidSet) {
    return err(
      "invalid_dimension_set",
      "dimensionFindings must contain exactly one entry for each of hook/structure/momentum/payoff_clarity"
    );
  }

  // Order check, only meaningful once the set itself is confirmed
  // correct — a wrong-order failure should never be confused with a
  // missing/duplicate-dimension failure.
  for (let index = 0; index < COMPARISON_DIMENSIONS.length; index += 1) {
    if (rawDimensions[index] !== COMPARISON_DIMENSIONS[index]) {
      return err(
        "invalid_dimension_order",
        `dimensionFindings[${index}] must be "${COMPARISON_DIMENSIONS[index]}"`
      );
    }
  }

  const findings: DimensionFinding[] = [];

  for (let index = 0; index < candidate.length; index += 1) {
    const item = candidate[index];
    const fieldPath = `dimensionFindings[${index}]`;

    if (!isPlainObject(item)) {
      return err("invalid_shape", `${fieldPath} is not an object`);
    }

    if (!hasOnlyExpectedKeys(item, DIMENSION_FINDING_KEYS)) {
      return err("invalid_shape", `${fieldPath} has unexpected properties`);
    }

    const dimension = item.dimension as ComparisonDimension;

    if (!isEnumMember<StrongerSide>(item.strongerSide, STRONGER_SIDES)) {
      return err("invalid_stronger_side", `${fieldPath}.strongerSide is not a valid value`);
    }
    const strongerSide = item.strongerSide;

    if (item.gap === undefined) {
      return err(
        "invalid_gap",
        `${fieldPath}.gap is missing (must be present, either null or a valid gap level)`
      );
    }
    const gapCandidate = item.gap;

    if (strongerSide === "similar") {
      if (gapCandidate !== null) {
        return err("invalid_gap", `${fieldPath}.gap must be null when strongerSide is "similar"`);
      }
    } else if (!isEnumMember<GapLevel>(gapCandidate, GAP_LEVELS)) {
      return err(
        "invalid_gap",
        `${fieldPath}.gap must be a valid value when strongerSide is not "similar"`
      );
    }
    const gap = (strongerSide === "similar" ? null : gapCandidate) as GapLevel | null;

    const conclusion = validateProseField(
      item.conclusion,
      MAX_DIMENSION_CONCLUSION_LENGTH,
      userScript,
      competitorTranscript,
      `${fieldPath}.conclusion`
    );
    if (!conclusion.ok) return conclusion;

    const userObservation = validateProseField(
      item.userObservation,
      MAX_DIMENSION_OBSERVATION_LENGTH,
      userScript,
      competitorTranscript,
      `${fieldPath}.userObservation`
    );
    if (!userObservation.ok) return userObservation;

    const competitorObservation = validateProseField(
      item.competitorObservation,
      MAX_DIMENSION_OBSERVATION_LENGTH,
      userScript,
      competitorTranscript,
      `${fieldPath}.competitorObservation`
    );
    if (!competitorObservation.ok) return competitorObservation;

    // "similar" must never be described with strong advantage/
    // disadvantage language. Outright ranking/performance words are
    // already impossible here (validateProseField above already rejects
    // them on every field, similar or not) — this catches the milder
    // remaining case: "far better", "much stronger", etc.
    if (strongerSide === "similar") {
      const strongLanguageFields = [conclusion.value, userObservation.value, competitorObservation.value];
      for (const fieldValue of strongLanguageFields) {
        if (findStrongContrastLanguage(fieldValue)) {
          return err(
            "invalid_stronger_side",
            `${fieldPath} describes a "similar" finding with strong advantage/disadvantage language`
          );
        }
      }
    }

    const evidenceCandidate = item.evidence;
    if (!isPlainObject(evidenceCandidate) || !hasOnlyExpectedKeys(evidenceCandidate, DIMENSION_EVIDENCE_KEYS)) {
      return err("invalid_shape", `${fieldPath}.evidence is not a valid object`);
    }

    const userEvidence = validateUserScriptEvidence(
      evidenceCandidate.user,
      userScript,
      `${fieldPath}.evidence.user`
    );
    if (!userEvidence.ok) return userEvidence;

    const competitorEvidence = validateCompetitorTranscriptEvidence(
      evidenceCandidate.competitor,
      competitorTranscript,
      `${fieldPath}.evidence.competitor`
    );
    if (!competitorEvidence.ok) return competitorEvidence;

    findings.push({
      dimension,
      strongerSide,
      gap,
      conclusion: conclusion.value,
      userObservation: userObservation.value,
      competitorObservation: competitorObservation.value,
      evidence: { user: userEvidence.value, competitor: competitorEvidence.value },
    });
  }

  if (hasNormalizedDuplicate(findings.map((finding) => finding.conclusion))) {
    return err("duplicate_content", "dimensionFindings contains duplicate conclusions");
  }

  if (hasNormalizedDuplicate(findings.map((finding) => finding.userObservation))) {
    return err("duplicate_content", "dimensionFindings contains duplicate userObservation values");
  }

  if (hasNormalizedDuplicate(findings.map((finding) => finding.competitorObservation))) {
    return err("duplicate_content", "dimensionFindings contains duplicate competitorObservation values");
  }

  return ok(findings);
}

// ── Priorities ─────────────────────────────────────────────────────────────

const PRIORITY_KEYS = ["rank", "problem", "competitorPrinciple", "howToApply", "evidence"] as const;
const PRIORITY_EVIDENCE_KEYS = ["user", "competitor"] as const;

function validatePriorities(
  candidate: unknown,
  userScript: string,
  competitorTranscript: NormalizedTranscript
): Checked<Priority[]> {
  if (!Array.isArray(candidate) || candidate.length < MIN_PRIORITIES || candidate.length > MAX_PRIORITIES) {
    return err(
      "invalid_priority_count",
      `priorities must contain between ${MIN_PRIORITIES} and ${MAX_PRIORITIES} items`
    );
  }

  const priorities: Priority[] = [];

  for (let index = 0; index < candidate.length; index += 1) {
    const item = candidate[index];
    const fieldPath = `priorities[${index}]`;

    if (!isPlainObject(item)) {
      return err("invalid_shape", `${fieldPath} is not an object`);
    }

    if (!hasOnlyExpectedKeys(item, PRIORITY_KEYS)) {
      return err("invalid_shape", `${fieldPath} has unexpected properties`);
    }

    if (item.rank !== index + 1) {
      return err("invalid_priority_rank", `${fieldPath}.rank must be ${index + 1}`);
    }

    const problem = validateProseField(
      item.problem,
      MAX_PRIORITY_PROBLEM_LENGTH,
      userScript,
      competitorTranscript,
      `${fieldPath}.problem`
    );
    if (!problem.ok) return problem;

    if (isGenericFeedback(problem.value)) {
      return err("generic_feedback", `${fieldPath}.problem is generic filler without grounded specificity`);
    }

    const competitorPrinciple = validateInstructionalProseField(
      item.competitorPrinciple,
      MAX_PRIORITY_COMPETITOR_PRINCIPLE_LENGTH,
      userScript,
      competitorTranscript,
      `${fieldPath}.competitorPrinciple`
    );
    if (!competitorPrinciple.ok) return competitorPrinciple;

    const howToApply = validateInstructionalProseField(
      item.howToApply,
      MAX_PRIORITY_HOW_TO_APPLY_LENGTH,
      userScript,
      competitorTranscript,
      `${fieldPath}.howToApply`
    );
    if (!howToApply.ok) return howToApply;

    if (isGenericFeedback(howToApply.value)) {
      return err("generic_feedback", `${fieldPath}.howToApply is generic filler without grounded specificity`);
    }

    const evidenceCandidate = item.evidence;
    if (!isPlainObject(evidenceCandidate) || !hasOnlyExpectedKeys(evidenceCandidate, PRIORITY_EVIDENCE_KEYS)) {
      return err("invalid_shape", `${fieldPath}.evidence is not a valid object`);
    }

    const userEvidence = validateUserScriptEvidence(
      evidenceCandidate.user,
      userScript,
      `${fieldPath}.evidence.user`
    );
    if (!userEvidence.ok) return userEvidence;

    const competitorEvidence = validateCompetitorTranscriptEvidence(
      evidenceCandidate.competitor,
      competitorTranscript,
      `${fieldPath}.evidence.competitor`
    );
    if (!competitorEvidence.ok) return competitorEvidence;

    priorities.push({
      rank: item.rank,
      problem: problem.value,
      competitorPrinciple: competitorPrinciple.value,
      howToApply: howToApply.value,
      evidence: { user: userEvidence.value, competitor: competitorEvidence.value },
    });
  }

  if (hasNormalizedDuplicate(priorities.map((priority) => priority.problem))) {
    return err("duplicate_content", "priorities contains duplicate problem statements");
  }

  if (hasNormalizedDuplicate(priorities.map((priority) => priority.howToApply))) {
    return err("duplicate_content", "priorities contains duplicate howToApply instructions");
  }

  return ok(priorities);
}

// ── Cautions ───────────────────────────────────────────────────────────────

const CAUTION_KEYS = ["whatNotToCopy", "reason", "evidence"] as const;
const CAUTION_EVIDENCE_KEYS = ["competitor", "user"] as const;

function validateCautions(
  candidate: unknown,
  userScript: string,
  competitorTranscript: NormalizedTranscript
): Checked<Caution[]> {
  if (!Array.isArray(candidate) || candidate.length < MIN_CAUTIONS || candidate.length > MAX_CAUTIONS) {
    return err(
      "invalid_caution_count",
      `cautions must contain between ${MIN_CAUTIONS} and ${MAX_CAUTIONS} items`
    );
  }

  const cautions: Caution[] = [];

  for (let index = 0; index < candidate.length; index += 1) {
    const item = candidate[index];
    const fieldPath = `cautions[${index}]`;

    if (!isPlainObject(item)) {
      return err("invalid_shape", `${fieldPath} is not an object`);
    }

    if (!hasOnlyExpectedKeys(item, CAUTION_KEYS)) {
      return err("invalid_shape", `${fieldPath} has unexpected properties`);
    }

    const whatNotToCopy = validateProseField(
      item.whatNotToCopy,
      MAX_CAUTION_WHAT_NOT_TO_COPY_LENGTH,
      userScript,
      competitorTranscript,
      `${fieldPath}.whatNotToCopy`
    );
    if (!whatNotToCopy.ok) return whatNotToCopy;

    const reason = validateProseField(
      item.reason,
      MAX_CAUTION_REASON_LENGTH,
      userScript,
      competitorTranscript,
      `${fieldPath}.reason`
    );
    if (!reason.ok) return reason;

    const evidenceCandidate = item.evidence;
    if (!isPlainObject(evidenceCandidate) || !hasOnlyExpectedKeys(evidenceCandidate, CAUTION_EVIDENCE_KEYS)) {
      return err("invalid_shape", `${fieldPath}.evidence is not a valid object`);
    }

    const competitorEvidence = validateCompetitorTranscriptEvidence(
      evidenceCandidate.competitor,
      competitorTranscript,
      `${fieldPath}.evidence.competitor`
    );
    if (!competitorEvidence.ok) return competitorEvidence;

    // user is a required property (never omitted) that may be null —
    // undefined is a hard shape error, never silently coerced to null,
    // so a malformed candidate can't quietly slip past.
    if (evidenceCandidate.user === undefined) {
      return err(
        "invalid_shape",
        `${fieldPath}.evidence.user is missing (must be null or a UserScriptEvidence object)`
      );
    }

    let userEvidence: UserScriptEvidence | null = null;
    if (evidenceCandidate.user !== null) {
      const validatedUserEvidence = validateUserScriptEvidence(
        evidenceCandidate.user,
        userScript,
        `${fieldPath}.evidence.user`
      );
      if (!validatedUserEvidence.ok) return validatedUserEvidence;
      userEvidence = validatedUserEvidence.value;
    }

    cautions.push({
      whatNotToCopy: whatNotToCopy.value,
      reason: reason.value,
      evidence: { competitor: competitorEvidence.value, user: userEvidence },
    });
  }

  if (hasNormalizedDuplicate(cautions.map((caution) => caution.whatNotToCopy))) {
    return err("duplicate_content", "cautions contains duplicate whatNotToCopy statements");
  }

  return ok(cautions);
}

// ── Top-level validator ────────────────────────────────────────────────────

const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "locale",
  "comparisonSummary",
  "dimensionFindings",
  "priorities",
  "cautions",
] as const;

export type ValidateCompetitorScriptComparisonInput = {
  candidate: unknown;
  userScript: string;
  competitorTranscript: NormalizedTranscript;
  expectedLocale: ComparisonLocale;
};

// Never throws for ordinary invalid model output — always returns a
// typed result. Every failure carries a stable code plus an internal
// diagnostic reason (never shown to end users, never provider output).
export function validateCompetitorScriptComparison(
  input: ValidateCompetitorScriptComparisonInput
): CompetitorScriptComparisonResult {
  const { candidate, userScript, competitorTranscript, expectedLocale } = input;

  if (!isPlainObject(candidate)) {
    return toResult(err("invalid_shape", "candidate is not an object"));
  }

  if (!hasOnlyExpectedKeys(candidate, TOP_LEVEL_KEYS)) {
    return toResult(err("invalid_shape", "candidate has unexpected top-level properties"));
  }

  if (candidate.schemaVersion !== 1) {
    return toResult(err("invalid_schema_version", "schemaVersion must be exactly 1"));
  }

  if (candidate.locale !== "en" && candidate.locale !== "ru") {
    return toResult(err("invalid_locale", 'locale must be "en" or "ru"'));
  }

  if (candidate.locale !== expectedLocale) {
    return toResult(
      err(
        "invalid_locale",
        `candidate locale "${candidate.locale}" does not match expected locale "${expectedLocale}"`
      )
    );
  }

  const comparisonSummary = validateComparisonSummary(candidate.comparisonSummary, userScript, competitorTranscript);
  if (!comparisonSummary.ok) return toResult(comparisonSummary);

  const dimensionFindings = validateDimensionFindings(candidate.dimensionFindings, userScript, competitorTranscript);
  if (!dimensionFindings.ok) return toResult(dimensionFindings);

  const priorities = validatePriorities(candidate.priorities, userScript, competitorTranscript);
  if (!priorities.ok) return toResult(priorities);

  const cautions = validateCautions(candidate.cautions, userScript, competitorTranscript);
  if (!cautions.ok) return toResult(cautions);

  const comparison: CompetitorScriptComparison = {
    schemaVersion: 1,
    locale: expectedLocale,
    comparisonSummary: comparisonSummary.value,
    dimensionFindings: dimensionFindings.value,
    priorities: priorities.value,
    cautions: cautions.value,
  };

  return { ok: true, comparison };
}
