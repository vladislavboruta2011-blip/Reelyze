import {
  buildBodyAndLengthFixes,
  buildMediumScoreFixes,
  buildOptionalImprovementFixes,
  buildPayoffFixes,
  buildPrimaryWeaknessFixes,
  buildScriptTypeFixes,
  buildStrongEndingOpeningFixes,
  buildSupportingSignalFixes,
} from "./scoring-fix-builders";

export {
  buildBodyAndLengthFixes,
  buildMediumScoreFixes,
  buildOptionalImprovementFixes,
  buildPayoffFixes,
  buildPrimaryWeaknessFixes,
  buildScriptTypeFixes,
  buildStrongEndingOpeningFixes,
  buildSupportingSignalFixes,
};

// Suggested-fix semantic grouping and deduplication.
// Keep scoring orchestration and mutable fix collection outside this module.

export function getFixSemanticKey(value: string): string {
  const lower = value.toLowerCase();

  if (/opening|first line|open with|rewrite the opening|lead with|sharpen the first/.test(lower)) {
    return "opening";
  }
  if (/payoff|final line|end with|outcome clearer|challenge outcome|viewer feels rewarded|viewer feels clearly rewarded/.test(lower)) {
    return "payoff";
  }
  if (/include a number|specific detail|named reference|real-world example|make the script feel grounded|make it feel grounded/.test(lower)) {
    return "specificity";
  }
  if (/raise the stakes|what is at risk|what was lost/.test(lower)) {
    return "stakes";
  }
  if (/middle section|pattern interrupt|unexpected turn|add a contrast|contrast line/.test(lower)) {
    return "middle";
  }
  if (/cut repeated|make each line earn|tighten any line|cut any sentence/.test(lower)) {
    return "tighten";
  }

  return lower
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

export function dedupeFixes(values: string[]): string[] {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = getFixSemanticKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
