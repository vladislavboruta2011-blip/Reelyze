import { Clock } from "lucide-react";
import type { Messages } from "../../../../lib/messages";

type RisksCopy = Messages["competitorScripts"]["analyzeResults"]["risks"];

// No measured retention percentages — every item is a timestamp plus a
// short, generic illustrative description and suggestion. Coral/red tint,
// not a full alarming red, since these are minor illustrative notes.
export function RisksSection({ risks }: { risks: RisksCopy }) {
  return (
    <section className="flex h-full flex-col rounded-[24px] border border-[#F87171]/25 bg-gradient-to-b from-[#F87171]/[0.05] to-transparent p-6 lg:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FCA5A5]">
        {risks.sectionEyebrow}
      </p>
      <h2 className="mt-1.5 text-[16px] font-semibold text-[#F5F5F7]">
        {risks.heading}
      </h2>
      <ul className="mt-5 flex flex-1 flex-col gap-4">
        {risks.items.map((item) => (
          <li key={item.timestamp} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F87171]/15 text-[#FCA5A5]"
              aria-hidden="true"
            >
              <Clock size={13} />
            </span>
            <div>
              <p className="text-[12px] font-semibold tabular-nums text-[#FCA5A5]">
                {item.timestamp}
              </p>
              <p className="mt-0.5 text-[13px] leading-[1.5] text-[#F5F5F7]">
                {item.description}
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-[#9CA3AF]">
                {item.suggestion}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
