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
    <section className="flex h-full flex-col rounded-[20px] border border-[#FECACA] bg-[#FFF5F5] p-4 lg:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#DC2626]">
        {risks.sectionEyebrow}
      </p>
      <h2 className="mt-1.5 text-[16px] font-semibold text-[#111827]">
        {risks.heading}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3.5 text-[12.5px] leading-[1.5] text-[#6B7280]">
          {risks.emptyState}
        </p>
      ) : (
        <ul className="mt-3.5 flex flex-1 flex-col gap-3.5">
          {items.map((item, index) => (
            <li key={`${item.risk}-${index}`} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]"
                aria-hidden="true"
              >
                <Clock size={14} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.evidence.startMs !== null && (
                    <span className="text-[12.5px] font-semibold tabular-nums text-[#DC2626]">
                      {formatTimestampMs(item.evidence.startMs)}
                    </span>
                  )}
                  <span className="rounded-full border border-[#FECACA] bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#B91C1C]">
                    {severity[item.severity]}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] italic leading-[1.55] text-[#6B7280]">
                  &ldquo;{item.evidence.excerpt}&rdquo;
                </p>
                <p className="mt-1.5 text-[14px] font-medium leading-[1.55] text-[#111827]">
                  {item.risk}
                </p>
                <p className="mt-1 text-[13.5px] leading-[1.55] text-[#374151]">
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
