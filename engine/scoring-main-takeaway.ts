import type { UniversalSignals } from "./scoring-evaluation";
import type { ScriptStructures } from "./scoring-structures";

// Deterministic headline selection for the overall scoring summary.
// Keep detailed risky-part generation outside this module.

type Weakness =
  | "weak-hook" | "weak-payoff" | "weak-middle" | "weak-stakes"
  | "weak-specificity" | "weak-mystery" | "weak-consequence"
  | "repetitive" | "excellent-hook" | "excellent-payoff" | "balanced-strong" | "balanced-weak";

function hashPick<T>(seed: string, options: T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return options[h % options.length];
}

const TAKEAWAY_TEMPLATES: Record<Weakness, string[]> = {
  "weak-hook": [
    "The opening is the bottleneck here — everything after it is wasted if viewers swipe in the first two seconds.",
    "This script's biggest leak is at the very top. Fix the first line and the rest of the structure holds up.",
    "Strong material is buried behind a slow opening. Lead with it instead of working up to it.",
  ],
  "weak-payoff": [
    "The setup earns attention, but the ending doesn't cash it in. Viewers reach the end with no clear reward.",
    "This script builds tension well but resolves it too vaguely — the payoff needs a concrete result.",
    "Everything before the ending works. The last line is where retention quietly leaks out.",
  ],
  "weak-middle": [
    "The hook and ending both work — it's the middle that goes flat and risks losing viewers mid-watch.",
    "Strong bookends, soft middle. Add one more turn or contrast halfway through to hold attention.",
  ],
  "weak-stakes": [
    "Nothing in this script is clearly at risk. Add a consequence — what's lost, threatened, or on the line.",
  ],
  "weak-specificity": [
    "This script stays general throughout. A number, name, date, or measurable detail would ground it.",
  ],
  "weak-mystery": [
    "There's no unanswered question pulling viewers forward — consider an unresolved detail early on.",
  ],
  "weak-consequence": [
    "The script states what happened but not what it changed. Add a clear consequence to the outcome.",
  ],
  "repetitive": [
    "Several lines restate the same idea without adding new information — tighten for pace.",
  ],
  "excellent-hook": [
    "The opening does real work here — it creates a gap viewers want closed before they swipe away.",
  ],
  "excellent-payoff": [
    "The ending lands a real consequence, which is what makes this feel worth the watch time.",
  ],
  "balanced-strong": [
    "The script has a clear opening, progression, and payoff. No major structural issue stands out.",
  ],
  "balanced-weak": [
    "No single part is broken, but nothing is strong enough yet either — sharpen the hook, stakes, or payoff.",
  ],
};

function classifyPrimaryWeakness(
  hookScore: number, payoffStrength: number, retentionRisk: number,
  signals: UniversalSignals, structures: ScriptStructures
): Weakness {
  if (hookScore >= 85) return "excellent-hook";
  if (payoffStrength >= 80) return "excellent-payoff";
  if (signals.genericPenalty >= 25) return "repetitive";
  if (hookScore < 50) return "weak-hook";
  if (payoffStrength < 35 && !structures.hasConsequencePayoff) return "weak-payoff";
  if (retentionRisk >= 60 && hookScore >= 65) return "weak-middle";
  if (signals.stakesScore < 12) return "weak-stakes";
  if (signals.specificityScore < 12) return "weak-specificity";
  if (signals.curiosityScore < 12) return "weak-mystery";
  if (signals.consequenceScore < 12) return "weak-consequence";
  return "balanced-weak";
}

export function buildMainTakeaway(
  script: string, hookScore: number, payoffStrength: number, retentionRisk: number,
  signals: UniversalSignals, structures: ScriptStructures, issueTitles: string[] = []
): string {
  const issueText = issueTitles.join(" ").toLowerCase();

  if (issueTitles.length === 0) {
    const strength: Weakness =
      structures.hasConsequencePayoff && payoffStrength >= 60
        ? "excellent-payoff"
        : hookScore >= 75
          ? "excellent-hook"
          : "balanced-strong";

    return hashPick(script + strength, TAKEAWAY_TEMPLATES[strength]);
  }

  // Keep the headline aligned with the concrete feedback shown below it.
  // A detected genericness issue takes priority over a secondary weak hook.
  const weakness: Weakness =
    /script feels too generic|repetitive|generic script/.test(issueText)
      ? "repetitive"
      : /strong payoff appears too late|weak opening|hook needs|curiosity gap/.test(issueText)
        ? "weak-hook"
        : /weak or generic payoff|payoff could be stronger|weak payoff/.test(issueText)
          ? "weak-payoff"
          : /middle|momentum/.test(issueText)
            ? "weak-middle"
            : classifyPrimaryWeakness(
                hookScore,
                payoffStrength,
                retentionRisk,
                signals,
                structures,
              );

  return hashPick(script + weakness, TAKEAWAY_TEMPLATES[weakness]);
}
