import { readFileSync } from "node:fs";

let failures = 0;

// Captured before testRoute() mocks console.info/error to observe the
// route's own logging — the check() helper must always print through the
// real console, never through a mock that would swallow FAIL output.
const realConsoleLog = console.log;
const realConsoleError = console.error;

function check(name: string, condition: boolean): void {
  if (condition) {
    realConsoleLog(`✅ PASS — ${name}`);
  } else {
    realConsoleError(`❌ FAIL — ${name}`);
    failures += 1;
  }
}

console.log("\nCompetitor Scripts Analyze API Tests\n");

const STANDARD_ID = "dQw4w9WgXcQ";

function jsonRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/competitor-scripts/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function testRoute() {
  const { POST } = await import(
    "../app/api/competitor-scripts/analyze/route"
  );

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = ((...args: unknown[]) => {
    fetchCalled = true;
    throw new Error(`unexpected network call: ${JSON.stringify(args)}`);
  }) as typeof fetch;

  const originalConsoleInfo = console.info;
  const originalConsoleError = console.error;
  let infoCalls: unknown[][] = [];
  const errorCalls: unknown[][] = [];
  console.info = (...args: unknown[]) => {
    infoCalls.push(args);
  };
  console.error = (...args: unknown[]) => {
    errorCalls.push(args);
  };

  try {
    // ── Valid requests ─────────────────────────────────────────────────

    fetchCalled = false;
    infoCalls = [];
    const watchResponse = await POST(
      jsonRequest({ url: `https://www.youtube.com/watch?v=${STANDARD_ID}` })
    );
    const watchBody = await watchResponse.json();

    check("valid watch URL returns 200", watchResponse.status === 200);
    check(
      "valid watch URL response has the exact success shape",
      watchBody.ok === true &&
        watchBody.status === "validated" &&
        watchBody.input.videoId === STANDARD_ID &&
        watchBody.input.canonicalUrl ===
          `https://www.youtube.com/watch?v=${STANDARD_ID}` &&
        watchBody.input.sourceFormat === "watch"
    );
    check("no network call is made for a valid request", fetchCalled === false);
    check("a successful request logs exactly once", infoCalls.length === 1);
    check(
      "the success log never contains the raw submitted URL",
      infoCalls.length === 1 &&
        !JSON.stringify(infoCalls[0]).includes("youtube.com/watch")
    );

    fetchCalled = false;
    const shortsResponse = await POST(
      jsonRequest({ url: `https://youtube.com/shorts/${STANDARD_ID}` })
    );
    const shortsBody = await shortsResponse.json();
    check(
      "valid Shorts URL returns 200 with sourceFormat shorts",
      shortsResponse.status === 200 && shortsBody.input.sourceFormat === "shorts"
    );
    check("no network call is made for a Shorts request", fetchCalled === false);

    const shortResponse = await POST(
      jsonRequest({ url: `https://youtu.be/${STANDARD_ID}` })
    );
    const shortBody = await shortResponse.json();
    check(
      "valid youtu.be URL returns 200 with sourceFormat short",
      shortResponse.status === 200 && shortBody.input.sourceFormat === "short"
    );

    // Extra unknown fields are ignored, not rejected.
    const extraFieldsResponse = await POST(
      jsonRequest({
        url: `https://www.youtube.com/watch?v=${STANDARD_ID}`,
        locale: "en",
        transcript: "ignored",
      })
    );
    check(
      "extra unrecognized body fields do not break a valid request",
      extraFieldsResponse.status === 200
    );

    // ── Response never contains anything beyond validated input ─────────

    check(
      "the success response never contains transcript, score, creator, or metric fields",
      !/transcript|score|creator|metric|analysis/i.test(
        JSON.stringify(watchBody)
      )
    );

    // ── Invalid requests ──────────────────────────────────────────────

    const missingUrlResponse = await POST(jsonRequest({}));
    check("missing url field returns 400", missingUrlResponse.status === 400);
    const missingUrlBody = await missingUrlResponse.json();
    check(
      "missing url field has code missing_url",
      missingUrlBody.ok === false && missingUrlBody.error.code === "missing_url"
    );

    const nonStringUrlResponse = await POST(jsonRequest({ url: 12345 }));
    check("non-string url returns 400", nonStringUrlResponse.status === 400);
    const nonStringUrlBody = await nonStringUrlResponse.json();
    check(
      "non-string url has code url_not_string",
      nonStringUrlBody.error.code === "url_not_string"
    );

    const emptyUrlResponse = await POST(jsonRequest({ url: "" }));
    check("empty url string returns 400", emptyUrlResponse.status === 400);

    const invalidHostResponse = await POST(
      jsonRequest({ url: "https://vimeo.com/watch?v=" + STANDARD_ID })
    );
    check(
      "non-YouTube domain returns 400 with code unsupported_host",
      invalidHostResponse.status === 400
    );
    const invalidHostBody = await invalidHostResponse.json();
    check(
      "non-YouTube domain error code is unsupported_host",
      invalidHostBody.error.code === "unsupported_host"
    );

    const malformedJsonResponse = await POST(
      jsonRequest("{not valid json")
    );
    check("malformed JSON returns 400", malformedJsonResponse.status === 400);
    const malformedJsonBody = await malformedJsonResponse.json();
    check(
      "malformed JSON error code is invalid_json",
      malformedJsonBody.error.code === "invalid_json"
    );
    check(
      "malformed JSON never surfaces a raw stack trace",
      !JSON.stringify(malformedJsonBody).toLowerCase().includes("at object")
    );

    const wrongContentTypeResponse = await POST(
      new Request("http://localhost/api/competitor-scripts/analyze", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ url: `https://youtu.be/${STANDARD_ID}` }),
      })
    );
    check(
      "wrong content type is rejected with 415",
      wrongContentTypeResponse.status === 415
    );

    const oversizedResponse = await POST(
      jsonRequest({ url: "https://youtu.be/" + "A".repeat(3_000) })
    );
    check(
      "excessively long url is rejected with 400",
      oversizedResponse.status === 400
    );
    const oversizedBody = await oversizedResponse.json();
    check(
      "excessively long url error code is url_too_long",
      oversizedBody.error.code === "url_too_long"
    );

    const oversizedBodyResponse = await POST(
      jsonRequest({ url: "https://youtu.be/" + "A".repeat(20_000) })
    );
    check(
      "a request body exceeding the byte limit is rejected with 413",
      oversizedBodyResponse.status === 413
    );

    const arrayBodyResponse = await POST(jsonRequest([1, 2, 3]));
    check(
      "a JSON array body is rejected as an invalid body shape",
      arrayBodyResponse.status === 400
    );

    check("no unexpected error was logged", errorCalls.length === 0);

    // ── Method availability (405 handled naturally by the App Router) ───

    const routeModule: Record<string, unknown> = await import(
      "../app/api/competitor-scripts/analyze/route"
    );
    check(
      "the route exports only POST — no GET/PUT/DELETE handler exists",
      typeof routeModule.POST === "function" &&
        routeModule.GET === undefined &&
        routeModule.PUT === undefined &&
        routeModule.DELETE === undefined
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalConsoleInfo;
    console.error = originalConsoleError;
  }
}

// ── Compare Scripts is untouched by this backend PR ───────────────────────

check(
  "the Compare Scripts input form does not reference the new analyze API route",
  !readFileSync(
    "app/competitor-scripts/compare/compare-input-form.tsx",
    "utf8"
  ).includes("/api/competitor-scripts/analyze")
);

check(
  "the Analyze Competitor form is not yet wired to the new API route",
  !readFileSync(
    "app/competitor-scripts/analyze/analyze-input-form.tsx",
    "utf8"
  ).includes("/api/competitor-scripts/analyze")
);

const routeSource = readFileSync(
  "app/api/competitor-scripts/analyze/route.ts",
  "utf8"
);
check(
  "the analyze route never calls fetch, OpenAI, or Supabase",
  !/openai|supabase|createSupabaseServerClient|await fetch\(/i.test(routeSource)
);
check(
  "the analyze route never logs the raw request body or full URL variable",
  !/console\.(info|error|log)\([^)]*\burl\b[^)]*\)/.test(
    routeSource.replace(/\/\/.*$/gm, "")
  )
);

async function main() {
  await testRoute();

  if (failures > 0) {
    process.exitCode = 1;
  } else {
    console.log(
      "\nResult: all Competitor Scripts Analyze API tests passed."
    );
  }
}

void main();
