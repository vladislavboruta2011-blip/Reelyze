import assert from "node:assert/strict";

import { buildAnalysisV2SystemPrompt } from "../engine/analysis-v2-prompt";

const prompt = buildAnalysisV2SystemPrompt();

const requiredRules = [
  {
    name: "one material problem should receive one suggested fix",
    text: "If one actionable change resolves all material problems, return one suggestedFix.",
  },
  {
    name: "two independent problems should receive two suggested fixes",
    text: "If the script has two materially different problems that require different changes, return two suggestedFixes.",
  },
  {
    name: "shared root causes may use one shared fix",
    text: "If multiple riskyParts share the same root cause, one suggestedFix may address all of them.",
  },
  {
    name: "the model must not invent a second fix",
    text: "Do not create a second suggestedFix merely to fill the available limit.",
  },
  {
    name: "hook evaluation must use only the opening hook",
    text: "Evaluate hookAssessment and hookDecision using only the opening hook, not unrelated material from later in the script.",
  },
  {
    name: "unfulfilled late promises must be treated as payoff problems",
    text: "Treat an explicit promise near the end as a material payoff problem when the promised information is not delivered anywhere in the script.",
  },
  {
    name: "independent unfulfilled promises need separate feedback",
    text: "If an unfulfilled promise is independent from another material problem, report it as a separate riskyPart with a separate suggestedFix.",
  },
  {
    name: "suggested hooks must not repeat and re-promise the same explanation",
    text: "A suggestedHook must not state the explanation and then promise to explain that same explanation.",
  },
  {
    name: "later specificity must not hide generic first-sentence filler",
    text: "Evaluate the first sentence independently. If it is generic filler that delays the concrete subject, premise, problem, or promise, treat it as a material hook weakness even when a later opening sentence is specific.",
  },
  {
    name: "generic opening filler needs grounded hook feedback",
    text: "When generic filler appears before the concrete premise, quote the filler sentence as a riskyPart and include a non-optional suggestedFix with target hook.",
  },
  {
    name: "generic opening filler cannot receive a strong result",
    text: "If generic opening filler delays the concrete premise, verdict must not be strong, riskyParts must not be empty, and overall must not exceed 84.",
  },
  {
    name: "generic opening filler requires a mandatory hook fix",
    text: "For generic opening filler, hookDecision must be refine or rewrite and the suggestedFix with target hook must have optional set to false.",
  },
  {
    name: "named frameworks are not automatically concrete",
    text: "Named steps, mnemonic labels, or a polished framework are not automatically useful or concrete.",
  },
  {
    name: "tautological framework explanations are material weaknesses",
    text: "If each step's explanation merely restates its label without adding a mechanism, example, decision rule, specific action, or observable result, treat that as a material content and payoff weakness; verdict must not be strong, riskyParts must not be empty, and include a non-optional suggestedFix.",
  },
];

let failures = 0;

console.log("\nAnalysis V2 Prompt Regression Tests\n");

for (const rule of requiredRules) {
  try {
    assert.ok(
      prompt.includes(rule.text),
      `Missing prompt rule: ${rule.text}`
    );
    console.log(`✅ PASS — ${rule.name}`);
  } catch (error) {
    failures += 1;
    console.error(`❌ FAIL — ${rule.name}`);
    console.error(
      error instanceof Error ? error.message : String(error)
    );
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("\nResult: all Analysis V2 prompt tests passed.");
}
