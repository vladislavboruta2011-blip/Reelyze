import { isValidAnalysisId } from "./[id]/fetch-analysis";

// Mirrors engine/analysis-v2-schema.ts's ANALYSIS_V2_LIMITS and the
// supabase/migrations/20260717120000_create_analyses_table.sql
// analyses_title_length CHECK constraint — the same value as
// app/results/save-analysis.ts's own MAX_TITLE_CHARACTERS, redeclared here
// rather than cross-imported, matching how app/page.tsx and
// app/results/page.tsx each already keep their own local copy of this
// constant. Update all of them together if this limit ever changes.
export const MAX_TITLE_CHARACTERS = 200;

export type ValidateRenameTitleResult =
  | { ok: true; title: string }
  | { ok: false; reason: "empty" | "too-long" };

// Trims first, matching app/results/save-analysis.ts's
// validateAnalysisForSave own trim-then-check order — the migration's
// analyses_title_not_blank constraint uses btrim(title), so a
// whitespace-only value is blank at the database level too and must be
// rejected here before ever reaching it. Never truncates: unlike
// generateDefaultAnalysisTitle's auto-generated-fallback path, this is a
// direct user edit, so an over-long title is rejected, not silently cut.
export function validateRenameTitle(
  rawTitle: string
): ValidateRenameTitleResult {
  const title = rawTitle.trim();

  if (title.length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (title.length > MAX_TITLE_CHARACTERS) {
    return { ok: false, reason: "too-long" };
  }

  return { ok: true, title };
}

export type RenameAnalysisResult =
  | { ok: true }
  | { ok: false; reason: "invalid-title" }
  // Covers both "no row with this id exists" and "a row exists but is
  // owned by someone else" — RLS's analyses_update_own policy (auth.uid()
  // = user_id) makes those two cases indistinguishable at the query level
  // (both update zero rows, no error), matching
  // app/my-analyses/delete-analysis.ts's own not-found rationale. They must
  // stay indistinguishable to the caller too.
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "database" };

// Minimal client surface this needs — an authenticated, RLS-bound
// supabase-js client (lib/supabase/browser.ts's supabaseBrowser), matching
// the narrow structural-type pattern already used by
// app/my-analyses/delete-analysis.ts's AnalysesDeleteClient and
// app/results/save-analysis.ts's AnalysesInsertClient. Never the
// service-role client — RLS is what actually enforces "only my own row"
// here, not this code, and no user id is ever passed into the query for
// that reason. The update payload is deliberately typed to allow only
// `title` — never user_id, script, result_json, or model_used.
//
// .select("id") after .update() (rather than a bare update) is what makes
// "zero rows affected" observable at all, mirroring deleteAnalysis's own
// rationale: supabase-js's default update response carries no row count,
// so without requesting the updated row back there would be no way to
// distinguish "renamed my own row" from "matched nothing".
export type AnalysesRenameClient = {
  from(table: "analyses"): {
    update(values: { title: string }): {
      eq(
        column: "id",
        value: string
      ): {
        select(columns: "id"): PromiseLike<{
          data: unknown[] | null;
          error: { code?: string } | null;
        }>;
      };
    };
  };
};

export async function renameAnalysis(
  client: AnalysesRenameClient,
  id: string,
  rawTitle: string
): Promise<RenameAnalysisResult> {
  // Never a real row id — treated as not-found without a database
  // round-trip, same rationale as deleteAnalysis's own id check.
  if (!isValidAnalysisId(id)) {
    return { ok: false, reason: "not-found" };
  }

  // Callers (RenameAnalysisDialog) validate before ever calling this, for
  // immediate inline feedback — this is a defense-in-depth safety net, not
  // the primary validation path, so it gets its own distinct reason rather
  // than being conflated with a real database failure.
  const validation = validateRenameTitle(rawTitle);

  if (!validation.ok) {
    return { ok: false, reason: "invalid-title" };
  }

  try {
    const { data, error } = await client
      .from("analyses")
      .update({ title: validation.title })
      .eq("id", id)
      .select("id");

    if (error) {
      // Deliberately logs only the error code — never the query result or
      // the full error object, which could otherwise carry a user's saved
      // title via Postgres's DETAIL.
      console.error("Failed to rename analysis", { code: error.code ?? null });
      return { ok: false, reason: "database" };
    }

    const updatedRows = data ?? [];

    // Zero rows affected is never treated as success — it's either a
    // nonexistent id or someone else's row (RLS's using clause silently
    // excludes it), and those two cases must stay indistinguishable here.
    if (updatedRows.length === 0) {
      return { ok: false, reason: "not-found" };
    }

    return { ok: true };
  } catch {
    console.error("Failed to rename analysis: unexpected error");
    return { ok: false, reason: "database" };
  }
}
