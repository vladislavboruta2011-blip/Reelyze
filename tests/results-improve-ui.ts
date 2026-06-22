import { readFileSync } from "node:fs";

const source = readFileSync("app/results/page.tsx", "utf8");
let failures = 0;

console.log("\nReelyze Improve Hook UI Regression Tests\n");

const fetchCount = source.split('fetch("/api/improve"').length - 1;

if (fetchCount === 1) {
  console.log("✅ PASS — Improve Hook uses one shared API request path");
} else {
  console.error(
    `❌ FAIL — Expected one shared Improve Hook request path, found ${fetchCount}`
  );
  failures += 1;
}

const handlerStart = source.indexOf("async function handleImproveHook");
const handlerEnd =
  handlerStart >= 0
    ? source.indexOf("\n  }", handlerStart)
    : -1;
const handler =
  handlerStart >= 0 && handlerEnd > handlerStart
    ? source.slice(handlerStart, handlerEnd)
    : "";

const jsonIndex = handler.indexOf("await response.json()");
const okIndex = handler.indexOf("if (!response.ok)");

if (jsonIndex >= 0 && okIndex >= 0 && jsonIndex < okIndex) {
  console.log("✅ PASS — API error payload is read before response.ok handling");
} else {
  console.error(
    "❌ FAIL — Improve Hook must read the API payload before handling a non-OK response"
  );
  failures += 1;
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("\nResult: all Improve Hook UI regression tests passed.");
}
