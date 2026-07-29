import { ExternalLink } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { YouTubeUrlSourceFormat } from "../../../../lib/competitor-scripts/youtube-url";
import type {
  AnalysisScores,
  AnalysisVerdict,
} from "../../../../lib/competitor-scripts/analysis/types";
import { YouTubeEmbed } from "./youtube-embed";

type SummaryCopy = Messages["competitorScripts"]["analyzeResults"]["summary"];
type ScoresCopy = Messages["competitorScripts"]["analyzeResults"]["scores"];
type VerdictCopy = Messages["competitorScripts"]["analyzeResults"]["verdict"];
type TakeawayCopy = Messages["competitorScripts"]["analyzeResults"]["takeaway"];

// Same three-way mapping main-takeaway.tsx uses for its own verdict badge —
// kept as its own small local constant here (not extracted to a shared
// module) since it's a 3-entry presentational map, consistent with how
// score-overview.tsx also keeps its own local METRIC_ICONS.
const VERDICT_STYLES: Record<AnalysisVerdict, string> = {
  strong: "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#4ADE80]",
  mixed: "border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#FBBF24]",
  weak: "border-[#F87171]/40 bg-[#F87171]/15 text-[#FCA5A5]",
};

function formatDurationMs(durationMs: number | null): string | null {
  if (durationMs === null) {
    return null;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export type ResultsSummaryData = {
  videoId: string;
  canonicalUrl: string;
  sourceFormat: YouTubeUrlSourceFormat;
  languageCode: string | null;
  durationMs: number | null;
  segmentCount: number;
};

// Populated only when a real, validated analysis exists (never for the
// legacy/degraded states) — every field here is a direct read of already-
// validated analysis data, never re-derived or re-worded client-side.
export type ResultsSummaryAnalysisOverview = {
  verdict: AnalysisVerdict;
  scores: AnalysisScores;
  mainTakeaway: string;
};

// Every value shown here comes from the real API response for the video
// the user submitted — never fictional/placeholder data. Fields we don't
// actually know (a real title, creator, view counts, actual YouTube
// duration) are simply not shown, rather than backfilled with anything
// that could read as real. The video itself is the real submitted
// YouTube video, embedded directly — not a placeholder thumbnail. When
// analysisOverview is present, it fills what used to be unused horizontal
// space next to the video with a condensed, real read of the same
// verdict/scores/mainTakeaway rendered in full further down the page —
// never a second, different source of truth.
export function ResultsSummary({
  summary,
  scores,
  verdictCopy,
  takeawayCopy,
  data,
  analysisOverview,
}: {
  summary: SummaryCopy;
  scores: ScoresCopy;
  verdictCopy: VerdictCopy;
  takeawayCopy: TakeawayCopy;
  data: ResultsSummaryData;
  analysisOverview: ResultsSummaryAnalysisOverview | null;
}) {
  const durationDisplay = formatDurationMs(data.durationMs) ?? summary.unknownDuration;
  const languageDisplay = data.languageCode ?? summary.unknownLanguage;

  const rows = [
    { label: summary.platformLabel, value: summary.platform },
    { label: summary.sourceFormatLabel, value: data.sourceFormat },
    { label: summary.durationLabel, value: durationDisplay },
    { label: summary.languageLabel, value: languageDisplay },
    { label: summary.segmentCountLabel, value: String(data.segmentCount) },
  ];

  return (
    <section className="rounded-[20px] border border-[#7C3AED]/20 bg-white/[0.035] p-5 lg:p-6">
      <span className="inline-flex items-center rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C4B5FD]">
        {summary.realDataLabel}
      </span>

      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start lg:shrink-0">
          <div className="w-full max-w-[200px] shrink-0 sm:w-[200px]">
            <YouTubeEmbed videoId={data.videoId} title={summary.embedTitle} />
          </div>

          <div className="min-w-0 max-w-[300px]">
            <h2 className="text-[17px] font-bold leading-[1.35] text-[#F5F5F7]">
              {summary.neutralTitle}
            </h2>
            <a
              href={data.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${summary.openOnYouTube}: ${data.canonicalUrl}`}
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-[#A78BFA] hover:text-[#C4B5FD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4B5FD]"
            >
              {summary.openOnYouTube}
              <ExternalLink size={11} aria-hidden="true" />
            </a>
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

        {analysisOverview && (
          <div className="min-w-0 flex-1 rounded-[16px] border border-white/10 bg-white/[0.03] p-4 lg:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
              {summary.analysisOverviewHeading}
            </p>

            <div className="mt-2.5 flex flex-wrap items-baseline gap-2.5">
              <span className="text-[38px] font-black leading-none text-[#F5F5F7]">
                {analysisOverview.scores.overallScore}
              </span>
              <span className="text-[13px] font-medium text-[#6B7280]">
                {scores.scoreSuffix}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${VERDICT_STYLES[analysisOverview.verdict]}`}
              >
                {verdictCopy[analysisOverview.verdict]}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] font-medium text-[#9CA3AF]">
              {scores.overall.label}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
              {[
                { label: scores.hook.label, value: analysisOverview.scores.hookScore },
                { label: scores.retention.label, value: analysisOverview.scores.momentumScore },
                { label: scores.structure.label, value: analysisOverview.scores.structureScore },
              ].map((row) => (
                <div key={row.label}>
                  <p className="text-[16px] font-bold leading-none text-[#F5F5F7]">
                    {row.value}
                    <span className="ml-0.5 text-[11px] font-medium text-[#6B7280]">
                      {scores.scoreSuffix}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-[10.5px] font-medium uppercase tracking-[0.04em] text-[#6B7280]">
                    {row.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-white/10 pt-3.5">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
                {takeawayCopy.heading}
              </p>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-[#D1D5DB]">
                {analysisOverview.mainTakeaway}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
