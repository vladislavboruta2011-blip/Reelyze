import { TriangleAlert } from "lucide-react";
import type { Messages } from "../../../../lib/messages";

type WeaknessesCopy =
  Messages["competitorScripts"]["analyzeResults"]["weaknesses"];

// Amber/neutral styling only — never alarming red, matching the spec's
// "not severe" framing for illustrative weak points.
export function WeaknessesSection({
  weaknesses,
}: {
  weaknesses: WeaknessesCopy;
}) {
  return (
    <section className="flex h-full flex-col rounded-[24px] border border-[#F59E0B]/25 bg-gradient-to-b from-[#F59E0B]/[0.05] to-transparent p-6 lg:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FBBF24]">
        {weaknesses.sectionEyebrow}
      </p>
      <h2 className="mt-1.5 text-[16px] font-semibold text-[#F5F5F7]">
        {weaknesses.heading}
      </h2>
      <ul className="mt-5 flex flex-1 flex-col gap-4">
        {weaknesses.items.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F59E0B]/15 text-[#F59E0B]"
              aria-hidden="true"
            >
              <TriangleAlert size={14} />
            </span>
            <div>
              <p className="text-[13.5px] font-semibold text-[#F5F5F7]">
                {item.title}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[#9CA3AF]">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
