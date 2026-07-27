// Pure, server-safe YouTube URL validation and canonicalization — no
// network access, no assumption that the video actually exists. This is
// the smallest correct foundation for a future Analyze Competitor flow:
// it only proves a submitted string is a syntactically valid, public-
// shaped YouTube video/Shorts link and extracts its 11-character video id.

export type YouTubeUrlSourceFormat = "watch" | "shorts" | "short";

export type YouTubeUrlErrorCode =
  | "empty"
  | "invalid_url"
  | "unsupported_host"
  | "unsupported_path"
  | "missing_video_id"
  | "invalid_video_id";

export type YouTubeUrlResult =
  | {
      ok: true;
      videoId: string;
      canonicalUrl: string;
      sourceFormat: YouTubeUrlSourceFormat;
    }
  | {
      ok: false;
      code: YouTubeUrlErrorCode;
    };

// Exact-match allow-list only — never a suffix/`.includes()` check. That
// distinction is what actually prevents a deceptive host like
// "youtube.com.example.com" (itself a real, unrelated domain that merely
// contains "youtube.com" as a substring) from being accepted.
const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// Exported so other server-side modules (e.g. the transcript foundation)
// can validate an already-extracted video id without duplicating the
// pattern.
export function isValidYouTubeVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value);
}

function buildCanonicalUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Never throws — every rejection path returns a typed { ok: false, code }
// result instead, so callers (the API route, the future UI) can react to a
// specific, stable reason rather than parsing an error message.
export function normalizeYouTubeVideoUrl(
  input: string
): YouTubeUrlResult {
  if (typeof input !== "string") {
    return { ok: false, code: "empty" };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return { ok: false, code: "empty" };
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, code: "invalid_url" };
  }

  // Rejects javascript:/data:/file:/etc — only ever http(s) is a public,
  // fetchable video link.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, code: "invalid_url" };
  }

  // Rejects credentials embedded in the URL (e.g. https://user:pass@host/...).
  if (parsed.username !== "" || parsed.password !== "") {
    return { ok: false, code: "invalid_url" };
  }

  const host = parsed.hostname.toLowerCase();

  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, code: "unsupported_host" };
  }

  const pathSegments = parsed.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") {
    if (pathSegments.length === 0) {
      return { ok: false, code: "missing_video_id" };
    }

    if (pathSegments.length !== 1) {
      return { ok: false, code: "unsupported_path" };
    }

    const videoId = pathSegments[0];

    if (!isValidYouTubeVideoId(videoId)) {
      return { ok: false, code: "invalid_video_id" };
    }

    return {
      ok: true,
      videoId,
      canonicalUrl: buildCanonicalUrl(videoId),
      sourceFormat: "short",
    };
  }

  if (parsed.pathname === "/watch") {
    const videoId = parsed.searchParams.get("v");

    if (videoId === null || videoId.length === 0) {
      return { ok: false, code: "missing_video_id" };
    }

    if (!isValidYouTubeVideoId(videoId)) {
      return { ok: false, code: "invalid_video_id" };
    }

    return {
      ok: true,
      videoId,
      canonicalUrl: buildCanonicalUrl(videoId),
      sourceFormat: "watch",
    };
  }

  if (parsed.pathname.startsWith("/shorts/")) {
    if (pathSegments.length < 2) {
      return { ok: false, code: "missing_video_id" };
    }

    if (pathSegments.length !== 2) {
      return { ok: false, code: "unsupported_path" };
    }

    const videoId = pathSegments[1];

    if (!isValidYouTubeVideoId(videoId)) {
      return { ok: false, code: "invalid_video_id" };
    }

    return {
      ok: true,
      videoId,
      canonicalUrl: buildCanonicalUrl(videoId),
      sourceFormat: "shorts",
    };
  }

  // Covers playlist-only, channel, user, embed, live, and any other
  // recognized-host-but-unsupported path shape.
  return { ok: false, code: "unsupported_path" };
}

export function extractYouTubeVideoId(input: string): string | null {
  const result = normalizeYouTubeVideoUrl(input);
  return result.ok ? result.videoId : null;
}
