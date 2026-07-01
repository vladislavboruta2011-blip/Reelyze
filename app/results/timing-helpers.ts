import { formatTime } from "../../engine/scoring";

export function createLineTimestamps(
  lines: string[],
  totalDuration: number
): string[] {
  if (lines.length <= 1) {
    return ["00:00"];
  }

  const step = totalDuration / lines.length;

  return lines.map((_, index) =>
    formatTime(Math.floor(index * step))
  );
}

export function createScaleLabels(
  totalDuration: number
): string[] {
  const safeDuration = Math.max(4, totalDuration);

  return [
    formatTime(0),
    formatTime(Math.round(safeDuration * 0.25)),
    formatTime(Math.round(safeDuration * 0.5)),
    formatTime(Math.round(safeDuration * 0.75)),
    formatTime(safeDuration),
  ];
}
