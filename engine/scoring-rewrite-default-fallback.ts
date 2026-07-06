// Default contrast fallback strategy for deterministic hook rewrites.
// Keep hook rewrite orchestration itself in scoring-rewrite.ts.

import { capitalizeFirst } from "./scoring-rewrite-formatting";

export function createDefaultFallbackRewrite(firstLine: string): string {
  const shortSubject = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 7).join(" ");
  return `${capitalizeFirst(shortSubject)} — but not for the reason most people think.`;
}
