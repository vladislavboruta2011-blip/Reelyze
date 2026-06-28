import assert from "node:assert/strict";

import type {
  AnalysisV2Result,
  AnalysisV2SuccessResponse,
} from "../engine/analysis-v2-schema";
import {
  adaptAnalysisV2ForResults,
  isAnalysisV2SuccessResponse,
  parseStoredAnalysisV2,
} from "../engine/analysis-v2-ui-adapter";

const strongScript =
  "If super glue gets stuck to your skin, do not pull it apart. First, soak the area in warm soapy water. Then gently roll the skin apart.";

const strongResult: AnalysisV2Result = {
  scriptType: "how_to",
  verdict: "strong",
  scores: {
    overall: 88,
    hook: 82,
    retentionRisk: 22,
  },
  hookDecision: "keep",
  hookAssessment:
    "The opening names the problem and immediately gives a useful warning.",
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
      excerpt: "Then gently roll the skin apart.",
      label: "Resolution",
      status: "strong",
    },
  ],
  mainTakeaway:
    "The script is focused, useful, and structurally strong.",
};

const strongResponse: AnalysisV2SuccessResponse = {
  status: "ok",
  result: strongResult,
  modelUsed: "test-model",
};

const mixedScript =
  "Start with a clear result. This middle line is vague and repeats itself. End with a specific payoff.";

const mixedResponse: AnalysisV2SuccessResponse = {
  status: "ok",
  modelUsed: "test-model",
  result: {
    scriptType: "explanation",
    verdict: "mixed",
    scores: {
      overall: 61,
      hook: 68,
      retentionRisk: 52,
    },
    hookDecision: "refine",
    hookAssessment:
      "The opening is understandable but could create more tension.",
    suggestedHook:
      "Start with the specific result before explaining why it happens.",
    riskyParts: [
      {
        excerpt:
          "This middle line is vague and repeats itself.",
        reason:
          "The middle loses momentum because it repeats an abstract point.",
        severity: "medium",
      },
      {
        excerpt:
          "End with a specific payoff.",
        reason:
          "The ending is usable but could be more concrete.",
        severity: "low",
      },
    ],
    suggestedFixes: [
      {
        target: "middle",
        suggestion:
          "Replace the vague middle line with one concrete mechanism.",
        optional: false,
      },
    ],
    scenes: [
      {
        excerpt: "Start with a clear result.",
        label: "Opening",
        status: "average",
      },
      {
        excerpt:
          "This middle line is vague and repeats itself.",
        label: "Weak middle",
        status: "risky",
      },
      {
        excerpt: "End with a specific payoff.",
        label: "Ending",
        status: "average",
      },
    ],
    mainTakeaway:
      "The script has a workable structure, but the middle needs more specificity.",
  },
};

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [
  {
    name: "accepts a valid success response",
    run: () => {
      assert.equal(
        isAnalysisV2SuccessResponse(
          strongResponse,
          strongScript
        ),
        true
      );
    },
  },
  {
    name: "rejects malformed stored JSON",
    run: () => {
      assert.equal(
        parseStoredAnalysisV2("{invalid", strongScript),
        null
      );
    },
  },
  {
    name: "rejects stored analysis for a different script",
    run: () => {
      assert.equal(
        parseStoredAnalysisV2(
          JSON.stringify(strongResponse),
          "A completely different script."
        ),
        null
      );
    },
  },
  {
    name: "adapts scores and main takeaway",
    run: () => {
      const adapted = adaptAnalysisV2ForResults(
        strongResponse,
        strongScript,
        [
          "If super glue gets stuck to your skin, do not pull it apart.",
          "First, soak the area in warm soapy water.",
          "Then gently roll the skin apart.",
        ],
        12
      );

      assert.equal(adapted.overall.score, 88);
      assert.equal(adapted.hook.score, 82);
      assert.equal(adapted.risk.score, 22);
      assert.equal(
        adapted.overall.description,
        strongResult.mainTakeaway
      );
      assert.equal(adapted.mainTakeaway, strongResult.mainTakeaway);
      assert.equal(adapted.suggestedHook, "");
      assert.deepEqual(adapted.riskyLineIndexes, []);
      assert.deepEqual(adapted.warningLineIndexes, []);
    },
  },
  {
    name: "maps medium and low risks to line indexes",
    run: () => {
      const adapted = adaptAnalysisV2ForResults(
        mixedResponse,
        mixedScript,
        [
          "Start with a clear result.",
          "This middle line is vague and repeats itself.",
          "End with a specific payoff.",
        ],
        10
      );

      assert.deepEqual(adapted.riskyLineIndexes, [1]);
      assert.deepEqual(adapted.warningLineIndexes, [2]);
      assert.equal(adapted.riskyParts.length, 2);
      assert.equal(adapted.fixes.length, 1);
      assert.equal(
        adapted.suggestedHook,
        mixedResponse.result.suggestedHook
      );
    },
  },
  {
    name: "mixed verdict overrides a strong score label",
    run: () => {
      const highMixedResponse: AnalysisV2SuccessResponse = {
        ...mixedResponse,
        result: {
          ...mixedResponse.result,
          scores: {
            ...mixedResponse.result.scores,
            overall: 75,
          },
        },
      };

      const adapted = adaptAnalysisV2ForResults(
        highMixedResponse,
        mixedScript,
        [
          "Start with a clear result.",
          "This middle line is vague and repeats itself.",
          "End with a specific payoff.",
        ],
        10
      );

      assert.equal(adapted.overall.label, "Mixed");
    },
  },
  {
    name: "mixed verdict overrides a green score color",
    run: () => {
      const highMixedResponse: AnalysisV2SuccessResponse = {
        ...mixedResponse,
        result: {
          ...mixedResponse.result,
          scores: {
            ...mixedResponse.result.scores,
            overall: 75,
          },
        },
      };

      const adapted = adaptAnalysisV2ForResults(
        highMixedResponse,
        mixedScript,
        [
          "Start with a clear result.",
          "This middle line is vague and repeats itself.",
          "End with a specific payoff.",
        ],
        10
      );

      assert.equal(adapted.overall.ringColor, "#F59E0B");
    },
  },
  {
    name: "creates scene widths that exactly fill the bar",
    run: () => {
      const adapted = adaptAnalysisV2ForResults(
        mixedResponse,
        mixedScript,
        [
          "Start with a clear result.",
          "This middle line is vague and repeats itself.",
          "End with a specific payoff.",
        ],
        10
      );

      const totalWidth = adapted.sceneSegments.reduce(
        (sum, segment) => sum + segment.width,
        0
      );

      assert.equal(totalWidth, 1110);
      assert.equal(adapted.sceneSegments.length, 3);
      assert.deepEqual(
        adapted.sceneSegments.map((segment) => segment.color),
        ["#F59E0B", "#EF4444", "#F59E0B"]
      );
    },
  },

  {
    name: "returns the normalized result when loading stored analysis",
    run: () => {
      const storedScript =
        "Start with a clear result. Explain why viewers should care. This middle line is vague and repeats itself. End with a specific payoff.";

      const staleResponse: AnalysisV2SuccessResponse = {
        status: "ok",
        modelUsed: "old-model",
        result: {
          scriptType: "explanation",
          verdict: "mixed",
          scores: {
            overall: 61,
            hook: 68,
            retentionRisk: 52,
          },
          hookDecision: "refine",
          hookAssessment:
            "The opening is clear, but the middle needs more specificity.",
          suggestedHook:
            "Start with the specific result before explaining why it happens.",
          riskyParts: [
            {
              excerpt:
                "This middle line is vague and repeats itself.",
              reason:
                "The middle loses momentum because it repeats an abstract point.",
              severity: "medium",
            },
          ],
          suggestedFixes: [
            {
              target: "middle",
              suggestion:
                "Replace the vague middle line with one concrete mechanism.",
              optional: false,
            },
          ],
          scenes: [
            {
              excerpt: "Start with a clear result.",
              label: "Opening",
              status: "average",
            },
            {
              excerpt:
                "This middle line is vague and repeats itself.",
              label: "Weak middle",
              status: "risky",
            },
            {
              excerpt: "End with a specific payoff.",
              label: "Ending",
              status: "average",
            },
          ],
          mainTakeaway:
            "The script has a workable structure, but the middle needs more specificity.",
        },
      };

      const parsed = parseStoredAnalysisV2(
        JSON.stringify(staleResponse),
        storedScript
      );

      assert.ok(parsed);
      assert.equal(parsed.result.hookDecision, "keep");
      assert.equal(parsed.result.suggestedHook, undefined);
    },
  },
];

console.log("\nAnalysis V2 UI Adapter Tests\n");

let failures = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`✅ PASS — ${test.name}`);
  } catch (error) {
    failures += 1;
    console.error(`❌ FAIL — ${test.name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length}/${tests.length} tests passed.\n`);
}
