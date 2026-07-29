import type { StructureBeatLabel } from "../../../../lib/competitor-scripts/analysis/types";

// Purely presentational — a deterministic score-metric -> color mapping
// shared by ScoreOverview and WhyScoresSection so the two sections read as
// visually connected. Never affects analysis semantics/data. Keyed by the
// same "overall" | "hook" | "retention" | "structure" strings
// WhyScoresSection's SCORE_LABEL_KEY already produces from each real
// scoreReason's `.score` field.
export type MetricKey = "overall" | "hook" | "retention" | "structure";

export const METRIC_KEYS: readonly MetricKey[] = [
  "overall",
  "hook",
  "retention",
  "structure",
];

export const METRIC_COLORS: Record<
  MetricKey,
  { ring: string; ringTrack: string; icon: string; iconBg: string; text: string }
> = {
  overall: {
    ring: "#A855F7",
    ringTrack: "rgba(168,85,247,0.15)",
    icon: "#C084FC",
    iconBg: "rgba(168,85,247,0.15)",
    text: "#C4B5FD",
  },
  hook: {
    ring: "#F97316",
    ringTrack: "rgba(249,115,22,0.15)",
    icon: "#FB923C",
    iconBg: "rgba(249,115,22,0.15)",
    text: "#FDBA74",
  },
  retention: {
    ring: "#22C55E",
    ringTrack: "rgba(34,197,94,0.15)",
    icon: "#4ADE80",
    iconBg: "rgba(34,197,94,0.15)",
    text: "#86EFAC",
  },
  structure: {
    ring: "#3B82F6",
    ringTrack: "rgba(59,130,246,0.15)",
    icon: "#60A5FA",
    iconBg: "rgba(59,130,246,0.15)",
    text: "#93C5FD",
  },
};

// Structural beats are a distinct, larger label set (STRUCTURE_BEAT_LABELS
// in lib/competitor-scripts/analysis/types.ts) than the 4 score metrics
// above, so they get their own deterministic, purely-presentational color
// map — every supported label is covered, "other" included, so an
// unrecognized/future label never renders unstyled.
export const BEAT_COLORS: Record<StructureBeatLabel, string> = {
  hook: "#A855F7",
  setup: "#8B5CF6",
  context: "#3B82F6",
  escalation: "#22C55E",
  reveal: "#F97316",
  payoff: "#EAB308",
  cta: "#EC4899",
  digression: "#64748B",
  recap: "#06B6D4",
  other: "#9CA3AF",
};
