// Reusable structural detectors used by the canonical scoring engine.

// Keep these helpers independent from aggregate structure orchestration and scoring.

export function detectPersistenceArc(lines: string[]): { has: boolean; strong: boolean } {
  const text = lines.join(" ");
  const lower = text.toLowerCase();

  const hasDurationOrRepetition =
    /\d+\s*(years?|months?|weeks?|days?|hours?)\b/i.test(text) ||
    new RegExp(`\\b${SPELLED_OUT_NUMBERS}\\b\\s+(years?|months?|weeks?|days?|hours?)\\b`, "i").test(text) ||
    /\b(every day|each day|every morning|every night|every year|day after day|night after night|week after week|month after month|year after year|time after time|again and again|over and over)\b/i.test(lower);

  const hasResistance =
    /\b(tried to (stop|move|remove|change|take|force)|attempted to (stop|move|remove)|forced (it|him|her|them) (away|out|to leave)|kept (trying to|attempting to))\b/i.test(lower);

  const hasContinuation =
    /\b(kept (coming|returning|going|waiting|sitting|showing up)|continued to|never stopped|would not leave|refused to (leave|move|go)|never left|always (came|returned)( back)?|came back|returned again|went back|showed up again|remained there|stayed there|still (came|returned|waited|sat|stood|remained|stayed|showed up))\b/i.test(lower);

  const has = hasDurationOrRepetition && hasContinuation;
  const strong = has && hasResistance;
  return { has, strong };
}

export function detectCapabilityViolation(lines: string[]): { has: boolean; strong: boolean } {
  const text = lines.join(" ");
  const lower = text.toLowerCase();

  const inabilityPattern =
    /\b(had never|has never|never (learned|trained|studied|practiced|spoken|performed|could|been able)|could not|couldn'?t|should not be able|wasn'?t supposed to|was not supposed to|was unable to|had no way to|did not know how to|didn'?t know how to|only (spoke|knew|used|could))\b/i;

  const abilityPattern =
    /\b(speaking|speak|spoke|answered|reading|read|writing|write|wrote|playing|play|played|performing|perform|performed|walking|walk|walked|running|run|ran|moving|move|moved|using|use|used|understanding|understand|understood|recognizing|recognize|recognized|solving|solve|solved|remembering|remember|remembered|managed to|was able to)\b/i;

  const hasInability = inabilityPattern.test(lower);
  const hasAbilityEvent = abilityPattern.test(lower);

  // Direct contradiction inside one sentence:
  // "speaking a language he had never learned"
  const hasDirectViolation = lines.some((line) => {
    const lineLower = line.toLowerCase();

    return (
      inabilityPattern.test(lineLower) &&
      abilityPattern.test(lineLower)
    );
  });

  // Contradiction spread across separate lines:
  // inability/setup first, unexpected ability later
  const hasContrastAbility = lines.some((line, index) => {
    if (index === 0) return false;

    const lineLower = line.toLowerCase();

    const hasContrastLead =
      /^(but|yet|however|even so|still|instead)\b/i.test(lineLower) ||
      /\b(and yet|but when|even though|despite that)\b/i.test(lineLower);

    return hasContrastLead && abilityPattern.test(lineLower);
  });

  const hasDoesItAnyway =
    /\b(but then|and yet|somehow|until one day|suddenly|minutes? later|moments? later|seconds? later|hours? later|shortly after|soon after|then,?\s+(he|she|it|they)|managed to|was able to)\b/i.test(lower) ||
    hasDirectViolation ||
    hasContrastAbility;

  // Ignore hypothetical comparisons such as
  // "moved like he had practiced for years". They describe how the
  // performance looked, not a real period of training.
  const acquisitionText = lower.replace(
    /\b(?:like|as if|as though)\s+(?:he|she|they|it|someone)\s+had\s+(?:trained|practiced|studied|learned)\b.{0,40}\b(?:for|over|during)\s+(?:several\s+|a few\s+|\d+\s+)?(?:hours?|days?|weeks?|months?|years?)\b/gi,
    "",
  );

  const hasExplainedAcquisition =
    /\b(trained|practiced|studied|took lessons|received training|enrolled in (classes|lessons)|learned)\b.{0,40}\b(for|over|during)\s+(several\s+|a few\s+|\d+\s+)?(hours?|days?|weeks?|months?|years?)\b/i.test(acquisitionText) ||
    /\bafter\s+(several\s+|a few\s+|\d+\s+)?(hours?|days?|weeks?|months?|years?)\s+of\s+(training|practice|lessons|study)\b/i.test(acquisitionText);

  const hasReversal =
    /\b(never did it again|lost the ability|could not do it again|just as suddenly|stopped working|never happened again|returned to normal|went back to normal|came back like nothing happened)\b/i.test(lower) ||
    /\b(ability|skill|language|voice|effect|symptom|power|memory|speech|spanish)\s+(slowly\s+|suddenly\s+)?(disappeared|faded|vanished|went away)\b/i.test(lower) ||
    /\bnormal (voice|speech|movement|ability)\s+came back\b/i.test(lower);

  const has =
    !hasExplainedAcquisition &&
    (
      hasDirectViolation ||
      (hasInability && hasAbilityEvent && hasDoesItAnyway)
    );

  const strong = has && hasReversal;

  return { has, strong };
}

export function detectAnomalySequence(lines: string[]): { has: boolean; strong: boolean } {
  const text = lines.join(" ");
  const lower = text.toLowerCase();

  const hasAbnormalEvent =
    /\b(disappeared|vanished|went silent|stopped responding|stopped transmitting|ceased all communication|communication ceased|communications ceased|lost contact|contact was lost|found (empty|abandoned|drifting|deserted)|gone without (a trace|warning))\b/i.test(lower);

  const hasPhysicalClue =
    /\bstill (on|in|at|sitting|lying|running)\b|\buntouched\b|\bno signs of\b|\bleft behind\b|\bremained exactly where\b|\bwere exactly where\b/i.test(lower);

  const hasInvestigationOrNoResolution =
    /\b(searched|investigated|looked for|found no trace|no trace of|could not locate|couldn'?t locate|no one (knows|ever found|explained)|never (explained|found|solved|recovered)|remains a mystery|to this day)\b/i.test(lower);

  const hasOrdinaryResolution =
    /\b(was|were) (caused|explained) by\b/i.test(lower) ||
    /\b(because of|due to|after) (a |the )?(power cut|power outage|outage|maintenance|technical issue|equipment failure)\b/i.test(lower) ||
    /\b(restored|fixed|repaired|resolved) (the )?(power|electricity|connection|signal|system|problem)\b/i.test(lower);

  const has =
    hasAbnormalEvent &&
    !hasOrdinaryResolution &&
    (hasPhysicalClue || hasInvestigationOrNoResolution);
  const strong = hasAbnormalEvent && hasPhysicalClue && hasInvestigationOrNoResolution;
  return { has, strong };
}

export function detectConsequenceProgression(lines: string[]): { has: boolean; strong: boolean } {
  const text = lines.join(" ");
  const lower = text.toLowerCase();

  const hasBadState =
    /\b(losing money|losing \$[\d,]+|losing thousands|losing millions|monthly losses?|running out of|could not pay|couldn'?t pay|in debt|shutting down|about to (close|fail|collapse)|failing|on the verge of|expenses exceeded revenue|costs exceeded revenue|costs? (were )?(higher|greater) than (sales|revenue|income)|spending (was )?(higher|greater) than (sales|revenue|income)|(sales|revenue|income) (was|were) (below|lower than) (costs?|expenses|spending))\b/i.test(lower);

  const hasAttemptedFix =
    /\b(tried to|attempted to|cut costs|changed (the|their)|switched to|decided to try|added (another|more|one more)|built (another|more|one more)|launched (another|more|one more)|thought .{0,50} would (save|fix|solve|help|work))\b/i.test(lower);

  const hasWorseResult =
    /\b(but it got worse|still wasn'?t enough|continued to (lose|fail|struggle)|even worse|nothing changed|failed to help|did not help|didn'?t help|kept losing|made (the )?losses worse|losses (grew|increased|worsened)|every launch made .{0,30} worse|each launch made .{0,30} worse)\b/i.test(lower);

  const hasDecisiveChange =
    /\b(finally|instead|decided to|pivoted|focused on|cut|dropped|removed|stopped|narrowed|simplified|reduced|limited)\b/i.test(lower) &&
    /\b(then|finally|instead|after that|so they|focused on|pivoted|removed|dropped|stopped|narrowed|simplified|reduced|limited)\b/i.test(lower);

  const hasMeasurableImprovement =
    /\b(grew|increased|recovered|turned around|doubled|tripled|saved the|became profitable|reached profitability|made a profit|broke even|revenue (grew|increased|doubled|passed|exceeded|overtook)|revenue finally (passed|exceeded|overtook)|profit finally|expenses fell below revenue|(income|sales|revenue) (was|were) (greater|higher) than (spending|costs?|expenses)|(income|sales|revenue) exceeded (spending|costs?|expenses))\b/i.test(lower);

  const hasExternalOutcomeShift =
    /\b(competitor|rival|another company|another business|other company|other business)\b.{0,60}\b(revenue|profit|sales|income)\s+(grew|increased|rose|improved|doubled|tripled|exceeded)\b/i.test(lower);

  const has =
    !hasExternalOutcomeShift &&
    hasBadState &&
    (hasAttemptedFix || hasWorseResult) &&
    hasDecisiveChange &&
    hasMeasurableImprovement;

  const strong =
    has &&
    hasWorseResult &&
    hasMeasurableImprovement;

  return { has, strong };
}

export function detectNarrativeArc(lines: string[]): {
  hasNarrativeArc: boolean;
  turnIndex: number;
  arcIsEarly: boolean;
} {
  const TURN_MARKERS =
    /\b(but then|until one day|until|then one day|years later|months later|weeks later|days later|after that|suddenly|that was when|that is when|everything changed|things changed|from that (day|moment)|it wasn'?t until|never (again|the same)|kept (coming|going|waiting|returning))\b/i;

  let turnIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (TURN_MARKERS.test(lines[i])) {
      turnIndex = i;
      break;
    }
  }
  if (turnIndex < 0) return { hasNarrativeArc: false, turnIndex: -1, arcIsEarly: false };

  const setupText = lines.slice(0, Math.max(turnIndex, 1)).join(" ");
  const afterText = lines.slice(turnIndex + 1).join(" ");

  const setupIsConcrete =
    /\d/.test(setupText) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(setupText) ||
    /\b\w+ed\b/i.test(setupText) ||
    /\b(found|went|came|gave|took|saw|ran|fell|grew|broke|drove|woke|won|built|caught|heard|held|left|met|stood|wrote)\b/i.test(setupText);

  const hasResolution =
    afterText.trim().split(/\s+/).filter(Boolean).length >= 4;

  const hasNarrativeArc = setupIsConcrete && hasResolution;
  const arcIsEarly = turnIndex >= 1 && turnIndex <= Math.ceil(lines.length * 0.65);

  return { hasNarrativeArc, turnIndex, arcIsEarly };
}

export function hasStrongOutcomePayoff(text: string): boolean {
  const lower = text.toLowerCase();

  // A measurable result can be expressed as a multiplier without repeating
  // the original number: retention doubled, costs halved, revenue tripled.
  const hasMultiplicativeOutcome =
    /\b(?:doubled|tripled|quadrupled|halved)\b/.test(lower);

  // A measured change must connect an outcome verb to a concrete result.
  const hasMeasuredChange =
    /\b(?:increased|decreased|grew|rose|fell|dropped|improved|declined|cut|reduced)\b[^.!?]{0,80}\b(?:by|to|from)\s+(?:\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)\b/.test(
      lower,
    );

  // Reaching or crossing a concrete threshold is also a resolved outcome.
  // The measured margin may follow the compared object:
  // "revenue passed expenses by $40,000".
  const hasThresholdOutcome =
    /\b(?:reached|hit|passed|exceeded)\s+(?:[$€£]\s*)?(?:\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)\b/.test(
      lower,
    ) ||
    /\b(?:passed|exceeded|surpassed|overtook)\b[^.!?]{1,60}\bby\s+(?:[$€£]\s*)?(?:\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)\b/.test(
      lower,
    );

  // A resolved threshold may compare two concrete values without repeating
  // either number in the final line: "revenue finally passed expenses".
  const hasRelationalThresholdOutcome =
    /\b(?:finally|eventually|ultimately)\s+(?:passed|exceeded|surpassed|overtook)\s+(?!away\b|through\b|by\b)(?:the\s+|its\s+|their\s+|his\s+|her\s+)?[a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3}(?=[.!?,;]|$)/.test(
      lower,
    ) ||
    /\b(?:exceeded|surpassed|overtook)\s+(?!away\b|through\b|by\b)(?:the\s+|its\s+|their\s+|his\s+|her\s+)?[a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3}(?=[.!?,;]|$)/.test(
      lower,
    );

  // A direct comparative result resolves which option wins even when the
  // final line does not repeat the earlier measurements.
  const hasExplicitRelativeOutcome =
    /\b(?:reaches?|ranks?|scores?|finishes?|stands?|comes?|ends?|places?)\s+(?:still\s+)?(?:slightly\s+|much\s+|far\s+|clearly\s+|considerably\s+|noticeably\s+)?(?:higher|lower|faster|slower|farther|further|ahead|behind|first|last)\b/.test(
      lower,
    ) ||
    /\bstill\s+(?:reaches?|ranks?|scores?|finishes?|stands?|comes?|ends?|places?)\s+(?:slightly\s+|much\s+|far\s+|clearly\s+|considerably\s+|noticeably\s+)?(?:higher|lower|faster|slower|farther|further|ahead|behind|first|last)\b/.test(
      lower,
    );

  // A concrete directional state change is a resolved physical consequence,
  // unlike a vague ending such as "things began changing".
  const hasDirectionalStateChange =
    /\b(?:(?:would|could|will|may|might)\s+)?(?:begin|begins|began|start|starts|started)\s+[a-z]+ing\s+(?:away|apart|out|off|toward|towards|into|from)\b/.test(
      lower,
    );

  // A final transformation into an extreme state forms a strong reversal:
  // something silent becomes one of the loudest things, for example.
  const hasSuperlativeTransformation =
    /\b(?:(?:would|could|can|will|may|might)\s+)?(?:actually\s+)?(?:become|became|becomes|turn|turns|turned)\s+(?:into\s+)?(?:one of the|the)\s+(?:most|least|[a-z]+est)\b/.test(
      lower,
    );

  return (
    hasMultiplicativeOutcome ||
    hasMeasuredChange ||
    hasThresholdOutcome ||
    hasRelationalThresholdOutcome ||
    hasExplicitRelativeOutcome ||
    hasDirectionalStateChange ||
    hasSuperlativeTransformation
  );
}

const SPELLED_OUT_NUMBERS =
  "(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|" +
  "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|" +
  "thousand|million|billion|dozen)";

export function hasSpecificQuantity(sentence: string): boolean {
  // Numeral + unit (covers existing digit-based cases plus dollar amounts)
  if (/\$[\d,]+/.test(sentence)) return true;
  if (
    /\d[\d,]*(?:\.\d+)?\s*(percent|%|inch(?:es)?|miles?|mph|kph|km|feet|foot|meters?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|degrees?|times|billion|million|thousand|dollars?)/i.test(
      sentence
    )
  ) {
    return true;
  }
  // Spelled-out number + unit: "six years", "ten seconds", "a dozen times"
  const wordUnitPattern = new RegExp(
    `\\b${SPELLED_OUT_NUMBERS}\\b\\s+(percent|inch(?:es)?|miles?|feet|foot|meters?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|degrees?|times)\\b`,
    "i"
  );
  return wordUnitPattern.test(sentence);
}
