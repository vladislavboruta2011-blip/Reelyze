// Pure deterministic hook rewrite helpers used by the scoring experience.

// Keep this module independent from final scoring, feedback assembly, and UI code.



import { lineHasRewriteHardAnchor } from "./scoring-rewrite-anchor";
import { capitalizeFirst } from "./scoring-rewrite-formatting";
import { isRewriteFillerIntro, isRewriteScenarioOpener } from "./scoring-rewrite-openers";

export function createHookRewrite(script: string): string {
  const allLines = script
    .split(/[\n.!?]/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const firstLine = allLines[0] ?? "";
  const bodyLines = allLines.slice(1);
  const firstLower = firstLine.toLowerCase();

  // ── Detect filler intro ────────────────────────────────────────────────────
  const isFillerIntro = isRewriteFillerIntro(firstLower);

// ── Generic script guard ──────────────────────────────────────────────────
  // If the script has no concrete material, do not invent a fake hook.
  // Return a diagnostic message instead, consistent with the API response.

  const allConcrete = allLines.filter(line => lineHasRewriteHardAnchor(line));
  if (allConcrete.length === 0 && allLines.length >= 3) {
    return "This script needs one specific example, result, or consequence before the hook can feel strong.";
  }

  // ── Step 0: scenario opener + final payoff combination ───────────────────
  // For "Imagine X / What if X" scripts, the strongest hook combines the opening
  // scenario premise with the final payoff/realization line.
  // E.g. "Imagine the world went silent for one minute" + "Even silence has a sound"
  // → "What if the world went silent for one minute — and even silence has a sound?"
  const isScenarioOpener = isRewriteScenarioOpener(firstLower);
  if (isScenarioOpener && bodyLines.length >= 3) {
    const finalPayoffLine = bodyLines[bodyLines.length - 1] ?? "";
    // Pick the last line as payoff candidate — prefer it if it's a realization/paradox/twist
    const candidatePayoff = finalPayoffLine.trim();
    const candidateWc = candidatePayoff.split(/\s+/).length;
    const payoffLower = candidatePayoff.toLowerCase();
    const isStrongFinalLine =
      candidateWc >= 4 && candidateWc <= 14 &&
      !payoffLower.startsWith("but") && // avoid "But then you would notice..."
      (
        // Paradox / realization patterns
        /\b(never|always|still|even|only|just|yet)\b/i.test(candidatePayoff) ||
        // Identity / reversal
        /\b(has|have|is|are) (a|an|the)?\s*\w+/i.test(candidatePayoff) ||
        // Short punchy conclusion
        candidateWc <= 8
      );
    if (isStrongFinalLine) {
      // Extract the scenario premise from the first line (trim "Imagine" / "What if")
      const premiseCleaned = firstLine
        .replace(/^(imagine|what if|picture this)[,.]?\s*/i, "")
        .replace(/[.!?]+$/, "")
        .trim();
      const payoffCleaned = candidatePayoff.replace(/[.!?]+$/, "").trim().toLowerCase();
      const premiseWc = premiseCleaned.split(/\s+/).length;
      if (premiseWc >= 4 && premiseWc <= 14) {
        return `What if ${premiseCleaned.toLowerCase()} — and ${payoffCleaned}?`;
      }
    }
  }

  // ── Step 1: specific number + measurement unit (universal — any niche) ────
  // Priority: any body sentence with a specific number + named unit.
  const numberSentence = bodyLines.find(line => {
    return /\d[\d,]*(?:\.\d+)?/.test(line) &&
      /\b(feet|foot|miles|mile|mph|kph|km\/h|percent|%|seconds|minutes|hours|days|years|meters|kilograms|pounds|degrees|times|billion|million|thousand)\b/i.test(line);
  });
  if (numberSentence) {
    const cleaned = numberSentence.replace(/[.!?]+$/, "").trim();
    const wordCount = cleaned.split(/\s+/).length;
    if (wordCount <= 20) {
      return capitalizeFirst(cleaned) + ".";
    }
    return capitalizeFirst(cleaned.split(/\s+/).slice(0, 16).join(" ")) + ".";
  }

  // ── Step 2: strong consequence / payoff in the last third (universal) ─────
  // Any line that states what changes, what is lost, or what the outcome is.
  const totalBodyLines = bodyLines.length;
  const lastThirdStart = Math.floor(totalBodyLines * 0.6);
  const lastThirdLines = bodyLines.slice(lastThirdStart);

  const consequenceLine = lastThirdLines.find(line => {
    const ll = line.toLowerCase();
    const wc = line.split(/\s+/).length;
    return wc >= 5 && wc <= 22 && (
      // causal / outcome markers (universal)
      /that is why|that is what|the result|as a result/.test(ll) ||
      // continuation / unstoppable force (universal)
      /keeps (going|moving|running|building|compounding|growing)/.test(ll) ||
      // identity / social consequence (universal)
      /says (about|something about) (you|them|us)|how (people|everyone|others) (see|look|judge)/.test(ll) ||
      /what you (are|become|represent)|proof that (you|they|it)/.test(ll) ||
      // permanence / control (universal)
      /you do not control|become permanent|once it (is|becomes)/.test(ll) ||
      // explanation-chain ending (universal)
      /it is not (just|only|about)|the (real|actual|true) (reason|problem|issue)/.test(ll) ||
      /the (scary|strange|crazy|interesting|surprising) part/.test(ll) ||
      // behavioral / training consequence (universal)
      /trains (your|the)|training (your|the)|rewires|builds the habit/.test(ll) ||
      // comparative payoff (universal)
      /much (harder|bigger|deeper|stranger|worse|better) (to|than)/.test(ll)
    );
  });

  if (consequenceLine) {
    const cleaned = consequenceLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);
    if (words.length <= 18) return capitalizeFirst(cleaned) + ".";
    return capitalizeFirst(words.slice(0, 14).join(" ")) + ".";
  }

  // ── Step 3: concrete physical / visual detail (universal mystery/event) ───
  // Any line with a specific physical scene, object, or observable state.
  const visualDetailLine = bodyLines.find(line => {
    const ll = line.toLowerCase();
    const wc = line.split(/\s+/).length;
    return wc >= 5 && wc <= 22 && (
      // observable state (universal: any subject can be "still there")
      /\bstill\b/.test(ll) ||
      // absence / presence markers (universal)
      /\bleft behind\b|\buntouched\b|\bno signs of\b/.test(ll) ||
      // disappearance / discovery (universal)
      /\bdisappeared\b|\bvanished\b|\bfound\b|\bdiscovered\b/.test(ll) ||
      // specific named objects in context (universal — any physical object detail)
      (ll.includes("on the") && /\b(table|floor|ground|deck|shelf|wall|seat)\b/.test(ll)) ||
      // nobody / absence of people (universal)
      /\bnobody\b|\bno one\b|\bevery person\b|\beveryone (was gone|had left|disappeared)\b/.test(ll)
    );
  });

  if (visualDetailLine) {
    const cleaned = visualDetailLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);
    const hook = words.length <= 18
      ? capitalizeFirst(cleaned)
      : capitalizeFirst(words.slice(0, 14).join(" "));

    // Find a complementary second detail (any absence or contrast line)
    const secondDetail = bodyLines.find(line => {
      const ll = line.toLowerCase();
      return line !== visualDetailLine &&
        (ll.includes("but") || ll.includes("yet") || ll.includes("gone") ||
         ll.includes("missing") || ll.includes("nobody") || ll.includes("no one")) &&
        line.split(/\s+/).length >= 4 && line.split(/\s+/).length <= 14;
    });

    if (secondDetail) {
      const secondCleaned = secondDetail.replace(/[.!?]+$/, "").trim().toLowerCase();
      const secondWords = secondCleaned.split(/\s+/).slice(0, 8).join(" ");
      return `${hook} — ${secondWords}.`;
    }
    return `${hook} — and nobody knew why.`;
  }

  // ── Step 4: contradiction / reversal (universal) ──────────────────────────
  // Any line that reverses an assumption using "not" + a core concept.
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
  if (reversalLine) {
    const cleaned = reversalLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);
    if (words.length <= 18) return capitalizeFirst(cleaned) + ".";
    return capitalizeFirst(words.slice(0, 14).join(" ")) + ".";
  }

  // ── Step 5: filler intro — anchor to best body line ───────────────────────
  if (isFillerIntro && bodyLines.length >= 2) {
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

  // ── Step 6: existing contrast hook — reinforce with body payoff ───────────
  if (
    firstLower.startsWith("most people think") ||
    firstLower.startsWith("most creators think") ||
    firstLower.includes(" but ") ||
    firstLower.includes(" not ")
  ) {
    const payoffLine = bodyLines[bodyLines.length - 2] ?? bodyLines[bodyLines.length - 1] ?? "";
    const cleaned = payoffLine.replace(/[.!?]+$/, "").trim().toLowerCase();
    const words = cleaned.split(/\s+/);
    if (words.length >= 4 && words.length <= 15) {
      return `${capitalizeFirst(firstLine.replace(/[.!?]+$/, ""))} — ${cleaned}.`;
    }
    const shortFirst = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 8).join(" ");
    return `${capitalizeFirst(shortFirst)} — but that is not what the script reveals.`;
  }

  // ── Default: contrast using first line ────────────────────────────────────
  const shortSubject = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 7).join(" ");
  return `${capitalizeFirst(shortSubject)} — but not for the reason most people think.`;
}

export { getHookRewriteReason } from "./scoring-rewrite-reason";
