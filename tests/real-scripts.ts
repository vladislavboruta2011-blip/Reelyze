import {
  analyzeScript,
  detectScriptStructures,
} from "../engine/scoring";

type RealScriptCase = {
  name: string;
  category: string;
  title: string;
  script: string;
};

const cases: RealScriptCase[] = [
  {
    name: "Ronaldo vs NBA players",
    category: "sports comparison",
    title: "Can Ronaldo Jump Higher Than NBA Players?",
    script: `Can Ronaldo jump higher than NBA players?
Against Stephen Curry, Ronaldo reaches about six inches higher.
Against Luka Doncic, he still wins by around three inches.
Kyrie Irving gets closer, but Ronaldo remains slightly ahead.
Kobe Bryant finally beats him by about two inches.
And LeBron James reaches nearly seven inches higher.`,
  },
  {
    name: "NBA players on the Moon",
    category: "science comparison",
    title: "How High Would NBA Players Jump on the Moon?",
    script: `How high would NBA players jump on the Moon?
Stephen Curry could reach almost twenty-four feet.
Victor Wembanyama would reach even higher because of his enormous standing reach.
LeBron James could get close to twenty-eight feet.
Ja Morant would rise slightly above him.
But Keon Johnson could reach more than thirty feet above the ground.`,
  },
  {
    name: "Bermuda ship mystery",
    category: "mystery story",
    title: "The Ship Found With No Crew",
    script: `A ship was found drifting with no crew anywhere on board.
The engine was still running, food was sitting on the tables, and every lifeboat was untouched.
Rescue teams searched the surrounding ocean for days.
They found no bodies, no emergency signal, and no sign of an attack.
To this day, nobody knows why everyone disappeared.`,
  },
  {
    name: "Failed app transformation",
    category: "business transformation",
    title: "The App That Was Losing Thousands",
    script: `This app was losing thousands of dollars every month.
The founders kept adding new features because they thought more options would save it.
But every update made the product slower and more confusing.
Finally, they removed almost everything and focused on one problem.
Within three months, users doubled and the company became profitable.`,
  },
  {
    name: "Weak football facts",
    category: "weak factual",
    title: "Football Is a Popular Sport",
    script: `Football is one of the most popular sports in the world.
It is played in many different countries.
Each team has eleven players.
The goal is to score more goals than the other team.
Many people enjoy watching football.`,
  },
  {
    name: "Generic creator advice",
    category: "generic motivation",
    title: "Never Give Up on YouTube",
    script: `Growing on YouTube takes time.
You need to stay consistent and keep working hard.
Some videos will perform better than others.
Do not give up when results are slow.
Believe in yourself and continue posting.`,
  },
];

function createScriptLines(script: string): string[] {
  const cleaned = script.trim().replace(/\s+/g, " ");

  if (!cleaned) return [];

  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function estimateDuration(script: string): number {
  const cleaned = script.trim().replace(/\s+/g, " ");

  if (!cleaned) return 0;

  return Math.max(
    4,
    Math.ceil(cleaned.length / 16.5),
  );
}

type ScoreRange = [number, number];

type StructureKey =
  | "hasPersistenceArc"
  | "hasCapabilityViolation"
  | "hasAnomalySequence"
  | "hasConsequenceProgression"
  | "hasConsequencePayoff"
  | "escalationQuality";

type ExpectedCase = {
  hook: ScoreRange;
  overall: ScoreRange;
  retention: ScoreRange;
  structures: Partial<
    Record<StructureKey, boolean | string>
  >;
};

const expectations: Record<string, ExpectedCase> = {
  "Ronaldo vs NBA players": {
    hook: [50, 75],
    overall: [55, 78],
    retention: [25, 55],
    structures: {
      escalationQuality: "list",
    },
  },
  "NBA players on the Moon": {
    hook: [50, 75],
    overall: [45, 70],
    retention: [35, 70],
    structures: {
      escalationQuality: "list",
    },
  },
  "Bermuda ship mystery": {
    hook: [75, 95],
    overall: [65, 90],
    retention: [20, 50],
    structures: {
      hasAnomalySequence: true,
      hasConsequencePayoff: true,
    },
  },
  "Failed app transformation": {
    hook: [65, 90],
    overall: [55, 80],
    retention: [35, 65],
    structures: {
      hasConsequenceProgression: true,
    },
  },
  "Weak football facts": {
    hook: [25, 50],
    overall: [20, 50],
    retention: [60, 90],
    structures: {
      hasPersistenceArc: false,
      hasCapabilityViolation: false,
      hasAnomalySequence: false,
      hasConsequenceProgression: false,
    },
  },
  "Generic creator advice": {
    hook: [20, 50],
    overall: [15, 50],
    retention: [60, 90],
    structures: {
      hasPersistenceArc: false,
      hasCapabilityViolation: false,
      hasAnomalySequence: false,
      hasConsequenceProgression: false,
    },
  },
};

function inRange(
  value: number,
  range: ScoreRange,
): boolean {
  return value >= range[0] && value <= range[1];
}

let failed = 0;

console.log("\nReelyze Phase 2 Real Script Regression Suite\n");

for (const test of cases) {
  const lines = createScriptLines(test.script);
  const duration = estimateDuration(test.script);

  const result = analyzeScript(
    test.script,
    duration,
    lines,
  );

  const structures = detectScriptStructures(
    lines,
    test.script,
  );

  const expected = expectations[test.name];

  if (!expected) {
    throw new Error(
      `Missing expectations for: ${test.name}`,
    );
  }

  const hook = result.hook.score;
  const overall = result.overall.score;
  const retention = result.risk.score;

  const hookPass = inRange(
    hook,
    expected.hook,
  );

  const overallPass = inRange(
    overall,
    expected.overall,
  );

  const retentionPass = inRange(
    retention,
    expected.retention,
  );

  const structureChecks = Object.entries(
    expected.structures,
  ).map(([key, expectedValue]) => {
    const structureKey = key as StructureKey;
    const actual = structures[structureKey];

    return {
      key: structureKey,
      actual,
      expected: expectedValue,
      pass: actual === expectedValue,
    };
  });

  const structuresPass = structureChecks.every(
    (check) => check.pass,
  );

  const pass =
    hookPass &&
    overallPass &&
    retentionPass &&
    structuresPass;

  if (!pass) {
    failed++;
  }

  console.log(
    `${pass ? "✅ PASS" : "❌ FAIL"} — ${test.name}`,
  );

  console.log(
    `  Hook:      ${hook} expected ${expected.hook[0]}-${expected.hook[1]}${hookPass ? "" : " ❌"}`,
  );

  console.log(
    `  Overall:   ${overall} expected ${expected.overall[0]}-${expected.overall[1]}${overallPass ? "" : " ❌"}`,
  );

  console.log(
    `  Retention: ${retention} expected ${expected.retention[0]}-${expected.retention[1]}${retentionPass ? "" : " ❌"}`,
  );

  for (const check of structureChecks) {
    console.log(
      `  ${check.key}: ${check.actual} expected ${check.expected}${check.pass ? "" : " ❌"}`,
    );
  }

  console.log("");
}

if (failed > 0) {
  console.log(
    `Result: ${failed} real-script test(s) failed.`,
  );
  process.exit(1);
}

console.log(
  "Result: all real-script regression tests passed.",
);
