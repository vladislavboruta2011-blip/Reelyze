import OpenAI from "openai";

import { UnusableAIResponseError } from "@/engine/improve-hook";

// Shared, provider-agnostic primitives for classifying and bounded-retrying
// transient upstream AI-provider failures (dropped connection, timeout,
// rate limit, upstream 5xx). Used by every route that calls OpenAI directly
// (analyze-v2, improve-script, improve) so the classification and delay
// logic exists in exactly one place.

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function getUpstreamErrorStatus(
  error: unknown
): number | undefined {
  return typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status ===
      "number"
    ? (error as { status: number }).status
    : undefined;
}

// Transient: worth exactly one bounded retry. Excludes 401/403 (auth/config
// problems a retry cannot fix) and 400-class errors (deterministic
// rejections, e.g. validation) — those must not be retried.
export function isTransientUpstreamError(
  error: unknown
): boolean {
  if (error instanceof OpenAI.APIConnectionError) {
    return true;
  }

  const upstreamStatus = getUpstreamErrorStatus(error);

  return (
    upstreamStatus === 429 ||
    (upstreamStatus !== undefined && upstreamStatus >= 500)
  );
}

// Shared by /api/improve-script and /api/improve: a genuinely malformed or
// non-JSON model response (UnusableAIResponseError) is retried exactly
// once, the same as a transient upstream failure — never for deterministic
// rejections (400s, validation, or an honest editorial preserve/diagnostic,
// which are never thrown as errors in the first place).
export function isRetryableAIResponseError(
  error: unknown
): boolean {
  return (
    error instanceof UnusableAIResponseError ||
    isTransientUpstreamError(error)
  );
}

// Calls `attempt` once; on a retryable error, waits `delayMs` and calls it
// exactly one more time (sequential, never in parallel). Any other error,
// or a second failure, propagates to the caller unchanged.
export async function callWithBoundedRetry<T>(
  attempt: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  delayMs = 250
): Promise<{ result: T; retryCount: number }> {
  try {
    return { result: await attempt(), retryCount: 0 };
  } catch (error) {
    if (!shouldRetry(error)) {
      throw error;
    }

    await delay(delayMs);

    return { result: await attempt(), retryCount: 1 };
  }
}
