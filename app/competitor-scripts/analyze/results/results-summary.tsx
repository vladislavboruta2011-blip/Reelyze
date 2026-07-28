import { ExternalLink } from "lucide-react";
import type { Messages } from "../../../../lib/messages";
import type { YouTubeUrlSourceFormat } from "../../../../lib/competitor-scripts/youtube-url";
import { YouTubeEmbed } from "./youtube-embed";

type SummaryCopy = Messages["competitorScripts"]["analyzeResults"]["summary"];

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

// Every value shown here comes from the real API response for the video
// the user submitted — never fictional/placeholder data. Fields we don't
// actually know (a real title, creator, view counts, actual YouTube
// duration) are simply not shown, rather than backfilled with anything
// that could read as real. The video itself is the real submitted
// YouTube video, embedded directly — not a placeholder thumbnail.
export function ResultsSummary({
  summary,
  data,
}: {
  summary: SummaryCopy;
  data: ResultsSummaryData;
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

      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
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
    </section>
  );
}
