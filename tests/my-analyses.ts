import { readFileSync } from "node:fs";

import { LAUNCHED_LOCALES } from "../lib/i18n";
import { getMessages } from "../lib/messages";
import {
  fetchMyAnalyses,
  formatAnalysisCreatedAt,
  parseScoreSummary,
  type AnalysesListClient,
  type MyAnalysesListItem,
} from "../app/my-analyses/analyses-list";
import {
  PAGE_SIZE,
  filterAnalysesByRisk,
  filterAnalysesByTitle,
  getTotalPages,
  paginateAnalyses,
} from "../app/my-analyses/analyses-search";

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
    "the query has a fixed limit of 200 (raised from 50 to give client-side Pagination more to page through)",
    calls.limitCount === 200
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

function makeItem(overrides: Partial<MyAnalysesListItem> = {}): MyAnalysesListItem {
  return {
    id: "item-1",
    title: "An analysis",
    createdAt: "2026-07-17T12:00:00.000Z",
    locale: "en",
    scores: { overall: 80, hook: 80, retentionRisk: 10 },
    ...overrides,
  };
}

// Pure, dependency-free functions (no React/context) imported directly from
// analyses-search.tsx and executed here — unlike the source-text-shape
// checks elsewhere in this file (see checkDashboardShape's comment on why
// this repo has no React/DOM test harness), these can be, and are, called
// and asserted on directly.
function checkPaginationHelpers(): void {
  check("PAGE_SIZE is exactly 10", PAGE_SIZE === 10);

  check(
    "getTotalPages never returns fewer than 1 page, even for an empty list",
    getTotalPages(0) === 1
  );
  check(
    "getTotalPages rounds up a partial final page",
    getTotalPages(10) === 1 &&
      getTotalPages(11) === 2 &&
      getTotalPages(25) === 3 &&
      getTotalPages(200) === 20
  );

  const twentyFiveItems = Array.from({ length: 25 }, (_, index) =>
    makeItem({ id: `item-${index + 1}`, title: `Analysis ${index + 1}` })
  );

  check(
    "paginateAnalyses returns exactly PAGE_SIZE items for a full page",
    paginateAnalyses(twentyFiveItems, 1).length === 10 &&
      paginateAnalyses(twentyFiveItems, 1)[0]?.id === "item-1" &&
      paginateAnalyses(twentyFiveItems, 1)[9]?.id === "item-10"
  );
  check(
    "paginateAnalyses returns the remainder on the final partial page",
    paginateAnalyses(twentyFiveItems, 3).length === 5 &&
      paginateAnalyses(twentyFiveItems, 3)[0]?.id === "item-21" &&
      paginateAnalyses(twentyFiveItems, 3)[4]?.id === "item-25"
  );
  check(
    "paginateAnalyses returns an empty page past the end of the list (clamping is the caller's job, not this pure slice)",
    paginateAnalyses(twentyFiveItems, 5).length === 0
  );

  check(
    "default page is page 1 in spirit: paginateAnalyses(items, 1) is the natural starting page",
    paginateAnalyses(twentyFiveItems, 1)[0]?.id === "item-1"
  );

  // Composition order: Search, then Risk Filter, then Pagination — over the
  // *complete* combined Search+Filter result, never the raw list. Built so
  // that doing Pagination first (or Search/Filter after) would produce a
  // visibly different, wrong page: 12 matching and 12 non-matching items
  // are interleaved, so any 10-item raw page mixes both — pre-paginating
  // and then searching only ever finds a handful of matches per page,
  // while searching first finds all 12 matches before paginating.
  const mixedItems = Array.from({ length: 24 }, (_, index) =>
    index % 2 === 0
      ? makeItem({
          id: `match-${index / 2 + 1}`,
          title: `Hook analysis ${index / 2 + 1}`,
          scores: { overall: 80, hook: 80, retentionRisk: 10 },
        })
      : makeItem({
          id: `nomatch-${(index - 1) / 2 + 1}`,
          title: `Retention piece ${(index - 1) / 2 + 1}`,
          scores: { overall: 80, hook: 80, retentionRisk: 10 },
        })
  );

  const searchedThenPaginated = paginateAnalyses(
    filterAnalysesByRisk(filterAnalysesByTitle(mixedItems, "hook"), "all"),
    1
  );
  const paginatedThenSearched = filterAnalysesByTitle(
    paginateAnalyses(mixedItems, 1),
    "hook"
  );

  check(
    "pagination operates on the full Search+Filter result, not a pre-paginated slice",
    searchedThenPaginated.length === 10 &&
      searchedThenPaginated.every((item) => item.id.startsWith("match-")) &&
      // Proof the order matters: pre-paginating page 1 of the raw,
      // interleaved 24-item list (10 items, half match/half not) and only
      // then searching "hook" finds far fewer matches than searching the
      // complete list first.
      paginatedThenSearched.length === 5
  );

  // Null-score filtering behavior is unchanged by adding Pagination: still
  // visible under "all", still excluded from every specific tier.
  const withNullScore = [
    makeItem({ id: "has-score", scores: { overall: 80, hook: 80, retentionRisk: 70 } }),
    makeItem({ id: "no-score", scores: null }),
  ];

  check(
    "null-score rows remain visible under the All filter and excluded from a specific tier, unaffected by pagination",
    filterAnalysesByRisk(withNullScore, "all").length === 2 &&
      filterAnalysesByRisk(withNullScore, "high").length === 1 &&
      filterAnalysesByRisk(withNullScore, "high")[0]?.id === "has-score"
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
    "myAnalyses.loading heading/description are covered, non-empty, and plain strings for every launched locale",
    LAUNCHED_LOCALES.every((locale) => {
      const loading = getMessages(locale).myAnalyses.loading;

      return (
        typeof loading.heading === "string" &&
        loading.heading.length > 0 &&
        typeof loading.description === "string" &&
        loading.description.length > 0
      );
    })
  );

  check(
    "myAnalyses.error.retryLabel is covered, non-empty, and a plain string for every launched locale",
    LAUNCHED_LOCALES.every((locale) => {
      const retryLabel = getMessages(locale).myAnalyses.error.retryLabel;

      return typeof retryLabel === "string" && retryLabel.length > 0;
    })
  );

  check(
    "EN and RU loading heading/description and retry label are actually localized (not identical strings)",
    getMessages("en").myAnalyses.loading.heading !==
      getMessages("ru").myAnalyses.loading.heading &&
      getMessages("en").myAnalyses.loading.description !==
        getMessages("ru").myAnalyses.loading.description &&
      getMessages("en").myAnalyses.error.retryLabel !==
        getMessages("ru").myAnalyses.error.retryLabel
  );

  check(
    "myAnalyses subtitle and dashboard table column keys are covered for every launched locale",
    LAUNCHED_LOCALES.every((locale) => {
      const myAnalyses = getMessages(locale).myAnalyses;

      return (
        myAnalyses.subtitle.length > 0 &&
        myAnalyses.table.columnScript.length > 0 &&
        myAnalyses.table.columnAnalyzed.length > 0 &&
        myAnalyses.table.columnOverall.length > 0 &&
        myAnalyses.table.columnHook.length > 0 &&
        myAnalyses.table.columnRisk.length > 0 &&
        myAnalyses.table.columnActions.length > 0 &&
        myAnalyses.table.open.length > 0
      );
    })
  );

  check(
    "EN and RU empty-state headings are actually localized (not identical strings)",
    getMessages("en").myAnalyses.empty.heading !==
      getMessages("ru").myAnalyses.empty.heading
  );

  check(
    "EN and RU dashboard subtitle and column labels are actually localized (not identical strings)",
    getMessages("en").myAnalyses.subtitle !==
      getMessages("ru").myAnalyses.subtitle &&
      getMessages("en").myAnalyses.table.columnScript !==
        getMessages("ru").myAnalyses.table.columnScript &&
      getMessages("en").myAnalyses.table.open !==
        getMessages("ru").myAnalyses.table.open
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
    "rerun is out of scope for this PR (page has no such inline handler); Open, Delete, and Rename are dedicated components, not inline page handlers",
    !pageSource.includes("handleDelete") &&
      !pageSource.includes("handleRename") &&
      !pageSource.includes("handleRerun") &&
      !pageSource.includes("handleOpen")
  );
}

// Dashboard-redesign-specific source-shape checks. Same rationale as
// checkPageSourceShape above: no React/DOM test harness exists here, so
// structural claims (sidebar exists, nav item is marked active, no fake
// fields are rendered, the Open action is honestly disabled) are verified
// against the page's source text.
function checkDashboardShape(): void {
  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");
  // The desktop table, mobile card, and their row cells were extracted
  // into analyses-search.tsx (alongside the search feature that now
  // drives which rows they show) — checks on that moved markup read the
  // combined source of both files, not page.tsx alone. The Loading / Empty
  // / Error states feature further extracted the list fetch and its
  // Error/Empty branching into analyses-content.tsx (see that file's own
  // comment), so ErrorState now lives there too.
  const searchSource = readFileSync(
    "app/my-analyses/analyses-search.tsx",
    "utf8"
  );
  const contentSource = readFileSync(
    "app/my-analyses/analyses-content.tsx",
    "utf8"
  );
  const combinedSource = `${pageSource}\n${searchSource}\n${contentSource}`;

  check(
    "a desktop sidebar shell exists with the Climpy logo",
    /hidden lg:flex/.test(pageSource) &&
      pageSource.includes('<aside') &&
      pageSource.includes('src="/logo.png"')
  );

  check(
    "the sidebar has New Analysis, My Analyses, and How It Works nav items",
    pageSource.includes("{results.nav.newAnalysis}") &&
      pageSource.includes("{messages.common.myAnalyses}") &&
      pageSource.includes("{messages.landing.nav.howItWorks}")
  );

  check(
    "the My Analyses nav item is marked as the active/current page in both the desktop sidebar and mobile bottom nav",
    (() => {
      const activeMyAnalysesLinks = pageSource
        .split('href="/my-analyses"')
        .slice(1)
        .filter((chunk) => chunk.slice(0, 80).includes('aria-current="page"'));

      return activeMyAnalysesLinks.length === 2;
    })()
  );

  check(
    "a prominent New Analysis CTA exists in the main header, next to the page title",
    (() => {
      const headerStart = pageSource.indexOf("myAnalyses.heading");
      const headerSection =
        headerStart >= 0
          ? pageSource.slice(headerStart, headerStart + 600)
          : "";

      return headerSection.includes("{results.nav.newAnalysis}");
    })()
  );

  check(
    "the desktop table declares the required columns and no others",
    combinedSource.includes("myAnalyses.table.columnScript") &&
      combinedSource.includes("myAnalyses.table.columnAnalyzed") &&
      combinedSource.includes("myAnalyses.table.columnOverall") &&
      combinedSource.includes("myAnalyses.table.columnHook") &&
      combinedSource.includes("myAnalyses.table.columnRisk") &&
      combinedSource.includes("myAnalyses.table.columnActions")
  );

  check(
    "no fake Type, thumbnail, platform, or word-count field is rendered",
    !/\bType\b/.test(combinedSource) &&
      !/thumbnail/i.test(combinedSource) &&
      !/platform/i.test(combinedSource) &&
      !/word[\s-]?count/i.test(combinedSource)
  );

  check(
    "no external image / <img> thumbnail is used — only the local logo (next/image) and a neutral document icon",
    !combinedSource.includes("<img")
  );

  // Open Saved Analysis landed on top of this dashboard's stub: the Open
  // action is now a real, enabled navigation to /my-analyses/[id] instead
  // of the disabled placeholder this PR originally shipped.
  check(
    "the Open action is a real Link to /my-analyses/[id], never a disabled control",
    (() => {
      const openButtonStart = combinedSource.indexOf(
        "function OpenAnalysisButton"
      );
      const nextFunctionStart =
        openButtonStart >= 0
          ? combinedSource.indexOf("\nfunction ", openButtonStart + 1)
          : -1;
      const body =
        openButtonStart >= 0 && nextFunctionStart > openButtonStart
          ? combinedSource.slice(openButtonStart, nextFunctionStart)
          : "";

      return (
        body.includes("<Link") &&
        body.includes("`/my-analyses/${id}`") &&
        !body.includes("disabled")
      );
    })()
  );

  check(
    "each row's Open action is keyed to that row's own analysis id",
    (combinedSource.match(/<OpenAnalysisButton\s+id=\{item\.id\}/g) ?? [])
      .length === 2
  );

  check(
    "malformed/missing scores fall back to the unavailable badge, in both the table and the mobile card",
    (combinedSource.split("ScoreUnavailableBadge").length - 1) >= 2 &&
      combinedSource.includes("myAnalyses.list.scoreUnavailable")
  );

  check(
    "a mobile card structure exists (stacked list, not a squeezed table) and stays hidden on desktop",
    // Tolerates the mobile-polish feature's own overflow-x-hidden class
    // sitting between "block" and "lg:hidden" — the two are no longer
    // adjacent, so a literal "block lg:hidden" substring/regex no longer
    // matches even though the same semantic wrapper is still present.
    /\bblock\b[^"]*\blg:hidden\b/.test(pageSource) &&
      combinedSource.includes("function AnalysisMobileCard")
  );

  check(
    "the mobile view never renders the desktop <table>",
    (() => {
      const mobileStart = pageSource.indexOf('{/* MOBILE */}');
      const mobileSection =
        mobileStart >= 0 ? pageSource.slice(mobileStart) : "";

      return mobileStart >= 0 && !mobileSection.includes("<table");
    })()
  );

  // Title search and the Risk Level filter both landed on top of this
  // dashboard: a single text input plus a chip-button risk filter group
  // are now expected (both in analyses-search.tsx, not page.tsx itself),
  // but a native <select>, a date/time filter, or an Overall/Hook score
  // filter remain out of scope (see checkFiltersShape for the Risk filter's
  // own structural checks).
  check(
    "no native <select>, date/time filter, or score-range filter was added — only the approved title search input and risk filter chip group exist",
    !combinedSource.includes("<select") &&
      (searchSource.match(/<input/g) ?? []).length === 1 &&
      !pageSource.includes("<input") &&
      // Word-ish boundaries deliberately, not a bare /date/ substring test
      // — "update" (used all over this file's own comments, e.g.
      // router.refresh()/setState prose) contains "date" as a substring
      // and would otherwise false-positive here.
      !/type=["']date["']|date-?picker|date-?range|time-?range/i.test(
        searchSource
      )
  );

  check(
    "the error state is announced via role=alert and stays localized (no raw technical detail)",
    combinedSource.includes('role="alert"') &&
      combinedSource.includes("myAnalyses.error.heading") &&
      combinedSource.includes("myAnalyses.error.description")
  );

  check(
    "table column headers use scope, and the title cell uses scope=row (real semantic table, not a div grid)",
    combinedSource.includes('scope="col"') &&
      combinedSource.includes('scope="row"')
  );
}

// Search-specific structural checks, following the same source-shape
// convention as checkDashboardShape above (no React/DOM test harness
// exists here — see that function's comment).
function checkSearchShape(): void {
  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");
  const searchSource = readFileSync(
    "app/my-analyses/analyses-search.tsx",
    "utf8"
  );
  // AnalysesSearchBar/AnalysesFilterBar/AnalysesSearchDesktopResults/
  // AnalysesSearchMobileResults are mounted from analyses-content.tsx (one
  // DesktopAnalysesContent + one MobileAnalysesContent instance, each under
  // its own <Suspense> in page.tsx — see analyses-content.tsx's own
  // comment), not directly from page.tsx anymore.
  const contentSource = readFileSync(
    "app/my-analyses/analyses-content.tsx",
    "utf8"
  );

  check(
    "search state is shared via a single Context/Provider, not two independent desktop/mobile states",
    (searchSource.match(/= createContext/g) ?? []).length === 1 &&
      (searchSource.match(/function AnalysesSearchProvider/g) ?? [])
        .length === 1 &&
      (pageSource.match(/<AnalysesSearchProvider>/g) ?? []).length === 1
  );

  check(
    "the search bar is rendered once per breakpoint, both reading the same shared context",
    (contentSource.match(/<AnalysesSearchBar\b/g) ?? []).length === 2
  );

  check(
    "search messages are threaded through props, not useMessages(), typed as a narrowed Pick of the real Messages shape",
    !searchSource.includes("useMessages(") &&
      searchSource.includes(
        'Pick<Messages["myAnalyses"], "table" | "list" | "search" | "filters" | "pagination">'
      )
  );

  check(
    "matching is case-insensitive, title-only, and whitespace-only queries behave like an empty query",
    (() => {
      const fnStart = searchSource.indexOf(
        "function filterAnalysesByTitle"
      );
      const fnEnd =
        fnStart >= 0 ? searchSource.indexOf("\n}", fnStart) : -1;
      const body =
        fnStart >= 0 && fnEnd > fnStart
          ? searchSource.slice(fnStart, fnEnd)
          : "";

      return (
        body.includes(".trim()") &&
        body.includes(".toLowerCase()") &&
        body.includes("item.title.toLowerCase().includes") &&
        !body.includes("item.locale") &&
        !body.includes("item.scores")
      );
    })()
  );

  check(
    "a clear button appears only once a query exists, and clears the shared query",
    searchSource.includes("query.length > 0 &&") &&
      (searchSource.match(/setQuery\(""\)/g) ?? []).length >= 2
  );

  check(
    "a distinct no-results state exists for a non-matching search, separate from the empty-analyses state",
    searchSource.includes("function NoResults") &&
      searchSource.includes("searchMessages.noResultsHeading") &&
      searchSource.includes("searchMessages.noResultsDescriptionPrefix") &&
      searchSource.includes("searchMessages.noResultsDescriptionSuffix")
  );

  check(
    "the no-results description is built from plain strings in the Client Component, never a message function passed as a prop",
    !searchSource.includes("noResultsDescription(") &&
      typeof getMessages("en").myAnalyses.search.noResultsDescriptionPrefix ===
        "string" &&
      typeof getMessages("en").myAnalyses.search.noResultsDescriptionSuffix ===
        "string"
  );

  check(
    "myAnalyses.search keys are covered for every launched locale",
    LAUNCHED_LOCALES.every((locale) => {
      const search = getMessages(locale).myAnalyses.search;

      return (
        search.inputLabel.length > 0 &&
        search.placeholder.length > 0 &&
        search.clearLabel.length > 0 &&
        search.noResultsHeading.length > 0 &&
        search.noResultsDescriptionPrefix.length > 0 &&
        search.noResultsDescriptionSuffix.length > 0
      );
    })
  );

  check(
    "EN and RU search labels are actually localized (not identical strings)",
    getMessages("en").myAnalyses.search.placeholder !==
      getMessages("ru").myAnalyses.search.placeholder &&
      getMessages("en").myAnalyses.search.noResultsHeading !==
        getMessages("ru").myAnalyses.search.noResultsHeading
  );

  // analyses-content.tsx (also Server Components — DesktopAnalysesContent/
  // MobileAnalysesContent) must build plain, narrowed objects
  // (searchMyAnalyses/searchResults) before handing them to these Client
  // Components — the full `myAnalyses`/`results` message trees contain
  // function-valued keys elsewhere (e.g. myAnalyses.delete
  // .dialogDescriptionWithTitle, results.script.characterCount), and
  // Pick<> on the receiving prop type doesn't strip those at runtime, only
  // narrows the type. Passing the wide objects directly crashes with
  // "Functions cannot be passed directly to Client Components." the first
  // time the page actually renders (it's a force-dynamic route, so
  // `next build` never renders it to catch this). Scoped to just these
  // four tags' own prop lists — EmptyState/ErrorState are Server
  // Components too, so their unrelated `myAnalyses={myAnalyses}` usage
  // elsewhere in analyses-content.tsx is legitimate and must not trip this
  // check.
  const searchClientCallSites = [
    ...contentSource.matchAll(/<AnalysesSearchBar\b[\s\S]*?\/>/g),
    ...contentSource.matchAll(/<AnalysesFilterBar\b[\s\S]*?\/>/g),
    ...contentSource.matchAll(/<AnalysesSearchDesktopResults\b[\s\S]*?\/>/g),
    ...contentSource.matchAll(/<AnalysesSearchMobileResults\b[\s\S]*?\/>/g),
  ].map((match) => match[0]);

  check(
    "the Server Component passes narrowed, plain-data props into the search/filter Client Components, never the full myAnalyses/results message trees",
    searchClientCallSites.length === 6 &&
      searchClientCallSites.every(
        (tag) =>
          !tag.includes("myAnalyses={myAnalyses}") &&
          !tag.includes("results={results}") &&
          tag.includes("myAnalyses={searchMyAnalyses}")
      )
  );
}

// Risk Level filter structural checks — same source-shape convention as
// checkSearchShape above (no React/DOM test harness exists here).
function checkFiltersShape(): void {
  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");
  const searchSource = readFileSync(
    "app/my-analyses/analyses-search.tsx",
    "utf8"
  );
  const scoreVisualsSource = readFileSync(
    "app/my-analyses/score-visuals.tsx",
    "utf8"
  );
  const contentSource = readFileSync(
    "app/my-analyses/analyses-content.tsx",
    "utf8"
  );

  check(
    "the risk filter reuses the exported riskTier helper (same >=65/>=45 thresholds as each row's own RiskIndicator) instead of duplicating the thresholds",
    scoreVisualsSource.includes("export function riskTier") &&
      searchSource.includes("riskTier") &&
      /riskTier,?\s*}\s*from\s*"\.\/score-visuals"/.test(searchSource) &&
      !/riskFilter[\s\S]{0,80}>=\s*6[45]/.test(searchSource) &&
      !/riskFilter[\s\S]{0,80}>=\s*45/.test(searchSource)
  );

  check(
    "filterAnalysesByRisk defaults to All as a no-op, and excludes null-score (unavailable) rows from every specific tier",
    (() => {
      const fnStart = searchSource.indexOf(
        "function filterAnalysesByRisk"
      );
      const fnEnd =
        fnStart >= 0 ? searchSource.indexOf("\n}", fnStart) : -1;
      const body =
        fnStart >= 0 && fnEnd > fnStart
          ? searchSource.slice(fnStart, fnEnd)
          : "";

      return (
        body.includes('riskFilter === "all"') &&
        body.includes("item.scores !== null") &&
        body.includes("riskTier(item.scores.retentionRisk) === riskFilter")
      );
    })()
  );

  check(
    "Search and the Risk filter compose with AND — both predicates run before either results view renders",
    (() => {
      const composedCount = (
        searchSource.match(
          /filterAnalysesByRisk\(\s*filterAnalysesByTitle\(items, query\),\s*riskFilter,\s*\)/g
        ) ?? []
      ).length;
      // Composition now lives once, centrally, inside
      // useSearchedAndFilteredAnalyses (which Pagination also builds on —
      // see checkPaginationShape) rather than being duplicated per
      // breakpoint the way it briefly was pre-Pagination; both results
      // components below call that one hook.
      const bothComponentsUseSharedHook =
        (
          searchSource.match(
            /const \{ pageItems, totalPages \} = useSearchedAndFilteredAnalyses\(items\);/g
          ) ?? []
        ).length === 2;

      return composedCount === 1 && bothComponentsUseSharedHook;
    })()
  );

  check(
    "risk filter state (riskFilter/setRiskFilter) lives on the one existing SearchContext, not a second provider",
    (searchSource.match(/= createContext/g) ?? []).length === 1 &&
      (searchSource.match(/function AnalysesSearchProvider/g) ?? [])
        .length === 1 &&
      (() => {
        const typeStart = searchSource.indexOf("type SearchContextValue");
        const typeEnd =
          typeStart >= 0 ? searchSource.indexOf("};", typeStart) : -1;
        const body =
          typeStart >= 0 && typeEnd > typeStart
            ? searchSource.slice(typeStart, typeEnd)
            : "";

        return body.includes("query") && body.includes("riskFilter");
      })()
  );

  check(
    "the filter control is an accessible chip/button group, not a native <select>, with a named group label and aria-pressed on the active option",
    searchSource.includes('role="group"') &&
      searchSource.includes("aria-label={filtersMessages.groupLabel}") &&
      searchSource.includes("aria-pressed={isActive}") &&
      !searchSource.includes("<select")
  );

  check(
    "the filter bar is rendered once per breakpoint, sharing the same context as the search bar",
    (contentSource.match(/<AnalysesFilterBar\b/g) ?? []).length === 2
  );

  check(
    "the risk filter reuses the existing translated High/Medium/Low risk labels instead of new duplicate strings",
    searchSource.includes("results.scoreLabels.risk") &&
      searchSource.includes("riskLabels.high") &&
      searchSource.includes("riskLabels.medium") &&
      searchSource.includes("riskLabels.low")
  );

  check(
    "default filter state is All",
    searchSource.includes('useState<RiskFilterValue>("all")')
  );

  check(
    "the no-results state distinguishes search-only, filter-only, and combined search+filter cases",
    searchSource.includes("filtersMessages.noResultsHeading") &&
      searchSource.includes("filtersMessages.noResultsDescription") &&
      searchSource.includes("filtersMessages.noResultsCombinedHeading") &&
      searchSource.includes("filtersMessages.noResultsCombinedDescription") &&
      searchSource.includes("hasRiskFilter") &&
      searchSource.includes("hasQuery")
  );

  check(
    "the no-results 'Clear search' button only ever clears the search query, never the risk filter (independent resets, no combined Clear-all control)",
    (() => {
      const fnStart = searchSource.indexOf("function NoResults");
      const nextFnMatch =
        fnStart >= 0
          ? /\n(export )?function /.exec(searchSource.slice(fnStart + 1))
          : null;
      const fnEnd =
        fnStart >= 0 && nextFnMatch
          ? fnStart + 1 + nextFnMatch.index
          : -1;
      const body =
        fnStart >= 0 && fnEnd > fnStart
          ? searchSource.slice(fnStart, fnEnd)
          : "";

      return (
        body.includes("hasQuery &&") &&
        body.includes('onClick={() => setQuery("")}') &&
        !body.includes("setRiskFilter")
      );
    })()
  );

  check(
    "myAnalyses.filters keys are covered for every launched locale",
    LAUNCHED_LOCALES.every((locale) => {
      const filters = getMessages(locale).myAnalyses.filters;

      return (
        filters.groupLabel.length > 0 &&
        filters.all.length > 0 &&
        filters.noResultsHeading.length > 0 &&
        filters.noResultsDescription.length > 0 &&
        filters.noResultsCombinedHeading.length > 0 &&
        filters.noResultsCombinedDescription.length > 0
      );
    })
  );

  check(
    "EN and RU filter labels are actually localized (not identical strings)",
    getMessages("en").myAnalyses.filters.groupLabel !==
      getMessages("ru").myAnalyses.filters.groupLabel &&
      getMessages("en").myAnalyses.filters.noResultsHeading !==
        getMessages("ru").myAnalyses.filters.noResultsHeading &&
      getMessages("en").myAnalyses.filters.noResultsCombinedHeading !==
        getMessages("ru").myAnalyses.filters.noResultsCombinedHeading
  );

  check(
    "no function-valued message is passed as a prop across the Server/Client boundary for the filter bar either — SearchMyAnalyses/SearchResults stay narrowed Pick<> types",
    searchSource.includes(
      'Pick<Messages["myAnalyses"], "table" | "list" | "search" | "filters" | "pagination">'
    ) &&
      contentSource.includes("filters: myAnalyses.filters,")
  );

  check(
    "the filter bar is mounted from analyses-content.tsx only, never duplicated directly in page.tsx",
    !pageSource.includes("<AnalysesFilterBar") &&
      !pageSource.includes("filters: myAnalyses.filters,")
  );
}

// Pagination structural checks — same source-shape convention as
// checkSearchShape/checkFiltersShape above (no React/DOM test harness
// exists here; the pure logic itself is covered directly and executably by
// checkPaginationHelpers).
function checkPaginationShape(): void {
  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");
  const searchSource = readFileSync(
    "app/my-analyses/analyses-search.tsx",
    "utf8"
  );
  const contentSource = readFileSync(
    "app/my-analyses/analyses-content.tsx",
    "utf8"
  );
  const analysesListSource = readFileSync(
    "app/my-analyses/analyses-list.ts",
    "utf8"
  );

  check(
    "MY_ANALYSES_LIMIT is 200",
    /MY_ANALYSES_LIMIT\s*=\s*200/.test(analysesListSource)
  );

  check(
    "pagination is applied after Search and the Risk filter, over their complete combined result — never before",
    (() => {
      const fnStart = searchSource.indexOf(
        "function useSearchedAndFilteredAnalyses"
      );
      // The function's own return type is a multi-line object literal
      // ending in its own "\n}" before the real body opens (the body
      // actually starts at "} {" — return-type close, then body open) —
      // so the body's closing brace must be searched for *after* that
      // point, not from fnStart directly.
      const returnTypeCloseIndex =
        fnStart >= 0 ? searchSource.indexOf("} {", fnStart) : -1;
      const fnEnd =
        returnTypeCloseIndex >= 0
          ? searchSource.indexOf("\n}", returnTypeCloseIndex + 3)
          : -1;
      const body =
        fnStart >= 0 && fnEnd > fnStart
          ? searchSource.slice(fnStart, fnEnd)
          : "";

      // filterAnalysesByRisk( is the *outer* call and textually precedes
      // its own nested filterAnalysesByTitle( argument — so comparing raw
      // text positions would get evaluation order backwards. Instead,
      // assert the actual nesting (Title search innermost, so it runs
      // first; Risk filter wraps it into `combinedItems`) and that
      // Pagination is applied to that exact combined value, not the raw
      // `items`.
      const hasSearchNestedInsideRiskFilter =
        /const combinedItems = filterAnalysesByRisk\(\s*filterAnalysesByTitle\(items, query\),\s*riskFilter,\s*\);/.test(
          body
        );
      const paginatesOverTheCombinedResult = /paginateAnalyses\(\s*combinedItems,/.test(
        body
      );

      return hasSearchNestedInsideRiskFilter && paginatesOverTheCombinedResult;
    })()
  );

  check(
    "default page is 1",
    searchSource.includes("useState(1)")
  );

  check(
    "the query and risk filter changing resets page to 1 during AnalysesSearchProvider's own render, not inside a useEffect — this is same-component state (the Provider owns `page` and adjusts it directly), unlike the cross-component clamp below which correctly does use an effect",
    /if \(lastResetFor\.query !== query \|\| lastResetFor\.riskFilter !== riskFilter\)/.test(
      searchSource
    ) &&
      /setLastResetFor\(\{ query, riskFilter \}\);\s*setPage\(1\);/.test(
        searchSource
      ) &&
      !/useEffect\(\(\) => \{\s*setPage\(1\)/.test(searchSource)
  );

  check(
    "clearing the search query resets page to 1 because it changes `query` (no special-cased clear-vs-type distinction)",
    (searchSource.match(/setQuery\(""\)/g) ?? []).length >= 2
  );

  check(
    "selecting All resets page to 1 because it changes `riskFilter` (no special-cased All-vs-other distinction)",
    searchSource.includes('setRiskFilter(value)')
  );

  check(
    "the composed result shrinking clamps the current page instead of resetting it to 1 (a stale out-of-range page is pulled down to the new last page, not back to page 1)",
    (() => {
      const fnStart = searchSource.indexOf(
        "function useSearchedAndFilteredAnalyses"
      );
      const returnTypeCloseIndex =
        fnStart >= 0 ? searchSource.indexOf("} {", fnStart) : -1;
      const fnEnd =
        returnTypeCloseIndex >= 0
          ? searchSource.indexOf("\n}", returnTypeCloseIndex + 3)
          : -1;
      const body =
        fnStart >= 0 && fnEnd > fnStart
          ? searchSource.slice(fnStart, fnEnd)
          : "";

      return (
        body.includes("if (page > totalPages)") &&
        body.includes("setPage(totalPages)") &&
        body.includes("Math.min(page, totalPages)") &&
        !body.includes("setPage(1)")
      );
    })()
  );

  // Regression guard: useSearchedAndFilteredAnalyses runs inside
  // AnalysesSearchDesktopResults/AnalysesSearchMobileResults — different
  // component instances than AnalysesSearchProvider, which actually owns
  // `page`/`setPage`. Calling `setPage` synchronously in this hook's body
  // (outside an effect) would update a *different* component's state
  // during *this* component's render — exactly React's "Cannot update a
  // component (AnalysesSearchProvider) while rendering a different
  // component (AnalysesSearchDesktopResults/MobileResults)" hazard, not
  // the safe "adjust your own state during render" pattern the Provider's
  // own `lastResetFor` reset correctly uses above. This only ever
  // reproduces once the composed result actually shrinks while the user is
  // on a later page — normal browser smoke-testing on page 1 never
  // triggers it, which is exactly why this needs a standing structural
  // check rather than relying on it always being caught by hand.
  check(
    "regression guard: the cross-component page clamp only ever calls the Provider's setPage from inside a useEffect, never synchronously during a child component's render",
    (() => {
      const fnStart = searchSource.indexOf(
        "function useSearchedAndFilteredAnalyses"
      );
      const returnTypeCloseIndex =
        fnStart >= 0 ? searchSource.indexOf("} {", fnStart) : -1;
      const fnEnd =
        returnTypeCloseIndex >= 0
          ? searchSource.indexOf("\n}", returnTypeCloseIndex + 3)
          : -1;
      const body =
        fnStart >= 0 && fnEnd > fnStart
          ? searchSource.slice(fnStart, fnEnd)
          : "";

      const effectMatch =
        /useEffect\(\(\) => \{([\s\S]*?)\}, \[page, totalPages, setPage\]\);/.exec(
          body
        );
      const effectBody = effectMatch ? effectMatch[1] : "";
      const totalSetPageCalls = (body.match(/setPage\(/g) ?? []).length;

      return (
        effectMatch !== null &&
        effectBody.includes("if (page > totalPages)") &&
        effectBody.includes("setPage(totalPages)") &&
        // Exactly one setPage(...) call in this whole child-rendered hook,
        // and it's the one already confirmed to live inside the effect —
        // so it categorically cannot also exist as a bare render-time call.
        totalSetPageCalls === 1
      );
    })()
  );

  check(
    "page can never go below 1 or above the total page count",
    searchSource.includes("Math.min(page, totalPages)") &&
      /getTotalPages[\s\S]{0,80}Math\.max\(1,/.test(searchSource)
  );

  check(
    "Previous and Next are real <button> elements using the native disabled attribute at the page boundaries, not just a visual style",
    /<button[\s\S]{0,40}disabled=\{page <= 1\}/.test(searchSource) &&
      /<button[\s\S]{0,40}disabled=\{page >= totalPages\}/.test(searchSource)
  );

  check(
    "pagination controls are wrapped in a labelled <nav> landmark with an accessible pagination label",
    /<nav\s+aria-label=\{paginationMessages\.ariaLabel\}/.test(searchSource)
  );

  check(
    "the Page X of Y indicator is announced via aria-live=\"polite\" without stealing focus (no manual .focus() call)",
    searchSource.includes('aria-live="polite"') &&
      !searchSource.includes(".focus()")
  );

  check(
    "the entire pagination control is hidden (not just disabled) when the composed result has zero or one page",
    /if \(totalPages <= 1\) \{\s*return null;\s*\}/.test(searchSource)
  );

  check(
    "the Page X of Y text is built from plain string messages plus local numeric state, never a message function",
    searchSource.includes(
      "paginationMessages.pageLabel} {page} {paginationMessages.ofLabel}"
    ) && !/pagination\.\w+\(/.test(searchSource)
  );

  check(
    "no duplicated page-size constant or competing page-size threshold exists outside the one exported PAGE_SIZE",
    (searchSource.match(/PAGE_SIZE\s*=\s*10/g) ?? []).length === 1 &&
      !/\/\s*10\b/.test(
        searchSource.slice(searchSource.indexOf("function paginateAnalyses"))
      )
  );

  check(
    "pagination state (page/setPage) lives on the one existing SearchContext, not a second provider — desktop and mobile share one page state",
    (searchSource.match(/= createContext/g) ?? []).length === 1 &&
      (searchSource.match(/function AnalysesSearchProvider/g) ?? [])
        .length === 1 &&
      (() => {
        const typeStart = searchSource.indexOf("type SearchContextValue");
        const typeEnd =
          typeStart >= 0 ? searchSource.indexOf("};", typeStart) : -1;
        const body =
          typeStart >= 0 && typeEnd > typeStart
            ? searchSource.slice(typeStart, typeEnd)
            : "";

        return body.includes("page") && body.includes("setPage");
      })()
  );

  check(
    "pagination controls are rendered once per breakpoint via the shared results components (no separate control mounted directly in page.tsx or analyses-content.tsx)",
    // Checks actual JSX usage (the "<PaginationControls" render call), not a
    // bare substring mention — page.tsx's mobile-polish comments legitimately
    // reference the component *by name* in prose without ever rendering it.
    (searchSource.match(/<PaginationControls\b/g) ?? []).length === 2 &&
      !pageSource.includes("<PaginationControls") &&
      !contentSource.includes("<PaginationControls")
  );

  check(
    "myAnalyses.pagination keys are covered for every launched locale, and are plain strings, not functions",
    LAUNCHED_LOCALES.every((locale) => {
      const pagination = getMessages(locale).myAnalyses.pagination;

      return (
        typeof pagination.ariaLabel === "string" &&
        pagination.ariaLabel.length > 0 &&
        typeof pagination.previousLabel === "string" &&
        pagination.previousLabel.length > 0 &&
        typeof pagination.nextLabel === "string" &&
        pagination.nextLabel.length > 0 &&
        typeof pagination.pageLabel === "string" &&
        pagination.pageLabel.length > 0 &&
        typeof pagination.ofLabel === "string" &&
        pagination.ofLabel.length > 0
      );
    })
  );

  check(
    "EN and RU pagination labels are actually localized (not identical strings)",
    getMessages("en").myAnalyses.pagination.ariaLabel !==
      getMessages("ru").myAnalyses.pagination.ariaLabel &&
      getMessages("en").myAnalyses.pagination.previousLabel !==
        getMessages("ru").myAnalyses.pagination.previousLabel &&
      getMessages("en").myAnalyses.pagination.nextLabel !==
        getMessages("ru").myAnalyses.pagination.nextLabel
  );

  check(
    "only a narrow, explicitly-constructed plain object crosses the Server/Client boundary for pagination messages too — SearchMyAnalyses includes 'pagination', and analyses-content.tsx builds it as a plain field, never spreading the full myAnalyses tree",
    searchSource.includes(
      'Pick<Messages["myAnalyses"], "table" | "list" | "search" | "filters" | "pagination">'
    ) &&
      contentSource.includes("pagination: myAnalyses.pagination,") &&
      !contentSource.includes("...myAnalyses") &&
      !pageSource.includes("...myAnalyses")
  );
}

// Loading / Empty / Error states feature — same source-shape convention as
// the other checkXShape functions above (no React/DOM test harness exists
// here). Empty-state-vs-no-results and the list-fetch typed-result/inline
// ErrorState behavior predate this feature and are already covered above
// (checkEmptyState, checkDatabaseError, checkDashboardShape's role=alert
// check); this function covers only what's new: the Loading fallback, the
// Retry control, and the single-query architecture that makes both safe.
function checkLoadingAndRetryShape(): void {
  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");
  const contentSource = readFileSync(
    "app/my-analyses/analyses-content.tsx",
    "utf8"
  );
  const retrySource = readFileSync(
    "app/my-analyses/retry-list-error.tsx",
    "utf8"
  );

  check(
    "the Suspense fallback is a narrowed Pick<Messages['myAnalyses'], 'loading'> object, not the full myAnalyses tree, and reads loading.heading/description",
    pageSource.includes('Pick<Messages["myAnalyses"], "loading">') &&
      pageSource.includes("myAnalyses.loading.heading") &&
      pageSource.includes("myAnalyses.loading.description")
  );

  check(
    "the loading card is announced via role=status and aria-live=polite — page.tsx no longer defines ErrorState (moved to analyses-content.tsx), so role=alert doesn't appear here at all",
    /role="status"[\s\S]{0,120}aria-live="polite"/.test(pageSource) &&
      !pageSource.includes('role="alert"')
  );

  check(
    "no table-row or mobile-card skeleton was built for the loading state — just a small indicator, heading, and description, matching the Empty/Error card shape",
    !/skeleton/i.test(pageSource) &&
      !pageSource.includes("<table") &&
      pageSource.includes("rounded-[18px] border border-[#E5E7EB] bg-white p-10 text-center")
  );

  check(
    "the Suspense boundary is placed once per breakpoint around the analyses content, each with its own AnalysesLoadingCard fallback",
    (pageSource.match(/<Suspense fallback=\{<AnalysesLoadingCard/g) ?? [])
      .length === 2
  );

  check(
    "the signed-out redirect happens before (outside) the data Suspense boundary, never inside it",
    (() => {
      const redirectIndex = pageSource.indexOf(
        'redirect("/login?next=/my-analyses");'
      );
      const firstSuspenseIndex = pageSource.indexOf("<Suspense");

      return (
        redirectIndex >= 0 &&
        firstSuspenseIndex > redirectIndex
      );
    })()
  );

  check(
    "route-level error.tsx was deliberately not added for this feature — the expected list-fetch failure stays an inline typed-result branch",
    (() => {
      try {
        readFileSync("app/my-analyses/error.tsx", "utf8");
        return false;
      } catch {
        return true;
      }
    })()
  );

  check(
    "fetchMyAnalyses is called from exactly one place (inside a cache()-wrapped zero-argument function in analyses-content.tsx), never directly from page.tsx or a second call site",
    contentSource.includes('import { cache } from "react";') &&
      /cache\(\s*async \(\): Promise<FetchMyAnalysesResult> => \{/.test(
        contentSource
      ) &&
      (contentSource.match(/fetchMyAnalyses\(/g) ?? []).length === 1 &&
      !pageSource.includes("fetchMyAnalyses")
  );

  check(
    "both DesktopAnalysesContent and MobileAnalysesContent read the list through the one shared cache()-memoized accessor, not their own independent fetch",
    (contentSource.match(/await getMyAnalysesResult\(\)/g) ?? []).length ===
      2 &&
      contentSource.includes("export async function DesktopAnalysesContent") &&
      contentSource.includes("export async function MobileAnalysesContent")
  );

  check(
    "the error state's Retry control calls router.refresh(), never window.location.reload() or a raw location refresh",
    retrySource.includes("router.refresh()") &&
      !retrySource.includes("location.reload") &&
      !retrySource.includes("window.location")
  );

  check(
    "Retry is a real <button>, natively disabled while a useTransition pending refresh is in flight (not a styled div or a disabled-looking class alone)",
    /<button[\s\S]{0,60}disabled=\{isPending\}/.test(retrySource) &&
      retrySource.includes("useTransition()") &&
      retrySource.includes("startTransition(() => {")
  );

  check(
    "Retry does not introduce a second pending-state label — it reuses the same label prop while disabled, no new 'Retrying...' string",
    !/retrying/i.test(retrySource) && !/retrying/i.test(pageSource)
  );

  check(
    "only a narrow, single string prop crosses into the Retry Client Component — never the wider myAnalyses/myAnalyses.error message subtree",
    retrySource.includes("{ label: string }") &&
      !retrySource.includes("Messages") &&
      contentSource.includes("<RetryListErrorButton label={myAnalyses.error.retryLabel} />")
  );

  check(
    "the Retry button keeps ErrorState's existing role=alert on its containing element",
    (() => {
      const errorStart = contentSource.indexOf("function ErrorState");
      const errorEnd =
        errorStart >= 0 ? contentSource.indexOf("\n}", errorStart) : -1;
      const body =
        errorStart >= 0 && errorEnd > errorStart
          ? contentSource.slice(errorStart, errorEnd)
          : "";

      return (
        body.includes('role="alert"') && body.includes("<RetryListErrorButton")
      );
    })()
  );

  check(
    "the true EmptyState and the Search/Filter NoResults state are still two distinct implementations, in two different files, not merged into one",
    contentSource.includes("function EmptyState") &&
      !contentSource.includes("function NoResults") &&
      (() => {
        const searchSource = readFileSync(
          "app/my-analyses/analyses-search.tsx",
          "utf8"
        );

        return (
          searchSource.includes("function NoResults") &&
          !searchSource.includes("function EmptyState")
        );
      })()
  );

  check(
    "the EmptyState New Analysis CTA is unchanged: a real Link to / using results.nav.newAnalysis, still gated on the true zero-items case only",
    (() => {
      // EmptyState's own params destructure across multiple lines (a plain
      // "\n}" search would stop at the type annotation's closing brace, not
      // the function's) — find the next function declaration instead, the
      // same delimiter technique checkDashboardShape's OpenAnalysisButton
      // check already uses for the identical reason.
      const emptyStart = contentSource.indexOf("function EmptyState");
      const emptyEnd =
        emptyStart >= 0
          ? contentSource.indexOf("\nfunction ", emptyStart + 1)
          : -1;
      const body =
        emptyStart >= 0 && emptyEnd > emptyStart
          ? contentSource.slice(emptyStart, emptyEnd)
          : "";

      return (
        body.includes('<Link') &&
        body.includes('href="/"') &&
        body.includes("{newAnalysisLabel}") &&
        // page.tsx builds newAnalysisLabel from results.nav.newAnalysis and
        // threads it down as a prop through DesktopAnalysesContent/
        // MobileAnalysesContent into EmptyState — analyses-content.tsx only
        // ever forwards that already-resolved prop, never re-derives it.
        pageSource.includes("newAnalysisLabel={results.nav.newAnalysis}") &&
        contentSource.includes(
          "newAnalysisLabel={newAnalysisLabel}"
        )
      );
    })()
  );

  check(
    "malformed-row handling is untouched by this feature — no new 'some items could not be shown' warning was added",
    !/could not be shown/i.test(contentSource) &&
      !/some items/i.test(contentSource)
  );

  check(
    "Rename and Delete dialogs were not touched by this feature (still use router.refresh() on success, with no new global refresh indicator)",
    (() => {
      const renameSource = readFileSync(
        "app/my-analyses/rename-analysis-dialog.tsx",
        "utf8"
      );
      const deleteSource = readFileSync(
        "app/my-analyses/delete-analysis-dialog.tsx",
        "utf8"
      );

      return (
        renameSource.includes("router.refresh();") &&
        deleteSource.includes("router.refresh();") &&
        !renameSource.includes("isRefreshing") &&
        !deleteSource.includes("isRefreshing")
      );
    })()
  );
}

// Final UI polish — same source-shape convention as the other checkXShape
// functions above (no React/DOM test harness exists here). Scoped to each
// control's own function body/class-string rather than one global count,
// so a legitimate future addition of the branded focus ring elsewhere on
// the page doesn't silently invalidate these checks (or vice versa).
const BRANDED_FOCUS_VISIBLE =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]";

// Extracts a top-level function's source by name, delimited by the next
// top-level "function "/"export function "/"export async function "
// declaration — mirrors the delimiter technique already used elsewhere in
// this file (e.g. checkDashboardShape's OpenAnalysisButton check) for
// functions whose own params span multiple lines, where a naive "\n}"
// search would stop at the params' closing brace instead of the
// function's.
function extractFunctionSource(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}`);

  if (start < 0) {
    return "";
  }

  const nextMatch = /\n(export )?(async )?function /.exec(
    source.slice(start + 1)
  );
  const end = nextMatch ? start + 1 + nextMatch.index : source.length;

  return source.slice(start, end);
}

function checkUiPolishShape(): void {
  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");
  const searchSource = readFileSync(
    "app/my-analyses/analyses-search.tsx",
    "utf8"
  );
  const scoreVisualsSource = readFileSync(
    "app/my-analyses/score-visuals.tsx",
    "utf8"
  );
  const overflowMenuSource = readFileSync(
    "app/my-analyses/overflow-menu.tsx",
    "utf8"
  );
  const retrySource = readFileSync(
    "app/my-analyses/retry-list-error.tsx",
    "utf8"
  );

  const searchBarSource = extractFunctionSource(
    searchSource,
    "AnalysesSearchBar"
  );

  check(
    "the search input has a visible focus replacement — outline-none is always paired with the branded focus-visible treatment, never left with no replacement",
    searchBarSource.includes("outline-none") &&
      searchBarSource.includes(BRANDED_FOCUS_VISIBLE)
  );

  check(
    "the search bar's clear button also carries the branded focus-visible treatment",
    (() => {
      const clearButtonStart = searchBarSource.indexOf(
        'onClick={() => setQuery("")}'
      );
      const clearButtonEnd =
        clearButtonStart >= 0
          ? searchBarSource.indexOf("</button>", clearButtonStart)
          : -1;
      const clearButtonSource =
        clearButtonStart >= 0 && clearButtonEnd > clearButtonStart
          ? searchBarSource.slice(clearButtonStart, clearButtonEnd)
          : "";

      return clearButtonSource.includes(BRANDED_FOCUS_VISIBLE);
    })()
  );

  check(
    "Risk Filter chips (both the active and inactive class branches) carry the branded focus-visible treatment",
    (() => {
      const filterBarSource = extractFunctionSource(
        searchSource,
        "AnalysesFilterBar"
      );
      const brandedCount = (
        filterBarSource.match(
          /focus-visible:outline-\[#7C3AED\]/g
        ) ?? []
      ).length;

      // Both the isActive and the inactive className branches must carry
      // it — not just one — since RISK_FILTER_OPTIONS.map renders every
      // chip from this same ternary regardless of which branch is active.
      return brandedCount === 2;
    })()
  );

  check(
    "Pagination Previous and Next both carry the branded focus-visible treatment, and disabled opacity matches the Rename/Delete/Retry pattern (opacity-60, not the old opacity-40)",
    (() => {
      const paginationSource = extractFunctionSource(
        searchSource,
        "PaginationControls"
      );
      const brandedCount = (
        paginationSource.match(/focus-visible:outline-\[#7C3AED\]/g) ?? []
      ).length;

      return (
        brandedCount === 2 &&
        paginationSource.includes("disabled:opacity-60") &&
        !paginationSource.includes("disabled:opacity-40") &&
        // Boundary logic itself must be untouched by this feature.
        paginationSource.includes("disabled={page <= 1}") &&
        paginationSource.includes("disabled={page >= totalPages}")
      );
    })()
  );

  check(
    "the Open action (shared by the desktop table and mobile card) carries the branded focus-visible treatment",
    extractFunctionSource(searchSource, "OpenAnalysisButton").includes(
      BRANDED_FOCUS_VISIBLE
    )
  );

  check(
    "the desktop header New Analysis CTA carries the branded focus-visible treatment and uses PencilLine size 16 (matching the sidebar scale, not the old odd size 15)",
    (() => {
      // page.tsx has four href="/" links (sidebar nav, this header CTA,
      // the mobile top CTA, the mobile bottom nav) — "h-[44px] shrink-0" is
      // this specific CTA's own unique className fragment, so anchoring on
      // it (rather than the ambiguous href) can't accidentally match one
      // of the other three links.
      const headerStart = pageSource.indexOf("h-[44px] shrink-0");
      const ctaEnd =
        headerStart >= 0 ? pageSource.indexOf("</Link>", headerStart) : -1;
      const ctaSource =
        headerStart >= 0 && ctaEnd > headerStart
          ? pageSource.slice(headerStart, ctaEnd)
          : "";

      return (
        ctaSource.includes(BRANDED_FOCUS_VISIBLE) &&
        ctaSource.includes("<PencilLine size={16} />")
      );
    })()
  );

  check(
    "no PencilLine size=15 remains anywhere on the page — the desktop header CTA was the only such usage",
    !pageSource.includes("<PencilLine size={15}")
  );

  check(
    "the mobile bottom-navigation PencilLine icon size is unchanged at 14 — mobile icon sizing is deferred to the separate Mobile polish feature",
    (() => {
      const mobileStart = pageSource.indexOf('{/* MOBILE */}');
      const mobileSection =
        mobileStart >= 0 ? pageSource.slice(mobileStart) : "";

      return (
        mobileStart >= 0 &&
        mobileSection.includes("<PencilLine size={14} />")
      );
    })()
  );

  check(
    "the overflow-menu trigger button carries the branded focus-visible treatment",
    (() => {
      const triggerStart = overflowMenuSource.indexOf("<button\n        ref={triggerRef}");
      const triggerEnd =
        triggerStart >= 0
          ? overflowMenuSource.indexOf("</button>", triggerStart)
          : -1;
      const triggerSource =
        triggerStart >= 0 && triggerEnd > triggerStart
          ? overflowMenuSource.slice(triggerStart, triggerEnd)
          : "";

      return triggerSource.includes(BRANDED_FOCUS_VISIBLE);
    })()
  );

  check(
    "both overflow-menu item class branches (destructive and default) carry the branded focus-visible treatment, without disturbing the existing ArrowUp/Down/Home/End keyboard-cycling logic",
    (() => {
      // Scoped to just the items.map ternary — the trigger button (checked
      // separately above) also legitimately carries this same string, so
      // counting across the whole file would over-count.
      const ternaryStart = overflowMenuSource.indexOf(
        'item.variant === "destructive"'
      );
      const ternaryEnd =
        ternaryStart >= 0
          ? overflowMenuSource.indexOf("{item.label}", ternaryStart)
          : -1;
      const ternarySource =
        ternaryStart >= 0 && ternaryEnd > ternaryStart
          ? overflowMenuSource.slice(ternaryStart, ternaryEnd)
          : "";
      const brandedCount = (
        ternarySource.match(/focus-visible:outline-\[#7C3AED\]/g) ?? []
      ).length;

      return (
        brandedCount === 2 &&
        overflowMenuSource.includes("ArrowDown") &&
        overflowMenuSource.includes("ArrowUp") &&
        overflowMenuSource.includes('event.key === "Home"') &&
        overflowMenuSource.includes('event.key === "End"')
      );
    })()
  );

  check(
    "the Retry button carries the branded focus-visible treatment",
    retrySource.includes(BRANDED_FOCUS_VISIBLE)
  );

  check(
    "no focus-visible styling was added to any non-interactive element (ScoreRing/RiskIndicator/ScoreUnavailableBadge stay plain <div>/<span> with no focus ring)",
    !scoreVisualsSource.includes("focus-visible")
  );

  check(
    "no #9CA3AF usage remains anywhere in the My Analyses UI — every previously-identified informational/interactive usage (unavailable-score text, timestamps, search placeholder, clear-button foreground) was replaced with the AA-safe #6B7280, and no new third gray token was introduced",
    !searchSource.includes("#9CA3AF") &&
      !scoreVisualsSource.includes("#9CA3AF") &&
      !pageSource.includes("#9CA3AF")
  );

  check(
    "ScoreUnavailableBadge text uses the accessible #6B7280 muted color",
    extractFunctionSource(
      scoreVisualsSource,
      "ScoreUnavailableBadge"
    ).includes("text-[#6B7280]")
  );

  check(
    "both the desktop table's and mobile card's timestamp text use the accessible #6B7280 muted color",
    (() => {
      const scriptCellSource = extractFunctionSource(searchSource, "ScriptCell");
      const mobileCardSource = extractFunctionSource(
        searchSource,
        "AnalysisMobileCard"
      );

      return (
        scriptCellSource.includes("text-[#6B7280] lg:hidden") &&
        mobileCardSource.includes(
          '<span className="text-[11px] text-[#6B7280]">'
        )
      );
    })()
  );

  check(
    "the search placeholder and the clear button's resting foreground both use the accessible #6B7280 color",
    searchBarSource.includes("placeholder:text-[#6B7280]") &&
      (() => {
        const clearButtonStart = searchBarSource.indexOf(
          'onClick={() => setQuery("")}'
        );
        const clearButtonEnd =
          clearButtonStart >= 0
            ? searchBarSource.indexOf("</button>", clearButtonStart)
            : -1;
        const clearButtonSource =
          clearButtonStart >= 0 && clearButtonEnd > clearButtonStart
            ? searchBarSource.slice(clearButtonStart, clearButtonEnd)
            : "";

        return clearButtonSource.includes("text-[#6B7280]");
      })()
  );

  check(
    "no result-count / 'Showing X of Y' element was added — explicitly out of scope for this feature",
    !searchSource.includes("Showing") &&
      !pageSource.includes("Showing") &&
      !/\bresultCount\b|\bresultsCount\b/i.test(searchSource)
  );

  check(
    "no shared Button/Chip/Card/focus-style primitive was extracted — every control keeps its own inline className, matching the explicit no-refactor scope for this feature",
    !searchSource.includes("./button") &&
      !searchSource.includes("./chip") &&
      !pageSource.includes("./button") &&
      !pageSource.includes("./chip")
  );

  check(
    "Search, Risk Filter, and Pagination logic/thresholds are untouched by this feature",
    searchSource.includes("item.title.toLowerCase().includes") &&
      searchSource.includes('riskFilter === "all"') &&
      searchSource.includes("riskTier(item.scores.retentionRisk) === riskFilter") &&
      /PAGE_SIZE\s*=\s*10/.test(searchSource)
  );

  // --- Final UI polish: ErrorState alignment, Retry height, dialog focus --

  const contentSource = readFileSync(
    "app/my-analyses/analyses-content.tsx",
    "utf8"
  );

  function extractErrorStateBody(): string {
    const errorStart = contentSource.indexOf("function ErrorState");
    const errorEnd =
      errorStart >= 0 ? contentSource.indexOf("\n}", errorStart) : -1;

    return errorStart >= 0 && errorEnd > errorStart
      ? contentSource.slice(errorStart, errorEnd)
      : "";
  }

  function extractEmptyStateBody(): string {
    const emptyStart = contentSource.indexOf("function EmptyState");
    const emptyEnd =
      emptyStart >= 0
        ? contentSource.indexOf("\nfunction ", emptyStart + 1)
        : -1;

    return emptyStart >= 0 && emptyEnd > emptyStart
      ? contentSource.slice(emptyStart, emptyEnd)
      : "";
  }

  check(
    "ErrorState's card wrapper now matches EmptyState's exactly (white background, neutral border, rounded-[18px], p-10) instead of the old purple-tinted p-8 treatment, while keeping role=\"alert\"",
    (() => {
      const errorBody = extractErrorStateBody();

      return (
        errorBody.includes(
          'className="rounded-[18px] border border-[#E5E7EB] bg-white p-10 text-center"'
        ) &&
        errorBody.includes('role="alert"') &&
        !errorBody.includes("#7C3AED]/30") &&
        !errorBody.includes("bg-[#F3E8FF] p-8")
      );
    })()
  );

  check(
    "ErrorState has the same purple icon-circle treatment as EmptyState/AnalysesLoadingCard (h-12 w-12 circle, #DDD6FE border, #F3E8FF background), using a purple (not red) alert icon",
    (() => {
      const errorBody = extractErrorStateBody();
      const emptyBody = extractEmptyStateBody();
      const iconCircleClass =
        "mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF]";

      return (
        errorBody.includes(iconCircleClass) &&
        emptyBody.includes(iconCircleClass) &&
        /TriangleAlert\s*\n?\s*size=\{20\}\s*\n?\s*className="text-\[#7C3AED\]"/.test(
          errorBody
        ) &&
        !errorBody.includes("#EF4444") &&
        !errorBody.includes("#DC2626")
      );
    })()
  );

  check(
    "ErrorState's heading and description now use the exact same typography classes as EmptyState (text-[18px] font-semibold text-[#111827] heading; text-[14px] leading-[1.6] text-[#6B7280] description) instead of the old smaller/purple heading and 13px description",
    (() => {
      const errorBody = extractErrorStateBody();

      return (
        errorBody.includes(
          'className="mt-4 text-[18px] font-semibold text-[#111827]"'
        ) &&
        errorBody.includes(
          'className="mx-auto mt-2 max-w-[360px] text-[14px] leading-[1.6] text-[#6B7280]"'
        ) &&
        !errorBody.includes("text-[15px] font-semibold text-[#7C3AED]") &&
        !errorBody.includes("text-[13px] text-[#6B7280]")
      );
    })()
  );

  check(
    "ErrorState's heading and description copy (myAnalyses.error.heading / myAnalyses.error.description) are unchanged by this visual-only polish — only presentation classes moved",
    (() => {
      const errorBody = extractErrorStateBody();

      return (
        errorBody.includes("{myAnalyses.error.heading}") &&
        errorBody.includes("{myAnalyses.error.description}") &&
        errorBody.includes(
          "<RetryListErrorButton label={myAnalyses.error.retryLabel} />"
        )
      );
    })()
  );

  check(
    "EN and RU myAnalyses.error copy strings are unchanged by this feature (still the exact pre-existing strings, no new/edited error message keys)",
    (() => {
      const messagesSource = readFileSync("lib/messages.ts", "utf8");

      return (
        messagesSource.includes(
          'heading: "Could not load your analyses."'
        ) &&
        messagesSource.includes(
          'description: "Please refresh the page to try again."'
        ) &&
        messagesSource.includes('retryLabel: "Try again"') &&
        messagesSource.includes('retryLabel: "Повторить"')
      );
    })()
  );

  check(
    "the Retry button's action height is now h-[44px] (matching Empty/NoResults' action-button height), not the old h-10 — while every other retry behavior stays intact",
    (() => {
      const retryButtonSource = readFileSync(
        "app/my-analyses/retry-list-error.tsx",
        "utf8"
      );

      return (
        retryButtonSource.includes("mt-6 inline-flex h-[44px]") &&
        !retryButtonSource.includes("h-10 ") &&
        retryButtonSource.includes(BRANDED_FOCUS_VISIBLE) &&
        retryButtonSource.includes("router.refresh()") &&
        !retryButtonSource.includes("location.reload") &&
        !retryButtonSource.includes("window.location") &&
        retryButtonSource.includes("disabled={isPending}") &&
        retryButtonSource.includes("useTransition()") &&
        retryButtonSource.includes("startTransition(() => {")
      );
    })()
  );

  check(
    "the Rename dialog's Cancel and Confirm buttons both now carry the branded focus-visible treatment, with their disabled/pending/color/dimension classes otherwise unchanged",
    (() => {
      const renameSource = readFileSync(
        "app/my-analyses/rename-analysis-dialog.tsx",
        "utf8"
      );
      const brandedCount = (
        renameSource.match(/focus-visible:outline-\[#7C3AED\]/g) ?? []
      ).length;

      return (
        brandedCount === 2 &&
        renameSource.includes(
          'className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#6B7280] transition hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"'
        ) &&
        renameSource.includes(
          'className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[#7C3AED] px-4 text-[13px] font-semibold text-white transition hover:bg-[#6D28D9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"'
        ) &&
        renameSource.includes("disabled={isSaving}") &&
        renameSource.includes(
          "{isSaving ? renameMessages.saving : renameMessages.confirm}"
        )
      );
    })()
  );

  check(
    "the Delete dialog's Cancel and destructive Confirm buttons both now carry the branded focus-visible treatment, with the destructive red background/hover and disabled/pending behavior otherwise unchanged",
    (() => {
      const deleteSource = readFileSync(
        "app/my-analyses/delete-analysis-dialog.tsx",
        "utf8"
      );
      const brandedCount = (
        deleteSource.match(/focus-visible:outline-\[#7C3AED\]/g) ?? []
      ).length;

      return (
        brandedCount === 2 &&
        deleteSource.includes(
          'className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#6B7280] transition hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"'
        ) &&
        deleteSource.includes("bg-[#EF4444]") &&
        deleteSource.includes("hover:bg-[#DC2626]") &&
        deleteSource.includes(
          'className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[#EF4444] px-4 text-[13px] font-semibold text-white transition hover:bg-[#DC2626] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"'
        ) &&
        deleteSource.includes("disabled={isDeleting}") &&
        deleteSource.includes(
          "{isDeleting ? deleteMessages.deleting : deleteMessages.confirm}"
        )
      );
    })()
  );

  check(
    "no route-level loading.tsx or error.tsx was added by this polish feature, and no new URL/debug state was introduced",
    (() => {
      let loadingRouteFileExists = true;
      let errorRouteFileExists = true;

      try {
        readFileSync("app/my-analyses/loading.tsx", "utf8");
      } catch {
        loadingRouteFileExists = false;
      }

      try {
        readFileSync("app/my-analyses/error.tsx", "utf8");
      } catch {
        errorRouteFileExists = false;
      }

      return (
        !loadingRouteFileExists &&
        !errorRouteFileExists &&
        !searchSource.includes("useSearchParams") &&
        !contentSource.includes("useSearchParams")
      );
    })()
  );
}

// Mobile polish — same source-shape convention as the other checkXShape
// functions above (no React/DOM test harness exists here). Scoped to each
// control's own function body/class-string, mirroring
// checkUiPolishShape's own approach.
function checkMobilePolishShape(): void {
  const searchSource = readFileSync(
    "app/my-analyses/analyses-search.tsx",
    "utf8"
  );
  const overflowMenuSource = readFileSync(
    "app/my-analyses/overflow-menu.tsx",
    "utf8"
  );

  const searchBarSource = extractFunctionSource(
    searchSource,
    "AnalysesSearchBar"
  );

  check(
    "the search clear button has an explicit accessible hit area (h-8 w-8, not the old p-1-only sizing), with the same X icon and clear behavior unchanged",
    (() => {
      const clearButtonStart = searchBarSource.indexOf(
        'onClick={() => setQuery("")}'
      );
      const clearButtonEnd =
        clearButtonStart >= 0
          ? searchBarSource.indexOf("</button>", clearButtonStart)
          : -1;
      const clearButtonSource =
        clearButtonStart >= 0 && clearButtonEnd > clearButtonStart
          ? searchBarSource.slice(clearButtonStart, clearButtonEnd)
          : "";

      return (
        clearButtonSource.includes("h-8 w-8") &&
        !clearButtonSource.includes(" p-1 ") &&
        clearButtonSource.includes("<X size={14} aria-hidden=\"true\" />") &&
        clearButtonSource.includes(BRANDED_FOCUS_VISIBLE)
      );
    })()
  );

  check(
    "OpenAnalysisButton (shared by the desktop table row and the mobile card) is bigger by default for a mobile tap target, with an explicit lg:h-8 override restoring the exact pre-existing desktop height — no separate mobile-only component was created",
    (() => {
      const openButtonSource = extractFunctionSource(
        searchSource,
        "OpenAnalysisButton"
      );

      // Anchored on the override sitting immediately before the class
      // string's own closing quote (`lg:h-8",`) rather than just
      // `.includes("lg:h-8")` — this file's own explanatory comment above
      // the className also mentions "lg:h-8" in prose, so a bare substring
      // check would pass even if the real className lacked it.
      return (
        /\bh-10\b/.test(openButtonSource) &&
        openButtonSource.includes('lg:h-8",')
      );
    })()
  );

  check(
    "the overflow-menu trigger is bigger by default for a mobile tap target, with an explicit lg:h-8 lg:w-8 override restoring the exact pre-existing desktop size",
    (() => {
      const triggerStart = overflowMenuSource.indexOf(
        "<button\n        ref={triggerRef}"
      );
      const triggerEnd =
        triggerStart >= 0
          ? overflowMenuSource.indexOf("</button>", triggerStart)
          : -1;
      const triggerSource =
        triggerStart >= 0 && triggerEnd > triggerStart
          ? overflowMenuSource.slice(triggerStart, triggerEnd)
          : "";

      // Anchored on the override sitting immediately before the
      // className attribute's own closing quote (`lg:h-8 lg:w-8"`) —
      // same rationale as the OpenAnalysisButton check above.
      return (
        /\bh-10 w-10\b/.test(triggerSource) &&
        triggerSource.includes('lg:h-8 lg:w-8"')
      );
    })()
  );

  check(
    "this feature did not touch long-title behavior, Risk Filter chips, Pagination button heights, or the mobile header CTA/sign-out (the mobile card's action-row layout and the bottom navigation's height/padding are intentionally updated by the mobile-polish feature — see its dedicated checks below)",
    (() => {
      const mobileCardSource = extractFunctionSource(
        searchSource,
        "AnalysisMobileCard"
      );
      const filterBarSource = extractFunctionSource(
        searchSource,
        "AnalysesFilterBar"
      );
      const paginationSource = extractFunctionSource(
        searchSource,
        "PaginationControls"
      );
      const signOutSource = readFileSync(
        "app/my-analyses/sidebar-sign-out-button.tsx",
        "utf8"
      );
      const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");

      return (
        mobileCardSource.includes('className="truncate text-[15px]') &&
        filterBarSource.includes("h-9") &&
        !filterBarSource.includes("h-10") &&
        paginationSource.includes("h-9") &&
        !paginationSource.includes("h-10") &&
        signOutSource.includes("h-9") &&
        !signOutSource.includes("h-10") &&
        pageSource.includes(
          'className="inline-flex h-9 items-center justify-center rounded-full bg-[#7C3AED] px-4 text-[13px] font-semibold text-white"'
        )
      );
    })()
  );

  check(
    "no localization work was introduced — messages.ts is untouched by this feature (no new/changed message keys)",
    (() => {
      const messagesSource = readFileSync("lib/messages.ts", "utf8");

      // A loose but sufficient guard: the exact known myAnalyses.loading /
      // error.retryLabel keys from the prior feature must still be the
      // most recently added myAnalyses-scoped keys — i.e. this feature
      // didn't add anything new under myAnalyses in either locale block.
      return (
        messagesSource.includes("retryLabel: \"Try again\"") &&
        messagesSource.includes("retryLabel: \"Повторить\"")
      );
    })()
  );

  check(
    "no route-level loading.tsx or error.tsx was added, and no URL-based state (useSearchParams/router.push with query strings) was introduced for Search/Filter/Pagination",
    (() => {
      let hasLoadingFile = false;
      let hasErrorFile = false;

      try {
        readFileSync("app/my-analyses/loading.tsx", "utf8");
        hasLoadingFile = true;
      } catch {
        hasLoadingFile = false;
      }

      try {
        readFileSync("app/my-analyses/error.tsx", "utf8");
        hasErrorFile = true;
      } catch {
        hasErrorFile = false;
      }

      return (
        !hasLoadingFile &&
        !hasErrorFile &&
        !searchSource.includes("useSearchParams") &&
        !searchSource.includes("router.push")
      );
    })()
  );

  // --- Tablet-width / overflow-safety / card-stack / pagination-wrap -----

  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");

  check(
    "the mobile wrapper has an overflow-x-hidden safety boundary, still shows/hides via the same block/lg:hidden pair, and the desktop tree is still hidden lg:flex",
    pageSource.includes('className="block overflow-x-hidden lg:hidden"') &&
      pageSource.includes('className="hidden lg:flex"')
  );

  check(
    "the mobile content shell widens to max-w-[640px] at md (tablet widths below lg), while keeping the existing max-w-[430px] phone cap as the base",
    (() => {
      const shellStart = pageSource.indexOf(
        'className="mx-auto w-full max-w-[430px]'
      );
      const shellEnd =
        shellStart >= 0 ? pageSource.indexOf('"', shellStart + 11) : -1;
      const shellClass =
        shellStart >= 0 && shellEnd > shellStart
          ? pageSource.slice(shellStart, shellEnd)
          : "";

      return (
        shellClass.includes("max-w-[430px]") &&
        shellClass.includes("md:max-w-[640px]")
      );
    })()
  );

  check(
    "the bottom-navigation inner container uses the exact same tablet cap (max-w-[430px] base, md:max-w-[640px]) as the content shell — no width mismatch between scrollable content and the fixed nav",
    (() => {
      const navInnerStart = pageSource.indexOf(
        'className="mx-auto flex h-[76px] w-full max-w-[430px]'
      );
      const navInnerEnd =
        navInnerStart >= 0 ? pageSource.indexOf('"', navInnerStart + 11) : -1;
      const navInnerClass =
        navInnerStart >= 0 && navInnerEnd > navInnerStart
          ? pageSource.slice(navInnerStart, navInnerEnd)
          : "";

      return (
        navInnerClass.includes("max-w-[430px]") &&
        navInnerClass.includes("md:max-w-[640px]")
      );
    })()
  );

  check(
    "no two-column card grid was introduced at any width, and the lg breakpoint remains the one and only desktop/mobile switch — no new md:/tablet-specific breakpoint switch was added",
    !pageSource.includes("grid-cols-2") &&
      !searchSource.includes("grid-cols-2") &&
      !pageSource.includes("md:hidden") &&
      !pageSource.includes("md:block") &&
      !pageSource.includes("md:flex")
  );

  check(
    "AnalysisMobileCard's lower section is structurally two separate rows (a score/risk row, then a full actions row) rather than one row that only sometimes fits — a permanent stack, not a responsive one, since this card is never rendered on desktop",
    (() => {
      const mobileCardSource = extractFunctionSource(
        searchSource,
        "AnalysisMobileCard"
      );

      return (
        mobileCardSource.includes(
          'className="mt-4 flex flex-col gap-3"'
        ) &&
        mobileCardSource.includes('className="flex items-center gap-4"') &&
        mobileCardSource.includes('className="flex items-center gap-2"')
      );
    })()
  );

  check(
    "the Open Analysis button flex-grows to fill the mobile actions row (via a className prop passed only at this call site), while the overflow trigger keeps its fixed h-10 w-10 touch target and the desktop table's own OpenAnalysisButton call site is untouched",
    (() => {
      const mobileCardSource = extractFunctionSource(
        searchSource,
        "AnalysisMobileCard"
      );
      const desktopTableSource = extractFunctionSource(
        searchSource,
        "AnalysesTable"
      );

      return (
        mobileCardSource.includes(
          '<OpenAnalysisButton\n            id={item.id}\n            title={item.title}\n            label={myAnalyses.table.open}\n            className="flex-1"\n          />'
        ) &&
        !desktopTableSource.includes('className="flex-1"') &&
        /\bh-10 w-10\b/.test(overflowMenuSource) &&
        overflowMenuSource.includes('lg:h-8 lg:w-8"')
      );
    })()
  );

  check(
    "no score, risk, label, button, or menu was removed from the mobile card — ScoreCell (overall/hook), RiskIndicator/ScoreUnavailableBadge, OpenAnalysisButton, and AnalysisActionsMenu are all still present exactly once each",
    (() => {
      const mobileCardSource = extractFunctionSource(
        searchSource,
        "AnalysisMobileCard"
      );

      return (
        (mobileCardSource.match(/<ScoreCell/g) ?? []).length === 2 &&
        mobileCardSource.includes("<RiskIndicator") &&
        mobileCardSource.includes("<ScoreUnavailableBadge") &&
        mobileCardSource.includes("<OpenAnalysisButton") &&
        mobileCardSource.includes("<AnalysisActionsMenu")
      );
    })()
  );

  check(
    "the desktop table (AnalysesTable) is completely untouched by the mobile card restructuring — still its own separate component, still a <table>, still rendering scores/risk/actions in table cells",
    (() => {
      const desktopTableSource = extractFunctionSource(
        searchSource,
        "AnalysesTable"
      );

      return (
        desktopTableSource.includes("<table") &&
        !desktopTableSource.includes("flex-col gap-3") &&
        desktopTableSource.includes("<OpenAnalysisButton") &&
        desktopTableSource.includes("<AnalysisActionsMenu")
      );
    })()
  );

  check(
    "PaginationControls wraps safely below lg (flex-wrap, the page-indicator forced onto its own full-width row via order-first + w-full so Previous/Next always share a predictable second row) while lg: restores the exact original single-row, single-order, gap-4 desktop layout",
    (() => {
      const paginationSource = extractFunctionSource(
        searchSource,
        "PaginationControls"
      );

      return (
        paginationSource.includes(
          'className="mt-4 flex flex-wrap items-center justify-center gap-3 lg:flex-nowrap lg:gap-4"'
        ) &&
        paginationSource.includes(
          'className="order-first w-full text-center text-[13px] font-medium text-[#6B7280] lg:order-none lg:w-auto"'
        )
      );
    })()
  );

  check(
    "pagination's own math, disabled logic, aria-live announcement, and exact labels are unchanged by the wrap-safety restructuring",
    (() => {
      const paginationSource = extractFunctionSource(
        searchSource,
        "PaginationControls"
      );

      return (
        paginationSource.includes("if (totalPages <= 1)") &&
        paginationSource.includes("return null;") &&
        paginationSource.includes("disabled={page <= 1}") &&
        paginationSource.includes("disabled={page >= totalPages}") &&
        paginationSource.includes("onClick={() => setPage(page - 1)}") &&
        paginationSource.includes("onClick={() => setPage(page + 1)}") &&
        paginationSource.includes('aria-live="polite"') &&
        paginationSource.includes("{paginationMessages.previousLabel}") &&
        paginationSource.includes("{paginationMessages.nextLabel}") &&
        paginationSource.includes(
          "{paginationMessages.pageLabel} {page} {paginationMessages.ofLabel}"
        )
      );
    })()
  );

  check(
    "the fixed bottom navigation includes env(safe-area-inset-bottom) as reserved bottom clearance, still uses z-50, and its three destinations/active-state markup are unchanged",
    (() => {
      const navStart = pageSource.indexOf("{/* Total height is");
      const navEnd =
        navStart >= 0 ? pageSource.indexOf("</div>\n        </div>", navStart) : -1;
      const navSource =
        navStart >= 0 && navEnd > navStart
          ? pageSource.slice(navStart, navEnd)
          : "";

      return (
        navSource.includes("h-[calc(76px+env(safe-area-inset-bottom))]") &&
        navSource.includes("pb-[env(safe-area-inset-bottom)]") &&
        navSource.includes("z-50") &&
        navSource.includes('aria-current="page"') &&
        navSource.includes("<PencilLine size={14} />") &&
        navSource.includes("<History size={14} />") &&
        navSource.includes("<HelpCircle size={14} />") &&
        navSource.includes("{results.nav.newAnalysisMobileNav}") &&
        navSource.includes("{messages.common.myAnalyses}") &&
        navSource.includes("{messages.landing.nav.howItWorks}")
      );
    })()
  );

  check(
    "the mobile content shell's bottom padding was widened to clear the safe-area-extended bottom nav (calc(100px+env(safe-area-inset-bottom)), not a bare new pixel value)",
    pageSource.includes(
      "pb-[calc(100px+env(safe-area-inset-bottom))]"
    ) && !pageSource.includes('pb-[100px]"')
  );

  check(
    "the filter-chip row (already flex-wrap, already overflow-safe) was left unchanged by this feature — no horizontal-scroll chips, abbreviated labels, hidden filters, or logic changes were introduced",
    (() => {
      const filterBarSource = extractFunctionSource(
        searchSource,
        "AnalysesFilterBar"
      );

      return (
        filterBarSource.includes(
          'className="mb-4 flex flex-wrap items-center gap-2"'
        ) &&
        !filterBarSource.includes("overflow-x-auto") &&
        !filterBarSource.includes("overflow-x-scroll")
      );
    })()
  );

  check(
    "Rename and Delete dialogs were not touched by this mobile-polish feature — no max-height/overflow-y-auto was added without a reproduced defect",
    (() => {
      const renameSource = readFileSync(
        "app/my-analyses/rename-analysis-dialog.tsx",
        "utf8"
      );
      const deleteSource = readFileSync(
        "app/my-analyses/delete-analysis-dialog.tsx",
        "utf8"
      );

      return (
        !renameSource.includes("max-h-") &&
        !renameSource.includes("overflow-y-auto") &&
        !deleteSource.includes("max-h-") &&
        !deleteSource.includes("overflow-y-auto") &&
        renameSource.includes("max-w-[420px]") &&
        deleteSource.includes("max-w-[420px]")
      );
    })()
  );

  check(
    "Search, Risk Filter AND logic, pagination math, and rename/delete are still driven by the same unchanged functions this feature never touched",
    searchSource.includes("function filterAnalysesByTitle") &&
      searchSource.includes("function filterAnalysesByRisk") &&
      searchSource.includes("function paginateAnalyses") &&
      searchSource.includes("function getTotalPages") &&
      /PAGE_SIZE\s*=\s*10/.test(searchSource)
  );
}

// My Analyses localization — same source-shape convention as the other
// checkXShape functions above (no React/DOM test harness exists here).
// The executable formatAnalysisCreatedAt checks below are the one part of
// this feature that's a pure function, so those are exercised directly
// rather than only inspected as source text.
function checkLocalizationShape(): void {
  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");
  const contentSource = readFileSync(
    "app/my-analyses/analyses-content.tsx",
    "utf8"
  );
  const searchSource = readFileSync(
    "app/my-analyses/analyses-search.tsx",
    "utf8"
  );
  const listSource = readFileSync(
    "app/my-analyses/analyses-list.ts",
    "utf8"
  );

  check(
    "the fixed English/Russian mix bug is fixed: page.tsx no longer hardcodes getMessages(DEFAULT_LOCALE), and resolves the real locale via getServerLocale() instead",
    !pageSource.includes("getMessages(DEFAULT_LOCALE)") &&
      pageSource.includes(
        'import { getServerLocale } from "../../lib/server-locale";'
      ) &&
      pageSource.includes("const locale = await getServerLocale();") &&
      pageSource.includes("const messages = getMessages(locale);")
  );

  check(
    "the resolved locale is threaded into both DesktopAnalysesContent and MobileAnalysesContent as a plain prop — never refetched or re-resolved per breakpoint",
    (pageSource.match(/locale=\{locale\}/g) ?? []).length === 2
  );

  check(
    "analyses-content.tsx's AnalysesContentProps declares locale as the plain Locale type (a string union), not a function, and forwards it unchanged into both results components",
    contentSource.includes("locale: Locale;") &&
      (contentSource.match(/locale=\{locale\}/g) ?? []).length === 2
  );

  check(
    "every formatAnalysisCreatedAt call site in analyses-search.tsx now passes the resolved locale — none left calling it with only a timestamp",
    (searchSource.match(/formatAnalysisCreatedAt\(item\.createdAt, locale\)/g) ?? [])
      .length === 3 &&
      !/formatAnalysisCreatedAt\(item\.createdAt\)(?!,)/.test(searchSource)
  );

  check(
    "AnalysesSearchDesktopResults/MobileResults, AnalysesTable, AnalysisMobileCard, and ScriptCell all declare locale as a plain Locale prop (never a function type)",
    (searchSource.match(/locale: Locale;?/g) ?? []).length >= 5
  );

  check(
    "the per-analysis language badge (localeLabel(item.locale)) is untouched by this feature — it still reads the analysis row's own stored locale, never the interface locale",
    (searchSource.match(/localeLabel\(item\.locale\)/g) ?? []).length === 2
  );

  check(
    "user-created analysis titles are still rendered as plain, untranslated content — never passed through a message lookup or translation function",
    searchSource.includes("{item.title}") &&
      !/myAnalyses\.[a-zA-Z.]*\(item\.title\)/.test(searchSource) &&
      !/messages\.[a-zA-Z.]*\(item\.title\)/.test(searchSource)
  );

  check(
    "formatAnalysisCreatedAt now accepts an explicit locale parameter with deterministic en-US/ru-RU Intl tags, defaulting to DEFAULT_LOCALE, and still falls back to the raw ISO string on any formatting error",
    listSource.includes('en: "en-US"') &&
      listSource.includes('ru: "ru-RU"') &&
      listSource.includes("locale: Locale = DEFAULT_LOCALE") &&
      /catch\s*\{\s*return isoTimestamp;\s*\}/.test(listSource)
  );

  check(
    "formatAnalysisCreatedAt actually renders different, locale-appropriate output for en vs ru for the same timestamp",
    (() => {
      const timestamp = "2026-03-05T14:30:00.000Z";
      const enFormatted = formatAnalysisCreatedAt(timestamp, "en");
      const ruFormatted = formatAnalysisCreatedAt(timestamp, "ru");

      return (
        enFormatted.length > 0 &&
        ruFormatted.length > 0 &&
        enFormatted !== ruFormatted &&
        // A concrete, deterministic signal that these are genuinely
        // locale-formatted, not just coincidentally different strings —
        // English's medium date style spells the month, Russian's does
        // not use "March" or "Mar" for it.
        /Mar/.test(enFormatted) &&
        !/Mar/.test(ruFormatted)
      );
    })()
  );

  check(
    "formatAnalysisCreatedAt still falls back to the raw ISO string, unchanged, when given an unparseable timestamp — for both en and ru",
    formatAnalysisCreatedAt("not-a-date", "en") === "not-a-date" &&
      formatAnalysisCreatedAt("not-a-date", "ru") === "not-a-date"
  );

  check(
    "formatAnalysisCreatedAt still works when called with no locale argument at all (defaults safely, backward compatible with any other caller)",
    formatAnalysisCreatedAt("2026-03-05T14:30:00.000Z").length > 0
  );

  check(
    "the [id] route (opened-analysis error state and not-found state) resolves the same real locale, via the same getServerLocale() helper — no separate/second locale-resolution path",
    (() => {
      const idPageSource = readFileSync(
        "app/my-analyses/[id]/page.tsx",
        "utf8"
      );
      const notFoundSource = readFileSync(
        "app/my-analyses/[id]/not-found.tsx",
        "utf8"
      );

      return (
        !idPageSource.includes("getMessages(DEFAULT_LOCALE)") &&
        idPageSource.includes(
          'import { getServerLocale } from "../../../lib/server-locale";'
        ) &&
        idPageSource.includes("const locale = await getServerLocale();") &&
        !notFoundSource.includes("getMessages(DEFAULT_LOCALE)") &&
        notFoundSource.includes(
          'import { getServerLocale } from "../../../lib/server-locale";'
        ) &&
        notFoundSource.includes(
          "const locale = await getServerLocale();"
        ) &&
        // not-found.tsx's export must now be async — getServerLocale()
        // returns a Promise, and a non-async component could never await
        // it.
        notFoundSource.includes(
          "export default async function AnalysisNotFound()"
        )
      );
    })()
  );

  check(
    "the single shared cache()-backed accessor is untouched by this feature — still exactly two call sites (one per breakpoint), no new/duplicated fetch introduced by locale threading",
    (contentSource.match(/await getMyAnalysesResult\(\)/g) ?? []).length === 2
  );

  check(
    "lib/server-locale.ts is the one server-only piece of this feature — it imports next/headers, but lib/i18n.ts (imported by Client Components) never does",
    (() => {
      const serverLocaleSource = readFileSync(
        "lib/server-locale.ts",
        "utf8"
      );
      const i18nSource = readFileSync("lib/i18n.ts", "utf8");

      return (
        serverLocaleSource.includes('from "next/headers"') &&
        !i18nSource.includes("next/headers")
      );
    })()
  );

  check(
    "getServerLocale reuses normalizeApiLocale (the existing, already-tested strict server-side validation rule) rather than a new, separately-invented cookie-parsing rule",
    readFileSync("lib/server-locale.ts", "utf8").includes(
      "normalizeApiLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)"
    )
  );

  check(
    "LocaleProvider writes the locale cookie in both the mount-sync effect and setLocale, keeping it synchronized with localStorage on every change, and guards the one-time migration refresh with a ref so it can only ever fire once",
    (() => {
      const providerSource = readFileSync(
        "app/locale-provider.tsx",
        "utf8"
      );

      return (
        (providerSource.match(/document\.cookie = buildLocaleCookieString/g) ?? [])
          .length === 2 &&
        providerSource.includes("hasSyncedLocaleCookieRef") &&
        providerSource.includes("hasSyncedLocaleCookieRef.current = true;") &&
        // The refresh call must be reachable only through the ref guard —
        // never unconditional.
        /if \(!hasSyncedLocaleCookieRef\.current\) \{[\s\S]{0,120}router\.refresh\(\)/.test(
          providerSource
        )
      );
    })()
  );

  check(
    "no Ukrainian locale was added — this feature is scoped to the two currently launched locales only",
    LAUNCHED_LOCALES.length === 2 &&
      LAUNCHED_LOCALES.includes("en") &&
      LAUNCHED_LOCALES.includes("ru") &&
      !(LAUNCHED_LOCALES as readonly string[]).includes("uk")
  );

  check(
    "no LanguageSwitcher was added to My Analyses' own chrome — locale selection remains available only through the existing product locations",
    !pageSource.includes("LanguageSwitcher") &&
      !contentSource.includes("LanguageSwitcher") &&
      !searchSource.includes("LanguageSwitcher")
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
  checkPaginationHelpers();
  checkDateFormatting();
  checkMessageCoverage();
  checkPageSourceShape();
  checkDashboardShape();
  checkSearchShape();
  checkFiltersShape();
  checkPaginationShape();
  checkLoadingAndRetryShape();
  checkUiPolishShape();
  checkMobilePolishShape();
  checkLocalizationShape();

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
