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
