// Script line splitting, duration estimation, and timestamp formatting.
// Keep scoring evaluation and feedback generation outside this module.

export function createScriptLines(script: string) {
  const cleaned = script.trim().replace(/\s+/g, " ");

  if (!cleaned) {
    return [];
  }

  const sentenceParts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (sentenceParts.length >= 2) {
    return sentenceParts;
  }

  const words = cleaned.split(" ");

  if (words.length <= 12) {
    return [cleaned];
  }

  const lines: string[] = [];
  const wordsPerLine = 10;

  for (let i = 0; i < words.length; i += wordsPerLine) {
    const line = words.slice(i, i + wordsPerLine).join(" ");

    if (line) {
      lines.push(line);
    }
  }

  return lines;
}

export function estimateDuration(script: string) {
  const cleaned = script.trim().replace(/\s+/g, " ");

  if (cleaned.length === 0) {
    return 0;
  }

  const seconds = Math.ceil(cleaned.length / 16.5);

  return Math.max(4, seconds);
}

export function createTimeRange(
  startPercent: number,
  endPercent: number,
  duration: number
) {
  const start = Math.floor(duration * startPercent);
  const end = Math.max(start + 1, Math.floor(duration * endPercent));

  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}
