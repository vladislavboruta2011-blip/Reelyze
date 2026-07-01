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
  analyzeFlatMiddleFeedback,
  analyzeOpeningFeedback,
  buildMainTakeaway,
  detectScriptType,
  normalizeAutoCaptionScript,
} from "./scoring-script-feedback";

import { calibrateScoringScores } from "./scoring-calibration";

import { analyzeScoringEnding } from "./scoring-ending";

import { getFixSemanticKey } from "./scoring-fixes";

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

  // ── 1. Very short script ────────────────────────────────────────────────────
  if (charCount < 180 && !isStructurallyCompleteShort) {
    riskyParts.push({
      time: createTimeRange(0.1, 0.8, duration),
      title: "Script may be too short.",
      description: "The idea may not feel developed enough before the ending.",
    });
    if (primaryWeak === "short") {
      addFix("Add one stronger example, specific detail, or consequence before the final payoff.");
      addFix("Include a number, result, or named reference to make the script feel grounded.");
      addFix("Expand the payoff — state clearly what changes, what was lost, or what the viewer should take away.");
    }
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

  // ── 3. Generic/filler script ────────────────────────────────────────────────
  // Do not call a scenario-building script "generic" — use a more precise label.
  const hasScenarioStructure =
    openingWindowSignals.hasScenarioOpener ||
    /^(imagine|what if|picture this)\b/i.test(lines[0] ?? "");
  const genericLabel = hasScenarioStructure
    ? "Scenario lacks stakes or consequence."
    : "Script feels too generic.";
  const genericDescription = hasScenarioStructure
    ? "The scenario creates an image but the lines do not build toward a strong consequence, mystery, or specific tension."
    : "The lines repeat obvious ideas without a concrete example, number, twist, or consequence.";

  if (signals.genericPenalty >= 12 && overallScore < 72) {
    riskyParts.push({
      time: createTimeRange(0.2, 0.7, duration),
      title: genericLabel,
      description: genericDescription,
    });
    const midIdx = Math.floor(totalLines / 2);
    if (!riskyLineIndexes.includes(midIdx)) riskyLineIndexes.push(midIdx);
    if (totalLines > 3 && !riskyLineIndexes.includes(midIdx - 1)) {
      warningLineIndexes.push(midIdx - 1);
    }
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

  if (
    (payoffStrength < 28 && signals.consequenceScore < 15 && wordCount >= 20 && !isGoodScript && !lastLineIsStrong) ||
    (isGenericMotivationalEnding && !isGoodScript)
  ) {
    riskyParts.push({
      time: createTimeRange(0.75, 1.0, duration),
      title: isGenericMotivationalEnding ? "Weak or generic payoff." : "Payoff could be stronger.",
      description: isGenericMotivationalEnding
        ? "The ending is too vague to feel rewarding. Replace it with a specific consequence, result, or unresolved detail."
        : "The ending may not feel rewarding. A clearer result or consequence would help.",
    });
    riskyLineIndexes.push(Math.max(0, totalLines - 1));
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
  const middleSectionText = lines.slice(
    Math.floor(totalLines * 0.25),
    Math.floor(totalLines * 0.75)
  ).join(" ");
  const middleHasConcreteContent =
    /\d/.test(middleSectionText) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(middleSectionText) ||
    /\b(feet|miles|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|billion|million|thousand|degrees)\b/i.test(middleSectionText) ||
    /\b(would|could) (disappear|fit|vanish|be hidden|be buried|be submerged|still have)\b/i.test(middleSectionText) ||
    /\bmore than (a mile|a kilometer|a foot|a meter|a year)\b/i.test(middleSectionText) ||
    hasStructuredEscalation;

  if (
    signals.openLoopScore === 0 &&
    signals.curiosityScore < 12 &&
    signals.contrastScore < 15 &&
    wordCount >= 35 &&
    overallScore < 58 &&
    !hasStructuredEscalation &&
    !middleHasConcreteContent &&
    !isViralOrGiveaway &&
    !isEmotionalStory
  ) {
    if (!riskyParts.some(p => p.title === "No reason to keep watching.")) {
      riskyParts.push({
        time: createTimeRange(0.3, 0.6, duration),
        title: "No reason to keep watching.",
        description: "The script may not give viewers enough curiosity or unresolved tension before the payoff.",
      });
    }
  }

  // ── 7. Filler phrases ────────────────────────────────────────────────────────
  const fluffPhrases = [
    "basically", "as you can see", "i just want to", "this is very important",
    "let's talk about", "i'm going to explain", "really important",
  ];
  if (fluffPhrases.some(p => lower.includes(p))) {
    if (!riskyParts.some(p => p.title === "Script feels too generic." || p.title === "Possible filler phrases.")) {
      riskyParts.push({
        time: createTimeRange(0.3, 0.6, duration),
        title: "Possible filler phrases.",
        description: "Some lines may sound like setup instead of real value.",
      });
    }
  }

  // ── 8. Script too long ──────────────────────────────────────────────────────
  if (charCount > 850) {
    riskyParts.push({
      time: createTimeRange(0.55, 0.85, duration),
      title: "Script may be too long.",
      description: "Viewers may lose focus before the ending.",
    });
  }

  // ── Build fixes — context-aware, not generic ────────────────────────────────

  // Script-type-specific fixes (prepended before generic logic)
  if (isViralOrGiveaway) {
    const lowerNorm = normalizedText.toLowerCase();
    const hasCTAInterrupt =
      /\b(subscribe|follow|hit subscribe|smash subscribe)\b/i.test(lowerNorm) &&
      normalizedLines.length >= 4 &&
      normalizedLines.slice(0, Math.floor(normalizedLines.length * 0.8)).some(l =>
        /\b(subscribe|follow)\b/i.test(l.toLowerCase())
      );
    if (hasCTAInterrupt) {
      addFix("Move the subscribe CTA to after the payoff — placing it before the challenge resolves may cause viewers to drop.");
    }
    if (payoffStrength < 40) {
      addFix("Add one clear consequence: what happens if the challenge fails or succeeds?");
    }
    if (!structures.hasConsequencePayoff && wordCount > 30) {
      addFix("Make the challenge outcome clearer before any CTA — viewers need to know if it worked.");
    }
  }

  if (isEmotionalStory) {
    if (payoffStrength < 35) {
      addFix("Make the emotional payoff more specific — what exactly changed, and how does the viewer feel the impact?");
    }
    if (hookNeedsWork && effectiveHookScore < 65) {
      addFix("Open with the most emotional or unexpected moment from the story — not just the setup.");
    }
    if (signals.specificityScore < 20) {
      addFix("Add one specific named detail, place, or action to make the story feel real rather than general.");
    }
  }

  // Primary weakness fix — only add hook rewrites when hook actually needs work
  if (primaryWeak === "hook" && hookNeedsWork && effectiveHookScore < 65) {
    if (
      !structures.hasListBuildup &&
      (structures.hasStrongPayoffLate || structures.hasConsequencePayoff)
    ) {
      // The consequence exists — just needs to move forward
      addFix("Lead with the consequence: move your strongest final line to the very beginning.");
   } else if (structures.hasMysteryClueBuildup) {
      // Universal: mystery/clue script — find the most concrete physical detail line
      const strongestMysteryClue = lines.slice(1).find(l => {
        const ll = l.toLowerCase();
        const wordCount = l.split(/\s+/).length;
        // A good clue line: concrete object/state + not too long + not a vague summary
        return wordCount >= 5 && wordCount <= 18 &&
          (ll.includes("still") || ll.includes("untouched") || ll.includes("left behind") ||
           ll.includes("no signs") || ll.includes("nothing was") || ll.includes("everything was") ||
           ll.includes("appeared") || ll.includes("looked like") || ll.includes("seemed"));
      });
      if (strongestMysteryClue) {
        addFix(`Open with the most specific physical detail: "${strongestMysteryClue.replace(/[.!?]+$/, "").trim()}" creates more tension than announcing the topic.`);
      } else {
        addFix("Open with the most specific clue or physical detail from the script instead of announcing the topic.");
      }
    } else {
      addFix("Rewrite the opening line — it should lead with the strongest detail, consequence, or contrast from your script, not just announce the topic.");
    }
  }
  if (primaryWeak === "generic") {
    addFix("Replace generic advice lines with a single concrete example, number, or real consequence.");
    addFix("Cut any sentence that could apply to any video — only keep lines specific to this topic.");
  }
  if (primaryWeak === "payoff") {
    addFix("Make the final payoff more specific — state the result, consequence, or unresolved mystery clearly.");
  }

  // Supporting fixes — only add hook-focused fixes when hook needs work
  if (hookNeedsWork && signals.curiosityScore < 12 && effectiveHookScore < 55) {
    addFix("Open with an unanswered question, a missing detail, or a surprising consequence.");
  }

  // Only suggest "add contrast" if the script truly lacks contrast AND escalation
  if (
    signals.contrastScore < 12 &&
    signals.openLoopScore < 12 &&
    !hasStructuredEscalation &&
    wordCount > 20 &&
    overallScore < 58
  ) {
    addFix('Add a contrast line mid-script — something like: "But that is not the real problem."');
  }

  if (signals.genericPenalty >= 12 && overallScore < 72) {
    addFix("Add one specific detail, number, named reference, or real-world example to make the script feel grounded.");
  }
  if (
    signals.stakesScore < 12 &&
    signals.consequenceScore < 10 &&
    wordCount >= 25 &&
    overallScore < 62
  ) {
    addFix("Raise the stakes: what is at risk, what was lost, or what changes if this is ignored?");
  }
  if (signals.specificityScore < 10 && wordCount >= 20 && overallScore < 70) {
    addFix("Add a more concrete detail, example, consequence, or measurable result to make the script feel grounded.");
  }

  // Payoff fix — only if last line is NOT already a strong consequence
  if (
    payoffStrength < 28 &&
    signals.consequenceScore < 15 &&
    wordCount >= 20 &&
    !isGoodScript &&
    !lastLineIsStrong &&
    primaryWeak !== "payoff"
  ) {
    addFix("Make the final payoff more specific — state the result, consequence, or unresolved mystery clearly.");
  }

  // If the last line IS strong but hook is weak — suggest moving it
  if (lastLineIsStrong && effectiveHookScore < 55 && !fixes.some(f => f.toLowerCase().includes("lead with"))) {
    addFix("Lead with your strongest consequence: the final line of your script would make a more powerful opening.");
  }

 if (
    hookNeedsWork &&
    signals.openLoopScore === 0 &&
    signals.curiosityScore < 12 &&
    signals.contrastScore < 15 &&
    !hasStructuredEscalation &&
    !middleHasConcreteContent &&
    wordCount >= 35 &&
    overallScore < 58
  ) {
    addFix("Add an unanswered question or a delayed reveal to keep viewers engaged through the middle.");
  }
  if (fluffPhrases.some(p => lower.includes(p))) {
    addFix("Replace filler phrases with a specific example, concrete consequence, or direct insight.");
  }
  if (
    charCount < 180 &&
    !isStructurallyCompleteShort &&
    primaryWeak !== "short"
  ) {
    addFix("Add one stronger example or consequence before the final payoff.");
  }
  if (charCount > 850) {
    addFix("Cut repeated explanations and keep only the strongest points.");
  }

 // Hook fix for medium-score scripts — only when hook actually needs work
  if (hookNeedsWork && effectiveHookScore < 65 && primaryWeak !== "hook" && !fixes.some(f => f.toLowerCase().includes("rewrite") || f.toLowerCase().includes("opening line") || f.toLowerCase().includes("lead with"))) {
    addFix("Rewrite the opening line — lead with the strongest consequence, number, or contradiction from the script.");
  } else if (hookIsAcceptable && effectiveHookScore < 75 && !isGoodScript && retentionRisk > 35) {
    addFix("Tighten the middle section — each line should add new information or tension.");
  }

  // Optional improvements for good-but-not-great scripts
  if (isGoodScript && !isStrongScript) {
    if (fixes.length === 0) {
      if (hookScore >= 65 && retentionRisk <= 35) {
        addFix("Add one more specific example, number, or concrete detail to make the payoff feel more earned.");
        addFix("Make the payoff more specific so the viewer feels clearly rewarded.");
        addFix("Tighten any line that does not add new information or tension.");
      } else {
        if (hookScore < 75) addFix("Sharpen the first line with a stronger curiosity gap or clearer contrast.");
        if (signals.specificityScore < 30) addFix("Add one more specific detail to make the payoff feel even more concrete.");
        if (fixes.length === 0) addFix("Tighten any line that does not add new information or tension.");
      }
    }
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
