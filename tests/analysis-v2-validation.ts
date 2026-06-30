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
    hookDecision: "keep",
    hookAssessment:
      "The opening clearly names the problem and gives an immediate warning.",
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
    name: "normalizes refine to keep when all material issues are outside the opening",
    run: () => {
      const value = createMixedResult();
      value.hookDecision = "refine";
      value.hookAssessment =
        "The opening is clear, but the instruction sequence needs a better transition.";
      value.suggestedHook =
        "When super glue sticks to your skin, avoid pulling it apart.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.ok, true);

      assert.equal(result.value.hookDecision, "keep");
      assert.equal(result.value.suggestedHook, undefined);
    },
  },
  {
    name: "preserves refine when a hook-target fix provides opening evidence",
    run: () => {
      const value = createMixedResult();
      value.hookDecision = "refine";
      value.hookAssessment =
        "The opening is useful but can state the warning more directly.";
      value.suggestedHook =
        "If super glue sticks to your skin, never pull it apart.";
      value.suggestedFixes = [
        {
          target: "clarity",
          suggestion:
            "Connect the rolling instruction directly to the soaking step.",
          optional: false,
        },
        {
          target: "hook",
          suggestion:
            "State the warning more directly so the opening is immediately actionable.",
          optional: false,
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.ok, true);

      assert.equal(result.value.hookDecision, "refine");
      assert.equal(
        result.value.suggestedHook,
        "If super glue sticks to your skin, never pull it apart."
      );
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

  {
    name: "rejects keep when a required hook fix proves a material opening issue",
    run: () => {
      const value = createMixedResult();

      value.hookDecision = "keep";
      value.hookAssessment =
        "The opening is too generic and delays the concrete warning.";
      value.suggestedHook = undefined;
      value.riskyParts = [
        {
          excerpt:
            "If super glue gets stuck to your skin, do not pull it apart.",
          reason:
            "The opening needs a more direct and specific warning.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Rewrite the opening as a direct, specific warning.",
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
    name: "rejects an invented named entity in a suggested hook",
    run: () => {
      const value = createWeakResult();

      value.hookDecision = "rewrite";
      value.suggestedHook =
        "NASA says this household method dissolves super glue.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects an invented capitalized name at the start of a suggested hook",
    run: () => {
      const value = createWeakResult();

      value.hookDecision = "rewrite";
      value.suggestedHook =
        "Ronaldo says this household method dissolves super glue.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects unsupported ensuring claim in a suggested hook",
    run: () => {
      const value = createWeakResult();

      value.hookDecision = "rewrite";
      value.suggestedHook =
        "This method works by ensuring the glue separates safely.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },

  {
    name: "rejects unsupported ensure claim in a suggested hook",
    run: () => {
      const value = createWeakResult();

      value.hookDecision = "rewrite";
      value.suggestedHook =
        "This household method ensures the glue comes apart safely.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },

  {
    name: "rejects unsupported claim strengthening in a suggested hook",
    run: () => {
      const value = createWeakResult();

      value.hookDecision = "rewrite";
      value.suggestedHook =
        "This household method completely dissolves super glue.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "accepts grounded named entities and claim strength already present in the script",
    run: () => {
      const groundedScript =
        "NASA tested this household method on dried super glue. The report says it completely loosens the glue after soaking and ensures it separates safely.";

      const value = createMixedResult();

      value.hookDecision = "rewrite";
      value.hookAssessment =
        "The opening contains the evidence but delays the useful result.";
      value.suggestedHook =
        "NASA tested a method that completely loosens dried super glue and ensures it separates safely.";
      value.riskyParts = [
        {
          excerpt:
            "NASA tested this household method on dried super glue.",
          reason:
            "The opening mentions the test but delays the concrete result.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Move the documented result into the opening.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt:
            "NASA tested this household method on dried super glue.",
          label: "Delayed result",
          status: "risky",
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        groundedScript
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.value.hookDecision, "rewrite");
      assert.equal(
        result.value.suggestedHook,
        "NASA tested a method that completely loosens dried super glue and ensures it separates safely."
      );
    },
  },

  {
    name: "preserves refine when a risky excerpt partially overlaps the opening window",
    run: () => {
      const openingWords = Array.from(
        { length: 45 },
        (_, index) => `word${index + 1}`
      );
      const overlapScript =
        `${openingWords.join(" ")}.`;
      const overlapExcerpt = openingWords
        .slice(29, 40)
        .join(" ");

      const value = createMixedResult();

      value.hookDecision = "refine";
      value.hookAssessment =
        "The opening contains a long setup that should be tightened.";
      value.suggestedHook =
        "Lead with the concrete warning before the long setup.";
      value.riskyParts = [
        {
          excerpt: overlapExcerpt,
          reason:
            "This part of the opening extends the setup before the main point.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "clarity",
          suggestion:
            "Shorten the overlapping setup so the main point arrives earlier.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt: overlapExcerpt,
          label: "Extended opening setup",
          status: "risky",
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        overlapScript
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.value.hookDecision, "refine");
      assert.equal(
        result.value.suggestedHook,
        "Lead with the concrete warning before the long setup."
      );
    },
  },

  {
    name: "rejects a rewrite for generic advice with no concrete anchor",
    run: () => {
      const abstractScript =
        "Life is full of choices. Some choices are good, and some choices are bad. It is up to you to decide which path to take.";

      const value = createWeakResult();

      value.scriptType = "generic_advice";
      value.verdict = "weak";
      value.scores = {
        overall: 35,
        hook: 30,
        retentionRisk: 70,
      };
      value.hookDecision = "rewrite";
      value.hookAssessment =
        "The opening is generic and the script lacks concrete examples, mechanisms, or observable results.";
      value.suggestedHook =
        "Every choice you make shapes your future. Here is why your decisions matter more than you think.";
      value.riskyParts = [
        {
          excerpt: "Life is full of choices.",
          reason:
            "The opening is generic and does not provide a concrete premise or observable result.",
          severity: "high",
        },
        {
          excerpt:
            "Some choices are good, and some choices are bad.",
          reason:
            "This advice remains abstract without a concrete example, mechanism, or specific situation.",
          severity: "high",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Add concrete source material before attempting to rewrite the hook.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt: "Life is full of choices.",
          label: "Generic opening",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "The script is too abstract to support a grounded hook rewrite.";

      const result = validateAnalysisV2Result(
        value,
        abstractScript
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "accepts diagnostic for generic advice with no concrete anchor",
    run: () => {
      const abstractScript =
        "Life is full of choices. Some choices are good, and some choices are bad. It is up to you to decide which path to take.";

      const value = createWeakResult();

      value.scriptType = "generic_advice";
      value.verdict = "weak";
      value.scores = {
        overall: 35,
        hook: 30,
        retentionRisk: 70,
      };
      value.hookDecision = "diagnostic";
      value.hookAssessment =
        "The script lacks enough concrete material for a grounded hook rewrite.";
      value.suggestedHook = undefined;
      value.riskyParts = [
        {
          excerpt: "Life is full of choices.",
          reason:
            "The opening is generic and does not provide a concrete premise or observable result.",
          severity: "high",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Add a concrete example, mechanism, named situation, number, or observable result before rewriting the hook.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt: "Life is full of choices.",
          label: "Generic opening",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "The script needs concrete source material before a grounded hook can be written.";

      const result = validateAnalysisV2Result(
        value,
        abstractScript
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.value.hookDecision, "diagnostic");
      assert.equal(result.value.suggestedHook, undefined);
    },
  },
  {
    name: "allows rewrite for generic advice with a concrete numeric anchor",
    run: () => {
      const concreteAdviceScript =
        "Track every purchase for 7 days, then compare the total with your weekly budget. The gap shows where your spending is leaking.";

      const value = createMixedResult();

      value.scriptType = "generic_advice";
      value.verdict = "mixed";
      value.scores = {
        overall: 65,
        hook: 55,
        retentionRisk: 40,
      };
      value.hookDecision = "rewrite";
      value.hookAssessment =
        "The script contains a concrete seven-day tracking exercise, but the opening can lead with that specific action.";
      value.suggestedHook =
        "Track every purchase for 7 days to see exactly where your budget is leaking.";
      value.riskyParts = [
        {
          excerpt:
            "Track every purchase for 7 days, then compare the total with your weekly budget.",
          reason:
            "The concrete exercise is useful, but the outcome can be stated more directly in the opening.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Lead with the seven-day tracking exercise and its observable budgeting result.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt:
            "Track every purchase for 7 days, then compare the total with your weekly budget.",
          label: "Concrete exercise",
          status: "risky",
        },
        {
          excerpt:
            "The gap shows where your spending is leaking.",
          label: "Observable result",
          status: "strong",
        },
      ];
      value.mainTakeaway =
        "The script has concrete material but needs a more direct opening.";

      const result = validateAnalysisV2Result(
        value,
        concreteAdviceScript
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.value.hookDecision, "rewrite");
    },
  },
  {
    name: "rejects a strong result with generic first-sentence filler",
    run: () => {
      const genericOpeningScript =
        "Something interesting happens before a spacecraft returns to Earth. NASA heats pieces of its heat shield to extreme temperatures to test whether they can survive reentry. Engineers then inspect the material for cracks, erosion, and weak spots. Those tests help reveal problems before the spacecraft faces the real atmosphere.";

      const value = createStrongResult();

      value.scriptType = "explanation";
      value.verdict = "strong";
      value.scores = {
        overall: 85,
        hook: 80,
        retentionRisk: 20,
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The opening is clear and specific.";
      value.riskyParts = [];
      value.suggestedFixes = [];
      value.scenes = [
        {
          excerpt:
            "Something interesting happens before a spacecraft returns to Earth.",
          label: "Opening",
          status: "strong",
        },
        {
          excerpt:
            "NASA heats pieces of its heat shield to extreme temperatures to test whether they can survive reentry.",
          label: "Testing process",
          status: "strong",
        },
        {
          excerpt:
            "Those tests help reveal problems before the spacecraft faces the real atmosphere.",
          label: "Payoff",
          status: "strong",
        },
      ];
      value.mainTakeaway =
        "The script is structurally strong with a clear and specific opening.";

      const result = validateAnalysisV2Result(
        value,
        genericOpeningScript
      );

      assert.equal(result.ok, false);
    },
  },

  {
    name: "rejects generic filler without required hook feedback",
    run: () => {
      const genericOpeningScript =
        "Something interesting happens before a spacecraft returns to Earth. NASA heats pieces of its heat shield to extreme temperatures to test whether they can survive reentry. Engineers inspect the material for cracks.";

      const value = createMixedResult();

      value.scriptType = "explanation";
      value.scores = {
        overall: 75,
        hook: 80,
        retentionRisk: 35,
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The opening is clear enough.";
      value.riskyParts = [
        {
          excerpt:
            "Something interesting happens before a spacecraft returns to Earth.",
          reason:
            "The opening delays the concrete NASA testing premise.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "clarity",
          suggestion:
            "Make the opening more specific.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt:
            "Something interesting happens before a spacecraft returns to Earth.",
          label: "Generic opening",
          status: "risky",
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        genericOpeningScript
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "accepts generic filler with complete grounded hook feedback",
    run: () => {
      const genericOpeningScript =
        "Something interesting happens before a spacecraft returns to Earth. NASA heats pieces of its heat shield to extreme temperatures to test whether they can survive reentry. Engineers inspect the material for cracks.";

      const value = createMixedResult();

      value.scriptType = "explanation";
      value.scores = {
        overall: 75,
        hook: 65,
        retentionRisk: 35,
      };
      value.hookDecision = "refine";
      value.hookAssessment =
        "The first sentence is generic and delays the concrete NASA testing premise.";
      value.suggestedHook =
        "Before reentry, NASA heats heat-shield pieces to test whether they can survive.";
      value.riskyParts = [
        {
          excerpt:
            "Something interesting happens before a spacecraft returns to Earth.",
          reason:
            "The opening delays the concrete NASA testing premise.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Replace the generic first sentence with the concrete NASA testing premise.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt:
            "Something interesting happens before a spacecraft returns to Earth.",
          label: "Generic opening",
          status: "risky",
        },
        {
          excerpt:
            "NASA heats pieces of its heat shield to extreme temperatures to test whether they can survive reentry.",
          label: "Concrete premise",
          status: "strong",
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        genericOpeningScript
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.value.hookDecision, "refine");
    },
  },
  {
    name: "rejects keep when a specific hidden setting promise is not revealed",
    run: () => {
      const promiseScript =
        "Your phone battery dies faster because of one hidden setting. Most people never turn it off. It runs quietly in the background. Once you understand it, your phone usage makes more sense.";

      const value = createMixedResult();

      value.scriptType = "explanation";
      value.verdict = "mixed";
      value.scores = {
        overall: 70,
        hook: 80,
        retentionRisk: 40,
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The hook is clear and specific, promising a hidden phone setting that affects battery life.";
      value.riskyParts = [
        {
          excerpt:
            "Once you understand it, your phone usage makes more sense.",
          reason:
            "The payoff is vague because it never names the promised hidden setting.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Name the hidden setting and explain how turning it off changes battery usage.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt:
            "Your phone battery dies faster because of one hidden setting.",
          label: "Specific promise",
          status: "risky",
        },
        {
          excerpt:
            "Once you understand it, your phone usage makes more sense.",
          label: "Unrevealed payoff",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "The script makes a specific promise but does not reveal the hidden setting.";

      const result = validateAnalysisV2Result(
        value,
        promiseScript
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects comparison content classified as list escalation",
    run: () => {
      const comparisonScript =
        "We tested four budget laptops side by side. The first lasted four hours. The second lasted six. The third reached eight. The final laptop lasted thirteen hours and became the clear winner.";

      const value = createStrongResult();

      value.scriptType = "list_escalation";
      value.hookAssessment =
        "The opening establishes a side-by-side laptop comparison.";
      value.scenes = [
        {
          excerpt:
            "We tested four budget laptops side by side.",
          label: "Comparison setup",
          status: "strong",
        },
        {
          excerpt:
            "The final laptop lasted thirteen hours and became the clear winner.",
          label: "Winner",
          status: "strong",
        },
      ];
      value.mainTakeaway =
        "The script compares laptops using one shared battery-life measurement.";

      const result = validateAnalysisV2Result(
        value,
        comparisonScript
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects parallel advice classified as list escalation",
    run: () => {
      const adviceScript =
        "These are three overlooked productivity habits. Put your phone in another room. Write down one priority. Then work for 25 minutes without stopping.";

      const value = createStrongResult();

      value.scriptType = "list_escalation";
      value.hookAssessment =
        "The opening introduces three productivity habits.";
      value.scenes = [
        {
          excerpt:
            "These are three overlooked productivity habits.",
          label: "Advice-list setup",
          status: "strong",
        },
        {
          excerpt:
            "Put your phone in another room.",
          label: "First habit",
          status: "strong",
        },
        {
          excerpt:
            "Then work for 25 minutes without stopping.",
          label: "Third habit",
          status: "strong",
        },
      ];
      value.mainTakeaway =
        "The script presents three parallel productivity habits.";

      const result = validateAnalysisV2Result(
        value,
        adviceScript
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "allows a genuine escalating sequence",
    run: () => {
      const escalationScript =
        "He first survived a car crash. Then he survived a plane crash in the mountains. Finally, he survived a shipwreck alone for seven days, the most extreme event of all.";

      const value = createStrongResult();

      value.scriptType = "list_escalation";
      value.hookAssessment =
        "The opening begins a sequence of increasingly extreme survival events.";
      value.scenes = [
        {
          excerpt:
            "He first survived a car crash.",
          label: "Initial event",
          status: "strong",
        },
        {
          excerpt:
            "Then he survived a plane crash in the mountains.",
          label: "Higher-stakes event",
          status: "strong",
        },
        {
          excerpt:
            "Finally, he survived a shipwreck alone for seven days, the most extreme event of all.",
          label: "Most extreme event",
          status: "strong",
        },
      ];
      value.mainTakeaway =
        "The events demonstrably escalate in danger and severity.";

      const result = validateAnalysisV2Result(
        value,
        escalationScript
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(
        result.value.scriptType,
        "list_escalation"
      );
    },
  },
  {
    name: "accepts a concrete first sentence beginning with something",
    run: () => {
      const concreteScript =
        "Something inside the heat shield expands when temperatures rise. Engineers measure that expansion before approving the material. The test reveals whether the shield can survive reentry.";

      const value = createStrongResult();

      value.scriptType = "explanation";
      value.verdict = "strong";
      value.scores = {
        overall: 88,
        hook: 82,
        retentionRisk: 20,
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The opening immediately identifies a concrete physical mechanism.";
      value.riskyParts = [];
      value.suggestedFixes = [];
      value.scenes = [
        {
          excerpt:
            "Something inside the heat shield expands when temperatures rise.",
          label: "Physical mechanism",
          status: "strong",
        },
        {
          excerpt:
            "Engineers measure that expansion before approving the material.",
          label: "Testing step",
          status: "strong",
        },
        {
          excerpt:
            "The test reveals whether the shield can survive reentry.",
          label: "Payoff",
          status: "strong",
        },
      ];
      value.mainTakeaway =
        "The explanation begins with a concrete mechanism and resolves it clearly.";

      const result = validateAnalysisV2Result(
        value,
        concreteScript
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.value.verdict, "strong");
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
