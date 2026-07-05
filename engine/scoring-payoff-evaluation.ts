import type { UniversalSignals } from "./scoring-evaluation";
import {
  detectAnomalySequence,
  hasStrongOutcomePayoff,
} from "./scoring-structures";

// Pure payoff-strength calculation.
// Keep signal extraction, hook scoring, and retention evaluation in their own modules.

export function calculatePayoffStrength(
  lines: string[],
  signals: UniversalSignals
): number {
  let strength = 25;

  const lastThird = lines.slice(Math.floor(lines.length * 0.6)).join(" ").toLowerCase();
  const fullText = lines.join(" ").toLowerCase();
  const anomaly = detectAnomalySequence(lines);

  // Strong explicit payoff phrases in the last third
  const payoffPhrases = [
    "that's why", "the result", "changed everything", "changed history",
    "never recovered", "years later", "lost their lives",
    "ended forever", "the aftermath", "what followed",
    "that decision", "it worked", "it failed",
  ];
  const payoffHits = payoffPhrases.filter(p => lastThird.includes(p)).length;
  strength += payoffHits * 14;

  // Unresolved-mystery language is rewarding only when the script contains
  // a concrete anomaly and evidence, not merely a vague mystery claim.
  const mysteryPayoffPhrases = [
    "to this day", "still remains", "was never found", "were never found",
    "never explained", "remains a mystery", "no one ever found",
    "nobody ever found", "no one knows", "nobody knows",
  ];
  const mysteryPayoffHits = anomaly.has
    ? mysteryPayoffPhrases.filter((phrase) => lastThird.includes(phrase)).length
    : 0;
  strength += mysteryPayoffHits * 14;

  // Resolution phrases
  const resolutionPhrases = [
    "that is why", "that's why", "here's what happened", "the answer",
    "the reason", "it turned out", "turned out", "the truth was",
  ];
  const resolutionHits = resolutionPhrases.filter(p => lastThird.includes(p)).length;
  strength += resolutionHits * 10;

  // Weak payoff phrases
  const weakPayoffPhrases = [
    "entire result", "can change", "that is why one", "viewers stay longer",
    "one stronger",
  ];
  const weakPayoffHits = weakPayoffPhrases.filter(p => lastThird.includes(p)).length;
  strength += weakPayoffHits * 5;

  // ── Universal narrative / consequence / transformation endings ────────────
  // Detected via structural pattern, not topic-specific phrases.
  // Works for mystery, science, business, sports, psychology, or any niche.
  let narrativePayoffScore = 0;

  // Quantified outcomes and extreme-state transformations are resolved payoffs.
  if (hasStrongOutcomePayoff(lastThird)) narrativePayoffScore += 13;

  // Sudden reveal / transformation (universal)
  if (/suddenly (became|turned|changed|revealed|showed)/.test(lastThird)) narrativePayoffScore += 13;
  // "much [adjective] than" — any comparative escalation at end
  if (/much (harder|bigger|deeper|stranger|darker|worse|better|more) (to|than|for)/.test(lastThird)) narrativePayoffScore += 13;
  // Identity / social consequence (universal subject)
  if (/proof that (you|it|they|this)|says (about|something about) (you|them|it)/.test(lastThird)) narrativePayoffScore += 13;
  if (/how (everyone|people|others) (see|look|view|judge)/.test(lastThird)) narrativePayoffScore += 13;
  // Mystery resolution requires a concrete anomaly elsewhere in the script.
  if (
    anomaly.has &&
    /(was|were|has been|have been) never (found|solved|explained|identified|recovered)/.test(lastThird)
  ) {
    narrativePayoffScore += 13;
  }
  if (
    anomaly.has &&
    /(the case|the investigation|the inquiry) (remains|is still|has never)/.test(lastThird)
  ) {
    narrativePayoffScore += 10;
  }
  // Consequence threshold / "might be enough" (universal)
  if (/that might be enough|might be enough to|just enough to/.test(lastThird)) narrativePayoffScore += 13;
  // Competing with / surpassing a concept (universal)
  if (/competing with (a |the )?(symbol|concept|idea|status|identity|image)/.test(lastThird)) narrativePayoffScore += 13;
  // Personal version / transformation (universal)
  if (/version of (you|them|it|this)|change (how|who|what) (you|they|everyone|people)/.test(lastThird)) narrativePayoffScore += 13;
  // General transformation ending (universal)
  if (/(changes|changed) (everything|the whole|how|what|who)/.test(lastThird)) narrativePayoffScore += 10;
  // Explanation-chain conclusion (universal — any topic)
  if (/that is (why|what makes|how|the reason)/.test(lastThird) && !/that is why one/.test(lastThird)) narrativePayoffScore += 10;

  strength += Math.min(narrativePayoffScore, 26); // cap so one script can't double-dip

  // Numeric specificity in ending
  if (/\d/.test(lastThird)) strength += 8;

  // Consequence present
  if (signals.consequenceScore >= 20) strength += 10;
  else if (signals.consequenceScore >= 8) strength += 5;

  // Escalation support
  if (signals.escalationScore >= 20) strength += 6;

  // Stakes support
  if (signals.stakesScore >= 20) strength += 5;

  // Weak ending penalty
  const weakEndingPhrases = [
    "let me know", "comment below", "what do you think", "share this",
    "follow for more", "like and subscribe", "stay tuned",
  ];
  const weakEndingHits = weakEndingPhrases.filter(p => fullText.includes(p)).length;
  strength -= weakEndingHits * 8;

  // No resolution at all
  if (
    payoffHits === 0 && mysteryPayoffHits === 0 && resolutionHits === 0 &&
    weakPayoffHits === 0 && narrativePayoffScore === 0 &&
    signals.consequenceScore === 0
  ) {
    strength -= 14;
  }

if (signals.genericPenalty >= 42) strength -= 22;
  else if (signals.genericPenalty >= 28) strength -= 16;
  else if (signals.genericPenalty >= 20) strength -= 12;
  else if (signals.genericPenalty >= 10) strength -= 6;

  return Math.min(100, Math.max(0, Math.round(strength)));
}
