// Shared structured server-side failure logging for AI-backed routes
// (/api/improve-script, /api/improve). Deliberately excludes script, title,
// prompt, full model response, API keys, and headers/cookies — only
// structural, non-content diagnostics are kept.

export type AIRouteFailureLog = {
  requestId: string;
  endpoint: string;
  locale: string;
  failureStage: string;
  errorCategory: string;
  upstreamStatus: number | null;
  retryCount: number;
  resultStatus: string | null;
};

export function logAIRouteFailure(
  input: AIRouteFailureLog
): void {
  console.error("[ai-route] request failed", input);
}
