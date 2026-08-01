import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMessages } from "../../../../lib/messages";
import { getServerLocale } from "../../../../lib/server-locale";
import { Sidebar } from "../../sidebar";
import { ModeSwitcher } from "../../mode-switcher";
import { CompareResultsContent } from "./compare-results-content";

export default async function CompareResultsPage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const copy = messages.competitorScripts.compareResults;

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#111827] antialiased">
      <Sidebar messages={messages} />

      {/* Deliberately no shared page-entrance class here — this wrapper
          mounts before the real result is ready. CompareResultsContent's
          ready-state container carries its own dedicated result-entrance
          class instead, timed to when the real comparison is actually
          visible (see app/globals.css and analyze/results/page.tsx, which
          established this exact pattern). */}
      <div className="lg:ml-[260px]">
        <div className="px-5 pt-5 pb-8 lg:px-10 lg:pt-6 lg:pb-12">
          <div className="mx-auto w-full max-w-[1220px]">
            <Link
              href="/competitor-scripts/compare"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6B7280] transition hover:text-[#111827]"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              {copy.backToCompare}
            </Link>

            <ModeSwitcher messages={messages} activeMode="compare" />

            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#2563EB]">
              {copy.heroEyebrow}
            </p>
            <h1 aria-label={copy.pageTitle} className="mt-3">
              <span
                aria-hidden="true"
                className="block text-[32px] font-black leading-[0.98] tracking-[-0.045em] text-[#111827] md:text-[44px] lg:text-[52px]"
              >
                {copy.headingPrefix}
              </span>
              <span
                aria-hidden="true"
                className="relative mt-1 inline-block overflow-visible pb-1 pr-3 text-[40px] font-black leading-[0.94] tracking-[-0.05em] text-[#2563EB] md:text-[54px] lg:text-[66px]"
              >
                {copy.headingAccent}
              </span>
            </h1>
            <p className="mt-4 max-w-[680px] text-[15px] leading-[1.7] text-[#6B7280] lg:text-[16px]">
              {copy.description}
            </p>

            <CompareResultsContent copy={copy} />
          </div>
        </div>
      </div>
    </main>
  );
}
