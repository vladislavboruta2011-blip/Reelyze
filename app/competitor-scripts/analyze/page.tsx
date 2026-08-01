import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMessages } from "../../../lib/messages";
import { getServerLocale } from "../../../lib/server-locale";
import { Sidebar } from "../sidebar";
import { ModeSwitcher } from "../mode-switcher";
import { AnalyzeInputForm } from "./analyze-input-form";
import { BreakdownSection } from "./breakdown-section";
import { ExamplePreview } from "./example-preview";
import { HeroIllustration } from "./hero-illustration";
import { WorkflowSteps } from "./workflow-steps";

export default async function AnalyzeCompetitorPage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const copy = messages.competitorScripts.analyze;

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#111827] antialiased">
      <Sidebar messages={messages} />

      <div className="animate-page-enter lg:ml-[260px]">
        <div className="px-5 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-[1160px]">
            <Link
              href="/competitor-scripts"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6B7280] transition hover:text-[#111827]"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              {copy.backToSelection}
            </Link>

            <ModeSwitcher messages={messages} activeMode="analyze" />

            <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_290px]">
              <div className="text-left">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#7C3AED]">
                  {copy.heroEyebrow}
                </p>
                <h1 aria-label={copy.pageTitle} className="mt-4">
                  <span
                    aria-hidden="true"
                    className="block text-[32px] font-black leading-[0.95] tracking-[-0.05em] text-[#111827] md:text-[44px] lg:text-[60px]"
                  >
                    {copy.headingPrefix}
                  </span>
                  <span
                    aria-hidden="true"
                    className="relative mt-1 inline-block text-[40px] font-black leading-[0.9] tracking-[-0.06em] text-[#7C3AED] md:text-[56px] lg:text-[76px]"
                  >
                    {copy.headingAccent}
                  </span>
                </h1>
                <p className="mt-7 max-w-[660px] text-[16px] font-medium leading-[1.6] text-[#6B7280] md:text-[18px] lg:text-[20px]">
                  {copy.description}
                </p>
              </div>
              <div className="mx-auto hidden md:block lg:mx-0 lg:-translate-x-3 lg:justify-self-end">
                <HeroIllustration />
              </div>
            </div>

            <AnalyzeInputForm copy={copy} />

            <WorkflowSteps workflow={copy.workflow} />

            <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
              <BreakdownSection breakdown={copy.breakdown} />
              <ExamplePreview example={copy.example} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
