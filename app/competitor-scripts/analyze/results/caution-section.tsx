import { ShieldAlert } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { CautionItem } from "../../../../lib/competitor-scripts/analysis/types";

type CautionCopy = Messages["competitorScripts"]["analyzeResults"]["caution"];

// May legitimately be empty — no manufactured cautions.
export function CautionSection({
  caution,
  items,
}: {
  caution: CautionCopy;
  items: CautionItem[];
}) {
  return (
    <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 lg:p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
        {caution.sectionEyebrow}
      </p>
      <div className="mt-2 flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F59E0B]/15 text-[#FBBF24]"
          aria-hidden="true"
        >
          <ShieldAlert size={17} />
        </span>
        <h2 className="text-[17px] font-semibold text-[#F5F5F7]">
          {caution.heading}
        </h2>
      </div>
      <p className="mt-2 max-w-[680px] text-[13px] leading-[1.5] text-[#9CA3AF]">
        {caution.description}
      </p>

      {items.length === 0 ? (
        <p className="mt-3.5 text-[13px] leading-[1.55] text-[#9CA3AF]">
          {caution.emptyState}
        </p>
      ) : (
        <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={`${item.whatNotToCopy}-${index}`}
              className={
                index > 0
                  ? "border-t border-white/10 pt-3.5 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0"
                  : ""
              }
            >
              <p className="text-[13.5px] font-semibold text-[#F5F5F7]">
                {item.whatNotToCopy}
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-[#D1D5DB]">
                {item.reason}
              </p>
              {item.evidence && (
                <p className="mt-1 text-[12px] italic leading-[1.45] text-[#6B7280]">
                  &ldquo;{item.evidence.excerpt}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
