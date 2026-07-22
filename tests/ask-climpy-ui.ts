import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync("app/results/page.tsx", "utf8");
const panelSource = readFileSync("app/results/ask-climpy-panel.tsx", "utf8");
const messagesSource = readFileSync("lib/messages.ts", "utf8");
const revealSource = readFileSync("app/results/ask-climpy-reveal.ts", "utf8");

type TestCase = {
  name: string;
  run: () => void;
};

function sliceBetween(
  source: string,
  startMarker: string,
  endMarker: string
): string {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Could not find start marker: ${startMarker}`);

  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Could not find end marker after start: ${endMarker}`);

  return source.slice(start, end);
}

const tests: TestCase[] = [
  {
    name: "page.tsx imports AskClimpyPanel from the panel module",
    run: () => {
      assert.match(
        pageSource,
        /import\s*\{\s*\n?\s*AskClimpyPanel/,
        "Expected page.tsx to import AskClimpyPanel"
      );
    },
  },
  {
    name: "AskClimpyPanel is only rendered while open AND a validated analysis exists",
    run: () => {
      assert.match(
        pageSource,
        /\{isAskClimpyOpen && savedAnalysisV2 && \(\s*<AskClimpyPanel/
      );
    },
  },
  {
    name: "Ask Climpy entry button (desktop and mobile) is gated on savedAnalysisV2",
    run: () => {
      const entryButtonCount =
        pageSource.split("onClick={handleOpenAskClimpy}").length - 1;

      assert.equal(
        entryButtonCount,
        2,
        "Expected exactly two Ask Climpy entry points (desktop + mobile)"
      );
    },
  },
  {
    name: "handleOpenAskClimpy refuses to open without a validated analysis",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "function handleOpenAskClimpy()",
        "function handleCloseAskClimpy()"
      );

      assert.match(handler, /if \(!savedAnalysisV2\) return;/);
    },
  },
  {
    name: "handleCloseAskClimpy is never gated on isAskClimpyPending — closing always succeeds",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "function handleCloseAskClimpy()",
        "async function handleSendAskClimpy("
      );

      assert.doesNotMatch(
        handler,
        /if\s*\(\s*isAskClimpyPending/,
        "Close handler must not be blocked by a pending request"
      );
      assert.match(
        handler,
        /askClimpyAbortControllerRef\.current\?\.abort\(\)/,
        "Close handler must abort any in-flight request"
      );
    },
  },

  // ── Correction 4: stable analysis identity ───────────────────────────
  {
    name: "The analysis identity key is a deterministic serialization of script + result, not a bare object reference",
    run: () => {
      const memo = sliceBetween(
        pageSource,
        "const askClimpyAnalysisIdentityKey = useMemo(",
        "}, [activeScript, savedAnalysisV2]);"
      );

      assert.match(memo, /JSON\.stringify\(/);
      assert.match(memo, /script: activeScript/);
      assert.match(memo, /result: savedAnalysisV2\.result/);
    },
  },
  {
    name: "The identity key computation does not depend on locale",
    run: () => {
      const memo = sliceBetween(
        pageSource,
        "const askClimpyAnalysisIdentityKey = useMemo(",
        "}, [activeScript, savedAnalysisV2]);"
      );

      assert.doesNotMatch(memo, /\blocale\b/);
    },
  },
  {
    name: "The reset effect depends on the identity key, not directly on savedAnalysisV2",
    run: () => {
      assert.match(
        pageSource,
        /\}, \[askClimpyAnalysisIdentityKey\]\);/,
        "Expected the identity-reset effect's dependency array to be [askClimpyAnalysisIdentityKey]"
      );
    },
  },
  {
    name: "The analysis-identity-reset effect aborts/clears Ask Climpy state, skipping the initial mount",
    run: () => {
      const effect = sliceBetween(
        pageSource,
        "askClimpyMountedRef.current = true;",
        "}, [askClimpyAnalysisIdentityKey]);"
      );

      assert.match(effect, /askClimpyAbortControllerRef\.current\?\.abort\(\)/);
      assert.match(effect, /askClimpyRequestIdRef\.current \+= 1;/);
      assert.match(effect, /setAskClimpyMessages\(\[\]\);/);
      assert.match(effect, /setIsAskClimpyOpen\(false\);/);
    },
  },
  {
    name: "A separate unmount-only effect also aborts any in-flight Ask Climpy request",
    run: () => {
      assert.match(
        pageSource,
        /useEffect\(\(\) => \{\s*return \(\) => \{\s*askClimpyAbortControllerRef\.current\?\.abort\(\);\s*\};\s*\}, \[\]\);/
      );
    },
  },
  {
    name: "handleSendAskClimpy ignores a stale response using the request-id ref (mirrors improveScriptRequestIdRef pattern)",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      assert.match(handler, /const requestId = askClimpyRequestIdRef\.current \+ 1;/);
      assert.match(handler, /askClimpyRequestIdRef\.current = requestId;/);
      assert.match(
        handler,
        /if \(askClimpyRequestIdRef\.current !== requestId\) \{\s*return;/
      );
      assert.match(handler, /new AbortController\(\)/);
      assert.match(handler, /signal: controller\.signal/);
    },
  },

  // ── Correction 1: 6 successful answers, not 8 user turns ─────────────
  {
    name: "The cap counts successful assistant answers, not user turns or attempted requests",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      assert.match(
        handler,
        /next\.filter\(\s*\(message\) => message\.role === "assistant"\s*\)\.length/,
        "Expected the cap to count role === \"assistant\" messages"
      );
      assert.doesNotMatch(
        handler,
        /message\.role === "user"[\s\S]{0,40}\.length/,
        "The cap must not count user-role messages"
      );
      assert.match(
        handler,
        /ASK_CLIMPY_LIMITS\.maxSuccessfulAnswersPerAnalysis/
      );
    },
  },
  {
    name: "The assistant message (the only thing the cap counts) is only ever pushed after response.ok and a validated payload",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      const errorGuardIndex = handler.indexOf(
        "if (!response.ok || !isValidAskClimpyResponse(data)) {"
      );
      const assistantPushIndex = handler.indexOf('role: "assistant"');

      assert.ok(errorGuardIndex >= 0);
      assert.ok(assistantPushIndex > errorGuardIndex);
    },
  },
  {
    name: "A valid safe refusal (cannotSafelyRewrite: true, a normal 200 response) is pushed and counted exactly like any other successful answer — never special-cased out of the slot count",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      // The assistant-message push sits entirely past the response.ok/
      // isValidAskClimpyResponse guard and reads data.cannotSafelyRewrite
      // only to store it on the message — there is no branch anywhere in
      // this handler that skips the push, or excludes the message from the
      // "assistant" filter used for the cap, based on that value.
      assert.doesNotMatch(
        handler,
        /if\s*\(\s*data\.cannotSafelyRewrite/,
        "There must be no branch that special-cases cannotSafelyRewrite before pushing/counting the message"
      );
      assert.match(handler, /cannotSafelyRewrite: data\.cannotSafelyRewrite,/);
    },
  },
  {
    name: "An aborted request never pushes an assistant message (and so never consumes a slot)",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      const catchBlock = sliceBetween(handler, "} catch (error) {", "} finally {");
      assert.match(catchBlock, /AbortError/);
      assert.doesNotMatch(catchBlock, /role: "assistant"/);
    },
  },

  // ── Correction 2: 200-character rewrite excerpt limit ────────────────
  {
    name: "A rewrite request derives rewriteFragment only from the selected risky part's excerpt",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      assert.match(
        handler,
        /requestRewrite && selectedContext\.type === "riskyPart"\s*\?\s*analysisContext\.riskyParts\[selectedContext\.index\]\?\.excerpt/
      );
    },
  },

  // ── Correction 5: exact starter-question set ──────────────────────────
  {
    name: "Starter questions: whatToFixFirst is always offered",
    run: () => {
      const starters = sliceBetween(
        pageSource,
        "const askClimpyStarterQuestions = useMemo",
        "function handleOpenAskClimpy()"
      );

      assert.match(starters, /id: "whatToFixFirst"/);
    },
  },
  {
    name: "Starter questions: whyHookWeak only appears when hookDecision !== \"keep\"",
    run: () => {
      const starters = sliceBetween(
        pageSource,
        "const askClimpyStarterQuestions = useMemo",
        "function handleOpenAskClimpy()"
      );

      assert.match(
        starters,
        /if \(savedAnalysisV2\.result\.hookDecision !== "keep"\) \{/
      );
      assert.match(starters, /id: "whyHookWeak"/);
    },
  },
  {
    name: "Starter questions: the two riskiest-part starters share the same riskiest index",
    run: () => {
      const starters = sliceBetween(
        pageSource,
        "const askClimpyStarterQuestions = useMemo",
        "function handleOpenAskClimpy()"
      );

      assert.match(starters, /findRiskiestRiskyPartIndex/);
      assert.match(starters, /id: "explainRiskiestPart"/);
      assert.match(starters, /id: "rewriteRiskiestPart"/);

      const explainIndexUse = starters.indexOf(
        'selectedContext: { type: "riskyPart", index: riskiestIndex }'
      );
      const rewriteIndexUse = starters.lastIndexOf(
        'selectedContext: { type: "riskyPart", index: riskiestIndex }'
      );
      assert.ok(explainIndexUse >= 0 && explainIndexUse !== rewriteIndexUse);
    },
  },
  {
    name: "Starter questions: rewriteRiskiestPart additionally requires isRiskyPartRewriteEligible",
    run: () => {
      const starters = sliceBetween(
        pageSource,
        "const askClimpyStarterQuestions = useMemo",
        "function handleOpenAskClimpy()"
      );

      assert.match(starters, /isRiskyPartRewriteEligible\(riskiestPart, activeScript\)/);
    },
  },
  {
    name: "Starter questions no longer include the removed 'biggestProblem' question",
    run: () => {
      assert.doesNotMatch(pageSource, /biggestProblem/);
      assert.doesNotMatch(messagesSource, /biggestProblem/);
    },
  },
  {
    name: "lib/messages.ts defines exactly the four approved starter questions per locale",
    run: () => {
      const requiredStarterKeys = [
        "whatToFixFirst",
        "whyHookWeak",
        "explainRiskiestPart",
        "rewriteRiskiestPart",
      ];

      for (const key of requiredStarterKeys) {
        const count = messagesSource.split(`${key}:`).length - 1;
        assert.equal(
          count,
          2,
          `Expected starterQuestions.${key} to be defined for both locales, found ${count}`
        );
      }

      const enStarterQuestion = messagesSource.match(
        /starterQuestions: \{\s*whatToFixFirst: "([^"]+)"/
      );
      assert.ok(enStarterQuestion);
      assert.equal(enStarterQuestion[1], "What should I fix first?");

      const whyHookWeakEn = messagesSource.match(/whyHookWeak: "([^"]+)"/);
      assert.ok(whyHookWeakEn);
      assert.equal(whyHookWeakEn[1], "Why is my hook weak?");

      const explainRiskiestEn = messagesSource.match(
        /explainRiskiestPart: "([^"]+)"/
      );
      assert.ok(explainRiskiestEn);
      assert.equal(explainRiskiestEn[1], "Explain the riskiest part simply.");

      const rewriteRiskiestEn = messagesSource.match(
        /rewriteRiskiestPart: "([^"]+)"/
      );
      assert.ok(rewriteRiskiestEn);
      assert.equal(
        rewriteRiskiestEn[1],
        "Rewrite the riskiest part without adding facts."
      );
    },
  },

  // ── Correction 3: approved response contract, no rewrite object ──────
  {
    name: "isValidAskClimpyResponse validates answer/action/example/cannotSafelyRewrite — never a status or rewrite field",
    run: () => {
      const guard = sliceBetween(
        pageSource,
        "function isValidAskClimpyResponse(",
        "\n}\n\nfunction parseStoredImproveScriptCache"
      );

      assert.match(guard, /payload\.cannotSafelyRewrite/);
      assert.match(guard, /payload\.action/);
      assert.match(guard, /payload\.example/);
      assert.doesNotMatch(guard, /payload\.status/);
      assert.doesNotMatch(guard, /payload\.rewrite/);
    },
  },
  {
    name: "The assistant message assembly reads action/example/cannotSafelyRewrite, never a rewrite object",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      assert.match(handler, /data\.action/);
      assert.match(handler, /data\.example/);
      assert.match(handler, /data\.cannotSafelyRewrite/);
      assert.doesNotMatch(handler, /data\.rewrite/);
      assert.doesNotMatch(handler, /data\.status/);
    },
  },
  {
    name: "The panel's local display-message type keeps originalFragment as client-only metadata, not part of the network contract",
    run: () => {
      assert.match(panelSource, /originalFragment\?: string/);
      assert.match(
        panelSource,
        /LOCAL, client-only message shape/i
      );
    },
  },
  {
    name: "The panel never renders a rewrite object — only action/example/cannotSafelyRewrite",
    run: () => {
      assert.doesNotMatch(panelSource, /message\.rewrite/);
      assert.match(panelSource, /message\.example/);
      assert.match(panelSource, /message\.cannotSafelyRewrite/);
    },
  },
  {
    name: "The route's public response type has no rewrite object and no status discriminant",
    run: () => {
      const source = readFileSync("engine/ask-climpy-validation.ts", "utf8");
      const responseType = sliceBetween(
        source,
        "export type AskClimpyResponse = {",
        "};"
      );

      assert.match(responseType, /answer: string;/);
      assert.match(responseType, /action\?: string;/);
      assert.match(responseType, /example\?: string;/);
      assert.match(responseType, /cannotSafelyRewrite: boolean;/);
      assert.doesNotMatch(responseType, /rewrite/);
      assert.doesNotMatch(responseType, /status/);
    },
  },

  // ── Panel accessibility / responsiveness (unaffected by corrections) ──
  {
    name: "ask-climpy-panel.tsx uses createPortal with a full accessible-dialog treatment",
    run: () => {
      assert.match(panelSource, /createPortal\(/);
      assert.match(panelSource, /role="dialog"/);
      assert.match(panelSource, /aria-modal="true"/);
      assert.match(panelSource, /FOCUSABLE_SELECTOR/);
      assert.match(panelSource, /document\.body\.style\.overflow = "hidden";/);
      assert.match(panelSource, /previouslyFocusedElementRef\.current\?\.focus\(\);/);
    },
  },
  {
    name: "ask-climpy-panel.tsx closes on Escape without gating on a pending ref",
    run: () => {
      const handler = sliceBetween(
        panelSource,
        "function handleKeyDown(event: KeyboardEvent) {",
        "if (event.key !== \"Tab\""
      );

      assert.match(handler, /event\.key === "Escape"/);
      assert.match(handler, /onCloseRef\.current\(\);/);
      assert.doesNotMatch(handler, /isPending/);
    },
  },
  {
    name: "Backdrop click only closes when the click target is the backdrop itself",
    run: () => {
      assert.match(
        panelSource,
        /onClick=\{\(event\) => \{\s*if \(event\.target === event\.currentTarget\) \{\s*onCloseRef\.current\(\);/
      );
    },
  },
  {
    name: "Desktop backdrop is transparent (still blocks interaction) while mobile backdrop is visibly dimmed",
    run: () => {
      assert.match(panelSource, /bg-black\/50/);
      assert.match(panelSource, /md:bg-transparent/);
    },
  },
  {
    name: "Desktop renders as a right-positioned floating panel (not a centered modal, not an edge-to-edge drawer)",
    run: () => {
      assert.match(panelSource, /md:items-stretch md:justify-end/);
      assert.doesNotMatch(
        panelSource,
        /items-center justify-center[^"]*md:items-center/,
        "The panel must never become a centered modal on desktop"
      );
    },
  },
  {
    name: "Desktop floating panel has approximately 16-20px top/right/bottom margins via padded backdrop",
    run: () => {
      assert.match(panelSource, /md:p-5/);
    },
  },
  {
    name: "Desktop floating panel width is in the approved 460-500px range with a narrow-viewport safety clamp",
    run: () => {
      const widthMatch = panelSource.match(/md:w-\[(\d+)px\]/);
      assert.ok(widthMatch, "Expected an explicit md:w-[Npx] desktop width");
      const width = Number(widthMatch[1]);
      assert.ok(width >= 460 && width <= 500, `Expected width in [460,500], got ${width}`);

      assert.match(
        panelSource,
        /md:max-w-\[calc\(100vw-40px\)\]/,
        "Expected a viewport-based max-width safety clamp matching the chosen margins"
      );
    },
  },
  {
    name: "Desktop floating panel has an explicit bounded max-height matching the chosen margins",
    run: () => {
      assert.match(panelSource, /md:max-h-\[calc\(100dvh-40px\)\]/);
    },
  },
  {
    name: "Desktop floating panel has rounded outer corners on all sides, a subtle border, and a soft shadow",
    run: () => {
      assert.match(panelSource, /md:rounded-\[20px\]/);
      assert.doesNotMatch(
        panelSource,
        /md:rounded-none|md:rounded-l-\[20px\]/,
        "Must not still be using the old left-corners-only edge-drawer rounding"
      );
      assert.match(panelSource, /border border-\[#E5E7EB\]/);
      assert.match(panelSource, /md:shadow-\[0_20px_56px_rgba\(17,24,39,0\.16\)\]/);
      assert.match(panelSource, /bg-white/);
    },
  },
  {
    name: "The interaction-blocking backdrop is preserved (transparent on desktop, dimmed on mobile) and still closes on outside click",
    run: () => {
      assert.match(panelSource, /bg-black\/50/);
      assert.match(panelSource, /md:bg-transparent/);
      assert.match(
        panelSource,
        /onClick=\{\(event\) => \{\s*if \(event\.target === event\.currentTarget\) \{\s*onCloseRef\.current\(\);/
      );
    },
  },
  {
    name: "Mobile remains a near-full-height (85dvh) bottom sheet with rounded top corners",
    run: () => {
      assert.match(panelSource, /max-h-\[85dvh\]/);
      assert.match(panelSource, /rounded-t-\[20px\]/);
      assert.match(panelSource, /w-full/);
    },
  },
  {
    name: "The composer respects the mobile safe-area bottom inset",
    run: () => {
      assert.match(panelSource, /env\(safe-area-inset-bottom\)/);
    },
  },

  // ── Label rename: "What changed" -> "What to change" ─────────────────
  {
    name: "\"What changed\" no longer appears anywhere in Ask Climpy UI or messages",
    run: () => {
      assert.doesNotMatch(messagesSource, /What changed/);
      assert.doesNotMatch(panelSource, /What changed/);
      assert.doesNotMatch(messagesSource, /Что изменилось/);
    },
  },
  {
    name: "\"What to change\" (EN) / \"Что изменить\" (RU) actionLabel is present for both locales",
    run: () => {
      const enMatch = messagesSource.match(/actionLabel: "([^"]+)"/);
      assert.ok(enMatch);
      assert.equal(enMatch[1], "What to change");

      const occurrences = messagesSource.split("actionLabel:").length - 1;
      assert.equal(occurrences, 2, "Expected actionLabel defined once per locale");
      assert.match(messagesSource, /actionLabel: "Что изменить"/);
    },
  },
  {
    name: "exampleLabel (EN \"Example\" / RU \"Пример\") is defined for both locales",
    run: () => {
      const occurrences = messagesSource.split("exampleLabel:").length - 1;
      assert.equal(occurrences, 2);
      assert.match(messagesSource, /exampleLabel: "Example"/);
      assert.match(messagesSource, /exampleLabel: "Пример"/);
    },
  },
  {
    name: "originalLabel (EN \"Original\" / RU \"Оригинал\") and suggestedRewriteLabel (EN \"Suggested rewrite\" / RU natural equivalent) are defined for both locales",
    run: () => {
      assert.equal(messagesSource.split("originalLabel:").length - 1, 2);
      assert.equal(messagesSource.split("suggestedRewriteLabel:").length - 1, 2);
      assert.match(messagesSource, /originalLabel: "Original"/);
      assert.match(messagesSource, /originalLabel: "Оригинал"/);
      assert.match(messagesSource, /suggestedRewriteLabel: "Suggested rewrite"/);
      // Natural RU equivalent, not a literal/awkward translation — accept
      // any non-empty Cyrillic string rather than pinning exact wording.
      const ruSuggestedRewrite = messagesSource.match(
        /suggestedRewriteLabel: "([^"]+)"/g
      );
      assert.ok(ruSuggestedRewrite && ruSuggestedRewrite.length === 2);
      assert.match(ruSuggestedRewrite[1], /[Ѐ-ӿ]/);
    },
  },
  {
    name: "The old rewriteLabel/rewriteOriginalLabel keys were renamed, not duplicated",
    run: () => {
      assert.doesNotMatch(messagesSource, /\brewriteLabel:/);
      assert.doesNotMatch(messagesSource, /\brewriteOriginalLabel:/);
      assert.doesNotMatch(panelSource, /askClimpy\.rewriteLabel\b/);
      assert.doesNotMatch(panelSource, /askClimpy\.rewriteOriginalLabel\b/);
    },
  },

  // ── Assistant message visual hierarchy ────────────────────────────────
  {
    name: "action section renders only when slice.action is truthy (i.e. only when message.action exists)",
    run: () => {
      const assistantComponentStart = panelSource.indexOf(
        "function AskClimpyAssistantMessage("
      );
      const assistantComponent = panelSource.slice(assistantComponentStart);
      assert.match(assistantComponent, /\{slice\.action && \(/);
      assert.match(assistantComponent, /askClimpy\.actionLabel/);
    },
  },
  {
    name: "example section renders only when slice.example is truthy (i.e. only when message.example exists)",
    run: () => {
      const assistantComponentStart = panelSource.indexOf(
        "function AskClimpyAssistantMessage("
      );
      const assistantComponent = panelSource.slice(assistantComponentStart);
      assert.match(assistantComponent, /\{slice\.example && \(/);
    },
  },
  {
    name: "A rewrite response (originalFragment present) labels its two parts Original and Suggested rewrite, not the generic Example label",
    run: () => {
      const assistantComponentStart = panelSource.indexOf(
        "function AskClimpyAssistantMessage("
      );
      const assistantComponent = panelSource.slice(assistantComponentStart);

      assert.match(assistantComponent, /const isRewriteComparison = Boolean\(message\.originalFragment\);/);
      assert.match(assistantComponent, /askClimpy\.originalLabel/);
      assert.match(
        assistantComponent,
        /isRewriteComparison \? askClimpy\.suggestedRewriteLabel : askClimpy\.exampleLabel/
      );
    },
  },
  {
    name: "The rewrite/example section never implies the change was automatically applied — no Apply button and no Improve Script CTA",
    run: () => {
      assert.doesNotMatch(panelSource, />Apply</i);
      assert.doesNotMatch(panelSource, /applyLabel|handleApply|onApply/i);
      assert.doesNotMatch(panelSource, /improve-script|handleImproveScript|improveScriptButton/i);
    },
  },
  {
    name: "Sections are visually distinct but compact — action uses a lightweight left-accent treatment, not another heavy bordered card",
    run: () => {
      const assistantComponentStart = panelSource.indexOf(
        "function AskClimpyAssistantMessage("
      );
      const assistantComponent = panelSource.slice(assistantComponentStart);
      assert.match(assistantComponent, /border-l-\[3px\] border-\[#DDD6FE\]/);
    },
  },
  {
    name: "Header, locale-mismatch notice, and composer are non-scrolling (shrink-0) regions; only the conversation area scrolls",
    run: () => {
      assert.match(
        panelSource,
        /className="flex shrink-0 items-center justify-between border-b/,
        "Header must be shrink-0 (a stable, non-scrolling flex region)"
      );
      assert.match(
        panelSource,
        /className="shrink-0 border-t border-\[#E5E7EB\] bg-\[#FAFAFA\]/,
        "Composer must be shrink-0 (a stable, non-scrolling flex region) with a distinct background"
      );
      assert.match(
        panelSource,
        /ref=\{scrollContainerRef\}\s*\n?\s*className="min-h-0 flex-1 overflow-y-auto/,
        "Conversation area must be the flex-1 (with min-h-0 to actually scroll) region"
      );
    },
  },
  {
    name: "The panel never owns its own conversation-truth state — messages/pending/capped are read only from props, never re-declared as local state",
    run: () => {
      // The panel does legitimately own small LOCAL, ephemeral state now
      // (the word-by-word reveal ticker's tickedWordCount) — that is
      // per-message animation progress, not conversation truth, and is
      // never a substitute source for messages/isPending/isCapped. What
      // must never happen is the panel re-declaring those three as its own
      // local state instead of reading the props already passed in.
      assert.doesNotMatch(panelSource, /const \[messages, set/i);
      assert.doesNotMatch(panelSource, /const \[isPending, set/i);
      assert.doesNotMatch(panelSource, /const \[isCapped, set/i);
      assert.match(panelSource, /messages: AskClimpyDisplayMessage\[\];/);
      assert.match(panelSource, /isPending: boolean;/);
      assert.match(panelSource, /isCapped: boolean;/);
    },
  },
  {
    name: "The panel does not implement streaming (no EventSource / text/event-stream / ReadableStream)",
    run: () => {
      assert.doesNotMatch(panelSource, /EventSource|text\/event-stream|ReadableStream/);
    },
  },
  {
    name: "page.tsx's Ask Climpy fetch call does not request streaming",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      assert.doesNotMatch(handler, /stream:\s*true/);
    },
  },
  {
    name: "The Ask Climpy panel z-index is above the existing legacy modals (z-50)",
    run: () => {
      assert.match(panelSource, /z-\[110\]/);
      assert.match(pageSource, /bg-black\/60 backdrop-blur-\[2px\]/);
    },
  },
  {
    name: "No new Supabase usage was introduced in the Ask Climpy panel or its wiring in page.tsx",
    run: () => {
      assert.doesNotMatch(panelSource, /supabase/i);
    },
  },
  {
    name: "No model-generated suggested-follow-up-question feature exists in the panel or its wiring",
    run: () => {
      // Narrowed to the actual anti-pattern (a model-suggested list of next
      // questions to click) — not the approved Phase 2B "contextual short
      // follow-up" behavior (the creator's OWN short follow-ups like
      // "Why?" resolved against prior history), which legitimately uses the
      // words "follow-up"/"followUp" in comments and prompt copy.
      assert.doesNotMatch(panelSource, /followUpQuestions|suggestedQuestions|<FollowUp/i);
      assert.doesNotMatch(
        pageSource.slice(pageSource.indexOf("askClimpyStarterQuestions")),
        /followUpQuestions|suggestedQuestions|<FollowUp/i
      );
    },
  },
  {
    name: "No Improve Script CTA exists inside the Ask Climpy panel",
    run: () => {
      assert.doesNotMatch(panelSource, /improve-script|handleImproveScript|improveScriptButton/i);
    },
  },
  {
    name: "No analytics/tracking call sites were introduced for Ask Climpy",
    run: () => {
      assert.doesNotMatch(panelSource, /analytics|posthog|growthbook|gtag/i);
      const askClimpySection = sliceBetween(
        pageSource,
        "const [isAskClimpyOpen",
        "async function handleSendAskClimpy("
      );
      assert.doesNotMatch(askClimpySection, /analytics|posthog|growthbook|gtag/i);
    },
  },

  // ── suggestedHook removal ─────────────────────────────────────────────
  {
    name: "page.tsx never passes suggestedHook into Ask Climpy's analysis context",
    run: () => {
      // Scoped tightly to the Ask-Climpy-specific regions only — page.tsx
      // also has legitimate, unrelated suggestedHook usage elsewhere (the
      // existing Improve Hook / Improve Script features), which must not be
      // touched by this check.
      const starterQuestionsSection = sliceBetween(
        pageSource,
        "const askClimpyStarterQuestions = useMemo",
        "function handleOpenAskClimpy()"
      );
      const sendHandlerSection = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      const responseGuardSection = sliceBetween(
        pageSource,
        "function isValidAskClimpyResponse(",
        "\n}\n\nfunction parseStoredImproveScriptCache"
      );

      assert.doesNotMatch(starterQuestionsSection, /suggestedHook/);
      assert.doesNotMatch(sendHandlerSection, /suggestedHook/);
      assert.doesNotMatch(responseGuardSection, /suggestedHook/);
    },
  },
  {
    name: "buildAskClimpyAnalysisContext call sites pass the analysis's own locale as the second argument",
    run: () => {
      const occurrences =
        pageSource.split("buildAskClimpyAnalysisContext(\n      savedAnalysisV2.result,\n      savedAnalysisLocale\n    )").length - 1;
      assert.equal(
        occurrences,
        2,
        "Expected both buildAskClimpyAnalysisContext call sites to pass savedAnalysisLocale"
      );
    },
  },
  {
    name: "engine/ask-climpy-validation.ts's AskClimpyAnalysisContext type contains no suggestedHook field",
    run: () => {
      const source = readFileSync("engine/ask-climpy-validation.ts", "utf8");
      const contextType = sliceBetween(
        source,
        "export type AskClimpyAnalysisContext = {",
        "};"
      );
      assert.doesNotMatch(contextType, /suggestedHook/);
      assert.match(contextType, /analysisLocale: AnalysisV2Locale;/);
    },
  },

  // ── Ask Climpy locale-mismatch disclosure ─────────────────────────────
  {
    name: "handleSendAskClimpy sends the current interface locale (not the analysis's own locale) as the top-level request locale",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      const bodyStart = handler.indexOf("body: JSON.stringify({");
      const bodySlice = handler.slice(bodyStart, bodyStart + 400);

      assert.match(bodySlice, /\blocale,/);
      assert.doesNotMatch(bodySlice, /locale: savedAnalysisLocale/);
    },
  },
  {
    name: "page.tsx passes hasLocaleMismatch to AskClimpyPanel (the same signal as the existing Results-page notice)",
    run: () => {
      const panelUsage = sliceBetween(
        pageSource,
        "{isAskClimpyOpen && savedAnalysisV2 && (",
        ")}"
      );
      assert.match(panelUsage, /hasLocaleMismatch=\{hasLocaleMismatch\}/);
    },
  },
  {
    name: "The existing Results-page locale-mismatch notice is untouched (still exactly two occurrences, desktop + mobile)",
    run: () => {
      const occurrences =
        pageSource.split("{results.localeMismatch.message}").length - 1;
      assert.equal(occurrences, 2);
    },
  },
  {
    name: "ask-climpy-panel.tsx accepts a hasLocaleMismatch prop and conditionally renders the localized disclosure",
    run: () => {
      assert.match(panelSource, /hasLocaleMismatch: boolean;/);
      assert.match(
        panelSource,
        /\{hasLocaleMismatch && \([\s\S]{0,200}askClimpy\.localeMismatchNotice/
      );
    },
  },
  {
    name: "The Ask Climpy disclosure is a distinct notice from the existing Results-page locale-mismatch message",
    run: () => {
      // askClimpy.localeMismatchNotice (panel) must be a separate message key
      // from results.localeMismatch.message (existing Results-page notice) —
      // confirmed by them being defined at different nesting paths in
      // lib/messages.ts.
      assert.match(messagesSource, /localeMismatch: \{\s*message:/);
      assert.match(messagesSource, /localeMismatchNotice:\s*\n?\s*"/);
    },
  },
  {
    name: "Locale-mismatch disclosure logic: shown for EN analysis under RU interface, RU analysis under EN interface, and absent when locales match",
    run: () => {
      // Mirrors the exact predicate page.tsx uses for hasLocaleMismatch
      // (savedAnalysisLocale !== locale) — proven directly against the
      // three required scenarios.
      function mismatch(analysisLocale: "en" | "ru", interfaceLocale: "en" | "ru") {
        return analysisLocale !== interfaceLocale;
      }

      assert.equal(mismatch("en", "ru"), true, "EN analysis under RU interface must show the disclosure");
      assert.equal(mismatch("ru", "en"), true, "RU analysis under EN interface must show the disclosure");
      assert.equal(mismatch("en", "en"), false, "Matching locales must not show the disclosure");
      assert.equal(mismatch("ru", "ru"), false, "Matching locales must not show the disclosure");

      assert.match(pageSource, /savedAnalysisLocale !== locale/);
    },
  },

  // ── Reveal animation wiring ───────────────────────────────────────────
  {
    name: "The assistant message is stored in full immediately on success — the reveal is a separate, later-cleared visual flag",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      const messagesPushIndex = handler.indexOf("setAskClimpyMessages((previous) => {");
      const revealSetIndex = handler.indexOf(
        "setAskClimpyRevealMessageId(assistantMessageId);"
      );

      assert.ok(messagesPushIndex >= 0);
      assert.ok(revealSetIndex > messagesPushIndex, "Reveal must be triggered only after the full message is stored");
    },
  },
  {
    name: "revealMessageId/onRevealComplete are wired into the AskClimpyPanel prop list",
    run: () => {
      const panelUsage = sliceBetween(
        pageSource,
        "{isAskClimpyOpen && savedAnalysisV2 && (",
        "/>\n      )}"
      );
      assert.match(panelUsage, /revealMessageId=\{askClimpyRevealMessageId\}/);
      assert.match(panelUsage, /onRevealComplete=\{\(\) => setAskClimpyRevealMessageId\(null\)\}/);
    },
  },
  {
    name: "Closing the panel clears askClimpyRevealMessageId (stops any active animation)",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "function handleCloseAskClimpy()",
        "async function handleSendAskClimpy("
      );
      assert.match(handler, /setAskClimpyRevealMessageId\(null\);/);
    },
  },
  {
    name: "The analysis-identity-reset effect also clears askClimpyRevealMessageId",
    run: () => {
      const effect = sliceBetween(
        pageSource,
        "askClimpyMountedRef.current = true;",
        "}, [askClimpyAnalysisIdentityKey]);"
      );
      assert.match(effect, /setAskClimpyRevealMessageId\(null\);/);
    },
  },
  {
    name: "A stale/superseded response can never trigger a reveal — the reveal trigger sits after the existing requestId staleness guard",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      const staleGuardIndex = handler.indexOf(
        "if (askClimpyRequestIdRef.current !== requestId) {"
      );
      const revealSetIndex = handler.indexOf(
        "setAskClimpyRevealMessageId(assistantMessageId);"
      );

      assert.ok(staleGuardIndex >= 0 && staleGuardIndex < revealSetIndex);
    },
  },
  {
    name: "ask-climpy-reveal.ts is a pure module with no React/DOM dependency",
    run: () => {
      assert.doesNotMatch(revealSource, /from "react"/);
      assert.doesNotMatch(revealSource, /window\.(matchMedia|setInterval|clearInterval|setTimeout)/);
      assert.doesNotMatch(revealSource, /"use client"/);
    },
  },
  {
    name: "The panel builds each assistant message's reveal plan from the reveal module and passes isRevealing per message.id",
    run: () => {
      assert.match(panelSource, /buildAskClimpyRevealPlan/);
      assert.match(panelSource, /sliceAskClimpyRevealPlan/);
      assert.match(panelSource, /isRevealing=\{message\.id === revealMessageId\}/);
    },
  },
  {
    name: "The reveal ticker respects prefers-reduced-motion and shows the complete message immediately when enabled",
    run: () => {
      assert.match(
        panelSource,
        /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/
      );
      const hook = sliceBetween(
        panelSource,
        "function useAskClimpyRevealedWordCount(",
        "\nfunction AskClimpyMessageBubble"
      );
      assert.match(hook, /prefersReducedMotion\(\)/);
      assert.match(hook, /onCompleteRef\.current\(\)/);
    },
  },
  {
    name: "The reveal interval is cleared in the effect's cleanup function (stops safely on unmount/close)",
    run: () => {
      const hook = sliceBetween(
        panelSource,
        "function useAskClimpyRevealedWordCount(",
        "\nfunction AskClimpyMessageBubble"
      );
      assert.match(hook, /window\.setInterval\(/);
      assert.match(
        hook,
        /return \(\) => \{\s*window\.clearInterval\(intervalId\);\s*\};/
      );
    },
  },
  {
    name: "Reopening never replays an animation — a settled/non-revealing message renders plan.totalWords directly, not synchronized via a reset effect",
    run: () => {
      const hook = sliceBetween(
        panelSource,
        "function useAskClimpyRevealedWordCount(",
        "\nfunction AskClimpyMessageBubble"
      );
      assert.match(hook, /return shouldAnimate \? tickedWordCount : plan\.totalWords;/);
    },
  },
  {
    name: "The visible animated text is aria-hidden only WHILE revealing — once complete, the same visible DOM text becomes the accessible content (no second sr-only copy inside AskClimpyAssistantMessage)",
    run: () => {
      const assistantComponentStart = panelSource.indexOf(
        "function AskClimpyAssistantMessage("
      );
      assert.ok(assistantComponentStart >= 0);
      const assistantComponent = panelSource.slice(assistantComponentStart);

      assert.match(
        assistantComponent,
        /const isRevealComplete = revealedWordCount >= plan\.totalWords;/
      );
      assert.match(
        assistantComponent,
        /const hiddenWhileRevealing = isRevealComplete \? undefined : true;/
      );
      assert.match(assistantComponent, /aria-hidden=\{hiddenWhileRevealing\}/);
      // No more per-message duplicate: the old fullAnnouncement/sr-only
      // span inside this component is gone — see buildAskClimpyFullAnnouncement
      // and the panel's single shared liveAnnouncement region instead.
      assert.doesNotMatch(assistantComponent, /fullAnnouncement/);
      assert.doesNotMatch(assistantComponent, /role="status" className="sr-only"/);
    },
  },
  {
    name: "Question-cap counting is unaffected by the reveal animation — it still counts stored assistant messages, not revealed words",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      assert.match(
        handler,
        /next\.filter\(\s*\(message\) => message\.role === "assistant"\s*\)\.length/
      );
      assert.doesNotMatch(handler, /revealedWordCount/);
    },
  },
  {
    name: "The API remains non-streaming and AskClimpyResponse's shape is unchanged after the reliability fix",
    run: () => {
      const routeSource = readFileSync("app/api/ask-climpy/route.ts", "utf8");
      const chatCompletionCall = sliceBetween(
        routeSource,
        "openai.chat.completions.create({",
        "});"
      );
      // Deliberately narrowed to the actual OpenAI call — the request-body
      // reader elsewhere in this file legitimately uses TextDecoder's own
      // unrelated `{ stream: true }` option for chunked byte decoding.
      assert.doesNotMatch(chatCompletionCall, /\bstream:\s*true/);
      assert.doesNotMatch(routeSource, /EventSource|text\/event-stream/);

      const validationSource = readFileSync(
        "engine/ask-climpy-validation.ts",
        "utf8"
      );
      const responseType = sliceBetween(
        validationSource,
        "export type AskClimpyResponse = {",
        "};"
      );
      assert.match(responseType, /answer: string;/);
      assert.match(responseType, /action\?: string;/);
      assert.match(responseType, /example\?: string;/);
      assert.match(responseType, /cannotSafelyRewrite: boolean;/);
    },
  },
  // ── Localization boundary: status-mapped, never-raw client errors ────
  {
    name: "The client never renders the API's raw `reason` string — errors are mapped purely from HTTP status to localized message keys",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      assert.doesNotMatch(
        handler,
        /data\.reason|payload\.reason/,
        "The API error `reason` field must never be read for display"
      );
      assert.match(handler, /response\.status === 429/);
      assert.match(
        handler,
        /response\.status === 400 \|\|\s*\n?\s*response\.status === 413 \|\|\s*\n?\s*response\.status === 415/
      );
      assert.match(handler, /askClimpyMessagesText\.errorRequestInvalid/);
      assert.match(handler, /askClimpyMessagesText\.errorRateLimited/);
      assert.match(handler, /askClimpyMessagesText\.errorGeneric/);
    },
  },
  {
    name: "The network-error catch block (timeout/offline/unexpected) also uses the localized generic message, never a raw error",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      const catchBlock = sliceBetween(handler, "} catch (error) {", "} finally {");
      assert.match(catchBlock, /askClimpyMessagesText\.errorGeneric/);
      assert.doesNotMatch(catchBlock, /error\.message/);
    },
  },
  {
    name: "errorRequestInvalid (400/413/415) is defined as a distinct key from errorGeneric and errorRateLimited, for both locales",
    run: () => {
      assert.equal(messagesSource.split("errorRequestInvalid:").length - 1, 2);
      assert.match(messagesSource, /errorRequestInvalid:\s*\n?\s*"[^"]*wasn't right[^"]*"/);
      assert.match(messagesSource, /errorRequestInvalid:\s*\n?\s*"С этим запросом что-то не так/);
    },
  },
  {
    name: "The Russian generic error is natural (\"Climpy не смог ответить. Попробуйте ещё раз.\"), not a literal translation",
    run: () => {
      assert.match(messagesSource, /errorGeneric: "Climpy не смог ответить\. Попробуйте ещё раз\."/);
    },
  },

  // ── Corrected locale-mismatch disclosure copy (Phase 3) ───────────────
  {
    name: "The Ask Climpy disclosure states Climpy WILL answer in the interface language — never that answers \"may\" use the original language",
    run: () => {
      assert.doesNotMatch(messagesSource, /Answers may switch to English/);
      assert.doesNotMatch(messagesSource, /Ответы могут быть на английском/);
    },
  },
  {
    name: "EN interface disclosure names Russian as the analysis's language and English as what Climpy will answer in",
    run: () => {
      assert.match(
        messagesSource,
        /localeMismatchNotice:\s*\n?\s*"This analysis was created in Russian\. Climpy will explain it in English\."/
      );
    },
  },
  {
    name: "RU interface disclosure names English as the analysis's language and Russian as what Climpy will answer in",
    run: () => {
      assert.match(
        messagesSource,
        /localeMismatchNotice:\s*\n?\s*"Этот анализ создан на английском\. Climpy объяснит его на русском\."/
      );
    },
  },
  {
    name: "The disclosure is driven by savedAnalysisLocale !== locale — absent when locales match (matching-locale case already covered above), present for both mismatch directions",
    run: () => {
      // hasLocaleMismatch (already proven above to gate the disclosure) is
      // symmetric — it is true for EN-under-RU and RU-under-EN alike, and
      // false only when they match. This re-confirms the predicate is a
      // plain equality check with no directional special-casing that could
      // silently only handle one of the two mismatch directions.
      assert.match(pageSource, /const hasLocaleMismatch =/);
      const mismatchBlock = sliceBetween(
        pageSource,
        "const hasLocaleMismatch =",
        "const saveTitle = useMemo"
      );
      assert.match(mismatchBlock, /savedAnalysisLocale !== locale/);
    },
  },
  {
    name: "No effect resets or mutates askClimpyMessages when only `locale` changes — prior turns keep their original language after switching the interface locale",
    run: () => {
      assert.doesNotMatch(pageSource, /\[locale\]/);
    },
  },
  {
    name: "handleSendAskClimpy always sends the live `locale` value (read fresh at send time, not memoized from an earlier turn) — new requests use the current interface locale",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      const bodyStart = handler.indexOf("body: JSON.stringify({");
      const bodySlice = handler.slice(bodyStart, bodyStart + 400);
      assert.match(bodySlice, /\blocale,/);
    },
  },
  {
    name: "The existing Results-page locale-mismatch notice does not contain the same factual contradiction and was left untouched",
    run: () => {
      // \"Run a new analysis to receive AI explanations in <lang>\" is a
      // claim about the STATIC analysis prose (mainTakeaway/hookAssessment/
      // etc, which the approved behavior says legitimately stays in its
      // original language until re-run) — distinct from Ask Climpy's own
      // disclosure, which is about NEW conversational answers. It does not
      // say answers "may" happen in the original language, so it is not the
      // same contradiction and must remain unchanged.
      assert.match(
        messagesSource,
        /This analysis was generated in Russian\. Run a new analysis to receive AI explanations in English\./
      );
      assert.match(
        messagesSource,
        /Этот анализ был создан на английском\. Запустите новый анализ, чтобы получить объяснения ИИ на русском\./
      );
    },
  },

  {
    name: "The route now retries once for a malformed/invalid model response, not just transient upstream failures",
    run: () => {
      const routeSource = readFileSync("app/api/ask-climpy/route.ts", "utf8");
      const runFn = sliceBetween(
        routeSource,
        "export async function runAskClimpy(",
        "\nexport async function POST("
      );

      assert.match(runFn, /for \(let attempt = 0; attempt < ASK_CLIMPY_MAX_ATTEMPTS/);
      assert.match(runFn, /const isLastAttempt = attempt === ASK_CLIMPY_MAX_ATTEMPTS - 1;/);
      // Both the parse-failure and validation-failure branches must consult
      // isLastAttempt (i.e. retry) rather than returning unconditionally.
      const parsedNullBlock = sliceBetween(runFn, "if (parsed === null) {", "const resultValidation");
      assert.match(parsedNullBlock, /isLastAttempt/);
      const validationFailBlock = runFn.slice(runFn.indexOf("if (!resultValidation.ok) {"));
      assert.match(validationFailBlock, /isLastAttempt/);
    },
  },

  // ── Phase 2A: bounded local conversational intents ───────────────────
  {
    name: "handleSendAskClimpy checks classifyAskClimpyLocalIntent BEFORE the error-reference check and before the network call",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );

      const localIntentIndex = handler.indexOf(
        "const localIntent = classifyAskClimpyLocalIntent(question);"
      );
      const errorReferenceIndex = handler.indexOf(
        "isAskClimpyErrorReferencePhrase(question)"
      );
      const sendIndex = handler.indexOf("await sendAskClimpyRequest(");

      assert.ok(localIntentIndex >= 0);
      assert.ok(errorReferenceIndex > localIntentIndex);
      assert.ok(sendIndex > errorReferenceIndex);
    },
  },
  {
    name: "A local-intent match pushes the user message plus a \"local\" reply and returns — never reaching sendAskClimpyRequest",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );

      const localIntentBlock = sliceBetween(
        handler,
        "if (localIntent) {",
        "// Phase 3"
      );

      assert.match(localIntentBlock, /role: "user", content: question/);
      assert.match(localIntentBlock, /role: "local"/);
      assert.match(
        localIntentBlock,
        /content: results\.askClimpy\.localIntents\[localIntent\]/
      );
      assert.match(localIntentBlock, /return;/);
      assert.doesNotMatch(localIntentBlock, /fetch\(|sendAskClimpyRequest/);
    },
  },
  {
    name: "localIntents replies never call fetch — classifyAskClimpyLocalIntent is imported from the pure helper module, not re-implemented inline",
    run: () => {
      assert.match(
        pageSource,
        /import\s*\{\s*\n?\s*classifyAskClimpyLocalIntent,\s*\n?\s*classifyAskClimpyRewriteIntent,\s*\n?\s*isAskClimpyErrorReferencePhrase,?\s*\n?\s*\}\s*from\s*"\.\/ask-climpy-local-intents"/
      );
    },
  },

  // ── Phase 3: after-error short reference vs. successful-answer follow-up ──
  {
    name: "The error-reference local reply ONLY fires when the immediately preceding message has role \"error\" — never after a successful answer",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );

      assert.match(
        handler,
        /const lastMessage = askClimpyMessages\[askClimpyMessages\.length - 1\];/
      );
      assert.match(
        handler,
        /lastMessage\?\.role === "error" &&\s*\n\s*isAskClimpyErrorReferencePhrase\(question\)/
      );
    },
  },
  {
    name: "The post-error local explanation carries the failed request's retryable metadata forward, and uses errorTechnicalExplanation copy",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );
      const errorReferenceBlock = sliceBetween(
        handler,
        'isAskClimpyErrorReferencePhrase(question)\n      ) {',
        "await sendAskClimpyRequest("
      );

      assert.match(
        errorReferenceBlock,
        /content: results\.askClimpy\.errorTechnicalExplanation/
      );
      assert.match(errorReferenceBlock, /retryable: lastMessage\.retryable/);
      assert.match(errorReferenceBlock, /return;/);
    },
  },
  {
    name: "Any question that is not a local intent and not an after-error reference falls through to sendAskClimpyRequest with the ordinary user bubble (covers a successful-answer follow-up like \"Why?\")",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );

      // The final fallthrough block (after both early-return branches)
      // unconditionally pushes the user message and calls
      // sendAskClimpyRequest — this is the path a contextual follow-up
      // ("Why?" after a real, successful assistant answer) takes, since
      // lastMessage.role would be "assistant", not "error".
      const fallthroughStart = handler.lastIndexOf(
        'setAskClimpyMessages((previous) => [\n        ...previous,\n        { id: userMessageId, role: "user", content: question },\n      ]);'
      );
      assert.ok(fallthroughStart >= 0);
      const fallthrough = handler.slice(fallthroughStart);
      assert.match(fallthrough, /await sendAskClimpyRequest\(\s*question,/);
    },
  },

  // ── Phase 5: prompt permits short follow-ups against prior history ───
  {
    name: "buildAskClimpySystemPrompt explicitly permits short follow-ups (\"Why?\", \"Explain\", etc.) to resolve against the immediately preceding HISTORY turn",
    run: () => {
      const promptSource = readFileSync("engine/ask-climpy-prompt.ts", "utf8");
      assert.match(promptSource, /SHORT FOLLOW-UP QUESTIONS/);
      assert.match(
        promptSource,
        /Resolve "that", "it", "why", and similar bare references against the most recent Climpy turn in HISTORY/
      );
      assert.match(
        promptSource,
        /Do not reject a short follow-up merely because it does not repeat the original subject by name\./
      );
      // Still refuses unrelated general-knowledge requests and keeps every
      // other rule unchanged.
      assert.match(
        promptSource,
        /still refuse any request unrelated to this script\/analysis/
      );
    },
  },
  {
    name: "buildAskClimpySystemPrompt gives a safe, non-hallucinating instruction for a bare reference with no prior HISTORY",
    run: () => {
      const promptSource = readFileSync("engine/ask-climpy-prompt.ts", "utf8");
      assert.match(
        promptSource,
        /do not guess what it refers to — briefly ask, in your "answer", what part of the analysis the creator means/
      );
    },
  },

  // ── Phase 4: compact error block + Retry wiring ───────────────────────
  {
    name: "page.tsx passes onRetry={handleRetryAskClimpy} to AskClimpyPanel",
    run: () => {
      const panelUsage = sliceBetween(
        pageSource,
        "{isAskClimpyOpen && savedAnalysisV2 && (",
        "/>\n      )}"
      );
      assert.match(panelUsage, /onRetry=\{handleRetryAskClimpy\}/);
    },
  },
  {
    name: "handleRetryAskClimpy never pushes a new user-role message — it only resends via sendAskClimpyRequest",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleRetryAskClimpy(",
        "  // Performs the actual insert."
      );

      assert.doesNotMatch(handler, /role: "user"/);
      assert.match(handler, /await sendAskClimpyRequest\(/);
      assert.match(
        handler,
        /if \(\s*\n\s*!savedAnalysisV2 \|\|\s*\n\s*isAskClimpyPending \|\|\s*\n\s*isAskClimpyCapped \|\|/
      );
    },
  },
  {
    name: "sendAskClimpyRequest attaches retryable metadata (question/selectedContext/requestRewrite/rewriteFragment) to BOTH the response-guard error push and the catch-block error push",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );

      assert.match(
        handler,
        /const retryable: AskClimpyRetryableRequest = \{\s*question,\s*selectedContext,\s*requestRewrite,/
      );

      const occurrences = handler.split("retryable,").length - 1;
      assert.ok(
        occurrences >= 2,
        `Expected retryable attached at both error push sites, found ${occurrences}`
      );
    },
  },
  {
    name: "ask-climpy-panel.tsx's error and local bubbles render a Retry button only when message.retryable is present, calling onRetry",
    run: () => {
      const errorBubble = sliceBetween(
        panelSource,
        'if (message.role === "error") {',
        'if (message.role === "local") {'
      );
      assert.match(errorBubble, /message\.retryable &&/);
      assert.match(errorBubble, /onClick=\{\(\) => onRetry\(message\.retryable!\)\}/);
      assert.match(errorBubble, /askClimpy\.retryLabel/);

      const localBubble = sliceBetween(
        panelSource,
        "function AskClimpyLocalMessage(",
        "\nfunction AskClimpyAssistantMessage"
      );
      assert.match(localBubble, /message\.retryable &&/);
      assert.match(localBubble, /onClick=\{\(\) => onRetry\(message\.retryable!\)\}/);
    },
  },
  {
    name: "Retry is disabled while pending or capped (isPending || isCapped), not just isPending",
    run: () => {
      assert.match(
        panelSource,
        /isRetryDisabled=\{isPending \|\| isCapped\}/
      );
    },
  },
  {
    name: "AskClimpyDisplayMessage's error/local variants carry retryable as AskClimpyRetryableRequest, kept on the message itself (not a separate top-level React state)",
    run: () => {
      assert.match(panelSource, /retryable\?: AskClimpyRetryableRequest;/);
      // No separate useState for retry metadata in page.tsx — retry state
      // is invalidated automatically by the existing askClimpyMessages
      // reset (see the analysis-identity-reset effect), never a second
      // piece of state that would need its own invalidation logic.
      assert.doesNotMatch(pageSource, /useState.*[Rr]etryable/);
    },
  },
  {
    name: "The compact error block still never exposes the raw server reason/status — only the localized errorText already mapped from HTTP status",
    run: () => {
      const errorBubble = sliceBetween(
        panelSource,
        'if (message.role === "error") {',
        'if (message.role === "local") {'
      );
      assert.doesNotMatch(errorBubble, /reason|status/i);
    },
  },

  // ── Local intents / cap / persistence regression ──────────────────────
  {
    name: "Only role === \"assistant\" messages count toward the six-answer cap — local and error messages are structurally excluded",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      assert.match(
        handler,
        /next\.filter\(\s*\(message\) => message\.role === "assistant"\s*\)\.length/
      );
      assert.doesNotMatch(handler, /message\.role === "local"/);
    },
  },
  {
    name: "The model-facing history array only ever includes \"user\"/\"assistant\" roles — \"local\" and \"error\" messages are excluded, matching the requirement that failed requests and local replies never become model history",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      assert.match(
        handler,
        /\.filter\(\s*\(message\) => message\.role === "user" \|\| message\.role === "assistant"\s*\)/
      );
    },
  },
  {
    name: "lib/messages.ts defines localIntents (greeting/thanks/acknowledgement/farewell/capability), errorTechnicalExplanation, and retryLabel for both locales with the approved copy",
    run: () => {
      for (const key of [
        "greeting",
        "thanks",
        "acknowledgement",
        "farewell",
        "capability",
      ]) {
        const count = messagesSource.split(`${key}:`).length - 1;
        assert.ok(count >= 2, `Expected localIntents.${key} for both locales, found ${count}`);
      }

      assert.equal(messagesSource.split("errorTechnicalExplanation:").length - 1, 2);

      // "retryLabel:" alone is not scoped to askClimpy (myAnalyses.error
      // also has an unrelated retryLabel key) — anchor to the surrounding
      // askClimpy copy instead of a bare occurrence count.
      assert.match(messagesSource, /errorRequestInvalid:[\s\S]{0,1600}?retryLabel: "Try again"/);
      assert.match(messagesSource, /errorRequestInvalid:[\s\S]{0,1600}?retryLabel: "Повторить"/);
      assert.match(
        messagesSource,
        /errorTechnicalExplanation:\s*\n?\s*"That request failed because Climpy couldn't get a valid response\. It wasn't caused by the way you asked\. Try the request again\."/
      );
      assert.match(
        messagesSource,
        /errorTechnicalExplanation:\s*\n?\s*"Запрос завершился технической ошибкой ответа\. Это произошло не из-за формулировки вашего вопроса\. Попробуйте отправить запрос ещё раз\."/
      );
    },
  },
  {
    name: "No Supabase, analytics, or persistence was introduced by the local-intents module",
    run: () => {
      const localIntentsSource = readFileSync(
        "app/results/ask-climpy-local-intents.ts",
        "utf8"
      );
      assert.doesNotMatch(localIntentsSource, /supabase|analytics|posthog|growthbook|fetch\(/i);
    },
  },
  {
    name: "The analysis-identity-reset effect still resets askClimpyMessages to [] and closes the panel — retry metadata (embedded per-message) is invalidated for free, with no separate reset needed",
    run: () => {
      const effect = sliceBetween(
        pageSource,
        "askClimpyMountedRef.current = true;",
        "}, [askClimpyAnalysisIdentityKey]);"
      );
      assert.match(effect, /setAskClimpyMessages\(\[\]\);/);
      assert.match(effect, /setIsAskClimpyOpen\(false\);/);
    },
  },

  // ── Animation consistency correction: local replies use the same
  // word-reveal system as model answers, at a distinct faster speed ────
  {
    name: "The panel renders \"local\" messages via a dedicated AskClimpyLocalMessage component that reuses buildAskClimpyRevealPlan/sliceAskClimpyRevealPlan at the \"local\" speed — not a second animation implementation",
    run: () => {
      assert.match(
        panelSource,
        /if \(message\.role === "local"\) \{\s*\n\s*return \(\s*\n\s*<AskClimpyLocalMessage/
      );

      const localComponent = sliceBetween(
        panelSource,
        "function AskClimpyLocalMessage(",
        "\nfunction AskClimpyAssistantMessage"
      );
      assert.match(
        localComponent,
        /buildAskClimpyRevealPlan\(\{ answer: message\.content \}, "local"\)/
      );
      assert.match(localComponent, /useAskClimpyRevealedWordCount\(/);
      assert.match(localComponent, /sliceAskClimpyRevealPlan\(/);
    },
  },
  {
    name: "AskClimpyAssistantMessage (model answers) still calls buildAskClimpyRevealPlan with no explicit speed argument — the default \"model\" window is unchanged",
    run: () => {
      const assistantComponentStart = panelSource.indexOf(
        "function AskClimpyAssistantMessage("
      );
      assert.ok(assistantComponentStart >= 0);
      const assistantComponent = panelSource.slice(assistantComponentStart);
      const planCallStart = assistantComponent.indexOf("buildAskClimpyRevealPlan({");
      assert.ok(planCallStart >= 0);
      const planCall = assistantComponent.slice(planCallStart, planCallStart + 200);
      assert.doesNotMatch(
        planCall,
        /"local"|"model"/,
        "Model-answer reveal must keep relying on the default (unchanged) speed, not pass an explicit argument"
      );
    },
  },
  {
    name: "handleSendAskClimpy triggers the reveal for all three local-reply branches (courtesy intent, post-error explanation, and no-eligible-rewrite explanation) via setAskClimpyRevealMessageId",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );
      const occurrences =
        handler.split("setAskClimpyRevealMessageId(localMessageId);").length - 1;
      assert.equal(
        occurrences,
        3,
        "Expected the reveal trigger in the local-intent branch, the post-error-reference branch, and the no-eligible-rewrite branch"
      );
    },
  },
  {
    name: "A local reply's reveal trigger is set AFTER the message is already fully stored (never before) — same ordering guarantee as a model answer",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );
      const localIntentBlock = sliceBetween(handler, "if (localIntent) {", "// Phase 3");
      const messagesPushIndex = localIntentBlock.indexOf("setAskClimpyMessages((previous) => [");
      const revealSetIndex = localIntentBlock.indexOf(
        "setAskClimpyRevealMessageId(localMessageId);"
      );
      assert.ok(messagesPushIndex >= 0 && revealSetIndex > messagesPushIndex);
    },
  },
  {
    name: "Neither local-reply branch ever calls sendAskClimpyRequest or fetch — local replies never make an API request",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );
      const localIntentBlock = sliceBetween(handler, "if (localIntent) {", "// Phase 3");
      const errorReferenceBlock = sliceBetween(
        handler,
        'isAskClimpyErrorReferencePhrase(question)\n      ) {',
        "setAskClimpyMessages((previous) => [\n        ...previous,\n        { id: userMessageId, role: \"user\", content: question },\n      ]);"
      );

      assert.doesNotMatch(localIntentBlock, /sendAskClimpyRequest|fetch\(/);
      assert.doesNotMatch(errorReferenceBlock, /sendAskClimpyRequest|fetch\(/);
    },
  },
  {
    name: "Error bubbles are never word-animated — the error branch never references isRevealing, a reveal plan, or the reveal ticker hook",
    run: () => {
      const errorBubble = sliceBetween(
        panelSource,
        'if (message.role === "error") {',
        'if (message.role === "local") {'
      );
      assert.doesNotMatch(
        errorBubble,
        /isRevealing|buildAskClimpyRevealPlan|useAskClimpyRevealedWordCount|sliceAskClimpyRevealPlan/
      );
    },
  },
  {
    name: "The user-message bubble is never word-animated — it renders message.content directly with no reveal plan",
    run: () => {
      const userBubble = sliceBetween(
        panelSource,
        'if (message.role === "user") {',
        'if (message.role === "error") {'
      );
      assert.doesNotMatch(
        userBubble,
        /isRevealing|buildAskClimpyRevealPlan|useAskClimpyRevealedWordCount/
      );
      assert.match(userBubble, /\{message\.content\}/);
    },
  },
  {
    name: "Retry buttons (error and local) render the static retryLabel directly — never routed through a reveal slice",
    run: () => {
      const errorBubble = sliceBetween(
        panelSource,
        'if (message.role === "error") {',
        'if (message.role === "local") {'
      );
      const localComponent = sliceBetween(
        panelSource,
        "function AskClimpyLocalMessage(",
        "\nfunction AskClimpyAssistantMessage"
      );

      for (const bubble of [errorBubble, localComponent]) {
        assert.match(bubble, />\s*\{askClimpy\.retryLabel\}\s*</);
        assert.doesNotMatch(bubble, /slice\.retryLabel|slice\.retry/);
      }
    },
  },
  {
    name: "AskClimpyLocalMessage's visible text is aria-hidden only WHILE revealing, and becomes the accessible content once complete — no per-message sr-only duplicate of message.content",
    run: () => {
      const localComponent = sliceBetween(
        panelSource,
        "function AskClimpyLocalMessage(",
        "\nfunction AskClimpyAssistantMessage"
      );
      assert.match(
        localComponent,
        /const isRevealComplete = revealedWordCount >= plan\.totalWords;/
      );
      assert.match(
        localComponent,
        /<p aria-hidden=\{isRevealComplete \? undefined : true\}>\{slice\.answer\}<\/p>/
      );
      assert.doesNotMatch(localComponent, /role="status" className="sr-only"/);
      assert.doesNotMatch(localComponent, />\s*\{message\.content\}\s*<\/span>/);
    },
  },
  {
    name: "AskClimpyLocalMessage reuses the exact same reveal ticker hook as model answers (useAskClimpyRevealedWordCount) — reduced-motion and one-shot-ticker behavior are inherited for free, not reimplemented",
    run: () => {
      const localComponent = sliceBetween(
        panelSource,
        "function AskClimpyLocalMessage(",
        "\nfunction AskClimpyAssistantMessage"
      );
      const assistantComponentStart = panelSource.indexOf(
        "function AskClimpyAssistantMessage("
      );
      assert.ok(assistantComponentStart >= 0);
      const assistantComponent = panelSource.slice(assistantComponentStart);

      assert.match(localComponent, /useAskClimpyRevealedWordCount\(\s*plan,\s*isRevealing,\s*onRevealComplete\s*\)/);
      assert.match(assistantComponent, /useAskClimpyRevealedWordCount\(/);

      // Only one hook definition exists — both components call the same
      // function, proving there is no second/duplicate animation hook.
      const hookDefinitionCount =
        panelSource.split("function useAskClimpyRevealedWordCount(").length - 1;
      assert.equal(hookDefinitionCount, 1);
    },
  },
  {
    name: "Closing the panel during ANY reveal (model or local) clears revealMessageId the same way — handleCloseAskClimpy does not special-case message role",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "function handleCloseAskClimpy()",
        "async function sendAskClimpyRequest("
      );
      assert.match(handler, /setAskClimpyRevealMessageId\(null\);/);
      assert.doesNotMatch(handler, /role === "local"|role === "assistant"/);
    },
  },
  {
    name: "The analysis-identity-reset effect clears revealMessageId unconditionally (covers an in-progress local reveal exactly like a model-answer reveal)",
    run: () => {
      const effect = sliceBetween(
        pageSource,
        "askClimpyMountedRef.current = true;",
        "}, [askClimpyAnalysisIdentityKey]);"
      );
      assert.match(effect, /setAskClimpyRevealMessageId\(null\);/);
      assert.doesNotMatch(effect, /role === "local"|role === "assistant"/);
    },
  },
  {
    name: "Reopening never replays a settled local reply either — a non-revealing message renders plan.totalWords directly regardless of role (same shared hook return statement)",
    run: () => {
      const hook = sliceBetween(
        panelSource,
        "function useAskClimpyRevealedWordCount(",
        "\nfunction AskClimpyMessageBubble"
      );
      assert.match(hook, /return shouldAnimate \? tickedWordCount : plan\.totalWords;/);
      assert.doesNotMatch(hook, /role/);
    },
  },
  {
    name: "Only one message can ever be the active reveal target at a time — revealMessageId is a single id, and isRevealing is computed identically (message.id === revealMessageId) for both local and assistant bubbles",
    run: () => {
      assert.match(
        pageSource,
        /const \[askClimpyRevealMessageId, setAskClimpyRevealMessageId\] = useState<\s*\n?\s*string \| null\s*\n?\s*>\(null\);/
      );
      const messagesMapBlock = sliceBetween(
        panelSource,
        "{messages.map((message) => (",
        "))}"
      );
      const occurrences =
        messagesMapBlock.split('isRevealing={message.id === revealMessageId}').length - 1;
      assert.equal(occurrences, 1, "Expected a single shared isRevealing prop passed once per bubble, not per-role");
    },
  },

  // ── Duplicate-error-block regression: one user-triggered submission
  // followed by a failed Retry must never produce two visible error
  // blocks. Root cause: handleRetryAskClimpy minted a brand-new message id
  // for every retry attempt, so a repeated failure appended a second,
  // separate error message instead of updating the original one in place.
  {
    name: "There is exactly one fetch(\"/api/ask-climpy\", ...) call site — both handleSendAskClimpy and handleRetryAskClimpy funnel through the SAME sendAskClimpyRequest, never a second independent fetch",
    run: () => {
      const occurrences =
        pageSource.split('fetch("/api/ask-climpy"').length - 1;
      assert.equal(occurrences, 1, "Expected exactly one fetch call site for the Ask Climpy endpoint");
    },
  },
  {
    name: "The composer is NOT wrapped in a <form> — Enter (via onKeyDown) and the Send button's onClick both call the same submitQuestion(), never a native form submit plus a click handler firing independently",
    run: () => {
      assert.doesNotMatch(panelSource, /<form/i);
      const composer = sliceBetween(
        panelSource,
        "function submitQuestion() {",
        "return createPortal("
      );
      assert.match(composer, /if \(trimmed\.length === 0 \|\| isPending \|\| isCapped\) return;/);
    },
  },
  {
    name: "handleSendAskClimpy and handleRetryAskClimpy share a single synchronous re-entrancy guard (askClimpyIsSubmittingRef) that a state-based check alone cannot close in the same tick",
    run: () => {
      assert.match(
        pageSource,
        /const askClimpyIsSubmittingRef = useRef\(false\);/
      );

      const sendHandler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );
      assert.match(sendHandler, /askClimpyIsSubmittingRef\.current/);
      assert.match(sendHandler, /askClimpyIsSubmittingRef\.current = true;/);
      assert.match(sendHandler, /askClimpyIsSubmittingRef\.current = false;/);
      // Guarded and set BEFORE any await — the whole body runs inside a
      // try/finally so the flag is always released regardless of which
      // branch (local intent / error reference / network) is taken.
      assert.match(sendHandler, /try \{/);
      assert.match(sendHandler, /\} finally \{\s*\n\s*askClimpyIsSubmittingRef\.current = false;/);

      const retryHandler = sliceBetween(
        pageSource,
        "async function handleRetryAskClimpy(",
        "  // Performs the actual insert."
      );
      assert.match(retryHandler, /askClimpyIsSubmittingRef\.current/);
      assert.match(retryHandler, /askClimpyIsSubmittingRef\.current = true;/);
      assert.match(retryHandler, /\} finally \{\s*\n\s*askClimpyIsSubmittingRef\.current = false;/);
    },
  },
  {
    name: "upsertAskClimpyMessage replaces an existing message with the same id in place, or appends when the id is new — the core one-error-block invariant",
    run: () => {
      const helper = sliceBetween(
        pageSource,
        "function upsertAskClimpyMessage(",
        "\nfunction parseStoredImproveScriptCache"
      );
      assert.match(helper, /existingIndex === -1/);
      assert.match(helper, /return \[\.\.\.previous, message\];/);
      assert.match(helper, /next\[existingIndex\] = message;/);
    },
  },
  {
    name: "sendAskClimpyRequest's non-ok branch upserts (never blindly appends) the error message, and returns immediately — it can never also reach the catch block for the same failure",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      const nonOkBranch = sliceBetween(
        handler,
        'if (!response.ok || !isValidAskClimpyResponse(data)) {',
        "// data: AskClimpyResponse"
      );
      assert.match(nonOkBranch, /upsertAskClimpyMessage\(/);
      assert.doesNotMatch(nonOkBranch, /\[\s*\n?\s*\.\.\.previous,\s*\n?\s*\{\s*\n?\s*id: `\$\{messageIdRoot\}-error`/);
      // The branch ends in an unconditional return — JS/TS control flow
      // guarantees a try block's own catch clause is never entered once a
      // return inside try has already executed, so the non-ok path and the
      // network-exception (catch) path are structurally mutually exclusive
      // for one single fetch.
      const returnIndex = nonOkBranch.lastIndexOf("return;");
      assert.ok(returnIndex > nonOkBranch.indexOf("upsertAskClimpyMessage("));
    },
  },
  {
    name: "sendAskClimpyRequest's catch block ALSO upserts by messageIdRoot (never a blind append) — a thrown network error updates the same one error message a retry of the same turn would target",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      const catchBlock = sliceBetween(handler, "} catch (error) {", "} finally {");
      assert.match(catchBlock, /upsertAskClimpyMessage\(/);
      assert.match(catchBlock, /id: `\$\{messageIdRoot\}-error`/);
    },
  },
  {
    name: "Aborted or stale (superseded requestId) responses still return before ever reaching an upsert/error push — no error block for a cancelled/replaced request",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      const catchBlock = sliceBetween(handler, "} catch (error) {", "} finally {");
      const abortGuardIndex = catchBlock.indexOf(
        'if (error instanceof DOMException && error.name === "AbortError") {'
      );
      const staleGuardIndex = catchBlock.indexOf(
        "if (askClimpyRequestIdRef.current !== requestId) {"
      );
      const upsertIndex = catchBlock.indexOf("upsertAskClimpyMessage(");

      assert.ok(abortGuardIndex >= 0 && abortGuardIndex < upsertIndex);
      assert.ok(staleGuardIndex >= 0 && staleGuardIndex < upsertIndex);

      // Same staleness guard exists right after the fetch resolves, before
      // the non-ok/success branches, in the try block.
      const tryBlock = sliceBetween(handler, "try {", "} catch (error) {");
      assert.match(
        tryBlock,
        /if \(askClimpyRequestIdRef\.current !== requestId\) \{\s*\n\s*return;/
      );
    },
  },
  {
    name: "retryable carries messageIdRoot, and handleRetryAskClimpy reuses it directly — it never mints a fresh id for a retry, which is what previously caused a second, duplicate error block",
    run: () => {
      const sendHandler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      assert.match(
        sendHandler,
        /const retryable: AskClimpyRetryableRequest = \{[\s\S]{0,200}messageIdRoot,/
      );

      const retryHandler = sliceBetween(
        pageSource,
        "async function handleRetryAskClimpy(",
        "  // Performs the actual insert."
      );
      assert.match(
        retryHandler,
        /await sendAskClimpyRequest\(\s*\n\s*retryable\.question,\s*\n\s*retryable\.selectedContext,\s*\n\s*retryable\.requestRewrite,\s*\n\s*retryable\.messageIdRoot,\s*\n\s*true\s*\n\s*\);/
      );
      assert.doesNotMatch(retryHandler, /generateAskClimpyMessageId/);
    },
  },
  {
    name: "A successful response (including a successful Retry) filters out any stale error message sharing the same messageIdRoot before appending the new assistant message — the prior error block is resolved/removed, not left duplicated alongside the answer",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      const successBlock = sliceBetween(
        handler,
        "const assistantMessageId = `${messageIdRoot}-answer`;",
        "// Triggers the panel's word-by-word reveal"
      );
      assert.match(
        successBlock,
        /const withoutStaleError = previous\.filter\(\s*\n\s*\(message\) => message\.id !== `\$\{messageIdRoot\}-error`\s*\n\s*\);/
      );
      assert.match(successBlock, /\.\.\.withoutStaleError,/);
    },
  },
  {
    name: "The six-answer cap counting logic is unchanged by the duplicate-error fix — still counts role === \"assistant\" on the post-filter array",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      assert.match(
        handler,
        /next\.filter\(\s*\(message\) => message\.role === "assistant"\s*\)\.length/
      );
    },
  },
  {
    name: "handleCloseAskClimpy never mutates askClimpyMessages content — close/reopen preserves whatever single error block already existed, exactly as before",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "function handleCloseAskClimpy()",
        "async function sendAskClimpyRequest("
      );
      assert.doesNotMatch(handler, /setAskClimpyMessages/);
    },
  },

  // ── RU copy correction: "Спросить Climpy" -> "Спросить у Climpy" ─────
  {
    name: "The Russian Ask Climpy entryButton/panelHeading copy is exactly \"Спросить у Climpy\"",
    run: () => {
      const ruEntryMatch = messagesSource.match(/entryButton: "([^"]+)"/g);
      assert.ok(ruEntryMatch && ruEntryMatch.length === 2);
      // First is EN ("Ask Climpy"), second is RU.
      assert.equal(ruEntryMatch[1], 'entryButton: "Спросить у Climpy"');

      const ruHeadingMatch = messagesSource.match(/panelHeading: "([^"]+)"/g);
      assert.ok(ruHeadingMatch && ruHeadingMatch.length === 2);
      assert.equal(ruHeadingMatch[1], 'panelHeading: "Спросить у Climpy"');
    },
  },
  {
    name: "The old \"Спросить Climpy\" (without \"у\") copy is completely absent from messages.ts",
    run: () => {
      assert.doesNotMatch(messagesSource, /"Спросить Climpy"/);
    },
  },
  {
    name: "entryButton is used consistently for both the desktop and mobile Main Takeaway Ask Climpy entry points, and panelHeading for the panel title — the same message keys the RU copy fix applies to",
    run: () => {
      const entryButtonUsageCount =
        pageSource.split("{results.askClimpy.entryButton}").length - 1;
      assert.equal(entryButtonUsageCount, 2, "Expected desktop + mobile entry buttons to both read entryButton");

      assert.match(panelSource, /\{askClimpy\.panelHeading\}/);
    },
  },

  // ── Reliability & retry-UX hardening: manual Retry is an exceptional
  // recovery path, never an unlimited "keep clicking" affordance ─────────
  {
    name: "sendAskClimpyRequest accepts hasBeenRetried (default false) as its fifth parameter",
    run: () => {
      assert.match(
        pageSource,
        /async function sendAskClimpyRequest\(\s*\n\s*question: string,\s*\n\s*selectedContext: SelectedContext,\s*\n\s*requestRewrite: boolean,\s*\n\s*messageIdRoot: string,[\s\S]{0,600}hasBeenRetried: boolean = false\s*\n\s*\)/
      );
    },
  },
  {
    name: "The first failure (hasBeenRetried: false, non-429) attaches retryable — exactly one visible Retry button",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      const nonOkBranch = sliceBetween(
        handler,
        "if (!response.ok || !isValidAskClimpyResponse(data)) {",
        "// data: AskClimpyResponse"
      );
      // The final (non-429, non-hasBeenRetried) branch is the only one that
      // attaches `retryable,` to the upserted message.
      const finalBranchStart = nonOkBranch.lastIndexOf("const errorText =");
      const finalBranch = nonOkBranch.slice(finalBranchStart);
      assert.match(finalBranch, /retryable,/);
    },
  },
  {
    name: "A failed manual Retry (hasBeenRetried: true) hides Retry entirely — no retryable attached — and swaps in errorRetryFailed instead of the standard error text",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      const nonOkBranch = sliceBetween(
        handler,
        "if (!response.ok || !isValidAskClimpyResponse(data)) {",
        "// data: AskClimpyResponse"
      );
      const hasBeenRetriedBranch = sliceBetween(
        nonOkBranch,
        "if (hasBeenRetried) {",
        "const errorText ="
      );
      assert.match(hasBeenRetriedBranch, /content: askClimpyMessagesText\.errorRetryFailed,/);
      assert.doesNotMatch(hasBeenRetriedBranch, /retryable/);

      const catchBlock = sliceBetween(handler, "} catch (error) {", "} finally {");
      assert.match(catchBlock, /hasBeenRetried\s*\n\s*\?\s*\{/);
      assert.match(catchBlock, /content: askClimpyMessagesText\.errorRetryFailed,/);
    },
  },
  {
    name: "handleRetryAskClimpy always calls sendAskClimpyRequest with hasBeenRetried: true — it is, by definition, THE one approved manual retry for its turn",
    run: () => {
      const retryHandler = sliceBetween(
        pageSource,
        "async function handleRetryAskClimpy(",
        "  // Performs the actual insert."
      );
      const callStart = retryHandler.indexOf("await sendAskClimpyRequest(");
      const call = retryHandler.slice(callStart, callStart + 250);
      assert.match(call, /retryable\.messageIdRoot,\s*\n\s*true\s*\n\s*\);/);
    },
  },
  {
    name: "A new question after Retry has been hidden is still fully allowed — handleSendAskClimpy is never gated on any prior-turn-failed flag, only pending/capped/re-entrancy",
    run: () => {
      // Ends right at handleSendAskClimpy's own closing brace (the first
      // occurrence of its finally-block reset) — deliberately excludes the
      // doc comment directly preceding handleRetryAskClimpy, which legitimately
      // mentions hasBeenRetried while describing THAT function, not this one.
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "askClimpyIsSubmittingRef.current = false;\n    }\n  }"
      );
      assert.match(
        handler,
        /if \(\s*\n\s*!savedAnalysisV2 \|\|\s*\n\s*isAskClimpyPending \|\|\s*\n\s*isAskClimpyCapped \|\|\s*\n\s*askClimpyIsSubmittingRef\.current\s*\n\s*\) \{/
      );
      assert.doesNotMatch(handler, /hasBeenRetried|retryExhausted|turnFailed/i);
    },
  },
  {
    name: "The 429 branch is checked FIRST (before hasBeenRetried) and never attaches retryable, regardless of retry count — no immediately clickable Retry for a rate limit",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      const nonOkBranch = sliceBetween(
        handler,
        "if (!response.ok || !isValidAskClimpyResponse(data)) {",
        "// data: AskClimpyResponse"
      );

      const rateLimitIndex = nonOkBranch.indexOf('if (response.status === 429) {');
      const hasBeenRetriedIndex = nonOkBranch.indexOf("if (hasBeenRetried) {");
      assert.ok(rateLimitIndex >= 0 && rateLimitIndex < hasBeenRetriedIndex);

      // Ends right at the 429 branch's own closing brace (its first
      // "return;" + brace) — deliberately excludes the doc comment that
      // follows it (which legitimately discusses "retryable" in prose while
      // describing the LATER hasBeenRetried branch).
      const rateLimitBranchEnd = nonOkBranch.indexOf("return;\n        }", rateLimitIndex);
      const rateLimitBranch = nonOkBranch.slice(rateLimitIndex, rateLimitBranchEnd);
      assert.match(rateLimitBranch, /content: askClimpyMessagesText\.errorRateLimited,/);
      assert.doesNotMatch(rateLimitBranch, /retryable/);
    },
  },
  {
    name: "A 429 preserves the conversation and never touches the six-answer cap — it only ever upserts an error message, never an assistant push or a messages-clearing call",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function sendAskClimpyRequest(",
        "  // Performs the actual insert."
      );
      const nonOkBranch = sliceBetween(
        handler,
        "if (!response.ok || !isValidAskClimpyResponse(data)) {",
        "// data: AskClimpyResponse"
      );
      const rateLimitBranch = sliceBetween(
        nonOkBranch,
        'if (response.status === 429) {',
        "if (hasBeenRetried) {"
      );
      assert.doesNotMatch(rateLimitBranch, /role: "assistant"|setAskClimpyMessages\(\[\]\)|setIsAskClimpyCapped/);
    },
  },
  {
    name: "lib/messages.ts defines errorRetryFailed for both locales with the approved exact copy",
    run: () => {
      assert.equal(messagesSource.split("errorRetryFailed:").length - 1, 2);
      assert.match(
        messagesSource,
        /errorRetryFailed:\s*\n?\s*"Climpy couldn't get a valid response after trying again\. Please wait a moment or ask the question in another way\."/
      );
      assert.match(
        messagesSource,
        /errorRetryFailed:\s*\n?\s*"Climpy снова не смог получить корректный ответ\. Подождите немного или сформулируйте вопрос иначе\."/
      );
    },
  },
  {
    name: "errorRetryFailed is a distinct key from errorGeneric/errorRateLimited/errorRequestInvalid/errorTechnicalExplanation",
    run: () => {
      const keys = [
        "errorGeneric",
        "errorRateLimited",
        "errorRequestInvalid",
        "errorRetryFailed",
        "errorTechnicalExplanation",
      ];
      assert.equal(new Set(keys).size, keys.length);
    },
  },

  // ── Copied-text duplication fix: one shared live-announcement region,
  // never a second permanent sr-only copy per message ──────────────────
  {
    name: "The panel renders exactly ONE shared role=\"status\" aria-live=\"polite\" sr-only region, driven by a single liveAnnouncement state value",
    run: () => {
      assert.match(
        panelSource,
        /const \[liveAnnouncement, setLiveAnnouncement\] = useState\(""\);/
      );
      const liveRegionOccurrences =
        panelSource.split('role="status" aria-live="polite" className="sr-only"').length - 1;
      assert.equal(liveRegionOccurrences, 1, "Expected exactly one shared live-announcement region");
      assert.match(panelSource, /\{liveAnnouncement\}/);
    },
  },
  {
    name: "buildAskClimpyFullAnnouncement is a pure top-level helper (not duplicated per message component) used only to populate the shared live region",
    run: () => {
      const defCount =
        panelSource.split("function buildAskClimpyFullAnnouncement(").length - 1;
      assert.equal(defCount, 1);

      const usageCount =
        panelSource.split("buildAskClimpyFullAnnouncement(message)").length - 1;
      assert.equal(usageCount, 1, "Expected it called exactly once, inside the messages.map onRevealComplete wrapper");
    },
  },
  {
    name: "Each message's onRevealComplete is wrapped at the messages.map call site to set the live announcement exactly once, before delegating to the parent's onRevealComplete",
    run: () => {
      const mapBlock = sliceBetween(
        panelSource,
        "{messages.map((message) => (",
        "))}"
      );
      assert.match(
        mapBlock,
        /onRevealComplete=\{\(\) => \{\s*\n[\s\S]{0,350}setLiveAnnouncement\(buildAskClimpyFullAnnouncement\(message\)\);\s*\n\s*onRevealComplete\(\);\s*\n\s*\}\}/
      );
    },
  },
  {
    name: "The live announcement is cleared shortly after being set (a timed effect keyed on liveAnnouncement) — it is never a permanent, lingering duplicate of any message's text",
    run: () => {
      const effectStart = panelSource.indexOf("useEffect(() => {\n    if (!liveAnnouncement) return;");
      assert.ok(effectStart >= 0);
      const effect = panelSource.slice(effectStart, effectStart + 500);
      assert.match(effect, /window\.setTimeout\(\(\) => setLiveAnnouncement\(""\), 1000\)/);
      assert.match(effect, /return \(\) => window\.clearTimeout\(timeoutId\);/);
    },
  },
  {
    name: "Reopening the panel never re-announces historical messages: onRevealComplete (and therefore the live-announcement side effect) only ever fires for a message that WAS actively revealing, which requires revealMessageId to currently equal that message's id",
    run: () => {
      // isRevealing is still computed identically per bubble (already
      // proven single-target elsewhere) — after close, page.tsx clears
      // revealMessageId to null, so no message is "revealing" on reopen,
      // and useAskClimpyRevealedWordCount's onRevealComplete-triggering
      // effects (both the ticker completion and the reduced-motion bypass)
      // are gated on isRevealing being true — never fired for a message
      // that starts already-complete.
      const hookSource = sliceBetween(
        panelSource,
        "function useAskClimpyRevealedWordCount(",
        "\nfunction AskClimpyMessageBubble"
      );
      assert.match(hookSource, /if \(isRevealing && !shouldAnimate\) \{/);
      assert.match(hookSource, /const shouldAnimate =\s*\n\s*isRevealing && plan\.totalWords > 0 && !prefersReducedMotion\(\);/);
    },
  },
  {
    name: "Reduced motion still produces exactly one visible text copy (no per-message sr-only duplicate) and one announcement via the shared live region",
    run: () => {
      const localComponent = sliceBetween(
        panelSource,
        "function AskClimpyLocalMessage(",
        "\nfunction AskClimpyAssistantMessage"
      );
      const assistantComponentStart = panelSource.indexOf(
        "function AskClimpyAssistantMessage("
      );
      const assistantComponent = panelSource.slice(assistantComponentStart);

      for (const component of [localComponent, assistantComponent]) {
        assert.doesNotMatch(component, /role="status" className="sr-only"/);
      }
      // The reduced-motion bypass path (shouldAnimate: false) still calls
      // onCompleteRef.current() exactly once — unchanged — which is now
      // the SAME wrapped callback that populates the shared live region.
      const hookSource = sliceBetween(
        panelSource,
        "function useAskClimpyRevealedWordCount(",
        "\nfunction AskClimpyMessageBubble"
      );
      assert.match(hookSource, /onCompleteRef\.current\(\);/);
    },
  },
  {
    name: "Reveal timings are unchanged by the accessibility fix — buildAskClimpyRevealPlan call sites are untouched (model default speed, local speed explicit)",
    run: () => {
      const assistantComponentStart = panelSource.indexOf(
        "function AskClimpyAssistantMessage("
      );
      const assistantComponent = panelSource.slice(assistantComponentStart);
      assert.match(
        assistantComponent,
        /buildAskClimpyRevealPlan\(\{\s*\n\s*answer: message\.content,\s*\n\s*action: message\.action,\s*\n\s*example: message\.example,\s*\n\s*\}\);/
      );

      const localComponent = sliceBetween(
        panelSource,
        "function AskClimpyLocalMessage(",
        "\nfunction AskClimpyAssistantMessage"
      );
      assert.match(
        localComponent,
        /buildAskClimpyRevealPlan\(\{ answer: message\.content \}, "local"\)/
      );
    },
  },

  // ── Typed rewrite intent (Phase 4) ────────────────────────────────────
  {
    name: "handleSendAskClimpy imports and consults classifyAskClimpyRewriteIntent, but ONLY when requestRewrite is already false — the starter button's own true is never re-evaluated",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );
      assert.match(
        handler,
        /if \(!requestRewrite && savedAnalysisV2\) \{\s*\n\s*const rewriteIntent = classifyAskClimpyRewriteIntent\(question\);/
      );
    },
  },
  {
    name: "A recognized typed rewrite intent resolves to the SAME deterministic riskiest-part index and eligibility check the starter button uses (findRiskiestRiskyPartIndex + isRiskyPartRewriteEligible), never a fragment chosen from the question text",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );
      const rewriteIntentBlock = sliceBetween(
        handler,
        'if (rewriteIntent === "rewriteRiskiestPart") {',
        "setAskClimpyMessages((previous) => [\n        ...previous,\n        { id: userMessageId, role: \"user\", content: question },\n      ]);"
      );
      assert.match(rewriteIntentBlock, /findRiskiestRiskyPartIndex\(\s*\n\s*analysisContext\.riskyParts\s*\n\s*\)/);
      assert.match(
        rewriteIntentBlock,
        /isRiskyPartRewriteEligible\(riskiestPart, activeScript\)/
      );
      assert.match(
        rewriteIntentBlock,
        /effectiveSelectedContext = \{\s*\n\s*type: "riskyPart",\s*\n\s*index: riskiestIndex,\s*\n\s*\};/
      );
      assert.match(rewriteIntentBlock, /effectiveRequestRewrite = true;/);
    },
  },
  {
    name: "The typed-rewrite path calls sendAskClimpyRequest with the effective (possibly overridden) selectedContext/requestRewrite, not the raw arguments — so rewriteFragment/originalFragment are derived exactly like the starter path",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );
      assert.match(
        handler,
        /await sendAskClimpyRequest\(\s*\n\s*question,\s*\n\s*effectiveSelectedContext,\s*\n\s*effectiveRequestRewrite,\s*\n\s*userMessageId\s*\n\s*\);/
      );
    },
  },
  {
    name: "When no risky part is eligible, the typed rewrite intent never calls the API — it pushes a local explanation (noEligibleRewriteExplanation) and returns before the fetch path",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );
      const noEligibleBlock = sliceBetween(
        handler,
        "} else {\n            // No eligible risky part",
        "return;\n          }"
      );
      assert.match(
        noEligibleBlock,
        /content: results\.askClimpy\.noEligibleRewriteExplanation,/
      );
      assert.doesNotMatch(noEligibleBlock, /sendAskClimpyRequest|fetch\(/);
      assert.match(noEligibleBlock, /role: "local"/);
    },
  },
  {
    name: "The no-eligible-rewrite local message pushes the user bubble exactly once (no duplication) and never sets requestRewrite/selectedContext for a fake request",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );
      const noEligibleBlock = sliceBetween(
        handler,
        "} else {\n            // No eligible risky part",
        "return;\n          }"
      );
      const userPushCount =
        noEligibleBlock.split('{ id: userMessageId, role: "user", content: question },').length - 1;
      assert.equal(userPushCount, 1);
    },
  },
  {
    name: "lib/messages.ts defines noEligibleRewriteExplanation for both locales with a non-empty, distinct message",
    run: () => {
      assert.equal(messagesSource.split("noEligibleRewriteExplanation:").length - 1, 2);
      assert.match(
        messagesSource,
        /noEligibleRewriteExplanation:\s*\n?\s*"There's no validated risky part Climpy can safely rewrite right now\. Try asking a specific question about your analysis instead\."/
      );
      assert.match(
        messagesSource,
        /noEligibleRewriteExplanation:\s*\n?\s*"Сейчас нет проверенного рискованного фрагмента, который Climpy может безопасно переписать\. Попробуйте задать конкретный вопрос об анализе\."/
      );
    },
  },
  {
    name: "Typed rewrite eligibility reuses isRiskyPartRewriteEligible (which already enforces the 200-character limit and exact-substring check) — no separate/duplicated length or grounding logic was introduced",
    run: () => {
      const handler = sliceBetween(
        pageSource,
        "async function handleSendAskClimpy(",
        "async function handleRetryAskClimpy("
      );
      const occurrences = handler.split("isRiskyPartRewriteEligible(").length - 1;
      assert.equal(occurrences, 1, "Expected exactly one call, reusing the existing helper");
      assert.doesNotMatch(handler, /maxRewriteFragmentCharacters|\.length > 200|\.length <= 200/);
    },
  },
  {
    name: "The starter-button rewrite path is untouched: it still passes requestRewrite: true and the riskiest-part selectedContext directly from askClimpyStarterQuestions, bypassing the typed-intent block entirely",
    run: () => {
      const starters = sliceBetween(
        pageSource,
        "const askClimpyStarterQuestions = useMemo",
        "function handleOpenAskClimpy()"
      );
      assert.match(starters, /id: "rewriteRiskiestPart"/);
      assert.match(
        starters,
        /selectedContext: \{ type: "riskyPart", index: riskiestIndex \},\s*\n\s*requestRewrite: true,/
      );
    },
  },
];

function main() {
  console.log("\nAsk Climpy UI Regression Tests\n");

  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
      console.log(`✅ PASS — ${test.name}`);
    } catch (error) {
      console.error(`❌ FAIL — ${test.name}`);
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }

  console.log(`\nAsk Climpy UI tests: ${passed}/${tests.length} passed`);
}

main();
