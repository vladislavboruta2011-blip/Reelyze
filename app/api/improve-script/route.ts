import OpenAI from "openai";

import type {
  AnalysisV2Locale,
  AnalysisV2Result,
} from "../../../engine/analysis-v2-schema";
import {
  validateAnalysisV2Result,
} from "../../../engine/analysis-v2-validation";
import {
  UnusableAIResponseError,
} from "../../../engine/improve-hook";
import {
  boundImproveScriptResult,
  buildImproveScriptDiagnosticResponse,
  buildImproveScriptPreserveResponse,
  parseImproveScriptResponse,
  shouldDiagnoseImproveScript,
  type ImproveScriptLocale,
  type ImproveScriptResult,
} from "../../../engine/improve-script";
import {
  delay,
  getUpstreamErrorStatus,
  isRetryableAIResponseError,
} from "../../../lib/ai-transient-retry";
import { logAIRouteFailure } from "../../../lib/ai-route-log";
import { normalizeApiLocale } from "../../../lib/i18n";

export type {
  ImproveScriptResult,
} from "../../../engine/improve-script";

const MAX_REQUEST_BODY_BYTES = 16_384;
const IMPROVE_SCRIPT_TRANSIENT_RETRY_DELAY_MS = 250;
const AI_RATE_LIMIT_MAX_REQUESTS = 10;
const AI_RATE_LIMIT_WINDOW_MS = 60_000;
const AI_RATE_LIMIT_MAX_ENTRIES = 10_000;

// Diagnostic-only headers: never read by parsing, retry, or caching logic —
// a rejected/failed response must never be cached.
export const IMPROVE_SCRIPT_REQUEST_ID_HEADER =
  "X-Improve-Script-Request-Id";
export const IMPROVE_SCRIPT_RETRY_COUNT_HEADER =
  "X-Improve-Script-Retry-Count";

function buildImproveScriptResponseHeaders(
  requestId: string,
  status: number,
  retryCount = 0
): Record<string, string> {
  const headers: Record<string, string> = {
    [IMPROVE_SCRIPT_REQUEST_ID_HEADER]: requestId,
    [IMPROVE_SCRIPT_RETRY_COUNT_HEADER]: String(retryCount),
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

function buildErrorResponse(reason: string): ImproveScriptResult {
  return {
    status: "error",
    improvedScript: "AI script improvement is unavailable right now.",
    changes: [],
    reason,
  };
}

function isAnalysisConfirmedComplete(
  analysisResult: AnalysisV2Result
): boolean {
  return (
    analysisResult.verdict === "strong" &&
    analysisResult.hookDecision === "keep" &&
    analysisResult.riskyParts.length === 0 &&
    analysisResult.suggestedFixes.every(
      (fix) => fix.optional
    )
  );
}

function hasValidatedActionableIssue(
  analysisResult: AnalysisV2Result
): boolean {
  // hookDecision only describes the opening specifically ("diagnostic"
  // means the hook itself lacks enough material for a confident rewrite —
  // see requiresGenericAdviceDiagnostic in analysis-v2-validation.ts). A
  // validated, grounded riskyPart with a non-optional fix can legitimately
  // target the body/clarity/payoff instead, independent of that hook
  // decision, so it must not be disqualified merely because the hook was
  // diagnosed as needing more material.
  return (
    analysisResult.riskyParts.length > 0 &&
    analysisResult.suggestedFixes.some(
      (fix) => !fix.optional
    )
  );
}

function buildValidatedAnalysisContext(
  analysisResult: AnalysisV2Result
): string {
  return JSON.stringify(
    {
      verdict: analysisResult.verdict,
      mainTakeaway: analysisResult.mainTakeaway,
      hookDecision: analysisResult.hookDecision,
      hookAssessment: analysisResult.hookAssessment,
      riskyParts: analysisResult.riskyParts,
      requiredSuggestedFixes:
        analysisResult.suggestedFixes.filter(
          (fix) => !fix.optional
        ),
      optionalSuggestedFixes:
        analysisResult.suggestedFixes.filter(
          (fix) => fix.optional
        ),
    },
    null,
    2
  );
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

const IMPROVE_SCRIPT_LANGUAGE_NAMES: Record<ImproveScriptLocale, string> = {
  en: "English",
  ru: "Russian",
};

// Additive, self-contained block — must never alter the editorial-decision
// or invention/causal-safety rules above it. It only controls which
// language the "changes" and "reason" explanation fields are written in.
function buildImproveScriptLanguageInstructions(
  locale: ImproveScriptLocale
): string {
  const languageName = IMPROVE_SCRIPT_LANGUAGE_NAMES[locale];

  return `

LANGUAGE
Write every "changes" item and the "reason" field in ${languageName}.
Keep "improvedScript" in the exact language of the Original script — never translate the script itself, regardless of the explanation language. If an Approved refined hook is provided, keep it in the script's language too.
Keep "editorialDecision.primaryProblemScope" and every other JSON key and enum value in English exactly as this prompt specifies.
"editorialDecision.primaryProblemEvidence" must remain an exact untranslated quote copied from the Original script.
Do not translate names of real people, brands, products, or teams that appear in the script.
Choosing ${languageName} for the explanation must not change editorialDecision.strategy, candidateAudit, or which script is returned — only the language of "changes" and "reason".`;
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
        ...buildImproveScriptResponseHeaders(
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

  if (contentType !== "application/json") {
    return respond(
      buildErrorResponse("Unsupported Content-Type. Use application/json."),
      415
    );
  }

  let body: unknown;

  try {
    body = await readJsonBodyWithLimit(req);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return respond(
        buildErrorResponse("Request body is too large."),
        413
      );
    }

    return respond(
      buildErrorResponse("Invalid JSON request body."),
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
        buildErrorResponse("No script was provided."),
        400
      );
    }

    const requestBody = body as Record<string, unknown>;

    if ("title" in requestBody && typeof requestBody.title !== "string") {
      return respond(
        buildErrorResponse("Title must be a string."),
        400
      );
    }

    if (
      "refinedHook" in requestBody &&
      typeof requestBody.refinedHook !== "string"
    ) {
      return respond(
        buildErrorResponse("Refined hook must be a string."),
        400
      );
    }

    const script = (requestBody.script as string).trim();
    const title =
      typeof requestBody.title === "string"
        ? requestBody.title.trim()
        : "";

    const refinedHook =
      typeof requestBody.refinedHook === "string"
        ? requestBody.refinedHook.trim()
        : "";
    const hasAnalysisResult =
      "analysisResult" in requestBody;
    // normalizeApiLocale's default availableLocales is LAUNCHED_LOCALES
    // ("en" | "ru"), so this is always one of ImproveScriptLocale's two values.
    const locale = normalizeApiLocale(
      requestBody.locale
    ) as ImproveScriptLocale;

    if (script.length === 0) {
      return respond(
        buildErrorResponse("A non-empty script must be provided."),
        400
      );
    }

    if (script.length > 1000) {
      return respond(
        buildErrorResponse(
          "Script is too long. Keep it to 1,000 characters or less."
        ),
        400
      );
    }

    if (title.length > 200) {
      return respond(
        buildErrorResponse(
          "Title is too long. Keep it to 200 characters or less."
        ),
        400
      );
    }

    if (refinedHook.length > 1000) {
      return respond(
        buildErrorResponse(
          "Refined hook is too long. Keep it to 1,000 characters or less."
        ),
        400
      );
    }

    let analysisResult: AnalysisV2Result | null = null;

    if (hasAnalysisResult) {
      // The request's own locale, not the validator's "en" default — the
      // submitted analysisResult was produced (and already validated) for
      // this locale, and several validation rules are locale-gated (e.g.
      // the below-80 mainTakeaway check), so re-validating a genuine ru
      // result under "en" would reject it outright.
      const validation = validateAnalysisV2Result(
        requestBody.analysisResult,
        script,
        locale as AnalysisV2Locale
      );

      if (!validation.ok) {
        return respond(
          buildErrorResponse(
            "Analysis result is invalid or does not match the submitted script."
          ),
          400
        );
      }

      analysisResult = validation.value;
    }

    if (
      analysisResult !== null &&
      refinedHook.length === 0 &&
      isAnalysisConfirmedComplete(analysisResult)
    ) {
      return respond(
        boundImproveScriptResult(
          buildImproveScriptPreserveResponse(script, locale),
          locale
        ),
        200
      );
    }

    const bypassLegacyDiagnostic =
      analysisResult !== null &&
      hasValidatedActionableIssue(analysisResult);

    if (
      !bypassLegacyDiagnostic &&
      shouldDiagnoseImproveScript(script)
    ) {
      return respond(
        buildImproveScriptDiagnosticResponse(locale),
        200
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return respond(
        buildErrorResponse(
          "AI script improvement is temporarily unavailable."
        ),
        503
      );
    }

    const rateLimit = consumeAIRateLimit(getClientIdentifier(req));

    if (!rateLimit.allowed) {
      return respond(
        buildErrorResponse(
          "Too many script improvement requests. Please try again later."
        ),
        429,
        0,
        { "Retry-After": String(rateLimit.retryAfterSeconds) }
      );
    }

    const systemPrompt = `You are an expert YouTube Shorts script editor for Climpy.

Your task is to make the strongest useful improvement possible using only the video title, original script, approved refined hook, and validated analysis context when provided.

Use only information already present in the original script or title.
A validated analysis context is a grounded editorial hypothesis, not permission to invent facts and not an unconditional order to rewrite.
When it identifies a required issue, evaluate that exact issue before considering a different diagnosis.
Either resolve the issue through a materially better grounded rewrite or preserve only when no safe candidate honestly improves the complete script.
Do not silently ignore a validated required issue and restart the editorial diagnosis from zero.
Do not invent or strengthen facts, numbers, measurements, people, events, examples, causes, outcomes, comparisons, certainty, consequences, or supported claims.
Preserve the original topic, core idea, scope, uncertainty, meaning, and payoff material.

Before writing, internally evaluate the complete script as one connected viewer experience.

Determine:
1. What the script promises the viewer.
2. What material and supported claims are actually available.
3. What existing wording, structure, ordering, opening, progression, or payoff already works.
4. Whether one specific source-supported problem meaningfully limits the script.
5. Where that primary problem is located: "hook", "body", "payoff", or "whole_script".
6. Whether the available material supports a rewrite that solves that problem without weakening an existing strength.
7. Whether the honest strategy is "rewrite" or "preserve".

Choose "preserve" when no concrete limiting problem can be proven, when the original already uses its material effectively, or when a candidate would not create a meaningful editorial improvement.
Do not require or invent a primary problem, evidence, changes, or rewritten script for a preserve decision.

Possible problems may include a weak opening, unclear promise, predictable progression, early payoff, weak ending, repetition, filler, unsupported meaning, or already-strong execution.
These are examples, not fixed templates. Judge each script on its own material.

Primary problem scope:
- Use "hook" only when the opening itself is the primary limiting problem.
- Use "body" when the opening already works and the main problem is in the middle progression.
- Use "payoff" when the opening and progression work but the ending fails to deliver the strongest supported reward.
- Use "whole_script" only when the diagnosed problem genuinely affects the complete structure rather than one isolated section.
- When scope is "body" or "payoff" and no Approved refined hook is provided, copy the original first complete sentence exactly as the opening of improvedScript.
- Do not label a body or payoff problem as "whole_script" merely to gain permission to rewrite a strong opening.

Improve the complete script, not only the first line.

Approved refined hook integration:
- When an Approved refined hook is provided, treat it as the already-selected opening for this rewrite.
- Begin the improvedScript with that exact refined hook.
- Do not rewrite, weaken, contradict, replace, or remove it.
- Improve the remaining script around that opening using only supported source material.
- The refined hook is not a new factual source. Every claim in it and in the rewrite must still be supported by the original script or title.

A meaningful improvement may:
- reframe the opening;
- change the information order;
- compress context;
- remove filler or repetition;
- strengthen progression;
- reposition supported payoff material;
- improve sentence value;
- improve natural spoken rhythm;
- preserve strong original lines that already work.

None of these changes is mandatory by itself.

Do not force a twist.
Do not force a different sentence order.
Do not force suspense when direct clarity is stronger.
Do not replace a strong hook merely to make the output look different.

The rewrite must solve the script's actual primary problem.
It must not be a sentence-by-sentence paraphrase that mostly replaces words with synonyms while preserving the same weakness.

Structural similarity is acceptable when the original structure is already effective.
The goal is not maximum difference. The goal is maximum useful improvement supported by the source material.

Opening principles:
- Make the premise immediately understandable and relevant to the title.
- Treat the first 1–2 seconds like the thumbnail of the Short.
- Prefer concrete, visual, simple language when the source material supports it.
- Avoid slow setup, vague framing, and generic introductory filler.

Progression principles:
- Treat the script as one connected sequence rather than isolated sentences.
- Each sentence should add information, context, tension, consequence, progression, or payoff.
- Remove sentences that only repeat or summarize information the viewer already understands.
- Use rehooks or open loops only when supported by the original material.
- Do not reveal the strongest payoff too early when that would leave the remaining script as filler.

Ending principles:
- The ending should deliver the strongest supported final value available in the material.
- It may be a reveal, consequence, number, final image, punchline, fulfilled promise, or escalation only when supported.
- Do not invent a twist or stronger ending.
- Avoid an ending that merely summarizes what the viewer already understood.
- Phrases such as "That is why," "That's how," "So this means," or "Which is why" are weak when they only restate the previous explanation.
- They are acceptable only when they immediately add genuinely new supported information.

Already-strong scripts:
- Preserve strong wording, structure, ordering, and endings that already work.
- Make only changes that create real editorial value.
- Do not present minor wording substitutions as major improvements.

Before returning the result, internally verify:
- Did the rewrite solve the single biggest problem?
- Is the complete script meaningfully stronger?
- Did I improve the viewer experience rather than only replace words?
- Did I preserve every supported claim, comparison, cause, outcome, and level of certainty?
- Did I accidentally strengthen unsupported meaning?
- Does every sentence add value?
- Is the ending the strongest supported final reward available?
- Am I presenting a light paraphrase as a successful improvement?

Candidate comparison:
- After drafting a candidate, compare the complete candidate directly against the complete Original script.
- Set "resolvedPrimaryProblem" to true only when the candidate clearly fixes the diagnosed primary problem.
- Set "candidateMateriallyBetter" to true only when the improvement is substantial enough to justify replacing the original, not merely different wording.
- Set "regressionIntroduced" to true when the candidate weakens any existing strength, including the hook, clarity, specificity, supported meaning, certainty, progression, or payoff.
- A rewrite is acceptable only when resolvedPrimaryProblem is true, candidateMateriallyBetter is true, and regressionIntroduced is false.
- If any of those conditions is not satisfied, return the preserve response shape instead of presenting the candidate as an improvement.

Keep the script concise, natural, immediately understandable, easy to say aloud, and suitable for a YouTube Short.

Return only valid JSON, with no markdown or code fences.

Choose exactly one response shape.

For a meaningful rewrite:
{
  "editorialDecision": {
    "strategy": "rewrite",
    "primaryProblemScope": "<hook | body | payoff | whole_script>",
    "primaryProblem": "<the single biggest editorial problem that the rewrite is intended to solve>",
    "primaryProblemEvidence": "<an exact quote from the Original script that demonstrates the primary problem>"
  },
  "candidateAudit": {
    "resolvedPrimaryProblem": true,
    "candidateMateriallyBetter": true,
    "regressionIntroduced": false
  },
  "improvedScript": "<the complete rewritten script>",
  "changes": [
    "<specific editorial change tied to this script>",
    "<specific editorial change tied to this script>"
  ],
  "reason": "<specific explanation of the primary problem, the editorial decisions made, and why the complete rewrite is stronger without changing supported meaning>"
}

For an already-strong script or an uncertain improvement:
{
  "editorialDecision": {
    "strategy": "preserve"
  }
}

The "editorialDecision" must describe the decision made before generating a rewrite.
For "rewrite", "primaryProblemScope" must be exactly "hook", "body", "payoff", or "whole_script".
For "rewrite", "primaryProblem" must be specific to this script rather than a generic quality label.
For "rewrite", "primaryProblemEvidence" must be an exact quote copied from the Original script, not a paraphrase, inference, or invented example.
Choose the shortest exact quote that clearly demonstrates the stated primary problem.
For "rewrite", "candidateAudit" is required and must contain all three boolean fields.
An accepted rewrite must use resolvedPrimaryProblem=true, candidateMateriallyBetter=true, and regressionIntroduced=false.
If that exact audit result is not honest, return the preserve response shape instead.
Every rewrite item in "changes" must describe a concrete editorial decision made in this script.
For "preserve", do not require or invent a primary problem, evidence, candidate audit, changes, reason, or improvedScript.
Do not use generic claims such as "improved pacing, clarity, and engagement."
${buildImproveScriptLanguageInstructions(locale)}`;

    const validatedAnalysisContext =
      analysisResult !== null
        ? buildValidatedAnalysisContext(analysisResult)
        : "";

    const userPrompt = `Evaluate this complete YouTube Shorts script and choose the honest editorial strategy.

${title ? `Video title / topic:\n${title}\n\n` : ""}${refinedHook ? `Approved refined hook — keep this exact opening if strategy is rewrite:\n${refinedHook}\n\n` : ""}${validatedAnalysisContext ? `Validated Analysis V2 context — explicitly evaluate this grounded editorial hypothesis:\n${validatedAnalysisContext}\n\n` : ""}Original script:
${script}

Choose preserve when the original is already strong or when a rewrite would not create a meaningful editorial improvement.
Choose rewrite only when one specific supported problem can be solved using the material above.
When validated analysis contains a required issue, evaluate that issue directly instead of independently replacing it with an unrelated diagnosis.
Do not invent any new facts, numbers, measurements, examples, causes, or outcomes.
Return only valid JSON matching the required schema.`;

    const openai = new OpenAI({
      apiKey,
      timeout: 15_000,
      maxRetries: 0,
    });

    async function callModelOnce(): Promise<ImproveScriptResult> {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 1_200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? "";

      return parseImproveScriptResponse(
        raw,
        script,
        refinedHook,
        bypassLegacyDiagnostic,
        locale
      );
    }

    // Exactly one bounded retry, sequential, for either a transient
    // upstream failure or a genuinely malformed/schema-invalid model
    // response (UnusableAIResponseError) — never for an honest editorial
    // preserve/diagnostic result, which is returned normally, not thrown.
    let result: ImproveScriptResult;

    try {
      result = await callModelOnce();
    } catch (error) {
      if (!isRetryableAIResponseError(error)) {
        throw error;
      }

      await delay(IMPROVE_SCRIPT_TRANSIENT_RETRY_DELAY_MS);
      retryCount = 1;
      result = await callModelOnce();
    }

    return respond(
      boundImproveScriptResult(result, locale),
      200,
      retryCount
    );
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
        endpoint: "/api/improve-script",
        locale: failureLocale,
        failureStage: "model-call-or-parse",
        errorCategory:
          "schema-invalid-or-malformed-model-response",
        upstreamStatus: upstreamStatus ?? null,
        retryCount,
        resultStatus: null,
      });

      return respond(
        buildErrorResponse(
          "Climpy could not generate a valid script improvement right now."
        ),
        502,
        retryCount
      );
    }

    if (upstreamStatus === 401 || upstreamStatus === 403) {
      logAIRouteFailure({
        requestId,
        endpoint: "/api/improve-script",
        locale: failureLocale,
        failureStage: "model-call",
        errorCategory: "upstream-auth-failure",
        upstreamStatus,
        retryCount,
        resultStatus: null,
      });

      return respond(
        buildErrorResponse(
          "AI script improvement is temporarily unavailable."
        ),
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
        endpoint: "/api/improve-script",
        locale: failureLocale,
        failureStage: "model-call",
        errorCategory: "transient-upstream-failure",
        upstreamStatus: upstreamStatus ?? null,
        retryCount,
        resultStatus: null,
      });

      return respond(
        buildErrorResponse(
          "AI script improvement is temporarily unavailable."
        ),
        503,
        retryCount
      );
    }

    logAIRouteFailure({
      requestId,
      endpoint: "/api/improve-script",
      locale: failureLocale,
      failureStage: "model-call-or-parse",
      errorCategory: "internal-error",
      upstreamStatus: upstreamStatus ?? null,
      retryCount,
      resultStatus: null,
    });

    return respond(
      buildErrorResponse(
        "Climpy could not generate a custom script improvement right now."
      ),
      500,
      retryCount
    );
  }
}
