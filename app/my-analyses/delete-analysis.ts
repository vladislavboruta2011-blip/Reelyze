import { isValidAnalysisId } from "./[id]/fetch-analysis";

export type DeleteAnalysisResult =
  | { ok: true }
  // Covers both "no row with this id exists" and "a row exists but is
  // owned by someone else" — RLS's analyses_delete_own policy (auth.uid()
  // = user_id) makes those two cases indistinguishable at the query level
  // (both delete zero rows, no error), matching
  // app/my-analyses/[id]/fetch-analysis.ts's fetchAnalysisById "not-found"
  // rationale. They must stay indistinguishable to the caller too.
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "database" };

// Minimal client surface this needs — an authenticated, RLS-bound
// supabase-js client (lib/supabase/browser.ts's supabaseBrowser), matching
// the narrow structural-type pattern already used by
// app/my-analyses/analyses-list.ts's AnalysesListClient and
// app/results/save-analysis.ts's AnalysesInsertClient. Never the
// service-role client — RLS is what actually enforces "only my own row"
// here, not this code, and no user id is ever passed into the query for
// that reason.
//
// .select("id") after .delete() (rather than a bare delete) is what makes
// "zero rows affected" observable at all: supabase-js's default delete
// response carries no row count, so without requesting the deleted rows
// back there would be no way to distinguish "deleted my own row" from
// "matched nothing" — and a bare "no error" must never be reported as
// success on its own.
export type AnalysesDeleteClient = {
  from(table: "analyses"): {
    delete(): {
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

export async function deleteAnalysis(
  client: AnalysesDeleteClient,
  id: string
): Promise<DeleteAnalysisResult> {
  // Never a real row id — treated as not-found without a database
  // round-trip, same rationale as fetchAnalysisById's own id check.
  if (!isValidAnalysisId(id)) {
    return { ok: false, reason: "not-found" };
  }

  try {
    const { data, error } = await client
      .from("analyses")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      // Deliberately logs only the error code — never the query result or
      // the full error object, which could otherwise carry a user's saved
      // title via Postgres's DETAIL.
      console.error("Failed to delete analysis", { code: error.code ?? null });
      return { ok: false, reason: "database" };
    }

    const deletedRows = data ?? [];

    // Zero rows affected is never treated as success — it's either a
    // nonexistent id or someone else's row (RLS's using clause silently
    // excludes it), and those two cases must stay indistinguishable here.
    if (deletedRows.length === 0) {
      return { ok: false, reason: "not-found" };
    }

    return { ok: true };
  } catch {
    console.error("Failed to delete analysis: unexpected error");
    return { ok: false, reason: "database" };
  }
}
