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
import { selectFeaturedDimension } from "../../../../lib/competitor-scripts/compare-featured-dimension";
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

// ── Evidence ────────────────────────────────────────────────────────────
// The one shared evidence-excerpt block. "featured" is the large
// pull-quote treatment used above the fold and for Priority 1; "compact"
// is the smaller treatment used everywhere else. Both variants keep an
// explicit text label ("Your script"/"Competitor script") as the primary
// signal — the left-border tint (neutral for user, cyan for competitor)
// is a secondary, non-essential cue only, never the sole distinguishing
// signal between the two sides.
function EvidenceQuote({
  source,
  label,
  excerpt,
  timestamp,
  variant = "compact",
}: {
  source: "user" | "competitor";
  label: string;
  excerpt: string;
  timestamp: string | null;
  variant?: "compact" | "featured";
}) {
  const accentBorder = source === "competitor" ? "border-[#93C5FD]" : "border-[#E5E7EB]";
  const accentLabel = source === "competitor" ? "text-[#2563EB]" : "text-[#6B7280]";

  if (variant === "featured") {
    return (
      <div className={`rounded-[14px] border-l-[3px] ${accentBorder} bg-white px-4 py-3.5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${accentLabel}`}>
            {label}
          </p>
          {timestamp !== null && (
            <span className="text-[11.5px] tabular-nums text-[#9CA3AF]">{timestamp}</span>
          )}
        </div>
        <p className="mt-1.5 text-[14.5px] italic leading-[1.55] text-[#111827]">
          &ldquo;{excerpt}&rdquo;
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border-l-2 border-[#E5E7EB] bg-[#F8F8FC] px-3.5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
          {label}
        </p>
        {timestamp !== null && (
          <span className="text-[11px] tabular-nums text-[#9CA3AF]">{timestamp}</span>
        )}
      </div>
      <p className="mt-1.5 text-[12.5px] italic leading-[1.5] text-[#374151]">
        &ldquo;{excerpt}&rdquo;
      </p>
    </div>
  );
}

function DimensionBadges({
  copy,
  finding,
  compact,
}: {
  copy: ResultsCopy;
  finding: DimensionFinding;
  compact: boolean;
}) {
  const strongSideClass = compact
    ? "rounded-full border border-[#E5E7EB] bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#374151]"
    : "rounded-full border border-[#E5E7EB] bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] font-semibold text-[#374151]";
  const gapClass = compact
    ? "rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#92400E]"
    : "rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2.5 py-0.5 text-[11px] font-semibold text-[#92400E]";

  return (
    <>
      <span className={`inline-flex items-center ${strongSideClass}`}>
        {copy.strongerSide[finding.strongerSide]}
      </span>
      {finding.gap !== null && (
        <span className={`inline-flex items-center ${gapClass}`}>{copy.gap[finding.gap]}</span>
      )}
    </>
  );
}

// The single large "biggest difference" card shown above the fold —
// Direction B's one obvious focal point. Renders every field the
// dimension finding contract exposes (never a subset), just at a larger,
// more prominent scale than the three secondary cards below it.
function FeaturedDimensionCard({
  copy,
  finding,
}: {
  copy: ResultsCopy;
  finding: DimensionFinding;
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-[#BFDBFE] bg-[#F5F9FF] p-6 lg:p-8">
      <div className="relative z-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
          {copy.dimensions.featuredEyebrow}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <h3 className="text-[20px] font-bold text-[#111827] lg:text-[22px]">
            {copy.dimensions.labels[finding.dimension]}
          </h3>
          <DimensionBadges copy={copy} finding={finding} compact={false} />
        </div>

        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
          {copy.dimensions.conclusionLabel}
        </p>
        <p className="mt-1 max-w-[720px] text-[15.5px] leading-[1.65] text-[#374151] lg:text-[16px]">
          {finding.conclusion}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
              {copy.dimensions.observationLabel}
            </p>
            <p className="mt-1 text-[13.5px] leading-[1.6] text-[#374151]">{finding.userObservation}</p>
            <div className="mt-2">
              <EvidenceQuote
                variant="featured"
                source="user"
                label={copy.evidence.yourScriptLabel}
                excerpt={finding.evidence.user.excerpt}
                timestamp={null}
              />
            </div>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
              {copy.dimensions.observationLabel}
            </p>
            <p className="mt-1 text-[13.5px] leading-[1.6] text-[#374151]">
              {finding.competitorObservation}
            </p>
            <div className="mt-2">
              <EvidenceQuote
                variant="featured"
                source="competitor"
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
    </section>
  );
}

// The three non-featured dimensions, compact. Every field the contract
// exposes is still rendered (nothing hidden or truncated) — only the
// typography/spacing scale is reduced relative to the featured card.
// The evidence pair here deliberately never becomes a 2-column grid (see
// module-level responsive note near the parent grid below): these cards
// are already narrow once arranged three-across, so their own evidence
// stays single-column at every width to avoid cramped quotes.
function SecondaryDimensionCard({
  copy,
  finding,
}: {
  copy: ResultsCopy;
  finding: DimensionFinding;
}) {
  return (
    <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[13.5px] font-semibold text-[#111827]">
          {copy.dimensions.labels[finding.dimension]}
        </h4>
        <DimensionBadges copy={copy} finding={finding} compact />
      </div>

      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
        {copy.dimensions.conclusionLabel}
      </p>
      <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[#374151]">{finding.conclusion}</p>

      <div className="mt-2.5 flex flex-col gap-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
            {copy.dimensions.observationLabel}
          </p>
          <p className="mt-0.5 text-[12px] leading-[1.5] text-[#6B7280]">{finding.userObservation}</p>
          <div className="mt-1.5">
            <EvidenceQuote
              source="user"
              label={copy.evidence.yourScriptLabel}
              excerpt={finding.evidence.user.excerpt}
              timestamp={null}
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
            {copy.dimensions.observationLabel}
          </p>
          <p className="mt-0.5 text-[12px] leading-[1.5] text-[#6B7280]">
            {finding.competitorObservation}
          </p>
          <div className="mt-1.5">
            <EvidenceQuote
              source="competitor"
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

// Priority 1 gets the large "primary" treatment; ranks 2-3 render
// "compact". Every field the contract exposes (problem, competitorPrinciple,
// howToApply, both evidence excerpts) is rendered in both variants —
// ranking/order is a direct, unmodified read of comparison.priorities,
// never re-derived here.
function PriorityCard({
  copy,
  priority,
  variant,
}: {
  copy: ResultsCopy;
  priority: Priority;
  variant: "primary" | "compact";
}) {
  const isPrimary = variant === "primary";

  return (
    <div
      className={
        isPrimary
          ? "relative overflow-hidden rounded-[20px] border border-[#BFDBFE] bg-[#F5F9FF] p-5 lg:p-6"
          : "rounded-[14px] border border-[#E5E7EB] bg-white p-4"
      }
    >
      <div className="flex items-center gap-2.5">
        <span
          className={
            isPrimary
              ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[14px] font-bold text-[#2563EB]"
              : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[11px] font-bold text-[#374151]"
          }
          aria-hidden="true"
        >
          {priority.rank}
        </span>
        <p
          className={
            isPrimary
              ? "text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2563EB]"
              : "text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]"
          }
        >
          {copy.priorities.rankLabel} {priority.rank}
        </p>
      </div>

      <p
        className={
          isPrimary
            ? "mt-3 text-[16px] font-semibold leading-[1.4] text-[#111827]"
            : "mt-2 text-[13px] font-semibold leading-[1.4] text-[#111827]"
        }
      >
        {priority.problem}
      </p>

      <div className={isPrimary ? "mt-3" : "mt-2"}>
        <p
          className={
            isPrimary
              ? "text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]"
              : "text-[10px] font-semibold uppercase tracking-[0.05em] text-[#6B7280]"
          }
        >
          {copy.priorities.competitorPrincipleLabel}
        </p>
        <p
          className={
            isPrimary
              ? "mt-1 text-[13.5px] leading-[1.6] text-[#374151]"
              : "mt-0.5 text-[12px] leading-[1.5] text-[#6B7280]"
          }
        >
          {priority.competitorPrinciple}
        </p>
      </div>

      <div className={isPrimary ? "mt-3" : "mt-2"}>
        <p
          className={
            isPrimary
              ? "text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]"
              : "text-[10px] font-semibold uppercase tracking-[0.05em] text-[#6B7280]"
          }
        >
          {copy.priorities.howToApplyLabel}
        </p>
        <p
          className={
            isPrimary
              ? "mt-1 text-[13.5px] leading-[1.6] text-[#374151]"
              : "mt-0.5 text-[12px] leading-[1.5] text-[#6B7280]"
          }
        >
          {priority.howToApply}
        </p>
      </div>

      <div
        className={
          isPrimary
            ? "mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2"
            : "mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
        }
      >
        <EvidenceQuote
          variant={isPrimary ? "featured" : "compact"}
          source="user"
          label={copy.evidence.yourScriptLabel}
          excerpt={priority.evidence.user.excerpt}
          timestamp={null}
        />
        <EvidenceQuote
          variant={isPrimary ? "featured" : "compact"}
          source="competitor"
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
// when it is, never a manufactured "no cautions" placeholder. Kept
// visually quieter than every section above it (no accent color, no
// gradient surface).
function CautionCard({ copy, caution }: { copy: ResultsCopy; caution: Caution }) {
  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 py-3.5">
      <p className="text-[13px] font-semibold text-[#374151]">{caution.whatNotToCopy}</p>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-[#6B7280]">{caution.reason}</p>
      <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <EvidenceQuote
          source="competitor"
          label={copy.evidence.competitorScriptLabel}
          excerpt={caution.evidence.competitor.excerpt}
          timestamp={formatEvidenceTimestamp(
            caution.evidence.competitor.startMs,
            caution.evidence.competitor.endMs
          )}
        />
        {caution.evidence.user !== null && (
          <EvidenceQuote
            source="user"
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
        className="mt-5 rounded-[24px] border border-[#E5E7EB] bg-white px-6 py-10 text-center"
      >
        <p className="text-[14px] text-[#6B7280]">{copy.description}</p>
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="mt-5 rounded-[24px] border border-[#E5E7EB] bg-white px-6 py-12 text-center">
        <h2 className="text-[20px] font-semibold text-[#111827]">
          {copy.missingState.heading}
        </h2>
        <p className="mx-auto mt-3 max-w-[480px] text-[14px] leading-[1.6] text-[#6B7280]">
          {copy.missingState.description}
        </p>
        <Link
          href="/competitor-scripts/compare"
          className="mt-6 inline-flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] px-6 text-[14px] font-semibold text-white transition hover:from-[#2563EB] hover:to-[#3B82F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
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

  // Presentation-only split — see selectFeaturedDimension's own comment.
  // comparison.dimensionFindings itself is never reassigned, sorted, or
  // mutated; `secondary` is always a fresh array from .filter().
  const { featured, secondary } = selectFeaturedDimension(comparison.dimensionFindings);
  const [primaryPriority, ...compactPriorities] = comparison.priorities;

  // The dedicated result-entrance class below plays once, right here, the
  // moment this "ready" container is first mounted — never on the earlier
  // "loading" placeholder above. Reuses the exact same class Analyze
  // Results already established (app/globals.css .animate-result-enter),
  // no new CSS, no new keyframes.
  return (
    <div className="flex flex-col gap-5 animate-result-enter lg:gap-6">
      {/* A. Orientation — deliberately a plain, low-emphasis strip (no
          card, no glow, no badge pill) so it never competes with the
          main-insight hero directly below it. Embed/link/action are all
          still present, just visually quieter than before. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[#E5E7EB] pb-5">
        <div className="w-[96px] shrink-0">
          <YouTubeEmbed videoId={sourceMeta.videoId} title={copy.summary.embedTitle} />
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">
            {copy.summary.realDataLabel}
          </span>
          <a
            href={sourceMeta.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${copy.summary.openOnYouTube}: ${sourceMeta.canonicalUrl}`}
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#2563EB] hover:text-[#1D4ED8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
          >
            {copy.summary.openOnYouTube}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        </div>
        <Link
          href="/competitor-scripts/compare"
          className="inline-flex h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#E5E7EB] bg-white px-3.5 text-[12.5px] font-semibold text-[#374151] transition hover:bg-[#F8F8FC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
        >
          <GitCompare size={13} aria-hidden="true" />
          {copy.summary.compareAnother}
        </Link>
      </div>

      {/* B. Main insight — the real visual hero of the page. Promoted well
          above the generic page-level H1 in prominence; no card wrapper,
          so it reads as editorial content rather than another stacked
          box. */}
      <div>
        <div
          aria-hidden="true"
          className="h-[3px] w-10 rounded-full bg-[#2563EB]"
        />
        <h2 className="mt-3 max-w-[820px] text-[26px] font-black leading-[1.15] tracking-[-0.02em] text-[#111827] lg:text-[34px]">
          {comparison.comparisonSummary.headline}
        </h2>
        <p className="mt-3 max-w-[720px] text-[15px] leading-[1.7] text-[#374151] lg:text-[16px]">
          {comparison.comparisonSummary.mainTakeaway}
        </p>
      </div>

      {/* C. Featured dimension — one obvious focal point, chosen
          deterministically (see selectFeaturedDimension). */}
      <FeaturedDimensionCard copy={copy} finding={featured} />

      {/* D. Remaining three dimensions, compact. Single column below the
          sidebar breakpoint, three-across at lg — matching where the
          shared Sidebar itself switches layout, so both transitions land
          together. */}
      <section>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
          {copy.dimensions.sectionEyebrow}
        </p>
        <h2 className="mt-2 text-[17px] font-semibold text-[#111827]">
          {copy.dimensions.heading}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          {secondary.map((finding) => (
            <SecondaryDimensionCard key={finding.dimension} copy={copy} finding={finding} />
          ))}
        </div>
      </section>

      {/* E. Priorities — Priority 1 dominant, 2-3 compact. Order is a
          direct, unmodified read of comparison.priorities. */}
      <section>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
          {copy.priorities.sectionEyebrow}
        </p>
        <h2 className="mt-2 text-[17px] font-semibold text-[#111827]">{copy.priorities.heading}</h2>
        <div className="mt-4 flex flex-col gap-3.5">
          <PriorityCard copy={copy} priority={primaryPriority} variant="primary" />
          {compactPriorities.map((priority) => (
            <PriorityCard key={priority.rank} copy={copy} priority={priority} variant="compact" />
          ))}
        </div>
      </section>

      {/* F. Cautions — omitted entirely when empty, visually quieter
          (dimmer border/background, no accent color) than every section
          above it. */}
      {comparison.cautions.length > 0 && (
        <section className="rounded-[20px] border border-[#E5E7EB] bg-[#F8F8FC] p-5 lg:p-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
            {copy.cautions.sectionEyebrow}
          </p>
          <h2 className="mt-2 text-[16px] font-semibold text-[#374151]">{copy.cautions.heading}</h2>
          <div className="mt-3.5 flex flex-col gap-3.5">
            {comparison.cautions.map((caution, index) => (
              <CautionCard key={`${caution.whatNotToCopy}-${index}`} copy={copy} caution={caution} />
            ))}
          </div>
        </section>
      )}

      {/* G. Source metadata — every value is a direct read of sourceMeta,
          never re-derived or fabricated. */}
      <section className="rounded-[16px] border border-[#E5E7EB] bg-[#F8F8FC] p-4 lg:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
          {copy.sourceMeta.sectionEyebrow}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
              {copy.sourceMeta.videoIdLabel}
            </dt>
            <dd className="mt-0.5 truncate text-[12.5px] font-medium text-[#374151]">
              {sourceMeta.videoId}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
              {copy.sourceMeta.canonicalUrlLabel}
            </dt>
            <dd className="mt-0.5 truncate text-[12.5px] font-medium text-[#374151]">
              <a
                href={sourceMeta.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#2563EB]"
              >
                {sourceMeta.canonicalUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
              {copy.sourceMeta.durationLabel}
            </dt>
            <dd className="mt-0.5 text-[12.5px] font-medium text-[#374151]">{durationDisplay}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
              {copy.sourceMeta.userScriptLengthLabel}
            </dt>
            <dd className="mt-0.5 text-[12.5px] font-medium text-[#374151]">
              {sourceMeta.userScriptCharacterCount} {copy.sourceMeta.charactersSuffix}
            </dd>
          </div>
        </dl>
      </section>

      {/* H. Navigation actions */}
      <div className="mt-1 flex flex-col gap-4 border-t border-[#E5E7EB] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-5">
          <Link
            href="/competitor-scripts/compare"
            className="inline-flex h-[44px] items-center justify-center px-1 text-[13px] font-medium text-[#6B7280] transition hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] sm:h-auto sm:px-0"
          >
            {copy.actions.backToCompare}
          </Link>
          <Link
            href="/competitor-scripts"
            className="inline-flex h-[44px] items-center justify-center px-1 text-[13px] font-medium text-[#6B7280] transition hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] sm:h-auto sm:px-0"
          >
            {copy.actions.backToSelection}
          </Link>
        </div>

        <Link
          href="/competitor-scripts/compare"
          className="inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] px-6 text-[14px] font-semibold text-white transition hover:from-[#2563EB] hover:to-[#3B82F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] sm:w-auto"
        >
          {copy.actions.compareAnother}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
