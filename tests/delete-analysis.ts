import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { LAUNCHED_LOCALES } from "../lib/i18n";
import { getMessages } from "../lib/messages";
import {
  deleteAnalysis,
  type AnalysesDeleteClient,
} from "../app/my-analyses/delete-analysis";

let failures = 0;

function check(label: string, pass: boolean, detail?: string): void {
  if (pass) {
    console.log(`PASS — ${label}`);
    return;
  }

  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ""}`);
}

const SAMPLE_ID = "11111111-1111-4111-8111-111111111111";

// Records exactly how it was called, matching the pattern already used by
// tests/my-analyses.ts's / tests/save-analysis.ts's makeClient —
// deliberately has no method beyond delete/eq/select, so a stray call this
// mock doesn't implement (e.g. .eq("user_id", ...)) would throw and fail
// the test loudly instead of silently passing.
function makeClient(
  data: unknown[] | null,
  error: { code?: string } | null = null
) {
  const calls: {
    fromTable?: string;
    eqColumn?: string;
    eqValue?: string;
    selectColumns?: string;
  } = {};

  const client: AnalysesDeleteClient = {
    from(table) {
      calls.fromTable = table;

      return {
        delete() {
          return {
            eq(column, value) {
              calls.eqColumn = column;
              calls.eqValue = value;

              return {
                select(columns) {
                  calls.selectColumns = columns;
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

// --- Core delete behavior -----------------------------------------------

async function checkSuccessfulDelete(): Promise<void> {
  const { client, calls } = makeClient([{ id: SAMPLE_ID }]);
  const result = await deleteAnalysis(client, SAMPLE_ID);

  check(
    "deleting exactly one owned row is treated as success",
    result.ok === true
  );
  check(`queries the "analyses" table`, calls.fromTable === "analyses");
  check(
    "the delete filters by the requested analysis id",
    calls.eqColumn === "id" && calls.eqValue === SAMPLE_ID
  );
  check(
    "the delete requests the deleted row back (so zero-rows is observable), selecting nothing beyond id",
    calls.selectColumns === "id"
  );
}

async function checkZeroRowsIsNotSuccess(): Promise<void> {
  const { client } = makeClient([]);
  const result = await deleteAnalysis(client, SAMPLE_ID);

  check(
    "zero rows affected is never reported as success",
    result.ok === false && result.reason === "not-found"
  );
}

async function checkDatabaseError(): Promise<void> {
  const { client } = makeClient(null, { code: "57014" });
  const result = await deleteAnalysis(client, SAMPLE_ID);

  check(
    "a real database error is surfaced as a database failure, distinct from not-found",
    result.ok === false && result.reason === "database"
  );
}

async function checkUnexpectedClientError(): Promise<void> {
  const client: AnalysesDeleteClient = {
    from() {
      throw new Error("network failure");
    },
  };

  const result = await deleteAnalysis(client, SAMPLE_ID);

  check(
    "an unexpected client-level error is caught and surfaced as a database failure, not a crash",
    result.ok === false && result.reason === "database"
  );
}

// --- Id validation --------------------------------------------------------

async function checkMalformedIdRejected(): Promise<void> {
  const client: AnalysesDeleteClient = {
    from() {
      throw new Error("must never be called for a malformed id");
    },
  };

  const badResult = await deleteAnalysis(client, "not-a-uuid");
  check(
    "a malformed id never reaches the database — rejected up front",
    badResult.ok === false && badResult.reason === "not-found"
  );

  const traversalResult = await deleteAnalysis(client, "../../etc/passwd");
  check(
    "a path-traversal-shaped value is rejected the same way, without a query",
    traversalResult.ok === false && traversalResult.reason === "not-found"
  );
}

async function checkMissingIdRejected(): Promise<void> {
  const client: AnalysesDeleteClient = {
    from() {
      throw new Error("must never be called for a missing id");
    },
  };

  const result = await deleteAnalysis(client, "");
  check(
    "an empty/missing id never reaches the database — rejected up front",
    result.ok === false && result.reason === "not-found"
  );
}

// --- Missing vs. unauthorized indistinguishability ------------------------

async function checkMissingAndUnauthorizedIdentical(): Promise<void> {
  // RLS's analyses_delete_own policy makes "no row with this id" and "a row
  // exists but belongs to someone else" indistinguishable at the query
  // level — both simply delete zero rows, no error. This asserts the exact
  // same result shape for both underlying causes, so the caller can never
  // tell them apart either.
  const missing = makeClient([]);
  const missingResult = await deleteAnalysis(missing.client, SAMPLE_ID);

  const unauthorized = makeClient([]);
  const unauthorizedResult = await deleteAnalysis(
    unauthorized.client,
    SAMPLE_ID
  );

  check(
    "a nonexistent id and someone else's id produce the identical result shape",
    JSON.stringify(missingResult) === JSON.stringify(unauthorizedResult) &&
      missingResult.ok === false &&
      missingResult.reason === "not-found"
  );
}

// --- Security/data source-shape checks -------------------------------------

function checkDeleteModuleSourceShape(): void {
  const source = readFileSync("app/my-analyses/delete-analysis.ts", "utf8");

  check(
    "the delete module never filters or supplies a user_id in the actual query (RLS is the only ownership boundary) — user_id may still appear in prose comments documenting that RLS boundary",
    !/\.eq\(\s*"user_id"/.test(source) && !/user_id\s*:/.test(source)
  );

  check(
    "the delete module never uses the service-role client or references its secret key",
    !source.includes('from "../../lib/supabase"') &&
      !source.includes("SUPABASE_SECRET_KEY")
  );

  check(
    "the delete module never calls OpenAI, inserts, or performs an unrelated update",
    !source.toLowerCase().includes("openai") &&
      !source.includes(".insert(") &&
      !source.includes(".update(")
  );
}

function checkNoMigrationChanges(): void {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(migrationsDir);

  check(
    "no new migration file was added for this feature",
    files.length === 1 &&
      files[0] === "20260717120000_create_analyses_table.sql"
  );

  const sql = readFileSync(
    path.join(migrationsDir, "20260717120000_create_analyses_table.sql"),
    "utf8"
  );

  check(
    "the existing analyses_delete_own RLS policy is unchanged and already sufficient — no migration was needed for this feature",
    /create policy analyses_delete_own\s+on public\.analyses\s+for delete\s+to authenticated\s+using \(auth\.uid\(\) = user_id\);/i.test(
      sql
    )
  );
}

// --- UI/dialog source-shape checks -----------------------------------------
//
// No React/DOM test harness exists in this repo's test suite (see
// tests/my-analyses.ts's own rationale) — interaction/dialog behavior that
// can't be exercised as a pure function is verified against the component's
// source shape instead.

function checkButtonSourceShape(): void {
  const source = readFileSync(
    "app/my-analyses/delete-analysis-button.tsx",
    "utf8"
  );

  check(
    "the component is a Client Component",
    source.startsWith('"use client";')
  );

  check(
    "deletion uses the RLS-bound browser client, never the service-role client",
    source.includes(
      'import { supabaseBrowser } from "../../lib/supabase/browser";'
    ) &&
      !source.includes('from "../../lib/supabase"') &&
      !source.includes("SUPABASE_SECRET_KEY")
  );

  check(
    "never calls OpenAI, never inserts, never performs an unrelated update",
    !source.toLowerCase().includes("openai") &&
      !source.includes(".insert(") &&
      !source.includes(".update(")
  );

  check(
    "never uses window.confirm, and imports nothing beyond React/Next/local modules (no new UI framework)",
    !source.includes("window.confirm") &&
      !source.includes("confirm(") &&
      Array.from(source.matchAll(/^import .* from "([^"]+)";$/gm)).every(
        ([, specifier]) =>
          specifier.startsWith(".") ||
          specifier === "react" ||
          specifier === "react-dom" ||
          specifier === "next/navigation"
      )
  );

  check(
    "the confirmation dialog uses an accessible role, aria-modal, and a labelled heading/description",
    source.includes('role="alertdialog"') &&
      source.includes('aria-modal="true"') &&
      source.includes("aria-labelledby={headingId}") &&
      source.includes("aria-describedby={descriptionId}")
  );

  check(
    "the dialog safely includes the analysis title when available, with a fallback when it's blank",
    source.includes(
      "deleteMessages.dialogDescriptionWithTitle(trimmedTitle)"
    ) && source.includes("deleteMessages.dialogDescription")
  );

  check(
    "Cancel never triggers a delete request",
    (() => {
      const cancelButtonStart = source.indexOf("ref={cancelButtonRef}");
      const cancelButtonEnd =
        cancelButtonStart >= 0
          ? source.indexOf("</button>", cancelButtonStart)
          : -1;
      const cancelButtonJsx =
        cancelButtonStart >= 0 && cancelButtonEnd > cancelButtonStart
          ? source.slice(cancelButtonStart, cancelButtonEnd)
          : "";

      return (
        cancelButtonJsx.includes("onClick={closeDialog}") &&
        !cancelButtonJsx.includes("deleteAnalysis")
      );
    })()
  );

  check(
    "Escape is handled and guarded against closing while a deletion is in flight",
    (() => {
      const idx = source.indexOf('if (event.key === "Escape") {');
      if (idx < 0) return false;
      const snippet = source.slice(idx, idx + 400);
      return snippet.includes("if (isDeletingRef.current) return;");
    })()
  );

  check(
    "backdrop click closes the dialog only through closeDialog's own not-while-deleting guard",
    /onClick=\{\(event\) => \{\s*if \(event\.target === event\.currentTarget\) \{\s*closeDialog\(\);/.test(
      source
    ) && source.includes("if (isDeletingRef.current) return;\n    setIsOpen(false);")
  );

  check(
    "double submission is prevented via a guard checked at the top of the confirm handler",
    /async function handleConfirm\(\) \{\s*if \(isDeletingRef\.current\) return;/.test(
      source
    )
  );

  check(
    "both Cancel and Confirm are disabled while a deletion is pending",
    (source.match(/disabled=\{isDeleting\}/g) ?? []).length === 2
  );

  check(
    "a visible 'Deleting...' pending label replaces the confirm label while pending",
    source.includes(
      "{isDeleting ? deleteMessages.deleting : deleteMessages.confirm}"
    )
  );

  check(
    "initial focus prefers Cancel, never the destructive Confirm action",
    source.includes("cancelButtonRef.current?.focus();")
  );

  check(
    "focus returns to whatever triggered the dialog once it closes",
    source.includes("previouslyFocusedElementRef.current?.focus();")
  );

  check(
    "a failed delete keeps the dialog open (no close in the failure branch) and shows only the generic localized message, never a raw Supabase error/reason",
    (() => {
      const idx = source.indexOf("if (!result.ok) {");
      const closeIdx = idx >= 0 ? source.indexOf("\n    }\n", idx) : -1;
      const branch =
        idx >= 0 && closeIdx > idx ? source.slice(idx, closeIdx) : "";

      return (
        branch.includes("setErrorMessage(deleteMessages.errorDescription);") &&
        !branch.includes("setIsOpen(false)") &&
        !branch.includes("result.reason") &&
        !branch.toLowerCase().includes("error.message")
      );
    })()
  );

  check(
    "a successful delete closes the dialog and revalidates via router.refresh() — never a full page reload",
    source.includes(
      "setIsOpen(false);\n    setIsDeleting(false);\n    router.refresh();"
    ) &&
      !source.includes("window.location.reload") &&
      !source.includes("location.href")
  );
}

function checkPageWiringSourceShape(): void {
  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");

  check(
    "DeleteAnalysisButton is imported and rendered exactly twice — once for the desktop table row, once for the mobile card",
    pageSource.includes(
      'import { DeleteAnalysisButton } from "./delete-analysis-button";'
    ) &&
      (pageSource.match(/<DeleteAnalysisButton\s+id=\{item\.id\}/g) ?? [])
        .length === 2
  );

  check(
    "Open remains present alongside Delete as a sibling, never nested inside it",
    (() => {
      const occurrences = pageSource.split("<OpenAnalysisButton");

      return (
        occurrences.length - 1 === 2 &&
        occurrences.slice(1).every((chunk) => {
          const closeIndex = chunk.indexOf("/>");
          const snippet = chunk.slice(0, closeIndex);
          return !snippet.includes("<DeleteAnalysisButton");
        })
      );
    })()
  );
}

// --- Localization -----------------------------------------------------

function checkMessageCoverage(): void {
  check(
    "myAnalyses.delete.* keys are covered for every launched locale",
    LAUNCHED_LOCALES.every((locale) => {
      const del = getMessages(locale).myAnalyses.delete;

      return (
        del.triggerLabel.length > 0 &&
        del.dialogHeading.length > 0 &&
        del.dialogDescription.length > 0 &&
        del.permanentWarning.length > 0 &&
        del.cancel.length > 0 &&
        del.confirm.length > 0 &&
        del.deleting.length > 0 &&
        del.errorHeading.length > 0 &&
        del.errorDescription.length > 0 &&
        del.dialogDescriptionWithTitle("Sample").length > 0
      );
    })
  );

  check(
    "EN and RU delete strings are actually localized (not identical)",
    getMessages("en").myAnalyses.delete.dialogHeading !==
      getMessages("ru").myAnalyses.delete.dialogHeading &&
      getMessages("en").myAnalyses.delete.confirm !==
        getMessages("ru").myAnalyses.delete.confirm &&
      getMessages("en").myAnalyses.delete.dialogDescriptionWithTitle("X") !==
        getMessages("ru").myAnalyses.delete.dialogDescriptionWithTitle("X")
  );

  check(
    "the title-aware dialog message actually embeds the given title",
    getMessages("en")
      .myAnalyses.delete.dialogDescriptionWithTitle("My Very Specific Title")
      .includes("My Very Specific Title")
  );
}

async function main(): Promise<void> {
  await checkSuccessfulDelete();
  await checkZeroRowsIsNotSuccess();
  await checkDatabaseError();
  await checkUnexpectedClientError();
  await checkMalformedIdRejected();
  await checkMissingIdRejected();
  await checkMissingAndUnauthorizedIdentical();
  checkDeleteModuleSourceShape();
  checkNoMigrationChanges();
  checkButtonSourceShape();
  checkPageWiringSourceShape();
  checkMessageCoverage();

  if (failures > 0) {
    console.error(`\nDelete Saved Analysis tests: ${failures} failed`);
    process.exitCode = 1;
  } else {
    console.log("\nDelete Saved Analysis tests: all passed");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL — unexpected error: ${message}`);
  process.exitCode = 1;
});
