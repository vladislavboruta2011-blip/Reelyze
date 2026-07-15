import OpenAI from "openai";
import {
  UnusableAIResponseError,
  boundGeneratedResult,
  buildEarlyDiagnosticResponse,
  buildGenericScriptResponse,
  buildUnsupportedTitleClaimResponse,
  hasAnyConcreteAnchor,
  isVeryGenericScript,
  parseHookResponse,
  type ImproveHookLocale,
  type ImproveHookResult,
} from "../../../engine/improve-hook";
import {
  delay,
  getUpstreamErrorStatus,
  isRetryableAIResponseError,
} from "../../../lib/ai-transient-retry";
import { logAIRouteFailure } from "../../../lib/ai-route-log";
import { normalizeApiLocale } from "../../../lib/i18n";

export type {
  ImproveHookResult,
} from "../../../engine/improve-hook";

const MAX_REQUEST_BODY_BYTES = 16_384;
const AI_RATE_LIMIT_MAX_REQUESTS = 10;
const AI_RATE_LIMIT_WINDOW_MS = 60_000;
const AI_RATE_LIMIT_MAX_ENTRIES = 10_000;
const IMPROVE_TRANSIENT_RETRY_DELAY_MS = 250;

// Diagnostic-only headers: never read by parsing, retry, or caching logic —
// a rejected/failed response must never be cached.
export const IMPROVE_REQUEST_ID_HEADER = "X-Improve-Request-Id";
export const IMPROVE_RETRY_COUNT_HEADER =
  "X-Improve-Retry-Count";

function buildImproveResponseHeaders(
  requestId: string,
  status: number,
  retryCount = 0
): Record<string, string> {
  const headers: Record<string, string> = {
    [IMPROVE_REQUEST_ID_HEADER]: requestId,
    [IMPROVE_RETRY_COUNT_HEADER]: String(retryCount),
  };

  if (status < 200 || status >= 300) {
    headers["Cache-Control"] = "no-store";
  }

  return headers;
}

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

const IMPROVE_LANGUAGE_NAMES: Record<ImproveHookLocale, string> = {
  en: "English",
  ru: "Russian",
};

// Additive, self-contained block — must never alter the hook-quality rules
// above it. It only controls which language the explanatory prose fields
// are written in.
function buildImproveLanguageInstructions(
  locale: ImproveHookLocale
): string {
  const languageName = IMPROVE_LANGUAGE_NAMES[locale];

  return `

LANGUAGE
Write "diagnosis", "reason", and every "hookOptions[].whyItWorks" in ${languageName}.
Keep "improvedHook", "originalHook", "hookOptions[].text", every JSON key, and "hookLabel" exactly as this prompt specifies — never translate the script itself or any hook option. improvedHook, originalHook, and hookOptions[].text must stay in the script's original language regardless of the explanation language.
Do not translate names of real people, brands, products, or teams that appear in the script.
Choosing ${languageName} for the explanation must not change hookScore, hookLabel, primaryWeakness, anchorMaterial, or which hook is chosen — only the language of the prose explanation.`;
}

export async function POST(req: Request): Promise<Response> {
  // Diagnostic-only correlation id for this request — never used for
  // scoring, editorial decisions, caching keys, or rate limiting.
  const requestId = crypto.randomUUID();

  function respond(
    resultBody: unknown,
    status: number,
    retryCount = 0,
    extraHeaders?: Record<string, string>
  ): Response {
    return Response.json(resultBody, {
      status,
      headers: {
        ...buildImproveResponseHeaders(
          requestId,
          status,
          retryCount
        ),
        ...extraHeaders,
      },
    });
  }

  const contentType =
    req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";

  if (contentType != "application/json") {
    return respond(
      {
        status: "error",
        improvedHook: "AI hook improvement is unavailable right now.",
        reason: "Unsupported Content-Type. Use application/json.",
      } satisfies ImproveHookResult,
      415
    );
  }

  let body: unknown;

  try {
    body = await readJsonBodyWithLimit(req);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return respond(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Request body is too large.",
        } satisfies ImproveHookResult,
        413
      );
    }

    return respond(
      {
        status: "error",
        improvedHook: "AI hook improvement is unavailable right now.",
        reason: "Invalid JSON request body.",
      } satisfies ImproveHookResult,
      400
    );
  }

  // Set to 1 immediately before the single bounded retry attempt below, so
  // the catch block can report the real count instead of inferring it from
  // the error category.
  let retryCount = 0;

  try {
    if (
      !body ||
      typeof body !== "object" ||
      !("script" in body) ||
      typeof (body as Record<string, unknown>).script !== "string"
    ) {
      return respond(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "No script was provided.",
        } satisfies ImproveHookResult,
        400
      );
    }

    const requestBody = body as Record<string, unknown>;

    if ("title" in requestBody && typeof requestBody.title !== "string") {
      return respond(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Title must be a string.",
        } satisfies ImproveHookResult,
        400
      );
    }

    const script = (requestBody.script as string).trim();
    const title =
      typeof requestBody.title === "string" ? requestBody.title.trim() : "";
    // normalizeApiLocale's default availableLocales is LAUNCHED_LOCALES
    // ("en" | "ru"), so this is always one of ImproveHookLocale's two values.
    const locale = normalizeApiLocale(
      requestBody.locale
    ) as ImproveHookLocale;

    if (script.length === 0) {
      return respond(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "A non-empty script must be provided.",
        } satisfies ImproveHookResult,
        400
      );
    }

    if (script.length > 1000) {
      return respond(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Script is too long. Keep it to 1,000 characters or less.",
        } satisfies ImproveHookResult,
        400
      );
    }

    if (title.length > 200) {
      return respond(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Title is too long. Keep it to 200 characters or less.",
        } satisfies ImproveHookResult,
        400
      );
    }

    const unsupportedTitleClaimResponse =
      buildUnsupportedTitleClaimResponse(
        title,
        script,
        locale
      );

    if (unsupportedTitleClaimResponse) {
      return respond(unsupportedTitleClaimResponse, 200);
    }

    // ── ABSOLUTE EARLY GUARD — must run before any AI call ──────────────────
    const earlyNoAnchorGuard = !hasAnyConcreteAnchor(script);
    if (earlyNoAnchorGuard) {
      return respond(buildEarlyDiagnosticResponse(locale), 200);
    }

    const systemPrompt = `You are a YouTube Shorts hook strategist and retention editor.

FIRST STEP — EDITORIAL DIAGNOSIS (mandatory before writing anything):
Review the title, the original opening, and the full script before choosing a result.

Decide whether the best editorial action is:
1. preserve the original because it already works or no candidate adds enough supported value;
2. perform a meaningful rewrite that fixes a real opening weakness;
3. avoid inventing a stronger promise when the source material does not support one.

A rewrite is successful only when it creates a materially better opening experience through an observable editorial operation, such as:
- removing generic delay before the topic;
- naming an unclear subject;
- resolving an ambiguous reference;
- introducing a supported mechanism, consequence, contrast, or visual earlier;
- improving title–hook–payoff alignment;
- clarifying the opening without changing its supported meaning.

Identify the supported material most relevant to that decision. Return the primary supporting material in "anchorMaterial" for traceability, but do not treat anchor types as a fixed hierarchy.

A number, question, mechanism, consequence, contradiction, visual detail, named reference, or payoff is only one possible signal. None automatically becomes the best hook angle merely because it exists.

Choose material according to how much it contributes to:
- immediate topic clarity;
- title confirmation;
- relevant curiosity;
- payoff alignment;
- viewer value in the opening seconds.

When using a number, measurement, name, claim, or qualifier, preserve it exactly. Never invent, replace, exaggerate, or strengthen unsupported facts.

CRITICAL FACT PRESERVATION RULE: Do not exaggerate the factual scope of the script.
- If the script says "today", the hook must say "today" — never "ever" or "always"
- If the script says "could", the hook must not say "will"
- If the script says "one moment", the hook must not say "everything forever"
- A stronger hook means more specific — not more exaggerated

HOOK GENERATION RULES:
- Under 22 words. Natural. Easy to say in one breath.
- The final rewrite and each hook option may use different supported strategies. Do not force every option to repeat the same number, phrase, or anchorMaterial.
- Do not present synonym swaps, decorative adjectives, reordered wording, or a different sentence form as improvement unless they perform an observable editorial operation.
- Prefer the script's own concrete mechanism, action, or cause-and-effect detail (e.g. "removing choices", "your phone next to you", "junk food in your room") over generic topic restatements (e.g. "X is crucial for success", "X is important"). If the script names a specific mechanism for WHY something works, that mechanism — not a generic adjective — should anchor the hook.
- When using a physical comparison as the anchor, write it as a clear visual fact, not as an awkward or confusing action. Prefer natural phrasing like "even Mount Everest would sit more than a mile underwater" over "drop Mount Everest into its depths." If the script already contains a clean comparison, reflect that comparison clearly — do not invent a physical action that was not in the script.
- The improved hook must sound like a polished YouTube Shorts opening that is easy to say out loud in one breath. It should not read like a literal rearrangement of script sentences. If the anchor is a comparison, state the comparison in a single clear, visual, natural sentence.
- Use the supported material that best enables the chosen editorial operation. The improvedHook does not need to include every concrete detail or a particular number when another supported angle creates a materially better opening experience.
- Never start with "What if" unless the script is genuinely hypothetical and a question is clearly stronger than a statement for this specific content.
- Never use: "shocking", "insane", "crazy", "think again", "changes everything", "you won't believe", "the secret to".
- Do not invent facts not in the script. Do not change who does what, what the scope is, or what the time range is.
- If the original already works and no candidate creates enough supported editorial value, return the original.
- NEVER convert "Imagine X" into "What if X".
- Judge similarity by editorial function, not by a fixed word-overlap percentage. High lexical overlap can be valid when it resolves ambiguity or another specific defect; low overlap can still be cosmetic.
- Do not replace an effective opening unless the candidate performs a clear supported editorial operation that materially improves the viewer experience.
- Prefer a concrete statement hook over a question hook when the consequence is clearer than the mystery.
- For YouTube Shorts, the improvedHook should usually be one short, punchy sentence under 14 words when possible. It should feel like the first line of a 20-30 second Short, not the intro to a long-form video. Prefer the strongest consequence, contradiction, number, visual, or payoff over explanatory setup. Avoid slow phrases like "Most people think..." unless that contrast is truly the strongest possible opening.
- If the script contains a stronger final payoff line, consider moving that payoff to the beginning as the improved hook.
- For weak hooks, prefer a punchy 5-10 word opening when possible. Avoid double-clause explanatory hooks structured as "X does not start when Y -- it starts when Z" or "X is not about Y -- it is about Z" unless that exact contrast is clearly the strongest possible phrasing. A Shorts hook should feel like a fast first-second statement, not a complete explanation. Prefer direct consequence hooks, threat hooks, contradiction hooks, or payoff-first hooks over setup-plus-reveal sentences.
- Keep the supported material needed for the chosen operation, but do not force a number, object, or detail that is secondary to a clearer mechanism, consequence, reference clarification, or title-alignment fix.
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
"Most people think stopping Earth is the worst part." (replaces a specific supported scenario with a generic belief contrast)
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
    "type": "exactNumberWithUnit" | "concreteVisualDetail" | "consequence" | "contradiction" | "statusIdentityDetail" | "finalPayoff" | "mechanism" | "namedReference" | "question",
    "value": "<the exact supported text selected from the title, original opening, or script — copy it verbatim>",
    "sourceLine": "<the exact title text or source sentence it came from>"
  },
  "primaryWeakness": "<one of: filler-intro | obvious-statement | too-generic | no-curiosity-gap | no-contradiction | no-stakes | answer-given-too-early | weak-payoff-alignment | already-strong>",
  "rewriteStrategy": "<strategy used>",
  "originalHook": "<first line of the script>",
  "diagnosis": "<one sentence: what the hook fails to do, or confirm it already works>",
  "improvedHook": "<the single best rewrite, or the original if already strong>",
  "reason": "<specific explanation tied to THIS script — identify the original weakness or strength, the supported material, the observable editorial operation, and why the result improves or preserves the viewer experience>",
  "hookOptions": [
    { "type": "<strategy>", "text": "<hook>", "whyItWorks": "<one sentence specific to this script>" },
    { "type": "<strategy>", "text": "<hook>", "whyItWorks": "<one sentence specific to this script>" },
    { "type": "<strategy>", "text": "<hook>", "whyItWorks": "<one sentence specific to this script>" }
  ]
}

NEVER use the double-quote character inside any JSON string value. Rephrase to avoid it.
${buildImproveLanguageInstructions(locale)}`;

    const userPrompt = `Analyze this YouTube Shorts script and improve the hook.
${title ? `\nVideo title / topic: "${title}"\n` : ""}
Script:
${script}

Step 1 — EDITORIAL DIAGNOSIS:
Read the title, original opening, and full script. Identify the opening's real strength or weakness.

Decide whether the best action is to:
- preserve the original because it already works or no alternative adds enough supported value;
- rewrite it through a specific observable editorial operation;
- avoid manufacturing a stronger promise when the source material is insufficient.

Step 2 — SELECT SUPPORTING MATERIAL:
Choose the supported material that contributes most to the chosen decision. There is no fixed priority order.

A number, question, mechanism, consequence, contradiction, visual detail, named reference, or payoff does not automatically win merely because it exists.

Record the primary supporting material in anchorMaterial for traceability. This field describes the evidence behind the decision; it does not force every candidate to use the same wording or angle.

Step 3 — GENERATE 3 SUPPORTED OPTIONS:
Create three genuinely useful options when a rewrite is justified.

The options may use different supported strategies, such as:
- clarifying the subject or reference;
- leading with a mechanism, consequence, contradiction, visual, or relevant number;
- improving title–hook–payoff alignment;
- preserving the original when an alternative adds no meaningful editorial value.

Do not create superficial variety through synonym swaps, decorative wording, or unsupported claims.

Step 4 — CHOOSE THE BEST RESULT:
Select the option that creates the strongest materially better opening experience using only supported material.

If no candidate performs a meaningful editorial operation, return the original opening instead of forcing a rewrite.

Step 5 — WRITE A TRUTHFUL REASON:
State:
- the original opening's real weakness or existing strength;
- the supported material relevant to the decision;
- the observable editorial operation performed, or why preservation is better;
- how that decision changes or protects the viewer experience.

Do not claim that a question, subject, detail, movement, or structure was added when it was already present.

Return only valid JSON matching the exact schema.`;

    // ── Generic script guard ───────────────────────────────────────────────
    const { isGeneric } = isVeryGenericScript(script);
    if (isGeneric) {
      return respond(buildGenericScriptResponse(locale), 200);
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return respond(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "AI hook improvement is temporarily unavailable.",
        } satisfies ImproveHookResult,
        503
      );
    }

    const rateLimit = consumeAIRateLimit(getClientIdentifier(req));

    if (!rateLimit.allowed) {
      return respond(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Too many hook improvement requests. Please try again later.",
        } satisfies ImproveHookResult,
        429,
        0,
        { "Retry-After": String(rateLimit.retryAfterSeconds) }
      );
    }

    const openai = new OpenAI({
      apiKey,
      timeout: 15_000,
      maxRetries: 0,
    });

    async function callModelOnce(): Promise<ImproveHookResult> {
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

      return parseHookResponse(raw, script, locale);
    }

    // Exactly one bounded retry, sequential, for either a transient
    // upstream failure or a genuinely malformed/schema-invalid model
    // response (UnusableAIResponseError).
    let result: ImproveHookResult;

    try {
      result = await callModelOnce();
    } catch (error) {
      if (!isRetryableAIResponseError(error)) {
        throw error;
      }

      await delay(IMPROVE_TRANSIENT_RETRY_DELAY_MS);
      retryCount = 1;
      result = await callModelOnce();
    }

    return respond(boundGeneratedResult(result), 200, retryCount);
  } catch (error) {
    const upstreamStatus = getUpstreamErrorStatus(error);
    const failureLocale =
      typeof body === "object" &&
      body !== null &&
      "locale" in body
        ? String((body as Record<string, unknown>).locale)
        : "unknown";

    if (error instanceof UnusableAIResponseError) {
      logAIRouteFailure({
        requestId,
        endpoint: "/api/improve",
        locale: failureLocale,
        failureStage: "model-call-or-parse",
        errorCategory:
          "schema-invalid-or-malformed-model-response",
        upstreamStatus: upstreamStatus ?? null,
        retryCount,
        resultStatus: null,
      });

      return respond(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "Climpy could not generate a valid hook improvement right now.",
        } satisfies ImproveHookResult,
        502,
        retryCount
      );
    }

    if (upstreamStatus === 401 || upstreamStatus === 403) {
      logAIRouteFailure({
        requestId,
        endpoint: "/api/improve",
        locale: failureLocale,
        failureStage: "model-call",
        errorCategory: "upstream-auth-failure",
        upstreamStatus,
        retryCount,
        resultStatus: null,
      });

      return respond(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "AI hook improvement is temporarily unavailable.",
        } satisfies ImproveHookResult,
        503,
        retryCount
      );
    }

    if (
      upstreamStatus === 429 ||
      (upstreamStatus !== undefined && upstreamStatus >= 500) ||
      error instanceof OpenAI.APIConnectionError
    ) {
      logAIRouteFailure({
        requestId,
        endpoint: "/api/improve",
        locale: failureLocale,
        failureStage: "model-call",
        errorCategory: "transient-upstream-failure",
        upstreamStatus: upstreamStatus ?? null,
        retryCount,
        resultStatus: null,
      });

      return respond(
        {
          status: "error",
          improvedHook: "AI hook improvement is unavailable right now.",
          reason: "AI hook improvement is temporarily unavailable.",
        } satisfies ImproveHookResult,
        503,
        retryCount
      );
    }

    logAIRouteFailure({
      requestId,
      endpoint: "/api/improve",
      locale: failureLocale,
      failureStage: "model-call-or-parse",
      errorCategory: "internal-error",
      upstreamStatus: upstreamStatus ?? null,
      retryCount,
      resultStatus: null,
    });

    return respond(
      {
        status: "error",
        improvedHook: "AI hook improvement is unavailable right now.",
        reason: "Climpy could not generate a custom hook improvement for this script.",
      } satisfies ImproveHookResult,
      500,
      retryCount
    );
  }
}
