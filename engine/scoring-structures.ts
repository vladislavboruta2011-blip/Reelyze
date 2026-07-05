// Pure structural detectors used by the canonical scoring engine.

// Keep this module independent from final scoring, feedback generation, and UI code.



import { detectRankingStructures } from "./scoring-ranking-structures";

import {
  detectAnomalySequence,
  detectCapabilityViolation,
  detectConsequenceProgression,
  detectNarrativeArc,
  detectPersistenceArc,
  hasSpecificQuantity,
  hasStrongOutcomePayoff,
} from "./scoring-structure-detectors";

export {
  detectAnomalySequence,
  detectCapabilityViolation,
  detectConsequenceProgression,
  detectNarrativeArc,
  detectPersistenceArc,
  hasSpecificQuantity,
  hasStrongOutcomePayoff,
};

export interface ScriptStructures {
  hasListBuildup: boolean;
  hasMysteryClueBuildup: boolean;
  hasContradictionReversal: boolean;
  hasConsequencePayoff: boolean;
  hasStrongPayoffLate: boolean;
  hasNumericPremise: boolean;
  hasFillerIntro: boolean;
  hasExplanationChain: boolean;     // premise → mechanism → consequence → payoff
  hasWeakPayoff: boolean;           // script ends with no new consequence or vague summary
  hasNarrativeArc: boolean;
  narrativeArcIsEarly: boolean;
  hasPersistenceArc: boolean;
  hasCapabilityViolation: boolean;
  hasAnomalySequence: boolean;
  hasConsequenceProgression: boolean;
  escalationQuality: "list" | "mystery" | "reversal" | "explanation" | "flat" | "none";
}

export function detectScriptStructures(lines: string[], fullText: string): ScriptStructures {
  const lower = fullText.toLowerCase();
  const totalLines = lines.length;

  // ── Filler intro ──────────────────────────────────────────────────────────
  const firstLine = lines[0] ?? "";
  const firstLower = firstLine.toLowerCase().trim();
  const hasFillerIntro =
    firstLower.startsWith("today i will") ||
    firstLower.startsWith("today i want") ||
    firstLower.startsWith("in this video") ||
    firstLower.startsWith("i will explain") ||
    firstLower.startsWith("i want to explain") ||
    firstLower.startsWith("let's talk about") ||
    firstLower.startsWith("let me explain") ||
    firstLower.startsWith("welcome back") ||
    firstLower.startsWith("hey guys");

  const {
    hasListBuildup,
    hasRankingCulmination,
  } = detectRankingStructures(lines, fullText);

  // ── Mystery clue buildup ──────────────────────────────────────────────────
  // A mystery requires a concrete abnormal event. Generic statements such as
  // "it seemed mysterious" or "nobody understood" are not evidence buildup.
  const anomaly = detectAnomalySequence(lines);
  const mysteryCluePatterns = [
    /\b(disappeared|vanished|went silent|stopped responding|stopped transmitting|ceased all communication|communication ceased|communications ceased|lost contact|contact was lost)\b/i,
    /\bstill (on|in|at|there|sitting|lying|running|open|locked)\b/i,
    /\b(remained|left behind|untouched|empty|abandoned|drifting)\b/i,
    /\b(no sign(?:s)? of|found no trace|no trace of|could not locate|couldn'?t locate)\b/i,
    /\b(searched|investigated|rescue crews?|search teams?|police entered|coast guard)\b/i,
    /\b(locked from the inside|doors? (?:were )?locked)\b/i,
    /\b(never explained|never found|no one ever found|nobody ever found|was never recovered)\b/i,
  ];
  const mysteryClueLines = lines.filter((line) =>
    mysteryCluePatterns.some((pattern) => pattern.test(line.trim()))
  );
  const hasMysteryClueBuildup =
    anomaly.has && mysteryClueLines.length >= 3;

  // ── Contradiction / reversal ──────────────────────────────────────────────
  const hasContradictionReversal =
    (lower.includes("most people think") || lower.includes("most creators think") ||
     lower.includes("everyone thinks") || lower.includes("you probably think")) &&
    (lower.includes(" but ") || lower.includes("however") || lower.includes("actually") ||
     lower.includes("the real") || lower.includes("not really") || lower.includes("it does not") ||
     lower.includes("it is not"));

  // ── Explanation chain ─────────────────────────────────────────────────────
  // Universal: premise → number/mechanism → consequence → payoff
  // Detected by: specific number/unit present AND a mechanism word AND a consequence marker
  const hasSpecificNumber = /\d[\d,]*(?:\.\d+)?/.test(lower) &&
    /\b(feet|miles|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|billion|million|thousand|degrees)\b/i.test(lower);
  const hasMechanismWord =
    lower.includes("because") || lower.includes("which means") ||
    lower.includes("that means") || lower.includes("the reason") ||
    lower.includes("so ") || lower.includes("therefore") ||
    lower.includes("as a result") || lower.includes("this means") ||
    lower.includes("that is why") || lower.includes("the result") ||
    lower.includes("the mechanism") || lower.includes("as a consequence") ||
    lower.includes("which causes") || lower.includes("which creates");
  const hasConsequenceMarker =
    lower.includes("would") || lower.includes("keeps going") ||
    lower.includes("keeps moving") || lower.includes("keeps ") ||
    lower.includes("everything") || lower.includes("scariest") ||
    lower.includes("the real") || lower.includes("it is that") ||
    lower.includes("it is not") || lower.includes("the scary part") ||
    lower.includes("the crazy part") || lower.includes("the strange part") ||
    lower.includes("but ") || lower.includes("however");
  const hasExplanationChain = hasSpecificNumber && hasMechanismWord && hasConsequenceMarker;

  // ── Consequence payoff in last 30% ────────────────────────────────────────
  // Widened to catch structural endings, not just specific phrase matches.
  const lastThirdLines = lines.slice(Math.floor(totalLines * 0.70));
  const lastThirdText = lastThirdLines.join(" ").toLowerCase();

  const hasStrongOutcome = hasStrongOutcomePayoff(lastThirdText);
  const hasConcreteMysteryPayoff =
    anomaly.has &&
    /\b(to this day|was never found|were never found|never explained|remains a mystery|no one ever found|nobody ever found|no one knows|nobody knows)\b/.test(
      lastThirdText,
    );

  // Universal consequence markers: any strong causal or consequential statement
  const hasConsequencePayoff =
    hasStrongOutcome ||
    hasConcreteMysteryPayoff ||
    hasRankingCulmination ||
    // explicit causal payoff
    /that is why|that's why|the real reason|the reason is|it turns out/.test(lastThirdText) ||
    // strong continuation / unstoppable force
    /keeps going|keeps moving|everything else keeps|keeps /.test(lastThirdText) ||
    // personal/identity/social consequence
    /says about you|what you (are|become)|how (people|everyone) (see|look)|proof that/.test(lastThirdText) ||
    // loss of control / permanence
    /you do not control|you lose control|become permanent|once it is/.test(lastThirdText) ||
    // brain/behavior consequence
    /training your brain|trains your brain|quit when|rewires/.test(lastThirdText) ||
    // reversal / twist payoff
    /it is not (just|about|the)|not just.*it is|the scary part|the crazy part/.test(lastThirdText) ||
    // status/symbol consequence
    /competing with|symbol of|proof that|what wearing/.test(lastThirdText) ||
    // irreversible historical consequence
    /never recovered|changed everything|changed history/.test(lastThirdText);

  // ── Strong payoff appearing late (placement issue) ────────────────────
  // The last line contains a structural consequence but hook was a filler intro.
  const lastLine = lines[totalLines - 1] ?? "";
  const lastLineLower = lastLine.toLowerCase();
  // Widened: any line ending with a causal/consequence structure
  const lastLineIsStructuralConsequence =
    hasStrongOutcomePayoff(lastLineLower) ||
    // consequence / behavioral outcome (universal)
    /training your (brain|mind|body)|controls (your|how)|permanent/.test(lastLineLower) ||
    /you do not control|you lose control|once it (is|becomes|goes)/.test(lastLineLower) ||
    // continuation / unstoppable force (universal — any subject)
    /keeps (going|moving|running|working|growing|building|compounding)/.test(lastLineLower) ||
    // identity / social consequence (universal)
    /says (about|something about) (you|them|us)|how (people|everyone|others) (see|look|judge)/.test(lastLineLower) ||
    /what you (are|become|represent)|proof that (you|they|it)/.test(lastLineLower) ||
    // explanation chain endings (universal — any premise/mechanism)
    /it is not (just|only|about)|the (real|actual|true) (reason|problem|issue|point)/.test(lastLineLower) ||
    /the (scary|strange|crazy|interesting|surprising|remarkable) part/.test(lastLineLower) ||
    /but (not|never|nowhere|nothing) (the|just|only|about)/.test(lastLineLower) ||
    /the whole (point|story|picture|idea)/.test(lastLineLower) ||
    // causal wrap-up (universal)
    /that is (why|what|how|when) (it|this|the|your|everything)/.test(lastLineLower) ||
    /not for the reason|not (what|how|why) (most|many|you)/.test(lastLineLower);
  // Note: hasConsequencePayoff is computed next and cannot be referenced here.
  // analyzeScript() will use lastLineIsStructuralConsequence || structures.hasConsequencePayoff
  // when it needs the combined check.

  const hasStrongPayoffLate = lastLineIsStructuralConsequence && hasFillerIntro;

  // ── Numeric premise + mechanism ───────────────────────────────────────────
  // Universal: detects any specific number with a unit paired with a mechanism word.
  // Does not reference topic-specific terms like "gravity" or "one sixth".
  const hasNumericPremise =
    hasSpecificQuantity(fullText) &&
    (lower.includes("because") || lower.includes("that means") ||
     lower.includes("which means") || lower.includes("the reason") ||
     lower.includes("mechanism") || lower.includes("as a result") ||
     lower.includes("the result") || lower.includes("not about") ||
     lower.includes("therefore") || lower.includes("this means") ||
     lower.includes("which causes") || lower.includes("which creates") ||
     /\b(came|comes|come|resulted|results?) from\b/i.test(lower) ||
     /\b(caused by|led to)\b/i.test(lower) ||
     /\b(then|after that|instead)\b.{0,120}\b(removed|replaced|changed|switched|focused|cut|reduced|added)\b/i.test(lower) ||
     /\bby (replacing|removing|adding|changing|using|switching|cutting|increasing|reducing)\b/i.test(lower));

  // ── Weak payoff ────────────────────────────────────────────────────────────
  // The last line offers no new consequence, result, or unresolved tension.
  const lastLineWordCount = lastLine.split(/\s+/).filter(Boolean).length;
  const lastLineIsGenericClose =
    /let me know|comment below|what do you think|share this|follow for more/.test(lastLineLower) ||
    /like and subscribe|stay tuned|hope this helps|that is all|that is it/.test(lastLineLower) ||
    (lastLineWordCount <= 8 && !lastLineIsStructuralConsequence && !hasMechanismWord);
  const hasWeakPayoff = lastLineIsGenericClose && !hasConsequencePayoff;

  // ── Escalation quality ─────────────────────────────────────────────────────
  let escalationQuality: ScriptStructures["escalationQuality"] = "none";
  if (hasListBuildup) escalationQuality = "list";
  else if (hasMysteryClueBuildup) escalationQuality = "mystery";
  else if (hasContradictionReversal) escalationQuality = "reversal";
  else if (hasExplanationChain) escalationQuality = "explanation";
  else if (lower.includes("but") || lower.includes("however") || lower.includes("then")) {
    escalationQuality = "flat";
  }

  const narrativeArc = detectNarrativeArc(lines);
  const persistence = detectPersistenceArc(lines);
  const capability = detectCapabilityViolation(lines);
  const progression = detectConsequenceProgression(lines);

  return {
    hasListBuildup,
    hasMysteryClueBuildup,
    hasContradictionReversal,
    hasConsequencePayoff,
    hasStrongPayoffLate,
    hasNumericPremise,
    hasFillerIntro,
    hasExplanationChain,
    hasWeakPayoff,
    hasNarrativeArc: narrativeArc.hasNarrativeArc,
    narrativeArcIsEarly: narrativeArc.arcIsEarly,
    hasPersistenceArc: persistence.has,
    hasCapabilityViolation: capability.has,
    hasAnomalySequence: anomaly.has,
    hasConsequenceProgression: progression.has,
    escalationQuality,
  };
}
