import {
  analyzeScript,
  createHookRewrite,
  createScriptLines,
  detectScriptStructures,
  estimateDuration,
} from "../engine/scoring";
import { detectScriptType } from "../engine/scoring-script-preprocessing";

type CheckContext = {
  lines: string[];
  duration: number;
  hook: number;
  overall: number;
  retention: number;
  structures: ReturnType<typeof detectScriptStructures>;
  scriptType: ReturnType<typeof detectScriptType>;
  riskyParts: ReturnType<typeof analyzeScript>["riskyParts"];
  takeaway: string;
  fixes: string[];
};

type Check = {
  label: string;
  test: (context: CheckContext) => boolean;
  expected: string;
};

type EdgeCase = {
  name: string;
  script: string;
  checks: Check[];
};

function evaluate(script: string): CheckContext {
  const lines = createScriptLines(script);
  const duration = estimateDuration(script);
  const result = analyzeScript(script, duration, lines);
  const structures = detectScriptStructures(lines, script);

  return {
    lines,
    duration,
    hook: result.hook.score,
    overall: result.overall.score,
    retention: result.risk.score,
    structures,
      scriptType: detectScriptType(script),
    riskyParts: result.riskyParts,
    takeaway: result.overall.description,
    fixes: result.fixes,
  };
}

const assertedCases: EdgeCase[] = [
  {
    name: "Capability violation with misleading practice simile",
    script: `A boy woke up after surgery and could suddenly play songs he had never learned.
Before the operation, he had never touched a piano.
But when he sat down, both hands moved like he had practiced for years.`,
    checks: [
      {
        label: "practice simile is not treated as real training",
        test: ({ structures }) => structures.hasCapabilityViolation,
        expected: "hasCapabilityViolation = true",
      },
      {
        label: "capability violation receives a strong hook score",
        test: ({ hook }) => hook >= 75,
        expected: "Hook ≥ 75",
      },
    ],
  },
  {
    name: "Auto captions without punctuation",
    script:
      "this dog waited outside the same hospital every morning for six years nurses tried to move him during storms and freezing nights he always returned before sunrise nobody had trained him to do it he was waiting for the owner who never came back",
    checks: [
      {
        label: "auto-caption transcript is split into usable lines",
        test: ({ lines }) => lines.length >= 4,
        expected: "at least 4 normalized lines",
      },
      {
        label: "persistence arc survives missing punctuation",
        test: ({ structures }) => structures.hasPersistenceArc,
        expected: "hasPersistenceArc = true",
      },
    ],
  },
  {
    name: "Strong opening with weak continuation",
    script: `A plane landed with nobody inside.
Planes are used by many people around the world.
They can travel long distances.
Airports help passengers board flights.
Flying is an important form of transportation.`,
    checks: [
      {
        label: "weak continuation keeps the overall score low",
        test: ({ overall }) => overall <= 45,
        expected: "Overall ≤ 45",
      },
      {
        label: "weak continuation keeps retention risk high",
        test: ({ retention }) => retention >= 65,
        expected: "Retention risk ≥ 65",
      },
    ],
  },
  {
    name: "Giveaway prize with non-catalog object",
    script: `This creator is giving away a custom telescope to one subscriber.
The first viewer who solves the final clue gets to keep it.
Each clue removes half the remaining comments.
At the end, one person receives the telescope.`,
    checks: [
      {
        label: "non-catalog prize object is classified as giveaway",
        test: ({ scriptType }) => scriptType === "giveaway_or_prize",
        expected: 'scriptType = "giveaway_or_prize"',
      },
      {
        label: "non-catalog prize stake receives giveaway hook floor",
        test: ({ hook }) => hook >= 62,
        expected: "Hook ≥ 62",
      },
      {
        label: "non-catalog prize premise receives giveaway overall floor",
        test: ({ overall }) => overall >= 58,
        expected: "Overall ≥ 58",
      },
    ],
  },
  {
    name: "Ranking written as fragments",
    script: `Who jumps the highest?
Curry — twenty-four feet.
Wembanyama — nearly twenty-five feet.
LeBron — twenty-eight feet.
Ja Morant — slightly higher.
Keon Johnson — more than thirty feet.`,
    checks: [
      {
        label: "fragment ranking is detected as list buildup",
        test: ({ structures }) => structures.hasListBuildup,
        expected: "hasListBuildup = true",
      },
      {
        label: "fragment ranking receives list escalation",
        test: ({ structures }) => structures.escalationQuality === "list",
        expected: 'escalationQuality = "list"',
      },
    ],
  },
  {
    name: "Strong story without transition words",
    script: `A woman received a letter from herself dated twenty years in the future.
The handwriting matched perfectly.
It described the house she would buy and the name of a child she did not have yet.
Twenty years passed.
Every detail in the letter came true.`,
    checks: [
      {
        label: "future-story wording is not mistaken for a numeric mechanism",
        test: ({ structures }) => !structures.hasNumericPremise,
        expected: "hasNumericPremise = false",
      },
    ],
  },
  {
    name: "Spelled-out inches are a specific quantity",
    script: `Ronaldo jumps six inches higher than Stephen Curry because his recorded reach is greater.`,
    checks: [
      {
        label: "spelled-out inches form a numeric premise",
        test: ({ structures }) => structures.hasNumericPremise,
        expected: "hasNumericPremise = true",
      },
      {
        label: "spelled-out inches receive measurement specificity",
        test: ({ hook }) => hook >= 55,
        expected: "Hook ≥ 55",
      },
    ],
  },
  {
    name: "Singular inch is a specific quantity",
    script: `Ronaldo jumps 1 inch higher than Stephen Curry because his recorded reach is greater.`,
    checks: [
      {
        label: "singular inch forms a numeric premise",
        test: ({ structures }) => structures.hasNumericPremise,
        expected: "hasNumericPremise = true",
      },
    ],
  },
  {
    name: "Specific quantities written as words",
    script: `This runner improved more in six weeks than he had in two years.
He cut ten seconds from his race time.
His weekly mileage stayed below thirty miles.
The change came from replacing long workouts with three short sprint sessions.
By week six, he reached the national qualifying standard.`,
    checks: [
      {
        label: "spelled-out quantities form a numeric premise",
        test: ({ structures }) => structures.hasNumericPremise,
        expected: "hasNumericPremise = true",
      },
    ],
  },
  {
    name: "Quantified outcome is a strong payoff",
    script: `This app was losing users every week.
The team kept adding features, but every update made the product harder to use.
Then they removed most of the features and focused on one core problem.
Users started returning more often.
Within 60 days, user retention doubled, and the company finally became profitable.`,
    checks: [
      {
        label: "quantified outcome is classified as consequence payoff",
        test: ({ structures }) => structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = true",
      },
      {
        label: "quantified outcome is not flagged as weak payoff",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff"),
          ),
        expected: "no payoff warning",
      },
    ],
  },
  {
    name: "Generic business outcome stays weak",
    script: `This app was losing users every week.
The team kept adding features, but every update made the product harder to use.
Then they removed most of the features and focused on one core problem.
Users started returning more often.
The changes helped the company.`,
    checks: [
      {
        label: "generic business ending is not a consequence payoff",
        test: ({ structures }) => !structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = false",
      },
      {
        label: "generic business ending remains flagged",
        test: ({ riskyParts }) =>
          riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff"),
          ),
        expected: "payoff warning remains",
      },
    ],
  },
  {
    name: "Paradox reversal is a strong payoff",
    script: `Imagine the world went completely silent for one minute.
At first, it would seem peaceful.
But without outside noise, you would begin hearing your heartbeat, breathing, and every movement inside your body.
Those internal sounds would feel impossible to ignore.
Complete silence would actually become one of the loudest things you had ever experienced.`,
    checks: [
      {
        label: "opposite-state reversal is classified as consequence payoff",
        test: ({ structures }) => structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = true",
      },
      {
        label: "paradox reversal is not flagged as weak payoff",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff"),
          ),
        expected: "no payoff warning",
      },
    ],
  },
  {
    name: "Generic paradox ending stays weak",
    script: `Imagine the world went completely silent for one minute.
At first, it would seem peaceful.
But without outside noise, you would begin hearing your heartbeat, breathing, and every movement inside your body.
Those internal sounds would feel unusual.
Complete silence would be a strange experience.`,
    checks: [
      {
        label: "generic strange ending is not a consequence payoff",
        test: ({ structures }) => !structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = false",
      },
      {
        label: "generic strange ending remains flagged",
        test: ({ riskyParts }) =>
          riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff"),
          ),
        expected: "payoff warning remains",
      },
    ],
  },
  {
    name: "Concrete disappearance mystery uses evidence buildup",
    script: `A research boat vanished during a routine trip.
Two days later, rescuers found it drifting with the engine still running.
Food remained on the table, every life jacket was still aboard, and there was no sign of a struggle.
Search teams checked the surrounding ocean for a week.
No one ever found the six crew members.`,
    checks: [
      {
        label: "concrete disappearance forms an anomaly sequence",
        test: ({ structures }) => structures.hasAnomalySequence,
        expected: "hasAnomalySequence = true",
      },
      {
        label: "physical evidence forms mystery clue buildup",
        test: ({ structures }) => structures.hasMysteryClueBuildup,
        expected: "hasMysteryClueBuildup = true",
      },
      {
        label: "concrete clues receive mystery escalation",
        test: ({ structures }) => structures.escalationQuality === "mystery",
        expected: 'escalationQuality = "mystery"',
      },
      {
        label: "specific unresolved disappearance is a consequence payoff",
        test: ({ structures }) => structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = true",
      },
      {
        label: "concrete mystery is not flagged for weak middle or payoff",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) => {
            const title = part.title.toLowerCase();
            return title.includes("payoff") || title.includes("middle may lose");
          }),
        expected: "no weak-middle or payoff warning",
      },
    ],
  },
  {
    name: "Vague strange event is not a mystery structure",
    script: `Something very strange happened one night.
People said it looked unusual.
Nobody understood what was going on.
The situation appeared mysterious.
To this day, no one knows what really happened.`,
    checks: [
      {
        label: "vague event is not an anomaly sequence",
        test: ({ structures }) => !structures.hasAnomalySequence,
        expected: "hasAnomalySequence = false",
      },
      {
        label: "vague descriptions are not mystery clue buildup",
        test: ({ structures }) => !structures.hasMysteryClueBuildup,
        expected: "hasMysteryClueBuildup = false",
      },
      {
        label: "generic mystery phrase is not a consequence payoff",
        test: ({ structures }) => !structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = false",
      },
      {
        label: "generic mystery phrase is not called a strong late payoff",
        test: ({ riskyParts }) =>
          !riskyParts.some(
            (part) => part.title === "Strong payoff appears too late.",
          ),
        expected: "no strong-payoff-late warning",
      },
      {
        label: "vague ending remains flagged as weak payoff",
        test: ({ riskyParts }) =>
          riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff"),
          ),
        expected: "payoff warning remains",
      },
    ],
  },
  {
    name: "Concrete signal mystery uses evidence buildup",
    script: `A radio station stopped transmitting in the middle of a live broadcast.
When police entered the studio, the microphones were still on and every chair was empty.
The doors were locked from the inside.
Investigators searched the building but found no trace of the presenters.
The interruption was never explained.`,
    checks: [
      {
        label: "concrete signal loss forms an anomaly sequence",
        test: ({ structures }) => structures.hasAnomalySequence,
        expected: "hasAnomalySequence = true",
      },
      {
        label: "studio evidence forms mystery clue buildup",
        test: ({ structures }) => structures.hasMysteryClueBuildup,
        expected: "hasMysteryClueBuildup = true",
      },
      {
        label: "studio clues receive mystery escalation",
        test: ({ structures }) => structures.escalationQuality === "mystery",
        expected: 'escalationQuality = "mystery"',
      },
      {
        label: "specific unexplained interruption is a consequence payoff",
        test: ({ structures }) => structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = true",
      },
      {
        label: "concrete signal mystery is not flagged for weak middle or payoff",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) => {
            const title = part.title.toLowerCase();
            return title.includes("payoff") || title.includes("middle may lose");
          }),
        expected: "no weak-middle or payoff warning",
      },
    ],
  },
  {
    name: "Generic unexplained event stays weak",
    script: `This was one of the strangest events anyone had seen.
Everything about it seemed unusual.
People looked for answers.
Nobody could explain it.
It remains a mystery to this day.`,
    checks: [
      {
        label: "generic unexplained event is not an anomaly sequence",
        test: ({ structures }) => !structures.hasAnomalySequence,
        expected: "hasAnomalySequence = false",
      },
      {
        label: "generic statements are not mystery clue buildup",
        test: ({ structures }) => !structures.hasMysteryClueBuildup,
        expected: "hasMysteryClueBuildup = false",
      },
      {
        label: "generic unresolved phrase is not a consequence payoff",
        test: ({ structures }) => !structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = false",
      },
      {
        label: "generic event is not called a strong late payoff",
        test: ({ riskyParts }) =>
          !riskyParts.some(
            (part) => part.title === "Strong payoff appears too late.",
          ),
        expected: "no strong-payoff-late warning",
      },
      {
        label: "generic unresolved ending remains flagged",
        test: ({ riskyParts }) =>
          riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff"),
          ),
        expected: "payoff warning remains",
      },
    ],
  },
  {
    name: "Final numeric maximum completes a comparison",
    script: `How far can each design send the signal?
The first reaches 120 meters.
The second reaches 145 meters.
The third reaches 170 meters.
The fourth reaches 190 meters.
The final design reaches 230 meters.`,
    checks: [
      {
        label: "ordered measurements form list buildup",
        test: ({ structures }) => structures.hasListBuildup,
        expected: "hasListBuildup = true",
      },
      {
        label: "final strict maximum completes the comparison",
        test: ({ structures }) => structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = true",
      },
      {
        label: "final strict maximum is not a weak payoff",
        test: ({ structures }) => !structures.hasWeakPayoff,
        expected: "hasWeakPayoff = false",
      },
      {
        label: "completed maximum receives no payoff warning",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff"),
          ),
        expected: "no payoff warning",
      },
    ],
  },
  {
    name: "Final numeric minimum completes a comparison",
    script: `Which process uses the least energy?
The first uses 90 units.
The second uses 75 units.
The third uses 62 units.
The fourth uses 51 units.
The final process uses only 38 units.`,
    checks: [
      {
        label: "descending measurements form list buildup",
        test: ({ structures }) => structures.hasListBuildup,
        expected: "hasListBuildup = true",
      },
      {
        label: "final strict minimum completes the comparison",
        test: ({ structures }) => structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = true",
      },
      {
        label: "final strict minimum is not a weak payoff",
        test: ({ structures }) => !structures.hasWeakPayoff,
        expected: "hasWeakPayoff = false",
      },
      {
        label: "completed minimum receives no payoff warning",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff"),
          ),
        expected: "no payoff warning",
      },
    ],
  },
  {
    name: "Comparative chain ends with a universal leader",
    script: `Which route is faster?
The coastal route beats the mountain route.
The tunnel route is faster than the coastal route.
The bridge route finishes ahead of the tunnel route.
But the direct route is faster than every other option.`,
    checks: [
      {
        label: "repeated comparative relationships form list buildup",
        test: ({ structures }) => structures.hasListBuildup,
        expected: "hasListBuildup = true",
      },
      {
        label: "universal final comparison completes the ranking",
        test: ({ structures }) => structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = true",
      },
      {
        label: "comparative culmination receives list escalation",
        test: ({ structures }) => structures.escalationQuality === "list",
        expected: 'escalationQuality = "list"',
      },
      {
        label: "comparative culmination receives no payoff warning",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff"),
          ),
        expected: "no payoff warning",
      },
    ],
  },
  {
    name: "Generic close does not complete an ordered comparison",
    script: `How far can each design send the signal?
The first reaches 120 meters.
The second reaches 145 meters.
The third reaches 170 meters.
The fourth reaches 190 meters.
All of these designs are impressive.`,
    checks: [
      {
        label: "ordered measurements still form list buildup",
        test: ({ structures }) => structures.hasListBuildup,
        expected: "hasListBuildup = true",
      },
      {
        label: "generic final statement is not a ranking payoff",
        test: ({ structures }) => !structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = false",
      },
      {
        label: "generic final statement remains a weak payoff",
        test: ({ structures }) => structures.hasWeakPayoff,
        expected: "hasWeakPayoff = true",
      },
      {
        label: "unfinished comparison retains payoff warning",
        test: ({ riskyParts }) =>
          riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff"),
          ),
        expected: "payoff warning remains",
      },
    ],
  },
  {
    name: "Non-extreme final value does not complete a ranking",
    script: `Which battery lasts the longest?
Model A lasts 10 hours.
Model B lasts 15 hours.
Model C lasts 12 hours.
Model D lasts 14 hours.
Model E lasts 13 hours.`,
    checks: [
      {
        label: "distinct measured options form list buildup",
        test: ({ structures }) => structures.hasListBuildup,
        expected: "hasListBuildup = true",
      },
      {
        label: "non-extreme final value is not a ranking payoff",
        test: ({ structures }) => !structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = false",
      },
      {
        label: "non-extreme ending remains a weak payoff",
        test: ({ structures }) => structures.hasWeakPayoff,
        expected: "hasWeakPayoff = true",
      },
      {
        label: "non-extreme ending retains payoff warning",
        test: ({ riskyParts }) =>
          riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff"),
          ),
        expected: "payoff warning remains",
      },
    ],
  },
  {
    name: "Temporal measurements are not a ranked list",
    script: `The project changed throughout the week.
On Monday it had 10 tasks.
On Tuesday it had 14 tasks.
On Wednesday it had 12 tasks.
On Thursday it had 16 tasks.
The team reviewed the results on Friday.`,
    checks: [
      {
        label: "one subject measured over time is not list buildup",
        test: ({ structures }) => !structures.hasListBuildup,
        expected: "hasListBuildup = false",
      },
      {
        label: "temporal measurements do not receive list escalation",
        test: ({ structures }) => structures.escalationQuality !== "list",
        expected: 'escalationQuality != "list"',
      },
    ],
  },
  {
    name: "Generic advice feedback stays focused",
    script: `Success on social media is very important.
Many creators want more views.
You need to work hard and stay consistent.
Always improve your content.
Anything is possible if you believe in yourself.`,
    checks: [
      {
        label: "main takeaway identifies generic or repetitive content",
        test: ({ takeaway }) =>
          /generic|repeat|restate|same idea|specific/i.test(takeaway) &&
          !/opening|first line|very top/i.test(takeaway),
        expected: "takeaway focuses on genericness, not the hook",
      },
      {
        label: "only one semantic opening fix is shown",
        test: ({ fixes }) =>
          fixes.filter((fix) =>
            /opening|first line|open with|rewrite the opening|lead with/i.test(fix)
          ).length <= 1,
        expected: "at most one opening-focused fix",
      },
    ],
  },
  {
    name: "Completed ranking feedback respects its structure",
    script: `Which option finished first?
Alpha reached 12 points.
Beta reached 18 points.
Gamma reached 24 points.
Delta reached 31 points.
Epsilon finished with 40 points.`,
    checks: [
      {
        label: "completed ranking receives no payoff-improvement fix",
        test: ({ fixes }) =>
          !fixes.some((fix) =>
            /expand the payoff|make the payoff more specific|payoff feel more earned|payoff feel clearly rewarded/i.test(fix)
          ),
        expected: "no payoff-improvement fix",
      },
      {
        label: "numeric ranking is not told to add a number",
        test: ({ fixes }) =>
          !fixes.some((fix) =>
            /include a number|add (?:one )?(?:more )?(?:specific )?(?:example, )?number/i.test(fix)
          ),
        expected: "no redundant add-number fix",
      },
      {
        label: "valid list buildup receives no false middle warning",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) =>
            /middle|momentum/i.test(part.title)
          ),
        expected: "no middle or momentum warning",
      },
    ],
  },
  {
    name: "Concrete transformation payoff is not contradicted",
    script: `Today I want to tell you about a startup that was having problems.
The founders kept adding new features.
Each launch made the losses worse.
Then they removed their biggest product.
Within 90 days, revenue passed expenses by $40,000.`,
    checks: [
      {
        label: "quantified transformation ending receives no weak-payoff warning",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) =>
            /weak.*payoff|payoff could be stronger/i.test(part.title)
          ),
        expected: "no weak-payoff warning",
      },
      {
        label: "quantified transformation ending receives no payoff fix",
        test: ({ fixes }) =>
          !fixes.some((fix) => /payoff|outcome clearer/i.test(fix)),
        expected: "no payoff-focused fix",
      },
    ],
  },
  {
    name: "Threshold crossing without repeated number is a payoff",
    script: `This startup was losing $50,000 every month.
The founders thought one more feature would save it.
But every launch made the losses worse.
Then they removed their biggest product and focused on one small problem.
Within 90 days, revenue finally passed expenses.`,
    checks: [
      {
        label: "resolved business threshold is a consequence payoff",
        test: ({ structures }) => structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = true",
      },
      {
        label: "resolved business threshold receives no payoff warning",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff")
          ),
        expected: "no payoff warning",
      },
    ],
  },
  {
    name: "Direct comparison winner is a payoff",
    script: `If Ronaldo and Michael Jordan jumped at the same time, who would reach higher?
Ronaldo is 6 feet 2 inches tall, while Jordan is 6 feet 6 inches.
Jordan has the height advantage, but Ronaldo can reach around 9 feet 7 inches with his head.
Jordan still reaches slightly higher, proving that height and vertical jump both matter.`,
    checks: [
      {
        label: "named comparison winner is a consequence payoff",
        test: ({ structures }) => structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = true",
      },
      {
        label: "named comparison winner receives no payoff warning",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff")
          ),
        expected: "no payoff warning",
      },
    ],
  },
  {
    name: "Clean transformation analysis has aligned takeaway",
    script: `This app lost 40% of its users in one week.
The team added three new features, but retention dropped again.
Then they removed the most complicated feature and simplified onboarding.
Within 30 days, weekly retention increased from 18% to 31%.`,
    checks: [
      {
        label: "clean analysis has no risky parts",
        test: ({ riskyParts }) => riskyParts.length === 0,
        expected: "no risky parts",
      },
      {
        label: "clean analysis has no suggested fixes",
        test: ({ fixes }) => fixes.length === 0,
        expected: "no suggested fixes",
      },
      {
        label: "takeaway does not invent a missing consequence",
        test: ({ takeaway }) =>
          !/nothing in this script is clearly at risk|add a consequence|what(?:'|’)s lost, threatened/i.test(
            takeaway
          ),
        expected: "takeaway aligned with clean analysis",
      },
    ],
  },
  {
    name: "Concrete physical consequence is a payoff",
    script: `Imagine the Sun suddenly disappeared for 8 minutes.
Earth would not notice immediately because sunlight takes about 8 minutes to reach us.
The sky would remain bright for a short time, and the planet would continue moving as if nothing had happened.
Then the light would vanish, and Earth would begin drifting away from its old orbit.`,
    checks: [
      {
        label: "specific physical state change is a consequence payoff",
        test: ({ structures }) => structures.hasConsequencePayoff,
        expected: "hasConsequencePayoff = true",
      },
      {
        label: "specific physical state change receives no payoff warning",
        test: ({ riskyParts }) =>
          !riskyParts.some((part) =>
            part.title.toLowerCase().includes("payoff")
          ),
        expected: "no payoff warning",
      },
    ],
  },
];

const knownGapScript =
  "Ronaldo can jump higher than Stephen Curry by around six inches, higher than Luka Doncic by three inches, and slightly higher than Kyrie Irving, but Kobe Bryant could beat him by about two inches, while LeBron James could jump nearly seven inches higher.";

console.log("\nReelyze Phase 5 Edge Case Tests\n");

let failures = 0;

for (const edgeCase of assertedCases) {
  const context = evaluate(edgeCase.script);

  console.log(`\n— ${edgeCase.name}`);
  console.log(
    `  Hook ${context.hook} | Overall ${context.overall} | Retention ${context.retention}`,
  );

  for (const check of edgeCase.checks) {
    const passed = check.test(context);

    console.log(
      `${passed ? "✅" : "❌"} ${check.label} — expected ${check.expected}`,
    );

    if (!passed) failures += 1;
  }
}

const knownGap = evaluate(knownGapScript);

console.log("\n— Multiple comparisons in one long sentence");

const longSentenceRankingDetected =
  knownGap.structures.hasListBuildup &&
  knownGap.structures.escalationQuality === "list";

console.log(
  `${longSentenceRankingDetected ? "✅" : "❌"} long-sentence ranking is detected as list buildup`,
);

if (!longSentenceRankingDetected) {
  failures += 1;
}

const longSentenceOverallPasses = knownGap.overall >= 55;
console.log(
  `${longSentenceOverallPasses ? "✅" : "❌"} structured comparison receives Overall ≥ 55 — actual ${knownGap.overall}`,
);
if (!longSentenceOverallPasses) {
  failures += 1;
}

const longSentenceRetentionPasses = knownGap.retention <= 55;
console.log(
  `${longSentenceRetentionPasses ? "✅" : "❌"} structured comparison keeps Retention Risk ≤ 55 — actual ${knownGap.retention}`,
);
if (!longSentenceRetentionPasses) {
  failures += 1;
}

const unreliableDiagnosticScripts = [
  "Want to become successful. Work hard every day. Stay focused and never give up.",
  "Most people want success. They need to work hard. They should stay focused every day.",
];

console.log("\n— Client diagnostic topic fallback");

for (const script of unreliableDiagnosticScripts) {
  const rewrite = createHookRewrite(script);
  const passed =
    rewrite ===
    "This script needs one specific example, result, or consequence before the hook can feel strong.";

  console.log(
    `${passed ? "✅" : "❌"} unreliable first word uses neutral diagnostic guidance`,
  );

  if (!passed) failures += 1;
}

if (failures > 0) {
  console.error(`\nResult: ${failures} edge-case assertion(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nResult: all asserted edge-case tests passed.");
}
