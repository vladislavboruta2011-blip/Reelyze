"use client";

import { Inter } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  SquarePen,
  PencilLine,
  ThumbsUp,
  ThumbsDown,
  AudioLines,
  Scissors,
  FastForward,
} from "lucide-react";

const inter = Inter({
  subsets: ["latin"],
});

type ScoreData = {
  score: number;
  label: string;
  color: string;
  ringColor: string;
  description: string;
};

type RiskyPart = {
  time: string;
  title: string;
  description: string;
};

type SceneSegment = {
  label: string;
  color: string;
  width: number;
};

type LineStatus = "normal" | "warning" | "risky";

type AnalysisResult = {
  overall: ScoreData;
  hook: ScoreData;
  risk: ScoreData;
  riskyParts: RiskyPart[];
  fixes: string[];
  riskyLineIndexes: number[];
  warningLineIndexes: number[];
  sceneSegments: SceneSegment[];
};

const fallbackScript =
  "What if one small change could make viewers watch until the end? But the real problem is not editing speed. It is that the first line gives viewers no reason to stay.";

function pluralize(count: number, singular: string, plural: string) {
  return count === 1
    ? `${count} ${singular}`
    : `${count} ${plural}`;
}

export default function ResultsPage() {
  const [savedScript, setSavedScript] = useState("");
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isHookModalOpen, setIsHookModalOpen] = useState(false);
  const [copiedHook, setCopiedHook] = useState(false);
  const [aiHook, setAiHook] = useState("");
  const [aiHookReason, setAiHookReason] = useState("");
  const [aiHookStatus, setAiHookStatus] = useState("");
  const [isImprovingHook, setIsImprovingHook] = useState(false);
  useEffect(() => {
    const storedScript = sessionStorage.getItem("reelyze-script");

    if (storedScript) {
      setSavedScript(storedScript);
    }

    localStorage.removeItem("reelyze-script");
    setIsStorageLoaded(true);
  }, []);

  const hasAnalyzedScript = savedScript.trim().length > 0;
  const activeScript = hasAnalyzedScript ? savedScript.trim() : fallbackScript;

  const scriptLines = useMemo(() => {
    return createScriptLines(activeScript);
  }, [activeScript]);

  const estimatedDuration = useMemo(() => {
    return estimateDuration(activeScript);
  }, [activeScript]);

  const lineTimestamps = useMemo(() => {
    return createLineTimestamps(scriptLines, estimatedDuration);
  }, [scriptLines, estimatedDuration]);

  const scaleLabels = useMemo(() => {
    return createScaleLabels(estimatedDuration);
  }, [estimatedDuration]);

  const characterCount = activeScript.length;

  const analysis = useMemo(() => {
    return analyzeScript(activeScript, estimatedDuration, scriptLines);
  }, [activeScript, estimatedDuration, scriptLines]);
  
  const fallbackImprovedHook = useMemo(() => {
  return createHookRewrite(activeScript);
}, [activeScript]);

const improvedHook = aiHook || fallbackImprovedHook;
const hookWasActuallyChanged =
  improvedHook.trim().toLowerCase() !== scriptLines[0]?.trim().toLowerCase();

const shouldShowHookAnalysis =
  analysis.hook.score >= 80 || !hookWasActuallyChanged;
  
  const improvedHookReason =
  aiHookReason || getHookRewriteReason(activeScript);

  function handleCopyHook() {
    navigator.clipboard.writeText(improvedHook);
    setCopiedHook(true);

    setTimeout(() => {
      setCopiedHook(false);
    }, 1500);
  }

  return (
    <main
      className={`${inter.className} min-h-screen overflow-auto bg-[#050505] text-white antialiased`}
    >
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
            className="absolute left-[22px] top-[120px] flex h-[56px] w-[186px] items-center gap-3 rounded-[14px] border border-[#24242A] bg-[#1A0608] px-[20px]"
          >
            <SquarePen size={18} className="text-[#EF4444]" />
            <span className="text-[16px] font-semibold leading-[24px] text-[#EF4444]">
              Results
            </span>
          </Link>

          <Link
            href="/"
            className="absolute left-[22px] top-[190px] flex h-[56px] w-[186px] items-center gap-3 rounded-[14px] border border-[#24242A] bg-[#0B0C10] px-[20px]"
          >
            <PencilLine size={18} className="text-white" />
            <span className="text-[16px] font-semibold leading-[24px] text-white">
              New Analysis
            </span>
          </Link>

          <div className="absolute left-[22px] top-[730px] h-[195px] w-[186px] overflow-hidden rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
            <p className="absolute left-[12px] top-[20px] h-[24px] w-[155px] text-[18px] font-bold leading-[24px] text-white">
              Rate this analysis
            </p>

            <p className="absolute left-[13px] top-[50px] h-[24px] w-[153px] text-[13px] font-normal leading-[24px] text-[#B3B3B3]">
              Was this review helpful?
            </p>

            <button
              onClick={() => {
                setFeedbackMessage("Thanks! Glad this was helpful.");
              }}
              className="absolute left-[12px] top-[88px] flex h-[42px] w-[162px] items-center justify-center gap-2 rounded-[10px] border border-[#EF4444] bg-transparent text-[13px] font-medium leading-[24px] text-white transition hover:bg-[#1A0608]"
            >
              <ThumbsUp size={15} />
              Helpful
            </button>

            <button
              onClick={() => {
                setIsFeedbackOpen(true);
              }}
              className="absolute left-[12px] top-[132px] flex h-[42px] w-[162px] items-center justify-center gap-2 rounded-[10px] border border-[#24242A] bg-[#111217] text-[13px] font-medium leading-[24px] text-white transition hover:bg-[#1A0608]"
            >
              <ThumbsDown size={15} />
              Not helpful
            </button>

            {feedbackMessage && (
              <p className="absolute left-[10px] top-[176px] w-[166px] truncate text-center text-[11px] font-normal leading-[14px] text-[#B3B3B3]">
                {feedbackMessage}
              </p>
            )}
          </div>
        </aside>

        <h1 className="absolute left-[267px] top-[34px] h-[24px] w-[226px] text-[32px] font-semibold leading-[24px] text-white">
          Script Review
        </h1>

        <p className="absolute left-[270px] top-[78px] h-[24px] w-[462px] text-[16px] font-normal leading-[24px] text-[#B3B3B3]">
          Analyzed just now - YouTube Shorts Script
        </p>

        {!isStorageLoaded && (
          <div className="absolute left-[270px] top-[135px] h-[220px] w-[720px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
            <h2 className="absolute left-[30px] top-[35px] text-[26px] font-semibold leading-[32px] text-white">
              Loading results...
            </h2>

            <p className="absolute left-[30px] top-[85px] w-[560px] text-[16px] font-normal leading-[24px] text-[#B3B3B3]">
              Please wait while Reelyze checks your latest analysis.
            </p>
          </div>
        )}

        {isStorageLoaded && !hasAnalyzedScript && (
          <div className="absolute left-[270px] top-[135px] h-[220px] w-[720px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
            <h2 className="absolute left-[30px] top-[35px] text-[26px] font-semibold leading-[32px] text-white">
              No script analyzed yet.
            </h2>

            <p className="absolute left-[30px] top-[85px] w-[560px] text-[16px] font-normal leading-[24px] text-[#B3B3B3]">
              Go to New Analysis and paste your YouTube Shorts script first.
              After you click Analyze Script, your results will appear here.
            </p>

            <Link
              href="/"
              className="absolute left-[30px] top-[145px] flex h-[48px] w-[190px] items-center justify-center rounded-[12px] border border-[#24242A] bg-[#EF4444] text-[15px] font-semibold leading-[24px] text-white transition hover:bg-[#dc2626]"
            >
              New Analysis
            </Link>
          </div>
        )}

        {isStorageLoaded && hasAnalyzedScript && (
          <>
            <section className="absolute left-[270px] top-[115px] h-[170px] w-[1140px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
              <ScoreBlock
                left={0}
                title="Overall Score"
                score={analysis.overall.score}
                label={analysis.overall.label}
                labelColor={analysis.overall.color}
                ringColor={analysis.overall.ringColor}
                description={analysis.overall.description}
              />

              <ScoreBlock
                left={380}
                title="Hook Score"
                score={analysis.hook.score}
                label={analysis.hook.label}
                labelColor={analysis.hook.color}
                ringColor={analysis.hook.ringColor}
                description={analysis.hook.description}
              />

              <ScoreBlock
                left={760}
                title="Retention Risk"
                score={analysis.risk.score}
                label={analysis.risk.label}
                labelColor={analysis.risk.color}
                ringColor={analysis.risk.ringColor}
                description={analysis.risk.description}
              />
            </section>

            <section className="absolute left-[270px] top-[305px] h-[615px] w-[660px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
              <h2 className="absolute left-[25px] top-[35px] h-[24px] w-[118px] text-[22px] font-semibold leading-[24px] text-white">
                Your Script
              </h2>

              <div className="absolute left-[30px] top-[85px] h-[470px] w-[600px] overflow-hidden rounded-[16px] border border-[#24242A] bg-[#0B1018]/[0.0784]">
                <div className="h-full w-full overflow-y-auto px-[20px] py-[22px] pr-[14px]">
                  <div className="flex flex-col gap-[8px]">
                    {scriptLines.map((line, index) => {
                      const status: LineStatus = analysis.riskyLineIndexes.includes(
                        index
                      )
                        ? "risky"
                        : analysis.warningLineIndexes.includes(index)
                        ? "warning"
                        : "normal";

                      return (
                        <ScriptLine
                          key={`${lineTimestamps[index] ?? index}-${line}`}
                          time={
                            lineTimestamps[index] ??
                            formatTime(estimatedDuration)
                          }
                          status={status}
                          text={line}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <p className="absolute left-[44px] top-[581px] h-[24px] w-[280px] text-[14px] font-normal leading-[24px] text-[#B3B3B3]">
                {characterCount} / 1000 characters - ~
                {formatTime(estimatedDuration)}
              </p>
            </section>

            <section className="absolute left-[950px] top-[305px] h-[300px] w-[460px] overflow-hidden rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
              <h2 className="absolute left-[25px] top-[35px] h-[24px] text-[22px] font-semibold leading-[24px] text-white">
                Risky Parts
              </h2>

              <p className="absolute left-[360px] top-[35px] h-[24px] text-[14px] font-normal leading-[24px] text-[#B3B3B3]">
                {pluralize(analysis.riskyParts.length, "found", "found")}
              </p>

              <div className="absolute left-[25px] top-[78px] h-[205px] w-[410px] overflow-y-auto pr-[8px]">
                <div className="flex flex-col gap-[18px]">
                  {analysis.riskyParts.length === 0 ? (
  <div className="absolute left-[0px] top-[0px] w-[360px]">
    <p className="text-[15px] font-medium leading-[24px] text-white">
      No risky parts found.
    </p>
    <p className="mt-[4px] text-[14px] font-normal leading-[22px] text-[#B3B3B3]">
      This script stays focused and does not contain any major drop-off points.
    </p>
  </div>
) : (
  analysis.riskyParts.map((part) => (
    <RiskyItem
      key={`${part.time}-${part.title}`}
      time={part.time}
      title={part.title}
      description={part.description}
    />
  ))
)}
                </div>
              </div>
            </section>

            <section className="absolute left-[950px] top-[625px] h-[295px] w-[460px] overflow-hidden rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
              <h2 className="absolute left-[25px] top-[30px] h-[24px] text-[22px] font-semibold leading-[24px] text-white">
                Suggested Fixes
              </h2>
        
              <p className="absolute left-[300px] top-[30px] h-[24px] text-[14px] font-normal leading-[24px] text-[#B3B3B3]">
                {pluralize(analysis.fixes.length, "suggestion", "suggestions")}
              </p>

             {analysis.fixes.length > 0 && analysis.hook.score < 80 && (
              <button
                onClick={async () => {
  setCopiedHook(false);
  setIsImprovingHook(true);
  setIsHookModalOpen(true);

  const response = await fetch("/api/improve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      script: activeScript,
    }),
  });

  const data = await response.json().catch(() => ({
    improvedHook: "AI hook improvement is unavailable right now.",
    whyItsBetter: "Reelyze could not generate a custom explanation.",
  }));

  setAiHook(data.improvedHook || "AI hook improvement is unavailable right now.");

setAiHook(
  data.hook ||
    data.improvedHook ||
    "AI hook improvement is unavailable right now."
);

setAiHookReason(
  data.reason ||
    data.whyItsBetter ||
    (data.status === "good"
      ? "The hook is already clear, specific, and creates curiosity without needing a rewrite."
      : "The hook was adjusted to improve clarity, curiosity, or payoff connection.")
);

setAiHookStatus(data.status || "improved");

setIsImprovingHook(false);
}}
                className="absolute left-[25px] top-[55px] h-[28px] w-[125px] rounded-[9px] border border-[#EF4444]/40 bg-[#1A0608] text-[12px] font-semibold leading-[20px] text-[#EF4444] transition hover:bg-[#2A080C]"
              >
                Improve Hook
              </button>
             )}
              <div className="absolute left-[20px] top-[90px] h-[190px] w-[420px] overflow-y-auto pr-[18px]">
                <div className="flex flex-col gap-[18px]">
                  {analysis.fixes.length === 0 ? (
  <div className="absolute left-[0px] top-[0px] w-[360px]">
    <p className="text-[15px] font-medium leading-[24px] text-white">
      No fixes needed.
    </p>
    <p className="mt-[4px] text-[14px] font-normal leading-[22px] text-[#B3B3B3]">
      The script already performs well based on the current analysis.
    </p>
  </div>
) : (
  analysis.fixes.map((fix, index) => (
    <FixItem
      key={`${fix}-${index}`}
      icon={
        index % 3 === 0 ? (
          <AudioLines size={20} />
        ) : index % 3 === 1 ? (
          <Scissors size={20} />
        ) : (
          <FastForward size={20} />
        )
      }
      text={fix}
    />
  ))
)}
                </div>
              </div>
            </section>

            <section className="absolute left-[270px] top-[950px] h-[155px] w-[1140px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
              <h2 className="absolute left-[25px] top-[15px] h-[24px] text-[22px] font-semibold leading-[24px] text-white">
                Scene Breakdown
              </h2>

              <div className="absolute left-[25px] top-[60px] flex h-[5px] w-[1110px] overflow-hidden rounded-[999px]">
                {analysis.sceneSegments.map((segment, index) => (
                  <div
                    key={`${segment.label}-${index}`}
                    className="h-[5px]"
                    style={{
                      width: `${segment.width}px`,
                      backgroundColor: segment.color,
                    }}
                  />
                ))}
              </div>

              <div className="absolute left-[25px] top-[80px] grid w-[1110px] grid-cols-5 text-[14px] font-medium leading-[24px] text-[#B3B3B3]">
                <p>{scaleLabels[0]}</p>
                <p>{scaleLabels[1]}</p>
                <p>{scaleLabels[2]}</p>
                <p>{scaleLabels[3]}</p>
                <p className="text-right">{scaleLabels[4]}</p>
              </div>

              <div className="absolute left-[25px] top-[115px] flex items-center gap-[55px]">
                {analysis.sceneSegments.map((segment, index) => (
                  <Legend
                    key={`${segment.label}-${index}`}
                    color={segment.color}
                    label={segment.label}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {isFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
          <div className="relative h-[310px] w-[460px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
            <button
              onClick={() => setIsFeedbackOpen(false)}
              className="absolute right-[20px] top-[18px] text-[22px] font-normal leading-[24px] text-[#B3B3B3] transition hover:text-white"
            >
              x
            </button>

            <h2 className="absolute left-[30px] top-[30px] text-[22px] font-semibold leading-[24px] text-white">
              What was wrong?
            </h2>

            <p className="absolute left-[30px] top-[65px] w-[360px] text-[14px] font-normal leading-[22px] text-[#B3B3B3]">
              Tell us what felt inaccurate, confusing, or not useful in this
              analysis.
            </p>

            <textarea
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="Write your feedback here..."
              className="absolute left-[30px] top-[115px] h-[105px] w-[400px] resize-none rounded-[12px] border border-[#24242A] bg-[#0B1018] px-[14px] py-[12px] text-[14px] font-normal leading-[20px] text-white outline-none placeholder:text-[#777A85]"
            />

            <button
              onClick={() => {
                setIsFeedbackOpen(false);
                setFeedbackText("");
                setFeedbackMessage("Thanks - we will improve Reelyze.");
              }}
              className="absolute left-[30px] top-[240px] h-[44px] w-[160px] rounded-[12px] border border-[#24242A] bg-[#EF4444] text-[14px] font-semibold leading-[24px] text-white transition hover:bg-[#dc2626]"
            >
              Send feedback
            </button>

            <button
              onClick={() => setIsFeedbackOpen(false)}
              className="absolute left-[205px] top-[240px] h-[44px] w-[120px] rounded-[12px] border border-[#24242A] bg-[#111217] text-[14px] font-semibold leading-[24px] text-white transition hover:bg-[#1A0608]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isHookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
          <div className="relative h-[410px] w-[560px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
            <button
              onClick={() => setIsHookModalOpen(false)}
              className="absolute right-[20px] top-[18px] text-[22px] font-normal leading-[24px] text-[#B3B3B3] transition hover:text-white"
            >
              x
            </button>

            <h2 className="absolute left-[30px] top-[30px] text-[22px] font-semibold leading-[24px] text-white">
              {shouldShowHookAnalysis ? "Hook Analysis" : "Improved Hook"}
            </h2>

            <p className="absolute left-[30px] top-[65px] w-[430px] text-[14px] font-normal leading-[22px] text-[#B3B3B3]">
              {shouldShowHookAnalysis
  ? "This opening is already strong and does not need a rewrite."
  : "Use this version to make the opening clearer, stronger, and more curiosity-driven."}
            </p>

            <div className="absolute left-[30px] top-[115px] h-[86px] w-[460px] rounded-[14px] border border-[#24242A] bg-[#0B1018] px-[16px] py-[14px]">
              <p className="text-[15px] font-normal leading-[22px] text-white">
                "{isImprovingHook ? "Improving hook..." : improvedHook}"
              </p>
            </div>

            <div className="absolute left-[30px] top-[220px] w-[500px] max-h-[115px] overflow-hidden">
              <p className="mt-[6px] text-[14px] font-normal leading-[21px] text-[#B3B3B3] break-words whitespace-normal">
  {shouldShowHookAnalysis ? "Why this hook works:" : "Why it is better:"}
</p>

              <p className="mt-[6px] text-[14px] font-normal leading-[21px] text-[#B3B3B3] break-words whitespace-normal">
  {isImprovingHook
    ? "Reelyze is rewriting the opening based on your script."
    : improvedHookReason}
</p>
            </div>

            <button
              onClick={handleCopyHook}
              className="absolute left-[30px] top-[360px] h-[40px] w-[130px] rounded-[12px] border border-[#24242A] bg-[#EF4444] text-[14px] font-semibold leading-[24px] text-white transition hover:bg-[#dc2626]"
            >
              {copiedHook ? "Copied!" : "Copy Hook"}
            </button>

            <button
              onClick={() => setIsHookModalOpen(false)}
              className="absolute left-[175px] top-[360px] h-[40px] w-[100px] rounded-[12px] border border-[#24242A] bg-[#111217] text-[14px] font-semibold leading-[24px] text-white transition hover:bg-[#1A0608]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function ScoreBlock({
  left,
  title,
  score,
  label,
  labelColor,
  ringColor,
  description,
}: {
  left: number;
  title: string;
  score: number;
  label: string;
  labelColor: string;
  ringColor: string;
  description: string;
}) {
  return (
    <div
      className="absolute top-0 h-[170px] w-[380px]"
      style={{ left: `${left}px` }}
    >
      <p className="absolute left-[35px] top-[22px] h-[24px] text-[15px] font-medium leading-[24px] text-white">
        {title}
      </p>

      <div className="absolute left-[35px] top-[60px]">
        <ScoreRing score={score} color={ringColor} />
      </div>

      <div className="absolute left-[148px] top-[44px] w-[205px] text-center">
        <p
          className="text-[24px] font-semibold leading-[24px]"
          style={{ color: labelColor }}
        >
          {label}
        </p>

        <p className="mt-[12px] text-[14px] font-normal leading-[22px] text-[#B3B3B3]">
          {description}
        </p>
      </div>
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const safeScore = Math.max(0, Math.min(100, score));
  const gapDegrees = (100 - safeScore) * 3.6;
  const scoreDegrees = safeScore * 3.6;
  const startAngle = 180 + gapDegrees / 2;

  return (
    <div className="relative h-[88px] w-[88px]">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from ${startAngle}deg, ${color} 0deg ${scoreDegrees}deg, #252832 ${scoreDegrees}deg 360deg)`,
        }}
      />

      <div className="absolute left-[8px] top-[8px] h-[72px] w-[72px] rounded-full bg-[#0B0C10]" />

      <div className="absolute inset-0 flex flex-col items-center justify-center pt-[4px]">
        <p className="text-[28px] font-semibold leading-[24px] text-white">
          {safeScore}
        </p>

        <p className="mt-[4px] text-[14px] font-normal leading-[24px] text-[#B3B3B3]">
          /100
        </p>
      </div>
    </div>
  );
}

function ScriptLine({
  time,
  text,
  status,
}: {
  time: string;
  text: string;
  status: LineStatus;
}) {
  const isRisky = status === "risky";
  const isWarning = status === "warning";

  return (
    <div
      className={
        isRisky
          ? "grid grid-cols-[46px_1fr] gap-[12px] rounded-[9px] border border-[#EF4444]/20 bg-[#1A0608] px-[8px] py-[6px]"
          : isWarning
          ? "grid grid-cols-[46px_1fr] gap-[12px] rounded-[9px] border border-[#F59E0B]/20 bg-[#1A1305] px-[8px] py-[6px]"
          : "grid grid-cols-[46px_1fr] gap-[12px] px-[8px] py-[2px]"
      }
    >
      <p
        className={
          isRisky
            ? "text-[13px] font-normal leading-[20px] text-[#EF4444]"
            : isWarning
            ? "text-[13px] font-normal leading-[20px] text-[#F59E0B]"
            : "text-[13px] font-normal leading-[20px] text-[#B3B3B3]"
        }
      >
        {time}
      </p>

      <p
        className={
          isRisky
            ? "text-[13px] font-normal leading-[20px] text-[#EF4444]"
            : isWarning
            ? "text-[13px] font-normal leading-[20px] text-[#F59E0B]"
            : "text-[13px] font-normal leading-[20px] text-[#B3B3B3]"
        }
      >
        {text}
      </p>
    </div>
  );
}

function RiskyItem({
  time,
  title,
  description,
}: {
  time: string;
  title: string;
  description: string;
}) {
  return (
    <div className="w-full">
      <p className="text-[14px] font-medium leading-[18px] text-[#EF4444]">
        {time}
      </p>

      <p
        className="mt-[6px] text-[14px] font-normal leading-[19px] text-white"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {title}
      </p>

      <p
        className="mt-[3px] text-[13px] font-normal leading-[18px] text-[#B3B3B3]"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {description}
      </p>
    </div>
  );
}

function FixItem({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex w-full">
      <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] border border-[#EF4444]/30 bg-[#1A0608] text-[#EF4444]">
        {icon}
      </div>

      <p
        className="ml-[16px] w-[350px] text-[14px] font-normal leading-[19px] text-white"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {text}
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center">
      <div
        className="h-[5px] w-[5px] rounded-full"
        style={{ backgroundColor: color }}
      />

      <p className="ml-[10px] text-[14px] font-normal leading-[24px] text-[#B3B3B3]">
        {label}
      </p>
    </div>
  );
}

function createScriptLines(script: string) {
  const cleaned = script.trim().replace(/\s+/g, " ");

  if (!cleaned) {
    return [];
  }

  const sentenceParts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (sentenceParts.length >= 2) {
    return sentenceParts;
  }

  const words = cleaned.split(" ");

  if (words.length <= 12) {
    return [cleaned];
  }

  const lines: string[] = [];
  const wordsPerLine = 10;

  for (let i = 0; i < words.length; i += wordsPerLine) {
    const line = words.slice(i, i + wordsPerLine).join(" ");

    if (line) {
      lines.push(line);
    }
  }

  return lines;
}

function estimateDuration(script: string) {
  const cleaned = script.trim().replace(/\s+/g, " ");

  if (cleaned.length === 0) {
    return 0;
  }

  const seconds = Math.ceil(cleaned.length / 16.5);

  return Math.max(4, seconds);
}

function createLineTimestamps(lines: string[], totalDuration: number) {
  if (lines.length === 0) return ["00:00"];
  if (lines.length === 1) return ["00:00"];

  const step = totalDuration / lines.length;

  return lines.map((_, index) => formatTime(Math.floor(index * step)));
}

function createScaleLabels(totalDuration: number) {
  const safeDuration = Math.max(4, totalDuration);

  return [
    formatTime(0),
    formatTime(Math.round(safeDuration * 0.25)),
    formatTime(Math.round(safeDuration * 0.5)),
    formatTime(Math.round(safeDuration * 0.75)),
    formatTime(safeDuration),
  ];
}

function createTimeRange(
  startPercent: number,
  endPercent: number,
  duration: number
) {
  const start = Math.floor(duration * startPercent);
  const end = Math.max(start + 1, Math.floor(duration * endPercent));

  return `${formatTime(start)} - ${formatTime(end)}`;
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

// ─── Universal signal extraction ────────────────────────────────────────────

// ─── Universal signal extraction ────────────────────────────────────────────

interface UniversalSignals {
  curiosityScore: number;
  contrastScore: number;
  stakesScore: number;
  specificityScore: number;
  openLoopScore: number;
  payoffScore: number;
  clarityScore: number;
  escalationScore: number;
  consequenceScore: number;
}

function extractUniversalSignals(text: string): UniversalSignals {
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);

  // ── Curiosity ───────────────────────────────────────────────────────────────
  const curiosityPhrases = [
    "what if", "why does", "why did", "how did", "have you ever",
    "did you know", "what really", "the real reason", "nobody knows",
    "no one knows", "here's the thing", "you won't believe",
    "turns out", "the truth", "most people don't", "the secret",
    "still a mystery", "remains a mystery", "unsolved",
    "disappeared", "vanished",
  ];
  const weakCuriosityPhrases = [
    "why", "hidden", "unknown", "real problem", "before they",
    "no reason to", "reason to keep", "losing viewers", "viewers stay",
  ];
  // ── NEW: narrative mystery / tension openers ──────────────────────────────
  // These appear in story-driven scripts without explicit curiosity phrases
  const narrativeCuriosityPhrases = [
    "one small detail", "did not fit", "something was off",
    "but something", "suddenly became", "much darker", "darker than",
    "not what it seemed", "nothing like", "sounded nothing like",
    "looked nothing like", "stopped moving", "last message",
    "security footage", "what appeared to be", "what looked like",
    "for weeks", "for months", "for years", "nobody knew",
    "at first it seemed", "at first it looked",
  ];
  const curiosityHits = curiosityPhrases.filter(p => lower.includes(p)).length;
  const weakCuriosityHits = weakCuriosityPhrases.filter(p => lower.includes(p)).length;
  const narrativeCuriosityHits = narrativeCuriosityPhrases.filter(p => lower.includes(p)).length;
  const hasQuestion = Math.min((text.match(/\?/g) || []).length, 2);
  const curiosityScore = Math.min(
    85,
    curiosityHits * 14 + weakCuriosityHits * 5 + narrativeCuriosityHits * 11 + hasQuestion * 10
  );

  // ── Contrast ────────────────────────────────────────────────────────────────
  const contrastPhrases = [
    "but", "however", "yet", "instead", "the problem is", "the real problem",
    "most people think", "actually", "the truth is", "not what",
    "opposite", "surprisingly", "contrary", "despite", "even though",
    "while most", "what nobody", "what most", "most creators", "blame",
  ];
  // ── NEW: belief-reversal and comparison-contrast patterns ─────────────────
  const beliefReversalPhrases = [
    "that is not the real reason", "not the real reason",
    "not really", "not just", "not only", "it is not about",
    "it's not about", "sells something", "competing with",
    "much harder to copy", "more than", "proof that",
    "it is proof", "at first it sounds", "sounds impossible",
    "but ronaldo", "but he", "but she", "but they", "but the brand",
  ];
  const contrastHits = contrastPhrases.filter(p => lower.includes(p)).length;
  const beliefReversalHits = beliefReversalPhrases.filter(p => lower.includes(p)).length;
  const contrastScore = Math.min(
    85,
    contrastHits >= 1
      ? 20 + (contrastHits - 1) * 10 + beliefReversalHits * 10
      : beliefReversalHits * 14
  );

  // ── Stakes ──────────────────────────────────────────────────────────────────
  const stakesPhrases = [
    "lost", "cost", "destroyed", "failed", "changed", "millions", "forever",
    "danger", "risk", "survive", "death", "collapse", "collapsed", "ended",
    "ruined", "gone", "affected", "disaster", "crisis", "killed", "saved",
    "nothing left", "fell apart", "wiped out", "tragedy",
  ];
  const weakStakesPhrases = [
    "losing viewers", "viewers leave", "no reason", "entire result",
    "whole result",
  ];
  // ── NEW: soft social/personal/comparison stakes ───────────────────────────
  const softStakesPhrases = [
    "reputation", "status", "how everyone looks", "how people see",
    "nobody was supposed to see", "version of you",
    "change how", "changes how", "change the way", "gap becomes",
    "reach advantage", "hard to close", "much harder to close",
    "competing with symbols", "symbol of", "proof that you",
    "how you", "everyone knows", "everyone sees",
  ];
  const stakesHits = stakesPhrases.filter(p => lower.includes(p)).length;
  const weakStakesHits = weakStakesPhrases.filter(p => lower.includes(p)).length;
  const softStakesHits = softStakesPhrases.filter(p => lower.includes(p)).length;
  const stakesScore = Math.min(80, stakesHits * 14 + weakStakesHits * 6 + softStakesHits * 10);

  // ── Specificity ─────────────────────────────────────────────────────────────
  const numberMatches = Math.min((text.match(/\d+/g) || []).length, 4);
  const moneyMatches = Math.min((text.match(/\$|million|billion|thousand|percent|%/g) || []).length, 3);
  const namedEntityScore = /[A-Z][a-z]+ [A-Z][a-z]+|[A-Z]{2,}/.test(text) ? 18 : 0;
  const numericSpecificity = numberMatches * 12 + moneyMatches * 16 + namedEntityScore;

  const conceptualPhrases = [
    "the real problem", "the first line", "first line", "gives away",
    "creates a question", "adds contrast", "delays the payoff",
    "cause", "effect", "as a result", "which means", "opening line",
  ];
  const conceptualHits = Math.min(conceptualPhrases.filter(p => lower.includes(p)).length, 4);
  const conceptualSpecificity = conceptualHits * 7;

  // ── NEW: narrative specificity — concrete story details ───────────────────
  // Grounded details that make a script feel specific without numbers
  const narrativeSpecificityPhrases = [
    "on her way home", "stopped moving", "near a road", "last message",
    "security footage", "gas station", "missing person",
    "for weeks", "for months", "for days",
    "vertical jump", "timing", "body control", "reach advantage",
    "basketball move", "elite", "footballers",
    "tell time", "cheap watch", "status", "symbol of success",
    "one full day", "private joke", "awkward comment",
    "thought nobody was listening", "nobody was supposed to see",
    "version of you", "how everyone looks at you",
    "phone stopped", "phone started recording",
  ];
  const narrativeSpecificityHits = Math.min(
    narrativeSpecificityPhrases.filter(p => lower.includes(p)).length, 5
  );
  const narrativeSpecificity = narrativeSpecificityHits * 9; // max ~45

  const specificityScore = Math.min(100, numericSpecificity + conceptualSpecificity + narrativeSpecificity);

  // ── Open loops ──────────────────────────────────────────────────────────────
  const openLoopPhrases = [
    "but the real", "what happened next", "there is one problem", "wait until",
    "but that's not", "but that is not", "that's not the worst", "the catch",
    "nobody knows why", "no one knows why", "changes everything",
    "here's where", "and then something", "what no one expected",
    "what nobody expected", "before they even",
  ];
  const weakOpenLoopPhrases = [
    "no reason to keep", "if the hook", "the real problem is",
    "real problem is usually",
  ];
  // ── NEW: mystery/evidence escalation open loops ───────────────────────────
  const narrativeOpenLoopPhrases = [
    "one small detail", "did not fit", "something was off",
    "then they found", "and what", "but what", "but one",
    "that is when", "that was when", "until they", "until she",
    "and that might", "and that could", "and that would",
    "suddenly became", "what looked like a normal",
    "what seemed like a normal", "at first police",
    "at first it looked", "at first it seemed",
  ];
  const openLoopHits = openLoopPhrases.filter(p => lower.includes(p)).length;
  const weakOpenLoopHits = weakOpenLoopPhrases.filter(p => lower.includes(p)).length;
  const narrativeOpenLoopHits = narrativeOpenLoopPhrases.filter(p => lower.includes(p)).length;
  const openLoopScore = Math.min(
    80,
    openLoopHits * 20 + weakOpenLoopHits * 8 + narrativeOpenLoopHits * 13
  );

  // ── Payoff ──────────────────────────────────────────────────────────────────
  const payoffPhrases = [
    "that's why", "the result", "changed history", "changed everything",
    "changed the world", "affected millions", "chain reaction", "cost millions",
    "never recovered", "to this day", "years later", "lost their lives",
    "saved millions", "ended forever", "still remains", "was never found",
    "never found", "the company lost", "it worked", "it failed",
    "that decision", "what followed", "the aftermath",
  ];
  const weakPayoffPhrases = [
    "entire result", "can change", "that is why one", "viewers stay longer",
    "one stronger",
  ];
  // ── NEW: consequence / transformation / reveal payoff patterns ─────────────
  const narrativePayoffPhrases = [
    "suddenly became something", "suddenly became much", "much darker",
    "is not really competing", "not competing with", "competing with symbols",
    "it is competing with", "symbol of success", "proof that you",
    "nobody was supposed to see", "version of you that",
    "change how everyone", "how everyone looks at you",
    "the gap becomes", "gap becomes much harder",
    "that is why rolex", "that is why one stronger",
    "one stronger opening", "the entire result",
    "might be enough to", "that might be enough",
    "and that might be enough",
  ];
  const payoffHits = payoffPhrases.filter(p => lower.includes(p)).length;
  const weakPayoffHits = weakPayoffPhrases.filter(p => lower.includes(p)).length;
  const narrativePayoffHits = narrativePayoffPhrases.filter(p => lower.includes(p)).length;
  const lastThirdText = sentences.slice(Math.floor(sentences.length * 0.66)).join(" ").toLowerCase();
  const payoffInEnd = [
    ...payoffPhrases, ...narrativePayoffPhrases
  ].filter(p => lastThirdText.includes(p)).length;
  const payoffScore = Math.min(
    85,
    payoffHits * 14 + weakPayoffHits * 6 + narrativePayoffHits * 12 + payoffInEnd * 8
  );

  // ── Clarity ─────────────────────────────────────────────────────────────────
  const firstSentence = sentences[0] ?? "";
  const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
  const firstSentenceWords = firstSentence.split(/\s+/).filter(Boolean).length;
  let clarityScore = 55;
  if (firstSentenceWords >= 5 && firstSentenceWords <= 20) clarityScore += 25;
  else if (firstSentenceWords > 28) clarityScore -= 20;
  if (avgWordsPerSentence <= 22) clarityScore += 15;
  else if (avgWordsPerSentence > 35) clarityScore -= 15;
  clarityScore = Math.min(100, Math.max(0, clarityScore));

  // ── Escalation ──────────────────────────────────────────────────────────────
  const escalationPhrases = [
    "then", "after that", "next", "but then", "suddenly", "until",
    "eventually", "as a result", "which led", "that caused", "triggered",
    "sparked", "forcing", "leaving", "meaning",
  ];
  // ── NEW: narrative escalation patterns ────────────────────────────────────
  const narrativeEscalationPhrases = [
    "at first", "but then", "and then", "that is when", "that was when",
    "suddenly became", "from normal to", "what started as",
    "went from", "turned into", "became something", "began to",
    "the problem is that", "the scary part", "the real problem",
    "but that is not", "but that's not all",
  ];
  const escalationHits = escalationPhrases.filter(p => lower.includes(p)).length;
  const narrativeEscalationHits = narrativeEscalationPhrases.filter(p => lower.includes(p)).length;
  const escalationScore = Math.min(75, escalationHits * 8 + narrativeEscalationHits * 10);

  // ── Consequence ─────────────────────────────────────────────────────────────
  const consequencePhrases = [
    "changed history", "destroyed", "cost", "killed", "collapsed",
    "failed", "ended", "ruined", "affected millions", "changed everything",
    "changed the world", "triggered a chain reaction", "never recovered",
    "lost their lives", "gone forever", "wiped out", "bankruptcy",
    "the fallout", "consequences",
  ];
  const weakConsequencePhrases = [
    "entire result", "viewers stay longer", "no reason to keep watching",
    "losing viewers", "before they even", "whole result",
  ];
  // ── NEW: soft consequence / transformation patterns ────────────────────────
  const softConsequencePhrases = [
    "change how everyone", "how everyone looks at you",
    "how people see", "gap becomes", "much harder to close",
    "competing with symbols", "is not really competing",
    "might be enough to", "that might be enough",
    "nobody was supposed to see", "a version of you",
    "suddenly show", "suddenly became something",
    "much darker", "something much darker",
    "the whole story", "changes the whole",
  ];
  const consequenceHits = consequencePhrases.filter(p => lower.includes(p)).length;
  const weakConsequenceHits = weakConsequencePhrases.filter(p => lower.includes(p)).length;
  const softConsequenceHits = softConsequencePhrases.filter(p => lower.includes(p)).length;
  const consequenceScore = Math.min(
    80,
    consequenceHits * 16 + weakConsequenceHits * 6 + softConsequenceHits * 11
  );

  return {
    curiosityScore,
    contrastScore,
    stakesScore,
    specificityScore,
    openLoopScore,
    payoffScore,
    clarityScore,
    escalationScore,
    consequenceScore,
  };
}

// ─── Hook strength ──────────────────────────────────────────────────────────

// ─── Hook strength ──────────────────────────────────────────────────────────

function calculateHookStrength(
  firstSentence: string,
  signals: UniversalSignals
): number {
  const lower = firstSentence.toLowerCase();
  const wordCount = firstSentence.split(/\s+/).filter(Boolean).length;

  let score = 38;

  // ── Tier-1: direct curiosity / pattern-interrupt openers ──────────────────
  const tier1Hooks = [
    "what if", "did you know", "have you ever", "what really",
    "the real reason", "nobody knows", "no one knows", "you won't believe",
    "the truth about", "most people don't", "disappeared", "vanished",
    "still a mystery", "unsolved",
  ];
  const tier1Hits = tier1Hooks.filter(p => lower.includes(p)).length;
  score += tier1Hits * 18;

  // ── Tier-2: belief-contrast and soft curiosity openers ────────────────────
  const tier2Hooks = [
    "most creators think", "most people think", "everyone thinks",
    "you probably think", "most think",
    "turns out", "here's the thing", "what no one", "but the real",
    "what most", "the secret", "the real problem",
  ];
  const tier2Hits = tier2Hooks.filter(p => lower.includes(p)).length;
  score += tier2Hits * 14;

  // ── NEW Tier-3: narrative / story-driven openers ───────────────────────────
  // Story hooks that do not use explicit curiosity phrases but still create
  // tension through mystery setup, action, or implicit contrast
  const tier3Hooks = [
    // mystery/event openers
    "a woman", "a man", "a teenager", "a student", "a player",
    "one day", "it started when", "it began when",
    "for weeks", "for months", "nobody knew",
    // action/event openers
    "on her way", "on his way", "on their way",
    "they found", "police found", "investigators found",
    // comparison/contrast openers (sports, brand, business)
    "at first it sounds", "at first it looked", "at first it seemed",
    "sounds impossible", "looks impossible",
    // personal/social hooks
    "what if your", "imagine if your", "what if you",
  ];
  const tier3Hits = tier3Hooks.filter(p => lower.includes(p)).length;
  score += tier3Hits * 13;

  // ── Question mark in first sentence ───────────────────────────────────────
  if (firstSentence.includes("?")) score += 12;

  // ── Direct viewer address ─────────────────────────────────────────────────
  if (lower.includes(" your ") || lower.startsWith("your ")) score += 8;
  if (lower.includes(" you ") && !lower.startsWith("you ")) score += 4;

  // ── Contrast words in first sentence ─────────────────────────────────────
  const contrastPhrases = [
    "but the real", "but actually", "not what", "most creators",
    "the problem is", "the real problem", "however",
    "not the real", "that is not", "it is not about",
  ];
  const contrastHits = contrastPhrases.filter(p => lower.includes(p)).length;
  if (contrastHits >= 1) score += 10 + Math.min(contrastHits - 1, 2) * 5;
  if (contrastHits === 0 && lower.includes("but")) score += 4;

  // ── Numeric / money specificity ───────────────────────────────────────────
  if (/\d/.test(firstSentence)) score += 8;
  if (/\$|million|billion/.test(lower)) score += 5;

  // ── Stakes / tension words in first sentence ──────────────────────────────
  const stakesPhrases = [
    "lost", "destroyed", "cost", "danger", "changed",
    "forever", "collapse", "killed", "losing",
    "darker", "disappeared", "vanished", "impossible",
  ];
  const stakesHits = stakesPhrases.filter(p => lower.includes(p)).length;
  score += Math.min(stakesHits, 2) * 7;

  // ── Narrative specificity from first sentence ─────────────────────────────
  // Concrete story details even without numbers
  const narrativeDetailPhrases = [
    "on her way home", "stopped moving", "near a road",
    "last message", "security footage", "gas station",
    "vertical jump", "body control", "reach advantage",
    "tell time", "cheap watch", "status",
    "one full day", "private joke", "thought nobody",
    "phone started recording",
  ];
  const narrativeDetailHits = narrativeDetailPhrases.filter(p => lower.includes(p)).length;
  score += Math.min(narrativeDetailHits, 2) * 8;

  // ── Open loop support from full script ────────────────────────────────────
  if (signals.openLoopScore >= 20) score += 7;

  // ── Clarity bonus ─────────────────────────────────────────────────────────
  if (wordCount >= 5 && wordCount <= 22) score += 8;
  else if (wordCount > 30) score -= 10;

  // ── Penalties ─────────────────────────────────────────────────────────────
  const hardWeakStarts = [
    "welcome back", "hey guys", "hello everyone",
    "today we are going to", "today i want to",
    "before we start", "before we begin",
    "in today's video", "let me explain",
  ];
  if (hardWeakStarts.some(p => lower.startsWith(p))) score -= 28;
  if (lower.startsWith("in this video")) score -= 18;

  const vagueStarts = [
    "this is about", "this video is about", "this is a story about",
    "i want to talk about", "let's talk about", "so basically",
    "i will talk about", "i will explain",
  ];
  if (vagueStarts.some(p => lower.startsWith(p) || lower.includes(p))) score -= 14;

  // No curiosity/contrast/narrative signal — soft penalty only
  if (
    tier1Hits === 0 && tier2Hits === 0 && tier3Hits === 0 &&
    !firstSentence.includes("?") && contrastHits === 0
  ) {
    score -= 6;
  }

  const hasStrongSpecificity = signals.specificityScore >= 30;
  const cap = hasStrongSpecificity ? 92 : 88;

  return Math.min(cap, Math.max(0, Math.round(score)));
}

// ─── Retention structure ────────────────────────────────────────────────────

// ─── Retention structure ────────────────────────────────────────────────────

function calculateRetentionStructure(
  lines: string[],
  signals: UniversalSignals
): number {
  let risk = 42;

  const totalLines = lines.length;
  if (totalLines === 0) return 85;

  const fullText = lines.join(" ").toLowerCase();
  const charCount = fullText.length;

  // ── Positive reductions ────────────────────────────────────────────────────
  if (signals.curiosityScore >= 40) risk -= 7;
  else if (signals.curiosityScore >= 20) risk -= 4;

  if (signals.contrastScore >= 40) risk -= 6;
  else if (signals.contrastScore >= 20) risk -= 4;

  if (signals.openLoopScore >= 40) risk -= 7;
  else if (signals.openLoopScore >= 15) risk -= 4;

  if (signals.payoffScore >= 40) risk -= 6;
  else if (signals.payoffScore >= 15) risk -= 3;

  if (signals.consequenceScore >= 30) risk -= 5;
  else if (signals.consequenceScore >= 15) risk -= 2;

  if (signals.escalationScore >= 30) risk -= 5;
  else if (signals.escalationScore >= 15) risk -= 2;

  if (signals.stakesScore >= 30) risk -= 4;
  else if (signals.stakesScore >= 15) risk -= 2;

  if (signals.specificityScore >= 35) risk -= 4;
  else if (signals.specificityScore >= 18) risk -= 2;

  if (charCount >= 200 && charCount <= 750) risk -= 3;

  // ── NEW: universal narrative structure bonuses ─────────────────────────────
  // "At first… but…" escalation pattern (common in sports, mystery, business)
  const hasAtFirstBut =
    fullText.includes("at first") && (fullText.includes(" but ") || fullText.includes("however"));
  if (hasAtFirstBut) risk -= 5;

  // "Most people think X, but Y" belief reversal
  const hasMostPeopleReversal =
    (fullText.includes("most people think") || fullText.includes("most creators think")) &&
    (fullText.includes(" but ") || fullText.includes("however") || fullText.includes("actually"));
  if (hasMostPeopleReversal) risk -= 5;

  // Mystery/evidence sequence — concrete clue introduced mid-script
  const hasMysterySequence =
    (fullText.includes("one small detail") || fullText.includes("did not fit") ||
     fullText.includes("something was off") || fullText.includes("security footage") ||
     fullText.includes("last message") || fullText.includes("then they found")) &&
    (fullText.includes("but") || fullText.includes("suddenly") || fullText.includes("darker"));
  if (hasMysterySequence) risk -= 6;

  // Comparison escalation — "X but Y still has Z advantage" type structure
  const hasComparisonEscalation =
    (fullText.includes("but") && fullText.includes("still") &&
     (fullText.includes("advantage") || fullText.includes("gap") || fullText.includes("harder")));
  if (hasComparisonEscalation) risk -= 4;

  // Consequence/transformation ending
  const hasSoftConsequence =
    fullText.includes("that might be enough") ||
    fullText.includes("competing with symbols") ||
    fullText.includes("how everyone looks") ||
    fullText.includes("version of you") ||
    fullText.includes("something much darker") ||
    fullText.includes("much harder to close");
  if (hasSoftConsequence) risk -= 4;

  // ── Penalties ────────────────────────────────────────────────────────────
  if (totalLines >= 5) {
    const midStart = Math.floor(totalLines * 0.33);
    const midEnd = Math.floor(totalLines * 0.66);
    const middleText = lines.slice(midStart, midEnd).join(" ").toLowerCase();
    const middleHasSignal = [
      "but", "however", "then", "suddenly", "except", "actually",
      "the problem", "real problem", "if it", "that is why", "result",
      "at first", "one detail", "the scary part", "the truth",
    ].some(p => middleText.includes(p));
    if (!middleHasSignal) risk += 7;
  }

  if (signals.openLoopScore === 0) risk += 8;
  if (signals.payoffScore === 0 && signals.consequenceScore === 0) risk += 10;
  if (signals.contrastScore === 0) risk += 6;
  if (signals.curiosityScore === 0) risk += 6;
  if (signals.specificityScore === 0) risk += 5;

  const fluffPhrases = [
    "basically", "as you can see", "i just want to", "this is very important",
    "i'm going to explain", "really important", "just to summarize",
  ];
  const fluffHits = fluffPhrases.filter(p => fullText.includes(p)).length;
  risk += fluffHits * 7;

  if (charCount < 180) risk += 10;
  if (charCount > 850) risk += 8;

  // ── Dynamic floor based on positive signal count ─────────────────────────
  const positiveSignalCount = [
    signals.curiosityScore >= 20,
    signals.contrastScore >= 20,
    signals.openLoopScore >= 15,
    signals.payoffScore >= 15,
    signals.escalationScore >= 15,
    signals.specificityScore >= 18,
    signals.stakesScore >= 15,
    signals.consequenceScore >= 15,
  ].filter(Boolean).length;

  // Narrative structure bonuses count toward floor too
  const narrativeBonusCount = [
    hasAtFirstBut, hasMostPeopleReversal, hasMysterySequence,
    hasComparisonEscalation, hasSoftConsequence,
  ].filter(Boolean).length;

  const combinedStrength = positiveSignalCount + narrativeBonusCount;

  const floor = combinedStrength >= 8 ? 20
    : combinedStrength >= 6 ? 24
    : combinedStrength >= 5 ? 27
    : combinedStrength >= 4 ? 30
    : combinedStrength >= 3 ? 34
    : 38;

  return Math.min(100, Math.max(floor, Math.round(risk)));
}

// ─── Payoff strength ────────────────────────────────────────────────────────

// ─── Payoff strength ────────────────────────────────────────────────────────

function calculatePayoffStrength(
  lines: string[],
  signals: UniversalSignals
): number {
  let strength = 25;

  const lastThird = lines.slice(Math.floor(lines.length * 0.6)).join(" ").toLowerCase();
  const fullText = lines.join(" ").toLowerCase();

  // Strong explicit payoff phrases in the last third
  const payoffPhrases = [
    "that's why", "the result", "changed everything", "changed history",
    "never recovered", "to this day", "years later", "lost their lives",
    "ended forever", "still remains", "was never found", "the aftermath",
    "what followed", "that decision", "it worked", "it failed",
  ];
  const payoffHits = payoffPhrases.filter(p => lastThird.includes(p)).length;
  strength += payoffHits * 14;

  // Resolution phrases
  const resolutionPhrases = [
    "that is why", "that's why", "here's what happened", "the answer",
    "the reason", "it turned out", "turned out", "the truth was",
  ];
  const resolutionHits = resolutionPhrases.filter(p => lastThird.includes(p)).length;
  strength += resolutionHits * 10;

  // Weak payoff phrases
  const weakPayoffPhrases = [
    "entire result", "can change", "that is why one", "viewers stay longer",
    "one stronger",
  ];
  const weakPayoffHits = weakPayoffPhrases.filter(p => lastThird.includes(p)).length;
  strength += weakPayoffHits * 5;

  // ── NEW: narrative / consequence / transformation endings ─────────────────
  // These are strong payoffs that do not use explicit "that's why" phrasing
  const narrativePayoffPhrases = [
    // mystery/reveal endings
    "suddenly became something", "suddenly became much", "much darker",
    "something much darker", "what looked like a normal",
    "was never found", "the case", "the investigation",
    // comparison/consequence endings
    "the gap becomes", "gap becomes much harder", "much harder to close",
    "is not really competing", "competing with symbols",
    "symbol of success", "proof that you",
    // personal/social consequence endings
    "nobody was supposed to see", "version of you that",
    "change how everyone", "how everyone looks at you",
    "might be enough to", "that might be enough",
    "and that might be enough",
    // general transformation
    "the whole story", "changes the whole", "changes everything",
    "that is why one stronger", "one stronger opening",
  ];
  const narrativePayoffHits = narrativePayoffPhrases.filter(p => lastThird.includes(p)).length;
  strength += narrativePayoffHits * 13;

  // Numeric specificity in ending
  if (/\d/.test(lastThird)) strength += 8;

  // Consequence present
  if (signals.consequenceScore >= 20) strength += 10;
  else if (signals.consequenceScore >= 8) strength += 5;

  // Escalation support
  if (signals.escalationScore >= 20) strength += 6;

  // Stakes support
  if (signals.stakesScore >= 20) strength += 5;

  // Weak ending penalty
  const weakEndingPhrases = [
    "let me know", "comment below", "what do you think", "share this",
    "follow for more", "like and subscribe", "stay tuned",
  ];
  const weakEndingHits = weakEndingPhrases.filter(p => fullText.includes(p)).length;
  strength -= weakEndingHits * 8;

  // No resolution at all
  if (
    payoffHits === 0 && resolutionHits === 0 &&
    weakPayoffHits === 0 && narrativePayoffHits === 0 &&
    signals.consequenceScore === 0
  ) {
    strength -= 14;
  }

  return Math.min(100, Math.max(0, Math.round(strength)));
}

// ─── Main analysis ───────────────────────────────────────────────────────────

function analyzeScript(
  script: string,
  duration: number,
  scriptLines: string[]
): AnalysisResult {
  const text = script.trim();
  const lines = scriptLines;
  const totalLines = lines.length;

  const firstSentence = text.split(/[.!?]/)[0]?.trim() ?? text.trim();
  const signals = extractUniversalSignals(text);

 const hookScore = text.length > 0
  ? Math.max(18, clampScore(calculateHookStrength(firstSentence, signals)))
  : 0;
  const structureRisk = calculateRetentionStructure(lines, signals);
  const payoffStrength = calculatePayoffStrength(lines, signals);

// Payoff reduces risk, but is capped so no script reaches near-zero risk
  const payoffReduction = Math.min(payoffStrength * 0.10, 8);
  let retentionRisk = clampScore(Math.round(structureRisk - payoffReduction));
  // Absolute floor: no script should ever report below 20 retention risk
  if (retentionRisk < 20) retentionRisk = 20;

  // ── Score caps ────────────────────────────────────────────────────────────
  const charCount = text.length;
  const hasNumericSpecificity = signals.specificityScore >= 30;
  const isShortSimple = charCount < 350 && totalLines <= 5;

  // Overall raw
  let overallScore = clampScore(
    Math.round(hookScore * 0.55 + (100 - retentionRisk) * 0.45)
  );

  // Cap: no numeric/named specificity → overall ≤ 85
  if (!hasNumericSpecificity && overallScore > 85) overallScore = 85;

  // Cap: short simple script → overall ≤ 82
  if (isShortSimple && overallScore > 82) overallScore = 82;

  // Cap: retention risk above 30 → overall ≤ 88
  if (retentionRisk > 30 && overallScore > 88) overallScore = 88;

  // Cap: weak payoff → overall ≤ 85
  if (payoffStrength < 40 && overallScore > 85) overallScore = 85;

  overallScore = clampScore(overallScore);

// ── Build risky parts and fixes ────────────────────────────────────────────
  const riskyParts: RiskyPart[] = [];
  const fixes: string[] = [];
  const riskyLineIndexes: number[] = [];
  const warningLineIndexes: number[] = [];

  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const isGoodScript = overallScore >= 70 && hookScore >= 65 && retentionRisk <= 35;
  const isStrongScript = overallScore >= 80;

 // Pre-compute hook rewrite once so Suggested Fixes and Improved Hook modal always match
  const hookRewriteSuggestion = createHookRewrite(text);

  // 1. Weak/Average hook → red risky part only when hookScore < 45
  //    Warning-level (yellow) when 45–64
  //    Nothing when hookScore >= 65
  if (hookScore < 45) {
    riskyParts.push({
      time: createTimeRange(0, 0.25, duration),
      title: "Weak opening.",
      description: "The first line may not stop viewers from swiping. It needs more curiosity, contrast, or a clear result.",
    });
    riskyLineIndexes.push(0);
    fixes.push(`Rewrite your hook: "${hookRewriteSuggestion}"`);
  } else if (hookScore < 65) {
    // Warning only — first line gets yellow highlight, not red
    warningLineIndexes.push(0);
    if (!isGoodScript) {
      fixes.push("Sharpen the opening with a stronger curiosity gap or clearer contrast to give viewers a faster reason to stay.");
    }
  }

  // 2. No curiosity gap — only for clearly weak hooks
  if (signals.curiosityScore < 12 && hookScore < 55) {
    if (!riskyParts.some(p => p.title === "Weak opening.")) {
      riskyParts.push({
        time: createTimeRange(0, 0.3, duration),
        title: "No clear curiosity gap.",
        description: "The opening explains the topic but does not create enough tension or an unanswered question.",
      });
      if (!riskyLineIndexes.includes(0)) riskyLineIndexes.push(0);
    }
    fixes.push("Open with an unanswered question, a missing detail, or a surprising consequence.");
  }

  // 3. No contrast or open loop — only for clearly weak scripts
  if (
    signals.contrastScore < 12 &&
    signals.openLoopScore < 12 &&
    wordCount > 20 &&
    overallScore < 58
  ) {
    fixes.push('Add a contrast line mid-script — something like: "But that is not the real problem."');
  }

  // 4. Flat middle — only for longer scripts with genuinely flat middles
  if (totalLines >= 5) {
    const middleLines = lines.slice(
      Math.floor(totalLines * 0.33),
      Math.floor(totalLines * 0.66)
    );
    const middleText = middleLines.join(" ").toLowerCase();
    const middleFlat = ![
      "but", "however", "then", "suddenly", "except", "actually",
      "the problem", "real problem", "if it", "that is why", "result",
    ].some(p => middleText.includes(p));

    if (middleFlat && !isGoodScript) {
      riskyParts.push({
        time: createTimeRange(0.35, 0.65, duration),
        title: "Middle may lose momentum.",
        description: "No contrast, escalation, or new tension was found in the middle section.",
      });
      riskyLineIndexes.push(Math.floor(totalLines / 2));
      fixes.push("Add a pattern interrupt or contrast in the middle to restart attention.");
    }
  }

  // 5. No stakes — only for weak scripts that genuinely lack consequence signal
  if (
    signals.stakesScore < 12 &&
    signals.consequenceScore < 10 &&
    wordCount >= 25 &&
    overallScore < 62
  ) {
    fixes.push("Raise the stakes: what is at risk, what was lost, or what changes if this is ignored?");
  }

  // 6. No specificity — only when genuinely absent and script is weak
  if (signals.specificityScore < 10 && wordCount >= 20 && overallScore < 70) {
    fixes.push("Add a more concrete detail, example, consequence, or measurable result to make the script feel grounded.");
  }

  // 7. Weak payoff — only when payoff AND consequence are both genuinely weak
  if (
    payoffStrength < 28 &&
    signals.consequenceScore < 15 &&
    wordCount >= 20 &&
    !isGoodScript
  ) {
    riskyParts.push({
      time: createTimeRange(0.75, 1.0, duration),
      title: "Payoff could be stronger.",
      description: "The ending may not feel rewarding. A clearer result or consequence would help.",
    });
    riskyLineIndexes.push(Math.max(0, totalLines - 1));
    fixes.push("Make the final payoff more specific — state the result, consequence, or unresolved mystery clearly.");
  }

  // 8. No open loop — only for clearly weak scripts
  if (
    signals.openLoopScore === 0 &&
    signals.curiosityScore < 12 &&
    signals.contrastScore < 15 &&
    wordCount >= 35 &&
    overallScore < 58
  ) {
    riskyParts.push({
      time: createTimeRange(0.3, 0.6, duration),
      title: "No reason to keep watching.",
      description: "The script may not give viewers enough curiosity or unresolved tension before the payoff.",
    });
    fixes.push("Add an unanswered question or a delayed reveal to keep viewers engaged through the middle.");
  }

  // 9. Filler phrases
  const fluffPhrases = [
    "basically", "as you can see", "i just want to", "this is very important",
    "let's talk about", "i'm going to explain", "really important",
  ];
  if (fluffPhrases.some(p => lower.includes(p))) {
    riskyParts.push({
      time: createTimeRange(0.3, 0.6, duration),
      title: "Possible filler phrases.",
      description: "Some lines may sound like setup instead of real value.",
    });
    fixes.push("Replace filler phrases with a specific example, concrete consequence, or direct insight.");
  }

  // 10. Script too short
  if (charCount < 180) {
    riskyParts.push({
      time: createTimeRange(0.45, 0.75, duration),
      title: "Script may be too short.",
      description: "The idea may not feel developed enough before the ending.",
    });
    fixes.push("Add one stronger example or consequence before the final payoff.");
  }

  // 11. Script too long
  if (charCount > 850) {
    riskyParts.push({
      time: createTimeRange(0.55, 0.85, duration),
      title: "Script may be too long.",
      description: "Viewers may lose focus before the ending.",
    });
    fixes.push("Cut repeated explanations and keep only the strongest points.");
  }

  // ── Optional improvement suggestions for good scripts ─────────────────────
  // Soft, non-urgent language only — no "rewrite" or "add contrast" if signals are strong
  if (isGoodScript && !isStrongScript) {
    if (fixes.length === 0) {
      if (hookScore < 75) {
        fixes.push("Sharpen the first line with a stronger curiosity gap or clearer contrast.");
      }
      if (signals.specificityScore < 30) {
        fixes.push("Add one more specific detail to make the payoff feel even more concrete.");
      }
      if (fixes.length === 0) {
        fixes.push("Tighten any line that does not add new information or tension.");
      }
    }
  }

  // ── Warning line indexes ───────────────────────────────────────────────────
  lines.forEach((line, index) => {
    if (riskyLineIndexes.includes(index)) return;
    const ll = line.toLowerCase();
    const isMediumLength = line.length > 110 && line.length <= 200;
    const isVague =
      (ll.includes("viewers") || ll.includes("creators") || ll.includes("retention")) &&
      !ll.includes("?") && !ll.includes("but") && !ll.includes("real problem");
    const hasWarningPhrase = [
      "most people think", "most creators think", "the problem is",
      "step by step", "every line should", "add one line", "start with",
    ].some(p => ll.includes(p));
    if (isMediumLength || isVague || hasWarningPhrase) {
      warningLineIndexes.push(index);
    }
  });

  // ── Deduplicate ────────────────────────────────────────────────────────────
  let uniqueRiskyParts = dedupeRiskyParts(riskyParts);
  let uniqueFixes = dedupeFixes(fixes);
  const uniqueRiskyIndexes = [...new Set(riskyLineIndexes)]
    .filter(i => i >= 0 && i < totalLines)
    .sort((a, b) => a - b);
  const uniqueWarningIndexes = [...new Set(warningLineIndexes)]
    .filter(i => i >= 0 && i < totalLines && !uniqueRiskyIndexes.includes(i))
    .sort((a, b) => a - b);

// ── Enforce minimums for weak scripts ─────────────────────────────────────
 if (overallScore < 58) {
    // Weak scripts must always have at least 2 risky parts and 4 direct fixes
    const alreadyHasOpeningPart = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("weak opening") ||
      p.title.toLowerCase().includes("hook needs") ||
      p.title.toLowerCase().includes("curiosity gap")
    );
    if (uniqueRiskyParts.length < 2 && hookScore < 65 && !alreadyHasOpeningPart) {
      uniqueRiskyParts.push({
        time: createTimeRange(0, 0.25, duration),
        title: "Hook needs more work.",
        description: "The opening does not clearly create curiosity, contrast, or a reason to stay.",
      });
      if (!uniqueRiskyIndexes.includes(0)) uniqueRiskyIndexes.push(0);
    }
    if (uniqueRiskyParts.length < 2) {
      uniqueRiskyParts.push({
        time: createTimeRange(0.35, 0.65, duration),
        title: "Middle may lose momentum.",
        description: "The script may need a stronger turn, contrast, or new piece of information.",
      });
      uniqueRiskyIndexes.push(Math.max(1, Math.floor(totalLines / 2)));
    }
    if (uniqueFixes.length < 4) {
      if (hookScore < 65 && !uniqueFixes.some(f => f.toLowerCase().includes("rewrite"))) {
        uniqueFixes.push(`Rewrite your hook: "${hookRewriteSuggestion}"`);
      }
      if (signals.contrastScore < 20 && !uniqueFixes.some(f => f.toLowerCase().includes("contrast"))) {
        uniqueFixes.push("Add a contrast or pattern interrupt in the middle section.");
      }
      if (signals.payoffScore < 20 && signals.consequenceScore < 15 && !uniqueFixes.some(f => f.toLowerCase().includes("payoff"))) {
        uniqueFixes.push("Make the payoff more specific so the viewer feels rewarded.");
      }
      if (uniqueFixes.length < 4) {
        uniqueFixes.push("Make each line earn its place — cut any sentence that does not add new information or tension.");
      }
    }
    uniqueRiskyParts = dedupeRiskyParts(uniqueRiskyParts);
    uniqueFixes = dedupeFixes(uniqueFixes);
  } else if (overallScore < 75) {
    // Medium scripts: at least 1 risky part, 2–4 fixes, but no harsh language
    const alreadyHasOpeningPartMid = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("weak opening") ||
      p.title.toLowerCase().includes("hook needs") ||
      p.title.toLowerCase().includes("curiosity gap")
    );
    if (uniqueRiskyParts.length < 1 && hookScore < 65 && !alreadyHasOpeningPartMid) {
      uniqueRiskyParts.push({
        time: createTimeRange(0, 0.25, duration),
        title: "Hook needs more work.",
        description: "The opening does not clearly create curiosity, contrast, or a reason to stay.",
      });
      if (!uniqueRiskyIndexes.includes(0)) uniqueRiskyIndexes.push(0);
    }
    if (uniqueFixes.length < 2) {
      if (hookScore < 68 && !uniqueFixes.some(f => f.toLowerCase().includes("sharpen") || f.toLowerCase().includes("rewrite"))) {
        uniqueFixes.push("Sharpen the first line with a stronger curiosity gap or clearer contrast.");
      }
      if (signals.contrastScore < 15 && signals.openLoopScore < 15 && !uniqueFixes.some(f => f.toLowerCase().includes("contrast") || f.toLowerCase().includes("turn"))) {
        uniqueFixes.push("Add a contrast or unexpected turn in the middle section.");
      }
      if (signals.payoffScore < 20 && signals.consequenceScore < 15 && !uniqueFixes.some(f => f.toLowerCase().includes("payoff") || f.toLowerCase().includes("result"))) {
        uniqueFixes.push("End with a specific result, consequence, or unresolved detail the viewer will remember.");
      }
      if (uniqueFixes.length < 2) {
        uniqueFixes.push("Make each line earn its place — cut any sentence that does not add new information or tension.");
      }
    }
    uniqueRiskyParts = dedupeRiskyParts(uniqueRiskyParts);
    uniqueFixes = dedupeFixes(uniqueFixes);
  }

  // ── Clear everything for genuinely strong scripts ─────────────────────────
  if (uniqueRiskyParts.length === 0 && overallScore >= 80) {
    uniqueFixes.length = 0;
    uniqueRiskyIndexes.length = 0;
    uniqueWarningIndexes.length = 0;
  }

  const hasEndingFlagged = uniqueRiskyParts.some(p =>
    p.title.toLowerCase().includes("payoff") ||
    p.title.toLowerCase().includes("too long") ||
    p.title.toLowerCase().includes("drop-off")
  );
  const sceneSegments = createSceneSegments(
  hookScore,
  retentionRisk,
  overallScore,
  uniqueRiskyParts.length > 0,
  hasEndingFlagged,
  uniqueFixes.length,
  payoffStrength,
);

  const issueTitles = uniqueRiskyParts.map(p => p.title.toLowerCase());

  return {
    overall: {
      score: overallScore,
      label: getOverallLabel(overallScore),
      color: "#FFFFFF",
      ringColor: "#EF4444",
      description: getOverallDescription(overallScore, issueTitles),
    },
    hook: {
      score: hookScore,
      label: getHookLabel(hookScore),
      color: getHookColor(hookScore),
      ringColor: getHookColor(hookScore),
      description: getHookDescription(hookScore, issueTitles),
    },
    risk: {
      score: retentionRisk,
      label: getRiskLabel(retentionRisk),
      color: getRiskColor(retentionRisk),
      ringColor: getRiskColor(retentionRisk),
      description: getRiskDescription(retentionRisk, issueTitles),
    },
    riskyParts: uniqueRiskyParts.slice(0, 4),
    fixes: uniqueFixes.slice(0, 5),
    riskyLineIndexes: uniqueRiskyIndexes,
    warningLineIndexes: uniqueWarningIndexes,
    sceneSegments,
  };
}

function createSceneSegments(
  hookScore: number,
  riskScore: number,
  overallScore: number,
  hasRiskyParts: boolean,
  hasEndingFlagged: boolean,
  fixCount: number,
  payoffStrength: number,
): SceneSegment[] {
  const totalWidth = 1110;

  // ── Opening segment color ─────────────────────────────────────────────────
  const openingColor: string =
    hookScore < 45 ? "#EF4444"
    : hookScore < 75 ? "#F59E0B"
    : "#22C55E";

  // ── Middle segment color ──────────────────────────────────────────────────
  const middleColor: string =
    riskScore >= 60 ? "#EF4444"
    : riskScore >= 35 ? "#F59E0B"
    : "#22C55E";

  // ── Ending segment color ──────────────────────────────────────────────────
  const endingColor: string =
    hasEndingFlagged && riskScore >= 45 ? "#EF4444"
    : (overallScore < 75 && fixCount > 0) || payoffStrength < 40 ? "#F59E0B"
    : "#22C55E";

  // ── Opening label ─────────────────────────────────────────────────────────
  const openingLabel =
    openingColor === "#EF4444" ? "Risky"
    : openingColor === "#F59E0B" ? "Average"
    : "Strong";

  // ── Middle label ──────────────────────────────────────────────────────────
  const middleLabel =
    middleColor === "#EF4444" ? "Risky"
    : middleColor === "#F59E0B" ? "Average"
    : "Strong";

  // ── Ending label ──────────────────────────────────────────────────────────
  const endingLabel =
    endingColor === "#EF4444" ? "Potential drop-off"
    : endingColor === "#F59E0B" ? "Average"
    : "Strong";

  // ── Width ratios ──────────────────────────────────────────────────────────
  const openingRatio = hookScore < 45 ? 0.38 : hookScore < 75 ? 0.33 : 0.30;
  const endingRatio  = 0.25;
  const middleRatio  = 1 - openingRatio - endingRatio;

  return withWidths(
    [
      { label: openingLabel, color: openingColor },
      { label: middleLabel,  color: middleColor  },
      { label: endingLabel,  color: endingColor  },
    ],
    [openingRatio, middleRatio, endingRatio],
    totalWidth
  );
}

function withWidths(
  segments: Omit<SceneSegment, "width">[],
  ratios: number[],
  totalWidth: number
): SceneSegment[] {
  let usedWidth = 0;
  return segments.map((segment, index) => {
    const isLast = index === segments.length - 1;
    const width = isLast
      ? totalWidth - usedWidth
      : Math.round(totalWidth * ratios[index]);
    usedWidth += width;
    return { ...segment, width };
  });
}

// ─── Dedupe helpers ──────────────────────────────────────────────────────────

function dedupeRiskyParts(parts: RiskyPart[]): RiskyPart[] {
  const seen = new Set<string>();
  return parts.filter(part => {
    const key = part.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeFixes(fixes: string[]): string[] {
  const seen = new Set<string>();
  return fixes.filter(fix => {
    const key = fix.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Hook rewrite (fallback) ─────────────────────────────────────────────────

// ─── Hook rewrite (fallback) ─────────────────────────────────────────────────

function createHookRewrite(script: string): string {
  const cleanLines = script
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const firstLine = cleanLines[0] ?? "";
  const secondLine = cleanLines[1] ?? "";
  const thirdLine = cleanLines[2] ?? "";
  const combined = `${firstLine} ${secondLine} ${thirdLine}`.toLowerCase();
  const firstLower = firstLine.toLowerCase();

  // ── Strip filler intro prefix to expose the real topic ───────────────────
  const stripped = firstLine
    .replace(/^today i (want to |will )?(talk about|explain|cover|discuss)\s*/i, "")
    .replace(/^i (will |want to )(talk about|explain|cover|discuss)\s*/i, "")
    .replace(/^in this video,?\s*(i will |i want to |we will |we are going to )?(talk about|explain|cover|discuss)?\s*/i, "")
    .replace(/^let'?s talk about\s*/i, "")
    .replace(/^this video is about\s*/i, "")
    .replace(/^so,?\s*/i, "")
    .replace(/^hey guys,?\s*/i, "")
    .replace(/^welcome( back)?,?\s*/i, "")
    .replace(/[.!?]+$/g, "")
    .trim();

  // Remove leading subordinator words that cause grammar problems in templates
  // "why videos need hooks" → "videos need hooks"
  // "how to improve videos" → "improve videos" (further cleaned below)
  const cleanedTopic = stripped
    .replace(/^(why|how|what|whether|when|where|that)\s+/i, "")
    .trim();

  // Detect if the cleaned topic starts with "to " (infinitive from "how to...")
  // "to improve your videos" → "improving your videos"
  const topicNormalized = cleanedTopic
    .replace(/^to ([a-z])/i, (_, c: string) => c.toUpperCase())
    .trim();

  const topicWords = topicNormalized.split(/\s+/).filter(Boolean);

  // ── Pattern matching for connected rewrites ───────────────────────────────

  // Pattern: "Most people think X" or "X is expensive because Y"
  const beliefMatch =
    /most (people|creators) think (.{5,50})/i.exec(combined) ??
    /(.{4,40}) is (expensive|famous|known|popular|successful) because/i.exec(combined);
  if (beliefMatch) {
    const subjectWords = firstLine
      .replace(/^most (people|creators) think\s*/i, "")
      .replace(/[.!?]+$/, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .join(" ");
    const subject = subjectWords || topicNormalized;
    return `Most people think ${subject} is about one thing, but that is not what people are really paying for.`;
  }

  // Pattern: comparison between two entities
  const comparisonSignal =
    combined.includes(" vs ") ||
    combined.includes("outjump") ||
    combined.includes("better than") ||
    combined.includes("compared to") ||
    (combined.includes(" and ") && (combined.includes("player") || combined.includes("athlete")));
  if (comparisonSignal) {
    const subject = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 5).join(" ");
    return `What if ${subject} was closer to the competition than most people think?`;
  }

  // Pattern: personal consequence / social exposure
  const personalSignal =
    combined.includes("your phone") ||
    combined.includes("recording") ||
    combined.includes("everything you") ||
    combined.includes("you said") ||
    combined.includes("you thought");
  if (personalSignal) {
    return `What if everything you said today was recorded — and someone was about to play it back?`;
  }

  // Pattern: disappearance / mystery / crime
  const mysterySignal =
    combined.includes("disappear") ||
    combined.includes("vanish") ||
    combined.includes("missing") ||
    combined.includes("murder") ||
    combined.includes("crime") ||
    combined.includes("killed") ||
    combined.includes("found dead");
  if (mysterySignal) {
    const subject = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 4).join(" ");
    return `${capitalizeFirst(subject)} seemed like a normal story — until one detail changed everything.`;
  }

  // Pattern: brand / business / product insight
  const businessSignal =
    combined.includes("brand") ||
    combined.includes("company") ||
    combined.includes("business") ||
    combined.includes("product") ||
    combined.includes("sell") ||
    combined.includes("revenue") ||
    combined.includes("billion");
  if (businessSignal) {
    const subject = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 5).join(" ");
    return `${capitalizeFirst(subject)} is not really selling what most people think it is.`;
  }

  // Pattern: filler intro — build rewrite from cleaned topic
  const isFillerIntro =
    firstLower.startsWith("today i") ||
    firstLower.startsWith("in this video") ||
    firstLower.startsWith("let's talk") ||
    firstLower.startsWith("i will") ||
    firstLower.startsWith("i want to") ||
    firstLower.startsWith("so today") ||
    firstLower.startsWith("hey guys") ||
    firstLower.startsWith("welcome");

 if (isFillerIntro) {
    // If the cleaned topic is a full clause (contains a verb-like structure),
    // the "What if X is the one thing..." template produces broken grammar.
    // Detect this by checking for common auxiliary/verb patterns mid-topic.
    const topicIsClause =
      /\b(is|are|was|were|be|need|needs|have|has|make|makes|help|helps|cause|causes|stop|stops|keep|keeps|get|gets|work|works|mean|means|require|requires|matter|matters|affect|affects|improve|improves|impact|impacts)\b/i.test(
        topicNormalized
      ) && topicWords.length >= 2;

    // Detect topic domain for more specific fallbacks
    const topicLower = topicNormalized.toLowerCase();
    const isHookOrRetentionTopic =
      topicLower.includes("hook") ||
      topicLower.includes("viewer") ||
      topicLower.includes("watch") ||
      topicLower.includes("retention") ||
      topicLower.includes("short") ||
      topicLower.includes("video") ||
      topicLower.includes("content");

    if (topicIsClause && isHookOrRetentionTopic) {
      // Domain-specific natural rewrites for video/hook/retention topics
      const hookDomainRewrites = [
        `What if one weak hook is the reason viewers leave before your video even starts?`,
        `What if your first line is the reason viewers never reach the best part?`,
        `What if people are leaving your Short before they even understand the point?`,
      ];
      // Pick deterministically based on topic length to avoid random variance
      return hookDomainRewrites[topicWords.length % hookDomainRewrites.length];
    }

    if (topicIsClause) {
      // Generic filler intro with a clause topic — reframe as consequence
      // Extract the first noun phrase from the topic as the subject
      const subjectGuess = topicWords.slice(0, 3).join(" ");
      return `What if ${subjectGuess.toLowerCase()} is costing you more than you realise?`;
    }

    // Topic reads as a noun phrase — safe to embed in the template
    if (topicNormalized.length >= 8 && topicWords.length >= 2) {
      return `What if ${topicNormalized.toLowerCase()} is the one thing most people get completely wrong?`;
    }

    // Fallback: universal consequence-driven hook
    return `What if one weak hook is the reason viewers leave before your video even starts?`;
  }

  // Default: keep it connected to the actual first line
  const shortTopic = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 6).join(" ");
  return `${capitalizeFirst(shortTopic)} — but the part most people miss changes everything.`;
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getHookRewriteReason(script: string): string {
  const lower = script.toLowerCase();
  const firstLine = script.split(/[\n.!?]/)[0]?.toLowerCase() ?? "";

  if (
    firstLine.startsWith("hey guys") ||
    firstLine.startsWith("welcome") ||
    firstLine.startsWith("in this video") ||
    firstLine.startsWith("today i") ||
    firstLine.startsWith("i will") ||
    firstLine.startsWith("i want to")
  ) {
    return "It removes the slow intro and jumps directly into a question or consequence, giving viewers a faster reason to keep watching.";
  }
  if (lower.includes("most people think") || lower.includes("most creators think")) {
    return "It sharpens the belief reversal in the first line so viewers immediately sense a gap between what they assumed and what they are about to learn.";
  }
  if (lower.includes("what if") || lower.includes("imagine if")) {
    return "It focuses the 'what if' on a personal, concrete consequence so the viewer feels the stakes immediately rather than abstractly.";
  }
  if (lower.includes("disappear") || lower.includes("missing") || lower.includes("crime") || lower.includes("murder")) {
    return "It leads with the moment of tension rather than the setup, so the viewer is pulled into the mystery before they have a chance to scroll.";
  }
  if (lower.includes("brand") || lower.includes("company") || lower.includes("business") || lower.includes("sell")) {
    return "It reframes the opening as a counterintuitive business insight, which creates curiosity about what the real product actually is.";
  }
  if (lower.includes("vs ") || lower.includes("outjump") || lower.includes("better than") || lower.includes("compared to")) {
    return "It opens with the surprising implication of the comparison rather than the setup, giving viewers a clearer reason to stay for the answer.";
  }
  return "It starts with a concrete question or surprising consequence, which creates a curiosity gap that the rest of the script resolves.";
}

// ─── Score helpers ───────────────────────────────────────────────────────────

// ─── Score helpers ───────────────────────────────────────────────────────────

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getOverallLabel(score: number): string {
  if (score >= 85) return "Very Strong";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Average";
  if (score >= 40) return "Needs Work";
  return "Weak";
}

function getHookLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Good";
  if (score >= 45) return "Average";
  return "Weak";
}

function getRiskLabel(score: number): string {
  if (score >= 65) return "High";
  if (score >= 45) return "Medium";
  if (score >= 26) return "Low-Medium";
  return "Low";
}

function getHookColor(score: number): string {
  if (score >= 75) return "#22C55E";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

function getRiskColor(score: number): string {
  if (score >= 65) return "#EF4444";
  if (score >= 45) return "#F59E0B";
  return "#22C55E";
}

function getOverallDescription(score: number, issues: string[]): string {
  // Issue-driven overrides (only for clearly weak scripts)
  if (score < 60 && issues.some(i => i.includes("weak opening") || i.includes("hook needs"))) {
    return "The main weakness is the opening. A stronger first line would improve the whole script.";
  }
  if (issues.some(i => i.includes("too short"))) {
    return "The hook works, but the script needs more development before the payoff feels complete.";
  }
  // Score-based fallback
  if (score >= 85) return "Very strong structure. The hook, pacing, and payoff work well together.";
  if (score >= 75) return "Strong foundation with good pacing. A sharper payoff or more specific detail could push it further.";
  if (score >= 60) return "The script has a clear direction, but the hook, middle, or payoff may still need some work.";
  if (score >= 40) return "Has some useful parts, but needs a stronger hook, clearer stakes, or better payoff.";
  return "The script may lose viewers early. Strengthen the opening and remove slow setup.";
}

function getHookDescription(score: number, issues: string[]): string {
  // Issue-driven overrides — only apply when hook is actually weak
  if (score < 45 && issues.some(i => i.includes("weak opening") || i.includes("hook needs"))) {
    return "The opening feels too slow. Replace it with a question, contrast, or clear result.";
  }
  if (score < 65 && issues.some(i => i.includes("curiosity gap"))) {
    return "The hook is understandable, but it does not create enough curiosity yet.";
  }
  // Score-based fallback
  if (score >= 80) return "Strong opening. It creates curiosity and gives viewers a clear reason to keep watching.";
  if (score >= 65) return "The hook is clear, but it could create a slightly stronger curiosity gap or contrast.";
  if (score >= 45) return "The opening is understandable, but may not stop viewers from scrolling fast enough.";
  return "The first line needs a stronger question, contrast, or promise to earn attention.";
}

function getRiskDescription(score: number, issues: string[]): string {
  // Issue-driven overrides
  if (issues.some(i => i.includes("middle may lose"))) {
    return "The middle may feel flat. Add a new turn or contrast to restart attention.";
  }
  if (issues.some(i => i.includes("no reason to keep"))) {
    return "The script may lose momentum because it does not build enough unanswered curiosity.";
  }
  // Score-based fallback
  if (score >= 65) return "Several moments may cause viewers to leave before the payoff.";
  if (score >= 45) return "Some parts may slow viewers down, especially where the script explains without building tension.";
  if (score >= 26) return "Moderate-low risk. The script mostly works but may have a few weaker moments.";
  return "Low retention risk. The script stays focused and moves clearly toward the payoff.";
}