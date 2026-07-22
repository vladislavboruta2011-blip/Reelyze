import assert from "node:assert/strict";

import { ANALYSIS_V2_HOOK_STRONG_THRESHOLD } from "../engine/analysis-v2-schema";
import {
  normalizeAnalysisV2CompleteCausalExplanationModelResult,
  parseAnalysisV2Json,
  repairAnalysisV2MainTakeawayForScoreBreakdown,
  validateAnalysisV2Input,
  validateAnalysisV2ModelResult,
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

function createComponentModelResult(): Record<string, unknown> {
  const result = createStrongResult();

  delete result.scores;

  result.scoreComponents = {
    overall: {
      premiseAppeal: 21,
      openingPromise: 21,
      progression: 21,
      payoff: 21,
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
  result.suggestedHook = null;

  return result;
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
      name: "accepts a valid strong result without a score breakdown",
      run: () => {
        const result = validateAnalysisV2Result(
          createStrongResult(),
          script
        );

        assert.equal(result.ok, true);

        if (result.ok) {
          assert.equal(
            result.value.scoreBreakdown,
            undefined
          );
        }
      },
    },
    {
      name: "derives public scores and breakdown from model score components",
      run: () => {
        const modelResult =
          createComponentModelResult();

        const result = validateAnalysisV2ModelResult(
          modelResult,
          script
        );

        assert.equal(result.ok, true);

        if (result.ok) {
          assert.deepEqual(result.value.scores, {
            overall: 84,
            hook: 82,
            retentionRisk: 22,
          });
          assert.deepEqual(
            result.value.scoreBreakdown,
            modelResult.scoreComponents
          );
          assert.equal(
            "scoreComponents" in result.value,
            false
          );
        }
      },
    },
    {
      name: "rejects a score breakdown whose totals do not match the public scores",
      run: () => {
        const modelValidation =
          validateAnalysisV2ModelResult(
            createComponentModelResult(),
            script
          );

        if (!modelValidation.ok) {
          throw new Error(
            modelValidation.reason
          );
        }

        const breakdown =
          modelValidation.value.scoreBreakdown;

        if (!breakdown) {
          throw new Error(
            "Expected a score breakdown."
          );
        }

        const invalidResult = {
          ...modelValidation.value,
          scoreBreakdown: {
            ...breakdown,
            overall: {
              ...breakdown.overall,
              premiseAppeal:
                breakdown.overall.premiseAppeal - 1,
            },
          },
        };

        const result = validateAnalysisV2Result(
          invalidResult,
          script
        );

        assert.equal(result.ok, false);
      },
    },
    {
      name: "rejects a below-80 breakdown paired with a blanket no-problem takeaway",
      run: () => {
        const modelResult =
          createComponentModelResult();
        const scoreComponents =
          modelResult.scoreComponents as {
            overall: Record<string, number>;
          };

        scoreComponents.overall = {
          premiseAppeal: 10,
          openingPromise: 21,
          progression: 21,
          payoff: 21,
        };
        modelResult.mainTakeaway =
          "The script has no material Shorts performance problems.";

        const result =
          validateAnalysisV2ModelResult(
            modelResult,
            script
          );

        assert.equal(result.ok, false);
      },
    },
    {
      name: "rejects a below-80 takeaway that ignores the lowest overall component",
      run: () => {
        const modelResult =
          createComponentModelResult();
        const scoreComponents =
          modelResult.scoreComponents as {
            overall: Record<string, number>;
          };

        scoreComponents.overall = {
          premiseAppeal: 10,
          openingPromise: 21,
          progression: 21,
          payoff: 21,
        };
        modelResult.mainTakeaway =
          "The script is clear and structurally polished throughout.";

        const result =
          validateAnalysisV2ModelResult(
            modelResult,
            script
          );

        assert.equal(result.ok, false);
      },
    },
    {
      name: "repairs a below-80 takeaway that ignores the lowest overall component",
      run: () => {
        const modelResult =
          createComponentModelResult();
        const scoreComponents =
          modelResult.scoreComponents as {
            overall: Record<string, number>;
          };

        scoreComponents.overall = {
          premiseAppeal: 10,
          openingPromise: 21,
          progression: 21,
          payoff: 21,
        };
        modelResult.mainTakeaway =
          "The script is clear and structurally polished throughout.";

        const repaired =
          repairAnalysisV2MainTakeawayForScoreBreakdown(
            modelResult
          );

        assert.notEqual(repaired, null);

        const result =
          validateAnalysisV2ModelResult(
            repaired,
            script
          );

        if (!result.ok) {
          throw new Error(result.reason);
        }

        assert.equal(
          result.value.scores.overall,
          73
        );
        assert.match(
          result.value.mainTakeaway,
          /premise appeal/i
        );
        assert.match(
          result.value.mainTakeaway,
          /limits the overall score/i
        );
      },
    },
    {
      // Existing tie contract (getLowestOverallComponentKeys returns every
      // key tied for lowest; mainTakeawayExplainsLowestOverallComponent
      // accepts naming ANY one of them via .some()) — not a new policy,
      // just regression coverage for behavior that already exists.
      name: "tie: naming only one of two tied-lowest components is enough to pass validation",
      run: () => {
        const modelResult = createComponentModelResult();
        const scoreComponents = modelResult.scoreComponents as {
          overall: Record<string, number>;
        };

        scoreComponents.overall = {
          premiseAppeal: 15,
          openingPromise: 20,
          progression: 21,
          payoff: 15,
        };
        modelResult.mainTakeaway =
          "The script is clear, but its premise appeal limits the overall score because the idea has limited audience pull.";

        const result = validateAnalysisV2ModelResult(
          modelResult,
          script
        );

        if (!result.ok) {
          throw new Error(result.reason);
        }
      },
    },
    {
      name: "tie: naming neither of two tied-lowest components still fails validation",
      run: () => {
        const modelResult = createComponentModelResult();
        const scoreComponents = modelResult.scoreComponents as {
          overall: Record<string, number>;
        };

        scoreComponents.overall = {
          premiseAppeal: 15,
          openingPromise: 20,
          progression: 21,
          payoff: 15,
        };
        modelResult.mainTakeaway =
          "The script is clear and mostly works well.";

        const result = validateAnalysisV2ModelResult(
          modelResult,
          script
        );

        assert.equal(result.ok, false);
      },
    },
    {
      name: "tie: repair joins both tied-lowest component labels together instead of picking just one",
      run: () => {
        const modelResult = createComponentModelResult();
        const scoreComponents = modelResult.scoreComponents as {
          overall: Record<string, number>;
        };

        scoreComponents.overall = {
          premiseAppeal: 15,
          openingPromise: 20,
          progression: 21,
          payoff: 15,
        };
        modelResult.mainTakeaway =
          "The script is clear and mostly works well.";

        const repaired =
          repairAnalysisV2MainTakeawayForScoreBreakdown(
            modelResult
          );

        assert.notEqual(repaired, null);

        const result = validateAnalysisV2ModelResult(
          repaired,
          script
        );

        if (!result.ok) {
          throw new Error(result.reason);
        }

        assert.match(
          result.value.mainTakeaway,
          /premise appeal/i
        );
        assert.match(
          result.value.mainTakeaway,
          /payoff/i
        );
      },
    },
    {
      name: "ru: accepts a below-80 Russian takeaway that explains the lowest overall component in Russian",
      run: () => {
        // This is the actual root cause behind English fallback text
        // appearing in RU analyses: an English-only regex check used to
        // reject any well-formed Russian mainTakeaway outright, forcing
        // the (also English) repair template to run on every below-80 RU
        // script. A well-formed Russian explanation must now pass.
        const modelResult = createComponentModelResult();
        const scoreComponents = modelResult.scoreComponents as {
          overall: Record<string, number>;
        };

        scoreComponents.overall = {
          premiseAppeal: 10,
          openingPromise: 21,
          progression: 21,
          payoff: 21,
        };
        modelResult.mainTakeaway =
          "Сценарий понятен, но привлекательность идеи слабо привлекает аудиторию, что ограничивает общую оценку.";

        const result = validateAnalysisV2ModelResult(
          modelResult,
          script,
          "ru"
        );

        if (!result.ok) {
          throw new Error(result.reason);
        }
      },
    },
    {
      name: "ru: still rejects a below-80 Russian takeaway that ignores the lowest overall component",
      run: () => {
        const modelResult = createComponentModelResult();
        const scoreComponents = modelResult.scoreComponents as {
          overall: Record<string, number>;
        };

        scoreComponents.overall = {
          premiseAppeal: 10,
          openingPromise: 21,
          progression: 21,
          payoff: 21,
        };
        modelResult.mainTakeaway =
          "Сценарий понятен и структурно выдержан на всём протяжении.";

        const result = validateAnalysisV2ModelResult(
          modelResult,
          script,
          "ru"
        );

        assert.equal(result.ok, false);
      },
    },
    {
      name: "ru: repairs a below-80 takeaway in Russian instead of English",
      run: () => {
        const modelResult = createComponentModelResult();
        const scoreComponents = modelResult.scoreComponents as {
          overall: Record<string, number>;
        };

        scoreComponents.overall = {
          premiseAppeal: 10,
          openingPromise: 21,
          progression: 21,
          payoff: 21,
        };
        modelResult.mainTakeaway =
          "The script is clear and structurally polished throughout.";

        const repaired = repairAnalysisV2MainTakeawayForScoreBreakdown(
          modelResult,
          "ru"
        );

        assert.notEqual(repaired, null);

        const result = validateAnalysisV2ModelResult(
          repaired,
          script,
          "ru"
        );

        if (!result.ok) {
          throw new Error(result.reason);
        }

        assert.doesNotMatch(
          result.value.mainTakeaway,
          /[a-zA-Z]{4,}/
        );
        assert.match(
          result.value.mainTakeaway,
          /привлекательность идеи/i
        );
        assert.match(
          result.value.mainTakeaway,
          /ограничивает общую оценку/i
        );
      },
    },
    {
      name: "en flow is unchanged: repair still produces English by default",
      run: () => {
        const modelResult = createComponentModelResult();
        const scoreComponents = modelResult.scoreComponents as {
          overall: Record<string, number>;
        };

        scoreComponents.overall = {
          premiseAppeal: 10,
          openingPromise: 21,
          progression: 21,
          payoff: 21,
        };
        modelResult.mainTakeaway =
          "The script is clear and structurally polished throughout.";

        const repaired =
          repairAnalysisV2MainTakeawayForScoreBreakdown(
            modelResult
          );

        assert.notEqual(repaired, null);

        const result = validateAnalysisV2ModelResult(
          repaired,
          script
        );

        if (!result.ok) {
          throw new Error(result.reason);
        }

        assert.match(
          result.value.mainTakeaway,
          /premise appeal/i
        );
      },
    },
    {
      name: "accepts a below-80 takeaway that explains the lowest overall component",
      run: () => {
        const modelResult =
          createComponentModelResult();
        const scoreComponents =
          modelResult.scoreComponents as {
            overall: Record<string, number>;
          };

        scoreComponents.overall = {
          premiseAppeal: 10,
          openingPromise: 21,
          progression: 21,
          payoff: 21,
        };
        modelResult.mainTakeaway =
          "The main limitation is limited audience pull: the premise offers only a modest viewer reward despite clear execution.";

        const result =
          validateAnalysisV2ModelResult(
            modelResult,
            script
          );

        if (!result.ok) {
          throw new Error(result.reason);
        }

        assert.equal(
          result.value.scores.overall,
          73
        );
      },
    },
  {
    name: "rejects an out-of-range score component",
    run: () => {
      const modelResult =
        createComponentModelResult();
      const scoreComponents =
        modelResult.scoreComponents as {
          overall: Record<string, number>;
        };

      scoreComponents.overall.premiseAppeal = 26;

      const result = validateAnalysisV2ModelResult(
        modelResult,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects a missing score component",
    run: () => {
      const modelResult =
        createComponentModelResult();
      const scoreComponents =
        modelResult.scoreComponents as {
          hook: Record<string, number>;
        };

      delete scoreComponents.hook.viewerPull;

      const result = validateAnalysisV2ModelResult(
        modelResult,
        script
      );

      assert.equal(result.ok, false);
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
    name: "rejects an external-consequence fix for a resolved outcome narrative",
    run: () => {
      const resolvedOutcomeScript =
        "A research drone disappeared during a storm. Search teams followed its last signal into a canyon. The battery was almost dead, and the tracker stopped updating. After six hours, the drone was found intact.";

      const value = createMixedResult();

      value.scriptType = "narrative_event";
      value.scores = {
        overall: 63,
        hook: 80,
        retentionRisk: 40,
      };
      value.riskyParts = [
        {
          excerpt:
            "After six hours, the drone was found intact.",
          reason:
            "The payoff is underwhelming because it lacks a broader consequence or explanation of significance.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Add an external consequence or implication that explains why this matters.",
          optional: false,
        },
      ];
      value.scenes = [
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
      ];
      value.mainTakeaway =
        "The chronology escalates clearly, but the resolved outcome supposedly needs another consequence.";

      const result = validateAnalysisV2Result(
        value,
        resolvedOutcomeScript
      );

      assert.equal(result.ok, false);

      if (result.ok) {
        throw new Error(
          "Expected the external-consequence payoff critique to be rejected."
        );
      }

      assert.match(
        result.reason,
        /resolved outcome narrative cannot be treated as missing payoff/i
      );
    },
  },
  {
    name: "rejects a paraphrased significance fix for a resolved outcome narrative",
    run: () => {
      const resolvedOutcomeScript =
        "A research drone disappeared during a storm. Search teams followed its last signal into a canyon. The battery was almost dead, and the tracker stopped updating. After six hours, the drone was found intact.";

      const value = createMixedResult();

      value.scriptType = "narrative_event";
      value.scores = {
        overall: 60,
        hook: 75,
        retentionRisk: 45,
      };
      value.riskyParts = [
        {
          excerpt:
            "After six hours, the drone was found intact.",
          reason:
            "The script ends with a minimal payoff that lacks a clear explanation of the significance or consequence of this resolved outcome, limiting viewer reward.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Add a contrast, example, or implication that strengthens why this found result matters in the context of the search.",
          optional: false,
        },
      ];
      value.scenes = [
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
      ];
      value.mainTakeaway =
        "The chronology escalates clearly, but the resolved ending supposedly needs another implication.";

      const result = validateAnalysisV2Result(
        value,
        resolvedOutcomeScript
      );

      assert.equal(result.ok, false);

      if (result.ok) {
        throw new Error(
          "Expected the paraphrased significance fix to be rejected."
        );
      }

      assert.match(
        result.reason,
        /resolved outcome narrative cannot be treated as missing payoff/i
      );
    },
  },
  {
    name: "normalizes repeated missing-depth feedback for a complete auto-caption explanation",
    run: () => {
      const autoCaptionScript =
        "so basically [music] your body releases adrenaline when it senses danger and that is why your hands shake [music] the response normally fades after the danger has passed";
      const value =
        createComponentModelResult();

      value.scriptType = "explanation";
      value.verdict = "strong";
      value.scoreComponents = {
        overall: {
          premiseAppeal: 12,
          openingPromise: 12,
          progression: 13,
          payoff: 12,
        },
        hook: {
          immediacy: 16,
          specificity: 16,
          viewerPull: 16,
          deliveryAlignment: 15,
        },
        retentionRisk: {
          openingFriction: 13,
          progressionRisk: 13,
          predictabilityRisk: 14,
          payoffRisk: 13,
        },
      };
      value.hookDecision = "refine";
      value.hookAssessment =
        "The opening filler reduces immediacy, and the explanation needs more detail.";
      value.suggestedHook =
        "Your body releases adrenaline when it senses danger, causing your hands to shake.";
      value.riskyParts = [
        {
          excerpt: autoCaptionScript,
          reason:
            "The explanation lacks a deeper mechanism and additional consequences.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "middle",
          suggestion:
            "Add more detailed explanation or consequences to improve retention.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt: autoCaptionScript,
          label:
            "Incomplete explanation needing more detail",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "Adding more detailed explanation or consequences would improve retention.";

      const normalized =
        normalizeAnalysisV2CompleteCausalExplanationModelResult(
          value,
          autoCaptionScript
        );

      assert.notEqual(normalized, null);

      const result =
        validateAnalysisV2ModelResult(
          normalized,
          autoCaptionScript
        );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(
        result.value.verdict,
        "mixed"
      );
      assert.equal(
        result.value.scores.overall,
        49
      );
      assert.equal(
        result.value.riskyParts.length,
        1
      );
      assert.equal(
        result.value.riskyParts[0]?.excerpt,
        "so basically"
      );
      assert.equal(
        result.value.suggestedFixes.length,
        1
      );
      assert.equal(
        result.value.suggestedFixes[0]?.target,
        "hook"
      );
      assert.equal(
        result.value.scenes[0]?.status,
        "average"
      );
      assert.equal(
        result.value.mainTakeaway,
        "The causal explanation is complete; only the opening filler limits immediacy."
      );
    },
  },
  {
    name: "ru: causal-explanation normalization produces Russian hookAssessment/reason/suggestion/mainTakeaway, not English",
    run: () => {
      const CYRILLIC = /[Ѐ-ӿ]/;
      const autoCaptionScript =
        "so basically [music] your body releases adrenaline when it senses danger and that is why your hands shake [music] the response normally fades after the danger has passed";
      const value = createComponentModelResult();

      value.scriptType = "explanation";
      value.verdict = "strong";
      value.scoreComponents = {
        overall: {
          premiseAppeal: 12,
          openingPromise: 12,
          progression: 13,
          payoff: 12,
        },
        hook: {
          immediacy: 16,
          specificity: 16,
          viewerPull: 16,
          deliveryAlignment: 15,
        },
        retentionRisk: {
          openingFriction: 13,
          progressionRisk: 13,
          predictabilityRisk: 14,
          payoffRisk: 13,
        },
      };
      value.hookDecision = "refine";
      value.hookAssessment =
        "The opening filler reduces immediacy, and the explanation needs more detail.";
      value.suggestedHook =
        "Your body releases adrenaline when it senses danger, causing your hands to shake.";
      value.riskyParts = [
        {
          excerpt: autoCaptionScript,
          reason:
            "The explanation lacks a deeper mechanism and additional consequences.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "middle",
          suggestion:
            "Add more detailed explanation or consequences to improve retention.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt: autoCaptionScript,
          label: "Incomplete explanation needing more detail",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "Adding more detailed explanation or consequences would improve retention.";

      const normalized =
        normalizeAnalysisV2CompleteCausalExplanationModelResult(
          value,
          autoCaptionScript,
          "ru"
        );

      assert.notEqual(normalized, null);

      const result = validateAnalysisV2ModelResult(
        normalized,
        autoCaptionScript,
        "ru"
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      // Enums/technical values stay exactly as before — locale never
      // touches them.
      assert.equal(result.value.verdict, "mixed");
      assert.equal(result.value.scores.overall, 49);
      assert.equal(result.value.suggestedFixes[0]?.target, "hook");
      assert.equal(result.value.scenes[0]?.status, "average");

      // The original script's exact excerpt is never translated.
      assert.equal(
        result.value.riskyParts[0]?.excerpt,
        "so basically"
      );

      // But every user-facing prose field is now Russian, not English.
      assert.match(result.value.hookAssessment, CYRILLIC);
      assert.match(
        result.value.riskyParts[0]?.reason ?? "",
        CYRILLIC
      );
      assert.match(
        result.value.suggestedFixes[0]?.suggestion ?? "",
        CYRILLIC
      );
      assert.match(result.value.mainTakeaway, CYRILLIC);
    },
  },
  {
    name: "rejects missing-depth criticism in any feedback field for a complete auto-caption explanation",
    run: () => {
      const autoCaptionScript =
        "so basically [music] your body releases adrenaline when it senses danger and that is why your hands shake [music] the response normally fades after the danger has passed";

      const createValidAutoCaptionResult =
        (): Record<string, unknown> => {
          const value = createMixedResult();

          value.scriptType = "explanation";
          value.scores = {
            overall: 47,
            hook: 60,
            retentionRisk: 55,
          };
          value.hookDecision = "refine";
          value.hookAssessment =
            "The opening filler delays the otherwise complete causal explanation.";
          value.suggestedHook =
            "Your body releases adrenaline when it senses danger, causing your hands to shake.";
          value.riskyParts = [
            {
              excerpt: "so basically",
              reason:
                "Generic filler delays the concrete premise and reduces hook immediacy.",
              severity: "medium",
            },
          ];
          value.suggestedFixes = [
            {
              target: "hook",
              suggestion:
                "Remove the generic filler 'so basically' and start directly with the concrete premise.",
              optional: false,
            },
          ];
          value.scenes = [
            {
              excerpt: autoCaptionScript,
              label:
                "Complete causal explanation with opening filler",
              status: "average",
            },
          ];
          value.mainTakeaway =
            "The causal explanation is complete; only the opening filler needs refinement.";

          return value;
        };

      const variants: Array<{
        name: string;
        mutate: (
          value: Record<string, unknown>
        ) => void;
      }> = [
        {
          name: "hookAssessment",
          mutate: (value) => {
            value.hookAssessment =
              "The opening is clear, but the explanation lacks a deeper mechanism.";
          },
        },
        {
          name: "mainTakeaway",
          mutate: (value) => {
            value.mainTakeaway =
              "The script offers only a minimal payoff without deeper mechanism or broader viewer reward.";
          },
        },
        {
          name: "inflected expansion request in mainTakeaway",
          mutate: (value) => {
            value.mainTakeaway =
              "Strengthening the hook and adding more detailed explanation or consequences would improve retention and engagement.";
          },
        },
        {
          name: "riskyParts reason",
          mutate: (value) => {
            value.riskyParts = [
              {
                excerpt: "so basically",
                reason:
                  "The explanation lacks deeper mechanism even though the quoted filler is the only opening issue.",
                severity: "medium",
              },
            ];
          },
        },
        {
          name: "suggestedFix suggestion",
          mutate: (value) => {
            value.suggestedFixes = [
              {
                target: "middle",
                suggestion:
                  "Expand the explanation with a deeper mechanism or additional example.",
                optional: false,
              },
            ];
          },
        },
        {
          name: "scene label",
          mutate: (value) => {
            value.scenes = [
              {
                excerpt: autoCaptionScript,
                label:
                  "Incomplete explanation without deeper mechanism",
                status: "average",
              },
            ];
          },
        },
      ];

      for (const variant of variants) {
        const value =
          createValidAutoCaptionResult();

        variant.mutate(value);

        const result =
          validateAnalysisV2Result(
            value,
            autoCaptionScript
          );

        assert.equal(
          result.ok,
          false,
          `${variant.name} should be rejected`
        );

        if (result.ok) {
          throw new Error(
            `Expected ${variant.name} missing-depth criticism to be rejected.`
          );
        }

        assert.match(
          result.reason,
          /complete causal explanation in an unpunctuated script cannot be treated as missing mechanism/i
        );
      }
    },
  },
  {
    name: "accepts an explicit statement that a complete causal explanation does not need deeper mechanism",
    run: () => {
      const autoCaptionScript =
        "so basically [music] your body releases adrenaline when it senses danger and that is why your hands shake [music] the response normally fades after the danger has passed";
      const value = createMixedResult();

      value.scriptType = "explanation";
      value.scores = {
        overall: 47,
        hook: 60,
        retentionRisk: 55,
      };
      value.hookDecision = "refine";
      value.hookAssessment =
        "The opening filler delays the otherwise complete causal explanation.";
      value.suggestedHook =
        "Your body releases adrenaline when it senses danger, causing your hands to shake.";
      value.riskyParts = [
        {
          excerpt: "so basically",
          reason:
            "Generic filler delays the concrete premise and reduces hook immediacy.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Remove the generic filler 'so basically' and start directly with the concrete premise.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt: autoCaptionScript,
          label:
            "Complete causal explanation with opening filler",
          status: "average",
        },
      ];
      value.mainTakeaway =
        "The causal explanation is complete and does not need a deeper mechanism; only the opening filler needs refinement.";

      const result =
        validateAnalysisV2Result(
          value,
          autoCaptionScript
        );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.ok, true);
    },
  },
  {
    name: "normalizes repeated missing-depth feedback to strong when unpunctuated causal scores support strong",
    run: () => {
      const noPunctuationScript =
        "your hands can shake after a stressful moment because the body releases adrenaline the hormone raises heart rate and prepares the muscles for action once the adrenaline level falls the shaking usually stops";
      const value =
        createComponentModelResult();

      value.scriptType = "explanation";
      value.verdict = "mixed";
      value.scoreComponents = {
        overall: {
          premiseAppeal: 18,
          openingPromise: 18,
          progression: 18,
          payoff: 18,
        },
        hook: {
          immediacy: 18,
          specificity: 18,
          viewerPull: 17,
          deliveryAlignment: 17,
        },
        retentionRisk: {
          openingFriction: 8,
          progressionRisk: 8,
          predictabilityRisk: 7,
          payoffRisk: 7,
        },
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The premise is clear, but the explanation supposedly needs more detail.";
      value.riskyParts = [
        {
          excerpt: noPunctuationScript,
          reason:
            "The explanation lacks deeper mechanism and additional examples.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "middle",
          suggestion:
            "Add more detailed explanation and examples.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt: noPunctuationScript,
          label:
            "Incomplete explanation needing more detail",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "The script needs a deeper mechanism.";

      const normalized =
        normalizeAnalysisV2CompleteCausalExplanationModelResult(
          value,
          noPunctuationScript
        );

      assert.notEqual(normalized, null);

      const result =
        validateAnalysisV2ModelResult(
          normalized,
          noPunctuationScript
        );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(
        result.value.verdict,
        "strong"
      );
      assert.equal(
        result.value.scores.overall,
        72
      );
      assert.equal(
        result.value.scores.retentionRisk,
        30
      );
      assert.equal(
        result.value.hookDecision,
        "keep"
      );
        assert.match(
          result.value.mainTakeaway,
          /all solid but only moderately strong/
        );
      assert.equal(
        result.value.riskyParts.length,
        0
      );
      assert.equal(
        result.value.suggestedFixes.length,
        0
      );
      assert.equal(
        result.value.scenes[0]?.status,
        "strong"
      );
    },
  },
  {
    name: "normalizes repeated missing-depth feedback to a readability issue when unpunctuated causal scores are mixed",
    run: () => {
      const noPunctuationScript =
        "your hands can shake after a stressful moment because the body releases adrenaline the hormone raises heart rate and prepares the muscles for action once the adrenaline level falls the shaking usually stops";
      const value =
        createComponentModelResult();

      value.scriptType = "explanation";
      value.verdict = "mixed";
      value.scoreComponents = {
        overall: {
          premiseAppeal: 15,
          openingPromise: 15,
          progression: 15,
          payoff: 15,
        },
        hook: {
          immediacy: 17,
          specificity: 17,
          viewerPull: 16,
          deliveryAlignment: 15,
        },
        retentionRisk: {
          openingFriction: 13,
          progressionRisk: 13,
          predictabilityRisk: 12,
          payoffRisk: 12,
        },
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The explanation supposedly needs more detail.";
      value.riskyParts = [
        {
          excerpt: noPunctuationScript,
          reason:
            "The explanation lacks deeper mechanism.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "middle",
          suggestion:
            "Expand the explanation with another example.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt: noPunctuationScript,
          label: "Incomplete explanation",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "More causal depth is needed.";

      const normalized =
        normalizeAnalysisV2CompleteCausalExplanationModelResult(
          value,
          noPunctuationScript
        );

      assert.notEqual(normalized, null);

      const result =
        validateAnalysisV2ModelResult(
          normalized,
          noPunctuationScript
        );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(
        result.value.verdict,
        "mixed"
      );
      assert.equal(
        result.value.scores.overall,
        60
      );
      assert.equal(
        result.value.riskyParts.length,
        1
      );
      assert.equal(
        result.value.riskyParts[0]?.excerpt,
        noPunctuationScript
      );
      assert.equal(
        result.value.suggestedFixes[0]?.target,
        "clarity"
      );
      assert.equal(
        result.value.scenes[0]?.status,
        "average"
      );
    },
  },
  {
    name: "rejects missing-depth feedback for a complete unpunctuated causal explanation",
    run: () => {
      const noPunctuationScript =
        "your hands can shake after a stressful moment because the body releases adrenaline the hormone raises heart rate and prepares the muscles for action once the adrenaline level falls the shaking usually stops";

      const value = createMixedResult();

      value.scriptType = "explanation";
      value.scores = {
        overall: 49,
        hook: 65,
        retentionRisk: 45,
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The opening immediately introduces the concrete premise about why hands shake after stress.";
      value.riskyParts = [
        {
          excerpt: noPunctuationScript,
          reason:
            "The explanation is very brief and lacks deeper mechanism, examples, or implications that would increase viewer engagement and payoff.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "middle",
          suggestion:
            "Expand the explanation to include a clearer mechanism or example of how adrenaline causes shaking and why it stops, to increase viewer engagement and payoff.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt: noPunctuationScript,
          label: "Complete causal explanation",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "The script explains the cause and resolution but supposedly needs deeper mechanism.";

      const result = validateAnalysisV2Result(
        value,
        noPunctuationScript
      );

      assert.equal(result.ok, false);

      if (result.ok) {
        throw new Error(
          "Expected the unnecessary causal-expansion feedback to be rejected."
        );
      }

      assert.match(
        result.reason,
        /complete causal explanation in an unpunctuated script cannot be treated as missing mechanism/i
      );
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
    name: "accepts a strong result below 85 without an optional refinement",
    run: () => {
      const value = createStrongResult();
      value.suggestedFixes = [];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.ok, true);
      assert.equal(
        result.value.suggestedFixes.length,
        0
      );
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
    name: "removes candidate facts appended to an allowed verified request",
    run: () => {
      const value = createMixedResult();

      value.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Add a verified consequence or implication that explains why this matters, such as cultural significance, genetic distribution, or common misconceptions.",
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
      assert.equal(
        result.value.suggestedFixes[0]
          ?.suggestion,
        "Add a verified consequence or implication that explains why this matters."
      );
    },
  },
  {
    name: "ru: recognizes the Russian allowed verified-request form just like the English one",
    run: () => {
      const value = createMixedResult();

      value.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Добавьте проверенное следствие или значение, которое объясняет, почему это важно, например культурное значение или распространённые заблуждения.",
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
      assert.equal(
        result.value.suggestedFixes[0]?.suggestion,
        "Добавьте проверенное следствие или значение, которое объясняет, почему это важно."
      );
    },
  },
  {
    name: "rejects arbitrary text appended after an allowed verified request",
    run: () => {
      const value = createMixedResult();

      value.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Add a verified consequence or implication that explains why this matters, and completely rewrite the ending.",
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
    name: "rejects a contextualized verified request outside the neutral forms",
    run: () => {
      const value = createMixedResult();

      value.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Add a verified consequence or implication that explains why the warm soapy water step matters.",
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
    name: "accepts an allowed neutral verified diagnostic fix",
    run: () => {
      const value = createMixedResult();

      value.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Add an external consequence or implication that explains why this matters.",
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
    },
  },
  {
    name: "accepts a grounded contextualized fix without a verified claim",
    run: () => {
      const value = createMixedResult();

      value.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Explain why the warm soapy water step matters before moving to the next instruction.",
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
    // Existing keep contract, made explicit rather than incidental: keep
    // with no hook-targeted fix at all remains valid.
    name: "keep contract: no hook fix at all is valid",
    run: () => {
      const value = createMixedResult();

      value.hookDecision = "keep";
      value.suggestedFixes = [
        {
          target: "clarity",
          suggestion:
            "Connect this instruction directly to the soaking step so the sequence is easier to follow.",
          optional: false,
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, true);
    },
  },
  {
    // Only a HOOK-targeted, non-optional fix is forbidden alongside keep —
    // a required body/payoff-area fix follows the exact existing contract
    // and remains valid.
    name: "keep contract: a required non-hook (payoff-area) fix is valid",
    run: () => {
      const value = createMixedResult();

      value.hookDecision = "keep";
      value.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Add a verified consequence or implication that explains why this matters.",
          optional: false,
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, true);
    },
  },
  {
    // An OPTIONAL hook-targeted fix alongside keep is not the same
    // contradiction the validator rejects — only a required (non-optional)
    // hook fix is forbidden.
    name: "keep contract: optional hook-targeted advice is valid",
    run: () => {
      const value = createMixedResult();

      value.hookDecision = "keep";
      // A mixed result still needs its own non-optional fix somewhere —
      // this keeps the required "clarity" fix from the baseline and adds
      // an OPTIONAL hook fix alongside it, isolating exactly what this
      // test checks: an optional (not required) hook fix does not trip
      // the keep/required-hook-fix contradiction.
      value.suggestedFixes = [
        {
          target: "clarity",
          suggestion:
            "Connect this instruction directly to the soaking step so the sequence is easier to follow.",
          optional: false,
        },
        {
          target: "hook",
          suggestion:
            "Optionally tighten the opening phrasing for pacing.",
          optional: true,
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, true);
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
    name: "rejects a 'here is a story about' framing opener with a Strong hook score and a strong verdict, even with a concrete strong body",
    run: () => {
      const bakeryScript =
        "Here is a story about a bakery. Last month, a small bakery raised the price of every pastry by 40%. Within one week, customer visits dropped by half. The owner restored the old prices and offered returning customers a free pastry. By Friday, sales were almost back to normal.";

      const value = createStrongResult();

      value.scriptType = "narrative_event";
      value.verdict = "strong";
      value.scores = {
        overall: 78,
        hook: ANALYSIS_V2_HOOK_STRONG_THRESHOLD + 2,
        retentionRisk: 25,
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The opening sentence quickly introduces a concrete and specific story premise about a bakery.";
      value.riskyParts = [];
      value.suggestedFixes = [];
      value.scenes = [
        {
          excerpt: "Here is a story about a bakery.",
          label: "Opening story introduction",
          status: "strong",
        },
        {
          excerpt:
            "Last month, a small bakery raised the price of every pastry by 40%.",
          label: "Price increase event",
          status: "strong",
        },
      ];
      value.mainTakeaway =
        "The script is understandable, but its premise appeal limits the overall score.";

      const result = validateAnalysisV2Result(
        value,
        bakeryScript
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects the same framing filler with a Strong hook score even under a non-strong (mixed) verdict",
    run: () => {
      // Isolates the Strong-hook-score guard from the strong-verdict guard:
      // this result is already mixed (not strong) and already has a grounded
      // opening risky part and a non-optional hook fix, yet the hook score
      // itself still reaches the shared Strong threshold — that alone must
      // still be rejected.
      const bakeryScript =
        "Here is a story about a bakery. Last month, a small bakery raised the price of every pastry by 40%. Within one week, customer visits dropped by half.";

      const value = createMixedResult();

      value.scriptType = "narrative_event";
      value.scores = {
        overall: 60,
        hook: ANALYSIS_V2_HOOK_STRONG_THRESHOLD,
        retentionRisk: 35,
      };
      value.hookDecision = "refine";
      value.hookAssessment =
        "The opening announces a story instead of leading with the concrete price increase.";
      value.suggestedHook =
        "Last month, this bakery raised prices by 40% overnight.";
      value.riskyParts = [
        {
          excerpt: "Here is a story about a bakery.",
          reason:
            "This opening only announces a story and delays the concrete 40% price increase.",
          severity: "high",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Remove the generic story announcement and open directly with the 40% price increase.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt: "Here is a story about a bakery.",
          label: "Opening",
          status: "risky",
        },
      ];

      const result = validateAnalysisV2Result(
        value,
        bakeryScript
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "accepts a corrected 'story about' opener: below-Strong hook score, refine decision, grounded opening risk, non-optional fix, and a plain (non-question) fix/hook",
    run: () => {
      const bakeryScript =
        "Here is a story about a bakery. Last month, a small bakery raised the price of every pastry by 40%. Within one week, customer visits dropped by half. The owner restored the old prices and offered returning customers a free pastry. By Friday, sales were almost back to normal.";

      const value = createMixedResult();

      value.scriptType = "narrative_event";
      value.scores = {
        overall: 60,
        hook: ANALYSIS_V2_HOOK_STRONG_THRESHOLD - 1,
        retentionRisk: 35,
      };
      value.hookDecision = "refine";
      value.hookAssessment =
        "The opening announces a story instead of leading with the concrete 40% price increase.";
      value.suggestedHook =
        "Last month, this bakery raised prices by 40% overnight.";
      value.riskyParts = [
        {
          excerpt: "Here is a story about a bakery.",
          reason:
            "This opening only announces a story and delays the concrete 40% price increase that drives the whole script.",
          severity: "high",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Remove the generic story announcement and open directly with the 40% price increase.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt: "Here is a story about a bakery.",
          label: "Opening",
          status: "risky",
        },
        {
          excerpt:
            "Last month, a small bakery raised the price of every pastry by 40%.",
          label: "Price increase",
          status: "strong",
        },
      ];
      value.mainTakeaway =
        "The main limitation is the generic opening, which delays the concrete price-increase fact that should lead the hook.";

      const result = validateAnalysisV2Result(
        value,
        bakeryScript
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.ok, true);
      assert.notEqual(result.value.hookDecision, "keep");
      assert.ok(
        result.value.scores.hook <
          ANALYSIS_V2_HOOK_STRONG_THRESHOLD
      );
      assert.ok(result.value.riskyParts.length > 0);
      assert.ok(
        result.value.suggestedFixes.some(
          (fix) => fix.target === "hook" && !fix.optional
        )
      );
      // The rule must not force an interrogative hook — a plain declarative
      // rewrite is a valid correction.
      assert.equal(
        (result.value.suggestedHook ?? "").trim().endsWith(
          "?"
        ),
        false
      );
      assert.equal(
        result.value.suggestedFixes[0]!.suggestion.trim().endsWith(
          "?"
        ),
        false
      );
    },
  },
  {
    name: "does not flag a direct factual opener with the same concrete specificity as the framing variant",
    run: () => {
      // The opening sentence states both the cause (the 40% price increase)
      // and its own consequence (visits dropped by half) together — unlike
      // the framing variant (generic filler) and unlike a split-consequence
      // opener (a separate, distinct weakness with its own tests below),
      // this is a genuinely compact, direct hook and must not be flagged by
      // either rule.
      const directScript =
        "Last month, a small bakery raised the price of every pastry by 40%, and customer visits dropped by half within a week. The owner restored the old prices and offered returning customers a free pastry. By Friday, sales were almost back to normal.";

      const value = createStrongResult();

      value.scriptType = "narrative_event";
      value.verdict = "strong";
      value.scores = {
        overall: 78,
        hook: ANALYSIS_V2_HOOK_STRONG_THRESHOLD + 2,
        retentionRisk: 25,
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The opening leads directly with the concrete 40% price increase and its immediate consequence.";
      value.riskyParts = [];
      value.suggestedFixes = [];
      value.scenes = [
        {
          excerpt:
            "Last month, a small bakery raised the price of every pastry by 40%, and customer visits dropped by half within a week.",
          label: "Price increase and consequence",
          status: "strong",
        },
      ];
      value.mainTakeaway =
        "The script leads with a concrete, specific event and stays focused.";

      const result = validateAnalysisV2Result(
        value,
        directScript
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.ok, true);
      assert.equal(result.value.hookDecision, "keep");
    },
  },
  {
    name: "rejects a maximal-immediacy hook when the cause and its consequence are split across two sentences",
    run: () => {
      const script =
        "Last month, a small bakery raised the price of every pastry by 40%. Within one week, customer visits dropped by half. The owner restored the old prices and offered returning customers a free pastry. By Friday, sales were almost back to normal.";

      const value = createStrongResult();

      value.scriptType = "narrative_event";
      value.verdict = "strong";
      value.scores = {
        overall: 82,
        hook: 25 + 20 + 18 + 20,
        retentionRisk: 20,
      };
      value.scoreBreakdown = {
        overall: {
          premiseAppeal: 20,
          openingPromise: 21,
          progression: 20,
          payoff: 21,
        },
        hook: {
          immediacy: 25,
          specificity: 20,
          viewerPull: 18,
          deliveryAlignment: 20,
        },
        retentionRisk: {
          openingFriction: 4,
          progressionRisk: 5,
          predictabilityRisk: 6,
          payoffRisk: 5,
        },
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The opening leads with a concrete, specific event.";
      value.riskyParts = [];
      value.suggestedFixes = [];
      value.scenes = [
        {
          excerpt:
            "Last month, a small bakery raised the price of every pastry by 40%.",
          label: "Price increase",
          status: "strong",
        },
      ];
      value.mainTakeaway =
        "The script leads with a concrete, specific event and stays focused throughout.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "rejects a Strong aggregate hook score reached via unrelated components (specificity) even when no single component hits the literal max, while hookDecision/riskyPart/fix already say refine",
    run: () => {
      // Reproduces the reported inconsistency exactly: neither immediacy
      // nor deliveryAlignment is individually maximal (20 each, below the
      // literal 25 ceiling the narrower per-component check enforces), but
      // specificity alone pushes the aggregate hook total into the Strong
      // band while hookDecision/riskyPart/fix already say the opening
      // needs work — an internally inconsistent result that the narrower
      // component-only check cannot catch by itself.
      const script =
        "Last month, a small bakery raised the price of every pastry by 40%. Within one week, customer visits dropped by half. The owner restored the old prices and offered returning customers a free pastry. By Friday, sales were almost back to normal.";

      const value = createMixedResult();

      value.scriptType = "narrative_event";
      value.scores = {
        overall: 80,
        hook: 20 + 24 + 18 + 20,
        retentionRisk: 45,
      };
      value.scoreBreakdown = {
        overall: {
          premiseAppeal: 20,
          openingPromise: 20,
          progression: 20,
          payoff: 20,
        },
        hook: {
          immediacy: 20,
          specificity: 24,
          viewerPull: 18,
          deliveryAlignment: 20,
        },
        retentionRisk: {
          openingFriction: 12,
          progressionRisk: 11,
          predictabilityRisk: 11,
          payoffRisk: 11,
        },
      };
      value.hookDecision = "refine";
      value.hookAssessment =
        "The cause is stated in the first sentence, but the consequence appears only in the next sentence.";
      value.suggestedHook =
        "A small bakery raised the price of every pastry by 40%, and within one week, customer visits dropped by half.";
      value.riskyParts = [
        {
          excerpt:
            "Last month, a small bakery raised the price of every pastry by 40%.",
          reason:
            "The cause is here, but the consequence is only revealed in the next sentence.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Compress the cause and its consequence into one opening sentence.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt:
            "Last month, a small bakery raised the price of every pastry by 40%.",
          label: "Price increase",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "The main limitation is the split cause-and-consequence opening.";

      assert.ok(
        (value.scores as { hook: number }).hook >=
          ANALYSIS_V2_HOOK_STRONG_THRESHOLD,
        "test setup must actually reach the Strong band"
      );

      const result = validateAnalysisV2Result(
        value,
        script
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "accepts the same reproduction once normalized: refine decision, grounded opening risky part, non-optional fix, hook below Strong threshold, and a breakdown that sums to the same final score",
    run: () => {
      const script =
        "Last month, a small bakery raised the price of every pastry by 40%. Within one week, customer visits dropped by half. The owner restored the old prices and offered returning customers a free pastry. By Friday, sales were almost back to normal.";

      const value = createMixedResult();

      value.scriptType = "narrative_event";
      value.scores = {
        overall: 60,
        hook: 16 + 17 + 16 + 16,
        retentionRisk: 45,
      };
      value.scoreBreakdown = {
        overall: {
          premiseAppeal: 15,
          openingPromise: 15,
          progression: 15,
          payoff: 15,
        },
        hook: {
          immediacy: 16,
          specificity: 17,
          viewerPull: 16,
          deliveryAlignment: 16,
        },
        retentionRisk: {
          openingFriction: 12,
          progressionRisk: 11,
          predictabilityRisk: 11,
          payoffRisk: 11,
        },
      };
      value.hookDecision = "refine";
      value.hookAssessment =
        "The cause is stated in the first sentence, but the consequence appears only in the next sentence.";
      value.suggestedHook =
        "A small bakery raised the price of every pastry by 40%, and within one week, customer visits dropped by half.";
      value.riskyParts = [
        {
          excerpt:
            "Last month, a small bakery raised the price of every pastry by 40%.",
          reason:
            "The cause is here, but the consequence is only revealed in the next sentence.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Compress the cause and its consequence into one opening sentence.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt:
            "Last month, a small bakery raised the price of every pastry by 40%.",
          label: "Price increase",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "The main limitation is the split cause-and-consequence opening, which limits premise appeal.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.ok, true);
      assert.ok(
        result.value.hookDecision === "refine" ||
          result.value.hookDecision === "rewrite"
      );
      assert.ok(result.value.riskyParts.length > 0);
      assert.ok(
        result.value.suggestedFixes.some(
          (fix) => fix.target === "hook" && !fix.optional
        )
      );
      assert.ok(
        result.value.scores.hook <
          ANALYSIS_V2_HOOK_STRONG_THRESHOLD
      );

      // Breakdown and total stay mathematically consistent.
      const breakdown = result.value.scoreBreakdown;

      if (!breakdown) {
        throw new Error(
          "expected the accepted result to keep its score breakdown"
        );
      }

      const hookSum =
        breakdown.hook.immediacy +
        breakdown.hook.specificity +
        breakdown.hook.viewerPull +
        breakdown.hook.deliveryAlignment;

      assert.equal(hookSum, result.value.scores.hook);
    },
  },
  {
    name: "generic-framing invariant: a Strong aggregate hook score reached via unrelated components cannot coexist with the refine decision and risky part it also requires",
    run: () => {
      // Same universal invariant, exercised through the OTHER rule that
      // can force hookDecision to refine/rewrite (generic first-sentence
      // filler) rather than the split cause/consequence rule, proving the
      // fix is not specific to one invariant.
      const genericOpeningScript =
        "Something interesting happens before a spacecraft returns to Earth. NASA heats pieces of its heat shield to extreme temperatures to test whether they can survive reentry. Engineers inspect the material for cracks.";

      const value = createMixedResult();

      value.scriptType = "explanation";
      value.scores = {
        overall: 75,
        hook: 20 + 24 + 18 + 20,
        retentionRisk: 35,
      };
      value.scoreBreakdown = {
        overall: {
          premiseAppeal: 19,
          openingPromise: 19,
          progression: 19,
          payoff: 18,
        },
        hook: {
          immediacy: 20,
          specificity: 24,
          viewerPull: 18,
          deliveryAlignment: 20,
        },
        retentionRisk: {
          openingFriction: 9,
          progressionRisk: 9,
          predictabilityRisk: 9,
          payoffRisk: 8,
        },
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
      ];

      assert.ok(
        (value.scores as { hook: number }).hook >=
          ANALYSIS_V2_HOOK_STRONG_THRESHOLD,
        "test setup must actually reach the Strong band"
      );

      const result = validateAnalysisV2Result(
        value,
        genericOpeningScript
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "does not flag the exact short direct cause+effect opener from the reported scenario",
    run: () => {
      const script =
        "A small bakery raised every pastry price by 40%, causing visits to fall by half within one week.";

      const value = createStrongResult();

      value.scriptType = "narrative_event";
      value.verdict = "strong";
      value.scores = {
        overall: 82,
        hook: 22 + 21 + 20 + 21,
        retentionRisk: 20,
      };
      value.scoreBreakdown = {
        overall: {
          premiseAppeal: 20,
          openingPromise: 21,
          progression: 20,
          payoff: 21,
        },
        hook: {
          immediacy: 22,
          specificity: 21,
          viewerPull: 20,
          deliveryAlignment: 21,
        },
        retentionRisk: {
          openingFriction: 4,
          progressionRisk: 5,
          predictabilityRisk: 6,
          payoffRisk: 5,
        },
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The single opening sentence states both the cause and its consequence.";
      value.riskyParts = [];
      value.suggestedFixes = [];
      value.scenes = [
        { excerpt: script, label: "Full hook", status: "strong" },
      ];
      value.mainTakeaway =
        "The script leads with a compact cause-and-consequence hook.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.ok, true);
      assert.equal(result.value.hookDecision, "keep");
      assert.equal(result.value.riskyParts.length, 0);
    },
  },
  {
    name: "ru: rejects the exact reported Strong-hook/refine inconsistency identically to en (locale parity)",
    run: () => {
      const script =
        "Last month, a small bakery raised the price of every pastry by 40%. Within one week, customer visits dropped by half. The owner restored the old prices and offered returning customers a free pastry. By Friday, sales were almost back to normal.";

      const buildInconsistentValue = () => {
        const value = createMixedResult();

        value.scriptType = "narrative_event";
        value.scores = {
          overall: 80,
          hook: 20 + 24 + 18 + 20,
          retentionRisk: 45,
        };
        value.scoreBreakdown = {
          overall: {
            premiseAppeal: 20,
            openingPromise: 20,
            progression: 20,
            payoff: 20,
          },
          hook: {
            immediacy: 20,
            specificity: 24,
            viewerPull: 18,
            deliveryAlignment: 20,
          },
          retentionRisk: {
            openingFriction: 12,
            progressionRisk: 11,
            predictabilityRisk: 11,
            payoffRisk: 11,
          },
        };
        value.hookDecision = "refine";
        value.riskyParts = [
          {
            excerpt:
              "Last month, a small bakery raised the price of every pastry by 40%.",
            reason: "placeholder",
            severity: "medium",
          },
        ];
        value.suggestedFixes = [
          {
            target: "hook",
            suggestion: "placeholder",
            optional: false,
          },
        ];
        value.scenes = [
          {
            excerpt:
              "Last month, a small bakery raised the price of every pastry by 40%.",
            label: "Price increase",
            status: "risky",
          },
        ];

        return value;
      };

      const enValue = buildInconsistentValue();
      enValue.hookAssessment =
        "The cause is stated in the first sentence, but the consequence appears only in the next sentence.";
      (
        enValue.riskyParts as { reason: string }[]
      )[0]!.reason =
        "The cause is here, but the consequence is only revealed in the next sentence.";
      (
        enValue.suggestedFixes as { suggestion: string }[]
      )[0]!.suggestion =
        "Compress the cause and its consequence into one opening sentence.";
      enValue.mainTakeaway =
        "The main limitation is the split cause-and-consequence opening.";

      const ruValue = buildInconsistentValue();
      ruValue.hookAssessment =
        "Причина указана в первом предложении, но следствие раскрывается только в следующем.";
      (
        ruValue.riskyParts as { reason: string }[]
      )[0]!.reason =
        "Здесь есть причина, но следствие раскрывается только в следующем предложении.";
      (
        ruValue.suggestedFixes as { suggestion: string }[]
      )[0]!.suggestion =
        "Объедините причину и следствие в одно вступительное предложение.";
      ruValue.mainTakeaway =
        "Основное ограничение — разделённое на два предложения начало.";

      const enResult = validateAnalysisV2Result(
        enValue,
        script,
        "en"
      );
      const ruResult = validateAnalysisV2Result(
        ruValue,
        script,
        "ru"
      );

      assert.equal(enResult.ok, false);
      assert.equal(ruResult.ok, false);

      if (enResult.ok || ruResult.ok) {
        throw new Error(
          "expected both locales to reject the Strong-hook/refine inconsistency"
        );
      }

      assert.equal(enResult.reason, ruResult.reason);
    },
  },
  {
    name: "accepts a corrected split cause/consequence hook: non-maximal components, grounded opening risk, non-optional fix, refine decision, and a plain (non-question) fix",
    run: () => {
      const script =
        "Last month, a small bakery raised the price of every pastry by 40%. Within one week, customer visits dropped by half. The owner restored the old prices and offered returning customers a free pastry. By Friday, sales were almost back to normal.";

      const value = createMixedResult();

      value.scriptType = "narrative_event";
      value.scores = {
        overall: 15 + 17 + 17 + 16,
        hook: 14 + 18 + 13 + 10,
        retentionRisk: 35,
      };
      value.scoreBreakdown = {
        overall: {
          premiseAppeal: 15,
          openingPromise: 17,
          progression: 17,
          payoff: 16,
        },
        hook: {
          immediacy: 14,
          specificity: 18,
          viewerPull: 13,
          deliveryAlignment: 10,
        },
        retentionRisk: {
          openingFriction: 10,
          progressionRisk: 8,
          predictabilityRisk: 10,
          payoffRisk: 7,
        },
      };
      value.hookDecision = "refine";
      value.hookAssessment =
        "The cause and its consequence are split across two sentences, delaying the real viewer pull.";
      value.suggestedHook =
        "A bakery raised every pastry price by 40%, and customer visits fell by half within a week.";
      value.riskyParts = [
        {
          excerpt:
            "Last month, a small bakery raised the price of every pastry by 40%.",
          reason:
            "This sentence states the cause but delays its own consequence to the next sentence, so the real viewer pull arrives too late.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "hook",
          suggestion:
            "Compress the cause and its consequence into one opening sentence instead of splitting them across two.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt:
            "Last month, a small bakery raised the price of every pastry by 40%.",
          label: "Price increase",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "The main limitation is the split cause-and-consequence opening, which limits premise appeal.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.ok, true);
      assert.notEqual(result.value.hookDecision, "keep");
      assert.ok(
        result.value.hookDecision === "refine" ||
          result.value.hookDecision === "rewrite"
      );
      assert.ok(
        result.value.scoreBreakdown !== undefined &&
          result.value.scoreBreakdown.hook.immediacy < 25 &&
          result.value.scoreBreakdown.hook
            .deliveryAlignment < 25
      );
      assert.ok(result.value.riskyParts.length > 0);
      assert.ok(
        result.value.suggestedFixes.some(
          (fix) => fix.target === "hook" && !fix.optional
        )
      );
      // The rule must not force an interrogative hook.
      assert.equal(
        (result.value.suggestedHook ?? "")
          .trim()
          .endsWith("?"),
        false
      );
      assert.equal(
        result.value.suggestedFixes[0]!.suggestion
          .trim()
          .endsWith("?"),
        false
      );
    },
  },
  {
    name: "does not flag a short direct factual opener that already compresses cause and consequence into one sentence",
    run: () => {
      const script =
        "A bakery raised every pastry price by 40%, and customer visits fell by half within a week.";

      const value = createStrongResult();

      value.scriptType = "narrative_event";
      value.verdict = "strong";
      value.scores = {
        overall: 82,
        hook: 22 + 21 + 20 + 21,
        retentionRisk: 20,
      };
      value.scoreBreakdown = {
        overall: {
          premiseAppeal: 20,
          openingPromise: 21,
          progression: 20,
          payoff: 21,
        },
        hook: {
          immediacy: 22,
          specificity: 21,
          viewerPull: 20,
          deliveryAlignment: 21,
        },
        retentionRisk: {
          openingFriction: 4,
          progressionRisk: 5,
          predictabilityRisk: 6,
          payoffRisk: 5,
        },
      };
      value.hookDecision = "keep";
      value.hookAssessment =
        "The single opening sentence states both the cause and its consequence.";
      value.riskyParts = [];
      value.suggestedFixes = [];
      value.scenes = [
        { excerpt: script, label: "Full hook", status: "strong" },
      ];
      value.mainTakeaway =
        "The script leads with a compact cause-and-consequence hook.";

      const result = validateAnalysisV2Result(
        value,
        script
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.ok, true);
      assert.equal(result.value.hookDecision, "keep");
    },
  },
  {
    name: "ru: rejects the same split cause/consequence hook identically to en (locale parity), quoted excerpts stay English",
    run: () => {
      const script =
        "Last month, a small bakery raised the price of every pastry by 40%. Within one week, customer visits dropped by half.";

      const buildBuggyValue = () => {
        const value = createStrongResult();

        value.scriptType = "narrative_event";
        value.verdict = "strong";
        value.scores = {
          overall: 82,
          hook: 25 + 20 + 18 + 20,
          retentionRisk: 20,
        };
        value.scoreBreakdown = {
          overall: {
            premiseAppeal: 20,
            openingPromise: 21,
            progression: 20,
            payoff: 21,
          },
          hook: {
            immediacy: 25,
            specificity: 20,
            viewerPull: 18,
            deliveryAlignment: 20,
          },
          retentionRisk: {
            openingFriction: 4,
            progressionRisk: 5,
            predictabilityRisk: 6,
            payoffRisk: 5,
          },
        };
        value.hookDecision = "keep";
        value.riskyParts = [];
        value.suggestedFixes = [];
        value.scenes = [
          {
            excerpt:
              "Last month, a small bakery raised the price of every pastry by 40%.",
            label: "Price increase",
            status: "strong",
          },
        ];

        return value;
      };

      const enValue = buildBuggyValue();
      enValue.hookAssessment =
        "The opening leads with a concrete, specific event.";
      enValue.mainTakeaway =
        "The script leads with a concrete, specific event and stays focused throughout.";

      const ruValue = buildBuggyValue();
      ruValue.hookAssessment =
        "Открытие сразу даёт конкретное, специфичное событие.";
      ruValue.mainTakeaway =
        "Сценарий сразу даёт конкретное событие и остаётся сфокусированным.";

      const enResult = validateAnalysisV2Result(
        enValue,
        script,
        "en"
      );
      const ruResult = validateAnalysisV2Result(
        ruValue,
        script,
        "ru"
      );

      assert.equal(enResult.ok, false);
      assert.equal(ruResult.ok, false);

      if (enResult.ok || ruResult.ok) {
        throw new Error(
          "expected both locales to reject the split cause/consequence hook"
        );
      }

      assert.equal(enResult.reason, ruResult.reason);

      assert.equal(
        (ruValue.scenes as { excerpt: string }[])[0]!
          .excerpt,
        "Last month, a small bakery raised the price of every pastry by 40%."
      );
    },
  },
  {
    name: "universal rule: several distinct generic framing openers are all rejected the same way, not just the bakery wording",
    run: () => {
      const openers = [
        "Here is a story about a bakery.",
        "This is a story about a bakery.",
        "Today, I want to tell you about a bakery.",
        "Let me tell you about a bakery.",
      ];

      const rest =
        " Last month, a small bakery raised the price of every pastry by 40%. Within one week, customer visits dropped by half.";

      for (const opener of openers) {
        const script = opener + rest;
        const value = createStrongResult();

        value.scriptType = "narrative_event";
        value.verdict = "strong";
        value.scores = {
          overall: 78,
          hook: ANALYSIS_V2_HOOK_STRONG_THRESHOLD + 2,
          retentionRisk: 25,
        };
        value.hookDecision = "keep";
        value.hookAssessment =
          "The opening is clear and specific.";
        value.riskyParts = [];
        value.suggestedFixes = [];
        value.scenes = [
          {
            excerpt: opener,
            label: "Opening",
            status: "strong",
          },
        ];
        value.mainTakeaway =
          "The script is understandable.";

        const result = validateAnalysisV2Result(
          value,
          script
        );

        assert.equal(
          result.ok,
          false,
          `expected "${opener}" to be treated as generic framing filler`
        );
      }
    },
  },
  {
    name: "ru: rejects the same 'story about' framing filler identically to en (locale parity), quoted excerpts stay English",
    run: () => {
      const bakeryScript =
        "Here is a story about a bakery. Last month, a small bakery raised the price of every pastry by 40%. Within one week, customer visits dropped by half. The owner restored the old prices and offered returning customers a free pastry. By Friday, sales were almost back to normal.";

      const buildBuggyValue = () => {
        const value = createStrongResult();

        value.scriptType = "narrative_event";
        value.verdict = "strong";
        value.scores = {
          overall: 78,
          hook: ANALYSIS_V2_HOOK_STRONG_THRESHOLD + 2,
          retentionRisk: 25,
        };
        value.hookDecision = "keep";
        value.riskyParts = [];
        value.suggestedFixes = [];
        value.scenes = [
          {
            excerpt: "Here is a story about a bakery.",
            label: "Opening",
            status: "strong",
          },
        ];

        return value;
      };

      const enValue = buildBuggyValue();
      enValue.hookAssessment =
        "The opening sentence quickly introduces a concrete story premise about a bakery.";
      enValue.mainTakeaway =
        "The script is understandable.";

      const ruValue = buildBuggyValue();
      ruValue.hookAssessment =
        "Открывающая фраза сразу вводит в конкретную ситуацию с пекарней.";
      ruValue.mainTakeaway = "Сценарий понятен.";

      const enResult = validateAnalysisV2Result(
        enValue,
        bakeryScript,
        "en"
      );
      const ruResult = validateAnalysisV2Result(
        ruValue,
        bakeryScript,
        "ru"
      );

      assert.equal(enResult.ok, false);
      assert.equal(ruResult.ok, false);

      if (enResult.ok || ruResult.ok) {
        throw new Error(
          "expected both locales to reject the framing filler"
        );
      }

      assert.equal(enResult.reason, ruResult.reason);

      // The excerpt itself is a quote from the (English) submitted script —
      // it must never be translated regardless of locale.
      assert.equal(
        (ruValue.scenes as { excerpt: string }[])[0]!
          .excerpt,
        "Here is a story about a bakery."
      );
    },
  },
  {
    name: "rejects keep when a specific hidden mechanism promise is not revealed",
    run: () => {
      const promiseScript =
        "The vault door failed because of one hidden mechanism. Most people never notice it. It runs silently during every test. Once you understand it, the failure makes more sense.";

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
        "The hook is clear and specific, promising a hidden mechanism behind the vault failure.";
      value.riskyParts = [
        {
          excerpt:
            "Once you understand it, the failure makes more sense.",
          reason:
            "The payoff is vague because it never names the promised hidden mechanism.",
          severity: "medium",
        },
      ];
      value.suggestedFixes = [
        {
          target: "payoff",
          suggestion:
            "Name the hidden mechanism and explain how it causes the vault door to fail.",
          optional: false,
        },
      ];
      value.scenes = [
        {
          excerpt:
            "The vault door failed because of one hidden mechanism.",
          label: "Specific promise",
          status: "risky",
        },
        {
          excerpt:
            "Once you understand it, the failure makes more sense.",
          label: "Unrevealed payoff",
          status: "risky",
        },
      ];
      value.mainTakeaway =
        "The script makes a specific promise but does not reveal the hidden mechanism.";

      const result = validateAnalysisV2Result(
        value,
        promiseScript
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "allows keep when a specific hidden mechanism promise is revealed",
    run: () => {
      const revealedScript =
        "The vault door failed because of one hidden mechanism. The hidden mechanism is thermal expansion in the lock. As the room heated up, the metal latch expanded just enough to jam the door.";

      const value = createStrongResult();

      value.scriptType = "explanation";
      value.hookDecision = "keep";
      value.hookAssessment =
        "The hook promises a hidden mechanism and the script reveals it as thermal expansion in the lock.";
      value.scenes = [
        {
          excerpt:
            "The vault door failed because of one hidden mechanism.",
          label: "Specific promise",
          status: "strong",
        },
        {
          excerpt:
            "The hidden mechanism is thermal expansion in the lock.",
          label: "Revealed mechanism",
          status: "strong",
        },
        {
          excerpt:
            "As the room heated up, the metal latch expanded just enough to jam the door.",
          label: "Mechanism explanation",
          status: "strong",
        },
      ];
      value.mainTakeaway =
        "The script reveals the promised mechanism and explains how it causes the failure.";

      const result = validateAnalysisV2Result(
        value,
        revealedScript
      );

      if (!result.ok) {
        throw new Error(result.reason);
      }

      assert.equal(result.value.hookDecision, "keep");
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
