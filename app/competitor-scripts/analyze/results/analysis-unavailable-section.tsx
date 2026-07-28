import { AlertCircle } from "lucide-react";
import type { Messages } from "../../../../lib/messages";

type AnalysisUnavailableCopy =
  Messages["competitorScripts"]["analyzeResults"]["analysisUnavailable"];

// The four safe, product-level reasons real analysis content is not
// shown. "legacy" covers both a PR9-era stored payload (analysis never
// existed) and a stored analysis that failed re-validation on read —
// both cases are "we don't have a trustworthy analysis to show," never
// distinguished further to the user. None of these ever mention
// OPENAI_API_KEY, OpenAI, a validator, a schema, retries, or any other
// internal implementation detail.
export type AnalysisUnavailableReason =
  | "transcript_too_long_for_analysis"
  | "analysis_invalid_response"
  | "analysis_unavailable"
  | "legacy";

const REASON_TO_COPY_KEY: Record<
  AnalysisUnavailableReason,
  keyof AnalysisUnavailableCopy
> = {
  transcript_too_long_for_analysis: "transcriptTooLong",
  analysis_invalid_response: "invalidResponse",
  analysis_unavailable: "unavailable",
  legacy: "legacy",
};

// Never a fatal page state — video/transcript/metadata render normally
// alongside this; only the analysis cards are replaced by this single
// safe message.
export function AnalysisUnavailableSection({
  copy,
  reason,
}: {
  copy: AnalysisUnavailableCopy;
  reason: AnalysisUnavailableReason;
}) {
  const message = copy[REASON_TO_COPY_KEY[reason]];

  return (
    <section className="flex flex-col items-center rounded-[20px] border border-white/10 bg-white/[0.03] p-6 text-center lg:p-8">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#9CA3AF]"
        aria-hidden="true"
      >
        <AlertCircle size={20} />
      </div>
      <h2 className="mt-3 text-[17px] font-semibold text-[#F5F5F7]">
        {message.heading}
      </h2>
      <p className="mx-auto mt-2 max-w-[480px] text-[13.5px] leading-[1.6] text-[#9CA3AF]">
        {message.description}
      </p>
    </section>
  );
}
