import { readFileSync } from "node:fs";

import { LAUNCHED_LOCALES } from "../lib/i18n";
import { getMessages } from "../lib/messages";
import {
  fetchMyAnalyses,
  formatAnalysisCreatedAt,
  parseScoreSummary,
  type AnalysesListClient,
} from "../app/my-analyses/analyses-list";

let failures = 0;

function check(label: string, pass: boolean, detail?: string): void {
  if (pass) {
    console.log(`PASS — ${label}`);
    return;
  }

  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ""}`);
}

const validResult = {
  overall: 90,
  hook: 88,
  retentionRisk: 10,
};

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    title: "A saved analysis",
    created_at: "2026-07-17T12:00:00.000Z",
    locale: "en",
    scores: validResult,
    ...overrides,
  };
}

// Records exactly how it was called, so tests assert the real query shape
// instead of guessing from source text. Deliberately has no `.eq()` (or
// any other filter method) at all — if fetchMyAnalyses ever tried to
// filter by a client-supplied user id, calling a method this mock doesn't
// implement would throw and the test would fail loudly, not silently pass.
function makeClient(rows: unknown[] | null, error: { code?: string } | null = null) {
  const calls: {
    selectColumns?: string;
    orderColumn?: string;
    orderOptions?: { ascending: boolean };
    limitCount?: number;
  } = {};

  const client: AnalysesListClient = {
    from(table) {
      check(`queries the "${table}" table`, table === "analyses");

      return {
        select(columns) {
          calls.selectColumns = columns;

          return {
            order(column, options) {
              calls.orderColumn = column;
              calls.orderOptions = options;

              return {
                limit(count) {
                  calls.limitCount = count;

                  return Promise.resolve({
                    data: rows,
                    error,
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  return { client, calls };
}

async function checkQueryShape(): Promise<void> {
  const { client, calls } = makeClient([makeRow()]);

  const result = await fetchMyAnalyses(client);

  check("the query succeeds against a well-formed mock client", result.ok);

  check(
    "the query is ordered by created_at, newest first",
    calls.orderColumn === "created_at" &&
      calls.orderOptions?.ascending === false
  );

  check(
    "the query has a fixed limit",
    calls.limitCount === 50
  );

  check(
    "the query never selects the full script field",
    typeof calls.selectColumns === "string" &&
      !/(^|[,\s])script($|[,\s:])/.test(calls.selectColumns)
  );

  check(
    "the query never selects the full result_json blob (only the scores sub-path)",
    typeof calls.selectColumns === "string" &&
      !/(^|[,\s])result_json($|[,\s:])/.test(calls.selectColumns) &&
      calls.selectColumns.includes("result_json->scores")
  );

  check(
    "the query never filters or references user_id (RLS is the only ownership boundary)",
    typeof calls.selectColumns === "string" &&
      !calls.selectColumns.includes("user_id")
  );
}

async function checkEmptyState(): Promise<void> {
  const { client } = makeClient([]);
  const result = await fetchMyAnalyses(client);

  check(
    "an empty table produces an empty, successful items list",
    result.ok === true && result.ok && result.items.length === 0
  );
}

async function checkPopulatedState(): Promise<void> {
  const { client } = makeClient([
    makeRow({ id: "row-1", title: "First" }),
    makeRow({ id: "row-2", title: "Second" }),
  ]);
  const result = await fetchMyAnalyses(client);

  check(
    "a populated table returns every well-formed row",
    result.ok === true && result.ok && result.items.length === 2
  );

  if (result.ok) {
    check(
      "items preserve title, locale, createdAt, and parsed scores",
      result.items[0].title === "First" &&
        result.items[0].locale === "en" &&
        result.items[0].createdAt === "2026-07-17T12:00:00.000Z" &&
        result.items[0].scores?.overall === 90
    );
  }
}

async function checkMalformedRowHandling(): Promise<void> {
  const { client } = makeClient([
    makeRow({ id: "row-1", title: "Valid row" }),
    // Malformed scores (wrong shape) — row itself still has valid
    // id/title/created_at/locale, so it must still appear, just with a
    // neutral unavailable-score state instead of invented numbers.
    makeRow({
      id: "row-2",
      title: "Row with malformed scores",
      scores: { overall: "not-a-number", hook: null },
    }),
    // Missing scores entirely.
    makeRow({ id: "row-3", title: "Row with no scores", scores: null }),
    // Critically malformed row (no title) — dropped, but must not crash
    // the whole fetch or the other rows.
    { id: "row-4", title: null, created_at: "2026-07-17T12:00:00.000Z", locale: "en", scores: validResult },
  ]);

  const result = await fetchMyAnalyses(client);

  check(
    "a malformed row does not crash the whole list fetch",
    result.ok === true
  );

  if (result.ok) {
    check(
      "rows with recoverable data (valid id/title/date/locale) are kept even with bad scores",
      result.items.some((item) => item.id === "row-2") &&
        result.items.some((item) => item.id === "row-3")
    );

    check(
      "malformed scores are surfaced as null (unavailable), never invented",
      result.items.find((item) => item.id === "row-2")?.scores === null &&
        result.items.find((item) => item.id === "row-3")?.scores === null
    );

    check(
      "a row missing a required field (title) is dropped, not crashed on",
      !result.items.some((item) => item.id === "row-4")
    );

    check(
      "the well-formed row is still present alongside the malformed ones",
      result.items.some(
        (item) => item.id === "row-1" && item.scores?.overall === 90
      )
    );
  }
}

async function checkDatabaseError(): Promise<void> {
  const { client } = makeClient(null, { code: "42501" });
  const result = await fetchMyAnalyses(client);

  check(
    "a database error is surfaced as a read failure, not a false empty list",
    result.ok === false && result.reason === "database"
  );
}

async function checkUnexpectedClientError(): Promise<void> {
  const client: AnalysesListClient = {
    from() {
      throw new Error("network failure");
    },
  };

  const result = await fetchMyAnalyses(client);

  check(
    "an unexpected client error is caught and surfaced as a database failure",
    result.ok === false && result.reason === "database"
  );
}

function checkParseScoreSummary(): void {
  check(
    "a well-formed scores object parses successfully",
    parseScoreSummary(validResult)?.overall === 90
  );

  check("null scores parse to null", parseScoreSummary(null) === null);
  check(
    "an array is rejected (not treated as an object)",
    parseScoreSummary([1, 2, 3]) === null
  );
  check(
    "non-numeric fields are rejected",
    parseScoreSummary({ overall: "90", hook: 1, retentionRisk: 1 }) === null
  );
  check(
    "NaN/Infinity fields are rejected",
    parseScoreSummary({ overall: NaN, hook: 1, retentionRisk: 1 }) === null &&
      parseScoreSummary({
        overall: Infinity,
        hook: 1,
        retentionRisk: 1,
      }) === null
  );
}

function checkDateFormatting(): void {
  const formatted = formatAnalysisCreatedAt("2026-07-17T12:00:00.000Z");

  check(
    "a valid ISO timestamp formats to a non-empty, human-readable string",
    typeof formatted === "string" && formatted.length > 0
  );

  check(
    "an unparseable timestamp falls back to the raw value instead of throwing",
    formatAnalysisCreatedAt("not-a-date").length > 0
  );
}

function checkMessageCoverage(): void {
  check(
    "myAnalyses empty/error/list keys are covered for every launched locale",
    LAUNCHED_LOCALES.every((locale) => {
      const myAnalyses = getMessages(locale).myAnalyses;

      return (
        myAnalyses.heading.length > 0 &&
        myAnalyses.empty.heading.length > 0 &&
        myAnalyses.empty.description.length > 0 &&
        myAnalyses.error.heading.length > 0 &&
        myAnalyses.error.description.length > 0 &&
        myAnalyses.list.scoreUnavailable.length > 0
      );
    })
  );

  check(
    "EN and RU empty-state headings are actually localized (not identical strings)",
    getMessages("en").myAnalyses.empty.heading !==
      getMessages("ru").myAnalyses.empty.heading
  );
}

// No React/DOM test harness exists in this repo's test suite (see
// tests/login-page-build-safety.ts / tests/results-improve-ui.ts for the
// established pattern), so the page-level wiring that can't be exercised
// as a pure function — the signed-out redirect and which Supabase client
// is used — is verified by checking the page's source shape instead.
function checkPageSourceShape(): void {
  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");

  check(
    "a signed-out visitor is redirected to /login instead of seeing any data",
    /if \(!user\) \{\s*redirect\("\/login\?next=\/my-analyses"\);/.test(
      pageSource
    )
  );

  check(
    "the page fetches with the session-bound (cookie-based) Supabase server client",
    pageSource.includes(
      'import { createSupabaseServerClient } from "../../lib/supabase/server";'
    ) && pageSource.includes("const supabase = await createSupabaseServerClient();")
  );

  check(
    "the page never uses the service-role client or references its secret key",
    !pageSource.includes('from "../../lib/supabase"') &&
      !pageSource.includes("SUPABASE_SECRET_KEY")
  );

  check(
    "the page never adds an explicit .eq() filter (RLS is the only ownership boundary, not a client-supplied user id)",
    !/\.eq\(/.test(pageSource)
  );

  const listModuleSource = readFileSync(
    "app/my-analyses/analyses-list.ts",
    "utf8"
  );

  check(
    "the query module never uses the service-role client or references its secret key",
    !listModuleSource.includes('from "../../lib/supabase"') &&
      !listModuleSource.includes("SUPABASE_SECRET_KEY")
  );

  check(
    "open/delete/rename/rerun are out of scope for this PR (page has no such handlers)",
    !pageSource.includes("handleDelete") &&
      !pageSource.includes("handleRename") &&
      !pageSource.includes("handleRerun") &&
      !pageSource.includes("handleOpen")
  );
}

async function main(): Promise<void> {
  await checkQueryShape();
  await checkEmptyState();
  await checkPopulatedState();
  await checkMalformedRowHandling();
  await checkDatabaseError();
  await checkUnexpectedClientError();
  checkParseScoreSummary();
  checkDateFormatting();
  checkMessageCoverage();
  checkPageSourceShape();

  if (failures > 0) {
    console.error(`\nMy Analyses tests: ${failures} failed`);
    process.exitCode = 1;
  } else {
    console.log("\nMy Analyses tests: all passed");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL — unexpected error: ${message}`);
  process.exitCode = 1;
});
