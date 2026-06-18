"use client";

import { Inter } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  SquarePen,
  PencilLine,
  Gauge,
  Target,
  TriangleAlert,
  Lightbulb,
  BarChart3,
  Lock,
  Clock,
} from "lucide-react";

const inter = Inter({
  subsets: ["latin"],
});

function formatMobileDuration(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length === 0) return "0:00";
  const seconds = Math.max(4, Math.ceil(cleaned.length / 16.5));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function HomePage() {
  const router = useRouter();
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  function handleScriptChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = event.target.value;
    setScript(val);

    if (val.length > maxCharacters) {
      setAnalyzeError("Script is too long. Please shorten it to 1,000 characters or less.");
    } else if (analyzeError) {
      setAnalyzeError("");
    }
  }

  const maxCharacters = 1000;

  function handleAnalyze() {
    const cleanedScript = script.trim();

    if (cleanedScript.length === 0) {
      setAnalyzeError("Please paste your script before analyzing.");
      return;
    }

    if (script.length > maxCharacters) {
      setAnalyzeError("Script is too long. Please shorten it to 1,000 characters or less.");
      return;
    }

    setAnalyzeError("");
    setIsAnalyzing(true);

    try {
      sessionStorage.setItem("reelyze-script", cleanedScript);
      sessionStorage.setItem("reelyze-title", title.trim());
      localStorage.removeItem("reelyze-script");
      router.push("/results");
    } catch {
      setIsAnalyzing(false);
      setAnalyzeError("Something went wrong. Please try again.");
    }
  }

  return (
    <main
      className={`${inter.className} min-h-screen bg-[#050505] text-white antialiased`}
    >
      {/* DESKTOP */}
      <div className="hidden lg:block overflow-auto">
      <div className="relative h-[2850px] min-w-[1440px] bg-[#050505]">
        <header className="absolute left-0 top-0 z-20 h-[72px] w-[1440px] border-b border-[#1F1F1F] bg-[#050505]">
  <img
    src="/logo.png"
    alt="Reelyze logo"
    className="absolute left-[21px] top-[22px] h-[40px] w-[39px] object-contain"
  />

  <p className="absolute left-[74px] top-[28px] text-[22px] font-bold leading-[24px] tracking-[0.1em] text-white">
    Reelyze
  </p>

  <nav className="absolute left-[604px] top-[32px] flex h-[19px] w-[196px] items-center gap-[32px]">
    <a href="#features" className="text-[15px] font-medium leading-[19px] text-white/80 hover:text-white">
      Features
    </a>
    <a href="#how-it-works" className="text-[15px] font-medium leading-[19px] text-white/80 hover:text-white">
      How it works
    </a>
  </nav>

  <Link
    href="/results"
    className="absolute left-[1170px] top-[12px] flex h-[48px] w-[96px] items-center justify-center rounded-[14px] border border-[#24242A] bg-[#0B0C10] text-[15px] font-semibold text-white"
  >
    Results
  </Link>

  <a
    href="#analyzer"
    onClick={(event) => {
      event.preventDefault();
      document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" });
    }}
    className="absolute left-[1280px] top-[12px] flex h-[48px] w-[140px] items-center justify-center rounded-[14px] bg-[#DC2626] text-[15px] font-semibold text-white hover:bg-[#EF4444]"
  >
    Start
  </a>
</header>

        {/* ── HERO ── */}
<section className="absolute left-0 top-0 h-[980px] w-[1440px] bg-[#050505]">
  <div className="absolute left-[79px] top-[150px] flex h-[43px] w-[289px] items-center rounded-full border border-[#3A1B22] bg-[#1A0D11] shadow-[0_0_40px_rgba(239,68,68,0.12)]">
    <div className="absolute left-[-12px] top-[-18px] flex h-[81px] w-[81px] items-center justify-center rounded-full bg-[#1A0D11]/70">
      <Target size={22} className="text-[#FF4A55]" />
    </div>
    <span className="absolute left-[82px] top-[2px] text-[16px] font-semibold leading-[38px] text-[#FF4A55]">
      Made for creators
    </span>
  </div>

  <h1 className="absolute left-[79px] top-[238px] w-[610px] text-[84px] font-bold leading-[0.98] tracking-[-0.04em] text-white">
    Analyze your scripts before{" "}
    <span className="text-[#EF4444]">you upload.</span>
  </h1>

  <p className="absolute left-[91px] top-[573px] w-[610px] text-[21px] font-light leading-[38px] text-[#B3B3B3]">
    Reelyze helps creators improve hooks, retention, and weak parts before publishing.
  </p>

  <a
    href="#analyzer"
    onClick={(event) => {
      event.preventDefault();
      document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" });
    }}
    className="absolute left-[91px] top-[716px] flex h-[60px] w-[289px] items-center justify-center rounded-[14px] bg-[#DC2626] text-[30px] font-semibold text-white shadow-[0_18px_60px_rgba(220,38,38,0.22)] hover:bg-[#EF4444]"
  >
    Start Analyzing
    <span className="ml-[18px] text-[30px] leading-none">→</span>
  </a>

  <a
    href="#features"
    className="absolute left-[427px] top-[720px] flex h-[52px] w-[210px] items-center justify-center rounded-[14px] border border-[#1F1F1F] bg-[#111114] text-[16px] font-medium text-white hover:bg-[#16161A]"
  >
    See How It Works
  </a>

  {/* Script Review preview */}
  <div className="absolute left-[757px] top-[114px] h-[823px] w-[650px] rounded-[24px] border border-[#1F1F1F] bg-[#0B0B0F] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
    <div className="absolute left-[44px] top-[12px]">
      <p className="text-[24px] font-semibold leading-[38px] text-white">Script Review</p>
      <p className="mt-[-4px] text-[16px] font-extralight leading-[38px] text-[#71717A]">Analyzed just now</p>
    </div>

    <button className="absolute left-[461px] top-[28px] h-[44px] w-[140px] rounded-[14px] border border-[#252830] bg-[#0E1015] text-[15px] font-semibold leading-[38px] text-[#F4F4F6]">
      Re-analyze
    </button>

    <div className="absolute left-[36px] top-[109px] grid grid-cols-3 gap-[24px]">
      <div className="h-[116px] w-[176px] rounded-[20px] border border-[#1F1F1F] bg-[#101014] px-[16px] pt-[14px]">
        <p className="text-[15px] font-semibold leading-[24px] text-white">Hook Score</p>
        <p className="mt-[12px] text-[32px] font-semibold leading-[38px] text-white">82</p>
        <p className="mt-[-8px] text-[10px] font-normal leading-[18px] text-[#71717A]">/100</p>
      </div>

      <div className="h-[116px] w-[176px] rounded-[20px] border border-[#1F1F1F] bg-[#101014] px-[16px] pt-[14px]">
        <p className="text-[15px] font-semibold leading-[24px] text-white">Retention Risk</p>
        <p className="mt-[12px] text-[20px] font-semibold leading-[38px] text-[#FF9A1F]">Medium</p>
        <div className="mt-[2px] flex gap-[6px]">
          <span className="h-[6px] w-[24px] rounded-[4px] bg-[#FF8F1F]" />
          <span className="h-[6px] w-[24px] rounded-[4px] bg-[#FF8F1F]" />
          <span className="h-[6px] w-[24px] rounded-[4px] bg-[#2A2B30]" />
          <span className="h-[6px] w-[24px] rounded-[4px] bg-[#2A2B30]" />
        </div>
      </div>

      <div className="h-[116px] w-[176px] rounded-[20px] border border-[#1F1F1F] bg-[#101014] px-[16px] pt-[14px]">
        <p className="text-[15px] font-semibold leading-[24px] text-white">Overall Score</p>
        <p className="mt-[12px] text-[32px] font-semibold leading-[38px] text-white">78</p>
        <p className="mt-[-8px] text-[10px] font-normal leading-[18px] text-[#71717A]">/100</p>
      </div>
    </div>

    <div className="absolute left-[37px] top-[279px] h-[365px] w-[576px] rounded-[20px] border border-[#1F1F1F] bg-[#101014]">
      <p className="absolute left-[32px] top-[17px] text-[20px] font-medium leading-[20px] text-white">
        Your Script
      </p>

      <div className="absolute left-[32px] top-[70px] grid grid-cols-[70px_1fr] gap-y-[18px] text-[16px] font-light leading-[30px]">
        <span className="text-[#71717A]">00:00</span>
        <span className="text-[#B3B3B3]">What if I told you most viewers decide to skip</span>

        <span className="text-[#71717A]">00:05</span>
        <span className="text-[#B3B3B3]">your Short before the real point even starts?</span>

        <span className="text-[#EF4444]">00:12</span>
        <span className="text-[#EF4444]">You lose them before your message even gets delivered.</span>
      </div>

      <div className="absolute left-0 top-[180px] h-[85px] w-[576px] border border-[#EF4444]/40 bg-[#E1192D]/20" />
      <div className="absolute left-[507px] top-[207px] flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[#FF3B4A] text-[13px] font-bold text-black shadow-[0_0_30px_rgba(255,59,74,0.4)]">
        !
      </div>
    </div>

    <div className="absolute left-[36px] top-[584px] h-[220px] w-[320px] rounded-[20px] border border-[#1F1F1F] bg-[#101014] px-[20px] pt-[18px]">
      <p className="text-[15px] font-semibold leading-[24px] text-white">Retention Over Time</p>

      <div className="absolute left-[20px] top-[70px] flex flex-col gap-[16px] text-[13px] text-[#71717A]">
        <span>100%</span>
        <span>66%</span>
        <span>33%</span>
        <span>0%</span>
      </div>

      <div className="absolute left-[78px] top-[78px] h-[3px] w-[190px] rounded-full bg-[#22CC5E]" />
      <div className="absolute left-[78px] top-[110px] h-[3px] w-[165px] rounded-full bg-[#22CC5E]" />
      <div className="absolute left-[78px] top-[142px] h-[3px] w-[120px] rounded-full bg-[#FF8F1F]" />
      <div className="absolute left-[78px] top-[174px] h-[3px] w-[75px] rounded-full bg-[#EF4444]" />

      <div className="absolute left-[190px] top-[58px] h-[60px] w-[108px] rounded-[14px] border border-[#252830] bg-[#111318] px-[10px] pt-[6px] shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
        <p className="text-[12px] font-semibold leading-[20px] text-[#FF4A55]">High drop risk</p>
        <p className="text-[11px] font-light leading-[18px] text-[#71717A]">00:12</p>
      </div>
    </div>

    <div className="absolute left-[380px] top-[584px] h-[220px] w-[250px] rounded-[20px] border border-[#1F1F1F] bg-[#101014] px-[22px] pt-[18px]">
      <div className="mb-[12px] flex items-center gap-[10px]">
        <Lightbulb size={20} className="text-[#FF4A55]" />
        <p className="text-[17px] font-semibold leading-[38px] text-white">Suggested Change</p>
      </div>

      <p className="text-[16px] font-light leading-[30px] text-[#B3B3B3]">
        Cut the intro and start with the main value faster.
      </p>

      <button className="absolute left-[14px] top-[155px] h-[46px] w-[200px] rounded-[14px] border border-[#252830] bg-[#0F1116] text-[15px] font-semibold text-[#F5F5F7]">
        View Suggestion →
      </button>
    </div>
  </div>
</section>

        {/* ── FEATURES SECTION ── */}
        <div className="absolute left-[270px] top-[1450px] h-[420px] w-[1140px]">
          <h2 className="text-center w-full text-[34px] font-semibold leading-[40px] text-white">
            Built to find what viewers skip.
          </h2>

          <p className="mt-[16px] text-center w-full text-[16px] font-normal leading-[26px] text-[#B3B3B3]">
            Reelyze reviews your script, highlights weak moments, and shows what could make viewers lose interest before your video goes live.
          </p>

          <div className="mt-[48px] flex justify-between gap-[24px]">
            <div className="h-[220px] w-[364px] rounded-[20px] border border-[#24242A] bg-[#0B0C10] px-[24px] py-[24px]">
              <Target size={32} className="text-[#EF4444]" />
              <p className="mt-[16px] text-[18px] font-semibold leading-[24px] text-white">Hook Analysis</p>
              <p className="mt-[8px] text-[14px] font-normal leading-[22px] text-[#B3B3B3]">
                See if your opening creates enough curiosity to keep viewers watching.
              </p>
            </div>

            <div className="h-[220px] w-[364px] rounded-[20px] border border-[#24242A] bg-[#0B0C10] px-[24px] py-[24px]">
              <BarChart3 size={32} className="text-[#EF4444]" />
              <p className="mt-[16px] text-[18px] font-semibold leading-[24px] text-white">Retention Feedback</p>
              <p className="mt-[8px] text-[14px] font-normal leading-[22px] text-[#B3B3B3]">
                Find weak sections, slow moments, and parts that may lose momentum.
              </p>
            </div>

            <div className="h-[220px] w-[364px] rounded-[20px] border border-[#24242A] bg-[#0B0C10] px-[24px] py-[24px]">
              <Lightbulb size={32} className="text-[#EF4444]" />
              <p className="mt-[16px] text-[18px] font-semibold leading-[24px] text-white">Actionable Fixes</p>
              <p className="mt-[8px] text-[14px] font-normal leading-[22px] text-[#B3B3B3]">
                Get specific changes to improve your hook, pacing, and payoff.
              </p>
            </div>
          </div>
        </div>
     </div>

        {/* ── ANALYZER FORM ── */}
        <div
          id="analyzer"
          className="absolute left-[150px] top-[1960px] w-[1140px] pb-[80px]"
        >
          <div className="flex gap-[30px]">

            {/* Script input card */}
            <div className="relative h-[700px] w-[720px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
              <h2 className="absolute left-[25px] top-[30px] text-[22px] font-semibold leading-[24px] text-white">
                Your Script
              </h2>
              <p className="absolute left-[25px] top-[63px] text-[16px] font-normal leading-[24px] text-[#B3B3B3]">
                Paste your YouTube Shorts script below
              </p>
              <div className="absolute left-[30px] top-[100px] h-[52px] w-[660px] rounded-[12px] border border-[#24242A] bg-[#0B1018] flex items-center px-[16px]">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add your video title or topic"
                  className="h-full w-full bg-transparent text-[14px] font-normal leading-[24px] text-[#B3B3B3] outline-none placeholder:text-[#777A85]"
                />
              </div>
              <div className="absolute left-[30px] top-[162px] h-[468px] w-[660px] rounded-[16px] border border-[#24242A] bg-[#0B1018]">
                <textarea
                  value={script}
                  onChange={handleScriptChange}
                  placeholder="Paste your script here..."
                  className="h-full w-full resize-none rounded-[16px] bg-transparent px-[20px] py-[20px] text-[14px] font-normal leading-[24px] text-[#B3B3B3] outline-none placeholder:text-[#777A85]"
                />
                {script.length === 0 && (
                  <p className="pointer-events-none absolute left-[20px] top-[55px] text-[14px] font-normal leading-[24px] text-[#777A85]">
                    You can copy it from Google Docs, Notion, or any other tool.
                  </p>
                )}
              </div>
              <p className={`absolute left-[30px] top-[646px] text-[14px] font-normal leading-[24px] ${script.length > maxCharacters ? "text-[#EF4444]" : "text-[#B3B3B3]"}`}>
                {script.length} / 1000 characters
              </p>
            </div>

            {/* What You'll Get card */}
            <div className="relative h-[530px] w-[390px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
              <h2 className="absolute left-[30px] top-[24px] text-[22px] font-semibold leading-[24px] text-white">
                What You&apos;ll Get
              </h2>
              <p className="absolute left-[30px] top-[56px] text-[14px] font-normal leading-[24px] text-[#B3B3B3]">
                AI analysis includes:
              </p>
              <FeatureItem top={100} icon={<Gauge size={38} />} title="Overall Score" description="See how strong your script is before posting." />
              <FeatureItem top={175} icon={<Target size={38} />} title="Hook Analysis" description="Find out if your opening stops the scroll." />
              <FeatureItem top={255} icon={<TriangleAlert size={38} />} title="Retention Risk" description="Spot moments where viewers may lose interest." />
              <FeatureItem top={335} icon={<Lightbulb size={38} />} title="Risky Parts" description="Get specific lines and timestamps to improve." />
              <FeatureItem top={415} icon={<BarChart3 size={38} />} title="Suggested Fixes" description="Receive clear fixes for hooks, pacing, and payoff." />
            </div>

          </div>

          {/* Analyze button + privacy */}
          <div className="mt-[28px] flex items-center gap-[24px]">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || script.trim().length === 0 || script.length > maxCharacters}
              className="h-[56px] w-[230px] rounded-[14px] bg-[#EF4444] text-[17px] font-semibold leading-[24px] text-white transition hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-80"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Script"}
            </button>
            <div className="flex items-center gap-[8px] text-[14px] font-normal leading-[24px] text-[#B3B3B3]">
              <Lock size={14} />
              <span>Your data is secure and will not be shared</span>
            </div>
          </div>

          {analyzeError && (
            <p className="mt-[10px] text-[13px] font-normal leading-[20px] text-[#EF4444]">
              {analyzeError}
            </p>
          )}

        </div>

      </div>

      {/* MOBILE */}
      <div className="block lg:hidden bg-[#050505]">
        <div className="mx-auto w-full max-w-[390px] flex flex-col pb-[100px]">

          {/* Шапка */}
          <div className="flex items-center justify-between px-[20px] pt-[28px] pb-[20px]">
            <div className="flex items-center gap-[10px]">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-[#EF4444]">
                <span className="text-[14px] font-bold text-white">R</span>
              </div>
              <p className="text-[15px] font-semibold leading-[24px] text-white">Reelyze</p>
            </div>
            <div className="flex h-[32px] w-[96px] items-center justify-center rounded-full border border-[#24242A] bg-[#0B0C10]">
              <span className="text-[13px] font-medium text-[#EF4444]">Shorts AI</span>
            </div>
          </div>

          {/* Hero */}
          <div className="px-[20px] mb-[24px]">
            <div className="mb-[16px] inline-flex h-[28px] items-center rounded-full border border-[#24242A] bg-[#0B0C10] px-[14px]">
              <span className="text-[11px] font-semibold leading-[24px] text-[#EF4444]">
                For YouTube Shorts scripts
              </span>
            </div>

            <h1 className="text-[30px] font-semibold leading-[36px] text-white">
              Analyze your Shorts script <span className="text-[#EF4444]">before you upload.</span>
            </h1>

            <p className="mt-[10px] text-[13px] font-normal leading-[20px] text-[#B3B3B3]">
              Get a hook score, retention risk, risky timestamps, and concrete fixes before your video goes live.
            </p>

            <a
              href="#analyzer-mobile"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById("analyzer-mobile")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-[16px] flex h-[48px] w-full items-center justify-center rounded-[14px] bg-[#EF4444] text-[15px] font-semibold text-white"
            >
              Start Analyzing
            </a>

            <p className="mt-[10px] text-[11px] font-normal leading-[18px] text-[#777A85]">
              Currently optimized for YouTube Shorts scripts. More formats coming soon.
            </p>
          </div>

          {/* Заголовок секції аналізатора */}
          <div className="px-[20px] mb-[20px]">
            <h2 className="text-[24px] font-semibold leading-[30px] text-white mb-[8px]" id="analyzer-mobile">Paste your script</h2>
            <p className="text-[13px] font-normal leading-[20px] text-[#B3B3B3]">
              Paste your Shorts script and get hook, retention, and payoff feedback in seconds.
            </p>
          </div>

          {/* Карточка Video title */}
          <div className="mx-[20px] mb-[12px] rounded-[16px] border border-[#24242A] bg-[#0B0C10] px-[18px] pt-[14px] pb-[16px]">
            <div className="flex items-baseline gap-[8px] mb-[4px]">
              <p className="text-[16px] font-semibold text-white">Video title</p>
              <p className="text-[14px] font-semibold text-[#B3B3B3]">Optional</p>
            </div>
            <p className="text-[12px] font-normal text-[#B3B3B3] mb-[10px]">Helps Reelyze understand the context.</p>
            <div className="flex h-[38px] w-full items-center rounded-[10px] border border-[#24242A] bg-[#050505] px-[14px]">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add your video title or topic"
                className="h-full w-full bg-transparent text-[12px] font-normal text-[#B3B3B3] outline-none focus:outline-none focus:ring-0 placeholder:text-[#777A85]"
              />
            </div>
          </div>

          {/* Карточка Your Script */}
          <div className="mx-[20px] mb-[12px] rounded-[16px] border border-[#24242A] bg-[#0B0C10] px-[18px] pt-[14px] pb-[14px]">
            <div className="flex items-baseline justify-between mb-[4px]">
              <p className="text-[16px] font-semibold text-white">Your Script</p>
              <p className={`text-[13px] font-normal ${script.length > maxCharacters ? "text-[#EF4444]" : "text-[#B3B3B3]"}`}>{script.length} / 1000 characters</p>
            </div>
            <p className="text-[12px] font-normal text-[#B3B3B3] mb-[10px]">Best for 15–60 second videos.</p>
            <div className="w-full rounded-[12px] border border-[#24242A] bg-[#050505] mb-[10px]">
              <textarea
                value={script}
              onChange={handleScriptChange}
              placeholder="Paste your script here..."
              rows={7}
              className="w-full resize-none rounded-[12px] bg-transparent px-[14px] py-[12px] text-[12px] font-normal leading-[21px] text-[#B3B3B3] outline-none focus:outline-none focus:ring-0 placeholder:text-[#777A85]"
              />
            </div>
            {script.length === 0 && (
              <p className="text-[10px] font-normal leading-[18px] text-[#777A85] mb-[8px]">
                You can copy it from Google Docs, Notion, or any other tool.
              </p>
            )}
            <div className="flex items-center justify-between mt-[4px]">
              <div className="flex items-center gap-[6px]">
                <Clock size={13} className="text-[#B3B3B3]" />
                <p className="text-[13px] font-normal text-[#B3B3B3]">~{formatMobileDuration(script)} estimated</p>
              </div>
              <p className="text-[12px] font-normal text-[#B3B3B3]">Shorts only</p>
            </div>
          </div>

          {/* Кнопка Analyze */}
          <div className="px-[20px] mb-[10px]">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || script.trim().length === 0 || script.length > maxCharacters}
              className="w-full h-[56px] rounded-[14px] text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-80 focus:outline-none focus:ring-0"
              style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Script"}
            </button>
          </div>

          {/* Error + Privacy (в одному блоці щоб не перекривалось) */}
          <div className="px-[20px] mb-[20px] flex flex-col gap-[8px]">
            {analyzeError && (
              <p className="text-[12px] text-[#EF4444]">{analyzeError}</p>
            )}
            <div className="flex items-center gap-[8px]">
              <Lock size={12} className="text-[#B3B3B3] shrink-0" />
              <p className="text-[12px] font-normal text-[#B3B3B3]">Your script is only used to generate this analysis.</p>
            </div>
          </div>

          {/* Карточка What Reelyze checks */}
          <div className="mx-[20px] rounded-[16px] border border-[#24242A] bg-[#0B0C10] px-[18px] pt-[16px] pb-[16px]">
            <p className="text-[16px] font-semibold text-white mb-[12px]">What Reelyze checks</p>
            <div className="flex flex-col gap-[8px]">
              {[
                { icon: <Target size={18} />, title: "Hook strength", desc: "Scores your opening line." },
                { icon: <BarChart3 size={18} />, title: "Retention risk", desc: "Finds where viewers may drop." },
                { icon: <Lightbulb size={18} />, title: "Payoff quality", desc: "Checks if the ending feels worth it." },
                { icon: <Gauge size={18} />, title: "Suggested fixes", desc: "Gives specific improvements." },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex h-[56px] w-full items-center gap-[12px] rounded-[12px] border border-[#24242A] bg-[#0B0C10] px-[12px]"
                >
                  <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center text-[#EF4444]">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-white">{item.title}</p>
                    <p className="text-[12px] font-normal text-[#B3B3B3]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Features section */}
          <div className="mt-[28px] px-[20px]">
            <h2 className="text-[24px] font-semibold leading-[30px] text-white text-center mb-[10px]">
              Built to find what viewers skip.
            </h2>
            <p className="text-[13px] font-normal leading-[20px] text-[#B3B3B3] text-center mb-[20px]">
              Reelyze reviews your script, highlights weak moments, and shows what could make viewers lose interest before your video goes live.
            </p>

            <div className="flex flex-col gap-[12px]">
              <div className="rounded-[16px] border border-[#24242A] bg-[#0B0C10] px-[18px] py-[18px]">
                <Target size={26} className="text-[#EF4444]" />
                <p className="mt-[10px] text-[15px] font-semibold text-white">Hook Analysis</p>
                <p className="mt-[6px] text-[12px] font-normal leading-[20px] text-[#B3B3B3]">
                  See if your opening creates enough curiosity to keep viewers watching.
                </p>
              </div>

              <div className="rounded-[16px] border border-[#24242A] bg-[#0B0C10] px-[18px] py-[18px]">
                <BarChart3 size={26} className="text-[#EF4444]" />
                <p className="mt-[10px] text-[15px] font-semibold text-white">Retention Feedback</p>
                <p className="mt-[6px] text-[12px] font-normal leading-[20px] text-[#B3B3B3]">
                  Find weak sections, slow moments, and parts that may lose momentum.
                </p>
              </div>

              <div className="rounded-[16px] border border-[#24242A] bg-[#0B0C10] px-[18px] py-[18px]">
                <Lightbulb size={26} className="text-[#EF4444]" />
                <p className="mt-[10px] text-[15px] font-semibold text-white">Actionable Fixes</p>
                <p className="mt-[6px] text-[12px] font-normal leading-[20px] text-[#B3B3B3]">
                  Get specific changes to improve your hook, pacing, and payoff.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom nav — fixed */}
        <div className="fixed bottom-0 left-0 right-0 z-50 h-[80px] border-t border-[#24242A] bg-[#0B090D] lg:hidden">
          <div className="mx-auto flex h-full w-full max-w-[390px] items-center justify-between px-[20px]">
            <Link
              href="/"
              className="flex h-[38px] w-[150px] items-center justify-center gap-[6px] rounded-[14px] border border-[#2A1014] bg-[#12080A] focus:outline-none focus:ring-0"
            >
              <PencilLine size={14} className="text-[#EF4444]" />
              <span className="text-[13px] font-semibold text-[#EF4444]">New analysis</span>
            </Link>
            <Link
              href="/results"
              className="flex h-[38px] w-[115px] items-center justify-center gap-[6px] rounded-[14px] border border-[#24242A] bg-[#0B0C10] focus:outline-none focus:ring-0"
            >
              <SquarePen size={13} className="text-white" />
              <span className="text-[13px] font-semibold text-white">Results</span>
            </Link>
          </div>
        </div>

      </div>

    </main>
  );
}

function FeatureItem({
  top,
  icon,
  title,
  description,
}: {
  top: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="absolute left-[30px] flex w-[340px]" style={{ top }}>
      <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center text-[#EF4444]">
        {icon}
      </div>

      <div className="ml-[15px]">
        <p className="h-[24px] text-[15px] font-medium leading-[24px] text-white">
          {title}
        </p>

        <p className="mt-[1px] w-[285px] text-[13px] font-normal leading-[24px] text-[#B3B3B3]">
          {description}
        </p>
      </div>
    </div>
  );
}