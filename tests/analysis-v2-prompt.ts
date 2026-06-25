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
