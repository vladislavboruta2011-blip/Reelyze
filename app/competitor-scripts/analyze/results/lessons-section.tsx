import { Lightbulb } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { ActionableLesson } from "../../../../lib/competitor-scripts/analysis/types";

type LessonsCopy = Messages["competitorScripts"]["analyzeResults"]["lessons"];

// Transferable lessons a different creator could apply — never rendered
// as "copy this exact script" instructions.
export function LessonsSection({
  lessons,
  items,
}: {
  lessons: LessonsCopy;
  items: ActionableLesson[];
}) {
  return (
    <section className="flex h-full flex-col rounded-[20px] border border-[#3B82F6]/25 bg-gradient-to-b from-[#3B82F6]/[0.05] to-transparent p-5 lg:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#93C5FD]">
        {lessons.sectionEyebrow}
      </p>
      <div className="mt-1.5 flex items-center gap-2.5">
        <h2 className="text-[16px] font-semibold text-[#F5F5F7]">
          {lessons.heading}
        </h2>
      </div>
      <ul className="mt-4 flex flex-1 flex-col gap-3">
        {items.map((item, index) => (
          <li
            key={`${item.principle}-${index}`}
            className="flex items-start gap-2.5"
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3B82F6]/15 text-[#93C5FD]"
              aria-hidden="true"
            >
              <Lightbulb size={11} />
            </span>
            <div className="text-[13.5px] leading-[1.5] text-[#D1D5DB]">
              <p className="font-semibold text-[#F5F5F7]">{item.principle}</p>
              <p className="mt-0.5 text-[12.5px] text-[#9CA3AF]">
                {item.application}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
