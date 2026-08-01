import { GitCompare, Lightbulb, PlayCircle, Sparkles } from "lucide-react";
import { getMessages } from "../../lib/messages";
import { getServerLocale } from "../../lib/server-locale";
import { ModeCard } from "./mode-card";
import { Sidebar } from "./sidebar";

export default async function CompetitorScriptsPage() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const copy = messages.competitorScripts.modeSelection;

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#111827] antialiased">
      <Sidebar messages={messages} />

      <div className="animate-page-enter lg:ml-[260px]">
        <div className="px-5 py-8 lg:px-10 lg:py-10">
          <div className="relative mx-auto w-full max-w-[1200px] overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white p-7 shadow-[0_18px_60px_rgba(17,24,39,0.04)] lg:p-10">
            <div className="relative z-10">
              <div className="mx-auto mb-8 max-w-[640px] text-center">
                <div className="inline-flex h-[36px] items-center gap-2 rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-4 text-[12px] font-semibold text-[#5B21B6]">
                  <Sparkles size={14} className="text-[#7C3AED]" aria-hidden="true" />
                  {copy.badge}
                </div>
                <h1 className="mt-4 text-[32px] font-extrabold tracking-[-0.03em] text-[#111827] lg:text-[42px]">
                  {copy.heading}
                </h1>
                <p className="mt-3 text-[14px] leading-[1.65] text-[#6B7280] lg:text-[15px]">
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

              <div className="mx-auto mt-6 flex max-w-[560px] items-center justify-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-[#F8F8FC] px-6 py-4 text-center">
                <Lightbulb
                  size={18}
                  className="shrink-0 text-[#B45309]"
                  aria-hidden="true"
                />
                <p className="text-[13px] leading-[1.6] text-[#6B7280]">
                  {copy.note}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
