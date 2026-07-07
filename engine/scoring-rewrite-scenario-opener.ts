import { isRewriteScenarioOpener } from "./scoring-rewrite-openers";

export function createScenarioOpenerRewrite(
  firstLine: string,
  firstLower: string,
  bodyLines: string[],
): string | null {
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

  return null;
}
