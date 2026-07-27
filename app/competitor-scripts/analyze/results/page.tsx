import Link from "next/link";
import { ArrowLeft, ArrowRight, GitCompare, Sparkles } from "lucide-react";
import { getMessages } from "../../../../lib/messages";
import { getServerLocale } from "../../../../lib/server-locale";
import { Sidebar } from "../../sidebar";
import { CautionSection } from "./caution-section";
import { LessonsSection } from "./lessons-section";
import { MainTakeaway } from "./main-takeaway";
import { ResultsSummary } from "./results-summary";
import { RisksSection } from "./risks-section";
import { ScoreOverview } from "./score-overview";
import { ScriptBreakdown } from "./script-breakdown";
import { StrengthsSection } from "./strengths-section";
import { WeaknessesSection } from "./weaknesses-section";
import { WhyScoresSection } from "./why-scores-section";

export default async function AnalyzeResultsPage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const copy = messages.competitorScripts.analyzeResults;

  return (
    <main className="min-h-screen bg-[#0A0A12] text-[#F5F5F7] antialiased">
      <Sidebar messages={messages} />

      <div className="lg:ml-[260px]">
        <div className="px-5 pt-5 pb-8 lg:px-10 lg:pt-6 lg:pb-12">
          <div className="mx-auto w-full max-w-[1220px]">
            {/* Hero cluster: header + summary + scores, tightened for a
                denser first viewport. */}
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_460px] xl:items-start">
                <div>
                  <Link
                    href="/competitor-scripts/analyze"
                    className="inline-flex items-center gap-2 text-[13px] font-medium text-[#9CA3AF] transition hover:text-[#F5F5F7]"
                  >
                    <ArrowLeft size={15} aria-hidden="true" />
                    {copy.backToAnalyze}
                  </Link>

                  <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#A78BFA]">
                    {copy.heroEyebrow}
                  </p>
                  <h1 aria-label={copy.pageTitle} className="mt-3">
                    <span
                      aria-hidden="true"
                      className="block text-[32px] font-black leading-[0.98] tracking-[-0.045em] text-white md:text-[44px] lg:text-[52px]"
                    >
                      {copy.headingPrefix}
                    </span>
                    <span
                      aria-hidden="true"
                      className="relative mt-1 inline-block overflow-visible bg-gradient-to-r from-[#4C1D95] via-[#7C3AED] to-[#A78BFA] bg-clip-text pb-1 pr-3 text-[40px] font-black leading-[0.94] tracking-[-0.05em] text-transparent [text-shadow:0_0_20px_rgba(124,58,237,0.18)] md:text-[54px] lg:text-[66px]"
                    >
                      {copy.headingAccent}
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-[6px] left-0 h-[5px] w-[120px] -rotate-1 rounded-full bg-gradient-to-r from-[#4C1D95] to-[#A78BFA] opacity-80"
                      />
                    </span>
                  </h1>
                  <p className="mt-4 max-w-[680px] text-[15px] leading-[1.7] text-[#9CA3AF] lg:text-[16px]">
                    {copy.description}
                  </p>

                  <div className="mt-5 flex items-start gap-2.5 rounded-[14px] border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-4 py-3">
                    <Sparkles
                      size={16}
                      className="mt-0.5 shrink-0 text-[#C4B5FD]"
                      aria-hidden="true"
                    />
                    <p className="text-[13px] leading-[1.5] text-[#C4B5FD]">
                      {copy.previewNotice}
                    </p>
                  </div>
                </div>

                <ResultsSummary summary={copy.summary} />
              </div>

              <ScoreOverview scores={copy.scores} />
            </div>

            {/* Lower report — unchanged rhythm, same gap scale as before. */}
            <div className="mt-7 flex flex-col gap-7 lg:mt-10 lg:gap-10">
              <MainTakeaway takeaway={copy.takeaway} />

              <WhyScoresSection whyScores={copy.whyScores} />

              <ScriptBreakdown timeline={copy.timeline} />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <StrengthsSection strengths={copy.strengths} />
                <WeaknessesSection weaknesses={copy.weaknesses} />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.15fr]">
                <RisksSection risks={copy.risks} />
                <LessonsSection lessons={copy.lessons} />
              </div>

              <CautionSection caution={copy.caution} />

              <div className="flex flex-col gap-3 border-t border-white/10 pt-8 pb-2 sm:flex-row sm:flex-wrap">
                <Link
                  href="/competitor-scripts/analyze"
                  className="inline-flex h-[50px] w-full items-center justify-center px-4 text-[13px] font-medium text-[#9CA3AF] transition hover:text-[#F5F5F7] sm:w-auto"
                >
                  {copy.actions.backToAnalyze}
                </Link>
                <Link
                  href="/competitor-scripts/analyze"
                  className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#6D28D9] to-[#7C3AED] px-6 text-[14px] font-semibold text-white transition hover:from-[#7C3AED] hover:to-[#8B5CF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4B5FD] sm:w-auto"
                >
                  {copy.actions.analyzeAnother}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link
                  href="/competitor-scripts/compare"
                  className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border border-white/15 bg-white/[0.03] px-6 text-[14px] font-semibold text-[#F5F5F7] transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4B5FD] sm:w-auto"
                >
                  <GitCompare size={16} aria-hidden="true" />
                  {copy.actions.compareWithMyScript}
                </Link>
                <Link
                  href="/competitor-scripts"
                  className="inline-flex h-[50px] w-full items-center justify-center px-4 text-[13px] font-medium text-[#9CA3AF] transition hover:text-[#F5F5F7] sm:w-auto"
                >
                  {copy.actions.backToSelection}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
