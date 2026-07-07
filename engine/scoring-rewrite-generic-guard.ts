// Generic script guard for deterministic hook rewrites.
// Keep hook rewrite orchestration itself in scoring-rewrite.ts.

import { lineHasRewriteHardAnchor } from "./scoring-rewrite-anchor";

export function createGenericGuardRewrite(allLines: string[]): string | null {
  const allConcrete = allLines.filter(line => lineHasRewriteHardAnchor(line));
  if (allConcrete.length === 0 && allLines.length >= 3) {
    return "This script needs one specific example, result, or consequence before the hook can feel strong.";
  }

  return null;
}
