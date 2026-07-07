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

const scoringRewriteAnchorPath = path.join(
  projectRoot,
  "engine/scoring-rewrite-anchor.ts",
);

const scoringRewriteFormattingPath = path.join(
  projectRoot,
  "engine/scoring-rewrite-formatting.ts",
);

const scoringRewriteNumberSentencePath = path.join(
  projectRoot,
  "engine/scoring-rewrite-number-sentence.ts",
);

const scoringRewriteConsequencePath = path.join(
  projectRoot,
  "engine/scoring-rewrite-consequence.ts",
);

const scoringRewriteVisualDetailPath = path.join(
  projectRoot,
  "engine/scoring-rewrite-visual-detail.ts",
);

const scoringRewriteReversalPath = path.join(
  projectRoot,
  "engine/scoring-rewrite-reversal.ts",
);

const scoringRewriteFillerFallbackPath = path.join(
  projectRoot,
  "engine/scoring-rewrite-filler-fallback.ts",
);

const scoringRewriteContrastFallbackPath = path.join(
  projectRoot,
  "engine/scoring-rewrite-contrast-fallback.ts",
);

const scoringRewriteDefaultFallbackPath = path.join(
  projectRoot,
  "engine/scoring-rewrite-default-fallback.ts",
);

const scoringRewriteGenericGuardPath = path.join(
  projectRoot,
  "engine/scoring-rewrite-generic-guard.ts",
);

const scoringRewriteScenarioOpenerPath = path.join(
  projectRoot,
  "engine/scoring-rewrite-scenario-opener.ts",
);

const scoringRewriteOpenersPath = path.join(
  projectRoot,
  "engine/scoring-rewrite-openers.ts",
);

const scoringRewriteReasonPath = path.join(
  projectRoot,
  "engine/scoring-rewrite-reason.ts",
);

const scoringEvaluationPath = path.join(
  projectRoot,
  "engine/scoring-evaluation.ts",
);

const scoringOpeningWindowPath = path.join(
  projectRoot,
  "engine/scoring-opening-window.ts",
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

const scoringScriptTypeFixesPath = path.join(
  projectRoot,
  "engine/scoring-script-type-fixes.ts",
);

const scoringPrimaryWeaknessFixesPath = path.join(
  projectRoot,
  "engine/scoring-primary-weakness-fixes.ts",
);

const scoringSupportingSignalFixesPath = path.join(
  projectRoot,
  "engine/scoring-supporting-signal-fixes.ts",
);

const scoringBodyLengthFixesPath = path.join(
  projectRoot,
  "engine/scoring-body-length-fixes.ts",
);

const scoringPayoffFixesPath = path.join(
  projectRoot,
  "engine/scoring-payoff-fixes.ts",
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

const scoringRewriteAnchorSource = fs.readFileSync(
  scoringRewriteAnchorPath,
  "utf8",
);

const scoringRewriteFormattingSource = fs.readFileSync(
  scoringRewriteFormattingPath,
  "utf8",
);

const scoringRewriteNumberSentenceSource = fs.readFileSync(
  scoringRewriteNumberSentencePath,
  "utf8",
);

const scoringRewriteConsequenceSource = fs.readFileSync(
  scoringRewriteConsequencePath,
  "utf8",
);

const scoringRewriteVisualDetailSource = fs.readFileSync(
  scoringRewriteVisualDetailPath,
  "utf8",
);

const scoringRewriteReversalSource = fs.readFileSync(
  scoringRewriteReversalPath,
  "utf8",
);

const scoringRewriteFillerFallbackSource = fs.readFileSync(
  scoringRewriteFillerFallbackPath,
  "utf8",
);

const scoringRewriteContrastFallbackSource = fs.readFileSync(
  scoringRewriteContrastFallbackPath,
  "utf8",
);

const scoringRewriteDefaultFallbackSource = fs.readFileSync(
  scoringRewriteDefaultFallbackPath,
  "utf8",
);

const scoringRewriteGenericGuardSource = fs.readFileSync(
  scoringRewriteGenericGuardPath,
  "utf8",
);

const scoringRewriteScenarioOpenerSource = fs.readFileSync(
  scoringRewriteScenarioOpenerPath,
  "utf8",
);

const scoringRewriteOpenersSource = fs.readFileSync(
  scoringRewriteOpenersPath,
  "utf8",
);

const scoringRewriteReasonSource = fs.readFileSync(
  scoringRewriteReasonPath,
  "utf8",
);

const scoringEvaluationSource = fs.readFileSync(
  scoringEvaluationPath,
  "utf8",
);

const scoringOpeningWindowSource = fs.readFileSync(
  scoringOpeningWindowPath,
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

const scoringScriptTypeFixesSource = fs.readFileSync(
  scoringScriptTypeFixesPath,
  "utf8",
);

const scoringPrimaryWeaknessFixesSource = fs.readFileSync(
  scoringPrimaryWeaknessFixesPath,
  "utf8",
);

const scoringSupportingSignalFixesSource = fs.readFileSync(
  scoringSupportingSignalFixesPath,
  "utf8",
);

const scoringBodyLengthFixesSource = fs.readFileSync(
  scoringBodyLengthFixesPath,
  "utf8",
);

const scoringPayoffFixesSource = fs.readFileSync(
  scoringPayoffFixesPath,
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

const requiredRewriteAnchorExports = [
  "export function lineHasRewriteHardAnchor(",
];

const missingRewriteAnchorExports =
  requiredRewriteAnchorExports.filter(
    (declaration) =>
      !scoringRewriteAnchorSource.includes(declaration),
  );

if (missingRewriteAnchorExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite anchor module is missing required exports:",
      ...missingRewriteAnchorExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteFormattingExports = [
  "export function capitalizeFirst(",
];

const missingRewriteFormattingExports =
  requiredRewriteFormattingExports.filter(
    (declaration) =>
      !scoringRewriteFormattingSource.includes(declaration),
  );

if (missingRewriteFormattingExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite formatting module is missing required exports:",
      ...missingRewriteFormattingExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteNumberSentenceExports = [
  "export function createNumberSentenceRewrite(",
];

const missingRewriteNumberSentenceExports =
  requiredRewriteNumberSentenceExports.filter(
    (declaration) =>
      !scoringRewriteNumberSentenceSource.includes(declaration),
  );

if (missingRewriteNumberSentenceExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite number sentence module is missing required exports:",
      ...missingRewriteNumberSentenceExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteConsequenceExports = [
  "export function createConsequenceRewrite(",
];

const missingRewriteConsequenceExports =
  requiredRewriteConsequenceExports.filter(
    (declaration) =>
      !scoringRewriteConsequenceSource.includes(declaration),
  );

if (missingRewriteConsequenceExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite consequence module is missing required exports:",
      ...missingRewriteConsequenceExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteVisualDetailExports = [
  "export function createVisualDetailRewrite(",
];

const missingRewriteVisualDetailExports =
  requiredRewriteVisualDetailExports.filter(
    (declaration) =>
      !scoringRewriteVisualDetailSource.includes(declaration),
  );

if (missingRewriteVisualDetailExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite visual detail module is missing required exports:",
      ...missingRewriteVisualDetailExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteReversalExports = [
  "export function createReversalRewrite(",
];

const missingRewriteReversalExports =
  requiredRewriteReversalExports.filter(
    (declaration) =>
      !scoringRewriteReversalSource.includes(declaration),
  );

if (missingRewriteReversalExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite reversal module is missing required exports:",
      ...missingRewriteReversalExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteFillerFallbackExports = [
  "export function createFillerFallbackRewrite(",
];

const missingRewriteFillerFallbackExports =
  requiredRewriteFillerFallbackExports.filter(
    (declaration) =>
      !scoringRewriteFillerFallbackSource.includes(declaration),
  );

if (missingRewriteFillerFallbackExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite filler fallback module is missing required exports:",
      ...missingRewriteFillerFallbackExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteContrastFallbackExports = [
  "export function createContrastFallbackRewrite(",
];

const missingRewriteContrastFallbackExports =
  requiredRewriteContrastFallbackExports.filter(
    (declaration) =>
      !scoringRewriteContrastFallbackSource.includes(declaration),
  );

if (missingRewriteContrastFallbackExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite contrast fallback module is missing required exports:",
      ...missingRewriteContrastFallbackExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteDefaultFallbackExports = [
  "export function createDefaultFallbackRewrite(",
];

const missingRewriteDefaultFallbackExports =
  requiredRewriteDefaultFallbackExports.filter(
    (declaration) =>
      !scoringRewriteDefaultFallbackSource.includes(declaration),
  );

if (missingRewriteDefaultFallbackExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite default fallback module is missing required exports:",
      ...missingRewriteDefaultFallbackExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteGenericGuardExports = [
  "export function createGenericGuardRewrite(",
];

const missingRewriteGenericGuardExports =
  requiredRewriteGenericGuardExports.filter(
    (declaration) =>
      !scoringRewriteGenericGuardSource.includes(declaration),
  );

if (missingRewriteGenericGuardExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite generic guard module is missing required exports:",
      ...missingRewriteGenericGuardExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteScenarioOpenerExports = [
  "export function createScenarioOpenerRewrite(",
];

const missingRewriteScenarioOpenerExports =
  requiredRewriteScenarioOpenerExports.filter(
    (declaration) =>
      !scoringRewriteScenarioOpenerSource.includes(declaration),
  );

if (missingRewriteScenarioOpenerExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite scenario opener module is missing required exports:",
      ...missingRewriteScenarioOpenerExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteOpenersExports = [
  "export function isRewriteFillerIntro(",
  "export function isRewriteScenarioOpener(",
];

const missingRewriteOpenersExports =
  requiredRewriteOpenersExports.filter(
    (declaration) =>
      !scoringRewriteOpenersSource.includes(declaration),
  );

if (missingRewriteOpenersExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite openers module is missing required exports:",
      ...missingRewriteOpenersExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredRewriteReasonExports = [
  "export function getHookRewriteReason(",
];

const missingRewriteReasonExports =
  requiredRewriteReasonExports.filter(
    (declaration) =>
      !scoringRewriteReasonSource.includes(declaration),
  );

if (missingRewriteReasonExports.length > 0) {
  throw new Error(
    [
      "Scoring rewrite reason module is missing required exports:",
      ...missingRewriteReasonExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

const requiredEvaluationExports = [
  "export interface UniversalSignals",
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

const requiredOpeningWindowExports = [
  "export interface OpeningWindowSignals",
  "export function extractOpeningWindow(",
  "export function scoreOpeningWindow(",
];

const missingOpeningWindowExports =
  requiredOpeningWindowExports.filter(
    (declaration) =>
      !scoringOpeningWindowSource.includes(
        declaration,
      ),
  );

if (missingOpeningWindowExports.length > 0) {
  throw new Error(
    [
      "Scoring opening-window module is missing required exports:",
      ...missingOpeningWindowExports.map(
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

const requiredScriptTypeFixExports = [
  "export function buildScriptTypeFixes(",
];

const missingScriptTypeFixExports =
  requiredScriptTypeFixExports.filter(
    (declaration) =>
      !scoringScriptTypeFixesSource.includes(
        declaration,
      ),
  );

if (missingScriptTypeFixExports.length > 0) {
  throw new Error(
    [
      "Scoring script-type fixes module is missing required exports:",
      ...missingScriptTypeFixExports.map(
        (declaration) => `  - ${declaration}`,
      ),
    ].join("\n"),
  );
}

  const requiredPrimaryWeaknessFixExports = [
    "export function buildPrimaryWeaknessFixes(",
  ];

  const missingPrimaryWeaknessFixExports =
    requiredPrimaryWeaknessFixExports.filter(
      (declaration) =>
        !scoringPrimaryWeaknessFixesSource.includes(
          declaration,
        ),
    );

  if (missingPrimaryWeaknessFixExports.length > 0) {
    throw new Error(
      [
        "Scoring primary-weakness fixes module is missing required exports:",
        ...missingPrimaryWeaknessFixExports.map(
          (declaration) => `  - ${declaration}`,
        ),
      ].join("\n"),
    );
  }

  const requiredSupportingSignalFixExports = [
    "export function buildSupportingSignalFixes(",
  ];

  const missingSupportingSignalFixExports =
    requiredSupportingSignalFixExports.filter(
      (declaration) =>
        !scoringSupportingSignalFixesSource.includes(
          declaration,
        ),
    );

  if (missingSupportingSignalFixExports.length > 0) {
    throw new Error(
      [
        "Scoring supporting-signal fixes module is missing required exports:",
        ...missingSupportingSignalFixExports.map(
          (declaration) => `  - ${declaration}`,
        ),
      ].join("\n"),
    );
  }

  const requiredBodyLengthFixExports = [
    "export function buildBodyAndLengthFixes(",
  ];

  const missingBodyLengthFixExports =
    requiredBodyLengthFixExports.filter(
      (declaration) =>
        !scoringBodyLengthFixesSource.includes(
          declaration,
        ),
    );

  if (missingBodyLengthFixExports.length > 0) {
    throw new Error(
      [
        "Scoring body-and-length fixes module is missing required exports:",
        ...missingBodyLengthFixExports.map(
          (declaration) => `  - ${declaration}`,
        ),
      ].join("\n"),
    );
  }

  const requiredPayoffFixExports = [
    "export function buildPayoffFixes(",
  ];

  const missingPayoffFixExports =
    requiredPayoffFixExports.filter(
      (declaration) =>
        !scoringPayoffFixesSource.includes(
          declaration,
        ),
    );

  if (missingPayoffFixExports.length > 0) {
    throw new Error(
      [
        "Scoring payoff fixes module is missing required exports:",
        ...missingPayoffFixExports.map(
          (declaration) => `  - ${declaration}`,
        ),
      ].join("\n"),
    );
  }

  const requiredFixBuilderExports = [
    'export { buildScriptTypeFixes } from "./scoring-script-type-fixes";',
    'export { buildPrimaryWeaknessFixes } from "./scoring-primary-weakness-fixes";',
    'export { buildSupportingSignalFixes } from "./scoring-supporting-signal-fixes";',
    'export { buildBodyAndLengthFixes } from "./scoring-body-length-fixes";',
    "export function buildMediumScoreFixes(",
    "export function buildOptionalImprovementFixes(",
    'export { buildPayoffFixes } from "./scoring-payoff-fixes";',
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
