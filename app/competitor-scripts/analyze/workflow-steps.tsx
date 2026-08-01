import { CheckCircle2, FileText, ScanSearch, Sparkles, Video } from "lucide-react";
import type { Messages } from "../../../lib/messages";

type WorkflowCopy = Messages["competitorScripts"]["analyze"]["workflow"];

const STAGE_ICONS = [Video, FileText, ScanSearch, Sparkles, CheckCircle2];

// A static, informational preview of the future analysis pipeline — not a
// live progress component. Nothing here is time-driven (no setTimeout/
// setInterval), nothing changes after the form is submitted, and there is
// no spinner or currently-running state anywhere. The section heading itself
// (not just an sr-only label) makes that explicit for every user, sighted
// or not.
export function WorkflowSteps({ workflow }: { workflow: WorkflowCopy }) {
  return (
    <section aria-labelledby="analyze-workflow-heading" className="mt-8">
      <h2
        id="analyze-workflow-heading"
        className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]"
      >
        {workflow.sectionLabel}
      </h2>

      <ol className="relative mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-4">
        <div
          className="pointer-events-none absolute left-[10%] right-[10%] top-7 hidden border-t border-dashed border-[#E5E7EB] lg:block"
          aria-hidden="true"
        />
        {workflow.stages.map((stage, index) => {
          const Icon = STAGE_ICONS[index] ?? CheckCircle2;
          const isFirst = index === 0;

          return (
            <li
              key={stage.title}
              className="relative flex items-start gap-3 lg:flex-col lg:items-center lg:text-center"
            >
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border bg-white ${
                  isFirst
                    ? "border-[#7C3AED] text-[#7C3AED] shadow-[0_0_0_4px_#F3E8FF]"
                    : "border-[#E5E7EB] text-[#9CA3AF]"
                }`}
              >
                <Icon size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#111827]">
                  {stage.title}
                </p>
                <p className="mt-0.5 text-[12px] leading-[1.4] text-[#6B7280]">
                  {stage.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
