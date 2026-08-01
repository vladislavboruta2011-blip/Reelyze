import type { Messages } from "../../../lib/messages";

type ExampleCopy = Messages["competitorScripts"]["compare"]["example"];

// A clearly labeled illustrative mockup — never a real comparison, never
// tied to whatever URL/script the user has entered. Every line is generic,
// fictional filler with no real creator, brand, video, or statistic. The
// disclaimer and the "In this example" framing on the summary are always
// visible body text, never hidden in a tooltip.
export function ExampleComparison({ example }: { example: ExampleCopy }) {
  return (
    <section className="flex h-full flex-col rounded-[28px] border border-[#BFDBFE] bg-[#F5F9FF] p-6 lg:p-8">
      <h2 className="text-[18px] font-semibold text-[#111827]">
        {example.heading}
      </h2>

      <p className="mt-2 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] leading-[1.5] text-[#6B7280]">
        {example.disclaimer}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
            {example.competitorLabel}
          </p>
          <ul className="mt-3.5 flex flex-col gap-2.5">
            {example.competitorLines.map((line) => (
              <li
                key={line}
                className="rounded-[10px] border-l-2 border-[#E5E7EB] bg-white px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-[#374151]"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2563EB]">
            {example.yourScriptLabel}
          </p>
          <ul className="mt-3.5 flex flex-col gap-2.5">
            {example.yourScriptLines.map((line) => (
              <li
                key={line}
                className="rounded-[10px] border-l-2 border-[#93C5FD] bg-white px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-[#374151]"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex-1 rounded-[14px] border border-[#E5E7EB] bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
          {example.summaryHeading}
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {example.summaryItems.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[#BFDBFE] bg-[#DBEAFE] px-3.5 py-1.5 text-[12px] font-medium text-[#2563EB]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
