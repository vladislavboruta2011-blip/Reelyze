import { Sparkles } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { ScoreReason } from "../../../../lib/competitor-scripts/analysis/types";

type ScoresCopy = Messages["competitorScripts"]["analyzeResults"]["scores"];
type WhyScoresCopy = Messages["competitorScripts"]["analyzeResults"]["whyScores"];

// Mapped by each reason's own `score` field, never by array order — the
// contract identifies each of the 4 scoreReasons this way specifically so
// display never depends on a server-side ordering guarantee.
const SCORE_LABEL_KEY = {
  overallScore: "overall",
  hookScore: "hook",
  momentumScore: "retention",
  structureScore: "structure",
} as const;

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
      <h2 className="text-[15px] font-semibold text-[#F5F5F7]">
        {whyScores.heading}
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {reasons.map((reason) => {
          const label = scores[SCORE_LABEL_KEY[reason.score]].label;

          return (
            <li key={reason.score} className="flex items-start gap-2.5">
              <div
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#7C3AED]/15 text-[#A78BFA]"
                aria-hidden="true"
              >
                <Sparkles size={14} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#C4B5FD]">
                  {label}
                </p>
                <p className="mt-1 text-[12px] leading-[1.5] text-[#9CA3AF]">
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
