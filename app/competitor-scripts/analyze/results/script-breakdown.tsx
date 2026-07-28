import { Info } from "lucide-react";
import type { Messages } from "../../../../lib/messages";

type TimelineCopy = Messages["competitorScripts"]["analyzeResults"]["timeline"];

// A static, illustrative stage timeline — every stage title and timestamp
// is fictional filler, never derived from a real video or the submitted
// URL, and never mixed with the real transcript shown in TranscriptSection
// above. Grows naturally with its content — no internal scroll container,
// no fixed height.
export function ScriptBreakdown({ timeline }: { timeline: TimelineCopy }) {
  return (
    <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 lg:p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#A78BFA]">
        {timeline.sectionEyebrow}
      </p>
      <h2 className="mt-2 text-[17px] font-semibold text-[#F5F5F7]">
        {timeline.heading}
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <ol className="relative flex flex-col gap-4 border-l-2 border-[#7C3AED]/25 pl-5">
          {timeline.stages.map((stage) => (
            <li key={stage.title} className="relative">
              <span
                className="absolute -left-[26px] top-0.5 h-3 w-3 rounded-full border-2 border-[#0A0A12] bg-[#7C3AED]"
                aria-hidden="true"
              />
              <p className="text-[14px] font-semibold text-[#F5F5F7]">
                {stage.title}
              </p>
              <p className="mt-0.5 text-[12px] tabular-nums text-[#A78BFA]">
                {stage.timestamp}
              </p>
            </li>
          ))}
        </ol>

        <div className="flex items-start gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.02] p-3.5">
          <Info
            size={15}
            className="mt-0.5 shrink-0 text-[#9CA3AF]"
            aria-hidden="true"
          />
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
              {timeline.previewColumnHeading}
            </p>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-[#D1D5DB]">
              {timeline.previewColumnBody}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
