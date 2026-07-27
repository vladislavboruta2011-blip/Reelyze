// Format-only check shared by the Analyze and Compare input forms — never
// contacts YouTube or any backend. A syntactically valid, YouTube-hostname
// URL is the most any UI-only phase can ever verify; whether the video is
// actually public, and whether a transcript exists, can only be known once
// real extraction exists (a later PR).
export function isSupportedVideoUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "youtu.be")
    );
  } catch {
    return false;
  }
}
