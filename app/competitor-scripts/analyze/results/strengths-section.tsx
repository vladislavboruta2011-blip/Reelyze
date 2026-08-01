import { CheckCircle2 } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { Strength } from "../../../../lib/competitor-scripts/analysis/types";
import { formatTimestampMs } from "./format-timestamp";

type StrengthsCopy = Messages["competitorScripts"]["analyzeResults"]["strengths"];

// Real strengths (1-5 on a valid analysis) — never a hard-coded count.
export function StrengthsSection({
  strengths,
  items,
}: {
  strengths: StrengthsCopy;
  items: Strength[];
}) {
  return (
    <section className="flex h-full flex-col rounded-[20px] border border-[#86EFAC] bg-[#F4FDF6] p-4 lg:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#15803D]">
        {strengths.sectionEyebrow}
      </p>
      <h2 className="mt-1.5 text-[16px] font-semibold text-[#111827]">
        {strengths.heading}
      </h2>
      <ul className="mt-3.5 flex flex-1 flex-col gap-3.5">
        {items.map((item, index) => (
          <li key={`${item.title}-${index}`} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]"
              aria-hidden="true"
            >
              <CheckCircle2 size={15} />
            </span>
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-[14.5px] font-semibold text-[#111827]">
                  {item.title}
                </p>
                {item.evidence.startMs !== null && (
                  <span className="text-[11.5px] tabular-nums text-[#9CA3AF]">
                    {formatTimestampMs(item.evidence.startMs)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12.5px] italic leading-[1.55] text-[#6B7280]">
                &ldquo;{item.evidence.excerpt}&rdquo;
              </p>
              <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[#374151]">
                {item.whyItWorks}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
