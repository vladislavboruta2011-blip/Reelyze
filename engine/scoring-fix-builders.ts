// Context-aware suggested-fix builders used by the scoring feedback pipeline.

// Keep fix deduplication and feedback orchestration outside this module.

export { buildScriptTypeFixes } from "./scoring-script-type-fixes";

export { buildPrimaryWeaknessFixes } from "./scoring-primary-weakness-fixes";

export { buildSupportingSignalFixes } from "./scoring-supporting-signal-fixes";

export { buildBodyAndLengthFixes } from "./scoring-body-length-fixes";

export { buildPayoffFixes } from "./scoring-payoff-fixes";

export { buildStrongEndingOpeningFixes } from "./scoring-strong-ending-opening-fixes";

export { buildMediumScoreFixes } from "./scoring-medium-score-fixes";

export { buildOptionalImprovementFixes } from "./scoring-optional-improvement-fixes";
