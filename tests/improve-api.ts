process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

type TestCase = {
  name: string;
  body: unknown;
  rawBody?: string;
  expectedStatus: number;
  expectedReason: RegExp;
};

async function main() {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new Error("Unexpected external API call during validation test");
  }) as typeof fetch;

  try {
    const { POST } = await import("../app/api/improve/route");

    const cases: TestCase[] = [
      {
        name: "Malformed JSON is rejected",
        body: null,
        rawBody: '{"script":',
        expectedStatus: 400,
        expectedReason: /invalid|json|request/i,
      },
      {
        name: "Whitespace-only script is rejected",
        body: { script: "   \n\t   ", title: "Empty script" },
        expectedStatus: 400,
        expectedReason: /script|provided|empty/i,
      },
      {
        name: "Script over 1000 characters is rejected",
        body: { script: "x".repeat(1001), title: "Oversized script" },
        expectedStatus: 400,
        expectedReason: /1000|too long|character/i,
      },
    ];

    let failures = 0;

    console.log("\nReelyze Improve API Validation Tests\n");

    for (const testCase of cases) {
      const request = new Request("http://localhost/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: testCase.rawBody ?? JSON.stringify(testCase.body),
      });

      const response = await POST(request);
      const payload = await response.json() as {
        status?: string;
        reason?: string;
      };

      const statusPass = response.status === testCase.expectedStatus;
      const reasonPass =
        typeof payload.reason === "string" &&
        testCase.expectedReason.test(payload.reason);

      if (statusPass && reasonPass) {
        console.log(`✅ PASS — ${testCase.name}`);
      } else {
        failures += 1;
        console.error(`❌ FAIL — ${testCase.name}`);
        console.error(
          `  expected status ${testCase.expectedStatus}, received ${response.status}`
        );
        console.error(
          `  expected reason ${testCase.expectedReason}, received ${JSON.stringify(payload.reason)}`
        );
      }
    }

    if (failures > 0) {
      console.error(`\nResult: ${failures} validation regression(s) failed.`);
      process.exitCode = 1;
      return;
    }

    console.log("\nResult: all Improve API validation tests passed.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
