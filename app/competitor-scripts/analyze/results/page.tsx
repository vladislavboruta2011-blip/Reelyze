import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMessages } from "../../../../lib/messages";
import { getServerLocale } from "../../../../lib/server-locale";
import { Sidebar } from "../../sidebar";
import { AnalyzeResultsContent } from "./analyze-results-content";

export default async function AnalyzeResultsPage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const copy = messages.competitorScripts.analyzeResults;

  return (
    <main className="min-h-screen bg-[#0A0A12] text-[#F5F5F7] antialiased">
      <Sidebar messages={messages} activeMode="analyze" />

      {/* Deliberately no shared page-entrance class here — this wrapper
          mounts before the real report is ready. AnalyzeResultsContent's
          ready-state container carries its own dedicated result-entrance
          class instead, timed to when the real analysis is actually
          visible (see globals.css). */}
      <div className="lg:ml-[260px]">
        <div className="px-5 pt-5 pb-8 lg:px-10 lg:pt-6 lg:pb-12">
          <div className="mx-auto w-full max-w-[1220px]">
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

            <AnalyzeResultsContent copy={copy} />
          </div>
        </div>
      </div>
    </main>
  );
}
