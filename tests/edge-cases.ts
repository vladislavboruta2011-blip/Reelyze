import {
  analyzeScript,
  createScriptLines,
  detectScriptStructures,
  estimateDuration,
} from "../engine/scoring";

type CheckContext = {
  lines: string[];
  duration: number;
  hook: number;
  overall: number;
  retention: number;
  structures: ReturnType<typeof detectScriptStructures>;
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

if (failures > 0) {
  console.error(`\nResult: ${failures} edge-case assertion(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nResult: all asserted edge-case tests passed.");
}
