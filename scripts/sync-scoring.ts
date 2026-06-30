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

const scoringRewritePath = path.join(
  projectRoot,
  "engine/scoring-rewrite.ts",
);

const scoringEvaluationPath = path.join(
  projectRoot,
  "engine/scoring-evaluation.ts",
);

const scoringScriptFeedbackPath = path.join(
  projectRoot,
  "engine/scoring-script-feedback.ts",
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

const scoringRewriteSource = fs.readFileSync(
  scoringRewritePath,
  "utf8",
);

const scoringEvaluationSource = fs.readFileSync(
  scoringEvaluationPath,
  "utf8",
);

const scoringScriptFeedbackSource = fs.readFileSync(
  scoringScriptFeedbackPath,
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

const requiredScoringExports = [
  "export function analyzeScript(",
  "export function createScriptLines(",
  "export function estimateDuration(",
  "export function formatTime(",
  "export type AnalysisResult",
  "export type RiskyPart",
  "export type SceneSegment",
  'export { createHookRewrite, getHookRewriteReason } from "./scoring-rewrite";',
];

const missingScoringExports =
  requiredScoringExports.filter(
    (declaration) =>
      !scoringSource.includes(declaration),
  );

if (missingScoringExports.length > 0) {
  throw new Error(
    [
      "Canonical scoring entry point is missing required exports:",
      ...missingScoringExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteExports = [
  "export function createHookRewrite(",
  "export function getHookRewriteReason(",
];

const missingRewriteExports =
  requiredRewriteExports.filter(
    (declaration) =>
      !scoringRewriteSource.includes(declaration),
  );

if (missingRewriteExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite module is missing required exports:",
      ...missingRewriteExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredEvaluationExports = [
  "export interface OpeningWindowSignals",
  "export interface UniversalSignals",
  "export function extractOpeningWindow(",
  "export function scoreOpeningWindow(",
  "export function extractUniversalSignals(",
  "export function calculateHookStrength(",
  "export function calculateRetentionStructure(",
  "export function calculatePayoffStrength(",
];

const missingEvaluationExports =
  requiredEvaluationExports.filter(
    (declaration) =>
      !scoringEvaluationSource.includes(declaration),
  );

if (missingEvaluationExports.length > 0) {
  throw new Error(
    [
      "Scoring evaluation module is missing required exports:",
      ...missingEvaluationExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredScriptFeedbackExports = [
  "export function detectScriptType(",
  "export function normalizeAutoCaptionScript(",
  "export function buildMainTakeaway(",
];

const missingScriptFeedbackExports =
  requiredScriptFeedbackExports.filter(
    (declaration) =>
      !scoringScriptFeedbackSource.includes(declaration),
  );

if (missingScriptFeedbackExports.length > 0) {
  throw new Error(
    [
      "Scoring script-feedback module is missing required exports:",
      ...missingScriptFeedbackExports.map(
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
  "PASS — scoring entry point and extracted scoring modules are valid",
);
