import type { Messages } from "../../lib/messages";

// Mirrors the exact color thresholds already used for score coloring on
// /results (engine/analysis-v2-ui-adapter.ts's getPositiveScoreColor /
// getRiskColor, not exported from that module) — same visual language,
// not a new one.
function positiveScoreColor(score: number): string {
  if (score >= 75) return "#22C55E";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

function riskColor(score: number): string {
  if (score >= 65) return "#EF4444";
  if (score >= 45) return "#F59E0B";
  return "#22C55E";
}

// Three tiers for this compact summary view (the full /results page breaks
// risk into four for its detailed breakdown — this is deliberately
// coarser, matching the "Low/Medium/High" the dashboard row calls for).
// Exported so the Risk Level filter (analyses-search.tsx) reuses these exact
// thresholds instead of duplicating them — the filter buckets must always
// agree with what a row's own RiskIndicator dot/label already shows.
export function riskTier(
  score: number
): "high" | "medium" | "low" {
  if (score >= 65) return "high";
  if (score >= 45) return "medium";
  return "low";
}

// A compact circular score indicator. The number and an aria-label are
// always present — color is a supplement, never the only way the value is
// communicated (a colorblind or screen-reader user still gets the exact
// number either way).
export function ScoreRing({
  value,
  metricLabel,
}: {
  value: number;
  metricLabel: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const color = positiveScoreColor(clamped);

  return (
    <div
      role="img"
      aria-label={`${metricLabel}: ${clamped} / 100`}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${color} ${clamped * 3.6}deg, #E5E7EB 0deg)`,
      }}
    >
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[#111827]">
        {clamped}
      </div>
    </div>
  );
}

// Neutral, honest "we don't have a number for this" state — never a
// fabricated score. Text-based, not just a muted color, so it reads the
// same for every user.
export function ScoreUnavailableBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-dashed border-[#E5E7EB] px-2 text-[10px] font-medium text-[#6B7280]">
      {label}
    </span>
  );
}

export function RiskIndicator({
  value,
  scoreLabels,
}: {
  value: number;
  scoreLabels: Messages["results"]["scoreLabels"]["risk"];
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const tier = riskTier(clamped);
  const color = riskColor(clamped);
  const label =
    tier === "high"
      ? scoreLabels.high
      : tier === "medium"
        ? scoreLabels.medium
        : scoreLabels.low;

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#111827]">
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
