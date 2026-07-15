import { readFileSync } from "node:fs";

const source = readFileSync("app/results/page.tsx", "utf8");
const homeSource = readFileSync("app/page.tsx", "utf8");
const messagesSource = readFileSync("lib/messages.ts", "utf8");
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
const refinedHookHandlerStart = source.indexOf(
  "async function handleImproveScript"
);
const refinedHookHandlerEnd =
  refinedHookHandlerStart >= 0
    ? source.indexOf(
        "async function handleCopyImprovedScript",
        refinedHookHandlerStart
      )
    : -1;
const refinedHookHandler =
  refinedHookHandlerStart >= 0 &&
  refinedHookHandlerEnd > refinedHookHandlerStart
    ? source.slice(
        refinedHookHandlerStart,
        refinedHookHandlerEnd
      )
    : "";

const forwardsSuccessfulRefinedHook =
  refinedHookHandler.includes("refinedHook:") &&
  refinedHookHandler.includes('aiHookMode === "rewrite"') &&
  refinedHookHandler.includes("aiHook.trim()");

if (forwardsSuccessfulRefinedHook) {
  console.log(
    "✅ PASS — Improve Script receives a successful refined hook"
  );
} else {
  console.error(
    "❌ FAIL — Improve Script must forward a non-empty refined hook only after a successful hook rewrite"
  );
  failures += 1;
}

// Cross-feature consistency: the validated Analysis V2 result — not only
// the ephemeral aiHook/aiHookMode state populated by a separate manual
// "Improve Hook" click — must be able to supply the approved refined hook,
// so Improve Script cannot silently invent its own opening when the user
// never opened the Improve Hook modal first.
const derivesRefinedHookFromValidatedAnalysisFirst =
  refinedHookHandler.includes("analysisApprovedHook") &&
  refinedHookHandler.includes(
    'analysisResult.hookDecision === "refine"'
  ) &&
  refinedHookHandler.includes(
    'analysisResult.hookDecision === "rewrite"'
  ) &&
  refinedHookHandler.includes(
    "analysisResult.suggestedHook"
  ) &&
  refinedHookHandler.indexOf("analysisApprovedHook") <
    refinedHookHandler.lastIndexOf(
      'aiHookMode === "rewrite"'
    );

if (derivesRefinedHookFromValidatedAnalysisFirst) {
  console.log(
    "✅ PASS — Improve Script derives the approved refined hook from validated analysis first, before the ephemeral Improve Hook UI state"
  );
} else {
  console.error(
    "❌ FAIL — Improve Script must prioritize the validated analysis's own suggestedHook over ephemeral aiHook/aiHookMode state"
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
    "const modalHookText = improveError ? results.hookModal.noImprovedHookGenerated : improvedHook;"
  ) &&
  messagesSource.includes(
    'noImprovedHookGenerated: "No improved hook was generated."'
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
  storageEffect.includes("setStorageError(results.error.invalidAnalysis)") &&
  messagesSource.includes(
    'invalidAnalysis:\n        "Your saved analysis is invalid. Please go back and analyze the script again."'
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
const visibleTitleErrorBindingCount =
  homeSource.split("messages.landing.analyzer.titleTooLong").length - 1;
const validationTitleErrorBindingCount =
  homeSource.split("messages.landing.errors.titleTooLong").length - 1;
const catalogContainsTitleTooLongError = messagesSource.includes(
  "Title is too long. Please shorten it to 200 characters or less."
);

if (
  silentTitleLimitCount === 0 &&
  titleCounterCount === 2 &&
  titleDisableGuardCount >= 2 &&
  visibleTitleErrorBindingCount === 2 &&
  validationTitleErrorBindingCount >= 1 &&
  catalogContainsTitleTooLongError
) {
  console.log("✅ PASS — Title length feedback is visible on desktop and mobile");
} else {
  console.error(
    `❌ FAIL — Title must allow overflow feedback instead of silently truncating (maxLength: ${silentTitleLimitCount}, counters: ${titleCounterCount}, guards: ${titleDisableGuardCount}, visible bindings: ${visibleTitleErrorBindingCount}, validation bindings: ${validationTitleErrorBindingCount}, catalog: ${catalogContainsTitleTooLongError})`
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


const scriptCardStart = source.indexOf(
  '<h2 className="text-[17px] font-semibold text-[#111827]">{results.script.heading}</h2>'
);
const savedTitleBlockIndex = source.indexOf("{savedTitle && (", scriptCardStart);
const titleLabelIndex = source.indexOf(">{results.script.titleLabel}</p>", savedTitleBlockIndex);
const savedTitleValueIndex = source.indexOf("{savedTitle}</p>", savedTitleBlockIndex);
const scriptLinesContentIndex = source.indexOf(
  "<ScriptLinesContent",
  scriptCardStart
);

if (
  scriptCardStart >= 0 &&
  savedTitleBlockIndex > scriptCardStart &&
  titleLabelIndex > savedTitleBlockIndex &&
  savedTitleValueIndex > titleLabelIndex &&
  scriptLinesContentIndex > savedTitleValueIndex
) {
  console.log("✅ PASS — Results displays the saved title above the script lines");
} else {
  console.error(
    "❌ FAIL — Results must display the saved video title/topic above the script lines"
  );
  failures += 1;
}

const desktopUsesLocalizedShortsNotice = homeSource.includes(
  "messages.landing.analyzer.supportingText"
);
const catalogContainsDesktopShortsNotice = messagesSource.includes(
  "Works best for YouTube Shorts (15–60 seconds)."
);
const hasDesktopShortsNotice =
  desktopUsesLocalizedShortsNotice &&
  catalogContainsDesktopShortsNotice;

const mobileUsesLocalizedShortsNotice = homeSource.includes(
  "messages.landing.analyzer.shortsOnly"
);
const catalogContainsMobileShortsNotice = messagesSource.includes(
  'shortsOnly: "Shorts only"'
);
const hasMobileShortsNotice =
  mobileUsesLocalizedShortsNotice &&
  catalogContainsMobileShortsNotice;

if (hasDesktopShortsNotice && hasMobileShortsNotice) {
  console.log("✅ PASS — New Analysis shows desktop and mobile Shorts-only guidance");
} else {
  console.error(
    `❌ FAIL — New Analysis must show Shorts-only guidance on desktop and mobile (desktop binding: ${desktopUsesLocalizedShortsNotice}, desktop catalog: ${catalogContainsDesktopShortsNotice}, mobile binding: ${mobileUsesLocalizedShortsNotice}, mobile catalog: ${catalogContainsMobileShortsNotice})`
  );
  failures += 1;
}

const scriptLengthGuardCount =
  homeSource.split("script.length > maxCharacters").length - 1;
const scriptTooLongBindingCount =
  homeSource.split("messages.landing.errors.scriptTooLong").length - 1;
const catalogContainsScriptTooLongError = messagesSource.includes(
  "Script is too long. Please shorten it to 1,000 characters or less."
);
const silentScriptLimitCount =
  homeSource.split("maxLength={maxCharacters}").length - 1;

if (
  scriptLengthGuardCount >= 2 &&
  scriptTooLongBindingCount >= 2 &&
  catalogContainsScriptTooLongError &&
  silentScriptLimitCount === 0
) {
  console.log("✅ PASS — Script length feedback blocks over-1000 scripts visibly");
} else {
  console.error(
    `❌ FAIL — Script length must use visible blocking feedback instead of silent truncation (guards: ${scriptLengthGuardCount}, bindings: ${scriptTooLongBindingCount}, catalog: ${catalogContainsScriptTooLongError}, maxLength: ${silentScriptLimitCount})`
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
  source.includes('results.suggestedFixes.hookActionNeedsDetails') &&
  source.includes(
    'hookDecision === "refine"'
  ) &&
  source.includes('results.suggestedFixes.hookActionRefine') &&
  source.includes('results.suggestedFixes.hookActionImprove') &&
  messagesSource.includes('hookActionNeedsDetails: "Needs Details"') &&
  messagesSource.includes('hookActionRefine: "Refine Hook"') &&
  messagesSource.includes('hookActionImprove: "Improve Hook"');

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
    ": analysis.hook.score >= 70\n    ? results.suggestedFixes.hookActionRefine\n    : results.suggestedFixes.hookActionImprove;"
  );

if (preservesLegacyHookActionLabel) {
  console.log(
    "✅ PASS — Legacy fallback keeps its score-based action label"
  );
} else {
  console.error(
    "❌ FAIL — Legacy fallback must still show Refine Hook for hook scores from 70 to 74"
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
  "title={results.scoreCards.retentionRisk}"
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
    "messages.results.scoreBreakdown.heading"
  ) &&
  uiComponentsSource.includes(
    "messages.results.scoreBreakdown.description"
  ) &&
  uiComponentsSource.includes(
    "item.score * 4"
  ) &&
  messagesSource.includes("heading: \"Why these scores?\"") &&
  messagesSource.includes("Lower is better for");

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


const improveScriptFetchCount =
  source.split('fetch("/api/improve-script"').length - 1;

const improveScriptHandlerStart = source.indexOf(
  "async function handleImproveScript"
);
const improveScriptHandlerEnd =
  improveScriptHandlerStart >= 0
    ? source.indexOf(
        "async function handleCopyImprovedScript",
        improveScriptHandlerStart
      )
    : -1;
const improveScriptHandler =
  improveScriptHandlerStart >= 0 &&
  improveScriptHandlerEnd > improveScriptHandlerStart
    ? source.slice(improveScriptHandlerStart, improveScriptHandlerEnd)
    : "";

const improveScriptJsonIndex =
  improveScriptHandler.indexOf("await response.json()");
const improveScriptOkIndex =
  improveScriptHandler.indexOf("if (!response.ok)");

const hasSeparateImproveScriptFlow =
  improveScriptFetchCount === 1 &&
  source.includes("function isValidImproveScriptSuccessPayload(") &&
  source.includes("const [isScriptModalOpen, setIsScriptModalOpen]") &&
  source.includes("const [improvedScript, setImprovedScript]") &&
  source.includes("const [isImprovingScript, setIsImprovingScript]") &&
  source.includes("const [improveScriptError, setImproveScriptError]") &&
  source.includes("async function handleImproveScript()") &&
  source.includes("async function handleCopyImprovedScript()") &&
  source.includes("setIsScriptModalOpen(true)") &&
  source.includes("{isScriptModalOpen &&") &&
  source.split("Improve Script").length - 1 >= 2;

if (hasSeparateImproveScriptFlow) {
  console.log(
    "✅ PASS — Improve Script uses a separate endpoint, state, handler, and modal"
  );
} else {
  console.error(
    "❌ FAIL — Improve Script must use its own endpoint, state, handler, and modal"
  );
  failures += 1;
}

if (
  improveScriptJsonIndex >= 0 &&
  improveScriptOkIndex >= 0 &&
  improveScriptJsonIndex < improveScriptOkIndex
) {
  console.log(
    "✅ PASS — Improve Script reads the API payload before response.ok handling"
  );
} else {
  console.error(
    "❌ FAIL — Improve Script must read the API payload before handling a non-OK response"
  );
  failures += 1;
}

const hasImproveScriptPayloadGuard =
  source.includes("function isValidImproveScriptSuccessPayload(") &&
  improveScriptHandler.includes(
    "if (!isValidImproveScriptSuccessPayload(data))"
  );

if (hasImproveScriptPayloadGuard) {
  console.log(
    "✅ PASS — Improve Script validates successful API payloads before rendering"
  );
} else {
  console.error(
    "❌ FAIL — Improve Script must validate successful API payloads before rendering"
  );
  failures += 1;
}

const improveScriptCopyHandlerStart = source.indexOf(
  "async function handleCopyImprovedScript"
);
const improveScriptCopyHandlerEnd =
  improveScriptCopyHandlerStart >= 0
    ? source.indexOf("async function handleShare", improveScriptCopyHandlerStart)
    : -1;
const improveScriptCopyHandler =
  improveScriptCopyHandlerStart >= 0 &&
  improveScriptCopyHandlerEnd > improveScriptCopyHandlerStart
    ? source.slice(
        improveScriptCopyHandlerStart,
        improveScriptCopyHandlerEnd
      )
    : "";

const copiesFullImprovedScript =
  improveScriptCopyHandler.includes(
    "await navigator.clipboard.writeText(improvedScript)"
  ) &&
  improveScriptCopyHandler.includes(
    "if (isImprovingScript || improveScriptError) return;"
  ) &&
  improveScriptCopyHandler.includes("setCopiedScript(true)") &&
  improveScriptCopyHandler.includes("catch");

if (copiesFullImprovedScript) {
  console.log(
    "✅ PASS — Improve Script copies the complete validated rewrite safely"
  );
} else {
  console.error(
    "❌ FAIL — Improve Script copy action must safely copy the complete rewrite"
  );
  failures += 1;
}


const supportsPreserveImproveScriptStatus =
  source.includes(
    'status: "improved" | "diagnostic" | "preserve";'
  ) &&
  source.includes(
    'payload.status === "preserve"'
  );

const storesImproveScriptResultStatus =
  source.includes(
    "const [improveScriptStatus, setImproveScriptStatus]"
  ) &&
  improveScriptHandler.includes(
    "setImproveScriptStatus(data.status)"
  );

const presentsPreservedOriginalHonestly =
  source.includes('improveScriptStatus === "preserve"') &&
  source.includes("results.improveScriptModal.originalPreservedTitle") &&
  source.includes("results.improveScriptModal.preservedDescription") &&
  source.includes(
    "copiedScript ? results.improveScriptModal.copied : improveScriptStatus === \"preserve\""
  ) &&
  source.includes("results.improveScriptModal.copyOriginal") &&
  messagesSource.includes('originalPreservedTitle: "Original Script Preserved"') &&
  messagesSource.includes(
    "the generated rewrite did not make a meaningful editorial improvement"
  ) &&
  messagesSource.includes('copyOriginal: "Copy Original"');

if (
  supportsPreserveImproveScriptStatus &&
  storesImproveScriptResultStatus &&
  presentsPreservedOriginalHonestly
) {
  console.log(
    "✅ PASS — Improve Script presents preserved originals honestly"
  );
} else {
  console.error(
    "❌ FAIL — Preserve responses must be accepted, stored, and shown as the original rather than an improved rewrite"
  );
  console.error(
    JSON.stringify({
      supportsPreserveImproveScriptStatus,
      storesImproveScriptResultStatus,
      presentsPreservedOriginalHonestly,
    })
  );
  failures += 1;
}



const forwardsValidatedAnalysisToImproveScript =
  refinedHookHandler.includes("analysisResult:") &&
  (
    refinedHookHandler.includes("savedAnalysisV2?.result") ||
    refinedHookHandler.includes("savedAnalysisV2.result")
  ) &&
  refinedHookHandler.includes("body: JSON.stringify({");

if (forwardsValidatedAnalysisToImproveScript) {
  console.log(
    "✅ PASS — Results forwards the validated Analysis V2 result to Improve Script"
  );
} else {
  console.error(
    "❌ FAIL — Results must forward the validated Analysis V2 result to Improve Script"
  );
  failures += 1;
}

const improveScriptFingerprintStart = source.indexOf(
  "function createImproveScriptFingerprint("
);
const improveScriptFingerprintEnd =
  improveScriptFingerprintStart >= 0
    ? source.indexOf(
        "\nfunction isValidImproveScriptSuccessPayload",
        improveScriptFingerprintStart
      )
    : -1;
const improveScriptFingerprintSource =
  improveScriptFingerprintStart >= 0 &&
  improveScriptFingerprintEnd > improveScriptFingerprintStart
    ? source.slice(
        improveScriptFingerprintStart,
        improveScriptFingerprintEnd
      )
    : "";

const invalidatesImproveScriptCacheWithAnalysis =
  source.includes('const IMPROVE_SCRIPT_CACHE_VERSION = "3";') &&
  improveScriptFingerprintSource.includes("analysisResult") &&
  improveScriptFingerprintSource.includes("locale") &&
  refinedHookHandler.includes("analysisResult") &&
  refinedHookHandler.includes("createImproveScriptFingerprint({");

if (invalidatesImproveScriptCacheWithAnalysis) {
  console.log(
    "✅ PASS — Improve Script cache is invalidated when the validated analysis changes"
  );
} else {
  console.error(
    "❌ FAIL — Improve Script cache fingerprint must include the validated analysis and use a new pipeline version"
  );
  failures += 1;
}


const hasVersionedImproveScriptCacheContract =
  source.includes('const IMPROVE_SCRIPT_CACHE_VERSION = "3";') &&
  source.includes("const IMPROVE_SCRIPT_CACHE_STORAGE_KEY") &&
  source.includes("function createImproveScriptFingerprint(") &&
  source.includes("version: IMPROVE_SCRIPT_CACHE_VERSION") &&
  source.includes("script: script.trim()") &&
  source.includes("title: title.trim()") &&
  source.includes("refinedHook: refinedHook.trim()") &&
  improveScriptFingerprintSource.includes("analysisResult") &&
  improveScriptFingerprintSource.includes("locale");

if (hasVersionedImproveScriptCacheContract) {
  console.log(
    "✅ PASS — Improve Script cache fingerprint includes every invalidation input"
  );
} else {
  console.error(
    "❌ FAIL — Improve Script cache must be versioned by script, title, refined hook, validated analysis, and pipeline version"
  );
  failures += 1;
}

const improveScriptCacheReadIndex = improveScriptHandler.indexOf(
  "sessionStorage.getItem(IMPROVE_SCRIPT_CACHE_STORAGE_KEY)"
);
const improveScriptFetchIndex = improveScriptHandler.indexOf(
  'fetch("/api/improve-script"'
);
const reusesValidatedImproveScriptCache =
  source.includes("function parseStoredImproveScriptCache(") &&
  source.includes("function applyImproveScriptResult(") &&
  improveScriptCacheReadIndex >= 0 &&
  improveScriptFetchIndex >= 0 &&
  improveScriptCacheReadIndex < improveScriptFetchIndex &&
  improveScriptHandler.includes(
    "cachedImproveScript.fingerprint === improveScriptFingerprint"
  ) &&
  improveScriptHandler.includes(
    "applyImproveScriptResult(cachedImproveScript.result)"
  );

if (reusesValidatedImproveScriptCache) {
  console.log(
    "✅ PASS — Repeated Improve Script clicks reuse the validated cached result before fetch"
  );
} else {
  console.error(
    "❌ FAIL — Improve Script must open the matching validated cache entry without another API request"
  );
  failures += 1;
}

const improveScriptValidationIndex = improveScriptHandler.indexOf(
  "if (!isValidImproveScriptSuccessPayload(data))"
);
const improveScriptCacheWriteIndex = improveScriptHandler.indexOf(
  "sessionStorage.setItem("
);
const cachesOnlyValidatedImproveScriptResults =
  improveScriptValidationIndex >= 0 &&
  improveScriptCacheWriteIndex > improveScriptValidationIndex &&
  improveScriptHandler.includes("IMPROVE_SCRIPT_CACHE_STORAGE_KEY") &&
  improveScriptHandler.includes("fingerprint: improveScriptFingerprint") &&
  improveScriptHandler.includes("result: data");

if (cachesOnlyValidatedImproveScriptResults) {
  console.log(
    "✅ PASS — Improve Script caches complete results only after payload validation"
  );
} else {
  console.error(
    "❌ FAIL — Improve Script must not cache API errors, malformed payloads, or incomplete result fields"
  );
  failures += 1;
}

const hasImproveScriptRequestDeduplication =
  source.includes("const improveScriptRequestRef = useRef") &&
  improveScriptHandler.includes(
    "improveScriptRequestRef.current?.fingerprint === improveScriptFingerprint"
  ) &&
  improveScriptHandler.includes(
    "latestImproveScriptFingerprintRef.current !== improveScriptFingerprint"
  ) &&
  improveScriptHandler.includes("requestId");

if (hasImproveScriptRequestDeduplication) {
  console.log(
    "✅ PASS — Improve Script deduplicates identical requests and ignores stale responses"
  );
} else {
  console.error(
    "❌ FAIL — Improve Script needs a synchronous in-flight lock and stale-response protection"
  );
  failures += 1;
}


if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("\nResult: all Improve Hook UI regression tests passed.");
}
