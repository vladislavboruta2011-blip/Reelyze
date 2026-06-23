import { readFileSync } from "node:fs";

const source = readFileSync("app/results/page.tsx", "utf8");
let failures = 0;

console.log("\nReelyze Improve Hook UI Regression Tests\n");

const fetchCount = source.split('fetch("/api/improve"').length - 1;

if (fetchCount === 1) {
  console.log("✅ PASS — Improve Hook uses one shared API request path");
} else {
  console.error(
    `❌ FAIL — Expected one shared Improve Hook request path, found ${fetchCount}`
  );
  failures += 1;
}

const handlerStart = source.indexOf("async function handleImproveHook");
const handlerEnd =
  handlerStart >= 0
    ? source.indexOf("\n  }", handlerStart)
    : -1;
const handler =
  handlerStart >= 0 && handlerEnd > handlerStart
    ? source.slice(handlerStart, handlerEnd)
    : "";

const jsonIndex = handler.indexOf("await response.json()");
const okIndex = handler.indexOf("if (!response.ok)");

if (jsonIndex >= 0 && okIndex >= 0 && jsonIndex < okIndex) {
  console.log("✅ PASS — API error payload is read before response.ok handling");
} else {
  console.error(
    "❌ FAIL — Improve Hook must read the API payload before handling a non-OK response"
  );
  failures += 1;
}

const hasSafeModalHookText =
  source.includes(
    'const modalHookText = improveError ? "No improved hook was generated." : improvedHook;'
  );

if (hasSafeModalHookText) {
  console.log("✅ PASS — Failed AI requests do not display a fallback as the generated hook");
} else {
  console.error(
    "❌ FAIL — Improve Hook modal must not present the local fallback as an AI result after an error"
  );
  failures += 1;
}

const copyGuardCount =
  source.split("disabled={isImprovingHook || Boolean(improveError)}").length - 1;

if (
  source.includes("if (isImprovingHook || improveError) return;") &&
  copyGuardCount === 2
) {
  console.log("✅ PASS — Copy actions are blocked while loading and after an error");
} else {
  console.error(
    `❌ FAIL — Expected guarded copy handler and two disabled copy buttons, found ${copyGuardCount} disabled buttons`
  );
  failures += 1;
}

const hasSuccessPayloadGuard =
  source.includes("function isValidImproveSuccessPayload(") &&
  source.includes("if (!isValidImproveSuccessPayload(data))");

if (hasSuccessPayloadGuard) {
  console.log("✅ PASS — Malformed successful API payloads are rejected");
} else {
  console.error(
    "❌ FAIL — Improve Hook must validate a successful API payload before using it"
  );
  failures += 1;
}


const copyHandlerStart = source.indexOf("function handleCopyHook");
const copyHandlerEnd =
  copyHandlerStart >= 0
    ? source.indexOf("async function handleImproveHook", copyHandlerStart)
    : -1;
const copyHandler =
  copyHandlerStart >= 0 && copyHandlerEnd > copyHandlerStart
    ? source.slice(copyHandlerStart, copyHandlerEnd)
    : "";

const clipboardAwaitIndex = copyHandler.indexOf(
  "await navigator.clipboard.writeText(improvedHook)"
);
const copiedSuccessIndex = copyHandler.indexOf("setCopiedHook(true)");
const handlesClipboardFailure = copyHandler.includes("catch");

if (
  source.includes("async function handleCopyHook()") &&
  clipboardAwaitIndex >= 0 &&
  copiedSuccessIndex > clipboardAwaitIndex &&
  handlesClipboardFailure
) {
  console.log("✅ PASS — Copy success is shown only after clipboard write succeeds");
} else {
  console.error(
    "❌ FAIL — Copy Hook must await clipboard.writeText and must not show success when the write fails"
  );
  failures += 1;
}


const shareHandlerStart = source.indexOf("async function handleShare");
const shareHandlerEnd =
  shareHandlerStart >= 0
    ? source.indexOf("\n  return (", shareHandlerStart)
    : -1;
const shareHandler =
  shareHandlerStart >= 0 && shareHandlerEnd > shareHandlerStart
    ? source.slice(shareHandlerStart, shareHandlerEnd)
    : "";

const avoidsUnshareableResultsUrl =
  !shareHandler.includes("window.location.href") &&
  !shareHandler.includes("Review link copied.");

const sharesActualReviewContent =
  shareHandler.includes("activeScript") &&
  shareHandler.includes("analysis.overall.score") &&
  shareHandler.includes("analysis.hook.score") &&
  shareHandler.includes("analysis.risk.score");

const blocksShareWithoutResults =
  shareHandler.includes(
    "if (!isStorageLoaded || storageError || !hasAnalyzedScript) return;"
  ) &&
  source.includes(
    "disabled={!isStorageLoaded || Boolean(storageError) || !hasAnalyzedScript}"
  );

if (
  avoidsUnshareableResultsUrl &&
  sharesActualReviewContent &&
  blocksShareWithoutResults
) {
  console.log("✅ PASS — Share exports actual review content only when results exist");
} else {
  console.error(
    "❌ FAIL — Share must not copy the session-only /results URL or expose fallback content"
  );
  failures += 1;
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("\nResult: all Improve Hook UI regression tests passed.");
}
