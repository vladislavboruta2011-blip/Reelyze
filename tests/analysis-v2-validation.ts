import assert from "node:assert/strict";

import {
  parseAnalysisV2Json,
  validateAnalysisV2Input,
  validateAnalysisV2Result,
} from "../engine/analysis-v2-validation";

const script =
  "If super glue gets stuck to your skin, do not pull it apart. First, soak the area in warm soapy water. Then gently roll the skin apart. It usually comes apart in under five minutes.";

function createStrongResult(): Record<string, unknown> {
  return {
    scriptType: "how_to",
    verdict: "strong",
    scores: {
      overall: 84,
      hook: 82,
      retentionRisk: 22,
    },
    hookDecision: "keep",
    hookAssessment:
      "The hook names the problem and gives an immediate warning.",
    riskyParts: [],
    suggestedFixes: [
      {
        target: "clarity",
        suggestion:
          "Optionally shorten the final resolution so the ending lands faster.",
        optional: true,
      },
    ],
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

function createWeakResult(): Record<string, unknown> {
  return {
    scriptType: "generic_advice",
    verdict: "weak",
    scores: {
      overall: 31,
      hook: 28,
      retentionRisk: 74,
    },
    hookDecision: "diagnostic",
    hookAssessment:
      "The script lacks enough concrete material for a grounded rewrite.",
    riskyParts: [
      {
        excerpt:
          "Then gently roll the skin apart.",
        reason:
          "This isolated sentence would be unclear without the surrounding steps.",
        severity: "medium",
      },
    ],
    suggestedFixes: [
      {
        target: "clarity",
        suggestion:
          "Connect the instruction more explicitly to the previous step.",
        optional: false,
      },
    ],
    scenes: [
      {
        excerpt:
          "Then gently roll the skin apart.",
        label: "Unclear instruction",
        status: "risky",
      },
    ],
    mainTakeaway:
      "The script is weak because one important instruction lacks enough context.",
  };
}

function createMixedResult(): Record<string, unknown> {
  return {
    scriptType: "how_to",
    verdict: "mixed",
    scores: {
      overall: 62,
      hook: 58,
      retentionRisk: 52,
    },
    hookDecision: "refine",
    hookAssessment:
      "The opening is clear, but the instruction sequence needs a better transition.",
    suggestedHook:
      "When super glue sticks to your skin, avoid pulling it apart.",
    riskyParts: [
      {
        excerpt:
          "Then gently roll the skin apart.",
        reason:
          "This instruction needs a clearer connection to the previous step.",
        severity: "medium",
      },
    ],
    suggestedFixes: [
      {
        target: "clarity",
        suggestion:
          "Connect this instruction directly to the soaking step so the sequence is easier to follow.",
        optional: false,
      },
    ],
    scenes: [
      {
        excerpt:
          "Then gently roll the skin apart.",
        label: "Unclear transition",
        status: "risky",
      },
    ],
    mainTakeaway:
      "The script has a useful structure but needs one clearer transition.",
  };
}

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [
  {
    name: "accepts valid input",
    run: () => {
      const result = validateAnalysisV2Input(
        script,
        "Super glue removal"
      );

      assert.equal(result.ok, true);
    },
  },
  {
    name: "rejects an empty script",
    run: () => {
      const result = validateAnalysisV2Input("   ", "");

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects an oversized script",
    run: () => {
      const result = validateAnalysisV2Input(
        "a".repeat(1001),
        ""
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects an oversized title",
    run: () => {
      const result = validateAnalysisV2Input(
        script,
        "a".repeat(201)
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "parses valid JSON",
    run: () => {
      const parsed = parseAnalysisV2Json('{"status":"ok"}');

      assert.deepEqual(parsed, { status: "ok" });
    },
  },
  {
    name: "parses JSON inside a markdown fence",
    run: () => {
      const parsed = parseAnalysisV2Json(
        '```json\n{"status":"ok"}\n```'
      );

      assert.deepEqual(parsed, { status: "ok" });
    },
  },
  {
    name: "rejects malformed JSON",
    run: () => {
      const parsed = parseAnalysisV2Json("{invalid");

      assert.equal(parsed, null);
    },
  },
  {
    name: "accepts a valid strong result",
    run: () => {
      const result = validateAnalysisV2Result(
        createStrongResult(),
        script
      );

      assert.equal(result.ok, true);
    },
  },
  {
    name: "accepts a valid weak result",
    run: () => {
      const result = validateAnalysisV2Result(
        createWeakResult(),
        script
      );

      assert.equal(result.ok, true);
    },
  },
  {
    name: "accepts a valid mixed result",
    run: () => {
      const result = validateAnalysisV2Result(
        createMixedResult(),
        script
      );

      assert.equal(result.ok, true);
    },
  },
  {
    name: "rejects a weak result without a suggested fix",
    run: () => {
      const value = createWeakResult();
      value.suggestedFixes = [];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects a mixed result without a risky part",
    run: () => {
      const value = createMixedResult();
      value.riskyParts = [];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects a mixed result without a required fix",
    run: () => {
      const value = createMixedResult();
      value.suggestedFixes = [
        {
          target: "clarity",
          suggestion:
            "Optionally shorten the transition.",
          optional: true,
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects a strong result below 85 without an optional refinement",
    run: () => {
      const value = createStrongResult();
      value.suggestedFixes = [];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "accepts a strong result at 85 or higher without a refinement",
    run: () => {
      const value = createStrongResult();
      value.scores = {
        overall: 88,
        hook: 86,
        retentionRisk: 18,
      };
      value.suggestedFixes = [];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, true);
    },
  },
  {
    name: "rejects an invalid script type",
    run: () => {
      const value = createStrongResult();
      value.scriptType = "unknown";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects scores outside the allowed range",
    run: () => {
      const value = createStrongResult();
      value.scores = {
        overall: 101,
        hook: 82,
        retentionRisk: 22,
      };

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects an ungrounded risky excerpt",
    run: () => {
      const value = createWeakResult();
      value.riskyParts = [
        {
          excerpt:
            "This sentence does not exist in the script.",
          reason: "Invented issue.",
          severity: "high",
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects an ungrounded scene excerpt",
    run: () => {
      const value = createStrongResult();
      value.scenes = [
        {
          excerpt: "Invented scene.",
          label: "Invented",
          status: "strong",
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects risky parts in a strong result",
    run: () => {
      const value = createStrongResult();
      value.riskyParts = [
        {
          excerpt:
            "Then gently roll the skin apart.",
          reason: "Material issue.",
          severity: "high",
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects a risky scene in a strong result",
    run: () => {
      const value = createStrongResult();
      value.scenes = [
        {
          excerpt:
            "Then gently roll the skin apart.",
          label: "Problem",
          status: "risky",
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects a required fix in a strong result",
    run: () => {
      const value = createStrongResult();
      value.suggestedFixes = [
        {
          target: "clarity",
          suggestion: "Rewrite this section.",
          optional: false,
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects rewrite without a suggested hook",
    run: () => {
      const value = createWeakResult();
      value.hookDecision = "rewrite";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects a suggested hook for keep",
    run: () => {
      const value = createStrongResult();
      value.suggestedHook =
        "A different hook that should not be present.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects an invented number in a suggested hook",
    run: () => {
      const value = createWeakResult();
      value.hookDecision = "rewrite";
      value.suggestedHook =
        "This method removes super glue in 30 seconds.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects more than two risky parts",
    run: () => {
      const value = createWeakResult();
      value.riskyParts = [
        {
          excerpt:
            "If super glue gets stuck to your skin, do not pull it apart.",
          reason: "Issue one.",
          severity: "low",
        },
        {
          excerpt:
            "First, soak the area in warm soapy water.",
          reason: "Issue two.",
          severity: "medium",
        },
        {
          excerpt:
            "Then gently roll the skin apart.",
          reason: "Issue three.",
          severity: "high",
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects more than two suggested fixes",
    run: () => {
      const value = createWeakResult();
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion: "Fix one.",
          optional: false,
        },
        {
          target: "middle",
          suggestion: "Fix two.",
          optional: false,
        },
        {
          target: "payoff",
          suggestion: "Fix three.",
          optional: false,
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
];

let passed = 0;

for (const test of tests) {
  try {
    test.run();
    passed += 1;
    console.log(`PASS — ${test.name}`);
  } catch (error) {
    console.error(`FAIL — ${test.name}`);
    throw error;
  }
}

console.log(
  `\nAnalysis V2 validation tests: ${passed}/${tests.length} passed`
);
