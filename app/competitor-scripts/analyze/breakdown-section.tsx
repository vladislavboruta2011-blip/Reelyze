import {
  Eye,
  Flame,
  GraduationCap,
  LayoutList,
  Repeat,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { Messages } from "../../../lib/messages";

type BreakdownCopy = Messages["competitorScripts"]["analyze"]["breakdown"];

const ITEM_ICONS = [
  LayoutList,
  Flame,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Repeat,
  GraduationCap,
  ShieldAlert,
];

// Eight static, localized items describing what the (not-yet-built) result
// will contain — no scores, no generated findings, nothing derived from a
// real analysis.
export function BreakdownSection({ breakdown }: { breakdown: BreakdownCopy }) {
  return (
    <section className="flex h-full flex-col rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_60px_rgba(17,24,39,0.04)] lg:p-8">
      <h2 className="text-[18px] font-semibold text-[#111827]">
        {breakdown.heading}
      </h2>
      <ul className="mt-5 grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
        {breakdown.items.map((item, index) => {
          const Icon = ITEM_ICONS[index] ?? LayoutList;

          return (
            <li key={item.title} className="flex flex-col gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F3E8FF] text-[#7C3AED]">
                <Icon size={16} aria-hidden="true" />
              </div>
              <p className="text-[13.5px] font-semibold text-[#111827]">
                {item.title}
              </p>
              <p className="text-[12.5px] leading-[1.5] text-[#6B7280]">
                {item.description}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
