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

// ringTrack is now the same neutral light-gray track every other
// progress ring/bar in the app already uses (Hero's score rings,
// ui-components.tsx's score bars, score-visuals.tsx's conic-gradient) —
// a per-metric tinted track was only legible against the old dark card
// background. icon/text now reuse the metric's own `ring` hue directly:
// each of these accent colors already reads correctly as text/icon color
// on a white card (the exact same values Hero's score cards and
// DesktopScoreCard already apply as plain text color on white), so a
// separate lighter dark-mode-only shade is no longer needed.
export const METRIC_COLORS: Record<
  MetricKey,
  { ring: string; ringTrack: string; icon: string; iconBg: string; text: string }
> = {
  overall: {
    ring: "#A855F7",
    ringTrack: "#E5E7EB",
    icon: "#A855F7",
    iconBg: "rgba(168,85,247,0.12)",
    text: "#A855F7",
  },
  hook: {
    ring: "#F97316",
    ringTrack: "#E5E7EB",
    icon: "#F97316",
    iconBg: "rgba(249,115,22,0.12)",
    text: "#F97316",
  },
  retention: {
    ring: "#22C55E",
    ringTrack: "#E5E7EB",
    icon: "#22C55E",
    iconBg: "rgba(34,197,94,0.12)",
    text: "#22C55E",
  },
  structure: {
    ring: "#3B82F6",
    ringTrack: "#E5E7EB",
    icon: "#3B82F6",
    iconBg: "rgba(59,130,246,0.12)",
    text: "#3B82F6",
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
