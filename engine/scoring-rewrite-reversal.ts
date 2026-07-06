// Reversal rewrite strategy for deterministic hook rewrites.
// Keep hook rewrite orchestration itself in scoring-rewrite.ts.

import { capitalizeFirst } from "./scoring-rewrite-formatting";

export function createReversalRewrite(bodyLines: string[]): string | null {
  const reversalLine = bodyLines.find(line => {
    const ll = line.toLowerCase();
    const wc = line.split(/\s+/).length;
    return wc >= 5 && wc <= 22 && (
      (ll.includes(" not ") || ll.startsWith("not ")) &&
      (ll.includes("just") || ll.includes("about") || ll.includes("only") ||
       ll.includes("really") || ll.includes("the real") || ll.includes("selling") ||
       ll.includes("buying") || ll.includes("question") || ll.includes("point") ||
       ll.includes("reason") || ll.includes("idea"))
    );
  });

  if (!reversalLine) return null;

  const cleaned = reversalLine.replace(/[.!?]+$/, "").trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= 18) return capitalizeFirst(cleaned) + ".";
  return capitalizeFirst(words.slice(0, 14).join(" ")) + ".";
}
