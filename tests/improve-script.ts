import assert from "node:assert/strict";

import {
  boundImproveScriptResult,
  buildImproveScriptDiagnosticResponse,
  parseImproveScriptResponse,
  shouldDiagnoseImproveScript,
} from "../engine/improve-script";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [
  {
    name: "generic abstract script should require diagnostic instead of full rewrite",
    run: () => {
      const script = [
        "Success is possible for anyone.",
        "You need to stay focused.",
        "Most people give up too early.",
        "Consistency is the key to improvement.",
      ].join("\n");

      assert.equal(shouldDiagnoseImproveScript(script), true);

      const result = parseImproveScriptResponse(
        JSON.stringify({
          improvedScript:
            "This rewrite should not be accepted because the source is too generic.",
          changes: ["Made it stronger."],
          reason: "The script needed a better story.",
        }),
        script
      );

      assert.equal(result.status, "diagnostic");
      assert.match(result.reason, /too broad|unsupported|concrete/i);
      assert.ok(result.missingMaterial);
      assert.ok(result.missingMaterial.length > 0);
    },
  },
  {
    name: "grounded concrete script can return an improved full script",
    run: () => {
      const script = [
        "Most people miss what actually changed the test.",
        "The valve stayed closed for 12 seconds before the pressure escaped.",
        "That delay made the final reading look safer than it really was.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          improvedScript: [
            "The test looked safe for 12 seconds.",
            "But the valve was still holding pressure inside the chamber.",
            "When it finally opened, the final reading changed — and that delay is what most people miss.",
          ].join("\n"),
          changes: [
            "Moved the 12-second concrete detail earlier.",
            "Cut the generic opening.",
            "Made the payoff clearer at the end.",
          ],
          reason:
            "The rewrite keeps the original test, valve, pressure, 12-second delay, and final reading while making the visual anchor appear sooner.",
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.match(result.improvedScript, /12 seconds/);
      assert.match(result.reason, /12-second|12 seconds|valve|pressure/i);
      assert.ok(result.changes.length >= 2);
    },
  },
  {
    name: "rewrite with unsupported new number should fall back to diagnostic",
    run: () => {
      const script = [
        "Most people miss what actually changed the test.",
        "The valve stayed closed for 12 seconds before the pressure escaped.",
        "That delay made the final reading look safer than it really was.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          improvedScript: [
            "The test looked safe for 30 seconds.",
            "But the valve was still holding pressure inside the chamber.",
          ].join("\n"),
          changes: ["Added a stronger number."],
          reason: "The rewrite makes the timing more dramatic.",
        }),
        script
      );

      assert.equal(result.status, "diagnostic");
      assert.match(result.reason, /number|measurement|not supported/i);
      assert.doesNotMatch(result.improvedScript, /30 seconds/);
    },
  },
  {
    name: "bound result trims long output while preserving result shape",
    run: () => {
      const longScript = `${"Line with pacing improvement. ".repeat(100)}`;
      const result = boundImproveScriptResult({
        status: "improved",
        improvedScript: longScript,
        changes: [
          "Moved the strongest visual earlier.",
          "Cut filler.",
          "Improved payoff delivery.",
        ],
        reason: "A".repeat(1000),
      });

      assert.equal(result.status, "improved");
      assert.ok(result.improvedScript.length <= 1400);
      assert.ok(result.reason.length <= 600);
      assert.ok(result.changes.length <= 6);
    },
  },
  {
    name: "diagnostic response includes missing material guidance",
    run: () => {
      const result = buildImproveScriptDiagnosticResponse();

      assert.equal(result.status, "diagnostic");
      assert.match(result.improvedScript, /concrete|payoff|example/i);
      assert.ok(result.missingMaterial);
      assert.ok(result.missingMaterial.length > 0);
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

console.log(`\nImprove Script tests: ${passed}/${tests.length} passed`);
