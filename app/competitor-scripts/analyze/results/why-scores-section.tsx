import { Activity, Gauge, ListTree, Zap } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { ScoreReason } from "../../../../lib/competitor-scripts/analysis/types";
import { METRIC_COLORS, type MetricKey } from "./metric-colors";

type ScoresCopy = Messages["competitorScripts"]["analyzeResults"]["scores"];
type WhyScoresCopy = Messages["competitorScripts"]["analyzeResults"]["whyScores"];

// Mapped by each reason's own `score` field, never by array order — the
// contract identifies each of the 4 scoreReasons this way specifically so
// display never depends on a server-side ordering guarantee. Also doubles
// as the color/icon lookup key so this section visually connects back to
// the same metric in Score Overview above it.
const SCORE_LABEL_KEY: Record<ScoreReason["score"], MetricKey> = {
  overallScore: "overall",
  hookScore: "hook",
  momentumScore: "retention",
  structureScore: "structure",
} as const;

const METRIC_REASON_ICONS: Record<MetricKey, typeof Gauge> = {
  overall: Gauge,
  hook: Zap,
  retention: Activity,
  structure: ListTree,
};

export function WhyScoresSection({
  whyScores,
  scores,
  reasons,
}: {
  whyScores: WhyScoresCopy;
  scores: ScoresCopy;
  reasons: ScoreReason[];
}) {
  return (
    <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 lg:p-6">
      <h2 className="text-[16px] font-semibold text-[#F5F5F7]">
        {whyScores.heading}
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {reasons.map((reason) => {
          const metricKey = SCORE_LABEL_KEY[reason.score];
          const label = scores[metricKey].label;
          const palette = METRIC_COLORS[metricKey];
          const Icon = METRIC_REASON_ICONS[metricKey];

          return (
            <li
              key={reason.score}
              className="flex items-start gap-3 rounded-[14px] border border-white/10 bg-white/[0.02] p-4"
            >
              <div
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                style={{
                  backgroundColor: palette.iconBg,
                  color: palette.icon,
                }}
                aria-hidden="true"
              >
                <Icon size={16} />
              </div>
              <div>
                <p
                  className="text-[14px] font-semibold"
                  style={{ color: palette.text }}
                >
                  {label}
                </p>
                <p className="mt-1.5 text-[13.5px] leading-[1.6] text-[#D1D5DB]">
                  {reason.driver}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
