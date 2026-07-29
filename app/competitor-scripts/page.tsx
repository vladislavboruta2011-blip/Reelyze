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
    <main className="min-h-screen bg-[#0A0A12] text-[#F5F5F7] antialiased">
      <Sidebar messages={messages} />

      <div className="animate-page-enter lg:ml-[260px]">
        <div className="px-5 py-8 lg:px-10 lg:py-10">
          <div className="relative mx-auto w-full max-w-[1200px] overflow-hidden rounded-[32px] border border-white/[0.12] bg-white/[0.025] p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_-30px_rgba(0,0,0,0.6)] lg:p-10">
            {/* Same restrained glow language as the landing Hero's own
                background (app/page.tsx's HeroBackground) — same colors,
                scaled down to sit inside this card instead of a full
                viewport band. Purely decorative, so it's the one thing in
                this card not part of the relative z-10 content layer
                below. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            >
              <div className="absolute left-1/2 top-[-180px] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[#7C3AED]/20 blur-[120px]" />
              <div className="absolute right-[-140px] top-[30px] h-[320px] w-[340px] rounded-full bg-[#3B82F6]/15 blur-[110px]" />
            </div>

            <div className="relative z-10">
              <div className="mx-auto mb-8 max-w-[640px] text-center">
                <div className="inline-flex h-[36px] items-center gap-2 rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-4 text-[12px] font-semibold text-[#C4B5FD]">
                  <Sparkles size={14} className="text-[#A78BFA]" aria-hidden="true" />
                  {copy.badge}
                </div>
                <h1 className="mt-4 text-[32px] font-extrabold tracking-[-0.03em] text-[#F5F5F7] lg:text-[42px]">
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
      </div>
    </main>
  );
}
