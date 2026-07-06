// Deterministic hard-anchor detection for hook rewrite suggestions.
// Keep hook rewrite generation itself in scoring-rewrite.ts.

export function lineHasRewriteHardAnchor(line: string): boolean {
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
