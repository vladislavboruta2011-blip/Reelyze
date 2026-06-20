import { detectScriptStructures } from "../engine/scoring";

type DetectorKey =
  | "hasPersistenceArc"
  | "hasCapabilityViolation"
  | "hasAnomalySequence"
  | "hasConsequenceProgression";

type DetectorCase = {
  name: string;
  detector: DetectorKey;
  expected: boolean;
  script: string;
};

const cases: DetectorCase[] = [
  {
    name: "Persistence positive",
    detector: "hasPersistenceArc",
    expected: true,
    script: `For three winters, the horse returned to the same gate.
Farmers tried to block it, but it kept returning every morning.`,
  },
  {
    name: "Persistence negative",
    detector: "hasPersistenceArc",
    expected: false,
    script: `He lived in that apartment for six years.
When the lease ended, he moved to another city.`,
  },
  {
    name: "Capability positive",
    detector: "hasCapabilityViolation",
    expected: true,
    script: `She played a difficult piano piece she had never practiced.
Yet every note was correct.`,
  },
  {
    name: "Capability negative",
    detector: "hasCapabilityViolation",
    expected: false,
    script: `She had never studied French.
Then she enrolled in classes and learned it over two years.`,
  },
  {
    name: "Anomaly positive",
    detector: "hasAnomalySequence",
    expected: true,
    script: `The fishing boat vanished during the night.
Its lights were still on and the engine was running.
The coast guard searched the area, but the crew was never found.`,
  },
  {
    name: "Anomaly negative",
    detector: "hasAnomalySequence",
    expected: false,
    script: `The town vanished from newer maps.
Officials explained that its boundaries had merged with the next city.`,
  },
  {
    name: "Progression positive",
    detector: "hasConsequenceProgression",
    expected: true,
    script: `The shop was losing thousands every month.
They added more products, but the losses grew.
Then they dropped half the catalog and focused on one service.
Within 60 days, revenue exceeded costs.`,
  },
  {
    name: "Progression negative",
    detector: "hasConsequenceProgression",
    expected: false,
    script: `The company launched a new logo.
Revenue increased during the following month.`,
  },
];

function createScriptLines(script: string): string[] {
  return script
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

let failed = 0;

console.log("\nReelyze Phase 1 Detector Tests\n");

for (const test of cases) {
  const lines = createScriptLines(test.script);
  const structures = detectScriptStructures(lines, test.script);
  const actual = structures[test.detector];
  const pass = actual === test.expected;

  if (!pass) {
    failed++;
  }

  console.log(`${pass ? "✅ PASS" : "❌ FAIL"} — ${test.name}`);
  console.log(
    `  ${test.detector}: ${actual} expected ${test.expected}${pass ? "" : " ❌"}`,
  );
}

console.log("");

if (failed > 0) {
  console.log(`Result: ${failed} detector test(s) failed.`);
  process.exit(1);
}

console.log("Result: all detector tests passed.");
