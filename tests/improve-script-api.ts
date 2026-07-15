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
                      primaryProblemScope: "whole_script",
                      primaryProblem:
                        "The opening delays the concrete 12-second detail that explains the misleading result.",
                      primaryProblemEvidence:
                        "The valve stayed closed for 12 seconds before the pressure escaped.",
                    },
                    candidateAudit: {
                      resolvedPrimaryProblem: true,
                      candidateMateriallyBetter: true,
                      regressionIntroduced: false,
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
                      primaryProblemScope: "whole_script",
                      primaryProblem:
                        "The script lacks a strong opening that immediately captures the viewer's attention and clearly connects to the title.",
                      primaryProblemEvidence:
                        "Most defenders watch the ball when Ronaldo jumps.",
                    },
                    candidateAudit: {
                      resolvedPrimaryProblem: true,
                      candidateMateriallyBetter: true,
                      regressionIntroduced: false,
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

  const preserveMessiProductionParaphraseProbe = spawnSync(
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
                      primaryProblemScope: "whole_script",
                      primaryProblem:
                        "The original opening is weak and does not immediately capture the viewer's interest.",
                      primaryProblemEvidence:
                        "If Messi had Ronaldo’s vertical jump, how high would he actually reach?",
                    },
                    candidateAudit: {
                      resolvedPrimaryProblem: true,
                      candidateMateriallyBetter: true,
                      regressionIntroduced: false,
                    },
                    improvedScript:
                      "What if Messi had Ronaldo’s incredible vertical jump? Messi stands at 5 feet 7, while Ronaldo towers at 6 feet 2. Even with Ronaldo’s jump, Messi wouldn’t reach as high as Ronaldo. However, he’d likely score many more headers, jumping high enough to challenge nearly any defender.",
                    changes: [
                      "Reframed the opening to immediately engage the viewer with a question about the scenario.",
                      "Streamlined the progression to create a smoother flow of ideas, connecting Messi's height, Ronaldo's jump, and the potential impact on Messi's game."
                    ],
                    reason:
                      "The original script's opening was weak and did not immediately capture the viewer's interest. By posing a direct question, the rewrite engages the audience right away."
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
          "If Messi had Ronaldo’s vertical jump, how high would he actually reach?",
          "Messi is around 5 feet 7, while Ronaldo is around 6 feet 2.",
          "So even with Ronaldo’s jump, Messi still wouldn’t reach as high as Ronaldo.",
          "But he’d probably score far more headers and be jumping high enough to challenge almost any defender."
        ].join("\\n");

        const response = await POST(
          new Request("http://localhost/api/improve-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "If Messi Had Ronaldo's Jump",
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
            "Expected production Messi paraphrase to preserve the exact original script"
          );
        }

        console.log("PRESERVE_MESSI_PRODUCTION_PARAPHRASE_PASS");
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
    preserveMessiProductionParaphraseProbe.status === 0 &&
    preserveMessiProductionParaphraseProbe.stdout.includes(
      "PRESERVE_MESSI_PRODUCTION_PARAPHRASE_PASS"
    )
  ) {
    console.log(
      "✅ PASS — Production Messi paraphrase preserves the exact original script"
    );
  } else {
    console.error(
      "❌ FAIL — Production Messi paraphrase must preserve the exact original script"
    );
    console.error(
      preserveMessiProductionParaphraseProbe.stderr.trim() ||
        preserveMessiProductionParaphraseProbe.stdout.trim()
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
                      primaryProblemScope: "whole_script",
                      primaryProblem:
                        "The opening delays the concrete timing detail.",
                      primaryProblemEvidence:
                        "The valve stayed closed for 12 seconds before the pressure escaped.",
                    },
                    candidateAudit: {
                      resolvedPrimaryProblem: true,
                      candidateMateriallyBetter: true,
                      regressionIntroduced: false,
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

  const causalDistortionProbe = spawnSync(
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
                      primaryProblemScope: "whole_script",
                      primaryProblem:
                        "The generic opening delays the concrete valve event.",
                      primaryProblemEvidence:
                        "Before we start, you need to understand one important thing.",
                    },
                    candidateAudit: {
                      resolvedPrimaryProblem: true,
                      candidateMateriallyBetter: true,
                      regressionIntroduced: false,
                    },
                    improvedScript: [
                      "The valve that changed the final test stayed closed for 12 seconds.",
                      "That delay forced it open, changing the result."
                    ].join("\\n"),
                    changes: [
                      "Removed the generic introductory sentence.",
                      "Connected the delay directly to the valve opening."
                    ],
                    reason:
                      "The rewrite makes the cause and result more immediate."
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
              title: "The Valve That Changed the Final Test",
              script:
                "Before we start, you need to understand one important thing. The valve stayed closed for 12 seconds before pressure forced it open. That delay changed the final test result.",
            }),
          })
        );

        const payload = await response.json();

        if (
          response.status !== 200 ||
          payload.status !== "diagnostic" ||
          /delay forced it open/i.test(payload.improvedScript ?? "") ||
          !/cause|caused|supported event|original script/i.test(
            payload.reason ?? ""
          )
        ) {
          throw new Error(
            "Expected causal distortion to fall back to diagnostic"
          );
        }

        console.log("CAUSAL_DISTORTION_GUARD_PASS");
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
    causalDistortionProbe.status === 0 &&
    causalDistortionProbe.stdout.includes(
      "CAUSAL_DISTORTION_GUARD_PASS"
    )
  ) {
    console.log(
      "✅ PASS — Causal distortion from AI falls back to diagnostic"
    );
  } else {
    console.error(
      "❌ FAIL — Causal-distortion API guard"
    );
    console.error(
      causalDistortionProbe.stderr.trim() ||
        causalDistortionProbe.stdout.trim()
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

  const refinedHookPromptProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `let providerRequestBody = "";

      globalThis.fetch = async (_input, init) => {
        providerRequestBody =
          typeof init?.body === "string" ? init.body : "";

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
                    editorialDecision: {
                      strategy: "rewrite",
                      primaryProblemScope: "whole_script",
                      primaryProblem:
                        "The generic first sentence delays the concrete valve event.",
                      primaryProblemEvidence:
                        "Before we start, you need to understand one important thing.",
                    },
                    candidateAudit: {
                      resolvedPrimaryProblem: true,
                      candidateMateriallyBetter: true,
                      regressionIntroduced: false,
                    },
                    improvedScript:
                      "The valve stayed closed for 12 seconds before pressure forced it open. That delay changed the final test result.",
                    changes: [
                      "Removed the generic introductory sentence.",
                      "Kept the approved refined hook as the opening."
                    ],
                    reason:
                      "The rewrite begins with the approved concrete hook and removes unsupported filler."
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

      import("./app/api/improve-script/route.ts").then(async ({ POST }) => {
        const refinedHook =
          "The valve stayed closed for 12 seconds before pressure forced it open.";

        const response = await POST(
          new Request("http://localhost/api/improve-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "The Valve That Changed the Final Test",
              script:
                "Before we start, you need to understand one important thing. The valve stayed closed for 12 seconds before pressure forced it open. That delay changed the final test result.",
              refinedHook,
            }),
          })
        );

        const payload = await response.json();

        if (
          response.status !== 200 ||
          payload.status !== "improved" ||
          !providerRequestBody.includes(refinedHook) ||
          !/approved refined hook|refined hook/i.test(providerRequestBody)
        ) {
          throw new Error(
            "Expected Improve Script to include the approved refined hook in the AI prompt"
          );
        }

        console.log("REFINED_HOOK_PROMPT_PASS");
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
    refinedHookPromptProbe.status === 0 &&
    refinedHookPromptProbe.stdout.includes("REFINED_HOOK_PROMPT_PASS")
  ) {
    console.log(
      "✅ PASS — Improve Script API forwards the approved refined hook to the AI prompt"
    );
  } else {
    console.error(
      "❌ FAIL — Improve Script API must forward the approved refined hook to the AI prompt"
    );
    console.error(
      refinedHookPromptProbe.stderr.trim() ||
        refinedHookPromptProbe.stdout.trim()
    );
    process.exitCode = 1;
    return;
  }

  const strongAnalysisBlocksFalseDiagnosticProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `import("./app/api/improve-script/route.ts").then(async ({ POST }) => {
        globalThis.fetch = async () => {
          throw new Error(
            "Strong validated analysis should preserve before any external AI request"
          );
        };

        const script = [
          "Want a smooth knee slide?",
          "Build speed before dropping down.",
          "Keep your chest upright and bring both knees down together.",
          "Lean back slightly as your momentum carries you forward.",
          "This keeps the slide smooth instead of making you tip over."
        ].join(" ");

        const analysisResult = {
          scriptType: "how_to",
          verdict: "strong",
          scores: {
            overall: 84,
            hook: 82,
            retentionRisk: 20
          },
          hookDecision: "keep",
          hookAssessment:
            "The opening immediately states the practical result the viewer will learn.",
          riskyParts: [],
          suggestedFixes: [],
          scenes: [
            {
              excerpt: "Want a smooth knee slide?",
              label: "Clear practical promise",
              status: "strong"
            },
            {
              excerpt: "Build speed before dropping down.",
              label: "Preparation",
              status: "strong"
            },
            {
              excerpt:
                "Keep your chest upright and bring both knees down together.",
              label: "Core movement",
              status: "strong"
            },
            {
              excerpt:
                "Lean back slightly as your momentum carries you forward.",
              label: "Controlled slide",
              status: "strong"
            },
            {
              excerpt:
                "This keeps the slide smooth instead of making you tip over.",
              label: "Resolved result",
              status: "strong"
            }
          ],
          mainTakeaway:
            "The script gives a clear sequence, explains the movement, and delivers the promised practical result."
        };

        const response = await POST(
          new Request("http://localhost/api/improve-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "How to do a smooth knee slide",
              script,
              analysisResult
            })
          })
        );

        const payload = await response.json();

        if (
          response.status !== 200 ||
          payload.status !== "preserve" ||
          payload.improvedScript !== script ||
          !Array.isArray(payload.changes) ||
          payload.changes.length !== 0
        ) {
          throw new Error(
            "Expected validated strong complete analysis to prevent a false diagnostic"
          );
        }

        console.log("STRONG_ANALYSIS_PRESERVE_PASS");
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
    strongAnalysisBlocksFalseDiagnosticProbe.status === 0 &&
    strongAnalysisBlocksFalseDiagnosticProbe.stdout.includes(
      "STRONG_ANALYSIS_PRESERVE_PASS"
    )
  ) {
    console.log(
      "✅ PASS — Validated strong complete analysis prevents a false Improve Script diagnostic"
    );
  } else {
    console.error(
      "❌ FAIL — Validated strong complete analysis must prevent a false Improve Script diagnostic"
    );
    console.error(
      strongAnalysisBlocksFalseDiagnosticProbe.stderr.trim() ||
        strongAnalysisBlocksFalseDiagnosticProbe.stdout.trim()
    );
    process.exitCode = 1;
    return;
  }

  const validatedMixedAnalysisBypassesGenericHeuristicProbe =
    spawnSync(
      "npx",
      [
        "tsx",
        "-e",
        `let providerCalls = 0;

        globalThis.fetch = async () => {
          providerCalls += 1;

          return new Response(
            JSON.stringify({
              id: "chatcmpl-mixed-analysis-heuristic-test",
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
                        strategy: "preserve"
                      }
                    })
                  },
                  finish_reason: "stop"
                }
              ]
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json"
              }
            }
          );
        };

        import("./app/api/improve-script/route.ts").then(
          async ({ POST }) => {
            const script = [
              "Want a smoother knee slide?",
              "Build speed before dropping down.",
              "Keep your chest upright and bring both knees down together.",
              "Lean back slightly as your momentum carries you forward.",
              "This keeps the slide smooth instead of making you tip over."
            ].join(" ");

            const riskyExcerpt =
              "Lean back slightly as your momentum carries you forward.";

            const analysisResult = {
              scriptType: "how_to",
              verdict: "mixed",
              scores: {
                overall: 74,
                hook: 82,
                retentionRisk: 38
              },
              hookDecision: "keep",
              hookAssessment:
                "The opening immediately promises a clear practical result.",
              riskyParts: [
                {
                  excerpt: riskyExcerpt,
                  reason:
                    "The timing of the lean-back instruction is not connected clearly to the moment the knees come down.",
                  severity: "medium"
                }
              ],
              suggestedFixes: [
                {
                  target: "clarity",
                  suggestion:
                    "Place the lean-back instruction immediately after bringing both knees down so the movement reads as one clear sequence.",
                  optional: false
                }
              ],
              scenes: [
                {
                  excerpt: "Want a smoother knee slide?",
                  label: "Direct practical promise",
                  status: "strong"
                },
                {
                  excerpt: "Build speed before dropping down.",
                  label: "Preparation",
                  status: "strong"
                },
                {
                  excerpt:
                    "Keep your chest upright and bring both knees down together.",
                  label: "Core movement",
                  status: "strong"
                },
                {
                  excerpt: riskyExcerpt,
                  label: "Unclear instruction timing",
                  status: "risky"
                },
                {
                  excerpt:
                    "This keeps the slide smooth instead of making you tip over.",
                  label: "Practical result",
                  status: "strong"
                }
              ],
              mainTakeaway:
                "The script has a clear promise and useful sequence, but one instruction should be repositioned so its timing is easier to follow."
            };

            const response = await POST(
              new Request(
                "http://localhost/api/improve-script",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    title: "How to do a smooth knee slide",
                    script,
                    analysisResult
                  })
                }
              )
            );

            const payload = await response.json();

            if (
              response.status !== 200 ||
              payload.status !== "preserve" ||
              providerCalls !== 1
            ) {
              throw new Error(
                "Expected validated mixed analysis with a concrete required fix to reach the editorial model instead of being replaced by the generic diagnostic"
              );
            }

            console.log(
              "MIXED_ANALYSIS_HEURISTIC_BYPASS_PASS"
            );
          }
        ).catch((error) => {
          console.error(
            error instanceof Error ? error.message : error
          );
          process.exit(1);
        });`,
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
      }
    );

  if (
    validatedMixedAnalysisBypassesGenericHeuristicProbe.status === 0 &&
    validatedMixedAnalysisBypassesGenericHeuristicProbe.stdout.includes(
      "MIXED_ANALYSIS_HEURISTIC_BYPASS_PASS"
    )
  ) {
    console.log(
      "✅ PASS — Validated mixed analysis bypasses the legacy generic diagnostic heuristic"
    );
  } else {
    console.error(
      "❌ FAIL — A validated mixed analysis with a concrete required fix must not be replaced by the legacy generic diagnostic"
    );
    console.error(
      validatedMixedAnalysisBypassesGenericHeuristicProbe.stderr.trim() ||
        validatedMixedAnalysisBypassesGenericHeuristicProbe.stdout.trim()
    );
    process.exitCode = 1;
    return;
  }

  // Regression test for a real reported bug: a genuinely valid ru
  // AnalysisV2 result with an overall score below 80 was rejected here
  // with a 400 ("Analysis result is invalid or does not match the
  // submitted script") because this route validated the submitted
  // analysisResult without the request's own locale, silently defaulting
  // to "en". The below-80 mainTakeaway check is locale-gated, so a
  // correct Russian mainTakeaway failed to match the English-only term
  // tables. The mixed-analysis probe above never exercises this because
  // it never sends `locale: "ru"`.
  const ruBelowEightyAnalysisBypassesLocaleDefaultProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `let providerCalls = 0;

        globalThis.fetch = async () => {
          providerCalls += 1;

          return new Response(
            JSON.stringify({
              id: "chatcmpl-ru-below-eighty-locale-test",
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
                        strategy: "preserve"
                      }
                    })
                  },
                  finish_reason: "stop"
                }
              ]
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json"
              }
            }
          );
        };

        import("./app/api/improve-script/route.ts").then(
          async ({ POST }) => {
            const script =
              "Success is very important in life. Many people want to become successful, but they do not know what to do. You should work hard, believe in yourself, and never give up.";

            const analysisResult = {
              scriptType: "generic_advice",
              verdict: "mixed",
              scores: {
                overall: 58,
                hook: 70,
                retentionRisk: 55
              },
              scoreBreakdown: {
                overall: {
                  premiseAppeal: 13,
                  openingPromise: 15,
                  progression: 15,
                  payoff: 15
                },
                hook: {
                  immediacy: 18,
                  specificity: 17,
                  viewerPull: 17,
                  deliveryAlignment: 18
                },
                retentionRisk: {
                  openingFriction: 14,
                  progressionRisk: 14,
                  predictabilityRisk: 13,
                  payoffRisk: 14
                }
              },
              hookDecision: "diagnostic",
              hookAssessment:
                "Хук ставит тему сразу и понятен.",
              riskyParts: [
                {
                  excerpt:
                    "Many people want to become successful, but they do not know what to do.",
                  reason:
                    "Эта идея звучит очень обобщённо и не создаёт конкретного любопытства.",
                  severity: "medium"
                }
              ],
              suggestedFixes: [
                {
                  target: "clarity",
                  suggestion:
                    "Сделайте совет более конкретным, добавив один пример из личного опыта.",
                  optional: false
                }
              ],
              scenes: [
                {
                  excerpt: script,
                  label: "Общий совет",
                  status: "average"
                }
              ],
              mainTakeaway:
                "Сценарий понятен, но привлекательность идеи ограничивает общую оценку, потому что идея слабо привлекает аудиторию."
            };

            const response = await POST(
              new Request(
                "http://localhost/api/improve-script",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    title: "Success advice",
                    script,
                    locale: "ru",
                    analysisResult
                  })
                }
              )
            );

            const payload = await response.json();

            if (
              response.status !== 200 ||
              payload.status !== "preserve" ||
              providerCalls !== 1
            ) {
              throw new Error(
                "Expected a genuinely valid ru analysisResult with overall < 80 to reach the editorial model instead of being rejected as invalid. Got status " +
                  response.status +
                  " payload " +
                  JSON.stringify(payload)
              );
            }

            console.log(
              "RU_BELOW_EIGHTY_ANALYSIS_LOCALE_BYPASS_PASS"
            );
          }
        ).catch((error) => {
          console.error(
            error instanceof Error ? error.message : error
          );
          process.exit(1);
        });`,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
    }
  );

  if (
    ruBelowEightyAnalysisBypassesLocaleDefaultProbe.status === 0 &&
    ruBelowEightyAnalysisBypassesLocaleDefaultProbe.stdout.includes(
      "RU_BELOW_EIGHTY_ANALYSIS_LOCALE_BYPASS_PASS"
    )
  ) {
    console.log(
      "✅ PASS — A valid ru analysisResult with overall < 80 is re-validated under its own locale, not rejected under the en default"
    );
  } else {
    console.error(
      "❌ FAIL — A valid ru analysisResult with overall < 80 must not be rejected by the en-default re-validation bug"
    );
    console.error(
      ruBelowEightyAnalysisBypassesLocaleDefaultProbe.stderr.trim() ||
        ruBelowEightyAnalysisBypassesLocaleDefaultProbe.stdout.trim()
    );
    process.exitCode = 1;
    return;
  }

  const requiredAnalysisIssuePromptProbe = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `let providerRequestBody = "";

      globalThis.fetch = async (_input, init) => {
        providerRequestBody =
          typeof init?.body === "string" ? init.body : "";

        return new Response(
          JSON.stringify({
            id: "chatcmpl-analysis-context-test",
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
                      strategy: "preserve"
                    }
                  })
                },
                finish_reason: "stop"
              }
            ]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      };

      import("./app/api/improve-script/route.ts").then(async ({ POST }) => {
        const script = [
          "These are three overlooked productivity habits that almost nobody talks about.",
          "Put your phone in another room because notifications pull your attention away.",
          "Write down one priority because a long task list splits your focus.",
          "Then work for 25 minutes because a short timer makes starting feel easier."
        ].join(" ");

        const riskyExcerpt =
          "These are three overlooked productivity habits that almost nobody talks about.";

        const requiredFix =
          "Remove or soften the claim that the habits are overlooked or that almost nobody talks about them.";

        const analysisResult = {
          scriptType: "how_to",
          verdict: "mixed",
          scores: {
            overall: 70,
            hook: 75,
            retentionRisk: 40
          },
          hookDecision: "refine",
          hookAssessment:
            "The opening makes an unsupported novelty claim because the habits are presented as overlooked even though the script gives familiar advice.",
          suggestedHook:
            "These are three productivity habits that can make focusing easier.",
          riskyParts: [
            {
              excerpt: riskyExcerpt,
              reason:
                "The novelty claim is not supported by the familiar habits that follow.",
              severity: "medium"
            }
          ],
          suggestedFixes: [
            {
              target: "hook",
              suggestion: requiredFix,
              optional: false
            }
          ],
          scenes: [
            {
              excerpt: riskyExcerpt,
              label: "Unsupported novelty claim",
              status: "risky"
            },
            {
              excerpt:
                "Put your phone in another room because notifications pull your attention away.",
              label: "First habit",
              status: "strong"
            },
            {
              excerpt:
                "Write down one priority because a long task list splits your focus.",
              label: "Second habit",
              status: "strong"
            },
            {
              excerpt:
                "Then work for 25 minutes because a short timer makes starting feel easier.",
              label: "Third habit",
              status: "strong"
            }
          ],
          mainTakeaway:
            "The advice is clear, but the opening overstates its novelty and should be softened."
        };

        const response = await POST(
          new Request("http://localhost/api/improve-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Three overlooked productivity habits",
              script,
              analysisResult
            })
          })
        );

        const payload = await response.json();

        if (
          response.status !== 200 ||
          payload.status !== "preserve" ||
          !providerRequestBody.includes(requiredFix) ||
          !providerRequestBody.includes(
            "The advice is clear, but the opening overstates its novelty and should be softened."
          )
        ) {
          throw new Error(
            "Expected the validated required issue in the Improve Script provider prompt"
          );
        }

        console.log("ANALYSIS_ISSUE_PROMPT_PASS");
      }).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      });`,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
    }
  );

  if (
    requiredAnalysisIssuePromptProbe.status === 0 &&
    requiredAnalysisIssuePromptProbe.stdout.includes(
      "ANALYSIS_ISSUE_PROMPT_PASS"
    )
  ) {
    console.log(
      "✅ PASS — Improve Script prompt receives the validated required analysis issue"
    );
  } else {
    console.error(
      "❌ FAIL — Improve Script prompt must receive the validated required analysis issue"
    );
    console.error(
      requiredAnalysisIssuePromptProbe.stderr.trim() ||
        requiredAnalysisIssuePromptProbe.stdout.trim()
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
    exposesObservableCandidateAudit:
      routeSource.includes('"candidateAudit"') &&
      routeSource.includes('"resolvedPrimaryProblem"') &&
      routeSource.includes('"candidateMateriallyBetter"') &&
      routeSource.includes('"regressionIntroduced"'),
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

  const supportsEditorialPreserveDecision =
    routeSource.includes('"strategy": "preserve"') &&
    /preserve (?:the )?(?:original|script)/i.test(routeSource) &&
    /meaningful (?:editorial )?improvement/i.test(routeSource) &&
    (
      routeSource.includes("do not require") ||
      routeSource.includes("does not require") ||
      routeSource.includes("without requiring")
    );

  if (supportsEditorialPreserveDecision) {
    console.log(
      "✅ PASS — Improve Script prompt allows an honest preserve decision"
    );
  } else {
    console.error(
      "❌ FAIL — Improve Script prompt must allow an honest preserve decision"
    );
    process.exitCode = 1;
    return;
  }

  const isLocaleAware =
    routeSource.includes(
      "function buildImproveScriptLanguageInstructions("
    ) &&
    routeSource.includes(
      "${buildImproveScriptLanguageInstructions(locale)}"
    ) &&
    routeSource.includes(
      'Write every "changes" item and the "reason" field in ${languageName}.'
    ) &&
    routeSource.includes(
      "Keep \"improvedScript\" in the exact language of the Original script"
    ) &&
    routeSource.includes(
      "primaryProblemEvidence\" must remain an exact untranslated quote"
    ) &&
    routeSource.includes("normalizeApiLocale(");

  if (isLocaleAware) {
    console.log(
      "✅ PASS — Improve Script prompt is locale-aware without touching editorialDecision or improvedScript language"
    );
  } else {
    console.error(
      "❌ FAIL — Improve Script prompt must localize explanations while keeping improvedScript in the script's language"
    );
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
      {
        name: "Non-string refined hook is rejected",
        body: {
          script:
            "The valve stayed closed for 12 seconds before pressure escaped.",
          title: "Pressure test",
          refinedHook: 123,
        },
        expectedStatus: 400,
        expectedReason: /refined hook|string|invalid/i,
      },
      {
        name: "Refined hook over 1000 characters is rejected",
        body: {
          script:
            "The valve stayed closed for 12 seconds before pressure escaped.",
          title: "Pressure test",
          refinedHook: "x".repeat(1001),
        },
        expectedStatus: 400,
        expectedReason: /refined hook|1000|too long|character/i,
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
