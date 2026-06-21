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
  {
    name: "Persistence paraphrase — week after week",
    detector: "hasPersistenceArc",
    expected: true,
    script: `Week after week, the fox returned to the same porch.
The owner chased it away, but it came back the next evening.`,
  },
  {
    name: "Persistence false positive — unrelated still",
    detector: "hasPersistenceArc",
    expected: false,
    script: `The museum was closed for three years.
It is still located in the center of the city.`,
  },
  {
    name: "Capability paraphrase — unexplained performance",
    detector: "hasCapabilityViolation",
    expected: true,
    script: `He had never touched a violin.
Minutes later, he performed the entire concerto perfectly.`,
  },
  {
    name: "Capability false positive — ability after training",
    detector: "hasCapabilityViolation",
    expected: false,
    script: `She had never learned to swim.
But then she trained for months and was able to cross the pool.`,
  },
  {
    name: "Capability simile — implied practice is not real training",
    detector: "hasCapabilityViolation",
    expected: true,
    script: `A boy woke up after surgery and could suddenly play songs he had never learned.
Before the operation, he had never touched a piano.
But when he sat down, both hands moved like he had practiced for years.`,
  },
  {
    name: "Capability negative — real long-term training",
    detector: "hasCapabilityViolation",
    expected: false,
    script: `A boy practiced piano every day for five years and became highly skilled.`,
  },
  {
    name: "Capability bare verb — could play without studying",
    detector: "hasCapabilityViolation",
    expected: true,
    script: `A woman had never studied music, but suddenly she could play a complex song perfectly.`,
  },
  {
    name: "Anomaly paraphrase — communication ceased",
    detector: "hasAnomalySequence",
    expected: true,
    script: `The research team ceased all communication.
Their meals and notebooks remained exactly where they were.
Rescue crews found no trace of them.`,
  },
  {
    name: "Anomaly false positive — explained power cut",
    detector: "hasAnomalySequence",
    expected: false,
    script: `The office went silent after the power cut.
Engineers investigated the problem and restored the electricity.`,
  },
  {
    name: "Progression paraphrase — costs to recovery",
    detector: "hasConsequenceProgression",
    expected: true,
    script: `Costs were higher than sales.
Their first redesign failed to help.
They narrowed the product to one customer group.
By summer, income was greater than spending.`,
  },
  {
    name: "Progression false positive — mixed subjects",
    detector: "hasConsequenceProgression",
    expected: false,
    script: `The report said the company was losing money.
Analysts tried to explain why.
Instead, they focused on a competitor whose revenue increased.`,
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
