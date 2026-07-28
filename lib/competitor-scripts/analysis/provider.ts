// Competitor Scripts analysis provider: transcript -> size guard -> prompt
// construction -> model call -> structured result parsing -> the real
// validate.ts validator -> success or a typed failure. This file never
// reads process.env — the production model caller takes its API key as an
// explicit parameter, so wiring OPENAI_API_KEY into an actual request is
// deferred entirely to the API route that composes this provider.
//
// Retry budget: at most ONE retry, shared between a transient
// provider/network failure and a malformed/invalid model response —
// never two separate budgets, never a third call. This is guaranteed by
// construction: `attempt()` is called from exactly two call sites below
// (never in a loop, never recursively), so a third invocation is not
// reachable by any code path in this function.

import OpenAI from "openai";

import { delay, isTransientUpstreamError } from "@/lib/ai-transient-retry";

import { COMPETITOR_ANALYSIS_JSON_SCHEMA } from "./json-schema";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import type { AnalysisLocale, CompetitorScriptAnalysis } from "./types";
import { checkAnalysisTranscriptSize, validateCompetitorScriptAnalysis } from "./validate";
import type { NormalizedTranscript } from "../transcript/types";

// ── Production configuration (named constants, not magic numbers) ────────

// Fixed to the bake-off-selected model. No fallback model, no automatic
// reasoning escalation, no switching between attempt 1 and attempt 2 —
// both attempts always use this exact model and reasoning level.
export const COMPETITOR_ANALYSIS_MODEL = "gpt-5.6-luna";
export const COMPETITOR_ANALYSIS_REASONING_EFFORT = "low" as const;

// Per-attempt timeout. Justified from bake-off gpt-5.6-luna latency
// (median ~13.6s, p90 ~15.0s, observed max ~16.2s across 12 real calls) —
// 30s leaves comfortable headroom above the observed max for a single
// attempt. Confirmed genuinely per-attempt, not shared/cumulative: the
// installed SDK's own doc comment on `timeout` says "the maximum amount
// of time... that the client should wait for a response... before timing
// out A SINGLE REQUEST" (node_modules/openai/client.d.ts), and a fresh
// `OpenAI` client is constructed inside the model caller on every call
// below — so attempt 1 and attempt 2 each independently get their own
// full 30s window. `maxRetries: 0` (also set below) is what makes this
// safe: the SDK's own doc warns "request timeouts are retried by default"
// (default maxRetries is 2), which would otherwise let a single logical
// attempt silently become up to 3 physical HTTP requests and break the
// ≤2-total-calls guarantee below. A worst case of two consecutive
// timeouts (~60s combined) is a known, accepted limitation of this PR,
// not solved here.
export const COMPETITOR_ANALYSIS_TIMEOUT_MS = 30_000;

// Calculated, not inherited, from the real PR 10A contract bounds
// (constants.ts). Worst-case schema-maximal response, every array at its
// max count and every string at its max length:
//   mainTakeaway(240) + scoreReasons 4x320 + structure 8x(180+120+320)
//   + strengths 5x(100+180+320) + weaknesses 5x(100+180+320)
//   + retentionRisks 5x(180+320+320) + actionableLessons 5x(100+180+320)
//   + caution 3x(100+320+180)
//   = 21,380 worst-case content characters.
// Two upward adjustments on top of that raw count, both required by a
// closer audit (see PR 10B pre-commit review):
//   1. JSON-escaping overhead: EvidenceRef.excerpt is copied verbatim from
//      the transcript, which can legitimately contain a literal `"`
//      (quoted dialogue) or other characters that must be JSON-escaped to
//      `\"`, each adding one extra character. +10% on content is a
//      conservative allowance for this.
//   2. Structural JSON overhead (31 EvidenceRef wrappers, property names,
//      braces/commas) — ~2,755 characters, unchanged from the original
//      estimate.
//   (21,380 * 1.10) + 2,755 ≈ 26,273 worst-case characters.
// Chars/token ratio: the schema's `locale` field accepts "ru", and every
// prose field must then be written in Russian — Cyrillic text tokenizes
// meaningfully less efficiently than English with OpenAI's BPE
// tokenizers, and dense JSON punctuation also tokenizes worse than plain
// prose. There is no tokenizer available in this environment to measure
// this exactly (no tiktoken/js-tiktoken in node_modules, and measuring
// via the API would require a real network call, which this PR must not
// make), so a deliberately conservative 2.0 chars/token is used instead
// of the English-prose-typical ~4 — conservative specifically so the
// ru-locale worst case and escaping overhead are both covered:
//   26,273 / 2.0 ≈ 13,137 worst-case content tokens.
// The Responses API's max_output_tokens explicitly includes reasoning
// tokens (they are not a separate, additive budget — see the SDK doc
// comment quoted in the PR 10B audit report), so headroom for reasoning
// must come out of the same cap, on top of the content estimate above,
// not instead of it. The real bake-off run (36 calls, gpt-5.6-luna,
// reasoning=low) observed reasoning_tokens of at most 298 per call on
// much smaller fixture responses; ~2,500 tokens of headroom here is a
// large (~8x) safety multiplier over that observed max, to account for a
// genuinely maximal, more complex response needing more reasoning:
//   13,137 + 2,500 ≈ 15,637 tokens.
// 16,000 is the smallest round number above that combined estimate.
export const COMPETITOR_ANALYSIS_MAX_OUTPUT_TOKENS = 16_000;

// Delay before the single retry attempt, matching the existing
// lib/ai-transient-retry.ts default.
export const COMPETITOR_ANALYSIS_RETRY_DELAY_MS = 250;

// ── Model caller (dependency-injected; no real OpenAI call in tests) ─────

export type CompetitorAnalysisModelOutput = {
  raw: string;
  modelUsed: string;
};

export type CompetitorAnalysisModelCaller = (input: {
  systemPrompt: string;
  userPrompt: string;
}) => Promise<CompetitorAnalysisModelOutput>;

// Thrown when the model call itself succeeded (transport-level) but the
// result is unusable — empty output, non-JSON output, or output that
// failed the real PR 10A validator. Retried exactly once, the same as a
// transient upstream failure, via isRetryableAnalysisError below.
class UnusableAnalysisResponseError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "UnusableAnalysisResponseError";
  }
}

// isTransientUpstreamError is reused unmodified from lib/ai-transient-retry.ts.
// Confirmed compatible with the Responses API (not just Chat Completions,
// which is the only surface it was previously used against): `Responses`
// and `Completions` both extend the same `APIResource` base
// (node_modules/openai/resources/responses/responses.d.ts,
// resources/chat/completions/completions.d.ts) and therefore share the
// same core request pipeline and error hierarchy
// (node_modules/openai/core/error.d.ts) — there is no Responses-specific
// error type. A client-side timeout (our 30s AbortController firing)
// throws `APIConnectionTimeoutError`, which `extends APIConnectionError`,
// so it is caught by the existing `instanceof OpenAI.APIConnectionError`
// check; 429 throws `RateLimitError`; 5xx throws `InternalServerError`/a
// generic `APIError` with `status >= 500` — both caught by the existing
// status-based branch. 409 (`ConflictError`) is deliberately NOT
// classified as transient by the existing helper (its own comment: "400-
// class errors are deterministic rejections... must not be retried") —
// that is pre-existing repo-wide policy shared with 3 other routes, not
// something this PR changes.
function isRetryableAnalysisError(error: unknown): boolean {
  return error instanceof UnusableAnalysisResponseError || isTransientUpstreamError(error);
}

// Production model caller. Takes the API key as an explicit parameter —
// this function never reads process.env itself; composing it with a real
// key from the environment is PR 10C's job, not this provider's.
export function createOpenAICompetitorAnalysisModelCaller(config: {
  apiKey: string;
}): CompetitorAnalysisModelCaller {
  return async ({ systemPrompt, userPrompt }) => {
    const openai = new OpenAI({
      apiKey: config.apiKey,
      timeout: COMPETITOR_ANALYSIS_TIMEOUT_MS,
      maxRetries: 0,
    });

    const response = await openai.responses.create({
      model: COMPETITOR_ANALYSIS_MODEL,
      reasoning: { effort: COMPETITOR_ANALYSIS_REASONING_EFFORT },
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: COMPETITOR_ANALYSIS_MAX_OUTPUT_TOKENS,
      text: {
        format: {
          type: "json_schema",
          name: "competitor_script_analysis",
          strict: true,
          schema: COMPETITOR_ANALYSIS_JSON_SCHEMA,
        },
      },
    });

    const raw = response.output_text?.trim() ?? "";
    if (raw.length === 0) {
      throw new UnusableAnalysisResponseError("The model returned an empty response.");
    }

    return { raw, modelUsed: response.model || COMPETITOR_ANALYSIS_MODEL };
  };
}

// ── Provider result contract ──────────────────────────────────────────────

// transcript_too_long_for_analysis reuses AnalysisSizeCheckResult's exact
// false-branch shape from types.ts (checkAnalysisTranscriptSize returns it
// directly, unmodified, below). analysis_invalid_response/analysis_unavailable
// are new provider-level outcomes — they do not exist anywhere in PR 10A's
// types.ts (verified: only CompetitorScriptAnalysisResult and
// AnalysisSizeCheckResult are exported there, and neither contains these
// two codes), so there is no existing type being duplicated or drifted
// from. Both carry only a `code`, no free-text `reason` — the internal
// validator/error detail that drove the decision stays fully internal to
// this file (used only to build the one-line corrective retry instruction
// below) and is never part of this public contract.
export type CompetitorAnalysisProviderResult =
  | { ok: true; analysis: CompetitorScriptAnalysis }
  | {
      ok: false;
      code: "transcript_too_long_for_analysis";
      maxCharacters: number;
      actualCharacters: number;
    }
  | { ok: false; code: "analysis_invalid_response" }
  | { ok: false; code: "analysis_unavailable" };

// One concise corrective instruction derived from the specific validator
// failure, appended to the user prompt on the single retry only — never a
// large per-error-code branching prompt system. This uses the internal
// error detail (validator code/reason, or a short quoted offending
// fragment for grounding failures) purely to help the SAME model correct
// itself on the next attempt — it is never part of the public result type
// above, never logged, and never contains the full transcript or the
// full raw model response (see the PR 10B audit report for concrete
// examples of this text for each failure category).
function buildCorrectiveInstruction(error: UnusableAnalysisResponseError): string {
  return `Your previous response was rejected for this reason: ${error.message}. Fix specifically this issue and resend a single complete, valid JSON response that follows every rule above.`;
}

// Never leaks the internal validator reason or any raw SDK error message
// into the public result — both failure branches carry only a `code`.
function toProviderFailure(error: unknown): CompetitorAnalysisProviderResult {
  if (error instanceof UnusableAnalysisResponseError) {
    return { ok: false, code: "analysis_invalid_response" };
  }

  return { ok: false, code: "analysis_unavailable" };
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function runCompetitorScriptAnalysis(input: {
  transcript: NormalizedTranscript;
  locale: AnalysisLocale;
  modelCaller: CompetitorAnalysisModelCaller;
}): Promise<CompetitorAnalysisProviderResult> {
  const { transcript, locale, modelCaller } = input;

  const sizeCheck = checkAnalysisTranscriptSize(transcript);
  if (!sizeCheck.ok) {
    return sizeCheck;
  }

  async function attempt(correctiveInstruction?: string): Promise<CompetitorScriptAnalysis> {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({ transcript, locale, correctiveInstruction });

    const modelOutput = await modelCaller({ systemPrompt, userPrompt });

    let candidate: unknown;
    try {
      candidate = JSON.parse(modelOutput.raw);
    } catch {
      throw new UnusableAnalysisResponseError("The model's output was not valid JSON.");
    }

    const validation = validateCompetitorScriptAnalysis({
      candidate,
      transcript,
      expectedLocale: locale,
    });

    if (!validation.ok) {
      throw new UnusableAnalysisResponseError(
        `${validation.failure.code}: ${validation.failure.reason}`
      );
    }

    return validation.analysis;
  }

  // Structurally bounded at two total calls: `attempt()` appears at
  // exactly two call sites in this function (never in a loop, never
  // recursively), so a third call is not reachable.
  try {
    return { ok: true, analysis: await attempt() };
  } catch (firstError) {
    if (!isRetryableAnalysisError(firstError)) {
      return toProviderFailure(firstError);
    }

    await delay(COMPETITOR_ANALYSIS_RETRY_DELAY_MS);

    const correctiveInstruction =
      firstError instanceof UnusableAnalysisResponseError
        ? buildCorrectiveInstruction(firstError)
        : undefined;

    try {
      return { ok: true, analysis: await attempt(correctiveInstruction) };
    } catch (secondError) {
      return toProviderFailure(secondError);
    }
  }
}
