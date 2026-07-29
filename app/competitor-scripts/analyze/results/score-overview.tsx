"use client";

import { useEffect, useState } from "react";
import { Activity, Gauge, ListTree, Zap } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { AnalysisScores } from "../../../../lib/competitor-scripts/analysis/types";
import { METRIC_COLORS, type MetricKey } from "./metric-colors";

type ScoresCopy = Messages["competitorScripts"]["analyzeResults"]["scores"];

// Overall/Hook/Retention/Structure, in that fixed order — matches the
// metrics array below index-for-index. Distinct from icons already used
// elsewhere on this page (Clock for retention risks, Lightbulb for
// lessons, etc.) so no metric here visually echoes an unrelated section.
const METRIC_ICONS = [Gauge, Zap, Activity, ListTree];
const METRIC_KEYS_ORDERED: MetricKey[] = [
  "overall",
  "hook",
  "retention",
  "structure",
];

// Each metric gets its own accent color (see metric-colors.ts) — these are
// four distinct score dimensions, not interchangeable alert severities, so
// a shared single color would visually flatten a real difference the
// Score Overview / Why These Scores sections are meant to connect.
const RING_SIZE = 116;
const RING_STROKE_WIDTH = 11;
const RING_RADIUS = (RING_SIZE - RING_STROKE_WIDTH) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Shared fill timing for every ring — same duration/easing/delay on all
// four, so they visibly draw together as one moment, never staggered
// per-card. A restrained, purely decelerating ease-out (same curve family
// as the approved page/report entrance), so the ring fill and the report
// fade-in read as one coordinated arrival.
const RING_FILL_TRANSITION =
  "stroke-dashoffset 1100ms cubic-bezier(0.16, 1, 0.3, 1) 120ms";

// A real SVG progress ring — background track plus an active arc whose
// final length is driven directly by the real 0-100 score, never
// recalculated. strokeLinecap="round" gives both ends of the visible arc
// a genuinely rounded cap (never a flat/square cut-off). Rotated -90deg
// so progress starts at 12 o'clock and draws clockwise. Purely decorative
// — the real score/label text rendered on top of it already carries the
// accessible value, so this SVG itself is aria-hidden.
//
// The arc animates from empty (0%) to the real score once this ring
// mounts (i.e. once the real analysis report itself is visible — this
// component is never rendered during the "loading" state). Initial React
// state is lazily computed from prefers-reduced-motion so reduced-motion
// users never see an empty ring, not even for one frame: their very first
// render already paints the final offset. Everyone else starts empty and
// flips to the final offset after two requestAnimationFrame ticks — one
// tick is sometimes coalesced by the browser before the first paint,
// which would skip the visible "empty" starting frame entirely; two
// reliably guarantees the empty state actually paints first.
function ScoreRing({ value, color }: { value: number; color: string }) {
  const [isFilled, setIsFilled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => setIsFilled(true));
    });

    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
    };
  }, []);

  const offset = isFilled
    ? RING_CIRCUMFERENCE * (1 - value / 100)
    : RING_CIRCUMFERENCE;

  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      className="-rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={RING_STROKE_WIDTH}
      />
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={RING_STROKE_WIDTH}
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={{ transition: RING_FILL_TRANSITION }}
      />
    </svg>
  );
}

// Real scores from the validated analysis, 0-100 as returned by the
// backend — never recalculated here. The UI label "Retention" maps to
// the domain field momentumScore; the field itself is never renamed.
export function ScoreOverview({
  scores,
  data,
}: {
  scores: ScoresCopy;
  data: AnalysisScores;
}) {
  const metrics = [
    { ...scores.overall, value: data.overallScore },
    { ...scores.hook, value: data.hookScore },
    { ...scores.retention, value: data.momentumScore },
    { ...scores.structure, value: data.structureScore },
  ];

  return (
    <section className="rounded-[20px] border border-[#7C3AED]/25 bg-gradient-to-b from-[#7C3AED]/[0.06] to-transparent p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#A78BFA]">
          {scores.sectionEyebrow}
        </p>
      </div>
      <h2 className="mt-2 text-[17px] font-semibold text-[#F5F5F7]">
        {scores.heading}
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = METRIC_ICONS[index] ?? Gauge;
          const metricKey = METRIC_KEYS_ORDERED[index] ?? "overall";
          const palette = METRIC_COLORS[metricKey];

          return (
            <div
              key={metric.label}
              className="flex flex-col items-center rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-5 text-center"
            >
              <div
                className="relative shrink-0"
                style={{ width: RING_SIZE, height: RING_SIZE }}
              >
                <ScoreRing value={metric.value} color={palette.ring} />
                <div
                  role="img"
                  aria-label={`${metric.label}: ${metric.value} ${scores.scoreSuffix}`}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                >
                  <Icon
                    size={18}
                    style={{ color: palette.icon }}
                    aria-hidden="true"
                  />
                  <span className="mt-1 text-[32px] font-bold leading-none text-[#F5F5F7]">
                    {metric.value}
                  </span>
                  <span className="mt-0.5 text-[11px] font-medium text-[#6B7280]">
                    {scores.scoreSuffix}
                  </span>
                </div>
              </div>
              <p className="mt-3.5 text-[14px] font-semibold text-[#F5F5F7]">
                {metric.label}
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.5] text-[#9CA3AF]">
                {metric.explanation}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
