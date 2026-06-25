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
    name: "runAnalysisV2 rejects malformed model JSON",
    run: async () => {
      const modelCaller: AnalysisV2ModelCaller =
        async () => ({
          raw: "{invalid",
          modelUsed: "mock-model",
        });

      const result = await runAnalysisV2(
        script,
        "",
        modelCaller
      );

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
    },
  },
  {
    name: "runAnalysisV2 rejects invalid grounded analysis",
    run: async () => {
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
        async () => ({
          raw: JSON.stringify(invalidResult),
          modelUsed: "mock-model",
        });

      const result = await runAnalysisV2(
        script,
        "",
        modelCaller
      );

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
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
