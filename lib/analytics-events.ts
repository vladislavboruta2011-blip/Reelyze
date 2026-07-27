// Strict allowlisted contract for the analyzer funnel events. Nothing in
// this module accepts arbitrary event names or properties — every event
// that can be constructed here is one of the four approved funnel events,
// with only categorical/enum-shaped properties. No script text, analysis
// content, or user identity has a place to go in this contract at all, by
// construction (not by convention).
import { getMessages } from "./messages";
import type { Locale } from "./i18n";

export const ANALYTICS_LOCALES = ["en", "ru"] as const;
export type AnalyticsLocale = (typeof ANALYTICS_LOCALES)[number];

export const LENGTH_BUCKETS = [
  "1-250",
  "251-500",
  "501-750",
  "751-1000",
] as const;
export type LengthBucket = (typeof LENGTH_BUCKETS)[number];

export const INPUT_SOURCES = ["manual", "example"] as const;
export type InputSource = (typeof INPUT_SOURCES)[number];

export const FAILURE_CATEGORIES = [
  "network",
  "timeout",
  "rate_limited",
  "invalid_response",
  "server",
  "unknown",
] as const;
export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

export const ANALYTICS_VERDICTS = ["strong", "mixed", "weak"] as const;
export type AnalyticsVerdict = (typeof ANALYTICS_VERDICTS)[number];

export type AnalyzerExampleInsertedEvent = {
  name: "analyzer_example_inserted";
  properties: {
    locale: AnalyticsLocale;
  };
};

export type AnalysisSubmittedEvent = {
  name: "analysis_submitted";
  properties: {
    locale: AnalyticsLocale;
    input_source: InputSource;
    length_bucket: LengthBucket;
  };
};

export type AnalysisSucceededEvent = {
  name: "analysis_succeeded";
  properties: {
    locale: AnalyticsLocale;
    input_source: InputSource;
    length_bucket: LengthBucket;
    verdict?: AnalyticsVerdict;
  };
};

export type AnalysisFailedEvent = {
  name: "analysis_failed";
  properties: {
    locale: AnalyticsLocale;
    input_source: InputSource;
    length_bucket: LengthBucket;
    failure_category: FailureCategory;
  };
};

export type AnalyticsEvent =
  | AnalyzerExampleInsertedEvent
  | AnalysisSubmittedEvent
  | AnalysisSucceededEvent
  | AnalysisFailedEvent;

export type AnalyticsEventName = AnalyticsEvent["name"];

export const ANALYTICS_EVENT_NAMES = [
  "analyzer_example_inserted",
  "analysis_submitted",
  "analysis_succeeded",
  "analysis_failed",
] as const satisfies readonly AnalyticsEventName[];

// Any locale outside the two launched locales already falls back to the
// English message catalog (see getMessages in lib/messages.ts) — this
// mirrors that same fallback so an unlaunched-locale visitor is reported
// as "en", never as a raw/unexpected value.
export function toAnalyticsLocale(locale: Locale): AnalyticsLocale {
  return locale === "ru" ? "ru" : "en";
}

// Matches the approved bucket boundaries exactly: 1-250, 251-500, 501-750,
// 751-1000. Only ever called with an already-validated 1..1000 length (the
// existing empty/over-limit checks run first), so lengths outside that
// range are not a real path — the final bucket is used as a safe fallback.
export function bucketScriptLength(length: number): LengthBucket {
  if (length <= 250) {
    return "1-250";
  }

  if (length <= 500) {
    return "251-500";
  }

  if (length <= 750) {
    return "501-750";
  }

  return "751-1000";
}

// A submission counts as "example" only when the script in the textarea at
// submit time is byte-identical to one of the two approved localized
// example scripts (checked against both locales, not just the current UI
// locale, so switching locale after inserting an example doesn't
// misclassify it as "manual"). Any edit at all — even one character —
// makes it "manual". This never persists anything; it is a plain string
// comparison against values already in the static message catalog.
export function detectInputSource(script: string): InputSource {
  const enExample = getMessages("en").landing.analyzer.exampleScript;
  const ruExample = getMessages("ru").landing.analyzer.exampleScript;

  if (script === enExample || script === ruExample) {
    return "example";
  }

  return "manual";
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

// Rebuilds a brand-new object containing only known, validated keys —
// never spreads or forwards the raw incoming payload. Used server-side as
// defense in depth: even though the client only ever calls trackEvent()
// with compiler-checked arguments, this route has no way to know that a
// given request actually came from that code path, so it must re-validate
// from scratch and drop anything that doesn't match the allowlist exactly.
export function validateAnalyticsEvent(raw: unknown): AnalyticsEvent | null {
  if (!isPlainObject(raw)) {
    return null;
  }

  const { name, properties } = raw;

  if (typeof name !== "string" || !isPlainObject(properties)) {
    return null;
  }

  const keys = Object.keys(properties);

  if (name === "analyzer_example_inserted") {
    if (
      keys.length !== 1 ||
      !isOneOf(properties.locale, ANALYTICS_LOCALES)
    ) {
      return null;
    }

    return {
      name,
      properties: { locale: properties.locale },
    };
  }

  if (name === "analysis_submitted") {
    if (
      keys.length !== 3 ||
      !isOneOf(properties.locale, ANALYTICS_LOCALES) ||
      !isOneOf(properties.input_source, INPUT_SOURCES) ||
      !isOneOf(properties.length_bucket, LENGTH_BUCKETS)
    ) {
      return null;
    }

    return {
      name,
      properties: {
        locale: properties.locale,
        input_source: properties.input_source,
        length_bucket: properties.length_bucket,
      },
    };
  }

  if (name === "analysis_succeeded") {
    const allowedKeys = new Set([
      "locale",
      "input_source",
      "length_bucket",
      "verdict",
    ]);

    if (
      keys.length < 3 ||
      keys.length > 4 ||
      keys.some((key) => !allowedKeys.has(key)) ||
      !isOneOf(properties.locale, ANALYTICS_LOCALES) ||
      !isOneOf(properties.input_source, INPUT_SOURCES) ||
      !isOneOf(properties.length_bucket, LENGTH_BUCKETS) ||
      (properties.verdict !== undefined &&
        !isOneOf(properties.verdict, ANALYTICS_VERDICTS))
    ) {
      return null;
    }

    const succeededEvent: AnalysisSucceededEvent = {
      name,
      properties: {
        locale: properties.locale,
        input_source: properties.input_source,
        length_bucket: properties.length_bucket,
      },
    };

    if (properties.verdict !== undefined) {
      succeededEvent.properties.verdict = properties.verdict as AnalyticsVerdict;
    }

    return succeededEvent;
  }

  if (name === "analysis_failed") {
    if (
      keys.length !== 4 ||
      !isOneOf(properties.locale, ANALYTICS_LOCALES) ||
      !isOneOf(properties.input_source, INPUT_SOURCES) ||
      !isOneOf(properties.length_bucket, LENGTH_BUCKETS) ||
      !isOneOf(properties.failure_category, FAILURE_CATEGORIES)
    ) {
      return null;
    }

    return {
      name,
      properties: {
        locale: properties.locale,
        input_source: properties.input_source,
        length_bucket: properties.length_bucket,
        failure_category: properties.failure_category,
      },
    };
  }

  return null;
}
