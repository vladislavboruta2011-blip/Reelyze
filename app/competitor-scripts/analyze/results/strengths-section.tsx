import { CheckCircle2 } from "lucide-react";
import type { Messages } from "../../../../lib/messages";

type StrengthsCopy = Messages["competitorScripts"]["analyzeResults"]["strengths"];

export function StrengthsSection({ strengths }: { strengths: StrengthsCopy }) {
  return (
    <section className="flex h-full flex-col rounded-[20px] border border-[#22C55E]/25 bg-gradient-to-b from-[#22C55E]/[0.05] to-transparent p-5 lg:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4ADE80]">
        {strengths.sectionEyebrow}
      </p>
      <h2 className="mt-1.5 text-[16px] font-semibold text-[#F5F5F7]">
        {strengths.heading}
      </h2>
      <ul className="mt-4 flex flex-1 flex-col gap-3.5">
        {strengths.items.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#4ADE80]"
              aria-hidden="true"
            >
              <CheckCircle2 size={14} />
            </span>
            <div>
              <p className="text-[13.5px] font-semibold text-[#F5F5F7]">
                {item.title}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[#9CA3AF]">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
