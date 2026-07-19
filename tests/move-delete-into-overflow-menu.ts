import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

let failures = 0;

function check(label: string, pass: boolean, detail?: string): void {
  if (pass) {
    console.log(`PASS — ${label}`);
    return;
  }

  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ""}`);
}

// No React/DOM test harness exists in this repo's test suite (see
// tests/my-analyses.ts's own rationale) — interaction/dialog behavior that
// can't be exercised as a pure function is verified against the component's
// source shape instead, matching tests/delete-analysis.ts's and
// tests/rename-analysis.ts's own established pattern.

// --- Overflow menu -----------------------------------------------------

function checkOverflowMenuIsGeneric(): void {
  const source = readFileSync("app/my-analyses/overflow-menu.tsx", "utf8");

  check(
    "OverflowMenu never imports or references Rename/Delete-specific logic (doc comments may still mention them for context)",
    !source.includes("renameAnalysis") &&
      !source.includes("deleteAnalysis") &&
      !source.includes("RenameAnalysisDialog") &&
      !source.includes("DeleteAnalysisDialog") &&
      !source.includes("DeleteAnalysisButton") &&
      !/^import .*(rename|delete)/im.test(source)
  );

  check(
    "the only extension OverflowMenuItem gained is the generic variant field — no analysis-specific prop names",
    /variant\?: "default" \| "destructive";/.test(source) &&
      !source.includes("isDestructiveDelete") &&
      !source.includes("analysisId")
  );

  check(
    "the destructive branch only changes styling — it still calls the same onSelect/setIsOpen(false) flow as the default branch",
    (() => {
      const idx = source.indexOf("onClick={() => {");
      const snippet = idx >= 0 ? source.slice(idx, idx + 200) : "";
      return (
        snippet.includes("setIsOpen(false);") &&
        snippet.includes("item.onSelect();") &&
        source.includes('item.variant === "destructive"')
      );
    })()
  );

  check(
    "imports nothing beyond React/react-dom/lucide-react/local modules (no new UI framework)",
    Array.from(source.matchAll(/^import .* from "([^"]+)";$/gm)).every(
      ([, specifier]) =>
        specifier.startsWith(".") ||
        specifier === "react" ||
        specifier === "react-dom" ||
        specifier === "lucide-react"
    )
  );
}

function checkOverflowMenuKeyboardBehaviorIntact(): void {
  const source = readFileSync("app/my-analyses/overflow-menu.tsx", "utf8");

  check(
    "Escape closes the menu and returns focus to the trigger",
    source.includes('if (event.key === "Escape") {') &&
      source.includes("closeMenu();") &&
      source.includes("triggerRef.current?.focus();")
  );

  check(
    "ArrowDown/ArrowUp move roving focus with wraparound among enabled items only",
    source.includes('event.key === "ArrowDown" || event.key === "ArrowUp"') &&
      /%\s*enabledIndices\.length/.test(source)
  );

  check(
    "Home moves focus to the first enabled item",
    /if \(event\.key === "Home"\) \{[\s\S]{0,120}itemRefs\.current\[enabledIndices\[0\]\]\?\.focus\(\);/.test(
      source
    )
  );

  check(
    "End moves focus to the last enabled item",
    /if \(event\.key === "End"\) \{[\s\S]{0,150}itemRefs\.current\[enabledIndices\[enabledIndices\.length - 1\]\]\?\.focus\(\);/.test(
      source
    )
  );

  check(
    "Tab closes the menu instead of trapping focus, matching the ARIA APG menu-button pattern",
    /if \(event\.key === "Tab"\) \{[\s\S]{0,400}setIsOpen\(false\);/.test(
      source
    )
  );

  check(
    "clicking outside the menu and outside the trigger closes it",
    source.includes("handlePointerDown") &&
      source.includes("menuRef.current?.contains(target)") &&
      source.includes("triggerRef.current?.contains(target)")
  );

  check(
    "disabled items are excluded from the roving-focus set and rendered with the disabled attribute",
    /\.map\(\(item, index\) => \(item\.disabled \? -1 : index\)\)/.test(
      source
    ) && source.includes("disabled={item.disabled}")
  );

  check(
    "uses the accessible ARIA menu-button pattern: aria-haspopup, aria-expanded, role=menu, role=menuitem",
    source.includes('aria-haspopup="menu"') &&
      source.includes("aria-expanded={isOpen}") &&
      source.includes('role="menu"') &&
      source.includes('role="menuitem"')
  );
}

// --- Page wiring ---------------------------------------------------------

function checkPageWiring(): void {
  const pageSource = readFileSync("app/my-analyses/page.tsx", "utf8");

  check(
    "DeleteAnalysisButton import is absent from the page",
    !pageSource.includes(
      'import { DeleteAnalysisButton } from "./delete-analysis-button";'
    ) && !pageSource.includes("DeleteAnalysisButton")
  );

  check(
    "no standalone Delete trigger remains in the desktop table row",
    (() => {
      const tableStart = pageSource.indexOf("function AnalysesTable(");
      const tableEnd = pageSource.indexOf("function AnalysisMobileCard(");
      const tableSource = pageSource.slice(tableStart, tableEnd);
      return (
        tableStart >= 0 &&
        tableEnd > tableStart &&
        !tableSource.includes("<DeleteAnalysisButton")
      );
    })()
  );

  check(
    "no standalone Delete trigger remains in the mobile card",
    (() => {
      const cardStart = pageSource.indexOf("function AnalysisMobileCard(");
      const cardEnd = pageSource.indexOf("function EmptyState(");
      const cardSource = pageSource.slice(cardStart, cardEnd);
      return (
        cardStart >= 0 &&
        cardEnd > cardStart &&
        !cardSource.includes("<DeleteAnalysisButton")
      );
    })()
  );

  check(
    "AnalysisActionsMenu remains rendered exactly twice — desktop table row and mobile card",
    pageSource.includes(
      'import { AnalysisActionsMenu } from "./analysis-actions-menu";'
    ) &&
      (pageSource.match(/<AnalysisActionsMenu\s+id=\{item\.id\}/g) ?? [])
        .length === 2
  );

  check(
    "Open remains visible and rendered exactly twice — desktop table row and mobile card",
    (pageSource.match(/<OpenAnalysisButton\s/g) ?? []).length === 2
  );

  check(
    "the obsolete delete-analysis-button.tsx file has been removed",
    !existsSync("app/my-analyses/delete-analysis-button.tsx")
  );
}

// --- Delete dialog ---------------------------------------------------------

function checkDeleteDialog(): void {
  const source = readFileSync(
    "app/my-analyses/delete-analysis-dialog.tsx",
    "utf8"
  );

  check(
    "the dialog uses role=alertdialog with correct accessible attributes (aria-modal, aria-labelledby, aria-describedby)",
    source.includes('role="alertdialog"') &&
      source.includes('aria-modal="true"') &&
      source.includes("aria-labelledby={headingId}") &&
      source.includes("aria-describedby={descriptionId}")
  );

  check(
    "Cancel receives initial focus",
    source.includes("cancelButtonRef.current?.focus();")
  );

  check(
    "Cancel never deletes",
    (() => {
      const cancelStart = source.indexOf("ref={cancelButtonRef}");
      const cancelEnd =
        cancelStart >= 0 ? source.indexOf("</button>", cancelStart) : -1;
      const cancelJsx =
        cancelStart >= 0 && cancelEnd > cancelStart
          ? source.slice(cancelStart, cancelEnd)
          : "";
      return (
        cancelJsx.includes("onClick={closeDialog}") &&
        !cancelJsx.includes("handleConfirm") &&
        !cancelJsx.includes("deleteAnalysis")
      );
    })()
  );

  check(
    "deleteAnalysis is called exactly once, from handleConfirm only",
    (source.match(/deleteAnalysis\(/g) ?? []).length === 1 &&
      /async function handleConfirm\(\) \{[\s\S]*?deleteAnalysis\(/.test(
        source
      )
  );

  check(
    "double-submit is blocked via a guard checked at the top of the confirm handler",
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
    "Escape cannot close the dialog while deleting is in flight",
    (() => {
      const idx = source.indexOf('if (event.key === "Escape") {');
      const snippet = idx >= 0 ? source.slice(idx, idx + 500) : "";
      return snippet.includes("if (isDeletingRef.current) return;");
    })()
  );

  check(
    "backdrop click cannot close the dialog while deleting is in flight",
    /onClick=\{\(event\) => \{\s*if \(event\.target === event\.currentTarget\) \{\s*closeDialog\(\);/.test(
      source
    ) &&
      /function closeDialog\(\) \{\s*if \(isDeletingRef\.current\) return;/.test(
        source
      )
  );

  check(
    "a successful delete calls router.refresh() and then closes via onClose",
    source.includes(
      "setIsDeleting(false);\n    router.refresh();\n    onCloseRef.current();"
    )
  );

  check(
    "a failed delete keeps the dialog open (no onClose call in the failure branch) and shows only the generic localized message — never a raw Supabase error",
    (() => {
      const idx = source.indexOf("if (!result.ok) {");
      const closeIdx = idx >= 0 ? source.indexOf("\n    }\n", idx) : -1;
      const branch =
        idx >= 0 && closeIdx > idx ? source.slice(idx, closeIdx) : "";
      return (
        branch.includes("setErrorMessage(deleteMessages.errorDescription);") &&
        !branch.includes("onCloseRef.current()") &&
        !branch.includes("result.reason") &&
        !branch.toLowerCase().includes("error.message")
      );
    })()
  );

  check(
    "missing and unauthorized rows remain indistinguishable — the dialog only ever renders the single generic errorDescription string, never a reason-specific one",
    !/errorMessage\s*=\s*.*reason/.test(source) &&
      (source.match(/deleteMessages\.\w*[Ee]rror\w*/g) ?? []).every(
        (match) => match === "deleteMessages.errorDescription"
      )
  );

  check(
    "no service-role client is used — only the RLS-bound supabaseBrowser client",
    source.includes(
      'import { supabaseBrowser } from "../../lib/supabase/browser";'
    ) &&
      !source.includes('from "../../lib/supabase"') &&
      !source.includes("SUPABASE_SECRET_KEY")
  );

  check(
    "deleteAnalysis is reused, unchanged — imported from the existing module",
    source.includes('import { deleteAnalysis } from "./delete-analysis";')
  );

  check(
    "no new delete query is duplicated in the dialog — it never calls supabase's own .from/.delete directly",
    !/\.from\(\s*"analyses"\s*\)/.test(source) && !source.includes(".delete(")
  );

  check(
    "input is not applicable — the dialog renders no text input",
    !source.includes("<input")
  );

  check(
    "focus returns to whatever triggered the dialog once it closes",
    source.includes("previouslyFocusedElementRef.current?.focus();")
  );

  check(
    "controlled by mount/unmount (id/title/onClose props only, no isOpen prop), with no trigger of its own",
    /\{\s*id,\s*title,\s*onClose,\s*\}: \{\s*id: string;\s*title: string;\s*onClose: \(\) => void;\s*\}/.test(
      source
    ) && !source.includes("setIsOpen(true)")
  );
}

// --- Composition -----------------------------------------------------------

function checkComposition(): void {
  const source = readFileSync(
    "app/my-analyses/analysis-actions-menu.tsx",
    "utf8"
  );

  check(
    "AnalysisActionsMenu owns both Rename and Delete dialog open state",
    /const \[isRenameDialogOpen, setIsRenameDialogOpen\] = useState\(false\);/.test(
      source
    ) &&
      /const \[isDeleteDialogOpen, setIsDeleteDialogOpen\] = useState\(false\);/.test(
        source
      )
  );

  check(
    "selecting Delete opens DeleteAnalysisDialog",
    source.includes(
      'import { DeleteAnalysisDialog } from "./delete-analysis-dialog";'
    ) &&
      source.includes("onSelect: () => setIsDeleteDialogOpen(true)") &&
      source.includes("{isDeleteDialogOpen && (") &&
      source.includes("<DeleteAnalysisDialog")
  );

  check(
    "selecting Rename still opens RenameAnalysisDialog",
    source.includes(
      'import { RenameAnalysisDialog } from "./rename-analysis-dialog";'
    ) &&
      source.includes("onSelect: () => setIsRenameDialogOpen(true)") &&
      source.includes("{isRenameDialogOpen && (") &&
      source.includes("<RenameAnalysisDialog")
  );

  check(
    "both dialogs use conditional mount/unmount, not an isOpen prop passed through",
    source.includes("{isRenameDialogOpen && (") &&
      source.includes("{isDeleteDialogOpen && (") &&
      !source.includes("isOpen={")
  );

  check(
    "the menu closes before the selected dialog opens — OverflowMenu's own onClick always runs setIsOpen(false) before item.onSelect()",
    (() => {
      const menuSource = readFileSync(
        "app/my-analyses/overflow-menu.tsx",
        "utf8"
      );
      const idx = menuSource.indexOf("onClick={() => {");
      const snippet = idx >= 0 ? menuSource.slice(idx, idx + 200) : "";
      return (
        snippet.indexOf("setIsOpen(false);") <
          snippet.indexOf("item.onSelect();") &&
        snippet.indexOf("setIsOpen(false);") >= 0
      );
    })()
  );

  check(
    "item order is stable: Rename first, Delete second",
    (() => {
      const renameIdx = source.indexOf('key: "rename"');
      const deleteIdx = source.indexOf('key: "delete"');
      return renameIdx >= 0 && deleteIdx > renameIdx;
    })()
  );

  check(
    "future items can be added through the items array without restructuring the component — items is declared as a single typed array assembled once",
    /const items: OverflowMenuItem\[\] = \[\s*\{\s*key: "rename",[\s\S]*\{\s*key: "delete",[\s\S]*\];/.test(
      source
    )
  );

  check(
    "Delete's entry is marked destructive; Rename's is not",
    (() => {
      const deleteIdx = source.indexOf('key: "delete"');
      const deleteEntryEnd = source.indexOf("},", deleteIdx);
      const deleteEntry = source.slice(deleteIdx, deleteEntryEnd);
      const renameIdx = source.indexOf('key: "rename"');
      const renameEntryEnd = source.indexOf("},", renameIdx);
      const renameEntry = source.slice(renameIdx, renameEntryEnd);
      return (
        deleteEntry.includes('variant: "destructive"') &&
        !renameEntry.includes("variant:")
      );
    })()
  );
}

// --- Data/security -----------------------------------------------------

function checkDeleteModuleUnchanged(): void {
  const targetPath = "app/my-analyses/delete-analysis.ts";

  check(
    `${targetPath} has no diff against the branch's base commit (a38c8b5) — it was not modified for this migration`,
    (() => {
      try {
        const diff = execSync(`git diff a38c8b5 -- ${targetPath}`, {
          cwd: process.cwd(),
          encoding: "utf8",
        });
        return diff.trim().length === 0;
      } catch {
        // If git isn't available in this environment, fall back to a
        // content-based assertion instead of silently passing.
        const source = readFileSync(targetPath, "utf8");
        return (
          source.includes("export async function deleteAnalysis(") &&
          !/\.eq\(\s*"user_id"/.test(source)
        );
      }
    })()
  );
}

function checkNoMigrationOrRlsChanges(): void {
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
    "the analyses_delete_own RLS policy remains untouched and unchanged",
    /create policy analyses_delete_own\s+on public\.analyses\s+for delete\s+to authenticated\s+using \(auth\.uid\(\) = user_id\);/i.test(
      sql
    )
  );
}

async function main(): Promise<void> {
  checkOverflowMenuIsGeneric();
  checkOverflowMenuKeyboardBehaviorIntact();
  checkPageWiring();
  checkDeleteDialog();
  checkComposition();
  checkDeleteModuleUnchanged();
  checkNoMigrationOrRlsChanges();

  if (failures > 0) {
    console.error(`\nMove Delete Into Overflow Menu tests: ${failures} failed`);
    process.exitCode = 1;
  } else {
    console.log("\nMove Delete Into Overflow Menu tests: all passed");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL — unexpected error: ${message}`);
  process.exitCode = 1;
});
