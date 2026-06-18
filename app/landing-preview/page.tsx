import { Inter } from "next/font/google";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Lightbulb,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export default function LandingPreviewPage() {
  return (
    <main className={`${inter.className} min-h-screen bg-[#050505] text-white`}>
      <DesktopLanding />
    </main>
  );
}

function DesktopLanding() {
  return (
    <div className="relative overflow-hidden">
      <BackgroundDecor />

      <Navbar />

      <HeroSection />

      <ValueSection />

      <BottomCTA />
    </div>
  );
}

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

function Navbar() {
  return (
    <header className="relative z-10 mx-auto flex h-[96px] w-full max-w-[1280px] items-center justify-between px-8">
      <a href="/" className="flex items-center gap-3">
        <img
          src="/logo.png"
          alt="Reelyze"
          className="h-10 w-10 object-contain"
        />
        <span className="text-[22px] font-bold tracking-[0.18em] text-white">
          REELYZE
        </span>
      </a>

      <nav className="hidden items-center gap-9 text-[15px] font-medium text-[#A1A1AA] md:flex">
        <a href="#features" className="transition hover:text-white">
          Features
        </a>
        <a href="#how-it-works" className="transition hover:text-white">
          How it works
        </a>
        <a href="#analyzer" className="transition hover:text-white">
          Analyze
        </a>
      </nav>

      <a
        href="/#analyzer"
        className="hidden rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:border-[#EF4444]/50 hover:bg-[#EF4444]/10 md:inline-flex"
      >
        Start free
      </a>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative z-10 mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-14 px-8 pb-18 pt-16 lg:grid-cols-[1fr_580px] lg:gap-16 lg:pb-20 lg:pt-16">
      <div className="max-w-[700px]">
        <Badge>
          <Sparkles className="h-4 w-4 text-[#EF4444]" />
          Made for creators
        </Badge>

        <h1 className="mt-6 max-w-[720px] text-[52px] font-extrabold leading-[1.0] tracking-[-0.055em] text-white md:text-[68px] lg:text-[76px]">
          Analyze your scripts before{" "}
          <span className="text-[#EF4444]">you upload.</span>
        </h1>

        <p className="mt-6 max-w-[520px] text-[18px] leading-[1.7] text-[#B3B3B3]">
          Reelyze finds weak hooks, risky middles, and payoff gaps before your video goes live.
        </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="/#analyzer"
            className="inline-flex h-[54px] items-center justify-center gap-2.5 rounded-[12px] bg-[#DC2626] px-7 text-[17px] font-semibold text-white shadow-[0_0_40px_rgba(220,38,38,0.30)] transition hover:bg-[#EF4444]"
          >
            Start Analyzing
            <ArrowRight className="h-4 w-4" />
          </a>

          <a
            href="#how-it-works"
            className="inline-flex h-[54px] items-center justify-center gap-2.5 rounded-[12px] border border-[#24242A] bg-[#0B0B0F] px-6 text-[16px] font-semibold text-white transition hover:border-white/15 hover:bg-[#111114]"
          >
            <Play className="h-4 w-4" style={{ fill: "white" }} />
            See How It Works
          </a>
        </div>

                <div className="mt-7 flex flex-wrap gap-3.5 text-[13px] text-[#888892]">
          <TrustItem>Find weak lines</TrustItem>
          <TrustItem>Improve pacing</TrustItem>
          <TrustItem>Fix before upload</TrustItem>
        </div>
      </div>

      <PreviewCard />
    </section>
  );
}

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

function PreviewCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[34px] bg-[#EF4444]/10 blur-[70px]" />

      <div className="relative overflow-hidden rounded-[26px] border border-[#24242A] bg-[#0B0B0F] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Script Review
            </h2>
            <p className="mt-2 text-[14px] text-[#777A85]">
              Analyzed in 8 seconds
            </p>
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
            <p className="text-[15px] font-semibold text-white">
              Your Script
            </p>
            <p className="text-[13px] text-[#777A85]">0:00–0:28</p>
          </div>

          <div className="space-y-3">
            <ScriptLine time="0:00" active>
              If your first 3 seconds feel slow, most viewers are already gone.
            </ScriptLine>
            <ScriptLine time="0:05">
              Reelyze finds the exact moment where retention starts dropping.
            </ScriptLine>
            <ScriptLine time="0:12" warning>
              This line needs a stronger visual payoff.
            </ScriptLine>
            <ScriptLine time="0:18">
              Then it gives you clearer fixes before you upload.
            </ScriptLine>
          </div>
        </div>

        <MainTakeaway />

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[18px] border border-[#24242A] bg-[#101014] p-5">
            <p className="text-[14px] font-semibold text-white">
              Retention Curve
            </p>

            <div className="mt-5 flex h-[90px] items-end gap-2">
              {[70, 82, 76, 58, 64, 48, 54, 42, 46, 38].map((height, index) => (
                <div
                  key={index}
                  className="w-full rounded-t-[6px] bg-gradient-to-t from-[#DC2626] to-[#EF4444]"
                  style={{ height: `${height}%`, opacity: 0.45 + index * 0.035 }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-[18px] border border-[#3A1B22] bg-[#1A0D11] p-5">
            <div className="flex items-center gap-2 text-[#EF4444]">
              <Lightbulb className="h-5 w-5" />
              <p className="text-[14px] font-semibold">Suggested Fix</p>
            </div>

            <p className="mt-4 text-[15px] leading-[1.65] text-[#E8D5D8]">
              Add a sharper contrast in the first line. Make the viewer feel
              what they lose if they scroll.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MainTakeaway() {
  return (
    <div className="mt-4 rounded-[16px] border border-[#2A2A30] bg-[#101014] px-4 py-3">
      <div className="flex items-start gap-3">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]" />

        <div>
          <p className="text-[13px] font-semibold text-[#EF4444]">
            Main Takeaway
          </p>
          <p className="mt-1 text-[13px] leading-[1.5] text-[#CFCFD6]">
            Strong hook, but the middle section needs a clearer payoff.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red" | "orange";
}) {
  const toneClass = {
    green: "text-[#22C55E]",
    red: "text-[#EF4444]",
    orange: "text-[#FF9A1F]",
  }[tone];

  return (
    <div className="rounded-[18px] border border-[#24242A] bg-[#101014] p-4">
      <p className="text-[13px] text-[#777A85]">{label}</p>
      <p className={`mt-3 text-[34px] font-bold tracking-[-0.05em] ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function ScriptLine({
  time,
  children,
  active,
  warning,
}: {
  time: string;
  children: React.ReactNode;
  active?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={[
        "flex gap-3 rounded-[12px] border px-4 py-3 text-[14px] leading-[1.55]",
        active
          ? "border-[#3A1B22] bg-[#1A0D11] text-[#F3E7E9]"
          : warning
            ? "border-[#5A3412] bg-[#1A1208] text-[#FFE3C2]"
            : "border-transparent bg-[#15151A] text-[#A1A1AA]",
      ].join(" ")}
    >
      <span className="shrink-0 text-[#777A85]">{time}</span>
      <span>{children}</span>
    </div>
  );
}

function ValueSection() {
  return (
    <section
      id="features"
      className="relative z-10 mx-auto w-full max-w-[1280px] px-8 pb-24 pt-4"
    >
      <div className="mx-auto max-w-[840px] text-center">
        <Badge>
          <Target className="h-4 w-4 text-[#EF4444]" />
          Before you publish
        </Badge>

        <h2 className="mt-8 text-[48px] font-extrabold leading-[1.02] tracking-[-0.055em] text-white md:text-[70px] lg:text-[78px]">
          Built to find what viewers skip.
        </h2>

        <p className="mx-auto mt-7 max-w-[700px] text-[20px] leading-[1.75] text-[#B3B3B3]">
          Reelyze turns your script into clear feedback: what works, what feels
          slow, and what to improve before you post.
        </p>
      </div>

      <div
        id="how-it-works"
        className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3"
      >
        <FeatureCard
          icon={<BarChart3 className="h-6 w-6" />}
          title="Hook Analysis"
          description="Find out if your first line creates curiosity or feels too generic."
        >
          <MiniHookPreview />
        </FeatureCard>

        <FeatureCard
          icon={<Clock3 className="h-6 w-6" />}
          title="Retention Feedback"
          description="See where the script slows down, repeats itself, or loses payoff."
        >
          <MiniRetentionPreview />
        </FeatureCard>

        <FeatureCard
          icon={<TrendingUp className="h-6 w-6" />}
          title="Retention Fixes"
          description="Get specific changes you can make before recording or editing."
        >
          <MiniFixPreview />
        </FeatureCard>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group rounded-[26px] border border-[#24242A] bg-[#0B0B0F] p-6 transition hover:border-[#EF4444]/35 hover:bg-[#0E0E13]">
      <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#3A1B22] bg-[#1A0D11] text-[#EF4444]">
        {icon}
      </div>

      <h3 className="mt-6 text-[25px] font-semibold tracking-[-0.035em] text-white">
        {title}
      </h3>

      <p className="mt-3 min-h-[58px] text-[16px] leading-[1.65] text-[#9A9AA3]">
        {description}
      </p>

      <div className="mt-7">{children}</div>
    </div>
  );
}

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
          <span>0:00–0:08</span>
          <span className="text-[#22C55E]">Strong</span>
        </div>
        <div className="flex justify-between text-[#B3B3B3]">
          <span>0:09–0:18</span>
          <span className="text-[#FF9A1F]">Medium</span>
        </div>
        <div className="flex justify-between text-[#B3B3B3]">
          <span>0:19–0:28</span>
          <span className="text-[#EF4444]">Risky</span>
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
        Replace the generic setup with a specific visual outcome in the first
        sentence.
      </p>

      <button className="mt-5 rounded-[12px] bg-[#DC2626] px-4 py-2.5 text-[14px] font-semibold text-white">
        Improve Hook
      </button>
    </div>
  );
}

function BottomCTA() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1280px] px-8 pb-24">
      <div className="overflow-hidden rounded-[30px] border border-[#24242A] bg-[#0B0B0F] p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.45)] md:p-12">
        <h2 className="mx-auto max-w-[780px] text-[42px] font-extrabold leading-[1.05] tracking-[-0.055em] text-white md:text-[62px]">
          Improve your next Short before it goes live.
        </h2>

        <p className="mx-auto mt-5 max-w-[620px] text-[18px] leading-[1.7] text-[#B3B3B3]">
          Paste your script, get a retention breakdown, and fix weak moments in
          minutes.
        </p>

        <a
          href="/#analyzer"
          className="mx-auto mt-9 inline-flex h-[60px] items-center justify-center gap-3 rounded-[14px] bg-[#DC2626] px-9 text-[20px] font-semibold text-white shadow-[0_0_54px_rgba(220,38,38,0.34)] transition hover:bg-[#EF4444]"
        >
          Start Analyzing
          <ArrowRight className="h-5 w-5" />
        </a>
      </div>
    </section>
  );
}