import { normalizeApiLocale, type Locale } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export type FeedbackRating = "helpful" | "unhelpful";

type FeedbackPayload = {
  rating: FeedbackRating;
  reason: string | null;
  text: string | null;
  title: string;
  script: string;
  overallScore: number | null;
  hookScore: number | null;
  retentionRisk: number | null;
  mainTakeaway: string | null;
  currentPath: string | null;
  // Diagnostic-only — the "feedback" table has no locale column (see
  // app/api/admin/feedback/route.ts's explicit select list), so this is
  // never persisted to Supabase, only used for safe structured logging.
  locale: Locale;
};

const MAX_BODY_BYTES = 8 * 1024;
const MAX_TITLE_LENGTH = 200;
const MAX_SCRIPT_LENGTH = 1000;
const MAX_REASON_LENGTH = 80;
const MAX_TEXT_LENGTH = 1000;
const MAX_TAKEAWAY_LENGTH = 1000;
const MAX_PATH_LENGTH = 300;

function createJsonResponse(
  body: Record<string, unknown>,
  status: number
): Response {
  return Response.json(body, { status });
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function readJsonBodyWithLimit(
  request: Request
): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Unsupported content type.");
  }

  const body = await request.text();

  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("Malformed JSON.");
  }
}

function readRequiredString(
  payload: Record<string, unknown>,
  key: string,
  maxLength: number
): string | null {
  const value = payload[key];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return null;
  }

  return trimmed;
}

function readOptionalString(
  payload: Record<string, unknown>,
  key: string,
  maxLength: number
): string | null {
  const value = payload[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > maxLength) {
    return null;
  }

  return trimmed;
}

function readOptionalScore(
  payload: Record<string, unknown>,
  key: string
): number | null {
  const value = payload[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  ) {
    return null;
  }

  return value;
}

function parseFeedbackPayload(
  rawPayload: unknown
): FeedbackPayload | null {
  if (!isPlainObject(rawPayload)) {
    return null;
  }

  const rating = rawPayload.rating;

  if (rating !== "helpful" && rating !== "unhelpful") {
    return null;
  }

  const title = readRequiredString(
    rawPayload,
    "title",
    MAX_TITLE_LENGTH
  );
  const script = readRequiredString(
    rawPayload,
    "script",
    MAX_SCRIPT_LENGTH
  );

  if (!title || !script) {
    return null;
  }

  return {
    rating,
    reason: readOptionalString(
      rawPayload,
      "reason",
      MAX_REASON_LENGTH
    ),
    text: readOptionalString(rawPayload, "text", MAX_TEXT_LENGTH),
    title,
    script,
    overallScore: readOptionalScore(rawPayload, "overallScore"),
    hookScore: readOptionalScore(rawPayload, "hookScore"),
    retentionRisk: readOptionalScore(rawPayload, "retentionRisk"),
    mainTakeaway: readOptionalString(
      rawPayload,
      "mainTakeaway",
      MAX_TAKEAWAY_LENGTH
    ),
    currentPath: readOptionalString(
      rawPayload,
      "currentPath",
      MAX_PATH_LENGTH
    ),
    // normalizeApiLocale's default availableLocales is LAUNCHED_LOCALES
    // ("en" | "ru"), so this is always one of Locale's launched values —
    // missing/invalid input safely defaults to "en", never rejects.
    locale: normalizeApiLocale(rawPayload.locale),
  };
}

function createScriptPreview(script: string): string {
  return script.length > 220
    ? `${script.slice(0, 220)}...`
    : script;
}

async function persistFeedback(
  feedback: FeedbackPayload,
  createdAt: string
): Promise<void> {
  const { error } = await supabase.from("feedback").insert({
    rating: feedback.rating,
    reason: feedback.reason,
    text: feedback.text,
    title: feedback.title,
    script_preview: createScriptPreview(feedback.script),
    overall_score: feedback.overallScore,
    hook_score: feedback.hookScore,
    retention_risk: feedback.retentionRisk,
    main_takeaway: feedback.mainTakeaway,
    current_path: feedback.currentPath,
    created_at: createdAt,
  });

  if (error) {
    throw error;
  }
}

export async function POST(request: Request): Promise<Response> {
  let rawPayload: unknown;

  try {
    rawPayload = await readJsonBodyWithLimit(request);
  } catch {
    return createJsonResponse(
      {
        status: "error",
        reason: "Feedback request could not be processed.",
      },
      400
    );
  }

  const feedback = parseFeedbackPayload(rawPayload);

  if (!feedback) {
    return createJsonResponse(
      {
        status: "error",
        reason: "Feedback request is invalid.",
      },
      400
    );
  }

  const createdAt = new Date().toISOString();

  try {
    await persistFeedback(feedback, createdAt);
  } catch (error) {
    console.error("Failed to persist Reelyze feedback", error);

    return createJsonResponse(
      {
        status: "error",
        reason: "Feedback could not be saved.",
      },
      500
    );
  }

  // Structural/categorical fields only — never the script, title,
  // mainTakeaway, or the free-form "text" feedback itself (those are
  // arbitrary user/AI-authored content). They are safely persisted to
  // Supabase above for the admin dashboard, but must not appear in
  // runtime logs.
  console.info("Reelyze feedback received", {
    rating: feedback.rating,
    reason: feedback.reason,
    hasCustomText: feedback.text !== null,
    locale: feedback.locale,
    scores: {
      overall: feedback.overallScore,
      hook: feedback.hookScore,
      retentionRisk: feedback.retentionRisk,
    },
    currentPath: feedback.currentPath,
    createdAt,
  });

  return createJsonResponse({ status: "ok" }, 200);
}
