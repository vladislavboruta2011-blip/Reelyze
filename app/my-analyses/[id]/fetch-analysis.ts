import {
  validateAnalysisV2Result,
} from "../../../engine/analysis-v2-validation";
import type {
  AnalysisV2Locale,
  AnalysisV2Result,
} from "../../../engine/analysis-v2-schema";

// Every column the "open saved analysis" experience needs to reproduce the
// exact Results page a user saw when they saved — no more (never selects
// user_id; RLS is the only ownership boundary, matching
// app/my-analyses/analyses-list.ts's existing rationale).
const ANALYSIS_BY_ID_SELECT_COLUMNS =
  "id, title, script, locale, result_json, model_used";

// Matches public.analyses's gen_random_uuid() primary key shape. Checked
// before ever touching the database: a value that can't possibly be a row
// id is treated as not-found without a wasted round-trip, and — more
// importantly — without depending on how Postgres/PostgREST happens to
// report an invalid uuid literal (a fragile thing to pattern-match on).
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidAnalysisId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

export type SavedAnalysis = {
  id: string;
  title: string;
  script: string;
  locale: AnalysisV2Locale;
  result: AnalysisV2Result;
  modelUsed: string;
};

export type FetchAnalysisByIdResult =
  | { status: "found"; analysis: SavedAnalysis }
  // Covers both "no row with this id exists" and "a row exists but is
  // owned by someone else" — RLS's analyses_select_own policy makes those
  // two cases indistinguishable at the query level, and they must stay
  // indistinguishable to the caller too: telling them apart would leak
  // which ids belong to another user.
  | { status: "not-found" }
  // The row exists and is owned by the caller, but result_json no longer
  // satisfies validateAnalysisV2Result (e.g. written by a since-changed
  // shape). Distinct from not-found: the row is real, just unusable.
  | { status: "invalid" }
  | { status: "database-error" };

// Minimal client surface this needs — an authenticated, RLS-bound
// supabase-js client (lib/supabase/server.ts's createSupabaseServerClient),
// matching the narrow structural-type pattern already used by
// app/my-analyses/analyses-list.ts's AnalysesListClient and
// app/results/save-analysis.ts's AnalysesInsertClient. Never the
// service-role client — RLS is what actually enforces "only my own row"
// here, not this code.
export type AnalysisByIdClient = {
  from(table: "analyses"): {
    select(columns: string): {
      eq(
        column: "id",
        value: string
      ): {
        maybeSingle(): PromiseLike<{
          data: unknown;
          error: { code?: string } | null;
        }>;
      };
    };
  };
};

type AnalysisByIdRow = {
  id: unknown;
  title: unknown;
  script: unknown;
  locale: unknown;
  result_json: unknown;
  model_used: unknown;
};

function isAnalysisV2Locale(
  value: unknown
): value is AnalysisV2Locale {
  return value === "en" || value === "ru";
}

export async function fetchAnalysisById(
  client: AnalysisByIdClient,
  id: string
): Promise<FetchAnalysisByIdResult> {
  let data: unknown;
  let error: { code?: string } | null;

  try {
    ({ data, error } = await client
      .from("analyses")
      .select(ANALYSIS_BY_ID_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle());
  } catch {
    console.error("Failed to load analysis: unexpected error");
    return { status: "database-error" };
  }

  if (error) {
    // Deliberately logs only the error code — never the query result,
    // which could otherwise carry a user's saved script or title.
    console.error("Failed to load analysis", { code: error.code ?? null });
    return { status: "database-error" };
  }

  if (!data || typeof data !== "object") {
    return { status: "not-found" };
  }

  const row = data as AnalysisByIdRow;

  if (
    typeof row.id !== "string" ||
    row.id.length === 0 ||
    typeof row.title !== "string" ||
    typeof row.script !== "string" ||
    typeof row.model_used !== "string" ||
    row.model_used.trim().length === 0 ||
    !isAnalysisV2Locale(row.locale)
  ) {
    return { status: "invalid" };
  }

  const validation = validateAnalysisV2Result(
    row.result_json,
    row.script,
    row.locale
  );

  if (!validation.ok) {
    return { status: "invalid" };
  }

  return {
    status: "found",
    analysis: {
      id: row.id,
      title: row.title,
      script: row.script,
      locale: row.locale,
      result: validation.value,
      modelUsed: row.model_used,
    },
  };
}
