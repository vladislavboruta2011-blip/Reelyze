import { Clock } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { RetentionRisk } from "../../../../lib/competitor-scripts/analysis/types";
import { formatTimestampMs } from "./format-timestamp";

type RisksCopy = Messages["competitorScripts"]["analyzeResults"]["risks"];
type SeverityCopy = Messages["competitorScripts"]["analyzeResults"]["severity"];

// Retention risks are editorial/structural risk assessments — never a
// claim of measured viewer behavior. May legitimately be empty.
export function RisksSection({
  risks,
  severity,
  items,
}: {
  risks: RisksCopy;
  severity: SeverityCopy;
  items: RetentionRisk[];
}) {
  return (
    <section className="flex h-full flex-col rounded-[20px] border border-[#F87171]/25 bg-gradient-to-b from-[#F87171]/[0.05] to-transparent p-5 lg:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FCA5A5]">
        {risks.sectionEyebrow}
      </p>
      <h2 className="mt-1.5 text-[16px] font-semibold text-[#F5F5F7]">
        {risks.heading}
      </h2>
      {items.length === 0 ? (
        <p className="mt-4 text-[12.5px] leading-[1.5] text-[#9CA3AF]">
          {risks.emptyState}
        </p>
      ) : (
        <ul className="mt-4 flex flex-1 flex-col gap-3.5">
          {items.map((item, index) => (
            <li key={`${item.risk}-${index}`} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F87171]/15 text-[#FCA5A5]"
                aria-hidden="true"
              >
                <Clock size={13} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.evidence.startMs !== null && (
                    <span className="text-[12px] font-semibold tabular-nums text-[#FCA5A5]">
                      {formatTimestampMs(item.evidence.startMs)}
                    </span>
                  )}
                  <span className="rounded-full border border-[#F87171]/30 bg-[#F87171]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#FCA5A5]">
                    {severity[item.severity]}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] italic leading-[1.5] text-[#6B7280]">
                  &ldquo;{item.evidence.excerpt}&rdquo;
                </p>
                <p className="mt-1 text-[13px] leading-[1.5] text-[#F5F5F7]">
                  {item.risk}
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-[#9CA3AF]">
                  {item.reason}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
