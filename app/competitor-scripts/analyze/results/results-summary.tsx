import { PlayCircle } from "lucide-react";
import type { Messages } from "../../../../lib/messages";

type SummaryCopy = Messages["competitorScripts"]["analyzeResults"]["summary"];

// Every value here is static, fictional placeholder content — never real
// creator/video data, never derived from the URL the user submitted. The
// "illustrative" label is always visible body text, not a tooltip.
export function ResultsSummary({ summary }: { summary: SummaryCopy }) {
  const rows = [
    { label: summary.platformLabel, value: summary.platform },
    { label: summary.durationLabel, value: summary.duration },
    { label: summary.transcriptLabel, value: summary.transcriptAvailable },
    { label: summary.statusLabel, value: summary.status },
  ];

  return (
    <section className="rounded-[24px] border border-[#7C3AED]/20 bg-white/[0.02] px-6 py-5 lg:px-7 lg:py-6">
      <span className="inline-flex items-center rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C4B5FD]">
        {summary.illustrativeLabel}
      </span>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          aria-hidden="true"
          className="relative flex h-[132px] w-full shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-[#7C3AED]/25 via-[#7C3AED]/10 to-transparent sm:w-[172px]"
        >
          <PlayCircle size={42} className="text-[#C4B5FD]" strokeWidth={1.75} />
          <span className="absolute bottom-2 right-2 rounded-[6px] bg-black/50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {summary.duration}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[17px] font-bold leading-[1.35] text-[#F5F5F7]">
            {summary.title}
          </h2>
          <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                  {row.label}
                </dt>
                <dd className="mt-0.5 truncate text-[13px] font-medium text-[#D1D5DB]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
