// Opening-window signal extraction used by the canonical scoring engine.
// Keep universal signal extraction and scoring orchestration outside this module.

export interface OpeningWindowSignals {
  // True if the window contains a structural reveal after a setup
  hasSetupReveal: boolean;
  // True if the window contains a concrete size/scale/measurement comparison
  hasConcreteComparison: boolean;
  // True if the window contains a causal connector leading to a consequence
  hasCausalConsequence: boolean;
  // True if window has a specific number with a unit
  hasNumericDetail: boolean;
  // True if window has a scenario opener (imagine / what if)
  hasScenarioOpener: boolean;
  // True if window scenario has any stakes / consequence / mystery
  scenarioHasStakes: boolean;
  // Structural strength 0–100 of the two-line opening
  windowStrength: number;
}

export function extractOpeningWindow(scriptLines: string[]): string {
  // Take the first 2 lines, capped at ~35 words total
  const candidates = scriptLines.slice(0, 2);
  const joined = candidates.join(" ").trim();
  const words = joined.split(/\s+/).filter(Boolean);
  return words.slice(0, 35).join(" ");
}

export function scoreOpeningWindow(openingWindow: string): OpeningWindowSignals {
  const lower = openingWindow.toLowerCase();

  // ── Concrete comparison (scale/size/distance/quantity) ──────────────────
  // Universal: any sentence that creates a visual by comparing scale.
  // Detected by structural patterns: "would disappear", "could fit",
  // "so [adj] that", "[subject] would [action]", etc.
  const hasConcreteComparison =
    /\bcould (disappear|fit|vanish|be buried|be swallowed|be hidden|be submerged)\b/i.test(openingWindow) ||
    /\bwould (disappear|fit|vanish|be hidden|still have|be buried)\b/i.test(openingWindow) ||
    /\bso (deep|tall|fast|slow|large|small|heavy|wide|far|long|short|hot|cold|dense|strong|weak)\b.{2,40}\bthat\b/i.test(openingWindow) ||
    /\b(more than|over|above|below|under|nearly|almost) (a mile|a kilometer|a foot|a meter|a year|a century|a billion|a million|a thousand)\b/i.test(openingWindow) ||
    /\b\w+ would (jump|reach|travel|move|fall|rise|grow|cover|span|stretch|sink)\b/i.test(openingWindow);

  // ── Causal consequence (something causes or reveals something else) ──────
  // Universal: "but [something unexpected]", "and it [verb consequence]"
  const hasCausalConsequence =
    /\b(but|however|yet)\b.{3,60}\b(would|could|can|will|does|is|was|disappeared|vanished|killed|destroyed|changed)\b/i.test(openingWindow) ||
    /\bif .{3,40}, (it|they|everything|the|your|that)\b/i.test(openingWindow) ||
    /\b(what happens|what would happen|the result|as a result|which means)\b/i.test(openingWindow);

  // ── Setup + reveal structure (line 1 = calm/normal, line 2 = contrast) ──
  // Universal: the window starts with an observation then contradicts it.
  const hasSetupReveal =
    (hasCausalConsequence || hasConcreteComparison) &&
    (lower.includes("but") || lower.includes("however") || lower.includes("yet") ||
     lower.includes("if ") || lower.includes("would") || lower.includes("could"));

  // ── Numeric detail ───────────────────────────────────────────────────────
  const hasNumericDetail =
    /\d/.test(openingWindow) &&
    /\b(percent|%|mile|foot|feet|meter|second|minute|hour|day|year|degree|kg|km|mph|kph|billion|million|thousand|\$)\b/i.test(lower);

  // ── Scenario opener ──────────────────────────────────────────────────────
  const hasScenarioOpener =
    /^(imagine|what if|picture this)\b/i.test(lower);

  // ── Scenario stakes: does the scenario have consequence/mystery? ─────────
  // A scenario opener alone is weak. It needs something to care about.
  const scenarioHasStakes =
    hasScenarioOpener && (
      hasCausalConsequence ||
      hasConcreteComparison ||
      hasNumericDetail ||
      // specific unresolved consequence or mystery after scenario
      /\b(terrifying|strange|impossible|wrong|wrong|dark|silent|gone|dead|broken|failed|changed|disappeared|nobody|no one|lost|destroyed)\b/i.test(lower)
    );

  // ── Window strength score ────────────────────────────────────────────────
  let windowStrength = 0;
  if (hasConcreteComparison) windowStrength += 30;
  if (hasCausalConsequence) windowStrength += 25;
  if (hasSetupReveal) windowStrength += 20;
  if (hasNumericDetail) windowStrength += 20;
  if (hasScenarioOpener && scenarioHasStakes) windowStrength += 15;
  else if (hasScenarioOpener && !scenarioHasStakes) windowStrength += 5;
  windowStrength = Math.min(windowStrength, 100);

  return {
    hasSetupReveal,
    hasConcreteComparison,
    hasCausalConsequence,
    hasNumericDetail,
    hasScenarioOpener,
    scenarioHasStakes,
    windowStrength,
  };
}
