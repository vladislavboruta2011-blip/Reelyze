import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMessages } from "../../../lib/messages";
import { getServerLocale } from "../../../lib/server-locale";
import { Sidebar } from "../sidebar";
import { ModeSwitcher } from "../mode-switcher";
import { CompareInputForm } from "./compare-input-form";
import { CoverageSection } from "./coverage-section";
import { ExampleComparison } from "./example-comparison";
import { HeroIllustration } from "./hero-illustration";
import { WorkflowSteps } from "./workflow-steps";

export default async function CompareScriptsPage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const copy = messages.competitorScripts.compare;

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

            <ModeSwitcher messages={messages} activeMode="compare" />

            <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_290px]">
              <div className="text-left">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#2563EB]">
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
                    className="relative mt-1 inline-block overflow-visible pb-1.5 pr-3 text-[42px] font-black leading-[0.94] tracking-[-0.055em] text-[#2563EB] md:text-[58px] lg:text-[80px]"
                  >
                    {copy.headingAccent}
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-2 left-0 h-[4px] w-[100px] -rotate-1 rounded-full bg-[#2563EB]"
                    />
                  </span>
                </h1>
                <p className="mt-7 max-w-[660px] text-[16px] font-medium leading-[1.6] text-[#6B7280] md:text-[18px] lg:text-[20px]">
                  {copy.description}
                </p>
              </div>
              <div className="mx-auto hidden md:block lg:mx-0 lg:justify-self-end">
                <HeroIllustration />
              </div>
            </div>

            <CompareInputForm copy={copy} />

            <WorkflowSteps workflow={copy.workflow} />

            <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
              <CoverageSection coverage={copy.coverage} />
              <ExampleComparison example={copy.example} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
