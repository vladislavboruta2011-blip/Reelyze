import type { Messages } from "../../../../lib/messages";

type TimelineCopy = Messages["competitorScripts"]["analyzeResults"]["timeline"];

// A static, illustrative script timeline — every timestamp and transcript
// line is fictional filler, never derived from a real video or the
// submitted URL. Grows naturally with its content — no internal scroll
// container, no fixed height.
export function ScriptBreakdown({ timeline }: { timeline: TimelineCopy }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.02] p-6 lg:p-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#A78BFA]">
          {timeline.sectionEyebrow}
        </p>
        <span className="inline-flex items-center rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C4B5FD]">
          {timeline.illustrativeLabel}
        </span>
      </div>
      <h2 className="mt-2 text-[19px] font-semibold text-[#F5F5F7]">
        {timeline.heading}
      </h2>

      <div className="mt-7 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ol className="relative flex flex-col gap-6 border-l-2 border-[#7C3AED]/25 pl-5">
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

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
            {timeline.transcriptHeading}
          </p>
          <ul className="mt-4 flex flex-col gap-4">
            {timeline.stages.map((stage) => (
              <li key={stage.title} className="flex items-start gap-3">
                <span className="w-[68px] shrink-0 text-[12px] font-semibold tabular-nums text-[#A78BFA]">
                  {stage.timestamp}
                </span>
                <p className="text-[13.5px] leading-[1.6] text-[#D1D5DB]">
                  {stage.transcript}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
