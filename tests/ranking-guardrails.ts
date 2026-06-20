import { detectScriptStructures } from "../engine/scoring";

type GuardrailCase = {
  name: string;
  script: string;
};

const cases: GuardrailCase[] = [
  {
    name: "Weather changes over time",
    script: `The temperature changed across three consecutive days.
On day one, the recorded temperature was higher than 20 degrees outside.
On day two, the recorded temperature fell below 18 degrees outside.
On day three, the recorded temperature was nearly 17 degrees outside.
The change came from a cold front moving through the region.`,
  },
  {
    name: "Single app improving over time",
    script: `The same app was tested during three different development weeks.
During week one, memory usage was higher than 4 gigabytes under load.
During week two, memory usage dropped below 3 gigabytes under load.
During week three, memory usage was nearly 2 gigabytes under load.
The improvement came from removing several unnecessary background processes.`,
  },
  {
    name: "Signal weakening with distance",
    script: `Engineers measured one wireless signal at several different distances.
At 10 meters, the measured signal was higher than the original estimate.
At 20 meters, the measured signal fell below half strength.
At 30 meters, the measured signal was nearly impossible to detect.
The pattern showed ordinary signal loss rather than a ranked comparison.`,
  },
];

function createScriptLines(script: string): string[] {
  return script
    .trim()
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

let failed = 0;

console.log("\nReelyze Phase 4 Ranking Guardrail Tests\n");

for (const test of cases) {
  const lines = createScriptLines(test.script);
  const structures = detectScriptStructures(lines, test.script);

  const hasListPass = structures.hasListBuildup === false;
  const qualityPass = structures.escalationQuality !== "list";
  const pass = hasListPass && qualityPass;

  if (!pass) failed++;

  console.log(`${pass ? "✅ PASS" : "❌ FAIL"} — ${test.name}`);
  console.log(
    `  hasListBuildup: ${structures.hasListBuildup} expected false`,
  );
  console.log(
    `  escalationQuality: ${structures.escalationQuality} expected not list`,
  );
}

if (failed > 0) {
  console.error(
    `\nResult: ${failed}/${cases.length} ranking guardrail tests failed.`,
  );
  process.exit(1);
}

console.log("\nResult: all ranking guardrail tests passed.");
