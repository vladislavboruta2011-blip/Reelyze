import { readFileSync } from "node:fs";

import { LAUNCHED_LOCALES } from "../lib/i18n";
import { getMessages } from "../lib/messages";
import {
  MAX_TITLE_CHARACTERS,
  clearPendingSaveIntent,
  createSaveAnalysisFingerprint,
  generateDefaultAnalysisTitle,
  insertAnalysis,
  readPendingSaveIntent,
  validateAnalysisForSave,
  writePendingSaveIntent,
  type AnalysesInsertClient,
  type AnalysesInsertRow,
} from "../app/results/save-analysis";
import type { AnalysisV2Result } from "../engine/analysis-v2-schema";

let failures = 0;

function check(label: string, pass: boolean, detail?: string): void {
  if (pass) {
    console.log(`PASS — ${label}`);
    return;
  }

  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ""}`);
}

// A minimal in-memory sessionStorage — Node has no browser storage globals,
// and the pending-save-intent helpers deliberately read/write the real
// `sessionStorage` global (same mechanism as this page's other
// sessionStorage usage), so tests provide their own before exercising them.
class MemorySessionStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

(globalThis as unknown as { sessionStorage: Storage }).sessionStorage =
  new MemorySessionStorage() as unknown as Storage;

const sampleResult = {
  scriptType: "explanation",
  verdict: "strong",
  scores: { overall: 90, hook: 88, retentionRisk: 10 },
  hookDecision: "keep",
  hookAssessment: "Clear and specific.",
  riskyParts: [],
  suggestedFixes: [],
  scenes: [],
  mainTakeaway: "Strong script overall.",
} satisfies AnalysisV2Result;

function checkTitleGeneration(): void {
  check(
    "uses the user-provided title verbatim when present",
    generateDefaultAnalysisTitle(
      "My Custom Title",
      "Some script.",
      "Untitled analysis"
    ) === "My Custom Title"
  );

  check(
    "falls back to the script's first meaningful line when title is blank",
    generateDefaultAnalysisTitle(
      "",
      "\n\n  What if one small change could change everything?\nSecond line.",
      "Untitled analysis"
    ) === "What if one small change could change everything?"
  );

  check(
    "normalizes internal whitespace in the derived title",
    generateDefaultAnalysisTitle(
      "",
      "This   has\tirregular    whitespace.",
      "Untitled analysis"
    ) === "This has irregular whitespace."
  );

  check(
    "falls back to the localized 'Untitled analysis' when script has no content",
    generateDefaultAnalysisTitle("", "   \n  \n", "Untitled analysis") ===
      "Untitled analysis"
  );

  {
    const longLine = "A".repeat(250);
    const title = generateDefaultAnalysisTitle(
      "",
      longLine,
      "Untitled analysis",
      MAX_TITLE_CHARACTERS
    );

    check(
      "truncates a derived title to the migration's title-length constraint",
      title.length <= MAX_TITLE_CHARACTERS,
      `expected length <= ${MAX_TITLE_CHARACTERS}, got ${title.length}`
    );
  }

  {
    const longUserTitle = "B".repeat(250);
    const title = generateDefaultAnalysisTitle(
      longUserTitle,
      "irrelevant script",
      "Untitled analysis",
      MAX_TITLE_CHARACTERS
    );

    check(
      "truncates an over-long user-provided title as well",
      title.length <= MAX_TITLE_CHARACTERS
    );
  }
}

function checkValidation(): void {
  {
    const result = validateAnalysisForSave({
      hasSession: false,
      script: "A valid script.",
      title: "A title",
      locale: "en",
      result: sampleResult,
      modelUsed: "gpt-4.1-mini",
    });

    check(
      "validation fails with reason 'auth' when there is no session",
      result.ok === false && result.reason === "auth"
    );
  }

  check(
    "validation fails for an empty script",
    !validateAnalysisForSave({
      hasSession: true,
      script: "   ",
      title: "A title",
      locale: "en",
      result: sampleResult,
      modelUsed: "gpt-4.1-mini",
    }).ok
  );

  check(
    "validation fails for an unsupported locale",
    !validateAnalysisForSave({
      hasSession: true,
      script: "A valid script.",
      title: "A title",
      locale: "fr",
      result: sampleResult,
      modelUsed: "gpt-4.1-mini",
    }).ok
  );

  check(
    "validation fails for a blank model identifier",
    !validateAnalysisForSave({
      hasSession: true,
      script: "A valid script.",
      title: "A title",
      locale: "en",
      result: sampleResult,
      modelUsed: "   ",
    }).ok
  );

  check(
    "validation passes for a well-formed save payload",
    validateAnalysisForSave({
      hasSession: true,
      script: "A valid script.",
      title: "A title",
      locale: "en",
      result: sampleResult,
      modelUsed: "gpt-4.1-mini",
    }).ok === true
  );
}

const baseRow: AnalysesInsertRow = {
  user_id: "user-123",
  title: "A title",
  script: "A valid script.",
  locale: "en",
  result_json: sampleResult,
  model_used: "gpt-4.1-mini",
};

function makeClient(
  response: PromiseLike<{
    data: { id: string } | null;
    error: { code?: string } | null;
  }>
): AnalysesInsertClient {
  return {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => response,
        }),
      }),
    }),
  };
}

async function checkInsertAnalysis(): Promise<void> {
  {
    const result = await insertAnalysis(
      makeClient(Promise.resolve({ data: { id: "row-1" }, error: null })),
      baseRow
    );

    check(
      "successful authenticated insert returns the inserted row id",
      result.ok === true && result.ok && result.id === "row-1"
    );
  }

  {
    const result = await insertAnalysis(
      makeClient(
        Promise.resolve({
          data: null,
          error: { code: "42501" },
        })
      ),
      baseRow
    );

    check(
      "a database error is surfaced as a database failure, not a false success",
      result.ok === false && result.reason === "database"
    );
  }

  {
    const result = await insertAnalysis(
      makeClient(Promise.resolve({ data: null, error: null })),
      baseRow
    );

    check(
      "a missing inserted id is never treated as success",
      result.ok === false && result.reason === "database"
    );
  }

  {
    const result = await insertAnalysis(
      makeClient(
        Promise.resolve({
          data: { id: "" } as unknown as { id: string },
          error: null,
        })
      ),
      baseRow
    );

    check(
      "a malformed (empty-string) inserted id is never treated as success",
      result.ok === false && result.reason === "database"
    );
  }

  {
    const result = await insertAnalysis(
      makeClient(Promise.reject(new Error("network failure"))),
      baseRow
    );

    check(
      "an unexpected client error is caught and surfaced as a database failure",
      result.ok === false && result.reason === "database"
    );
  }
}

const SAMPLE_SCRIPT =
  "What if one small change could make viewers watch until the end? This is the exact script text that must never appear in the pending-save intent.";
const SAMPLE_TITLE = "My Very Specific Draft Title";
const SAMPLE_MODEL = "gpt-4.1-mini";
const SAMPLE_RESULT_MARKER = "Strong script overall.";

async function checkPendingSaveIntent(): Promise<void> {
  clearPendingSaveIntent();

  check(
    "no pending intent exists before one is written",
    readPendingSaveIntent() === null
  );

  const fingerprint = await createSaveAnalysisFingerprint({
    script: SAMPLE_SCRIPT,
    title: SAMPLE_TITLE,
    locale: "en",
    modelUsed: SAMPLE_MODEL,
  });

  check(
    "the fingerprint is not simply the JSON-serialized raw fields",
    fingerprint !== SAMPLE_SCRIPT &&
      !fingerprint.includes(SAMPLE_SCRIPT) &&
      /^v1:[0-9a-f]{64}$/.test(fingerprint)
  );

  writePendingSaveIntent(fingerprint);

  // Inspect exactly what actually landed in sessionStorage — the raw
  // serialized string, not the parsed/typed helper return value — since
  // that's the artifact a privacy review would actually be looking at.
  const rawStoredValue = sessionStorage.getItem(
    "climpy-pending-save-analysis"
  );

  check(
    "a pending intent is actually written to sessionStorage",
    typeof rawStoredValue === "string" && rawStoredValue.length > 0
  );

  const storedValue = rawStoredValue ?? "";

  check(
    "the stored pending-intent value does not contain the sample script text",
    !storedValue.includes(SAMPLE_SCRIPT) &&
      !storedValue.includes("small change") &&
      !storedValue.includes("watch until the end")
  );

  check(
    "the stored pending-intent value does not contain the title, model, or result content",
    !storedValue.includes(SAMPLE_TITLE) &&
      !storedValue.includes(SAMPLE_MODEL) &&
      !storedValue.includes(SAMPLE_RESULT_MARKER) &&
      !storedValue.includes(JSON.stringify(sampleResult))
  );

  check(
    "the stored pending-intent value does not contain user data, tokens, or session identifiers",
    !storedValue.toLowerCase().includes("user-123") &&
      !storedValue.toLowerCase().includes("token") &&
      !storedValue.toLowerCase().includes("session") &&
      !storedValue.toLowerCase().includes("@") // no embedded email-shaped data
  );

  const read = readPendingSaveIntent();

  check(
    "a written pending intent round-trips with the same fingerprint",
    read !== null && read.fingerprint === fingerprint
  );

  clearPendingSaveIntent();

  check(
    "clearing removes the pending intent",
    readPendingSaveIntent() === null
  );

  const digestA1 = await createSaveAnalysisFingerprint({
    script: "Same script.",
    title: "Same title",
    locale: "en",
    modelUsed: "gpt-4.1-mini",
  });
  const digestA2 = await createSaveAnalysisFingerprint({
    script: "Same script.",
    title: "Same title",
    locale: "en",
    modelUsed: "gpt-4.1-mini",
  });

  check(
    "the same analysis identity produces the same digest",
    digestA1 === digestA2
  );

  const digestDifferentScript = await createSaveAnalysisFingerprint({
    script: "A completely different script.",
    title: "Same title",
    locale: "en",
    modelUsed: "gpt-4.1-mini",
  });

  check(
    "a changed script produces a different digest",
    digestA1 !== digestDifferentScript
  );

  const digestDifferentModel = await createSaveAnalysisFingerprint({
    script: "Same script.",
    title: "Same title",
    locale: "en",
    modelUsed: "gpt-4.1-mini-different",
  });

  check(
    "changed result/analysis metadata (model identifier) produces a different digest",
    digestA1 !== digestDifferentModel
  );

  // --- Stale intent is cleared ------------------------------------------
  //
  // A pending intent written for one analysis must never be consumed for a
  // different one — this is exactly the guard that stops an unrelated
  // later sign-in from triggering an unintended save. Verified here at the
  // digest level (mismatched digest => never treated as a match); the
  // page-level clearing behavior is verified by the source-shape checks
  // below, since there is no DOM/effect test harness in this repo.
  clearPendingSaveIntent();
  writePendingSaveIntent(digestA1);

  const staleRead = readPendingSaveIntent();
  const currentDigest = digestDifferentScript;

  check(
    "a stale (mismatched) pending intent is detectably different from the current analysis's digest",
    staleRead !== null && staleRead.fingerprint !== currentDigest
  );

  clearPendingSaveIntent();
}

function checkMessageCoverage(): void {
  check(
    "results.save keys are covered for every launched locale",
    LAUNCHED_LOCALES.every((locale) => {
      const save = getMessages(locale).results.save;

      return (
        save.action.length > 0 &&
        save.saving.length > 0 &&
        save.saved.length > 0 &&
        save.retry.length > 0 &&
        save.errorAuth.length > 0 &&
        save.errorValidation.length > 0 &&
        save.errorDatabase.length > 0 &&
        save.untitled.length > 0
      );
    })
  );

  check(
    "EN and RU save action labels are actually localized (not identical strings)",
    getMessages("en").results.save.action !==
      getMessages("ru").results.save.action
  );
}

// No React/DOM test harness exists in this repo's test suite (tsx runs
// plain Node scripts — see tests/login-page-build-safety.ts and
// tests/results-improve-ui.ts for the established pattern), so the
// orchestration behavior that can't be unit-tested as a pure function is
// verified by checking the page's source shape instead.
function checkResultsPageSourceShape(): void {
  const pageSource = readFileSync("app/results/page.tsx", "utf8");

  check(
    "signed-out Save opens the sign-in flow instead of saving directly",
    /async function handleSaveClick\(\)[\s\S]*?if \(!user\) \{[\s\S]*?setIsSaveSignInModalOpen\(true\)/.test(
      pageSource
    )
  );

  check(
    "the pending intent is written from a digest, never the raw fingerprint inputs",
    /const fingerprint = await computeCurrentSaveFingerprint\(\);\s*writePendingSaveIntent\(fingerprint\)/.test(
      pageSource
    )
  );

  check(
    "pending-save intent is written only from the explicit Save click handler",
    (() => {
      const writeCalls =
        pageSource.split("writePendingSaveIntent(").length - 1;
      const handleSaveClickStart = pageSource.indexOf(
        "async function handleSaveClick()"
      );
      const handleSaveClickEnd =
        handleSaveClickStart >= 0
          ? pageSource.indexOf("\n  }", handleSaveClickStart)
          : -1;
      const withinHandler =
        handleSaveClickStart >= 0 &&
        handleSaveClickEnd > handleSaveClickStart &&
        pageSource
          .slice(handleSaveClickStart, handleSaveClickEnd)
          .includes("writePendingSaveIntent(");

      return writeCalls === 1 && withinHandler;
    })()
  );

  check(
    "OAuth return verifies the digest before triggering a save, and consumption is guarded so it fires at most once",
    /if \(pending\.fingerprint !== currentFingerprint\) \{[\s\S]*?clearPendingSaveIntent\(\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?timer = window\.setTimeout\(\(\) => \{\s*if \(!cancelled\) \{\s*void performSave\(\);/.test(
      pageSource
    ) && pageSource.includes('if (saveState !== "idle") {')
  );

  check(
    "a stale pending intent (digest mismatch) is cleared instead of triggering a save",
    /pending\.fingerprint !== currentFingerprint[\s\S]*?clearPendingSaveIntent\(\)/.test(
      pageSource
    )
  );

  check(
    "a successful save clears the pending intent",
    /async function performSave\(\)[\s\S]*?clearPendingSaveIntent\(\)/.test(
      pageSource
    )
  );

  check(
    "closing the save sign-in modal without completing sign-in clears the pending intent",
    /isOpen=\{isSaveSignInModalOpen\}[\s\S]*?onClose=\{[\s\S]*?clearPendingSaveIntent\(\)/.test(
      pageSource
    )
  );

  check(
    "a failed save leaves saveState as 'error', not 'saved' (still retryable)",
    pageSource.includes('setSaveState("error");') &&
      !/reason: result\.reason,?\s*\}\);?\s*setSaveState\("saved"\)/.test(
        pageSource
      )
  );

  check(
    "the save button is only disabled while saving or already saved (error remains clickable)",
    /const isDisabled = state === "saving" \|\| state === "saved";/.test(
      readFileSync("app/results/ui-components.tsx", "utf8")
    )
  );

  check(
    "performSave guards against duplicate concurrent/completed saves",
    /async function performSave\(\) \{\s*if \(!savedAnalysisV2 \|\| saveState === "saving" \|\| saveState === "saved"\)/.test(
      pageSource
    )
  );

  check(
    "handleSaveClick also guards against duplicate clicks",
    /async function handleSaveClick\(\) \{\s*if \(!savedAnalysisV2 \|\| saveState === "saving" \|\| saveState === "saved"\)/.test(
      pageSource
    )
  );

  check(
    "the results page saves via the RLS-bound browser client, not the service-role client",
    pageSource.includes(
      'import { supabaseBrowser } from "../../lib/supabase/browser";'
    ) &&
      !pageSource.includes('from "../../lib/supabase"') &&
      !pageSource.includes("SUPABASE_SECRET_KEY")
  );

  const saveAnalysisSource = readFileSync(
    "app/results/save-analysis.ts",
    "utf8"
  );

  check(
    "the save-analysis module never references the service-role secret key",
    !saveAnalysisSource.includes("SUPABASE_SECRET_KEY") &&
      !saveAnalysisSource.includes('from "../../lib/supabase"')
  );
}

async function main(): Promise<void> {
  checkTitleGeneration();
  checkValidation();
  await checkInsertAnalysis();
  await checkPendingSaveIntent();
  checkMessageCoverage();
  checkResultsPageSourceShape();

  if (failures > 0) {
    console.error(`\nsave analysis tests: ${failures} failed`);
    process.exitCode = 1;
  } else {
    console.log("\nsave analysis tests: all passed");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL — unexpected error: ${message}`);
  process.exitCode = 1;
});
