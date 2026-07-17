import type { AnalysisV2Result } from "../../engine/analysis-v2-schema";

// Mirrors engine/analysis-v2-schema.ts's ANALYSIS_V2_LIMITS and the
// supabase/migrations/20260717120000_create_analyses_table.sql CHECK
// constraints (analyses_script_length / analyses_title_length). This is the
// results page's own storage-validation boundary, so the values are kept
// here rather than re-imported — update both places together if either
// limit ever changes.
export const MAX_SCRIPT_CHARACTERS = 1000;
export const MAX_TITLE_CHARACTERS = 200;

// The only locales the "analyses" table's `analyses_locale_allowed` CHECK
// constraint accepts — mirrors engine/analysis-v2-schema.ts's
// AnalysisV2Locale, the only locales Analysis V2 ever actually writes
// explanations in.
const SAVE_ANALYSIS_LOCALES = ["en", "ru"] as const;
export type SaveAnalysisLocale = (typeof SAVE_ANALYSIS_LOCALES)[number];

function isSaveAnalysisLocale(
  value: string
): value is SaveAnalysisLocale {
  return SAVE_ANALYSIS_LOCALES.some((locale) => locale === value);
}

// --- Deterministic default title ----------------------------------------

// Used only when the user left the optional title field blank on the
// landing page. Deliberately does not read from any other stored state —
// the original script (already validated and present on the results page)
// is the only input, so the result is reproducible for the same script.
export function generateDefaultAnalysisTitle(
  userTitle: string,
  script: string,
  untitledFallback: string,
  maxLength: number = MAX_TITLE_CHARACTERS
): string {
  const trimmedUserTitle = userTitle.trim();

  if (trimmedUserTitle.length > 0) {
    return trimmedUserTitle.length > maxLength
      ? trimmedUserTitle.slice(0, maxLength).trim()
      : trimmedUserTitle;
  }

  const firstMeaningfulLine =
    script
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .find((line) => line.length > 0) ?? "";

  if (firstMeaningfulLine.length === 0) {
    return untitledFallback;
  }

  return firstMeaningfulLine.length > maxLength
    ? firstMeaningfulLine.slice(0, maxLength).trim()
    : firstMeaningfulLine;
}

// --- Pending save intent (survives the Google OAuth redirect) -----------
//
// sessionStorage-only, scoped to this browser tab — the same mechanism
// this page already relies on for the analysis itself (reelyze-script /
// reelyze-title / ANALYSIS_V2_STORAGE_KEY, read on mount), which is why it
// reliably survives the full-page navigation to Google and back through
// /auth/callback to /results. This never holds a token, session, or
// credential — and, critically, never holds the raw script/title/model
// either: only a one-way SHA-256 digest of them, so the stored value on
// its own reveals nothing about the analysis it refers to.
const PENDING_SAVE_STORAGE_KEY = "climpy-pending-save-analysis";

// Bumped whenever the hashed input shape changes, so a fingerprint written
// by an older build can never be misread as matching under a new one — it
// simply won't have this prefix and gets treated as stale.
const SAVE_FINGERPRINT_VERSION = "v1";

export type PendingSaveIntent = {
  fingerprint: string;
};

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// A versioned SHA-256 digest of the analysis identity — never the raw
// script, title, result, model string, user id, or any credential. The
// hashed canonical string exists only as a local variable for the
// duration of this call; nothing but the resulting digest is ever
// returned, logged, or persisted.
export async function createSaveAnalysisFingerprint(input: {
  script: string;
  title: string;
  locale: string;
  modelUsed: string;
}): Promise<string> {
  const canonical = JSON.stringify({
    v: SAVE_FINGERPRINT_VERSION,
    script: input.script.trim(),
    title: input.title.trim(),
    locale: input.locale,
    modelUsed: input.modelUsed.trim(),
  });

  const digestBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical)
  );

  return `${SAVE_FINGERPRINT_VERSION}:${toHex(digestBuffer)}`;
}

export function writePendingSaveIntent(fingerprint: string): void {
  try {
    sessionStorage.setItem(
      PENDING_SAVE_STORAGE_KEY,
      JSON.stringify({ fingerprint })
    );
  } catch {
    // sessionStorage unavailable — the explicit Save click that requested
    // this simply won't auto-complete after sign-in; the user can still
    // click Save again once back on /results signed in.
  }
}

export function readPendingSaveIntent(): PendingSaveIntent | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SAVE_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const fingerprint = (parsed as Record<string, unknown>).fingerprint;

    if (typeof fingerprint !== "string" || fingerprint.length === 0) {
      return null;
    }

    return { fingerprint };
  } catch {
    return null;
  }
}

export function clearPendingSaveIntent(): void {
  try {
    sessionStorage.removeItem(PENDING_SAVE_STORAGE_KEY);
  } catch {
    // best-effort cleanup only — a leftover key is re-validated by its
    // fingerprint before ever being acted on.
  }
}

// --- Validation before insert ---------------------------------------------

export type SaveAnalysisValidationReason = "auth" | "validation";

export type SaveAnalysisValidationResult =
  | { ok: true }
  | { ok: false; reason: SaveAnalysisValidationReason };

export function validateAnalysisForSave(input: {
  hasSession: boolean;
  script: string;
  title: string;
  locale: string;
  result: unknown;
  modelUsed: string;
}): SaveAnalysisValidationResult {
  if (!input.hasSession) {
    return { ok: false, reason: "auth" };
  }

  const script = input.script.trim();

  if (script.length === 0 || script.length > MAX_SCRIPT_CHARACTERS) {
    return { ok: false, reason: "validation" };
  }

  const title = input.title.trim();

  if (title.length === 0 || title.length > MAX_TITLE_CHARACTERS) {
    return { ok: false, reason: "validation" };
  }

  if (!isSaveAnalysisLocale(input.locale)) {
    return { ok: false, reason: "validation" };
  }

  // The full validated-result shape is already enforced by
  // parseStoredAnalysisV2 (engine/analysis-v2-ui-adapter.ts) when the
  // analysis was loaded from sessionStorage on mount — savedAnalysisV2
  // cannot exist on this page's state without having passed that. This is
  // just a defensive plain-object check immediately before the insert, not
  // a second full re-validation.
  if (
    typeof input.result !== "object" ||
    input.result === null ||
    Array.isArray(input.result)
  ) {
    return { ok: false, reason: "validation" };
  }

  if (input.modelUsed.trim().length === 0) {
    return { ok: false, reason: "validation" };
  }

  return { ok: true };
}

// --- Insert -----------------------------------------------------------

export type AnalysesInsertRow = {
  user_id: string;
  title: string;
  script: string;
  locale: SaveAnalysisLocale;
  result_json: AnalysisV2Result;
  model_used: string;
};

export type SaveAnalysisInsertResult =
  | { ok: true; id: string }
  | { ok: false; reason: "database" };

// Minimal client surface this needs — an authenticated, RLS-bound
// supabase-js client (lib/supabase/browser.ts's supabaseBrowser). Kept as
// a narrow structural type rather than the full SupabaseClient so this can
// be exercised with a mock in tests without a live database. Never the
// service-role client from lib/supabase.ts — RLS on public.analyses is
// what actually enforces one-owner-per-row here, not this code.
export type AnalysesInsertClient = {
  from(table: "analyses"): {
    insert(row: AnalysesInsertRow): {
      select(columns: "id"): {
        // PromiseLike, not Promise: supabase-js's query builder is
        // thenable but doesn't implement the full Promise interface
        // (catch/finally/Symbol.toStringTag) until awaited.
        single(): PromiseLike<{
          data: { id: string } | null;
          error: { code?: string } | null;
        }>;
      };
    };
  };
};

export async function insertAnalysis(
  client: AnalysesInsertClient,
  row: AnalysesInsertRow
): Promise<SaveAnalysisInsertResult> {
  try {
    const { data, error } = await client
      .from("analyses")
      .insert(row)
      .select("id")
      .single();

    // Never claim success without a real inserted id — an error, a missing
    // row, or a malformed id are all treated as a database failure.
    if (
      error ||
      !data ||
      typeof data.id !== "string" ||
      data.id.trim().length === 0
    ) {
      // Deliberately logs only the error code, never `row` (script,
      // result_json) or the full `error` object (which some Postgres
      // errors embed offending values in via DETAIL).
      console.error("Failed to save analysis", {
        code: error?.code ?? null,
      });

      return { ok: false, reason: "database" };
    }

    return { ok: true, id: data.id };
  } catch {
    console.error("Failed to save analysis: unexpected error");
    return { ok: false, reason: "database" };
  }
}
