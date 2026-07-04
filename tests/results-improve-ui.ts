import { readFileSync } from "node:fs";

const source = readFileSync("app/results/page.tsx", "utf8");
const homeSource = readFileSync("app/page.tsx", "utf8");
const uiComponentsSource = readFileSync(
  "app/results/ui-components.tsx",
  "utf8"
);
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


const storageEffectStart = source.indexOf("useEffect(() => {");
const storageEffectEnd =
  storageEffectStart >= 0
    ? source.indexOf("\n  }, []);", storageEffectStart)
    : -1;
const storageEffect =
  storageEffectStart >= 0 && storageEffectEnd > storageEffectStart
    ? source.slice(storageEffectStart, storageEffectEnd)
    : "";

const validatesStoredScript =
  storageEffect.includes("storedScript.trim()") &&
  storageEffect.includes("storedScript.length <= MAX_SCRIPT_CHARACTERS");

const validatesStoredTitle =
  storageEffect.includes("storedTitle.trim()") &&
  storageEffect.includes("storedTitle.length <= MAX_TITLE_CHARACTERS");

const rejectsInvalidStoredAnalysis =
  storageEffect.includes("setStorageError(") &&
  storageEffect.includes(
    "Your saved analysis is invalid. Please go back and analyze the script again."
  );

if (
  source.includes("const MAX_SCRIPT_CHARACTERS = 1000;") &&
  source.includes("const MAX_TITLE_CHARACTERS = 200;") &&
  validatesStoredScript &&
  validatesStoredTitle &&
  rejectsInvalidStoredAnalysis
) {
  console.log("✅ PASS — Stored analysis data is revalidated before rendering results");
} else {
  console.error(
    "❌ FAIL — Results must reject empty or oversized sessionStorage data before analysis"
  );
  failures += 1;
}

const analyzeHandlerStart = homeSource.indexOf("function handleAnalyze()");
const analyzeHandlerEnd =
  analyzeHandlerStart >= 0
    ? homeSource.indexOf("\n  return (", analyzeHandlerStart)
    : -1;
const analyzeHandler =
  analyzeHandlerStart >= 0 && analyzeHandlerEnd > analyzeHandlerStart
    ? homeSource.slice(analyzeHandlerStart, analyzeHandlerEnd)
    : "";

const previousScriptReadIndex = analyzeHandler.indexOf(
  'previousScript =\n          sessionStorage.getItem("reelyze-script")'
);
const previousTitleReadIndex = analyzeHandler.indexOf(
  'previousTitle =\n          sessionStorage.getItem("reelyze-title")'
);
const previousAnalysisReadIndex = analyzeHandler.indexOf(
  "previousAnalysis =\n          sessionStorage.getItem(\n            ANALYSIS_V2_STORAGE_KEY\n          )"
);
const storageSnapshotReadyIndex = analyzeHandler.indexOf(
  "hasStorageSnapshot = true;"
);
const firstStoredScriptWriteIndex = analyzeHandler.indexOf(
  'sessionStorage.setItem(\n          "reelyze-script",'
);

const preservesPreviousStoredAnalysis =
  previousScriptReadIndex >= 0 &&
  previousTitleReadIndex >= 0 &&
  previousAnalysisReadIndex >= 0 &&
  storageSnapshotReadyIndex > previousScriptReadIndex &&
  storageSnapshotReadyIndex > previousTitleReadIndex &&
  storageSnapshotReadyIndex > previousAnalysisReadIndex &&
  firstStoredScriptWriteIndex > storageSnapshotReadyIndex &&
  analyzeHandler.includes(
    'restoreSessionValue(\n            "reelyze-script",\n            previousScript\n          )'
  ) &&
  analyzeHandler.includes(
    'restoreSessionValue(\n            "reelyze-title",\n            previousTitle\n          )'
  ) &&
  analyzeHandler.includes(
    "restoreSessionValue(\n            ANALYSIS_V2_STORAGE_KEY,\n            previousAnalysis\n          )"
  );

if (preservesPreviousStoredAnalysis) {
  console.log("✅ PASS — Analyze restores previous session data when storage fails");
} else {
  console.error(
    "❌ FAIL — Analyze must not leave partially overwritten session data after a storage failure"
  );
  failures += 1;
}

const isolatesLegacyStorageCleanup =
  analyzeHandler.includes("function clearLegacyStoredScript()") &&
  analyzeHandler.includes('localStorage.removeItem("reelyze-script")') &&
  analyzeHandler.includes("clearLegacyStoredScript();");

if (isolatesLegacyStorageCleanup) {
  console.log("✅ PASS — Legacy localStorage cleanup cannot block a valid analysis");
} else {
  console.error(
    "❌ FAIL — Optional localStorage cleanup must not roll back a valid sessionStorage analysis"
  );
  failures += 1;
}

const silentTitleLimitCount =
  homeSource.split("maxLength={MAX_TITLE_CHARACTERS}").length - 1;
const titleCounterCount =
  homeSource.split("{title.length} / {MAX_TITLE_CHARACTERS}").length - 1;
const titleDisableGuardCount =
  homeSource.split("title.length > MAX_TITLE_CHARACTERS").length - 1;
const hasVisibleTitleError =
  homeSource.includes(
    "Title is too long. Please shorten it to 200 characters or less."
  );

if (
  silentTitleLimitCount === 0 &&
  titleCounterCount === 2 &&
  titleDisableGuardCount >= 2 &&
  hasVisibleTitleError
) {
  console.log("✅ PASS — Title length feedback is visible on desktop and mobile");
} else {
  console.error(
    `❌ FAIL — Title must allow overflow feedback instead of silently truncating (maxLength: ${silentTitleLimitCount}, counters: ${titleCounterCount}, guards: ${titleDisableGuardCount}, error: ${hasVisibleTitleError})`
  );
  failures += 1;
}

const desktopFeedbackRequiresResults =
  source.includes(
    `{isStorageLoaded && !storageError && hasAnalyzedScript && (
            <div className="mt-auto px-4 pb-10 pt-8">`
  );

if (desktopFeedbackRequiresResults) {
  console.log("✅ PASS — Desktop feedback is hidden when no analysis exists");
} else {
  console.error(
    "❌ FAIL — Desktop feedback must not appear in loading, error, or empty states"
  );
  failures += 1;
}


// ── Analysis V2 Improve Hook integration ─────────────────────────────────────

const usesAnalysisV2HookDecision =
  source.includes(
    'const hookDecision = savedAnalysisV2?.result.hookDecision ?? "keep";'
  ) &&
  source.includes(
    "const shouldShowHookAction = savedAnalysisV2"
  ) &&
  source.includes(
    '? hookDecision !== "keep"'
  ) &&
  source.includes(
    ": analysis.fixes.length > 0 && analysis.hook.score < 75;"
  );

if (usesAnalysisV2HookDecision) {
  console.log(
    "✅ PASS — Analysis V2 hookDecision controls the production hook action"
  );
} else {
  console.error(
    "❌ FAIL — Analysis V2 hookDecision must control whether the hook action is shown"
  );
  failures += 1;
}

const hasDecisionSpecificActionLabels =
  source.includes(
    'hookDecision === "diagnostic"'
  ) &&
  source.includes('"Improve Script"') &&
  source.includes(
    'hookDecision === "refine"'
  ) &&
  source.includes('"Refine Hook"') &&
  source.includes('"Improve Hook"');

if (hasDecisionSpecificActionLabels) {
  console.log(
    "✅ PASS — keep, refine, rewrite, and diagnostic use decision-specific UI labels"
  );
} else {
  console.error(
    "❌ FAIL — Hook action labels must come from the Analysis V2 hook decision"
  );
  failures += 1;
}

const v2FastPathIndex = handler.indexOf("if (savedAnalysisV2) {");
const legacyImproveFetchIndex = handler.indexOf('fetch("/api/improve"');

const usesValidatedV2ResultBeforeLegacyAPI =
  v2FastPathIndex >= 0 &&
  legacyImproveFetchIndex >= 0 &&
  v2FastPathIndex < legacyImproveFetchIndex &&
  handler.includes("savedAnalysisV2.result.suggestedHook") &&
  handler.includes("savedAnalysisV2.result.hookAssessment");

if (usesValidatedV2ResultBeforeLegacyAPI) {
  console.log(
    "✅ PASS — Validated Analysis V2 hook data is used before the legacy Improve API"
  );
} else {
  console.error(
    "❌ FAIL — Production V2 results must use suggestedHook and hookAssessment without a second AI analysis"
  );
  failures += 1;
}

const avoidsScoreBasedGoodHookOverride =
  source.includes(
    "const shouldShowHookAnalysis = !savedAnalysisV2 && analysis.hook.score >= 80;"
  );

if (avoidsScoreBasedGoodHookOverride) {
  console.log(
    "✅ PASS — Analysis V2 hook decisions are not overridden by the old score threshold"
  );
} else {
  console.error(
    "❌ FAIL — The old score threshold must only remain available for the legacy fallback"
  );
  failures += 1;
}


const preservesLegacyHookActionFallback =
  source.includes(
    'const shouldShowHookAction = savedAnalysisV2\n  ? hookDecision !== "keep"\n  : analysis.fixes.length > 0 && analysis.hook.score < 75;'
  );

if (preservesLegacyHookActionFallback) {
  console.log(
    "✅ PASS — Legacy fallback keeps its original hook action condition"
  );
} else {
  console.error(
    "❌ FAIL — Legacy fallback must keep the previous fixes-and-score hook action condition"
  );
  failures += 1;
}

const hasDecisionSpecificModalCopy =
  source.includes("const hookModalTitle =") &&
  source.includes("const hookModalDescription =") &&
  source.includes("const hookModalReasonLabel =") &&
  source.split("{hookModalTitle}").length - 1 === 2 &&
  source.split("{hookModalDescription}").length - 1 === 2 &&
  source.split("{hookModalReasonLabel}").length - 1 === 2;

if (hasDecisionSpecificModalCopy) {
  console.log(
    "✅ PASS — Desktop and mobile hook modals share decision-specific copy"
  );
} else {
  console.error(
    "❌ FAIL — Hook modal title, description, and reason label must come from shared Analysis V2 decision state"
  );
  failures += 1;
}


const preservesLegacyHookActionLabel =
  source.includes(
    "const hookActionLabel = savedAnalysisV2"
  ) &&
  source.includes(
    ': analysis.hook.score >= 70\n    ? "Refine Script"\n    : "Improve Hook";'
  );

if (preservesLegacyHookActionLabel) {
  console.log(
    "✅ PASS — Legacy fallback keeps its score-based action label"
  );
} else {
  console.error(
    "❌ FAIL — Legacy fallback must still show Refine Script for hook scores from 70 to 74"
  );
  failures += 1;
}


const breakdownRenderCount =
  source.split("<ScoreBreakdownCard").length - 1;

const breakdownGuardCount =
  source.split(
    "analysis.scoreBreakdown &&"
  ).length - 1;

const desktopScoreIndex = source.indexOf(
  'title="Retention Risk"'
);
const desktopBreakdownIndex = source.indexOf(
  "<ScoreBreakdownCard",
  desktopScoreIndex
);
const desktopTakeawayIndex = source.indexOf(
  "{/* Main Takeaway */}",
  desktopBreakdownIndex
);

const mobileScoresIndex = source.indexOf(
  "<MobileScoreCards"
);
const mobileBreakdownIndex = source.indexOf(
  "<ScoreBreakdownCard",
  mobileScoresIndex
);
const mobileTakeawayIndex = source.indexOf(
  "{/* Main Takeaway */}",
  mobileBreakdownIndex
);

const hasScoreBreakdownComponent =
  uiComponentsSource.includes(
    "export function ScoreBreakdownCard("
  ) &&
  uiComponentsSource.includes(
    "Why these scores?"
  ) &&
  uiComponentsSource.includes(
    "Lower is better for"
  ) &&
  uiComponentsSource.includes(
    "item.score * 4"
  );

const scoreBreakdownAppearsInCorrectOrder =
  desktopScoreIndex >= 0 &&
  desktopBreakdownIndex > desktopScoreIndex &&
  desktopTakeawayIndex > desktopBreakdownIndex &&
  mobileScoresIndex >= 0 &&
  mobileBreakdownIndex > mobileScoresIndex &&
  mobileTakeawayIndex > mobileBreakdownIndex;

if (
  source.includes("  ScoreBreakdownCard,") &&
  breakdownRenderCount === 2 &&
  breakdownGuardCount === 2 &&
  hasScoreBreakdownComponent &&
  scoreBreakdownAppearsInCorrectOrder
) {
  console.log(
    "✅ PASS — score breakdown appears after score cards on desktop and mobile"
  );
} else {
  console.error(
    "❌ FAIL — Score breakdown must be guarded and rendered between score cards and Main Takeaway on desktop and mobile"
  );
  failures += 1;
}


if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("\nResult: all Improve Hook UI regression tests passed.");
}
