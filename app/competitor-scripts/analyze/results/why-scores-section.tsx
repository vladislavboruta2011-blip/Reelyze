import { Sparkles } from "lucide-react";
import type { Messages } from "../../../../lib/messages";

type WhyScoresCopy =
  Messages["competitorScripts"]["analyzeResults"]["whyScores"];

export function WhyScoresSection({ whyScores }: { whyScores: WhyScoresCopy }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.02] p-6 py-8 lg:p-9">
      <h2 className="text-[18px] font-semibold text-[#F5F5F7]">
        {whyScores.heading}
      </h2>
      <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {whyScores.reasons.map((reason) => (
          <li key={reason.title}>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#7C3AED]/15 text-[#A78BFA]"
              aria-hidden="true"
            >
              <Sparkles size={16} />
            </div>
            <p className="mt-3 text-[14px] font-semibold text-[#C4B5FD]">
              {reason.title}
            </p>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-[#9CA3AF]">
              {reason.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
