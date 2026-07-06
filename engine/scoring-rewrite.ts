// Pure deterministic hook rewrite helpers used by the scoring experience.

// Keep this module independent from final scoring, feedback assembly, and UI code.



import { lineHasRewriteHardAnchor } from "./scoring-rewrite-anchor";
import { capitalizeFirst } from "./scoring-rewrite-formatting";
import { isRewriteFillerIntro, isRewriteScenarioOpener } from "./scoring-rewrite-openers";
import { createNumberSentenceRewrite } from "./scoring-rewrite-number-sentence";
import { createConsequenceRewrite } from "./scoring-rewrite-consequence";
import { createVisualDetailRewrite } from "./scoring-rewrite-visual-detail";
import { createReversalRewrite } from "./scoring-rewrite-reversal";

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
  // If the script has no concrete material, do not invent a fake hook.
  // Return a diagnostic message instead, consistent with the API response.

  const allConcrete = allLines.filter(line => lineHasRewriteHardAnchor(line));
  if (allConcrete.length === 0 && allLines.length >= 3) {
    return "This script needs one specific example, result, or consequence before the hook can feel strong.";
  }

  // ── Step 0: scenario opener + final payoff combination ───────────────────
  // For "Imagine X / What if X" scripts, the strongest hook combines the opening
  // scenario premise with the final payoff/realization line.
  // E.g. "Imagine the world went silent for one minute" + "Even silence has a sound"
  // → "What if the world went silent for one minute — and even silence has a sound?"
  const isScenarioOpener = isRewriteScenarioOpener(firstLower);
  if (isScenarioOpener && bodyLines.length >= 3) {
    const finalPayoffLine = bodyLines[bodyLines.length - 1] ?? "";
    // Pick the last line as payoff candidate — prefer it if it's a realization/paradox/twist
    const candidatePayoff = finalPayoffLine.trim();
    const candidateWc = candidatePayoff.split(/\s+/).length;
    const payoffLower = candidatePayoff.toLowerCase();
    const isStrongFinalLine =
      candidateWc >= 4 && candidateWc <= 14 &&
      !payoffLower.startsWith("but") && // avoid "But then you would notice..."
      (
        // Paradox / realization patterns
        /\b(never|always|still|even|only|just|yet)\b/i.test(candidatePayoff) ||
        // Identity / reversal
        /\b(has|have|is|are) (a|an|the)?\s*\w+/i.test(candidatePayoff) ||
        // Short punchy conclusion
        candidateWc <= 8
      );
    if (isStrongFinalLine) {
      // Extract the scenario premise from the first line (trim "Imagine" / "What if")
      const premiseCleaned = firstLine
        .replace(/^(imagine|what if|picture this)[,.]?\s*/i, "")
        .replace(/[.!?]+$/, "")
        .trim();
      const payoffCleaned = candidatePayoff.replace(/[.!?]+$/, "").trim().toLowerCase();
      const premiseWc = premiseCleaned.split(/\s+/).length;
      if (premiseWc >= 4 && premiseWc <= 14) {
        return `What if ${premiseCleaned.toLowerCase()} — and ${payoffCleaned}?`;
      }
    }
  }

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
  if (isFillerIntro && bodyLines.length >= 2) {
    const bodyAnchor = bodyLines.find(l => {
      const wc = l.split(/\s+/).length;
      return wc >= 6 && wc <= 20;
    });
    if (bodyAnchor) {
      const cleaned = bodyAnchor.replace(/[.!?]+$/, "").trim();
      return `${capitalizeFirst(cleaned)} — and most people never realise it.`;
    }
    const firstBody = bodyLines[0]?.replace(/[.!?]+$/, "").trim() ?? "";
    return `${capitalizeFirst(firstBody)} — and that is what makes it interesting.`;
  }

  // ── Step 6: existing contrast hook — reinforce with body payoff ───────────
  if (
    firstLower.startsWith("most people think") ||
    firstLower.startsWith("most creators think") ||
    firstLower.includes(" but ") ||
    firstLower.includes(" not ")
  ) {
    const payoffLine = bodyLines[bodyLines.length - 2] ?? bodyLines[bodyLines.length - 1] ?? "";
    const cleaned = payoffLine.replace(/[.!?]+$/, "").trim().toLowerCase();
    const words = cleaned.split(/\s+/);
    if (words.length >= 4 && words.length <= 15) {
      return `${capitalizeFirst(firstLine.replace(/[.!?]+$/, ""))} — ${cleaned}.`;
    }
    const shortFirst = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 8).join(" ");
    return `${capitalizeFirst(shortFirst)} — but that is not what the script reveals.`;
  }

  // ── Default: contrast using first line ────────────────────────────────────
  const shortSubject = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 7).join(" ");
  return `${capitalizeFirst(shortSubject)} — but not for the reason most people think.`;
}

export { getHookRewriteReason } from "./scoring-rewrite-reason";
