import {
  UnusableAIResponseError,
  hasAnyConcreteAnchor,
  isVeryGenericScript,
} from "./improve-hook";

export type ImproveScriptResult = {
  status: "improved" | "diagnostic" | "error";
  improvedScript: string;
  changes: string[];
  reason: string;
  missingMaterial?: string[];
};

const FALLBACK_DIAGNOSTIC_SCRIPT =
  "Add one concrete example, result, number, visual moment, or clear payoff before generating a full rewrite.";

const FALLBACK_DIAGNOSTIC_REASON =
  "The script is too broad to rewrite safely without inventing unsupported facts or a stronger payoff.";

const MAX_IMPROVED_SCRIPT_LENGTH = 1_400;
const MAX_REASON_LENGTH = 600;
const MAX_CHANGE_LENGTH = 220;
const MAX_CHANGES = 6;
const MAX_MISSING_MATERIAL_ITEMS = 5;

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function normalizeStringList(
  value: unknown,
  fallback: string[],
  maxItems: number,
  maxItemLength: number
): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => truncateText(item, maxItemLength))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);

  return items.length > 0 ? items : fallback;
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new UnusableAIResponseError();
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new UnusableAIResponseError();
    }

    return parsed as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new UnusableAIResponseError();
    }

    const extracted = trimmed.slice(start, end + 1);
    const parsed = JSON.parse(extracted);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new UnusableAIResponseError();
    }

    return parsed as Record<string, unknown>;
  }
}

function collectNumbersWithUnits(text: string): Set<string> {
  const matches = text.matchAll(
    /\b\d+(?:[.,]\d+)?\s?(?:%|percent|seconds?|minutes?|hours?|days?|weeks?|months?|years?|feet|foot|ft|inches?|mph|miles?|km|kilometers?|metres?|meters?|cm|centimeters?|mm|millimeters?|degrees?|billion|million|thousand)\b/gi
  );

  return new Set(
    Array.from(matches, (match) =>
      match[0].toLowerCase().replace(/\s+/g, " ").trim()
    )
  );
}

function usesUnsupportedNumberWithUnit(
  originalScript: string,
  improvedScript: string
): boolean {
  const originalNumbers = collectNumbersWithUnits(originalScript);
  const improvedNumbers = collectNumbersWithUnits(improvedScript);

  for (const number of improvedNumbers) {
    if (!originalNumbers.has(number)) {
      return true;
    }
  }

  return false;
}

export function buildImproveScriptDiagnosticResponse(
  reason = FALLBACK_DIAGNOSTIC_REASON
): ImproveScriptResult {
  return {
    status: "diagnostic",
    improvedScript: FALLBACK_DIAGNOSTIC_SCRIPT,
    changes: [
      "No full rewrite was generated because the script needs more concrete source material first.",
    ],
    reason,
    missingMaterial: [
      "A specific example",
      "A concrete visual moment",
      "A clear payoff",
      "A number, result, or consequence",
    ],
  };
}

export function shouldDiagnoseImproveScript(script: string): boolean {
  const trimmedScript = script.trim();

  if (trimmedScript.length === 0) {
    return true;
  }

  if (!hasAnyConcreteAnchor(trimmedScript)) {
    return true;
  }

  return isVeryGenericScript(trimmedScript).isGeneric;
}

export function boundImproveScriptResult(
  result: ImproveScriptResult
): ImproveScriptResult {
  return {
    status: result.status,
    improvedScript: truncateText(
      result.improvedScript || FALLBACK_DIAGNOSTIC_SCRIPT,
      MAX_IMPROVED_SCRIPT_LENGTH
    ),
    changes: normalizeStringList(
      result.changes,
      ["The rewrite was cleaned up for clarity and pacing."],
      MAX_CHANGES,
      MAX_CHANGE_LENGTH
    ),
    reason: truncateText(
      result.reason || "Climpy generated a safer script improvement.",
      MAX_REASON_LENGTH
    ),
    ...(result.missingMaterial
      ? {
          missingMaterial: normalizeStringList(
            result.missingMaterial,
            [],
            MAX_MISSING_MATERIAL_ITEMS,
            MAX_CHANGE_LENGTH
          ),
        }
      : {}),
  };
}

export function parseImproveScriptResponse(
  raw: string,
  originalScript: string
): ImproveScriptResult {
  const script = originalScript.trim();

  if (shouldDiagnoseImproveScript(script)) {
    return buildImproveScriptDiagnosticResponse();
  }

  const parsed = extractJsonObject(raw);
  const improvedScript =
    typeof parsed.improvedScript === "string"
      ? parsed.improvedScript.trim()
      : "";

  if (!improvedScript) {
    throw new UnusableAIResponseError();
  }

  if (usesUnsupportedNumberWithUnit(script, improvedScript)) {
    return buildImproveScriptDiagnosticResponse(
      "The generated rewrite introduced a number or measurement that was not supported by the original script."
    );
  }

  const result: ImproveScriptResult = {
    status: "improved",
    improvedScript,
    changes: normalizeStringList(
      parsed.changes,
      ["The rewrite improves clarity, pacing, and payoff delivery."],
      MAX_CHANGES,
      MAX_CHANGE_LENGTH
    ),
    reason:
      typeof parsed.reason === "string" && parsed.reason.trim().length > 0
        ? parsed.reason.trim()
        : "The script was rewritten using only the original material while improving clarity and pacing.",
  };

  return boundImproveScriptResult(result);
}
