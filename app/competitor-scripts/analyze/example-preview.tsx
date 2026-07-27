import type { Messages } from "../../../lib/messages";

type ExampleCopy = Messages["competitorScripts"]["analyze"]["example"];

// A clearly labeled illustrative mockup — never a real result, never tied
// to whatever URL the user has typed. Every script line is generic,
// fictional filler with no real creator, brand, or video reference. The
// disclaimer is always visible, not just present in a tooltip or title
// attribute.
export function ExamplePreview({ example }: { example: ExampleCopy }) {
  return (
    <section className="flex h-full flex-col rounded-[28px] border border-[#3B82F6]/25 bg-gradient-to-b from-[#3B82F6]/[0.05] to-transparent p-6 lg:p-8">
      <h2 className="text-[18px] font-semibold text-[#F5F5F7]">
        {example.heading}
      </h2>

      <p className="mt-2 rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-[1.5] text-[#9CA3AF]">
        {example.disclaimer}
      </p>

      <div className="mt-5 grid flex-1 grid-cols-1 gap-5 sm:grid-cols-[130px_1fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
            {example.structureLabel}
          </p>
          <ol className="mt-3 flex flex-col gap-3">
            {example.stages.map((stage) => (
              <li key={stage.label} className="flex items-center gap-2.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-[#93C5FD]"
                  aria-hidden="true"
                />
                <span className="text-[11px] tabular-nums text-[#6B7280]">
                  {stage.timestamp}
                </span>
                <span className="text-[12.5px] font-medium text-[#D1D5DB]">
                  {stage.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
            {example.scriptLabel}
          </p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {example.scriptLines.map((line, index) => (
              <li
                key={line}
                className={`rounded-[10px] border-l-2 bg-white/[0.03] px-3 py-2 text-[13px] leading-[1.5] text-[#D1D5DB] ${
                  index % 2 === 0
                    ? "border-[#7C3AED]/60"
                    : "border-[#3B82F6]/60"
                }`}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
