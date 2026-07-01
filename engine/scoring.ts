export { createHookRewrite, getHookRewriteReason } from "./scoring-rewrite";

import {
  detectScriptStructures,
  type ScriptStructures,
} from "./scoring-structures";

import {
  calculateHookStrength,
  calculatePayoffStrength,
  calculateRetentionStructure,
  extractOpeningWindow,
  extractUniversalSignals,
  scoreOpeningWindow,
} from "./scoring-evaluation";

import {
  analyzeFillerFeedback,
  analyzeFlatMiddleFeedback,
  analyzeGenericFeedback,
  analyzeLengthFeedback,
  analyzeOpenLoopFeedback,
  analyzeOpeningFeedback,
  analyzePayoffFeedback,
  analyzeShortScriptFeedback,
  buildMainTakeaway,
  detectScriptType,
  normalizeAutoCaptionScript,
} from "./scoring-script-feedback";

import { calibrateScoringScores } from "./scoring-calibration";

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
} from "./scoring-risk-finalization";

import {
  createScriptLines,
  createTimeRange,
} from "./scoring-timing";

export {
  createScriptLines,
  estimateDuration,
  formatTime,
} from "./scoring-timing";

import {
  clampScore,
  createSceneSegments,
  getHookColor,
  getHookDescription,
  getHookLabel,
  getOverallLabel,
  getRiskColor,
  getRiskDescription,
  getRiskLabel,
  type AnalysisResult,
  type RiskyPart,
} from "./scoring-result-helpers";

export type {
  AnalysisResult,
  RiskyPart,
  SceneSegment,
  ScoreData,
} from "./scoring-result-helpers";

export {
  detectNarrativeArc,
  detectScriptStructures,
} from "./scoring-structures";

// Canonical pure scoring engine for the Results experience.
// Keep this file UI-free so production and regression tests use identical logic.

export function analyzeScript(
  script: string,
  duration: number,
  scriptLines: string[]
): AnalysisResult {
  const text = script.trim();
  const lines = scriptLines;
  const totalLines = lines.length;

  const scriptType = detectScriptType(text);

  // Normalize auto-caption transcripts before scoring
  const normalizedText = scriptType === "auto_caption_transcript"
    ? normalizeAutoCaptionScript(text)
    : text;
  const normalizedLines = scriptType === "auto_caption_transcript"
    ? createScriptLines(normalizedText)
    : lines;

  const firstSentence = normalizedText.split(/[.!?]/)[0]?.trim() ?? normalizedText.trim();
  const signals = extractUniversalSignals(normalizedText);
  const structures = detectScriptStructures(normalizedLines, normalizedText);

  const firstLower = firstSentence.toLowerCase();
  const bodyAfterHook = normalizedLines.slice(1).join(" ").toLowerCase();

  const hasVisualMysteryOpening =
    /\b(ship|boat|plane|camera|room|city|house|car|train|building|door|table|food|cargo|message|signal|footage)\b/i.test(firstSentence) &&
    /\b(found|discovered|drifting|empty|abandoned|open|untouched|still|gone|missing|disappeared|vanished|no signs|no emergency|no clear reason)\b/i.test(normalizedText) &&
    (
      /\b(still|untouched|gone|missing|disappeared|vanished|no signs|no emergency|no clear reason|every person|nobody|no one)\b/i.test(bodyAfterHook) ||
      /\bwith .{0,70} still\b/i.test(firstLower)
    );

  let hookScore = text.length > 0
    ? Math.max(18, clampScore(calculateHookStrength(firstSentence, signals, normalizedText)))
    : 0;

  if (hasVisualMysteryOpening && hookScore < 82) {
    hookScore = 82;
  }
  const structureRisk = calculateRetentionStructure(lines, signals, structures);
  const payoffStrength = calculatePayoffStrength(lines, signals);

  const payoffReduction = Math.min(payoffStrength * 0.10, 8);
  let retentionRisk = clampScore(Math.round(structureRisk - payoffReduction));

  if (structures.hasCapabilityViolation) {
    retentionRisk = Math.max(20, retentionRisk - 2);
  }

  if (structures.hasConsequenceProgression) {
    retentionRisk = Math.max(20, retentionRisk - 6);
  }

  if (retentionRisk < 20) retentionRisk = 20;

  // ── Hook + structure bonus: if hook is strong and escalation is detected,
  //    retention risk should not be High (≥65) ─────────────────────────────
const hasStructuredEscalation =
    structures.hasListBuildup ||
    structures.hasMysteryClueBuildup ||
    structures.hasContradictionReversal ||
    structures.hasConsequencePayoff ||
    structures.hasNumericPremise ||
    structures.hasExplanationChain ||
    structures.hasNarrativeArc ||
    structures.hasPersistenceArc ||
    structures.hasCapabilityViolation ||
    structures.hasAnomalySequence ||
    structures.hasConsequenceProgression;

  if (hookScore >= 70 && hasStructuredEscalation && retentionRisk >= 65) {
    retentionRisk = Math.min(retentionRisk, 58);
  }
  // Even with a decent hook (55+) and any buildup, cap at Medium
  if (hookScore >= 55 && hasStructuredEscalation && retentionRisk >= 65) {
    retentionRisk = Math.min(retentionRisk, 62);
  }

  const charCount = text.length;
  const hasNumericSpecificity = signals.specificityScore >= 30;
  const isShortSimple = charCount < 350 && totalLines <= 5;
  const isVeryShort = charCount < 130;
  const isStructurallyCompleteShort =
    charCount < 180 &&
    totalLines >= 4 &&
    hasStructuredEscalation &&
    structures.hasConsequencePayoff;

  const shortScriptSignalCount = [
    /\d/.test(text) && /\b(feet|miles|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|billion|million|thousand|degrees|\$)\b/i.test(text),
    structures.hasContradictionReversal || /\bbut\b|\bhowever\b|\bnot\b/i.test(text),
    signals.stakesScore >= 10,
    signals.consequenceScore >= 10 || structures.hasConsequencePayoff,
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(text),
  ].filter(Boolean).length;

  const isDenseDespiteShort = isVeryShort && shortScriptSignalCount >= 3;

 // Structure quality bonus — reward scripts that have valid escalation even if hook is weak.
  // This prevents a well-structured explanation chain or mystery from scoring very low
  // purely because the filler intro drags hook score down.
  const hasFillerOpener =
    structures.hasFillerIntro ||
    /^(today i|in this video|i will|i want to|let's talk|so today|hey guys|welcome|this video)/i.test(firstSentence);

  const hasGenericHookOpener =
    /\b(is very important|is important in|is possible for anyone|many people want|everyone wants|we all want|is the key to|takes hard work|success is|failure is|time is |life is )\b/i.test(firstSentence);

  const openingWindowText = extractOpeningWindow(lines);
  const openingWindowSignals = scoreOpeningWindow(openingWindowText);

  const openingWindowBonus =
    !hasFillerOpener && !hasGenericHookOpener
      ? Math.round(openingWindowSignals.windowStrength * 0.4)
      : 0;

  const effectiveHookScore = Math.min(88, hookScore + openingWindowBonus);

    const hookNeedsWork =
    !hasVisualMysteryOpening &&
    (
      effectiveHookScore < 58 ||
      hasFillerOpener ||
      hasGenericHookOpener ||
      (openingWindowSignals.hasScenarioOpener && !openingWindowSignals.scenarioHasStakes && effectiveHookScore < 55)
    );

  const hookIsAcceptable = !hookNeedsWork;

  const displayHookScore = effectiveHookScore;

  const structureBonus =
    (structures.hasExplanationChain ? 6 : 0) +
    (structures.hasNumericPremise ? 4 : 0) +
    (structures.hasListBuildup ? 5 : 0) +
    (structures.hasMysteryClueBuildup ? 4 : 0) +
    (structures.hasContradictionReversal ? 4 : 0) +
    (structures.hasConsequencePayoff ? 3 : 0) +
    (structures.hasCapabilityViolation ? 4 : 0) +
    (structures.hasConsequenceProgression ? 4 : 0);
  // Cap bonus so it can't inflate a weak hook script into "Very Strong"
  const cappedStructureBonus = Math.min(structureBonus, 12);

  let overallScore = clampScore(
    Math.round(effectiveHookScore * 0.55 + (100 - retentionRisk) * 0.45 + cappedStructureBonus)
  );

  if (!hasNumericSpecificity && overallScore > 85) overallScore = 85;
  if (isShortSimple && !isDenseDespiteShort && overallScore > 82) overallScore = 82;
  if (isVeryShort && !isDenseDespiteShort && overallScore > 55) overallScore = 55;
  if (retentionRisk > 30 && overallScore > 88) overallScore = 88;
  if (payoffStrength < 40 && overallScore > 85) overallScore = 85;

  if (signals.genericPenalty >= 42) overallScore = Math.min(overallScore, 42);
  else if (signals.genericPenalty >= 28) overallScore = Math.min(overallScore, 52);
  else if (signals.genericPenalty >= 20) overallScore = Math.min(overallScore, 62);
  else if (signals.genericPenalty >= 12) overallScore = Math.min(overallScore, 72);

  // Keep extremely generic scripts weak, but avoid unusable edge scores.
  if (signals.genericPenalty >= 42) {
    overallScore = Math.max(overallScore, 15);
    retentionRisk = Math.min(retentionRisk, 90);
  }

  overallScore = clampScore(overallScore);

    if (hasVisualMysteryOpening) {
    if (overallScore < 72) overallScore = 72;
    if (retentionRisk > 45) retentionRisk = 45;
  }

  const calibratedScores = calibrateScoringScores({
    scriptType,
    firstSentence,
    normalizedText,
    text,
    displayHookScore,
    overallScore,
    retentionRisk,
    signals,
  });

  const calibratedHookScore =
    calibratedScores.calibratedHookScore;

  overallScore = calibratedScores.overallScore;
  retentionRisk = calibratedScores.retentionRisk;

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
  if (
    !isGenericMotivationalEnding &&
    !structures.hasListBuildup &&
    lastLineIsStrong &&
    hookNeedsWork &&
    effectiveHookScore < 55 &&
    !riskyParts.some(p => p.title === "Strong payoff appears too late.")
  ) {
    // Replace generic "Weak opening" with placement-specific feedback
    const weakOpeningIdx = riskyParts.findIndex(p => p.title === "Weak opening.");
    if (weakOpeningIdx >= 0) {
      riskyParts[weakOpeningIdx] = {
        time: riskyParts[weakOpeningIdx].time,
        title: "Strong payoff appears too late.",
        description: "The strongest consequence is at the end but not in the opening. Move it earlier to stop the scroll.",
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

  const {
    uniqueRiskyParts,
    uniqueFixes,
    uniqueRiskyIndexes,
    uniqueWarningIndexes,
  } = enforceScoringFeedbackMinimums({
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

  const hasEndingFlagged = uniqueRiskyParts.some(p =>
    p.title.toLowerCase().includes("payoff") ||
    p.title.toLowerCase().includes("too long") ||
    p.title.toLowerCase().includes("drop-off")
  );

  const sceneSegments = createSceneSegments(
    effectiveHookScore,
    retentionRisk,
    overallScore,
    uniqueRiskyParts.length > 0,
    hasEndingFlagged,
    uniqueFixes.length,
    payoffStrength,
    structures,
  );

  const issueTitles = uniqueRiskyParts.map(p => p.title.toLowerCase());
  const mainTakeaway = buildMainTakeaway(
    text,
    calibratedHookScore,
    payoffStrength,
    retentionRisk,
    signals,
    structures,
    issueTitles,
  );

  return {
    overall: {
      score: overallScore,
      label: getOverallLabel(overallScore),
      color: "#FFFFFF",
      ringColor: overallScore >= 75 ? "#22C55E" : overallScore >= 60 ? "#F59E0B" : "#EF4444",
      description: mainTakeaway,
    },
    hook: {
      score: calibratedHookScore,
      label: getHookLabel(calibratedHookScore),
      color: getHookColor(calibratedHookScore),
      ringColor: getHookColor(calibratedHookScore),
      description: getHookDescription(calibratedHookScore, issueTitles, structures),
    },
    risk: {
      score: retentionRisk,
      label: getRiskLabel(retentionRisk),
      color: getRiskColor(retentionRisk),
      ringColor: getRiskColor(retentionRisk),
      description: getRiskDescription(retentionRisk, issueTitles, structures, signals.genericPenalty),
    },
    riskyParts: uniqueRiskyParts.slice(0, 4),
    fixes: uniqueFixes.slice(0, 5),
    riskyLineIndexes: uniqueRiskyIndexes,
    warningLineIndexes: uniqueWarningIndexes,
    sceneSegments,
  };
}
