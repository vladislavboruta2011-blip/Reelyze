import { Sparkles } from "lucide-react";
import type { Messages } from "../../../../lib/messages";

type TakeawayCopy = Messages["competitorScripts"]["analyzeResults"]["takeaway"];

export function MainTakeaway({ takeaway }: { takeaway: TakeawayCopy }) {
  return (
    <section className="rounded-[20px] border border-[#7C3AED]/30 bg-gradient-to-br from-[#7C3AED]/[0.12] via-[#7C3AED]/[0.04] to-transparent p-5 lg:p-7">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#7C3AED]/40 bg-[#7C3AED]/15 text-[#C4B5FD] shadow-[0_0_36px_rgba(124,58,237,0.25)]"
          aria-hidden="true"
        >
          <Sparkles size={22} />
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#C4B5FD]">
            {takeaway.sectionEyebrow}
          </p>
          <p className="mt-3 text-[19px] font-semibold leading-[1.5] text-[#F5F5F7] lg:text-[22px]">
            {takeaway.text}
          </p>
          <p className="mt-2.5 text-[14px] leading-[1.6] text-[#9CA3AF]">
            {takeaway.supporting}
          </p>
        </div>
      </div>
    </section>
  );
}
