import {
  analyzeScript,
  createScriptLines,
  detectScriptStructures,
  estimateDuration,
} from "../engine/scoring";

type PairCase = {
  name: string;
  expectedMaxHookDelta: number;
  scriptA: {
    label: string;
    text: string;
  };
  scriptB: {
    label: string;
    text: string;
  };
};

const pairs: PairCase[] = [
  {
    name: "Known athlete vs unknown athlete",
    expectedMaxHookDelta: 3,
    scriptA: {
      label: "Ronaldo",
      text: `Ronaldo jumps high because he is strong.
His movement is fast and explosive.
That helps him reach the ball above other players.`,
    },
    scriptB: {
      label: "Okonkwo",
      text: `Okonkwo jumps high because he is strong.
His movement is fast and explosive.
That helps him reach the ball above other players.`,
    },
  },
  {
    name: "Known generic topic vs unknown generic topic",
    expectedMaxHookDelta: 3,
    scriptA: {
      label: "Sharks",
      text: `Sharks are dangerous.
They live in oceans around the world.
Many people are afraid of them.`,
    },
    scriptB: {
      label: "Tornadoes",
      text: `Tornadoes are dangerous.
They appear in regions around the world.
Many people are afraid of them.`,
    },
  },
  {
    name: "Sports paradox vs business paradox",
    expectedMaxHookDelta: 5,
    scriptA: {
      label: "Sports",
      text: `He wins the header before the defender even reacts.
The defender watches the ball.
The cross reaches the target.`,
    },
    scriptB: {
      label: "Business",
      text: `She wins the contract before the client even reacts.
The client watches the document.
The email enters the inbox.`,
    },
  },
  {
    name: "Known stunt object vs unknown stunt object",
    expectedMaxHookDelta: 3,
    scriptA: {
      label: "Katana",
      text: `Can you slice through a katana with a butter knife?
The blade was sharpened for hours.
Then the test finally began.`,
    },
    scriptB: {
      label: "Crowbar",
      text: `Can you slice through a crowbar with a butter knife?
The blade was sharpened for hours.
Then the test finally began.`,
    },
  },
];

function scoreScript(text: string) {
  const lines = createScriptLines(text);
  const duration = estimateDuration(text);
  const result = analyzeScript(text, duration, lines);
  const structures = detectScriptStructures(lines, text);

  return {
    hook: result.hook.score,
    overall: result.overall.score,
    retention: result.risk.score,
    escalationQuality: structures.escalationQuality,
    hasListBuildup: structures.hasListBuildup,
    hasNarrativeArc: structures.hasNarrativeArc,
    hasConsequenceProgression:
      structures.hasConsequenceProgression,
  };
}

console.log("\nReelyze Phase 5 Invariance Probe\n");

for (const pair of pairs) {
  const resultA = scoreScript(pair.scriptA.text);
  const resultB = scoreScript(pair.scriptB.text);

  const hookDelta = Math.abs(
    resultA.hook - resultB.hook,
  );

  const overallDelta = Math.abs(
    resultA.overall - resultB.overall,
  );

  const retentionDelta = Math.abs(
    resultA.retention - resultB.retention,
  );

  const hookInvariant =
    hookDelta <= pair.expectedMaxHookDelta;

  console.log(
    `${hookInvariant ? "✅" : "❌"} ${pair.name}`,
  );

  console.log(`  A — ${pair.scriptA.label}:`, resultA);
  console.log(`  B — ${pair.scriptB.label}:`, resultB);

  console.log(
    `  Deltas: hook ${hookDelta}, overall ${overallDelta}, retention ${retentionDelta}`,
  );

  console.log(
    `  Expected hook delta: ≤${pair.expectedMaxHookDelta}`,
  );

  console.log("");
}
