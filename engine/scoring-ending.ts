// Classification of the final script line.
// Keep score calculation and feedback mutation outside this module.

export type ScoringEndingAnalysis = {
  isGenericMotivationalEnding: boolean;
  lastLineIsStrong: boolean;
};

export function analyzeScoringEnding({
  lastLine,
  hasConsequencePayoff,
}: {
  lastLine: string;
  hasConsequencePayoff: boolean;
}): ScoringEndingAnalysis {
  const lastLineLower = lastLine.toLowerCase();

  const lastLineWordCount = lastLine
    .split(/\s+/)
    .filter(Boolean)
    .length;

  const lastLineHasConcrete =
    /\d/.test(lastLine) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(lastLine) ||
    /\b\w+ed\b/i.test(lastLineLower) ||
    /\b(found|lost|went|came|got|gave|took|made|saw|ran|fell|grew|flew|broke|drove|woke|won|built|caught|said|sent|spoke|stood|wrote|heard|kept|knew|left|told|threw|thought)\b/i.test(
      lastLineLower,
    );

  const lastLineIsStructurallyGeneric =
    !lastLineHasConcrete &&
    lastLineWordCount <= 12 &&
    /\b(is|are|will be|can be|was|were)\b/i.test(
      lastLineLower,
    ) &&
    /\b(possible|important|key|essential|necessary|real|true|good|great|better|best|amazing|powerful|possible|valuable|needed)\b/i.test(
      lastLineLower,
    );

  const isGenericMotivationalEnding =
    /\b(possible for anyone|reach your goals|never give up|stay focused|hard work pays|believe in yourself|you can do it|keep working|keep going|just believe|work (hard|smart)|success takes|success is possible|everyone can|anyone can)\b/i.test(
      lastLineLower,
    ) ||
    (
      /\b(success|failure|life|time|things|people)\b/i.test(
        lastLineLower,
      ) &&
      /\b(is|are|will be|can be)\b/i.test(
        lastLineLower,
      ) &&
      !/\d/.test(lastLine) &&
      lastLine.split(/\s+/).length <= 10
    ) ||
    lastLineIsStructurallyGeneric;

  const lastLineIsStrong =
    !isGenericMotivationalEnding &&
    (
      /training your (brain|mind|body)|controls (your|how)|permanent/.test(
        lastLineLower,
      ) ||
      /you do not control|you lose control|once it (is|becomes|goes)/.test(
        lastLineLower,
      ) ||
      /keeps (going|moving|running|working|growing|building|compounding)/.test(
        lastLineLower,
      ) ||
      /says (about|something about) (you|them|us)|how (people|everyone|others) (see|look|judge)/.test(
        lastLineLower,
      ) ||
      /what you (are|become|represent)|proof that (you|they|it)/.test(
        lastLineLower,
      ) ||
      /it is not (just|only|about)|the (real|actual|true) (reason|problem|issue|point)/.test(
        lastLineLower,
      ) ||
      /the (scary|strange|crazy|interesting|surprising|remarkable) part/.test(
        lastLineLower,
      ) ||
      /the whole (point|story|picture|idea)/.test(
        lastLineLower,
      ) ||
      /that is (why|what|how|when) (it|this|the|your|everything)/.test(
        lastLineLower,
      ) ||
      /not for the reason|not (what|how|why) (most|many|you)/.test(
        lastLineLower,
      ) ||
      hasConsequencePayoff
    );

  return {
    isGenericMotivationalEnding,
    lastLineIsStrong,
  };
}
