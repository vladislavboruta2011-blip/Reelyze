import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";

type ValidationCase = {
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

  console.log("\nClimpy Improve Script API Tests\n");

  const noKeyProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `import("./app/api/improve-script/route.ts").then(async ({ POST }) => {
        globalThis.fetch = async () => {
          throw new Error("Unexpected external API call during deterministic diagnostic test");
        };

        const diagnosticResponse = await POST(
          new Request("http://localhost/api/improve-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Success",
              script:
                "Success is possible for anyone. You need to stay focused. Most people give up too early.",
            }),
          })
        );

        const diagnosticPayload = await diagnosticResponse.json();

        if (
          diagnosticResponse.status !== 200 ||
          diagnosticPayload.status !== "diagnostic" ||
          typeof diagnosticPayload.improvedScript !== "string" ||
          !Array.isArray(diagnosticPayload.missingMaterial)
        ) {
          throw new Error(
            "Expected deterministic diagnostic response without OPENAI_API_KEY"
          );
        }

        const aiRequiredResponse = await POST(
          new Request("http://localhost/api/improve-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Pressure test",
              script:
                "Most people miss what changed the test. The valve stayed closed for 12 seconds before the pressure escaped. That delay made the final reading look safer than it really was.",
            }),
          })
        );

        const aiRequiredPayload = await aiRequiredResponse.json();

        if (
          aiRequiredResponse.status !== 503 ||
          aiRequiredPayload.status !== "error" ||
          typeof aiRequiredPayload.reason !== "string" ||
          /credential|api.?key|openai|missing/i.test(aiRequiredPayload.reason)
        ) {
          throw new Error(
            "Expected safe 503 for an AI-dependent request without OPENAI_API_KEY"
          );
        }

        console.log("NO_KEY_DIAGNOSTIC_PASS");
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

  if (
    noKeyProbe.status === 0 &&
    noKeyProbe.stdout.includes("NO_KEY_DIAGNOSTIC_PASS") &&
    noKeyProbe.stdout.includes("NO_KEY_AI_REQUIRED_PASS")
  ) {
    console.log("✅ PASS — Diagnostic works without OPENAI_API_KEY");
    console.log("✅ PASS — AI-dependent request returns safe 503 without key");
  } else {
    console.error("❌ FAIL — No-key Improve Script behavior");
    console.error(noKeyProbe.stderr.trim() || noKeyProbe.stdout.trim());
    process.exitCode = 1;
    return;
  }

  const successfulRewriteProbe = spawnSync(
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
                    editorialDecision: {
                      strategy: "rewrite",
                      primaryProblem:
                        "The opening delays the concrete 12-second detail that explains the misleading result.",
                      primaryProblemEvidence:
                        "The valve stayed closed for 12 seconds before the pressure escaped.",
                    },
                    improvedScript: [
                      "The test looked safe for 12 seconds.",
                      "But the valve was still holding pressure inside the chamber.",
                      "When it finally opened, the final reading changed — and that delay is what most people miss."
                    ].join("\\n"),
                    changes: [
                      "Moved the 12-second detail earlier.",
                      "Cut the generic opening.",
                      "Made the payoff clearer."
                    ],
                    reason:
                      "The rewrite keeps the original valve, pressure, 12-second delay, and final reading."
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

      import("./app/api/improve-script/route.ts").then(async ({ POST }) => {
        const response = await POST(
          new Request("http://localhost/api/improve-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Pressure test",
              script:
                "Most people miss what changed the test. The valve stayed closed for 12 seconds before the pressure escaped. That delay made the final reading look safer than it really was.",
            }),
          })
        );

        const payload = await response.json();

        if (
          response.status !== 200 ||
          payload.status !== "improved" ||
          typeof payload.improvedScript !== "string" ||
          !payload.improvedScript.includes("12 seconds") ||
          payload.editorialDecision?.strategy !== "rewrite" ||
          typeof payload.editorialDecision?.primaryProblem !== "string" ||
          payload.editorialDecision.primaryProblem.trim().length === 0 ||
          typeof payload.editorialDecision?.primaryProblemEvidence !== "string" ||
          payload.editorialDecision.primaryProblemEvidence.trim() !==
            "The valve stayed closed for 12 seconds before the pressure escaped." ||
          !Array.isArray(payload.changes) ||
          typeof payload.reason !== "string"
        ) {
          throw new Error("Expected a valid full-script improvement response");
        }

        console.log("SUCCESSFUL_REWRITE_PASS");
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
    successfulRewriteProbe.status === 0 &&
    successfulRewriteProbe.stdout.includes("SUCCESSFUL_REWRITE_PASS")
  ) {
    console.log("✅ PASS — Grounded AI response returns a full improved script");
  } else {
    console.error("❌ FAIL — Grounded full-script improvement");
    console.error(
      successfulRewriteProbe.stderr.trim() ||
        successfulRewriteProbe.stdout.trim()
    );
    process.exitCode = 1;
    return;
  }

  const preserveLightParaphraseProbe = spawnSync(
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
                    editorialDecision: {
                      strategy: "rewrite",
                      primaryProblem:
                        "The script lacks a strong opening that immediately captures the viewer's attention and clearly connects to the title.",
                      primaryProblemEvidence:
                        "Most defenders watch the ball when Ronaldo jumps.",
                    },
                    improvedScript:
                      "Ronaldo is a nightmare for defenders in the air. While they focus on the ball, he zeroes in on them. He waits for them to lose their balance, then strikes at the space above. This is how he manages to outjump defenders, even when they're closer to the ball.",
                    changes: [
                      "Reframed the opening to immediately highlight Ronaldo's aerial threat, making it more engaging.",
                      "Streamlined the progression to enhance clarity and flow, ensuring each sentence builds on the last."
                    ],
                    reason:
                      "The original script's opening was weak and needed a stronger connection to the title."
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

      import("./app/api/improve-script/route.ts").then(async ({ POST }) => {
        const originalScript = [
          "Most defenders watch the ball when Ronaldo jumps.",
          "But Ronaldo watches the defender.",
          "He waits until they lose balance, then attacks the space above them.",
          "That is why he can reach the ball even when the defender is closer."
        ].join("\\n");

        const response = await POST(
          new Request("http://localhost/api/improve-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Why Ronaldo Is So Dangerous in the Air",
              script: originalScript,
            }),
          })
        );

        const payload = await response.json();

        if (
          response.status !== 200 ||
          payload.status !== "preserve" ||
          payload.improvedScript !== originalScript ||
          !Array.isArray(payload.changes) ||
          payload.changes.length !== 0 ||
          !/meaningful editorial improvement|preserv/i.test(
            payload.reason ?? ""
          )
        ) {
          throw new Error(
            "Expected light paraphrase to preserve the exact original script"
          );
        }

        console.log("PRESERVE_LIGHT_PARAPHRASE_PASS");
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
    preserveLightParaphraseProbe.status === 0 &&
    preserveLightParaphraseProbe.stdout.includes(
      "PRESERVE_LIGHT_PARAPHRASE_PASS"
    )
  ) {
    console.log(
      "✅ PASS — Light paraphrase preserves the exact original script"
    );
  } else {
    console.error(
      "❌ FAIL — Light paraphrase must preserve the exact original script"
    );
    console.error(
      preserveLightParaphraseProbe.stderr.trim() ||
        preserveLightParaphraseProbe.stdout.trim()
    );
    process.exitCode = 1;
    return;
  }

  const unsupportedNumberProbe = spawnSync(
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
                    editorialDecision: {
                      strategy: "rewrite",
                      primaryProblem:
                        "The opening delays the concrete timing detail.",
                      primaryProblemEvidence:
                        "The valve stayed closed for 12 seconds before the pressure escaped.",
                    },
                    improvedScript:
                      "The test looked safe for 30 seconds. But the valve was still holding pressure.",
                    changes: ["Added a stronger number."],
                    reason: "The new timing makes the opening more dramatic."
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

      import("./app/api/improve-script/route.ts").then(async ({ POST }) => {
        const response = await POST(
          new Request("http://localhost/api/improve-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Pressure test",
              script:
                "Most people miss what changed the test. The valve stayed closed for 12 seconds before the pressure escaped. That delay made the final reading look safer than it really was.",
            }),
          })
        );

        const payload = await response.json();

        if (
          response.status !== 200 ||
          payload.status !== "diagnostic" ||
          /30 seconds/i.test(payload.improvedScript ?? "") ||
          !/number|measurement|not supported/i.test(payload.reason ?? "")
        ) {
          throw new Error(
            "Expected unsupported new number to fall back to diagnostic"
          );
        }

        console.log("UNSUPPORTED_NUMBER_GUARD_PASS");
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
    unsupportedNumberProbe.status === 0 &&
    unsupportedNumberProbe.stdout.includes("UNSUPPORTED_NUMBER_GUARD_PASS")
  ) {
    console.log("✅ PASS — Unsupported AI number falls back to diagnostic");
  } else {
    console.error("❌ FAIL — Unsupported-number guard");
    console.error(
      unsupportedNumberProbe.stderr.trim() ||
        unsupportedNumberProbe.stdout.trim()
    );
    process.exitCode = 1;
    return;
  }

  const unusableOutputProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `import("./app/api/improve-script/route.ts").then(async ({ POST }) => {
        const cases = [
          ["EMPTY_CONTENT", ""],
          ["TRUNCATED_JSON", "{\\"improvedScript\\":"],
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

          const response = await POST(
            new Request("http://localhost/api/improve-script", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: "Pressure test",
                script:
                  "Most people miss what changed the test. The valve stayed closed for 12 seconds before the pressure escaped. That delay made the final reading look safer than it really was.",
              }),
            })
          );

          const payload = await response.json();

          if (
            response.status !== 502 ||
            payload.status !== "error" ||
            typeof payload.reason !== "string" ||
            /openai|provider|raw|json|parse/i.test(payload.reason)
          ) {
            throw new Error(
              "Expected safe 502 for unusable AI response: " + label
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
    unusableOutputProbe.status === 0 &&
    unusableOutputProbe.stdout.includes("EMPTY_CONTENT_SAFE_502_PASS") &&
    unusableOutputProbe.stdout.includes("TRUNCATED_JSON_SAFE_502_PASS") &&
    unusableOutputProbe.stdout.includes("EMPTY_OBJECT_SAFE_502_PASS")
  ) {
    console.log("✅ PASS — Unusable AI responses return safe 502");
  } else {
    console.error("❌ FAIL — Unusable AI response handling");
    console.error(
      unusableOutputProbe.stderr.trim() ||
        unusableOutputProbe.stdout.trim()
    );
    process.exitCode = 1;
    return;
  }

  const routeSource = readFileSync(
    "app/api/improve-script/route.ts",
    "utf8"
  );

  const universalEditorialPromptRequirements = {
    evaluatesCompleteScript:
      routeSource.includes("evaluate the complete script") ||
      routeSource.includes("evaluate the full script"),
    identifiesPrimaryProblem:
      routeSource.includes("single biggest problem") ||
      routeSource.includes("primary limiting problem"),
    exposesObservableEditorialDecision:
      routeSource.includes('"editorialDecision"') &&
      routeSource.includes('"strategy": "rewrite"') &&
      routeSource.includes('"primaryProblem"') &&
      routeSource.includes('"primaryProblemEvidence"'),
    requiresGroundedDecisionEvidence:
      routeSource.includes("exact quote") &&
      routeSource.includes("Original script") &&
      routeSource.includes("primaryProblemEvidence"),
    rejectsLightParaphrase:
      routeSource.includes("sentence-by-sentence paraphrase") ||
      routeSource.includes("light paraphrase"),
    avoidsForcedStructure:
      routeSource.includes("Do not force a twist") &&
      routeSource.includes("Do not force") &&
      routeSource.includes("sentence order"),
    protectsSupportedMeaning:
      routeSource.includes("supported claim") &&
      routeSource.includes("strengthen"),
    requiresStrongSupportedEnding:
      routeSource.includes("strongest supported") &&
      routeSource.includes("ending"),
  };

  if (
    Object.values(universalEditorialPromptRequirements).every(Boolean)
  ) {
    console.log(
      "✅ PASS — Route prompt includes universal editorial decision framework"
    );
  } else {
    console.error(
      "❌ FAIL — Route prompt includes universal editorial decision framework"
    );
    console.error(JSON.stringify(universalEditorialPromptRequirements));
    process.exitCode = 1;
    return;
  }

  const hasBoundedRateLimitStorage =
    routeSource.includes("AI_RATE_LIMIT_MAX_ENTRIES") &&
    routeSource.includes("aiRateLimitEntries.delete(") &&
    routeSource.includes(
      "aiRateLimitEntries.size >= AI_RATE_LIMIT_MAX_ENTRIES"
    );

  const hasOpenAITimeout =
    routeSource.includes("timeout: 15_000") ||
    routeSource.includes("timeout: 15000");

  const disablesAutomaticRetries = routeSource.includes("maxRetries: 0");

  const unsafeProductionLogs = [
    "raw AI output:",
    "final result:",
    'console.error("[improve-script] error:", error)',
    "JSON parse failed, raw:",
  ].filter((pattern) => routeSource.includes(pattern));

  if (
    hasBoundedRateLimitStorage &&
    hasOpenAITimeout &&
    disablesAutomaticRetries &&
    unsafeProductionLogs.length === 0
  ) {
    console.log("✅ PASS — Route includes required production safeguards");
  } else {
    console.error("❌ FAIL — Route production safeguards");
    console.error(
      JSON.stringify({
        hasBoundedRateLimitStorage,
        hasOpenAITimeout,
        disablesAutomaticRetries,
        unsafeProductionLogs,
      })
    );
    process.exitCode = 1;
    return;
  }

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new Error("Unexpected external API call during validation test");
  }) as typeof fetch;

  try {
    const { POST } = await import("../app/api/improve-script/route");

    const cases: ValidationCase[] = [
      {
        name: "Oversized request body is rejected",
        body: {
          script:
            "Success is possible for anyone. You need to stay focused every day.",
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
          script:
            "The valve stayed closed for 12 seconds before pressure escaped.",
          title: "Pressure test",
        },
        contentType: "text/plain",
        expectedStatus: 415,
        expectedReason: /content.?type|application\/json|unsupported/i,
      },
      {
        name: "Missing script is rejected",
        body: { title: "Missing script" },
        expectedStatus: 400,
        expectedReason: /script|provided|required/i,
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
          script:
            "The valve stayed closed for 12 seconds before pressure escaped.",
          title: "x".repeat(201),
        },
        expectedStatus: 400,
        expectedReason: /title|200|too long|character/i,
      },
      {
        name: "Non-string title is rejected",
        body: {
          script:
            "The valve stayed closed for 12 seconds before pressure escaped.",
          title: 123,
        },
        expectedStatus: 400,
        expectedReason: /title|string|invalid/i,
      },
    ];

    let failures = 0;

    for (const testCase of cases) {
      const request = new Request("http://localhost/api/improve-script", {
        method: "POST",
        headers: {
          "Content-Type": testCase.contentType ?? "application/json",
        },
        body: testCase.rawBody ?? JSON.stringify(testCase.body),
      });

      const response = await POST(request);
      const payload = (await response.json()) as {
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
      console.error(
        `\nResult: ${failures} Improve Script API validation regression(s) failed.`
      );
      process.exitCode = 1;
      return;
    }

    console.log("\nResult: all Improve Script API tests passed.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
