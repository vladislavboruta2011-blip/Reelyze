// Existing contrast hook fallback strategy for deterministic hook rewrites.
// Keep hook rewrite orchestration itself in scoring-rewrite.ts.

import { capitalizeFirst } from "./scoring-rewrite-formatting";

export function createContrastFallbackRewrite(
  firstLower: string,
  firstLine: string,
  bodyLines: string[],
): string | null {
  if (
    !firstLower.startsWith("most people think") &&
    !firstLower.startsWith("most creators think") &&
    !firstLower.includes(" but ") &&
    !firstLower.includes(" not ")
  ) {
    return null;
  }

  const payoffLine = bodyLines[bodyLines.length - 2] ?? bodyLines[bodyLines.length - 1] ?? "";
  const cleaned = payoffLine.replace(/[.!?]+$/, "").trim().toLowerCase();
  const words = cleaned.split(/\s+/);
  if (words.length >= 4 && words.length <= 15) {
    return `${capitalizeFirst(firstLine.replace(/[.!?]+$/, ""))} — ${cleaned}.`;
  }
  const shortFirst = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 8).join(" ");
  return `${capitalizeFirst(shortFirst)} — but that is not what the script reveals.`;
}
