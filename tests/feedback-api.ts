import { config } from "dotenv";

config({ path: ".env.local" });

const originalFetch = globalThis.fetch;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const persistedFeedbackRequests: Record<string, unknown>[] = [];

process.env.SUPABASE_URL = "https://feedback-test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "feedback-test-secret";

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

  if (persistedFeedbackRequests.length !== 2) {
    throw new Error(
      `Expected exactly 2 mocked Supabase inserts, received ${persistedFeedbackRequests.length}.`
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
