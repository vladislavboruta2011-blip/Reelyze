import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

type TestCase = {
  name: string;
  body: unknown;
  rawBody?: string;
  expectedStatus: number;
  expectedReason: RegExp;
};

async function main() {
  const envWithoutOpenAIKey = { ...process.env };
  delete envWithoutOpenAIKey.OPENAI_API_KEY;
  delete envWithoutOpenAIKey.OPENAI_ADMIN_KEY;

  const noKeyProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `import("./app/api/improve/route.ts").then(async ({ POST }) => {
        globalThis.fetch = async () => {
          throw new Error("Unexpected external API call during deterministic no-key test");
        };

        const request = new Request("http://localhost/api/improve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: "Success is very important. You need to work hard every day.",
            title: "Success",
          }),
        });

        const response = await POST(request);
        const payload = await response.json();

        if (
          response.status !== 200 ||
          payload.mode !== "diagnostic" ||
          typeof payload.reason !== "string"
        ) {
          throw new Error(
            "Expected deterministic diagnostic response without OPENAI_API_KEY"
          );
        }

        const aiRequiredRequest = new Request("http://localhost/api/improve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: "A car crossed 100 miles in one hour because its engine was modified.",
            title: "Modified car test",
          }),
        });

        const aiRequiredResponse = await POST(aiRequiredRequest);
        const aiRequiredPayload = await aiRequiredResponse.json();

        if (
          aiRequiredResponse.status !== 503 ||
          aiRequiredPayload.status !== "error" ||
          typeof aiRequiredPayload.reason !== "string" ||
          /credential|api.?key|openai|missing/i.test(aiRequiredPayload.reason)
        ) {
          throw new Error(
            "Expected a safe 503 response for an AI-dependent request without OPENAI_API_KEY"
          );
        }

        console.log("NO_KEY_DETERMINISTIC_PASS");
        console.log("NO_KEY_AI_REQUIRED_PASS");
      }).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      });`,
    ],
    {
      cwd: process.cwd(),
      env: envWithoutOpenAIKey,
      encoding: "utf8",
    }
  );

  console.log("\nReelyze Improve API Validation Tests\n");

  if (
    noKeyProbe.status === 0 &&
    noKeyProbe.stdout.includes("NO_KEY_DETERMINISTIC_PASS") &&
    noKeyProbe.stdout.includes("NO_KEY_AI_REQUIRED_PASS")
  ) {
    console.log("✅ PASS — Deterministic guard works without OPENAI_API_KEY");
    console.log("✅ PASS — AI-dependent request returns safe 503 without OPENAI_API_KEY");
  } else {
    console.error("❌ FAIL — Deterministic guard works without OPENAI_API_KEY");
    console.error(noKeyProbe.stderr.trim() || noKeyProbe.stdout.trim());
    process.exitCode = 1;
    return;
  }

  const invalidKeyProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "Incorrect API key provided",
              type: "invalid_request_error",
              code: "invalid_api_key",
            },
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "x-request-id": "test-request",
            },
          }
        );

      import("./app/api/improve/route.ts").then(async ({ POST }) => {
        const request = new Request("http://localhost/api/improve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: "A car crossed 100 miles in one hour because its engine was modified.",
            title: "Modified car test",
          }),
        });

        const response = await POST(request);
        const payload = await response.json();

        if (
          response.status !== 503 ||
          payload.status !== "error" ||
          typeof payload.reason !== "string" ||
          /credential|api.?key|openai|invalid_request_error|test-request/i.test(
            payload.reason
          )
        ) {
          throw new Error(
            "Expected a safe 503 response for an invalid OPENAI_API_KEY"
          );
        }

        console.log("INVALID_KEY_SAFE_503_PASS");
      }).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      });`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENAI_API_KEY: "test-invalid-key",
      },
      encoding: "utf8",
    }
  );

  if (
    invalidKeyProbe.status === 0 &&
    invalidKeyProbe.stdout.includes("INVALID_KEY_SAFE_503_PASS")
  ) {
    console.log("✅ PASS — Invalid OPENAI_API_KEY returns safe 503");
  } else {
    console.error("❌ FAIL — Invalid OPENAI_API_KEY returns safe 503");
    console.error(invalidKeyProbe.stderr.trim() || invalidKeyProbe.stdout.trim());
    process.exitCode = 1;
    return;
  }

  const routeSource = readFileSync("app/api/improve/route.ts", "utf8");
  const unsafeProductionLogs = [
    'console.log("',
    "[improve][TEST1]",
    "raw AI output:",
    "final result:",
    'console.error("[improve] error:", error)',
    'console.error("[improve] detail:", message)',
    "JSON parse failed, raw:",
  ].filter((pattern) => routeSource.includes(pattern));

  if (unsafeProductionLogs.length === 0) {
    console.log("✅ PASS — Improve API does not log user or provider payloads");
  } else {
    console.error("❌ FAIL — Improve API does not log user or provider payloads");
    console.error(
      `  found ${unsafeProductionLogs.length} unsafe production logging pattern(s)`
    );
    process.exitCode = 1;
    return;
  }

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
      {
        name: "Title over 200 characters is rejected",
        body: {
          script: "A car crossed 100 miles in one hour.",
          title: "x".repeat(201),
        },
        expectedStatus: 400,
        expectedReason: /title|200|too long|character/i,
      },
    ];

    let failures = 0;

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
