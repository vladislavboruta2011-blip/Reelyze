import { readFileSync } from "node:fs";
import type {
  TranscriptError,
  TranscriptErrorCode,
  TranscriptProvider,
  TranscriptProviderResult,
} from "../lib/competitor-scripts/transcript/types";

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
const FAKE_SUPADATA_KEY = "sd_test_fake_key_never_real";

function jsonRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/competitor-scripts/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function stubProvider(
  responder: (videoId: string) => TranscriptProviderResult | Promise<TranscriptProviderResult>
): { provider: TranscriptProvider; calls: string[] } {
  const calls: string[] = [];
  const provider: TranscriptProvider = {
    async getTranscript({ videoId }) {
      calls.push(videoId);
      return responder(videoId);
    },
  };
  return { provider, calls };
}

function throwingProvider(): TranscriptProvider {
  return {
    async getTranscript() {
      throw new Error("simulated unexpected provider failure");
    },
  };
}

function makeTranscriptError(code: TranscriptErrorCode): TranscriptError {
  const table: Record<TranscriptErrorCode, string> = {
    transcript_not_found: "not found",
    transcript_disabled: "disabled",
    transcript_unavailable: "unavailable",
    unsupported_language: "unsupported language",
    video_unavailable: "video unavailable",
    provider_rate_limited: "rate limited",
    provider_timeout: "timeout",
    provider_unavailable: "provider unavailable",
    invalid_provider_response: "invalid response",
  };
  return { code, message: table[code], retryable: false };
}

async function testRoute() {
  const { POST, runCompetitorScriptsAnalyze } = await import(
    "../app/api/competitor-scripts/analyze/route"
  );

  const originalFetch = globalThis.fetch;
  let fetchCalled: boolean = false;
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
    // ── Request validation is unchanged — every invalid request must
    //    still fail before any transcript/provider logic runs ─────────

    fetchCalled = false;
    infoCalls = [];
    const missingUrlResponse = await POST(jsonRequest({}));
    check("missing url field returns 400", missingUrlResponse.status === 400);
    const missingUrlBody = await missingUrlResponse.json();
    check(
      "missing url field has code missing_url",
      missingUrlBody.ok === false && missingUrlBody.error.code === "missing_url"
    );
    check("no provider/network call for a missing url", fetchCalled === false);

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
    check("no provider/network call for an invalid host", fetchCalled === false);

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
    check(
      "no provider/network call occurred for any invalid request",
      fetchCalled === false
    );

    // ── Default (production) composition, no env key configured ────────
    // The general test process never sets SUPADATA_API_KEY, so a valid
    // request through the real POST handler must fail safely — this is
    // exactly the behavior a misconfigured deployment would see.

    fetchCalled = false;
    infoCalls = [];
    const noKeyResponse = await POST(
      jsonRequest({ url: `https://www.youtube.com/watch?v=${STANDARD_ID}` })
    );
    check(
      "a valid request with no SUPADATA_API_KEY configured returns 503",
      noKeyResponse.status === 503
    );
    const noKeyBody = await noKeyResponse.json();
    check(
      "the missing-config response uses the generic transcript_service_unavailable code",
      noKeyBody.ok === false &&
        noKeyBody.error.code === "transcript_service_unavailable"
    );
    check(
      "the missing-config response never mentions env vars, keys, or Supadata",
      !/env|SUPADATA_API_KEY|api.?key|supadata/i.test(JSON.stringify(noKeyBody))
    );
    check("no provider/network call when no key is configured", fetchCalled === false);
    check(
      "the request-validated log still fires exactly once even though the transcript fetch fails",
      infoCalls.length === 1
    );
    check(
      "the request-validated log never contains the raw submitted URL",
      !JSON.stringify(infoCalls[0]).includes("youtube.com/watch")
    );

    // ── Environment isolation: missing / empty / whitespace key ────────

    async function withSupadataApiKey<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
      const original = process.env.SUPADATA_API_KEY;
      if (value === undefined) {
        delete process.env.SUPADATA_API_KEY;
      } else {
        process.env.SUPADATA_API_KEY = value;
      }
      try {
        return await fn();
      } finally {
        if (original === undefined) {
          delete process.env.SUPADATA_API_KEY;
        } else {
          process.env.SUPADATA_API_KEY = original;
        }
      }
    }

    for (const [label, value] of [
      ["missing", undefined],
      ["empty string", ""],
      ["whitespace-only", "   "],
    ] as const) {
      fetchCalled = false;
      const outcome = await withSupadataApiKey(value, () =>
        runCompetitorScriptsAnalyze(
          STANDARD_ID,
          `https://www.youtube.com/watch?v=${STANDARD_ID}`,
          "watch"
        )
      );
      check(
        `a ${label} SUPADATA_API_KEY causes zero provider calls and a safe 503`,
        fetchCalled === false &&
          outcome.status === 503 &&
          !outcome.body.ok &&
          outcome.body.error.code === "transcript_service_unavailable"
      );
    }

    // A configured (fake) key must reach the real provider construction
    // and call path — proven by the mocked global fetch actually firing —
    // while still never completing a real network request and never
    // leaking the key anywhere.
    {
      fetchCalled = false;
      const outcome = await withSupadataApiKey(FAKE_SUPADATA_KEY, () =>
        runCompetitorScriptsAnalyze(
          STANDARD_ID,
          `https://www.youtube.com/watch?v=${STANDARD_ID}`,
          "watch"
        )
      );
      check(
        "a configured key reaches the real provider, which attempts a fetch call",
        fetchCalled
      );
      check(
        "the real-provider path still fails safely (503) since fetch is mocked to throw",
        outcome.status === 503 && !outcome.body.ok && outcome.body.error.code === "transcript_service_unavailable"
      );
      check(
        "the configured API key never appears in the response",
        !JSON.stringify(outcome.body).includes(FAKE_SUPADATA_KEY)
      );
    }

    // ── Successful transcript mapping, via the DI seam ──────────────────

    {
      const { provider, calls } = stubProvider(() => ({
        ok: true,
        transcript: {
          videoId: STANDARD_ID,
          languageCode: "en",
          isAutoGenerated: null,
          segments: [{ text: "hello world", startMs: 0, durationMs: 500 }],
          text: "hello world",
          durationMs: 500,
        },
      }));

      const outcome = await runCompetitorScriptsAnalyze(
        STANDARD_ID,
        `https://www.youtube.com/watch?v=${STANDARD_ID}`,
        "watch",
        provider
      );

      check("a successful transcript fetch returns 200", outcome.status === 200);
      check(
        "the success response has the exact expected shape",
        outcome.body.ok === true &&
          outcome.body.status === "transcript_ready" &&
          outcome.body.input.videoId === STANDARD_ID &&
          outcome.body.input.canonicalUrl === `https://www.youtube.com/watch?v=${STANDARD_ID}` &&
          outcome.body.input.sourceFormat === "watch" &&
          outcome.body.transcript.languageCode === "en" &&
          outcome.body.transcript.isAutoGenerated === null &&
          outcome.body.transcript.text === "hello world" &&
          outcome.body.transcript.durationMs === 500 &&
          outcome.body.transcript.segments.length === 1
      );
      check(
        "the transcript object never duplicates videoId",
        outcome.body.ok === true && !("videoId" in outcome.body.transcript)
      );
      check(
        "the success response contains only approved top-level fields",
        outcome.body.ok === true &&
          JSON.stringify(Object.keys(outcome.body).sort()) ===
            JSON.stringify(["ok", "input", "transcript", "status"].sort())
      );
      check(
        "the transcript object contains only approved fields",
        outcome.body.ok === true &&
          JSON.stringify(Object.keys(outcome.body.transcript).sort()) ===
            JSON.stringify(
              ["languageCode", "isAutoGenerated", "segments", "text", "durationMs"].sort()
            )
      );
      check(
        "the success response never contains score, creator, metric, analysis, provider, or jobId fields",
        !/score|creator|metric|analysis|provider|jobid|supadata/i.test(
          JSON.stringify(outcome.body)
        )
      );
      check("the provider is called exactly once", calls.length === 1);
      check("the provider receives exactly the videoId", calls[0] === STANDARD_ID);
    }

    // sourceFormat threading for each supported input format
    for (const sourceFormat of ["watch", "shorts", "short"] as const) {
      const { provider } = stubProvider(() => ({
        ok: true,
        transcript: {
          videoId: STANDARD_ID,
          languageCode: null,
          isAutoGenerated: null,
          segments: [{ text: "x", startMs: 0, durationMs: null }],
          text: "x",
          durationMs: null,
        },
      }));
      const outcome = await runCompetitorScriptsAnalyze(
        STANDARD_ID,
        `https://www.youtube.com/watch?v=${STANDARD_ID}`,
        sourceFormat,
        provider
      );
      check(
        `sourceFormat "${sourceFormat}" is threaded through to the response input`,
        outcome.body.ok === true && outcome.body.input.sourceFormat === sourceFormat
      );
    }

    // multi-segment / duration preservation
    {
      const { provider } = stubProvider(() => ({
        ok: true,
        transcript: {
          videoId: STANDARD_ID,
          languageCode: "fr",
          isAutoGenerated: true,
          segments: [
            { text: "first", startMs: 0, durationMs: 500 },
            { text: "second", startMs: 500, durationMs: 700 },
          ],
          text: "first second",
          durationMs: 1200,
        },
      }));
      const outcome = await runCompetitorScriptsAnalyze(
        STANDARD_ID,
        `https://www.youtube.com/watch?v=${STANDARD_ID}`,
        "watch",
        provider
      );
      check(
        "multiple segments, language, isAutoGenerated, and duration are all preserved",
        outcome.body.ok === true &&
          outcome.body.transcript.segments.length === 2 &&
          outcome.body.transcript.languageCode === "fr" &&
          outcome.body.transcript.isAutoGenerated === true &&
          outcome.body.transcript.durationMs === 1200
      );
    }

    // ── Every internal TranscriptErrorCode maps to the documented public
    //    code and HTTP status ───────────────────────────────────────────

    const errorMappingCases: Array<{
      internal: TranscriptErrorCode;
      publicCode: string;
      status: number;
    }> = [
      { internal: "transcript_not_found", publicCode: "transcript_not_found", status: 404 },
      { internal: "transcript_disabled", publicCode: "transcript_unavailable", status: 422 },
      { internal: "transcript_unavailable", publicCode: "transcript_unavailable", status: 422 },
      { internal: "unsupported_language", publicCode: "transcript_unavailable", status: 422 },
      { internal: "video_unavailable", publicCode: "video_unavailable", status: 404 },
      { internal: "provider_rate_limited", publicCode: "transcript_rate_limited", status: 429 },
      { internal: "provider_timeout", publicCode: "transcript_timeout", status: 504 },
      { internal: "provider_unavailable", publicCode: "transcript_service_unavailable", status: 503 },
      {
        internal: "invalid_provider_response",
        publicCode: "invalid_transcript_response",
        status: 502,
      },
    ];

    for (const testCase of errorMappingCases) {
      const { provider } = stubProvider(() => ({
        ok: false,
        error: makeTranscriptError(testCase.internal),
      }));
      const outcome = await runCompetitorScriptsAnalyze(
        STANDARD_ID,
        `https://www.youtube.com/watch?v=${STANDARD_ID}`,
        "watch",
        provider
      );
      check(
        `internal "${testCase.internal}" maps to public "${testCase.publicCode}" with status ${testCase.status}`,
        outcome.status === testCase.status &&
          !outcome.body.ok &&
          outcome.body.error.code === testCase.publicCode
      );
      check(
        `the "${testCase.internal}" error response never leaks the internal code, retryable flag, or provider name`,
        !outcome.body.ok &&
          !JSON.stringify(outcome.body).includes("retryable") &&
          !/supadata|provider_/i.test(JSON.stringify(outcome.body))
      );
    }

    // ── Unexpected provider throw ────────────────────────────────────────

    {
      const outcome = await runCompetitorScriptsAnalyze(
        STANDARD_ID,
        `https://www.youtube.com/watch?v=${STANDARD_ID}`,
        "watch",
        throwingProvider()
      );
      check(
        "an unexpected provider throw maps to a safe 503, not an internal error",
        outcome.status === 503 &&
          !outcome.body.ok &&
          outcome.body.error.code === "transcript_service_unavailable"
      );
      check(
        "an unexpected provider throw never exposes the exception message",
        !JSON.stringify(outcome.body).includes("simulated unexpected provider failure")
      );
    }

    // Extra unknown request fields are still ignored, not rejected.
    {
      const { provider } = stubProvider(() => ({
        ok: true,
        transcript: {
          videoId: STANDARD_ID,
          languageCode: "en",
          isAutoGenerated: null,
          segments: [{ text: "x", startMs: 0, durationMs: null }],
          text: "x",
          durationMs: null,
        },
      }));
      void provider;
      const extraFieldsResponse = await POST(
        jsonRequest({
          url: `https://www.youtube.com/watch?v=${STANDARD_ID}`,
          locale: "en",
          transcript: "ignored",
        })
      );
      // No key configured in this general POST path, so this still safely
      // resolves to 503 rather than 400 — proving the extra fields didn't
      // break request parsing/validation itself.
      check(
        "extra unrecognized body fields do not break request validation",
        extraFieldsResponse.status === 503
      );
    }

    // ── Local rate limiting ──────────────────────────────────────────────
    // Every test below uses a distinct, dedicated fake X-Forwarded-For (or
    // X-Real-IP) value so its own bucket never interferes with any other
    // test in this file — the rate limiter's Map is module-level state
    // shared for the lifetime of this test process, exactly like its four
    // sibling routes' rate limiters. The two earlier tests that call POST
    // with no forwarding header at all ("no SUPADATA_API_KEY configured"
    // and "extra unrecognized body fields") each consume one unit of the
    // shared "unknown-client" bucket — well under its limit, accounted for
    // in the "unknown-client fallback" test below.

    {
      const RATE_LIMIT_IP = "203.0.113.201";
      let fetchAttempts = 0;
      const preRateLimitFetch = globalThis.fetch;
      globalThis.fetch = (() => {
        fetchAttempts += 1;
        throw new Error("simulated upstream failure for rate-limit test");
      }) as typeof fetch;

      try {
        await withSupadataApiKey(FAKE_SUPADATA_KEY, async () => {
          for (let i = 0; i < 10; i += 1) {
            const response = await POST(
              jsonRequest(
                { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
                { "X-Forwarded-For": RATE_LIMIT_IP }
              )
            );
            check(
              `request ${i + 1}/10 within the limit is allowed through to the provider layer`,
              response.status === 503
            );
          }
          check(
            "exactly 10 provider/fetch attempts occurred for the 10 allowed requests",
            fetchAttempts === 10
          );

          const limitedResponse = await POST(
            jsonRequest(
              { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
              { "X-Forwarded-For": RATE_LIMIT_IP }
            )
          );
          const limitedBody = await limitedResponse.json();

          check("the 11th request from the same client is rate-limited with 429", limitedResponse.status === 429);
          check(
            "the 429 response uses the local rate_limited code, distinct from transcript_rate_limited",
            limitedBody.ok === false && limitedBody.error.code === "rate_limited"
          );
          check(
            "the 429 response includes a Retry-After header",
            limitedResponse.headers.get("Retry-After") !== null
          );
          check(
            "no additional provider/fetch call occurs once the limit is reached",
            fetchAttempts === 10
          );
          check(
            "the configured API key never appears in the 429 response",
            !JSON.stringify(limitedBody).includes(FAKE_SUPADATA_KEY)
          );
          check(
            "the 429 response never leaks an IP, URL, transcript, provider name, or internal counter",
            !/203\.0\.113|youtube\.com|supadata|provider_|windowStartedAt|"count"/i.test(
              JSON.stringify(limitedBody)
            )
          );
        });
      } finally {
        globalThis.fetch = preRateLimitFetch;
      }
    }

    // Client isolation: one client hitting its limit must not affect another.
    {
      const CLIENT_A_IP = "203.0.113.202";
      const CLIENT_B_IP = "203.0.113.203";

      for (let i = 0; i < 10; i += 1) {
        await POST(
          jsonRequest(
            { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
            { "X-Forwarded-For": CLIENT_A_IP }
          )
        );
      }
      const clientALimited = await POST(
        jsonRequest(
          { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
          { "X-Forwarded-For": CLIENT_A_IP }
        )
      );
      check("client A is rate-limited after exhausting its own quota", clientALimited.status === 429);

      const clientBResponse = await POST(
        jsonRequest(
          { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
          { "X-Forwarded-For": CLIENT_B_IP }
        )
      );
      check(
        "a different client (distinct X-Forwarded-For) is unaffected by client A's limit",
        clientBResponse.status !== 429
      );
    }

    // x-forwarded-for: only the first comma-separated entry is the client
    // identity — a shared trailing hop must not merge two distinct clients.
    {
      const XFF_CLIENT_1 = "203.0.113.204, 203.0.113.205";
      const XFF_CLIENT_2_SAME_FIRST = "203.0.113.204, 203.0.113.206";
      const XFF_CLIENT_3_DIFFERENT_FIRST = "203.0.113.207, 203.0.113.205";

      for (let i = 0; i < 10; i += 1) {
        await POST(
          jsonRequest(
            { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
            { "X-Forwarded-For": XFF_CLIENT_1 }
          )
        );
      }
      const sameFirstEntryResponse = await POST(
        jsonRequest(
          { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
          { "X-Forwarded-For": XFF_CLIENT_2_SAME_FIRST }
        )
      );
      check(
        "only the first X-Forwarded-For entry determines identity — a matching first entry shares the exhausted bucket",
        sameFirstEntryResponse.status === 429
      );

      const differentFirstEntryResponse = await POST(
        jsonRequest(
          { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
          { "X-Forwarded-For": XFF_CLIENT_3_DIFFERENT_FIRST }
        )
      );
      check(
        "a different first X-Forwarded-For entry is treated as a distinct, unaffected client",
        differentFirstEntryResponse.status !== 429
      );
    }

    // x-real-ip fallback, used only when x-forwarded-for is absent.
    {
      const REAL_IP_CLIENT = "203.0.113.208";
      const REAL_IP_OTHER = "203.0.113.210";

      for (let i = 0; i < 10; i += 1) {
        await POST(
          jsonRequest(
            { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
            { "X-Real-IP": REAL_IP_CLIENT }
          )
        );
      }
      const realIpLimited = await POST(
        jsonRequest(
          { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
          { "X-Real-IP": REAL_IP_CLIENT }
        )
      );
      check("x-real-ip is honored as the fallback client identifier", realIpLimited.status === 429);

      const otherRealIpResponse = await POST(
        jsonRequest(
          { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
          { "X-Real-IP": REAL_IP_OTHER }
        )
      );
      check(
        "a different x-real-ip value is treated as a distinct client",
        otherRealIpResponse.status !== 429
      );
    }

    // Unknown-client fallback: requests with no forwarding header at all
    // deterministically share the same "unknown-client" bucket. Kept to a
    // small number of requests here — this bucket is also touched by two
    // earlier tests in this file, and the shared total must stay well
    // under the limit.
    {
      const unknownClientResponse1 = await POST(
        jsonRequest({ url: `https://www.youtube.com/watch?v=${STANDARD_ID}` })
      );
      const unknownClientResponse2 = await POST(
        jsonRequest({ url: `https://www.youtube.com/watch?v=${STANDARD_ID}` })
      );
      check(
        "requests with no forwarding header at all fall back deterministically to the same unknown-client bucket, without crashing or being spuriously rate-limited",
        unknownClientResponse1.status !== 429 && unknownClientResponse2.status !== 429
      );
    }

    // Window reset: no real-time wait — Date.now is monkey-patched, the
    // same style already used in tests/competitor-scripts-supadata-provider.ts
    // for deterministic timer behavior, so route.ts needs no test-only export.
    {
      const WINDOW_RESET_IP = "203.0.113.209";
      const originalDateNow = Date.now;
      let mockedNow = originalDateNow();
      Date.now = () => mockedNow;

      try {
        for (let i = 0; i < 10; i += 1) {
          await POST(
            jsonRequest(
              { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
              { "X-Forwarded-For": WINDOW_RESET_IP }
            )
          );
        }
        const withinWindowLimited = await POST(
          jsonRequest(
            { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
            { "X-Forwarded-For": WINDOW_RESET_IP }
          )
        );
        check("the client is rate-limited within the same window", withinWindowLimited.status === 429);

        mockedNow += 60_000;

        const afterWindowResponse = await POST(
          jsonRequest(
            { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
            { "X-Forwarded-For": WINDOW_RESET_IP }
          )
        );
        check(
          "the same client is allowed again once the window has elapsed, with no real-time wait",
          afterWindowResponse.status !== 429
        );
      } finally {
        Date.now = originalDateNow;
      }
    }

    // Invalid requests must never consume rate-limit quota — confirmed by
    // exhausting a dedicated client entirely with invalid requests and then
    // confirming a subsequent valid request from that same client still
    // succeeds through to the provider layer instead of being 429'd.
    {
      const INVALID_ONLY_IP = "203.0.113.211";

      for (let i = 0; i < 15; i += 1) {
        await POST(
          jsonRequest({ url: "https://vimeo.com/watch?v=" + STANDARD_ID }, { "X-Forwarded-For": INVALID_ONLY_IP })
        );
      }
      const validAfterManyInvalid = await POST(
        jsonRequest(
          { url: `https://www.youtube.com/watch?v=${STANDARD_ID}` },
          { "X-Forwarded-For": INVALID_ONLY_IP }
        )
      );
      check(
        "15 invalid (pre-limiter) requests from one client never consume that client's rate-limit quota",
        validAfterManyInvalid.status !== 429
      );
    }

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

// ── Compare Scripts and the Analyze frontend are untouched by this
//    server-only wiring PR ─────────────────────────────────────────────

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
  "the analyze route never calls OpenAI or Supabase",
  !/openai|supabase|createSupabaseServerClient/i.test(routeSource)
);
check(
  "the analyze route never logs the raw request body or full URL variable",
  !/console\.(info|error|log)\([^)]*\burl\b[^)]*\)/.test(
    routeSource.replace(/\/\/.*$/gm, "")
  )
);
check(
  "the analyze route never reads any env var other than SUPADATA_API_KEY",
  (routeSource.match(/process\.env\.[A-Z0-9_]+/g) ?? []).every(
    (match) => match === "process.env.SUPADATA_API_KEY"
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
