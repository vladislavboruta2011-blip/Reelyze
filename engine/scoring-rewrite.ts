// Pure deterministic hook rewrite helpers used by the scoring experience.

// Keep this module independent from final scoring, feedback assembly, and UI code.



export function createHookRewrite(script: string): string {
  const allLines = script
    .split(/[\n.!?]/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const firstLine = allLines[0] ?? "";
  const bodyLines = allLines.slice(1);
  const firstLower = firstLine.toLowerCase();

  // ── Detect filler intro ────────────────────────────────────────────────────
  const isFillerIntro =
    firstLower.startsWith("today i") || firstLower.startsWith("in this video") ||
    firstLower.startsWith("i will") || firstLower.startsWith("i want to") ||
    firstLower.startsWith("let's talk") || firstLower.startsWith("so today") ||
    firstLower.startsWith("hey guys") || firstLower.startsWith("welcome") ||
    firstLower.startsWith("this video");

// ── Generic script guard ──────────────────────────────────────────────────
  // If the script has no concrete material, do not invent a fake hook.
  // Return a diagnostic message instead, consistent with the API response.

  function clientLineHasHardAnchor(line: string): boolean {
    const ll = line.toLowerCase();

    // Generic-advice lines never count as hard anchors (mirrors API guard).
    const CLIENT_GENERIC_ADVICE_PATTERNS: RegExp[] = [
      /\bwork(s|ed|ing)? hard\b/i,
      /\bevery\s*day\b/i,
      /\bdaily\b/i,
      /\bnever give up\b/i,
      /\bstay focus(ed)?\b/i,
      /\bkeep going\b/i,
      /\bbelieve in yourself\b/i,
      /\bsuccess is possible\b/i,
      /\bmotivation is\b/i,
      /\bdiscipline is\b/i,
      /\bconsistency is key\b/i,
      /\bis (the )?key to\b/i,
      /\bis (very |extremely |really |truly )?important\b/i,
      /\bis possible for anyone\b/i,
      /\byou (should|must|need to|have to) (work|try|stay|keep|believe|focus|push)\b/i,
      /\bif you keep going\b/i,
      /\byou (can|will) succeed\b/i,
      /\bwants? to (stay|be|feel) (motivated|focused|disciplined|inspired)\b/i,
    ];
    const matchesAdvice = CLIENT_GENERIC_ADVICE_PATTERNS.some(p => p.test(line));
    const hasRealAnchorDespiteAdvice =
      /\d/.test(line) ||
      /[a-z,]\s+[A-Z][a-z]{2,}/.test(line) ||
      /\$\s*\d/.test(line);
    if (matchesAdvice && !hasRealAnchorDespiteAdvice) return false;

    if (/\d/.test(line)) return true;
    if (/[a-z,]\s+[A-Z][a-z]{2,}/.test(line)) return true;
    if (/\b(percent|%|mile|miles|foot|feet|meter|meters|km|second|seconds|minute|minutes|hour|hours|degree|degrees|mph|kph|billion|million|thousand|dollar|\$)\b/i.test(ll)) return true;
    if (/\d\s*(days?|weeks?|years?)\b/i.test(line)) return true;
    if (/\b(because|therefore|as a result|which means|led to|resulted in|caused|triggered|due to)\b/i.test(ll)) return true;
    const _cln = /\b(table|chair|floor|wall|door|window|room|building|school|hospital|street|road|ship|boat|car|truck|plane|phone|screen|camera|footage|image|photo|food|fire|smoke|blood|hand|face)\b/i.test(ll);
    const _natln = /\b(mountain|ocean|river|lake|forest|water|body)\b/i.test(ll);
    const _staticln = /^[a-z\s,]+ (is|are|was|were) (a |an |the |very |extremely |really |so |quite )?\w/i.test(line);
    if (_cln) return true;
    if (_natln && !_staticln) return true;
    if (/\b(found|went|came|gave|took|saw|ran|fell|grew|flew|broke|drove|woke|won|built|bought|caught|dug|drew|drank|ate|fought|heard|held|led|lit|met|paid|shook|shot|slept|spoke|stood|stole|swam|taught|threw|thought|wrote)\b/i.test(ll)) return true;
    const CLIENT_STATIVE = new Set([
      "focused","motivated","inspired","excited","tired","worried","scared",
      "bored","stressed","frustrated","confused","determined","dedicated",
      "committed","interested","pleased","surprised","shocked","amazed",
      "disappointed","satisfied","annoyed","relaxed","concerned","involved",
      "attached","related","required","needed","expected","supposed","based",
      "used","blessed","gifted","skilled","talented","valued","named","called",
      "considered","regarded","known","designed","intended","allowed",
      "believed","understood",
    ]);
    const edMatches = ll.match(/\b(\w+)ed\b/g) ?? [];
    return edMatches.some(m => !CLIENT_STATIVE.has(m) && m.replace(/ed$/, "").length >= 4);
  }
  const allConcrete = allLines.filter(line => clientLineHasHardAnchor(line));
  if (allConcrete.length === 0 && allLines.length >= 3) {
    return "This script needs one specific example, result, or consequence before the hook can feel strong.";
  }

  // ── Step 0: scenario opener + final payoff combination ───────────────────
  // For "Imagine X / What if X" scripts, the strongest hook combines the opening
  // scenario premise with the final payoff/realization line.
  // E.g. "Imagine the world went silent for one minute" + "Even silence has a sound"
  // → "What if the world went silent for one minute — and even silence has a sound?"
  const isScenarioOpener =
    /^(imagine|what if|picture this)\b/i.test(firstLower);
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

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export { getHookRewriteReason } from "./scoring-rewrite-reason";
