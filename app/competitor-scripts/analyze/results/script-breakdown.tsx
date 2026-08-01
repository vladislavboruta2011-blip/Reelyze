"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { StructureBeat } from "../../../../lib/competitor-scripts/analysis/types";
import { formatTimestampMs } from "./format-timestamp";
import { BEAT_COLORS } from "./metric-colors";

type StructureCopy = Messages["competitorScripts"]["analyzeResults"]["structure"];

// Real structure beats (2-8) from the validated analysis. Evidence
// excerpts are rendered verbatim, plain text only — never translated,
// case-normalized, or rewritten — while purpose/analysis prose follows
// the requested analysis locale. Timestamps come only from real evidence
// startMs; a beat with no timestamp simply omits one, never a fake value.
//
// Two-tier progressive disclosure: a compact step row (every real beat,
// marker + label + timestamp + a one-line evidence preview) is always
// visible so the section scans in a glance rather than reading as a long
// report. "Show full structure" reveals the full existing vertical
// timeline underneath — same real beats, full evidence quote, `purpose`
// as the one primary explanation per beat, and `analysis` (a real, second
// existing field, never invented) still available behind its own per-beat
// "Show details" toggle. Nothing is ever removed, only re-sequenced
// behind an extra layer of disclosure.
export function ScriptBreakdown({
  structureCopy,
  beats,
}: {
  structureCopy: StructureCopy;
  beats: StructureBeat[];
}) {
  const [expandedIndexes, setExpandedIndexes] = useState<
    ReadonlySet<number>
  >(new Set());
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);

  function toggleExpanded(index: number) {
    setExpandedIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <section className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 lg:p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#7C3AED]">
        {structureCopy.sectionEyebrow}
      </p>
      <h2 className="mt-2 text-[17px] font-semibold text-[#111827]">
        {structureCopy.heading}
      </h2>

      <ol className="mt-5 flex flex-col gap-3 lg:flex-row lg:flex-wrap">
        {beats.map((beat, index) => {
          const color = BEAT_COLORS[beat.label] ?? BEAT_COLORS.other;

          return (
            <li
              key={`${beat.label}-${index}`}
              className="flex min-w-0 flex-1 items-start gap-2.5 rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-3.5 py-3 lg:basis-[190px]"
            >
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-[13.5px] font-semibold text-[#111827]">
                    {structureCopy.beatLabels[beat.label]}
                  </p>
                  {beat.evidence.startMs !== null && (
                    <span className="text-[11.5px] tabular-nums text-[#9CA3AF]">
                      {formatTimestampMs(beat.evidence.startMs)}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[12px] italic leading-[1.4] text-[#6B7280]">
                  &ldquo;{beat.evidence.excerpt}&rdquo;
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={() => setIsFullyExpanded((current) => !current)}
        aria-expanded={isFullyExpanded}
        className="mt-4 inline-flex items-center gap-1 bg-transparent text-[12.5px] font-semibold text-[#7C3AED] transition-colors hover:text-[#6D28D9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
      >
        {isFullyExpanded
          ? structureCopy.hideFullStructure
          : structureCopy.showFullStructure}
        <ChevronDown
          size={13}
          className={`transition-transform ${isFullyExpanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isFullyExpanded && (
        <ol className="relative mt-5 flex flex-col gap-5 border-l-2 border-[#DDD6FE] pl-6">
          {beats.map((beat, index) => {
            const isExpanded = expandedIndexes.has(index);
            const color = BEAT_COLORS[beat.label] ?? BEAT_COLORS.other;

            return (
              <li key={`${beat.label}-${index}`} className="relative">
                <span
                  className="absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white"
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 0 0 3px ${color}26`,
                  }}
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <p className="text-[15px] font-semibold text-[#111827]">
                    {structureCopy.beatLabels[beat.label]}
                  </p>
                  {beat.evidence.startMs !== null && (
                    <span className="text-[12.5px] tabular-nums text-[#7C3AED]">
                      {formatTimestampMs(beat.evidence.startMs)}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[13.5px] italic leading-[1.55] text-[#6B7280]">
                  &ldquo;{beat.evidence.excerpt}&rdquo;
                </p>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#374151]">
                  {beat.purpose}
                </p>

                {isExpanded && (
                  <p className="mt-2 text-[13px] leading-[1.6] text-[#6B7280]">
                    {beat.analysis}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => toggleExpanded(index)}
                  aria-expanded={isExpanded}
                  className="mt-2 inline-flex items-center gap-1 bg-transparent text-[12px] font-semibold text-[#7C3AED] transition-colors hover:text-[#6D28D9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
                >
                  {isExpanded ? structureCopy.hideDetails : structureCopy.showDetails}
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
