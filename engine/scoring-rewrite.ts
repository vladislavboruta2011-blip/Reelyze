// Pure deterministic hook rewrite helpers used by the scoring experience.

// Keep this module independent from final scoring, feedback assembly, and UI code.



import { isRewriteFillerIntro } from "./scoring-rewrite-openers";
import { createScenarioOpenerRewrite } from "./scoring-rewrite-scenario-opener";
import { createGenericGuardRewrite } from "./scoring-rewrite-generic-guard";
import { createNumberSentenceRewrite } from "./scoring-rewrite-number-sentence";
import { createConsequenceRewrite } from "./scoring-rewrite-consequence";
import { createVisualDetailRewrite } from "./scoring-rewrite-visual-detail";
import { createReversalRewrite } from "./scoring-rewrite-reversal";
import { createFillerFallbackRewrite } from "./scoring-rewrite-filler-fallback";
import { createContrastFallbackRewrite } from "./scoring-rewrite-contrast-fallback";
import { createDefaultFallbackRewrite } from "./scoring-rewrite-default-fallback";

export function createHookRewrite(script: string): string {
  const allLines = script
    .split(/[\n.!?]/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const firstLine = allLines[0] ?? "";
  const bodyLines = allLines.slice(1);
  const firstLower = firstLine.toLowerCase();

  // ── Detect filler intro ────────────────────────────────────────────────────
  const isFillerIntro = isRewriteFillerIntro(firstLower);

  // ── Generic script guard ──────────────────────────────────────────────────
  const genericGuardRewrite = createGenericGuardRewrite(allLines);
  if (genericGuardRewrite) return genericGuardRewrite;

  // ── Step 0: scenario opener + final payoff combination ───────────────────
  // For "Imagine X / What if X" scripts, the strongest hook combines the opening
  // scenario premise with the final payoff/realization line.
  // E.g. "Imagine the world went silent for one minute" + "Even silence has a sound"
  // → "What if the world went silent for one minute — and even silence has a sound?"
  const scenarioOpenerRewrite = createScenarioOpenerRewrite(
    firstLine,
    firstLower,
    bodyLines,
  );
  if (scenarioOpenerRewrite) return scenarioOpenerRewrite;

  // ── Step 1: specific number + measurement unit (universal — any niche) ────
  // Priority: any body sentence with a specific number + named unit.
  const numberSentenceRewrite = createNumberSentenceRewrite(bodyLines);
  if (numberSentenceRewrite) return numberSentenceRewrite;

  // ── Step 2: strong consequence / payoff in the last third (universal) ─────
  // Any line that states what changes, what is lost, or what the outcome is.
  const consequenceRewrite = createConsequenceRewrite(bodyLines);
  if (consequenceRewrite) return consequenceRewrite;

  // ── Step 3: concrete physical / visual detail (universal mystery/event) ───
  // Any line with a specific physical scene, object, or observable state.
  const visualDetailRewrite = createVisualDetailRewrite(bodyLines);
  if (visualDetailRewrite) return visualDetailRewrite;

  // ── Step 4: contradiction / reversal (universal) ──────────────────────────
  // Any line that reverses an assumption using "not" + a core concept.
  const reversalRewrite = createReversalRewrite(bodyLines);
  if (reversalRewrite) return reversalRewrite;

  // ── Step 5: filler intro — anchor to best body line ───────────────────────
  const fillerFallbackRewrite = createFillerFallbackRewrite(
    isFillerIntro,
    bodyLines,
  );
  if (fillerFallbackRewrite) return fillerFallbackRewrite;

  // ── Step 6: existing contrast hook — reinforce with body payoff ───────────
  const contrastFallbackRewrite = createContrastFallbackRewrite(
    firstLower,
    firstLine,
    bodyLines,
  );
  if (contrastFallbackRewrite) return contrastFallbackRewrite;

  // ── Default: contrast using first line ────────────────────────────────────
  return createDefaultFallbackRewrite(firstLine);
}

export { getHookRewriteReason } from "./scoring-rewrite-reason";
