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
    <main className="min-h-screen bg-[#0A0A12] text-[#F5F5F7] antialiased">
      <Sidebar messages={messages} />

      <div className="animate-page-enter lg:ml-[260px]">
        <div className="px-5 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-[1160px]">
            <Link
              href="/competitor-scripts"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[#9CA3AF] transition hover:text-[#F5F5F7]"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              {copy.backToSelection}
            </Link>

            <ModeSwitcher messages={messages} activeMode="compare" />

            <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_290px]">
              <div className="text-left">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#67E8F9]">
                  {copy.heroEyebrow}
                </p>
                <h1 aria-label={copy.pageTitle} className="mt-4">
                  <span
                    aria-hidden="true"
                    className="block text-[32px] font-black leading-[0.95] tracking-[-0.05em] text-white md:text-[44px] lg:text-[60px]"
                  >
                    {copy.headingPrefix}
                  </span>
                  <span
                    aria-hidden="true"
                    className="relative mt-1 inline-block overflow-visible bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#22D3EE] bg-clip-text pb-1.5 pr-3 text-[42px] font-black leading-[0.94] tracking-[-0.055em] text-transparent [text-shadow:0_2px_8px_rgba(0,0,0,0.3),0_0_22px_rgba(34,211,238,0.18)] md:text-[58px] lg:text-[80px]"
                  >
                    {copy.headingAccent}
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-2 left-0 h-[4px] w-[100px] -rotate-1 rounded-full bg-gradient-to-r from-[#2563EB] to-[#22D3EE]"
                    />
                  </span>
                </h1>
                <p className="mt-7 max-w-[660px] text-[16px] font-medium leading-[1.6] text-[#C7CBD6] md:text-[18px] lg:text-[20px]">
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
