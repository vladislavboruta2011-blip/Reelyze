import Link from "next/link";
import { GitCompare, PlayCircle } from "lucide-react";
import type { Messages } from "../../lib/messages";

// Local navigation between the two Competitor Scripts modes, replacing the
// global sidebar rows that used to do this job (see sidebar.tsx). Reuses
// the existing modeSelection.sidebar labels rather than introducing new
// copy. Both destinations are always real routes, and both are always
// rendered as links — never disabled or hidden — so the current mode is
// always reachable and the other mode is always exactly one click away,
// from an input page or that mode's own results page alike.
export function ModeSwitcher({
  messages,
  activeMode,
}: {
  messages: Messages;
  activeMode: "analyze" | "compare";
}) {
  const copy = messages.competitorScripts.modeSelection.sidebar;

  return (
    <div
      role="tablist"
      aria-label={copy.analyzeLabel + " / " + copy.compareLabel}
      className="mt-6 inline-flex items-center gap-1 rounded-[14px] border border-[#E5E7EB] bg-white p-1"
    >
      <Link
        href="/competitor-scripts/analyze"
        role="tab"
        aria-selected={activeMode === "analyze"}
        className={[
          "inline-flex h-9 items-center gap-2 rounded-[10px] px-4 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]",
          activeMode === "analyze"
            ? "bg-[#F3E8FF] text-[#7C3AED]"
            : "text-[#6B7280] hover:text-[#111827]",
        ].join(" ")}
      >
        <PlayCircle size={15} aria-hidden="true" />
        {copy.analyzeLabel}
      </Link>
      <Link
        href="/competitor-scripts/compare"
        role="tab"
        aria-selected={activeMode === "compare"}
        className={[
          "inline-flex h-9 items-center gap-2 rounded-[10px] px-4 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]",
          activeMode === "compare"
            ? "bg-[#DBEAFE] text-[#2563EB]"
            : "text-[#6B7280] hover:text-[#111827]",
        ].join(" ")}
      >
        <GitCompare size={15} aria-hidden="true" />
        {copy.compareLabel}
      </Link>
    </div>
  );
}
