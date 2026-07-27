import {
  extractYouTubeVideoId,
  normalizeYouTubeVideoUrl,
} from "../lib/competitor-scripts/youtube-url";

let failures = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    console.log(`✅ PASS — ${name}`);
  } else {
    console.error(`❌ FAIL — ${name}`);
    failures += 1;
  }
}

console.log("\nCompetitor Scripts YouTube URL Tests\n");

const STANDARD_ID = "dQw4w9WgXcQ";
const HYPHEN_UNDERSCORE_ID = "aB3_x9-Z12Q";

// ── Valid inputs ─────────────────────────────────────────────────────────

{
  const result = normalizeYouTubeVideoUrl(
    `https://www.youtube.com/watch?v=${STANDARD_ID}`
  );
  check(
    "standard watch URL is accepted",
    result.ok && result.videoId === STANDARD_ID
  );
  check(
    "standard watch URL has sourceFormat watch",
    result.ok && result.sourceFormat === "watch"
  );
  check(
    "standard watch URL produces the canonical URL",
    result.ok &&
      result.canonicalUrl === `https://www.youtube.com/watch?v=${STANDARD_ID}`
  );
}

{
  const result = normalizeYouTubeVideoUrl(
    `https://youtube.com/watch?v=${STANDARD_ID}`
  );
  check(
    "watch URL without www is accepted",
    result.ok && result.videoId === STANDARD_ID && result.sourceFormat === "watch"
  );
}

{
  const result = normalizeYouTubeVideoUrl(
    `https://m.youtube.com/watch?v=${STANDARD_ID}`
  );
  check(
    "mobile watch URL is accepted",
    result.ok && result.videoId === STANDARD_ID && result.sourceFormat === "watch"
  );
}

{
  const result = normalizeYouTubeVideoUrl(`https://youtu.be/${STANDARD_ID}`);
  check(
    "youtu.be URL is accepted with sourceFormat short",
    result.ok && result.videoId === STANDARD_ID && result.sourceFormat === "short"
  );
  check(
    "youtu.be URL produces the canonical watch URL",
    result.ok &&
      result.canonicalUrl === `https://www.youtube.com/watch?v=${STANDARD_ID}`
  );
}

{
  const result = normalizeYouTubeVideoUrl(
    `https://www.youtube.com/shorts/${STANDARD_ID}`
  );
  check(
    "Shorts URL with www is accepted with sourceFormat shorts",
    result.ok && result.videoId === STANDARD_ID && result.sourceFormat === "shorts"
  );
}

{
  const result = normalizeYouTubeVideoUrl(
    `https://youtube.com/shorts/${STANDARD_ID}`
  );
  check(
    "Shorts URL without www is accepted with sourceFormat shorts",
    result.ok && result.videoId === STANDARD_ID && result.sourceFormat === "shorts"
  );
}

{
  const result = normalizeYouTubeVideoUrl(
    `https://www.youtube.com/watch?v=${STANDARD_ID}&si=abc123&feature=share&t=42&list=PLxyz`
  );
  check(
    "additional harmless query parameters are accepted",
    result.ok && result.videoId === STANDARD_ID
  );
  check(
    "harmless query parameters are stripped from the canonical URL",
    result.ok &&
      result.canonicalUrl === `https://www.youtube.com/watch?v=${STANDARD_ID}`
  );
}

{
  const result = normalizeYouTubeVideoUrl(`  https://youtu.be/${STANDARD_ID}  `);
  check(
    "surrounding whitespace is trimmed",
    result.ok && result.videoId === STANDARD_ID
  );
}

{
  const result = normalizeYouTubeVideoUrl(
    `https://www.youtube.com/watch?v=${HYPHEN_UNDERSCORE_ID}`
  );
  check(
    "IDs containing underscore and hyphen are accepted",
    result.ok && result.videoId === HYPHEN_UNDERSCORE_ID
  );
}

check(
  "extractYouTubeVideoId returns the id for a valid URL",
  extractYouTubeVideoId(`https://youtu.be/${STANDARD_ID}`) === STANDARD_ID
);

// ── Invalid inputs ───────────────────────────────────────────────────────

check(
  "empty input is rejected with code empty",
  (() => {
    const result = normalizeYouTubeVideoUrl("");
    return !result.ok && result.code === "empty";
  })()
);
check(
  "whitespace-only input is rejected with code empty",
  (() => {
    const result = normalizeYouTubeVideoUrl("   ");
    return !result.ok && result.code === "empty";
  })()
);
check(
  "random text is rejected with code invalid_url",
  (() => {
    const result = normalizeYouTubeVideoUrl("hello world");
    return !result.ok && result.code === "invalid_url";
  })()
);
check(
  "malformed URL is rejected with code invalid_url",
  (() => {
    const result = normalizeYouTubeVideoUrl("https://");
    return !result.ok && result.code === "invalid_url";
  })()
);
check(
  "javascript: protocol is rejected",
  (() => {
    const result = normalizeYouTubeVideoUrl(
      `javascript:alert(document.cookie)//${STANDARD_ID}`
    );
    return !result.ok && result.code === "invalid_url";
  })()
);
check(
  "data: protocol is rejected",
  (() => {
    const result = normalizeYouTubeVideoUrl("data:text/html,<script>1</script>");
    return !result.ok && result.code === "invalid_url";
  })()
);
check(
  "file: protocol is rejected",
  (() => {
    const result = normalizeYouTubeVideoUrl("file:///etc/passwd");
    return !result.ok && result.code === "invalid_url";
  })()
);
check(
  "non-http(s) protocol (ftp) is rejected",
  (() => {
    const result = normalizeYouTubeVideoUrl(`ftp://www.youtube.com/watch?v=${STANDARD_ID}`);
    return !result.ok && result.code === "invalid_url";
  })()
);
check(
  "deceptive YouTube-like domain is rejected as unsupported_host",
  (() => {
    const result = normalizeYouTubeVideoUrl(
      `https://youtube.com.evil.example/watch?v=${STANDARD_ID}`
    );
    return !result.ok && result.code === "unsupported_host";
  })()
);
check(
  "deceptive subdomain prefix is rejected as unsupported_host",
  (() => {
    const result = normalizeYouTubeVideoUrl(
      `https://youtube.com.attacker.io/watch?v=${STANDARD_ID}`
    );
    return !result.ok && result.code === "unsupported_host";
  })()
);
check(
  "non-YouTube domain is rejected as unsupported_host",
  (() => {
    const result = normalizeYouTubeVideoUrl(`https://vimeo.com/watch?v=${STANDARD_ID}`);
    return !result.ok && result.code === "unsupported_host";
  })()
);
check(
  "missing watch v parameter is rejected as missing_video_id",
  (() => {
    const result = normalizeYouTubeVideoUrl("https://www.youtube.com/watch");
    return !result.ok && result.code === "missing_video_id";
  })()
);
check(
  "empty Shorts path is rejected as missing_video_id",
  (() => {
    const result = normalizeYouTubeVideoUrl("https://www.youtube.com/shorts/");
    return !result.ok && result.code === "missing_video_id";
  })()
);
check(
  "malformed short id (invalid characters) is rejected as invalid_video_id",
  (() => {
    const result = normalizeYouTubeVideoUrl("https://youtu.be/!!!bad!!!!");
    return !result.ok && result.code === "invalid_video_id";
  })()
);
check(
  "id shorter than 11 characters is rejected as invalid_video_id",
  (() => {
    const result = normalizeYouTubeVideoUrl(
      "https://www.youtube.com/watch?v=short"
    );
    return !result.ok && result.code === "invalid_video_id";
  })()
);
check(
  "id longer than 11 characters is rejected as invalid_video_id",
  (() => {
    const result = normalizeYouTubeVideoUrl(
      `https://www.youtube.com/watch?v=${STANDARD_ID}EXTRA`
    );
    return !result.ok && result.code === "invalid_video_id";
  })()
);
check(
  "invalid id characters are rejected as invalid_video_id",
  (() => {
    const result = normalizeYouTubeVideoUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgX!Q"
    );
    return !result.ok && result.code === "invalid_video_id";
  })()
);
check(
  "playlist-only URL is rejected as unsupported_path",
  (() => {
    const result = normalizeYouTubeVideoUrl(
      "https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    );
    return !result.ok && result.code === "unsupported_path";
  })()
);
check(
  "channel URL is rejected as unsupported_path",
  (() => {
    const result = normalizeYouTubeVideoUrl(
      "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx"
    );
    return !result.ok && result.code === "unsupported_path";
  })()
);
check(
  "user URL is rejected as unsupported_path",
  (() => {
    const result = normalizeYouTubeVideoUrl("https://www.youtube.com/user/SomeUser");
    return !result.ok && result.code === "unsupported_path";
  })()
);
check(
  "embed URL is rejected as unsupported_path",
  (() => {
    const result = normalizeYouTubeVideoUrl(
      `https://www.youtube.com/embed/${STANDARD_ID}`
    );
    return !result.ok && result.code === "unsupported_path";
  })()
);
check(
  "live URL is rejected as unsupported_path",
  (() => {
    const result = normalizeYouTubeVideoUrl(
      `https://www.youtube.com/live/${STANDARD_ID}`
    );
    return !result.ok && result.code === "unsupported_path";
  })()
);
check(
  "embedded credentials are rejected as invalid_url",
  (() => {
    const result = normalizeYouTubeVideoUrl(
      `https://user:pass@www.youtube.com/watch?v=${STANDARD_ID}`
    );
    return !result.ok && result.code === "invalid_url";
  })()
);
check(
  "extractYouTubeVideoId returns null for an invalid URL",
  extractYouTubeVideoId("not a url") === null
);

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("\nResult: all Competitor Scripts YouTube URL tests passed.");
}
