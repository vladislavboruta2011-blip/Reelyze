// Compare provider: user script + competitor transcript -> input-size
// guard -> prompt construction -> model call -> structured result parsing
// -> the real validate.ts validator -> success or a typed failure. This
// file never reads process.env — the production model caller takes its
// API key as an explicit parameter, so wiring OPENAI_API_KEY into an
// actual request is deferred entirely to a future API route, exactly
// mirroring lib/competitor-scripts/analysis/provider.ts's own boundary.
//
// Fully independent from Analyze's provider — no shared types, no shared
// validator, no shared prompt/schema — per
// docs/product/compare/CONSTITUTION.md, "Relationship to Analyze." The
// only imports from outside this directory are two provider-agnostic,
// side-effect-free helpers already shared repo-wide
// (lib/ai-transient-retry.ts), the same two Analyze's own provider
// imports.
//
// Retry budget: at most ONE retry, shared between a transient
// provider/network failure and a malformed/invalid model response — never
// two separate budgets, never a third call. Guaranteed by construction:
// `attempt()` is called from exactly two call sites below (never in a
// loop, never recursively), so a third invocation is not reachable by any
// code path in this function. This mirrors
// lib/competitor-scripts/analysis/provider.ts's own retry architecture
// exactly.
//
// No AbortController/signal parameter exists here, matching Analyze's
// provider: cancellation is entirely internal, via the OpenAI client's own
// per-attempt `timeout`, not a caller-supplied signal.

import OpenAI from "openai";

import { delay, isTransientUpstreamError } from "@/lib/ai-transient-retry";

import { COMPARISON_JSON_SCHEMA } from "./json-schema";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import {
  MAX_COMPARISON_COMPETITOR_TRANSCRIPT_CHARACTERS,
  MAX_COMPARISON_USER_SCRIPT_CHARACTERS,
} from "./constants";
import type { ComparisonLocale, CompetitorScriptComparison } from "./types";
import { validateCompetitorScriptComparison } from "./validate";
import type { NormalizedTranscript } from "../transcript/types";

// ── Production configuration (named constants, not magic numbers) ────────

// Reuses Analyze's bake-off-selected model and reasoning effort: no
// Compare-specific bake-off has been run, and there is no evidence this
// task needs a different model or a different reasoning level, so this
// deliberately does not introduce an unproven second choice. Fixed on
// every attempt — no fallback model, no automatic reasoning escalation
// between attempt 1 and attempt 2.
export const COMPETITOR_COMPARISON_MODEL = "gpt-5.6-luna";
export const COMPETITOR_COMPARISON_REASONING_EFFORT = "low" as const;

// Per-attempt timeout. Reuses Analyze's exact 30s figure because this is
// the same underlying model (see COMPETITOR_COMPARISON_MODEL above) — no
// Compare-specific latency data has been collected to justify a different
// number. Genuinely per-attempt, not shared/cumulative, for the same
// reason documented in lib/competitor-scripts/analysis/provider.ts: a
// fresh `OpenAI` client is constructed inside the model caller on every
// call below, and `maxRetries: 0` (also set below) prevents the SDK's own
// default request-timeout retry from silently turning one logical attempt
// into more than one physical HTTP request.
export const COMPETITOR_COMPARISON_TIMEOUT_MS = 30_000;

// Calculated, not inherited, from Compare's own contract bounds
// (constants.ts) — Compare's schema is smaller than Analyze's, so
// Analyze's 16,000 figure is not reused as-is. Worst-case schema-maximal
// response, every array at its max count and every string at its max
// length:
//   comparisonSummary: headline(140) + mainTakeaway(240) = 380
//   dimensionFindings: 4 x (conclusion 200 + userObservation 220 +
//     competitorObservation 220 + evidence.user.excerpt 180 +
//     evidence.competitor.excerpt 180) = 4 x 1,000 = 4,000
//   priorities: 3 x (problem 280 + competitorPrinciple 280 +
//     howToApply 280 + evidence.user.excerpt 180 +
//     evidence.competitor.excerpt 180) = 3 x 1,200 = 3,600
//   cautions: 3 x (whatNotToCopy 100 + reason 280 +
//     evidence.competitor.excerpt 180 + evidence.user.excerpt 180,
//     worst case non-null) = 3 x 740 = 2,220
//   = 10,200 worst-case content characters.
// Structural JSON overhead (property names, braces/commas, and 20
// evidence-object wrappers: 4 dimensions x 2 + 3 priorities x 2 + 3
// cautions x 2): estimated the same way as the PR 10B analysis-provider
// audit (~89 chars per evidence wrapper there), scaled to Compare's 20
// wrappers and rounded up for the additional non-evidence field names
// Compare's schema also carries (dimension, strongerSide, gap, rank,
// etc.) that a wrapper-only count would miss: ~2,000 characters.
// (10,200 + 2,000) = 12,200 characters.
// Two upward adjustments, mirroring the PR 10B analysis-provider audit
// exactly (same rationale, applied to Compare's own totals):
//   1. JSON-escaping overhead: excerpt fields are copied verbatim from
//      real source text, which can legitimately contain a literal `"`
//      that must be escaped to `\"`. +10% on content is a conservative
//      allowance.
//   2. Chars/token ratio: the schema's `locale` field accepts "ru", and
//      every prose field must then be written in Russian — Cyrillic text
//      tokenizes meaningfully less efficiently than English with OpenAI's
//      BPE tokenizers. No tokenizer is available in this environment to
//      measure this exactly (no tiktoken/js-tiktoken in node_modules, and
//      measuring via the API would require a real network call), so the
//      same deliberately conservative 2.0 chars/token used by the
//      analysis provider is reused here rather than the English-prose-
//      typical ~4.
//   (12,200 * 1.10) / 2.0 ≈ 6,710 worst-case content tokens.
// Reasoning headroom: no Compare-specific bake-off telemetry exists (see
// above) — no real observed reasoning_tokens figure is available the way
// the analysis provider had one (its own bake-off measured at most 298
// reasoning tokens per call). In the complete absence of that data, this
// reuses the analysis provider's own already-conservative (~8x margin)
// headroom figure verbatim, as the most defensible placeholder available,
// rather than inventing an unsupported Compare-specific number:
//   6,710 + 2,500 ≈ 9,210 tokens.
// 10,000 is the smallest round number above that combined estimate.
export const COMPETITOR_COMPARISON_MAX_OUTPUT_TOKENS = 10_000;

// Delay before the single retry attempt, matching the existing
// lib/ai-transient-retry.ts default and Analyze's own provider.
export const COMPETITOR_COMPARISON_RETRY_DELAY_MS = 250;

// ── Input-size precondition ───────────────────────────────────────────────
// Run before any model call is ever attempted. An oversized script or
// transcript can never be fixed by retrying, so this is intentionally
// separate from the retry-worthy failure taxonomy below — the same
// division of responsibility as
// lib/competitor-scripts/analysis/validate.ts's checkAnalysisTranscriptSize.
// Compare has two independent size-bounded inputs (unlike Analyze's one
// transcript), so this returns one of two distinct failure codes rather
// than a single shared one — a caller needs to know which side was
// oversized.

export type ComparisonSizeCheckResult =
  | { ok: true }
  | {
      ok: false;
      code: "user_script_too_long_for_comparison";
      maxCharacters: number;
      actualCharacters: number;
    }
  | {
      ok: false;
      code: "competitor_transcript_too_long_for_comparison";
      maxCharacters: number;
      actualCharacters: number;
    };

export function checkComparisonInputSize(input: {
  userScript: string;
  competitorTranscript: NormalizedTranscript;
}): ComparisonSizeCheckResult {
  const { userScript, competitorTranscript } = input;

  if (userScript.length > MAX_COMPARISON_USER_SCRIPT_CHARACTERS) {
    return {
      ok: false,
      code: "user_script_too_long_for_comparison",
      maxCharacters: MAX_COMPARISON_USER_SCRIPT_CHARACTERS,
      actualCharacters: userScript.length,
    };
  }

  if (competitorTranscript.text.length > MAX_COMPARISON_COMPETITOR_TRANSCRIPT_CHARACTERS) {
    return {
      ok: false,
      code: "competitor_transcript_too_long_for_comparison",
      maxCharacters: MAX_COMPARISON_COMPETITOR_TRANSCRIPT_CHARACTERS,
      actualCharacters: competitorTranscript.text.length,
    };
  }

  return { ok: true };
}

// ── Model caller (dependency-injected; no real OpenAI call in tests) ─────

export type CompetitorComparisonModelOutput = {
  raw: string;
  modelUsed: string;
};

export type CompetitorComparisonModelCaller = (input: {
  systemPrompt: string;
  userPrompt: string;
}) => Promise<CompetitorComparisonModelOutput>;

// Thrown when the model call itself succeeded (transport-level) but the
// result is unusable — empty output, non-JSON output, or output that
// failed the real merged validator. Retried exactly once, the same as a
// transient upstream failure, via isRetryableComparisonError below.
class UnusableComparisonResponseError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "UnusableComparisonResponseError";
  }
}

// isTransientUpstreamError is reused unmodified from lib/ai-transient-retry.ts
// — already confirmed Responses-API-compatible by
// lib/competitor-scripts/analysis/provider.ts's own audit comment, which
// this file does not repeat verbatim but relies on unchanged.
function isRetryableComparisonError(error: unknown): boolean {
  return error instanceof UnusableComparisonResponseError || isTransientUpstreamError(error);
}

// Production model caller. Takes the API key as an explicit parameter —
// this function never reads process.env itself; composing it with a real
// key from the environment is a future API route's job, not this
// provider's.
export function createOpenAICompetitorComparisonModelCaller(config: {
  apiKey: string;
}): CompetitorComparisonModelCaller {
  return async ({ systemPrompt, userPrompt }) => {
    const openai = new OpenAI({
      apiKey: config.apiKey,
      timeout: COMPETITOR_COMPARISON_TIMEOUT_MS,
      maxRetries: 0,
    });

    const response = await openai.responses.create({
      model: COMPETITOR_COMPARISON_MODEL,
      reasoning: { effort: COMPETITOR_COMPARISON_REASONING_EFFORT },
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: COMPETITOR_COMPARISON_MAX_OUTPUT_TOKENS,
      text: {
        format: {
          type: "json_schema",
          name: "competitor_script_comparison",
          strict: true,
          schema: COMPARISON_JSON_SCHEMA,
        },
      },
    });

    const raw = response.output_text?.trim() ?? "";
    if (raw.length === 0) {
      throw new UnusableComparisonResponseError("The model returned an empty response.");
    }

    return { raw, modelUsed: response.model || COMPETITOR_COMPARISON_MODEL };
  };
}

// ── Provider result contract ──────────────────────────────────────────────

// The two too-long codes reuse ComparisonSizeCheckResult's exact
// false-branch shapes above, unmodified. comparison_invalid_response/
// comparison_unavailable are new provider-level outcomes, collapsing
// "malformed JSON," "empty output," and "validator-rejected" into the one
// same code — the same collapse Analyze's analysis_invalid_response
// already makes, not a new distinction Analyze doesn't draw. Neither
// carries a free-text `reason` — the internal validator/error detail that
// drove the decision stays fully internal to this file (used only to
// build the one-line corrective retry instruction below) and is never
// part of this public contract.
export type CompetitorComparisonProviderResult =
  | { ok: true; comparison: CompetitorScriptComparison }
  | {
      ok: false;
      code: "user_script_too_long_for_comparison";
      maxCharacters: number;
      actualCharacters: number;
    }
  | {
      ok: false;
      code: "competitor_transcript_too_long_for_comparison";
      maxCharacters: number;
      actualCharacters: number;
    }
  | { ok: false; code: "comparison_invalid_response" }
  | { ok: false; code: "comparison_unavailable" };

// One concise corrective instruction derived from the specific validator
// failure, appended to the user prompt on the single retry only — never a
// large per-error-code branching prompt system. This uses the internal
// error detail (validator code/reason) purely to help the SAME model
// correct itself on the next attempt — it is never part of the public
// result type above, never logged, and never contains the full user
// script or the full competitor transcript (only whatever short fragment
// of the model's own already-rejected output the validator's reason
// string happened to quote). Mirrors
// lib/competitor-scripts/analysis/provider.ts's buildCorrectiveInstruction
// exactly.
function buildCorrectiveInstruction(error: UnusableComparisonResponseError): string {
  return `Your previous response was rejected for this reason: ${error.message}. Fix specifically this issue and resend a single complete, valid JSON response that follows every rule above.`;
}

// Never leaks the internal validator reason or any raw SDK error message
// into the public result — both failure branches carry only a `code`.
function toProviderFailure(error: unknown): CompetitorComparisonProviderResult {
  if (error instanceof UnusableComparisonResponseError) {
    return { ok: false, code: "comparison_invalid_response" };
  }

  return { ok: false, code: "comparison_unavailable" };
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function runCompetitorScriptComparison(input: {
  userScript: string;
  competitorTranscript: NormalizedTranscript;
  locale: ComparisonLocale;
  modelCaller: CompetitorComparisonModelCaller;
}): Promise<CompetitorComparisonProviderResult> {
  const { userScript, competitorTranscript, locale, modelCaller } = input;

  const sizeCheck = checkComparisonInputSize({ userScript, competitorTranscript });
  if (!sizeCheck.ok) {
    return sizeCheck;
  }

  async function attempt(correctiveInstruction?: string): Promise<CompetitorScriptComparison> {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({
      userScript,
      competitorTranscript,
      locale,
      correctiveInstruction,
    });

    const modelOutput = await modelCaller({ systemPrompt, userPrompt });

    let candidate: unknown;
    try {
      candidate = JSON.parse(modelOutput.raw);
    } catch {
      throw new UnusableComparisonResponseError("The model's output was not valid JSON.");
    }

    const validation = validateCompetitorScriptComparison({
      candidate,
      userScript,
      competitorTranscript,
      expectedLocale: locale,
    });

    if (!validation.ok) {
      throw new UnusableComparisonResponseError(
        `${validation.failure.code}: ${validation.failure.reason}`
      );
    }

    return validation.comparison;
  }

  // Structurally bounded at two total calls: `attempt()` appears at
  // exactly two call sites in this function (never in a loop, never
  // recursively), so a third call is not reachable.
  try {
    return { ok: true, comparison: await attempt() };
  } catch (firstError) {
    if (!isRetryableComparisonError(firstError)) {
      return toProviderFailure(firstError);
    }

    await delay(COMPETITOR_COMPARISON_RETRY_DELAY_MS);

    const correctiveInstruction =
      firstError instanceof UnusableComparisonResponseError
        ? buildCorrectiveInstruction(firstError)
        : undefined;

    try {
      return { ok: true, comparison: await attempt(correctiveInstruction) };
    } catch (secondError) {
      return toProviderFailure(secondError);
    }
  }
}
