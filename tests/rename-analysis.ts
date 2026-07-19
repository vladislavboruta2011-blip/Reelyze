import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { LAUNCHED_LOCALES } from "../lib/i18n";
import { getMessages } from "../lib/messages";
import {
  MAX_TITLE_CHARACTERS,
  renameAnalysis,
  validateRenameTitle,
  type AnalysesRenameClient,
} from "../app/my-analyses/rename-analysis";

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
// tests/delete-analysis.ts's / tests/save-analysis.ts's makeClient —
// deliberately has no method beyond update/eq/select, so a stray call this
// mock doesn't implement (e.g. .eq("user_id", ...)) would throw and fail
// the test loudly instead of silently passing.
function makeClient(
  data: unknown[] | null,
  error: { code?: string } | null = null
) {
  const calls: {
    fromTable?: string;
    updateValues?: { title: string };
    eqColumn?: string;
    eqValue?: string;
    selectColumns?: string;
  } = {};

  const client: AnalysesRenameClient = {
    from(table) {
      calls.fromTable = table;

      return {
        update(values) {
          calls.updateValues = values;

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

// --- validateRenameTitle --------------------------------------------------

function checkValidateRenameTitle(): void {
  check(
    "a well-formed title is accepted",
    validateRenameTitle("My Renamed Analysis").ok === true
  );

  check(
    "an empty string is rejected",
    (() => {
      const result = validateRenameTitle("");
      return result.ok === false && result.reason === "empty";
    })()
  );

  check(
    "a whitespace-only string is rejected the same way as empty",
    (() => {
      const result = validateRenameTitle("   \n\t  ");
      return result.ok === false && result.reason === "empty";
    })()
  );

  check(
    "a title over the character limit is rejected, never silently truncated",
    (() => {
      const result = validateRenameTitle("A".repeat(MAX_TITLE_CHARACTERS + 1));
      return result.ok === false && result.reason === "too-long";
    })()
  );

  check(
    "a title exactly at the character limit is accepted",
    validateRenameTitle("B".repeat(MAX_TITLE_CHARACTERS)).ok === true
  );

  check(
    "surrounding whitespace is trimmed automatically",
    (() => {
      const result = validateRenameTitle("  Padded Title  ");
      return result.ok === true && result.ok && result.title === "Padded Title";
    })()
  );
}

// --- Core rename behavior --------------------------------------------------

async function checkSuccessfulRename(): Promise<void> {
  const { client, calls } = makeClient([{ id: SAMPLE_ID }]);
  const result = await renameAnalysis(client, SAMPLE_ID, "New Title");

  check(
    "renaming exactly one owned row is treated as success",
    result.ok === true
  );
  check(`queries the "analyses" table`, calls.fromTable === "analyses");
  check(
    "the update sends only the trimmed title — nothing else (never user_id)",
    JSON.stringify(calls.updateValues) === JSON.stringify({ title: "New Title" })
  );
  check(
    "the update filters by the requested analysis id",
    calls.eqColumn === "id" && calls.eqValue === SAMPLE_ID
  );
  check(
    "the update requests the updated row back (so zero-rows is observable), selecting nothing beyond id",
    calls.selectColumns === "id"
  );
}

async function checkTitleIsTrimmedBeforeSending(): Promise<void> {
  const { calls, client } = makeClient([{ id: SAMPLE_ID }]);
  await renameAnalysis(client, SAMPLE_ID, "   Padded   ");

  check(
    "the title is trimmed before being sent to the database",
    calls.updateValues?.title === "Padded"
  );
}

async function checkZeroRowsIsNotSuccess(): Promise<void> {
  const { client } = makeClient([]);
  const result = await renameAnalysis(client, SAMPLE_ID, "New Title");

  check(
    "zero rows affected is never reported as success",
    result.ok === false && result.reason === "not-found"
  );
}

async function checkDatabaseError(): Promise<void> {
  const { client } = makeClient(null, { code: "57014" });
  const result = await renameAnalysis(client, SAMPLE_ID, "New Title");

  check(
    "a real database error is surfaced as a database failure, distinct from not-found",
    result.ok === false && result.reason === "database"
  );
}

async function checkUnexpectedClientError(): Promise<void> {
  const client: AnalysesRenameClient = {
    from() {
      throw new Error("network failure");
    },
  };

  const result = await renameAnalysis(client, SAMPLE_ID, "New Title");

  check(
    "an unexpected client-level error is caught and surfaced as a database failure, not a crash",
    result.ok === false && result.reason === "database"
  );
}

async function checkInvalidTitleIsRejectedDefensively(): Promise<void> {
  const client: AnalysesRenameClient = {
    from() {
      throw new Error("must never be called for an invalid title");
    },
  };

  const emptyResult = await renameAnalysis(client, SAMPLE_ID, "   ");
  check(
    "an invalid (blank) title never reaches the database, even called directly",
    emptyResult.ok === false && emptyResult.reason === "invalid-title"
  );

  const tooLongResult = await renameAnalysis(
    client,
    SAMPLE_ID,
    "C".repeat(MAX_TITLE_CHARACTERS + 1)
  );
  check(
    "an invalid (too-long) title never reaches the database, even called directly",
    tooLongResult.ok === false && tooLongResult.reason === "invalid-title"
  );
}

// --- Id validation --------------------------------------------------------

async function checkMalformedIdRejected(): Promise<void> {
  const client: AnalysesRenameClient = {
    from() {
      throw new Error("must never be called for a malformed id");
    },
  };

  const badResult = await renameAnalysis(client, "not-a-uuid", "New Title");
  check(
    "a malformed id never reaches the database — rejected up front",
    badResult.ok === false && badResult.reason === "not-found"
  );

  const traversalResult = await renameAnalysis(
    client,
    "../../etc/passwd",
    "New Title"
  );
  check(
    "a path-traversal-shaped value is rejected the same way, without a query",
    traversalResult.ok === false && traversalResult.reason === "not-found"
  );
}

async function checkMissingIdRejected(): Promise<void> {
  const client: AnalysesRenameClient = {
    from() {
      throw new Error("must never be called for a missing id");
    },
  };

  const result = await renameAnalysis(client, "", "New Title");
  check(
    "an empty/missing id never reaches the database — rejected up front",
    result.ok === false && result.reason === "not-found"
  );
}

// --- Missing vs. unauthorized indistinguishability ------------------------

async function checkMissingAndUnauthorizedIdentical(): Promise<void> {
  // RLS's analyses_update_own policy makes "no row with this id" and "a row
  // exists but belongs to someone else" indistinguishable at the query
  // level — both simply update zero rows, no error. This asserts the exact
  // same result shape for both underlying causes, so the caller can never
  // tell them apart either.
  const missing = makeClient([]);
  const missingResult = await renameAnalysis(missing.client, SAMPLE_ID, "X");

  const unauthorized = makeClient([]);
  const unauthorizedResult = await renameAnalysis(
    unauthorized.client,
    SAMPLE_ID,
    "X"
  );

  check(
    "a nonexistent id and someone else's id produce the identical result shape",
    JSON.stringify(missingResult) === JSON.stringify(unauthorizedResult) &&
      missingResult.ok === false &&
      missingResult.reason === "not-found"
  );
}

// --- Security/data source-shape checks -------------------------------------

function checkRenameModuleSourceShape(): void {
  const source = readFileSync("app/my-analyses/rename-analysis.ts", "utf8");

  check(
    "the rename module never filters or supplies a user_id in the actual query (RLS is the only ownership boundary) — user_id may still appear in prose comments documenting that RLS boundary",
    !/\.eq\(\s*"user_id"/.test(source) && !/user_id\s*:/.test(source)
  );

  check(
    "the update payload type allows only title, never user_id/script/result_json/model_used",
    /update\(values: \{ title: string \}\)/.test(source)
  );

  check(
    "the rename module never uses the service-role client or references its secret key",
    !source.includes('from "../../lib/supabase"') &&
      !source.includes("SUPABASE_SECRET_KEY")
  );

  check(
    "the rename module never calls OpenAI, inserts, or deletes",
    !source.toLowerCase().includes("openai") &&
      !source.includes(".insert(") &&
      !source.includes(".delete(")
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
    "the existing analyses_update_own RLS policy is unchanged and already sufficient — no migration was needed for this feature",
    /create policy analyses_update_own\s+on public\.analyses\s+for update\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)\s+with check \(auth\.uid\(\) = user_id\);/i.test(
      sql
    )
  );

  check(
    "the title-length CHECK constraint this feature relies on is unchanged",
    /analyses_title_length check \(char_length\(title\) <= 200\)/i.test(sql)
  );
}

// --- UI/dialog source-shape checks -----------------------------------------
//
// No React/DOM test harness exists in this repo's test suite (see
// tests/my-analyses.ts's own rationale) — interaction/dialog behavior that
// can't be exercised as a pure function is verified against the component's
// source shape instead.

function checkDialogSourceShape(): void {
  const source = readFileSync(
    "app/my-analyses/rename-analysis-dialog.tsx",
    "utf8"
  );

  check(
    "the component is a Client Component",
    source.startsWith('"use client";')
  );

  check(
    "the dialog is controlled by mount/unmount (id/title/onClose props only, no isOpen prop), with no trigger of its own",
    /\{\s*id,\s*title,\s*onClose,\s*\}: \{\s*id: string;\s*title: string;\s*onClose: \(\) => void;\s*\}/.test(
      source
    ) && !source.includes("setIsOpen(true)")
  );

  check(
    "renaming uses the RLS-bound browser client, never the service-role client",
    source.includes(
      'import { supabaseBrowser } from "../../lib/supabase/browser";'
    ) &&
      !source.includes('from "../../lib/supabase"') &&
      !source.includes("SUPABASE_SECRET_KEY")
  );

  check(
    "never calls OpenAI, never inserts, never deletes",
    !source.toLowerCase().includes("openai") &&
      !source.includes(".insert(") &&
      !source.includes(".delete(")
  );

  check(
    "uses a plain (non-alert) accessible dialog role, aria-modal, and a labelled heading",
    source.includes('role="dialog"') &&
      source.includes('aria-modal="true"') &&
      source.includes("aria-labelledby={headingId}")
  );

  check(
    "the input is initialized from the current title (fresh on every mount) and receives initial focus with its text selected",
    source.includes("useState(title);") &&
      source.includes("inputRef.current?.focus();") &&
      source.includes("inputRef.current?.select();")
  );

  check(
    "the title is validated with validateRenameTitle before ever calling renameAnalysis",
    /const validation = validateRenameTitle\(inputValue\);[\s\S]{0,200}if \(!validation\.ok\)/.test(
      source
    )
  );

  check(
    "Cancel never triggers a rename request",
    (() => {
      const cancelStart = source.indexOf('onClick={closeDialog}');
      const cancelEnd =
        cancelStart >= 0 ? source.indexOf("</button>", cancelStart) : -1;
      const cancelJsx =
        cancelStart >= 0 && cancelEnd > cancelStart
          ? source.slice(cancelStart, cancelEnd)
          : "";

      return cancelStart >= 0 && !cancelJsx.includes("renameAnalysis");
    })()
  );

  check(
    "Escape is handled and guarded against closing while a save is in flight",
    (() => {
      const idx = source.indexOf('if (event.key === "Escape") {');
      if (idx < 0) return false;
      const snippet = source.slice(idx, idx + 200);
      return snippet.includes("if (isSavingRef.current) return;");
    })()
  );

  check(
    "backdrop click closes the dialog only through closeDialog's own not-while-saving guard",
    /onClick=\{\(event\) => \{\s*if \(event\.target === event\.currentTarget\) \{\s*closeDialog\(\);/.test(
      source
    ) && source.includes("if (isSavingRef.current) return;\n    onCloseRef.current();")
  );

  check(
    "double submission is prevented via a guard checked at the top of the submit handler",
    /async function handleSubmit\([\s\S]{0,80}\) \{\s*event\.preventDefault\(\);\s*\s*if \(isSavingRef\.current\) return;/.test(
      source
    )
  );

  check(
    "the input, Cancel, and Save are all disabled while a save is pending",
    (source.match(/disabled=\{isSaving\}/g) ?? []).length === 3
  );

  check(
    "a visible 'Saving...' pending label replaces the confirm label while pending",
    source.includes(
      "{isSaving ? renameMessages.saving : renameMessages.confirm}"
    )
  );

  check(
    "focus returns to whatever triggered the dialog once it closes",
    source.includes("previouslyFocusedElementRef.current?.focus();")
  );

  check(
    "a failed rename keeps the dialog open (no close in the failure branch) and shows only the generic localized message, never a raw Supabase error/reason",
    (() => {
      const idx = source.indexOf("if (!result.ok) {");
      const closeIdx = idx >= 0 ? source.indexOf("\n    }\n", idx) : -1;
      const branch =
        idx >= 0 && closeIdx > idx ? source.slice(idx, closeIdx) : "";

      return (
        branch.includes("setErrorMessage(renameMessages.errorDescription);") &&
        !branch.includes("onCloseRef.current()") &&
        !branch.includes("result.reason") &&
        !branch.toLowerCase().includes("error.message")
      );
    })()
  );

  check(
    "a successful rename closes the dialog and revalidates via router.refresh() — never a full page reload",
    source.includes(
      "setIsSaving(false);\n    router.refresh();\n    onCloseRef.current();"
    ) &&
      !source.includes("window.location.reload") &&
      !source.includes("location.href")
  );

  check(
    "empty and too-long titles show distinct, localized inline messages, never a generic fallback for a client-side validation failure",
    source.includes(
      'validation.reason === "empty"\n          ? renameMessages.errorEmpty\n          : renameMessages.errorTooLong'
    )
  );
}

function checkOverflowMenuSourceShape(): void {
  const source = readFileSync("app/my-analyses/overflow-menu.tsx", "utf8");

  check(
    "the overflow menu is a Client Component",
    source.startsWith('"use client";')
  );

  check(
    "the overflow menu is generic — it never imports or references Rename/Delete-specific logic (doc comments may still mention them for context)",
    !source.includes("renameAnalysis") &&
      !source.includes("deleteAnalysis") &&
      !source.includes("RenameAnalysisDialog") &&
      !source.includes("DeleteAnalysisButton") &&
      !/^import .*(rename|delete)/im.test(source)
  );

  check(
    "uses the accessible ARIA menu-button pattern: aria-haspopup, aria-expanded, role=menu, role=menuitem",
    source.includes('aria-haspopup="menu"') &&
      source.includes("aria-expanded={isOpen}") &&
      source.includes('role="menu"') &&
      source.includes('role="menuitem"')
  );

  check(
    "Escape closes the menu and returns focus to the trigger",
    source.includes('if (event.key === "Escape") {') &&
      source.includes("closeMenu();") &&
      source.includes("triggerRef.current?.focus();")
  );

  check(
    "arrow keys move roving focus between enabled menu items only",
    source.includes('event.key === "ArrowDown"') &&
      source.includes("item.disabled") &&
      source.includes("enabledIndices")
  );

  check(
    "clicking outside the menu (and outside the trigger) closes it",
    source.includes("handlePointerDown") &&
      source.includes("menuRef.current?.contains(target)") &&
      source.includes("triggerRef.current?.contains(target)")
  );

  check(
    "the dropdown is rendered via a portal to document.body, not plain CSS-relative positioning (avoids the desktop table's overflow-hidden clipping it)",
    source.includes("createPortal(") && source.includes("document.body")
  );

  check(
    "never uses window.confirm, and imports nothing beyond React/Next/lucide/local modules (no new UI framework)",
    !source.includes("window.confirm") &&
      Array.from(source.matchAll(/^import .* from "([^"]+)";$/gm)).every(
        ([, specifier]) =>
          specifier.startsWith(".") ||
          specifier === "react" ||
          specifier === "react-dom" ||
          specifier === "lucide-react"
      )
  );
}

function checkActionsMenuSourceShape(): void {
  const source = readFileSync(
    "app/my-analyses/analysis-actions-menu.tsx",
    "utf8"
  );

  check(
    "the actions menu is a Client Component",
    source.startsWith('"use client";')
  );

  check(
    "the menu contains exactly two items, in order: Rename then Delete",
    (() => {
      const keys = Array.from(source.matchAll(/key: "([a-z]+)"/g)).map(
        ([, key]) => key
      );
      return (
        keys.length === 2 && keys[0] === "rename" && keys[1] === "delete"
      );
    })()
  );

  check(
    "Rename is wired through the reusable OverflowMenu primitive and the controlled RenameAnalysisDialog",
    /import \{ OverflowMenu(, type OverflowMenuItem)? \} from "\.\/overflow-menu";/.test(
      source
    ) &&
      source.includes(
        'import { RenameAnalysisDialog } from "./rename-analysis-dialog";'
      )
  );

  check(
    "Delete is wired through the same reusable OverflowMenu primitive and the controlled DeleteAnalysisDialog",
    source.includes(
      'import { DeleteAnalysisDialog } from "./delete-analysis-dialog";'
    )
  );

  check(
    "Rename's dialog open state is owned here and controlled by conditionally mounting it, toggled from the menu item's onSelect",
    /const \[isRenameDialogOpen, setIsRenameDialogOpen\] = useState\(false\);/.test(
      source
    ) &&
      source.includes("onSelect: () => setIsRenameDialogOpen(true)") &&
      source.includes("{isRenameDialogOpen && (") &&
      source.includes("onClose={() => setIsRenameDialogOpen(false)}")
  );

  check(
    "Delete's dialog open state is owned here and controlled by conditionally mounting it, toggled from the menu item's onSelect",
    /const \[isDeleteDialogOpen, setIsDeleteDialogOpen\] = useState\(false\);/.test(
      source
    ) &&
      source.includes("onSelect: () => setIsDeleteDialogOpen(true)") &&
      source.includes("{isDeleteDialogOpen && (") &&
      source.includes("onClose={() => setIsDeleteDialogOpen(false)}")
  );

  check(
    "Delete's menu entry uses the destructive variant; Rename's does not",
    (() => {
      const deleteIdx = source.indexOf('key: "delete"');
      const renameIdx = source.indexOf('key: "rename"');
      if (deleteIdx < 0 || renameIdx < 0) return false;

      const deleteEntry = source.slice(deleteIdx, source.indexOf("},", deleteIdx));
      const renameEntry = source.slice(renameIdx, source.indexOf("},", renameIdx));

      return (
        deleteEntry.includes('variant: "destructive"') &&
        !renameEntry.includes("variant:")
      );
    })()
  );

  check(
    "items is a plain array assembled once, the stable extension point for future actions",
    /const items: OverflowMenuItem\[\] = \[/.test(source)
  );
}

function checkPageWiringSourceShape(): void {
  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");

  check(
    "AnalysisActionsMenu is imported and rendered exactly twice — once for the desktop table row, once for the mobile card",
    pageSource.includes(
      'import { AnalysisActionsMenu } from "./analysis-actions-menu";'
    ) &&
      (pageSource.match(/<AnalysisActionsMenu\s+id=\{item\.id\}/g) ?? [])
        .length === 2
  );

  check(
    "Open and the actions menu are two independent siblings — neither nested inside the other",
    (() => {
      const openOccurrences = pageSource.split("<OpenAnalysisButton");

      return (
        openOccurrences.length - 1 === 2 &&
        openOccurrences.slice(1).every((chunk) => {
          const snippet = chunk.slice(0, chunk.indexOf("/>"));
          return !snippet.includes("<AnalysisActionsMenu");
        })
      );
    })()
  );

  check(
    "Delete has been moved into the overflow menu — no standalone DeleteAnalysisButton remains on the page",
    !pageSource.includes("DeleteAnalysisButton")
  );
}

// --- Localization -----------------------------------------------------

function checkMessageCoverage(): void {
  check(
    "myAnalyses.rename.* keys are covered for every launched locale",
    LAUNCHED_LOCALES.every((locale) => {
      const rename = getMessages(locale).myAnalyses.rename;

      return (
        rename.triggerLabel.length > 0 &&
        rename.dialogHeading.length > 0 &&
        rename.inputLabel.length > 0 &&
        rename.cancel.length > 0 &&
        rename.confirm.length > 0 &&
        rename.saving.length > 0 &&
        rename.errorEmpty.length > 0 &&
        rename.errorTooLong.length > 0 &&
        rename.errorHeading.length > 0 &&
        rename.errorDescription.length > 0
      );
    })
  );

  check(
    "myAnalyses.actionsMenu.* keys are covered for every launched locale",
    LAUNCHED_LOCALES.every(
      (locale) => getMessages(locale).myAnalyses.actionsMenu.triggerLabel.length > 0
    )
  );

  check(
    "EN and RU rename strings are actually localized (not identical)",
    getMessages("en").myAnalyses.rename.dialogHeading !==
      getMessages("ru").myAnalyses.rename.dialogHeading &&
      getMessages("en").myAnalyses.rename.confirm !==
        getMessages("ru").myAnalyses.rename.confirm &&
      getMessages("en").myAnalyses.actionsMenu.triggerLabel !==
        getMessages("ru").myAnalyses.actionsMenu.triggerLabel
  );
}

async function main(): Promise<void> {
  checkValidateRenameTitle();
  await checkSuccessfulRename();
  await checkTitleIsTrimmedBeforeSending();
  await checkZeroRowsIsNotSuccess();
  await checkDatabaseError();
  await checkUnexpectedClientError();
  await checkInvalidTitleIsRejectedDefensively();
  await checkMalformedIdRejected();
  await checkMissingIdRejected();
  await checkMissingAndUnauthorizedIdentical();
  checkRenameModuleSourceShape();
  checkNoMigrationChanges();
  checkDialogSourceShape();
  checkOverflowMenuSourceShape();
  checkActionsMenuSourceShape();
  checkPageWiringSourceShape();
  checkMessageCoverage();

  if (failures > 0) {
    console.error(`\nRename Analysis tests: ${failures} failed`);
    process.exitCode = 1;
  } else {
    console.log("\nRename Analysis tests: all passed");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL — unexpected error: ${message}`);
  process.exitCode = 1;
});
