const originalFetch = globalThis.fetch;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalAdminPassword = process.env.ADMIN_PASSWORD;

process.env.SUPABASE_URL = "https://admin-feedback-test.supabase.co";
process.env.SUPABASE_SECRET_KEY = "admin-feedback-test-secret";

// A unique marker planted in every mocked row's private fields — any
// denial response (401/503) that leaked this string would prove private
// feedback content escaped before authorization succeeded.
const SECRET_MARKER = "UNIQUE_ADMIN_FEEDBACK_SECRET_TOKEN_99123";

let supabaseFetchCallCount = 0;

const mockedFeedbackRow = {
  id: 1,
  rating: "unhelpful",
  reason: "Wrong score",
  text: SECRET_MARKER,
  title: SECRET_MARKER,
  script_preview: SECRET_MARKER,
  overall_score: 40,
  hook_score: 30,
  retention_risk: 70,
  main_takeaway: SECRET_MARKER,
  current_path: "/results",
  created_at: "2026-01-01T00:00:00.000Z",
};

globalThis.fetch = (async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const method = (
    init?.method ??
    (input instanceof Request ? input.method : undefined) ??
    "GET"
  ).toUpperCase();

  if (!url.includes("/rest/v1/feedback") || method !== "GET") {
    throw new Error(`Unexpected Supabase request: ${method} ${url}`);
  }

  supabaseFetchCallCount += 1;

  return new Response(JSON.stringify([mockedFeedbackRow]), {
    status: 200,
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
    process.env.SUPABASE_SECRET_KEY = originalSupabaseSecretKey;
  }

  if (originalAdminUsername === undefined) {
    delete process.env.ADMIN_USERNAME;
  } else {
    process.env.ADMIN_USERNAME = originalAdminUsername;
  }

  if (originalAdminPassword === undefined) {
    delete process.env.ADMIN_PASSWORD;
  } else {
    process.env.ADMIN_PASSWORD = originalAdminPassword;
  }
}

function createBasicAuthorization(username: string, password: string): string {
  const encoded = Buffer.from(`${username}:${password}`, "utf8").toString(
    "base64"
  );

  return `Basic ${encoded}`;
}

function createRequest(authorization?: string): Request {
  const headers = new Headers();

  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }

  return new Request("http://localhost/api/admin/feedback", { headers });
}

async function expectJson(response: Response): Promise<Record<string, unknown>> {
  const json = (await response.json()) as unknown;

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("Expected JSON object response.");
  }

  return json as Record<string, unknown>;
}

function assertNoSecretLeak(response: Response, serializedBody: string): void {
  if (serializedBody.includes(SECRET_MARKER)) {
    throw new Error(
      "Denial response must never include feedback row content."
    );
  }

  if (response.headers.get("cache-control") !== "no-store") {
    throw new Error("Response must be marked Cache-Control: no-store.");
  }
}

async function main(): Promise<void> {
  const { GET } = await import("../app/api/admin/feedback/route");

  // --- misconfigured: no ADMIN_USERNAME/ADMIN_PASSWORD at all ---
  {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;

    const before = supabaseFetchCallCount;
    const response = await GET(createRequest());
    const json = await expectJson(response);
    const serialized = JSON.stringify(json);

    if (response.status !== 503 || json.status !== "error") {
      throw new Error(
        "Misconfigured admin access should return 503 with an error status."
      );
    }

    assertNoSecretLeak(response, serialized);

    if (supabaseFetchCallCount !== before) {
      throw new Error(
        "Supabase must not be queried when admin access is misconfigured."
      );
    }

    console.log(
      "PASS — misconfigured admin access returns 503, no data, no Supabase query"
    );
  }

  process.env.ADMIN_USERNAME = "admin-test";
  process.env.ADMIN_PASSWORD = "correct:test-password";

  // --- unauthenticated: no Authorization header ---
  {
    const before = supabaseFetchCallCount;
    const response = await GET(createRequest());
    const json = await expectJson(response);
    const serialized = JSON.stringify(json);

    if (response.status !== 401 || json.status !== "error") {
      throw new Error(
        "Missing credentials should return 401 with an error status."
      );
    }

    if (
      !response.headers.get("www-authenticate")?.startsWith(
        'Basic realm="Climpy Admin"'
      )
    ) {
      throw new Error(
        "401 response should include a Basic Auth challenge."
      );
    }

    assertNoSecretLeak(response, serialized);

    if (supabaseFetchCallCount !== before) {
      throw new Error(
        "Supabase must not be queried when no credentials are provided."
      );
    }

    console.log(
      "PASS — missing credentials return 401, no data, no Supabase query"
    );
  }

  // --- authenticated but wrong credentials ---
  {
    const before = supabaseFetchCallCount;
    const response = await GET(
      createRequest(createBasicAuthorization("admin-test", "wrong-password"))
    );
    const json = await expectJson(response);
    const serialized = JSON.stringify(json);

    if (response.status !== 401 || json.status !== "error") {
      throw new Error(
        "Incorrect credentials should return 401 with an error status."
      );
    }

    assertNoSecretLeak(response, serialized);

    if (supabaseFetchCallCount !== before) {
      throw new Error(
        "Supabase must not be queried when credentials are incorrect."
      );
    }

    console.log(
      "PASS — incorrect credentials return 401, no data, no Supabase query"
    );
  }

  // --- authorized: correct credentials ---
  {
    const before = supabaseFetchCallCount;
    const response = await GET(
      createRequest(
        createBasicAuthorization("admin-test", "correct:test-password")
      )
    );
    const json = await expectJson(response);

    if (response.status !== 200 || json.status !== "ok") {
      throw new Error(
        "Correct credentials should return 200 with status ok."
      );
    }

    if (response.headers.get("cache-control") !== "no-store") {
      throw new Error(
        "Authorized response must also be Cache-Control: no-store."
      );
    }

    if (!Array.isArray(json.feedback) || json.feedback.length !== 1) {
      throw new Error(
        "Expected the existing feedback array response shape to be preserved."
      );
    }

    const row = json.feedback[0] as Record<string, unknown>;

    if (row.script_preview !== SECRET_MARKER || row.id !== 1) {
      throw new Error(
        "Authorized response should return the mocked feedback row unchanged."
      );
    }

    if (supabaseFetchCallCount !== before + 1) {
      throw new Error(
        "Expected exactly one Supabase query for the authorized request."
      );
    }

    console.log(
      "PASS — correct credentials return 200 with the existing feedback response shape"
    );
  }

  console.log("\nAdmin feedback API tests: all passed");
  restoreTestEnvironment();
}

main().catch((error: unknown) => {
  restoreTestEnvironment();

  const message = error instanceof Error ? error.message : "Unknown test failure.";

  console.error(`\nAdmin feedback API tests failed: ${message}`);
  process.exitCode = 1;
});
