import assert from "node:assert/strict";

import { UnusableAIResponseError } from "../engine/improve-hook";
import {
  boundImproveScriptResult,
  buildImproveScriptDiagnosticResponse,
  buildImproveScriptPreserveResponse,
  parseImproveScriptResponse,
  shouldDiagnoseImproveScript,
  type ImproveScriptResult,
} from "../engine/improve-script";

// The exact grounded Ronaldo script from the diagnosed false-diagnostic
// regression: a specific measurement (9 feet 7 inches), a grounded
// comparison (7 feet 6 inches), a calculated difference already stated in
// the script (roughly 2 feet), and a delivered payoff (why the jump is
// unusual) — adequate material for a real "improved" outcome, not
// "insufficient grounding".
const RONALDO_GROUNDED_SCRIPT = [
  "Most people would never expect Cristiano Ronaldo’s head to reach around 9 feet 7 inches above the ground.",
  "An average person jumping might reach about 7 feet 6 inches.",
  "That means Ronaldo reached roughly 2 feet higher, which is what made the jump so unusual.",
].join(" ");

const RONALDO_GROUNDED_PRIMARY_PROBLEM = {
  scope: "hook",
  problem:
    "The opening sentence states a concrete cause but defers its consequence to the next sentence, reducing hook immediacy and delivery alignment.",
  evidence:
    "Most people would never expect Cristiano Ronaldo’s head to reach around 9 feet 7 inches above the ground.",
};

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
            primaryProblemScope: "whole_script",
            primaryProblem:
              "The opening delays the concrete detail that explains the misleading result.",
            primaryProblemEvidence:
              "The valve stayed closed for 12 seconds before the pressure escaped.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
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
        primaryProblemScope: "whole_script",
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
                primaryProblemScope: "whole_script",
                primaryProblem:
                  "The opening delays the concrete timing detail.",
              },
              candidateAudit: {
                resolvedPrimaryProblem: true,
                candidateMateriallyBetter: true,
                regressionIntroduced: false,
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
                primaryProblemScope: "whole_script",
                primaryProblem:
                  "The opening delays the concrete timing detail.",
                primaryProblemEvidence:
                  "The chamber cracked before the test began.",
              },
              candidateAudit: {
                resolvedPrimaryProblem: true,
                candidateMateriallyBetter: true,
                regressionIntroduced: false,
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
    name: "AI-selected preserve should return the exact original without inventing a rewrite problem",
    run: () => {
      const script = [
        "An entire village vanished overnight.",
        "The next morning, every house was still standing and every table was still set.",
        "But not a single person was found.",
        "To this day, nobody knows where they went.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "preserve",
          },
        }),
        script
      );

      assert.equal(result.status, "preserve");
      assert.equal(result.improvedScript, script);
      assert.deepEqual(result.changes, []);
      assert.ok(result.reason.length > 0);
      assert.equal(result.editorialDecision, undefined);
    },
  },
  {
    name: "AI-selected preserve should ignore conflicting generated fields",
    run: () => {
      const script = [
        "An entire village vanished overnight.",
        "The next morning, every house was still standing and every table was still set.",
        "But not a single person was found.",
        "To this day, nobody knows where they went.",
      ].join("\n");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "preserve",
          },
          improvedScript:
            "In 1924, a village disappeared under mysterious circumstances.",
          changes: [
            "Added historical context.",
            "Reframed the opening.",
          ],
          reason:
            "The rewrite adds context and creates a stronger introduction.",
        }),
        script
      );

      assert.equal(result.status, "preserve");
      assert.equal(result.improvedScript, script);
      assert.deepEqual(result.changes, []);
      assert.doesNotMatch(result.reason, /historical context|stronger introduction/i);
      assert.equal(result.editorialDecision, undefined);
    },
  },
  {
    name: "rewrite with only casing punctuation and whitespace changes resolves to diagnostic instead of failing",
    run: () => {
      const script = [
        "The valve stayed closed for 12 seconds.",
        "That delay changed the final reading.",
      ].join("\n");

      // A surface-only rewrite is not a material improvement — the model
      // itself diagnosed a real primaryProblem (that is why it chose
      // "rewrite"), but its own candidate made no actual change, so the
      // diagnosed weakness remains unresolved. That is a diagnostic
      // outcome, not "the original is already fine" — not an opaque
      // failure either.
      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "whole_script",
            primaryProblem:
              "The script needs a more immediate presentation of its concrete result.",
            primaryProblemEvidence:
              "The valve stayed closed for 12 seconds.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
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
      );

      // The original already has concrete material ("12 seconds") — this is
      // a candidate-quality failure, not source insufficiency, so it must
      // NOT claim material is missing.
      assert.equal(result.status, "diagnostic");
      assert.notEqual(result.improvedScript, script);
      assert.equal(result.missingMaterial, undefined);
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
            primaryProblemScope: "whole_script",
            primaryProblem:
              "The original repeats transitions and explains simple consequences with unnecessary wording.",
            primaryProblemEvidence:
              "The doors locked automatically after that happened.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
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
            primaryProblemScope: "whole_script",
            primaryProblem:
              "Repeated ambiguous pronouns make the lock, exit, and door difficult to distinguish.",
            primaryProblemEvidence:
              "It triggered the lock before the workers reached it.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
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
            primaryProblemScope: "whole_script",
            primaryProblem:
              "The generic opening delays the concrete valve event.",
            primaryProblemEvidence:
              "Before we start, you need to understand one important thing.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
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
            primaryProblemScope: "whole_script",
            primaryProblem:
              "The generic opening delays the concrete valve event.",
            primaryProblemEvidence:
              "Before we start, you need to understand one important thing.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
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
            primaryProblemScope: "whole_script",
            primaryProblem:
              "The original repeats mechanical actions instead of expressing each cause and immediate effect directly.",
            primaryProblemEvidence:
              "The movement of the lever made the latch slide out of its slot.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
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
    name: "production Messi light paraphrase with unchanged progression and payoff resolves to diagnostic",
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
            primaryProblemScope: "whole_script",
            primaryProblem:
              "The original opening is weak and does not immediately capture the viewer's interest.",
            primaryProblemEvidence:
              "If Messi had Ronaldo’s vertical jump, how high would he actually reach?",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
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

      assert.equal(result.status, "diagnostic");
      assert.notEqual(result.improvedScript, script);
    },
  },
  {
    name: "light paraphrase with unchanged progression and payoff resolves to diagnostic",
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
            primaryProblemScope: "whole_script",
            primaryProblem:
              "The script lacks a strong opening that immediately captures the viewer's attention and clearly connects to the title.",
            primaryProblemEvidence:
              "Most defenders watch the ball when Ronaldo jumps.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
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

      assert.equal(result.status, "diagnostic");
      assert.notEqual(result.improvedScript, script);
    },
  },
    {
      name: "candidate audit vetoes rewrites that do not prove a material improvement: regression protects the original (preserve), everything else is an unresolved diagnosed weakness (diagnostic)",
      run: () => {
        const script = [
          "Most people miss what actually changed the test.",
          "The valve stayed closed for 12 seconds before the pressure escaped.",
          "That delay made the final reading look safer than it really was.",
        ].join("\n");

        const baseResponse = {
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "hook",
            primaryProblem:
              "The opening delays the concrete timing detail.",
            primaryProblemEvidence:
              "The valve stayed closed for 12 seconds before the pressure escaped.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript: [
            "The test looked safe for 12 seconds.",
            "But the valve was still holding pressure inside the chamber.",
            "When it finally opened, the final reading changed.",
          ].join("\n"),
          changes: [
            "Moved the supported 12-second detail into the opening.",
            "Connected the delayed pressure release to the final reading.",
          ],
          reason:
            "The rewrite presents the supported timing detail earlier and makes the result easier to follow.",
        };

        const audits = [
          {
            resolvedPrimaryProblem: false,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: false,
            regressionIntroduced: false,
          },
          {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: true,
          },
        ];

        const results = audits.map((candidateAudit) =>
          parseImproveScriptResponse(
            JSON.stringify({
              ...baseResponse,
              candidateAudit,
            }),
            script
          )
        );

        // !resolvedPrimaryProblem and !candidateMateriallyBetter (with no
        // regression) both mean the diagnosed weakness is still unresolved
        // — diagnostic, not preserve. regressionIntroduced specifically
        // means the candidate made something WORSE, which is exactly the
        // "strong original, worse candidate" case that stays preserve.
        assert.deepEqual(
          results.map((result) => result.status),
          ["diagnostic", "diagnostic", "preserve"]
        );
        assert.notEqual(results[0].improvedScript, script);
        assert.notEqual(results[1].improvedScript, script);
        assert.equal(results[2].improvedScript, script);
      },
    },
    {
      name: "body-scoped rewrite that changes a protected original hook resolves to diagnostic",
      run: () => {
        const script = [
          "Haaland is NOT HUMAN and I can PROVE IT.",
          "In one match, he reached 8 feet 2 inches and met the cross above the defender.",
          "The next sentence repeats that he was above the defender without adding new evidence.",
          "The ending repeats the 8-foot-2 measurement instead of explaining why it mattered.",
        ].join("\n");

        const result = parseImproveScriptResponse(
          JSON.stringify({
            editorialDecision: {
              strategy: "rewrite",
              primaryProblemScope: "body",
              primaryProblem:
                "The body repeats the same jump evidence instead of progressing toward the promised proof.",
              primaryProblemEvidence:
                "The next sentence repeats that he was above the defender without adding new evidence.",
            },
            candidateAudit: {
              resolvedPrimaryProblem: true,
              candidateMateriallyBetter: true,
              regressionIntroduced: false,
            },
            improvedScript: [
              "Is Haaland even human?",
              "In one match, he reached 8 feet 2 inches and met the cross above the defender.",
              "That measurement becomes the final proof instead of being repeated across the body.",
            ].join("\n"),
            changes: [
              "Removed the repeated body explanation.",
              "Kept the supported 8-foot-2 measurement as the final proof.",
            ],
            reason:
              "The rewrite removes repetition from the body while preserving the supported measurement and result.",
          }),
          script
        );

        // The diagnosed problem was in the body, not the hook — a candidate
        // that changes the (already-fine) hook anyway is unsafe, but the
        // body/payoff weakness itself is real and still unresolved, so this
        // is diagnostic, not "the original needs no changes."
        assert.equal(result.status, "diagnostic");
        assert.notEqual(result.improvedScript, script);
      },
    },
    {
      name: "body-scoped rewrite that preserves the original hook can remain improved",
      run: () => {
        const script = [
          "Haaland is NOT HUMAN and I can PROVE IT.",
          "In one match, he reached 8 feet 2 inches and met the cross above the defender.",
          "The next sentence repeats that he was above the defender without adding new evidence.",
          "The ending repeats the same jump instead of completing the proof.",
        ].join("\n");

        const result = parseImproveScriptResponse(
          JSON.stringify({
            editorialDecision: {
              strategy: "rewrite",
              primaryProblemScope: "body",
              primaryProblem:
                "The body repeats the same jump evidence instead of progressing toward the promised proof.",
              primaryProblemEvidence:
                "The next sentence repeats that he was above the defender without adding new evidence.",
            },
            candidateAudit: {
              resolvedPrimaryProblem: true,
              candidateMateriallyBetter: true,
              regressionIntroduced: false,
            },
            improvedScript: [
              "Haaland is NOT HUMAN and I can PROVE IT.",
              "In one match, he reached 8 feet 2 inches and met the cross above the defender.",
              "That was the proof promised in the opening.",
            ].join("\n"),
            changes: [
              "Removed the repeated body explanation.",
              "Delivered the supported measurement as the proof.",
            ],
            reason:
              "The rewrite preserves the original hook while removing repetition from the body.",
          }),
          script
        );

        assert.equal(result.status, "improved");
        assert.equal(
          result.improvedScript.split("\n")[0],
          "Haaland is NOT HUMAN and I can PROVE IT."
        );
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
              primaryProblemScope: "whole_script",
              primaryProblem:
                "The opening delays the concrete detail that explains the misleading result.",
              primaryProblemEvidence:
                "The valve stayed closed for 12 seconds before the pressure escaped.",
            },
            candidateAudit: {
              resolvedPrimaryProblem: true,
              candidateMateriallyBetter: true,
              regressionIntroduced: false,
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
    name: "rewrite that restructures (rather than repeats verbatim) an approved refined hook is accepted when it still reuses the same grounded material",
    run: () => {
      const script = [
        "Before we start, you need to understand one important thing.",
        "The valve stayed closed for 12 seconds before pressure forced it open.",
        "That delay changed the final test result.",
      ].join("\n");

      const refinedHook =
        "The valve stayed closed for 12 seconds before pressure forced it open.";

      // The candidate does not repeat the approved hook verbatim, but it
      // reuses the exact same grounded fact (12 seconds, the valve,
      // pressure forcing it open) while removing the generic filler
      // opening — a legitimate restructuring, not an abandoned hook (see
      // abandonsApprovedRefinedHook).
      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "whole_script",
            primaryProblem:
              "The generic first sentence delays the concrete valve event.",
            primaryProblemEvidence:
              "Before we start, you need to understand one important thing.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
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
      );

      assert.equal(result.status, "improved");
      assert.match(result.improvedScript, /12 seconds/);
    },
  },
  {
    name: "a model-invented 'Did you know' question hook cannot silently replace an approved direct factual refined hook — resolves to diagnostic instead of failing",
    run: () => {
      const script = [
        "Here is a story about a bakery.",
        "Last month, a small bakery raised the price of every pastry by 40%.",
        "Within one week, customer visits dropped by half.",
        "The owner restored the old prices and offered returning customers a free pastry.",
        "By Friday, sales were almost back to normal.",
      ].join(" ");

      const refinedHook =
        "A small bakery raised the price of every pastry by 40%, and within one week, customer visits dropped by half.";

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "hook",
            primaryProblem:
              "The generic opening delays the concrete price-increase event.",
            primaryProblemEvidence:
              "Here is a story about a bakery.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript: [
            "Did you know that when a small bakery raised the price of every pastry by 40%, customer visits dropped by half within a week?",
            "The owner restored the old prices and offered returning customers a free pastry.",
            "By Friday, sales were almost back to normal.",
          ].join(" "),
          changes: [
            "Rewrote the opening as a question hook.",
          ],
          reason:
            "The rewrite opens with a question to draw in the viewer.",
        }),
        script,
        refinedHook
      );

      // A question-style opener must not silently override an approved
      // direct factual refined hook — the safe outcome is an honest
      // diagnostic (the hook weakness is real and still unresolved), never
      // the model's unapproved substitute and never a failure.
      assert.equal(result.status, "diagnostic");
      assert.notEqual(result.improvedScript, script);
      assert.equal(
        result.improvedScript.includes("Did you know"),
        false
      );
    },
  },
  {
    name: "rewrite that opens with the approved direct factual refined hook verbatim is accepted, without being forced into a question",
    run: () => {
      const script = [
        "Here is a story about a bakery.",
        "Last month, a small bakery raised the price of every pastry by 40%.",
        "Within one week, customer visits dropped by half.",
        "The owner restored the old prices and offered returning customers a free pastry.",
        "By Friday, sales were almost back to normal.",
      ].join(" ");

      const refinedHook =
        "A small bakery raised the price of every pastry by 40%, and within one week, customer visits dropped by half.";

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "hook",
            primaryProblem:
              "The generic opening delays the concrete price-increase event.",
            primaryProblemEvidence:
              "Here is a story about a bakery.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript: [
            `${refinedHook}`,
            "The owner restored the old prices and offered returning customers a free pastry.",
            "By Friday, sales were almost back to normal.",
          ].join(" "),
          changes: [
            "Opened directly with the approved refined hook instead of the generic story announcement.",
          ],
          reason:
            "The rewrite leads with the concrete price-increase event already approved as the refined hook.",
        }),
        script,
        refinedHook
      );

      assert.equal(result.status, "improved");
      assert.ok(result.improvedScript.startsWith(refinedHook));
      assert.equal(result.improvedScript.trim().includes("?"), false);
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
              primaryProblemScope: "whole_script",
              primaryProblem:
                "The opening delays the concrete timing detail.",
              primaryProblemEvidence:
                "The valve stayed closed for 12 seconds before the pressure escaped.",
            },
            candidateAudit: {
              resolvedPrimaryProblem: true,
              candidateMateriallyBetter: true,
              regressionIntroduced: false,
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
  {
    name: "locale-aware diagnostic and preserve responses stay in the requested language, improvedScript stays in the script's language",
    run: () => {
      const CYRILLIC = /[Ѐ-ӿ]/;

      const enDiagnostic = buildImproveScriptDiagnosticResponse("en");
      const ruDiagnostic = buildImproveScriptDiagnosticResponse("ru");
      const defaultDiagnostic = buildImproveScriptDiagnosticResponse();

      assert.equal(defaultDiagnostic.reason, enDiagnostic.reason);
      assert.doesNotMatch(enDiagnostic.reason, CYRILLIC);
      assert.match(ruDiagnostic.reason, CYRILLIC);
      assert.doesNotMatch(enDiagnostic.changes[0], CYRILLIC);
      assert.match(ruDiagnostic.changes[0], CYRILLIC);
      assert.ok(ruDiagnostic.missingMaterial);
      assert.match(ruDiagnostic.missingMaterial!.join(" "), CYRILLIC);

      const originalEnglishScript =
        "This is the original English script that must never be translated.";

      const enPreserve = buildImproveScriptPreserveResponse(
        originalEnglishScript,
        "en"
      );
      const ruPreserve = buildImproveScriptPreserveResponse(
        originalEnglishScript,
        "ru"
      );

      // The explanation language changes...
      assert.doesNotMatch(enPreserve.reason, CYRILLIC);
      assert.match(ruPreserve.reason, CYRILLIC);

      // ...but improvedScript always stays exactly the original script,
      // regardless of the UI locale.
      assert.equal(enPreserve.improvedScript, originalEnglishScript);
      assert.equal(ruPreserve.improvedScript, originalEnglishScript);
    },
  },
  {
    name: "refined-hook enforcement resolves a mismatched question-style rewrite to diagnostic identically under en and ru locale",
    run: () => {
      const script = [
        "Here is a story about a bakery.",
        "Last month, a small bakery raised the price of every pastry by 40%.",
        "Within one week, customer visits dropped by half.",
      ].join(" ");

      const refinedHook =
        "A small bakery raised the price of every pastry by 40%, and within one week, customer visits dropped by half.";

      const buildMismatchedResponse = () =>
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "hook",
            primaryProblem:
              "The generic opening delays the concrete price-increase event.",
            primaryProblemEvidence:
              "Here is a story about a bakery.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript:
            "Did you know a bakery once raised its prices by 40 percent?",
          changes: ["Rewrote the opening as a question hook."],
          reason:
            "The rewrite opens with a question to draw in the viewer.",
        });

      const enResult = parseImproveScriptResponse(
        buildMismatchedResponse(),
        script,
        refinedHook,
        false,
        "en"
      );
      const ruResult = parseImproveScriptResponse(
        buildMismatchedResponse(),
        script,
        refinedHook,
        false,
        "ru"
      );

      assert.equal(enResult.status, "diagnostic");
      assert.equal(ruResult.status, "diagnostic");
      // improvedScript is never the model's unapproved substitute, and the
      // diagnostic guidance text itself is locale-appropriate.
      assert.notEqual(enResult.improvedScript, script);
      assert.notEqual(ruResult.improvedScript, script);
      assert.doesNotMatch(enResult.improvedScript, /[Ѐ-ӿ]/);
      assert.match(ruResult.improvedScript, /[Ѐ-ӿ]/);
    },
  },

  // ── Phase 8 regression matrix: Ronaldo script + generalization ────────
  {
    name: "[Matrix A] Weak Ronaldo script + insufficient grounded material resolves to diagnostic, never preserve, never an unchanged-original-as-improved result",
    run: () => {
      const script = [
        "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
        "He trained for many years and became one of the best footballers in the world.",
        "People admire his discipline, speed, and jumping ability.",
        "But the most surprising part is how much higher he could jump than an average person.",
      ].join(" ");

      // The model attempted "rewrite" (it diagnosed a real primary problem —
      // the generic opening), but its own candidate only relocates the same
      // vague "much higher than an average person" claim — no new concrete
      // material, exactly the diagnosed live regression.
      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "hook",
            primaryProblem:
              "The opening is a generic topic announcement instead of leading with the surprising jumping-ability fact.",
            primaryProblemEvidence:
              "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: false,
            candidateMateriallyBetter: false,
            regressionIntroduced: false,
          },
          improvedScript: [
            "Cristiano Ronaldo can jump much higher than an average person.",
            "He trained for many years and became one of the best footballers in the world.",
            "People admire his discipline, speed, and jumping ability.",
          ].join(" "),
          changes: ["Moved the surprising claim to the opening."],
          reason: "The rewrite leads with the surprising claim instead of a generic announcement.",
        }),
        script
      );

      assert.equal(result.status, "diagnostic");
      assert.notEqual(result.status, "preserve");
      assert.notEqual(
        result.improvedScript,
        script,
        "A diagnostic result must never present the unchanged weak original as the (implicitly successful) result"
      );
      assert.ok(result.missingMaterial && result.missingMaterial.length > 0);
      assert.match(result.reason, /concrete|payoff|unsupported|too broad/i);
    },
  },
  {
    name: "[Matrix D] Strong original + a candidate that actively regresses it still resolves to preserve, with an \"already effective\" explanation, not \"the model failed\"",
    run: () => {
      const script = [
        "Nobody expected the bridge to collapse in under four seconds.",
        "Investigators found a single bolt had sheared under normal load.",
        "That one bolt was rated for half the weight the bridge actually carried.",
      ].join(" ");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "payoff",
            primaryProblem:
              "The ending could land slightly more forcefully.",
            primaryProblemEvidence:
              "That one bolt was rated for half the weight the bridge actually carried.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            // The candidate weakened an existing strength (removed the
            // concrete "four seconds" detail) — a genuine regression.
            regressionIntroduced: true,
          },
          improvedScript: [
            "Nobody expected the bridge to collapse so fast.",
            "Investigators found a single bolt had sheared under normal load.",
            "That bolt could not handle the real weight.",
          ].join(" "),
          changes: ["Rephrased the ending."],
          reason: "The rewrite makes the ending punchier.",
        }),
        script
      );

      assert.equal(result.status, "preserve");
      assert.equal(result.improvedScript, script);
      assert.match(result.reason, /already works well|not add meaningful value/i);
      assert.doesNotMatch(result.reason, /failed|could not/i);
    },
  },
  {
    name: "[Matrix E] Weak Ronaldo script + a genuinely grounded rewrite (existing measurement pulled forward) remains improved",
    run: () => {
      const script = [
        "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
        "He can jump 80 centimeters higher than an average person.",
        "People admire his discipline, speed, and jumping ability.",
      ].join(" ");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "hook",
            primaryProblem:
              "The opening is a generic topic announcement instead of leading with the concrete jump measurement.",
            primaryProblemEvidence:
              "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript: [
            "Cristiano Ronaldo can jump 80 centimeters higher than an average person.",
            "People admire his discipline, speed, and jumping ability.",
          ].join(" "),
          changes: [
            "Led with the existing 80-centimeter measurement instead of the generic announcement.",
          ],
          reason:
            "The rewrite leads with the concrete, already-supported measurement.",
        }),
        script
      );

      assert.equal(result.status, "improved");
      assert.match(result.improvedScript, /80 centimeters/);
    },
  },
  {
    name: "[Matrix F] A candidate that invents an unsupported fact for the weak Ronaldo script is still diagnostic (via the unsupported-number safety check), never fabricated as a rewrite",
    run: () => {
      const script = [
        "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
        "He trained for many years and became one of the best footballers in the world.",
        "But the most surprising part is how much higher he could jump than an average person.",
      ].join(" ");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "hook",
            primaryProblem:
              "The opening is a generic topic announcement.",
            primaryProblemEvidence:
              "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript: [
            "Cristiano Ronaldo can jump 78 centimeters higher than an average person.",
            "He trained for many years and became one of the best footballers in the world.",
          ].join(" "),
          changes: ["Added the exact jump measurement."],
          reason: "The rewrite adds the specific measurement.",
        }),
        script
      );

      assert.equal(result.status, "diagnostic");
      assert.doesNotMatch(result.improvedScript, /78 centimeters/);
    },
  },
  {
    // Manual-testing regression (Finding A): a safety-violation rejection
    // (unsupported number/cause/hedge) currently reaches the
    // candidate-quality diagnostic bucket unconditionally, via
    // buildSafetyViolationDiagnosticResponse, WITHOUT ever checking whether
    // the original script actually contains hard-anchor material — unlike
    // buildFailedCandidateDiagnosticResponse's audit-failure path, which
    // does check. For a genuinely vague, anchor-free original, this
    // produces a false "you have enough material, try again" diagnostic
    // instead of the honest "add concrete material" diagnostic.
    name: "[Matrix H] A genuinely vague, anchor-free original where the candidate fabricates a number still resolves to the source-insufficient diagnostic (missingMaterial present), not the candidate-quality bucket",
    run: () => {
      const script = [
        "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
        "He trained for many years and became one of the best footballers in the world.",
        "People admire his discipline, speed, and jumping ability.",
        "But the most surprising part is how much higher he could jump than an average person.",
      ].join(" ");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "hook",
            primaryProblem:
              "The opening is a generic topic announcement.",
            primaryProblemEvidence:
              "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript:
            "Cristiano Ronaldo can jump 78 centimeters higher than an average person.",
          changes: ["Added the specific jump measurement."],
          reason: "The rewrite adds the specific measurement.",
        }),
        script
      );

      assert.equal(result.status, "diagnostic");
      assert.doesNotMatch(result.improvedScript, /78 centimeters/);
      assert.ok(
        result.missingMaterial && result.missingMaterial.length > 0,
        "A genuinely anchor-free original must resolve to the source-insufficient diagnostic (non-empty missingMaterial), not the candidate-quality bucket"
      );
      assert.doesNotMatch(
        result.reason,
        /enough material|meaningfully stronger this time/i
      );
    },
  },
  {
    // Phase 4 requirement: hard-anchor classification must not be fooled by
    // vague duration/comparison language OR by a bare unit word with no
    // actual quantity attached, while still recognizing genuine numbers,
    // number+unit pairs, and supported causal statements. Every case below
    // uses an identical failed candidateAudit (all false) so the ONLY
    // variable is whether the ORIGINAL script itself contains hard-anchor
    // material — isolating containsHardAnchorMaterial's classification
    // from any other part of the dispatch.
    name: "[Matrix I] Hard-anchor classification: vague duration/comparison language and bare unit words without a quantity resolve to source-insufficient; explicit numbers, number+unit pairs, and causal statements remain grounded",
    run: () => {
      function classify(script: string): ImproveScriptResult {
        return parseImproveScriptResponse(
          JSON.stringify({
            editorialDecision: {
              strategy: "rewrite",
              primaryProblemScope: "hook",
              primaryProblem: "The opening could be stronger.",
              primaryProblemEvidence: script,
            },
            candidateAudit: {
              resolvedPrimaryProblem: false,
              candidateMateriallyBetter: false,
              regressionIntroduced: false,
            },
            improvedScript: "A rewritten version of the same script.",
            changes: ["Attempted a rewrite."],
            reason: "The rewrite attempts to improve the opening.",
          }),
          script
        );
      }

      // Should remain source-insufficient (missingMaterial present).
      const manyYears = classify("He trained for many years.");
      assert.ok(
        manyYears.missingMaterial && manyYears.missingMaterial.length > 0,
        "Vague duration language ('many years') must not by itself count as a hard anchor"
      );

      const muchHigher = classify(
        "He could jump much higher than an average person."
      );
      assert.ok(
        muchHigher.missingMaterial && muchHigher.missingMaterial.length > 0,
        "Generic comparative language without a grounded value must not count as enough material"
      );

      const bareUnitWord = classify(
        "He could jump several feet into the air."
      );
      assert.ok(
        bareUnitWord.missingMaterial && bareUnitWord.missingMaterial.length > 0,
        "A bare unit word ('feet') without an actual supported quantity must not automatically make a source concrete"
      );

      // Should still count as grounded (missingMaterial absent).
      const explicitDecimal = classify("His foot reached about 2.38 meters.");
      assert.equal(
        explicitDecimal.missingMaterial,
        undefined,
        "An explicit number + unit relationship must remain a valid hard anchor"
      );

      const explicitYears = classify("He trained for 15 years.");
      assert.equal(
        explicitYears.missingMaterial,
        undefined,
        "An explicit number must remain a valid hard anchor"
      );

      const explicitSeconds = classify(
        "The valve stayed closed for 12 seconds."
      );
      assert.equal(
        explicitSeconds.missingMaterial,
        undefined,
        "An explicit number + unit relationship must remain a valid hard anchor"
      );

      const causalStatement = classify(
        "The bridge collapsed because a single bolt failed under normal load."
      );
      assert.equal(
        causalStatement.missingMaterial,
        undefined,
        "A supported cause-and-effect statement must remain a valid hard anchor"
      );
    },
  },
  {
    name: "[Matrix F] A word-quantified invented measurement (\"almost a foot higher\") is caught too, not just digit-based ones — the exact live regression found during manual verification",
    run: () => {
      const script = [
        "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
        "He trained for many years and became one of the best footballers in the world.",
        "People admire his discipline, speed, and jumping ability.",
        "But the most surprising part is how much higher he could jump than an average person.",
      ].join(" ");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "body",
            primaryProblem:
              "The progression lacks specific details about Ronaldo's jumping ability compared to an average person.",
            primaryProblemEvidence:
              "But the most surprising part is how much higher he could jump than an average person.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript: [
            "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
            "He trained for many years and became one of the best footballers in the world.",
            "People admire his discipline, speed, and jumping ability.",
            "Did you know he can jump almost a foot higher than the average person? That’s what sets him apart from many athletes.",
          ].join(" "),
          changes: [
            "Added a specific comparison of Ronaldo's jump height to the average person's jump height.",
          ],
          reason:
            "The original script lacked specific details about how much higher Ronaldo can jump, so the rewrite adds this detail.",
        }),
        script
      );

      assert.equal(result.status, "diagnostic");
      assert.doesNotMatch(result.improvedScript, /a foot/i);
    },
  },
  {
    name: "[Matrix B] A question-style reordering of the exact same vague claim (no invented number, honest-but-wrong candidateAudit) still resolves to diagnostic — the exact live regression found during manual verification",
    run: () => {
      const script = [
        "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
        "He trained for many years and became one of the best footballers in the world.",
        "People admire his discipline, speed, and jumping ability.",
        "But the most surprising part is how much higher he could jump than an average person.",
      ].join(" ");

      // The model's own candidateAudit claims success, and no unsupported
      // number/cause was introduced (nothing for those checks to catch),
      // but the "rewrite" is only a thematic reordering of the SAME vague
      // claim into a question — no new concrete material anywhere.
      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "hook",
            primaryProblem:
              "The opening lacks immediate engagement and specificity about Ronaldo's achievements.",
            primaryProblemEvidence:
              "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript: [
            "Did you know Cristiano Ronaldo can jump higher than most people?",
            "After years of intense training, he became one of the best footballers in the world.",
            "People admire his discipline, speed, and incredible jumping ability.",
            "But the most surprising part is just how much higher he could jump than an average person.",
          ].join(" "),
          changes: [
            "Replaced the generic opening with a more engaging question.",
            "Reordered the sentences for a smoother flow.",
          ],
          reason:
            "The original opening was too generic; starting with a question makes it more intriguing.",
        }),
        script
      );

      assert.equal(result.status, "diagnostic");
      assert.notEqual(result.status, "improved");
      assert.ok(result.missingMaterial && result.missingMaterial.length > 0);
    },
  },

  // ── Phase 7 regression matrix: false-diagnostic-on-grounded-script fix ──
  {
    name: "[Matrix A] Grounded Ronaldo script + a candidate that combines cause/consequence while preserving all hedges resolves to improved, not diagnostic",
    run: () => {
      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: RONALDO_GROUNDED_PRIMARY_PROBLEM.scope,
            primaryProblem: RONALDO_GROUNDED_PRIMARY_PROBLEM.problem,
            primaryProblemEvidence: RONALDO_GROUNDED_PRIMARY_PROBLEM.evidence,
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript:
            "Cristiano Ronaldo’s head once reached around 9 feet 7 inches above the ground — roughly 2 feet higher than an average person might reach while jumping, about 7 feet 6 inches. That difference is what made his leap so unusual.",
          changes: [
            "Combined the measurement and the comparison into the opening so the payoff lands immediately.",
            "Kept every hedge word from the original.",
          ],
          reason:
            "The rewrite leads with the concrete measurement and comparison instead of splitting them across two sentences, while keeping every approximate/uncertain qualifier from the original.",
        }),
        RONALDO_GROUNDED_SCRIPT
      );

      assert.equal(result.status, "improved");
      assert.notEqual(result.status, "diagnostic");
      assert.notEqual(result.status, "preserve");
      assert.match(result.improvedScript, /9 feet 7 inches/);
      assert.match(result.improvedScript, /7 feet 6 inches/);
      assert.match(result.improvedScript, /2 feet/);
      assert.match(result.improvedScript, /\baround\b/i);
      assert.match(result.improvedScript, /\bmight\b/i);
      assert.match(result.improvedScript, /\babout\b/i);
      assert.match(result.improvedScript, /\broughly\b/i);
    },
  },
  {
    name: "[Matrix B] A candidate that introduces no new facts but reorganizes/combines existing measurements is accepted as meaningful, not rejected for \"adding no concrete material\"",
    run: () => {
      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: RONALDO_GROUNDED_PRIMARY_PROBLEM.scope,
            primaryProblem: RONALDO_GROUNDED_PRIMARY_PROBLEM.problem,
            primaryProblemEvidence: RONALDO_GROUNDED_PRIMARY_PROBLEM.evidence,
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript:
            "Cristiano Ronaldo’s head once reached around 9 feet 7 inches above the ground — roughly 2 feet higher than an average person might reach while jumping, about 7 feet 6 inches. That difference is what made his leap so unusual.",
          changes: ["Moved the existing measurements into the opening; no new facts were added."],
          reason: "Every number already existed in the original script — only the order changed.",
        }),
        RONALDO_GROUNDED_SCRIPT
      );

      assert.equal(result.status, "improved");
    },
  },
  {
    name: "[Matrix C] An awkward, overloaded candidate that the model itself flags as not materially better resolves to the candidate-quality diagnostic — never mislabeled as insufficient source material",
    run: () => {
      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: RONALDO_GROUNDED_PRIMARY_PROBLEM.scope,
            primaryProblem: RONALDO_GROUNDED_PRIMARY_PROBLEM.problem,
            primaryProblemEvidence: RONALDO_GROUNDED_PRIMARY_PROBLEM.evidence,
          },
          candidateAudit: {
            // The model's own honest self-audit: this awkward, overloaded
            // single-sentence candidate did not actually resolve the
            // diagnosed problem well enough.
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: false,
            regressionIntroduced: false,
          },
          improvedScript:
            "Most people would never expect that Cristiano Ronaldo, who trained for years to become one of the best footballers alive, could send his head around 9 feet 7 inches above the ground, roughly 2 feet more than an average person might reach about 7 feet 6 inches while jumping, which is what made it so unusual and surprising to everyone who saw it.",
          changes: ["Combined every fact into a single sentence."],
          reason: "The rewrite combines all details into one sentence.",
        }),
        RONALDO_GROUNDED_SCRIPT
      );

      assert.equal(result.status, "diagnostic");
      assert.notEqual(result.status, "preserve");
      // The source visibly has adequate material (the measurements) — must
      // never claim material is missing.
      assert.equal(result.missingMaterial, undefined);
      assert.doesNotMatch(result.reason, /needs a more concrete fact|comparison, event, or payoff/i);
    },
  },
  {
    name: "[Matrix D] Truly insufficient source (the earlier vague Ronaldo script, no measurements) still resolves to diagnostic with a correct missing-material explanation",
    run: () => {
      const vagueScript = [
        "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
        "He trained for many years and became one of the best footballers in the world.",
        "People admire his discipline, speed, and jumping ability.",
        "But the most surprising part is how much higher he could jump than an average person.",
      ].join(" ");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "hook",
            primaryProblem:
              "The opening is a generic topic announcement instead of leading with the surprising jumping-ability fact.",
            primaryProblemEvidence:
              "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: false,
            candidateMateriallyBetter: false,
            regressionIntroduced: false,
          },
          improvedScript:
            "Cristiano Ronaldo can jump much higher than an average person.",
          changes: ["Moved the surprising claim to the opening."],
          reason: "The rewrite leads with the surprising claim instead of a generic announcement.",
        }),
        vagueScript
      );

      assert.equal(result.status, "diagnostic");
      assert.notEqual(result.status, "improved");
      assert.ok(result.missingMaterial && result.missingMaterial.length > 0);
      assert.match(result.reason, /concrete|payoff|unsupported|too broad/i);
    },
  },
  {
    name: "[Matrix E] Strong original + a worse candidate: preserve remains valid",
    run: () => {
      const script = [
        "Nobody expected the bridge to collapse in under four seconds.",
        "Investigators found a single bolt had sheared under normal load.",
        "That one bolt was rated for half the weight the bridge actually carried.",
      ].join(" ");

      const result = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: "payoff",
            primaryProblem: "The ending could land slightly more forcefully.",
            primaryProblemEvidence:
              "That one bolt was rated for half the weight the bridge actually carried.",
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: true,
          },
          improvedScript: [
            "Nobody expected the bridge to collapse so fast.",
            "Investigators found a single bolt had sheared under normal load.",
            "That bolt could not handle the real weight.",
          ].join(" "),
          changes: ["Rephrased the ending."],
          reason: "The rewrite makes the ending punchier.",
        }),
        script
      );

      assert.equal(result.status, "preserve");
      assert.equal(result.improvedScript, script);
    },
  },
  {
    name: "[Matrix F] Light paraphrase with sufficient material: weak candidate rejected without mislabeling the source, a corrected grounded candidate succeeds on a later attempt",
    run: () => {
      const weakResult = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: RONALDO_GROUNDED_PRIMARY_PROBLEM.scope,
            primaryProblem: RONALDO_GROUNDED_PRIMARY_PROBLEM.problem,
            primaryProblemEvidence: RONALDO_GROUNDED_PRIMARY_PROBLEM.evidence,
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript: [
            "Most people would never expect Cristiano Ronaldo’s head to reach around 9 feet 7 inches above the ground.",
            "An average person jumping might reach about 7 feet 6 inches.",
            "That means Ronaldo reached roughly 2 feet higher, and that is quite unusual indeed.",
          ].join(" "),
          changes: ["Rephrased the ending slightly."],
          reason: "The rewrite rephrases the ending for emphasis.",
        }),
        RONALDO_GROUNDED_SCRIPT
      );

      assert.equal(weakResult.status, "diagnostic");
      assert.equal(weakResult.missingMaterial, undefined);

      const correctedResult = parseImproveScriptResponse(
        JSON.stringify({
          editorialDecision: {
            strategy: "rewrite",
            primaryProblemScope: RONALDO_GROUNDED_PRIMARY_PROBLEM.scope,
            primaryProblem: RONALDO_GROUNDED_PRIMARY_PROBLEM.problem,
            primaryProblemEvidence: RONALDO_GROUNDED_PRIMARY_PROBLEM.evidence,
          },
          candidateAudit: {
            resolvedPrimaryProblem: true,
            candidateMateriallyBetter: true,
            regressionIntroduced: false,
          },
          improvedScript:
            "Cristiano Ronaldo’s head once reached around 9 feet 7 inches above the ground — roughly 2 feet higher than an average person might reach while jumping, about 7 feet 6 inches. That difference is what made his leap so unusual.",
          changes: ["Combined the measurement and comparison into the opening."],
          reason: "The rewrite leads with the concrete measurement and comparison.",
        }),
        RONALDO_GROUNDED_SCRIPT
      );

      assert.equal(correctedResult.status, "improved");
    },
  },
  {
    name: "[Matrix G] Uncertainty preservation: rejects \"around X → exactly X\", \"might reach → reaches\", and \"roughly X → X exactly\"",
    run: () => {
      const baseResponse = {
        editorialDecision: {
          strategy: "rewrite",
          primaryProblemScope: RONALDO_GROUNDED_PRIMARY_PROBLEM.scope,
          primaryProblem: RONALDO_GROUNDED_PRIMARY_PROBLEM.problem,
          primaryProblemEvidence: RONALDO_GROUNDED_PRIMARY_PROBLEM.evidence,
        },
        candidateAudit: {
          resolvedPrimaryProblem: true,
          candidateMateriallyBetter: true,
          regressionIntroduced: false,
        },
        changes: ["Combined the cause and consequence."],
        reason: "The rewrite combines the cause and consequence into one sentence.",
      };

      const exactHeight = parseImproveScriptResponse(
        JSON.stringify({
          ...baseResponse,
          improvedScript:
            "Cristiano Ronaldo’s head reaches exactly 9 feet 7 inches above the ground, roughly 2 feet higher than an average person might reach while jumping, about 7 feet 6 inches.",
        }),
        RONALDO_GROUNDED_SCRIPT
      );
      assert.equal(exactHeight.status, "diagnostic");
      assert.match(exactHeight.reason, /approximate|uncertain|exact/i);

      const droppedMight = parseImproveScriptResponse(
        JSON.stringify({
          ...baseResponse,
          improvedScript:
            "Cristiano Ronaldo’s head reaches around 9 feet 7 inches above the ground, roughly 2 feet higher than an average person reaches while jumping, about 7 feet 6 inches.",
        }),
        RONALDO_GROUNDED_SCRIPT
      );
      assert.equal(droppedMight.status, "diagnostic");
      assert.match(droppedMight.reason, /approximate|uncertain|exact/i);

      const exactDifference = parseImproveScriptResponse(
        JSON.stringify({
          ...baseResponse,
          improvedScript:
            "Cristiano Ronaldo’s head reaches around 9 feet 7 inches above the ground, 2 feet exactly higher than an average person might reach while jumping, about 7 feet 6 inches.",
        }),
        RONALDO_GROUNDED_SCRIPT
      );
      assert.equal(exactDifference.status, "diagnostic");
      assert.match(exactDifference.reason, /approximate|uncertain|exact/i);
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
