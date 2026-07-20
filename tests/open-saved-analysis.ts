import { readFileSync } from "node:fs";

import { LAUNCHED_LOCALES } from "../lib/i18n";
import { getMessages } from "../lib/messages";
import {
  fetchAnalysisById,
  isValidAnalysisId,
  type AnalysisByIdClient,
} from "../app/my-analyses/[id]/fetch-analysis";

let failures = 0;

function check(label: string, pass: boolean, detail?: string): void {
  if (pass) {
    console.log(`PASS — ${label}`);
    return;
  }

  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ""}`);
}

// Same script + result pair tests/analysis-v2-validation.ts already
// confirms passes validateAnalysisV2Result under the default "en" locale —
// reused here so fetchAnalysisById's "found" path is exercised against a
// genuinely valid stored analysis, not a hand-waved shape.
const script =
  "If super glue gets stuck to your skin, do not pull it apart. First, soak the area in warm soapy water. Then gently roll the skin apart. It usually comes apart in under five minutes.";

function createValidResultJson(): Record<string, unknown> {
  return {
    scriptType: "how_to",
    verdict: "strong",
    scores: { overall: 84, hook: 82, retentionRisk: 22 },
    hookDecision: "keep",
    hookAssessment:
      "The hook names the problem and gives an immediate warning.",
    riskyParts: [],
    suggestedFixes: [
      {
        target: "clarity",
        suggestion:
          "Optionally shorten the final resolution so the ending lands faster.",
        optional: true,
      },
    ],
    scenes: [
      {
        excerpt:
          "If super glue gets stuck to your skin, do not pull it apart.",
        label: "Problem and warning",
        status: "strong",
      },
      {
        excerpt: "First, soak the area in warm soapy water.",
        label: "First step",
        status: "strong",
      },
      {
        excerpt: "It usually comes apart in under five minutes.",
        label: "Resolution",
        status: "strong",
      },
    ],
    mainTakeaway:
      "This how-to script is structurally strong and fulfills its promise.",
  };
}

const SAMPLE_ID = "11111111-1111-4111-8111-111111111111";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SAMPLE_ID,
    title: "How to remove super glue",
    script,
    locale: "en",
    result_json: createValidResultJson(),
    model_used: "gpt-4.1-mini",
    ...overrides,
  };
}

// Records exactly how it was called, matching the pattern already used by
// tests/my-analyses.ts's makeClient — deliberately has no method this mock
// doesn't implement, so a call to one (e.g. a stray .eq("user_id", ...))
// would throw and fail the test loudly instead of silently passing.
function makeClient(data: unknown, error: { code?: string } | null = null) {
  const calls: {
    selectColumns?: string;
    eqColumn?: string;
    eqValue?: string;
  } = {};

  const client: AnalysisByIdClient = {
    from(table) {
      check(`queries the "${table}" table`, table === "analyses");

      return {
        select(columns) {
          calls.selectColumns = columns;

          return {
            eq(column, value) {
              calls.eqColumn = column;
              calls.eqValue = value;

              return {
                maybeSingle() {
                  return Promise.resolve({ data, error });
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

// --- Owner access -----------------------------------------------------

async function checkOwnerAccess(): Promise<void> {
  const { client, calls } = makeClient(makeRow());
  const result = await fetchAnalysisById(client, SAMPLE_ID);

  check(
    "a row visible to the caller (owned by them, per RLS) resolves as found",
    result.status === "found"
  );

  if (result.status === "found") {
    check(
      "the found analysis carries the original script, title, locale, and model verbatim",
      result.analysis.script === script &&
        result.analysis.title === "How to remove super glue" &&
        result.analysis.locale === "en" &&
        result.analysis.modelUsed === "gpt-4.1-mini"
    );

    check(
      "the found analysis's result is the fully validated AnalysisV2Result",
      result.analysis.result.scores.overall === 84
    );
  }

  check(
    "the query filters by the requested id",
    calls.eqColumn === "id" && calls.eqValue === SAMPLE_ID
  );

  check(
    "the query never selects user_id (RLS is the only ownership boundary, not a client-supplied filter)",
    typeof calls.selectColumns === "string" &&
      !calls.selectColumns.includes("user_id")
  );
}

// --- Unauthorized / missing access ----------------------------------------
//
// RLS's analyses_select_own policy makes "no row with this id" and "a row
// exists but is owned by someone else" indistinguishable at the query
// level — both come back as { data: null, error: null }. This is the
// correct, secure behavior (see app/my-analyses/[id]/page.tsx's comment):
// telling them apart would leak which ids belong to another user.

async function checkUnauthorizedOrMissingAccess(): Promise<void> {
  const { client } = makeClient(null, null);
  const result = await fetchAnalysisById(client, SAMPLE_ID);

  check(
    "a row that doesn't exist — or belongs to another user — resolves as not-found, never a distinct error",
    result.status === "not-found"
  );
}

async function checkDatabaseError(): Promise<void> {
  const { client } = makeClient(null, { code: "57014" });
  const result = await fetchAnalysisById(client, SAMPLE_ID);

  check(
    "a real database error is surfaced distinctly from not-found",
    result.status === "database-error"
  );
}

async function checkUnexpectedClientError(): Promise<void> {
  const client: AnalysisByIdClient = {
    from() {
      throw new Error("network failure");
    },
  };

  const result = await fetchAnalysisById(client, SAMPLE_ID);

  check(
    "an unexpected client-level error is caught and surfaced as a database failure, not a crash",
    result.status === "database-error"
  );
}

// --- Malformed stored data -------------------------------------------------

async function checkMalformedRow(): Promise<void> {
  const missingTitle = makeClient(makeRow({ title: null }));
  const missingTitleResult = await fetchAnalysisById(
    missingTitle.client,
    SAMPLE_ID
  );

  check(
    "a row missing a required text field (title) is surfaced as invalid, not a crash",
    missingTitleResult.status === "invalid"
  );

  const badLocale = makeClient(makeRow({ locale: "fr" }));
  const badLocaleResult = await fetchAnalysisById(
    badLocale.client,
    SAMPLE_ID
  );

  check(
    "a locale outside en/ru (never written by this app's own CHECK constraint, but never trusted either) is surfaced as invalid",
    badLocaleResult.status === "invalid"
  );

  const badResult = makeClient(
    makeRow({ result_json: { not: "a valid analysis result" } })
  );
  const badResultResult = await fetchAnalysisById(
    badResult.client,
    SAMPLE_ID
  );

  check(
    "a result_json that fails the shared AnalysisV2Result validator is surfaced as invalid, never rendered",
    badResultResult.status === "invalid"
  );
}

// --- isValidAnalysisId ------------------------------------------------

function checkIsValidAnalysisId(): void {
  check("a well-formed uuid is accepted", isValidAnalysisId(SAMPLE_ID));

  check(
    "a non-uuid value never reaches the database — rejected up front",
    !isValidAnalysisId("not-a-uuid") &&
      !isValidAnalysisId("../../etc/passwd") &&
      !isValidAnalysisId("")
  );
}

// --- Source-shape checks ---------------------------------------------
//
// No React/DOM test harness exists in this repo's test suite (see
// tests/my-analyses.ts's own rationale) — page-level wiring that can't be
// exercised as a pure function is verified against the source instead.

function checkPageSourceShape(): void {
  const pageSource = readFileSync("app/my-analyses/[id]/page.tsx", "utf8");

  check(
    "a signed-out visitor is redirected to /login with a next path back to this exact analysis",
    pageSource.includes(
      "redirect(`/login?next=${encodeURIComponent(`/my-analyses/${id}`)}`)"
    )
  );

  check(
    "both an invalid id and an inaccessible/missing row call notFound() — never a distinct 'belongs to someone else' message",
    (pageSource.match(/notFound\(\)/g) ?? []).length === 2
  );

  check(
    "the page fetches with the session-bound (cookie-based) Supabase server client",
    pageSource.includes(
      'import { createSupabaseServerClient } from "../../../lib/supabase/server";'
    )
  );

  check(
    "the page never uses the service-role client or references its secret key",
    !pageSource.includes('from "../../../lib/supabase"') &&
      !pageSource.includes("SUPABASE_SECRET_KEY")
  );

  check(
    "opening an analysis never calls OpenAI or the analyze-v2/improve APIs — no new analysis runs, no recomputation",
    !pageSource.includes("openai") &&
      !pageSource.includes("/api/analyze-v2") &&
      !pageSource.includes("/api/improve")
  );

  check(
    "opening an analysis never inserts a row — no accidental duplicate save",
    !pageSource.includes(".insert(")
  );
}

function checkHandoffSourceShape(): void {
  const handoffSource = readFileSync(
    "app/my-analyses/[id]/open-analysis-handoff.tsx",
    "utf8"
  );

  check(
    "the handoff writes the same sessionStorage keys a fresh analysis writes, so /results renders through its existing, unduplicated code path",
    handoffSource.includes('sessionStorage.setItem("reelyze-script"') &&
      handoffSource.includes('sessionStorage.setItem("reelyze-title"') &&
      handoffSource.includes("ANALYSIS_V2_STORAGE_KEY")
  );

  check(
    "the handoff marks this analysis as already-saved, so /results won't offer a duplicate Save",
    handoffSource.includes("writeReopenedAnalysisId(analysis.id)")
  );

  check(
    "the handoff redirects into the real Results page instead of rendering its own score cards/script view — no duplicate Results UI",
    handoffSource.includes('router.replace("/results")') &&
      !handoffSource.includes("ScoreRing") &&
      !handoffSource.includes("ScriptLinesContent") &&
      !handoffSource.includes("SuggestedFixesContent") &&
      !handoffSource.includes("DesktopScoreCard")
  );

  check(
    "the handoff never calls OpenAI, any API route, or insertAnalysis — purely a storage handoff",
    !handoffSource.includes("fetch(") &&
      !handoffSource.includes("openai") &&
      !handoffSource.includes("insertAnalysis")
  );
}

function checkResultsPageDedupShape(): void {
  const resultsSource = readFileSync("app/results/page.tsx", "utf8");

  check(
    "results/page.tsx reads the reopened-analysis marker and initializes Save Analysis into its existing 'saved' state instead of 'idle'",
    resultsSource.includes(
      "const reopenedAnalysisId = readAndClearReopenedAnalysisId();"
    ) &&
      /if \(reopenedAnalysisId\) \{[\s\S]{0,120}setSaveState\("saved"\)/.test(
        resultsSource
      )
  );

  check(
    "the marker is read-and-cleared unconditionally, before the invalid-stored-data early return — never only inside the success branch, which would let a leftover marker survive to incorrectly mark a later, genuinely unsaved fresh analysis as already saved",
    (() => {
      const markerIndex = resultsSource.indexOf(
        "const reopenedAnalysisId = readAndClearReopenedAnalysisId();"
      );
      const earlyReturnIndex = resultsSource.indexOf(
        "setStorageError(results.error.invalidAnalysis);"
      );

      return (
        markerIndex >= 0 &&
        earlyReturnIndex >= 0 &&
        markerIndex < earlyReturnIndex
      );
    })()
  );

  check(
    "the dedup change never touches the actual Save Analysis flow (validateAnalysisForSave, insertAnalysis, performSave all remain)",
    resultsSource.includes("validateAnalysisForSave") &&
      resultsSource.includes("insertAnalysis") &&
      resultsSource.includes("async function performSave()")
  );

  const saveAnalysisSource = readFileSync(
    "app/results/save-analysis.ts",
    "utf8"
  );

  check(
    "app/results/save-analysis.ts itself has no knowledge of reopened analyses — the dedup lives entirely outside it",
    !saveAnalysisSource.includes("reopened") &&
      !saveAnalysisSource.includes("Reopened")
  );
}

function checkOpenButtonSourceShape(): void {
  // The Open action's markup moved out of page.tsx into
  // analyses-search.tsx's shared OpenAnalysisButton (used by both the
  // desktop table row and the mobile card) when the Search feature
  // extracted row rendering — this check follows that move.
  const searchSource = readFileSync(
    "app/my-analyses/analyses-search.tsx",
    "utf8"
  );

  check(
    "the My Analyses Open action navigates to /my-analyses/[id] for the clicked row",
    searchSource.includes("href={`/my-analyses/${id}`}")
  );
}

// --- Localization -----------------------------------------------------

function checkMessageCoverage(): void {
  check(
    "myAnalyses.open.* keys are covered for every launched locale",
    LAUNCHED_LOCALES.every((locale) => {
      const open = getMessages(locale).myAnalyses.open;

      return (
        open.loadingHeading.length > 0 &&
        open.loadingDescription.length > 0 &&
        open.notFoundHeading.length > 0 &&
        open.notFoundDescription.length > 0 &&
        open.backLink.length > 0 &&
        open.errorHeading.length > 0 &&
        open.errorDescription.length > 0
      );
    })
  );

  check(
    "EN and RU myAnalyses.open.* strings are actually localized (not identical)",
    getMessages("en").myAnalyses.open.notFoundHeading !==
      getMessages("ru").myAnalyses.open.notFoundHeading &&
      getMessages("en").myAnalyses.open.loadingHeading !==
        getMessages("ru").myAnalyses.open.loadingHeading &&
      getMessages("en").myAnalyses.table.open !==
        getMessages("ru").myAnalyses.table.open
  );
}

// The opened-analysis route (this page.tsx plus not-found.tsx) used to
// hardcode getMessages(DEFAULT_LOCALE), the exact same "not threaded
// through server-rendered routes yet" gap app/my-analyses/page.tsx had —
// now both resolve the real locale via the same lib/server-locale.ts
// helper the list page uses, so the opened-analysis error state and the
// not-found state stay consistent with the rest of the signed-in
// experience instead of silently reverting to English.
function checkServerLocaleResolutionShape(): void {
  const pageSource = readFileSync("app/my-analyses/[id]/page.tsx", "utf8");
  const notFoundSource = readFileSync(
    "app/my-analyses/[id]/not-found.tsx",
    "utf8"
  );

  check(
    "the opened-analysis error state (page.tsx) no longer hardcodes getMessages(DEFAULT_LOCALE) — it resolves the real locale via getServerLocale()",
    !pageSource.includes("getMessages(DEFAULT_LOCALE)") &&
      pageSource.includes(
        'import { getServerLocale } from "../../../lib/server-locale";'
      ) &&
      pageSource.includes("const locale = await getServerLocale();") &&
      pageSource.includes("const messages = getMessages(locale);")
  );

  check(
    "the not-found state no longer hardcodes getMessages(DEFAULT_LOCALE) either, resolves the same way, and is now an async component (required to await getServerLocale())",
    !notFoundSource.includes("getMessages(DEFAULT_LOCALE)") &&
      notFoundSource.includes(
        'import { getServerLocale } from "../../../lib/server-locale";'
      ) &&
      notFoundSource.includes("const locale = await getServerLocale();") &&
      notFoundSource.includes(
        "export default async function AnalysisNotFound()"
      )
  );

  check(
    "both routes resolve locale through the exact same shared helper — no separate/duplicated cookie-reading logic invented per route",
    (() => {
      const serverLocaleSource = readFileSync(
        "lib/server-locale.ts",
        "utf8"
      );

      return (
        serverLocaleSource.includes(
          "export async function getServerLocale"
        ) &&
        pageSource.includes('from "../../../lib/server-locale"') &&
        notFoundSource.includes('from "../../../lib/server-locale"')
      );
    })()
  );

  check(
    "no Supabase query, RLS policy, schema, or service-role code was touched by this locale fix — only which locale getMessages() is called with changed",
    !pageSource.includes("service") &&
      !pageSource.includes(".rpc(") &&
      pageSource.includes(
        'import { createSupabaseServerClient } from "../../../lib/supabase/server";'
      )
  );
}

async function main(): Promise<void> {
  await checkOwnerAccess();
  await checkUnauthorizedOrMissingAccess();
  await checkDatabaseError();
  await checkUnexpectedClientError();
  await checkMalformedRow();
  checkIsValidAnalysisId();
  checkPageSourceShape();
  checkHandoffSourceShape();
  checkResultsPageDedupShape();
  checkOpenButtonSourceShape();
  checkMessageCoverage();
  checkServerLocaleResolutionShape();

  if (failures > 0) {
    console.error(`\nOpen Saved Analysis tests: ${failures} failed`);
    process.exitCode = 1;
  } else {
    console.log("\nOpen Saved Analysis tests: all passed");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL — unexpected error: ${message}`);
  process.exitCode = 1;
});
