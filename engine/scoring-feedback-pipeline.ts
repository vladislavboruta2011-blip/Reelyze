import { analyzeScoringEnding } from "./scoring-ending";
import {
  buildBodyAndLengthFixes,
  buildMediumScoreFixes,
  buildOptionalImprovementFixes,
  buildPayoffFixes,
  buildPrimaryWeaknessFixes,
  buildScriptTypeFixes,
  buildStrongEndingOpeningFixes,
  buildSupportingSignalFixes,
  getFixSemanticKey,
} from "./scoring-fixes";
import {
  collectWarningLineIndexes,
  enforceScoringFeedbackMinimums,
  finalizeScoringFeedback,
  type FinalizedScoringFeedback,
} from "./scoring-risk-finalization";
import type { RiskyPart } from "./scoring-result-helpers";
import type { ScoringCalculationState } from "./scoring-score-calculation";
import {
  analyzeFillerFeedback,
  analyzeFlatMiddleFeedback,
  analyzeGenericFeedback,
  analyzeLengthFeedback,
  analyzeOpenLoopFeedback,
  analyzeOpeningFeedback,
  analyzePayoffFeedback,
  analyzePayoffPlacementFeedback,
  analyzeShortScriptFeedback,
} from "./scoring-script-feedback";

// Builds, deduplicates, and enforces the complete scoring feedback set.
export function buildScoringFeedbackPipeline({
  text,
  lines,
  duration,
  scoringState,
}: {
  text: string;
  lines: string[];
  duration: number;
  scoringState: ScoringCalculationState;
}): FinalizedScoringFeedback {
  const totalLines = lines.length;

  const {
    scriptType,
    normalizedText,
    normalizedLines,
    firstSentence,
    signals,
    structures,
    openingWindowSignals,
    hasStructuredEscalation,
    hookScore,
    payoffStrength,
    retentionRisk,
    charCount,
    isVeryShort,
    isStructurallyCompleteShort,
    effectiveHookScore,
    hookNeedsWork,
    hookIsAcceptable,
    overallScore,
  } = scoringState;

  // ── Hook status flags — drive risky parts, fixes, button label, scene breakdown ─
  // hookNeedsWork: the hook is weak enough that it should be the primary feedback.
  // hookIsAcceptable: the hook is decent; feedback should focus on middle/payoff.

  const isGoodScript = overallScore >= 70 && hookScore >= 65 && retentionRisk <= 35;
  const isStrongScript = overallScore >= 80;
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  type WeakArea = "hook" | "short" | "payoff" | "generic" | "middle" | "none";
  let primaryWeak: WeakArea = "none";
  if ((isVeryShort || charCount < 180) && !isStructurallyCompleteShort) {
    primaryWeak = "short";
  } else if (hookNeedsWork && effectiveHookScore < 45) {
    primaryWeak = "hook";
  } else if (signals.genericPenalty >= 20) {
    primaryWeak = "generic";
  } else if (payoffStrength < 28 && signals.consequenceScore < 15) {
    primaryWeak = "payoff";
  } else if (hookNeedsWork && effectiveHookScore < 65) {
    primaryWeak = "hook";
  }
  // If hookIsAcceptable, never set primaryWeak to "hook"

  const riskyParts: RiskyPart[] = [];
  const fixes: string[] = [];
  const riskyLineIndexes: number[] = [];
  const warningLineIndexes: number[] = [];

  const fixKeys = new Set<string>();
  function addFix(text: string) {
    const key = getFixSemanticKey(text);
    if (!fixKeys.has(key)) {
      fixKeys.add(key);
      fixes.push(text);
    }
  }

  // ── Script-type context for risky parts ───────────────────────────────────
  const isViralOrGiveaway = scriptType === "viral_challenge" || scriptType === "giveaway_or_prize";
  const isEmotionalStory = scriptType === "emotional_story";

  const shortScriptFeedback =
    analyzeShortScriptFeedback({
      charCount,
      isStructurallyCompleteShort,
      isPrimaryWeakShort:
        primaryWeak === "short",
      duration,
    });

  if (shortScriptFeedback.riskyPart) {
    riskyParts.push(
      shortScriptFeedback.riskyPart,
    );
  }

  for (const fix of shortScriptFeedback.fixes) {
    addFix(fix);
  }

  const endingAnalysis = analyzeScoringEnding({
    lastLine: lines[totalLines - 1] ?? "",
    hasConsequencePayoff:
      structures.hasConsequencePayoff,
  });

  const {
    isGenericMotivationalEnding,
    lastLineIsStrong,
  } = endingAnalysis;

  const openingFeedback =
    analyzeOpeningFeedback({
      normalizedText,
      firstSentence,
      isViralOrGiveaway,
      hookNeedsWork,
      effectiveHookScore,
      isGenericMotivationalEnding,
      structures,
      hasScenarioOpener:
        openingWindowSignals.hasScenarioOpener,
      scenarioHasStakes:
        openingWindowSignals.scenarioHasStakes,
      curiosityScore:
        signals.curiosityScore,
      duration,
    });

  riskyParts.push(
    ...openingFeedback.riskyParts,
  );

  riskyLineIndexes.push(
    ...openingFeedback.riskyLineIndexes,
  );

  warningLineIndexes.push(
    ...openingFeedback.warningLineIndexes,
  );

  const genericFeedback =
    analyzeGenericFeedback({
      lines,
      hasScenarioOpener:
        openingWindowSignals.hasScenarioOpener,
      genericPenalty:
        signals.genericPenalty,
      overallScore,
      duration,
    });

  if (genericFeedback.riskyPart) {
    riskyParts.push(
      genericFeedback.riskyPart,
    );
  }

  if (
    genericFeedback.riskyLineIndex !== null &&
    !riskyLineIndexes.includes(
      genericFeedback.riskyLineIndex,
    )
  ) {
    riskyLineIndexes.push(
      genericFeedback.riskyLineIndex,
    );
  }

  if (
    genericFeedback.warningLineIndex !== null &&
    !riskyLineIndexes.includes(
      genericFeedback.warningLineIndex,
    )
  ) {
    warningLineIndexes.push(
      genericFeedback.warningLineIndex,
    );
  }

  // ── 4. Flat middle — only when structure detection confirms it ──────────────
  const flatMiddleFeedback =
    analyzeFlatMiddleFeedback({
      lines,
      structures,
      isGoodScript,
      retentionRisk,
      duration,
      existingRiskyTitles:
        riskyParts.map(
          (part) => part.title,
        ),
    });

  if (flatMiddleFeedback.riskyPart) {
    riskyParts.push(
      flatMiddleFeedback.riskyPart,
    );
  }

  if (
    flatMiddleFeedback.riskyLineIndex !== null &&
    !riskyLineIndexes.includes(
      flatMiddleFeedback.riskyLineIndex,
    )
  ) {
    riskyLineIndexes.push(
      flatMiddleFeedback.riskyLineIndex,
    );
  }

  // ── 5. Payoff / ending ──────────────────────────────────────────────────────
  // IMPORTANT: If the last line IS a strong consequence, don't call it weak payoff.
  // Instead, check if the issue is placement (strong payoff but hook was weak).
  // lastLine, lastLineLower, and isGenericMotivationalEnding are already declared above.

  const payoffFeedback =
    analyzePayoffFeedback({
      payoffStrength,
      consequenceScore:
        signals.consequenceScore,
      wordCount,
      isGoodScript,
      lastLineIsStrong,
      isGenericMotivationalEnding,
      totalLines,
      duration,
    });

  if (payoffFeedback.riskyPart) {
    riskyParts.push(
      payoffFeedback.riskyPart,
    );
  }

  if (
    payoffFeedback.riskyLineIndex !== null
  ) {
    riskyLineIndexes.push(
      payoffFeedback.riskyLineIndex,
    );
  }

  // If hook needs work but ending IS strong: label as placement issue
  // Do NOT run when the ending is generic/motivational — isGenericMotivationalEnding already
  // sets lastLineIsStrong to false, but guard explicitly here for clarity and safety.
  const payoffPlacementFeedback =
    analyzePayoffPlacementFeedback({
      isGenericMotivationalEnding,
      hasListBuildup:
        structures.hasListBuildup,
      lastLineIsStrong,
      hookNeedsWork,
      effectiveHookScore,
      alreadyHasStrongPayoffLateFeedback:
        riskyParts.some(
          (part) =>
            part.title ===
            "Strong payoff appears too late.",
        ),
    });

  if (payoffPlacementFeedback.replacement) {
    // Replace generic "Weak opening" with placement-specific feedback
    const weakOpeningIdx = riskyParts.findIndex(
      (part) =>
        part.title === "Weak opening.",
    );
    if (weakOpeningIdx >= 0) {
      riskyParts[weakOpeningIdx] = {
        time: riskyParts[weakOpeningIdx].time,
        ...payoffPlacementFeedback.replacement,
      };
    }
  }

// ── 6. No open loop (very weak scripts only, and only when no valid structure) ──
  // Also suppress when the middle contains concrete scale, named references,
  // or explanatory content — these are not "no reason to keep watching".
  const openLoopFeedback =
    analyzeOpenLoopFeedback({
      lines,
      openLoopScore:
        signals.openLoopScore,
      curiosityScore:
        signals.curiosityScore,
      contrastScore:
        signals.contrastScore,
      wordCount,
      overallScore,
      hasStructuredEscalation,
      isViralOrGiveaway,
      isEmotionalStory,
      duration,
    });

  if (
    openLoopFeedback.riskyPart &&
    !riskyParts.some(
      (part) =>
        part.title ===
        "No reason to keep watching.",
    )
  ) {
    riskyParts.push(
      openLoopFeedback.riskyPart,
    );
  }

  // ── 7. Filler phrases ────────────────────────────────────────────────────────
  const fillerFeedback =
    analyzeFillerFeedback({
      lower,
      duration,
    });

  if (
    fillerFeedback.riskyPart &&
    !riskyParts.some(
      (part) =>
        part.title ===
          "Script feels too generic." ||
        part.title ===
          "Possible filler phrases.",
    )
  ) {
    riskyParts.push(
      fillerFeedback.riskyPart,
    );
  }

  // ── 8. Script too long ──────────────────────────────────────────────────────
  const lengthFeedback =
    analyzeLengthFeedback({
      charCount,
      duration,
    });

  if (lengthFeedback.riskyPart) {
    riskyParts.push(
      lengthFeedback.riskyPart,
    );
  }

  // ── Build fixes — context-aware, not generic ────────────────────────────────

  for (
    const fix of buildScriptTypeFixes({
      isViralOrGiveaway,
      isEmotionalStory,
      normalizedText,
      normalizedLines,
      payoffStrength,
      hasConsequencePayoff:
        structures.hasConsequencePayoff,
      wordCount,
      hookNeedsWork,
      effectiveHookScore,
      specificityScore:
        signals.specificityScore,
    })
  ) {
    addFix(fix);
  }

  for (
    const fix of buildPrimaryWeaknessFixes({
      primaryWeak,
      hookNeedsWork,
      effectiveHookScore,
      structures,
      lines,
    })
  ) {
    addFix(fix);
  }

  // Supporting fixes — only add hook-focused fixes when hook needs work
  for (
    const fix of buildSupportingSignalFixes({
      hookNeedsWork,
      curiosityScore: signals.curiosityScore,
      effectiveHookScore,
      contrastScore: signals.contrastScore,
      openLoopScore: signals.openLoopScore,
      hasStructuredEscalation,
      wordCount,
      overallScore,
      genericPenalty: signals.genericPenalty,
      stakesScore: signals.stakesScore,
      consequenceScore: signals.consequenceScore,
      specificityScore: signals.specificityScore,
    })
  ) {
    addFix(fix);
  }

  for (
    const fix of buildPayoffFixes({
      payoffStrength,
      consequenceScore: signals.consequenceScore,
      wordCount,
      isGoodScript,
      lastLineIsStrong,
      primaryWeak,
    })
  ) {
    addFix(fix);
  }

  for (
    const fix of buildStrongEndingOpeningFixes({
      lastLineIsStrong,
      effectiveHookScore,
      hasLeadWithFix: fixes.some((fix) =>
        fix.toLowerCase().includes("lead with"),
      ),
    })
  ) {
    addFix(fix);
  }

  for (
    const fix of buildBodyAndLengthFixes({
      hookNeedsWork,
      openLoopScore: signals.openLoopScore,
      curiosityScore: signals.curiosityScore,
      contrastScore: signals.contrastScore,
      hasStructuredEscalation,
      middleHasConcreteContent:
        openLoopFeedback.middleHasConcreteContent,
      wordCount,
      overallScore,
      hasFluffPhrases:
        fillerFeedback.hasFillerPhrases,
      charCount,
      isStructurallyCompleteShort,
      primaryWeak,
    })
  ) {
    addFix(fix);
  }

  for (
    const fix of buildMediumScoreFixes({
      hookNeedsWork,
      effectiveHookScore,
      primaryWeak,
      hasOpeningFix: fixes.some(
        (fix) =>
          fix.toLowerCase().includes("rewrite") ||
          fix.toLowerCase().includes("opening line") ||
          fix.toLowerCase().includes("lead with"),
      ),
      hookIsAcceptable,
      isGoodScript,
      retentionRisk,
    })
  ) {
    addFix(fix);
  }

  for (
    const fix of buildOptionalImprovementFixes({
      isGoodScript,
      isStrongScript,
      hasExistingFixes: fixes.length > 0,
      hookScore,
      retentionRisk,
      specificityScore: signals.specificityScore,
    })
  ) {
    addFix(fix);
  }

  warningLineIndexes.push(
    ...collectWarningLineIndexes(
      lines,
      riskyLineIndexes,
      signals.genericPenalty,
    ),
  );

  const finalizedFeedback = finalizeScoringFeedback({
    riskyParts,
    fixes,
    riskyLineIndexes,
    warningLineIndexes,
    totalLines,
  });

  return enforceScoringFeedbackMinimums({
    ...finalizedFeedback,
    overallScore,
    effectiveHookScore,
    hasStructuredEscalation,
    isStructurallyCompleteShort,
    hookNeedsWork,
    hasConsequencePayoff:
      structures.hasConsequencePayoff,
    contrastScore: signals.contrastScore,
    payoffScore: signals.payoffScore,
    consequenceScore:
      signals.consequenceScore,
    openLoopScore: signals.openLoopScore,
    genericPenalty: signals.genericPenalty,
    payoffStrength,
    lastLineIsStrong,
    totalLines,
    duration,
  });
}
