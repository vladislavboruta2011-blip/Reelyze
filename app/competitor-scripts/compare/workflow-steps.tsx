import { ArrowLeftRight, FileText, Rows3, Sparkles } from "lucide-react";
import type { Messages } from "../../../lib/messages";

type WorkflowCopy = Messages["competitorScripts"]["compare"]["workflow"];

const STAGE_ICONS = [FileText, Rows3, ArrowLeftRight, Sparkles];

// A static, informational preview of the future comparison pipeline — not
// a live progress component. Nothing here is time-driven (no setTimeout/
// setInterval), nothing changes after the form is submitted, and there is
// no spinner or currently-running state anywhere. The visible section
// heading makes that explicit for every user, sighted or not.
export function WorkflowSteps({ workflow }: { workflow: WorkflowCopy }) {
  return (
    <section aria-labelledby="compare-workflow-heading" className="mt-4">
      <h2
        id="compare-workflow-heading"
        className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]"
      >
        {workflow.sectionLabel}
      </h2>

      <ol className="relative mt-5 grid grid-cols-1 gap-6 lg:grid-cols-4 lg:gap-4">
        <div
          className="pointer-events-none absolute left-[10%] right-[10%] top-7 hidden border-t border-dashed border-[#E5E7EB] lg:block"
          aria-hidden="true"
        />
        {workflow.stages.map((stage, index) => {
          const Icon = STAGE_ICONS[index] ?? Sparkles;
          const isFirst = index === 0;

          return (
            <li
              key={stage.title}
              className="relative flex items-start gap-3 lg:flex-col lg:items-center lg:text-center"
            >
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border bg-white ${
                  isFirst
                    ? "border-[#BFDBFE] text-[#2563EB] shadow-[0_0_0_4px_#DBEAFE]"
                    : "border-[#E5E7EB] text-[#9CA3AF]"
                }`}
              >
                <Icon size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#111827]">
                  {stage.title}
                </p>
                <p className="mt-0.5 text-[12px] leading-[1.4] text-[#9CA3AF]">
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
