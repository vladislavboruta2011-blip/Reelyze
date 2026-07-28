import { ShieldAlert } from "lucide-react";
import type { Messages } from "../../../../lib/messages";

type CautionCopy = Messages["competitorScripts"]["analyzeResults"]["caution"];

export function CautionSection({ caution }: { caution: CautionCopy }) {
  return (
    <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 lg:p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
        {caution.sectionEyebrow}
      </p>
      <div className="mt-2 flex items-center gap-2.5">
        <ShieldAlert size={16} className="shrink-0 text-[#9CA3AF]" aria-hidden="true" />
        <h2 className="text-[17px] font-semibold text-[#F5F5F7]">
          {caution.heading}
        </h2>
      </div>
      <p className="mt-2 max-w-[680px] text-[13px] leading-[1.55] text-[#9CA3AF]">
        {caution.description}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {caution.columns.map((column, index) => (
          <div
            key={column.title}
            className={
              index > 0
                ? "border-t border-white/10 pt-5 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0"
                : ""
            }
          >
            <p className="text-[13.5px] font-semibold text-[#F5F5F7]">
              {column.title}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[#9CA3AF]">
              {column.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
