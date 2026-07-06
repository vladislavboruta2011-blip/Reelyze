// Consequence/payoff rewrite strategy for deterministic hook rewrites.
// Keep hook rewrite orchestration itself in scoring-rewrite.ts.

import { capitalizeFirst } from "./scoring-rewrite-formatting";

export function createConsequenceRewrite(bodyLines: string[]): string | null {
  const totalBodyLines = bodyLines.length;
  const lastThirdStart = Math.floor(totalBodyLines * 0.6);
  const lastThirdLines = bodyLines.slice(lastThirdStart);

  const consequenceLine = lastThirdLines.find(line => {
    const ll = line.toLowerCase();
    const wc = line.split(/\s+/).length;
    return wc >= 5 && wc <= 22 && (
      // causal / outcome markers (universal)
      /that is why|that is what|the result|as a result/.test(ll) ||
      // continuation / unstoppable force (universal)
      /keeps (going|moving|running|building|compounding|growing)/.test(ll) ||
      // identity / social consequence (universal)
      /says (about|something about) (you|them|us)|how (people|everyone|others) (see|look|judge)/.test(ll) ||
      /what you (are|become|represent)|proof that (you|they|it)/.test(ll) ||
      // permanence / control (universal)
      /you do not control|become permanent|once it (is|becomes)/.test(ll) ||
      // explanation-chain ending (universal)
      /it is not (just|only|about)|the (real|actual|true) (reason|problem|issue)/.test(ll) ||
      /the (scary|strange|crazy|interesting|surprising) part/.test(ll) ||
      // behavioral / training consequence (universal)
      /trains (your|the)|training (your|the)|rewires|builds the habit/.test(ll) ||
      // comparative payoff (universal)
      /much (harder|bigger|deeper|stranger|worse|better) (to|than)/.test(ll)
    );
  });

  if (!consequenceLine) return null;

  const cleaned = consequenceLine.replace(/[.!?]+$/, "").trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= 18) return capitalizeFirst(cleaned) + ".";
  return capitalizeFirst(words.slice(0, 14).join(" ")) + ".";
}
