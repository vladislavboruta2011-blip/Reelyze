import type { Messages } from "../../../../lib/messages";
import type { StructureBeat } from "../../../../lib/competitor-scripts/analysis/types";
import { formatTimestampMs } from "./format-timestamp";

type StructureCopy = Messages["competitorScripts"]["analyzeResults"]["structure"];

// Real structure beats (2-8) from the validated analysis. Evidence
// excerpts are rendered verbatim, plain text only — never translated,
// case-normalized, or rewritten — while purpose/analysis prose follows
// the requested analysis locale. Timestamps come only from real evidence
// startMs; a beat with no timestamp simply omits one, never a fake value.
export function ScriptBreakdown({
  structureCopy,
  beats,
}: {
  structureCopy: StructureCopy;
  beats: StructureBeat[];
}) {
  return (
    <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 lg:p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#A78BFA]">
        {structureCopy.sectionEyebrow}
      </p>
      <h2 className="mt-2 text-[17px] font-semibold text-[#F5F5F7]">
        {structureCopy.heading}
      </h2>

      <ol className="relative mt-4 flex flex-col gap-4 border-l-2 border-[#7C3AED]/25 pl-5">
        {beats.map((beat, index) => (
          <li key={`${beat.label}-${index}`} className="relative">
            <span
              className="absolute -left-[26px] top-0.5 h-3 w-3 rounded-full border-2 border-[#0A0A12] bg-[#7C3AED]"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-[14px] font-semibold text-[#F5F5F7]">
                {structureCopy.beatLabels[beat.label]}
              </p>
              {beat.evidence.startMs !== null && (
                <span className="text-[12px] tabular-nums text-[#A78BFA]">
                  {formatTimestampMs(beat.evidence.startMs)}
                </span>
              )}
            </div>
            <p className="mt-1 text-[12.5px] italic leading-[1.5] text-[#9CA3AF]">
              &ldquo;{beat.evidence.excerpt}&rdquo;
            </p>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-[#D1D5DB]">
              {beat.purpose}
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-[#9CA3AF]">
              {beat.analysis}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
