import OpenAI from "openai";

import { ANALYSIS_V2_JSON_SCHEMA } from "@/engine/analysis-v2-json-schema";
import {
  buildAnalysisV2SystemPrompt,
  buildAnalysisV2UserPrompt,
} from "@/engine/analysis-v2-prompt";
import {
  ANALYSIS_V2_LIMITS,
  type AnalysisV2ErrorResponse,
  type AnalysisV2SuccessResponse,
} from "@/engine/analysis-v2-schema";
import {
  normalizeAnalysisV2CompleteCausalExplanationModelResult,
  parseAnalysisV2Json,
  repairAnalysisV2MainTakeawayForScoreBreakdown,
  validateAnalysisV2Input,
  validateAnalysisV2ModelResult,
} from "@/engine/analysis-v2-validation";

const ANALYSIS_V2_MODEL =
  process.env.ANALYSIS_V2_MODEL?.trim() ||
  "gpt-4.1-mini";
const ANALYSIS_V2_TIMEOUT_MS = 20_000;
const ANALYSIS_V2_RATE_LIMIT_MAX_REQUESTS = 10;
const ANALYSIS_V2_RATE_LIMIT_WINDOW_MS = 60_000;
const ANALYSIS_V2_RATE_LIMIT_MAX_ENTRIES = 10_000;

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

type AnalysisV2ModelOutput = {
  raw: string;
  modelUsed: string;
};

export type AnalysisV2ModelCaller = (
  systemPrompt: string,
  userPrompt: string
) => Promise<AnalysisV2ModelOutput>;

export type AnalysisV2RunResult =
  | {
      ok: true;
      status: 200;
      response: AnalysisV2SuccessResponse;
    }
  | {
      ok: false;
      status: 400 | 502 | 503;
      response: AnalysisV2ErrorResponse;
    };

const rateLimitEntries = new Map<string, RateLimitEntry>();

class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body is too large.");
    this.name = "RequestBodyTooLargeError";
  }
}

class MissingApiKeyError extends Error {
  constructor() {
    super("Missing API key.");
    this.name = "MissingApiKeyError";
  }
}

class EmptyModelResponseError extends Error {
  constructor() {
    super("Empty model response.");
    this.name = "EmptyModelResponseError";
  }
}

function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedClient = forwardedFor
    ?.split(",")[0]
    ?.trim();

  return (
    forwardedClient ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown-client"
  );
}

function consumeAnalysisV2RateLimit(
  clientIdentifier: string,
  now = Date.now()
): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  for (const [key, entry] of rateLimitEntries) {
    if (
      now - entry.windowStartedAt >=
      ANALYSIS_V2_RATE_LIMIT_WINDOW_MS
    ) {
      rateLimitEntries.delete(key);
    }
  }

  const existing = rateLimitEntries.get(clientIdentifier);

  if (
    !existing ||
    now - existing.windowStartedAt >=
      ANALYSIS_V2_RATE_LIMIT_WINDOW_MS
  ) {
    if (
      !existing &&
      rateLimitEntries.size >=
        ANALYSIS_V2_RATE_LIMIT_MAX_ENTRIES
    ) {
      const oldestKey = rateLimitEntries.keys().next().value;

      if (oldestKey !== undefined) {
        rateLimitEntries.delete(oldestKey);
      }
    }

    rateLimitEntries.set(clientIdentifier, {
      count: 1,
      windowStartedAt: now,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (
    existing.count >=
    ANALYSIS_V2_RATE_LIMIT_MAX_REQUESTS
  ) {
    const remainingMilliseconds =
      ANALYSIS_V2_RATE_LIMIT_WINDOW_MS -
      (now - existing.windowStartedAt);

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(remainingMilliseconds / 1000)
      ),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

async function readJsonBodyWithLimit(
  request: Request
): Promise<unknown> {
  const contentLength =
    request.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);

    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes >
        ANALYSIS_V2_LIMITS.maxRequestBodyBytes
    ) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) {
    return JSON.parse("");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let rawBody = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      receivedBytes += value.byteLength;

      if (
        receivedBytes >
        ANALYSIS_V2_LIMITS.maxRequestBodyBytes
      ) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }

      rawBody += decoder.decode(value, {
        stream: true,
      });
    }

    rawBody += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return JSON.parse(rawBody);
}

export async function defaultAnalysisV2ModelCaller(
  systemPrompt: string,
  userPrompt: string
): Promise<AnalysisV2ModelOutput> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  const openai = new OpenAI({
    apiKey,
    timeout: ANALYSIS_V2_TIMEOUT_MS,
    maxRetries: 0,
  });

  const completion =
    await openai.chat.completions.create({
      model: ANALYSIS_V2_MODEL,
      temperature: 0.2,
      max_tokens: 1_400,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reelyze_analysis_v2",
          description:
            "A grounded, type-aware YouTube Shorts script analysis.",
          strict: true,
          schema: ANALYSIS_V2_JSON_SCHEMA,
        },
      },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

  const raw =
    completion.choices[0]?.message?.content?.trim() ??
    "";

  if (raw.length === 0) {
    throw new EmptyModelResponseError();
  }

  return {
    raw,
    modelUsed:
      completion.model || ANALYSIS_V2_MODEL,
  };
}

function buildAnalysisV2RetryUserPrompt(
  originalUserPrompt: string,
  validationReason: string
): string {
  const specificGuidance: string[] = [];
  const originalPromptHasNoveltyClaim =
    /\b(?:overlooked|little-known|secret|surprising|unique|nobody talks about|almost nobody talks about|almost nobody knows|rarely discussed|original)\b/i.test(
      originalUserPrompt
    );

  if (
    validationReason.includes(
      "unrevealed specific opening promise"
    )
  ) {
    specificGuidance.push(
      "Specific correction:",
      "If the opening promises one hidden setting, secret, cause, reason, or mechanism but the script never names it, treat this as a material hook/payoff problem.",
      "Do not use hookDecision keep.",
      "Do not call the hook clear and specific.",
      "Keep the derived overall component total at 65 or lower unless the script reveals the promised item.",
      "Use a grounded riskyPart excerpt from the opening promise and a required fix that asks to reveal or remove the promise."
    );
  } else if (
    validationReason.includes(
      "must be classified as how_to or generic_advice"
    )
  ) {
    specificGuidance.push(
      "Specific correction:",
      "Classify the script as how_to or generic_advice, not list_escalation.",
      "Preserve the material issue already identified instead of inventing a new issue for the retry.",
      'Do not use the word "verified" in suggestedFixes for this correction.',
      "Do not request external evidence, new facts, measurable results, or examples merely to prove that ordinary advice is overlooked, unique, original, secret, or rarely discussed.",
      "If the opening makes an unsupported novelty or originality claim, remove or soften that claim instead of asking the creator to prove it.",
      "If that unsupported claim is a material opening issue, use hookDecision refine or rewrite rather than keep.",
      "Keep every fix grounded in claims and wording already present in the submitted script."
    );
  } else if (
    validationReason.includes(
      "requires a diagnostic hook decision"
    )
  ) {
    specificGuidance.push(
      "Specific correction:",
      "The submitted generic advice does not contain enough concrete source material for a grounded hook rewrite.",
      "Use hookDecision diagnostic.",
      "Set suggestedHook to null.",
      "Do not invent or imply a replacement hook.",
      'Do not use the word "verified" in suggestedFixes for this correction.',
      "Use this required hook fix exactly:",
      '"Add a concrete example, mechanism, named situation, number, or observable result before rewriting the hook."'
    );
  } else if (
    validationReason.includes(
      "complete causal explanation in an unpunctuated script"
    )
  ) {
    specificGuidance.push(
      "Specific correction:",
      "Evaluate the semantic causal chain separately from punctuation and transcription formatting.",
      "The submitted script already states a cause, an observable physical effect, and a resolution.",
      "Do not call the explanation shallow, incomplete, too brief, or lacking a mechanism merely because the clauses run together.",
      "Do not request an additional example, deeper mechanism, implication, or factual expansion.",
      "Preserve the fulfilled mechanism, progression, and payoff components when recalculating the scores.",
      "If missing punctuation materially harms comprehension, identify at most one clarity or delivery issue and recommend adding sentence boundaries.",
      "Do not convert a punctuation issue into a content, premise, mechanism, or payoff failure.",
      "If the causal sequence remains understandable and no independent material problem exists, use a strong verdict with no riskyParts or required suggestedFixes."
    );
  } else if (
    validationReason.includes(
      "resolved outcome narrative"
    )
  ) {
    specificGuidance.push(
      "Specific correction:",
      "The script already establishes concrete stakes and ends with a resolved outcome.",
      "Treat that resolved outcome as a valid narrative payoff.",
      "Do not criticize the resolved outcome for lacking a separate external consequence, historical impact, policy change, security response, broader implication, or explanation of significance.",
      "Remove the riskyPart and required payoff fix that target the resolved outcome.",
      "Do not request external factual material merely to extend the resolved outcome.",
      "Reassess the score components using the chronology, rising stakes, narrow avoidance of a worse outcome, and final resolution.",
      "If no independent material problem remains, use a strong verdict with zero riskyParts and no required suggestedFixes."
    );
  } else if (
    validationReason.includes(
      "allowed neutral diagnostic forms"
    )
  ) {
    specificGuidance.push(
      "Specific correction:",
      "When a suggestedFix requests verified factual material, use exactly one of these complete sentences and do not add anything else:",
      '"Add a verified consequence or implication that explains why this matters."',
      '"Add a verified contrast, example, or measurable result that strengthens the payoff."',
      'Alternatively, remove the word "verified" and write a contextualized fix using only facts already present in the submitted script.',
      "Do not append candidate facts, examples, affected groups, consequences, effects, or possible factual directions.",
      "If the script already delivers its intended payoff and no material issue remains, remove the riskyPart and suggestedFix instead of forcing a verified factual request.",
      "For a mystery that presents concrete clues and does not promise a solution, an unresolved ending is allowed; do not request a verified explanation or factual resolution."
    );

    if (originalPromptHasNoveltyClaim) {
      specificGuidance.push(
        "This script contains a novelty or originality claim.",
        'Do not use the word "verified" in the corrected suggestedFix.',
        "Do not request external proof, research, examples, statistics, measurable results, or new facts to prove that the material is overlooked, secret, surprising, unique, original, or rarely discussed.",
        "Use a grounded hook fix that removes or softens the unsupported novelty wording using only wording and claims already present in the submitted script.",
        "The preferred correction is to remove or soften the novelty claim, not to ask the creator to prove it."
      );
    }
  }

  return [
    originalUserPrompt,
    "",
    "Correction required:",
    `The previous response failed deterministic validation: ${validationReason}`,
    ...specificGuidance,
    "Generate a new complete analysis from the original script.",
    "Correct the validation problem without inventing facts, excerpts, numbers, entities, or promises.",
    "Return only JSON that follows the required schema.",
  ].join("\n");
}

function isAnalysisV2FinalTargetedRetryReason(
  validationReason: string
): boolean {
  return (
    validationReason.includes(
      "complete causal explanation in an unpunctuated script"
    ) ||
    validationReason.includes(
      "unrevealed specific opening promise"
    ) ||
    validationReason.includes(
      "verdict is inconsistent with the supplied"
    ) ||
    validationReason.includes(
      "allowed neutral diagnostic forms"
    ) ||
    validationReason.includes(
      "A strong result must not contain risky parts"
    ) ||
    validationReason.includes(
      "A strong result must not contain risky scenes"
    ) ||
    validationReason.includes(
      "A strong result may contain at most one optional refinement"
    ) ||
    validationReason.includes(
      "Every fix in a strong result must be optional"
    ) ||
    validationReason.includes(
      "A strong result must use keep or refine"
    )
  );
}

function buildAnalysisV2FinalTargetedRetryUserPrompt(
  originalUserPrompt: string,
  validationReason: string
): string {
  const specificGuidance: string[] = [];
  const originalPromptHasTranscriptMarkers =
    /\[(?:music|applause|noise|sound)\]/i.test(
      originalUserPrompt
    );

  if (
    validationReason.includes(
      "complete causal explanation in an unpunctuated script"
    )
  ) {
    specificGuidance.push(
      "Evaluate the semantic clauses separately from punctuation and transcription formatting.",
      "The deterministic validator has already confirmed that the submitted script contains a cause, an observable effect, and a resolution.",
      "Treat the causal mechanism, progression, and resolution as fulfilled.",
      "Do not request a deeper mechanism, additional example, more detail, further implication, or factual expansion.",
      "Do not lower mechanism, progression, or payoff components merely because the explanation could be longer.",
      "If punctuation genuinely harms comprehension, report at most one clarity or delivery issue.",
      "Do not convert formatting into a content, premise, mechanism, progression, or payoff failure.",
      "If no independent material problem remains, use verdict strong, riskyParts [], suggestedFixes [], and no risky scenes."
    );

  } else if (
    validationReason.includes(
      "unrevealed specific opening promise"
    )
  ) {
    specificGuidance.push(
      "The opening promises one specific hidden setting, secret, cause, reason, or mechanism, but the script never reveals it.",
      "Treat this as a material hook and payoff problem.",
      "Do not use verdict strong.",
      "Do not use hookDecision keep.",
      "Do not describe the hook as clear, low-risk, fulfilled, or specific enough.",
      "Keep the derived overall score at 65 or lower.",
      "Include a grounded riskyPart copied from the opening promise.",
      "Include a non-optional fix that asks the creator to reveal the promised item or remove the promise.",
      "Do not invent the missing setting, cause, reason, mechanism, entity, or fact in suggestedHook or suggestedFixes."
    );
  } else if (
    validationReason.includes(
      "verdict is inconsistent with the supplied"
    )
  ) {
    specificGuidance.push(
      "Recalculate the public scores by summing the required score components before choosing the verdict.",
      "Then choose a verdict that matches the derived totals and the feedback arrays.",
      "A strong verdict requires overall at least 70, retentionRisk at most 45, zero riskyParts, no risky scenes, and no required fixes.",
      "A mixed verdict requires overall from 46 through 84 and must contain at least one grounded riskyPart and one non-optional suggestedFix.",
      "Do not preserve a mixed verdict when the derived overall score falls outside the mixed range.",
      "Do not change component scores merely to preserve the previous verdict.",
      "Align the verdict, riskyParts, scenes, suggestedFixes, hookDecision, and derived scores with the same evidence."
    );
  } else if (
    validationReason.includes(
      "allowed neutral diagnostic forms"
    )
  ) {
    specificGuidance.push(
      "A suggestedFix that requests verified factual material must use exactly one of these complete sentences:",
      '"Add a verified consequence or implication that explains why this matters."',
      '"Add a verified contrast, example, or measurable result that strengthens the payoff."',
      "Do not add context before or after the selected sentence.",
      "Do not replace 'this' with a specific action, step, object, topic, group, consequence, or factual direction.",
      "Do not append examples, candidate implications, affected groups, mechanisms, or clauses beginning with such as, for example, including, or like.",
      'Alternatively, remove the word "verified" and write a grounded contextualized fix using only information already present in the submitted script.',
      "If the script already fulfills the intended explanation and payoff, remove the riskyPart and required suggestedFix instead of forcing external factual material."
    );
  }

  specificGuidance.push(
    "Before returning JSON, perform a final deterministic consistency check across scoreComponents, derived scores, verdict, hookDecision, suggestedHook, riskyParts, suggestedFixes, and scenes.",
    "Choose exactly one coherent result path and apply it consistently to every field.",
    "Strong path: derived overall must be at least 70, retentionRisk must be at most 45, riskyParts must be [], there must be no risky scenes, there must be no non-optional fixes, there may be at most one optional fix, and hookDecision must be keep or refine.",
    "Mixed path: derived overall must be from 46 through 84, there must be at least one grounded riskyPart, and there must be at least one non-optional suggestedFix supported by the same evidence.",
    "Never return verdict strong while retaining any riskyPart, risky scene, or non-optional suggestedFix.",
    "Do not correct only the verdict. Make the component scores, derived totals, feedback arrays, scene statuses, hook decision, and summary describe the same evidence.",
    "Recalculate all three public scores from the supplied scoreComponents immediately before returning the final JSON."
  );

  if (originalPromptHasTranscriptMarkers) {
    specificGuidance.push(
      "The submitted script contains bracketed auto-caption markers.",
      "Treat [music], [applause], [noise], and [sound] as non-semantic transcription cues during semantic evaluation.",
      "Semantic removal applies only to judging the explanation; it does not permit removing or changing a marker inside an excerpt.",
      "Every riskyParts[].excerpt and scenes[].excerpt must remain an exact contiguous substring of the original submitted script.",
      "If an excerpt spans a bracketed marker, include that marker exactly or split the content into separate exact contiguous excerpts.",
      "Never concatenate words from opposite sides of a marker into an excerpt that does not literally exist in the original script.",
      "Read the meaningful words before and after each marker as one continuous causal sequence.",
      "Do not treat a transcript marker as evidence that a causal step, mechanism, example, or payoff is missing.",
      'A leading filler phrase such as "so basically" may justify at most one hook or clarity issue.',
      'Choose one coherent outcome for that filler: either retain it as a material issue and use verdict mixed with exactly one grounded riskyPart and one non-optional hook fix, or treat it as non-material and use verdict strong with no riskyParts, no risky scenes, and no required fixes.',
      'Never use verdict strong while still describing "so basically" as a remaining material problem in riskyParts, suggestedFixes, scene labels, hookAssessment, or mainTakeaway.',
      'If you report that filler issue, quote only the exact filler phrase and recommend removing it; do not request a deeper mechanism, additional example, implication, or factual expansion.',
      "Preserve the fulfilled cause, observable effect, and resolution after ignoring the transcript markers.",
      "Apply these transcript constraints together with the correction for the latest validation failure."
    );
  }

  return [
    originalUserPrompt,
    "",
    "Final targeted correction required:",
    `The latest corrected response still failed deterministic validation: ${validationReason}`,
    ...specificGuidance,
    "Generate one new complete analysis from the original submitted script.",
    "Correct the stated validation failure without inventing facts, excerpts, numbers, entities, or promises.",
    "Return only JSON matching the required schema.",
    "Do not mention these correction instructions in the result.",
  ].join("\n");
}

export async function runAnalysisV2(
  script: unknown,
  title: unknown,
  modelCaller: AnalysisV2ModelCaller =
    defaultAnalysisV2ModelCaller
): Promise<AnalysisV2RunResult> {
  const inputValidation =
    validateAnalysisV2Input(script, title);

  if (!inputValidation.ok) {
    return {
      ok: false,
      status: 400,
      response: {
        status: "error",
        reason: inputValidation.reason,
      },
    };
  }

  const systemPrompt =
    buildAnalysisV2SystemPrompt();
  const userPrompt = buildAnalysisV2UserPrompt(
    inputValidation.script,
    inputValidation.title
  );

  let currentUserPrompt = userPrompt;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let modelOutput: AnalysisV2ModelOutput;

    try {
      modelOutput = await modelCaller(
        systemPrompt,
        currentUserPrompt
      );
    } catch (error) {
      if (error instanceof MissingApiKeyError) {
        return {
          ok: false,
          status: 503,
          response: {
            status: "error",
            reason:
              "Analysis V2 is temporarily unavailable.",
          },
        };
      }

      const upstreamStatus =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status ===
          "number"
          ? (error as { status: number }).status
          : undefined;

      if (
        upstreamStatus === 401 ||
        upstreamStatus === 403 ||
        upstreamStatus === 429 ||
        (upstreamStatus !== undefined &&
          upstreamStatus >= 500) ||
        error instanceof OpenAI.APIConnectionError
      ) {
        return {
          ok: false,
          status: 503,
          response: {
            status: "error",
            reason:
              "Analysis V2 is temporarily unavailable.",
          },
        };
      }

      return {
        ok: false,
        status: 503,
        response: {
          status: "error",
          reason:
            "Analysis V2 could not complete this request.",
        },
      };
    }

    const parsed = parseAnalysisV2Json(
      modelOutput.raw
    );

    if (parsed === null) {
      return {
        ok: false,
        status: 502,
        response: {
          status: "error",
          reason:
            "Analysis V2 returned an unusable response.",
        },
      };
    }

    const resultValidation =
      validateAnalysisV2ModelResult(
        parsed,
        inputValidation.script
      );

    if (!resultValidation.ok) {
      if (
        resultValidation.reason ===
        "For an overall score below 80, mainTakeaway must identify the lowest-scoring overall component and explain how it limited the score."
      ) {
        const repairedModelResult =
          repairAnalysisV2MainTakeawayForScoreBreakdown(
            parsed
          );

        if (repairedModelResult !== null) {
          const repairedValidation =
            validateAnalysisV2ModelResult(
              repairedModelResult,
              inputValidation.script
            );

          if (repairedValidation.ok) {
            return {
              ok: true,
              status: 200,
              response: {
                status: "ok",
                result: repairedValidation.value,
                modelUsed: modelOutput.modelUsed,
              },
            };
          }
        }
      }

      if (attempt === 0) {
        currentUserPrompt =
          buildAnalysisV2RetryUserPrompt(
            userPrompt,
            resultValidation.reason
          );
        continue;
      }

      const canUseFinalTargetedRetry =
        attempt === 1 &&
        isAnalysisV2FinalTargetedRetryReason(
          resultValidation.reason
        );

      if (canUseFinalTargetedRetry) {
        currentUserPrompt =
          buildAnalysisV2FinalTargetedRetryUserPrompt(
            userPrompt,
            resultValidation.reason
          );
        continue;
      }

      if (attempt === 2) {
        const normalizedModelResult =
          normalizeAnalysisV2CompleteCausalExplanationModelResult(
            parsed,
            inputValidation.script
          );

        if (normalizedModelResult !== null) {
          const normalizedValidation =
            validateAnalysisV2ModelResult(
              normalizedModelResult,
              inputValidation.script
            );

          if (normalizedValidation.ok) {
            return {
              ok: true,
              status: 200,
              response: {
                status: "ok",
                result:
                  normalizedValidation.value,
                modelUsed:
                  modelOutput.modelUsed,
              },
            };
          }
        }
      }

      console.error(
        attempt === 2
          ? "[analyze-v2] validation failed after final targeted retry:"
          : "[analyze-v2] validation failed after retry:",
        resultValidation.reason
      );

      return {
        ok: false,
        status: 502,
        response: {
          status: "error",
          reason:
            "Analysis V2 returned an invalid analysis.",
        },
      };
    }

    return {
      ok: true,
      status: 200,
      response: {
        status: "ok",
        result: resultValidation.value,
        modelUsed: modelOutput.modelUsed,
      },
    };
  }

  return {
    ok: false,
    status: 502,
    response: {
      status: "error",
      reason:
        "Analysis V2 returned an invalid analysis.",
    },
  };
}

export async function POST(
  request: Request
): Promise<Response> {
  const contentType =
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() ?? "";

  if (contentType !== "application/json") {
    return Response.json(
      {
        status: "error",
        reason:
          "Unsupported Content-Type. Use application/json.",
      } satisfies AnalysisV2ErrorResponse,
      {
        status: 415,
      }
    );
  }

  let body: unknown;

  try {
    body = await readJsonBodyWithLimit(request);
  } catch (error) {
    if (
      error instanceof RequestBodyTooLargeError
    ) {
      return Response.json(
        {
          status: "error",
          reason: "Request body is too large.",
        } satisfies AnalysisV2ErrorResponse,
        {
          status: 413,
        }
      );
    }

    return Response.json(
      {
        status: "error",
        reason: "Invalid JSON request body.",
      } satisfies AnalysisV2ErrorResponse,
      {
        status: 400,
      }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return Response.json(
      {
        status: "error",
        reason: "Request body must be an object.",
      } satisfies AnalysisV2ErrorResponse,
      {
        status: 400,
      }
    );
  }

  const record = body as Record<string, unknown>;

  const inputValidation =
    validateAnalysisV2Input(
      record.script,
      record.title
    );

  if (!inputValidation.ok) {
    return Response.json(
      {
        status: "error",
        reason: inputValidation.reason,
      } satisfies AnalysisV2ErrorResponse,
      {
        status: 400,
      }
    );
  }

  const rateLimit = consumeAnalysisV2RateLimit(
    getClientIdentifier(request)
  );

  if (!rateLimit.allowed) {
    return Response.json(
      {
        status: "error",
        reason:
          "Too many Analysis V2 requests. Please try again later.",
      } satisfies AnalysisV2ErrorResponse,
      {
        status: 429,
        headers: {
          "Retry-After": String(
            rateLimit.retryAfterSeconds
          ),
        },
      }
    );
  }

  const result = await runAnalysisV2(
    inputValidation.script,
    inputValidation.title
  );

  return Response.json(result.response, {
    status: result.status,
  });
}
