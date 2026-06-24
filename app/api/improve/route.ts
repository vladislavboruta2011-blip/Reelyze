import OpenAI from "openai";

export type ImproveHookResult = {
  status: "good" | "improved" | "error";
  improvedHook: string;
  reason: string;
  mode?: "diagnostic" | "rewrite";
};

class UnusableAIResponseError extends Error {
  constructor() {
    super("Unusable AI response");
    this.name = "UnusableAIResponseError";
  }
}

// ── Universal generic-advice phrase guard ────────────────────────────────────
// These are advice/motivational clichés that must NEVER count as concrete
// anchor material, regardless of which other regex might accidentally match
// them (e.g. "work hard" containing no digit but matching some noun list).
// This is a defensive, independent layer — it runs in addition to, not
// instead of, the structural hard-anchor checks.
const GENERIC_ADVICE_PATTERNS: RegExp[] = [
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

// Returns true if the line is ENTIRELY/PRIMARILY a generic-advice clause
// (i.e. matches one of the cliché patterns AND has no other hard-anchor
// signal such as a number, named entity, or concrete noun).
function isGenericAdviceLine(line: string): boolean {
  const matchesAdvicePattern = GENERIC_ADVICE_PATTERNS.some(p => p.test(line));
  if (!matchesAdvicePattern) return false;

  // Even if it matches an advice pattern, a line with a real anchor
  // (number, named entity, concrete noun, measurable unit+digit) should
  // NOT be suppressed — e.g. "Work hard for 21 days and you'll see results."
  const hasRealAnchorDespiteAdvice =
    /\d/.test(line) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(line) ||
    /\d\s*(days?|weeks?|years?|percent|%|miles?|feet|kg|km|hours?|minutes?|seconds?)\b/i.test(line) ||
    /\$\s*\d/.test(line);

  return !hasRealAnchorDespiteAdvice;
}

// ── Absolute early guard: does the script contain ANY concrete anchor? ───────
// "Concrete anchor" = number, measurement, named reference, concrete object/event,
// causal/consequence connector, or specific physical/situational detail.
// Pure structural detection — works for any niche, no hardcoded topics/phrases.
function hasAnyConcreteAnchor(script: string): boolean {
  const lines = script
    .split(/[\n.!?]/)
    .map(l => l.trim())
    .filter(l => l.split(/\s+/).filter(Boolean).length >= 1);

  if (lines.length === 0) return true; // empty script — don't block, let normal flow handle it

  const STATIVE_OR_ABSTRACT_ED = new Set([
    "focused", "motivated", "inspired", "excited", "tired", "worried",
    "scared", "bored", "stressed", "frustrated", "confused", "determined",
    "dedicated", "committed", "interested", "pleased", "surprised", "shocked",
    "amazed", "disappointed", "satisfied", "annoyed", "relaxed", "concerned",
    "involved", "attached", "related", "required", "needed", "expected",
    "supposed", "based", "used", "blessed", "gifted", "skilled", "talented",
    "valued", "named", "called", "considered", "regarded", "known",
    "designed", "intended", "allowed", "believed", "understood",
  ]);

  for (const line of lines) {
    const ll = line.toLowerCase();

    // 0. Generic-advice lines never count toward concreteness — skip entirely,
    // even if they would otherwise match a later structural pattern.
    if (isGenericAdviceLine(line)) continue;

    // 1. Any digit (number, date, percentage, count, measurement)
    if (/\d/.test(line)) return true;

    // 2. Named reference mid-sentence (not sentence-start capital)
    if (/[a-z,]\s+[A-Z][a-z]{2,}/.test(line)) return true;

    // 3. Measurement unit — "day(s)/week(s)/year(s)" alone (e.g. "every day")
    // are too generic; require an adjacent digit for those specific units.
    if (/\b(percent|%|mile|miles|foot|feet|meter|meters|km|kilometer|pound|kg|kilogram|second|seconds|minute|minutes|hour|hours|degree|degrees|mph|kph|billion|million|thousand|dollar|euro|cent|\$)\b/i.test(ll)) return true;
    if (/\d\s*(days?|weeks?|years?)\b/i.test(line)) return true;

    // 4. Strong causal/consequence connector (real mechanism word)
    if (/\b(because|therefore|as a result|which means|led to|resulted in|caused|triggered|due to|consequently)\b/i.test(ll)) return true;

    // 5. Concrete physical/observable noun — static natural nouns (mountain, ocean, etc.)
    // only count when the line is NOT a simple static description.
    const _hasConcreteNoun5 = /\b(table|chair|floor|wall|door|window|room|building|office|school|hospital|station|airport|street|road|field|court|stage|ring|track|lab|store|market|ship|boat|car|truck|plane|phone|screen|camera|footage|image|photo|signal|message|food|fire|smoke|snow|rain|blood|hand|face|eye|voice|sound|light|shadow|key|box|bag|gun|knife|rope|wire|bridge|tower)\b/i.test(ll);
    const _hasNaturalNoun5 = /\b(mountain|ocean|river|lake|forest|water|body)\b/i.test(ll);
    const _isStaticDesc5 = /^[a-z\s,]+ (is|are|was|were) (a |an |the |very |extremely |really |so |quite )?\w/i.test(line);
    if (_hasConcreteNoun5) return true;
    if (_hasNaturalNoun5 && !_isStaticDesc5) return true;

    // 6. High-confidence irregular past tense (clear event/action)
    if (/\b(found|went|came|gave|took|saw|ran|fell|grew|flew|broke|drove|woke|won|built|bought|caught|dug|drew|drank|ate|fought|heard|held|led|lit|met|paid|shook|shot|slept|spoke|stood|stole|swam|taught|threw|thought|wrote)\b/i.test(ll)) return true;

    // 7. Non-stative -ed verb: an actual event/action happened
    const edMatches = ll.match(/\b(\w+)ed\b/g) ?? [];
    for (const m of edMatches) {
      if (!STATIVE_OR_ABSTRACT_ED.has(m) && m.replace(/ed$/, "").length >= 4) {
        return true;
      }
    }
  }

  return false;
}

const GENERIC_DIAGNOSTIC_HOOK =
  "This script needs one specific example, result, or consequence before the hook can feel strong.";

// Builds the universal diagnostic response when no concrete anchor exists.
function buildEarlyDiagnosticResponse(_script: string): ImproveHookResult {
  return {
    status: "improved",
    improvedHook: GENERIC_DIAGNOSTIC_HOOK,
    reason: "The script is too abstract to rewrite into a stronger hook without inventing unsupported ideas. Add one concrete example, result, consequence, number, or real situation first.",
    mode: "diagnostic",
  };
}

const MAX_REQUEST_BODY_BYTES = 16_384;
const MAX_IMPROVED_HOOK_CHARACTERS = 240;
const MAX_IMPROVE_REASON_CHARACTERS = 600;
const AI_RATE_LIMIT_MAX_REQUESTS = 10;
const AI_RATE_LIMIT_WINDOW_MS = 60_000;
const AI_RATE_LIMIT_MAX_ENTRIES = 10_000;

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

const aiRateLimitEntries = new Map<string, RateLimitEntry>();

class RequestBodyTooLargeError extends Error {}

function truncateGeneratedText(value: string, maxCharacters: number): string {
  const normalized = value.trim();

  if (normalized.length <= maxCharacters) {
    return normalized;
  }

  const sliced = normalized.slice(0, maxCharacters - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const minimumWordBoundary = Math.floor(maxCharacters * 0.75);
  const cutoff =
    lastSpace >= minimumWordBoundary ? lastSpace : sliced.length;

  return `${sliced.slice(0, cutoff).trimEnd()}…`;
}

function boundGeneratedResult(result: ImproveHookResult): ImproveHookResult {
  return {
    ...result,
    improvedHook: truncateGeneratedText(
      result.improvedHook,
      MAX_IMPROVED_HOOK_CHARACTERS
    ),
    reason: truncateGeneratedText(
      result.reason,
      MAX_IMPROVE_REASON_CHARACTERS
    ),
  };
}

function getClientIdentifier(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const forwardedClient = forwardedFor
    ?.split(",")[0]
    ?.trim();

  return (
    forwardedClient ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown-client"
  );
}

function consumeAIRateLimit(
  clientIdentifier: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  for (const [key, entry] of aiRateLimitEntries) {
    if (now - entry.windowStartedAt >= AI_RATE_LIMIT_WINDOW_MS) {
      aiRateLimitEntries.delete(key);
    }
  }

  const existing = aiRateLimitEntries.get(clientIdentifier);

  if (
    !existing ||
    now - existing.windowStartedAt >= AI_RATE_LIMIT_WINDOW_MS
  ) {
    if (
      !existing &&
      aiRateLimitEntries.size >= AI_RATE_LIMIT_MAX_ENTRIES
    ) {
      const oldestKey = aiRateLimitEntries.keys().next().value;

      if (oldestKey !== undefined) {
        aiRateLimitEntries.delete(oldestKey);
      }
    }

    aiRateLimitEntries.set(clientIdentifier, {
      count: 1,
      windowStartedAt: now,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= AI_RATE_LIMIT_MAX_REQUESTS) {
    const remainingMs =
      AI_RATE_LIMIT_WINDOW_MS - (now - existing.windowStartedAt);

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

async function readJsonBodyWithLimit(req: Request): Promise<unknown> {
  const contentLength = req.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);

    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > MAX_REQUEST_BODY_BYTES
    ) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!req.body) {
    return JSON.parse("");
  }

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let rawBody = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      receivedBytes += value.byteLength;

      if (receivedBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }

      rawBody += decoder.decode(value, { stream: true });
    }

    rawBody += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return JSON.parse(rawBody);
}

export async function POST(req: Request): Promise<Response> {
  const contentType =
    req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";

  if (contentType != "application/json") {
    return Response.json(
      {
        status: "error",
        improvedHook: "AI hook improvement is unavailable right now.",
        reason: "Unsupported Content-Type. Use application/json.",
      } satisfies ImproveHookResult,
      { status: 415 }
    );
  }

  let body: unknown;

  try {
    body = await readJsonBodyWithLimit(req);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Request body is too large.",
        } satisfies ImproveHookResult,
        { status: 413 }
      );
    }

    return Response.json(
      {
        status: "error",
        improvedHook: "AI hook improvement is unavailable right now.",
        reason: "Invalid JSON request body.",
      } satisfies ImproveHookResult,
      { status: 400 }
    );
  }

  try {
    if (
      !body ||
      typeof body !== "object" ||
      !("script" in body) ||
      typeof (body as Record<string, unknown>).script !== "string"
    ) {
      return Response.json(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "No script was provided.",
        } satisfies ImproveHookResult,
        { status: 400 }
      );
    }

    const requestBody = body as Record<string, unknown>;

    if ("title" in requestBody && typeof requestBody.title !== "string") {
      return Response.json(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Title must be a string.",
        } satisfies ImproveHookResult,
        { status: 400 }
      );
    }

    const script = (requestBody.script as string).trim();
    const title =
      typeof requestBody.title === "string" ? requestBody.title.trim() : "";

    if (script.length === 0) {
      return Response.json(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "A non-empty script must be provided.",
        } satisfies ImproveHookResult,
        { status: 400 }
      );
    }

    if (script.length > 1000) {
      return Response.json(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Script is too long. Keep it to 1,000 characters or less.",
        } satisfies ImproveHookResult,
        { status: 400 }
      );
    }

    if (title.length > 200) {
      return Response.json(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Title is too long. Keep it to 200 characters or less.",
        } satisfies ImproveHookResult,
        { status: 400 }
      );
    }

    // ── ABSOLUTE EARLY GUARD — must run before any AI call ──────────────────
    const earlyNoAnchorGuard = !hasAnyConcreteAnchor(script);
    if (earlyNoAnchorGuard) {
      return Response.json(buildEarlyDiagnosticResponse(script));
    }

    const systemPrompt = `You are a YouTube Shorts hook strategist and retention editor.

FIRST STEP — ANCHOR EXTRACTION (mandatory before writing anything):
Scan the full script body (every line after the first) and identify the single strongest anchor material. Output this as a field called "anchorMaterial" in your JSON response. You must commit to it before generating hooks.

Anchor priority order (highest first):
1. exactNumberWithUnit — a specific number with a measurement unit (miles per hour, feet, percent, seconds, degrees, billion, etc.). If found, this is ALWAYS the anchor. No other anchor type can outrank a specific number with a unit.

SPECIAL CASE — scenario scripts with a setup AND a payoff line: If the script opens with a scenario/imagined premise (e.g. "Imagine X happened for [duration]") AND separately contains a distinct payoff realization later (e.g. "X still has a property nobody expected"), do not anchor on the setup alone. Combine both: the improvedHook should reference the scenario's specific condition (the duration/premise) together with the payoff realization, since either one alone is a weaker hook than the combination. The "reason" field must name BOTH pieces explicitly.
2. concreteVisualDetail — a specific physical scene that creates a gap ("food still on the table", "cargo untouched", "every person gone")
3. consequence — a specific personal or high-stakes outcome the script eventually reveals
4. contradiction — a reversal of an assumption, ideally paired with a supporting body detail (NOT just "most people think X")
5. statusIdentityDetail — a specific identity or status implication from the script
6. finalPayoff — the destination the script is building toward, stated concretely

CRITICAL NUMBER RULE: If the script body contains any specific number with a unit (e.g. "over 1,000 miles per hour", "20 feet", "6 percent", "30 seconds"), the anchorMaterial MUST be type exactNumberWithUnit, and the improvedHook MUST include that exact number and unit. This is non-negotiable. A hook that uses the correct strategy but drops the number fails this rule.

CRITICAL FACT PRESERVATION RULE: Do not exaggerate the factual scope of the script.
- If the script says "today", the hook must say "today" — never "ever" or "always"
- If the script says "could", the hook must not say "will"
- If the script says "one moment", the hook must not say "everything forever"
- A stronger hook means more specific — not more exaggerated

HOOK GENERATION RULES:
- Under 22 words. Natural. Easy to say in one breath.
- Prefer the script's own concrete mechanism, action, or cause-and-effect detail (e.g. "removing choices", "your phone next to you", "junk food in your room") over generic topic restatements (e.g. "X is crucial for success", "X is important"). If the script names a specific mechanism for WHY something works, that mechanism — not a generic adjective — should anchor the hook.
- When using a physical comparison as the anchor, write it as a clear visual fact, not as an awkward or confusing action. Prefer natural phrasing like "even Mount Everest would sit more than a mile underwater" over "drop Mount Everest into its depths." If the script already contains a clean comparison, reflect that comparison clearly — do not invent a physical action that was not in the script.
- The improved hook must sound like a polished YouTube Shorts opening that is easy to say out loud in one breath. It should not read like a literal rearrangement of script sentences. If the anchor is a comparison, state the comparison in a single clear, visual, natural sentence.
- The improvedHook MUST use the anchorMaterial you identified. If your anchorMaterial is exactNumberWithUnit, the hook must contain that number and unit.
- Never start with "What if" unless the script is genuinely hypothetical and a question is clearly stronger than a statement for this specific content.
- Never use: "shocking", "insane", "crazy", "think again", "changes everything", "you won't believe", "the secret to".
- Do not invent facts not in the script. Do not change who does what, what the scope is, or what the time range is.
- If the hook is already strong (hookScore >= 80), do not force a worse rewrite — return the original.
- NEVER convert "Imagine X" into "What if X".
- NEVER return a rewrite sharing 80%+ of words with the original hook.
- NEVER rewrite a strong hook (hookScore >= 75) unless the rewrite is clearly stronger by using a specific detail, number, or consequence the original missed.
- Prefer a concrete statement hook over a question hook when the consequence is clearer than the mystery.
- For YouTube Shorts, the improvedHook should usually be one short, punchy sentence under 14 words when possible. It should feel like the first line of a 20-30 second Short, not the intro to a long-form video. Prefer the strongest consequence, contradiction, number, visual, or payoff over explanatory setup. Avoid slow phrases like "Most people think..." unless that contrast is truly the strongest possible opening.
- If the script contains a stronger final payoff line, consider moving that payoff to the beginning as the improved hook.
- For weak hooks, prefer a punchy 5-10 word opening when possible. Avoid double-clause explanatory hooks structured as "X does not start when Y -- it starts when Z" or "X is not about Y -- it is about Z" unless that exact contrast is clearly the strongest possible phrasing. A Shorts hook should feel like a fast first-second statement, not a complete explanation. Prefer direct consequence hooks, threat hooks, contradiction hooks, or payoff-first hooks over setup-plus-reveal sentences.
- The improvedHook must still use the script's strongest concrete anchor (the number, object, cause, or specific detail identified in anchorMaterial). Do not strip out the concrete anchor just to shorten the hook -- compress around it instead.
- The improvedHook should not simply copy or lightly rephrase an existing script sentence unless that sentence is already clearly the strongest possible hook. For weak hooks, transform the strongest concrete cause/effect into a sharper opening -- do not just extract a middle sentence and trim it. Prefer the hidden cause, the surprising consequence, or the final payoff over repeating a middle explanation line.
- When the script contains both a cause and a consequence (e.g. an object or action that triggers a later result), the best Shorts hook often combines them into one short line: cause + consequence, object + consequence, or hidden reason + result. Compress the causal chain into a single punchy statement rather than quoting one link of it.
- Bad long-form style: "Most people think mornings are ruined by waking up tired, but it actually starts with your phone at night." Too explanatory: "Your morning does not start when you wake up -- it begins with your phone at night." Too extractive (lightly rephrases a middle script line): "Checking your phone first thing makes your morning feel boring." Better Shorts style: "Your phone at night is ruining tomorrow morning." / "Your morning starts with last night's scroll." / "Your brain starts tomorrow before sleep."
- For weak hooks where the script later reveals a hidden mechanism, do NOT summarize the mechanism as an explanation. Turn it into a curiosity gap.
- Bad hook style: "The method works because it creates a better result." This explains the answer instead of creating curiosity.
- Bad hook style: "It's not just the obvious reason — the secret is a hidden mechanism." This starts unclear and sounds generic.
- Better hook style: "The result starts before the obvious moment."
- Better hook style: "The hidden mechanism happens before anyone notices."
- Bad hooks explain the answer. Good hooks make the viewer want the answer.
- The first 5 words must be understandable without previous context. Do not start improved hooks with vague pronouns like "It", "This", "That", "He", "She", or "They" unless the subject is named inside the same phrase.
- Avoid "secret" phrasing. It usually sounds generic. Use the actual mechanism, consequence, contradiction, number, or visual detail instead.
- Avoid weak belief-contrast openings like "Many think...", "Most people think...", or "Everyone thinks..." unless the hook also contains a very specific number, consequence, visual detail, or contradiction in the first clause.
- Avoid "but it's really about..." phrasing. It sounds explanatory. A better hook should make the mechanism feel like a reveal, not explain it fully.
- Strong hooks should be instantly understandable and punchy. Prefer "X happens before Y" over "Many people think X, but it is really about Y."

HOOK TYPE RECOGNITION — score these as STRONG even without a question mark:
- Numeric/stat hook: specific number + named subject + unusual scenario → 72–85
- Scenario hook: concrete imagined situation with personal stakes → 75–88
- Visual mystery hook: specific physical detail with irresistible gap → 78–88
- Consequence hook: strongest outcome stated immediately → 75–85
- Contradiction hook: reversal of assumption with specific anchor → 72–85

GOOD HOOK EXAMPLES:
consequence: "Bad sleep does not just make you tired — it quietly ruins the next day before it starts."
specificity + number: "If Earth stopped, your body would still be moving at over 1,000 miles per hour."
contradiction + detail: "A cheap watch tells time too — Rolex sells what wearing it says about you."
mystery + visual: "A ship was found drifting in the ocean — food still on the table, every person gone."
scenario + personal: "Imagine someone was about to play back everything you said today — and millions could hear it."

BAD HOOK EXAMPLES — never produce these:
"Most people think stopping Earth is the worst part." (drops the 1,000 mph number — fails anchor rule)
"Most people think a Rolex is just a watch — but it sells status." (too generic, misses "cheap watch tells time too" and "what it says about you")
"One moment can become permanent — and millions could hear every private joke you've ever said." (changes "today" to "ever" — fails fact preservation rule)
"What if the secret to feeling better lies in your sleep?" (vague, no anchor)

REASON QUALITY — must be specific to THIS script:
Bad: "The improved hook creates curiosity."
Good: "The original hook announces the topic without giving viewers a reason to stay. This version leads with the most concrete detail in the script — your body would still be moving at over 1,000 miles per hour — which makes the danger immediate and specific."

Return ONLY valid JSON, no markdown, no code fences.

Return exactly this shape:
{
  "hookScore": <number 0-100>,
  "hookLabel": "Weak" | "Average" | "Good" | "Strong",
  "anchorMaterial": {
    "type": "exactNumberWithUnit" | "concreteVisualDetail" | "consequence" | "contradiction" | "statusIdentityDetail" | "finalPayoff",
    "value": "<the exact text extracted from the script body — copy it verbatim>",
    "sourceLine": "<the sentence it came from>"
  },
  "primaryWeakness": "<one of: filler-intro | obvious-statement | too-generic | no-curiosity-gap | no-contradiction | no-stakes | answer-given-too-early | weak-payoff-alignment | already-strong>",
  "rewriteStrategy": "<strategy used>",
  "originalHook": "<first line of the script>",
  "diagnosis": "<one sentence: what the hook fails to do, or confirm it already works>",
  "improvedHook": "<the single best rewrite, or the original if already strong>",
  "reason": "<specific explanation tied to THIS script — name the anchor material and why the original missed it>",
  "hookOptions": [
    { "type": "<strategy>", "text": "<hook>", "whyItWorks": "<one sentence specific to this script>" },
    { "type": "<strategy>", "text": "<hook>", "whyItWorks": "<one sentence specific to this script>" },
    { "type": "<strategy>", "text": "<hook>", "whyItWorks": "<one sentence specific to this script>" }
  ]
}

NEVER use the double-quote character inside any JSON string value. Rephrase to avoid it.`;

    const userPrompt = `Analyze this YouTube Shorts script and improve the hook.
${title ? `\nVideo title / topic: "${title}"\n` : ""}
Script:
${script}

Step 1 — ANCHOR EXTRACTION (do this before anything else):
Read the entire script body (every line after the first line). Find the single strongest piece of hook material using the priority order in the system prompt. If there is any specific number with a unit anywhere in the script body, that is the anchor — period. Write down the exact text.

Step 2 — Score the current hook against the anchor:
Does the first line already use this anchor material? If not, that is the primary weakness.

Step 3 — Generate 3 hook options that each use the anchor you found:
- Option A: lead with the anchor directly (number, visual detail, or consequence)
- Option B: use the anchor inside a contradiction or reversal structure
- Option C: use the anchor with a personal stakes or identity framing

All 3 options must include the anchor value from Step 1. An option that does not reference the anchor fails.

Step 4 — Pick the best one as improvedHook. If the anchor is a specific number with a unit, the improvedHook must contain that number and unit.

Step 5 — Write the reason. It must name the anchor material and explain why the original first line failed to use it.

Return only valid JSON matching the exact schema.`;

    // ── Generic script guard ───────────────────────────────────────────────
    const { isGeneric, mainTopicWord } = isVeryGenericScript(script);
    if (isGeneric) {
      return Response.json(buildGenericScriptResponse(script, mainTopicWord));
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return Response.json(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "AI hook improvement is temporarily unavailable.",
        } satisfies ImproveHookResult,
        { status: 503 }
      );
    }

    const rateLimit = consumeAIRateLimit(getClientIdentifier(req));

    if (!rateLimit.allowed) {
      return Response.json(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Too many hook improvement requests. Please try again later.",
        } satisfies ImproveHookResult,
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const openai = new OpenAI({
      apiKey,
      timeout: 15_000,
      maxRetries: 0,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 900,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";

    const result = parseHookResponse(raw, script);

    return Response.json(boundGeneratedResult(result));
  } catch (error) {
    const upstreamStatus =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : undefined;

    if (error instanceof UnusableAIResponseError) {
      console.error("[improve] AI response was unusable.");
      return Response.json(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Reelyze could not generate a valid hook improvement right now.",
        } satisfies ImproveHookResult,
        { status: 502 }
      );
    }

    if (upstreamStatus === 401 || upstreamStatus === 403) {
      console.error("[improve] AI provider authentication failed.");
      return Response.json(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "AI hook improvement is temporarily unavailable.",
        } satisfies ImproveHookResult,
        { status: 503 }
      );
    }

    if (
      upstreamStatus === 429 ||
      (upstreamStatus !== undefined && upstreamStatus >= 500) ||
      error instanceof OpenAI.APIConnectionError
    ) {
      console.error("[improve] AI provider temporarily unavailable.");
      return Response.json(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "AI hook improvement is temporarily unavailable.",
        } satisfies ImproveHookResult,
        { status: 503 }
      );
    }

    console.error("[improve] request failed.");
    return Response.json(
      {
        status: "error",
        improvedHook: "AI hook improvement is unavailable right now.",
        reason: "Reelyze could not generate a custom hook improvement for this script.",
      } satisfies ImproveHookResult,
      { status: 500 }
    );
  }
}

// ── Banned openers: any improved hook starting with these is rejected ────────
const BANNED_HOOK_OPENERS = [
  "today i will",
  "today i want",
  "in this video",
  "in today's video",
  "i will explain",
  "i want to explain",
  "let's talk about",
  "let me explain",
  "this video is about",
  "welcome back",
  "hey guys",
  "so today",
  "it's not just",
  "it is not just",
  "this is not just",
  "that's not just",
  "that is not just",
  "the secret",
  "here's why",
  "here is why",
];

// ── Quality signals: a good hook must contain at least one ──────────────────
// NOTE: "— " and " — " are intentionally removed. An em-dash alone is not a
// quality signal — it was allowing generic "X — if you stay focused" hooks
// to pass validation. Real quality must come from contrast, consequence,
// specificity, or mystery — not punctuation.
const HOOK_QUALITY_SIGNALS = [
  // contrast / reversal
  " but ", "however", "not what", "not really", "is not ", "does not ",
  "most people think", "most creators think", "everyone thinks",
  // consequence / stakes
    " cost", " lost", " destroy", " fail", " ruin", "before it", "before he", "before she", "before they", "before you", "before the", "by the time",
  " one mistake", " one decision", "too late", "already ",
  // mystery / withhold
  "until ", "except ", "one detail", "something was",
  "nobody knew", "no one knew", "then they found",
  // specificity / concrete
  "$ ", "million", "billion", "seconds", "days", "weeks", "years",
  // curiosity gap
  "?", "why does", "why did", "how did", "what really",
  // status / identity
  "who you are", "how people see", "what you are",
];

function isTooSimilar(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // Check word overlap — if 80%+ of words in the improved hook exist in the original, reject
  const wordsA = new Set(na.split(" "));
  const wordsB = nb.split(" ");
  const overlap = wordsB.filter(w => wordsA.has(w)).length;
  return overlap / wordsB.length >= 0.8;
}

function isHookQualityAcceptable(hook: string): boolean {
  const lower = hook.toLowerCase();
  return HOOK_QUALITY_SIGNALS.some(signal => lower.includes(signal));
}

function isBannedOpener(hook: string): boolean {
  const lower = hook.toLowerCase().trimStart();
  return BANNED_HOOK_OPENERS.some(opener => lower.startsWith(opener));
}

function isExplanatorySummaryHook(hook: string): boolean {
  const lower = hook.toLowerCase();

  return (
    /\bmaking (him|her|it|them|you)\b/i.test(lower) ||
    /\bthis helps (him|her|it|them|you)\b/i.test(lower) ||
    /\bthis makes (him|her|it|them|you)\b/i.test(lower) ||
    /\bwhich makes (him|her|it|them|you)\b/i.test(lower) ||
    /\bthat is why\b/i.test(lower)
  );
}

function isUnclearStandaloneHook(hook: string): boolean {
  const lower = hook.toLowerCase().trimStart();

  return (
    /^(it|this|that|he|she|they)\b/i.test(lower) ||
    /\bsecret\b/i.test(lower)
  );
}

function isWeakBeliefContrastHook(hook: string): boolean {
  const lower = hook.toLowerCase().trimStart();

  return (
    /^(many|most|everyone|people)\s+(people\s+)?(think|believe|assume)\b/i.test(lower) ||
    /\bbut\s+(it'?s|it is|this is|that is)\s+really\s+about\b/i.test(lower) ||
    /\bbut\s+(the\s+)?(real|actual)\s+(secret|reason|point)\s+is\b/i.test(lower)
  );
}

function isConclusionHook(hook: string): boolean {
  const lower = hook.toLowerCase().trimStart();

  return (
    /^(that is why|that's why|this is why|that is how|this is how|that is what|this is what)\b/i.test(lower)
  );
}

function buildClearStandaloneFallbackHook(script: string): string {
  const lines = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] ?? "";
  const bodyLines = lines.slice(1);
  const bodyText = bodyLines.join(" ");
  const fullText = script.toLowerCase();

  const namedSubjectMatch = firstLine.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/);
  const subject =
    namedSubjectMatch?.[0] ??
    firstLine.match(/^(.+?)\s+(is|are|was|were|does|do|can|could|will|would|has|have)\b/i)?.[1]?.trim() ??
    "";

  const hasBeforeJumpMechanism =
    /\bbefore\b/i.test(bodyText) &&
    /\bjump|jumps|jumping|ground|air\b/i.test(bodyText);

  const isHeaderOrAirScript =
    /\bheader|headers|heading|aerial|in the air\b/i.test(fullText);

  if (subject.length > 0 && hasBeforeJumpMechanism && isHeaderOrAirScript) {
    return `${subject} wins headers before he even leaves the ground.`;
  }

  const physicalMechanismLine = bodyLines.find(line => {
    const ll = line.toLowerCase();

    return (
      /\b(ground|foot|feet|leg|legs|hip|hips|knee|knees|ankle|ankles|body|spring|force|power|speed|balance)\b/i.test(ll) &&
      /\b(jump|jumps|jumping|power|force|explosive|upward|transfer|loads?|drives?)\b/i.test(ll)
    );
  });

  if (subject.length > 0 && physicalMechanismLine) {
    const ll = physicalMechanismLine.toLowerCase();

    if (/\bspring\b/i.test(ll)) {
      return `${subject}'s body loads like a spring before the jump.`;
    }

    if (/\bground\b|\bfoot\b|\bfeet\b/i.test(ll)) {
      return `${subject}'s jump starts before he leaves the ground.`;
    }

    return `${subject}'s power comes from a detail most viewers miss.`;
  }

  const visualLine = bodyLines.find(line => {
    const ll = line.toLowerCase();

    return (
      /\bstill\b|\buntouched\b|\bleft behind\b|\bgone\b|\bmissing\b|\bvanished\b|\bdisappeared\b|\bno signs\b|\bno one\b|\bnobody\b|\bevery person\b/i.test(ll)
    );
  });

  if (visualLine) {
    const cleaned = visualLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);

    return words.length <= 14
      ? `${capitalizeFirstChar(cleaned)}.`
      : `${capitalizeFirstChar(words.slice(0, 14).join(" "))}.`;
  }

  const numberLine = bodyLines.find(line =>
    /\d[\d,]*(?:\.\d+)?/.test(line) &&
    /\b(miles per hour|mph|kph|km\/h|feet|foot|meters|percent|%|seconds|minutes|hours|days|years|degrees|times|million|billion|thousand)\b/i.test(line)
  );

  if (numberLine) {
    const cleaned = numberLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);

    return words.length <= 16
      ? `${capitalizeFirstChar(cleaned)}.`
      : `${capitalizeFirstChar(words.slice(0, 16).join(" "))}.`;
  }

  return "This script needs one sharper result or visual detail before Reelyze can write a stronger hook.";
}

const INCOMPLETE_ENDING_WORDS = new Set([
  "the", "a", "an", "of", "to", "and", "but", "or", "for", "with",
  "where", "when", "while", "that", "which", "who", "whom", "in", "on",
  "at", "by", "from", "as", "is", "was", "were", "this", "their", "its",
]);

function endsWithIncompletePhrase(hook: string): boolean {
  const cleaned = hook.trim().replace(/[."'!?]+$/, "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const lastWord = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, "");
  return INCOMPLETE_ENDING_WORDS.has(lastWord);
}

function capitalizeFirstChar(text: string): string {
  const trimmed = text.trim();

  if (!trimmed) return "";

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function buildAnchorHook(
  script: string,
  anchor: { type: string; value: string } | null
): string | null {
  if (!anchor) return null;

  const lines = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean);
  const bodyLines = lines.slice(1);

  if (anchor.type === "exactNumberWithUnit") {
    // Find the full sentence containing this number
    const sourceLine = bodyLines.find(l =>
      l.toLowerCase().includes(anchor.value.toLowerCase().replace(/^(over|about|nearly|around|roughly|just|almost)\s*/i, "").split(/\s+/)[0])
    ) ?? "";

    const cleaned = sourceLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);

    // Keep deterministic fallbacks fully grounded in the source sentence.
    if (cleaned.length > 0) {
      return words.length <= 20
        ? `${capitalizeFirstChar(cleaned)}.`
        : `${capitalizeFirstChar(words.slice(0, 18).join(" "))}.`;
    }

    return null;
  }

if (anchor.type === "concreteVisualDetail") {
    const cleaned = anchor.value.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);
    const hook = words.length <= 16
      ? capitalizeFirstChar(cleaned)
      : capitalizeFirstChar(words.slice(0, 14).join(" "));

    // Find a second, complementary detail using universal absence/contrast signals
    const secondDetail = bodyLines.find(l => {
      const ll = l.toLowerCase();
      if (l === anchor.value) return false;
      const wc = l.split(/\s+/).length;
      return wc >= 3 && wc <= 14 && (
        // absence of people (universal)
        /\b(nobody|no one|not a single person|every person|everyone) (was|had|were|on|gone|disappeared|left)\b/i.test(ll) ||
        // disappearance / absence markers (universal)
        /\b(gone|missing|vanished|disappeared|abandoned|empty|silent|deserted)\b/i.test(ll) ||
        // contrast (universal)
        (ll.includes(" but ") || ll.includes("yet ") || ll.includes("however"))
      );
    });

    if (secondDetail) {
      const secondCleaned = secondDetail.replace(/[.!?]+$/, "").trim();
      const secondWords = secondCleaned.split(/\s+/);
      // Use the full clause if short enough; never truncate mid-phrase.
      const secondPhrase = secondWords.length <= 10
        ? secondCleaned.toLowerCase()
        : secondWords.slice(0, 10).join(" ").toLowerCase();
      return `${hook} — but ${secondPhrase}.`;
    }

    return `${hook} — and nobody knew why.`;
  }

  return null;
}

function buildSpecificReason(original: string, improved: string, script: string): string {
  const origLower = original.toLowerCase();
  const lines = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean);
  const bodyLines = lines.slice(1);

  // ── Detect the original hook's primary failure mode (structural) ──────────
  const isFillerOpener =
    origLower.startsWith("today i") || origLower.startsWith("in this video") ||
    origLower.startsWith("i will") || origLower.startsWith("let's talk") ||
    origLower.startsWith("hey guys") || origLower.startsWith("welcome");

  const isObviousStatement =
    !isFillerOpener &&
    !origLower.includes("?") &&
    !origLower.includes(" but ") &&
    !origLower.includes("not ") &&
    !origLower.includes("never ");

  // ── Find the strongest body material used in the improved hook ────────────
  // Priority: number → consequence → reversal → visual detail

  // Number-based anchor (universal)
  const numberLine = bodyLines.find(l =>
    /\d[\d,]*\s*(miles|km|percent|%|million|billion|seconds|minutes|days|years|feet|meters|degrees)/i.test(l)
  );
  if (numberLine) {
    const shortNumber = numberLine.replace(/[.!?]+$/, "").toLowerCase();
    const preview = shortNumber.split(/\s+/).slice(0, 12).join(" ");
    return `The original opens without giving viewers a reason to stay. The improved hook uses the most specific detail in the script — ${preview} — which immediately shows the scale of what the video reveals.`;
  }

  // Consequence-based anchor (universal — behavioral, causal, identity)
  const lastThirdStart = Math.floor(bodyLines.length * 0.6);
  const consequenceLine = bodyLines.slice(lastThirdStart).find(l => {
    const ll = l.toLowerCase();
    return /that is why|that is what|keeps (going|moving|building)|says about you|proof that|become permanent|trains (your|the)|it is not (just|about)|the (scary|strange|real) (part|reason)/.test(ll);
  });
  if (consequenceLine) {
    const preview = consequenceLine.replace(/[.!?]+$/, "").toLowerCase().split(/\s+/).slice(0, 12).join(" ");
    return `The original only announces the topic. The improved hook leads with the consequence — ${preview} — which gives viewers a reason to keep watching before they understand the setup.`;
  }

  // Reversal-based anchor (universal)
  const reversalLine = bodyLines.find(l => {
    const ll = l.toLowerCase();
    return (ll.includes(" not ") || ll.startsWith("not ")) &&
      (ll.includes("just") || ll.includes("about") || ll.includes("only") ||
       ll.includes("really") || ll.includes("the real") || ll.includes("reason") || ll.includes("point"));
  });
  if (reversalLine) {
    const preview = reversalLine.replace(/[.!?]+$/, "").toLowerCase().split(/\s+/).slice(0, 12).join(" ");
    return `The original states an assumption the script will later disprove. The improved hook leads directly with the reversal — ${preview} — so viewers feel the gap between assumption and truth immediately.`;
  }

  // Visual detail anchor (universal)
  const visualLine = bodyLines.find(l => {
    const ll = l.toLowerCase();
    return /\bstill\b|\bleft behind\b|\buntouched\b|\bdisappeared\b|\bvanished\b|\bnobody\b|\bno one\b/.test(ll);
  });
  if (visualLine) {
    const preview = visualLine.replace(/[.!?]+$/, "").toLowerCase().split(/\s+/).slice(0, 12).join(" ");
    return `The original describes the event at a distance. The improved hook leads with a specific physical detail — ${preview} — which makes the tension concrete and immediate.`;
  }

  // ── Failure-mode fallbacks ────────────────────────────────────────────────
  if (isFillerOpener) {
    const bodyAnchor = bodyLines.find(l => {
      const wc = l.split(/\s+/).length;
      return wc >= 5 && wc <= 18;
    });
    const detail = bodyAnchor
      ? bodyAnchor.toLowerCase().replace(/[.!?]+$/, "").split(/\s+/).slice(0, 10).join(" ")
      : "a consequence or insight from later in the script";
    return `The original hook only announces the topic. The improved version leads with the most useful idea from the script body — ${detail} — so viewers have a reason to keep watching before they understand why it matters.`;
  }

  if (isObviousStatement) {
    return "The original states something the viewer already suspected, which gives them no reason to stay. The improved hook introduces a tension or contrast that only the script can resolve.";
  }

  return "The original hook states the topic without creating tension. The improved version leads with the most specific detail or consequence in the script, so the viewer has a reason to keep watching before they know where it ends.";
}

// ── Generic script detection ─────────────────────────────────────────────────
// Returns true when the script has no concrete anchor material.
// A generic script has: no numbers, no named entities, no visual details,
// no specific consequences, no reversals — only vague platitudes.
// When true, the AI should not be allowed to invent unsupported ideas.

// ── Universal line signal scoring ────────────────────────────────────────────
// Each line is evaluated on universal structural signals, not niche phrases.
// This works for any topic: science, sports, business, mystery, finance, etc.

function scoreLineSignals(line: string): {
  hasConcrete: boolean;
  isAbstract: boolean;
} {
  // Generic-advice lines are always abstract, never concrete.
  if (isGenericAdviceLine(line)) {
    return { hasConcrete: false, isAbstract: true };
  }

  const lower = line.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);

  // ── Concrete signals ───────────────────────────────────────────────────────

  // 1. Any digit (number, date, percentage, count, measurement)
  const hasNumber = /\d/.test(line);

  // 2. Any measurement unit — universal across niches
  const hasUnit =
    /\b(percent|%|mile|miles|foot|feet|meter|meters|km|kilometer|pound|kg|kilogram|second|seconds|minute|minutes|hour|hours|degree|degrees|mph|kph|billion|million|thousand|dollar|euro|cent|\$)\b/i.test(lower) ||
    /\d\s*(days?|weeks?|years?)\b/i.test(line);

  // 3. Named reference appearing mid-sentence (not a sentence-start capital)
  // Pattern: lowercase letter or comma, then whitespace, then Capital Word
  // This detects "in London", "on Facebook", "at Tesla", "with Ronaldo"
  // but NOT sentence-start "Success is..." or "Everyone wants..."
  const hasNamedReference = /[a-z,]\s+[A-Z][a-z]{2,}/.test(line);

  // 4. Concrete physical / observable noun — broad semantic category
  // Universal: anything that can be seen, touched, or pointed at
  const hasConcreteNoun =
    /\b(table|chair|floor|wall|door|window|room|building|office|school|hospital|station|airport|street|road|field|court|stage|ring|track|lab|store|market|shop|ship|boat|car|truck|plane|phone|screen|camera|footage|image|photo|signal|message|food|water|fire|smoke|snow|rain|blood|body|hand|face|eye|voice|sound|light|shadow|key|box|bag|bag|gun|knife|rope|wire|bridge|tower|mountain|ocean|river|lake|forest|sky|ground|surface|border|edge|line|map|paper|book|letter|note|sign|coin|card|seat|bed|door|gate|fence|wall|window|roof|ceiling|road|path|trail|staircase|elevator|engine|wheel|wing|wheel|pipe|tube|cable|switch|button|dial|meter|gauge|clock|battery|fuel|vessel|container|bottle|glass|plate|bowl|pot|pan|needle|thread|fabric|leather|stone|wood|metal|plastic|glass|rubber|sand|soil|ice|smoke|steam|dust|ash|foam|wax|oil|gas|liquid|powder|crystal|chip|disk|chip|screen|lens|mirror|frame|net|rope|chain|lock|key|seal|stamp|tag|label|badge|ticket|token|coin|bill|flag|weapon|tool|device|machine|system|circuit|sensor|signal|pulse|wave|beam|ray|particle|atom|cell|tissue|muscle|bone|nerve|skin|blood|organ|gene|virus|bacteria|chemical|compound|element|molecule)\b/i.test(lower);

  // Specific action: detect that something happened or was done.
  // Strategy: past-tense verbs (regular -ed endings) OR a small closed set
  // of high-frequency irregular past tenses that signal events.
  // This is grammatical / morphological detection, not a vocabulary list.
  // Regular past tense — only event-signaling -ed verbs, not stative adjectives.
  // We exclude common stative/motivational -ed adjectives that are NOT events:
  // focused, motivated, inspired, excited, tired, worried, scared, bored, stressed,
  // frustrated, confused, determined, dedicated, committed, interested, pleased,
  // surprised, shocked, amazed, disappointed, satisfied, annoyed, relaxed, etc.
  // Strategy: match -ed verbs only when they follow a clear subject + action structure
  // (i.e. something was DONE, not something IS a state).
  const STATIVE_ED_WORDS = new Set([
    "focused", "motivated", "inspired", "excited", "tired", "worried",
    "scared", "bored", "stressed", "frustrated", "confused", "determined",
    "dedicated", "committed", "interested", "pleased", "surprised", "shocked",
    "amazed", "disappointed", "satisfied", "annoyed", "relaxed", "concerned",
    "involved", "attached", "related", "required", "needed", "expected",
    "supposed", "based", "used", "blessed", "gifted", "skilled", "talented",
  ]);
  const edMatches = lower.match(/\b(\w+)ed\b/g) ?? [];
  const hasNonStatived = edMatches.some(m => {
    const stem = m.replace(/ed$/, "");
    return !STATIVE_ED_WORDS.has(m) && stem.length >= 3;
  });
  const hasSpecificAction =
    hasNonStatived ||
    /\b(found|lost|went|came|got|gave|took|made|saw|ran|fell|grew|flew|broke|froze|drove|rose|woke|wore|won|beat|built|bought|caught|cut|dug|drew|drank|ate|felt|fought|heard|held|kept|knew|led|left|lit|met|paid|read|said|sent|set|shook|shot|showed|slept|slid|spoke|stood|stole|stuck|swam|swung|taught|told|threw|thought|understood|woke|wrote)\b/i.test(lower);

  // 6. Causal / consequence structure — "X caused Y", "which led to", "as a result"
  // Detected by structural connectors, not topic phrases
  const hasCausalStructure =
    /\b(caused|led to|resulted in|triggered|forced|prevented|enabled|stopped|started|which means|as a result|because of|due to|therefore|consequently|so that|in order to|which caused|which led|which triggered|which prevented|which enabled)\b/i.test(lower);

  // 7. Time or place anchor — grounding the claim in reality
  const hasTimeOrPlace =
    /\b(in \d{4}|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|at \d|by \d|after \d|before \d|in (january|february|march|april|may|june|july|august|september|october|november|december)|last (week|month|year|night|decade)|next (week|month|year)|yesterday|today|tonight|this (morning|afternoon|evening|week|month|year)|in the (morning|afternoon|evening|night)|ago|earlier|later|then|at the time|at that point|within|during|throughout|since|until|by the time)\b/i.test(lower) ||
    /\b(in|at|near|outside|inside|under|above|below|beside|behind|around|across|through|along|over|between) (the|a|an) [a-z]+\b/i.test(lower);

  const hasConcrete =
    hasNumber || hasUnit || hasNamedReference ||
    hasConcreteNoun || hasSpecificAction ||
    hasCausalStructure || hasTimeOrPlace;

  // ── Abstract signals ───────────────────────────────────────────────────────

  // Abstract: a line that states a broad claim with no grounding
  // Detected by structural patterns — not topic-specific vocabulary

  // "X is [adjective/noun]" — abstract assertion
  const isAbstractAssertion =
    /^[a-z\s]+ (is|are|was|were) (very |extremely |really |truly |so |quite |always |often |usually |never )?(important|key|essential|crucial|critical|powerful|difficult|hard|easy|simple|possible|impossible|necessary|needed|useful|valuable|effective|amazing|incredible|wonderful|terrible|great|good|bad|wrong|right|true|false|real|common|rare|unique|special|different|better|worse|best|worst|only|enough|enough)\.?$/i.test(lower);

  // "X takes/requires/needs Y" — vague requirement
  const isVagueRequirement =
    /^[a-z\s]+ (takes|requires|needs|demands|involves|means) [a-z\s]+\.?$/i.test(lower) &&
    !hasNumber && !hasConcreteNoun && !hasSpecificAction;

  // "Many/Most/Everyone/People [verb] X" — generalized claim
  const isGeneralizedClaim =
    /^(many|most|all|every|some|few|no one|nobody|everyone|somebody|people|humans|we|they|you) (people )?(want|need|think|believe|know|feel|try|struggle|fail|succeed|can|will|do|don't|should|must|have to|tend to|are|is|were|was)\b/i.test(lower) &&
    !hasNumber && !hasConcreteNoun && !hasSpecificAction;

  // "You can/should/must/need to [do X]" — generic advice
  const isGenericAdvice =
    /^(you|we) (can|could|should|must|need to|have to|want to|try to) [a-z]/.test(lower) &&
    !hasNumber && !hasConcreteNoun && !hasSpecificAction;

  // Very short motivational fragment (≤6 words, no concrete signal)
  const isShortMotivational =
    words.length <= 6 &&
    !hasNumber && !hasConcreteNoun && !hasSpecificAction && !hasNamedReference;

  const isAbstract =
    !hasConcrete && (
      isAbstractAssertion ||
      isVagueRequirement ||
      isGeneralizedClaim ||
      isGenericAdvice ||
      isShortMotivational
    );

  return { hasConcrete, isAbstract };
}

// ── Universal generic script detector ────────────────────────────────────────
// Evaluates each line independently using structural signals.
// Returns true when the script has no concrete anchor and most lines are abstract.
// Works for any niche: motivation, finance, science, sports, mystery, etc.

// ── Hard anchor check — used by isVeryGenericScript ──────────────────────────
// This is a STRICTER check than scoreLineSignals.hasConcrete.
// It only returns true for lines that have real, undeniable anchor material:
// numbers, named references, measurement units, or clear causal events.
// It deliberately excludes the -ed verb detection entirely to prevent
// stative adjectives like "focused" or "motivated" from registering as concrete.
function lineHasHardAnchor(line: string): boolean {
  const ll = line.toLowerCase();
  // 0. Generic-advice lines never count as hard anchors.
  if (isGenericAdviceLine(line)) return false;
  // 1. Any digit
  if (/\d/.test(line)) return true;
  // 2. Named reference mid-sentence (not sentence-start capital)
  if (/[a-z,]\s+[A-Z][a-z]{2,}/.test(line)) return true;
  // 3. Measurement unit — "year(s)" alone is too generic; require an adjacent digit.
  if (/\b(percent|%|mile|miles|foot|feet|meter|meters|km|kilometer|pound|kg|kilogram|second|seconds|minute|minutes|hour|hours|degree|degrees|mph|kph|billion|million|thousand|dollar|euro|cent|\$)\b/i.test(ll)) return true;
  if (/\d\s*(years?)\b/i.test(line)) return true;
  // 4. Strong causal connector (not just "so" or "that is why" — requires real mechanism word)
  if (/\b(because|therefore|as a result|which means|led to|resulted in|caused|triggered|due to|consequently)\b/i.test(ll)) return true;
  // 5. Concrete physical / observable noun — only counts when paired with an
  // action/event OR when NOT in a static "X is a Y" sentence structure.
  // "Everest is a very tall mountain" should NOT count — static assertion.
  // "The ship hit a mountain of ice" SHOULD count — action present.
  const hasConcreteNoun = /\b(table|chair|floor|wall|door|window|room|building|office|school|hospital|station|airport|street|road|field|court|stage|ring|track|lab|store|market|ship|boat|car|truck|plane|phone|screen|camera|footage|image|photo|signal|message|food|fire|smoke|snow|rain|blood|hand|face|eye|voice|sound|light|shadow|box|bag|gun|knife|rope|wire|bridge|tower)\b/i.test(ll);
  // High-altitude / natural nouns (mountain, ocean, etc.) only count when the line
  // is NOT a simple static description ("X is a Y" or "X is very/extremely Y")
  const hasNaturalNoun = /\b(mountain|ocean|river|lake|forest|water|body)\b/i.test(ll);
  const isStaticDescription = /^[a-z\s,]+ (is|are|was|were) (a |an |the |very |extremely |really |so |quite |always |often )?\w/i.test(line);
  if (hasConcreteNoun) return true;
  if (hasNaturalNoun && !isStaticDescription) return true;
  // 6. High-confidence irregular past tense (closed list — no ambiguous stative forms)
  if (/\b(found|went|came|gave|took|saw|ran|fell|grew|flew|broke|drove|woke|won|built|bought|caught|dug|drew|drank|ate|fought|heard|held|led|lit|met|paid|shook|shot|slept|spoke|stood|stole|swam|taught|threw|thought|wrote)\b/i.test(ll)) return true;
  // 7. Non-stative -ed verb: any -ed word that is NOT in the stative list
  // AND is not a common abstract adjective pattern
  const STATIVE_OR_ABSTRACT_ED = new Set([
    "focused", "motivated", "inspired", "excited", "tired", "worried",
    "scared", "bored", "stressed", "frustrated", "confused", "determined",
    "dedicated", "committed", "interested", "pleased", "surprised", "shocked",
    "amazed", "disappointed", "satisfied", "annoyed", "relaxed", "concerned",
    "involved", "attached", "related", "required", "needed", "expected",
    "supposed", "based", "used", "blessed", "gifted", "skilled", "talented",
    "valued", "named", "called", "considered", "regarded", "known",
    "designed", "intended", "allowed", "believed", "understood",
  ]);
  const edMatches = ll.match(/\b(\w+)ed\b/g) ?? [];
  for (const word of edMatches) {
    const stem = word.replace(/ed$/, "");
    if (!STATIVE_OR_ABSTRACT_ED.has(word) && stem.length >= 4) {
      return true;
    }
  }
  return false;
}

function isVeryGenericScript(script: string): {
  isGeneric: boolean;
  mainTopicWord: string;
} {
  const lines = script
    .split(/[\n.!?]/)
    .map(l => l.trim())
    .filter(l => l.split(/\s+/).filter(Boolean).length >= 3); // only real lines

  if (lines.length < 3) {
    return { isGeneric: false, mainTopicWord: "" };
  }

  // Use the hard anchor check — stricter than scoreLineSignals to prevent
  // false positives from stative adjectives or causal-sounding phrases.
  const anchorCount = lines.filter(lineHasHardAnchor).length;

  if (anchorCount > 0) {
    return { isGeneric: false, mainTopicWord: "" };
  }

  // No hard anchor found anywhere. Now confirm most lines are abstract.
  const scored = lines.map(scoreLineSignals);
  const abstractCount = scored.filter(s => s.isAbstract).length;
  const abstractRatio = abstractCount / lines.length;

  // Generic: no anchor material at all AND majority of lines are abstract claims.
  // We use 0.35 as the threshold (not 0.5) because lines that fall through
  // the abstract detector as "neither" (like "That is why X is possible") 
  // dilute the ratio — a script with all vague lines should still be caught.

  const isGeneric = lines.length >= 4 && abstractRatio >= 0.35;

  if (!isGeneric) {
    return { isGeneric: false, mainTopicWord: "" };
  }

  // Extract main topic word from the first line
  const firstLine = lines[0] ?? "";
  const firstWords = firstLine.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  const stopWords = new Set([
    "is", "are", "was", "the", "a", "an", "in", "on", "at", "of", "to",
    "and", "but", "or", "for", "with", "this", "that", "very", "so",
    "it", "its", "i", "we", "you", "they", "why", "how", "what", "when",
  ]);
  const mainTopicWord =
    firstWords.find(w => !stopWords.has(w) && w.length >= 4) ??
    firstWords[1] ??
    firstWords[0] ??
    "";

  return { isGeneric: true, mainTopicWord };
}

function buildGenericScriptResponse(_script: string, _mainTopicWord: string): ImproveHookResult {
  // Return an honest structural diagnosis only.
  // Do NOT guess a topic from an unreliable first word.
  const improvedHook = GENERIC_DIAGNOSTIC_HOOK;

  const reason =
    "The script is too broad to create a strong grounded hook. Every line states a general idea — there is no specific number, named reference, concrete result, or story moment to anchor the opening. Add one specific detail first: a result someone achieved, a named example, a measurable outcome, or a story beat. Once the script has that, the hook can be rewritten around it.";

  return {
    status: "improved",
    improvedHook,
    reason,
    mode: "diagnostic",
  };
}

function extractAnchorFromScript(script: string): { type: string; value: string } | null {
  const lines = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean);
  const bodyLines = lines.slice(1);
  const bodyText = bodyLines.join(" ");

  // Priority 1: specific number with unit (always wins)
  const numberMatch = bodyText.match(
    /(\b(?:over|about|nearly|around|roughly|just|almost)?\s*\d[\d,]*(?:\.\d+)?\s*(?:miles per hour|km\/h|kilometers per hour|feet|foot|meters|kilograms|pounds|percent|%|seconds|minutes|hours|days|weeks|years|degrees|times|billion|million|thousand|mph|kph))\b/i
  );
  if (numberMatch) {
    return { type: "exactNumberWithUnit", value: numberMatch[0].trim() };
  }

  // Priority 2: concrete visual detail — structural detection, not topic-specific phrases.
  // Tier A: physical object in observable state (universal — any niche)
  // Detects: "X still on the Y", "X untouched", "X left behind"
  const visualTierAPatterns = [
    /\bstill (on|in|at|by|over|under|sitting|lying|standing|hanging)\b/i,
    /\buntouched\b/i,
    /\bleft behind\b/i,
  ];
  // Tier B: absence of people / discovery (universal)
  const visualTierBPatterns = [
    /\b(nobody|no one|not a single person|every person) (was|had|were|on)/i,
    /\b(everyone|everybody) (had disappeared|disappeared|was gone|had left)\b/i,
    /\bno signs of (life|struggle|damage|a fight|a storm|injury)\b/i,
  ];
  // Tier C: disappearance / discovery words (universal — weakest)
  const visualTierCPatterns = [
    /\b(disappeared|vanished|abandoned|found drifting|discovered empty)\b/i,
  ];

  for (const patterns of [visualTierAPatterns, visualTierBPatterns, visualTierCPatterns]) {
    for (const line of bodyLines) {
      if (patterns.some(p => p.test(line))) {
        return { type: "concreteVisualDetail", value: line.replace(/[.!?]+$/, "").trim() };
      }
    }
  }

  return null;
}

function hookContainsAnchor(hook: string, anchor: { type: string; value: string }): boolean {
  const hookLower = hook.toLowerCase();
  if (anchor.type === "exactNumberWithUnit") {
    const numericPart = anchor.value.match(/\d[\d,]*(?:\.\d+)?/)?.[0];
    return numericPart ? hookLower.includes(numericPart) : false;
  }
  if (anchor.type === "concreteVisualDetail") {
    const anchorWords = anchor.value.toLowerCase().split(/\s+/).filter(Boolean);
    for (let i = 0; i <= anchorWords.length - 3; i++) {
      const phrase = anchorWords.slice(i, i + 3).join(" ");
      if (hookLower.includes(phrase)) return true;
    }
    return false;
  }
  return true;
}

// Returns true if the hook distorts the meaning of the anchor source line.
// Universal: detects subject-verb relationship inversion, not topic-specific logic.
// Example: anchor says "X would still have Y above it" but hook says "drop X in, it vanishes"
// — the spatial relationship is inverted. This is a factual distortion regardless of topic.
function hookDistortsAnchor(hook: string, script: string, anchor: { type: string; value: string } | null): boolean {
  if (!anchor) return false;
  if (anchor.type !== "exactNumberWithUnit" && anchor.type !== "concreteVisualDetail") return false;

  const hookLower = hook.toLowerCase();
  const lines = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean);
  const bodyLines = lines.slice(1);

  // Find the source line for the anchor
  const sourceLine = bodyLines.find(l => {
    const ll = l.toLowerCase();
    const numericPart = anchor.value.match(/\d[\d,]*(?:\.\d+)?/)?.[0];
    return numericPart ? ll.includes(numericPart) : ll.includes(anchor.value.toLowerCase().slice(0, 12));
  }) ?? "";
  const sourceLower = sourceLine.toLowerCase();

  if (!sourceLower) return false;

  // Detect "still above / still have above" in source but "vanish / disappear / sink" in hook
  // This catches spatial relationship inversion universally: any source that says something
  // "would still be above / remain above / have X above it" should not become "it vanishes".
  const sourceImpliesPresence =
    /\bstill (have|be|remain|sit|stand|rise|extend|project|reach|tower|float|hover)\b/.test(sourceLower) ||
    /\babove (it|them|the|a)\b/.test(sourceLower) ||
    /\bremains? above\b/.test(sourceLower);

  const hookImpliesAbsence =
    /\b(vanish|disappear|sink|be gone|be submerged|be swallowed|be buried|be lost|be hidden|be covered)\b/.test(hookLower);

  if (sourceImpliesPresence && hookImpliesAbsence) return true;

  // Detect direction reversal: source says "X above Y" but hook says "drop X into Y"
  // Universal: "drop [subject] into" reverses the spatial frame of "X above Y".
  const sourceHasAbove = /\babove\b/.test(sourceLower);
  const hookHasDrop = /\bdrop .{2,30} (in|into)\b/.test(hookLower);
  if (sourceHasAbove && hookHasDrop) return true;

  return false;
}

function buildFallbackHookFromScript(script: string): string {
  const lines = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] ?? "";
  const bodyLines = lines.slice(1);

// Guard: if no concrete material exists, return diagnostic guidance.
  const hasAnyConcrete = lines.some(line => lineHasHardAnchor(line));

  if (!hasAnyConcrete && lines.length >= 3) {
    return GENERIC_DIAGNOSTIC_HOOK;
  }

  // ── Scenario opener + final payoff combination ──────────────────────────
  // For "Imagine X / What if X" scripts, combine the opening premise with the final payoff.
  const firstLineLower = firstLine.toLowerCase();
  const isScenarioOpener =
    /^(imagine|what if|picture this)\b/i.test(firstLineLower);
  if (isScenarioOpener && bodyLines.length >= 3) {
    const finalPayoffLine = bodyLines[bodyLines.length - 1] ?? "";
    const candidatePayoff = finalPayoffLine.trim();
    const candidateWc = candidatePayoff.split(/\s+/).length;
    const payoffLower = candidatePayoff.toLowerCase();
    const isStrongFinalLine =
      candidateWc >= 4 && candidateWc <= 14 &&
      !payoffLower.startsWith("but") &&
      (
        /\b(never|always|still|even|only|just|yet)\b/i.test(candidatePayoff) ||
        /\b(has|have|is|are) (a|an|the)?\s*\w+/i.test(candidatePayoff) ||
        candidateWc <= 8
      );
    if (isStrongFinalLine) {
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

  const numberLine = bodyLines.find(line =>
    /\d[\d,]*(?:\.\d+)?/.test(line) &&
    /\b(miles per hour|mph|kph|km\/h|feet|foot|meters|percent|%|seconds|minutes|hours|days|years|degrees|times|million|billion|thousand)\b/i.test(line)
  );

  if (numberLine) {
    const cleaned = numberLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);
    return words.length <= 18
      ? `${capitalizeFirstChar(cleaned)}.`
      : `${capitalizeFirstChar(words.slice(0, 14).join(" "))}.`;
  }

  const consequenceLine = bodyLines.slice(Math.floor(bodyLines.length * 0.5)).find(line => {
    const ll = line.toLowerCase();
    return (
      /that is why|that is what|as a result|the result/.test(ll) ||
      /keeps (going|moving|building|growing|compounding)/.test(ll) ||
      /you do not control|you lose control|become permanent/.test(ll) ||
      /says about you|how people see|proof that/.test(ll) ||
      /the (real|actual|true) (reason|problem|point)/.test(ll) ||
      /the (scary|strange|crazy|surprising) part/.test(ll)
    );
  });

  if (consequenceLine) {
    const cleaned = consequenceLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);
    return words.length <= 18
      ? `${capitalizeFirstChar(cleaned)}.`
      : `${capitalizeFirstChar(words.slice(0, 14).join(" "))}.`;
  }

  const visualLine = bodyLines.find(line => {
    const ll = line.toLowerCase();
    return (
      /\bstill\b/.test(ll) ||
      /\bleft behind\b|\buntouched\b|\bno signs of\b/.test(ll) ||
      /\bdisappeared\b|\bvanished\b|\bfound\b|\bdiscovered\b/.test(ll) ||
      /\bnobody\b|\bno one\b|\bevery person\b/.test(ll)
    );
  });

  if (visualLine) {
    const cleaned = visualLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);
    return words.length <= 18
      ? `${capitalizeFirstChar(cleaned)}.`
      : `${capitalizeFirstChar(words.slice(0, 14).join(" "))}.`;
  }

  const reversalLine = bodyLines.find(line => {
    const ll = line.toLowerCase();
    return (
      (ll.includes(" not ") || ll.startsWith("not ")) &&
      (ll.includes("just") || ll.includes("about") || ll.includes("only") || ll.includes("real") || ll.includes("reason"))
    );
  });

  if (reversalLine) {
    const cleaned = reversalLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);
    return words.length <= 18
      ? `${capitalizeFirstChar(cleaned)}.`
      : `${capitalizeFirstChar(words.slice(0, 14).join(" "))}.`;
  }

  const bodyAnchor = bodyLines.find(line => {
    const words = line.split(/\s+/);
    return words.length >= 5 && words.length <= 18;
  });

  if (bodyAnchor) {
    const cleaned = bodyAnchor.replace(/[.!?]+$/, "").trim();
    return `${capitalizeFirstChar(cleaned)} — and most people never realise it.`;
  }

  const shortSubject = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 8).join(" ");
  return `${capitalizeFirstChar(shortSubject)} — but not for the reason most people think.`;
}

function parseHookResponse(raw: string, script: string): ImproveHookResult {
  const firstLine = script.split(/[\n.!?]/)[0]?.trim() ?? script.trim();

  // Pre-extract anchor from the script so we can validate the AI's choice
  const scriptAnchor = extractAnchorFromScript(script);

  try {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsedValue: unknown = JSON.parse(cleaned);

    if (
      typeof parsedValue !== "object" ||
      parsedValue === null ||
      Array.isArray(parsedValue)
    ) {
      throw new UnusableAIResponseError();
    }

    const parsed = parsedValue as Record<string, unknown>;
    const hasImprovedHook =
      typeof parsed.improvedHook === "string" &&
      parsed.improvedHook.trim().length > 0;
    const hasHookOption =
      Array.isArray(parsed.hookOptions) &&
      parsed.hookOptions.some(
        option =>
          typeof option === "object" &&
          option !== null &&
          typeof (option as Record<string, unknown>).text === "string" &&
          ((option as Record<string, unknown>).text as string).trim().length > 0
      );
    const hookScore =
      typeof parsed.hookScore === "number" ? parsed.hookScore : null;
    const hasStrongScore = hookScore !== null && hookScore >= 80;

    if (!hasImprovedHook && !hasHookOption && !hasStrongScore) {
      throw new UnusableAIResponseError();
    }

    const aiSaysGood = hookScore !== null && hookScore >= 80;
    if (aiSaysGood) {
      // Even if AI says "good", verify the anchor is actually in the hook
      const anchorMissed = scriptAnchor && !hookContainsAnchor(firstLine, scriptAnchor);

      // A "good" status is invalid if the reason itself describes the hook
      // as deficient (this catches AI self-contradictions like the
      // status:"good" + "fails to include..." bug from Test 4).
      const rawReasonForGoodCheck =
        typeof parsed.reason === "string" ? parsed.reason.toLowerCase() : "";
      const WEAKNESS_PHRASES = [
        "fails to", "does not", "doesn't", "lacks", "missing", "misses",
        "should include", "could be stronger", "needs", "fails to include",
      ];
      const reasonIndicatesWeakness = WEAKNESS_PHRASES.some(p =>
        rawReasonForGoodCheck.includes(p)
      );

      if (!anchorMissed && !reasonIndicatesWeakness) {
        const reason =
          typeof parsed.reason === "string" && parsed.reason.trim().length > 0
            ? parsed.reason.trim()
            : "The opening already creates a strong reason to keep watching.";
        return { status: "good", improvedHook: firstLine, reason, mode: "rewrite" };
      }
      // Anchor was missed, OR the AI's own reason contradicts "good" —
      // fall through to the normal rewrite/validation/fallback pipeline below.
    }

    let improvedHook =
      typeof parsed.improvedHook === "string" && parsed.improvedHook.trim().length > 0
        ? parsed.improvedHook.trim()
        : "";

    // ── Validation layer ──────────────────────────────────────────────────
        const basicValidationFails =
      improvedHook.length === 0 ||
           isBannedOpener(improvedHook) ||
            isExplanatorySummaryHook(improvedHook) ||
      isUnclearStandaloneHook(improvedHook) ||
           isWeakBeliefContrastHook(improvedHook) ||
      isConclusionHook(improvedHook) ||
      isTooSimilar(improvedHook, firstLine) ||
      !isHookQualityAcceptable(improvedHook) ||
      endsWithIncompletePhrase(improvedHook);

    // Anchor validation — did the hook use the strongest material without distorting it?
    const anchorValidationFails =
      (scriptAnchor !== null && !hookContainsAnchor(improvedHook, scriptAnchor)) ||
      hookDistortsAnchor(improvedHook, script, scriptAnchor);

    if (basicValidationFails || anchorValidationFails) {
      // Try hookOptions before giving up on AI
      const options = Array.isArray(parsed.hookOptions) ? parsed.hookOptions : [];

      for (const opt of options) {
        if (
          typeof opt === "object" && opt !== null &&
          typeof (opt as Record<string, unknown>).text === "string"
        ) {
          const candidate = ((opt as Record<string, unknown>).text as string).trim();
          const candidateAnchorValid = !scriptAnchor || hookContainsAnchor(candidate, scriptAnchor);
          const candidateDistorts = hookDistortsAnchor(candidate, script, scriptAnchor);

          if (
            candidate.length > 0 &&
                                    !isBannedOpener(candidate) &&
                        !isExplanatorySummaryHook(candidate) &&
            !isUnclearStandaloneHook(candidate) &&
                        !isWeakBeliefContrastHook(candidate) &&
            !isConclusionHook(candidate) &&
            !isTooSimilar(candidate, firstLine) &&
            isHookQualityAcceptable(candidate) &&
            !endsWithIncompletePhrase(candidate) &&
            candidateAnchorValid &&
            !candidateDistorts
          ) {
            improvedHook = candidate;
            break;
          }
        }
      }
    }

    // If still failing, build a deterministic hook from the anchor
        if (
      improvedHook.length === 0 ||
            isBannedOpener(improvedHook) ||
            isExplanatorySummaryHook(improvedHook) ||
      isUnclearStandaloneHook(improvedHook) ||
            isWeakBeliefContrastHook(improvedHook) ||
      isConclusionHook(improvedHook) ||
      isTooSimilar(improvedHook, firstLine) ||
      !isHookQualityAcceptable(improvedHook) ||
      endsWithIncompletePhrase(improvedHook) ||
      (scriptAnchor !== null && !hookContainsAnchor(improvedHook, scriptAnchor))
    ) {
      improvedHook = buildAnchorHook(script, scriptAnchor) ?? buildFallbackHookFromScript(script);
    }

    const rawReason = typeof parsed.reason === "string" ? parsed.reason.trim() : "";
    const rawReasonLower = rawReason.toLowerCase();

    // Detect AI praise phrases that contradict a weak hook score.
    // If the AI says the original is "already compelling/effective/engaging"
    // but the script's hook has no concrete anchor or strong signal, reject it.
    const isPraisingOriginal =
      rawReasonLower.includes("already compelling") ||
      rawReasonLower.includes("already effective") ||
      rawReasonLower.includes("already engaging") ||
      rawReasonLower.includes("already strong") ||
      rawReasonLower.includes("effective from the start") ||
      rawReasonLower.includes("engaging from the start") ||
      rawReasonLower.includes("compelling from the start") ||
      (rawReasonLower.includes("already includes") && rawReasonLower.includes("anchor")) ||
      (rawReasonLower.includes("original hook") && rawReasonLower.includes("compelling"));

    // Only suppress praise if the script's first line has no hard anchor —
    // meaning it genuinely is a weak hook that shouldn't be praised.
    const firstLineHasConcrete = lineHasHardAnchor(firstLine);
    const shouldSuppressPraise = isPraisingOriginal && !firstLineHasConcrete;

    const isGenericReason =
      rawReason.length === 0 ||
      rawReason === "The hook was adjusted to improve clarity, curiosity, or payoff connection." ||
      (rawReasonLower.includes("creates curiosity") && rawReason.length < 80) ||
      rawReasonLower.startsWith("this hook is stronger because it starts with") ||
      shouldSuppressPraise;

    const reason = isGenericReason
      ? buildSpecificReason(firstLine, improvedHook, script)
      : rawReason;

    // Final guard: if the script has no hard anchor material, the modal must
    // return diagnostic guidance — not a rearrangement of generic lines.
    // Uses lineHasHardAnchor (stricter than scoreLineSignals).
    const allScriptLines = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean);
    const scriptHasConcrete = allScriptLines.some(line => lineHasHardAnchor(line));

    // Secondary check: if the improved hook itself contains no hard anchor,
    // and the script has no concrete material, it is a generic rearrangement.
    // e.g. "Success is possible for anyone — if you stay focused and never give up"
    // passes quality signals but is still hollow. Reject it.
    const hookHasConcrete = lineHasHardAnchor(improvedHook);

    if (!scriptHasConcrete || (!hookHasConcrete && !scriptHasConcrete)) {
      if (allScriptLines.length >= 3) {
        const diagnosticHook = GENERIC_DIAGNOSTIC_HOOK;
        const diagnosticReason = "The script is too abstract to rewrite into a stronger hook without inventing unsupported ideas. Add one concrete example, result, consequence, number, or real situation first.";
        return { status: "improved", improvedHook: diagnosticHook, reason: diagnosticReason, mode: "diagnostic" };
      }
    }

    // Final universal safety net: if the entire script has no hard-anchor line
    // anywhere, never let a non-diagnostic hook through, regardless of how it
    // was produced (AI, hookOptions, or anchor-builder fallback).
    const finalScriptHasConcrete = allScriptLines.some(line => lineHasHardAnchor(line));
    if (!finalScriptHasConcrete) {
      return {
        status: "improved",
        improvedHook: GENERIC_DIAGNOSTIC_HOOK,
        reason: "The script is too abstract to rewrite into a stronger hook without inventing unsupported ideas. Add one concrete example, result, consequence, number, or real situation first.",
        mode: "diagnostic",
      };
    }

        const finalHookIsInvalid =
      isBannedOpener(improvedHook) ||
      isExplanatorySummaryHook(improvedHook) ||
      isUnclearStandaloneHook(improvedHook) ||
      isWeakBeliefContrastHook(improvedHook) ||
      isConclusionHook(improvedHook) ||
      endsWithIncompletePhrase(improvedHook);

    if (finalHookIsInvalid) {
      const safeHook = buildClearStandaloneFallbackHook(script);
      return {
        status: "improved",
        improvedHook: safeHook,
        reason: buildSpecificReason(firstLine, safeHook, script),
        mode: "rewrite",
      };
    }

    return { status: "improved", improvedHook, reason, mode: "rewrite" };
  } catch (error) {
    console.error("[improve] response parse failed.");

    if (error instanceof UnusableAIResponseError) {
      throw error;
    }

    throw new UnusableAIResponseError();
  }
}
