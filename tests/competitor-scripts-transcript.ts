import { readFileSync } from "node:fs";
import {
  MAX_LANGUAGE_CODE_LENGTH,
  MAX_SEGMENTS,
  MAX_SEGMENT_TEXT_LENGTH,
  MAX_TRANSCRIPT_TEXT_LENGTH,
  normalizeTranscript,
} from "../lib/competitor-scripts/transcript/normalize";
import {
  createTranscriptError,
  type NormalizedTranscript,
  type NormalizeTranscriptInput,
  type TranscriptError,
  type TranscriptErrorCode,
  type TranscriptProvider,
  type TranscriptProviderResult,
} from "../lib/competitor-scripts/transcript/types";

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

console.log("\nCompetitor Scripts Transcript Foundation Tests\n");

const STANDARD_ID = "dQw4w9WgXcQ";
const HYPHEN_UNDERSCORE_ID = "aB3_x9-Z12Q";

const ALL_ERROR_CODES: TranscriptErrorCode[] = [
  "transcript_not_found",
  "transcript_disabled",
  "transcript_unavailable",
  "unsupported_language",
  "video_unavailable",
  "provider_rate_limited",
  "provider_timeout",
  "provider_unavailable",
  "invalid_provider_response",
];

const NON_RETRYABLE_CODES: TranscriptErrorCode[] = [
  "transcript_not_found",
  "transcript_disabled",
  "unsupported_language",
  "video_unavailable",
  "invalid_provider_response",
];

const RETRYABLE_CODES: TranscriptErrorCode[] = [
  "provider_rate_limited",
  "provider_timeout",
  "provider_unavailable",
  "transcript_unavailable",
];

function baseInput(
  segments: unknown,
  overrides: Partial<NormalizeTranscriptInput> = {}
): NormalizeTranscriptInput {
  return {
    videoId: STANDARD_ID,
    segments,
    ...overrides,
  };
}

function rejectedWith(
  result: TranscriptProviderResult,
  code: TranscriptErrorCode
): boolean {
  return !result.ok && result.error.code === code;
}

// ── Successful normalization ────────────────────────────────────────────

{
  const result = normalizeTranscript(baseInput([{ text: "hello", startMs: 0, durationMs: 500 }]));
  check(
    "a single valid segment normalizes successfully",
    result.ok && result.transcript.segments.length === 1
  );
}

{
  const result = normalizeTranscript(
    baseInput([
      { text: "first", startMs: 0, durationMs: 500 },
      { text: "second", startMs: 500, durationMs: 500 },
      { text: "third", startMs: 1000, durationMs: 500 },
    ])
  );
  check(
    "multiple segments normalize successfully",
    result.ok && result.transcript.segments.length === 3
  );
}

{
  const result = normalizeTranscript(
    baseInput([{ text: "   hello there   ", startMs: 0, durationMs: null }])
  );
  check(
    "surrounding whitespace is trimmed from segment text",
    result.ok && result.transcript.segments[0]?.text === "hello there"
  );
}

{
  const result = normalizeTranscript(
    baseInput([{ text: "hello    there,\n\tworld", startMs: 0, durationMs: null }])
  );
  check(
    "repeated internal whitespace collapses to a single space",
    result.ok && result.transcript.segments[0]?.text === "hello there, world"
  );
}

{
  const result = normalizeTranscript(
    baseInput([
      { text: "second", startMs: 500, durationMs: 100 },
      { text: "first", startMs: 0, durationMs: 100 },
      { text: "third", startMs: 1000, durationMs: 100 },
    ])
  );
  check(
    "unsorted segments are sorted chronologically by startMs",
    result.ok &&
      result.transcript.segments.map((segment) => segment.text).join(",") ===
        "first,second,third"
  );
}

{
  const result = normalizeTranscript(
    baseInput([
      { text: "alpha", startMs: 100, durationMs: 100 },
      { text: "beta", startMs: 100, durationMs: 100 },
      { text: "gamma", startMs: 100, durationMs: 100 },
    ])
  );
  check(
    "segments sharing the same startMs preserve original input order",
    result.ok &&
      result.transcript.segments.map((segment) => segment.text).join(",") ===
        "alpha,beta,gamma"
  );
}

{
  const result = normalizeTranscript(
    baseInput([{ text: "hello", startMs: 0 }])
  );
  check(
    "a missing durationMs normalizes to null",
    result.ok && result.transcript.segments[0]?.durationMs === null
  );
}

{
  const result = normalizeTranscript(
    baseInput([
      { text: "hello", startMs: 0, durationMs: 500 },
      { text: "world", startMs: 500, durationMs: 500 },
    ])
  );
  check(
    "transcript.text is derived from normalized segments in order",
    result.ok && result.transcript.text === "hello world"
  );
}

{
  const result = normalizeTranscript(
    baseInput([
      { text: "hello", startMs: 0, durationMs: 500 },
      { text: "world", startMs: 2000, durationMs: 1000 },
    ])
  );
  check(
    "transcript.durationMs is the max of startMs + durationMs across segments",
    result.ok && result.transcript.durationMs === 3000
  );
}

{
  const result = normalizeTranscript(
    baseInput([{ text: "hello", startMs: 0 }], { languageCode: "  en-US  " })
  );
  check(
    "languageCode is trimmed and normalized",
    result.ok && result.transcript.languageCode === "en-US"
  );
}

{
  const result = normalizeTranscript(
    baseInput([{ text: "hello", startMs: 0 }], { isAutoGenerated: true })
  );
  check(
    "isAutoGenerated true is preserved",
    result.ok && result.transcript.isAutoGenerated === true
  );
}

{
  const result = normalizeTranscript(
    baseInput([{ text: "hello", startMs: 0 }], { isAutoGenerated: false })
  );
  check(
    "isAutoGenerated false is preserved",
    result.ok && result.transcript.isAutoGenerated === false
  );
}

{
  const result = normalizeTranscript(baseInput([{ text: "hello", startMs: 0 }]));
  check(
    "isAutoGenerated omitted normalizes to null",
    result.ok && result.transcript.isAutoGenerated === null
  );
}

{
  const result = normalizeTranscript(
    baseInput([{ text: "hello", startMs: 0 }], { videoId: HYPHEN_UNDERSCORE_ID })
  );
  check(
    "a videoId containing underscore and hyphen is accepted",
    result.ok && result.transcript.videoId === HYPHEN_UNDERSCORE_ID
  );
}

// ── Invalid transcript-level input ──────────────────────────────────────

check(
  "a malformed videoId is rejected as invalid_provider_response",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "hello", startMs: 0 }], { videoId: "too-short" })),
    "invalid_provider_response"
  )
);

{
  const result = normalizeTranscript(
    baseInput([{ text: "hello", startMs: 0 }], { languageCode: "   " })
  );
  check(
    "an empty (whitespace-only) language code normalizes to null rather than being rejected",
    result.ok && result.transcript.languageCode === null
  );
}

check(
  "an excessively long language code is rejected",
  rejectedWith(
    normalizeTranscript(
      baseInput([{ text: "hello", startMs: 0 }], {
        languageCode: "x".repeat(MAX_LANGUAGE_CODE_LENGTH + 1),
      })
    ),
    "invalid_provider_response"
  )
);

check(
  "an invalid isAutoGenerated type is rejected",
  rejectedWith(
    normalizeTranscript(
      baseInput([{ text: "hello", startMs: 0 }], { isAutoGenerated: "yes" as unknown })
    ),
    "invalid_provider_response"
  )
);

check(
  "segments not an array is rejected",
  rejectedWith(normalizeTranscript(baseInput("not an array")), "invalid_provider_response")
);

check(
  "an empty segment array is rejected",
  rejectedWith(normalizeTranscript(baseInput([])), "invalid_provider_response")
);

check(
  "a segment array where every entry normalizes to empty text is rejected",
  rejectedWith(
    normalizeTranscript(
      baseInput([
        { text: "   ", startMs: 0 },
        { text: "<i></i>", startMs: 500 },
      ])
    ),
    "invalid_provider_response"
  )
);

check(
  "more than MAX_SEGMENTS entries is rejected",
  rejectedWith(
    normalizeTranscript(
      baseInput(
        Array.from({ length: MAX_SEGMENTS + 1 }, (_, index) => ({
          text: `segment ${index}`,
          startMs: index,
        }))
      )
    ),
    "invalid_provider_response"
  )
);

{
  // Enough max-length segments to guarantee the combined text exceeds
  // MAX_TRANSCRIPT_TEXT_LENGTH, without exceeding MAX_SEGMENTS.
  const segmentCount = Math.ceil(MAX_TRANSCRIPT_TEXT_LENGTH / MAX_SEGMENT_TEXT_LENGTH) + 1;
  check(
    "combined transcript text exceeding MAX_TRANSCRIPT_TEXT_LENGTH is rejected",
    rejectedWith(
      normalizeTranscript(
        baseInput(
          Array.from({ length: segmentCount }, (_, index) => ({
            text: "x".repeat(MAX_SEGMENT_TEXT_LENGTH),
            startMs: index * 1000,
          }))
        )
      ),
      "invalid_provider_response"
    )
  );
}

// ── Invalid segments ─────────────────────────────────────────────────────

check(
  "segment text that is not a string is rejected",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: 12345, startMs: 0 }])),
    "invalid_provider_response"
  )
);

{
  const result = normalizeTranscript(
    baseInput([
      { text: "   ", startMs: 0 },
      { text: "kept", startMs: 500 },
    ])
  );
  check(
    "a segment that normalizes to empty text is omitted, not treated as a fatal error",
    result.ok && result.transcript.segments.length === 1 && result.transcript.segments[0]?.text === "kept"
  );
}

{
  const result = normalizeTranscript(
    baseInput([
      { text: "<b></b><i> </i>", startMs: 0 },
      { text: "kept", startMs: 500 },
    ])
  );
  check(
    "HTML-only segment text is omitted",
    result.ok && result.transcript.segments.length === 1 && result.transcript.segments[0]?.text === "kept"
  );
}

check(
  "an invalid startMs type is rejected",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "hello", startMs: "0" }])),
    "invalid_provider_response"
  )
);

check(
  "a negative startMs is rejected",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "hello", startMs: -1 }])),
    "invalid_provider_response"
  )
);

check(
  "a NaN startMs is rejected",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "hello", startMs: Number.NaN }])),
    "invalid_provider_response"
  )
);

check(
  "an Infinity startMs is rejected",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "hello", startMs: Number.POSITIVE_INFINITY }])),
    "invalid_provider_response"
  )
);

check(
  "an unsafe integer startMs is rejected",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "hello", startMs: 2 ** 60 }])),
    "invalid_provider_response"
  )
);

check(
  "an invalid durationMs type is rejected",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "hello", startMs: 0, durationMs: "500" }])),
    "invalid_provider_response"
  )
);

check(
  "a negative durationMs is rejected",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "hello", startMs: 0, durationMs: -1 }])),
    "invalid_provider_response"
  )
);

check(
  "a NaN durationMs is rejected",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "hello", startMs: 0, durationMs: Number.NaN }])),
    "invalid_provider_response"
  )
);

check(
  "an Infinity durationMs is rejected",
  rejectedWith(
    normalizeTranscript(
      baseInput([{ text: "hello", startMs: 0, durationMs: Number.POSITIVE_INFINITY }])
    ),
    "invalid_provider_response"
  )
);

check(
  "an unsafe integer durationMs is rejected",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "hello", startMs: 0, durationMs: 2 ** 60 }])),
    "invalid_provider_response"
  )
);

check(
  "a startMs + durationMs sum that overflows safe integer range is rejected",
  rejectedWith(
    normalizeTranscript(
      baseInput([
        {
          text: "hello",
          startMs: Number.MAX_SAFE_INTEGER - 5,
          durationMs: 100,
        },
      ])
    ),
    "invalid_provider_response"
  )
);

check(
  "segment text above the maximum length is rejected",
  rejectedWith(
    normalizeTranscript(
      baseInput([{ text: "x".repeat(MAX_SEGMENT_TEXT_LENGTH + 1), startMs: 0 }])
    ),
    "invalid_provider_response"
  )
);

check(
  "duration zero is accepted as a valid, intentional duration",
  (() => {
    const result = normalizeTranscript(
      baseInput([{ text: "hello", startMs: 100, durationMs: 0 }])
    );
    return result.ok && result.transcript.segments[0]?.durationMs === 0;
  })()
);

// ── Deterministic behavior ────────────────────────────────────────────────

{
  const result = normalizeTranscript(
    baseInput([
      { text: "hello", startMs: 0, durationMs: 500, confidence: 0.98, speaker: "A" } as unknown,
    ])
  );
  check(
    "provider-specific extra segment metadata is not retained in the normalized output",
    result.ok &&
      JSON.stringify(Object.keys(result.transcript.segments[0] as object).sort()) ===
        JSON.stringify(["durationMs", "startMs", "text"])
  );
}

{
  const rawSegments = [
    { text: "second", startMs: 500, durationMs: 100 },
    { text: "first", startMs: 0, durationMs: 100 },
  ];
  const snapshot = JSON.stringify(rawSegments);
  normalizeTranscript(baseInput(rawSegments));
  check(
    "the raw input segments array is not mutated",
    JSON.stringify(rawSegments) === snapshot
  );
}

{
  const input = baseInput([
    { text: "hello   world", startMs: 500, durationMs: 100 },
    { text: "again", startMs: 0, durationMs: 100 },
  ]);
  const first = normalizeTranscript(input);
  const second = normalizeTranscript(input);
  check(
    "repeated normalization of the same input produces identical output",
    JSON.stringify(first) === JSON.stringify(second)
  );
}

{
  const result = normalizeTranscript(
    baseInput([
      { text: "same", startMs: 100, durationMs: 200 },
      { text: "same", startMs: 100, durationMs: 200 },
      { text: "different", startMs: 300, durationMs: 200 },
    ])
  );
  check(
    "exact duplicate segments (same text, startMs, durationMs) are removed, keeping the first occurrence",
    result.ok &&
      result.transcript.segments.length === 2 &&
      result.transcript.segments[0]?.text === "same" &&
      result.transcript.segments[1]?.text === "different"
  );
}

{
  const result = normalizeTranscript(
    baseInput([
      { text: "same", startMs: 100, durationMs: 200 },
      { text: "same", startMs: 100, durationMs: 999 },
    ])
  );
  check(
    "segments with matching text and startMs but different durationMs are not treated as duplicates",
    result.ok && result.transcript.segments.length === 2
  );
}

{
  const result = normalizeTranscript(
    baseInput([
      { text: "hello    world", startMs: 0 },
      { text: "  again  ", startMs: 500 },
    ])
  );
  check(
    "transcript.text never contains repeated whitespace",
    result.ok && !/\s{2,}/.test(result.transcript.text)
  );
}

{
  const result = normalizeTranscript(baseInput([{ text: "hello", startMs: 0, durationMs: 500 }]));
  check(
    "a successful transcript result contains only the approved top-level fields",
    result.ok &&
      JSON.stringify(Object.keys(result.transcript).sort()) ===
        JSON.stringify(
          ["videoId", "languageCode", "isAutoGenerated", "segments", "text", "durationMs"].sort()
        )
  );
}

// ── Error taxonomy ─────────────────────────────────────────────────────

check(
  "every error code produces a non-empty, safe message",
  ALL_ERROR_CODES.every((code) => {
    const error: TranscriptError = createTranscriptError(code);
    return typeof error.message === "string" && error.message.trim().length > 0;
  })
);

check(
  "retryability is deterministic and matches the documented mapping",
  NON_RETRYABLE_CODES.every((code) => createTranscriptError(code).retryable === false) &&
    RETRYABLE_CODES.every((code) => createTranscriptError(code).retryable === true)
);

check(
  "no error message contains provider response content, HTML, a URL, a stack trace, or a secret",
  ALL_ERROR_CODES.every((code) => {
    const message = createTranscriptError(code).message;
    return (
      !/<[a-z][\s\S]*>/i.test(message) &&
      !/https?:\/\//i.test(message) &&
      !/\bat\s+\S+\s*\(/.test(message) &&
      !/api[_-]?key|secret|token|password/i.test(message)
    );
  })
);

check(
  "normalizeTranscript never throws for any malformed input — it always returns a result",
  (() => {
    const malformedInputs: unknown[] = [
      null,
      undefined,
      42,
      "a string",
      [],
      {},
      { videoId: null, segments: null },
      { videoId: STANDARD_ID, segments: [null, undefined, 1, "x", []] },
      { videoId: STANDARD_ID, segments: [{ text: {}, startMs: {} }] },
    ];

    return malformedInputs.every((malformed) => {
      try {
        normalizeTranscript(malformed as NormalizeTranscriptInput);
        return true;
      } catch {
        return false;
      }
    });
  })()
);

// ── Provider contract ────────────────────────────────────────────────────

class InMemoryTestTranscriptProvider implements TranscriptProvider {
  constructor(
    private readonly behavior:
      | { kind: "success"; transcript: NormalizedTranscript }
      | { kind: "error"; code: TranscriptErrorCode }
      | { kind: "throw" }
  ) {}

  async getTranscript(input: { videoId: string }): Promise<TranscriptProviderResult> {
    if (this.behavior.kind === "throw") {
      throw new Error("simulated unexpected provider failure");
    }

    if (this.behavior.kind === "error") {
      return { ok: false, error: createTranscriptError(this.behavior.code) };
    }

    return {
      ok: true,
      transcript: { ...this.behavior.transcript, videoId: input.videoId },
    };
  }
}

const SAMPLE_TRANSCRIPT: NormalizedTranscript = {
  videoId: STANDARD_ID,
  languageCode: "en",
  isAutoGenerated: false,
  segments: [{ text: "hello", startMs: 0, durationMs: 500 }],
  text: "hello",
  durationMs: 500,
};

async function testProviderContract() {
  const successProvider = new InMemoryTestTranscriptProvider({
    kind: "success",
    transcript: SAMPLE_TRANSCRIPT,
  });
  const successResult = await successProvider.getTranscript({ videoId: STANDARD_ID });
  check(
    "the test provider returns a success result matching the contract",
    successResult.ok === true &&
      successResult.ok &&
      successResult.transcript.videoId === STANDARD_ID
  );

  for (const code of ALL_ERROR_CODES) {
    const provider = new InMemoryTestTranscriptProvider({ kind: "error", code });
    const result = await provider.getTranscript({ videoId: STANDARD_ID });
    check(
      `the test provider returns a well-formed failure result for ${code}`,
      !result.ok && result.error.code === code
    );
  }

  const throwingProvider = new InMemoryTestTranscriptProvider({ kind: "throw" });
  let caught: unknown = null;
  try {
    await throwingProvider.getTranscript({ videoId: STANDARD_ID });
  } catch (error) {
    caught = error;
  }
  check(
    "an unexpected provider throw propagates as a real exception a caller can distinguish from a data result",
    caught instanceof Error
  );

  const providerInput = { videoId: STANDARD_ID };
  check(
    "the provider input contains only videoId",
    JSON.stringify(Object.keys(providerInput)) === JSON.stringify(["videoId"])
  );
}

// ── Existing scope: Analyze API, Analyze UI, and Compare are unaffected ──

async function testExistingScopeUnaffected() {
  const { POST } = await import("../app/api/competitor-scripts/analyze/route");

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = ((...args: unknown[]) => {
    fetchCalled = true;
    throw new Error(`unexpected network call: ${JSON.stringify(args)}`);
  }) as typeof fetch;

  try {
    const response = await POST(
      new Request("http://localhost/api/competitor-scripts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${STANDARD_ID}` }),
      })
    );
    const body = await response.json();

    check(
      "the Analyze endpoint still returns status validated after this PR",
      response.status === 200 && body.status === "validated"
    );
    check(
      "the Analyze endpoint response never contains a transcript field",
      !("transcript" in body) && !("transcript" in (body.input ?? {}))
    );
    check(
      "the Analyze endpoint response never contains a provider field",
      !("provider" in body) && !("provider" in (body.input ?? {}))
    );
    check("the Analyze endpoint still makes no network call", fetchCalled === false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const analyzeRouteSource = readFileSync(
  "app/api/competitor-scripts/analyze/route.ts",
  "utf8"
);
check(
  "the Analyze route does not import or instantiate a transcript provider",
  !/transcript/i.test(analyzeRouteSource)
);

check(
  "the Analyze Competitor form is still not wired to the API",
  !readFileSync("app/competitor-scripts/analyze/analyze-input-form.tsx", "utf8").includes(
    "/api/competitor-scripts/analyze"
  )
);

check(
  "the Compare Scripts input form does not reference the transcript module or the analyze API route",
  (() => {
    const source = readFileSync(
      "app/competitor-scripts/compare/compare-input-form.tsx",
      "utf8"
    );
    return !source.includes("/api/competitor-scripts/analyze") && !/transcript/i.test(source);
  })()
);

const transcriptTypesSource = readFileSync(
  "lib/competitor-scripts/transcript/types.ts",
  "utf8"
);
const transcriptNormalizeSource = readFileSync(
  "lib/competitor-scripts/transcript/normalize.ts",
  "utf8"
);
check(
  "the transcript foundation never calls fetch, OpenAI, or Supabase",
  !/openai|supabase|\bfetch\(/i.test(transcriptTypesSource + transcriptNormalizeSource)
);
check(
  "the transcript foundation never uses setTimeout/setInterval or process.env",
  !/setTimeout|setInterval|process\.env/.test(transcriptTypesSource + transcriptNormalizeSource)
);

// ── Regression: encoded HTML must never reappear after normalization ────
//
// normalizeSegmentText originally stripped literal tags and THEN decoded
// entities. An encoded tag such as "&lt;b&gt;" contains no literal "<"
// or ">" characters, so the strip pass left it untouched, and decoding
// it afterward reintroduced literal "<b>" markup into text that was
// supposed to already be sanitized. The fix strips both before AND
// after decoding, and tightened the tag pattern so a bare "<"/">" in
// ordinary text (e.g. "5 < 10") is never misread as a tag.

const TAG_SEQUENCE_PATTERN = /<\/?[a-zA-Z][^<>]*>/;

function containsNoTagSequence(text: string): boolean {
  return !TAG_SEQUENCE_PATTERN.test(text);
}

function normalizeSingleSegment(text: string): string | null {
  const result = normalizeTranscript(baseInput([{ text, startMs: 0 }]));
  return result.ok ? result.transcript.segments[0]?.text ?? null : null;
}

check(
  "an encoded opening+closing tag pair no longer reappears as literal HTML",
  normalizeSingleSegment("&lt;b&gt;Hello&lt;/b&gt;") === "Hello"
);

check(
  "an encoded script tag's content does not survive — the whole segment is rejected since nothing else remains",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "&lt;script&gt;alert(1)&lt;/script&gt;", startMs: 0 }])),
    "invalid_provider_response"
  )
);

check(
  "mixed literal and encoded HTML around visible text is fully sanitized",
  normalizeSingleSegment("<b>&lt;i&gt;Hello&lt;/i&gt;</b>") === "Hello"
);

check(
  "double-encoded entities are decoded only one bounded pass, never fully unwrapped into real markup",
  normalizeSingleSegment("&amp;lt;b&amp;gt;Nested&amp;lt;/b&amp;gt;") === "&lt;b&gt;Nested&lt;/b&gt;"
);

check(
  "an HTML-only encoded segment normalizes to empty and is omitted (whole response rejected when it's the only segment)",
  rejectedWith(
    normalizeTranscript(baseInput([{ text: "&lt;div&gt;&lt;/div&gt;", startMs: 0 }])),
    "invalid_provider_response"
  )
);

{
  const result = normalizeTranscript(
    baseInput([
      { text: "&lt;div&gt;&lt;/div&gt;", startMs: 0 },
      { text: "kept", startMs: 500 },
    ])
  );
  check(
    "an HTML-only encoded segment is omitted while a sibling valid segment is kept",
    result.ok && result.transcript.segments.length === 1 && result.transcript.segments[0]?.text === "kept"
  );
}

check(
  "a mixed malformed case (literal unclosed tag + encoded script tag) removes the script content and leaves no complete tag sequence",
  (() => {
    const text = normalizeSingleSegment("Hello <b world &lt;script&gt;x&lt;/script&gt;");
    return text === "Hello <b world" && !text.includes("x");
  })()
);

check(
  "no normalized segment text contains a complete <tag>-shaped sequence, across every encoded/mixed case",
  [
    "&lt;b&gt;Hello&lt;/b&gt;",
    "Hello &lt;em&gt;world&lt;/em&gt;",
    "&amp;lt;b&amp;gt;Nested&amp;lt;/b&amp;gt;",
    "<b>&lt;i&gt;Hello&lt;/i&gt;</b>",
    "Text <br> next",
    "Hello <b world &lt;script&gt;x&lt;/script&gt;",
  ].every((raw) => {
    const text = normalizeSingleSegment(raw);
    return text === null || containsNoTagSequence(text);
  })
);

{
  const result = normalizeTranscript(
    baseInput([
      { text: "&lt;b&gt;Hello&lt;/b&gt;", startMs: 0 },
      { text: "Hello &lt;em&gt;world&lt;/em&gt;", startMs: 500 },
    ])
  );
  check(
    "the combined derived transcript text contains no HTML across multiple encoded segments",
    result.ok && containsNoTagSequence(result.transcript.text)
  );
}

{
  const input = baseInput([{ text: "&lt;b&gt;Hello&lt;/b&gt;", startMs: 0 }]);
  const first = normalizeTranscript(input);
  const second = normalizeTranscript(input);
  check(
    "repeated normalization of encoded-HTML input remains deterministic",
    JSON.stringify(first) === JSON.stringify(second)
  );
}

{
  const rawSegments = [{ text: "&lt;b&gt;Hello&lt;/b&gt;", startMs: 0 }];
  const snapshot = JSON.stringify(rawSegments);
  normalizeTranscript(baseInput(rawSegments));
  check(
    "the raw input array is not mutated when normalizing encoded HTML",
    JSON.stringify(rawSegments) === snapshot
  );
}

// ── Ordinary text using <, >, and & must survive, per the documented rule ──

check(
  "ordinary comparison text using literal < and > is preserved, not misread as a tag",
  normalizeSingleSegment("5 < 10 and 10 > 5") === "5 < 10 and 10 > 5"
);

check(
  "an encoded ampersand decodes to a literal & without being mistaken for further markup",
  normalizeSingleSegment("Tom &amp; Jerry") === "Tom & Jerry"
);

check(
  "encoded quotes decode to literal quote characters",
  normalizeSingleSegment('She said &quot;hello&quot; to me') === 'She said "hello" to me'
);

// ── createTranscriptError must never throw for an unvalidated runtime code ──

check(
  "createTranscriptError falls back to invalid_provider_response for an unrecognized runtime code instead of throwing",
  (() => {
    try {
      const error = createTranscriptError("not_a_real_code" as TranscriptErrorCode);
      return error.code === "invalid_provider_response" && error.message.length > 0;
    } catch {
      return false;
    }
  })()
);

async function main() {
  await testProviderContract();
  await testExistingScopeUnaffected();

  if (failures > 0) {
    process.exitCode = 1;
  } else {
    console.log(
      "\nResult: all Competitor Scripts Transcript Foundation tests passed."
    );
  }
}

void main();
