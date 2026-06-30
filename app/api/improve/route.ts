import OpenAI from "openai";
import {
  UnusableAIResponseError,
  boundGeneratedResult,
  buildEarlyDiagnosticResponse,
  buildGenericScriptResponse,
  hasAnyConcreteAnchor,
  isVeryGenericScript,
  parseHookResponse,
  type ImproveHookResult,
} from "../../../engine/improve-hook";

export type {
  ImproveHookResult,
} from "../../../engine/improve-hook";

const MAX_REQUEST_BODY_BYTES = 16_384;
const AI_RATE_LIMIT_MAX_REQUESTS = 10;
const AI_RATE_LIMIT_WINDOW_MS = 60_000;
const AI_RATE_LIMIT_MAX_ENTRIES = 10_000;

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

const aiRateLimitEntries = new Map<string, RateLimitEntry>();

class RequestBodyTooLargeError extends Error {}

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
      return Response.json(buildEarlyDiagnosticResponse());
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
    const { isGeneric } = isVeryGenericScript(script);
    if (isGeneric) {
      return Response.json(buildGenericScriptResponse());
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
