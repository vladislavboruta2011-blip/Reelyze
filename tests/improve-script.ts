import assert from "node:assert/strict";

import { UnusableAIResponseError } from "../engine/improve-hook";
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
    name: "structured editorial decision should be observable in the parsed result",
    run: () => {
      const script = [
        "Most people miss what actually changed the test.",
        "The valve stayed closed for 12 seconds before the pressure escaped.",
        "That delay made the final reading look safer than it really was.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblem:
              "The opening delays the concrete detail that explains the misleading result.",
            primaryProblemEvidence:
              "The valve stayed closed for 12 seconds before the pressure escaped.",
          },
          improvedScript: [
            "The test looked safe for 12 seconds.",
            "But the valve was still holding pressure inside the chamber.",
            "When it finally opened, the final reading changed.",
          ].join("\n"),
          changes: [
            "Moved the 12-second detail into the opening.",
            "Connected the delayed pressure release to the final reading.",
          ],
          reason:
            "The rewrite establishes the misleading result through the concrete timing detail.",
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.deepEqual(result.editorialDecision, {
        strategy: "rewrite",
        primaryProblem:
          "The opening delays the concrete detail that explains the misleading result.",
        primaryProblemEvidence:
          "The valve stayed closed for 12 seconds before the pressure escaped.",
      });
    },
  },
  {
    name: "editorial decision without source evidence should be rejected",
    run: () => {
      const script = [
        "Most people miss what actually changed the test.",
        "The valve stayed closed for 12 seconds before the pressure escaped.",
        "That delay made the final reading look safer than it really was.",
      ].join("\n");

      assert.throws(
        () =>
          parseImproveScriptResponse(
            JSON.stringify({
              editorialDecision: {
                strategy: "rewrite",
                primaryProblem:
                  "The opening delays the concrete timing detail.",
              },
              improvedScript: [
                "The test looked safe for 12 seconds.",
                "But the valve was still holding pressure inside the chamber.",
                "When it finally opened, the final reading changed.",
              ].join("\n"),
              changes: [
                "Moved the timing detail into the opening.",
              ],
              reason:
                "The rewrite establishes the misleading result earlier.",
            }),
            script
          ),
        UnusableAIResponseError
      );
    },
  },
  {
    name: "editorial decision with evidence outside the source should be rejected",
    run: () => {
      const script = [
        "Most people miss what actually changed the test.",
        "The valve stayed closed for 12 seconds before the pressure escaped.",
        "That delay made the final reading look safer than it really was.",
      ].join("\n");

      assert.throws(
        () =>
          parseImproveScriptResponse(
            JSON.stringify({
              editorialDecision: {
                strategy: "rewrite",
                primaryProblem:
                  "The opening delays the concrete timing detail.",
                primaryProblemEvidence:
                  "The chamber cracked before the test began.",
              },
              improvedScript: [
                "The test looked safe for 12 seconds.",
                "But the valve was still holding pressure inside the chamber.",
                "When it finally opened, the final reading changed.",
              ].join("\n"),
              changes: [
                "Moved the timing detail into the opening.",
              ],
              reason:
                "The rewrite establishes the misleading result earlier.",
            }),
            script
          ),
        UnusableAIResponseError
      );
    },
  },
  {
    name: "AI rewrite without observable editorial decision should be rejected",
    run: () => {
      const script = [
        "Most people miss what actually changed the test.",
        "The valve stayed closed for 12 seconds before the pressure escaped.",
        "That delay made the final reading look safer than it really was.",
      ].join("\n");

      assert.throws(
        () =>
          parseImproveScriptResponse(
            JSON.stringify({
              improvedScript: [
                "The test looked safe for 12 seconds.",
                "But the valve was still holding pressure inside the chamber.",
                "When it finally opened, the final reading changed.",
              ].join("\n"),
              changes: [
                "Moved the 12-second detail earlier.",
                "Made the final consequence clearer.",
              ],
              reason:
                "The rewrite moves the concrete timing detail earlier.",
            }),
            script
          ),
        UnusableAIResponseError
      );
    },
  },
  {
    name: "rewrite with only casing punctuation and whitespace changes should be rejected",
    run: () => {
      const script = [
        "The valve stayed closed for 12 seconds.",
        "That delay changed the final reading.",
      ].join("\n");

      assert.throws(
        () =>
          parseImproveScriptResponse(
            JSON.stringify({
              editorialDecision: {
                strategy: "rewrite",
                primaryProblem:
                  "The script needs a more immediate presentation of its concrete result.",
                primaryProblemEvidence:
                  "The valve stayed closed for 12 seconds.",
              },
              improvedScript:
                "the valve stayed closed for 12 seconds — THAT DELAY CHANGED THE FINAL READING!",
              changes: [
                "Changed the presentation of the existing lines.",
              ],
              reason:
                "The rewrite presents the same material more forcefully.",
            }),
            script
          ),
        UnusableAIResponseError
      );
    },
  },
  {
    name: "meaningful compression can preserve sentence order and ending",
    run: () => {
      const script = [
        "The sensor detected smoke, and this was something that happened before the alarm.",
        "The doors locked automatically after that happened.",
        "This meant the workers were trapped inside because they could not get out.",
        "The backup system opened the exit, which is how they escaped.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblem:
              "The original repeats transitions and explains simple consequences with unnecessary wording.",
            primaryProblemEvidence:
              "The doors locked automatically after that happened.",
          },
          improvedScript: [
            "Smoke reached the sensor before the alarm sounded.",
            "The doors locked automatically.",
            "That sealed the workers inside.",
            "They escaped only when the backup system reopened the exit.",
          ].join("\n"),
          changes: [
            "Removed repeated transition wording from the first two steps.",
            "Compressed the trapped-inside explanation without removing its cause.",
            "Preserved the backup-system escape as the final outcome.",
          ],
          reason:
            "The rewrite keeps the original sequence and ending while removing redundant explanation from every step.",
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.match(result.improvedScript, /sealed the workers inside/i);
      assert.match(result.improvedScript, /backup system reopened the exit/i);
      assert.ok(result.improvedScript.length < script.length);
    },
  },
  {
    name: "meaningful clarification can preserve order ending and similar length",
    run: () => {
      const script = [
        "The sensor detected smoke near the exit.",
        "It triggered the lock before the workers reached it.",
        "That trapped them inside.",
        "The backup switch opened it, and they escaped.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblem:
              "Repeated ambiguous pronouns make the lock, exit, and door difficult to distinguish.",
            primaryProblemEvidence:
              "It triggered the lock before the workers reached it.",
          },
          improvedScript: [
            "Smoke near the exit triggered the door lock.",
            "The door locked before the workers reached the exit.",
            "That trapped the workers inside.",
            "The backup switch reopened the door, letting them escape.",
          ].join("\n"),
          changes: [
            "Replaced ambiguous pronouns with the supported door, lock, exit, and workers references.",
            "Made the final escape action identify the door opened by the backup switch.",
          ],
          reason:
            "The rewrite preserves the original sequence and outcome while making every reference immediately clear.",
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.match(result.improvedScript, /door locked/i);
      assert.match(result.improvedScript, /workers reached the exit/i);
      assert.match(result.improvedScript, /reopened the door/i);
    },
  },
  {
    name: "rewrite that changes the supported cause should fall back to diagnostic",
    run: () => {
      const script = [
        "Before we start, you need to understand one important thing.",
        "The valve stayed closed for 12 seconds before pressure forced it open.",
        "That delay changed the final test result.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblem:
              "The generic opening delays the concrete valve event.",
            primaryProblemEvidence:
              "Before we start, you need to understand one important thing.",
          },
          improvedScript: [
            "The valve that changed the final test stayed closed for 12 seconds.",
            "That delay forced it open, changing the result.",
          ].join("\n"),
          changes: [
            "Removed the generic introductory sentence.",
            "Connected the delay directly to the valve opening.",
          ],
          reason:
            "The rewrite makes the cause and result more immediate.",
        }),
        script
      );

      assert.equal(result.status, "diagnostic");
      assert.doesNotMatch(
        result.improvedScript,
        /delay forced it open/i
      );
      assert.match(
        result.reason,
        /cause|causal|meaning|supported|original/i
      );
    },
  },

  {
    name: "rewrite cannot hide a changed cause behind a different causal connector",
    run: () => {
      const script = [
        "Before we start, you need to understand one important thing.",
        "The valve stayed closed for 12 seconds before pressure forced it open.",
        "That delay changed the final test result.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblem:
              "The generic opening delays the concrete valve event.",
            primaryProblemEvidence:
              "Before we start, you need to understand one important thing.",
          },
          improvedScript: [
            "The valve stayed closed for 12 seconds.",
            "That delay caused it to open and changed the final result.",
          ].join("\n"),
          changes: [
            "Removed the generic introductory sentence.",
            "Connected the delay directly to the opening event.",
          ],
          reason:
            "The rewrite presents the event and consequence more directly.",
        }),
        script
      );

      assert.equal(result.status, "diagnostic");
      assert.doesNotMatch(
        result.improvedScript,
        /delay caused it to open/i
      );
      assert.match(
        result.reason,
        /cause|caused|supported event|original script/i
      );
    },
  },

  {
    name: "meaningful causal clarification with low token retention should remain improved",
    run: () => {
      const script = [
        "The cable became tight, which caused the lever to move backward.",
        "The movement of the lever made the latch slide out of its slot.",
        "After the latch moved away, the door was able to swing open.",
        "The team went through the open door and reached the outside.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblem:
              "The original repeats mechanical actions instead of expressing each cause and immediate effect directly.",
            primaryProblemEvidence:
              "The movement of the lever made the latch slide out of its slot.",
          },
          improvedScript: [
            "As the cable tightened, it pulled the lever backward with it.",
            "That backward motion released the latch from the slot.",
            "Once the latch was clear, the door could swing fully open.",
            "The team then passed through the open doorway and finally escaped outside.",
          ].join("\n"),
          changes: [
            "Expressed the cable and lever movement as one direct causal action.",
            "Replaced the repeated lever wording with the supported latch consequence.",
            "Preserved the opened door and outside escape as the final outcome.",
          ],
          reason:
            "The rewrite keeps the original sequence and result while making each mechanical cause lead directly into its consequence.",
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.match(result.improvedScript, /released the latch/i);
      assert.match(result.improvedScript, /door could swing fully open/i);
      assert.match(result.improvedScript, /escaped outside/i);
    },
  },
  {
    name: "production Messi light paraphrase with unchanged progression and payoff should preserve the original",
    run: () => {
      const script = [
        "If Messi had Ronaldo’s vertical jump, how high would he actually reach?",
        "Messi is around 5 feet 7, while Ronaldo is around 6 feet 2.",
        "So even with Ronaldo’s jump, Messi still wouldn’t reach as high as Ronaldo.",
        "But he’d probably score far more headers and be jumping high enough to challenge almost any defender.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblem:
              "The original opening is weak and does not immediately capture the viewer's interest.",
            primaryProblemEvidence:
              "If Messi had Ronaldo’s vertical jump, how high would he actually reach?",
          },
          improvedScript:
            "What if Messi had Ronaldo’s incredible vertical jump? Messi stands at 5 feet 7, while Ronaldo towers at 6 feet 2. Even with Ronaldo’s jump, Messi wouldn’t reach as high as Ronaldo. However, he’d likely score many more headers, jumping high enough to challenge nearly any defender.",
          changes: [
            "Reframed the opening to immediately engage the viewer with a question about the scenario.",
            "Streamlined the progression to create a smoother flow of ideas, connecting Messi's height, Ronaldo's jump, and the potential impact on Messi's game.",
          ],
          reason:
            "The original script's opening was weak and did not immediately capture the viewer's interest. By posing a direct question, the rewrite engages the audience right away.",
        }),
        script
      );

      assert.equal(result.status, "preserve");
      assert.equal(result.improvedScript, script);
      assert.deepEqual(result.changes, []);
    },
  },
  {
    name: "light paraphrase with unchanged progression and payoff should preserve the original",
    run: () => {
      const script = [
        "Most defenders watch the ball when Ronaldo jumps.",
        "But Ronaldo watches the defender.",
        "He waits until they lose balance, then attacks the space above them.",
        "That is why he can reach the ball even when the defender is closer.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblem:
              "The script lacks a strong opening that immediately captures the viewer's attention and clearly connects to the title.",
            primaryProblemEvidence:
              "Most defenders watch the ball when Ronaldo jumps.",
          },
          improvedScript:
            "Ronaldo is a nightmare for defenders in the air. While they focus on the ball, he zeroes in on them. He waits for them to lose their balance, then strikes at the space above. This is how he manages to outjump defenders, even when they're closer to the ball.",
          changes: [
            "Reframed the opening to immediately highlight Ronaldo's aerial threat, making it more engaging.",
            "Streamlined the progression to enhance clarity and flow, ensuring each sentence builds on the last.",
          ],
          reason:
            "The original script's opening was weak and did not effectively hook the viewer. By emphasizing Ronaldo's aerial prowess right away, the rewrite creates a more compelling introduction.",
        }),
        script
      );

      assert.equal(result.status, "preserve");
      assert.equal(result.improvedScript, script);
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
            editorialDecision: {
              strategy: "rewrite",
              primaryProblem:
                "The opening delays the concrete detail that explains the misleading result.",
              primaryProblemEvidence:
                "The valve stayed closed for 12 seconds before the pressure escaped.",
            },
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
    name: "rewrite that replaces an approved refined hook should be rejected",
    run: () => {
      const script = [
        "Before we start, you need to understand one important thing.",
        "The valve stayed closed for 12 seconds before pressure forced it open.",
        "That delay changed the final test result.",
      ].join("\n");

      const refinedHook =
        "The valve stayed closed for 12 seconds before pressure forced it open.";

      assert.throws(
        () =>
          parseImproveScriptResponse(
            JSON.stringify({
              editorialDecision: {
                strategy: "rewrite",
                primaryProblem:
                  "The generic first sentence delays the concrete valve event.",
                primaryProblemEvidence:
                  "Before we start, you need to understand one important thing.",
              },
              improvedScript: [
                "The final test changed after the valve stayed closed for 12 seconds.",
                "Pressure eventually forced it open.",
              ].join("\n"),
              changes: [
                "Removed the generic introductory sentence.",
                "Moved the final test consequence into the opening.",
              ],
              reason:
                "The rewrite removes the generic setup and presents the supported event immediately.",
            }),
            script,
            refinedHook
          ),
        UnusableAIResponseError
      );
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
            editorialDecision: {
              strategy: "rewrite",
              primaryProblem:
                "The opening delays the concrete timing detail.",
              primaryProblemEvidence:
                "The valve stayed closed for 12 seconds before the pressure escaped.",
            },
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
