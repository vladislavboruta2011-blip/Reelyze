import { readFile } from "node:fs/promises";
import path from "node:path";

type FeedbackRecord = {
  rating?: unknown;
  reason?: unknown;
  text?: unknown;
  title?: unknown;
  scores?: {
    overall?: unknown;
    hook?: unknown;
    retentionRisk?: unknown;
  };
  mainTakeaway?: unknown;
  scriptPreview?: unknown;
  currentPath?: unknown;
  createdAt?: unknown;
};

const feedbackFile = path.join(process.cwd(), "data", "feedback.jsonl");

function asText(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : fallback;
}

function asScore(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "—";
}

async function main(): Promise<void> {
  let fileContent = "";

  try {
    fileContent = await readFile(feedbackFile, "utf8");
  } catch {
    console.log("No local feedback found yet.");
    console.log(`Expected file: ${feedbackFile}`);
    return;
  }

  const records = fileContent
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as FeedbackRecord);

  if (records.length === 0) {
    console.log("No local feedback found yet.");
    return;
  }

  console.log(`Found ${records.length} feedback record(s).\n`);

  for (const [index, record] of records.slice(-10).entries()) {
    console.log(`--- Feedback ${index + 1} ---`);
    console.log(`Created: ${asText(record.createdAt)}`);
    console.log(`Rating: ${asText(record.rating)}`);
    console.log(`Reason: ${asText(record.reason)}`);
    console.log(`Text: ${asText(record.text)}`);
    console.log(`Title: ${asText(record.title)}`);
    console.log(
      `Scores: overall ${asScore(record.scores?.overall)}, hook ${asScore(
        record.scores?.hook
      )}, retention risk ${asScore(record.scores?.retentionRisk)}`
    );
    console.log(`Path: ${asText(record.currentPath)}`);
    console.log(`Script preview: ${asText(record.scriptPreview)}`);
    console.log("");
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown feedback viewer error.";

  console.error(`Failed to view feedback: ${message}`);
  process.exitCode = 1;
});
