"use client";

import { Inter } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Clock3,
  Lightbulb,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  SquarePen,
  PencilLine,
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
    <div className="inline-flex h-[43px] items-center gap-2 rounded-full border border-[#3A1B22] bg-[#1A0D11] px-5 text-[15px] font-medium text-[#E8D5D8]">
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

// ─── Desktop landing: background decoration ───────────────────────────────────

function BackgroundDecor() {
  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-[-240px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[#EF4444]/[0.08] blur-[140px]" />
      <div className="pointer-events-none absolute right-[-220px] top-[220px] h-[520px] w-[520px] rounded-full bg-[#DC2626]/[0.11] blur-[130px]" />
      <div className="pointer-events-none absolute left-[-260px] top-[780px] h-[560px] w-[560px] rounded-full bg-[#EF4444]/[0.07] blur-[150px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:26px_26px] opacity-[0.16]" />
      <div className="pointer-events-none absolute left-0 top-[94px] h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="pointer-events-none absolute left-0 top-[860px] h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </>
  );
}

// ─── Desktop landing: navbar ──────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="relative z-10 mx-auto flex h-[96px] w-full max-w-[1280px] items-center justify-between px-8">
      <Link href="/" className="flex items-center gap-3">
        <img src="/logo.png" alt="Reelyze" className="h-10 w-10 object-contain" />
        <span className="text-[18px] font-bold tracking-[0.16em] text-white">REELYZE</span>
      </Link>

      <nav className="hidden items-center gap-9 text-[15px] font-medium text-[#A1A1AA] md:flex">
        <a href="#features" className="transition hover:text-white">Features</a>
        <a href="#how-it-works" className="transition hover:text-white">How it works</a>
        <a
          href="#analyzer"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="transition hover:text-white"
        >
          Analyze
        </a>
      </nav>

      <a
        href="#analyzer"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" });
        }}
        className="hidden rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:border-[#EF4444]/50 hover:bg-[#EF4444]/10 md:inline-flex"
      >
        Start free
      </a>
    </header>
  );
}

// ─── Desktop landing: hero preview card ──────────────────────────────────────

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "orange" }) {
  const toneClass = { green: "text-[#22C55E]", red: "text-[#EF4444]", orange: "text-[#FF9A1F]" }[tone];
  return (
    <div className="rounded-[18px] border border-[#24242A] bg-[#101014] p-4">
      <p className="text-[13px] text-[#777A85]">{label}</p>
      <p className={`mt-3 text-[34px] font-bold tracking-[-0.05em] ${toneClass}`}>{value}</p>
    </div>
  );
}

function ScriptLine({ time, children, active, warning }: { time: string; children: React.ReactNode; active?: boolean; warning?: boolean }) {
  return (
    <div className={["flex gap-3 rounded-[12px] border px-4 py-3 text-[14px] leading-[1.55]",
      active ? "border-[#3A1B22] bg-[#1A0D11] text-[#F3E7E9]"
      : warning ? "border-[#5A3412] bg-[#1A1208] text-[#FFE3C2]"
      : "border-transparent bg-[#15151A] text-[#A1A1AA]"].join(" ")}>
      <span className="shrink-0 text-[#777A85]">{time}</span>
      <span>{children}</span>
    </div>
  );
}

function PreviewCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[34px] bg-[#EF4444]/10 blur-[70px]" />
      <div className="relative overflow-hidden rounded-[26px] border border-[#24242A] bg-[#0B0B0F] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-white">Script Review</h2>
            <p className="mt-2 text-[14px] text-[#777A85]">Analyzed in 8 seconds</p>
          </div>
          <button className="rounded-[12px] border border-[#2B2B31] bg-[#15151A] px-4 py-2.5 text-[14px] font-semibold text-white">
            Re-analyze
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <MetricCard label="Overall" value="82" tone="green" />
          <MetricCard label="Hook" value="91" tone="red" />
          <MetricCard label="Risk" value="Med" tone="orange" />
        </div>

        <div className="mt-7 rounded-[20px] border border-[#24242A] bg-[#101014] p-5">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[15px] font-semibold text-white">Your Script</p>
            <p className="text-[13px] text-[#777A85]">0:00–0:28</p>
          </div>
          <div className="space-y-3">
            <ScriptLine time="0:00" active>If your first 3 seconds feel slow, most viewers are already gone.</ScriptLine>
            <ScriptLine time="0:05">Reelyze finds the exact moment where retention starts dropping.</ScriptLine>
            <ScriptLine time="0:12" warning>This line needs a stronger visual payoff.</ScriptLine>
            <ScriptLine time="0:18">Then it gives you clearer fixes before you upload.</ScriptLine>
          </div>
        </div>

        <div className="mt-4 rounded-[16px] border border-[#2A2A30] bg-[#101014] px-4 py-3">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]" />
            <div>
              <p className="text-[13px] font-semibold text-[#EF4444]">Main Takeaway</p>
              <p className="mt-1 text-[13px] leading-[1.5] text-[#CFCFD6]">Strong hook, but the middle section needs a clearer payoff.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[18px] border border-[#24242A] bg-[#101014] p-5">
            <p className="text-[14px] font-semibold text-white">Retention Curve</p>
            <div className="mt-5 flex h-[90px] items-end gap-2">
              {[70, 82, 76, 58, 64, 48, 54, 42, 46, 38].map((height, i) => (
                <div key={i} className="w-full rounded-t-[6px] bg-gradient-to-t from-[#DC2626] to-[#EF4444]"
                  style={{ height: `${height}%`, opacity: 0.45 + i * 0.035 }} />
              ))}
            </div>
          </div>
          <div className="rounded-[18px] border border-[#3A1B22] bg-[#1A0D11] p-5">
            <div className="flex items-center gap-2 text-[#EF4444]">
              <Lightbulb className="h-5 w-5" />
              <p className="text-[14px] font-semibold">Suggested Fix</p>
            </div>
            <p className="mt-4 text-[15px] leading-[1.65] text-[#E8D5D8]">
              Add a sharper contrast in the first line. Make the viewer feel what they lose if they scroll.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop landing: hero section ───────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative z-10 mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-14 px-8 pb-18 pt-16 lg:grid-cols-[1fr_580px] lg:gap-16 lg:pb-20 lg:pt-16">
      <div className="max-w-[700px]">
        <Badge>
          <Sparkles className="h-4 w-4 text-[#EF4444]" />
          Made for creators
        </Badge>

        <h1 className="mt-8 max-w-[760px] text-[56px] font-extrabold leading-[0.98] tracking-[-0.06em] text-white md:text-[76px] lg:text-[84px]">
          Analyze your scripts before{" "}
          <span className="text-[#EF4444]">you upload.</span>
        </h1>

        <p className="mt-8 max-w-[560px] text-[20px] leading-[1.75] text-[#B3B3B3]">
          Reelyze helps creators improve hooks, pacing, and retention before the video goes live.
        </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="#analyzer"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex h-[54px] items-center justify-center gap-2.5 rounded-[12px] bg-[#DC2626] px-7 text-[17px] font-semibold text-white shadow-[0_0_40px_rgba(220,38,38,0.30)] transition hover:bg-[#EF4444]"
          >
            Start Analyzing
            <ArrowRight className="h-4 w-4" />
          </a>

          <a
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex h-[54px] items-center justify-center gap-2.5 rounded-[12px] border border-[#24242A] bg-[#0B0B0F] px-6 text-[16px] font-semibold text-white transition hover:border-white/15 hover:bg-[#111114]"
          >
            <Play className="h-4 w-4" style={{ fill: "white" }} />
            See How It Works
          </a>
        </div>

        <div className="mt-9 flex flex-wrap gap-4 text-[14px] text-[#888892]">
          <TrustItem>Find weak lines</TrustItem>
          <TrustItem>Improve pacing</TrustItem>
          <TrustItem>Fix before upload</TrustItem>
        </div>
      </div>

      <PreviewCard />
    </section>
  );
}

// ─── Desktop landing: features / value section ────────────────────────────────

function MiniHookPreview() {
  return (
    <div className="rounded-[20px] border border-[#24242A] bg-[#101014] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-[#777A85]">Hook Score</p>
        <p className="text-[24px] font-bold text-[#EF4444]">91</p>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#24242A]">
        <div className="h-full w-[91%] rounded-full bg-[#EF4444]" />
      </div>
      <p className="mt-5 text-[14px] leading-[1.55] text-[#B3B3B3]">
        Strong contrast, clear tension, and a reason to keep watching.
      </p>
    </div>
  );
}

function MiniRetentionPreview() {
  return (
    <div className="rounded-[20px] border border-[#24242A] bg-[#101014] p-5">
      <p className="text-[14px] text-[#777A85]">Risk Timeline</p>
      <div className="mt-5 flex gap-2">
        <div className="h-3 flex-1 rounded-full bg-[#22C55E]" />
        <div className="h-3 flex-1 rounded-full bg-[#FF9A1F]" />
        <div className="h-3 flex-1 rounded-full bg-[#EF4444]" />
      </div>
      <div className="mt-5 space-y-3 text-[14px]">
        <div className="flex justify-between text-[#B3B3B3]">
          <span>0:00–0:08</span><span className="text-[#22C55E]">Strong</span>
        </div>
        <div className="flex justify-between text-[#B3B3B3]">
          <span>0:09–0:18</span><span className="text-[#FF9A1F]">Medium</span>
        </div>
        <div className="flex justify-between text-[#B3B3B3]">
          <span>0:19–0:28</span><span className="text-[#EF4444]">Risky</span>
        </div>
      </div>
    </div>
  );
}

function MiniFixPreview() {
  return (
    <div className="rounded-[20px] border border-[#3A1B22] bg-[#1A0D11] p-5">
      <div className="flex items-center gap-2 text-[#EF4444]">
        <ShieldCheck className="h-5 w-5" />
        <p className="text-[14px] font-semibold">Fix suggestion</p>
      </div>
      <p className="mt-5 text-[14px] leading-[1.7] text-[#E8D5D8]">
        Replace the generic setup with a specific visual outcome in the first sentence.
      </p>
      <button className="mt-5 rounded-[12px] bg-[#DC2626] px-4 py-2.5 text-[14px] font-semibold text-white">
        Improve Hook
      </button>
    </div>
  );
}

function FeatureCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="group rounded-[22px] border border-[#24242A] bg-[#0B0B0F] p-6 transition hover:border-[#EF4444]/30 hover:bg-[#0D0D11]">
      <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#3A1B22] bg-[#1A0D11] text-[#EF4444]">
        {icon}
      </div>
      <h3 className="mt-6 text-[25px] font-semibold tracking-[-0.035em] text-white">{title}</h3>
      <p className="mt-3 min-h-[58px] text-[16px] leading-[1.65] text-[#9A9AA3]">{description}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

function ValueSection() {
  return (
    <section id="features" className="relative z-10 mx-auto w-full max-w-[1280px] px-8 pb-16 pt-4">
      <div className="mx-auto max-w-[840px] text-center">
        <Badge>
          <Target className="h-4 w-4 text-[#EF4444]" />
          Before you publish
        </Badge>
                <h2 className="mt-8 text-[48px] font-extrabold leading-[1.02] tracking-[-0.055em] text-white md:text-[70px] lg:text-[78px]">
          Built to find what viewers{" "}
          <span className="text-[#EF4444]">skip.</span>
        </h2>
        <p className="mx-auto mt-7 max-w-[700px] text-[20px] leading-[1.75] text-[#B3B3B3]">
          Reelyze turns your script into clear feedback: what works, what feels slow, and what to improve before you post.
        </p>
      </div>

      <div id="how-it-works" className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        <FeatureCard icon={<BarChart3 className="h-6 w-6" />} title="Hook Analysis" description="Find out if your first line creates curiosity or feels too generic.">
          <MiniHookPreview />
        </FeatureCard>
        <FeatureCard icon={<Clock3 className="h-6 w-6" />} title="Retention Feedback" description="See where the script slows down, repeats itself, or loses payoff.">
          <MiniRetentionPreview />
        </FeatureCard>
        <FeatureCard icon={<TrendingUp className="h-6 w-6" />} title="Retention Fixes" description="Get specific changes you can make before recording or editing.">
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
}: {
  title: string;
  setTitle: (v: string) => void;
  script: string;
  handleScriptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  maxCharacters: number;
  handleAnalyze: () => void;
  isAnalyzing: boolean;
  analyzeError: string;
}) {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1280px] px-8 pb-24" id="analyzer">
      <div className="mx-auto max-w-[840px] text-center mb-14">
        <Badge>
          <Sparkles className="h-4 w-4 text-[#EF4444]" />
          Try it now
        </Badge>
        <h2 className="mt-8 text-[48px] font-extrabold leading-[1.02] tracking-[-0.055em] text-white">
          Paste your script. Get instant feedback.
        </h2>
        <p className="mx-auto mt-5 max-w-[560px] text-[18px] leading-[1.75] text-[#B3B3B3]">
          Works best for YouTube Shorts (15–60 seconds). More formats coming soon.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left: inputs */}
        <div className="flex flex-col gap-5">
          {/* Title input */}
          <div className="rounded-[20px] border border-[#24242A] bg-[#0B0B0F] p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="text-[15px] font-semibold text-white">
                Video title <span className="text-[#777A85] font-normal">(optional)</span>
              </label>
              <span
                className={`shrink-0 text-[13px] font-medium ${
                  title.length > MAX_TITLE_CHARACTERS
                    ? "text-[#EF4444]"
                    : "text-[#777A85]"
                }`}
              >
                {title.length} / {MAX_TITLE_CHARACTERS}
              </span>
            </div>
            <p className="mb-4 text-[13px] text-[#777A85]">Helps Reelyze understand context.</p>
            <div
              className={`flex h-[44px] items-center rounded-[12px] border bg-[#101014] px-4 ${
                title.length > MAX_TITLE_CHARACTERS
                  ? "border-[#EF4444]"
                  : "border-[#24242A]"
              }`}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add your video title or topic"
                className="h-full w-full bg-transparent text-[14px] text-[#B3B3B3] outline-none placeholder:text-[#777A85]"
              />
            </div>
            {title.length > MAX_TITLE_CHARACTERS && (
              <p className="mt-3 text-[13px] font-medium text-[#EF4444]">
                Title is too long. Please shorten it to 200 characters or less.
              </p>
            )}
          </div>

          {/* Script textarea */}
          <div className="rounded-[20px] border border-[#24242A] bg-[#0B0B0F] p-6">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-[15px] font-semibold text-white">Your Script</label>
              <span className={`text-[13px] font-medium ${script.length > maxCharacters ? "text-[#EF4444]" : "text-[#777A85]"}`}>
                {script.length} / {maxCharacters}
              </span>
            </div>
            <p className="mb-4 text-[13px] text-[#777A85]">Paste your YouTube Shorts script below.</p>

            <div className="relative rounded-[14px] border border-[#24242A] bg-[#101014]">
              <textarea
                value={script}
                onChange={handleScriptChange}
                placeholder="Paste your script here..."
                rows={12}
                className="w-full resize-none rounded-[14px] bg-transparent px-5 py-4 text-[14px] leading-[1.7] text-[#B3B3B3] outline-none placeholder:text-[#777A85]"
              />
              {script.length === 0 && (
                <p className="pointer-events-none absolute left-5 top-[52px] text-[13px] text-[#555560]">
                  You can copy it from Google Docs, Notion, or any other tool.
                </p>
              )}
            </div>
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
              className="inline-flex h-[60px] w-full items-center justify-center gap-3 rounded-[14px] text-[18px] font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#3A1010] disabled:text-[#6B3030] disabled:opacity-70 disabled:shadow-none enabled:bg-[#DC2626] enabled:shadow-[0_0_54px_rgba(220,38,38,0.28)] enabled:hover:bg-[#EF4444]"
            >
              {isAnalyzing ? "Analyzing..." : (
                <>Analyze Script <ArrowRight className="h-5 w-5" /></>
              )}
            </button>

            {analyzeError && (
              <p className="text-[13px] text-[#EF4444]">{analyzeError}</p>
            )}

            <div className="flex items-center gap-2 text-[13px] text-[#777A85]">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Your script is only used to generate this analysis.</span>
            </div>
          </div>
        </div>

        {/* Right: what you get */}
        <div className="rounded-[20px] border border-[#24242A] bg-[#0B0B0F] p-6 h-fit">
          <p className="text-[17px] font-semibold text-white mb-5">What you&apos;ll get</p>
          <div className="flex flex-col gap-4">
            {[
              { icon: <BarChart3 className="h-5 w-5" />, title: "Overall Score", desc: "See how strong your script is before posting." },
              { icon: <Target className="h-5 w-5" />, title: "Hook Analysis", desc: "Find out if your opening stops the scroll." },
              { icon: <TrendingUp className="h-5 w-5" />, title: "Retention Risk", desc: "Spot moments where viewers may lose interest." },
              { icon: <Lightbulb className="h-5 w-5" />, title: "Risky Timestamps", desc: "Get specific lines and moments to improve." },
              { icon: <ShieldCheck className="h-5 w-5" />, title: "Suggested Fixes", desc: "Receive clear fixes for hooks, pacing, and payoff." },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-[14px] border border-[#24242A] bg-[#101014] px-4 py-3.5">
                <div className="mt-0.5 shrink-0 text-[#EF4444]">{item.icon}</div>
                <div>
                  <p className="text-[14px] font-semibold text-white">{item.title}</p>
                  <p className="mt-0.5 text-[12px] leading-[1.5] text-[#777A85]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Desktop landing: bottom CTA ─────────────────────────────────────────────
// NOTE: BottomCTA is intentionally kept here but no longer rendered in the
// desktop layout. The analyzer section is now the terminal section on desktop.

function BottomCTA() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1280px] px-8 pb-24">
      <div className="overflow-hidden rounded-[24px] border border-[#24242A] bg-[#0B0B0F] px-8 py-12 text-center shadow-[0_16px_60px_rgba(0,0,0,0.40)] md:px-12 md:py-14">
        <h2 className="mx-auto max-w-[700px] text-[38px] font-extrabold leading-[1.06] tracking-[-0.05em] text-white md:text-[54px]">
          Improve your next Short before it goes live.
        </h2>

        <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-[1.7] text-[#B3B3B3]">
          Paste your script, get a retention breakdown, and fix weak moments in minutes.
        </p>

        
                    <a
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex h-[60px] items-center justify-center gap-3 rounded-[14px] border border-[#252830] bg-[#111114] px-7 text-[18px] font-semibold text-white transition hover:border-white/20 hover:bg-[#17171C]"
          >
            <Play className="h-5 w-5" style={{ fill: "white" }} />
            See How It Works
          </a>
      </div>
    </section>
  );
}

// ─── Root page component ──────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  const maxCharacters = 1000;

  function handleScriptChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = event.target.value;
    setScript(val);
    if (val.length > maxCharacters) {
      setAnalyzeError("Script is too long. Please shorten it to 1,000 characters or less.");
    } else if (analyzeError) {
      setAnalyzeError("");
    }
  }

  function handleAnalyze() {
    const cleanedScript = script.trim();
    const cleanedTitle = title.trim();

    if (cleanedScript.length === 0) {
      setAnalyzeError("Please paste your script before analyzing.");
      return;
    }
    if (script.length > maxCharacters) {
      setAnalyzeError("Script is too long. Please shorten it to 1,000 characters or less.");
      return;
    }
    if (cleanedTitle.length > MAX_TITLE_CHARACTERS) {
      setAnalyzeError("Title is too long. Please shorten it to 200 characters or less.");
      return;
    }

    let previousScript: string | null = null;
    let previousTitle: string | null = null;
    let hasStorageSnapshot = false;

    const restoreSessionValue = (key: string, value: string | null) => {
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

    try {
      previousScript = sessionStorage.getItem("reelyze-script");
      previousTitle = sessionStorage.getItem("reelyze-title");
      hasStorageSnapshot = true;

      sessionStorage.setItem("reelyze-script", cleanedScript);
      sessionStorage.setItem("reelyze-title", cleanedTitle);
      clearLegacyStoredScript();
      router.push("/results");
    } catch {
      if (hasStorageSnapshot) {
        restoreSessionValue("reelyze-script", previousScript);
        restoreSessionValue("reelyze-title", previousTitle);
      }
      setIsAnalyzing(false);
      setAnalyzeError("Something went wrong. Please try again.");
    }
  }

  return (
    <main className={`${inter.className} min-h-screen bg-[#050505] text-white antialiased`}>

      {/* ══════════════════════════════════
          DESKTOP LAYOUT
      ══════════════════════════════════ */}
      <div className="hidden lg:block">
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
          />
          {/* BottomCTA removed — analyzer is now the final desktop section */}
        </div>
      </div>

            {/* ══════════════════════════════════
          MOBILE LAYOUT
      ══════════════════════════════════ */}
      <div className="relative block min-h-screen overflow-x-hidden bg-[#050505] lg:hidden">
        <div className="pointer-events-none absolute left-1/2 top-[-140px] h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-[#EF4444]/[0.10] blur-[95px]" />
        <div className="pointer-events-none absolute right-[-140px] top-[420px] h-[280px] w-[280px] rounded-full bg-[#DC2626]/[0.07] blur-[100px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:26px_26px] opacity-[0.10]" />

        <div className="relative z-10 mx-auto flex w-full max-w-[430px] flex-col px-5 pb-14">
          {/* Header */}
          <div className="flex items-center justify-between pt-7">
                        <Link href="/" className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="Reelyze"
                className="h-[32px] w-[32px] object-contain"
              />
              <span className="text-[14px] font-bold tracking-[0.16em] text-white">
  REELYZE
</span>
            </Link>

            <Link
              href="/results"
              className="inline-flex h-[34px] items-center justify-center rounded-full border border-[#24242A] bg-[#0B0B0F]/80 px-4 text-[12px] font-semibold text-[#B3B3B3]"
            >
              Results
            </Link>
          </div>

          {/* Hero */}
          <section className="pt-12">
            <div className="inline-flex h-[30px] items-center rounded-full border border-[#3A1B22] bg-[#1A0D11] px-3.5">
              <span className="text-[11px] font-semibold text-[#EF4444]">
                YouTube Shorts script analyzer
              </span>
            </div>

            <h1 className="mt-5 max-w-[370px] text-[41px] font-bold leading-[43px] tracking-[-0.065em] text-white">
              Fix weak scripts before{" "}
              <span className="text-[#EF4444]">viewers scroll.</span>
            </h1>

            <p className="mt-4 max-w-[350px] text-[15px] font-medium leading-[24px] text-[#9A9AA3]">
              Reelyze reviews your hook, pacing, risky moments, and payoff before you upload your Short.
            </p>

            <a
              href="#analyzer-mobile"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("analyzer-mobile")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-6 inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-[15px] bg-[#DC2626] text-[15px] font-bold text-white shadow-[0_0_40px_rgba(220,38,38,0.28)] transition hover:bg-[#EF4444] active:scale-[0.99]"
            >
              Start Analyzing
              <ArrowRight className="h-4 w-4" />
            </a>

            <div className="mt-4 flex items-center gap-3 text-[11px] font-medium text-[#777A85]">
              <span>Shorts-first</span>
              <span className="h-1 w-1 rounded-full bg-[#3A3A42]" />
              <span>1,000 characters</span>
              <span className="h-1 w-1 rounded-full bg-[#3A3A42]" />
              <span>No upload needed</span>
            </div>
          </section>

          {/* Preview card */}
          <section className="mt-8 overflow-hidden rounded-[24px] border border-[#24242A] bg-[#0B0B0F]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-bold tracking-[-0.02em] text-white">Script Review</p>
                <p className="mt-1 text-[11px] text-[#777A85]">Preview result</p>
              </div>

              <div className="rounded-full border border-[#3A1B22] bg-[#1A0D11] px-3 py-1.5">
                <span className="text-[11px] font-semibold text-[#EF4444]">AI feedback</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-[15px] border border-[#24242A] bg-[#101014] p-3">
                <p className="text-[10px] font-medium text-[#777A85]">Overall</p>
                <p className="mt-2 text-[24px] font-semibold leading-none text-white">82</p>
              </div>

              <div className="rounded-[15px] border border-[#3A1B22] bg-[#1A0D11] p-3">
                <p className="text-[10px] font-medium text-[#A98B91]">Hook</p>
                <p className="mt-2 text-[24px] font-semibold leading-none text-[#EF4444]">91</p>
              </div>

              <div className="rounded-[15px] border border-[#24242A] bg-[#101014] p-3">
                <p className="text-[10px] font-medium text-[#777A85]">Risk</p>
                <p className="mt-2 text-[20px] font-semibold leading-none text-[#FF9A1F]">Med</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-[14px] border border-[#3A1B22] bg-[#1A0D11] px-3.5 py-3">
                <p className="text-[11px] font-semibold text-[#EF4444]">0:00 Hook issue</p>
                <p className="mt-1 text-[12px] leading-[18px] text-[#E8D5D8]">
                  Opening needs a clearer reason to keep watching.
                </p>
              </div>

              <div className="rounded-[14px] border border-[#24242A] bg-[#101014] px-3.5 py-3">
                <p className="text-[11px] font-semibold text-[#B3B3B3]">Suggested fix</p>
                <p className="mt-1 text-[12px] leading-[18px] text-[#777A85]">
                  Add a sharper contrast or specific outcome in the first line.
                </p>
              </div>
            </div>
          </section>

          {/* Analyzer */}
          <section
            id="analyzer-mobile"
            className="mt-8 scroll-mt-6 rounded-[24px] border border-[#24242A] bg-[#0B0B0F]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.45)]"
          >
            <div className="mb-5">
              <div className="mb-3 inline-flex h-[28px] items-center rounded-full border border-[#3A1B22] bg-[#1A0D11] px-3">
                <span className="text-[10px] font-semibold text-[#EF4444]">New analysis</span>
              </div>

              <h2 className="text-[27px] font-bold leading-[32px] tracking-[-0.055em] text-white">
                Paste your script.
              </h2>

              <p className="mt-2 text-[13px] leading-[21px] text-[#8F8F99]">
                Get a hook score, retention risk, risky timestamps, and specific fixes.
              </p>
            </div>

            {/* Title input */}
            <div className="rounded-[18px] border border-[#24242A] bg-[#101014] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <p className="text-[14px] font-semibold text-white">Video title</p>
                  <p className="text-[11px] font-medium text-[#777A85]">Optional</p>
                </div>
                <p
                  className={`shrink-0 text-[11px] font-medium ${
                    title.length > MAX_TITLE_CHARACTERS
                      ? "text-[#EF4444]"
                      : "text-[#777A85]"
                  }`}
                >
                  {title.length} / {MAX_TITLE_CHARACTERS}
                </p>
              </div>

              <div
                className={`flex h-[43px] w-full items-center rounded-[13px] border bg-[#050505] px-3.5 ${
                  title.length > MAX_TITLE_CHARACTERS
                    ? "border-[#EF4444]"
                    : "border-[#24242A]"
                }`}
              >
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add your video title or topic"
                  className="h-full w-full bg-transparent text-[13px] text-[#B3B3B3] outline-none placeholder:text-[#555560]"
                />
              </div>

              {title.length > MAX_TITLE_CHARACTERS && (
                <p className="mt-3 text-[11px] font-medium leading-[18px] text-[#EF4444]">
                  Title is too long. Please shorten it to 200 characters or less.
                </p>
              )}
            </div>

            {/* Script input */}
            <div className="mt-3 rounded-[18px] border border-[#24242A] bg-[#101014] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[14px] font-semibold text-white">Your Script</p>
                <p className={`shrink-0 text-[11px] font-medium ${script.length > maxCharacters ? "text-[#EF4444]" : "text-[#777A85]"}`}>
                  {script.length} / {maxCharacters}
                </p>
              </div>

              <div className="overflow-hidden rounded-[14px] border border-[#24242A] bg-[#050505]">
                <textarea
                  value={script}
                  onChange={handleScriptChange}
                  placeholder="Paste your script here."
                  rows={7}
                  className="w-full resize-none rounded-[14px] bg-transparent px-3.5 py-3 text-[13px] leading-[22px] text-[#B3B3B3] outline-none placeholder:text-[#555560]"
                />
              </div>

              {script.length > maxCharacters && (
                <p className="mt-3 text-[11px] font-medium leading-[18px] text-[#EF4444]">
                  Script is too long. Shorten it to 1,000 characters or less.
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-[#777A85]" />
                  <p className="text-[12px] text-[#777A85]">~{formatMobileDuration(script)} estimated</p>
                </div>

                <p className="rounded-full border border-[#24242A] bg-[#0B0B0F] px-2.5 py-1 text-[11px] font-medium text-[#777A85]">
                  Shorts only
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
              className="mt-4 inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-[15px] text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:bg-[#3A1010] disabled:text-[#6B3030] disabled:opacity-70 disabled:shadow-none enabled:bg-[#DC2626] enabled:text-white enabled:shadow-[0_0_34px_rgba(220,38,38,0.30)] enabled:hover:bg-[#EF4444] active:scale-[0.99]"
            >
              {isAnalyzing ? (
                "Analyzing..."
              ) : (
                <>
                  Analyze Script
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {analyzeError && script.length <= maxCharacters && (
              <div className="mt-3 rounded-[13px] border border-[#3A1B22] bg-[#1A0D11] px-3.5 py-3">
                <p className="text-[12px] font-medium leading-[18px] text-[#EF4444]">{analyzeError}</p>
              </div>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-[13px] border border-[#24242A] bg-[#101014] px-3.5 py-3">
              <Lock size={13} className="mt-0.5 shrink-0 text-[#777A85]" />
              <p className="text-[12px] leading-[18px] text-[#777A85]">
                Your script is only used to generate this analysis.
              </p>
            </div>
          </section>

          {/* What Reelyze checks */}
          <section className="mt-8">
            <p className="mb-3 text-[16px] font-semibold text-white">What Reelyze checks</p>

            <div className="grid grid-cols-1 gap-2.5">
              {[
                { icon: <Target size={16} />, title: "Hook strength", desc: "Scores your opening line." },
                { icon: <BarChart3 size={16} />, title: "Retention risk", desc: "Finds where viewers may drop." },
                { icon: <Lightbulb size={16} />, title: "Payoff quality", desc: "Checks if the ending feels worth it." },
                { icon: <ShieldCheck size={16} />, title: "Suggested fixes", desc: "Gives specific improvements." },
              ].map((item) => (
                <div key={item.title} className="flex min-h-[58px] items-center gap-3 rounded-[16px] border border-[#24242A] bg-[#0B0B0F]/90 px-3.5">
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] border border-[#3A1B22] bg-[#1A0D11] text-[#EF4444]">
                    {item.icon}
                  </div>

                  <div>
                    <p className="text-[13px] font-semibold text-white">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-[16px] text-[#777A85]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="mt-8 rounded-[24px] border border-[#3A1B22] bg-[#1A0D11] p-5">
            <h2 className="text-[23px] font-bold leading-[29px] tracking-[-0.055em] text-white">
              Improve the script before recording.
            </h2>

            <p className="mt-2 text-[13px] leading-[21px] text-[#A98B91]">
              Paste your next Short idea and see where viewers may lose interest.
            </p>

            <a
              href="#analyzer-mobile"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("analyzer-mobile")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-5 inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#DC2626] text-[14px] font-semibold text-white transition hover:bg-[#EF4444]"
            >
              Try Reelyze
              <ArrowRight className="h-4 w-4" />
            </a>
          </section>
        </div>
      </div>

    </main>
  );
}