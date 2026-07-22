import assert from "node:assert/strict";

import {
  ASK_CLIMPY_LOCAL_REVEAL_MAX_DURATION_MS,
  ASK_CLIMPY_LOCAL_REVEAL_MIN_DURATION_MS,
  ASK_CLIMPY_REVEAL_MAX_DURATION_MS,
  ASK_CLIMPY_REVEAL_MIN_DURATION_MS,
  buildAskClimpyRevealPlan,
  calculateAskClimpyRevealDurationMs,
  sliceAskClimpyRevealPlan,
} from "../app/results/ask-climpy-reveal";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [
  // ── calculateAskClimpyRevealDurationMs ───────────────────────────────
  {
    name: "calculateAskClimpyRevealDurationMs clamps very short text to the minimum duration",
    run: () => {
      assert.equal(
        calculateAskClimpyRevealDurationMs(1),
        ASK_CLIMPY_REVEAL_MIN_DURATION_MS
      );
      assert.equal(
        calculateAskClimpyRevealDurationMs(0),
        ASK_CLIMPY_REVEAL_MIN_DURATION_MS
      );
    },
  },
  {
    name: "calculateAskClimpyRevealDurationMs clamps very long text to the maximum duration",
    run: () => {
      assert.equal(
        calculateAskClimpyRevealDurationMs(10_000),
        ASK_CLIMPY_REVEAL_MAX_DURATION_MS
      );
    },
  },
  {
    name: "calculateAskClimpyRevealDurationMs scales within the approved 450-1200ms window for mid-length text",
    run: () => {
      const duration = calculateAskClimpyRevealDurationMs(150);
      assert.ok(duration >= ASK_CLIMPY_REVEAL_MIN_DURATION_MS);
      assert.ok(duration <= ASK_CLIMPY_REVEAL_MAX_DURATION_MS);

      const shorter = calculateAskClimpyRevealDurationMs(80);
      const longer = calculateAskClimpyRevealDurationMs(160);
      assert.ok(
        longer >= shorter,
        "Longer text should never produce a shorter (or equal-but-decreasing) duration"
      );
    },
  },
  {
    name: "calculateAskClimpyRevealDurationMs never returns a value outside [min, max]",
    run: () => {
      for (const totalCharacters of [0, 1, 10, 50, 100, 300, 900, 5000]) {
        const duration = calculateAskClimpyRevealDurationMs(totalCharacters);
        assert.ok(duration >= ASK_CLIMPY_REVEAL_MIN_DURATION_MS);
        assert.ok(duration <= ASK_CLIMPY_REVEAL_MAX_DURATION_MS);
      }
    },
  },

  // ── buildAskClimpyRevealPlan ─────────────────────────────────────────
  {
    name: "buildAskClimpyRevealPlan splits answer/action/example into word arrays",
    run: () => {
      const plan = buildAskClimpyRevealPlan({
        answer: "Fix the opening line first.",
        action: "Shorten the hook.",
        example: "A tighter version of the line.",
      });

      assert.deepEqual(plan.answerWords, [
        "Fix",
        "the",
        "opening",
        "line",
        "first.",
      ]);
      assert.deepEqual(plan.actionWords, ["Shorten", "the", "hook."]);
      assert.deepEqual(plan.exampleWords, [
        "A",
        "tighter",
        "version",
        "of",
        "the",
        "line.",
      ]);
      assert.equal(
        plan.totalWords,
        plan.answerWords.length + plan.actionWords.length + plan.exampleWords.length
      );
    },
  },
  {
    name: "buildAskClimpyRevealPlan treats absent action/example as zero words",
    run: () => {
      const plan = buildAskClimpyRevealPlan({ answer: "Fix the hook first." });
      assert.equal(plan.actionWords.length, 0);
      assert.equal(plan.exampleWords.length, 0);
      assert.equal(plan.totalWords, plan.answerWords.length);
    },
  },
  {
    name: "buildAskClimpyRevealPlan derives duration from the combined character count of all three fields",
    run: () => {
      const shortPlan = buildAskClimpyRevealPlan({ answer: "Short." });
      const longPlan = buildAskClimpyRevealPlan({
        answer: "A much longer answer that goes into considerably more detail about what to fix and why it matters for retention.",
        action: "Rework the opening and the payoff together.",
        example: "Here is a longer rewritten example fragment for comparison purposes.",
      });

      assert.ok(longPlan.durationMs >= shortPlan.durationMs);
    },
  },

  // ── sliceAskClimpyRevealPlan (ordering) ──────────────────────────────
  {
    name: "sliceAskClimpyRevealPlan reveals only the answer first, action and example still empty",
    run: () => {
      const plan = buildAskClimpyRevealPlan({
        answer: "Fix the opening line first.",
        action: "Shorten the hook.",
        example: "A tighter version.",
      });

      const slice = sliceAskClimpyRevealPlan(plan, 2);
      assert.equal(slice.answer, "Fix the");
      assert.equal(slice.action, "");
      assert.equal(slice.example, "");
    },
  },
  {
    name: "sliceAskClimpyRevealPlan only starts revealing action once the answer is fully revealed",
    run: () => {
      const plan = buildAskClimpyRevealPlan({
        answer: "Fix the hook.",
        action: "Shorten it now.",
        example: "A tighter version.",
      });

      const atAnswerBoundary = sliceAskClimpyRevealPlan(
        plan,
        plan.answerWords.length
      );
      assert.equal(atAnswerBoundary.answer, "Fix the hook.");
      assert.equal(atAnswerBoundary.action, "");

      const oneIntoAction = sliceAskClimpyRevealPlan(
        plan,
        plan.answerWords.length + 1
      );
      assert.equal(oneIntoAction.answer, "Fix the hook.");
      assert.equal(oneIntoAction.action, "Shorten");
      assert.equal(oneIntoAction.example, "");
    },
  },
  {
    name: "sliceAskClimpyRevealPlan starts revealing example right after answer when action is absent",
    run: () => {
      const plan = buildAskClimpyRevealPlan({
        answer: "Fix the hook.",
        example: "A tighter version.",
      });

      assert.equal(plan.actionWords.length, 0);

      const oneIntoExample = sliceAskClimpyRevealPlan(
        plan,
        plan.answerWords.length + 1
      );
      assert.equal(oneIntoExample.answer, "Fix the hook.");
      assert.equal(oneIntoExample.example, "A");
    },
  },
  {
    name: "sliceAskClimpyRevealPlan at totalWords reveals everything exactly matching the source text",
    run: () => {
      const plan = buildAskClimpyRevealPlan({
        answer: "Fix the hook.",
        action: "Shorten it.",
        example: "A tighter version.",
      });

      const complete = sliceAskClimpyRevealPlan(plan, plan.totalWords);
      assert.equal(complete.answer, "Fix the hook.");
      assert.equal(complete.action, "Shorten it.");
      assert.equal(complete.example, "A tighter version.");
    },
  },
  {
    name: "sliceAskClimpyRevealPlan clamps revealedWordCount below zero or above totalWords",
    run: () => {
      const plan = buildAskClimpyRevealPlan({ answer: "Fix the hook." });

      const negative = sliceAskClimpyRevealPlan(plan, -5);
      assert.equal(negative.answer, "");

      const overshoot = sliceAskClimpyRevealPlan(plan, plan.totalWords + 50);
      assert.equal(overshoot.answer, "Fix the hook.");
    },
  },
  {
    name: "sliceAskClimpyRevealPlan at zero words reveals nothing",
    run: () => {
      const plan = buildAskClimpyRevealPlan({
        answer: "Fix the hook.",
        action: "Shorten it.",
        example: "A tighter version.",
      });

      const nothing = sliceAskClimpyRevealPlan(plan, 0);
      assert.equal(nothing.answer, "");
      assert.equal(nothing.action, "");
      assert.equal(nothing.example, "");
    },
  },

  // ── Local-reply reveal speed (animation consistency correction) ─────
  // Local replies (courtesy small talk, post-error technical explanation)
  // never made a model round trip — they use the SAME reveal system as a
  // model answer, but a distinct, faster approved timing window.
  {
    name: "The approved local reveal window is 300-650ms, distinct from the unchanged 450-1200ms model window",
    run: () => {
      assert.equal(ASK_CLIMPY_LOCAL_REVEAL_MIN_DURATION_MS, 300);
      assert.equal(ASK_CLIMPY_LOCAL_REVEAL_MAX_DURATION_MS, 650);
      assert.equal(ASK_CLIMPY_REVEAL_MIN_DURATION_MS, 450);
      assert.equal(ASK_CLIMPY_REVEAL_MAX_DURATION_MS, 1200);
    },
  },
  {
    name: "calculateAskClimpyRevealDurationMs defaults to the model (450-1200ms) window when speed is omitted — model-answer timing is unchanged",
    run: () => {
      for (const totalCharacters of [0, 1, 10, 100, 5000]) {
        const duration = calculateAskClimpyRevealDurationMs(totalCharacters);
        assert.ok(duration >= ASK_CLIMPY_REVEAL_MIN_DURATION_MS);
        assert.ok(duration <= ASK_CLIMPY_REVEAL_MAX_DURATION_MS);
      }
    },
  },
  {
    name: "calculateAskClimpyRevealDurationMs(\"local\") always stays within the faster 300-650ms range, for any message length",
    run: () => {
      for (const totalCharacters of [0, 1, 10, 30, 100, 300, 5000]) {
        const duration = calculateAskClimpyRevealDurationMs(totalCharacters, "local");
        assert.ok(
          duration >= ASK_CLIMPY_LOCAL_REVEAL_MIN_DURATION_MS,
          `Expected >= ${ASK_CLIMPY_LOCAL_REVEAL_MIN_DURATION_MS}, got ${duration} for ${totalCharacters} chars`
        );
        assert.ok(
          duration <= ASK_CLIMPY_LOCAL_REVEAL_MAX_DURATION_MS,
          `Expected <= ${ASK_CLIMPY_LOCAL_REVEAL_MAX_DURATION_MS}, got ${duration} for ${totalCharacters} chars`
        );
      }
    },
  },
  {
    name: "For the same message length, the local window is always faster (shorter or equal) than the model window",
    run: () => {
      for (const totalCharacters of [5, 40, 120, 400]) {
        const localDuration = calculateAskClimpyRevealDurationMs(totalCharacters, "local");
        const modelDuration = calculateAskClimpyRevealDurationMs(totalCharacters, "model");
        assert.ok(
          localDuration <= modelDuration,
          `Expected local (${localDuration}) <= model (${modelDuration}) for ${totalCharacters} chars`
        );
      }
    },
  },
  {
    name: "buildAskClimpyRevealPlan defaults to \"model\" speed when omitted (backward compatible with existing model-answer call sites)",
    run: () => {
      const longAnswer =
        "This is a considerably longer model answer that should land well above the local window's own maximum duration if the wrong speed were ever applied by mistake.";
      const plan = buildAskClimpyRevealPlan({ answer: longAnswer });
      assert.ok(plan.durationMs >= ASK_CLIMPY_REVEAL_MIN_DURATION_MS);
      assert.ok(plan.durationMs <= ASK_CLIMPY_REVEAL_MAX_DURATION_MS);
    },
  },
  {
    name: "buildAskClimpyRevealPlan(..., \"local\") produces a plan whose durationMs sits in the faster local window for the same text that would exceed it under the model window",
    run: () => {
      const longAnswer =
        "This is a considerably longer local reply that would land well above the local window's own maximum duration under the model timing, but must stay clamped to local's own bounds.";

      const modelPlan = buildAskClimpyRevealPlan({ answer: longAnswer }, "model");
      const localPlan = buildAskClimpyRevealPlan({ answer: longAnswer }, "local");

      assert.ok(modelPlan.durationMs > ASK_CLIMPY_LOCAL_REVEAL_MAX_DURATION_MS);
      assert.ok(localPlan.durationMs <= ASK_CLIMPY_LOCAL_REVEAL_MAX_DURATION_MS);
      assert.ok(localPlan.durationMs >= ASK_CLIMPY_LOCAL_REVEAL_MIN_DURATION_MS);
    },
  },
  {
    name: "A local reply reveals by words (not characters): the greeting reply visually begins partial and completes",
    run: () => {
      const greeting =
        "Hi! Ask me about this analysis, and I'll help you decide what to fix.";
      const plan = buildAskClimpyRevealPlan({ answer: greeting }, "local");

      assert.ok(plan.totalWords > 1, "Expected more than one word to reveal progressively");

      const partial = sliceAskClimpyRevealPlan(plan, 2);
      assert.equal(partial.answer, "Hi! Ask");
      assert.notEqual(partial.answer, greeting, "Must begin partial, not the full text");

      const complete = sliceAskClimpyRevealPlan(plan, plan.totalWords);
      assert.equal(complete.answer, greeting, "Must fully match the stored message once complete");
    },
  },
  {
    name: "A local reply reveals by words (not characters): the capability reply visually begins partial and completes",
    run: () => {
      const capability =
        "I can explain your scores and risky parts, help you decide what to fix first, simplify a recommendation, or rewrite one validated risky fragment without inventing facts.";
      const plan = buildAskClimpyRevealPlan({ answer: capability }, "local");

      const partial = sliceAskClimpyRevealPlan(plan, 3);
      assert.equal(partial.answer, "I can explain");
      assert.notEqual(partial.answer, capability);

      const complete = sliceAskClimpyRevealPlan(plan, plan.totalWords);
      assert.equal(complete.answer, capability);
    },
  },
];

function main() {
  console.log("\nAsk Climpy Reveal Animation Tests\n");

  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
      console.log(`✅ PASS — ${test.name}`);
    } catch (error) {
      console.error(`❌ FAIL — ${test.name}`);
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }

  console.log(`\nAsk Climpy reveal tests: ${passed}/${tests.length} passed`);
}

main();
