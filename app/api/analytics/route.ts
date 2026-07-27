import { validateAnalyticsEvent } from "@/lib/analytics-events";

export const runtime = "nodejs";

// First-party, privacy-safe funnel logging: no third-party provider, no
// cookies, no database table. Every incoming payload is re-validated from
// scratch against the strict allowlist in lib/analytics-events.ts — an
// unknown event name, an extra property, or a value outside the approved
// enums is dropped rather than logged. Only the resulting, narrow,
// validated object is ever written to the log, never the raw request body.
export async function POST(request: Request): Promise<Response> {
  let rawPayload: unknown;

  try {
    rawPayload = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const event = validateAnalyticsEvent(rawPayload);

  if (!event) {
    return new Response(null, { status: 400 });
  }

  console.info("Climpy funnel event", {
    name: event.name,
    properties: event.properties,
  });

  return new Response(null, { status: 204 });
}
