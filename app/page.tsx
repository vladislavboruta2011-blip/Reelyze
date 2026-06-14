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

  const maxCharacters = 1000;

  function handleAnalyze() {
    setAnalyzeError("");
    const cleanedScript = script.trim();

    if (cleanedScript.length === 0) {
      setAnalyzeError("Please paste your script before analyzing.");
      return;
    }

    if (cleanedScript.length > maxCharacters) {
      setAnalyzeError("Your script is over 1000 characters. Please shorten it.");
      return;
    }

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
      <div className="relative h-[1200px] min-w-[1440px] bg-[#050505]">
        <aside className="absolute left-0 top-0 h-[1200px] w-[230px] border border-[#24242A] bg-[#07080D]">
          <img
            src="/logo.png"
            alt="Reelyze logo"
            className="absolute left-[20px] top-[28px] h-[36px] w-[36px] object-contain"
          />

          <p className="absolute left-[70px] top-[40px] h-[24px] w-[84px] text-[22px] font-semibold leading-[24px] text-white">
            Reelyze
          </p>

          <Link
            href="/results"
            className="absolute left-[22px] top-[120px] flex h-[56px] w-[186px] items-center gap-3 rounded-[14px] border border-[#24242A] bg-[#0B0C10] px-[20px]"
          >
            <SquarePen size={18} className="text-white" />
            <span className="text-[16px] font-semibold leading-[24px] text-white">
              Results
            </span>
          </Link>

          <Link
            href="/"
            className="absolute left-[22px] top-[190px] flex h-[56px] w-[186px] items-center gap-3 rounded-[14px] border border-[#24242A] bg-[#1A0608] px-[20px]"
          >
            <PencilLine size={18} className="text-[#EF4444]" />
            <span className="text-[16px] font-semibold leading-[24px] text-[#EF4444]">
              New Analysis
            </span>
          </Link>

          <div className="absolute left-[22px] top-[670px] h-[195px] w-[186px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
            <p className="absolute left-[18px] top-[30px] h-[24px] w-[141px] text-[20px] font-semibold leading-[24px] text-white">
              About Reelyze
            </p>

            <p className="absolute left-[18px] top-[70px] h-[96px] w-[154px] text-[14px] font-normal leading-[24px] text-[#B3B3B3]">
              We help creators make stronger videos by analyzing what keeps
              viewers watching.
            </p>
          </div>
        </aside>

        <h1 className="absolute left-[270px] top-[38px] h-[40px] w-[360px] whitespace-nowrap text-[34px] font-semibold leading-[40px] text-white">
          New analysis
        </h1>

        <p className="absolute left-[270px] top-[78px] h-[48px] w-[612px] text-[16px] font-normal leading-[24px] text-[#B3B3B3]">
          Paste your YouTube Shorts script below &#40;up to 1,000 characters&#41;
          and get retention-focused insights.
        </p>

        <section className="absolute left-[270px] top-[135px] h-[690px] w-[720px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
         <h2 className="absolute left-[25px] top-[30px] h-[24px] w-[118px] text-[22px] font-semibold leading-[24px] text-white">
            Your Script
          </h2>

          <p className="absolute left-[25px] top-[63px] h-[24px] w-[312px] text-[16px] font-normal leading-[24px] text-[#B3B3B3]">
            Paste your YouTube Shorts script below
          </p>

          <div className="absolute left-[30px] top-[95px] h-[52px] w-[660px] rounded-[12px] border border-[#24242A] bg-[#0B1018]/[0.0784] flex items-center px-[16px]">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add your video title or topic"
              className="h-full w-full bg-transparent text-[14px] font-normal leading-[24px] text-[#B3B3B3] outline-none placeholder:text-[#777A85]"
            />
          </div>

          <div className="absolute left-[30px] top-[157px] h-[468px] w-[660px] rounded-[16px] border border-[#24242A] bg-[#0B1018]/[0.0784]">
            <textarea
              value={script}
              maxLength={maxCharacters}
              onChange={(event) => setScript(event.target.value)}
              placeholder="Paste your script here..."
              className="h-full w-full resize-none rounded-[16px] bg-transparent px-[20px] py-[20px] text-[14px] font-normal leading-[24px] text-[#B3B3B3] outline-none placeholder:text-[#777A85]"
            />

            {script.length === 0 && (
              <p className="pointer-events-none absolute left-[20px] top-[55px] h-[24px] w-[417px] text-[14px] font-normal leading-[24px] text-[#777A85]">
                You can copy it from Google Docs, Notion, or any other tool.
              </p>
            )}
          </div>

          <p className="absolute left-[30px] top-[641px] h-[24px] w-[260px] whitespace-nowrap text-[20px] font-normal leading-[24px] text-[#B3B3B3]">
            {script.length} / 1000 characters
          </p>
        </section>

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="absolute left-[295px] top-[840px] h-[56px] w-[230px] rounded-[14px] border border-[#24242A] bg-[#EF4444] text-[17px] font-semibold leading-[24px] text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-80"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Script"}
        </button>

        {analyzeError && (
          <p className="absolute left-[295px] top-[906px] text-[13px] font-normal leading-[20px] text-[#EF4444]">
            {analyzeError}
          </p>
        )}

        <div className="absolute left-[570px] top-[855px] flex h-[24px] w-[312px] items-center gap-2 text-[14px] font-normal leading-[24px] text-[#B3B3B3]">
          <Lock size={14} />
          <span>Your data is secure and will not be shared</span>
        </div>

        <section className="absolute left-[1010px] top-[265px] h-[530px] w-[400px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
          <h2 className="absolute left-[55px] top-[15px] h-[24px] w-[230px] whitespace-nowrap text-[22px] font-semibold leading-[24px] text-white">
            What You'll Get
          </h2>

          <p className="absolute left-[55px] top-[40px] h-[24px] w-[162px] text-[14px] font-normal leading-[24px] text-[#B3B3B3]">
            AI analysis includes:
          </p>

          <FeatureItem
            top={110}
            icon={<Gauge size={42} />}
            title="Overall Score"
            description="Get a clear score for your script's retention potential."
          />

          <FeatureItem
            top={185}
            icon={<Target size={42} />}
            title="Hook Analysis"
            description="See how strong your hook is and how to improve it."
          />

          <FeatureItem
            top={270}
            icon={<TriangleAlert size={42} />}
            title="Retention Risk"
            description="Identify parts that may cause viewers to drop off."
          />

          <FeatureItem
            top={355}
            icon={<Lightbulb size={42} />}
            title="Risky Parts"
            description="Find specific timestamps with potential issues."
          />

          <FeatureItem
            top={438}
            icon={<BarChart3 size={42} />}
            title="Suggested Fixes"
            description="Get AI-powered suggestions to improve retention."
          />
        </section>
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

          {/* Заголовок */}
          <div className="px-[20px] mb-[20px]">
            <h1 className="text-[30px] font-semibold leading-[36px] text-white mb-[8px]">New analysis</h1>
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
              <p className="text-[13px] font-normal text-[#B3B3B3]">{script.length} / 1000 characters</p>
            </div>
            <p className="text-[12px] font-normal text-[#B3B3B3] mb-[10px]">Best for 15–60 second videos.</p>
            <div className="w-full rounded-[12px] border border-[#24242A] bg-[#050505] mb-[10px]">
              <textarea
                value={script}
                maxLength={maxCharacters}
                onChange={(e) => setScript(e.target.value)}
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
              disabled={isAnalyzing}
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