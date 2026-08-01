import { Sparkles } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { AnalysisVerdict } from "../../../../lib/competitor-scripts/analysis/types";

type TakeawayCopy = Messages["competitorScripts"]["analyzeResults"]["takeaway"];
type VerdictCopy = Messages["competitorScripts"]["analyzeResults"]["verdict"];

// The real, backend-derived verdict is rendered as-is — never
// recalculated or re-derived client-side. deriveAnalysisVerdict already
// ran (twice: provider-side validation, then again during client-side
// re-validation on write/read) before this component ever sees it.
const VERDICT_STYLES: Record<AnalysisVerdict, string> = {
  strong: "border-[#86EFAC] bg-[#DCFCE7] text-[#15803D]",
  mixed: "border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]",
  weak: "border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C]",
};

export function MainTakeaway({
  takeaway,
  verdictCopy,
  verdict,
  mainTakeaway,
}: {
  takeaway: TakeawayCopy;
  verdictCopy: VerdictCopy;
  verdict: AnalysisVerdict;
  mainTakeaway: string;
}) {
  return (
    <section className="rounded-[20px] border border-[#DDD6FE] bg-[#FAF7FF] p-5 lg:p-7">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF] text-[#7C3AED]"
          aria-hidden="true"
        >
          <Sparkles size={22} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7C3AED]">
              {takeaway.sectionEyebrow}
            </p>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${VERDICT_STYLES[verdict]}`}
            >
              {verdictCopy[verdict]}
            </span>
          </div>
          <p className="mt-3 text-[19px] font-semibold leading-[1.5] text-[#111827] lg:text-[22px]">
            {mainTakeaway}
          </p>
        </div>
      </div>
    </section>
  );
}
