import { Sparkles } from "lucide-react";
import type { Messages } from "../../../../lib/messages";

type WhyScoresCopy =
  Messages["competitorScripts"]["analyzeResults"]["whyScores"];

export function WhyScoresSection({ whyScores }: { whyScores: WhyScoresCopy }) {
  return (
    <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 lg:p-6">
      <h2 className="text-[15px] font-semibold text-[#F5F5F7]">
        {whyScores.heading}
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {whyScores.reasons.map((reason) => (
          <li key={reason.title} className="flex items-start gap-2.5">
            <div
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#7C3AED]/15 text-[#A78BFA]"
              aria-hidden="true"
            >
              <Sparkles size={14} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#C4B5FD]">
                {reason.title}
              </p>
              <p className="mt-1 text-[12px] leading-[1.5] text-[#9CA3AF]">
                {reason.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
