import {
  analyzeScript,
  detectScriptStructures,
  detectNarrativeArc,
} from "../engine/scoring";

function createScriptLines(script: string) {
  const cleaned = script.trim().replace(/\s+/g, " ");

  if (!cleaned) return [];

  const sentenceParts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (sentenceParts.length >= 2) return sentenceParts;

  const words = cleaned.split(" ");
  if (words.length <= 12) return [cleaned];

  const lines: string[] = [];
  const wordsPerLine = 10;

  for (let i = 0; i < words.length; i += wordsPerLine) {
    const line = words.slice(i, i + wordsPerLine).join(" ");
    if (line) lines.push(line);
  }

  return lines;
}

function estimateDuration(script: string) {
  const cleaned = script.trim().replace(/\s+/g, " ");
  if (cleaned.length === 0) return 0;
  const seconds = Math.ceil(cleaned.length / 16.5);
  return Math.max(4, seconds);
}
import { testCases } from "./fixtures";

type DetectorKey =
  | "hasPersistenceArc"
  | "hasCapabilityViolation"
  | "hasAnomalySequence"
  | "hasConsequenceProgression";

const structureExpectations: Record<
  string,
  Record<DetectorKey, boolean>
> = {
  "Dog grave story": {
    hasPersistenceArc: true,
    hasCapabilityViolation: false,
    hasAnomalySequence: false,
    hasConsequenceProgression: false,
  },
  "Coma language story": {
    hasPersistenceArc: false,
    hasCapabilityViolation: true,
    hasAnomalySequence: false,
    hasConsequenceProgression: false,
  },
  "Village vanished story": {
    hasPersistenceArc: false,
    hasCapabilityViolation: false,
    hasAnomalySequence: true,
    hasConsequenceProgression: false,
  },
  "Pacific Ocean weak factual script": {
    hasPersistenceArc: false,
    hasCapabilityViolation: false,
    hasAnomalySequence: false,
    hasConsequenceProgression: false,
  },
  "Startup losing money story": {
    hasPersistenceArc: false,
    hasCapabilityViolation: false,
    hasAnomalySequence: false,
    hasConsequenceProgression: true,
  },
  "Generic motivation weak script": {
    hasPersistenceArc: false,
    hasCapabilityViolation: false,
    hasAnomalySequence: false,
    hasConsequenceProgression: false,
  },
};

function inRange(value: number, range: [number, number]) {
  return value >= range[0] && value <= range[1];
}

let failed = 0;

console.log("\nReelyze Phase 0 Regression Harness\n");

for (const test of testCases) {
  const lines = createScriptLines(test.script);
  const duration = estimateDuration(test.script);
  const result = analyzeScript(test.script, duration, lines);
  const structures = detectScriptStructures(lines, test.script);
  const arc = detectNarrativeArc(lines);

  const hook = result.hook.score;
  const overall = result.overall.score;
  const retention = result.risk.score;

  const hookPass = inRange(hook, test.expected.hook);
  const overallPass = inRange(overall, test.expected.overall);
  const retentionPass = inRange(retention, test.expected.retention);

  const expectedStructure = structureExpectations[test.name];

  if (!expectedStructure) {
    throw new Error(
      `Missing structure expectations for: ${test.name}`,
    );
  }

  const detectorChecks = (
    Object.keys(expectedStructure) as DetectorKey[]
  ).map((key) => ({
    key,
    actual: structures[key],
    expected: expectedStructure[key],
    pass: structures[key] === expectedStructure[key],
  }));

  const structuresPass = detectorChecks.every(
    (check) => check.pass,
  );

  const pass =
    hookPass &&
    overallPass &&
    retentionPass &&
    structuresPass;

  if (!pass) failed++;

  console.log(`${pass ? "✅ PASS" : "❌ FAIL"} — ${test.name}`);
  console.log(`  Hook:      ${hook} expected ${test.expected.hook[0]}-${test.expected.hook[1]} ${hookPass ? "" : "❌"}`);
  console.log(`  Overall:   ${overall} expected ${test.expected.overall[0]}-${test.expected.overall[1]} ${overallPass ? "" : "❌"}`);
  console.log(`  Retention: ${retention} expected ${test.expected.retention[0]}-${test.expected.retention[1]} ${retentionPass ? "" : "❌"}`);

  console.log("  Detector assertions:");

  for (const check of detectorChecks) {
    console.log(
      `    ${check.key}: ${check.actual} expected ${check.expected} ${check.pass ? "" : "❌"}`,
    );
  }

  console.log("  Debug:");
  console.log("    Lines:", lines);
  console.log("    NarrativeArc:", arc);
  console.log("    Structures:", {
    hasNarrativeArc: structures.hasNarrativeArc,
    narrativeArcIsEarly: structures.narrativeArcIsEarly,
    hasMysteryClueBuildup: structures.hasMysteryClueBuildup,
    hasContradictionReversal: structures.hasContradictionReversal,
    hasConsequencePayoff: structures.hasConsequencePayoff,
    hasExplanationChain: structures.hasExplanationChain,
    escalationQuality: structures.escalationQuality,
  });

  console.log("");
}

if (failed > 0) {
  console.log(`Result: ${failed} test(s) failed.`);
  process.exit(1);
}

console.log("Result: all tests passed.");
