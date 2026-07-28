import { Eye, Flame, LayoutList, Sparkles } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { AnalysisScores } from "../../../../lib/competitor-scripts/analysis/types";

type ScoresCopy = Messages["competitorScripts"]["analyzeResults"]["scores"];

const METRIC_ICONS = [Sparkles, Flame, Eye, LayoutList];

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

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = METRIC_ICONS[index] ?? Sparkles;

          return (
            <div
              key={metric.label}
              className="flex flex-col items-center rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-4 text-center"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED]/15 text-[#C4B5FD]"
                aria-hidden="true"
              >
                <Icon size={16} />
              </div>
              <p
                role="img"
                aria-label={`${metric.label}: ${metric.value} ${scores.scoreSuffix}`}
                className="mt-2 flex items-baseline gap-1"
              >
                <span className="text-[34px] font-bold leading-none text-[#F5F5F7]">
                  {metric.value}
                </span>
                <span className="text-[13px] font-medium text-[#6B7280]">
                  {scores.scoreSuffix}
                </span>
              </p>
              <p className="mt-1.5 text-[13px] font-semibold text-[#F5F5F7]">
                {metric.label}
              </p>
              <p className="mt-1 text-[11.5px] leading-[1.45] text-[#9CA3AF]">
                {metric.explanation}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
