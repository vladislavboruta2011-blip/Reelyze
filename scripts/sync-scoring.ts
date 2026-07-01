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

const scoringRiskFinalizationPath = path.join(
  projectRoot,
  "engine/scoring-risk-finalization.ts",
);

const scoringTimingPath = path.join(
  projectRoot,
  "engine/scoring-timing.ts",
);

const scoringCalibrationPath = path.join(
  projectRoot,
  "engine/scoring-calibration.ts",
);

const scoringEndingPath = path.join(
  projectRoot,
  "engine/scoring-ending.ts",
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

const scoringRiskFinalizationSource = fs.readFileSync(
  scoringRiskFinalizationPath,
  "utf8",
);

const scoringTimingSource = fs.readFileSync(
  scoringTimingPath,
  "utf8",
);

const scoringCalibrationSource = fs.readFileSync(
  scoringCalibrationPath,
  "utf8",
);

const scoringEndingSource = fs.readFileSync(
  scoringEndingPath,
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
  `export {
  createScriptLines,
  estimateDuration,
  formatTime,
} from "./scoring-timing";`,
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
  "export function analyzeOpeningFeedback(",
  "export function buildMainTakeaway(",
  "export function analyzeFlatMiddleFeedback(",
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
  "export function buildScriptTypeFixes(",
  "export function buildPrimaryWeaknessFixes(",
  "export function buildSupportingSignalFixes(",
  "export function buildBodyAndLengthFixes(",
  "export function buildPayoffFixes(",
  "export function buildStrongEndingOpeningFixes(",
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

const requiredRiskFinalizationExports = [
  "export type FinalizedScoringFeedback",
  "export function collectWarningLineIndexes(",
  "export function finalizeScoringFeedback(",
  "export function enforceScoringFeedbackMinimums(",
];

const missingRiskFinalizationExports =
  requiredRiskFinalizationExports.filter(
    (declaration) =>
      !scoringRiskFinalizationSource.includes(
        declaration,
      ),
  );

if (missingRiskFinalizationExports.length > 0) {
  throw new Error(
    [
      "Scoring risk-finalization module is missing required exports:",
      ...missingRiskFinalizationExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredScoringTimingExports = [
  "export function createScriptLines(",
  "export function estimateDuration(",
  "export function createTimeRange(",
  "export function formatTime(",
];

const missingScoringTimingExports =
  requiredScoringTimingExports.filter(
    (declaration) =>
      !scoringTimingSource.includes(declaration),
  );

if (missingScoringTimingExports.length > 0) {
  throw new Error(
    [
      "Scoring timing module is missing required exports:",
      ...missingScoringTimingExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredScoringCalibrationExports = [
  "export type CalibratedScoringScores",
  "export function calibrateScoringScores(",
];

const missingScoringCalibrationExports =
  requiredScoringCalibrationExports.filter(
    (declaration) =>
      !scoringCalibrationSource.includes(declaration),
  );

if (missingScoringCalibrationExports.length > 0) {
  throw new Error(
    [
      "Scoring calibration module is missing required exports:",
      ...missingScoringCalibrationExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredScoringEndingExports = [
  "export type ScoringEndingAnalysis",
  "export function analyzeScoringEnding(",
];

const missingScoringEndingExports =
  requiredScoringEndingExports.filter(
    (declaration) =>
      !scoringEndingSource.includes(declaration),
  );

if (missingScoringEndingExports.length > 0) {
  throw new Error(
    [
      "Scoring ending module is missing required exports:",
      ...missingScoringEndingExports.map(
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
