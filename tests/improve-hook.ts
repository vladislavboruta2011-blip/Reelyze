import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildEarlyDiagnosticResponse,
  buildGenericScriptResponse,
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
  {
    name: "IH-P01 preserves a strong question instead of accepting a cosmetic rewrite",
    run: () => {
      const originalHook =
        "If Messi had Ronaldo's vertical jump, how high would he actually reach?";

      const script = [
        originalHook,
        "Messi is around 5 feet 7, while Ronaldo is around 6 feet 2.",
        "So even with Ronaldo's jump, Messi still wouldn't reach as high as Ronaldo.",
        "But he'd probably score far more headers and be jumping high enough to challenge almost any defender.",
      ].join("\n");

      const result = parseHookResponse(
        JSON.stringify({
          hookScore: 60,
          hookLabel: "Average",
          primaryWeakness: "no-curiosity-gap",
          rewriteStrategy: "scenario",
          originalHook,
          improvedHook:
            "Imagine if Messi had Ronaldo's incredible vertical jump.",
          reason:
            "The rewrite creates a clearer and more compelling question around Messi's jump.",
          hookOptions: [
            {
              type: "scenario",
              text:
                "Imagine if Messi had Ronaldo's incredible vertical jump.",
              whyItWorks: "It makes the scenario more engaging.",
            },
          ],
        }),
        script
      );

      assert.equal(result.status, "good");
      assert.equal(result.improvedHook, originalHook);
    },
  },

  {
    name: "IH-P02 preserves a strong grounded scenario instead of replacing it with a weaker fallback",
    run: () => {
      const originalHook =
        "If Earth stopped spinning, your body would still be moving at over 1,000 miles per hour.";

      const script = [
        originalHook,
        "Everything not firmly attached would keep moving east.",
        "The atmosphere and oceans would continue moving too, causing the greatest immediate destruction.",
      ].join("\n");

      const aiCandidate =
        "Imagine Earth stopping while your body keeps flying forward at incredible speed.";

      const result = parseHookResponse(
        JSON.stringify({
          hookScore: 62,
          hookLabel: "Average",
          primaryWeakness: "not-engaging-enough",
          rewriteStrategy: "scenario",
          originalHook,
          improvedHook: aiCandidate,
          reason:
            "The rewrite makes the scenario feel more immediate and dramatic.",
          hookOptions: [
            {
              type: "scenario",
              text: aiCandidate,
              whyItWorks: "It creates a more vivid opening.",
            },
          ],
        }),
        script
      );

      assert.equal(result.status, "good");
      assert.equal(result.improvedHook, originalHook);
      assert.equal(
        result.reason.toLowerCase().includes("question"),
        false,
        "A declarative scenario must not be described as a question"
      );
    },
  },

  {
    name: "IH-Q01 rejects a false claim that the rewrite added a missing question",
    run: () => {
      const originalHook =
        "Could Messi reach Ronaldo's height with Ronaldo's jump?";

      const script = [
        originalHook,
        "Messi is around 5 feet 7, while Ronaldo is around 6 feet 2.",
        "Their different heights would still affect the final reach.",
      ].join("\n");

      const result = parseHookResponse(
        JSON.stringify({
          hookScore: 65,
          hookLabel: "Average",
          primaryWeakness: "no-curiosity-gap",
          rewriteStrategy: "create-question",
          originalHook,
          improvedHook:
            "Imagine Messi jumping with Ronaldo's vertical leap.",
          reason:
            "The rewrite creates a clear question that the original was missing.",
          hookOptions: [
            {
              type: "create-question",
              text:
                "Imagine Messi jumping with Ronaldo's vertical leap.",
              whyItWorks:
                "It creates a direct question that was absent from the original.",
            },
          ],
        }),
        script
      );

      assert.equal(result.status, "good");
      assert.equal(result.improvedHook, originalHook);
      assert.match(
        result.reason,
        /already[^.]*question|question[^.]*already/i
      );
      assert.doesNotMatch(
        result.reason,
        /creates?[^.]*question|question[^.]*missing|missing[^.]*question|absent[^.]*question/i
      );
    },
  },

  {
    name: "IH-R01 removes a generic delay and leads with supported material",
    run: () => {
      const originalHook =
        "Before we start, you need to understand one important thing.";

      const script = [
        originalHook,
        "The valve stayed closed for 12 seconds before pressure forced it open.",
        "That delay changed the final test result.",
      ].join("\n");

      const improvedHook =
        "The valve stayed closed for 12 seconds before pressure forced it open.";

      const result = parseHookResponse(
        JSON.stringify({
          hookScore: 45,
          hookLabel: "Weak",
          primaryWeakness: "delayed-topic",
          rewriteStrategy: "lead-with-event",
          originalHook,
          improvedHook,
          reason:
            "The original delays the topic with a generic introduction. The rewrite leads directly with the supported 12-second valve event.",
          hookOptions: [
            {
              type: "lead-with-event",
              text: improvedHook,
              whyItWorks:
                "It removes the generic preamble and immediately introduces the concrete event.",
            },
          ],
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.equal(result.mode, "rewrite");
      assert.equal(result.improvedHook, improvedHook);
      assert.notEqual(result.improvedHook, originalHook);
    },
  },

  {
    name: "IH-R02 resolves an unclear subject without forcing a secondary number anchor",
    run: () => {
      const originalHook =
        "He broke the record after changing one part of his start.";

      const script = [
        originalHook,
        "Noah moved his hips higher in the blocks before the final race.",
        "He cut 0.18 seconds from his previous time.",
      ].join("\n");

      const improvedHook =
        "Noah broke the record after moving his hips higher in the blocks.";

      const result = parseHookResponse(
        JSON.stringify({
          hookScore: 55,
          hookLabel: "Average",
          primaryWeakness: "unclear-subject",
          rewriteStrategy: "name-the-subject",
          originalHook,
          improvedHook,
          reason:
            "The original begins with an unclear pronoun. The rewrite names Noah immediately and connects him to the supported change in his start.",
          hookOptions: [
            {
              type: "name-the-subject",
              text: improvedHook,
              whyItWorks:
                "It resolves the unclear subject without inventing a new fact.",
            },
          ],
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.equal(result.mode, "rewrite");
      assert.equal(result.improvedHook, improvedHook);
      assert.equal(result.improvedHook.includes("18 seconds"), false);
    },
  },

  {
    name: "IH-R05 allows a meaningful high-overlap clarification",
    run: () => {
      const originalHook =
        "Could Messi reach Ronaldo's height if he had his jump?";

      const script = [
        originalHook,
        "Messi is around 5 feet 7, while Ronaldo is around 6 feet 2.",
        "Even with the same vertical jump, their different heights would still affect the final reach.",
      ].join("\n");

      const improvedHook =
        "Could Messi reach Ronaldo's height with Ronaldo's jump?";

      const result = parseHookResponse(
        JSON.stringify({
          hookScore: 68,
          hookLabel: "Average",
          primaryWeakness: "ambiguous-reference",
          rewriteStrategy: "clarify-reference",
          originalHook,
          improvedHook,
          reason:
            "The rewrite replaces the ambiguous phrase 'his jump' with Ronaldo's name while preserving the original question.",
          hookOptions: [
            {
              type: "clarify-reference",
              text: improvedHook,
              whyItWorks:
                "It resolves which athlete owns the jump without changing the supported scenario.",
            },
          ],
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.equal(result.mode, "rewrite");
      assert.equal(result.improvedHook, improvedHook);
    },
  },

  {
    name: "IH-R06 accepts a supported causal mechanism instead of a templated fallback",
    run: () => {
      const originalHook =
        "The bridge collapse started with one small detail.";

      const script = [
        originalHook,
        "The bridge had stood for 80 years.",
        "One missing pin allowed a joint to twist under load.",
        "That movement triggered the collapse.",
      ].join("\n");

      const improvedHook =
        "One missing pin allowed a joint to twist under load, triggering the collapse.";

      const result = parseHookResponse(
        JSON.stringify({
          hookScore: 58,
          hookLabel: "Average",
          primaryWeakness: "generic-opening",
          rewriteStrategy: "lead-with-causal-mechanism",
          originalHook,
          improvedHook,
          reason:
            "The original only hints at a small detail. The rewrite leads with the supported missing-pin mechanism that caused the collapse.",
          hookOptions: [
            {
              type: "lead-with-causal-mechanism",
              text: improvedHook,
              whyItWorks:
                "It replaces a secondary age detail with the supported missing-pin mechanism.",
            },
          ],
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.equal(result.mode, "rewrite");
      assert.equal(
        result.improvedHook,
        improvedHook,
        "A secondary number in the body must not override a stronger supported causal mechanism"
      );
      assert.equal(
        result.improvedHook.includes("80 years"),
        false
      );
      assert.equal(
        result.improvedHook.includes("most people never realise"),
        false
      );
    },
  },

  {
    name: "parseHookResponse rejects a candidate that reverses the supported spatial relationship",
    run: () => {
      const originalHook =
        "The ocean is deeper than most people realise.";

      const script = [
        originalHook,
        "Even Mount Everest would still have 1 mile of water above its peak.",
        "The comparison shows how deep the ocean really is.",
      ].join("\n");

      const distortedHook =
        "Drop Mount Everest into the ocean and it would disappear under 1 mile of water.";

      const rejectedCandidateReason =
        "The rewrite turns the comparison into a more dramatic visual.";

      const result = parseHookResponse(
        JSON.stringify({
          hookScore: 55,
          hookLabel: "Average",
          primaryWeakness: "too-generic",
          rewriteStrategy: "lead-with-visual",
          originalHook,
          improvedHook: distortedHook,
          reason: rejectedCandidateReason,
          hookOptions: [],
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.notEqual(
        result.improvedHook,
        distortedHook,
        "A candidate that reverses the supported spatial relationship must not survive final validation"
      );
      assert.doesNotMatch(
        result.improvedHook,
        /drop[^.]*Everest[^.]*disappear|Everest[^.]*disappear/i
      );
      assert.notEqual(
        result.reason,
        rejectedCandidateReason,
        "When the parser replaces a rejected candidate, it must regenerate the reason for the hook it actually returns"
      );
    },
  },

  {
    name: "Improve Hook prompt uses universal editorial selection instead of absolute anchor rules",
    run: () => {
      const routeSource = readFileSync(
        "app/api/improve/route.ts",
        "utf8"
      );

      assert.doesNotMatch(
        routeSource,
        /If found, this is ALWAYS the anchor/i,
        "A number must not automatically outrank every other supported editorial angle"
      );

      assert.doesNotMatch(
        routeSource,
        /CRITICAL NUMBER RULE/i,
        "The prompt must not contain an absolute number-first rule"
      );

      assert.doesNotMatch(
        routeSource,
        /The improvedHook MUST use the anchorMaterial/i,
        "A valid rewrite must not be forced to use one preselected anchor"
      );

      assert.doesNotMatch(
        routeSource,
        /NEVER return a rewrite sharing 80%\+ of words/i,
        "High lexical overlap must not automatically invalidate a meaningful clarification"
      );

      assert.doesNotMatch(
        routeSource,
        /Step 1 — ANCHOR EXTRACTION/i,
        "The user prompt must begin with editorial diagnosis rather than mandatory anchor extraction"
      );

      assert.doesNotMatch(
        routeSource,
        /that is the anchor — period/i,
        "A number in the script body must not automatically become the selected angle"
      );

      assert.doesNotMatch(
        routeSource,
        /All 3 options must include the anchor value/i,
        "Hook options must be allowed to explore different supported editorial strategies"
      );

      assert.doesNotMatch(
        routeSource,
        /If the anchor is a specific number with a unit, the improvedHook must contain that number and unit/i,
        "The final hook must not be forced to retain a secondary number"
      );

      assert.doesNotMatch(
        routeSource,
        /explain why the original first line failed to use it/i,
        "The reason must not assume in advance that failing to use one anchor is the real weakness"
      );

      assert.match(
        routeSource,
        /"mechanism"/i,
        "The anchorMaterial schema must support a causal mechanism selected by the editorial diagnosis"
      );

      assert.match(
        routeSource,
        /"namedReference"/i,
        "The anchorMaterial schema must support a named reference used to resolve ambiguity"
      );

      assert.match(
        routeSource,
        /materially better opening experience/i,
        "The prompt must evaluate whether the candidate materially improves the viewer experience"
      );

      assert.match(
        routeSource,
        /observable editorial operation/i,
        "The prompt must require a visible editorial operation rather than cosmetic difference"
      );
    },
  },
  {
    name: "locale-aware diagnostic responses stay in the requested language",
    run: () => {
      const enEarly = buildEarlyDiagnosticResponse("en");
      const ruEarly = buildEarlyDiagnosticResponse("ru");
      const defaultEarly = buildEarlyDiagnosticResponse();

      assert.equal(defaultEarly.reason, enEarly.reason);
      assert.doesNotMatch(enEarly.reason, /[Ѐ-ӿ]/);
      assert.match(ruEarly.reason, /[Ѐ-ӿ]/);
      assert.doesNotMatch(enEarly.improvedHook, /[Ѐ-ӿ]/);
      assert.match(ruEarly.improvedHook, /[Ѐ-ӿ]/);

      const enGeneric = buildGenericScriptResponse("en");
      const ruGeneric = buildGenericScriptResponse("ru");

      assert.doesNotMatch(enGeneric.reason, /[Ѐ-ӿ]/);
      assert.match(ruGeneric.reason, /[Ѐ-ӿ]/);
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
