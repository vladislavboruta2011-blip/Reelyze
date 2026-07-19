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
  // combined source of both files, not page.tsx alone.
  const searchSource = readFileSync(
    "app/my-analyses/analyses-search.tsx",
    "utf8"
  );
  const combinedSource = `${pageSource}\n${searchSource}`;

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
    /block lg:hidden/.test(pageSource) &&
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
    pageSource.includes('role="alert"') &&
      pageSource.includes("myAnalyses.error.heading") &&
      pageSource.includes("myAnalyses.error.description")
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

  check(
    "search state is shared via a single Context/Provider, not two independent desktop/mobile states",
    (searchSource.match(/= createContext/g) ?? []).length === 1 &&
      (searchSource.match(/function AnalysesSearchProvider/g) ?? [])
        .length === 1 &&
      (pageSource.match(/<AnalysesSearchProvider>/g) ?? []).length === 1
  );

  check(
    "the search bar is rendered once per breakpoint, both reading the same shared context",
    (pageSource.match(/<AnalysesSearchBar\b/g) ?? []).length === 2
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

  // page.tsx (a Server Component) must build plain, narrowed objects
  // (searchMyAnalyses/searchResults) before handing them to these Client
  // Components — the full `myAnalyses`/`results` message trees contain
  // function-valued keys elsewhere (e.g. myAnalyses.delete
  // .dialogDescriptionWithTitle, results.script.characterCount), and
  // Pick<> on the receiving prop type doesn't strip those at runtime, only
  // narrows the type. Passing the wide objects directly crashes with
  // "Functions cannot be passed directly to Client Components." the first
  // time the page actually renders (it's a force-dynamic route, so
  // `next build` never renders it to catch this). Scoped to just these
  // three tags' own prop lists — EmptyState/ErrorState are Server
  // Components too, so their unrelated `myAnalyses={myAnalyses}` usage
  // elsewhere in page.tsx is legitimate and must not trip this check.
  const searchClientCallSites = [
    ...pageSource.matchAll(/<AnalysesSearchBar\b[\s\S]*?\/>/g),
    ...pageSource.matchAll(/<AnalysesFilterBar\b[\s\S]*?\/>/g),
    ...pageSource.matchAll(/<AnalysesSearchDesktopResults\b[\s\S]*?\/>/g),
    ...pageSource.matchAll(/<AnalysesSearchMobileResults\b[\s\S]*?\/>/g),
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
    (pageSource.match(/<AnalysesFilterBar\b/g) ?? []).length === 2
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
      pageSource.includes("filters: myAnalyses.filters,")
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
    "pagination controls are rendered once per breakpoint via the shared results components (no separate control mounted directly in page.tsx)",
    (searchSource.match(/<PaginationControls\b/g) ?? []).length === 2 &&
      !pageSource.includes("PaginationControls")
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
    "only a narrow, explicitly-constructed plain object crosses the Server/Client boundary for pagination messages too — SearchMyAnalyses includes 'pagination', and page.tsx builds it as a plain field, never spreading the full myAnalyses tree",
    searchSource.includes(
      'Pick<Messages["myAnalyses"], "table" | "list" | "search" | "filters" | "pagination">'
    ) &&
      pageSource.includes("pagination: myAnalyses.pagination,") &&
      !pageSource.includes("...myAnalyses")
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
