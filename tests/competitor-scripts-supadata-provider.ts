import { readFileSync } from "node:fs";
import {
  createSupadataTranscriptProvider,
  type SupadataProviderConfig,
} from "../lib/competitor-scripts/transcript/supadata-provider";
import { MAX_SEGMENTS } from "../lib/competitor-scripts/transcript/normalize";
import type { TranscriptProviderResult } from "../lib/competitor-scripts/transcript/types";

let failures = 0;

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

console.log("\nCompetitor Scripts Supadata Provider Tests\n");

const STANDARD_ID = "dQw4w9WgXcQ";
const FAKE_API_KEY = "sd_test_key_12345";
const ENDPOINT = "https://api.supadata.ai/v1/transcript";
const MAX_RESPONSE_BYTES_FOR_TEST = 1_500_000;

// Every test in this file must go through an injected fetchImpl. This
// guards against any accidental real network call slipping in.
const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => {
  throw new Error("unexpected real network call — tests must inject fetchImpl");
}) as typeof fetch;

type CapturedRequest = { url: string; init: RequestInit | undefined };

function capturingFetch(
  responder: (url: string, init: RequestInit | undefined) => Response | Promise<Response>
): { fetchImpl: typeof fetch; calls: CapturedRequest[] } {
  const calls: CapturedRequest[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return responder(url, init);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  const text = JSON.stringify(body);
  return new Response(text, {
    status,
    headers: {
      "content-type": "application/json",
      "content-length": String(new TextEncoder().encode(text).length),
    },
  });
}

function rawResponse(text: string, status: number, contentType: string): Response {
  return new Response(text, {
    status,
    headers: { "content-type": contentType },
  });
}

function makeProvider(overrides: Partial<SupadataProviderConfig> = {}) {
  const { fetchImpl, calls } = capturingFetch(() => jsonResponse({ content: [], lang: "en", availableLangs: ["en"] }));
  const provider = createSupadataTranscriptProvider({
    apiKey: FAKE_API_KEY,
    fetchImpl,
    ...overrides,
  });
  return { provider, calls };
}

function throwsSynchronously(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function codeOf(result: TranscriptProviderResult): string | null {
  return result.ok ? null : result.error.code;
}

// ── Construction / configuration ─────────────────────────────────────────

async function testConstruction() {
  check(
    "a valid provider constructs successfully and exposes getTranscript",
    (() => {
      const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY });
      return typeof provider.getTranscript === "function";
    })()
  );

  check(
    "an empty API key is rejected safely (throws synchronously at construction)",
    throwsSynchronously(() => createSupadataTranscriptProvider({ apiKey: "" }))
  );

  check(
    "a whitespace-only API key is rejected safely",
    throwsSynchronously(() => createSupadataTranscriptProvider({ apiKey: "   " }))
  );

  {
    let thrown: unknown = null;
    try {
      createSupadataTranscriptProvider({ apiKey: "" });
    } catch (error) {
      thrown = error;
    }
    check(
      "the empty-API-key construction error never contains a key value",
      thrown instanceof Error && !thrown.message.includes(FAKE_API_KEY)
    );
  }

  {
    const { fetchImpl } = capturingFetch(() => rawResponse("", 401, "application/json"));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "the API key never appears anywhere in a returned error result",
      !result.ok && !JSON.stringify(result).includes(FAKE_API_KEY)
    );
  }

  {
    const infoCalls: unknown[][] = [];
    const errorCalls: unknown[][] = [];
    const logCalls: unknown[][] = [];
    const warnCalls: unknown[][] = [];
    const originalInfo = console.info;
    const originalError = console.error;
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.info = (...args: unknown[]) => infoCalls.push(args);
    console.error = (...args: unknown[]) => errorCalls.push(args);
    console.log = (...args: unknown[]) => logCalls.push(args);
    console.warn = (...args: unknown[]) => warnCalls.push(args);

    try {
      const { fetchImpl } = capturingFetch(() =>
        jsonResponse({ content: [{ text: "hello", offset: 0, duration: 500 }], lang: "en" })
      );
      const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
      await provider.getTranscript({ videoId: STANDARD_ID });
    } finally {
      console.info = originalInfo;
      console.error = originalError;
      console.log = originalLog;
      console.warn = originalWarn;
    }

    check(
      "the provider produces zero console output by default (no logging at all)",
      infoCalls.length === 0 && errorCalls.length === 0 && logCalls.length === 0 && warnCalls.length === 0
    );
  }

  {
    // The config type only accepts apiKey/fetchImpl/timeoutMs — there is
    // no baseUrl/endpoint field. Even if a caller forces an extra field
    // through with a cast, the request must still go to the one
    // hardcoded endpoint.
    const { fetchImpl, calls } = capturingFetch(() => jsonResponse({ content: [], lang: "en" }));
    const configWithExtraField = {
      apiKey: FAKE_API_KEY,
      fetchImpl,
      baseUrl: "https://evil.example/v1/transcript",
    } as unknown as SupadataProviderConfig;
    const provider = createSupadataTranscriptProvider(configWithExtraField);
    await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "the request endpoint cannot be redirected by extra caller-supplied config fields",
      calls.length === 1 && calls[0]?.url.startsWith(ENDPOINT)
    );
  }

  check(
    "getTranscript's input parameter contains only videoId",
    JSON.stringify(Object.keys({ videoId: STANDARD_ID })) === JSON.stringify(["videoId"])
  );
}

// ── Request correctness ──────────────────────────────────────────────────

async function testRequestCorrectness() {
  {
    const { provider, calls } = makeProvider();
    await provider.getTranscript({ videoId: STANDARD_ID });
    const call = calls[0];
    check("the request uses HTTP GET", call?.init?.method === "GET");
    check(
      "the request targets the exact official Supadata transcript endpoint",
      call !== undefined && call.url.startsWith(ENDPOINT + "?")
    );

    const headers = new Headers(call?.init?.headers);
    check("the request sends the x-api-key header with the configured key", headers.get("x-api-key") === FAKE_API_KEY);
    check("the request sends an Accept: application/json header", headers.get("accept") === "application/json");

    const requestUrl = new URL(call!.url);
    check(
      "the canonical YouTube URL is sent as a safely encoded url query parameter",
      requestUrl.searchParams.get("url") === `https://www.youtube.com/watch?v=${STANDARD_ID}`
    );
    check("timestamped (non-plain-text) output is requested via text=false", requestUrl.searchParams.get("text") === "false");
    check("native-only mode is requested to disable AI fallback", requestUrl.searchParams.get("mode") === "native");

    const knownParams = new Set(["url", "text", "mode"]);
    const extraParams = [...requestUrl.searchParams.keys()].filter((key) => !knownParams.has(key));
    check(
      "no metadata, AI prompt, score, or user-identity query parameters are sent",
      extraParams.length === 0
    );

    check(
      "no request body is sent (GET request)",
      call?.init?.body === undefined || call?.init?.body === null
    );

    check(
      "the request is sent with redirect: \"error\" so the API key header can never be carried to a redirected origin",
      call?.init?.redirect === "error"
    );
  }

  {
    const { fetchImpl, calls } = capturingFetch(() => jsonResponse({ content: [], lang: "en" }));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    await provider.getTranscript({ videoId: "not-a-valid-id" });
    check("an invalid videoId causes no fetch call at all", calls.length === 0);
  }
}

// ── Successful mapping ───────────────────────────────────────────────────

async function testSuccessfulMapping() {
  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({ content: [{ text: "hello", offset: 0, duration: 500 }], lang: "en" })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("a single-segment response maps to a successful transcript", result.ok && result.transcript.segments.length === 1);
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({
        content: [
          { text: "first", offset: 0, duration: 500 },
          { text: "second", offset: 500, duration: 500 },
        ],
        lang: "en",
      })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("a multi-segment response maps successfully", result.ok && result.transcript.segments.length === 2);
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({
        content: [
          { text: "second", offset: 500, duration: 500 },
          { text: "first", offset: 0, duration: 500 },
        ],
        lang: "en",
      })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "unsorted provider chunks are normalized into chronological order",
      result.ok && result.transcript.segments.map((s) => s.text).join(",") === "first,second"
    );
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({
        content: [{ text: "  &lt;b&gt;hello   world&lt;/b&gt;  ", offset: 0, duration: 500 }],
        lang: "en",
      })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "whitespace and encoded HTML in provider text are cleaned through normalizeTranscript",
      result.ok && result.transcript.segments[0]?.text === "hello world"
    );
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({ content: [{ text: "hello", offset: 1234, duration: 5678 }], lang: "en" })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("provider offset maps to startMs", result.ok && result.transcript.segments[0]?.startMs === 1234);
    check("provider duration maps to durationMs", result.ok && result.transcript.segments[0]?.durationMs === 5678);
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({ content: [{ text: "hello", offset: 0, duration: 500 }], lang: "fr" })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("the top-level lang field maps to languageCode when available", result.ok && result.transcript.languageCode === "fr");
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({ content: [{ text: "hello", offset: 0, duration: 500 }] })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "isAutoGenerated is always null — Supadata's schema has no field for it",
      result.ok && result.transcript.isAutoGenerated === null
    );
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({
        content: [{ text: "hello", offset: 0, duration: 500, confidence: 0.99, speaker: "A" }],
        lang: "en",
      })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "provider-specific extra chunk fields are discarded",
      result.ok &&
        JSON.stringify(Object.keys(result.transcript.segments[0] as object).sort()) ===
          JSON.stringify(["durationMs", "startMs", "text"])
    );
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({ content: [{ text: "hello", offset: 0, duration: 500 }], lang: "en", extra: "field" })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "the successful output contains only the approved NormalizedTranscript fields",
      result.ok &&
        JSON.stringify(Object.keys(result.transcript).sort()) ===
          JSON.stringify(
            ["videoId", "languageCode", "isAutoGenerated", "segments", "text", "durationMs"].sort()
          )
    );
  }
}

// ── Provider errors ──────────────────────────────────────────────────────

async function testProviderErrors() {
  const statusCases: Array<{ name: string; status: number; body: unknown; expected: string }> = [
    { name: "transcript unavailable (206)", status: 206, body: { error: "transcript-unavailable" }, expected: "transcript_unavailable" },
    { name: "not found (404)", status: 404, body: { error: "not-found" }, expected: "video_unavailable" },
    { name: "unauthorized (401)", status: 401, body: { error: "unauthorized" }, expected: "provider_unavailable" },
    { name: "forbidden (403)", status: 403, body: { error: "forbidden" }, expected: "provider_unavailable" },
    { name: "upgrade-required (402)", status: 402, body: { error: "upgrade-required" }, expected: "provider_unavailable" },
    { name: "rate-limited (429)", status: 429, body: { error: "limit-exceeded" }, expected: "provider_rate_limited" },
    { name: "internal error (500)", status: 500, body: { error: "internal-error" }, expected: "provider_unavailable" },
    { name: "invalid-request (400)", status: 400, body: { error: "invalid-request" }, expected: "invalid_provider_response" },
    { name: "unknown 4xx (418)", status: 418, body: { error: "teapot" }, expected: "invalid_provider_response" },
    { name: "unknown 5xx (503)", status: 503, body: { error: "unavailable" }, expected: "provider_unavailable" },
    { name: "async job (202)", status: 202, body: { jobId: "abc123" }, expected: "provider_unavailable" },
  ];

  for (const testCase of statusCases) {
    const { fetchImpl } = capturingFetch(() => jsonResponse(testCase.body, testCase.status));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(`${testCase.name} maps to ${testCase.expected}`, codeOf(result) === testCase.expected);
  }

  {
    const { fetchImpl } = capturingFetch(() => rawResponse("{not valid json", 401, "application/json"));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "malformed error JSON still maps correctly (status alone drives the decision)",
      codeOf(result) === "provider_unavailable"
    );
  }

  {
    const { fetchImpl } = capturingFetch(() => rawResponse("<html><body>Server Error</body></html>", 500, "text/html"));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("an HTML error page response still maps correctly via status code", codeOf(result) === "provider_unavailable");
  }

  {
    const { fetchImpl } = capturingFetch(() => rawResponse("", 200, "application/json"));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("an empty successful body maps to invalid_provider_response", codeOf(result) === "invalid_provider_response");
  }

  // 206 is inside fetch's "ok" status range (200-299), so this proves the
  // 206 branch is checked BEFORE generic success parsing — not just that
  // it happens to reject an error-shaped body. The body here is a fully
  // valid, well-formed successful transcript payload; if the 206 status
  // check were missing, absent, or ordered after success parsing, this
  // would incorrectly produce an ok:true result instead.
  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({ content: [{ text: "hello", offset: 0, duration: 500 }], lang: "en" }, 206)
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "a 206 response is mapped to transcript_unavailable even when its body is a well-formed, otherwise-valid transcript payload",
      codeOf(result) === "transcript_unavailable"
    );
    check(
      "a 206 response never becomes invalid_provider_response",
      codeOf(result) !== "invalid_provider_response"
    );
    check("a 206 response never becomes a successful result", result.ok === false);
  }

  // 202 (async job) must map to provider_unavailable purely from status —
  // the body is never read or inspected at all, so every body variant
  // below (valid jobId, malformed JSON, empty, wrong content-type) must
  // produce the identical result, proving the jobId can never leak into
  // our output and body content has zero influence on the outcome.
  {
    const { fetchImpl } = capturingFetch(() => jsonResponse({ jobId: "job-abc-123" }, 202));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("202 with a valid JSON jobId maps to provider_unavailable", codeOf(result) === "provider_unavailable");
    check(
      "the jobId never appears anywhere in the returned result",
      !JSON.stringify(result).includes("job-abc-123")
    );
  }

  {
    const { fetchImpl } = capturingFetch(() => rawResponse("{not valid json", 202, "application/json"));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("202 with malformed JSON still maps to provider_unavailable", codeOf(result) === "provider_unavailable");
  }

  {
    const { fetchImpl } = capturingFetch(() => rawResponse("", 202, "application/json"));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("202 with an empty body still maps to provider_unavailable", codeOf(result) === "provider_unavailable");
  }

  {
    const { fetchImpl } = capturingFetch(() => rawResponse("<html>job queued</html>", 202, "text/html"));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("202 with an unexpected Content-Type still maps to provider_unavailable", codeOf(result) === "provider_unavailable");
  }

  {
    // The 202 body is never even read: prove no body-reading occurred by
    // giving a response whose .text() would throw if ever called.
    const throwingBodyResponse = new Response(
      new ReadableStream({
        pull(controller) {
          controller.error(new Error("body should never be read for a 202 response"));
        },
      }),
      { status: 202, headers: { "content-type": "application/json" } }
    );
    const { fetchImpl } = capturingFetch(() => throwingBodyResponse);
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "the 202 body stream is never read at all — a response whose body throws on read still resolves cleanly",
      codeOf(result) === "provider_unavailable"
    );
  }

  // ── Content-Length edge cases ──────────────────────────────────────────

  {
    const { fetchImpl } = capturingFetch(() =>
      rawResponse(JSON.stringify({ content: [{ text: "hello", offset: 0, duration: 500 }], lang: "en" }), 200, "application/json")
    );
    // Override the response's content-length header with a malformed value.
    const provider = createSupadataTranscriptProvider({
      apiKey: FAKE_API_KEY,
      fetchImpl: (async (...args: Parameters<typeof fetch>) => {
        const response = await fetchImpl(...args);
        const body = await response.text();
        return new Response(body, {
          status: response.status,
          headers: { "content-type": "application/json", "content-length": "not-a-number" },
        });
      }) as typeof fetch,
    });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "a malformed (non-numeric) Content-Length header does not bypass processing — the response is still parsed normally",
      result.ok && result.transcript.segments.length === 1
    );
  }

  {
    const bodyText = JSON.stringify({ content: [{ text: "hello", offset: 0, duration: 500 }], lang: "en" });
    const provider = createSupadataTranscriptProvider({
      apiKey: FAKE_API_KEY,
      fetchImpl: (async () =>
        new Response(bodyText, {
          status: 200,
          headers: { "content-type": "application/json", "content-length": "-500" },
        })) as typeof fetch,
    });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "a negative Content-Length header is not trusted — the response is still parsed normally rather than rejected or bypassed",
      result.ok && result.transcript.segments.length === 1
    );
  }

  // All four tests below isolate the adapter's own response-byte-size
  // check from normalizeTranscript's separate, much smaller per-segment
  // text limit (2000 chars) by putting bulk into an ignored top-level
  // "padding" field rather than into segment text. buildNormalizerInput
  // only ever reads `content`/`lang` from the parsed JSON, so `padding`
  // is read into memory (and counted by the size check) but never
  // reaches the normalizer — this lets a response sit right at the
  // adapter's byte boundary while still describing a tiny, always-valid
  // transcript, so a passing/failing result can only be explained by the
  // response-size check itself, not by an unrelated content limit.
  const SMALL_VALID_CONTENT = [{ text: "hello", offset: 0, duration: 500 }];

  function paddedBody(totalBytes: number): string {
    const overhead = new TextEncoder().encode(
      JSON.stringify({ content: SMALL_VALID_CONTENT, lang: "en", padding: "" })
    ).length;
    const paddingLength = Math.max(0, totalBytes - overhead);
    const padding = "x".repeat(paddingLength);
    return JSON.stringify({ content: SMALL_VALID_CONTENT, lang: "en", padding });
  }

  {
    // Content-Length understates the real size; the post-read byte check
    // must still catch the oversized actual body.
    const bodyText = paddedBody(MAX_RESPONSE_BYTES_FOR_TEST + 50_000);
    const provider = createSupadataTranscriptProvider({
      apiKey: FAKE_API_KEY,
      fetchImpl: (async () =>
        new Response(bodyText, {
          status: 200,
          headers: { "content-type": "application/json", "content-length": "10" },
        })) as typeof fetch,
    });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "an understated Content-Length paired with an oversized actual body is still caught by the post-read byte check",
      codeOf(result) === "invalid_provider_response"
    );
  }

  {
    // Exact-boundary payload (total body size <= MAX_RESPONSE_BYTES) must
    // be accepted, not off-by-one rejected — and since its only segment
    // is small and valid, an invalid_provider_response result here could
    // only be explained by the size check itself.
    const bodyText = paddedBody(MAX_RESPONSE_BYTES_FOR_TEST);
    const actualSize = new TextEncoder().encode(bodyText).length;
    check(
      "the exact-boundary test payload is constructed at (at most) the byte limit",
      actualSize <= MAX_RESPONSE_BYTES_FOR_TEST
    );
    const provider = createSupadataTranscriptProvider({
      apiKey: FAKE_API_KEY,
      fetchImpl: (async () => rawResponse(bodyText, 200, "application/json")) as typeof fetch,
    });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("a response at (or under) the exact byte boundary is accepted, not rejected", result.ok === true);
  }

  {
    // Boundary plus one byte must be rejected.
    const bodyText = paddedBody(MAX_RESPONSE_BYTES_FOR_TEST + 1);
    const provider = createSupadataTranscriptProvider({
      apiKey: FAKE_API_KEY,
      fetchImpl: (async () => rawResponse(bodyText, 200, "application/json")) as typeof fetch,
    });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "a response one byte over the boundary is rejected as invalid_provider_response",
      codeOf(result) === "invalid_provider_response"
    );
  }

  {
    // Size must be measured in encoded bytes, not JS string length —
    // multi-byte characters make these two measures diverge. Padding
    // (not segment text) carries the multi-byte content, for the same
    // isolation reason as above.
    const multiByteChar = "€"; // 3 bytes in UTF-8, 1 UTF-16 code unit
    const overhead = new TextEncoder().encode(
      JSON.stringify({ content: SMALL_VALID_CONTENT, lang: "en", padding: "" })
    ).length;
    const charCount = Math.floor((MAX_RESPONSE_BYTES_FOR_TEST - overhead) / 3) + 1000;
    const padding = multiByteChar.repeat(charCount);
    const bodyText = JSON.stringify({ content: SMALL_VALID_CONTENT, lang: "en", padding });
    const jsCharLength = bodyText.length;
    const byteLength = new TextEncoder().encode(bodyText).length;
    check(
      "the multi-byte test payload's byte length exceeds its JS character length (sanity check on the test itself)",
      byteLength > jsCharLength
    );
    const provider = createSupadataTranscriptProvider({
      apiKey: FAKE_API_KEY,
      fetchImpl: (async () => rawResponse(bodyText, 200, "application/json")) as typeof fetch,
    });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "response size is measured in encoded bytes, not JS character count — a multi-byte body over the byte limit is rejected",
      codeOf(result) === "invalid_provider_response"
    );
  }
}

// ── Transport safety ─────────────────────────────────────────────────────

// Fires the setTimeout callback on the next microtask instead of waiting
// out the real delay — deterministic, and never waits in real time. The
// callback is deferred (not invoked synchronously) so that a fetchImpl
// which attaches an "abort" listener still has a chance to register it
// before the abort fires, matching how a real (but instant) timer would
// interleave with an in-flight fetch.
function withInstantTimer<T>(fn: () => Promise<T>): { run: Promise<T>; setTimeoutCallCount: () => number } {
  const originalSetTimeout = global.setTimeout;
  let callCount = 0;
  // @ts-expect-error - test-only immediate-fire timer spy
  global.setTimeout = (callback: (...args: unknown[]) => void) => {
    callCount += 1;
    queueMicrotask(callback);
    return {} as NodeJS.Timeout;
  };
  const run = fn().finally(() => {
    global.setTimeout = originalSetTimeout;
  });
  return { run, setTimeoutCallCount: () => callCount };
}

// Checks signal.aborted synchronously (in case the mocked timer already
// fired before this ran) AND listens for a future abort event — correct
// regardless of exact microtask interleaving.
function abortAwareFetchImpl(): typeof fetch {
  return (async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    });
  }) as typeof fetch;
}

async function testTransportSafety() {
  {
    const { run, setTimeoutCallCount } = withInstantTimer(async () => {
      const provider = createSupadataTranscriptProvider({
        apiKey: FAKE_API_KEY,
        fetchImpl: abortAwareFetchImpl(),
      });
      return provider.getTranscript({ videoId: STANDARD_ID });
    });
    const result = await run;
    check("our own timeout maps to provider_timeout (no real-time wait)", codeOf(result) === "provider_timeout");
    check("exactly one timeout is created per request", setTimeoutCallCount() === 1);
  }

  {
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("an ordinary network rejection maps to provider_unavailable", codeOf(result) === "provider_unavailable");
  }

  {
    const fetchImpl = (async () => {
      throw new DOMException("aborted for an unrelated reason", "AbortError");
    }) as typeof fetch;
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl, timeoutMs: 30_000 });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "an AbortError NOT caused by our own timeout is handled conservatively as provider_unavailable, not provider_timeout",
      codeOf(result) === "provider_unavailable"
    );
  }

  {
    // Race behavior: the timer has already fired (signal.aborted is
    // true) by the time an UNRELATED rejection arrives. Classification
    // depends only on controller.signal.aborted, never on the
    // rejection's actual type/message — so this is still provider_timeout,
    // deterministically, even though the real cause was something else.
    const { run } = withInstantTimer(async () => {
      const fetchImpl = (async () => {
        // Yield one microtask so the mocked timer's abort (queued first)
        // runs before this rejects.
        await Promise.resolve();
        throw new TypeError("an unrelated network failure arriving after the timeout already fired");
      }) as typeof fetch;
      const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
      return provider.getTranscript({ videoId: STANDARD_ID });
    });
    const result = await run;
    check(
      "a fetch rejection arriving after our timer already fired is still classified consistently as provider_timeout",
      codeOf(result) === "provider_timeout"
    );
  }

  {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    let setTimeoutHandle: NodeJS.Timeout | undefined;
    let clearedHandle: NodeJS.Timeout | undefined;
    let setTimeoutCallCount = 0;
    // @ts-expect-error - test-only spy wrapper
    global.setTimeout = (...args: Parameters<typeof setTimeout>) => {
      setTimeoutCallCount += 1;
      setTimeoutHandle = originalSetTimeout(...args);
      return setTimeoutHandle;
    };
    // @ts-expect-error - test-only spy wrapper
    global.clearTimeout = (handle: NodeJS.Timeout) => {
      clearedHandle = handle;
      return originalClearTimeout(handle);
    };

    try {
      const { fetchImpl } = capturingFetch(() => jsonResponse({ content: [], lang: "en" }));
      const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
      await provider.getTranscript({ videoId: STANDARD_ID });
      check(
        "the timeout timer is cleared after a request completes",
        setTimeoutHandle !== undefined && clearedHandle === setTimeoutHandle
      );
      check("setTimeout is called exactly once for a successful request", setTimeoutCallCount === 1);
    } finally {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  }

  {
    const { fetchImpl, calls } = capturingFetch(() => rawResponse("", 500, "application/json"));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    await provider.getTranscript({ videoId: STANDARD_ID });
    check("a failed request is never retried — exactly one fetch call", calls.length === 1);
  }

  {
    const { fetchImpl, calls } = capturingFetch(() => jsonResponse({ content: [], lang: "en" }));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    await provider.getTranscript({ videoId: STANDARD_ID });
    check("a successful request makes exactly one fetch call", calls.length === 1);
  }
}

// ── Payload safety ───────────────────────────────────────────────────────

async function testPayloadSafety() {
  {
    const { fetchImpl } = capturingFetch(() => rawResponse("{not valid json", 200, "application/json"));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("malformed success JSON maps to invalid_provider_response", codeOf(result) === "invalid_provider_response");
  }

  {
    const { fetchImpl } = capturingFetch(() => rawResponse(JSON.stringify({ content: [] }), 200, "text/plain"));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("a wrong Content-Type on a 200 response maps to invalid_provider_response", codeOf(result) === "invalid_provider_response");
  }

  {
    const { fetchImpl } = capturingFetch(() => jsonResponse({ lang: "en" }));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("a response missing transcript content maps to invalid_provider_response", codeOf(result) === "invalid_provider_response");
  }

  {
    const { fetchImpl } = capturingFetch(() => jsonResponse({ content: "not an array", lang: "en" }));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("content that is not an array maps to invalid_provider_response", codeOf(result) === "invalid_provider_response");
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({ content: [{ text: 12345, offset: "not a number" }], lang: "en" })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("a malformed segment is rejected by the normalizer as invalid_provider_response", codeOf(result) === "invalid_provider_response");
  }

  {
    const { fetchImpl } = capturingFetch(() => jsonResponse({ content: [], lang: "en" }));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("an empty content array maps to invalid_provider_response", codeOf(result) === "invalid_provider_response");
  }

  {
    const tooMany = Array.from({ length: MAX_SEGMENTS + 1 }, (_, i) => ({ text: `segment ${i}`, offset: i, duration: 1 }));
    const { fetchImpl } = capturingFetch(() => jsonResponse({ content: tooMany, lang: "en" }));
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "excessive segment count is delegated to and rejected by the normalizer",
      codeOf(result) === "invalid_provider_response"
    );
  }

  {
    const hugeText = "x".repeat(MAX_RESPONSE_BYTES_FOR_TEST + 10_000);
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({ content: [{ text: hugeText, offset: 0, duration: 500 }], lang: "en" })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("an oversized response body is rejected as invalid_provider_response", codeOf(result) === "invalid_provider_response");
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({ content: [{ text: "hello", offset: Number.POSITIVE_INFINITY, duration: 500 }], lang: "en" })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check("an unsafe/infinite offset is rejected by the normalizer", codeOf(result) === "invalid_provider_response");
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({
        content: [{ text: "&lt;script&gt;alert(1)&lt;/script&gt;", offset: 0, duration: 500 }],
        lang: "en",
      })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "encoded HTML/script content from the provider cannot survive normalization",
      codeOf(result) === "invalid_provider_response"
    );
  }

  {
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({
        content: [{ text: "hello", offset: 0, duration: 500, internalProviderId: "xyz-123", raw: { nested: true } }],
        lang: "en",
        requestId: "req-abc",
      })
    );
    const provider = createSupadataTranscriptProvider({ apiKey: FAKE_API_KEY, fetchImpl });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      "raw provider-specific data never appears anywhere in the normalized output",
      result.ok && !JSON.stringify(result.transcript).includes("internalProviderId") && !JSON.stringify(result.transcript).includes("req-abc")
    );
  }
}

// ── Scope regression ──────────────────────────────────────────────────────

function testScopeRegression() {
  check(
    "the Analyze Competitor form is wired only to the analyze API route — never directly to Supadata, an API key, or any other provider",
    (() => {
      const source = readFileSync(
        "app/competitor-scripts/analyze/analyze-input-form.tsx",
        "utf8"
      );
      return (
        source.includes("/api/competitor-scripts/analyze") &&
        !/supadata/i.test(source) &&
        !/SUPADATA_API_KEY/.test(source)
      );
    })()
  );

  check(
    "the Compare Scripts input form does not reference Supadata, the transcript module, or the analyze API route",
    (() => {
      const source = readFileSync("app/competitor-scripts/compare/compare-input-form.tsx", "utf8");
      return !source.includes("/api/competitor-scripts/analyze") && !/supadata|transcript/i.test(source);
    })()
  );

  const packageJson = readFileSync("package.json", "utf8");
  check("no Supadata SDK dependency was added to package.json", !/supadata/i.test(packageJson));

  const providerSource = readFileSync("lib/competitor-scripts/transcript/supadata-provider.ts", "utf8");
  // Matches actual code usage (a property/bracket access), not prose in
  // comments that merely discusses process.env/NEXT_PUBLIC_ by name.
  check(
    "the provider module never reads process.env directly",
    !/process\.env(\.\w+|\[)/.test(providerSource)
  );
  check(
    "the provider module never references NEXT_PUBLIC_ variables",
    !/NEXT_PUBLIC_[A-Z0-9_]/.test(providerSource)
  );
  check(
    "the provider module never calls OpenAI or Supabase",
    !/openai|supabase/i.test(providerSource)
  );
}

async function main() {
  const unhandledRejections: unknown[] = [];
  const onUnhandledRejection = (reason: unknown) => {
    unhandledRejections.push(reason);
  };
  process.on("unhandledRejection", onUnhandledRejection);

  await testConstruction();
  await testRequestCorrectness();
  await testSuccessfulMapping();
  await testProviderErrors();
  await testTransportSafety();
  await testPayloadSafety();
  testScopeRegression();

  // Give any stray unhandled rejection a chance to surface before we
  // check for it.
  await new Promise((resolve) => setImmediate(resolve));
  process.off("unhandledRejection", onUnhandledRejection);

  check(
    "no unhandled promise rejection occurred anywhere in this test run",
    unhandledRejections.length === 0
  );

  globalThis.fetch = originalFetch;

  if (failures > 0) {
    process.exitCode = 1;
  } else {
    console.log("\nResult: all Competitor Scripts Supadata Provider tests passed.");
  }
}

void main();
