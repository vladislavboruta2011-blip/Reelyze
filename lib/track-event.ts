"use client";

import type { AnalyticsEvent } from "./analytics-events";

// Best-effort funnel-event sender. Never throws, never awaited by the
// caller, and never runs during server rendering — a failed or slow
// analytics call must never block or delay the Analyze flow. `keepalive`
// gives the request a chance to complete even if the page is about to
// navigate away (e.g. the analysis_succeeded call fired just before
// router.push("/results")).
export function trackEvent<E extends AnalyticsEvent["name"]>(
  name: E,
  properties: Extract<AnalyticsEvent, { name: E }>["properties"]
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    void fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, properties }),
      keepalive: true,
    }).catch(() => {
      // Analytics must never surface an error to the user.
    });
  } catch {
    // Synchronous failures (e.g. fetch unavailable) must not break Analyze.
  }
}
