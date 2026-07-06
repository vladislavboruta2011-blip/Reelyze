// Deterministic explanation helpers for hook rewrite suggestions.
// Keep hook rewrite generation itself in scoring-rewrite.ts.

export function getHookRewriteReason(script: string): string {
  const lines = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0]?.toLowerCase() ?? "";
  const bodyLines = lines.slice(1);
  const bodyText = bodyLines.join(" ").toLowerCase();

  // ── Detect the original hook's structural failure mode ──────────────────
  const isFillerOpener =
    firstLine.startsWith("hey guys") || firstLine.startsWith("welcome") ||
    firstLine.startsWith("in this video") || firstLine.startsWith("today i") ||
    firstLine.startsWith("i will") || firstLine.startsWith("i want to") ||
    firstLine.startsWith("let's talk") || firstLine.startsWith("so today") ||
    firstLine.startsWith("this video");

  const isBeliefReversal =
    firstLine.includes("most people think") || firstLine.includes("most creators think") ||
    firstLine.includes("everyone thinks") || firstLine.includes("you probably think");

  const isScenarioOpener =
    firstLine.startsWith("what if") || firstLine.startsWith("imagine");

  // ── Detect strongest body material (universal signal detection) ──────────
  const hasNumberAnchor = /\d[\d,]*\s*(miles|km|feet|meters|percent|%|million|billion|seconds|minutes|hours|days|years|degrees|times)/i.test(bodyText);

  const hasConsequenceAnchor =
    /that is why|that is what|keeps (going|moving|building)|says about you|proof that|become permanent|trains (your|the)|it is not (just|about)|the (scary|strange|real) (part|reason)/.test(bodyText);

  const hasVisualDetailAnchor =
    /\bstill\b|\bleft behind\b|\buntouched\b|\bno signs of\b|\bdisappeared\b|\bvanished\b|\bnobody\b|\bno one\b/.test(bodyText);

  const hasReversalAnchor =
    bodyLines.some(l => {
      const ll = l.toLowerCase();
      return (ll.includes(" not ") || ll.startsWith("not ")) &&
        (ll.includes("just") || ll.includes("about") || ll.includes("only") ||
         ll.includes("really") || ll.includes("the real") || ll.includes("reason"));
    });

  // ── Build reason based on structural failure + strongest anchor ──────────
  if (isFillerOpener) {
    if (hasNumberAnchor) {
      return "The original only announces the topic. The improved version leads with the most specific number or measurement from the script, which immediately shows viewers what the video reveals.";
    }
    if (hasConsequenceAnchor) {
      return "The original only announces the topic. The improved version leads with the strongest consequence from the script, giving viewers a reason to keep watching before they understand the setup.";
    }
    if (hasVisualDetailAnchor) {
      return "The original only announces the topic. The improved version opens with a specific physical detail from the script, pulling viewers into the scene before they have a chance to scroll.";
    }
    return "The original hook only announces the topic. The improved version leads with the most useful detail from the script so viewers have a reason to keep watching before they understand why it matters.";
  }

  if (isBeliefReversal) {
    return "It sharpens the contrast in the first line so viewers immediately sense the gap between what they assumed and what the script reveals.";
  }

  if (isScenarioOpener) {
    return "It focuses the scenario on a concrete consequence so viewers feel the stakes immediately rather than abstractly.";
  }

  if (hasNumberAnchor) {
    return "The original states the topic without using the most specific detail in the script. The improved version leads with the exact number or measurement, which makes the consequence immediate and concrete.";
  }

  if (hasConsequenceAnchor) {
    return "The original introduces the topic before the payoff. The improved version leads with the consequence, which gives viewers a clear reason to stay before they know how the script gets there.";
  }

  if (hasReversalAnchor) {
    return "The original states an assumption the script will later challenge. The improved version leads with the reversal so viewers feel the gap between assumption and truth from the first line.";
  }

  if (hasVisualDetailAnchor) {
    return "The original describes the subject at a distance. The improved version opens with a specific physical detail, making the tension concrete and immediate.";
  }

  // If the script has no concrete material at all, return a reason consistent
  // with the diagnostic hook text that createHookRewrite will have produced.
  const allBodyLines = bodyLines.join(" ");
  const hasSomeAnchor =
    /\d/.test(allBodyLines) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(allBodyLines) ||
    /\b(because|therefore|as a result|which means|led to|resulted in|caused|triggered)\b/i.test(allBodyLines.toLowerCase()) ||
    /\b(percent|%|mile|feet|meter|second|minute|hour|day|week|year|billion|million|thousand|\$)\b/i.test(allBodyLines.toLowerCase());

  if (!hasSomeAnchor) {
    return "The script is too abstract to rewrite without inventing unsupported ideas. Add one specific example, result, consequence, number, or real situation first.";
  }

  return "The original hook states the topic without creating tension. The improved version leads with the most specific detail or consequence in the script so the viewer has a reason to keep watching before they know where it ends.";
}
