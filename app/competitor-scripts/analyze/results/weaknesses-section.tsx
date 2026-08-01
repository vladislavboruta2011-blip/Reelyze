import { TriangleAlert } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { Weakness } from "../../../../lib/competitor-scripts/analysis/types";
import { formatTimestampMs } from "./format-timestamp";

type WeaknessesCopy =
  Messages["competitorScripts"]["analyzeResults"]["weaknesses"];
type SeverityCopy = Messages["competitorScripts"]["analyzeResults"]["severity"];

// A genuinely strong script can have zero weaknesses — that is never
// backfilled with manufactured criticism. An empty array renders a clean
// empty state instead of hiding the section or leaving it blank.
export function WeaknessesSection({
  weaknesses,
  severity,
  items,
}: {
  weaknesses: WeaknessesCopy;
  severity: SeverityCopy;
  items: Weakness[];
}) {
  return (
    <section className="flex h-full flex-col rounded-[20px] border border-[#FDE68A] bg-[#FFFBEB] p-4 lg:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#92400E]">
        {weaknesses.sectionEyebrow}
      </p>
      <h2 className="mt-1.5 text-[16px] font-semibold text-[#111827]">
        {weaknesses.heading}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3.5 text-[12.5px] leading-[1.5] text-[#6B7280]">
          {weaknesses.emptyState}
        </p>
      ) : (
        <ul className="mt-3.5 flex flex-1 flex-col gap-3.5">
          {items.map((item, index) => (
            <li key={`${item.issue}-${index}`} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[#B45309]"
                aria-hidden="true"
              >
                <TriangleAlert size={15} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-semibold text-[#111827]">
                    {item.issue}
                  </p>
                  <span className="rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#92400E]">
                    {severity[item.severity]}
                  </span>
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
                  {item.whyItMatters}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
