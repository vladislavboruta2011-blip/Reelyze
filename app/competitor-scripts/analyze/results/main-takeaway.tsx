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
  strong: "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#4ADE80]",
  mixed: "border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#FBBF24]",
  weak: "border-[#F87171]/40 bg-[#F87171]/15 text-[#FCA5A5]",
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
    <section className="rounded-[20px] border border-[#7C3AED]/30 bg-gradient-to-br from-[#7C3AED]/[0.12] via-[#7C3AED]/[0.04] to-transparent p-5 lg:p-7">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#7C3AED]/40 bg-[#7C3AED]/15 text-[#C4B5FD] shadow-[0_0_36px_rgba(124,58,237,0.25)]"
          aria-hidden="true"
        >
          <Sparkles size={22} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#C4B5FD]">
              {takeaway.sectionEyebrow}
            </p>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${VERDICT_STYLES[verdict]}`}
            >
              {verdictCopy[verdict]}
            </span>
          </div>
          <p className="mt-3 text-[19px] font-semibold leading-[1.5] text-[#F5F5F7] lg:text-[22px]">
            {mainTakeaway}
          </p>
        </div>
      </div>
    </section>
  );
}
