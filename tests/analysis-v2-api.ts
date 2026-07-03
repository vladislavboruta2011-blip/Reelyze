import assert from "node:assert/strict";

import {
  POST,
  runAnalysisV2,
  type AnalysisV2ModelCaller,
} from "../app/api/analyze-v2/route";

const script =
  "If super glue gets stuck to your skin, do not pull it apart. First, soak the area in warm soapy water. Then gently roll the skin apart. It usually comes apart in under five minutes.";

function createValidResult(): Record<string, unknown> {
  return {
    scriptType: "how_to",
    verdict: "strong",
    scores: {
      overall: 88,
      hook: 82,
      retentionRisk: 22,
    },
    hookDecision: "keep",
    hookAssessment:
      "The hook names the problem and gives an immediate warning.",
    suggestedHook: null,
    riskyParts: [],
    suggestedFixes: [],
    scenes: [
      {
        excerpt:
          "If super glue gets stuck to your skin, do not pull it apart.",
        label: "Problem and warning",
        status: "strong",
      },
      {
        excerpt:
          "First, soak the area in warm soapy water.",
        label: "First step",
        status: "strong",
      },
      {
        excerpt:
          "It usually comes apart in under five minutes.",
        label: "Resolution",
        status: "strong",
      },
    ],
    mainTakeaway:
      "This how-to script is structurally strong and fulfills its promise.",
  };
}

async function expectJson(
  response: Response
): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

const tests: TestCase[] = [
  {
    name: "runAnalysisV2 accepts valid mocked model output",
    run: async () => {
      const modelCaller: AnalysisV2ModelCaller =
        async () => ({
          raw: JSON.stringify(createValidResult()),
          modelUsed: "mock-model",
        });

      const result = await runAnalysisV2(
        script,
        "Super glue removal",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);

      if (result.ok) {
        assert.equal(result.response.status, "ok");
        assert.equal(
          result.response.modelUsed,
          "mock-model"
        );
      }
    },
  },
  {
    name: "runAnalysisV2 retries once after invalid grounded analysis",
    run: async () => {
      let callCount = 0;
      const userPrompts: string[] = [];

      const invalidResult = createValidResult();

      invalidResult.scenes = [
        {
          excerpt:
            "This excerpt does not exist in the script.",
          label: "Invented scene",
          status: "strong",
        },
      ];

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          return {
            raw: JSON.stringify(
              callCount === 1
                ? invalidResult
                : createValidResult()
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        script,
        "Super glue removal",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(callCount, 2);
      assert.match(
        userPrompts[1] ?? "",
        /previous response failed deterministic validation/i
      );
    },
  },

  {
    name: "runAnalysisV2 gives grounded retry guidance after parallel list misclassification",
    run: async () => {
      const originalityScript =
        "These are three overlooked productivity habits that almost nobody talks about. Put your phone in another room because notifications pull your attention away. Write down one priority because a long task list splits your focus. Then work for 25 minutes because a short timer makes starting feel easier.";

      let callCount = 0;
      const userPrompts: string[] = [];

      const createOriginalityResult = (
        scriptType: "list_escalation" | "how_to"
      ): Record<string, unknown> => ({
        scriptType,
        verdict: "mixed",
        scores: {
          overall: 70,
          hook: 75,
          retentionRisk: 40,
        },
        hookDecision: "refine",
        hookAssessment:
          "The opening makes an unsupported novelty claim because the habits are presented as overlooked even though the script gives familiar advice.",
        suggestedHook:
          "These are three productivity habits that can make focusing easier.",
        riskyParts: [
          {
            excerpt:
              "These are three overlooked productivity habits that almost nobody talks about.",
            reason:
              "The novelty claim is not supported by the familiar habits that follow.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Remove or soften the claim that the habits are overlooked or that almost nobody talks about them.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "These are three overlooked productivity habits that almost nobody talks about.",
            label: "Unsupported novelty claim",
            status: "risky",
          },
          {
            excerpt:
              "Put your phone in another room because notifications pull your attention away.",
            label: "First habit",
            status: "strong",
          },
          {
            excerpt:
              "Write down one priority because a long task list splits your focus.",
            label: "Second habit",
            status: "strong",
          },
          {
            excerpt:
              "Then work for 25 minutes because a short timer makes starting feel easier.",
            label: "Third habit",
            status: "strong",
          },
        ],
        mainTakeaway:
          "The advice is clear, but the opening overstates its novelty and should be softened.",
      });

      const invalidResult =
        createOriginalityResult(
          "list_escalation"
        );

      const correctedResult =
        createOriginalityResult("how_to");

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          return {
            raw: JSON.stringify(
              callCount === 1
                ? invalidResult
                : correctedResult
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        originalityScript,
        "Three overlooked productivity habits",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(callCount, 2);

      const retryPrompt = userPrompts[1] ?? "";

      assert.match(
        retryPrompt,
        /Classify the script as how_to or generic_advice, not list_escalation\./
      );
      assert.match(
        retryPrompt,
        /Do not use the word "verified"/i
      );
      assert.match(
        retryPrompt,
        /remove or soften that claim instead of asking the creator to prove it/i
      );
      assert.match(
        retryPrompt,
        /use hookDecision refine or rewrite rather than keep/i
      );

      if (result.ok) {
        assert.equal(
          result.response.result.scriptType,
          "how_to"
        );
        assert.equal(
          result.response.result.hookDecision,
          "refine"
        );
        assert.equal(
          result.response.result
            .suggestedFixes[0]?.suggestion,
          "Remove or soften the claim that the habits are overlooked or that almost nobody talks about them."
        );
      }
    },
  },

  {
    name: "runAnalysisV2 gives specific retry guidance for generic advice without a concrete anchor",
    run: async () => {
      const genericAdviceScript =
        "Life is full of choices. Some choices are good, and some choices are bad. It is up to you to decide which path to take.";

      let callCount = 0;
      const userPrompts: string[] = [];

      const createGenericAdviceResult = (
        hookDecision: "rewrite" | "diagnostic",
        suggestedHook: string | null
      ): Record<string, unknown> => ({
        scriptType: "generic_advice",
        verdict: "weak",
        scores: {
          overall: 35,
          hook: 30,
          retentionRisk: 70,
        },
        hookDecision,
        hookAssessment:
          "The opening is generic and lacks a concrete example, mechanism, named situation, number, or observable result.",
        suggestedHook,
        riskyParts: [
          {
            excerpt: "Life is full of choices.",
            reason:
              "The opening is generic and does not provide a concrete premise or observable result.",
            severity: "high",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Add a concrete example, mechanism, named situation, number, or observable result before rewriting the hook.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "Life is full of choices. Some choices are good, and some choices are bad. It is up to you to decide which path to take.",
            label: "Generic advice",
            status: "risky",
          },
        ],
        mainTakeaway:
          "The script needs concrete source material before a grounded hook can be written.",
      });

      const invalidResult =
        createGenericAdviceResult(
          "rewrite",
          "Life is full of choices."
        );

      const correctedResult =
        createGenericAdviceResult(
          "diagnostic",
          null
        );

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          return {
            raw: JSON.stringify(
              callCount === 1
                ? invalidResult
                : correctedResult
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        genericAdviceScript,
        "Life choices",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(callCount, 2);

      const retryPrompt = userPrompts[1] ?? "";

      assert.match(
        retryPrompt,
        /Use hookDecision diagnostic\./
      );
      assert.match(
        retryPrompt,
        /Set suggestedHook to null\./
      );
      assert.match(
        retryPrompt,
        /Do not use the word "verified"/i
      );
      assert.match(
        retryPrompt,
        /Add a concrete example, mechanism, named situation, number, or observable result before rewriting the hook\./
      );

      if (result.ok) {
        assert.equal(
          result.response.result.hookDecision,
          "diagnostic"
        );
        assert.equal(
          result.response.result.suggestedHook,
          undefined
        );
      }
    },
  },

  {
    name: "runAnalysisV2 gives specific retry guidance for invalid verified factual fixes",
    run: async () => {
      let callCount = 0;
      const userPrompts: string[] = [];

      const createMixedResultWithFix = (
        suggestion: string
      ): Record<string, unknown> => {
        const value = createValidResult();

        value.verdict = "mixed";
        value.scores = {
          overall: 70,
          hook: 82,
          retentionRisk: 40,
        };
        value.riskyParts = [
          {
            excerpt:
              "It usually comes apart in under five minutes.",
            reason:
              "The payoff needs a clearer consequence.",
            severity: "medium",
          },
        ];
        value.suggestedFixes = [
          {
            target: "payoff",
            suggestion,
            optional: false,
          },
        ];
        value.mainTakeaway =
          "The script is useful, but the payoff needs a clearer consequence.";

        return value;
      };

      const invalidResult = createMixedResultWithFix(
        "Add a verified consequence or implication that explains why the warm soapy water step matters."
      );

      const correctedResult = createMixedResultWithFix(
        "Add a verified consequence or implication that explains why this matters."
      );

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          return {
            raw: JSON.stringify(
              callCount === 1
                ? invalidResult
                : correctedResult
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        script,
        "Super glue removal",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(callCount, 2);

      const retryPrompt = userPrompts[1] ?? "";

      assert.match(
        retryPrompt,
        /use exactly one of these complete sentences/i
      );
      assert.match(
        retryPrompt,
        /Add a verified consequence or implication that explains why this matters\./
      );
      assert.match(
        retryPrompt,
        /Alternatively, remove the word "verified"/i
      );

      if (result.ok) {
        assert.equal(
          result.response.result.suggestedFixes[0]
            ?.suggestion,
          "Add a verified consequence or implication that explains why this matters."
        );
      }
    },
  },

  {
    name: "runAnalysisV2 rejects malformed model JSON",
    run: async () => {
      let callCount = 0;

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: "{invalid",
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        script,
        "",
        modelCaller
      );

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
      assert.equal(callCount, 1);
    },
  },
  {
    name: "runAnalysisV2 rejects invalid grounded analysis",
    run: async () => {
      let callCount = 0;
      const invalidResult = createValidResult();

      invalidResult.scenes = [
        {
          excerpt:
            "This excerpt does not exist in the script.",
          label: "Invented scene",
          status: "strong",
        },
      ];

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: JSON.stringify(invalidResult),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        script,
        "",
        modelCaller
      );

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
      assert.equal(callCount, 2);
    },
  },
  {
    name: "runAnalysisV2 maps provider failures to safe 503",
    run: async () => {
      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          throw Object.assign(
            new Error("Sensitive provider failure"),
            {
              status: 429,
            }
          );
        };

      const result = await runAnalysisV2(
        script,
        "",
        modelCaller
      );

      assert.equal(result.ok, false);
      assert.equal(result.status, 503);

      if (!result.ok) {
        assert.equal(
          result.response.reason.includes(
            "Sensitive provider failure"
          ),
          false
        );
      }
    },
  },
  {
    name: "invalid input stops before the model call",
    run: async () => {
      let called = false;

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          called = true;

          return {
            raw: JSON.stringify(createValidResult()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        "",
        "",
        modelCaller
      );

      assert.equal(result.ok, false);
      assert.equal(result.status, 400);
      assert.equal(called, false);
    },
  },
  {
    name: "POST rejects unsupported content type",
    run: async () => {
      const request = new Request(
        "http://localhost/api/analyze-v2",
        {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
          },
          body: script,
        }
      );

      const response = await POST(request);

      assert.equal(response.status, 415);
    },
  },
  {
    name: "POST rejects malformed JSON",
    run: async () => {
      const request = new Request(
        "http://localhost/api/analyze-v2",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{invalid",
        }
      );

      const response = await POST(request);

      assert.equal(response.status, 400);
    },
  },
  {
    name: "POST rejects an oversized declared body",
    run: async () => {
      const request = new Request(
        "http://localhost/api/analyze-v2",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": "20000",
          },
          body: "{}",
        }
      );

      const response = await POST(request);

      assert.equal(response.status, 413);
    },
  },
  {
    name: "POST rejects a non-object request body",
    run: async () => {
      const request = new Request(
        "http://localhost/api/analyze-v2",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify("not-an-object"),
        }
      );

      const response = await POST(request);

      assert.equal(response.status, 400);
    },
  },
  {
    name: "POST rejects an empty script",
    run: async () => {
      const request = new Request(
        "http://localhost/api/analyze-v2",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            script: "",
            title: "",
          }),
        }
      );

      const response = await POST(request);

      assert.equal(response.status, 400);
    },
  },
  {
    name: "POST returns safe 503 without an API key",
    run: async () => {
      const originalApiKey =
        process.env.OPENAI_API_KEY;

      delete process.env.OPENAI_API_KEY;

      try {
        const request = new Request(
          "http://localhost/api/analyze-v2",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.20",
            },
            body: JSON.stringify({
              script,
              title: "",
            }),
          }
        );

        const response = await POST(request);
        const payload = await expectJson(response);

        assert.equal(response.status, 503);
        assert.equal(payload.status, "error");
        assert.equal(
          /api.?key|credential|openai/i.test(
            String(payload.reason)
          ),
          false
        );
      } finally {
        if (originalApiKey === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY =
            originalApiKey;
        }
      }
    },
  },
  {
    name: "POST accepts a mocked OpenAI structured response",
    run: async () => {
      const originalFetch = globalThis.fetch;
      const originalApiKey =
        process.env.OPENAI_API_KEY;

      process.env.OPENAI_API_KEY = "test-key";

      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            id: "chatcmpl-analysis-v2-test",
            object: "chat.completion",
            created: 0,
            model: "gpt-4o-mini-test",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: JSON.stringify(
                    createValidResult()
                  ),
                },
                finish_reason: "stop",
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )) as typeof fetch;

      try {
        const request = new Request(
          "http://localhost/api/analyze-v2",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.30",
            },
            body: JSON.stringify({
              script,
              title: "Super glue removal",
            }),
          }
        );

        const response = await POST(request);
        const payload = await expectJson(response);

        assert.equal(response.status, 200);
        assert.equal(payload.status, "ok");
        assert.equal(
          payload.modelUsed,
          "gpt-4o-mini-test"
        );
      } finally {
        globalThis.fetch = originalFetch;

        if (originalApiKey === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY =
            originalApiKey;
        }
      }
    },
  },
  {
    name: "POST rate limits the eleventh request",
    run: async () => {
      const originalApiKey =
        process.env.OPENAI_API_KEY;

      delete process.env.OPENAI_API_KEY;

      try {
        for (let index = 0; index < 10; index += 1) {
          const request = new Request(
            "http://localhost/api/analyze-v2",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                "X-Forwarded-For":
                  "203.0.113.40",
              },
              body: JSON.stringify({
                script,
                title: "",
              }),
            }
          );

          const response = await POST(request);

          assert.equal(response.status, 503);
        }

        const limitedRequest = new Request(
          "http://localhost/api/analyze-v2",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "X-Forwarded-For":
                "203.0.113.40",
            },
            body: JSON.stringify({
              script,
              title: "",
            }),
          }
        );

        const limitedResponse =
          await POST(limitedRequest);

        assert.equal(limitedResponse.status, 429);
        assert.ok(
          limitedResponse.headers.get(
            "Retry-After"
          )
        );
      } finally {
        if (originalApiKey === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY =
            originalApiKey;
        }
      }
    },
  },
];

async function main(): Promise<void> {
  let passed = 0;

  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`PASS — ${test.name}`);
    } catch (error) {
      console.error(`FAIL — ${test.name}`);
      throw error;
    }
  }

  console.log(
    `\nAnalysis V2 API tests: ${passed}/${tests.length} passed`
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
