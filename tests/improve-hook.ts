import assert from "node:assert/strict";

import {
  hasAnyConcreteAnchor,
  isVeryGenericScript,
  parseHookResponse,
} from "../engine/improve-hook";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [
  {
    name: "generic abstract advice should not count as concrete material",
    run: () => {
      const script = [
        "Success is possible for anyone.",
        "You need to stay focused.",
        "Most people give up too early.",
        "Consistency is the key to improvement.",
      ].join("\n");

      assert.equal(hasAnyConcreteAnchor(script), false);

      const genericResult = isVeryGenericScript(script);

      assert.equal(genericResult.isGeneric, true);
    },
  },
  {
    name: "generic motivational lines should force diagnostic hook response",
    run: () => {
      const script = [
        "Success is possible for anyone.",
        "You need to stay focused.",
        "Most people give up too early.",
        "Consistency is the key to improvement.",
      ].join("\n");

      const result = parseHookResponse(
        JSON.stringify({
          hookScore: 40,
          improvedHook:
            "Success becomes possible — but only if you stay focused.",
          reason:
            "The opening needs a stronger curiosity gap.",
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.equal(result.mode, "diagnostic");
      assert.match(
        result.reason,
        /too abstract|specific example|concrete/i
      );
    },
  },
  {
    name: "number anchor allows grounded rewrite material",
    run: () => {
      const script = [
        "Most people miss this detail.",
        "The test lasted 12 seconds before the valve opened.",
        "That delay changed the final result.",
      ].join("\n");

      assert.equal(hasAnyConcreteAnchor(script), true);
      assert.equal(isVeryGenericScript(script).isGeneric, false);
    },
  },
  {
    name: "parseHookResponse rejects a new number not supported by the script anchor",
    run: () => {
      const script = [
        "Most people miss this detail.",
        "The test lasted 12 seconds before the valve opened.",
        "That delay changed the final result.",
      ].join("\n");

      const result = parseHookResponse(
        JSON.stringify({
          hookScore: 45,
          improvedHook:
            "The result changed after 30 seconds — but the cause was hidden.",
          reason:
            "The hook should lead with the strongest number.",
        }),
        script
      );

      assert.equal(result.mode, "rewrite");
      assert.match(result.improvedHook, /12/);
      assert.doesNotMatch(result.improvedHook, /30/);
    },
  },
  {
    name: "named reference anchor is detected structurally",
    run: () => {
      const script = [
        "A sample moved inside Atlas Lab during the pressure test.",
        "The sensor recorded the shift before the chamber opened.",
        "That result changed the final safety decision.",
      ].join("\n");

      assert.equal(hasAnyConcreteAnchor(script), true);
      assert.equal(isVeryGenericScript(script).isGeneric, false);
    },
  },
  {
    name: "cause effect mechanism allows grounded rewrite material",
    run: () => {
      const script = [
        "Most people only notice the final movement.",
        "The valve failed because pressure built inside the chamber.",
        "As a result, the seal opened before the test ended.",
      ].join("\n");

      assert.equal(hasAnyConcreteAnchor(script), true);
      assert.equal(isVeryGenericScript(script).isGeneric, false);
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

console.log(`\nImprove Hook tests: ${passed}/${tests.length} passed`);
