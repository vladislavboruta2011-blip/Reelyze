import type { DimensionFinding } from "./comparison/types";

// Presentation-only, deterministic selection of which one of the four
// already-validated dimensionFindings gets the large "biggest difference"
// treatment on the Compare results page (Direction B — see
// docs/product/compare/CONSTITUTION.md's "prefer one meaningful insight
// over many shallow ones"). Never reorders or mutates the input array —
// this is a rendering decision, not a product field. Kept in its own
// pure, side-effect-free module (no JSX, no "use client") so it is
// directly unit-testable, unlike the rest of the client component it's
// used from.
const GAP_SCORE: Record<string, number> = {
  large: 3,
  meaningful: 2,
  small: 1,
};

// null (i.e. strongerSide === "similar") sorts lowest — an explicit
// difference always outranks "no real difference" as the featured pick.
function gapScore(finding: DimensionFinding): number {
  return finding.gap === null ? 0 : (GAP_SCORE[finding.gap] ?? 0);
}

export type FeaturedDimensionSelection = {
  featured: DimensionFinding;
  secondary: DimensionFinding[];
};

// Rule: largest gap wins (large > meaningful > small > similar). Ties are
// broken by the existing fixed dimension order (hook, structure, momentum,
// payoff_clarity) simply by scanning left-to-right and only replacing the
// current pick on a strictly greater score — the first-encountered
// highest score is therefore always the one already earliest in the
// array's own fixed order, with no separate tie-break step needed.
// `findings` itself is never written to; `secondary` is always a fresh
// array from .filter().
export function selectFeaturedDimension(
  findings: readonly DimensionFinding[]
): FeaturedDimensionSelection {
  let featuredIndex = 0;
  let featuredScore = gapScore(findings[0]);

  for (let index = 1; index < findings.length; index += 1) {
    const score = gapScore(findings[index]);
    if (score > featuredScore) {
      featuredIndex = index;
      featuredScore = score;
    }
  }

  return {
    featured: findings[featuredIndex],
    secondary: findings.filter((_, index) => index !== featuredIndex),
  };
}
