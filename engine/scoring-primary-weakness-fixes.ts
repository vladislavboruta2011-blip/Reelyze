// Primary-weakness-specific suggested-fix builder helpers.

import type { ScriptStructures } from "./scoring-structures";

type PrimaryWeakArea =
  | "hook"
  | "short"
  | "payoff"
  | "generic"
  | "middle"
  | "none";

export function buildPrimaryWeaknessFixes({
  primaryWeak,
  hookNeedsWork,
  effectiveHookScore,
  structures,
  lines,
}: {
  primaryWeak: PrimaryWeakArea;
  hookNeedsWork: boolean;
  effectiveHookScore: number;
  structures: ScriptStructures;
  lines: readonly string[];
}): string[] {
  const fixes: string[] = [];

  if (
    primaryWeak === "hook" &&
    hookNeedsWork &&
    effectiveHookScore < 65
  ) {
    if (
      !structures.hasListBuildup &&
      (
        structures.hasStrongPayoffLate ||
        structures.hasConsequencePayoff
      )
    ) {
      fixes.push(
        "Lead with the consequence: move your strongest final line to the very beginning.",
      );
    } else if (
      structures.hasMysteryClueBuildup
    ) {
      const strongestMysteryClue =
        lines.slice(1).find((line) => {
          const lower = line.toLowerCase();
          const clueWordCount =
            line.split(/\s+/).length;

          return (
            clueWordCount >= 5 &&
            clueWordCount <= 18 &&
            (
              lower.includes("still") ||
              lower.includes("untouched") ||
              lower.includes("left behind") ||
              lower.includes("no signs") ||
              lower.includes("nothing was") ||
              lower.includes("everything was") ||
              lower.includes("appeared") ||
              lower.includes("looked like") ||
              lower.includes("seemed")
            )
          );
        });

      if (strongestMysteryClue) {
        fixes.push(
          `Open with the most specific physical detail: "${strongestMysteryClue
            .replace(/[.!?]+$/, "")
            .trim()}" creates more tension than announcing the topic.`,
        );
      } else {
        fixes.push(
          "Open with the most specific clue or physical detail from the script instead of announcing the topic.",
        );
      }
    } else {
      fixes.push(
        "Rewrite the opening line — it should lead with the strongest detail, consequence, or contrast from your script, not just announce the topic.",
      );
    }
  }

  if (primaryWeak === "generic") {
    fixes.push(
      "Replace generic advice lines with a single concrete example, number, or real consequence.",
    );
    fixes.push(
      "Cut any sentence that could apply to any video — only keep lines specific to this topic.",
    );
  }

  if (primaryWeak === "payoff") {
    fixes.push(
      "Make the final payoff more specific — state the result, consequence, or unresolved mystery clearly.",
    );
  }

  return fixes;
}
