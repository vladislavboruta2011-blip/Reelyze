// Deterministic opener detection helpers for hook rewrite suggestions.
// Keep hook rewrite generation itself in scoring-rewrite.ts.

export function isRewriteFillerIntro(firstLower: string): boolean {
  return firstLower.startsWith("today i") || firstLower.startsWith("in this video") ||
    firstLower.startsWith("i will") || firstLower.startsWith("i want to") ||
    firstLower.startsWith("let's talk") || firstLower.startsWith("so today") ||
    firstLower.startsWith("hey guys") || firstLower.startsWith("welcome") ||
    firstLower.startsWith("this video");
}

export function isRewriteScenarioOpener(firstLower: string): boolean {
  return /^(imagine|what if|picture this)\b/i.test(firstLower);
}
