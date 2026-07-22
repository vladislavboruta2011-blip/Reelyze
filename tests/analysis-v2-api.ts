import assert from "node:assert/strict";

import {
  ANALYSIS_V2_REQUEST_ID_HEADER,
  ANALYSIS_V2_RETRY_COUNT_HEADER,
  POST,
  runAnalysisV2,
  type AnalysisV2ModelCaller,
} from "../app/api/analyze-v2/route";
import { ANALYSIS_V2_JSON_SCHEMA } from "../engine/analysis-v2-json-schema";
import { adaptAnalysisV2ForResults } from "../engine/analysis-v2-ui-adapter";
import type { AnalysisV2SuccessResponse } from "../engine/analysis-v2-schema";

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

function createValidComponentResult(): Record<string, unknown> {
  const result = createValidResult();

  delete result.scores;

  result.scoreComponents = {
    overall: {
      premiseAppeal: 22,
      openingPromise: 22,
      progression: 22,
      payoff: 22,
    },
    hook: {
      immediacy: 21,
      specificity: 21,
      viewerPull: 20,
      deliveryAlignment: 20,
    },
    retentionRisk: {
      openingFriction: 5,
      progressionRisk: 5,
      predictabilityRisk: 6,
      payoffRisk: 6,
    },
  };

  return result;
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
    name: "runAnalysisV2 accepts a strong result below 85 without a refinement",
    run: async () => {
      const value = createValidResult();

      value.scores = {
        overall: 80,
        hook: 82,
        retentionRisk: 28,
      };
      value.suggestedFixes = [];

      const modelCaller: AnalysisV2ModelCaller =
        async () => ({
          raw: JSON.stringify(value),
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
        assert.equal(
          result.response.result.verdict,
          "strong"
        );
        assert.equal(
          result.response.result.suggestedFixes.length,
          0
        );
      }
    },
  },
  {
    name: "structured output schema requires score components",
    run: async () => {
      const required =
        ANALYSIS_V2_JSON_SCHEMA.required as readonly string[];

      assert.equal(
        required.includes("scoreComponents"),
        true
      );
      assert.equal(required.includes("scores"), false);
      assert.equal(
        "scoreComponents" in
          ANALYSIS_V2_JSON_SCHEMA.properties,
        true
      );
    },
  },
    {
      name: "runAnalysisV2 derives scores and exposes a validated breakdown",
      run: async () => {
        const componentResult =
          createValidComponentResult();

        const modelCaller: AnalysisV2ModelCaller =
          async () => ({
            raw: JSON.stringify(
              componentResult
            ),
            modelUsed: "mock-component-model",
          });

        const result = await runAnalysisV2(
          script,
          "Super glue removal",
          modelCaller
        );

        assert.equal(result.ok, true);

        if (result.ok) {
          assert.deepEqual(
            result.response.result.scores,
            {
              overall: 88,
              hook: 82,
              retentionRisk: 22,
            }
          );
          assert.deepEqual(
            result.response.result.scoreBreakdown,
            componentResult.scoreComponents
          );
          assert.equal(
            "scoreComponents" in
              result.response.result,
            false
          );
        }
      },
    },
  {
    name: "runAnalysisV2 repairs an invalid below-80 main takeaway without retrying",
    run: async () => {
      let callCount = 0;
      const componentResult =
        createValidComponentResult();
      const scoreComponents =
        componentResult.scoreComponents as {
          overall: Record<string, number>;
        };

      scoreComponents.overall = {
        premiseAppeal: 10,
        openingPromise: 21,
        progression: 21,
        payoff: 21,
      };
      componentResult.verdict = "mixed";
      componentResult.riskyParts = [
        {
          excerpt:
            "It usually comes apart in under five minutes.",
          reason:
            "The ending resolves the process, but the premise has limited audience pull.",
          severity: "medium",
        },
      ];
      componentResult.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Connect the final resolution more clearly to why the result matters to the viewer.",
          optional: false,
        },
      ];
      componentResult.scenes = [
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
          label: "Limited viewer reward",
          status: "risky",
        },
      ];
      componentResult.mainTakeaway =
        "The script is clear and structurally polished throughout.";

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: JSON.stringify(componentResult),
            modelUsed: "mock-repair-model",
          };
        };

      const result = await runAnalysisV2(
        script,
        "Super glue removal",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(callCount, 1);

      if (result.ok) {
        assert.equal(
          result.response.modelUsed,
          "mock-repair-model"
        );
        assert.equal(
          result.response.result.scores.overall,
          73
        );
        assert.match(
          result.response.result.mainTakeaway,
          /premise appeal/i
        );
        assert.match(
          result.response.result.mainTakeaway,
          /limits the overall score/i
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
    // Regression coverage for the live-model failure: prompt hardening
    // alone reduced hype/bridge filler but did not stop the model from
    // reassigning an explicit measurement ("2.38 meters") from the script's
    // actual measured subject ("his foot") onto a different concrete
    // subject ("the bicycle kick"). This exercises the full runtime
    // pipeline (not just the narrow validator in isolation) to confirm the
    // corrective retry actually triggers, receives the exact live invalid
    // hook's defect, and that a corrected candidate is accepted using the
    // existing bounded retry policy — no extra model call introduced.
    name: "runAnalysisV2 retries once and accepts a corrected hook after a live-reported measurement-subject reassignment",
    run: async () => {
      let callCount = 0;
      const userPrompts: string[] = [];

      const ronaldoScript =
        "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters. The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball. That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.";

      const createRonaldoRewriteResult = (
        suggestedHook: string
      ): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scores: {
          overall: 68,
          hook: 55,
          retentionRisk: 48,
        },
        hookDecision: "rewrite",
        hookAssessment:
          "The opening delays the concrete measurement behind a generic framing sentence instead of leading with it.",
        suggestedHook,
        riskyParts: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            reason:
              "The concrete measurement is delayed behind a generic framing opener instead of leading the hook.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Open directly with the concrete measurement already in the script instead of a generic framing sentence.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            label: "Opening",
            status: "risky",
          },
          {
            excerpt:
              "The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball.",
            label: "Context",
            status: "average",
          },
          {
            excerpt:
              "That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.",
            label: "Resolution",
            status: "strong",
          },
        ],
        mainTakeaway:
          "The script has a strong grounded fact, but the hook delays it behind a generic opener instead of leading with the measurement.",
      });

      const invalidHook =
        "Cristiano Ronaldo's 2018 bicycle kick against Juventus reached about 2.38 meters, making it one of the most athletic finishes of his career.";
      const correctedHook =
        "Cristiano Ronaldo's foot reached about 2.38 meters during his 2018 bicycle kick against Juventus.";

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          return {
            raw: JSON.stringify(
              createRonaldoRewriteResult(
                callCount === 1
                  ? invalidHook
                  : correctedHook
              )
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        ronaldoScript,
        "Ronaldo bicycle kick",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(
        callCount,
        2,
        "expected exactly one corrective retry — no extra model call beyond the existing retry policy"
      );

      if (result.ok) {
        assert.equal(
          result.response.result.suggestedHook,
          correctedHook
        );
      }

      assert.match(
        userPrompts[1] ?? "",
        /assigns an explicit measurement to a different subject/i
      );
      assert.match(
        userPrompts[1] ?? "",
        /keep the rewritten hook's grammatical subject for that number the same/i
      );
      assert.match(
        userPrompts[1] ?? "",
        /the suggestedhook is rewritten script text\. keep it in the same language as the submitted script/i
      );

      // The internal validation reason must never reach the user-facing
      // response — only the generic error message does, and only on a
      // final (non-retried) failure.
      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /assigns an explicit measurement to a different subject/i
      );
    },
  },

  {
    // The measurement-subject guard must never block a hook that keeps the
    // measurement on its correct subject — confirms no false positive on a
    // clean first attempt (zero retries).
    name: "runAnalysisV2 accepts a grounded hook rewrite that correctly preserves the measured subject on the first attempt",
    run: async () => {
      let callCount = 0;

      const ronaldoScript =
        "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters. The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball. That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.";

      const validResult = {
        scriptType: "narrative_event",
        verdict: "mixed",
        scores: {
          overall: 68,
          hook: 55,
          retentionRisk: 48,
        },
        hookDecision: "rewrite",
        hookAssessment:
          "The opening delays the concrete measurement behind a generic framing sentence instead of leading with it.",
        suggestedHook:
          "Cristiano Ronaldo's foot reached about 2.38 meters during his 2018 bicycle kick against Juventus.",
        riskyParts: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            reason:
              "The concrete measurement is delayed behind a generic framing opener instead of leading the hook.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Open directly with the concrete measurement already in the script instead of a generic framing sentence.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            label: "Opening",
            status: "risky",
          },
          {
            excerpt:
              "The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball.",
            label: "Context",
            status: "average",
          },
          {
            excerpt:
              "That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.",
            label: "Resolution",
            status: "strong",
          },
        ],
        mainTakeaway:
          "The script has a strong grounded fact, but the hook delays it behind a generic opener instead of leading with the measurement.",
      };

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: JSON.stringify(validResult),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        ronaldoScript,
        "Ronaldo bicycle kick",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(callCount, 1);
    },
  },

  {
    // Regression coverage for the diagnosed pipeline gap: the final
    // targeted retry (attempt 1 -> attempt 2) can be triggered by a
    // completely unrelated validation reason (here, a mixed-verdict/score
    // mismatch), and restructuring the hook to fix THAT problem could
    // silently reassign the measurement's subject with no reminder not to.
    // This proves the reminder is now present in that prompt even though
    // the reason that triggered escalation was never the measurement one.
    name: "runAnalysisV2 includes the measurement-subject reminder in the final targeted retry even when a different validation reason triggered it, and accepts a corrected final candidate",
    run: async () => {
      let callCount = 0;
      const userPrompts: string[] = [];

      const ronaldoScript =
        "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters. The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball. That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.";

      const invalidHook =
        "Cristiano Ronaldo's 2018 bicycle kick against Juventus reached about 2.38 meters, making it one of the most athletic finishes of his career.";
      const correctedHook =
        "Cristiano Ronaldo's foot reached about 2.38 meters during his 2018 bicycle kick against Juventus.";

      const baseResult = (
        suggestedHook: string,
        overall: number
      ): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scores: {
          overall,
          hook: 55,
          retentionRisk: 48,
        },
        hookDecision: "rewrite",
        hookAssessment:
          "The opening delays the concrete measurement behind a generic framing sentence instead of leading with it.",
        suggestedHook,
        riskyParts: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            reason:
              "The concrete measurement is delayed behind a generic framing opener instead of leading the hook.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Open directly with the concrete measurement already in the script instead of a generic framing sentence.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            label: "Opening",
            status: "risky",
          },
          {
            excerpt:
              "The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball.",
            label: "Context",
            status: "average",
          },
          {
            excerpt:
              "That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.",
            label: "Resolution",
            status: "strong",
          },
        ],
        mainTakeaway:
          "The script has a strong grounded fact, but the hook delays it behind a generic opener instead of leading with the measurement.",
      });

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          if (callCount === 1) {
            // Attempt 1 fails on the measurement-subject validator itself.
            return {
              raw: JSON.stringify(
                baseResult(invalidHook, 68)
              ),
              modelUsed: "mock-model",
            };
          }

          if (callCount === 2) {
            // Attempt 2 fixes the subject but introduces an UNRELATED
            // defect (overall score outside the valid mixed range) that
            // is one of the fixed finalTargetedRetry-eligible reasons —
            // this is what actually triggers the final targeted retry.
            return {
              raw: JSON.stringify(
                baseResult(correctedHook, 90)
              ),
              modelUsed: "mock-model",
            };
          }

          // Attempt 3 (the final targeted retry's own output): fully
          // corrected — subject preserved AND overall back in range.
          return {
            raw: JSON.stringify(
              baseResult(correctedHook, 68)
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        ronaldoScript,
        "Ronaldo bicycle kick",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(
        callCount,
        3,
        "expected exactly 3 model calls — the existing retry policy, not an added attempt"
      );

      if (result.ok) {
        assert.equal(
          result.response.result.suggestedHook,
          correctedHook
        );
      }

      // Attempt 2's retry prompt (built from attempt 1's own reason) still
      // carries the measurement-subject guidance.
      assert.match(
        userPrompts[1] ?? "",
        /assigns an explicit measurement to a different subject/i
      );

      // Attempt 3's prompt is the FINAL targeted retry, built from attempt
      // 2's reason — a mixed-verdict/score mismatch, NOT the measurement
      // reason. It must still carry the measurement-subject reminder (the
      // fix under test), plus the guidance for the reason that actually
      // triggered it (no regression to existing final-retry behavior).
      const finalRetryPrompt = userPrompts[2] ?? "";

      assert.match(
        finalRetryPrompt,
        /mixed verdict is inconsistent/i
      );
      assert.doesNotMatch(
        finalRetryPrompt,
        /assigns an explicit measurement to a different subject/i
      );
      assert.match(
        finalRetryPrompt,
        /keep it attached to the exact person, object, or body part the script says it measures/i
      );
      assert.match(
        finalRetryPrompt,
        /the suggestedhook is rewritten script text\. keep it in the same language as the submitted script/i
      );

      // The internal validation reason must never reach the user-facing
      // response.
      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /assigns an explicit measurement to a different subject/i
      );
      assert.doesNotMatch(
        responseText,
        /mixed verdict is inconsistent/i
      );
    },
  },

  {
    // The other side of the same regression: if the final targeted retry's
    // own candidate STILL reassigns the measurement despite the reminder,
    // the request must fail safely — exactly 3 calls, a generic public
    // error, and no internal reason leaked — never a 4th model call.
    name: "runAnalysisV2 fails safely after exactly 3 attempts when the final targeted retry candidate still reassigns the measurement",
    run: async () => {
      let callCount = 0;

      const ronaldoScript =
        "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters. The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball. That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.";

      const invalidHook =
        "Cristiano Ronaldo's 2018 bicycle kick against Juventus reached about 2.38 meters, making it one of the most athletic finishes of his career.";
      const correctedHook =
        "Cristiano Ronaldo's foot reached about 2.38 meters during his 2018 bicycle kick against Juventus.";

      const baseResult = (
        suggestedHook: string,
        overall: number
      ): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scores: {
          overall,
          hook: 55,
          retentionRisk: 48,
        },
        hookDecision: "rewrite",
        hookAssessment:
          "The opening delays the concrete measurement behind a generic framing sentence instead of leading with it.",
        suggestedHook,
        riskyParts: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            reason:
              "The concrete measurement is delayed behind a generic framing opener instead of leading the hook.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Open directly with the concrete measurement already in the script instead of a generic framing sentence.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            label: "Opening",
            status: "risky",
          },
          {
            excerpt:
              "The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball.",
            label: "Context",
            status: "average",
          },
          {
            excerpt:
              "That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.",
            label: "Resolution",
            status: "strong",
          },
        ],
        mainTakeaway:
          "The script has a strong grounded fact, but the hook delays it behind a generic opener instead of leading with the measurement.",
      });

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          if (callCount === 1) {
            return {
              raw: JSON.stringify(
                baseResult(invalidHook, 68)
              ),
              modelUsed: "mock-model",
            };
          }

          if (callCount === 2) {
            return {
              raw: JSON.stringify(
                baseResult(correctedHook, 90)
              ),
              modelUsed: "mock-model",
            };
          }

          // Attempt 3 still reassigns the measurement despite the reminder
          // — the request must give up safely, not retry a 4th time.
          return {
            raw: JSON.stringify(
              baseResult(invalidHook, 68)
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        ronaldoScript,
        "Ronaldo bicycle kick",
        modelCaller
      );

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
      assert.equal(
        callCount,
        3,
        "must give up after exactly 3 attempts — no 4th model call"
      );

      if (!result.ok) {
        assert.deepEqual(result.response, {
          status: "error",
          reason:
            "Analysis V2 returned an invalid analysis.",
        });
      }

      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /assigns an explicit measurement to a different subject/i
      );
      assert.doesNotMatch(
        responseText,
        /foot|kick|Juventus|Ronaldo/i
      );
    },
  },

  {
    // Regression coverage for the live-reported language-policy bug: an
    // English script analyzed with the Russian interface locale returned a
    // suggestedHook translated into Russian, which also silently defeated
    // the measurement-subject validator (it could not compare an English
    // source relationship against a Russian hook). This confirms the
    // accepted pipeline path keeps a correct English suggestedHook exactly
    // as returned — untranslated, untouched, subject preserved on "foot" —
    // while the Russian explanatory fields pass through unchanged, and that
    // this combination is accepted on the first attempt with zero retries.
    name: "runAnalysisV2 accepts an English suggestedHook unchanged for an English script analyzed under the Russian interface locale (Ronaldo regression)",
    run: async () => {
      let callCount = 0;

      const ronaldoScript =
        "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters. The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball. That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.";

      const englishHook =
        "Cristiano Ronaldo's foot reached about 2.38 meters during his 2018 bicycle kick against Juventus.";

      const validResultWithRussianExplanations = {
        scriptType: "narrative_event",
        verdict: "mixed",
        scores: {
          overall: 68,
          hook: 55,
          retentionRisk: 48,
        },
        hookDecision: "rewrite",
        hookAssessment:
          "Открытие откладывает конкретное измерение за общей вступительной фразой вместо того, чтобы вести с него.",
        suggestedHook: englishHook,
        riskyParts: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            reason:
              "Конкретное измерение задержано за общим вступительным открытием вместо того, чтобы вести хук.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Начните сразу с конкретного измерения, уже присутствующего в сценарии, вместо общего вступительного предложения.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            label: "Открытие",
            status: "risky",
          },
          {
            excerpt:
              "The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball.",
            label: "Контекст",
            status: "average",
          },
          {
            excerpt:
              "That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.",
            label: "Развязка",
            status: "strong",
          },
        ],
        mainTakeaway:
          "В сценарии есть сильный обоснованный факт, но хук откладывает его за общим вступлением вместо того, чтобы вести с измерения.",
      };

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: JSON.stringify(
              validResultWithRussianExplanations
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        ronaldoScript,
        "Ronaldo bicycle kick",
        modelCaller,
        "ru"
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(
        callCount,
        1,
        "a correct English hook alongside Russian explanations must be accepted on the first attempt"
      );

      if (result.ok) {
        assert.equal(
          result.response.result.suggestedHook,
          englishHook,
          "suggestedHook must remain in English exactly as returned, never translated toward the ru interface locale"
        );
        assert.equal(
          result.response.result.hookAssessment,
          validResultWithRussianExplanations.hookAssessment,
          "hookAssessment must remain in the ru interface locale, untouched"
        );
        assert.equal(result.response.locale, "ru");
      }
    },
  },

  {
    // Retry-gate regression: before the fix, isAnalysisV2FinalTargetedRetryReason
    // did not recognize the measurement-subject reason, so a request whose
    // FIRST RETRY (attempt 1, not attempt 0) still reassigned the measurement
    // would give up after exactly 2 model calls, never reaching the final
    // targeted retry — even though a more detailed, dedicated guidance
    // branch for this exact reason already existed there. This proves the
    // gate now lets that failure escalate to the existing (not a new) final
    // targeted retry, and that a corrected third candidate is accepted.
    name: "runAnalysisV2 escalates an attempt-1 measurement-subject failure to the final targeted retry (retry-gate fix) and accepts a corrected third candidate",
    run: async () => {
      let callCount = 0;
      const userPrompts: string[] = [];

      const ronaldoScript =
        "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters. The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball. That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.";

      const invalidHook =
        "Cristiano Ronaldo's 2018 bicycle kick against Juventus reached about 2.38 meters, making it one of the most athletic finishes of his career.";
      const correctedHook =
        "Cristiano Ronaldo's foot reached about 2.38 meters during his 2018 bicycle kick against Juventus.";

      const baseResult = (
        suggestedHook: string
      ): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scores: {
          overall: 68,
          hook: 55,
          retentionRisk: 48,
        },
        hookDecision: "rewrite",
        hookAssessment:
          "The opening delays the concrete measurement behind a generic framing sentence instead of leading with it.",
        suggestedHook,
        riskyParts: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            reason:
              "The concrete measurement is delayed behind a generic framing opener instead of leading the hook.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Open directly with the concrete measurement already in the script instead of a generic framing sentence.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            label: "Opening",
            status: "risky",
          },
          {
            excerpt:
              "The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball.",
            label: "Context",
            status: "average",
          },
          {
            excerpt:
              "That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.",
            label: "Resolution",
            status: "strong",
          },
        ],
        mainTakeaway:
          "The script has a strong grounded fact, but the hook delays it behind a generic opener instead of leading with the measurement.",
      });

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          if (callCount <= 2) {
            // Attempt 0 AND attempt 1 (the first retry's own output) both
            // reassign the measurement — before the fix, attempt 1's
            // failure would end the request right here.
            return {
              raw: JSON.stringify(baseResult(invalidHook)),
              modelUsed: "mock-model",
            };
          }

          // Attempt 2 (the final targeted retry's own output): corrected.
          return {
            raw: JSON.stringify(baseResult(correctedHook)),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        ronaldoScript,
        "Ronaldo bicycle kick",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(
        callCount,
        3,
        "the attempt-1 measurement-subject failure must escalate to exactly one final targeted retry — no 4th call"
      );

      if (result.ok) {
        assert.equal(
          result.response.result.suggestedHook,
          correctedHook
        );
      }

      // userPrompts[2] is the final targeted retry's prompt, built from
      // attempt 1's own (measurement-subject) reason.
      assert.match(
        userPrompts[2] ?? "",
        /assigns an explicit measurement to a different subject/i
      );
      assert.match(
        userPrompts[2] ?? "",
        /identify exactly which person, object, or body part the script says the number measures/i,
        "the detailed measurement guidance must appear in the final targeted retry when it is the triggering reason"
      );

      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /assigns an explicit measurement to a different subject/i
      );
    },
  },

  {
    // The other side of the gate fix: if the final targeted retry's own
    // candidate STILL reassigns the measurement, the request must still
    // fail safely at exactly 3 attempts — the gate fix must not create a
    // 4th call or change the public error contract.
    name: "runAnalysisV2 fails safely at exactly 3 attempts when an attempt-1 measurement-subject failure escalates but the final candidate is still invalid",
    run: async () => {
      let callCount = 0;

      const ronaldoScript =
        "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters. The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball. That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.";

      const invalidHook =
        "Cristiano Ronaldo's 2018 bicycle kick against Juventus reached about 2.38 meters, making it one of the most athletic finishes of his career.";

      const baseResult = (): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scores: {
          overall: 68,
          hook: 55,
          retentionRisk: 48,
        },
        hookDecision: "rewrite",
        hookAssessment:
          "The opening delays the concrete measurement behind a generic framing sentence instead of leading with it.",
        suggestedHook: invalidHook,
        riskyParts: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            reason:
              "The concrete measurement is delayed behind a generic framing opener instead of leading the hook.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Open directly with the concrete measurement already in the script instead of a generic framing sentence.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            label: "Opening",
            status: "risky",
          },
          {
            excerpt:
              "The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball.",
            label: "Context",
            status: "average",
          },
          {
            excerpt:
              "That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.",
            label: "Resolution",
            status: "strong",
          },
        ],
        mainTakeaway:
          "The script has a strong grounded fact, but the hook delays it behind a generic opener instead of leading with the measurement.",
      });

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: JSON.stringify(baseResult()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        ronaldoScript,
        "Ronaldo bicycle kick",
        modelCaller
      );

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
      assert.equal(
        callCount,
        3,
        "must give up after exactly 3 attempts — the gate fix must never add a 4th model call"
      );

      if (!result.ok) {
        assert.deepEqual(result.response, {
          status: "error",
          reason:
            "Analysis V2 returned an invalid analysis.",
        });
      }

      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /assigns an explicit measurement to a different subject/i
      );
      assert.doesNotMatch(
        responseText,
        /foot|kick|Juventus|Ronaldo/i
      );
    },
  },

  {
    // Finding B regression: the exact manually-tested script (grounded
    // measurement + comparison + payoff) with a mainTakeaway that never
    // names the lowest-scoring overall component. The deterministic repair
    // (repairAnalysisV2MainTakeawayForScoreBreakdown) fixes the mainTakeaway
    // TEXT successfully, but this fixture also has an unrelated, genuinely
    // separate defect (the opening's cause/consequence split across two
    // sentences is not flagged as a grounded opening riskyPart) that was
    // masked behind the mainTakeaway failure and only surfaces on
    // re-validation — proving the repair alone cannot always resolve this
    // reason. Before the gate fix, attempt 1's identical failure would end
    // the request right here with a raw 502.
    name: "runAnalysisV2 escalates an attempt-1 mainTakeaway-consistency failure to the final targeted retry (retry-gate fix) and accepts a corrected third candidate",
    run: async () => {
      let callCount = 0;
      const userPrompts: string[] = [];

      const measurementScript =
        "Most people would never expect Cristiano Ronaldo’s head to reach around 9 feet 7 inches above the ground. An average person jumping might reach about 7 feet 6 inches. That means Ronaldo reached roughly 2 feet higher, which is what made the jump so unusual.";

      const flawedResult = (): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scoreComponents: {
          overall: {
            premiseAppeal: 18,
            openingPromise: 15,
            progression: 20,
            payoff: 10,
          },
          hook: {
            immediacy: 18,
            specificity: 18,
            viewerPull: 17,
            deliveryAlignment: 17,
          },
          retentionRisk: {
            openingFriction: 10,
            progressionRisk: 10,
            predictabilityRisk: 10,
            payoffRisk: 15,
          },
        },
        hookDecision: "refine",
        hookAssessment:
          "The hook states a grounded measurement comparison.",
        suggestedHook:
          "Cristiano Ronaldo once jumped so high his head reached around 9 feet 7 inches off the ground.",
        riskyParts: [
          {
            excerpt:
              "That means Ronaldo reached roughly 2 feet higher, which is what made the jump so unusual.",
            reason:
              "The ending states the difference but does not add a stronger payoff beyond restating the comparison.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "payoff",
            optional: false,
            suggestion:
              "Add a verified consequence or implication that explains why this matters.",
          },
        ],
        scenes: [
          {
            excerpt:
              "Most people would never expect Cristiano Ronaldo’s head to reach around 9 feet 7 inches above the ground.",
            label: "Hook",
            status: "strong",
          },
          {
            excerpt:
              "An average person jumping might reach about 7 feet 6 inches.",
            label: "Comparison",
            status: "strong",
          },
          {
            excerpt:
              "That means Ronaldo reached roughly 2 feet higher, which is what made the jump so unusual.",
            label: "Payoff",
            status: "risky",
          },
        ],
        // Never names "payoff" (the lowest component) or explains a
        // limitation — this is the exact confirmed Finding B reason.
        mainTakeaway:
          "This script is engaging and mostly works well as a Short.",
      });

      const correctedResult = (): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scoreComponents: {
          overall: {
            premiseAppeal: 18,
            openingPromise: 15,
            progression: 20,
            payoff: 15,
          },
          hook: {
            immediacy: 18,
            specificity: 18,
            viewerPull: 17,
            deliveryAlignment: 18,
          },
          retentionRisk: {
            openingFriction: 10,
            progressionRisk: 10,
            predictabilityRisk: 10,
            payoffRisk: 12,
          },
        },
        hookDecision: "refine",
        hookAssessment:
          "The hook states a grounded measurement but defers the comparison payoff to the next sentence.",
        suggestedHook:
          "Cristiano Ronaldo once jumped so high his head reached around 9 feet 7 inches off the ground — roughly 2 feet higher than an average person might reach, about 7 feet 6 inches.",
        riskyParts: [
          {
            excerpt:
              "Most people would never expect Cristiano Ronaldo’s head to reach around 9 feet 7 inches above the ground.",
            reason:
              "The opening states the measurement but defers the comparison and consequence to the next two sentences, reducing hook immediacy.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            optional: false,
            suggestion:
              "Combine the measurement and the comparison into the opening sentence so the payoff lands immediately.",
          },
        ],
        scenes: [
          {
            excerpt:
              "Most people would never expect Cristiano Ronaldo’s head to reach around 9 feet 7 inches above the ground.",
            label: "Hook",
            status: "risky",
          },
          {
            excerpt:
              "An average person jumping might reach about 7 feet 6 inches.",
            label: "Comparison",
            status: "strong",
          },
          {
            excerpt:
              "That means Ronaldo reached roughly 2 feet higher, which is what made the jump so unusual.",
            label: "Payoff",
            status: "strong",
          },
        ],
        // Names "payoff" (the lowest component) and explains the limitation.
        mainTakeaway:
          "The script is understandable, but its payoff limits the overall score because the ending payoff does not deliver a strong enough viewer reward.",
      });

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          if (callCount <= 2) {
            // Attempt 0 AND attempt 1 (the first retry's own output) both
            // keep the same generic mainTakeaway — before the fix, attempt
            // 1's failure would end the request right here.
            return {
              raw: JSON.stringify(flawedResult()),
              modelUsed: "mock-model",
            };
          }

          // Attempt 2 (the final targeted retry's own output): corrected.
          return {
            raw: JSON.stringify(correctedResult()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        measurementScript,
        "Ronaldo jump height",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(
        callCount,
        3,
        "the attempt-1 mainTakeaway-consistency failure must escalate to exactly one final targeted retry — no 4th call"
      );

      if (result.ok) {
        assert.equal(
          result.response.result.mainTakeaway,
          correctedResult().mainTakeaway
        );
      }

      // userPrompts[2] is the final targeted retry's prompt, built from
      // attempt 1's own (mainTakeaway-consistency) reason.
      const finalRetryPrompt = userPrompts[2] ?? "";

      assert.match(
        finalRetryPrompt,
        /mainTakeaway must identify the lowest-scoring overall component/i
      );
      assert.match(
        finalRetryPrompt,
        /identify the lowest-scoring overall component/i,
        "the final targeted retry must instruct the model to identify the lowest-scoring overall component"
      );
      assert.match(
        finalRetryPrompt,
        /explain (?:in mainTakeaway )?how (?:it|that (?:specific )?component) limited the overall score/i,
        "the final targeted retry must instruct the model to explain how the lowest component limited the score"
      );
      assert.match(
        finalRetryPrompt,
        /do not invent a different weakness|the same lowest-scoring component identified by the score breakdown/i,
        "the final targeted retry must instruct the model not to invent a different weakness than the actual lowest component"
      );

      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /mainTakeaway must identify the lowest-scoring overall component/i
      );
    },
  },

  {
    // The other side of the same gate fix: if the final targeted retry's
    // own candidate STILL keeps a mainTakeaway that fails to name the
    // lowest-scoring component, the request must fail safely — exactly 3
    // calls, the existing generic public 502, and no internal validation
    // reason leaked — never a 4th model call.
    name: "runAnalysisV2 fails safely at exactly 3 attempts when an attempt-1 mainTakeaway-consistency failure escalates but the final candidate is still invalid",
    run: async () => {
      let callCount = 0;

      const measurementScript =
        "Most people would never expect Cristiano Ronaldo’s head to reach around 9 feet 7 inches above the ground. An average person jumping might reach about 7 feet 6 inches. That means Ronaldo reached roughly 2 feet higher, which is what made the jump so unusual.";

      const flawedResult = (): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scoreComponents: {
          overall: {
            premiseAppeal: 18,
            openingPromise: 15,
            progression: 20,
            payoff: 10,
          },
          hook: {
            immediacy: 18,
            specificity: 18,
            viewerPull: 17,
            deliveryAlignment: 17,
          },
          retentionRisk: {
            openingFriction: 10,
            progressionRisk: 10,
            predictabilityRisk: 10,
            payoffRisk: 15,
          },
        },
        hookDecision: "refine",
        hookAssessment:
          "The hook states a grounded measurement comparison.",
        suggestedHook:
          "Cristiano Ronaldo once jumped so high his head reached around 9 feet 7 inches off the ground.",
        riskyParts: [
          {
            excerpt:
              "That means Ronaldo reached roughly 2 feet higher, which is what made the jump so unusual.",
            reason:
              "The ending states the difference but does not add a stronger payoff beyond restating the comparison.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "payoff",
            optional: false,
            suggestion:
              "Add a verified consequence or implication that explains why this matters.",
          },
        ],
        scenes: [
          {
            excerpt:
              "Most people would never expect Cristiano Ronaldo’s head to reach around 9 feet 7 inches above the ground.",
            label: "Hook",
            status: "strong",
          },
          {
            excerpt:
              "An average person jumping might reach about 7 feet 6 inches.",
            label: "Comparison",
            status: "strong",
          },
          {
            excerpt:
              "That means Ronaldo reached roughly 2 feet higher, which is what made the jump so unusual.",
            label: "Payoff",
            status: "risky",
          },
        ],
        mainTakeaway:
          "This script is engaging and mostly works well as a Short.",
      });

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: JSON.stringify(flawedResult()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        measurementScript,
        "Ronaldo jump height",
        modelCaller
      );

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
      assert.equal(
        callCount,
        3,
        "must give up after exactly 3 attempts — the gate fix must never add a 4th model call"
      );

      if (!result.ok) {
        assert.deepEqual(result.response, {
          status: "error",
          reason:
            "Analysis V2 returned an invalid analysis.",
        });
      }

      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /mainTakeaway must identify the lowest-scoring overall component/i
      );
      assert.doesNotMatch(
        responseText,
        /payoff|Ronaldo|9 feet 7 inches/i
      );
    },
  },

  {
    // Live-observed follow-on regression: the mainTakeaway gate fix removed
    // the premature 2-attempt failure, but the final targeted retry's OWN
    // guidance never told the model that hookDecision "keep" cannot coexist
    // with a required (non-optional) hook-targeted suggestedFix — so a
    // model correcting mainTakeaway while simplifying hookDecision to
    // "keep" (without also removing/optionalizing the accompanying hook
    // fix) still produces a self-contradictory final candidate. This mock
    // model reads the actual final-retry prompt at call time: it only
    // returns the safe, contradiction-free candidate once that prompt
    // explicitly states the keep/required-hook-fix invariant.
    name: "runAnalysisV2's mainTakeaway final targeted retry carries the keep/required-hook-fix invariant, so a corrected third candidate that simplifies hookDecision to keep is accepted",
    run: async () => {
      let callCount = 0;
      const userPrompts: string[] = [];

      // Deliberately a script with NO hook-timing structural requirement
      // (unlike the Ronaldo measurement script used elsewhere in this
      // file, whose cause/consequence split across two sentences forces
      // hookDecision to be refine/rewrite) — this isolates the
      // keep/required-hook-fix contract cleanly, with keep genuinely valid
      // for this script's hook.
      const bridgeScript =
        "A new pedestrian bridge in the city cracked under normal foot traffic last spring. Investigators found a single support beam was rated for half the expected load. The city has not yet announced repairs.";

      const flawedMainTakeawayResult = (): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scoreComponents: {
          overall: {
            premiseAppeal: 18,
            openingPromise: 15,
            progression: 20,
            payoff: 10,
          },
          hook: {
            immediacy: 18,
            specificity: 18,
            viewerPull: 17,
            deliveryAlignment: 18,
          },
          retentionRisk: {
            openingFriction: 10,
            progressionRisk: 10,
            predictabilityRisk: 10,
            payoffRisk: 15,
          },
        },
        hookDecision: "keep",
        hookAssessment:
          "The hook states a grounded structural failure with a concrete cause.",
        suggestedHook: null,
        riskyParts: [
          {
            excerpt:
              "The city has not yet announced repairs.",
            reason:
              "The ending states the outcome but does not add a stronger payoff beyond restating the situation.",
            severity: "medium",
          },
        ],
        // Deliberately empty: a mixed result needs at least one non-optional
        // fix somewhere, an orthogonal requirement unrelated to hookDecision.
        // This is the "hidden secondary defect" that masks behind the
        // mainTakeaway failure and survives the deterministic mainTakeaway
        // repair (which only rewrites mainTakeaway text) — without it, the
        // repair would resolve this fixture completely on the first
        // attempt, before ever reaching the final targeted retry this test
        // needs to exercise.
        suggestedFixes: [],
        scenes: [
          {
            excerpt:
              "A new pedestrian bridge in the city cracked under normal foot traffic last spring.",
            label: "Hook",
            status: "strong",
          },
          {
            excerpt:
              "Investigators found a single support beam was rated for half the expected load.",
            label: "Cause",
            status: "strong",
          },
          {
            excerpt:
              "The city has not yet announced repairs.",
            label: "Payoff",
            status: "risky",
          },
        ],
        mainTakeaway:
          "This script is engaging and mostly works well as a Short.",
      });

      // The model corrects mainTakeaway and adds the now-missing
      // non-optional fix on its third attempt but — unless the prompt
      // explicitly warns against it — targets that fix at hook while
      // leaving hookDecision as keep.
      const contradictoryKeepCandidate = (): Record<string, unknown> => {
        const base = flawedMainTakeawayResult();
        return {
          ...base,
          suggestedFixes: [
            {
              target: "hook",
              optional: false,
              suggestion:
                "Combine the cause and outcome into the opening sentence.",
            },
          ],
          mainTakeaway:
            "The script is understandable, but its payoff limits the overall score because the ending payoff does not deliver a strong enough viewer reward.",
        };
      };

      const correctedKeepCandidate = (): Record<string, unknown> => {
        const base = flawedMainTakeawayResult();
        return {
          ...base,
          suggestedFixes: [
            {
              target: "payoff",
              optional: false,
              suggestion:
                "Add a verified consequence or implication that explains why this matters.",
            },
          ],
          mainTakeaway:
            "The script is understandable, but its payoff limits the overall score because the ending payoff does not deliver a strong enough viewer reward.",
        };
      };

      // The exact invariant sentence this test requires the final targeted
      // retry prompt to state — matched verbatim against the guidance text
      // added for this fix, the same way other tests match exact phrases
      // from the production prompt-builder functions.
      const KEEP_INVARIANT_MARKER =
        "cannot coexist with a required (non-optional) suggestedFix targeting hook";

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          if (callCount <= 2) {
            // Attempt 0 AND attempt 1 both keep the same generic
            // mainTakeaway, escalating to the final targeted retry.
            return {
              raw: JSON.stringify(flawedMainTakeawayResult()),
              modelUsed: "mock-model",
            };
          }

          // Attempt 2 (the final targeted retry's own output): whether the
          // simulated model avoids the keep/required-hook-fix contradiction
          // depends on whether its own prompt actually told it to.
          const promptStatesInvariant = userPrompt.includes(
            KEEP_INVARIANT_MARKER
          );

          return {
            raw: JSON.stringify(
              promptStatesInvariant
                ? correctedKeepCandidate()
                : contradictoryKeepCandidate()
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        bridgeScript,
        "Bridge collapse",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(
        callCount,
        3,
        "must resolve within the existing 3-call maximum — no 4th call"
      );

      if (result.ok) {
        assert.equal(
          result.response.result.hookDecision,
          "keep"
        );
        assert.ok(
          !result.response.result.suggestedHook,
          "suggestedHook must be absent/null for a keep decision"
        );
        assert.equal(
          result.response.result.suggestedFixes.some(
            (fix: { target: string; optional: boolean }) =>
              fix.target === "hook" && !fix.optional
          ),
          false,
          "the accepted result must not carry a required hook-targeted fix alongside hookDecision keep"
        );
      }

      const finalRetryPrompt = userPrompts[2] ?? "";
      assert.match(
        finalRetryPrompt,
        /keep/i
      );
      assert.ok(
        finalRetryPrompt.includes(KEEP_INVARIANT_MARKER),
        "the final targeted retry prompt must explicitly state that hookDecision keep cannot coexist with a required hook-targeted fix"
      );

      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /A keep hook decision cannot contain a required hook fix/i
      );
    },
  },

  {
    // The other side of the same fix: if the model ignores the invariant on
    // every attempt (including the final targeted retry), the request must
    // still fail safely — exactly 3 calls, the existing generic public 502,
    // and no internal validation reason leaked — never a 4th model call.
    name: "runAnalysisV2 fails safely at exactly 3 attempts when the final targeted retry candidate still contradicts keep with a required hook fix",
    run: async () => {
      let callCount = 0;

      // Same script as the success-case test above — no hook-timing
      // structural requirement, so keep is genuinely valid and the
      // keep/required-hook-fix contradiction is the only issue in play.
      const bridgeScript =
        "A new pedestrian bridge in the city cracked under normal foot traffic last spring. Investigators found a single support beam was rated for half the expected load. The city has not yet announced repairs.";

      const contradictoryResult = (): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scoreComponents: {
          overall: {
            premiseAppeal: 18,
            openingPromise: 15,
            progression: 20,
            payoff: 10,
          },
          hook: {
            immediacy: 18,
            specificity: 18,
            viewerPull: 17,
            deliveryAlignment: 18,
          },
          retentionRisk: {
            openingFriction: 10,
            progressionRisk: 10,
            predictabilityRisk: 10,
            payoffRisk: 15,
          },
        },
        hookDecision: "keep",
        hookAssessment:
          "The hook states a grounded structural failure with a concrete cause.",
        suggestedHook: null,
        riskyParts: [
          {
            excerpt:
              "The city has not yet announced repairs.",
            reason:
              "The ending states the outcome but does not add a stronger payoff beyond restating the situation.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            optional: false,
            suggestion:
              "Combine the cause and outcome into the opening sentence.",
          },
        ],
        scenes: [
          {
            excerpt:
              "A new pedestrian bridge in the city cracked under normal foot traffic last spring.",
            label: "Hook",
            status: "strong",
          },
          {
            excerpt:
              "Investigators found a single support beam was rated for half the expected load.",
            label: "Cause",
            status: "strong",
          },
          {
            excerpt:
              "The city has not yet announced repairs.",
            label: "Payoff",
            status: "risky",
          },
        ],
        // Deliberately already-consistent with the lowest-scoring component
        // (payoff) — this isolates the keep/required-hook-fix contradiction
        // as the ONLY failure reason on every attempt; an inconsistent
        // mainTakeaway here would mask it behind the earlier mainTakeaway
        // check instead.
        mainTakeaway:
          "The script is understandable, but its payoff limits the overall score because the ending payoff does not deliver a strong enough viewer reward.",
      });

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: JSON.stringify(contradictoryResult()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        bridgeScript,
        "Bridge collapse",
        modelCaller
      );

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
      assert.equal(
        callCount,
        3,
        "must give up after exactly 3 attempts — never a 4th model call"
      );

      if (!result.ok) {
        assert.deepEqual(result.response, {
          status: "error",
          reason:
            "Analysis V2 returned an invalid analysis.",
        });
      }

      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /A keep hook decision cannot contain a required hook fix/i
      );
      assert.doesNotMatch(
        responseText,
        /payoff|bridge|support beam/i
      );
    },
  },

  {
    // Retry-gate coverage for the DIRECT occurrence of this reason (as
    // opposed to Test A's mainTakeaway-escalation path): when the
    // keep/required-hook-fix contradiction is itself the reason on attempt
    // 1, it must be eligible to escalate to the final targeted retry, the
    // same as every other already-supported structural reason.
    name: "runAnalysisV2 escalates an attempt-1 keep/required-hook-fix failure to the final targeted retry and accepts a corrected third candidate",
    run: async () => {
      let callCount = 0;
      const userPrompts: string[] = [];

      // Same script as Tests A/B above — no hook-timing structural
      // requirement, so keep is genuinely valid and the
      // keep/required-hook-fix contradiction is the only issue in play.
      const bridgeScript =
        "A new pedestrian bridge in the city cracked under normal foot traffic last spring. Investigators found a single support beam was rated for half the expected load. The city has not yet announced repairs.";

      const baseResult = (
        overrides: Record<string, unknown>
      ): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scoreComponents: {
          overall: {
            premiseAppeal: 18,
            openingPromise: 15,
            progression: 20,
            payoff: 10,
          },
          hook: {
            immediacy: 18,
            specificity: 18,
            viewerPull: 17,
            deliveryAlignment: 18,
          },
          retentionRisk: {
            openingFriction: 10,
            progressionRisk: 10,
            predictabilityRisk: 10,
            payoffRisk: 15,
          },
        },
        hookAssessment:
          "The hook states a grounded structural failure with a concrete cause.",
        riskyParts: [
          {
            excerpt:
              "The city has not yet announced repairs.",
            reason:
              "The ending states the outcome but does not add a stronger payoff beyond restating the situation.",
            severity: "medium",
          },
        ],
        scenes: [
          {
            excerpt:
              "A new pedestrian bridge in the city cracked under normal foot traffic last spring.",
            label: "Hook",
            status: "strong",
          },
          {
            excerpt:
              "Investigators found a single support beam was rated for half the expected load.",
            label: "Cause",
            status: "strong",
          },
          {
            excerpt:
              "The city has not yet announced repairs.",
            label: "Payoff",
            status: "risky",
          },
        ],
        // Already consistent with the lowest-scoring component (payoff) on
        // every attempt — isolates the keep/required-hook-fix contradiction
        // as the only failure reason, exactly like Test B above.
        mainTakeaway:
          "The script is understandable, but its payoff limits the overall score because the ending payoff does not deliver a strong enough viewer reward.",
        ...overrides,
      });

      const contradictoryResult = () =>
        baseResult({
          hookDecision: "keep",
          suggestedHook: null,
          suggestedFixes: [
            {
              target: "hook",
              optional: false,
              suggestion:
                "Combine the cause and outcome into the opening sentence.",
            },
          ],
        });

      const correctedResult = () =>
        baseResult({
          hookDecision: "keep",
          suggestedHook: null,
          suggestedFixes: [
            {
              target: "payoff",
              optional: false,
              suggestion:
                "Add a verified consequence or implication that explains why this matters.",
            },
          ],
        });

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          if (callCount <= 2) {
            // Attempt 0 AND attempt 1 both keep the same contradiction.
            return {
              raw: JSON.stringify(contradictoryResult()),
              modelUsed: "mock-model",
            };
          }

          // Attempt 2 (the final targeted retry's own output): corrected.
          return {
            raw: JSON.stringify(correctedResult()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        bridgeScript,
        "Bridge collapse",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(
        callCount,
        3,
        "the attempt-1 keep/required-hook-fix failure must escalate to exactly one final targeted retry — no 4th call"
      );

      if (result.ok) {
        assert.equal(
          result.response.result.hookDecision,
          "keep"
        );
      }

      const finalRetryPrompt = userPrompts[2] ?? "";
      assert.match(
        finalRetryPrompt,
        /A keep hook decision cannot contain a required hook fix/i
      );

      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /A keep hook decision cannot contain a required hook fix/i
      );
    },
  },

  {
    // Cross-validator drift investigation, Test 1: attempt 1 fails on
    // keep/required-hook-fix (NOT mainTakeaway), so the final targeted
    // retry prompt is built from the KEEP branch — which does not contain
    // mainTakeaway-specific guidance. If the model's third candidate then
    // fixes keep/fix but introduces a FRESH mainTakeaway inconsistency, the
    // deterministic mainTakeaway repair (which runs unconditionally
    // whenever this exact reason occurs, regardless of which prompt
    // produced the candidate or which attempt number it is) still catches
    // and fixes it. This proves the system self-heals here even though the
    // final-retry prompt itself carried no mainTakeaway reminder.
    name: "cross-validator drift: a keep/fix-triggered final retry whose candidate introduces a fresh mainTakeaway defect is still repaired and accepted",
    run: async () => {
      let callCount = 0;
      const userPrompts: string[] = [];

      const bridgeScript =
        "A new pedestrian bridge in the city cracked under normal foot traffic last spring. Investigators found a single support beam was rated for half the expected load. The city has not yet announced repairs.";

      const baseResult = (
        overrides: Record<string, unknown>
      ): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scoreComponents: {
          overall: {
            premiseAppeal: 18,
            openingPromise: 15,
            progression: 20,
            payoff: 10,
          },
          hook: {
            immediacy: 18,
            specificity: 18,
            viewerPull: 17,
            deliveryAlignment: 18,
          },
          retentionRisk: {
            openingFriction: 10,
            progressionRisk: 10,
            predictabilityRisk: 10,
            payoffRisk: 15,
          },
        },
        hookAssessment:
          "The hook states a grounded structural failure with a concrete cause.",
        riskyParts: [
          {
            excerpt:
              "The city has not yet announced repairs.",
            reason:
              "The ending states the outcome but does not add a stronger payoff beyond restating the situation.",
            severity: "medium",
          },
        ],
        scenes: [
          {
            excerpt:
              "A new pedestrian bridge in the city cracked under normal foot traffic last spring.",
            label: "Hook",
            status: "strong",
          },
          {
            excerpt:
              "Investigators found a single support beam was rated for half the expected load.",
            label: "Cause",
            status: "strong",
          },
          {
            excerpt:
              "The city has not yet announced repairs.",
            label: "Payoff",
            status: "risky",
          },
        ],
        ...overrides,
      });

      // Attempts 0 and 1: keep + required hook fix (mainTakeaway already
      // consistent — isolates the keep/fix contradiction as the only
      // failure, escalating via the KEEP branch, not the mainTakeaway one).
      const keepFixContradiction = () =>
        baseResult({
          hookDecision: "keep",
          suggestedHook: null,
          suggestedFixes: [
            {
              target: "hook",
              optional: false,
              suggestion:
                "Combine the cause and outcome into the opening sentence.",
            },
          ],
          mainTakeaway:
            "The script is understandable, but its payoff limits the overall score because the ending payoff does not deliver a strong enough viewer reward.",
        });

      // Attempt 2: fixes keep/fix (payoff-targeted fix instead of hook),
      // but reverts to a generic mainTakeaway that does not name the
      // lowest-scoring component.
      const freshMainTakeawayDefect = () =>
        baseResult({
          hookDecision: "keep",
          suggestedHook: null,
          suggestedFixes: [
            {
              target: "payoff",
              optional: false,
              suggestion:
                "Add a verified consequence or implication that explains why this matters.",
            },
          ],
          mainTakeaway:
            "This script is engaging and mostly works well as a Short.",
        });

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          if (callCount <= 2) {
            return {
              raw: JSON.stringify(keepFixContradiction()),
              modelUsed: "mock-model",
            };
          }

          return {
            raw: JSON.stringify(freshMainTakeawayDefect()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        bridgeScript,
        "Bridge collapse",
        modelCaller
      );

      // Confirms the drift premise: the final retry prompt was built from
      // the keep/fix reason, NOT the mainTakeaway reason — it carries the
      // keep invariant but not mainTakeaway-specific guidance.
      const finalRetryPrompt = userPrompts[2] ?? "";
      assert.match(
        finalRetryPrompt,
        /A keep hook decision cannot contain a required hook fix/i
      );
      assert.doesNotMatch(
        finalRetryPrompt,
        /identify the lowest-scoring overall component/i
      );

      // Despite the missing prompt-level reminder, the deterministic
      // mainTakeaway repair — which runs unconditionally on any attempt
      // whenever this exact reason occurs — still resolves it.
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(
        callCount,
        3,
        "no 4th call — the repair resolves attempt 2's own output in place"
      );

      if (result.ok) {
        assert.equal(
          result.response.result.hookDecision,
          "keep"
        );
        assert.match(
          result.response.result.mainTakeaway,
          /payoff/i
        );
      }
    },
  },

  {
    // Cross-validator drift investigation, Test 2: a mainTakeaway defect
    // with NO coexisting issue is deterministically repairable on whatever
    // attempt it first occurs — proven by tracing the actual contract
    // rather than assuming a 3-call scenario. Because the repair check
    // runs unconditionally, before any attempt-number branching, a "clean"
    // mainTakeaway defect (nothing else wrong) can never survive to a
    // second real model call: it resolves in exactly ONE call, regardless
    // of which attempt number would otherwise have produced it. This is
    // the correct, intended behavior — not a gap — and this test locks it
    // in as a regression guard.
    name: "cross-validator drift: a mainTakeaway-only defect with no coexisting issue is always repaired on the very first attempt, never surviving to a second call",
    run: async () => {
      let callCount = 0;

      const bridgeScript =
        "A new pedestrian bridge in the city cracked under normal foot traffic last spring. Investigators found a single support beam was rated for half the expected load. The city has not yet announced repairs.";

      const flawedResult = (): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scoreComponents: {
          overall: {
            premiseAppeal: 18,
            openingPromise: 15,
            progression: 20,
            payoff: 10,
          },
          hook: {
            immediacy: 18,
            specificity: 18,
            viewerPull: 17,
            deliveryAlignment: 18,
          },
          retentionRisk: {
            openingFriction: 10,
            progressionRisk: 10,
            predictabilityRisk: 10,
            payoffRisk: 15,
          },
        },
        hookDecision: "keep",
        suggestedHook: null,
        hookAssessment:
          "The hook states a grounded structural failure with a concrete cause.",
        riskyParts: [
          {
            excerpt:
              "The city has not yet announced repairs.",
            reason:
              "The ending states the outcome but does not add a stronger payoff beyond restating the situation.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "payoff",
            optional: false,
            suggestion:
              "Add a verified consequence or implication that explains why this matters.",
          },
        ],
        scenes: [
          {
            excerpt:
              "A new pedestrian bridge in the city cracked under normal foot traffic last spring.",
            label: "Hook",
            status: "strong",
          },
          {
            excerpt:
              "Investigators found a single support beam was rated for half the expected load.",
            label: "Cause",
            status: "strong",
          },
          {
            excerpt:
              "The city has not yet announced repairs.",
            label: "Payoff",
            status: "risky",
          },
        ],
        mainTakeaway:
          "This script is engaging and mostly works well as a Short.",
      });

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: JSON.stringify(flawedResult()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        bridgeScript,
        "Bridge collapse",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(
        callCount,
        1,
        "a mainTakeaway-only defect with nothing else wrong must resolve via repair on the first attempt, not survive to a retry"
      );

      if (result.ok) {
        assert.match(
          result.response.result.mainTakeaway,
          /payoff/i
        );
      }
    },
  },

  {
    // Cross-validator drift investigation, Test 3: when the mainTakeaway
    // repair's OWN revalidation exposes a genuinely different, independent
    // defect (here: an orthogonal "mixed verdict needs a non-optional fix"
    // requirement, masked behind the mainTakeaway check because validation
    // returns on the first failure encountered), the terminal log/response
    // reason is STILL reported as the original mainTakeaway reason — never
    // the true final blocking defect. This documents the existing log
    // semantics: the reported terminal reason reflects what triggered the
    // repair attempt, not necessarily what actually kept blocking it.
    name: "cross-validator drift: a mainTakeaway defect masking an independent, unrepairable defect still fails safely, with the terminal reason reflecting the masked (not the true) cause",
    run: async () => {
      let callCount = 0;

      const bridgeScript =
        "A new pedestrian bridge in the city cracked under normal foot traffic last spring. Investigators found a single support beam was rated for half the expected load. The city has not yet announced repairs.";

      const flawedResult = (): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scoreComponents: {
          overall: {
            premiseAppeal: 18,
            openingPromise: 15,
            progression: 20,
            payoff: 10,
          },
          hook: {
            immediacy: 18,
            specificity: 18,
            viewerPull: 17,
            deliveryAlignment: 18,
          },
          retentionRisk: {
            openingFriction: 10,
            progressionRisk: 10,
            predictabilityRisk: 10,
            payoffRisk: 15,
          },
        },
        hookDecision: "keep",
        suggestedHook: null,
        hookAssessment:
          "The hook states a grounded structural failure with a concrete cause.",
        riskyParts: [
          {
            excerpt:
              "The city has not yet announced repairs.",
            reason:
              "The ending states the outcome but does not add a stronger payoff beyond restating the situation.",
            severity: "medium",
          },
        ],
        // Orthogonal, independent defect: a mixed result requires at least
        // one non-optional suggestedFix somewhere. Repair only ever
        // rewrites mainTakeaway, so it cannot resolve this on its own —
        // and no other check in this fixture masks it, so it is the true,
        // sole blocker on every attempt.
        suggestedFixes: [],
        scenes: [
          {
            excerpt:
              "A new pedestrian bridge in the city cracked under normal foot traffic last spring.",
            label: "Hook",
            status: "strong",
          },
          {
            excerpt:
              "Investigators found a single support beam was rated for half the expected load.",
            label: "Cause",
            status: "strong",
          },
          {
            excerpt:
              "The city has not yet announced repairs.",
            label: "Payoff",
            status: "risky",
          },
        ],
        mainTakeaway:
          "This script is engaging and mostly works well as a Short.",
      });

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: JSON.stringify(flawedResult()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        bridgeScript,
        "Bridge collapse",
        modelCaller
      );

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
      assert.equal(
        callCount,
        3,
        "never a 4th call, even though the true blocker is unrelated to mainTakeaway"
      );

      if (!result.ok) {
        assert.deepEqual(result.response, {
          status: "error",
          reason:
            "Analysis V2 returned an invalid analysis.",
        });
      }

      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /mainTakeaway must identify the lowest-scoring overall component/i
      );
      assert.doesNotMatch(
        responseText,
        /non-optional suggested fix/i
      );
    },
  },

  {
    // Cross-validator drift investigation, Test 4: the RU-locale path for
    // the same "clean, sole mainTakeaway defect" shape resolves the same
    // way as EN — one call, correct component named in Russian, no extra
    // model call.
    name: "cross-validator drift: RU locale mainTakeaway repair resolves on the first attempt with the correct component named in Russian",
    run: async () => {
      let callCount = 0;

      const bridgeScriptRu =
        "Новый пешеходный мост в городе треснул при обычной пешеходной нагрузке прошлой весной. Следователи обнаружили, что одна опорная балка была рассчитана только на половину ожидаемой нагрузки. Город пока не объявил о ремонте.";

      const flawedResult = (): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scoreComponents: {
          overall: {
            premiseAppeal: 18,
            openingPromise: 15,
            progression: 20,
            payoff: 10,
          },
          hook: {
            immediacy: 18,
            specificity: 18,
            viewerPull: 17,
            deliveryAlignment: 18,
          },
          retentionRisk: {
            openingFriction: 10,
            progressionRisk: 10,
            predictabilityRisk: 10,
            payoffRisk: 15,
          },
        },
        hookDecision: "keep",
        suggestedHook: null,
        hookAssessment:
          "Хук содержит обоснованный факт о структурном повреждении.",
        riskyParts: [
          {
            excerpt: "Город пока не объявил о ремонте.",
            reason:
              "Концовка констатирует факт, но не добавляет более сильной развязки.",
            severity: "medium",
          },
        ],
        // Exact canonical allowed neutral-diagnostic RU form — must match
        // verbatim, not a free paraphrase.
        suggestedFixes: [
          {
            target: "payoff",
            optional: false,
            suggestion:
              "Добавьте проверенное следствие или значение, которое объясняет, почему это важно.",
          },
        ],
        scenes: [
          {
            excerpt:
              "Новый пешеходный мост в городе треснул при обычной пешеходной нагрузке прошлой весной.",
            label: "Хук",
            status: "strong",
          },
          {
            excerpt:
              "Следователи обнаружили, что одна опорная балка была рассчитана только на половину ожидаемой нагрузки.",
            label: "Причина",
            status: "strong",
          },
          {
            excerpt: "Город пока не объявил о ремонте.",
            label: "Развязка",
            status: "risky",
          },
        ],
        mainTakeaway:
          "Этот сценарий интересен и в целом хорошо работает как Shorts.",
      });

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: JSON.stringify(flawedResult()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        bridgeScriptRu,
        "Обрушение моста",
        modelCaller,
        "ru"
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(
        callCount,
        1,
        "resolves via repair on the first attempt, same as EN"
      );

      if (result.ok) {
        assert.match(
          result.response.result.mainTakeaway,
          /развязк/i
        );
        assert.doesNotMatch(
          result.response.result.mainTakeaway,
          /[a-zA-Z]{4,}/
        );
      }
    },
  },

  {
    // First-retry reminder coverage: the compact reminder must appear even
    // when attempt 0 failed for a completely unrelated reason (the gap this
    // task closes), and must NOT be redundantly duplicated alongside the
    // detailed guidance when the measurement-subject reason is itself the
    // trigger.
    name: "buildAnalysisV2RetryUserPrompt (first retry) carries the compact measurement reminder for an unrelated trigger, and the detailed guidance without duplication for the measurement-subject trigger",
    run: async () => {
      const originalityScript =
        "These are three overlooked productivity habits that almost nobody talks about. Put your phone in another room because notifications pull your attention away. Write down one priority because a long task list splits your focus. Then work for 25 minutes because a short timer makes starting feel easier.";

      // Case 1: attempt 0 fails for an UNRELATED reason (parallel-advice
      // list-escalation misclassification, an existing supported reason).
      // The first retry it triggers must still carry the compact reminder.
      let callCountUnrelated = 0;
      const unrelatedUserPrompts: string[] = [];

      const modelCallerUnrelated: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCountUnrelated += 1;
          unrelatedUserPrompts.push(userPrompt);

          if (callCountUnrelated === 1) {
            return {
              raw: JSON.stringify({
                scriptType: "list_escalation",
                verdict: "strong",
                scores: {
                  overall: 82,
                  hook: 70,
                  retentionRisk: 30,
                },
                hookDecision: "keep",
                hookAssessment:
                  "The hook is clear and specific.",
                suggestedHook: null,
                riskyParts: [],
                suggestedFixes: [],
                scenes: [
                  {
                    excerpt: originalityScript,
                    label: "Habits",
                    status: "strong",
                  },
                ],
                mainTakeaway:
                  "The three habits are clear and actionable.",
              }),
              modelUsed: "mock-model",
            };
          }

          return {
            raw: JSON.stringify({
              scriptType: "how_to",
              verdict: "mixed",
              scores: {
                overall: 68,
                hook: 55,
                retentionRisk: 48,
              },
              hookDecision: "refine",
              hookAssessment:
                "The hook makes an unsupported novelty claim.",
              suggestedHook:
                "Three productivity habits that actually work.",
              riskyParts: [
                {
                  excerpt:
                    "These are three overlooked productivity habits that almost nobody talks about.",
                  reason:
                    "Unsupported novelty claim not backed by less-obvious material.",
                  severity: "medium",
                },
              ],
              suggestedFixes: [
                {
                  target: "hook",
                  suggestion:
                    "Remove the overlooked/nobody-talks-about claim.",
                  optional: false,
                },
              ],
              scenes: [
                {
                  excerpt: originalityScript,
                  label: "Habits",
                  status: "average",
                },
              ],
              mainTakeaway:
                "The habits are conventional, so the novelty claim is unsupported.",
            }),
            modelUsed: "mock-model",
          };
        };

      const unrelatedResult = await runAnalysisV2(
        originalityScript,
        "Productivity habits",
        modelCallerUnrelated
      );

      assert.equal(unrelatedResult.ok, true);
      assert.equal(callCountUnrelated, 2);
      assert.match(
        unrelatedUserPrompts[1] ?? "",
        /must be classified as how_to or generic_advice/i
      );
      assert.match(
        unrelatedUserPrompts[1] ?? "",
        /never move it onto a different action, event, goal, location, or broader entity/i,
        "the compact measurement reminder must appear in the first retry even for an unrelated trigger"
      );
      assert.doesNotMatch(
        unrelatedUserPrompts[1] ?? "",
        /identify exactly which person, object, or body part the script says the number measures/i,
        "the detailed measurement guidance must not appear when it was not the triggering reason"
      );

      // Case 2: attempt 0 fails specifically on the measurement-subject
      // reason — the first retry must carry the detailed guidance, and must
      // NOT also carry the redundant compact reminder in the same prompt.
      const ronaldoScript =
        "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters. The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball. That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.";

      const invalidHook =
        "Cristiano Ronaldo's 2018 bicycle kick against Juventus reached about 2.38 meters, making it one of the most athletic finishes of his career.";
      const correctedHook =
        "Cristiano Ronaldo's foot reached about 2.38 meters during his 2018 bicycle kick against Juventus.";

      const baseResult = (
        suggestedHook: string
      ): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scores: {
          overall: 68,
          hook: 55,
          retentionRisk: 48,
        },
        hookDecision: "rewrite",
        hookAssessment:
          "The opening delays the concrete measurement behind a generic framing sentence instead of leading with it.",
        suggestedHook,
        riskyParts: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            reason:
              "The concrete measurement is delayed behind a generic framing opener instead of leading the hook.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Open directly with the concrete measurement already in the script instead of a generic framing sentence.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            label: "Opening",
            status: "risky",
          },
          {
            excerpt:
              "The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball.",
            label: "Context",
            status: "average",
          },
          {
            excerpt:
              "That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.",
            label: "Resolution",
            status: "strong",
          },
        ],
        mainTakeaway:
          "The script has a strong grounded fact, but the hook delays it behind a generic opener instead of leading with the measurement.",
      });

      let callCountMeasurement = 0;
      const measurementUserPrompts: string[] = [];

      const modelCallerMeasurement: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCountMeasurement += 1;
          measurementUserPrompts.push(userPrompt);

          return {
            raw: JSON.stringify(
              baseResult(
                callCountMeasurement === 1
                  ? invalidHook
                  : correctedHook
              )
            ),
            modelUsed: "mock-model",
          };
        };

      const measurementResult = await runAnalysisV2(
        ronaldoScript,
        "Ronaldo bicycle kick",
        modelCallerMeasurement
      );

      assert.equal(measurementResult.ok, true);
      assert.equal(callCountMeasurement, 2);
      assert.match(
        measurementUserPrompts[1] ?? "",
        /identify exactly which person, object, or body part the script says the number measures/i
      );

      const detailedOccurrences = (
        measurementUserPrompts[1] ?? ""
      ).match(
        /never move it onto a different action, event, goal, location, or broader entity/gi
      );

      assert.equal(
        detailedOccurrences,
        null,
        "the compact reminder must not be redundantly duplicated in the first retry when the detailed guidance already covers the same trigger"
      );
    },
  },

  {
    // Final-retry reminder coverage: the compact reminder must remain
    // present in the final targeted retry regardless of the triggering
    // reason (unlike the first retry, this redundancy is intentional at the
    // last attempt), and the detailed guidance must still appear when the
    // triggering reason is specifically the measurement-subject one.
    name: "buildAnalysisV2FinalTargetedRetryUserPrompt carries the compact reminder unconditionally, plus the detailed guidance when triggered by the measurement-subject reason",
    run: async () => {
      const ronaldoScript =
        "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters. The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball. That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.";

      const invalidHook =
        "Cristiano Ronaldo's 2018 bicycle kick against Juventus reached about 2.38 meters, making it one of the most athletic finishes of his career.";
      const correctedHook =
        "Cristiano Ronaldo's foot reached about 2.38 meters during his 2018 bicycle kick against Juventus.";

      const baseResult = (
        suggestedHook: string
      ): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scores: {
          overall: 68,
          hook: 55,
          retentionRisk: 48,
        },
        hookDecision: "rewrite",
        hookAssessment:
          "The opening delays the concrete measurement behind a generic framing sentence instead of leading with it.",
        suggestedHook,
        riskyParts: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            reason:
              "The concrete measurement is delayed behind a generic framing opener instead of leading the hook.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Open directly with the concrete measurement already in the script instead of a generic framing sentence.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            label: "Opening",
            status: "risky",
          },
          {
            excerpt:
              "The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball.",
            label: "Context",
            status: "average",
          },
          {
            excerpt:
              "That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.",
            label: "Resolution",
            status: "strong",
          },
        ],
        mainTakeaway:
          "The script has a strong grounded fact, but the hook delays it behind a generic opener instead of leading with the measurement.",
      });

      let callCount = 0;
      const userPrompts: string[] = [];

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          if (callCount <= 2) {
            return {
              raw: JSON.stringify(baseResult(invalidHook)),
              modelUsed: "mock-model",
            };
          }

          return {
            raw: JSON.stringify(baseResult(correctedHook)),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        ronaldoScript,
        "Ronaldo bicycle kick",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(callCount, 3);

      const finalRetryPrompt = userPrompts[2] ?? "";

      assert.match(
        finalRetryPrompt,
        /never move it onto a different action, event, goal, location, or broader entity/i,
        "the compact reminder must be present in the final targeted retry"
      );
      assert.match(
        finalRetryPrompt,
        /identify exactly which person, object, or body part the script says the number measures/i,
        "the detailed guidance must also be present when triggered by the measurement-subject reason"
      );
    },
  },

  {
    // Full regression path: attempt 0 fails on an unrelated gate-eligible
    // reason (mixed-verdict/score inconsistency), attempt 1 (the first
    // retry's own output) reassigns the measurement from foot to bicycle
    // kick, and attempt 2 (now reachable thanks to the gate fix) preserves
    // foot and succeeds — all under the Russian interface locale, proving
    // suggestedHook stays English while explanations stay Russian
    // throughout the whole corrected chain.
    name: "Ronaldo regression: attempt-0 unrelated failure, attempt-1 measurement reassignment, attempt-2 corrected success, under the RU interface locale",
    run: async () => {
      let callCount = 0;
      const userPrompts: string[] = [];

      const ronaldoScript =
        "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters. The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball. That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.";

      const invalidHook =
        "Cristiano Ronaldo's 2018 bicycle kick against Juventus reached about 2.38 meters, making it one of the most athletic finishes of his career.";
      const correctedHook =
        "Cristiano Ronaldo's foot reached about 2.38 meters during his 2018 bicycle kick against Juventus.";

      const russianHookAssessment =
        "Открытие откладывает конкретное измерение за общей вступительной фразой вместо того, чтобы вести с него.";
      const russianMainTakeaway =
        "В сценарии есть сильный обоснованный факт, но хук откладывает его за общим вступлением вместо того, чтобы вести с измерения.";

      const baseResult = (
        suggestedHook: string | null,
        overall: number
      ): Record<string, unknown> => ({
        scriptType: "narrative_event",
        verdict: "mixed",
        scores: {
          overall,
          hook: 55,
          retentionRisk: 48,
        },
        hookDecision: "rewrite",
        hookAssessment: russianHookAssessment,
        suggestedHook,
        riskyParts: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            reason:
              "Конкретное измерение задержано за общим вступительным открытием вместо того, чтобы вести хук.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Начните сразу с конкретного измерения, уже присутствующего в сценарии, вместо общего вступительного предложения.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "Today I want to tell you something very interesting about Cristiano Ronaldo's 2018 bicycle kick against Juventus, where his foot reached about 2.38 meters.",
            label: "Открытие",
            status: "risky",
          },
          {
            excerpt:
              "The goal happened in the Champions League, and he lifted his body almost horizontally before striking the ball.",
            label: "Контекст",
            status: "average",
          },
          {
            excerpt:
              "That unusual height is why the goal is still remembered as one of the most athletic finishes of his career.",
            label: "Развязка",
            status: "strong",
          },
        ],
        mainTakeaway: russianMainTakeaway,
      });

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          if (callCount === 1) {
            // Attempt 0: fails on an unrelated gate-eligible reason — the
            // overall score (90) is outside the mixed range (46-84) for a
            // mixed verdict, a "verdict is inconsistent with the supplied
            // scores" failure.
            return {
              raw: JSON.stringify(
                baseResult(correctedHook, 90)
              ),
              modelUsed: "mock-model",
            };
          }

          if (callCount === 2) {
            // Attempt 1 (the first retry's own output): the verdict/score
            // problem is fixed, but the measurement is now reassigned.
            return {
              raw: JSON.stringify(
                baseResult(invalidHook, 68)
              ),
              modelUsed: "mock-model",
            };
          }

          // Attempt 2 (the final targeted retry's own output): both
          // problems corrected.
          return {
            raw: JSON.stringify(
              baseResult(correctedHook, 68)
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        ronaldoScript,
        "Ronaldo bicycle kick",
        modelCaller,
        "ru"
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(
        callCount,
        3,
        "expected exactly 3 model calls for this corrected chain"
      );

      // First retry (attempt 0 -> attempt 1), triggered by the unrelated
      // verdict/score reason, must still carry the compact measurement
      // invariant.
      assert.match(
        userPrompts[1] ?? "",
        /verdict is inconsistent with the supplied/i
      );
      assert.match(
        userPrompts[1] ?? "",
        /never move it onto a different action, event, goal, location, or broader entity/i
      );

      // Final targeted retry (attempt 1 -> attempt 2), triggered by the
      // measurement-subject reason, must carry both the detailed
      // corrective instructions and the compact reminder.
      assert.match(
        userPrompts[2] ?? "",
        /assigns an explicit measurement to a different subject/i
      );
      assert.match(
        userPrompts[2] ?? "",
        /identify exactly which person, object, or body part the script says the number measures/i
      );
      assert.match(
        userPrompts[2] ?? "",
        /never move it onto a different action, event, goal, location, or broader entity/i
      );

      if (result.ok) {
        assert.equal(
          result.response.result.suggestedHook,
          correctedHook,
          "suggestedHook must remain English"
        );
        assert.match(
          result.response.result.suggestedHook ?? "",
          /foot/i
        );
        assert.doesNotMatch(
          result.response.result.suggestedHook ?? "",
          /bicycle kick reached|kick.*reached about 2\.38/i
        );
        assert.equal(
          result.response.result.hookAssessment,
          russianHookAssessment
        );
        assert.equal(
          result.response.result.mainTakeaway,
          russianMainTakeaway
        );
        assert.equal(result.response.locale, "ru");
      }

      const responseText = JSON.stringify(result.response);
      assert.doesNotMatch(
        responseText,
        /assigns an explicit measurement to a different subject/i
      );
      assert.doesNotMatch(
        responseText,
        /verdict is inconsistent with the supplied/i
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
      assert.match(
        retryPrompt,
        /the suggestedhook is rewritten script text\. keep it in the same language as the submitted script/i,
        "the source-language reminder must appear in the first retry even when an unrelated validation reason triggered it"
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
    name: "runAnalysisV2 corrects missing-depth feedback caused by absent punctuation",
    run: async () => {
      const noPunctuationScript =
        "your hands can shake after a stressful moment because the body releases adrenaline the hormone raises heart rate and prepares the muscles for action once the adrenaline level falls the shaking usually stops";

      let callCount = 0;
      const userPrompts: string[] = [];

      const invalidResult: Record<string, unknown> = {
        scriptType: "explanation",
        verdict: "mixed",
        scores: {
          overall: 72,
          hook: 70,
          retentionRisk: 30,
        },
        hookDecision: "keep",
        hookAssessment:
          "The opening immediately introduces the concrete premise about why hands shake after stress.",
        suggestedHook: null,
        riskyParts: [
          {
            excerpt: noPunctuationScript,
            reason:
              "The explanation is very brief and lacks deeper mechanism, examples, or implications that would increase viewer engagement and payoff.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "middle",
            suggestion:
              "Expand the explanation to include a clearer mechanism or example of how adrenaline causes shaking and why it stops, to increase viewer engagement and payoff.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt: noPunctuationScript,
            label: "Complete causal explanation",
            status: "risky",
          },
        ],
        mainTakeaway:
          "The script explains the cause and resolution but supposedly needs deeper mechanism.",
      };

      const firstInvalidResult: Record<string, unknown> = {
        ...invalidResult,
        scenes: [
          {
            excerpt:
              "This excerpt does not exist in the submitted script.",
            label: "Invalid grounded scene",
            status: "risky",
          },
        ],
      };



      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          return {
            raw: JSON.stringify(
              callCount === 1
                ? firstInvalidResult
                : invalidResult
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        noPunctuationScript,
        "why hands shake",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(callCount, 3);

      const firstRetryPrompt =
        userPrompts[1] ?? "";
      const finalRetryPrompt =
        userPrompts[2] ?? "";

      assert.match(
        firstRetryPrompt,
        /previous response failed deterministic validation/i
      );
      assert.match(
        firstRetryPrompt,
        /scene excerpt is not an exact substring/i
      );
      assert.match(
        finalRetryPrompt,
        /Final targeted correction required/i
      );
      assert.match(
        finalRetryPrompt,
        /complete causal explanation in an unpunctuated script/i
      );
      assert.match(
        finalRetryPrompt,
        /contains a cause, an observable effect, and a resolution/i
      );
      assert.match(
        finalRetryPrompt,
        /Do not request a deeper mechanism, additional example/i
      );
      assert.match(
        finalRetryPrompt,
        /If no independent material problem remains, use verdict strong, riskyParts \[\], suggestedFixes \[\]/i
      );

      if (result.ok) {
        assert.equal(
          result.response.result.verdict,
          "strong"
        );
        assert.equal(
          result.response.result.riskyParts.length,
          0
        );
        assert.equal(
          result.response.result.suggestedFixes.length,
          0
        );
      }
    },
  },
  {
    name: "runAnalysisV2 preserves a complete causal explanation across auto-caption markers",
    run: async () => {
      const autoCaptionScript =
        "so basically [music] your body releases adrenaline when it senses danger and that is why your hands shake [music] the response normally fades after the danger has passed";

      let callCount = 0;
      const userPrompts: string[] = [];

      const invalidResult: Record<string, unknown> = {
        scriptType: "explanation",
        verdict: "mixed",
        scores: {
          overall: 47,
          hook: 60,
          retentionRisk: 55,
        },
        hookDecision: "refine",
        hookAssessment:
          "The opening phrase 'so basically' is generic filler before the otherwise complete explanation.",
        suggestedHook:
          "Your body releases adrenaline when it senses danger, causing your hands to shake.",
        riskyParts: [
          {
            excerpt: "so basically",
            reason:
              "Generic filler delays the concrete premise and reduces hook immediacy.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Remove the generic filler 'so basically' and start directly with the concrete premise.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt: autoCaptionScript,
            label:
              "Complete causal explanation with opening filler",
            status: "average",
          },
        ],
        mainTakeaway:
          "The script explains the adrenaline response clearly but offers only a minimal payoff without deeper mechanism or broader viewer reward.",
      };

      const invalidVerdictResult: Record<string, unknown> = {
        scriptType: "explanation",
        verdict: "mixed",
        scores: {
          overall: 40,
          hook: 60,
          retentionRisk: 55,
        },
        hookDecision: "refine",
        hookAssessment:
          "The opening phrase 'so basically' is generic filler before the otherwise complete explanation.",
        suggestedHook:
          "Your body releases adrenaline when it senses danger, and that is why your hands shake.",
        riskyParts: [
          {
            excerpt: "so basically",
            reason:
              "Generic filler delays the concrete premise and reduces hook immediacy.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Remove the generic filler 'so basically' and start directly with the concrete premise.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt: "so basically",
            label: "Opening filler",
            status: "risky",
          },
          {
            excerpt:
              "your body releases adrenaline when it senses danger and that is why your hands shake",
            label: "Cause and observable effect",
            status: "strong",
          },
          {
            excerpt:
              "the response normally fades after the danger has passed",
            label: "Resolution",
            status: "strong",
          },
        ],
        mainTakeaway:
          "Only the opening filler needs refinement; the causal explanation is complete.",
      };

      const correctedResult: Record<string, unknown> = {
        scriptType: "explanation",
        verdict: "strong",
        scores: {
          overall: 73,
          hook: 75,
          retentionRisk: 20,
        },
        hookDecision: "keep",
        hookAssessment:
          "After ignoring the transcription markers, the opening immediately presents a clear causal explanation.",
        suggestedHook: null,
        riskyParts: [],
        suggestedFixes: [],
        scenes: [
          {
            excerpt: autoCaptionScript,
            label: "Cause, physical effect, and resolution",
            status: "strong",
          },
        ],
        mainTakeaway:
          "The script contains a complete causal chain despite auto-caption formatting.",
      };

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          return {
            raw: JSON.stringify(
              callCount === 1
                ? invalidResult
                : callCount === 2
                  ? invalidVerdictResult
                  : correctedResult
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        autoCaptionScript,
        "adrenaline response",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(callCount, 3);

      const finalRetryPrompt =
        userPrompts[2] ?? "";

      assert.match(
        finalRetryPrompt,
        /mixed verdict is inconsistent with the supplied overall score/i
      );
      assert.match(
        finalRetryPrompt,
        /Recalculate the public scores by summing the required score components/i
      );
      assert.match(
        finalRetryPrompt,
        /contains bracketed auto-caption markers/i
      );
      assert.match(
        finalRetryPrompt,
        /Treat \[music\].*as non-semantic transcription cues/i
      );
      assert.match(
        finalRetryPrompt,
        /Read the meaningful words before and after each marker as one continuous causal sequence/i
      );
      assert.match(
        finalRetryPrompt,
        /Every riskyParts\[\]\.excerpt and scenes\[\]\.excerpt must remain an exact contiguous substring/i
      );
      assert.match(
        finalRetryPrompt,
        /If an excerpt spans a bracketed marker, include that marker exactly or split the content/i
      );
      assert.match(
        finalRetryPrompt,
        /Never concatenate words from opposite sides of a marker into an excerpt that does not literally exist/i
      );
      assert.match(
        finalRetryPrompt,
        /may justify at most one hook or clarity issue/i
      );
      assert.match(
        finalRetryPrompt,
        /do not request a deeper mechanism, additional example/i
      );
      assert.match(
        finalRetryPrompt,
        /Apply these transcript constraints together with the correction for the latest validation failure/i
      );

      if (result.ok) {
        assert.equal(
          result.response.result.verdict,
          "strong"
        );
        assert.equal(
          result.response.result.riskyParts.length,
          0
        );
        assert.equal(
          result.response.result.suggestedFixes.length,
          0
        );
      }
    },
  },
  {
    name: "runAnalysisV2 corrects a strong auto-caption result that retains risky feedback",
    run: async () => {
      const autoCaptionScript =
        "so basically [music] your body releases adrenaline when it senses danger and that is why your hands shake [music] the response normally fades after the danger has passed";

      let callCount = 0;
      const userPrompts: string[] = [];

      const invalidDepthResult: Record<string, unknown> = {
        scriptType: "explanation",
        verdict: "mixed",
        scores: {
          overall: 47,
          hook: 60,
          retentionRisk: 55,
        },
        hookDecision: "refine",
        hookAssessment:
          "The opening filler delays the otherwise complete causal explanation.",
        suggestedHook:
          "Your body releases adrenaline when it senses danger, causing your hands to shake.",
        riskyParts: [
          {
            excerpt: "so basically",
            reason:
              "Generic filler delays the concrete premise and reduces hook immediacy.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Remove the generic filler and begin directly with the concrete premise.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt: autoCaptionScript,
            label:
              "Complete causal explanation with opening filler",
            status: "average",
          },
        ],
        mainTakeaway:
          "The explanation is clear but supposedly lacks a deeper mechanism.",
      };

      const invalidStrongResult: Record<string, unknown> = {
        scriptType: "explanation",
        verdict: "strong",
        scores: {
          overall: 73,
          hook: 75,
          retentionRisk: 20,
        },
        hookDecision: "refine",
        hookAssessment:
          "The causal explanation is complete, but the opening filler reduces immediacy.",
        suggestedHook:
          "Your body releases adrenaline when it senses danger, causing your hands to shake.",
        riskyParts: [
          {
            excerpt: "so basically",
            reason:
              "Generic filler delays the concrete premise and reduces hook immediacy.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Remove the generic filler and begin directly with the concrete premise.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt: autoCaptionScript,
            label:
              "Complete causal explanation with opening filler",
            status: "average",
          },
        ],
        mainTakeaway:
          "The causal explanation is complete, with only the opening filler needing refinement.",
      };

      const finalInvalidDepthResult: Record<string, unknown> = {
        scriptType: "explanation",
        verdict: "mixed",
        scores: {
          overall: 49,
          hook: 63,
          retentionRisk: 53,
        },
        hookDecision: "refine",
        hookAssessment:
          "The opening filler delays the premise, but the explanation still needs more detail.",
        suggestedHook:
          "Your body releases adrenaline when it senses danger, causing your hands to shake.",
        riskyParts: [
          {
            excerpt: "so basically",
            reason:
              "Generic filler delays the concrete premise and reduces hook immediacy.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "hook",
            suggestion:
              "Remove the generic filler and begin directly with the concrete premise.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt: autoCaptionScript,
            label:
              "Complete causal explanation with opening filler",
            status: "average",
          },
        ],
        mainTakeaway:
          "Strengthening the hook and adding more detailed explanation or consequences would improve retention and engagement.",
      };

      const modelCaller: AnalysisV2ModelCaller =
        async (_systemPrompt, userPrompt) => {
          callCount += 1;
          userPrompts.push(userPrompt);

          return {
            raw: JSON.stringify(
              callCount === 1
                ? invalidDepthResult
                : callCount === 2
                  ? invalidStrongResult
                  : finalInvalidDepthResult
            ),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        autoCaptionScript,
        "adrenaline response",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(callCount, 3);

      const finalRetryPrompt =
        userPrompts[2] ?? "";

      assert.match(
        finalRetryPrompt,
        /A strong result must not contain risky parts/i
      );
      assert.match(
        finalRetryPrompt,
        /perform a final deterministic consistency check/i
      );
      assert.match(
        finalRetryPrompt,
        /Choose exactly one coherent result path/i
      );
      assert.match(
        finalRetryPrompt,
        /Never return verdict strong while retaining any riskyPart/i
      );
      assert.match(
        finalRetryPrompt,
        /either retain it as a material issue and use verdict mixed/i
      );
      assert.match(
        finalRetryPrompt,
        /or treat it as non-material and use verdict strong with no riskyParts/i
      );
      assert.match(
        finalRetryPrompt,
        /Never use verdict strong while still describing "so basically" as a remaining material problem/i
      );
      assert.match(
        finalRetryPrompt,
        /Recalculate all three public scores from the supplied scoreComponents/i
      );

      if (result.ok) {
        assert.equal(
          result.response.result.verdict,
          "mixed"
        );
        assert.equal(
          result.response.result.riskyParts.length,
          1
        );
        assert.equal(
          result.response.result.suggestedFixes.length,
          1
        );
        assert.equal(
          result.response.result.riskyParts[0]?.excerpt,
          "so basically"
        );
        assert.equal(
          result.response.result.suggestedFixes[0]?.target,
          "hook"
        );
        assert.equal(
          result.response.result.mainTakeaway,
          "The causal explanation is complete; only the opening filler limits immediacy."
        );
      }
    },
  },
  {
    name: "runAnalysisV2 corrects an external-consequence critique of a resolved outcome",
    run: async () => {
      const resolvedOutcomeScript =
        "A research drone disappeared during a storm. Search teams followed its last signal into a canyon. The battery was almost dead, and the tracker stopped updating. After six hours, the drone was found intact.";

      let callCount = 0;
      const userPrompts: string[] = [];

      const invalidResult: Record<string, unknown> = {
        scriptType: "narrative_event",
        verdict: "mixed",
        scores: {
          overall: 63,
          hook: 80,
          retentionRisk: 40,
        },
        hookDecision: "keep",
        hookAssessment:
          "The opening immediately establishes a concrete search under pressure.",
        suggestedHook: null,
        riskyParts: [
          {
            excerpt:
              "After six hours, the drone was found intact.",
            reason:
              "The script ends with a minimal payoff that lacks a clear explanation of the significance or consequence of this resolved outcome, limiting viewer reward.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "payoff",
            suggestion:
              "Add a contrast, example, or implication that strengthens why this found result matters in the context of the search.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt:
              "A research drone disappeared during a storm.",
            label: "Search begins",
            status: "strong",
          },
          {
            excerpt:
              "The battery was almost dead, and the tracker stopped updating.",
            label: "Signal almost fails",
            status: "strong",
          },
          {
            excerpt:
              "After six hours, the drone was found intact.",
            label: "Resolved outcome",
            status: "risky",
          },
        ],
        mainTakeaway:
          "The chronology is clear, but the resolved ending supposedly needs another consequence.",
      };

      const correctedResult: Record<string, unknown> = {
        scriptType: "narrative_event",
        verdict: "strong",
        scores: {
          overall: 80,
          hook: 82,
          retentionRisk: 28,
        },
        hookDecision: "keep",
        hookAssessment:
          "The opening immediately establishes a concrete search under pressure and the chronology escalates through rising stakes.",
        suggestedHook: null,
        riskyParts: [],
        suggestedFixes: [
          {
            target: "clarity",
            suggestion:
              "Optionally tighten one middle sentence so the escalation reaches the final resolved outcome faster.",
            optional: true,
          },
        ],
        scenes: [
          {
            excerpt:
              "A research drone disappeared during a storm.",
            label: "Search begins",
            status: "strong",
          },
          {
            excerpt:
              "The battery was almost dead, and the tracker stopped updating.",
            label: "Signal almost fails",
            status: "strong",
          },
          {
            excerpt:
              "After six hours, the drone was found intact.",
            label: "Resolved outcome payoff",
            status: "strong",
          },
        ],
        mainTakeaway:
          "The chronology escalates through concrete stakes and resolves with a meaningful found outcome.",
      };

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
        resolvedOutcomeScript,
        "The missing research drone",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(callCount, 2);

      const retryPrompt = userPrompts[1] ?? "";

      assert.match(
        retryPrompt,
        /Treat that resolved outcome as a valid narrative payoff/i
      );
      assert.match(
        retryPrompt,
        /Remove the riskyPart and required payoff fix/i
      );
      assert.match(
        retryPrompt,
        /Do not request external factual material merely to extend the resolved outcome/i
      );

      if (result.ok) {
        assert.equal(
          result.response.result.verdict,
          "strong"
        );
        assert.equal(
          result.response.result.riskyParts.length,
          0
        );
        assert.equal(
          result.response.result.suggestedFixes[0]
            ?.optional,
          true
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
              callCount < 3
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
      assert.equal(callCount, 3);

      const retryPrompt = userPrompts[1] ?? "";
      const finalRetryPrompt =
        userPrompts[2] ?? "";

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
      assert.match(
        finalRetryPrompt,
        /Final targeted correction required/i
      );
      assert.match(
        finalRetryPrompt,
        /allowed neutral diagnostic forms/i
      );
      assert.match(
        finalRetryPrompt,
        /must use exactly one of these complete sentences/i
      );
      assert.match(
        finalRetryPrompt,
        /Do not replace 'this' with a specific action, step, object, topic, group, consequence, or factual direction/i
      );
      assert.match(
        finalRetryPrompt,
        /remove the riskyPart and required suggestedFix instead of forcing external factual material/i
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
    name: "runAnalysisV2 accepts a successful model call with zero retries",
    run: async () => {
      let callCount = 0;

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          return {
            raw: JSON.stringify(createValidResult()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        script,
        "",
        modelCaller
      );

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(callCount, 1);
      assert.equal(result.retryCount, 0);
    },
  },
  {
    name: "runAnalysisV2 retries once after a transient 503 and then succeeds",
    run: async () => {
      let callCount = 0;

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          if (callCount === 1) {
            throw Object.assign(
              new Error("Upstream unavailable"),
              { status: 503 }
            );
          }

          return {
            raw: JSON.stringify(createValidResult()),
            modelUsed: "mock-model",
          };
        };

      const result = await runAnalysisV2(
        script,
        "",
        modelCaller
      );

      assert.equal(callCount, 2);
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(result.retryCount, 1);
    },
  },
  {
    name: "runAnalysisV2 returns a controlled 503 after two consecutive transient failures, retrying only once",
    run: async () => {
      let callCount = 0;

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          throw Object.assign(
            new Error("Sensitive upstream detail"),
            { status: 500 }
          );
        };

      const result = await runAnalysisV2(
        script,
        "",
        modelCaller
      );

      assert.equal(
        callCount,
        2,
        "exactly one retry: initial call plus one retry, no more"
      );
      assert.equal(result.ok, false);
      assert.equal(result.status, 503);
      assert.equal(result.retryCount, 1);

      if (!result.ok) {
        assert.equal(
          result.response.reason.includes(
            "Sensitive upstream detail"
          ),
          false
        );
      }
    },
  },
  {
    name: "runAnalysisV2 does not retry a non-transient model error",
    run: async () => {
      let callCount = 0;

      const modelCaller: AnalysisV2ModelCaller =
        async () => {
          callCount += 1;

          throw Object.assign(
            new Error("Bad request to provider"),
            { status: 400 }
          );
        };

      const result = await runAnalysisV2(
        script,
        "",
        modelCaller
      );

      assert.equal(
        callCount,
        1,
        "a non-transient (400-shaped) provider error must not be retried"
      );
      assert.equal(result.ok, false);
      assert.equal(result.retryCount, 0);
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
    name: "POST echoes a valid requested locale and defaults an invalid one to en",
    run: async () => {
      const originalFetch = globalThis.fetch;
      const originalApiKey =
        process.env.OPENAI_API_KEY;

      process.env.OPENAI_API_KEY = "test-key";

      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            id: "chatcmpl-analysis-v2-locale-test",
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
        const ruRequest = new Request(
          "http://localhost/api/analyze-v2",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.50",
            },
            body: JSON.stringify({
              script,
              title: "Super glue removal",
              locale: "ru",
            }),
          }
        );

        const ruResponse = await POST(ruRequest);
        const ruPayload = await expectJson(ruResponse);

        assert.equal(ruResponse.status, 200);
        assert.equal(ruPayload.locale, "ru");

        const invalidLocaleRequest = new Request(
          "http://localhost/api/analyze-v2",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.51",
            },
            body: JSON.stringify({
              script,
              title: "Super glue removal",
              locale: "fr",
            }),
          }
        );

        const invalidLocaleResponse = await POST(
          invalidLocaleRequest
        );
        const invalidLocalePayload = await expectJson(
          invalidLocaleResponse
        );

        assert.equal(invalidLocaleResponse.status, 200);
        assert.equal(invalidLocalePayload.locale, "en");

        const missingLocaleRequest = new Request(
          "http://localhost/api/analyze-v2",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.52",
            },
            body: JSON.stringify({
              script,
              title: "Super glue removal",
            }),
          }
        );

        const missingLocaleResponse = await POST(
          missingLocaleRequest
        );
        const missingLocalePayload = await expectJson(
          missingLocaleResponse
        );

        assert.equal(missingLocaleResponse.status, 200);
        assert.equal(missingLocalePayload.locale, "en");
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
  {
    name: "POST exposes a stable request id and a zero retry-count header on a clean success",
    run: async () => {
      const originalFetch = globalThis.fetch;
      const originalApiKey =
        process.env.OPENAI_API_KEY;

      process.env.OPENAI_API_KEY = "test-key";

      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            id: "chatcmpl-analysis-v2-header-test",
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
              "X-Forwarded-For": "203.0.113.60",
            },
            body: JSON.stringify({
              script,
              title: "Super glue removal",
            }),
          }
        );

        const response = await POST(request);

        assert.equal(response.status, 200);

        const requestId = response.headers.get(
          ANALYSIS_V2_REQUEST_ID_HEADER
        );

        assert.match(
          requestId ?? "",
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          "request id must be a real UUID, not a placeholder"
        );

        assert.equal(
          response.headers.get(
            ANALYSIS_V2_RETRY_COUNT_HEADER
          ),
          "0"
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
    name: "POST reports a non-zero retry-count header after a mocked transient upstream failure recovers",
    run: async () => {
      const originalFetch = globalThis.fetch;
      const originalApiKey =
        process.env.OPENAI_API_KEY;

      process.env.OPENAI_API_KEY = "test-key";

      let fetchCallCount = 0;

      globalThis.fetch = (async () => {
        fetchCallCount += 1;

        if (fetchCallCount === 1) {
          return new Response(
            JSON.stringify({
              error: {
                message: "Upstream overloaded",
                type: "server_error",
              },
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
        }

        return new Response(
          JSON.stringify({
            id: "chatcmpl-analysis-v2-retry-header-test",
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
        );
      }) as typeof fetch;

      try {
        const request = new Request(
          "http://localhost/api/analyze-v2",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.61",
            },
            body: JSON.stringify({
              script,
              title: "Super glue removal",
            }),
          }
        );

        const response = await POST(request);

        assert.equal(response.status, 200);
        assert.equal(fetchCallCount, 2);
        assert.equal(
          response.headers.get(
            ANALYSIS_V2_RETRY_COUNT_HEADER
          ),
          "1"
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
    name: "POST marks a failed response as non-cacheable",
    run: async () => {
      const request = new Request(
        "http://localhost/api/analyze-v2",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "203.0.113.62",
          },
          body: JSON.stringify({
            script: "",
            title: "",
          }),
        }
      );

      const response = await POST(request);

      assert.equal(response.status, 400);
      assert.equal(
        response.headers.get("Cache-Control"),
        "no-store"
      );
      assert.ok(
        response.headers.get(
          ANALYSIS_V2_REQUEST_ID_HEADER
        )
      );
    },
  },
  {
    name: "comprehensive: RU explanatory fields are Russian (exact match), evidence excerpts stay verbatim in the script's own language, and EN/RU reach identical scores and decisions",
    run: async () => {
      const originalFetch = globalThis.fetch;
      const originalApiKey = process.env.OPENAI_API_KEY;

      process.env.OPENAI_API_KEY = "test-key";

      // A script built around one distinctive, unmistakable English
      // sentence used as the riskyPart excerpt, and a second one used as
      // a scene excerpt. If either ever comes back paraphrased,
      // translated, or substituted, the exact-equality assertions below
      // fail immediately — there is no proxy reasoning here.
      const RISKY_EXCERPT = "Messi scored the winning goal in Paris.";
      const SCENE_EXCERPT =
        "The stadium erupted the moment the ball crossed the line.";
      const evidenceScript = `${RISKY_EXCERPT} Nobody expected the match to end this way. ${SCENE_EXCERPT}`;
      const evidenceScriptLines = [
        RISKY_EXCERPT,
        "Nobody expected the match to end this way.",
        SCENE_EXCERPT,
      ];

      const sharedScoreComponents = {
        overall: {
          premiseAppeal: 10,
          openingPromise: 18,
          progression: 18,
          payoff: 18,
        },
        hook: {
          immediacy: 18,
          specificity: 18,
          viewerPull: 18,
          deliveryAlignment: 18,
        },
        retentionRisk: {
          openingFriction: 10,
          progressionRisk: 10,
          predictabilityRisk: 10,
          payoffRisk: 10,
        },
      };

      // Exact, hand-authored EN/RU text pairs. Because the test itself
      // supplies these strings, every "RU" assertion below can check for
      // literal equality against a known value instead of a loose
      // "contains Cyrillic" heuristic.
      const EXPECTED = {
        en: {
          hookAssessment:
            "The hook names the problem and gives an immediate warning that keeps viewer attention.",
          riskyReason:
            "This step sounds routine and does not create enough curiosity.",
          fixSuggestion:
            "Make the first step more concrete by adding the expected reaction time.",
          sceneLabel1: "Problem and warning",
          sceneLabel3: "Resolution",
          mainTakeaway:
            "The script is understandable, but its premise appeal limits the overall score because the idea has limited audience pull.",
        },
        ru: {
          hookAssessment:
            "Хук называет проблему и сразу даёт предупреждение, что удерживает внимание зрителя.",
          riskyReason:
            "Этот шаг звучит обыденно и не создаёт достаточного любопытства.",
          fixSuggestion:
            "Сделайте первый шаг более конкретным, добавив ожидаемое время реакции.",
          sceneLabel1: "Проблема и предупреждение",
          sceneLabel3: "Развязка",
          // Directly satisfies the (locale-aware) lowest-component check —
          // this exercises the AI-content happy path, not the repair
          // fallback (that path already has its own dedicated test).
          mainTakeaway:
            "Сценарий понятен, но привлекательность идеи ограничивает общую оценку, потому что идея слабо привлекает аудиторию.",
        },
      } as const;

      function buildModelResult(locale: "en" | "ru") {
        const text = EXPECTED[locale];

        return {
          scriptType: "how_to",
          verdict: "mixed",
          scoreComponents: sharedScoreComponents,
          hookDecision: "keep",
          hookAssessment: text.hookAssessment,
          suggestedHook: null,
          // The excerpt is IDENTICAL in both locales — evidence copied
          // from the script must never depend on the explanation language.
          riskyParts: [
            {
              excerpt: RISKY_EXCERPT,
              reason: text.riskyReason,
              severity: "medium",
            },
          ],
          suggestedFixes: [
            {
              target: "clarity",
              suggestion: text.fixSuggestion,
              optional: false,
            },
          ],
          scenes: [
            {
              excerpt: RISKY_EXCERPT,
              label: text.sceneLabel1,
              status: "average",
            },
            {
              excerpt: "Nobody expected the match to end this way.",
              label: locale === "ru" ? "Реакция зрителей" : "Crowd reaction",
              status: "average",
            },
            {
              excerpt: SCENE_EXCERPT,
              label: text.sceneLabel3,
              status: "strong",
            },
          ],
          mainTakeaway: text.mainTakeaway,
        };
      }

      async function runForLocale(
        locale: "en" | "ru",
        clientIp: string
      ): Promise<AnalysisV2SuccessResponse> {
        globalThis.fetch = (async () =>
          new Response(
            JSON.stringify({
              id: `chatcmpl-comprehensive-${locale}`,
              object: "chat.completion",
              created: 0,
              model: "gpt-4o-mini-test",
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content: JSON.stringify(
                      buildModelResult(locale)
                    ),
                  },
                  finish_reason: "stop",
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )) as typeof fetch;

        const request = new Request(
          "http://localhost/api/analyze-v2",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": clientIp,
            },
            body: JSON.stringify({
              script: evidenceScript,
              title: "Historic match",
              locale,
            }),
          }
        );

        const response = await POST(request);
        const payload = await expectJson(response);

        assert.equal(
          payload.status,
          "ok",
          `Expected a successful ${locale} analysis, got: ${JSON.stringify(payload)}`
        );

        return payload as unknown as AnalysisV2SuccessResponse;
      }

      try {
        // Sequential on purpose: both calls mutate the shared
        // globalThis.fetch mock, so running them concurrently would race
        // (this previously caused a false failure where the "en" run
        // observed the "ru" mock).
        const enResponse = await runForLocale("en", "203.0.113.60");
        const ruResponse = await runForLocale("ru", "203.0.113.61");

        assert.equal(enResponse.locale, "en");
        assert.equal(ruResponse.locale, "ru");

        // ── 1. Direct evidence/excerpt fidelity — the exact JSON field,
        // not a UI projection (AnalysisV2UiRiskyPart does not even expose
        // excerpt, so this must be checked on the raw result). ──────────
        assert.equal(
          ruResponse.result.riskyParts[0]?.excerpt,
          RISKY_EXCERPT
        );
        assert.equal(
          enResponse.result.riskyParts[0]?.excerpt,
          RISKY_EXCERPT
        );
        assert.ok(
          ruResponse.result.riskyParts[0]?.excerpt.includes("Messi")
        );
        assert.equal(
          ruResponse.result.scenes[0]?.excerpt,
          RISKY_EXCERPT
        );
        assert.equal(
          ruResponse.result.scenes[2]?.excerpt,
          SCENE_EXCERPT
        );

        const CYRILLIC = /[Ѐ-ӿ]/;

        // The excerpt is evidence copied from the script, not an
        // explanation — it must never contain Cyrillic in the RU
        // response, because the script itself is English.
        assert.doesNotMatch(
          ruResponse.result.riskyParts[0]?.excerpt ?? "",
          CYRILLIC,
          "riskyParts[0].excerpt must stay in the script's own language (English), not be translated to Russian"
        );
        assert.doesNotMatch(
          ruResponse.result.scenes[0]?.excerpt ?? "",
          CYRILLIC,
          "scenes[0].excerpt must stay in the script's own language (English), not be translated to Russian"
        );

        // ── 2. Editorial/numeric parity — locale must never change these. ──
        assert.equal(enResponse.result.verdict, ruResponse.result.verdict);
        assert.equal(
          enResponse.result.hookDecision,
          ruResponse.result.hookDecision
        );
        assert.deepEqual(
          enResponse.result.scores,
          ruResponse.result.scores
        );
        assert.deepEqual(
          enResponse.result.scoreBreakdown,
          ruResponse.result.scoreBreakdown
        );

        // ── 3. Every user-facing deterministic/AI explanatory field,
        // checked by exact string equality against the value this test
        // itself supplied (or, for deterministic fields such as
        // riskyParts[].title, against the known centralized RU string). ──
        const enAdapted = adaptAnalysisV2ForResults(
          enResponse,
          evidenceScript,
          evidenceScriptLines,
          15
        );
        const ruAdapted = adaptAnalysisV2ForResults(
          ruResponse,
          evidenceScript,
          evidenceScriptLines,
          15
        );

        // overall.description IS mainTakeaway (same field, rendered in
        // two different UI spots) — assert that explicitly so a future
        // refactor can't silently reintroduce a second, unlocalized
        // source for either.
        assert.equal(ruAdapted.mainTakeaway, EXPECTED.ru.mainTakeaway);
        assert.equal(
          ruAdapted.overall.description,
          EXPECTED.ru.mainTakeaway
        );
        assert.equal(enAdapted.mainTakeaway, EXPECTED.en.mainTakeaway);
        assert.equal(
          enAdapted.overall.description,
          EXPECTED.en.mainTakeaway
        );

        // hook description (AI content, passed straight through by the
        // adapter).
        assert.equal(
          ruAdapted.hook.description,
          EXPECTED.ru.hookAssessment
        );
        assert.equal(
          enAdapted.hook.description,
          EXPECTED.en.hookAssessment
        );

        // retention/"risk" description — with a riskyPart present, this
        // equals that part's (AI) reason.
        assert.equal(ruAdapted.risk.description, EXPECTED.ru.riskyReason);
        assert.equal(enAdapted.risk.description, EXPECTED.en.riskyReason);

        // riskyParts[0].title is the DETERMINISTIC fallback from
        // getRiskTitle(severity) — severity "medium" must map to the
        // exact centralized Russian string, not the English one.
        assert.equal(
          ruAdapted.riskyParts[0]?.title,
          "Возможная точка оттока."
        );
        assert.equal(
          enAdapted.riskyParts[0]?.title,
          "Potential drop-off point."
        );

        // riskyParts[0].description is the AI-authored reason, exactly as
        // supplied (this is prose, not evidence, so it IS translated).
        assert.equal(
          ruAdapted.riskyParts[0]?.description,
          EXPECTED.ru.riskyReason
        );
        assert.equal(
          enAdapted.riskyParts[0]?.description,
          EXPECTED.en.riskyReason
        );

        // suggested fixes.
        assert.equal(ruAdapted.fixes[0], EXPECTED.ru.fixSuggestion);
        assert.equal(enAdapted.fixes[0], EXPECTED.en.fixSuggestion);

        // scene labels (AI content).
        assert.equal(
          ruAdapted.sceneSegments[0]?.label,
          EXPECTED.ru.sceneLabel1
        );
        assert.equal(
          ruAdapted.sceneSegments[2]?.label,
          EXPECTED.ru.sceneLabel3
        );
        assert.equal(
          enAdapted.sceneSegments[0]?.label,
          EXPECTED.en.sceneLabel1
        );
        assert.equal(
          enAdapted.sceneSegments[2]?.label,
          EXPECTED.en.sceneLabel3
        );

        // scoreBreakdown group titles/item labels (e.g. "Immediacy") are
        // intentionally identical between locales — they are static
        // Analysis V2 category names localized at the UI-component layer
        // (app/results/ui-components.tsx's messages.results.scoreBreakdown
        // mapping), not by this adapter.
        assert.equal(
          ruAdapted.scoreBreakdown?.hook.items[0]?.label,
          enAdapted.scoreBreakdown?.hook.items[0]?.label
        );
      } finally {
        globalThis.fetch = originalFetch;

        if (originalApiKey === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY = originalApiKey;
        }
      }
    },
  },
  {
    name: "comprehensive: the deterministic no-riskyParts retention fallback is the exact centralized Russian string, not English",
    run: async () => {
      // Direct adapter call (no network/POST involved) — this exercises
      // the fallback branch of getRiskDescription, which only runs when
      // there are zero riskyParts. A strong, empty-riskyParts result is
      // required to reach it (mirrors the STRONG-SCRIPT GATE rule).
      const script = "A clean, focused explanation with no material issues.";

      const ruStrongResponse: AnalysisV2SuccessResponse = {
        status: "ok",
        modelUsed: "test-model",
        locale: "ru",
        result: {
          scriptType: "explanation",
          verdict: "strong",
          scores: { overall: 82, hook: 80, retentionRisk: 20 },
          hookDecision: "keep",
          hookAssessment: "Хук ясно и сразу называет тему.",
          riskyParts: [],
          suggestedFixes: [],
          scenes: [
            { excerpt: script, label: "Полное объяснение", status: "strong" },
          ],
          mainTakeaway: "Сценарий чёткий и полностью раскрывает тему.",
        },
      };

      const enStrongResponse: AnalysisV2SuccessResponse = {
        ...ruStrongResponse,
        locale: "en",
        result: {
          ...ruStrongResponse.result,
          hookAssessment: "The hook clearly and immediately states the topic.",
          scenes: [
            { excerpt: script, label: "Full explanation", status: "strong" },
          ],
          mainTakeaway:
            "The script is clear and fully delivers on its topic.",
        },
      };

      const ruAdapted = adaptAnalysisV2ForResults(
        ruStrongResponse,
        script,
        [script],
        10
      );
      const enAdapted = adaptAnalysisV2ForResults(
        enStrongResponse,
        script,
        [script],
        10
      );

      assert.equal(ruAdapted.riskyParts.length, 0);
      assert.equal(
        ruAdapted.risk.description,
        "Низкий риск удержания. Сценарий остаётся сфокусированным и сохраняет чёткое развитие."
      );
      assert.equal(
        enAdapted.risk.description,
        "Low retention risk. The script stays focused and maintains a clear progression."
      );
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
