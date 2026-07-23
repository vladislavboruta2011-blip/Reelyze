"use client";

import Image from "next/image";
import { Inter } from "next/font/google";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthNav } from "./auth-nav";
import { LanguageSwitcher } from "./language-switcher";
import { SignInModal } from "./sign-in-modal";
import { useSession } from "./session-provider";
import {
  OverflowMenu,
  type OverflowMenuItem,
} from "./my-analyses/overflow-menu";
import { supabaseBrowser } from "../lib/supabase/browser";
import { useMessages } from "./use-messages";
import { useLocale } from "./locale-provider";
import {
  ANALYSIS_V2_STORAGE_KEY,
  checkAnalysisV2ResponseContract,
  isAnalysisV2SuccessResponse,
  type AnalysisV2ResponseContractReason,
} from "../engine/analysis-v2-ui-adapter";
import { logAnalysisV2UnexpectedResponse } from "../engine/analysis-v2-diagnostics";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Clock3,
  Lightbulb,
  Lock,
  Menu,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

// ─── Utility: estimate mobile duration from script text ───────────────────────
function formatMobileDuration(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length === 0) return "0:00";
  const seconds = Math.max(4, Math.ceil(cleaned.length / 16.5));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Shared small components ──────────────────────────────────────────────────

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex h-[43px] items-center gap-2 rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-5 text-[15px] font-medium text-[#5B21B6]">
      {children}
    </div>
  );
}

function TrustItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
      <span>{children}</span>
    </div>
  );
}

function HandUnderline({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-flex flex-col items-start">
      <span>{children}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 260 12"
        preserveAspectRatio="none"
        className="mt-[-3px] h-[10px] w-full text-[#7C3AED]"
      >
        <path
          d="M3 7 C 28 2, 56 10, 88 6 S 148 3, 190 7 S 232 10, 257 5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
    </span>
  );
}

// ─── Desktop landing: background decoration ───────────────────────────────────

function BackgroundDecor() {
  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-[-240px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[#7C3AED]/[0.08] blur-[140px]" />
      <div className="pointer-events-none absolute right-[-220px] top-[220px] h-[520px] w-[520px] rounded-full bg-[#6D28D9]/[0.11] blur-[130px]" />
      <div className="pointer-events-none absolute left-[-260px] top-[780px] h-[560px] w-[560px] rounded-full bg-[#7C3AED]/[0.07] blur-[150px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.10)_1px,transparent_1px)] [background-size:26px_26px] opacity-[0.16]" />
      <div className="pointer-events-none absolute left-0 top-[94px] h-px w-full bg-gradient-to-r from-transparent via-[#E5E7EB] to-transparent" />
      <div className="pointer-events-none absolute left-0 top-[860px] h-px w-full bg-gradient-to-r from-transparent via-[#E5E7EB] to-transparent" />
    </>
  );
}

// ─── Desktop landing: navbar ──────────────────────────────────────────────────

function Navbar() {
  const messages = useMessages();

  return (
    <header className="relative z-10 mx-auto flex h-[96px] w-full max-w-[1280px] items-center justify-between px-8">
      <Link href="/" className="flex items-center gap-3">
        <Image src="/logo.png" alt="Climpy" width={40} height={40} className="h-10 w-10 object-contain" priority />
        <span className="text-[18px] font-bold tracking-[0.16em] text-[#111827]">CLIMPY</span>
      </Link>

      <nav className="hidden items-center gap-9 text-[15px] font-medium text-[#6B7280] md:flex">
        <a href="#features" className="transition hover:text-[#111827]">
          {messages.landing.nav.features}
        </a>
        <a href="#how-it-works" className="transition hover:text-[#111827]">
          {messages.landing.nav.howItWorks}
        </a>
        <a
          href="#analyzer"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="transition hover:text-[#111827]"
        >
          {messages.landing.nav.analyze}
        </a>
      </nav>

      <div className="hidden items-center gap-3 md:flex">
        <LanguageSwitcher />
        <AuthNav />
        <a
          href="#analyzer"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[14px] font-semibold text-[#111827] transition hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/10"
        >
          {messages.landing.nav.startFree}
        </a>
      </div>
    </header>
  );
}

// ─── Desktop landing: hero preview card ──────────────────────────────────────

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "orange" }) {
  const toneClass = { green: "text-[#22C55E]", red: "text-[#7C3AED]", orange: "text-[#FF9A1F]" }[tone];
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-[#F8F8FC] p-4">
      <p className="text-[13px] text-[#6B7280]">{label}</p>
      <p className={`mt-3 text-[34px] font-bold tracking-[-0.05em] ${toneClass}`}>{value}</p>
    </div>
  );
}

function ScriptLine({ time, children, active, warning }: { time: string; children: React.ReactNode; active?: boolean; warning?: boolean }) {
  return (
    <div className={["flex gap-3 rounded-[12px] border px-4 py-3 text-[14px] leading-[1.55]",
      active ? "border-[#DDD6FE] bg-[#F3E8FF] text-[#4C1D95]"
      : warning ? "border-[#FED7AA] bg-[#FFF7ED] text-[#9A3412]"
      : "border-transparent bg-[#F3F4F6] text-[#6B7280]"].join(" ")}>
      <span className="shrink-0 text-[#6B7280]">{time}</span>
      <span>{children}</span>
    </div>
  );
}

function PreviewCard() {
  const messages = useMessages();

  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[34px] bg-[#7C3AED]/10 blur-[70px]" />
      <div className="relative overflow-hidden rounded-[26px] border border-[#E5E7EB] bg-white p-5 shadow-[0_24px_90px_rgba(0,0,0,0.12)]">
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-[#111827]">
                {messages.landing.desktopPreview.title}
              </h2>
              <span className="rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-3 py-1 text-[12px] font-semibold text-[#7C3AED]">
                {messages.landing.desktopPreview.aiReview}
              </span>
            </div>
            <p className="mt-2 text-[14px] text-[#6B7280]">{messages.landing.desktopPreview.analyzedIn}</p>
          </div>
          <button className="rounded-[12px] border border-[#E5E7EB] bg-[#F3F4F6] px-4 py-2.5 text-[14px] font-semibold text-[#111827]">
            {messages.landing.desktopPreview.reanalyze}
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <MetricCard label={messages.landing.desktopPreview.scores.overall} value="82" tone="green" />
          <MetricCard label={messages.landing.desktopPreview.scores.hook} value="91" tone="red" />
          <MetricCard label={messages.landing.desktopPreview.scores.risk} value={messages.landing.desktopPreview.scores.medium} tone="orange" />
        </div>

        <div className="mt-7 rounded-[20px] border border-[#E5E7EB] bg-[#F8F8FC] p-5">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[15px] font-semibold text-[#111827]">{messages.landing.desktopPreview.scriptLabel}</p>
            <p className="text-[13px] text-[#6B7280]">0:00–0:28</p>
          </div>
          <div className="space-y-3">
            <ScriptLine time="0:00" active>{messages.landing.desktopPreview.scriptLines.opening}</ScriptLine>
            <ScriptLine time="0:05">{messages.landing.desktopPreview.scriptLines.retention}</ScriptLine>
            <ScriptLine time="0:12" warning>{messages.landing.desktopPreview.scriptLines.payoff}</ScriptLine>
            <ScriptLine time="0:18">{messages.landing.desktopPreview.scriptLines.fixes}</ScriptLine>
          </div>
        </div>

        <div className="mt-4 rounded-[16px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 py-3">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED]" />
            <div>
              <p className="text-[13px] font-semibold text-[#7C3AED]">{messages.landing.desktopPreview.mainTakeawayLabel}</p>
              <p className="mt-1 text-[13px] leading-[1.5] text-[#4B5563]">{messages.landing.desktopPreview.mainTakeaway}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[18px] border border-[#E5E7EB] bg-[#F8F8FC] p-5">
            <p className="text-[14px] font-semibold text-[#111827]">{messages.landing.desktopPreview.retentionCurve}</p>
            <div className="mt-5 flex h-[90px] items-end gap-2">
              {[70, 82, 76, 58, 64, 48, 54, 42, 46, 38].map((height, i) => (
                <div key={i} className="w-full rounded-t-[6px] bg-gradient-to-t from-[#7C3AED] to-[#A855F7]"
                  style={{ height: `${height}%`, opacity: 0.45 + i * 0.035 }} />
              ))}
            </div>
          </div>
          <div className="rounded-[18px] border border-[#DDD6FE] bg-[#F3E8FF] p-5">
            <div className="flex items-center gap-2 text-[#7C3AED]">
              <Lightbulb className="h-5 w-5" />
              <p className="text-[14px] font-semibold">{messages.landing.desktopPreview.suggestedFixLabel}</p>
            </div>
            <p className="mt-4 text-[15px] leading-[1.65] text-[#5B21B6]">
              {messages.landing.desktopPreview.suggestedFix}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop landing: hero section ───────────────────────────────────────────

function HeroSection() {
  const messages = useMessages();

  return (
    <section className="relative z-10 mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-14 px-8 pb-18 pt-16 lg:grid-cols-[1fr_580px] lg:gap-16 lg:pb-20 lg:pt-16">
      <div className="max-w-[700px]">
        <Badge>
          <Sparkles className="h-4 w-4 text-[#7C3AED]" />
          {messages.landing.hero.desktopBadge}
        </Badge>

        <h1 className="mt-8 max-w-[760px] text-[56px] font-extrabold leading-[0.98] tracking-[-0.06em] text-[#111827] md:text-[76px] lg:text-[84px]">
          {messages.landing.hero.desktopHeadlinePrefix}{" "}
            <span className="text-[#7C3AED]">
              {messages.landing.hero.desktopHeadlineHighlight}
            </span>
        </h1>

        <p className="mt-8 max-w-[560px] text-[20px] leading-[1.75] text-[#6B7280]">
          {messages.landing.hero.desktopDescription}
        </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="#analyzer"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex h-[54px] items-center justify-center gap-2.5 rounded-[12px] bg-[#6D28D9] px-7 text-[17px] font-semibold text-white shadow-[0_0_40px_rgba(109,40,217,0.30)] transition hover:bg-[#7C3AED]"
          >
            {messages.landing.hero.primaryAction}
            <ArrowRight className="h-4 w-4" />
          </a>

          <a
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex h-[54px] items-center justify-center gap-2.5 rounded-[12px] border border-[#E5E7EB] bg-white px-6 text-[16px] font-semibold text-[#111827] transition hover:border-white/15 hover:bg-[#F3F4F6]"
          >
            <Play className="h-4 w-4" style={{ fill: "white" }} />
            {messages.landing.hero.secondaryAction}
          </a>
        </div>

        <div className="mt-9 flex flex-wrap gap-4 text-[14px] text-[#6B7280]">
            <TrustItem>
              {messages.landing.hero.trustFindWeakLines}
            </TrustItem>
            <TrustItem>
              {messages.landing.hero.trustImprovePacing}
            </TrustItem>
            <TrustItem>
              {messages.landing.hero.trustFixBeforeUpload}
            </TrustItem>
        </div>
      </div>

      <PreviewCard />
    </section>
  );
}

// ─── Desktop landing: features / value section ────────────────────────────────

function MiniHookPreview() {
  const messages = useMessages();

  return (
    <div className="rounded-[20px] border border-[#E5E7EB] bg-[#F8F8FC] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-[#6B7280]">{messages.landing.value.hook.previewLabel}</p>
        <p className="text-[24px] font-bold text-[#7C3AED]">91</p>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
        <div className="h-full w-[91%] rounded-full bg-[#7C3AED]" />
      </div>
      <p className="mt-5 text-[14px] leading-[1.55] text-[#6B7280]">
        {messages.landing.value.hook.previewDescription}
      </p>
    </div>
  );
}

function MiniRetentionPreview() {
  const messages = useMessages();

  return (
    <div className="rounded-[20px] border border-[#E5E7EB] bg-[#F8F8FC] p-5">
      <p className="text-[14px] text-[#6B7280]">{messages.landing.value.retention.previewLabel}</p>
      <div className="mt-5 flex gap-2">
        <div className="h-3 flex-1 rounded-full bg-[#22C55E]" />
        <div className="h-3 flex-1 rounded-full bg-[#FF9A1F]" />
        <div className="h-3 flex-1 rounded-full bg-[#7C3AED]" />
      </div>
      <div className="mt-5 space-y-3 text-[14px]">
        <div className="flex justify-between text-[#6B7280]">
          <span>0:00–0:08</span><span className="text-[#22C55E]">{messages.landing.value.retention.strong}</span>
        </div>
        <div className="flex justify-between text-[#6B7280]">
          <span>0:09–0:18</span><span className="text-[#FF9A1F]">{messages.landing.value.retention.medium}</span>
        </div>
        <div className="flex justify-between text-[#6B7280]">
          <span>0:19–0:28</span><span className="text-[#7C3AED]">{messages.landing.value.retention.risky}</span>
        </div>
      </div>
    </div>
  );
}

function MiniFixPreview() {
  const messages = useMessages();

  return (
    <div className="rounded-[20px] border border-[#DDD6FE] bg-[#F3E8FF] p-5">
      <div className="flex items-center gap-2 text-[#7C3AED]">
        <ShieldCheck className="h-5 w-5" />
        <p className="text-[14px] font-semibold">{messages.landing.value.fixes.previewLabel}</p>
      </div>
      <p className="mt-5 text-[14px] leading-[1.7] text-[#5B21B6]">
        {messages.landing.value.fixes.previewDescription}
      </p>
      <button className="mt-5 rounded-[12px] bg-[#6D28D9] px-4 py-2.5 text-[14px] font-semibold text-white">
        {messages.landing.value.fixes.action}
      </button>
    </div>
  );
}

function FeatureCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="group rounded-[22px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_60px_rgba(17,24,39,0.04)] transition duration-300 hover:-translate-y-1 hover:border-[#7C3AED]/30 hover:bg-[#FAF7FF] hover:shadow-[0_26px_80px_rgba(124,58,237,0.14)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#DDD6FE] bg-[#F3E8FF] text-[#7C3AED]">
        {icon}
      </div>
      <h3 className="mt-6 text-[25px] font-semibold tracking-[-0.035em] text-[#111827]">{title}</h3>
      <p className="mt-3 min-h-[58px] text-[16px] leading-[1.65] text-[#6B7280]">{description}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

function ValueSection() {
  const messages = useMessages();

  return (
    <section id="features" className="relative z-10 mx-auto w-full max-w-[1280px] px-8 pb-16 pt-4">
      <div className="mx-auto max-w-[840px] text-center">
        <Badge>
          <Target className="h-4 w-4 text-[#7C3AED]" />
          {messages.landing.value.badge}
        </Badge>
                <h2 className="mt-8 text-[48px] font-extrabold leading-[1.02] tracking-[-0.055em] text-[#111827] md:text-[70px] lg:text-[78px]">
          {messages.landing.value.headingPrefix}{" "}
          <span className="text-[#7C3AED]">{messages.landing.value.headingHighlight}</span>
        </h2>
        <p className="mx-auto mt-7 max-w-[700px] text-[20px] leading-[1.75] text-[#6B7280]">
          {messages.landing.value.description}
        </p>
      </div>

      <div id="how-it-works" className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        <FeatureCard icon={<BarChart3 className="h-6 w-6" />} title={messages.landing.value.hook.title} description={messages.landing.value.hook.description}>
          <MiniHookPreview />
        </FeatureCard>
        <FeatureCard icon={<Clock3 className="h-6 w-6" />} title={messages.landing.value.retention.title} description={messages.landing.value.retention.description}>
          <MiniRetentionPreview />
        </FeatureCard>
        <FeatureCard icon={<TrendingUp className="h-6 w-6" />} title={messages.landing.value.fixes.title} description={messages.landing.value.fixes.description}>
          <MiniFixPreview />
        </FeatureCard>
      </div>
    </section>
  );
}

const MAX_TITLE_CHARACTERS = 200;

// ─── Desktop: analyzer section ────────────────────────────────────────────────

function AnalyzerSection({
  title,
  setTitle,
  script,
  handleScriptChange,
  maxCharacters,
  handleAnalyze,
  isAnalyzing,
  analyzeError,
  onTryExample,
}: {
  title: string;
  setTitle: (v: string) => void;
  script: string;
  handleScriptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  maxCharacters: number;
  handleAnalyze: () => void;
  isAnalyzing: boolean;
  analyzeError: string;
  onTryExample: () => void;
}) {
  const messages = useMessages();

  const scriptCharactersOverLimit = Math.max(
    0,
    script.length - maxCharacters
  );

  return (
    <section className="relative z-10 mx-auto w-full max-w-[1280px] px-8 pb-24" id="analyzer">
      <div className="mx-auto max-w-[840px] text-center mb-14">
        <Badge>
          <Sparkles className="h-4 w-4 text-[#7C3AED]" />
            {messages.landing.analyzer.eyebrow}
          </Badge>
        <h2 className="mt-8 text-[48px] font-extrabold leading-[1.02] tracking-[-0.055em] text-[#111827]">
          {messages.landing.analyzer.heading}
        </h2>
        <p className="mx-auto mt-5 max-w-[560px] text-[18px] leading-[1.75] text-[#6B7280]">
          {messages.landing.analyzer.supportingText}
        </p>

          <div
            aria-label={messages.landing.analyzer.instructionsLabel}
            className="mx-auto mt-8 grid max-w-[760px] grid-cols-3 gap-3 text-left"
          >
            {[
              {
                number: "1",
                title: messages.landing.analyzer.steps.paste.title,
                description: messages.landing.analyzer.steps.paste.desktopDescription,
              },
              {
                number: "2",
                title: messages.landing.analyzer.steps.analyze.title,
                description: messages.landing.analyzer.steps.analyze.desktopDescription,
              },
              {
                number: "3",
                title: messages.landing.analyzer.steps.review.title,
                description: messages.landing.analyzer.steps.review.desktopDescription,
              },
            ].map((step) => (
              <div
                key={step.number}
                className="rounded-[16px] border border-[#E5E7EB] bg-white px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[12px] font-bold text-[#7C3AED]">
                    {step.number}
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-[#111827]">
                      {step.title}
                    </p>
                    <p className="mt-1 text-[12px] leading-[1.55] text-[#6B7280]">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left: inputs */}
        <div className="flex flex-col gap-5">
          {/* Title input */}
          <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="text-[15px] font-semibold text-[#111827]">
                  {messages.landing.analyzer.videoTitle}{" "}
                  <span className="text-[#6B7280] font-normal">
                    {messages.landing.analyzer.optionalDesktop}
                  </span>
              </label>
              <span
                className={`shrink-0 text-[13px] font-medium ${
                  title.length > MAX_TITLE_CHARACTERS
                    ? "text-[#7C3AED]"
                    : "text-[#6B7280]"
                }`}
              >
                {title.length} / {MAX_TITLE_CHARACTERS}
              </span>
            </div>
              <p className="mb-4 text-[13px] text-[#6B7280]">
                {messages.landing.analyzer.titleHelp}
              </p>
            <div
              className={`flex h-[44px] items-center rounded-[12px] border bg-[#F8F8FC] px-4 ${
                title.length > MAX_TITLE_CHARACTERS
                  ? "border-[#7C3AED]"
                  : "border-[#E5E7EB]"
              }`}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={messages.landing.analyzer.titlePlaceholder}
                className="h-full w-full bg-transparent text-[14px] text-[#6B7280] outline-none placeholder:text-[#6B7280]"
              />
            </div>
            {title.length > MAX_TITLE_CHARACTERS && (
              <p className="mt-3 text-[13px] font-medium text-[#7C3AED]">
                {messages.landing.analyzer.titleTooLong}
              </p>
            )}
          </div>

          {/* Script textarea */}
          <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-[15px] font-semibold text-[#111827]">{messages.landing.analyzer.scriptLabel}</label>
              <span className={`text-[13px] font-medium ${script.length > maxCharacters ? "text-[#7C3AED]" : "text-[#6B7280]"}`}>
                {script.length} / {maxCharacters}
              </span>
            </div>
            <p className="mb-4 text-[13px] leading-[1.6] text-[#6B7280]">
              {messages.landing.analyzer.scriptHelpDesktop}
            </p>

            {script.trim().length === 0 && (
              <button
                type="button"
                onClick={onTryExample}
                className="mb-4 text-[13px] font-semibold text-[#7C3AED] hover:underline"
              >
                {messages.landing.analyzer.tryExampleAction}
              </button>
            )}

            <div
              className={`relative rounded-[14px] border bg-[#F8F8FC] ${
                scriptCharactersOverLimit > 0
                  ? "border-[#7C3AED]"
                  : "border-[#E5E7EB]"
              }`}
            >
              <textarea
                value={script}
                onChange={handleScriptChange}
                placeholder={messages.landing.analyzer.scriptPlaceholderDesktop}
                rows={12}
                className="w-full resize-none rounded-[14px] bg-transparent px-5 py-4 text-[14px] leading-[1.7] text-[#6B7280] outline-none placeholder:text-[#6B7280]"
              />
              {script.length === 0 && (
                <p className="pointer-events-none absolute left-5 top-[52px] text-[13px] text-[#9CA3AF]">
                  {messages.landing.analyzer.copyHint}
                </p>
              )}
            </div>

            {scriptCharactersOverLimit > 0 && (
              <p className="mt-3 text-[13px] font-medium leading-[1.6] text-[#7C3AED]">
                {messages.landing.analyzer.scriptOverLimit(scriptCharactersOverLimit)}
              </p>
            )}
          </div>

          {/* Analyze button + error */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleAnalyze}
              disabled={
                isAnalyzing ||
                script.trim().length === 0 ||
                script.length > maxCharacters ||
                title.length > MAX_TITLE_CHARACTERS
              }
              className="inline-flex h-[60px] w-full items-center justify-center gap-3 rounded-[14px] text-[18px] font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#EDE9FE] disabled:text-[#A78BFA] disabled:opacity-70 disabled:shadow-none enabled:bg-[#6D28D9] enabled:shadow-[0_0_54px_rgba(109,40,217,0.28)] enabled:hover:bg-[#7C3AED]"
            >
                {isAnalyzing ? messages.landing.analyzer.analyzing : (
                  <>
                    {messages.landing.analyzer.analyzeScript}
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
            </button>

            {analyzeError && scriptCharactersOverLimit === 0 && (
              <p className="text-[13px] text-[#7C3AED]">{analyzeError}</p>
            )}

            <div className="flex items-start gap-2 text-[13px] text-[#6B7280]">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex flex-col gap-1">
                <span>{messages.landing.analyzer.privacy}</span>
                <span>{messages.landing.analyzer.noAccountNeeded}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: what you get */}
        <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-6 h-fit">
          <p className="text-[17px] font-semibold text-[#111827] mb-5">{messages.landing.analyzer.whatYouWillGet}</p>
          <div className="flex flex-col gap-4">
            {[
              { icon: <BarChart3 className="h-5 w-5" />, ...messages.landing.analyzer.whatYouWillGetItems.overallScore },
              { icon: <Target className="h-5 w-5" />, ...messages.landing.analyzer.whatYouWillGetItems.hookAnalysis },
              { icon: <TrendingUp className="h-5 w-5" />, ...messages.landing.analyzer.whatYouWillGetItems.retentionRisk },
              { icon: <Lightbulb className="h-5 w-5" />, ...messages.landing.analyzer.whatYouWillGetItems.riskyTimestamps },
              { icon: <ShieldCheck className="h-5 w-5" />, ...messages.landing.analyzer.whatYouWillGetItems.suggestedFixes },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-[14px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 py-3.5">
                <div className="mt-0.5 shrink-0 text-[#7C3AED]">{item.icon}</div>
                <div>
                  <p className="text-[14px] font-semibold text-[#111827]">{item.title}</p>
                  <p className="mt-0.5 text-[12px] leading-[1.5] text-[#6B7280]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


function ComparisonSection() {
  const messages = useMessages();

  return (
    <section className="relative z-10 mx-auto w-full max-w-[1280px] px-8 pb-28">
      <div className="text-center">
        <Badge>{messages.landing.comparison.badge}</Badge>
        <h2 className="mx-auto mt-8 max-w-[860px] text-[56px] font-extrabold leading-[1.02] tracking-[-0.06em] text-[#111827]">
          {messages.landing.comparison.headingPrefix}{" "}
          <HandUnderline>{messages.landing.comparison.headingHighlight}</HandUnderline>.
        </h2>
        <p className="mx-auto mt-5 max-w-[620px] text-[18px] leading-[1.75] text-[#6B7280]">
          {messages.landing.comparison.description}
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="h-fit rounded-[28px] border border-[#E5E7EB] bg-[#F9FAFB] p-7">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
            {messages.landing.comparison.withoutLabel}
          </p>
          <h3 className="mt-4 text-[28px] font-extrabold leading-[1.08] tracking-[-0.05em] text-[#111827]">
            {messages.landing.comparison.withoutHeading}
          </h3>
          <p className="mt-4 text-[15px] leading-[1.7] text-[#6B7280]">
            {messages.landing.comparison.withoutDescription}
          </p>

          <div className="mt-7 space-y-4">
            {[
              messages.landing.comparison.withoutItems[0],
              messages.landing.comparison.withoutItems[1],
              messages.landing.comparison.withoutItems[2],
              messages.landing.comparison.withoutItems[3],
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E5E7EB] text-[13px] font-bold text-[#9CA3AF]">
                  ×
                </span>
                <p className="text-[15px] leading-[1.55] text-[#6B7280]">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-[#DDD6FE] bg-white p-8 shadow-[0_28px_90px_rgba(124,58,237,0.16)]">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#7C3AED]">
                Climpy
              </p>
              <h3 className="mt-4 text-[34px] font-extrabold leading-[1.02] tracking-[-0.055em] text-[#111827]">
                {messages.landing.comparison.withHeading}
              </h3>
            </div>

            <div className="rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-4 py-2 text-[13px] font-semibold text-[#7C3AED]">
              {messages.landing.comparison.aiReview}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: messages.landing.comparison.scores.hookScore, value: "74" },
              { label: messages.landing.comparison.scores.risk, value: messages.landing.comparison.scores.medium },
              { label: messages.landing.comparison.scores.riskyPart, value: "0:08–0:14" },
            ].map((item) => (
              <div key={item.label} className="rounded-[18px] border border-[#E9D5FF] bg-[#FAF5FF] p-4">
                <p className="text-[12px] font-semibold text-[#7C3AED]">{item.label}</p>
                <p className="mt-2 text-[24px] font-extrabold tracking-[-0.04em] text-[#111827]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4">
            <div className="rounded-[18px] border border-[#E9D5FF] bg-white p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                {messages.landing.comparison.mainIssueLabel}
              </p>
              <p className="mt-2 text-[16px] font-semibold leading-[1.6] text-[#111827]">
                {messages.landing.comparison.mainIssue}
              </p>
            </div>

            <div className="rounded-[18px] border border-[#E9D5FF] bg-white p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                {messages.landing.comparison.suggestedFixLabel}
              </p>
              <p className="mt-2 text-[16px] font-semibold leading-[1.6] text-[#111827]">
                {messages.landing.comparison.suggestedFix}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}



function CommonQuestionsSection() {
  const messages = useMessages();

  const questions = messages.landing.faq.questions;

  return (
    <section
      id="faqs"
      className="relative z-10 mx-auto w-full max-w-[1280px] px-8 pb-28"
    >
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.35fr]">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.22em] text-[#7C3AED]">
            {messages.landing.faq.badge}
          </div>

          <h2 className="max-w-[430px] text-[48px] font-extrabold leading-[1.02] tracking-[-0.055em] text-[#111827]">
            {messages.landing.faq.headingPrefix}{" "}<HandUnderline>{messages.landing.faq.headingHighlight}</HandUnderline>
          </h2>

          <p className="mt-5 max-w-[430px] text-[17px] leading-8 text-[#6B7280]">
            {messages.landing.faq.description}
          </p>
        </div>

        <div>
          <div className="grid gap-4 md:grid-cols-2">
            {questions.map((item) => (
              <details
                key={item.question}
                className="group rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_22px_70px_rgba(17,24,39,0.06)] transition hover:border-[#DDD6FE]"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left marker:hidden">
                  <span className="text-[18px] font-bold leading-6 tracking-[-0.03em] text-[#111827]">
                    {item.question}
                  </span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF] text-xl font-light text-[#7C3AED] transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>

                <p className="mt-4 text-[15px] leading-7 text-[#6B7280]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-6 rounded-[30px] border border-[#DDD6FE] bg-[#F3E8FF] p-6">
            <div>
              <h3 className="text-[22px] font-extrabold tracking-[-0.04em] text-[#111827]">
                {messages.landing.faq.ctaHeading}
              </h3>
              <p className="mt-2 text-[15px] leading-6 text-[#6B7280]">
                {messages.landing.faq.ctaDescription}
              </p>
            </div>

            <a
              href="#analyzer"
              className="shrink-0 rounded-full bg-[#111827] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#1F2937]"
            >
              {messages.landing.faq.ctaAction}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}



// The footer brand gradient's final/darkest stop — shared with HomePage's
// scroll listener so the body background it sets while scrolled to the
// bottom (for elastic-overscroll) can never drift from the actual footer.
const FOOTER_BRAND_DARK = "#3B0764";

function FooterSection() {
  const messages = useMessages();
  const footer = messages.landing.footer;

  return (
    <footer className="relative z-10 w-full">
      {/* Zone A — light footer content: logo, description, nav columns */}
      <div className="border-t border-[#E5E7EB] bg-[#FAF7FF]">
        <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-8 py-14 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Climpy"
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
              />
              <div>
                <p className="text-[22px] font-extrabold tracking-[-0.06em] text-[#111827]">
                  Climpy
                </p>
                <p className="text-[13px] font-medium text-[#6B7280]">
                  {footer.tagline}
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-[430px] text-[16px] leading-7 text-[#6B7280]">
              {footer.description}
            </p>
          </div>

          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
              {footer.productHeading}
            </p>
            <div className="mt-5 grid gap-3 text-[15px] font-medium text-[#374151]">
              <a href="#analyzer" className="transition hover:text-[#7C3AED]">
                {footer.analyzeScript}
              </a>
              <a href="#faqs" className="transition hover:text-[#7C3AED]">
                {footer.faqs}
              </a>
              <a href="#analyzer" className="transition hover:text-[#7C3AED]">
                {footer.tryClimpy}
              </a>
            </div>
          </div>

          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
              {footer.builtForHeading}
            </p>
            <div className="mt-5 grid gap-3 text-[15px] font-medium text-[#374151]">
              {footer.builtForItems.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Zone A → Zone B transition + Zone B itself, grouped so the glow's
          negative top offset can visually overlap Zone A's tail without
          affecting document flow/height (it's absolutely positioned). */}
      <div className="relative">
        {/* Soft fog/glow bridging the seam: transparent at its own top
            (revealing Zone A's flat color underneath), fading into the same
            lavender tone Zone B's gradient starts with. Holds a brief fully
            opaque plateau right at the Zone A/B boundary so the DOM seam is
            always masked by this single x-uniform color, regardless of how
            Zone B's own (radial-influenced, edge-weaker) blend looks at that
            row. Purely decorative, zero layout height — cannot add scroll
            space. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-[120px] z-10 h-[200px]"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(250,247,255,0) 0%, rgba(245,238,255,0.45) 38%, rgba(238,222,255,1) 55%, rgba(238,222,255,1) 65%, rgba(225,200,255,0.45) 82%, rgba(210,180,255,0) 100%)",
          }}
        />

        {/* Zone B — full-bleed brand zone: the last thing on the page.
            Layered radial + linear gradients (not a flat purple fill): an
            almost-white/lavender glow at the top blends into vivid Climpy
            purple, deepening toward the bottom, with a second soft radial
            bloom placed lower to sit behind the wordmark. A pure vertical
            linear-gradient sits underneath the radials as a guaranteed,
            x-independent fade — the radials add depth/bloom on top, but
            every column (including the far left/right edges, where the
            radials contribute little) still gets the same smooth hand-off
            from Zone A's tail into the brand gradient. */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            backgroundImage: `
              radial-gradient(120% 60% at 50% 0%, rgba(250,247,255,0.95) 0%, rgba(233,213,255,0.55) 20%, rgba(168,85,247,0.35) 42%, rgba(168,85,247,0) 62%),
              radial-gradient(90% 70% at 50% 82%, rgba(124,58,237,0.55) 0%, rgba(124,58,237,0) 65%),
              linear-gradient(180deg, rgba(250,247,255,0.98) 0%, rgba(240,226,255,0.9) 10%, rgba(216,185,255,0.6) 22%, rgba(190,150,255,0.22) 34%, rgba(190,150,255,0) 46%),
              linear-gradient(180deg, #FAF5FF 0%, #C084FC 22%, #7C3AED 56%, ${FOOTER_BRAND_DARK} 100%)
            `,
          }}
        >
          <div className="pointer-events-none absolute left-1/2 top-[68%] h-[380px] w-[75%] max-w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.10] blur-[110px]" />

          <div className="relative mx-auto flex w-full max-w-[1280px] flex-col items-center px-4 pt-20 sm:pt-28">
            <p
              aria-hidden="true"
              className="select-none whitespace-nowrap text-[clamp(52px,17vw,200px)] font-extrabold leading-none tracking-[-0.04em] text-white/25 [-webkit-text-stroke:1.5px_rgba(255,255,255,0.65)]"
            >
              CLIMPY
            </p>
          </div>

          <div className="relative mx-auto mt-10 flex w-full max-w-[1280px] flex-col gap-2 border-t border-white/15 px-8 py-6 text-[13px] font-medium text-white/60 sm:mt-14 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
            <p>{footer.copyright}</p>
            <p>{footer.processTagline}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}


// ─── Root page component ──────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLocale();
  const messages = useMessages();
  const { user } = useSession();
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Mobile-header compact menu (see the MOBILE LAYOUT header below) — the
  // same underlying actions AuthNav already exposes (Results/My Analyses/
  // Sign in/Sign out), just reachable through one accessible menu button
  // instead of every pill/button forced into one un-wrapped row, which
  // overflowed the viewport at ~390-400px. No new destinations, no
  // duplicated auth logic: this calls the exact same supabaseBrowser sign-
  // out and reuses the exact same SignInModal AuthNav itself uses.
  const [isMobileSignInModalOpen, setIsMobileSignInModalOpen] = useState(false);
  const [isMobileSigningOut, setIsMobileSigningOut] = useState(false);

  async function handleMobileSignOut() {
    if (isMobileSigningOut) return;

    setIsMobileSigningOut(true);
    await supabaseBrowser.auth.signOut();
    setIsMobileSigningOut(false);
  }

  const mobileMenuItems: OverflowMenuItem[] = [
    {
      key: "results",
      label: messages.landing.nav.results,
      onSelect: () => router.push("/results"),
    },
    ...(user
      ? [
          {
            key: "myAnalyses",
            label: messages.common.myAnalyses,
            onSelect: () => router.push("/my-analyses"),
          },
          {
            key: "signOut",
            label: messages.common.signOut,
            onSelect: handleMobileSignOut,
            disabled: isMobileSigningOut,
          },
        ]
      : [
          {
            key: "signIn",
            label: messages.common.signIn,
            onSelect: () => setIsMobileSignInModalOpen(true),
          },
        ]),
  ];

  // Elastic/rubber-band overscroll reveals the root <body> background, not
  // page content — <main> always paints its own opaque light background over
  // the real content regardless. Swapping body's background only while
  // scrolled to the true bottom makes a bottom overscroll reveal the
  // footer's own dark color instead of a mismatched light flash, while a top
  // overscroll still reveals the default light background untouched.
  useEffect(() => {
    let currentlyDark = false;

    function syncOverscrollBackground() {
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 1;

      // Skip the write entirely when nothing would change — avoids a style
      // mutation (and the resulting style recalc) on every scroll tick.
      if (atBottom === currentlyDark) {
        return;
      }

      currentlyDark = atBottom;
      document.body.style.backgroundColor = atBottom
        ? FOOTER_BRAND_DARK
        : "";
    }

    syncOverscrollBackground();
    window.addEventListener("scroll", syncOverscrollBackground, {
      passive: true,
    });
    window.addEventListener("resize", syncOverscrollBackground, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", syncOverscrollBackground);
      window.removeEventListener("resize", syncOverscrollBackground);
      // Navigating away (client-side routing keeps the same <body> node)
      // must not leave a different page permanently dark.
      document.body.style.backgroundColor = "";
    };
  }, []);

  // Compensates for arriving at /#analyzer (e.g. "New Analysis" from
  // /results or /my-analyses) on a narrow viewport. Next.js's own
  // hash-scroll (and a plain browser anchor) targets the analyzer section's
  // id, but that section belongs to the DESKTOP LAYOUT tree above, which is
  // display:none below the min-[900px] breakpoint — a display:none element
  // has no box to scroll to, so the native scroll silently no-ops there.
  // offsetParent is null exactly when that's the case, so this only ever
  // fires as a fallback for the one viewport band where the shared
  // #analyzer id couldn't have worked, using the same
  // document.getElementById(...).scrollIntoView() every other in-page
  // "jump to analyzer" control on this page already uses (see Navbar,
  // HeroSection, and the mobile header/hero above).
  useEffect(() => {
    if (window.location.hash !== "#analyzer") {
      return;
    }

    const desktopTarget = document.getElementById("analyzer");

    if (desktopTarget && desktopTarget.offsetParent === null) {
      document.getElementById("analyzer-mobile")?.scrollIntoView();
    }
  }, []);

  const maxCharacters = 1000;
  const scriptCharactersOverLimit = Math.max(
    0,
    script.length - maxCharacters
  );

  function handleScriptChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = event.target.value;
    setScript(val);

    if (val.length > maxCharacters) {
      setAnalyzeError(
        messages.landing.errors.scriptTooLong
      );
    } else if (analyzeError) {
      setAnalyzeError("");
    }
  }

  // Onboarding helper only — inserts one localized, pre-written example so
  // a first-time user can see the Analyze flow without writing anything.
  // Guarded again here (not just by the caller's conditional render) so a
  // stray/duplicate trigger can never clobber real user input.
  function handleTryExample() {
    if (script.trim().length > 0) {
      return;
    }

    setScript(messages.landing.analyzer.exampleScript);

    if (analyzeError) {
      setAnalyzeError("");
    }
  }

  function handleAnalyze() {
    const cleanedScript = script.trim();
    const cleanedTitle = title.trim();

    if (cleanedScript.length === 0) {
      setAnalyzeError(messages.landing.errors.emptyScript);
      return;
    }

    if (script.length > maxCharacters) {
      setAnalyzeError(
        messages.landing.errors.scriptTooLong
      );
      return;
    }

    if (cleanedTitle.length > MAX_TITLE_CHARACTERS) {
      setAnalyzeError(
        messages.landing.errors.titleTooLong
      );
      return;
    }

    let previousScript: string | null = null;
    let previousTitle: string | null = null;
    let previousAnalysis: string | null = null;
    let hasStorageSnapshot = false;

    const restoreSessionValue = (
      key: string,
      value: string | null
    ) => {
      try {
        if (value === null) {
          sessionStorage.removeItem(key);
        } else {
          sessionStorage.setItem(key, value);
        }
      } catch {
        // Storage is unavailable; the visible error below remains the source of truth.
      }
    };

    function clearLegacyStoredScript() {
      try {
        localStorage.removeItem("reelyze-script");
      } catch {
        // Legacy cleanup is optional and must not block a valid analysis.
      }
    }

    setAnalyzeError("");
    setIsAnalyzing(true);

    void (async () => {
      try {
        const response = await fetch("/api/analyze-v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            script: cleanedScript,
            title: cleanedTitle,
            locale,
          }),
        });

        let payload: unknown;

        try {
          payload = await response.json();
        } catch {
          throw new Error(
            messages.landing.errors.invalidResponse
          );
        }

        if (!response.ok) {
          // The API's `reason` is a technical/debug message and must not be
          // shown raw — it never goes through the message catalog and would
          // leak English into a Russian UI. Always show the localized
          // fallback instead.
          throw new Error(
            messages.landing.errors.analysisFailed
          );
        }

        if (
          !isAnalysisV2SuccessResponse(
            payload,
            cleanedScript
          )
        ) {
          const contractCheck =
            checkAnalysisV2ResponseContract(
              payload,
              cleanedScript
            );

          // contractCheck.valid should be unreachable here (it re-derives
          // the same verdict as the guard above), kept only for the
          // discriminated-union type.
          const contractReason: AnalysisV2ResponseContractReason =
            contractCheck.valid
              ? "invalid-success-shape"
              : contractCheck.reason;

          const rawRetryCount = response.headers.get(
            "x-analysis-v2-retry-count"
          );
          const parsedRetryCount =
            rawRetryCount !== null
              ? Number(rawRetryCount)
              : NaN;

          logAnalysisV2UnexpectedResponse({
            endpoint: "/api/analyze-v2",
            httpStatus: response.status,
            contentType: response.headers.get(
              "content-type"
            ),
            uiLocale: locale,
            reason: contractReason,
            payload,
            requestId: response.headers.get(
              "x-analysis-v2-request-id"
            ),
            retryCount: Number.isFinite(
              parsedRetryCount
            )
              ? parsedRetryCount
              : null,
          });

          throw new Error(
            messages.landing.errors.unexpectedResponse
          );
        }

        previousScript =
          sessionStorage.getItem("reelyze-script");
        previousTitle =
          sessionStorage.getItem("reelyze-title");
        previousAnalysis =
          sessionStorage.getItem(
            ANALYSIS_V2_STORAGE_KEY
          );
        hasStorageSnapshot = true;

        sessionStorage.setItem(
          "reelyze-script",
          cleanedScript
        );
        sessionStorage.setItem(
          "reelyze-title",
          cleanedTitle
        );
        sessionStorage.setItem(
          ANALYSIS_V2_STORAGE_KEY,
          JSON.stringify(payload)
        );

        clearLegacyStoredScript();
        router.push("/results");
      } catch (caughtError) {
        if (hasStorageSnapshot) {
          restoreSessionValue(
            "reelyze-script",
            previousScript
          );
          restoreSessionValue(
            "reelyze-title",
            previousTitle
          );
          restoreSessionValue(
            ANALYSIS_V2_STORAGE_KEY,
            previousAnalysis
          );
        }

        setIsAnalyzing(false);
        setAnalyzeError(
          caughtError instanceof Error
            ? caughtError.message
            : messages.landing.errors.generic
        );
      }
    })();
  }

  return (
    <main
      className={`${inter.className} min-h-screen bg-[#FAFAFA] text-[#111827] antialiased`}
    >
      {/* ══════════════════════════════════
          DESKTOP LAYOUT
          Threshold is a custom min-[900px] variant, not the default lg
          (1024px) breakpoint: a non-maximized desktop/tablet window in the
          ~900-1023px range must already get the desktop nav and a
          sensible-width hero, not the phone-width MOBILE LAYOUT below. Every
          other lg: (1024px) usage inside these sections (two-column grids,
          etc.) is untouched and continues to refine at 1024px as before.
      ══════════════════════════════════ */}
      <div className="hidden min-[900px]:block">
        <div className="relative overflow-hidden">
          <BackgroundDecor />
          <Navbar />
          <HeroSection />
          <ValueSection />
          <AnalyzerSection
            title={title}
            setTitle={setTitle}
            script={script}
            handleScriptChange={handleScriptChange}
            maxCharacters={maxCharacters}
            handleAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            analyzeError={analyzeError}
            onTryExample={handleTryExample}
          />
          <ComparisonSection />
          <CommonQuestionsSection />
          <FooterSection />
        </div>
      </div>

            {/* ══════════════════════════════════
          MOBILE LAYOUT
          Hidden from min-[900px] up (the complementary half of the pair
          above), not lg:hidden — see the note on the DESKTOP LAYOUT wrapper.
      ══════════════════════════════════ */}
      <div className="relative block min-h-screen overflow-x-hidden bg-[#FAFAFA] min-[900px]:hidden">
        <div className="pointer-events-none absolute left-1/2 top-[-140px] h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-[#7C3AED]/[0.10] blur-[95px]" />
        <div className="pointer-events-none absolute right-[-140px] top-[420px] h-[280px] w-[280px] rounded-full bg-[#6D28D9]/[0.07] blur-[100px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.08)_1px,transparent_1px)] [background-size:26px_26px] opacity-[0.10]" />

        {/* max-w-[430px] is unchanged for true mobile (below md/768px, per
            the existing design). md:max-w-[640px] only widens the OUTER
            container once the viewport reaches the 768-899px tablet band
            still served by this tree, so that band no longer reads as a
            narrow phone-width column centered in extra whitespace. */}
        <div className="relative z-10 mx-auto flex w-full max-w-[430px] flex-col px-5 pb-14 md:max-w-[640px]">
          {/* Header */}
          <div className="flex items-center justify-between pt-7">
                        <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Climpy"
                width={32}
                height={32}
                className="h-[32px] w-[32px] object-contain"
                priority
              />
              <span className="text-[14px] font-bold tracking-[0.16em] text-[#111827]">
  CLIMPY
</span>
            </Link>

            {/* Compact mobile header (root cause of the diagnosed ~390-
                400px overflow: the old row packed LanguageSwitcher +
                AuthNav (1-2 pills) + a "Results" link, un-wrapped, into one
                row alongside the logo — easily exceeding the available
                width, worse still when signed in). Only the language
                control stays inline; every other action (Results, My
                Analyses, Sign in/out) moves into one accessible menu — see
                app/my-analyses/overflow-menu.tsx (reused as-is, not a
                second navigation system). */}
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <OverflowMenu
                triggerLabel={messages.common.menu}
                items={mobileMenuItems}
                icon={Menu}
              />
            </div>
          </div>

          <SignInModal
            isOpen={isMobileSignInModalOpen}
            onClose={() => setIsMobileSignInModalOpen(false)}
            nextPath={pathname}
          />

          {/* Hero */}
          <section className="pt-12">
            <div className="inline-flex h-[30px] items-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-3.5">
              <span className="text-[11px] font-semibold text-[#7C3AED]">
                {messages.landing.hero.mobileBadge}
              </span>
            </div>

            <h1 className="mt-5 max-w-[370px] text-[41px] font-bold leading-[43px] tracking-[-0.065em] text-[#111827]">
              {messages.landing.hero.mobileHeadlinePrefix}{" "}
              <span className="text-[#7C3AED]">
                {messages.landing.hero.mobileHeadlineHighlight}
              </span>
            </h1>

            <p className="mt-4 max-w-[350px] text-[15px] font-medium leading-[24px] text-[#6B7280]">
              {messages.landing.hero.mobileDescription}
            </p>

            <a
              href="#analyzer-mobile"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("analyzer-mobile")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-6 inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-[15px] bg-[#6D28D9] text-[15px] font-bold text-white shadow-[0_0_40px_rgba(109,40,217,0.28)] transition hover:bg-[#7C3AED] active:scale-[0.99]"
            >
              {messages.landing.hero.primaryAction}
              <ArrowRight className="h-4 w-4" />
            </a>

            <div className="mt-4 flex items-center gap-3 text-[11px] font-medium text-[#6B7280]">
              <span>{messages.landing.hero.shortsFirst}</span>
              <span className="h-1 w-1 rounded-full bg-[#3A3A42]" />
              <span>{messages.landing.hero.characterLimit}</span>
              <span className="h-1 w-1 rounded-full bg-[#3A3A42]" />
              <span>{messages.landing.hero.noUploadNeeded}</span>
            </div>
          </section>

          {/* Preview card */}
          <section className="mt-8 overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.10)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-bold tracking-[-0.02em] text-[#111827]">{messages.landing.mobile.previewTitle}</p>
                <p className="mt-1 text-[11px] text-[#6B7280]">{messages.landing.mobile.previewLabel}</p>
              </div>

              <div className="rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-3 py-1.5">
                <span className="text-[11px] font-semibold text-[#7C3AED]">{messages.landing.mobile.aiFeedback}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-[15px] border border-[#E5E7EB] bg-[#F8F8FC] p-3">
                <p className="text-[10px] font-medium text-[#6B7280]">{messages.landing.mobile.previewScores.overall}</p>
                <p className="mt-2 text-[24px] font-semibold leading-none text-[#111827]">82</p>
              </div>

              <div className="rounded-[15px] border border-[#DDD6FE] bg-[#F3E8FF] p-3">
                <p className="text-[10px] font-medium text-[#7E22CE]">{messages.landing.mobile.previewScores.hook}</p>
                <p className="mt-2 text-[24px] font-semibold leading-none text-[#7C3AED]">91</p>
              </div>

              <div className="rounded-[15px] border border-[#E5E7EB] bg-[#F8F8FC] p-3">
                <p className="text-[10px] font-medium text-[#6B7280]">{messages.landing.mobile.previewScores.risk}</p>
                <p className="mt-2 text-[20px] font-semibold leading-none text-[#FF9A1F]">{messages.landing.mobile.previewScores.medium}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-[14px] border border-[#DDD6FE] bg-[#F3E8FF] px-3.5 py-3">
                <p className="text-[11px] font-semibold text-[#7C3AED]">{messages.landing.mobile.previewHookIssue}</p>
                <p className="mt-1 text-[12px] leading-[18px] text-[#5B21B6]">
                  {messages.landing.mobile.previewHookIssueDescription}
                </p>
              </div>

              <div className="rounded-[14px] border border-[#E5E7EB] bg-[#F8F8FC] px-3.5 py-3">
                <p className="text-[11px] font-semibold text-[#6B7280]">{messages.landing.mobile.previewSuggestedFix}</p>
                <p className="mt-1 text-[12px] leading-[18px] text-[#6B7280]">
                  {messages.landing.mobile.previewSuggestedFixDescription}
                </p>
              </div>
            </div>
          </section>

          {/* Analyzer */}
          <section
            id="analyzer-mobile"
            className="mt-8 scroll-mt-6 rounded-[24px] border border-[#E5E7EB] bg-white/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.10)]"
          >
            <div className="mb-5">
              <div className="mb-3 inline-flex h-[28px] items-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-3">
                <span className="text-[10px] font-semibold text-[#7C3AED]">{messages.landing.mobile.newAnalysis}</span>
              </div>

              <h2 className="text-[27px] font-bold leading-[32px] tracking-[-0.055em] text-[#111827]">
                {messages.landing.mobile.newAnalysisHeading}
              </h2>

              <p className="mt-2 text-[13px] leading-[21px] text-[#8F8F99]">
                {messages.landing.mobile.newAnalysisDescription}
              </p>

              <div
                aria-label={messages.landing.analyzer.instructionsLabel}
                className="mt-4 space-y-2"
              >
                {[
                  messages.landing.analyzer.steps.paste.mobileDescription,
                  messages.landing.analyzer.steps.analyze.mobileDescription,
                  messages.landing.analyzer.steps.review.mobileDescription,
                ].map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center gap-2.5 rounded-[13px] border border-[#E5E7EB] bg-[#F8F8FC] px-3 py-2.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[10px] font-bold text-[#7C3AED]">
                      {index + 1}
                    </span>
                    <p className="text-[12px] font-medium leading-[18px] text-[#6B7280]">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Title input */}
            <div className="rounded-[18px] border border-[#E5E7EB] bg-[#F8F8FC] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <p className="text-[14px] font-semibold text-[#111827]">{messages.landing.analyzer.videoTitle}</p>
                  <p className="text-[11px] font-medium text-[#6B7280]">{messages.landing.analyzer.optionalMobile}</p>
                </div>
                <p
                  className={`shrink-0 text-[11px] font-medium ${
                    title.length > MAX_TITLE_CHARACTERS
                      ? "text-[#7C3AED]"
                      : "text-[#6B7280]"
                  }`}
                >
                  {title.length} / {MAX_TITLE_CHARACTERS}
                </p>
              </div>

              <div
                className={`flex h-[43px] w-full items-center rounded-[13px] border bg-[#FAFAFA] px-3.5 ${
                  title.length > MAX_TITLE_CHARACTERS
                    ? "border-[#7C3AED]"
                    : "border-[#E5E7EB]"
                }`}
              >
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={messages.landing.analyzer.titlePlaceholder}
                  className="h-full w-full bg-transparent text-[13px] text-[#6B7280] outline-none placeholder:text-[#9CA3AF]"
                />
              </div>

              {title.length > MAX_TITLE_CHARACTERS && (
                <p className="mt-3 text-[11px] font-medium leading-[18px] text-[#7C3AED]">
                  {messages.landing.analyzer.titleTooLong}
                </p>
              )}
            </div>

            {/* Script input */}
            <div className="mt-3 rounded-[18px] border border-[#E5E7EB] bg-[#F8F8FC] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[14px] font-semibold text-[#111827]">{messages.landing.analyzer.scriptLabel}</p>
                <p className={`shrink-0 text-[11px] font-medium ${script.length > maxCharacters ? "text-[#7C3AED]" : "text-[#6B7280]"}`}>
                  {script.length} / {maxCharacters}
                </p>
              </div>

              <p className="mb-3 text-[12px] leading-[18px] text-[#6B7280]">
                {messages.landing.analyzer.scriptHelpMobile}
              </p>

              {script.trim().length === 0 && (
                <button
                  type="button"
                  onClick={handleTryExample}
                  className="mb-2 inline-block py-1 text-[12px] font-semibold text-[#7C3AED]"
                >
                  {messages.landing.analyzer.tryExampleAction}
                </button>
              )}

              <div
                className={`overflow-hidden rounded-[14px] border bg-[#FAFAFA] ${
                  scriptCharactersOverLimit > 0
                    ? "border-[#7C3AED]"
                    : "border-[#E5E7EB]"
                }`}
              >
                <textarea
                  value={script}
                  onChange={handleScriptChange}
                  placeholder={messages.landing.analyzer.scriptPlaceholderMobile}
                  rows={7}
                  className="w-full resize-none rounded-[14px] bg-transparent px-3.5 py-3 text-[13px] leading-[22px] text-[#6B7280] outline-none placeholder:text-[#9CA3AF]"
                />
              </div>

              {scriptCharactersOverLimit > 0 && (
                <p className="mt-3 text-[11px] font-medium leading-[18px] text-[#7C3AED]">
                  {messages.landing.analyzer.scriptOverLimit(scriptCharactersOverLimit)}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-[#6B7280]" />
                  <p className="text-[12px] text-[#6B7280]">{messages.landing.mobile.estimatedDuration(formatMobileDuration(script))}</p>
                </div>

                <p className="rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#6B7280]">
                  {messages.landing.analyzer.shortsOnly}
                </p>
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={
                isAnalyzing ||
                script.trim().length === 0 ||
                script.length > maxCharacters ||
                title.length > MAX_TITLE_CHARACTERS
              }
              className="mt-4 inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-[15px] text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:bg-[#EDE9FE] disabled:text-[#A78BFA] disabled:opacity-70 disabled:shadow-none enabled:bg-[#6D28D9] enabled:text-white enabled:shadow-[0_0_34px_rgba(109,40,217,0.30)] enabled:hover:bg-[#7C3AED] active:scale-[0.99]"
            >
              {isAnalyzing ? (
                messages.landing.analyzer.analyzing
              ) : (
                <>
                  {messages.landing.analyzer.analyzeScript}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {analyzeError && script.length <= maxCharacters && (
              <div className="mt-3 rounded-[13px] border border-[#DDD6FE] bg-[#F3E8FF] px-3.5 py-3">
                <p className="text-[12px] font-medium leading-[18px] text-[#7C3AED]">{analyzeError}</p>
              </div>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-[13px] border border-[#E5E7EB] bg-[#F8F8FC] px-3.5 py-3">
              <Lock size={13} className="mt-0.5 shrink-0 text-[#6B7280]" />
              <div className="flex flex-col gap-1.5">
                <p className="text-[12px] leading-[18px] text-[#6B7280]">
                  {messages.landing.analyzer.privacy}
                </p>
                <p className="text-[12px] leading-[18px] text-[#6B7280]">
                  {messages.landing.analyzer.noAccountNeeded}
                </p>
              </div>
            </div>
          </section>

          {/* What Climpy checks */}
          <section className="mt-8">
            <p className="mb-3 text-[16px] font-semibold text-[#111827]">{messages.landing.mobile.checksHeading}</p>

            <div className="grid grid-cols-1 gap-2.5">
              {[
                { icon: <Target size={16} />, ...messages.landing.mobile.checks.hookStrength },
                { icon: <BarChart3 size={16} />, ...messages.landing.mobile.checks.retentionRisk },
                { icon: <Lightbulb size={16} />, ...messages.landing.mobile.checks.payoffQuality },
                { icon: <ShieldCheck size={16} />, ...messages.landing.mobile.checks.suggestedFixes },
              ].map((item) => (
                <div key={item.title} className="flex min-h-[58px] items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-white/90 px-3.5">
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] border border-[#DDD6FE] bg-[#F3E8FF] text-[#7C3AED]">
                    {item.icon}
                  </div>

                  <div>
                    <p className="text-[13px] font-semibold text-[#111827]">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-[16px] text-[#6B7280]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="mt-8 rounded-[24px] border border-[#DDD6FE] bg-[#F3E8FF] p-5">
            <h2 className="text-[23px] font-bold leading-[29px] tracking-[-0.055em] text-[#111827]">
              {messages.landing.mobile.improveBeforeRecording}
            </h2>

            <p className="mt-2 text-[13px] leading-[21px] text-[#7E22CE]">
              {messages.landing.mobile.nextIdea}
            </p>

            <a
              href="#analyzer-mobile"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("analyzer-mobile")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-5 inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#6D28D9] text-[14px] font-semibold text-white transition hover:bg-[#7C3AED]"
            >
              {messages.landing.mobile.tryClimpy}
              <ArrowRight className="h-4 w-4" />
            </a>
          </section>
        </div>

        <div className="relative z-10 mt-8">
          <FooterSection />
        </div>
      </div>

    </main>
  );
}
