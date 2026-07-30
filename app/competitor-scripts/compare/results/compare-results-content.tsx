"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, GitCompare } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import {
  readStoredCompareResult,
  type StoredCompareResult,
} from "../../../../lib/competitor-scripts/compare-result-storage";
import type {
  Caution,
  DimensionFinding,
  Priority,
} from "../../../../lib/competitor-scripts/comparison/types";
import { formatTimestampMs } from "../../analyze/results/format-timestamp";
import { YouTubeEmbed } from "../../analyze/results/youtube-embed";

type ResultsCopy = Messages["competitorScripts"]["compareResults"];

type ContentState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; result: StoredCompareResult };

function formatDurationMs(durationMs: number | null): string | null {
  if (durationMs === null) {
    return null;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// endMs present -> a real range; endMs null -> only the real startMs is
// shown, never a fabricated end point.
function formatEvidenceTimestamp(startMs: number, endMs: number | null): string {
  return endMs === null
    ? formatTimestampMs(startMs)
    : `${formatTimestampMs(startMs)}–${formatTimestampMs(endMs)}`;
}

// The one shared evidence-excerpt block, used by both dimension findings
// and priorities (and, without a timestamp, by cautions). Deliberately
// separate from the surrounding generated-reasoning prose (observation/
// conclusion/problem/etc., rendered by each caller as a plain paragraph
// just above this) — italic + quote marks + a dimmer color is the one
// consistent visual signal across every section that "this is a real,
// verbatim excerpt," never mixed with generated text.
function EvidenceQuote({
  label,
  excerpt,
  timestamp,
}: {
  label: string;
  excerpt: string;
  timestamp: string | null;
}) {
  return (
    <div className="rounded-[12px] border-l-2 border-white/15 bg-white/[0.02] px-3.5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
          {label}
        </p>
        {timestamp !== null && (
          <span className="text-[11px] tabular-nums text-[#9CA3AF]">
            {timestamp}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[12.5px] italic leading-[1.5] text-[#6B7280]">
        &ldquo;{excerpt}&rdquo;
      </p>
    </div>
  );
}

function DimensionFindingCard({
  copy,
  finding,
}: {
  copy: ResultsCopy;
  finding: DimensionFinding;
}) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.02] p-4 lg:p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="text-[15px] font-semibold text-[#F5F5F7]">
          {copy.dimensions.labels[finding.dimension]}
        </h3>
        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-[#D1D5DB]">
          {copy.strongerSide[finding.strongerSide]}
        </span>
        {finding.gap !== null && (
          <span className="inline-flex items-center rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#FBBF24]">
            {copy.gap[finding.gap]}
          </span>
        )}
      </div>

      <p className="mt-2 text-[13.5px] leading-[1.6] text-[#D1D5DB]">
        {finding.conclusion}
      </p>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <p className="text-[13px] leading-[1.55] text-[#D1D5DB]">
            {finding.userObservation}
          </p>
          <div className="mt-2">
            <EvidenceQuote
              label={copy.evidence.yourScriptLabel}
              excerpt={finding.evidence.user.excerpt}
              timestamp={null}
            />
          </div>
        </div>
        <div>
          <p className="text-[13px] leading-[1.55] text-[#D1D5DB]">
            {finding.competitorObservation}
          </p>
          <div className="mt-2">
            <EvidenceQuote
              label={copy.evidence.competitorScriptLabel}
              excerpt={finding.evidence.competitor.excerpt}
              timestamp={formatEvidenceTimestamp(
                finding.evidence.competitor.startMs,
                finding.evidence.competitor.endMs
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PriorityCard({
  copy,
  priority,
}: {
  copy: ResultsCopy;
  priority: Priority;
}) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.02] p-4 lg:p-5">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#22D3EE]/15 text-[13px] font-bold text-[#67E8F9]"
          aria-hidden="true"
        >
          {priority.rank}
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
          {copy.priorities.rankLabel} {priority.rank}
        </p>
      </div>

      <p className="mt-2.5 text-[14px] font-semibold text-[#F5F5F7]">
        {priority.problem}
      </p>

      <div className="mt-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
          {copy.priorities.competitorPrincipleLabel}
        </p>
        <p className="mt-1 text-[13px] leading-[1.55] text-[#D1D5DB]">
          {priority.competitorPrinciple}
        </p>
      </div>

      <div className="mt-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
          {copy.priorities.howToApplyLabel}
        </p>
        <p className="mt-1 text-[13px] leading-[1.55] text-[#D1D5DB]">
          {priority.howToApply}
        </p>
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <EvidenceQuote
          label={copy.evidence.yourScriptLabel}
          excerpt={priority.evidence.user.excerpt}
          timestamp={null}
        />
        <EvidenceQuote
          label={copy.evidence.competitorScriptLabel}
          excerpt={priority.evidence.competitor.excerpt}
          timestamp={formatEvidenceTimestamp(
            priority.evidence.competitor.startMs,
            priority.evidence.competitor.endMs
          )}
        />
      </div>
    </div>
  );
}

// May legitimately be empty — the whole section is omitted by the caller
// when it is, never a manufactured "no cautions" placeholder.
function CautionCard({ copy, caution }: { copy: ResultsCopy; caution: Caution }) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-white/[0.02] px-4 py-3.5">
      <p className="text-[13px] font-semibold text-[#D1D5DB]">
        {caution.whatNotToCopy}
      </p>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-[#9CA3AF]">
        {caution.reason}
      </p>
      <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <EvidenceQuote
          label={copy.evidence.competitorScriptLabel}
          excerpt={caution.evidence.competitor.excerpt}
          timestamp={formatEvidenceTimestamp(
            caution.evidence.competitor.startMs,
            caution.evidence.competitor.endMs
          )}
        />
        {caution.evidence.user !== null && (
          <EvidenceQuote
            label={copy.evidence.yourScriptLabel}
            excerpt={caution.evidence.user.excerpt}
            timestamp={null}
          />
        )}
      </div>
    </div>
  );
}

// The one client boundary on the Results page. sessionStorage is only ever
// readable after mount, so this always starts in "loading" on both the
// server render and the client's first render (avoiding a hydration
// mismatch), then resolves to "missing" or "ready" from a single
// mount-only effect. This performs no network request of its own — the
// comparison was already fetched once, during the original Compare
// submission, and is only ever read back from sessionStorage here.
export function CompareResultsContent({ copy }: { copy: ResultsCopy }) {
  const [state, setState] = useState<ContentState>({ status: "loading" });

  useEffect(() => {
    // Deferred via a same-tick timer, matching the repo's existing
    // sessionStorage-hydration convention (see analyze-results-content.tsx)
    // — a setState call directly in an effect body is flagged by
    // react-hooks/set-state-in-effect.
    const timer = window.setTimeout(() => {
      const result = readStoredCompareResult();
      setState(result ? { status: "ready", result } : { status: "missing" });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  if (state.status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.02] px-6 py-10 text-center"
      >
        <p className="text-[14px] text-[#9CA3AF]">{copy.description}</p>
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
        <h2 className="text-[20px] font-semibold text-[#F5F5F7]">
          {copy.missingState.heading}
        </h2>
        <p className="mx-auto mt-3 max-w-[480px] text-[14px] leading-[1.6] text-[#9CA3AF]">
          {copy.missingState.description}
        </p>
        <Link
          href="/competitor-scripts/compare"
          className="mt-6 inline-flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#22D3EE] px-6 text-[14px] font-semibold text-white transition hover:from-[#2563EB] hover:via-[#3B82F6] hover:to-[#67E8F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67E8F9]"
        >
          {copy.missingState.action}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const { comparison, sourceMeta } = state.result;
  const durationDisplay =
    formatDurationMs(sourceMeta.durationMs) ?? copy.sourceMeta.unknownDuration;

  // The dedicated result-entrance class below plays once, right here, the
  // moment this "ready" container is first mounted — never on the earlier
  // "loading" placeholder above. Reuses the exact same class Analyze
  // Results already established (app/globals.css .animate-result-enter),
  // no new CSS.
  return (
    <div className="flex flex-col gap-3 animate-result-enter">
      {/* A. Orientation / header */}
      <section className="rounded-[20px] border border-[#22D3EE]/20 bg-white/[0.035] p-5 lg:p-6">
        <span className="inline-flex items-center rounded-full border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#67E8F9]">
          {copy.summary.realDataLabel}
        </span>

        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="w-full max-w-[200px] shrink-0 sm:w-[200px]">
            <YouTubeEmbed videoId={sourceMeta.videoId} title={copy.summary.embedTitle} />
          </div>

          <div className="min-w-0 flex-1">
            <a
              href={sourceMeta.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${copy.summary.openOnYouTube}: ${sourceMeta.canonicalUrl}`}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[#67E8F9] hover:text-[#A5F3FC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67E8F9]"
            >
              {copy.summary.openOnYouTube}
              <ExternalLink size={12} aria-hidden="true" />
            </a>

            <div className="mt-4">
              <Link
                href="/competitor-scripts/compare"
                className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[14px] border border-white/15 bg-white/[0.03] px-5 text-[13.5px] font-semibold text-[#F5F5F7] transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67E8F9]"
              >
                <GitCompare size={15} aria-hidden="true" />
                {copy.summary.compareAnother}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* B. Comparison summary */}
      <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 lg:p-6">
        <h2 className="text-[19px] font-bold leading-[1.35] text-[#F5F5F7]">
          {comparison.comparisonSummary.headline}
        </h2>
        <p className="mt-2.5 text-[14px] leading-[1.6] text-[#D1D5DB]">
          {comparison.comparisonSummary.mainTakeaway}
        </p>
      </section>

      {/* C. Four dimension findings, in the fixed contract order — never
          re-sorted client-side. */}
      <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 lg:p-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#67E8F9]">
          {copy.dimensions.sectionEyebrow}
        </p>
        <h2 className="mt-2 text-[17px] font-semibold text-[#F5F5F7]">
          {copy.dimensions.heading}
        </h2>
        <div className="mt-4 flex flex-col gap-5">
          {comparison.dimensionFindings.map((finding) => (
            <DimensionFindingCard key={finding.dimension} copy={copy} finding={finding} />
          ))}
        </div>
      </section>

      {/* D. Priorities, already rank-ordered by the validator */}
      <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 lg:p-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#67E8F9]">
          {copy.priorities.sectionEyebrow}
        </p>
        <h2 className="mt-2 text-[17px] font-semibold text-[#F5F5F7]">
          {copy.priorities.heading}
        </h2>
        <div className="mt-4 flex flex-col gap-5">
          {comparison.priorities.map((priority) => (
            <PriorityCard key={priority.rank} copy={copy} priority={priority} />
          ))}
        </div>
      </section>

      {/* E. Cautions — omitted entirely when empty, visually quieter
          (dimmer border/background, no accent color) than the primary
          findings/priorities sections above. */}
      {comparison.cautions.length > 0 && (
        <section className="rounded-[20px] border border-white/10 bg-white/[0.02] p-5 lg:p-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
            {copy.cautions.sectionEyebrow}
          </p>
          <h2 className="mt-2 text-[16px] font-semibold text-[#D1D5DB]">
            {copy.cautions.heading}
          </h2>
          <div className="mt-3.5 flex flex-col gap-3.5">
            {comparison.cautions.map((caution, index) => (
              <CautionCard key={`${caution.whatNotToCopy}-${index}`} copy={copy} caution={caution} />
            ))}
          </div>
        </section>
      )}

      {/* F. Source metadata — every value is a direct read of sourceMeta,
          never re-derived or fabricated. */}
      <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 lg:p-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
          {copy.sourceMeta.sectionEyebrow}
        </p>
        <h2 className="mt-2 text-[17px] font-semibold text-[#F5F5F7]">
          {copy.sourceMeta.heading}
        </h2>
        <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <dt className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
              {copy.sourceMeta.videoIdLabel}
            </dt>
            <dd className="mt-0.5 truncate text-[13px] font-medium text-[#D1D5DB]">
              {sourceMeta.videoId}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
              {copy.sourceMeta.canonicalUrlLabel}
            </dt>
            <dd className="mt-0.5 truncate text-[13px] font-medium text-[#D1D5DB]">
              <a
                href={sourceMeta.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#67E8F9]"
              >
                {sourceMeta.canonicalUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
              {copy.sourceMeta.durationLabel}
            </dt>
            <dd className="mt-0.5 text-[13px] font-medium text-[#D1D5DB]">
              {durationDisplay}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
              {copy.sourceMeta.userScriptLengthLabel}
            </dt>
            <dd className="mt-0.5 text-[13px] font-medium text-[#D1D5DB]">
              {sourceMeta.userScriptCharacterCount} {copy.sourceMeta.charactersSuffix}
            </dd>
          </div>
        </dl>
      </section>

      {/* G. Navigation actions */}
      <div className="mt-2 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-5">
          <Link
            href="/competitor-scripts/compare"
            className="inline-flex h-[44px] items-center justify-center px-1 text-[13px] font-medium text-[#9CA3AF] transition hover:text-[#F5F5F7] sm:h-auto sm:px-0"
          >
            {copy.actions.backToCompare}
          </Link>
          <Link
            href="/competitor-scripts"
            className="inline-flex h-[44px] items-center justify-center px-1 text-[13px] font-medium text-[#9CA3AF] transition hover:text-[#F5F5F7] sm:h-auto sm:px-0"
          >
            {copy.actions.backToSelection}
          </Link>
        </div>

        <Link
          href="/competitor-scripts/compare"
          className="inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#22D3EE] px-6 text-[14px] font-semibold text-white transition hover:from-[#2563EB] hover:via-[#3B82F6] hover:to-[#67E8F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67E8F9] sm:w-auto"
        >
          {copy.actions.compareAnother}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
