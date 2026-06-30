import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const resultsPath = path.join(
  projectRoot,
  "app/results/page.tsx",
);

const scoringPath = path.join(
  projectRoot,
  "engine/scoring.ts",
);

const duplicatePath = path.join(
  projectRoot,
  "app/results/engine/scoring.ts",
);

const resultsSource = fs.readFileSync(
  resultsPath,
  "utf8",
);

const scoringSource = fs.readFileSync(
  scoringPath,
  "utf8",
);

const forbiddenResultsDeclarations = [
  "function analyzeScript(",
  "function createScriptLines(",
  "function estimateDuration(",
  "function createHookRewrite(",
  "function getHookRewriteReason(",
];

const duplicatedDeclarations =
  forbiddenResultsDeclarations.filter(
    (declaration) =>
      resultsSource.includes(declaration),
  );

if (duplicatedDeclarations.length > 0) {
  throw new Error(
    [
      "Results page contains duplicated scoring declarations:",
      ...duplicatedDeclarations.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredExports = [
  "export function analyzeScript(",
  "export function createScriptLines(",
  "export function estimateDuration(",
  "export function createHookRewrite(",
  "export function getHookRewriteReason(",
  "export function formatTime(",
  "export type AnalysisResult",
  "export type RiskyPart",
  "export type SceneSegment",
];

const missingExports = requiredExports.filter(
  (declaration) =>
    !scoringSource.includes(declaration),
);

if (missingExports.length > 0) {
  throw new Error(
    [
      "Canonical scoring engine is missing required exports:",
      ...missingExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

if (fs.existsSync(duplicatePath)) {
  throw new Error(
    "Unused duplicate app/results/engine/scoring.ts must not exist.",
  );
}

console.log(
  "PASS — engine/scoring.ts is the single scoring source of truth",
);
