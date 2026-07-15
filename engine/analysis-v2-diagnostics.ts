import type { AnalysisV2ResponseContractReason } from "./analysis-v2-ui-adapter";

// Safe-logging helper for the /api/analyze-v2 frontend contract check.
// Deliberately excludes the script, title, prompt, full payload, API keys,
// and headers/cookies — only structural, non-content diagnostics are kept.

export type AnalysisV2UnexpectedResponseLogInput = {
  endpoint: string;
  httpStatus: number;
  contentType: string | null;
  uiLocale: string;
  reason: AnalysisV2ResponseContractReason;
  payload: unknown;
  requestId: string | null;
  retryCount: number | null;
};

export type AnalysisV2UnexpectedResponseLogEntry = {
  endpoint: string;
  httpStatus: number;
  contentType: string | null;
  uiLocale: string;
  reason: AnalysisV2ResponseContractReason;
  payloadKeys: string[];
  payloadStatus: string | null;
  requestId: string | null;
  retryCount: number | null;
};

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getTopLevelPayloadKeys(
  payload: unknown
): string[] {
  if (!isPlainObject(payload)) {
    return [];
  }

  return Object.keys(payload);
}

// Only the status/error-code discriminant, never any explanatory text
// (which could echo user-authored content back into logs).
function getPayloadStatusOrCode(
  payload: unknown
): string | null {
  if (!isPlainObject(payload)) {
    return null;
  }

  if (typeof payload.status === "string") {
    return payload.status;
  }

  if (typeof payload.code === "string") {
    return payload.code;
  }

  return null;
}

export function buildAnalysisV2UnexpectedResponseLog(
  input: AnalysisV2UnexpectedResponseLogInput
): AnalysisV2UnexpectedResponseLogEntry {
  return {
    endpoint: input.endpoint,
    httpStatus: input.httpStatus,
    contentType: input.contentType,
    uiLocale: input.uiLocale,
    reason: input.reason,
    payloadKeys: getTopLevelPayloadKeys(input.payload),
    payloadStatus: getPayloadStatusOrCode(input.payload),
    requestId: input.requestId,
    retryCount: input.retryCount,
  };
}

export function logAnalysisV2UnexpectedResponse(
  input: AnalysisV2UnexpectedResponseLogInput
): void {
  console.error(
    "[analyze-v2] rejected response contract",
    buildAnalysisV2UnexpectedResponseLog(input)
  );
}
