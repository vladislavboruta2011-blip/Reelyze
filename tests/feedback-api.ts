import { config } from "dotenv";

config({ path: ".env.local" });

const originalFetch = globalThis.fetch;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const persistedFeedbackRequests: Record<string, unknown>[] = [];

process.env.SUPABASE_URL = "https://feedback-test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "feedback-test-secret";

// Toggled on for exactly one test case to simulate a genuine database
// failure (e.g. the production DNS/connectivity failure this suite
// regresses against) without affecting every other case.
let simulateSupabaseFailure = false;

globalThis.fetch = (async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const request = input instanceof Request ? input : null;
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const method = (
    init?.method ??
    request?.method ??
    "GET"
  ).toUpperCase();

  if (
    !url.includes("/rest/v1/feedback") ||
    method != "POST"
  ) {
    throw new Error(
      `Unexpected Supabase request: ${method} ${url}`
    );
  }

  if (simulateSupabaseFailure) {
    return new Response(
      JSON.stringify({
        message: "Simulated database failure (e.g. DNS/connectivity).",
        code: "SIMULATED_FAILURE",
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  }

  let rawBody = init?.body;

  if (rawBody === undefined && request) {
    rawBody = await request.clone().text();
  }

  if (typeof rawBody !== "string") {
    throw new Error("Expected Supabase request body to be JSON.");
  }

  const parsedBody = JSON.parse(rawBody) as unknown;

  if (
    typeof parsedBody !== "object" ||
    parsedBody === null ||
    Array.isArray(parsedBody)
  ) {
    throw new Error("Expected persisted feedback to be an object.");
  }

  persistedFeedbackRequests.push(
    parsedBody as Record<string, unknown>
  );

  return new Response("[]", {
    status: 201,
    headers: {
      "content-type": "application/json",
    },
  });
}) as typeof globalThis.fetch;

function restoreTestEnvironment(): void {
  globalThis.fetch = originalFetch;

  if (originalSupabaseUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = originalSupabaseUrl;
  }

  if (originalSupabaseSecretKey === undefined) {
    delete process.env.SUPABASE_SECRET_KEY;
  } else {
    process.env.SUPABASE_SECRET_KEY =
      originalSupabaseSecretKey;
  }
}

function createRequest(
  body: unknown,
  contentType = "application/json"
): Request {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: {
      "content-type": contentType,
    },
    body:
      typeof body === "string"
        ? body
        : JSON.stringify(body),
  });
}

async function expectJson(
  response: Response
): Promise<Record<string, unknown>> {
  const json = (await response.json()) as unknown;

  if (
    typeof json !== "object" ||
    json === null ||
    Array.isArray(json)
  ) {
    throw new Error("Expected JSON object response.");
  }

  return json as Record<string, unknown>;
}

function createValidFeedback(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    rating: "helpful",
    reason: "Useful fixes",
    text: null,
    title: "Phone battery setting",
    script:
      "Your phone battery dies faster because of one hidden setting. Many apps keep running in the background.",
    overallScore: 80,
    hookScore: 85,
    retentionRisk: 30,
    mainTakeaway: "The script has a clear problem and payoff.",
    currentPath: "/results",
    ...overrides,
  };
}

async function main(): Promise<void> {
  const { POST } = await import("../app/api/feedback/route");

  {
    const response = await POST(
      createRequest(createValidFeedback())
    );
    const json = await expectJson(response);

    if (response.status !== 200 || json.status !== "ok") {
      throw new Error("Valid helpful feedback should be accepted.");
    }

    console.log("PASS — accepts valid helpful feedback");
  }

  {
    const response = await POST(
      createRequest(
        createValidFeedback({
          rating: "unhelpful",
          reason: "Wrong score",
          text: "The score felt too high.",
        })
      )
    );
    const json = await expectJson(response);

    if (response.status !== 200 || json.status !== "ok") {
      throw new Error("Valid unhelpful feedback should be accepted.");
    }

    console.log("PASS — accepts valid unhelpful feedback");
  }

  {
    const response = await POST(
      createRequest(createValidFeedback({ rating: "dislike" }))
    );
    const json = await expectJson(response);

    if (response.status !== 400 || json.status !== "error") {
      throw new Error("Invalid rating should be rejected.");
    }

    console.log("PASS — rejects invalid rating");
  }

  {
    const response = await POST(createRequest("{bad json"));
    const json = await expectJson(response);

    if (response.status !== 400 || json.status !== "error") {
      throw new Error("Malformed JSON should be rejected.");
    }

    console.log("PASS — rejects malformed JSON");
  }

  {
    const response = await POST(
      createRequest(createValidFeedback(), "text/plain")
    );
    const json = await expectJson(response);

    if (response.status !== 400 || json.status !== "error") {
      throw new Error("Non-JSON content type should be rejected.");
    }

    console.log("PASS — rejects non-JSON content type");
  }

  {
    const response = await POST(
      createRequest(createValidFeedback({ script: "x".repeat(1001) }))
    );
    const json = await expectJson(response);

    if (response.status !== 400 || json.status !== "error") {
      throw new Error("Oversized script should be rejected.");
    }

    console.log("PASS — rejects oversized script");
  }

  {
    const beforeCount = persistedFeedbackRequests.length;

    const response = await POST(
      createRequest(
        createValidFeedback({
          locale: "ru",
          reason: "Useful fixes",
        })
      )
    );
    const json = await expectJson(response);

    if (response.status !== 200 || json.status !== "ok") {
      throw new Error("Valid ru-locale feedback should be accepted.");
    }

    if (persistedFeedbackRequests.length !== beforeCount + 1) {
      throw new Error(
        "Expected exactly one new Supabase insert for the ru submission."
      );
    }

    const persisted =
      persistedFeedbackRequests[persistedFeedbackRequests.length - 1]!;

    // The stable canonical (English) reason value must reach Supabase
    // unchanged — never a localized RU label.
    if (persisted.reason !== "Useful fixes") {
      throw new Error(
        `Expected the canonical reason value to be persisted, got ${JSON.stringify(persisted.reason)}.`
      );
    }

    // The feedback table has no locale column (see
    // app/api/admin/feedback/route.ts's explicit select list) — locale
    // must not be written to Supabase.
    if ("locale" in persisted) {
      throw new Error(
        "locale must not be persisted to Supabase — the feedback table has no locale column."
      );
    }

    console.log(
      "PASS — accepts ru-locale feedback with the stable canonical reason value, and does not persist a locale column"
    );
  }

  {
    const enResponse = await POST(
      createRequest(
        createValidFeedback({ locale: "en", reason: "Useful fixes" })
      )
    );
    const enJson = await expectJson(enResponse);

    const ruResponse = await POST(
      createRequest(
        createValidFeedback({ locale: "ru", reason: "Useful fixes" })
      )
    );
    const ruJson = await expectJson(ruResponse);

    if (
      enResponse.status !== ruResponse.status ||
      enJson.status !== ruJson.status ||
      enResponse.status !== 200 ||
      enJson.status !== "ok"
    ) {
      throw new Error(
        "en and ru submissions of otherwise-identical feedback must behave identically."
      );
    }

    console.log(
      "PASS — en and ru submissions of the same feedback behave identically"
    );
  }

  {
    const response = await POST(
      createRequest(createValidFeedback({ locale: "not-a-real-locale" }))
    );
    const json = await expectJson(response);

    if (response.status !== 200 || json.status !== "ok") {
      throw new Error(
        "An invalid locale value must default safely, not reject the submission."
      );
    }

    console.log(
      "PASS — an invalid/garbage locale value defaults safely instead of rejecting the submission"
    );
  }

  {
    simulateSupabaseFailure = true;

    let response: Response;

    try {
      response = await POST(createRequest(createValidFeedback()));
    } finally {
      simulateSupabaseFailure = false;
    }

    const json = await expectJson(response);
    const serialized = JSON.stringify(json);

    if (response.status !== 500 || json.status !== "error") {
      throw new Error(
        "A database failure must return a safe generic error, not a success."
      );
    }

    if (
      serialized.includes("SIMULATED_FAILURE") ||
      serialized.includes("Simulated database failure") ||
      /ENOTFOUND|getaddrinfo|supabase\.co|fetch failed/i.test(
        serialized
      )
    ) {
      throw new Error(
        "The raw Supabase/database error must never reach the client response."
      );
    }

    console.log(
      "PASS — a database failure returns a safe generic error without leaking the raw Supabase error"
    );
  }

  {
    const originalConsoleInfo = console.info;
    const loggedCalls: unknown[][] = [];

    console.info = (...args: unknown[]) => {
      loggedCalls.push(args);
    };

    const secretScript =
      "UNIQUE_SECRET_SCRIPT_TOKEN_44219 do not log this script text";
    const secretTitle = "UNIQUE_SECRET_TITLE_TOKEN_55330";
    const secretTakeaway =
      "UNIQUE_SECRET_TAKEAWAY_TOKEN_66441";
    const secretCustomText =
      "UNIQUE_SECRET_CUSTOM_TEXT_TOKEN_77552";

    try {
      const response = await POST(
        createRequest(
          createValidFeedback({
            locale: "ru",
            rating: "unhelpful",
            reason: "Wrong score",
            text: secretCustomText,
            title: secretTitle,
            script: secretScript,
            mainTakeaway: secretTakeaway,
          })
        )
      );

      await expectJson(response);
    } finally {
      console.info = originalConsoleInfo;
    }

    const serializedLogs = JSON.stringify(loggedCalls);

    if (
      serializedLogs.includes(secretScript) ||
      serializedLogs.includes(secretTitle) ||
      serializedLogs.includes(secretTakeaway) ||
      serializedLogs.includes(secretCustomText)
    ) {
      throw new Error(
        "Structured feedback logs must never include script, title, mainTakeaway, or free-form custom text."
      );
    }

    if (
      !serializedLogs.includes("\"rating\"") ||
      !serializedLogs.includes("\"locale\":\"ru\"") ||
      !serializedLogs.includes("\"hasCustomText\":true")
    ) {
      throw new Error(
        "Structured feedback logs must still include rating, locale, and hasCustomText."
      );
    }

    console.log(
      "PASS — structured feedback log excludes script/title/mainTakeaway/custom text while keeping rating/locale/hasCustomText"
    );
  }

  if (persistedFeedbackRequests.length !== 7) {
    throw new Error(
      `Expected exactly 7 mocked Supabase inserts, received ${persistedFeedbackRequests.length}.`
    );
  }

  console.log(
    "PASS — persists only valid feedback through mocked Supabase"
  );
  console.log("\nFeedback API tests: all passed");
  restoreTestEnvironment();
}

main().catch((error: unknown) => {
  restoreTestEnvironment();

  const message =
    error instanceof Error ? error.message : "Unknown test failure.";

  console.error(`\nFeedback API tests failed: ${message}`);
  process.exitCode = 1;
});
