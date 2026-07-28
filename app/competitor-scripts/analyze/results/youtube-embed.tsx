import { isValidYouTubeVideoId } from "../../../../lib/competitor-scripts/youtube-url";

// The embed src is built from nothing but the already-validated 11-char
// videoId — never from the stored watch-page link or any other session-
// supplied string — and re-validates that shape itself as a defense-in-
// depth boundary, independent of whatever already validated it upstream.
// No query params are added: that keeps this at YouTube's own playback
// defaults (nothing forced on, nothing forced silent), which is exactly
// what's wanted here — this is a real video player, not a fake custom one.
export function YouTubeEmbed({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  if (!isValidYouTubeVideoId(videoId)) {
    return null;
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-[16px] bg-black"
      style={{ aspectRatio: "9 / 16" }}
    >
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
