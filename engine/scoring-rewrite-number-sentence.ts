// Number + measurement rewrite strategy for deterministic hook rewrites.
// Keep hook rewrite orchestration itself in scoring-rewrite.ts.

import { capitalizeFirst } from "./scoring-rewrite-formatting";

export function createNumberSentenceRewrite(bodyLines: string[]): string | null {
  const numberSentence = bodyLines.find(line => {
    return /\d[\d,]*(?:\.\d+)?/.test(line) &&
      /\b(feet|foot|miles|mile|mph|kph|km\/h|percent|%|seconds|minutes|hours|days|years|meters|kilograms|pounds|degrees|times|billion|million|thousand)\b/i.test(line);
  });
  if (!numberSentence) return null;

  const cleaned = numberSentence.replace(/[.!?]+$/, "").trim();
  const wordCount = cleaned.split(/\s+/).length;
  if (wordCount <= 20) {
    return capitalizeFirst(cleaned) + ".";
  }
  return capitalizeFirst(cleaned.split(/\s+/).slice(0, 16).join(" ")) + ".";
}
