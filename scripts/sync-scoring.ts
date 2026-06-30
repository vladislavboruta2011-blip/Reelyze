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

const scoringResultHelpersPath = path.join(
  projectRoot,
  "engine/scoring-result-helpers.ts",
);

const scoringFixesPath = path.join(
  projectRoot,
  "engine/scoring-fixes.ts",
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

const scoringResultHelpersSource = fs.readFileSync(
  scoringResultHelpersPath,
  "utf8",
);

const scoringFixesSource = fs.readFileSync(
  scoringFixesPath,
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
  `export type {
  AnalysisResult,
  RiskyPart,
  SceneSegment,
  ScoreData,
} from "./scoring-result-helpers";`,
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

const requiredResultHelperExports = [
  "export type ScoreData",
  "export type RiskyPart",
  "export type SceneSegment",
  "export type AnalysisResult",
  "export function createSceneSegments(",
  "export function dedupeRiskyParts(",
  "export function clampScore(",
  "export function getOverallLabel(",
  "export function getHookLabel(",
  "export function getRiskLabel(",
  "export function getHookColor(",
  "export function getRiskColor(",
  "export function getHookDescription(",
  "export function getRiskDescription(",
];

const missingResultHelperExports =
  requiredResultHelperExports.filter(
    (declaration) =>
      !scoringResultHelpersSource.includes(declaration),
  );

if (missingResultHelperExports.length > 0) {
  throw new Error(
    [
      "Scoring result-helper module is missing required exports:",
      ...missingResultHelperExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredScoringFixExports = [
  "export function getFixSemanticKey(",
  "export function dedupeFixes(",
];

const missingScoringFixExports =
  requiredScoringFixExports.filter(
    (declaration) =>
      !scoringFixesSource.includes(declaration),
  );

if (missingScoringFixExports.length > 0) {
  throw new Error(
    [
      "Scoring fixes module is missing required exports:",
      ...missingScoringFixExports.map(
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
