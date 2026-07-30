// Browser-only, ephemeral handoff between the Compare form and the Compare
// Results page. Never imports a server-only module (no provider, no
// process.env) — this file must be safe to bundle into client code.
//
// Unlike lib/competitor-scripts/analyze-result-storage.ts, this module
// deliberately does NOT call the real validateCompetitorScriptComparison —
// that validator requires the real competitor transcript (to check every
// excerpt is an exact substring and every timestamp intersects a real
// segment), and the transcript is intentionally never transported to the
// client. Re-running grounding here is therefore impossible, not merely
// skipped for convenience. This is a lightweight structural transport
// guard only: it proves the stored value has the right shape so a
// tampered/corrupted entry can never crash the Results page, but it does
// not re-prove anything the backend already proved once (excerpt
// grounding, claim/quote/number checks, plagiarism detection).
import {
  isValidYouTubeVideoId,
  normalizeYouTubeVideoUrl,
} from "@/lib/competitor-scripts/youtube-url";
import {
  COMPARISON_DIMENSIONS,
  GAP_LEVELS,
  STRONGER_SIDES,
  type CompetitorScriptComparison,
} from "@/lib/competitor-scripts/comparison/types";
import {
  MAX_CAUTIONS,
  MAX_PRIORITIES,
  MIN_CAUTIONS,
  MIN_PRIORITIES,
  REQUIRED_DIMENSION_COUNT,
} from "@/lib/competitor-scripts/comparison/constants";

export const COMPARE_RESULT_STORAGE_KEY = "climpy:competitor-compare-result:v1";

const STORAGE_VERSION = 1;
const MAX_CANONICAL_URL_LENGTH = 2048;

export type CompareSourceMeta = {
  videoId: string;
  canonicalUrl: string;
  durationMs: number | null;
  userScriptCharacterCount: number;
};

// The exact shape ever written to sessionStorage — comparison and
// sourceMeta are stored exactly as the API returned them, nothing added,
// nothing derived. Never stores: the full competitor transcript, raw model
// output, internal validator reasons, provider internals, the original
// (non-canonical) competitor URL, a duplicate locale field, or the full
// userScript.
export type PersistedCompareResult = {
  v: 1;
  createdAt: number;
  comparison: CompetitorScriptComparison;
  sourceMeta: CompareSourceMeta;
};

export type StoredCompareResult = PersistedCompareResult;

// The exact safe DTO shape the compare API returns on success — the input
// this module accepts when writing a fresh result after a real API call.
export type CompareSuccessPayload = {
  comparison: CompetitorScriptComparison;
  sourceMeta: CompareSourceMeta;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isEnumMember<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): value is T {
  return typeof value === "string" && (allowedValues as readonly string[]).includes(value);
}

// { source: "user", excerpt } — no timing fields, matching
// UserScriptEvidence's shape exactly (see comparison/types.ts).
function isValidUserEvidence(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }

  return value.source === "user" && isNonEmptyString(value.excerpt);
}

// { source: "competitor", excerpt, startMs, endMs } — endMs is required but
// nullable.
function isValidCompetitorEvidence(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }

  if (value.source !== "competitor" || !isNonEmptyString(value.excerpt)) {
    return false;
  }

  if (!isFiniteNonNegativeNumber(value.startMs)) {
    return false;
  }

  return value.endMs === null || isFiniteNonNegativeNumber(value.endMs);
}

function isValidDimensionFinding(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }

  const { dimension, strongerSide, gap, conclusion, userObservation, competitorObservation, evidence } = value;

  if (!isEnumMember(dimension, COMPARISON_DIMENSIONS)) {
    return false;
  }

  if (!isEnumMember(strongerSide, STRONGER_SIDES)) {
    return false;
  }

  // gap is a required field, present (non-null) iff strongerSide !==
  // "similar" — the exact rule the real validator enforces. Checking the
  // correlation here too costs nothing extra and is still purely
  // structural (no source text involved), unlike grounding.
  if (strongerSide === "similar") {
    if (gap !== null) {
      return false;
    }
  } else if (!isEnumMember(gap, GAP_LEVELS)) {
    return false;
  }

  if (
    !isNonEmptyString(conclusion) ||
    !isNonEmptyString(userObservation) ||
    !isNonEmptyString(competitorObservation)
  ) {
    return false;
  }

  if (!isPlainObject(evidence)) {
    return false;
  }

  return isValidUserEvidence(evidence.user) && isValidCompetitorEvidence(evidence.competitor);
}

function isValidPriority(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }

  const { rank, problem, competitorPrinciple, howToApply, evidence } = value;

  if (typeof rank !== "number" || !Number.isInteger(rank) || rank < 1) {
    return false;
  }

  if (!isNonEmptyString(problem) || !isNonEmptyString(competitorPrinciple) || !isNonEmptyString(howToApply)) {
    return false;
  }

  if (!isPlainObject(evidence)) {
    return false;
  }

  return isValidUserEvidence(evidence.user) && isValidCompetitorEvidence(evidence.competitor);
}

function isValidCaution(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }

  const { whatNotToCopy, reason, evidence } = value;

  if (!isNonEmptyString(whatNotToCopy) || !isNonEmptyString(reason)) {
    return false;
  }

  if (!isPlainObject(evidence)) {
    return false;
  }

  if (!isValidCompetitorEvidence(evidence.competitor)) {
    return false;
  }

  // user is a required property (never omitted) that may be null — an
  // absent key is a hard shape failure, never silently treated as null.
  if (!("user" in evidence)) {
    return false;
  }

  return evidence.user === null || isValidUserEvidence(evidence.user);
}

function isValidComparison(value: unknown): value is CompetitorScriptComparison {
  if (!isPlainObject(value)) {
    return false;
  }

  if (value.schemaVersion !== 1) {
    return false;
  }

  if (value.locale !== "en" && value.locale !== "ru") {
    return false;
  }

  const { comparisonSummary, dimensionFindings, priorities, cautions } = value;

  if (!isPlainObject(comparisonSummary)) {
    return false;
  }

  if (
    !isNonEmptyString(comparisonSummary.headline) ||
    !isNonEmptyString(comparisonSummary.mainTakeaway)
  ) {
    return false;
  }

  if (!Array.isArray(dimensionFindings) || dimensionFindings.length !== REQUIRED_DIMENSION_COUNT) {
    return false;
  }

  // Fixed order is a shape property here, not a grounding one — the real
  // validator guarantees it server-side, but a tampered sessionStorage
  // entry could still claim an out-of-order array, so this is re-checked.
  for (let index = 0; index < COMPARISON_DIMENSIONS.length; index += 1) {
    const finding = dimensionFindings[index];
    if (!isPlainObject(finding) || finding.dimension !== COMPARISON_DIMENSIONS[index]) {
      return false;
    }
  }

  if (!dimensionFindings.every(isValidDimensionFinding)) {
    return false;
  }

  if (
    !Array.isArray(priorities) ||
    priorities.length < MIN_PRIORITIES ||
    priorities.length > MAX_PRIORITIES ||
    !priorities.every(isValidPriority)
  ) {
    return false;
  }

  if (
    !Array.isArray(cautions) ||
    cautions.length < MIN_CAUTIONS ||
    cautions.length > MAX_CAUTIONS ||
    !cautions.every(isValidCaution)
  ) {
    return false;
  }

  return true;
}

function isValidSourceMeta(value: unknown): value is CompareSourceMeta {
  if (!isPlainObject(value)) {
    return false;
  }

  const { videoId, canonicalUrl, durationMs, userScriptCharacterCount } = value;

  if (typeof videoId !== "string" || !isValidYouTubeVideoId(videoId)) {
    return false;
  }

  if (
    typeof canonicalUrl !== "string" ||
    canonicalUrl.length === 0 ||
    canonicalUrl.length > MAX_CANONICAL_URL_LENGTH
  ) {
    return false;
  }

  const normalizedCanonicalUrl = normalizeYouTubeVideoUrl(canonicalUrl);
  if (!normalizedCanonicalUrl.ok || normalizedCanonicalUrl.videoId !== videoId) {
    return false;
  }

  if (durationMs !== null && !isFiniteNonNegativeNumber(durationMs)) {
    return false;
  }

  return isFiniteNonNegativeNumber(userScriptCharacterCount);
}

// The same lightweight structural guard applied to a fresh API response,
// before it is ever wrapped into a storage envelope or navigated to — the
// one place both the form (pre-write) and validateStoredCompareResult
// below (pre-read) share the exact same per-field checks, never two
// independently-drifting shape guards.
export function isValidCompareSuccessPayload(
  value: unknown
): value is CompareSuccessPayload {
  if (!isPlainObject(value) || value.ok !== true) {
    return false;
  }

  return isValidComparison(value.comparison) && isValidSourceMeta(value.sourceMeta);
}

// Sessionstorage is user-writable — every field is re-validated from
// scratch, never trusted just because it parsed as JSON. Never throws for
// ordinary malformed input; always returns null instead.
export function validateStoredCompareResult(value: unknown): StoredCompareResult | null {
  if (!isPlainObject(value)) {
    return null;
  }

  if (value.v !== STORAGE_VERSION) {
    return null;
  }

  if (!isFiniteNonNegativeNumber(value.createdAt)) {
    return null;
  }

  if (!isValidComparison(value.comparison)) {
    return null;
  }

  if (!isValidSourceMeta(value.sourceMeta)) {
    return null;
  }

  return {
    v: STORAGE_VERSION,
    createdAt: value.createdAt,
    comparison: value.comparison,
    sourceMeta: value.sourceMeta,
  };
}

// Never throws — storage may be unavailable (private browsing, disabled
// storage) or hold a malformed/tampered/stale-version value, and neither
// case should crash the Results page.
export function readStoredCompareResult(): StoredCompareResult | null {
  try {
    const raw = sessionStorage.getItem(COMPARE_RESULT_STORAGE_KEY);

    if (raw === null) {
      return null;
    }

    return validateStoredCompareResult(JSON.parse(raw));
  } catch {
    return null;
  }
}

// A new successful Compare submission always overwrites any previous
// result — there is only ever one "most recent" result per tab. Never
// cleared after a read: a refresh must be able to restore the page without
// spending another paid API request.
export function writeStoredCompareResult(payload: CompareSuccessPayload): void {
  const result: PersistedCompareResult = {
    v: STORAGE_VERSION,
    createdAt: Date.now(),
    comparison: payload.comparison,
    sourceMeta: payload.sourceMeta,
  };

  try {
    sessionStorage.setItem(COMPARE_RESULT_STORAGE_KEY, JSON.stringify(result));
  } catch {
    // Storage unavailable — the caller's own success/failure flow is the
    // source of truth, not this best-effort persistence step.
  }
}
