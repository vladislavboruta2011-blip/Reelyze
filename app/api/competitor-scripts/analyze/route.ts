import {
  normalizeYouTubeVideoUrl,
  type YouTubeUrlErrorCode,
  type YouTubeUrlSourceFormat,
} from "@/lib/competitor-scripts/youtube-url";

// Backend foundation only: validates and normalizes a submitted YouTube
// URL. Does not fetch, transcribe, or analyze the video in any way.
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4 * 1024;
const MAX_URL_LENGTH = 2048;

type AnalyzeRequestErrorCode =
  | "invalid_content_type"
  | "body_too_large"
  | "invalid_json"
  | "invalid_body"
  | "missing_url"
  | "url_not_string"
  | "url_too_long"
  | "internal_error"
  | YouTubeUrlErrorCode;

type AnalyzeSuccessResponse = {
  ok: true;
  input: {
    videoId: string;
    canonicalUrl: string;
    sourceFormat: YouTubeUrlSourceFormat;
  };
  status: "validated";
};

type AnalyzeErrorResponse = {
  ok: false;
  error: {
    code: AnalyzeRequestErrorCode;
    message: string;
  };
};

const ERROR_MESSAGES: Record<AnalyzeRequestErrorCode, string> = {
  invalid_content_type: "Unsupported content type. Use application/json.",
  body_too_large: "Request body is too large.",
  invalid_json: "Request body is not valid JSON.",
  invalid_body: "Request body must be a JSON object.",
  missing_url: "A competitor video URL is required.",
  url_not_string: "The competitor video URL must be a string.",
  url_too_long: "The competitor video URL is too long.",
  empty: "Paste a competitor video URL to continue.",
  invalid_url: "That doesn't look like a valid URL.",
  unsupported_host: "This doesn't look like a public YouTube link.",
  unsupported_path: "This doesn't look like a public YouTube video or Shorts link.",
  missing_video_id: "This link is missing a video id.",
  invalid_video_id: "This link's video id doesn't look valid.",
  internal_error: "Something went wrong. Please try again.",
};

class RequestBodyTooLargeError extends Error {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(
  body: AnalyzeSuccessResponse | AnalyzeErrorResponse,
  status: number
): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(code: AnalyzeRequestErrorCode, status: number): Response {
  return jsonResponse(
    { ok: false, error: { code, message: ERROR_MESSAGES[code] } },
    status
  );
}

async function readJsonBodyWithLimit(request: Request): Promise<unknown> {
  const body = await request.text();

  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    throw new RequestBodyTooLargeError();
  }

  return JSON.parse(body) as unknown;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const contentType =
      request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ??
      "";

    if (contentType !== "application/json") {
      return errorResponse("invalid_content_type", 415);
    }

    let rawBody: unknown;

    try {
      rawBody = await readJsonBodyWithLimit(request);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return errorResponse("body_too_large", 413);
      }
      return errorResponse("invalid_json", 400);
    }

    if (!isPlainObject(rawBody)) {
      return errorResponse("invalid_body", 400);
    }

    const { url } = rawBody;

    if (url === undefined || url === null) {
      return errorResponse("missing_url", 400);
    }

    if (typeof url !== "string") {
      return errorResponse("url_not_string", 400);
    }

    if (url.length > MAX_URL_LENGTH) {
      return errorResponse("url_too_long", 400);
    }

    const result = normalizeYouTubeVideoUrl(url);

    if (!result.ok) {
      return errorResponse(result.code, 400);
    }

    // Safe, structural logging only — the raw submitted URL is never
    // logged, only the already-validated, non-sensitive derived id.
    console.info("Competitor Scripts analyze: request validated", {
      videoId: result.videoId,
      sourceFormat: result.sourceFormat,
    });

    return jsonResponse(
      {
        ok: true,
        input: {
          videoId: result.videoId,
          canonicalUrl: result.canonicalUrl,
          sourceFormat: result.sourceFormat,
        },
        status: "validated",
      },
      200
    );
  } catch (error) {
    console.error("Competitor Scripts analyze: unexpected error", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return errorResponse("internal_error", 500);
  }
}
