import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

type TestCase = {
  name: string;
  body: unknown;
  rawBody?: string;
  contentType?: string;
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

  const transientProviderProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `import("./app/api/improve/route.ts").then(async ({ POST }) => {
        async function expectSafe503(label, mockFetch) {
          globalThis.fetch = mockFetch;

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
            /openai|provider|rate.?limit|network|failure|request.?id/i.test(
              payload.reason
            )
          ) {
            throw new Error("Expected a safe 503 response for " + label);
          }

          console.log(label + "_SAFE_503_PASS");
        }

        await expectSafe503(
          "RATE_LIMIT",
          async () =>
            new Response(
              JSON.stringify({
                error: {
                  message: "Rate limit reached",
                  type: "requests",
                  code: "rate_limit_exceeded",
                },
              }),
              {
                status: 429,
                headers: { "Content-Type": "application/json" },
              }
            )
        );

        await expectSafe503(
          "CONNECTION_ERROR",
          async () => {
            throw new Error("simulated network failure");
          }
        );

        for (const status of [500, 502, 503, 504]) {
          await expectSafe503(
            "UPSTREAM_" + status,
            async () =>
              new Response(
                JSON.stringify({
                  error: {
                    message: "Temporary upstream failure",
                    type: "server_error",
                    code: "server_error",
                  },
                }),
                {
                  status,
                  headers: { "Content-Type": "application/json" },
                }
              )
          );
        }
      }).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      });`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENAI_API_KEY: "test-key",
      },
      encoding: "utf8",
    }
  );

  if (
    transientProviderProbe.status === 0 &&
    transientProviderProbe.stdout.includes("RATE_LIMIT_SAFE_503_PASS") &&
    transientProviderProbe.stdout.includes("CONNECTION_ERROR_SAFE_503_PASS")
  ) {
    console.log("✅ PASS — Temporary provider failures return safe 503");
  } else {
    console.error("❌ FAIL — Temporary provider failures return safe 503");
    console.error(
      transientProviderProbe.stderr.trim() ||
        transientProviderProbe.stdout.trim()
    );
    process.exitCode = 1;
    return;
  }

  const unusableProviderOutputProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `import("./app/api/improve/route.ts").then(async ({ POST }) => {
        const cases = [
          ["EMPTY_CONTENT", ""],
          ["TRUNCATED_JSON", "{\\"hookScore\\": 50"],
          ["EMPTY_OBJECT", "{}"],
        ];

        for (const [label, content] of cases) {
          globalThis.fetch = async () =>
            new Response(
              JSON.stringify({
                id: "chatcmpl-test",
                object: "chat.completion",
                created: 0,
                model: "gpt-4o-mini",
                choices: [
                  {
                    index: 0,
                    message: {
                      role: "assistant",
                      content,
                    },
                    finish_reason: "stop",
                  },
                ],
                usage: {
                  prompt_tokens: 1,
                  completion_tokens: 1,
                  total_tokens: 2,
                },
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            );

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
            response.status !== 502 ||
            payload.status !== "error" ||
            typeof payload.reason !== "string" ||
            /openai|provider|raw|json|parse/i.test(payload.reason)
          ) {
            throw new Error(
              "Expected a safe 502 response for unusable AI output: " + label
            );
          }

          console.log(label + "_SAFE_502_PASS");
        }
      }).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      });`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENAI_API_KEY: "test-key",
      },
      encoding: "utf8",
    }
  );

  if (
    unusableProviderOutputProbe.status === 0 &&
    unusableProviderOutputProbe.stdout.includes("EMPTY_CONTENT_SAFE_502_PASS") &&
    unusableProviderOutputProbe.stdout.includes("TRUNCATED_JSON_SAFE_502_PASS") &&
    unusableProviderOutputProbe.stdout.includes("EMPTY_OBJECT_SAFE_502_PASS")
  ) {
    console.log("✅ PASS — Unusable AI responses return safe 502");
  } else {
    console.error("❌ FAIL — Unusable AI responses return safe 502");
    console.error(
      unusableProviderOutputProbe.stderr.trim() ||
        unusableProviderOutputProbe.stdout.trim()
    );
    process.exitCode = 1;
    return;
  }

  const oversizedProviderOutputProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            id: "chatcmpl-test",
            object: "chat.completion",
            created: 0,
            model: "gpt-4o-mini",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: JSON.stringify({
                    hookScore: 70,
                    improvedHook:
                      "A rebuilt engine carried this car 100 miles in one hour, but " +
                      "the same dramatic detail keeps repeating ".repeat(20),
                    reason:
                      "The 100 miles anchor creates specificity, but " +
                      "this explanation keeps repeating unnecessary detail ".repeat(30),
                  }),
                },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 1,
              completion_tokens: 1,
              total_tokens: 2,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );

      import("./app/api/improve/route.ts").then(async ({ POST }) => {
        const request = new Request("http://localhost/api/improve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script:
              "This car should never have survived the test. It traveled 100 miles in one hour because its engine was rebuilt.",
            title: "Modified car test",
          }),
        });

        const response = await POST(request);
        const payload = await response.json();

        if (
          response.status !== 200 ||
          typeof payload.improvedHook !== "string" ||
          typeof payload.reason !== "string" ||
          payload.improvedHook.length > 240 ||
          payload.reason.length > 600
        ) {
          throw new Error(
            "Expected successful AI output to be bounded before reaching the UI"
          );
        }

        console.log("BOUNDED_AI_OUTPUT_PASS");
      }).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      });`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENAI_API_KEY: "test-key",
      },
      encoding: "utf8",
    }
  );

  if (
    oversizedProviderOutputProbe.status === 0 &&
    oversizedProviderOutputProbe.stdout.includes("BOUNDED_AI_OUTPUT_PASS")
  ) {
    console.log("✅ PASS — Improve API bounds AI-generated hook and reason length");
  } else {
    console.error("❌ FAIL — Improve API bounds AI-generated hook and reason length");
    console.error(
      oversizedProviderOutputProbe.stderr.trim() ||
        oversizedProviderOutputProbe.stdout.trim()
    );
    process.exitCode = 1;
    return;
  }

  const localRateLimitProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `import("./app/api/improve/route.ts").then(async ({ POST }) => {
        let providerCalls = 0;

        globalThis.fetch = async () => {
          providerCalls += 1;

          return new Response(
            JSON.stringify({
              id: "chatcmpl-test",
              object: "chat.completion",
              created: 0,
              model: "gpt-4o-mini",
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content: JSON.stringify({
                      hookScore: 85,
                      reason: "The opening already uses the exact 100 miles anchor.",
                    }),
                  },
                  finish_reason: "stop",
                },
              ],
              usage: {
                prompt_tokens: 1,
                completion_tokens: 1,
                total_tokens: 2,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        };

        let finalResponse;

        for (let index = 0; index < 11; index += 1) {
          const request = new Request("http://localhost/api/improve", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": "203.0.113.10",
            },
            body: JSON.stringify({
              script: "A car crossed 100 miles in one hour because its engine was modified.",
              title: "Modified car test",
            }),
          });

          finalResponse = await POST(request);

          if (index < 10 && finalResponse.status === 429) {
            throw new Error("Rate limit blocked an allowed request");
          }
        }

        const finalPayload = await finalResponse.json();

        if (
          finalResponse.status !== 429 ||
          finalPayload.status !== "error" ||
          typeof finalPayload.reason !== "string" ||
          !/too many|rate|limit|later/i.test(finalPayload.reason) ||
          providerCalls !== 10
        ) {
          throw new Error(
            "Expected the eleventh AI-dependent request from one IP to return 429 before calling the provider"
          );
        }

        console.log("LOCAL_RATE_LIMIT_PASS");
      }).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      });`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENAI_API_KEY: "test-key",
      },
      encoding: "utf8",
    }
  );

  if (
    localRateLimitProbe.status === 0 &&
    localRateLimitProbe.stdout.includes("LOCAL_RATE_LIMIT_PASS")
  ) {
    console.log("✅ PASS — Improve API limits repeated AI requests per client");
  } else {
    console.error("❌ FAIL — Improve API limits repeated AI requests per client");
    console.error(
      localRateLimitProbe.stderr.trim() ||
        localRateLimitProbe.stdout.trim()
    );
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

  const boundsRateLimitMemory =
    routeSource.includes("AI_RATE_LIMIT_MAX_ENTRIES") &&
    routeSource.includes("aiRateLimitEntries.delete(") &&
    routeSource.includes(
      "aiRateLimitEntries.size >= AI_RATE_LIMIT_MAX_ENTRIES"
    );

  if (boundsRateLimitMemory) {
    console.log("✅ PASS — Improve API bounds in-memory rate-limit storage");
  } else {
    console.error("❌ FAIL — Improve API bounds in-memory rate-limit storage");
    process.exitCode = 1;
    return;
  }

  const hasOpenAITimeout =
    routeSource.includes("timeout: 15_000") ||
    routeSource.includes("timeout: 15000");
  const disablesAutomaticRetries = routeSource.includes("maxRetries: 0");

  if (hasOpenAITimeout && disablesAutomaticRetries) {
    console.log("✅ PASS — Improve API limits AI request duration and retries");
  } else {
    console.error("❌ FAIL — Improve API limits AI request duration and retries");
    console.error(
      `  timeout configured: ${hasOpenAITimeout}, retries disabled: ${disablesAutomaticRetries}`
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
        name: "Oversized request body is rejected",
        body: {
          script: "Success is very important. You need to work hard every day.",
          title: "Success",
          padding: "x".repeat(20_000),
        },
        expectedStatus: 413,
        expectedReason: /request|body|payload|too large/i,
      },
      {
        name: "Malformed JSON is rejected",
        body: null,
        rawBody: '{"script":',
        expectedStatus: 400,
        expectedReason: /invalid|json|request/i,
      },
      {
        name: "Non-JSON content type is rejected",
        body: {
          script: "A car crossed 100 miles in one hour.",
          title: "Modified car test",
        },
        contentType: "text/plain",
        expectedStatus: 415,
        expectedReason: /content.?type|application\/json|unsupported/i,
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
      {
        name: "Non-string title is rejected",
        body: {
          script: "Success is important and people should work hard every day.",
          title: 123,
        },
        expectedStatus: 400,
        expectedReason: /title|string|invalid/i,
      },
    ];

    let failures = 0;

    for (const testCase of cases) {
      const request = new Request("http://localhost/api/improve", {
        method: "POST",
        headers: {
          "Content-Type": testCase.contentType ?? "application/json",
        },
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
