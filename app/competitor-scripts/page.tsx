import { GitCompare, Lightbulb, PlayCircle } from "lucide-react";
import { getMessages } from "../../lib/messages";
import { getServerLocale } from "../../lib/server-locale";
import { ModeCard } from "./mode-card";
import { Sidebar } from "./sidebar";

export default async function CompetitorScriptsPage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const copy = messages.competitorScripts.modeSelection;

  return (
    <main className="min-h-screen bg-[#0A0A12] text-[#F5F5F7] antialiased">
      <Sidebar messages={messages} />

      <div className="lg:ml-[260px]">
        <div className="px-5 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-[1200px] rounded-[32px] border border-white/[0.12] bg-white/[0.025] p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_-30px_rgba(0,0,0,0.6)] lg:p-10">
            <div className="mx-auto mb-8 max-w-[640px] text-center">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#A78BFA]">
                {copy.pageTitle}
              </p>
              <h1 className="mt-3 text-[30px] font-bold tracking-[-0.02em] text-[#F5F5F7] lg:text-[38px]">
                {copy.heading}
              </h1>
              <p className="mt-3 text-[14px] leading-[1.65] text-[#9CA3AF] lg:text-[15px]">
                {copy.subheading}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
              <ModeCard
                accent="purple"
                icon={<PlayCircle size={30} aria-hidden="true" />}
                title={copy.analyzeCard.title}
                accentSubtitle={copy.analyzeCard.accentSubtitle}
                description={copy.analyzeCard.description}
                benefits={copy.analyzeCard.benefits}
                actionLabel={copy.analyzeCard.action}
                comingNextMessage={copy.comingNextMessage}
                href="/competitor-scripts/analyze"
              />
              <ModeCard
                accent="blue"
                icon={<GitCompare size={30} aria-hidden="true" />}
                title={copy.compareCard.title}
                accentSubtitle={copy.compareCard.accentSubtitle}
                description={copy.compareCard.description}
                benefits={copy.compareCard.benefits}
                actionLabel={copy.compareCard.action}
                comingNextMessage={copy.comingNextMessage}
                href="/competitor-scripts/compare"
              />
            </div>

            <div className="mx-auto mt-6 flex max-w-[560px] items-center justify-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] px-6 py-4 text-center">
              <Lightbulb
                size={18}
                className="shrink-0 text-[#F59E0B]"
                aria-hidden="true"
              />
              <p className="text-[13px] leading-[1.6] text-[#9CA3AF]">
                {copy.note}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
