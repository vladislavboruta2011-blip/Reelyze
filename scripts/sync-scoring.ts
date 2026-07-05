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

const scoringRankingStructuresPath = path.join(
  projectRoot,
  "engine/scoring-ranking-structures.ts",
);

const scoringStructureDetectorsPath = path.join(
  projectRoot,
  "engine/scoring-structure-detectors.ts",
);

const scoringRewritePath = path.join(
  projectRoot,
  "engine/scoring-rewrite.ts",
);

const scoringEvaluationPath = path.join(
  projectRoot,
  "engine/scoring-evaluation.ts",
);

const scoringHookEvaluationPath = path.join(
  projectRoot,
  "engine/scoring-hook-evaluation.ts",
);

const scoringRetentionEvaluationPath = path.join(
  projectRoot,
  "engine/scoring-retention-evaluation.ts",
);

const scoringPayoffEvaluationPath = path.join(
  projectRoot,
  "engine/scoring-payoff-evaluation.ts",
);

const scoringScriptPreprocessingPath = path.join(
  projectRoot,
  "engine/scoring-script-preprocessing.ts",
);

const scoringPayoffFeedbackPath = path.join(
  projectRoot,
  "engine/scoring-payoff-feedback.ts",
);

const scoringBodyFeedbackPath = path.join(
  projectRoot,
  "engine/scoring-body-feedback.ts",
);

const scoringScriptFeedbackPath = path.join(
  projectRoot,
  "engine/scoring-script-feedback.ts",
);

const scoringMainTakeawayPath = path.join(
  projectRoot,
  "engine/scoring-main-takeaway.ts",
);

const scoringScoreCalculationPath = path.join(
  projectRoot,
  "engine/scoring-score-calculation.ts",
);

const scoringFeedbackPipelinePath = path.join(
  projectRoot,
  "engine/scoring-feedback-pipeline.ts",
);

const scoringResultHelpersPath = path.join(
  projectRoot,
  "engine/scoring-result-helpers.ts",
);

const scoringFixesPath = path.join(
  projectRoot,
  "engine/scoring-fixes.ts",
);

const scoringFixBuildersPath = path.join(
  projectRoot,
  "engine/scoring-fix-builders.ts",
);

const scoringRiskFinalizationPath = path.join(
  projectRoot,
  "engine/scoring-risk-finalization.ts",
);

const scoringFeedbackMinimumsPath = path.join(
  projectRoot,
  "engine/scoring-feedback-minimums.ts",
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

const scoringRankingStructuresSource = fs.readFileSync(
  scoringRankingStructuresPath,
  "utf8",
);

const scoringStructureDetectorsSource = fs.readFileSync(
  scoringStructureDetectorsPath,
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

const scoringHookEvaluationSource = fs.readFileSync(
  scoringHookEvaluationPath,
  "utf8",
);

const scoringRetentionEvaluationSource = fs.readFileSync(
  scoringRetentionEvaluationPath,
  "utf8",
);

const scoringPayoffEvaluationSource = fs.readFileSync(
  scoringPayoffEvaluationPath,
  "utf8",
);

const scoringScriptPreprocessingSource = fs.readFileSync(
  scoringScriptPreprocessingPath,
  "utf8",
);

const scoringPayoffFeedbackSource = fs.readFileSync(
  scoringPayoffFeedbackPath,
  "utf8",
);

const scoringBodyFeedbackSource = fs.readFileSync(
  scoringBodyFeedbackPath,
  "utf8",
);

const scoringScriptFeedbackSource = fs.readFileSync(
  scoringScriptFeedbackPath,
  "utf8",
);

const scoringMainTakeawaySource = fs.readFileSync(
  scoringMainTakeawayPath,
  "utf8",
);

const scoringScoreCalculationSource = fs.readFileSync(
  scoringScoreCalculationPath,
  "utf8",
);

const scoringFeedbackPipelineSource = fs.readFileSync(
  scoringFeedbackPipelinePath,
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

const scoringFixBuildersSource = fs.readFileSync(
  scoringFixBuildersPath,
  "utf8",
);

const scoringRiskFinalizationSource = fs.readFileSync(
  scoringRiskFinalizationPath,
  "utf8",
);

const scoringFeedbackMinimumsSource = fs.readFileSync(
  scoringFeedbackMinimumsPath,
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

const requiredHookEvaluationExports = [
  "export function calculateHookStrength(",
];

const missingHookEvaluationExports =
  requiredHookEvaluationExports.filter(
    (declaration) =>
      !scoringHookEvaluationSource.includes(declaration),
  );

if (missingHookEvaluationExports.length > 0) {
  throw new Error(
    [
      "Scoring hook-evaluation module is missing required exports:",
      ...missingHookEvaluationExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRetentionEvaluationExports = [
  "export function calculateRetentionStructure(",
];

const missingRetentionEvaluationExports =
  requiredRetentionEvaluationExports.filter(
    (declaration) =>
      !scoringRetentionEvaluationSource.includes(declaration),
  );

if (missingRetentionEvaluationExports.length > 0) {
  throw new Error(
    [
      "Scoring retention-evaluation module is missing required exports:",
      ...missingRetentionEvaluationExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredPayoffEvaluationExports = [
  "export function calculatePayoffStrength(",
];

const missingPayoffEvaluationExports =
  requiredPayoffEvaluationExports.filter(
    (declaration) =>
      !scoringPayoffEvaluationSource.includes(declaration),
  );

if (missingPayoffEvaluationExports.length > 0) {
  throw new Error(
    [
      "Scoring payoff-evaluation module is missing required exports:",
      ...missingPayoffEvaluationExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredScriptPreprocessingExports = [
  "export function detectScriptType(",
  "export function normalizeAutoCaptionScript(",
];

const missingScriptPreprocessingExports =
  requiredScriptPreprocessingExports.filter(
    (declaration) =>
      !scoringScriptPreprocessingSource.includes(declaration),
  );

if (missingScriptPreprocessingExports.length > 0) {
  throw new Error(
    [
      "Scoring script-preprocessing module is missing required exports:",
      ...missingScriptPreprocessingExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredPayoffFeedbackExports = [
  "export function analyzePayoffFeedback(",
  "export function analyzePayoffPlacementFeedback(",
];

const missingPayoffFeedbackExports =
  requiredPayoffFeedbackExports.filter(
    (declaration) =>
      !scoringPayoffFeedbackSource.includes(declaration),
  );

if (missingPayoffFeedbackExports.length > 0) {
  throw new Error(
    [
      "Scoring payoff-feedback module is missing required exports:",
      ...missingPayoffFeedbackExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredBodyFeedbackExports = [
  "export function analyzeOpenLoopFeedback(",
  "export function analyzeFillerFeedback(",
  "export function analyzeLengthFeedback(",
  "export function analyzeFlatMiddleFeedback(",
];

const missingBodyFeedbackExports =
  requiredBodyFeedbackExports.filter(
    (declaration) =>
      !scoringBodyFeedbackSource.includes(declaration),
  );

if (missingBodyFeedbackExports.length > 0) {
  throw new Error(
    [
      "Scoring body-feedback module is missing required exports:",
      ...missingBodyFeedbackExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredScriptFeedbackExports = [
  "export function analyzeOpeningFeedback(",
  "export function analyzeShortScriptFeedback(",
  "export function analyzeGenericFeedback(",
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

const requiredMainTakeawayExports = [
  "export function buildMainTakeaway(",
];

const missingMainTakeawayExports =
  requiredMainTakeawayExports.filter(
    (declaration) =>
      !scoringMainTakeawaySource.includes(declaration),
  );

if (missingMainTakeawayExports.length > 0) {
  throw new Error(
    [
      "Scoring main-takeaway module is missing required exports:",
      ...missingMainTakeawayExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredScoreCalculationExports = [
  "export type ScoringCalculationState",
  "export function calculateScoringState(",
];

const missingScoreCalculationExports =
  requiredScoreCalculationExports.filter(
    (declaration) =>
      !scoringScoreCalculationSource.includes(declaration),
  );

if (missingScoreCalculationExports.length > 0) {
  throw new Error(
    [
      "Scoring score-calculation module is missing required exports:",
      ...missingScoreCalculationExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredFeedbackPipelineExports = [
  "export function buildScoringFeedbackPipeline(",
];

const missingFeedbackPipelineExports =
  requiredFeedbackPipelineExports.filter(
    (declaration) =>
      !scoringFeedbackPipelineSource.includes(declaration),
  );

if (missingFeedbackPipelineExports.length > 0) {
  throw new Error(
    [
      "Scoring feedback-pipeline module is missing required exports:",
      ...missingFeedbackPipelineExports.map(
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

const requiredFixBuilderExports = [
  "export function buildScriptTypeFixes(",
  "export function buildPrimaryWeaknessFixes(",
  "export function buildSupportingSignalFixes(",
  "export function buildBodyAndLengthFixes(",
  "export function buildMediumScoreFixes(",
  "export function buildOptionalImprovementFixes(",
  "export function buildPayoffFixes(",
  "export function buildStrongEndingOpeningFixes(",
];

const missingFixBuilderExports =
  requiredFixBuilderExports.filter(
    (declaration) =>
      !scoringFixBuildersSource.includes(
        declaration,
      ),
  );

if (missingFixBuilderExports.length > 0) {
  throw new Error(
    [
      "Scoring fix-builders module is missing required exports:",
      ...missingFixBuilderExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredFeedbackMinimumsExports = [
  "export function enforceScoringFeedbackMinimums(",
];

const missingFeedbackMinimumsExports =
  requiredFeedbackMinimumsExports.filter(
    (declaration) =>
      !scoringFeedbackMinimumsSource.includes(
        declaration,
      ),
  );

if (missingFeedbackMinimumsExports.length > 0) {
  throw new Error(
    [
      "Scoring feedback-minimums module is missing required exports:",
      ...missingFeedbackMinimumsExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRiskFinalizationExports = [
  "export type FinalizedScoringFeedback",
  "export function collectWarningLineIndexes(",
  "export function finalizeScoringFeedback(",
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

const requiredStructureDetectorExports = [
  "export function detectPersistenceArc(",
  "export function detectCapabilityViolation(",
  "export function detectAnomalySequence(",
  "export function detectConsequenceProgression(",
  "export function detectNarrativeArc(",
  "export function hasStrongOutcomePayoff(",
  "export function hasSpecificQuantity(",
];

const missingStructureDetectorExports =
  requiredStructureDetectorExports.filter(
    (declaration) =>
      !scoringStructureDetectorsSource.includes(
        declaration,
      ),
  );

if (missingStructureDetectorExports.length > 0) {
  throw new Error(
    [
      "Scoring structure-detectors module is missing required exports:",
      ...missingStructureDetectorExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRankingStructuresExports = [
  "export interface RankingStructures",
  "export function detectRankingStructures(",
];

const missingRankingStructuresExports =
  requiredRankingStructuresExports.filter(
    (declaration) =>
      !scoringRankingStructuresSource.includes(
        declaration,
      ),
  );

if (missingRankingStructuresExports.length > 0) {
  throw new Error(
    [
      "Scoring ranking-structures module is missing required exports:",
      ...missingRankingStructuresExports.map(
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
