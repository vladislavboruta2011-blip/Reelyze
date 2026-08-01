import {
  Check,
  Clock,
  FileText,
  MinusCircle,
  Search,
  SplitSquareHorizontal,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { Messages } from "../../../lib/messages";

type CoverageCopy = Messages["competitorScripts"]["compare"]["coverage"];

const ITEM_ICONS = [
  Zap,
  Search,
  FileText,
  Clock,
  Check,
  MinusCircle,
  SplitSquareHorizontal,
  TrendingUp,
];

// Eight static, localized items describing what the (not-yet-built)
// comparison will cover — no scores, no generated findings, nothing
// derived from a real comparison.
export function CoverageSection({ coverage }: { coverage: CoverageCopy }) {
  return (
    <section className="flex h-full flex-col rounded-[28px] border border-[#E5E7EB] bg-white p-6 lg:p-8">
      <h2 className="text-[18px] font-semibold text-[#111827]">
        {coverage.heading}
      </h2>
      <ul className="mt-5 grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
        {coverage.items.map((item, index) => {
          const Icon = ITEM_ICONS[index] ?? Zap;

          return (
            <li key={item.title} className="flex flex-col gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#DBEAFE] text-[#2563EB]">
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
