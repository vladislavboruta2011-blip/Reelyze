// Filler intro fallback rewrite strategy for deterministic hook rewrites.
// Keep hook rewrite orchestration itself in scoring-rewrite.ts.

import { capitalizeFirst } from "./scoring-rewrite-formatting";

export function createFillerFallbackRewrite(
  isFillerIntro: boolean,
  bodyLines: string[],
): string | null {
  if (!isFillerIntro || bodyLines.length < 2) return null;

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
