import type { AnalysisV2Scores } from "../../engine/analysis-v2-schema";

// Fixed cap on what a single request ever fetches — client-side Pagination
// (analyses-search.tsx) pages through whatever is fetched here, but this
// cap is still the ceiling on how many of a user's saved analyses are ever
// visible at all (there is no follow-up query for rows beyond this). 200
// keeps a single request small (see MY_ANALYSES_SELECT_COLUMNS below — no
// script/result_json blob) while covering realistic usage at this product
// stage; true server-side range pagination (and an exact total count) is a
// deliberately deferred, separate future feature.
const MY_ANALYSES_LIMIT = 200;

// Only the columns the list actually renders: no `script` (full original
// script text) and no full `result_json` blob — `result_json->scores` asks
// Postgres/PostgREST to project out just the small `scores` sub-object
// (overall/hook/retentionRisk), not the complete validated result
// (scoreBreakdown, riskyParts, suggestedFixes, scenes, mainTakeaway, ...).
const MY_ANALYSES_SELECT_COLUMNS =
  "id, title, created_at, locale, scores:result_json->scores";

export type MyAnalysesListItem = {
  id: string;
  title: string;
  createdAt: string;
  locale: string;
  scores: AnalysisV2Scores | null;
};

type AnalysesListRow = {
  id: unknown;
  title: unknown;
  created_at: unknown;
  locale: unknown;
  scores: unknown;
};

export type FetchMyAnalysesResult =
  | { ok: true; items: MyAnalysesListItem[] }
  | { ok: false; reason: "database" };

// Minimal client surface this needs — an authenticated, RLS-bound
// supabase-js client (lib/supabase/server.ts's createSupabaseServerClient).
// Kept as a narrow structural type, matching app/results/save-analysis.ts's
// AnalysesInsertClient, so this can be exercised with a mock in tests
// without a live database. Never the service-role client from
// lib/supabase.ts — RLS on public.analyses (auth.uid() = user_id) is what
// actually enforces "only my own rows" here, not this code, and no user id
// is ever passed into the query for that reason.
export type AnalysesListClient = {
  from(table: "analyses"): {
    select(columns: string): {
      order(
        column: "created_at",
        options: { ascending: false }
      ): {
        limit(count: number): PromiseLike<{
          data: unknown[] | null;
          error: { code?: string } | null;
        }>;
      };
    };
  };
};

// A row-level parse failure (missing/wrong-shaped id, title, created_at, or
// locale) makes that one row unusable and it is dropped — but must never
// throw and take down the rest of the list.
function parseRow(raw: unknown): MyAnalysesListItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const row = raw as AnalysesListRow;

  if (
    typeof row.id !== "string" ||
    row.id.length === 0 ||
    typeof row.title !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.locale !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    locale: row.locale,
    scores: parseScoreSummary(row.scores),
  };
}

// A malformed/missing `scores` value must never crash the list or invent a
// score — it just means this one card shows a neutral "unavailable" state
// instead of numbers. Deliberately does not clamp or coerce values: a
// present-but-out-of-range number is passed through as-is (the display
// layer's problem, not silently hidden here), only genuinely wrong shapes
// (missing keys, non-numbers, NaN/Infinity) are rejected.
export function parseScoreSummary(
  raw: unknown
): AnalysisV2Scores | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const { overall, hook, retentionRisk } = value;

  if (
    typeof overall !== "number" ||
    typeof hook !== "number" ||
    typeof retentionRisk !== "number" ||
    !Number.isFinite(overall) ||
    !Number.isFinite(hook) ||
    !Number.isFinite(retentionRisk)
  ) {
    return null;
  }

  return { overall, hook, retentionRisk };
}

export async function fetchMyAnalyses(
  client: AnalysesListClient
): Promise<FetchMyAnalysesResult> {
  try {
    const { data, error } = await client
      .from("analyses")
      .select(MY_ANALYSES_SELECT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(MY_ANALYSES_LIMIT);

    if (error) {
      // Deliberately logs only the error code — never the query result,
      // which could otherwise carry a user's saved titles.
      console.error("Failed to load My Analyses", {
        code: error.code ?? null,
      });

      return { ok: false, reason: "database" };
    }

    const rows = data ?? [];
    const items: MyAnalysesListItem[] = [];

    for (const row of rows) {
      const parsed = parseRow(row);

      // One malformed row is dropped, not fatal — the rest of the list
      // still renders. (Every currently-writable row satisfies the
      // migration's NOT NULL/CHECK constraints on id/title/created_at/
      // locale, so this really only guards `scores`-shaped surprises and
      // any future relaxation of those constraints, not today's schema.)
      if (parsed) {
        items.push(parsed);
      }
    }

    return { ok: true, items };
  } catch {
    console.error("Failed to load My Analyses: unexpected error");
    return { ok: false, reason: "database" };
  }
}

export function formatAnalysisCreatedAt(isoTimestamp: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoTimestamp));
  } catch {
    return isoTimestamp;
  }
}
