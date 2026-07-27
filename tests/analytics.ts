import { readFileSync } from "node:fs";
import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_LOCALES,
  ANALYTICS_VERDICTS,
  FAILURE_CATEGORIES,
  INPUT_SOURCES,
  LENGTH_BUCKETS,
  bucketScriptLength,
  detectInputSource,
  toAnalyticsLocale,
  validateAnalyticsEvent,
} from "../lib/analytics-events";
import { getMessages } from "../lib/messages";

let failures = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    console.log(`✅ PASS — ${name}`);
  } else {
    console.error(`❌ FAIL — ${name}`);
    failures += 1;
  }
}

console.log("\nAnalyzer Funnel Analytics Tests\n");

// ── Strict allowlists ───────────────────────────────────────────────────

check(
  "exactly the four approved event names exist, nothing else",
  JSON.stringify([...ANALYTICS_EVENT_NAMES].sort()) ===
    JSON.stringify(
      [
        "analyzer_example_inserted",
        "analysis_submitted",
        "analysis_succeeded",
        "analysis_failed",
      ].sort()
    )
);

check(
  "locale allowlist is exactly en/ru",
  JSON.stringify([...ANALYTICS_LOCALES].sort()) ===
    JSON.stringify(["en", "ru"])
);

check(
  "length bucket allowlist is exactly the four approved buckets",
  JSON.stringify(LENGTH_BUCKETS) ===
    JSON.stringify(["1-250", "251-500", "501-750", "751-1000"])
);

check(
  "input source allowlist is exactly manual/example",
  JSON.stringify([...INPUT_SOURCES].sort()) ===
    JSON.stringify(["example", "manual"])
);

check(
  "failure category allowlist is exactly the six approved categories",
  JSON.stringify([...FAILURE_CATEGORIES].sort()) ===
    JSON.stringify(
      [
        "network",
        "timeout",
        "rate_limited",
        "invalid_response",
        "server",
        "unknown",
      ].sort()
    )
);

check(
  "verdict allowlist is exactly strong/mixed/weak",
  JSON.stringify([...ANALYTICS_VERDICTS].sort()) ===
    JSON.stringify(["mixed", "strong", "weak"])
);

// ── bucketScriptLength boundaries ───────────────────────────────────────

const bucketCases: Array<[number, string]> = [
  [1, "1-250"],
  [250, "1-250"],
  [251, "251-500"],
  [500, "251-500"],
  [501, "501-750"],
  [750, "501-750"],
  [751, "751-1000"],
  [1000, "751-1000"],
];

for (const [length, expected] of bucketCases) {
  check(
    `bucketScriptLength(${length}) === "${expected}"`,
    bucketScriptLength(length) === expected
  );
}

// ── toAnalyticsLocale ────────────────────────────────────────────────────

check('toAnalyticsLocale("en") === "en"', toAnalyticsLocale("en") === "en");
check('toAnalyticsLocale("ru") === "ru"', toAnalyticsLocale("ru") === "ru");
check(
  'toAnalyticsLocale("es") falls back to "en" (unlaunched locale)',
  toAnalyticsLocale("es") === "en"
);
check(
  'toAnalyticsLocale("fr") falls back to "en" (unlaunched locale)',
  toAnalyticsLocale("fr") === "en"
);

// ── detectInputSource ────────────────────────────────────────────────────

const enExample = getMessages("en").landing.analyzer.exampleScript;
const ruExample = getMessages("ru").landing.analyzer.exampleScript;

check(
  "detectInputSource recognizes the exact EN example script",
  detectInputSource(enExample) === "example"
);
check(
  "detectInputSource recognizes the exact RU example script",
  detectInputSource(ruExample) === "example"
);
check(
  "detectInputSource still reports \"example\" for the RU example even when the current locale would render EN copy — checked against both locales, not just the active one",
  detectInputSource(ruExample) === "example"
);
check(
  "detectInputSource reports manual for a single edited character",
  detectInputSource(enExample + "!") === "manual"
);
check(
  "detectInputSource reports manual for arbitrary typed text",
  detectInputSource("This is my own script about something else.") ===
    "manual"
);
check(
  "detectInputSource reports manual for an empty string",
  detectInputSource("") === "manual"
);

// ── validateAnalyticsEvent — acceptance ─────────────────────────────────

check(
  "validateAnalyticsEvent accepts a well-formed analyzer_example_inserted event",
  JSON.stringify(
    validateAnalyticsEvent({
      name: "analyzer_example_inserted",
      properties: { locale: "en" },
    })
  ) ===
    JSON.stringify({
      name: "analyzer_example_inserted",
      properties: { locale: "en" },
    })
);

check(
  "validateAnalyticsEvent accepts a well-formed analysis_submitted event",
  JSON.stringify(
    validateAnalyticsEvent({
      name: "analysis_submitted",
      properties: {
        locale: "ru",
        input_source: "manual",
        length_bucket: "251-500",
      },
    })
  ) ===
    JSON.stringify({
      name: "analysis_submitted",
      properties: {
        locale: "ru",
        input_source: "manual",
        length_bucket: "251-500",
      },
    })
);

check(
  "validateAnalyticsEvent accepts analysis_succeeded without the optional verdict",
  validateAnalyticsEvent({
    name: "analysis_succeeded",
    properties: {
      locale: "en",
      input_source: "example",
      length_bucket: "1-250",
    },
  })?.name === "analysis_succeeded"
);

check(
  "validateAnalyticsEvent accepts analysis_succeeded with a valid verdict",
  JSON.stringify(
    validateAnalyticsEvent({
      name: "analysis_succeeded",
      properties: {
        locale: "en",
        input_source: "example",
        length_bucket: "1-250",
        verdict: "strong",
      },
    })
  ) ===
    JSON.stringify({
      name: "analysis_succeeded",
      properties: {
        locale: "en",
        input_source: "example",
        length_bucket: "1-250",
        verdict: "strong",
      },
    })
);

check(
  "validateAnalyticsEvent accepts a well-formed analysis_failed event",
  JSON.stringify(
    validateAnalyticsEvent({
      name: "analysis_failed",
      properties: {
        locale: "en",
        input_source: "manual",
        length_bucket: "751-1000",
        failure_category: "server",
      },
    })
  ) ===
    JSON.stringify({
      name: "analysis_failed",
      properties: {
        locale: "en",
        input_source: "manual",
        length_bucket: "751-1000",
        failure_category: "server",
      },
    })
);

// ── validateAnalyticsEvent — rejection ──────────────────────────────────

check(
  "validateAnalyticsEvent rejects an unknown event name",
  validateAnalyticsEvent({
    name: "page_view",
    properties: { locale: "en" },
  }) === null
);

check(
  "validateAnalyticsEvent rejects a locale outside en/ru",
  validateAnalyticsEvent({
    name: "analyzer_example_inserted",
    properties: { locale: "fr" },
  }) === null
);

check(
  "validateAnalyticsEvent rejects an invalid verdict value",
  validateAnalyticsEvent({
    name: "analysis_succeeded",
    properties: {
      locale: "en",
      input_source: "manual",
      length_bucket: "1-250",
      verdict: "excellent",
    },
  }) === null
);

check(
  "validateAnalyticsEvent rejects a missing required property",
  validateAnalyticsEvent({
    name: "analysis_failed",
    properties: {
      locale: "en",
      input_source: "manual",
      length_bucket: "1-250",
      // failure_category intentionally omitted
    },
  }) === null
);

check(
  "validateAnalyticsEvent rejects an extra unapproved property (e.g. script) even alongside otherwise-valid ones",
  validateAnalyticsEvent({
    name: "analysis_submitted",
    properties: {
      locale: "en",
      input_source: "manual",
      length_bucket: "1-250",
      script: "some user script text",
    },
  }) === null
);

check(
  "validateAnalyticsEvent rejects a non-object payload",
  validateAnalyticsEvent("not an object") === null &&
    validateAnalyticsEvent(null) === null &&
    validateAnalyticsEvent(42) === null
);

check(
  "validateAnalyticsEvent rejects non-object properties",
  validateAnalyticsEvent({
    name: "analyzer_example_inserted",
    properties: "en",
  }) === null
);

// ── /api/analytics route ────────────────────────────────────────────────

async function testRoute() {
  const { POST } = await import("../app/api/analytics/route");

  const originalConsoleInfo = console.info;
  let loggedCalls: unknown[][] = [];
  console.info = (...args: unknown[]) => {
    loggedCalls.push(args);
  };

  try {
    // Valid event: logged once, response has no body.
    loggedCalls = [];
    const validRequest = new Request("http://localhost/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "analyzer_example_inserted",
        properties: { locale: "en" },
      }),
    });
    const validResponse = await POST(validRequest);
    const validBody = await validResponse.text();

    check(
      "POST /api/analytics returns 204 for a valid event",
      validResponse.status === 204
    );
    check(
      "POST /api/analytics returns an empty body for a valid event",
      validBody === ""
    );
    check(
      "POST /api/analytics logs exactly once for a valid event",
      loggedCalls.length === 1
    );
    check(
      "the logged payload contains only the event name and its validated properties — no extra top-level keys",
      loggedCalls.length === 1 &&
        typeof loggedCalls[0][1] === "object" &&
        loggedCalls[0][1] !== null &&
        JSON.stringify(Object.keys(loggedCalls[0][1] as object).sort()) ===
          JSON.stringify(["name", "properties"])
    );

    // Malformed JSON body: rejected, never logged.
    loggedCalls = [];
    const malformedRequest = new Request(
      "http://localhost/api/analytics",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not valid json",
      }
    );
    const malformedResponse = await POST(malformedRequest);

    check(
      "POST /api/analytics returns 400 for malformed JSON",
      malformedResponse.status === 400
    );
    check(
      "POST /api/analytics never logs malformed JSON",
      loggedCalls.length === 0
    );

    // Disallowed extra property (e.g. script content): rejected, never logged.
    loggedCalls = [];
    const scriptLeakRequest = new Request(
      "http://localhost/api/analytics",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "analysis_submitted",
          properties: {
            locale: "en",
            input_source: "manual",
            length_bucket: "1-250",
            script: "some private user script content",
          },
        }),
      }
    );
    const scriptLeakResponse = await POST(scriptLeakRequest);

    check(
      "POST /api/analytics returns 400 when the payload carries an unapproved property such as script",
      scriptLeakResponse.status === 400
    );
    check(
      "POST /api/analytics never logs a payload carrying an unapproved property",
      loggedCalls.length === 0
    );

    // Unknown event name: rejected, never logged.
    loggedCalls = [];
    const unknownEventRequest = new Request(
      "http://localhost/api/analytics",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "page_view",
          properties: { locale: "en" },
        }),
      }
    );
    const unknownEventResponse = await POST(unknownEventRequest);

    check(
      "POST /api/analytics returns 400 for an unknown event name",
      unknownEventResponse.status === 400
    );
    check(
      "POST /api/analytics never logs an unknown event name",
      loggedCalls.length === 0
    );
  } finally {
    console.info = originalConsoleInfo;
  }
}

// ── trackEvent (client helper) ──────────────────────────────────────────

async function testTrackEvent() {
  const { trackEvent } = await import("../lib/track-event");
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as { window?: unknown }).window;

  try {
    // No `window` (server-render context): must not attempt a network call.
    delete (globalThis as { window?: unknown }).window;
    let fetchCalledDuringSsr = false;
    globalThis.fetch = (async () => {
      fetchCalledDuringSsr = true;
      throw new Error("fetch must not be called during SSR");
    }) as typeof fetch;

    let threwDuringSsr = false;
    try {
      trackEvent("analyzer_example_inserted", { locale: "en" });
    } catch {
      threwDuringSsr = true;
    }

    check(
      "trackEvent does not call fetch when window is undefined (server rendering)",
      !fetchCalledDuringSsr
    );
    check(
      "trackEvent never throws when window is undefined",
      !threwDuringSsr
    );

    // `window` present (client context): fires fetch, and a rejected fetch
    // must never throw synchronously or propagate to the caller.
    (globalThis as { window?: unknown }).window = {};
    let fetchCalledClientSide = false;
    let capturedUrl: string | null = null;
    let capturedBody: unknown = null;
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      fetchCalledClientSide = true;
      capturedUrl = typeof input === "string" ? input : input.toString();
      capturedBody = init?.body
        ? JSON.parse(init.body as string)
        : null;
      return Promise.reject(
        new Error("simulated analytics network failure")
      );
    }) as typeof fetch;

    let threwClientSide = false;
    try {
      trackEvent("analysis_failed", {
        locale: "en",
        input_source: "manual",
        length_bucket: "1-250",
        failure_category: "network",
      });
    } catch {
      threwClientSide = true;
    }

    check(
      "trackEvent calls fetch when window is present",
      fetchCalledClientSide
    );
    check(
      "trackEvent posts to /api/analytics",
      capturedUrl === "/api/analytics" ||
        capturedUrl === "http://localhost/api/analytics"
    );
    check(
      "trackEvent sends only the event name and approved properties in the body",
      JSON.stringify(capturedBody) ===
        JSON.stringify({
          name: "analysis_failed",
          properties: {
            locale: "en",
            input_source: "manual",
            length_bucket: "1-250",
            failure_category: "network",
          },
        })
    );
    check(
      "trackEvent never throws even when the underlying fetch rejects (analytics must never break Analyze)",
      !threwClientSide
    );

    // Give the rejected promise's .catch() a turn so it doesn't surface
    // as an unhandled rejection in this test run.
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }
}

// ── app/page.tsx wiring (source-shape) ──────────────────────────────────

const homeSource = readFileSync("app/page.tsx", "utf8");

const trackEventCallCount = homeSource.split("trackEvent(").length - 1;
check(
  "trackEvent is called exactly four times in app/page.tsx — once per approved event",
  trackEventCallCount === 4
);

check(
  'exactly one analyzer_example_inserted call site exists',
  homeSource.split('trackEvent("analyzer_example_inserted"').length - 1 === 1
);
check(
  "exactly one analysis_submitted call site exists",
  homeSource.split('trackEvent("analysis_submitted"').length - 1 === 1
);
check(
  "exactly one analysis_succeeded call site exists",
  homeSource.split('trackEvent("analysis_succeeded"').length - 1 === 1
);
check(
  "exactly one analysis_failed call site exists",
  homeSource.split('trackEvent("analysis_failed"').length - 1 === 1
);

// handleTryExample: the guard's `return;` must appear before both
// setScript(...) and the tracking call, so a blocked insertion never fires
// the event.
const tryExampleStart = homeSource.indexOf(
  "function handleTryExample()"
);
const tryExampleEnd = homeSource.indexOf(
  "\n  function handleAnalyze()"
);
const tryExampleBody = homeSource.slice(tryExampleStart, tryExampleEnd);
const guardReturnIndex = tryExampleBody.indexOf("return;");
const setScriptIndex = tryExampleBody.indexOf(
  "setScript(messages.landing.analyzer.exampleScript)"
);
const exampleTrackIndex = tryExampleBody.indexOf(
  'trackEvent("analyzer_example_inserted"'
);

check(
  "handleTryExample's non-overwrite guard returns before the example is inserted",
  guardReturnIndex >= 0 &&
    setScriptIndex > guardReturnIndex
);
check(
  "handleTryExample fires analyzer_example_inserted only after the example is actually inserted",
  exampleTrackIndex > setScriptIndex
);

// handleAnalyze: analysis_submitted must fire after all three local
// validation early-returns and before the actual API fetch call.
const handleAnalyzeStart = homeSource.indexOf(
  "function handleAnalyze()"
);
const handleAnalyzeBody = homeSource.slice(handleAnalyzeStart);
const lastValidationReturn = handleAnalyzeBody.lastIndexOf(
  "return;",
  handleAnalyzeBody.indexOf("void (async () => {")
);
const submittedTrackIndex = handleAnalyzeBody.indexOf(
  'trackEvent("analysis_submitted"'
);
const fetchCallIndex = handleAnalyzeBody.indexOf(
  'fetch("/api/analyze-v2"'
);

check(
  "analysis_submitted fires after the last local-validation early return",
  lastValidationReturn >= 0 && submittedTrackIndex > lastValidationReturn
);
check(
  "analysis_submitted fires before the API request",
  submittedTrackIndex > 0 &&
    fetchCallIndex > submittedTrackIndex
);

const succeededTrackIndex = handleAnalyzeBody.indexOf(
  'trackEvent("analysis_succeeded"'
);
const routerPushIndex = handleAnalyzeBody.indexOf(
  'router.push("/results")'
);
check(
  "analysis_succeeded fires before navigating to Results",
  succeededTrackIndex > 0 && routerPushIndex > succeededTrackIndex
);

const catchBlockIndex = handleAnalyzeBody.indexOf(
  "} catch (caughtError) {"
);
const failedTrackIndex = handleAnalyzeBody.indexOf(
  'trackEvent("analysis_failed"'
);
check(
  "analysis_failed fires only inside the catch block for an actually-submitted analysis",
  catchBlockIndex > 0 && failedTrackIndex > catchBlockIndex
);

check(
  "exactly one fetch(\"/api/analyze-v2\"...) call exists — no client-side retry loop that could duplicate final-outcome events",
  homeSource.split('fetch("/api/analyze-v2"').length - 1 === 1
);

// Snapshot values (locale/input_source/length_bucket) must be captured
// once and reused — not re-derived from possibly-mutated state inside the
// success/failure branches.
check(
  "analysis_succeeded reuses the snapshotted analyticsLocale/analyticsInputSource/analyticsLengthBucket rather than re-deriving them",
  handleAnalyzeBody
    .slice(succeededTrackIndex, succeededTrackIndex + 220)
    .includes("locale: analyticsLocale") &&
    handleAnalyzeBody
      .slice(succeededTrackIndex, succeededTrackIndex + 220)
      .includes("input_source: analyticsInputSource") &&
    handleAnalyzeBody
      .slice(succeededTrackIndex, succeededTrackIndex + 220)
      .includes("length_bucket: analyticsLengthBucket")
);
check(
  "analysis_failed reuses the same snapshotted values",
  handleAnalyzeBody
    .slice(failedTrackIndex, failedTrackIndex + 220)
    .includes("locale: analyticsLocale") &&
    handleAnalyzeBody
      .slice(failedTrackIndex, failedTrackIndex + 220)
      .includes("input_source: analyticsInputSource") &&
    handleAnalyzeBody
      .slice(failedTrackIndex, failedTrackIndex + 220)
      .includes("length_bucket: analyticsLengthBucket")
);

// No raw content ever appears inside any trackEvent(...) call block.
const forbiddenSubstrings = [
  "script:",
  "cleanedScript",
  "title:",
  "cleanedTitle",
  "payload.result.mainTakeaway",
  "payload.result.suggestedHook",
  "payload.result.riskyParts",
  "payload.result.scenes",
  "caughtError",
  "analyzeError",
  "response.headers",
  "email",
  "userId",
  "user.id",
];

function extractCallBlock(source: string, startIndex: number): string {
  if (startIndex < 0) return "";
  const openBraceIndex = source.indexOf("{", startIndex);
  const closeParenIndex = source.indexOf("});", openBraceIndex);
  return source.slice(startIndex, closeParenIndex + 3);
}

const allTrackEventBlocks = [
  extractCallBlock(tryExampleBody, exampleTrackIndex),
  extractCallBlock(handleAnalyzeBody, submittedTrackIndex),
  extractCallBlock(handleAnalyzeBody, succeededTrackIndex),
  extractCallBlock(handleAnalyzeBody, failedTrackIndex),
].join("\n");

const foundForbidden = forbiddenSubstrings.filter((needle) =>
  allTrackEventBlocks.includes(needle)
);

check(
  "no trackEvent(...) call anywhere includes script text, analysis content, error objects, or identity fields",
  foundForbidden.length === 0
);

// Only response.status (a numeric HTTP status code, not body content) may
// be read when deriving failure_category — never response text/json/body.
check(
  "failure_category is derived only from response.status, never from response body content",
  handleAnalyzeBody.includes("response.status === 429") &&
    handleAnalyzeBody.includes("response.status >= 500") &&
    !handleAnalyzeBody.includes("failureCategory = payload") &&
    !handleAnalyzeBody.includes("failureCategory = caughtError")
);

// trackEvent must never fire from inside a useEffect (module-mount /
// rerender path) — only from the two click-driven handlers.
const effectBlocksSource = [...homeSource.matchAll(/useEffect\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/g)]
  .map((match) => match[0])
  .join("\n");
check(
  "trackEvent never appears inside a useEffect — only inside the two click-driven handlers",
  !effectBlocksSource.includes("trackEvent(")
);

// ── unrelated behavior must remain untouched ────────────────────────────

check(
  "the Analyze button's disabled logic is unchanged (still trim-based, still appears twice)",
  homeSource.split("script.trim().length === 0 ||").length - 1 === 2
);
check(
  "the existing analyzer example non-overwrite gate is unchanged (still appears twice)",
  homeSource.split("{script.trim().length === 0 && (").length - 1 === 2
);
check(
  "no Ukrainian locale was introduced by this feature",
  !readFileSync("lib/messages.ts", "utf8").includes('"uk"') &&
    !readFileSync("lib/analytics-events.ts", "utf8").includes("uk")
);

// ── analytics module must never touch auth/Supabase/env ────────────────

const analyticsEventsSource = readFileSync(
  "lib/analytics-events.ts",
  "utf8"
);
const trackEventSource = readFileSync("lib/track-event.ts", "utf8");
const analyticsRouteSource = readFileSync(
  "app/api/analytics/route.ts",
  "utf8"
);
const combinedAnalyticsSource = [
  analyticsEventsSource,
  trackEventSource,
  analyticsRouteSource,
].join("\n");

check(
  "the analytics module never references Supabase, auth tokens, session tokens, cookies, or process.env",
  !/supabase|authorization|session[-_]?token|auth[-_]?token|document\.cookie|process\.env/i.test(
    combinedAnalyticsSource
  )
);
check(
  "the analytics route never imports a database client or persists to a table",
  !/createSupabaseServerClient|\.from\(["'`]/i.test(analyticsRouteSource)
);
check(
  "no third-party analytics provider dependency was introduced",
  !/posthog|mixpanel|segment|@vercel\/analytics|gtag|plausible/i.test(
    combinedAnalyticsSource
  )
);

async function main() {
  await testRoute();
  await testTrackEvent();

  if (failures > 0) {
    process.exitCode = 1;
  } else {
    console.log(
      "\nResult: all analyzer funnel analytics tests passed."
    );
  }
}

void main();
