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
  ArrowLeft,
  Share2,
  ChevronDown,
  ChevronRight,
  Zap,
  Target,
  ShieldCheck,
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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[22px] border border-[#24242A] bg-[#0B0B0F] ${className}`}>
      {children}
    </div>
  );
}

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] border border-[#3A1B22] bg-[#1A0D11] text-[#EF4444]">
      {children}
    </div>
  );
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1
    ? `${count} ${singular}`
    : `${count} ${plural}`;
}

export default function ResultsPage() {
 const [savedScript, setSavedScript] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isHookModalOpen, setIsHookModalOpen] = useState(false);
  const [copiedHook, setCopiedHook] = useState(false);
  const [aiHook, setAiHook] = useState("");
  const [aiHookReason, setAiHookReason] = useState("");
  const [aiHookStatus, setAiHookStatus] = useState("");
  const [aiHookMode, setAiHookMode] = useState<"diagnostic" | "rewrite" | "">("");
  const [isImprovingHook, setIsImprovingHook] = useState(false);
  const [improveError, setImproveError] = useState("");
const [mobileScriptOpen, setMobileScriptOpen] = useState(false);
  const [mobileSceneOpen, setMobileSceneOpen] = useState(false);
  const [mobileFixesOpen, setMobileFixesOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [desktopFeedback, setDesktopFeedback] = useState<"helpful" | "dislike" | null>(null);
  const [desktopSelectedReason, setDesktopSelectedReason] = useState<string | null>(null);
  const [desktopFeedbackSubmitted, setDesktopFeedbackSubmitted] = useState(false);
  const [desktopOtherFeedbackOpen, setDesktopOtherFeedbackOpen] = useState(false);
  const [desktopOtherFeedbackText, setDesktopOtherFeedbackText] = useState("");
  const [mobileFeedback, setMobileFeedback] = useState<"helpful" | "dislike" | null>(null);
  const [mobileSelectedReason, setMobileSelectedReason] = useState<string | null>(null);
  const [mobileFeedbackSubmitted, setMobileFeedbackSubmitted] = useState(false);
  
    useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedScript = sessionStorage.getItem("reelyze-script");
        const storedTitle = sessionStorage.getItem("reelyze-title");

        if (storedScript) {
          setSavedScript(storedScript);
        }

        if (storedTitle) {
          setSavedTitle(storedTitle);
        }

        try {
          localStorage.removeItem("reelyze-script");
        } catch {
          // localStorage not critical — ignore
        }
      } catch {
        setStorageError("Could not load your script. Please go back and try again.");
      } finally {
        setIsStorageLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
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

// A hook should only be presented as "already good" when its score is
// genuinely strong. "hookWasActuallyChanged" alone is not a valid signal —
// a failed/identical AI rewrite would otherwise be mislabeled as "Hook
// Analysis" even when the hook score is weak (e.g. Test 4's score of 46).
const shouldShowHookAnalysis = analysis.hook.score >= 80;

// Replace any rule-based hook rewrite in fixes with the AI hook once loaded,
// so Suggested Fixes and the modal always show the same improved hook.
const displayFixes: string[] = analysis.fixes.map((fix) => {
  if (aiHook && fix.toLowerCase().startsWith("rewrite your hook:")) {
    return `Rewrite your hook: "${aiHook}"`;
  }
  return fix;
});
  
 const improvedHookReason =
  aiHookReason || getHookRewriteReason(activeScript);

const hookCopyButtonLabel =
  aiHookMode === "diagnostic"
    ? "Copy Advice"
    : analysis.hook.score >= 70
    ? "Copy Version"
    : "Copy Hook";

  function handleCopyHook() {
    navigator.clipboard.writeText(improvedHook);
    setCopiedHook(true);

    setTimeout(() => {
      setCopiedHook(false);
    }, 1500);
  }

  async function handleShare() {
    const shareData = {
      title: savedTitle || "Reelyze Script Review",
      text: "Check my Reelyze script review.",
      url: typeof window !== "undefined" ? window.location.href : "",
    };

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
        setShareMessage("Shared.");
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        setShareMessage("Review link copied.");
      }
    } catch {
      // user cancelled share or clipboard write failed — ignore
    }

    setTimeout(() => {
      setShareMessage("");
    }, 2000);
  }

  return (
    <main
      className={`${inter.className} min-h-screen bg-[#050505] text-white antialiased`}
    >
      {/* DESKTOP */}
      <div className="hidden lg:flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 z-30 flex h-screen w-[230px] flex-col border-r border-[#24242A]/60 bg-[#050505]">
          <div className="flex items-center gap-3 px-6 py-7">
            <img src="/logo.png" alt="Reelyze" className="h-9 w-9 object-contain" />
            <span className="text-[15px] font-bold tracking-[0.16em] text-white">REELYZE</span>
          </div>
          <nav className="flex flex-col gap-1.5 px-4">
            <Link href="/results" className="flex h-[46px] items-center gap-3 rounded-[12px] border border-[#3A1B22] bg-[#1A0D11] px-4">
              <SquarePen size={16} className="text-[#EF4444]" />
              <span className="text-[14px] font-semibold text-[#EF4444]">Results</span>
            </Link>
            <Link href="/" className="flex h-[46px] items-center gap-3 rounded-[12px] px-4 transition hover:bg-white/[0.03]">
              <PencilLine size={16} className="text-[#777A85]" />
              <span className="text-[14px] font-medium text-[#777A85]">New Analysis</span>
            </Link>
          </nav>
          <div className="mt-auto px-4 pb-10 pt-8">
            <div className="rounded-[18px] border border-[#24242A]/70 bg-[#0B0B0F] p-5">
              <p className="text-[14px] font-semibold text-white">Rate this analysis</p>
              <p className="mt-1.5 text-[12px] text-[#777A85]">Was this review helpful?</p>
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={() => { setDesktopFeedback("helpful"); setDesktopSelectedReason(null); setDesktopFeedbackSubmitted(false); }}
                  className={["flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border text-[13px] font-medium transition", desktopFeedback === "helpful" ? "border-[#22C55E]/60 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#24242A] text-[#B3B3B3] hover:border-[#22C55E]/40 hover:text-white"].join(" ")}
                >
                  <ThumbsUp size={14} />
                  Helpful
                </button>
                <button
                  onClick={() => { setDesktopFeedback(desktopFeedback === "dislike" ? null : "dislike"); setDesktopSelectedReason(null); setDesktopFeedbackSubmitted(false); }}
                  className={["flex h-[38px] w-[42px] items-center justify-center rounded-[10px] border transition", desktopFeedback === "dislike" ? "border-[#EF4444]/60 bg-[#EF4444]/10 text-[#EF4444]" : "border-[#24242A] text-[#B3B3B3] hover:border-white/20 hover:text-white"].join(" ")}
                >
                  <ThumbsDown size={14} />
                </button>
              </div>

              {desktopFeedback === "helpful" && !desktopFeedbackSubmitted && (
                <div className="mt-3">
                  <p className="text-[11px] text-[#777A85] mb-1.5">What was helpful?</p>
                  <div className="flex flex-col gap-1.5">
                    {["Accurate score", "Useful fixes", "Clear explanation", "Other"].map((reason) => (
                      <button
                        key={reason}
                        onClick={() => {
                          if (reason === "Other") { setDesktopOtherFeedbackOpen(true); return; }
                          setDesktopSelectedReason(reason);
                          setDesktopFeedbackSubmitted(true);
                        }}
                        className={["w-full rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-medium transition", desktopSelectedReason === reason ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#24242A] text-[#777A85] hover:border-[#22C55E]/30 hover:text-[#B3B3B3]"].join(" ")}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {desktopFeedback === "dislike" && !desktopFeedbackSubmitted && (
                <div className="mt-3">
                  <p className="text-[11px] text-[#777A85] mb-1.5">What was wrong?</p>
                  <div className="flex flex-col gap-1.5">
                    {["Wrong score", "Bad suggestions", "Not specific enough", "Other"].map((reason) => (
                      <button
                        key={reason}
                        onClick={() => {
                          if (reason === "Other") { setDesktopOtherFeedbackOpen(true); return; }
                          setDesktopSelectedReason(reason);
                          setDesktopFeedbackSubmitted(true);
                        }}
                        className={["w-full rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-medium transition", desktopSelectedReason === reason ? "border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]" : "border-[#24242A] text-[#777A85] hover:border-[#EF4444]/30 hover:text-[#B3B3B3]"].join(" ")}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {desktopFeedbackSubmitted && (
                <p className="mt-2.5 text-[12px]" style={{ color: desktopFeedback === "helpful" ? "#22C55E" : "#EF4444" }}>
                  {desktopFeedback === "helpful" ? "Thanks — feedback noted." : "Thanks — we'll use this to improve."}
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <section className="min-h-screen w-full pl-[230px]">
          <div className="mx-auto w-full max-w-[1320px] px-9 py-11">

            {/* Header */}
            <div className="mb-7 flex items-start justify-between gap-6">
              <div>
                <h1 className="text-[36px] font-semibold tracking-[-0.02em] text-white">Script Review</h1>
                <p className="mt-1.5 text-[14px] text-[#777A85]">
                  Analyzed just now —{" "}
                  <span className="text-[#B3B3B3]">{savedTitle || "YouTube Shorts Script"}</span>
                </p>
              </div>
              <Link href="/" className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 text-[14px] font-semibold text-white transition hover:border-[#EF4444]/50 hover:bg-[#EF4444]/10">
                <PencilLine size={15} />
                New Analysis
              </Link>
            </div>

            {/* Loading state */}
            {!isStorageLoaded && (
              <Card className="p-8 mb-6">
                <p className="text-[20px] font-semibold text-white">Loading results...</p>
                <p className="mt-3 text-[14px] text-[#777A85]">Please wait while Reelyze checks your latest analysis.</p>
              </Card>
            )}

            {/* Error state */}
            {storageError && (
              <div className="mb-6 rounded-[22px] border border-[#EF4444]/30 bg-[#1A0D11] p-8">
                <p className="text-[15px] text-[#EF4444]">{storageError}</p>
              </div>
            )}

            {/* Empty state */}
            {isStorageLoaded && !storageError && !hasAnalyzedScript && (
              <Card className="p-8 mb-6">
                <h2 className="text-[26px] font-semibold text-white">No script analyzed yet.</h2>
                <p className="mt-4 text-[15px] text-[#777A85]">Go to New Analysis and paste your YouTube Shorts script first. After you click Analyze Script, your results will appear here.</p>
                <Link href="/" className="mt-6 inline-flex h-[48px] items-center justify-center rounded-[12px] bg-[#EF4444] px-6 text-[15px] font-semibold text-white transition hover:bg-[#dc2626]">New Analysis</Link>
              </Card>
            )}

            {/* Results */}
            {isStorageLoaded && !storageError && hasAnalyzedScript && (
              <>
                {/* Score cards */}
                <div className="mb-6 grid grid-cols-3 gap-5">
                  <Card className="p-6">
                    <p className="text-[13px] font-medium text-[#777A85]">Overall Score</p>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-[40px] font-bold leading-none tracking-[-0.03em] text-white">{analysis.overall.score}</span>
                      <span className="text-[14px] text-[#777A85]">/100</span>
                    </div>
                    <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-[#1C1C22]">
                      <div className="h-full rounded-full" style={{ width: `${analysis.overall.score}%`, backgroundColor: analysis.overall.ringColor, boxShadow: `0 0 8px ${analysis.overall.ringColor}55` }} />
                    </div>
                    <p className="mt-3.5 text-[14px] font-semibold" style={{ color: analysis.overall.ringColor }}>{analysis.overall.label}</p>
                    <p className="mt-1 text-[13px] leading-[1.55] text-[#777A85] line-clamp-2">{analysis.overall.description}</p>
                  </Card>
                  <Card className="p-6">
                    <p className="text-[13px] font-medium text-[#777A85]">Hook Score</p>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-[40px] font-bold leading-none tracking-[-0.03em] text-white">{analysis.hook.score}</span>
                      <span className="text-[14px] text-[#777A85]">/100</span>
                    </div>
                    <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-[#1C1C22]">
                      <div className="h-full rounded-full" style={{ width: `${analysis.hook.score}%`, backgroundColor: analysis.hook.color, boxShadow: `0 0 8px ${analysis.hook.color}55` }} />
                    </div>
                    <p className="mt-3.5 text-[14px] font-semibold" style={{ color: analysis.hook.color }}>{analysis.hook.label}</p>
                    <p className="mt-1 text-[13px] leading-[1.55] text-[#777A85] line-clamp-2">{analysis.hook.description}</p>
                  </Card>
                  <Card className="p-6">
                    <p className="text-[13px] font-medium text-[#777A85]">Retention Risk</p>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-[40px] font-bold leading-none tracking-[-0.03em] text-white">{analysis.risk.score}</span>
                      <span className="text-[14px] text-[#777A85]">/100</span>
                    </div>
                    <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-[#1C1C22]">
                      <div className="h-full rounded-full" style={{ width: `${analysis.risk.score}%`, backgroundColor: analysis.risk.color, boxShadow: `0 0 8px ${analysis.risk.color}55` }} />
                    </div>
                    <p className="mt-3.5 text-[14px] font-semibold" style={{ color: analysis.risk.color }}>{analysis.risk.label}</p>
                    <p className="mt-1 text-[13px] leading-[1.55] text-[#777A85] line-clamp-2">{analysis.risk.description}</p>
                  </Card>
                </div>

                {/* Main Takeaway */}
                <div className="mb-6 rounded-[16px] border border-[#3A1B22] bg-[#1A0D11] px-5 py-4 shadow-[0_0_28px_rgba(239,68,68,0.07)]">
                  <div className="flex items-start gap-3">
                    <Target size={16} className="mt-0.5 shrink-0 text-[#EF4444]" />
                    <div>
                      <p className="text-[12.5px] font-semibold text-[#EF4444]">Main Takeaway</p>
                      <p className="mt-1 text-[13px] leading-[1.6] text-[#E8D5D8]">{analysis.overall.description}</p>
                    </div>
                  </div>
                </div>

                {/* Script + right column */}
                <div className="grid grid-cols-[1.35fr_0.9fr] items-start gap-5">
                  {/* Script card */}
                  <Card className="p-6">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <h2 className="text-[17px] font-semibold text-white">Your Script</h2>
                      {savedTitle && (
                        <div className="flex items-center gap-2 rounded-[8px] border border-[#24242A] bg-[#101014] px-3 py-1">
                          <span className="text-[12px] text-[#777A85]">Topic:</span>
                          <span className="text-[12px] font-medium text-white">{savedTitle}</span>
                        </div>
                      )}
                    </div>
                    <div className="max-h-[480px] min-w-0 overflow-y-auto overflow-x-hidden rounded-[16px] border border-[#24242A] bg-[#101014] p-4">
                      <div className="flex flex-col gap-2">
                        {scriptLines.map((line, index) => {
                          const status: LineStatus = analysis.riskyLineIndexes.includes(index) ? "risky" : analysis.warningLineIndexes.includes(index) ? "warning" : "normal";
                          const isRisky = status === "risky";
                          const isWarning = status === "warning";
                          return (
                            <div key={`${lineTimestamps[index] ?? index}-${line}`}
                              className={["grid min-w-0 grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.6]", isRisky ? "border border-[#3A1B22] bg-[#1A0D11]" : isWarning ? "border border-[#FF9A1F]/25 bg-[#FF9A1F]/[0.06]" : "border border-transparent"].join(" ")}
                            >
                              <span className={isRisky ? "text-[#EF4444]" : isWarning ? "text-[#FF9A1F]" : "text-[#777A85]"}>{lineTimestamps[index] ?? formatTime(estimatedDuration)}</span>
                              <span className={`${isRisky ? "text-[#EF4444]" : isWarning ? "text-[#FF9A1F]" : "text-[#B3B3B3]"} min-w-0 break-words [overflow-wrap:anywhere]`}>
  {line}
</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="mt-4 text-[12px] text-[#777A85]">
  {characterCount} / 1000 Characters — ~{formatTime(estimatedDuration)} estimated
</p>
                  </Card>

                  {/* Right column */}
                  <div className="flex flex-col gap-6">
                    {/* Risky Parts */}
                    <Card className="p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-[17px] font-semibold text-white">Risky Parts</h2>
                        <span className="text-[12px] font-medium text-[#777A85]">{pluralize(analysis.riskyParts.length, "found", "found")}</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {analysis.riskyParts.length === 0 ? (
                          <div>
                            <p className="text-[14px] font-medium text-white">{analysis.fixes.length > 0 ? "No major risky parts found." : "No risky parts found."}</p>
                            <p className="mt-1 text-[13px] leading-[1.55] text-[#777A85]">{analysis.fixes.length > 0 ? "The script works overall, but a few areas could still be tightened." : "This script stays focused and does not contain any major drop-off points."}</p>
                          </div>
                        ) : (
                          analysis.riskyParts.map((part) => (
                            <div key={`${part.time}-${part.title}`} className="rounded-[14px] border border-[#24242A] bg-[#101014] p-4">
                              <p className="text-[12px] font-semibold text-[#EF4444]">{part.time}</p>
                              <p className="mt-1.5 text-[14px] font-medium text-white">{part.title}</p>
                              <p className="mt-1 text-[13px] leading-[1.55] text-[#777A85]">{part.description}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>

                    {/* Suggested Fixes */}
                    <Card className="p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-[17px] font-semibold text-white">Suggested Fixes</h2>
                        <span className="text-[12px] font-medium text-[#777A85]">{pluralize(displayFixes.length, "suggestion", "suggestions")}</span>
                      </div>
                      {analysis.fixes.length > 0 && analysis.hook.score < 75 && (
                        <button
                          onClick={async () => {
                            setCopiedHook(false);
                            setImproveError("");
                            setIsImprovingHook(true);
                            setIsHookModalOpen(true);
                            try {
                              const response = await fetch("/api/improve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: activeScript, title: savedTitle }) });
                              if (!response.ok) throw new Error(`Server error: ${response.status}`);
                              const data: { status?: string; improvedHook?: string; reason?: string; mode?: string } = await response.json();
                              const hookText = typeof data.improvedHook === "string" && data.improvedHook.trim().length > 0 ? data.improvedHook.trim() : "AI hook improvement is unavailable right now.";
                              const hookReason = typeof data.reason === "string" && data.reason.trim().length > 0 ? data.reason.trim() : data.status === "good" ? "The hook is already clear, specific, and creates curiosity without needing a rewrite." : "The hook was adjusted to improve clarity, curiosity, or payoff connection.";
                              setAiHook(hookText);
                              setAiHookReason(hookReason);
                              setAiHookStatus(typeof data.status === "string" ? data.status : "improved");
                              setAiHookMode(data.mode === "diagnostic" ? "diagnostic" : "rewrite");
                            } catch {
                              setImproveError("Could not improve hook. Please try again.");
                              setAiHook("AI hook improvement is unavailable right now.");
                              setAiHookReason("Reelyze could not generate a custom explanation.");
                              setAiHookMode("rewrite");
                            } finally {
                              setIsImprovingHook(false);
                            }
                          }}
                          className="mb-5 inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-[#DC2626] px-4 text-[13px] font-semibold text-white shadow-[0_0_32px_rgba(220,38,38,0.30)] transition hover:bg-[#EF4444]"
                        >
                          <ShieldCheck size={15} />
                          {analysis.hook.score >= 70 ? "Refine Script" : "Improve Hook"}
                        </button>
                      )}
                      <div className="flex flex-col gap-3">
                        {displayFixes.length === 0 ? (
                          <div>
                            <p className="text-[14px] font-medium text-white">No fixes needed.</p>
                            <p className="mt-1 text-[13px] leading-[1.55] text-[#777A85]">The script already performs well based on the current analysis.</p>
                          </div>
                        ) : (
                          displayFixes.map((fix, index) => (
                            <div key={`${fix}-${index}`} className="flex items-start gap-3 rounded-[12px] border border-[#24242A] bg-[#101014] px-3 py-3">
                              <IconBox>
                                {index % 3 === 0 ? <AudioLines size={18} /> : index % 3 === 1 ? <Scissors size={18} /> : <FastForward size={18} />}
                              </IconBox>
                              <p className="text-[13px] leading-[1.65] text-[#B3B3B3]">{fix}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Scene Breakdown */}
                <Card className="mt-5 p-6">
                  <h2 className="mb-4 text-[17px] font-semibold text-white">Scene Breakdown</h2>
                  <div className="flex h-[7px] w-full overflow-hidden rounded-full bg-[#1C1C22]">
                    {analysis.sceneSegments.map((segment, index) => {
                      const totalDesktopWidth = 1110;
                      const pct = segment.width / totalDesktopWidth;
                      return (
                        <div key={`${segment.label}-${index}`} className="h-full" style={{ width: `${pct * 100}%`, backgroundColor: segment.color, opacity: 0.88 }} />
                      );
                    })}
                  </div>
                  <div className="mt-3 grid grid-cols-5 text-[11.5px] text-[#555560]">
                    {scaleLabels.map((label, i) => (
                      <p key={label} className={i === 4 ? "text-right" : ""}>{label}</p>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-6">
                    {analysis.sceneSegments.map((segment, index) => (
                      <div key={`${segment.label}-${index}`} className="flex items-center gap-2">
                        <span className="h-[4px] w-[16px] rounded-full" style={{ backgroundColor: segment.color }} />
                        <span className="text-[12px] text-[#777A85]">{segment.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}

          </div>
        </section>
      </div>

      {/* Desktop other feedback modal */}
      {desktopOtherFeedbackOpen && (
        <div className="fixed inset-0 z-50 hidden lg:flex items-center justify-center bg-black/60 backdrop-blur-[3px]">
          <div className="relative w-full max-w-[460px] rounded-[24px] border border-[#24242A] bg-[#0B0B0F] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
            <button onClick={() => setDesktopOtherFeedbackOpen(false)} className="absolute right-5 top-5 text-[20px] text-[#777A85] transition hover:text-white">×</button>
            <h2 className="text-[20px] font-semibold text-white">{desktopFeedback === "helpful" ? "What did you like?" : "What did not work?"}</h2>
            <p className="mt-1.5 text-[13px] text-[#777A85]">Your feedback helps improve Reelyze.</p>
            <textarea
              value={desktopOtherFeedbackText}
              onChange={(e) => setDesktopOtherFeedbackText(e.target.value)}
              placeholder={desktopFeedback === "helpful" ? "Tell us what you liked about this analysis..." : "Tell us what was wrong or missing..."}
              rows={5}
              className="mt-5 w-full resize-none rounded-[12px] border border-[#24242A] bg-[#101014] px-4 py-3 text-[13px] leading-[1.65] text-[#B3B3B3] outline-none placeholder:text-[#555560]"
            />
            <div className="mt-4 flex gap-3">
              <button onClick={() => { setDesktopOtherFeedbackOpen(false); setDesktopOtherFeedbackText(""); setDesktopFeedbackSubmitted(true); }} className="h-[40px] rounded-[10px] bg-[#DC2626] px-5 text-[13px] font-semibold text-white transition hover:bg-[#EF4444]">Submit</button>
              <button onClick={() => setDesktopOtherFeedbackOpen(false)} className="h-[40px] rounded-[10px] border border-[#24242A] bg-[#101014] px-5 text-[13px] font-semibold text-white transition hover:bg-[#17171C]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE */}
      <div className="block lg:hidden bg-[#050505] min-h-screen">
        <div className="mx-auto w-full max-w-[430px] flex flex-col pb-[100px]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-11 pb-4">
            <Link href="/" className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] border border-[#24242A] bg-[#0B0B0F]">
              <ArrowLeft size={17} className="text-[#EF4444]" />
            </Link>
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Reelyze" className="h-7 w-7 object-contain" />
              <span className="text-[14px] font-bold tracking-[0.16em] text-white">REELYZE</span>
            </div>
            <button onClick={handleShare} className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] border border-[#24242A] bg-[#0B0B0F]">
              <Share2 size={17} className="text-[#777A85]" />
            </button>
          </div>

          {shareMessage && (
            <p className="px-5 -mt-1 mb-2 text-[11px] text-[#777A85]">{shareMessage}</p>
          )}

          {/* Title */}
          <div className="px-5 mb-5">
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-white">Script Review</h1>
            <p className="mt-1 text-[12px] text-[#777A85]">
              Analyzed just now — <span className="text-[#B3B3B3]">{savedTitle || "YouTube Shorts Script"}</span>
            </p>
          </div>

          {/* Loading */}
          {!isStorageLoaded && (
            <div className="mx-5 mb-4 rounded-[18px] border border-[#24242A] bg-[#0B0B0F] p-5">
              <p className="text-[15px] font-semibold text-white">Loading results...</p>
              <p className="mt-1.5 text-[13px] text-[#777A85]">Please wait a moment.</p>
            </div>
          )}

          {/* Error */}
          {storageError && (
            <div className="mx-5 mb-4 rounded-[18px] border border-[#EF4444]/30 bg-[#1A0D11] p-5">
              <p className="text-[13px] text-[#EF4444]">{storageError}</p>
            </div>
          )}

          {/* Empty state */}
          {isStorageLoaded && !storageError && !hasAnalyzedScript && (
            <div className="mx-5 mb-4 rounded-[18px] border border-[#24242A] bg-[#0B0B0F] p-6">
              <p className="text-[18px] font-semibold text-white mb-2">No script analyzed yet.</p>
              <p className="text-[13px] leading-[1.6] text-[#777A85] mb-5">Go to New Analysis and paste your script first.</p>
              <Link href="/" className="flex h-[44px] w-full items-center justify-center rounded-[12px] bg-[#DC2626] text-[14px] font-semibold text-white">New Analysis</Link>
            </div>
          )}

          {isStorageLoaded && !storageError && hasAnalyzedScript && (
            <div className="flex flex-col gap-3 px-5">

              {/* Score cards — horizontal row */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: "Overall", score: analysis.overall.score, color: analysis.overall.ringColor, status: analysis.overall.label },
                  { label: "Hook", score: analysis.hook.score, color: analysis.hook.color, status: analysis.hook.label },
                  { label: "Risk", score: analysis.risk.score, color: analysis.risk.color, status: analysis.risk.label },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center justify-center gap-1 rounded-[16px] border border-[#24242A] bg-[#0B0B0F] py-4 px-2">
                    <p className="text-[10px] font-medium text-[#777A85] text-center">{item.label}</p>
                    <span className="text-[32px] font-bold leading-none tracking-[-0.03em] text-white">{item.score}</span>
                    <div className="w-full h-[3px] rounded-full bg-[#1C1C22] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${item.score}%`, backgroundColor: item.color }} />
                    </div>
                    <p className="text-[10px] font-semibold" style={{ color: item.color }}>{item.status}</p>
                  </div>
                ))}
              </div>

              {/* Main Takeaway */}
              <div className="rounded-[18px] border border-[#3A1B22] bg-[#1A0D11] px-4 py-4 shadow-[0_0_24px_rgba(239,68,68,0.07)]">
                <div className="flex items-start gap-3">
                  <Target size={15} className="mt-0.5 shrink-0 text-[#EF4444]" />
                  <div>
                    <p className="text-[11px] font-semibold text-[#EF4444] mb-1">Main Takeaway</p>
                    <p className="text-[13px] leading-[1.6] text-[#E8D5D8]">{analysis.overall.description}</p>
                  </div>
                </div>
                {analysis.fixes.length > 0 && analysis.hook.score < 75 && (
                  <button
                    onClick={async () => {
                      setCopiedHook(false);
                      setImproveError("");
                      setIsImprovingHook(true);
                      setIsHookModalOpen(true);
                      try {
                        const response = await fetch("/api/improve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: activeScript, title: savedTitle }) });
                        if (!response.ok) throw new Error(`Server error: ${response.status}`);
                        const data: { status?: string; improvedHook?: string; reason?: string; mode?: string } = await response.json();
                        const hookText = typeof data.improvedHook === "string" && data.improvedHook.trim().length > 0 ? data.improvedHook.trim() : "AI hook improvement is unavailable right now.";
                        const hookReason = typeof data.reason === "string" && data.reason.trim().length > 0 ? data.reason.trim() : "The hook was adjusted to improve clarity, curiosity, or payoff connection.";
                        setAiHook(hookText);
                        setAiHookReason(hookReason);
                        setAiHookStatus(typeof data.status === "string" ? data.status : "improved");
                        setAiHookMode(data.mode === "diagnostic" ? "diagnostic" : "rewrite");
                      } catch {
                        setImproveError("Could not improve hook. Please try again.");
                        setAiHook("AI hook improvement is unavailable right now.");
                        setAiHookReason("Reelyze could not generate a custom explanation.");
                        setAiHookMode("rewrite");
                      } finally {
                        setIsImprovingHook(false);
                      }
                    }}
                    className="mt-4 w-full h-[44px] inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#DC2626] text-[14px] font-semibold text-white shadow-[0_0_24px_rgba(220,38,38,0.25)] transition hover:bg-[#EF4444]"
                  >
                    <ShieldCheck size={15} />
                    {analysis.hook.score >= 70 ? "Refine Script" : "Improve Hook"}
                  </button>
                )}
              </div>

              {/* Risky Parts */}
              <div className="rounded-[18px] border border-[#24242A] bg-[#0B0B0F] overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <h2 className="text-[15px] font-semibold text-white">Risky Parts</h2>
                  <span className="text-[11px] font-medium text-[#777A85]">{pluralize(analysis.riskyParts.length, "found", "found")}</span>
                </div>
                <div className="px-4 pb-4 flex flex-col gap-2.5">
                  {analysis.riskyParts.length === 0 ? (
                    <div className="rounded-[12px] border border-[#24242A] bg-[#101014] px-4 py-3">
                      <p className="text-[13px] font-medium text-white">{analysis.fixes.length > 0 ? "No major risky parts found." : "No risky parts found."}</p>
                      <p className="mt-1 text-[12px] leading-[1.5] text-[#777A85]">{analysis.fixes.length > 0 ? "The script works overall, but a few areas could still be tightened." : "This script stays focused and does not contain any major drop-off points."}</p>
                    </div>
                  ) : (
                    analysis.riskyParts.map((part) => (
                      <div key={`${part.time}-${part.title}`} className="rounded-[12px] border border-[#24242A] bg-[#101014] p-4">
                        <p className="text-[11px] font-semibold text-[#EF4444]">{part.time}</p>
                        <p className="mt-1 text-[13px] font-medium text-white">{part.title}</p>
                        <p className="mt-0.5 text-[12px] leading-[1.5] text-[#777A85]">{part.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Suggested Fixes */}
              <div className="rounded-[18px] border border-[#24242A] bg-[#0B0B0F] overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <h2 className="text-[15px] font-semibold text-white">Suggested Fixes</h2>
                  <span className="text-[11px] font-medium text-[#777A85]">{pluralize(displayFixes.length, "suggestion", "suggestions")}</span>
                </div>
                <div className="px-4 pb-4 flex flex-col gap-2.5">
                  {displayFixes.length === 0 ? (
                    <div className="rounded-[12px] border border-[#24242A] bg-[#101014] px-4 py-3">
                      <p className="text-[13px] font-medium text-white">No fixes needed.</p>
                      <p className="mt-1 text-[12px] text-[#777A85]">The script already performs well.</p>
                    </div>
                  ) : (
                    (mobileFixesOpen ? displayFixes : displayFixes.slice(0, 3)).map((fix, index) => (
                      <div key={`${fix}-${index}`} className="flex items-start gap-3 rounded-[12px] border border-[#24242A] bg-[#101014] px-3 py-3">
                        <IconBox>
                          {index % 3 === 0 ? <AudioLines size={16} /> : index % 3 === 1 ? <Scissors size={16} /> : <FastForward size={16} />}
                        </IconBox>
                        <p className="flex-1 text-[12px] leading-[1.6] text-[#B3B3B3]">{fix}</p>
                      </div>
                    ))
                  )}
                  {displayFixes.length > 3 && (
                    <button onClick={() => setMobileFixesOpen(!mobileFixesOpen)} className="flex w-full items-center justify-center gap-1.5 pt-1">
                      <span className="text-[12px] font-semibold text-[#777A85]">{mobileFixesOpen ? "Show fewer" : "View all suggestions"}</span>
                      <ChevronRight size={12} className={`text-[#777A85] transition-transform ${mobileFixesOpen ? "rotate-90" : ""}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Your Script — accordion */}
              <div className="rounded-[18px] border border-[#24242A] bg-[#0B0B0F] overflow-hidden">
                <button
                  onClick={() => setMobileScriptOpen(!mobileScriptOpen)}
                  className="flex w-full items-center justify-between px-5 py-4"
                >
                  <h2 className="text-[15px] font-semibold text-white">Your Script</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#777A85]">{characterCount} / 1000 Characters</span>
                    <ChevronDown size={15} className={`text-[#777A85] transition-transform ${mobileScriptOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {mobileScriptOpen && (
                  <div className="px-4 pb-4">
                    {savedTitle && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[11px] text-[#777A85]">Topic:</span>
                        <div className="rounded-[6px] border border-[#24242A] bg-[#101014] px-2.5 py-0.5">
                          <span className="text-[11px] font-medium text-white">{savedTitle}</span>
                        </div>
                      </div>
                    )}
                    <div className="rounded-[12px] border border-[#24242A] bg-[#101014] p-3 max-h-[300px] overflow-y-auto">
                      <div className="flex flex-col gap-1.5">
                        {scriptLines.map((line, index) => {
                          const status: LineStatus = analysis.riskyLineIndexes.includes(index) ? "risky" : analysis.warningLineIndexes.includes(index) ? "warning" : "normal";
                          const isRisky = status === "risky";
                          const isWarning = status === "warning";
                          return (
                            <div key={`${lineTimestamps[index] ?? index}-${line}`}
                              className={["grid grid-cols-[44px_1fr] gap-2.5 rounded-[8px] px-2.5 py-2 text-[12px] leading-[1.55]", isRisky ? "border border-[#3A1B22] bg-[#1A0D11]" : isWarning ? "border border-[#FF9A1F]/20 bg-[#FF9A1F]/[0.05]" : "border border-transparent"].join(" ")}
                            >
                              <span className={isRisky ? "text-[#EF4444]" : isWarning ? "text-[#FF9A1F]" : "text-[#555560]"}>{lineTimestamps[index] ?? formatTime(estimatedDuration)}</span>
                              <span className={isRisky ? "text-[#EF4444]" : isWarning ? "text-[#FF9A1F]" : "text-[#B3B3B3]"}>{line}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-[#555560]">~{formatTime(estimatedDuration)} estimated</p>
                  </div>
                )}
              </div>

              {/* Scene Breakdown — accordion */}
              <div className="rounded-[18px] border border-[#24242A] bg-[#0B0B0F] overflow-hidden">
                <button
                  onClick={() => setMobileSceneOpen(!mobileSceneOpen)}
                  className="flex w-full items-center justify-between px-5 py-4"
                >
                  <h2 className="text-[15px] font-semibold text-white">Scene Breakdown</h2>
                  <ChevronDown size={15} className={`text-[#777A85] transition-transform ${mobileSceneOpen ? "rotate-180" : ""}`} />
                </button>
                {mobileSceneOpen && (
                  <div className="px-4 pb-4">
                    <div className="flex h-[6px] w-full overflow-hidden rounded-full bg-[#1C1C22] mb-3">
                      {analysis.sceneSegments.map((segment, index) => {
                        const pct = segment.width / 1110;
                        return <div key={`${segment.label}-${index}`} className="h-full" style={{ width: `${pct * 100}%`, backgroundColor: segment.color, opacity: 0.9 }} />;
                      })}
                    </div>
                    <div className="grid grid-cols-5 text-[10px] text-[#555560] mb-3">
                      {scaleLabels.map((label, i) => (
                        <p key={label} className={i === 4 ? "text-right" : ""}>{label}</p>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {analysis.sceneSegments.map((segment, index) => (
                        <div key={`${segment.label}-${index}`} className="flex items-center gap-1.5">
                          <span className="h-[3px] w-[14px] rounded-full" style={{ backgroundColor: segment.color }} />
                          <span className="text-[11px] text-[#777A85]">{segment.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rate This Analysis */}
              <div className="rounded-[18px] border border-[#24242A] bg-[#0B0B0F] px-5 py-4">
                <p className="text-[14px] font-semibold text-white">Rate this analysis</p>
                <p className="mt-1 text-[12px] text-[#777A85]">Was this review helpful?</p>
                <div className="mt-3 flex gap-2.5">
                  <button
                    onClick={() => { setMobileFeedback("helpful"); setMobileSelectedReason(null); setMobileFeedbackSubmitted(false); }}
                    className={["flex h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border text-[13px] font-semibold transition", mobileFeedback === "helpful" ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#24242A] bg-[#101014] text-[#B3B3B3]"].join(" ")}
                  >
                    <ThumbsUp size={13} />
                    Helpful
                  </button>
                  <button
                    onClick={() => { setMobileFeedback(mobileFeedback === "dislike" ? null : "dislike"); setMobileSelectedReason(null); setMobileFeedbackSubmitted(false); }}
                    className={["flex h-[40px] w-[48px] items-center justify-center rounded-[10px] border transition", mobileFeedback === "dislike" ? "border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]" : "border-[#24242A] bg-[#101014] text-[#777A85]"].join(" ")}
                  >
                    <ThumbsDown size={14} />
                  </button>
                </div>

                {mobileFeedback === "helpful" && !mobileFeedbackSubmitted && (
                  <div className="mt-3">
                    <p className="text-[11px] text-[#777A85] mb-1.5">What was helpful?</p>
                    <div className="flex flex-col gap-1.5">
                      {["Accurate score", "Useful fixes", "Clear explanation", "Other"].map((reason) => (
                        <button
                          key={reason}
                          onClick={() => {
                            if (reason === "Other") { setIsFeedbackOpen(true); return; }
                            setMobileSelectedReason(reason);
                            setMobileFeedbackSubmitted(true);
                          }}
                          className={["w-full rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-medium transition", mobileSelectedReason === reason ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#24242A] bg-[#101014] text-[#777A85] hover:border-[#22C55E]/30 hover:text-[#B3B3B3]"].join(" ")}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mobileFeedback === "dislike" && !mobileFeedbackSubmitted && (
                  <div className="mt-3">
                    <p className="text-[11px] text-[#777A85] mb-1.5">What was wrong?</p>
                    <div className="flex flex-col gap-1.5">
                      {["Wrong score", "Bad suggestions", "Not specific enough", "Other"].map((reason) => (
                        <button
                          key={reason}
                          onClick={() => {
                            if (reason === "Other") { setIsFeedbackOpen(true); return; }
                            setMobileSelectedReason(reason);
                            setMobileFeedbackSubmitted(true);
                          }}
                          className={["w-full rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-medium transition", mobileSelectedReason === reason ? "border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]" : "border-[#24242A] bg-[#101014] text-[#777A85] hover:border-[#EF4444]/30 hover:text-[#B3B3B3]"].join(" ")}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mobileFeedbackSubmitted && (
                  <p className="mt-2 text-[12px]" style={{ color: mobileFeedback === "helpful" ? "#22C55E" : "#EF4444" }}>
                    {mobileFeedback === "helpful" ? "Thanks — feedback noted." : "Thanks — we'll use this to improve."}
                  </p>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 z-50 h-[76px] border-t border-[#24242A] bg-[#050505]/95 backdrop-blur-[8px]">
          <div className="mx-auto flex h-full w-full max-w-[430px] items-center justify-between px-5">
            <Link href="/" className="flex h-[40px] items-center justify-center gap-2 rounded-[12px] border border-[#24242A] bg-[#0B0B0F] px-5 text-[13px] font-semibold text-white">
              <PencilLine size={14} className="text-[#777A85]" />
              New analysis
            </Link>
            <Link href="/results" className="flex h-[40px] items-center justify-center gap-2 rounded-[12px] border border-[#3A1B22] bg-[#1A0D11] px-5 text-[13px] font-semibold text-[#EF4444]">
              <SquarePen size={13} />
              Results
            </Link>
          </div>
        </div>

      </div>

            {isFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-[2px]">
          <div className="relative w-full max-w-[360px] rounded-[22px] border border-[#24242A] bg-[#0B0B0F] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.70)]">
            <button
              onClick={() => setIsFeedbackOpen(false)}
              className="absolute right-4 top-4 text-[22px] font-normal leading-none text-[#B3B3B3] transition hover:text-white"
            >
              ×
            </button>

            <h2 className="pr-8 text-[22px] font-semibold leading-[28px] tracking-[-0.03em] text-white">
  {mobileFeedback === "helpful" ? "What did you like?" : "What was wrong?"}
</h2>

            <p className="mt-2 text-[13px] font-normal leading-[21px] text-[#B3B3B3]">
  {mobileFeedback === "helpful"
    ? "Tell us what felt useful, accurate, or helpful in this analysis."
    : "Tell us what felt inaccurate, confusing, or not useful in this analysis."}
</p>

            <textarea
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder={
  mobileFeedback === "helpful"
    ? "Tell us what you liked..."
    : "Write your feedback here..."
}
              rows={4}
              className="mt-4 w-full resize-none rounded-[14px] border border-[#24242A] bg-[#101014] px-3.5 py-3 text-[13px] font-normal leading-[20px] text-white outline-none placeholder:text-[#777A85] focus:border-[#3A1B22]"
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setIsFeedbackOpen(false);
                  setFeedbackText("");
                  setMobileSelectedReason("Other");
setMobileFeedbackSubmitted(true);
setFeedbackMessage(
  mobileFeedback === "helpful"
    ? "Thanks — feedback noted."
    : "Thanks — we will improve Reelyze."
);
                }}
                className="h-[44px] rounded-[12px] bg-[#DC2626] text-[13px] font-semibold text-white transition hover:bg-[#EF4444]"
              >
                Send feedback
              </button>

              <button
                onClick={() => setIsFeedbackOpen(false)}
                className="h-[44px] rounded-[12px] border border-[#24242A] bg-[#101014] text-[13px] font-semibold text-white transition hover:bg-[#17171C]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isHookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] px-[16px]">
          {/* Desktop modal */}
          <div className="relative hidden lg:block h-[410px] w-[560px] rounded-[20px] border border-[#24242A] bg-[#0B0C10]">
            <button
              onClick={() => setIsHookModalOpen(false)}
              className="absolute right-[20px] top-[18px] text-[22px] font-normal leading-[24px] text-[#B3B3B3] transition hover:text-white"
            >
              x
            </button>

            <h2 className="absolute left-[30px] top-[30px] text-[22px] font-semibold leading-[24px] text-white">
              {aiHookMode === "diagnostic"
                ? "Needs More Specific Material"
                : shouldShowHookAnalysis
                ? "Hook Analysis"
                : analysis.hook.score >= 70
                ? "Refine Script"
                : "Improved Hook"}
            </h2>

            <p className="absolute left-[30px] top-[65px] w-[430px] text-[14px] font-normal leading-[22px] text-[#B3B3B3]">
              {aiHookMode === "diagnostic"
                ? "This script is too broad to rewrite into a stronger hook without inventing ideas."
                : shouldShowHookAnalysis
                ? "This opening already creates a clear reason to keep watching."
                : analysis.hook.score >= 70
                ? "The hook is working. This refinement focuses on making the opening or payoff land stronger."
                : "Use this version to make the opening clearer, stronger, and more curiosity-driven."}
            </p>

            <div className="absolute left-[30px] top-[115px] h-[86px] w-[460px] rounded-[14px] border border-[#24242A] bg-[#0B1018] px-[16px] py-[14px]">
              <p className="text-[15px] font-normal leading-[22px] text-white">
                &ldquo;{isImprovingHook ? "Improving hook..." : improvedHook}&rdquo;
              </p>
            </div>

            <div className="absolute left-[30px] top-[220px] w-[500px] max-h-[115px] overflow-hidden">
              {improveError ? (
                <p className="mt-[6px] text-[13px] font-normal leading-[20px] text-[#EF4444]">
                  {improveError}
                </p>
              ) : (
                <>
                  <p className="mt-[6px] text-[14px] font-normal leading-[21px] text-[#B3B3B3] break-words whitespace-normal">
                    {aiHookMode === "diagnostic"
                      ? "Why no hook was generated:"
                      : shouldShowHookAnalysis
                      ? "Why this hook works:"
                      : analysis.hook.score >= 70
                      ? "What this version improves:"
                      : "Why it is better:"}
                  </p>
                  <p className="mt-[6px] text-[14px] font-normal leading-[21px] text-[#B3B3B3] break-words whitespace-normal">
                    {isImprovingHook
                      ? "Reelyze is rewriting the opening based on your script."
                      : improvedHookReason}
                  </p>
                </>
              )}
            </div>

            <button
              onClick={handleCopyHook}
              className="absolute left-[30px] top-[360px] h-[40px] w-[130px] rounded-[12px] border border-[#24242A] bg-[#EF4444] text-[14px] font-semibold leading-[24px] text-white transition hover:bg-[#dc2626]"
            >
              {copiedHook ? "Copied!" : hookCopyButtonLabel}
            </button>

            <button
              onClick={() => setIsHookModalOpen(false)}
              className="absolute left-[175px] top-[360px] h-[40px] w-[100px] rounded-[12px] border border-[#24242A] bg-[#111217] text-[14px] font-semibold leading-[24px] text-white transition hover:bg-[#1A0608]"
            >
              Close
            </button>
          </div>

          {/* Mobile modal */}
          <div className="relative flex flex-col lg:hidden w-full max-w-[360px] rounded-[18px] border border-[#24242A] bg-[#0B0C10] p-[22px]">
            <button
              onClick={() => setIsHookModalOpen(false)}
              className="absolute right-[16px] top-[14px] text-[20px] font-normal text-[#B3B3B3] focus:outline-none focus:ring-0"
            >
              x
            </button>

            <h2 className="text-[18px] font-semibold leading-[24px] text-white mb-[8px] pr-[24px]">
              {aiHookMode === "diagnostic"
                ? "Needs More Specific Material"
                : shouldShowHookAnalysis
                ? "Hook Analysis"
                : analysis.hook.score >= 70
                ? "Refine Script"
                : "Improved Hook"}
            </h2>

            <p className="text-[12px] font-normal leading-[20px] text-[#B3B3B3] mb-[14px]">
              {aiHookMode === "diagnostic"
                ? "This script is too broad to rewrite into a stronger hook without inventing ideas."
                : shouldShowHookAnalysis
                ? "This opening already creates a clear reason to keep watching."
                : analysis.hook.score >= 70
                ? "The hook is working. This refinement focuses on making the opening or payoff land stronger."
                : "Use this version to make the opening clearer, stronger, and more curiosity-driven."}
            </p>

            <div className="w-full rounded-[12px] border border-[#24242A] bg-[#0B1018] px-[14px] py-[12px] mb-[14px]">
              <p className="text-[13px] font-normal leading-[21px] text-white break-words">
                &ldquo;{isImprovingHook ? "Improving hook..." : improvedHook}&rdquo;
              </p>
            </div>

            {improveError ? (
              <p className="text-[12px] font-normal leading-[18px] text-[#EF4444] mb-[16px]">
                {improveError}
              </p>
            ) : (
              <div className="mb-[16px]">
                <p className="text-[12px] font-normal leading-[18px] text-[#B3B3B3]">
                  {aiHookMode === "diagnostic"
                    ? "Why no hook was generated:"
                    : shouldShowHookAnalysis
                    ? "Why this hook works:"
                    : analysis.hook.score >= 70
                    ? "What this version improves:"
                    : "Why it is better:"}
                </p>
                <p className="text-[12px] font-normal leading-[18px] text-[#B3B3B3] mt-[4px] break-words">
                  {isImprovingHook
                    ? "Reelyze is rewriting the opening based on your script."
                    : improvedHookReason}
                </p>
              </div>
            )}

            <div className="flex gap-[10px]">
              <button
                onClick={handleCopyHook}
                className="flex-1 h-[40px] rounded-[12px] border border-[#24242A] bg-[#EF4444] text-[13px] font-semibold text-white focus:outline-none focus:ring-0"
              >
                {copiedHook ? "Copied!" : hookCopyButtonLabel}
              </button>
              <button
                onClick={() => setIsHookModalOpen(false)}
                className="flex-1 h-[40px] rounded-[12px] border border-[#24242A] bg-[#111217] text-[13px] font-semibold text-white focus:outline-none focus:ring-0"
              >
                Close
              </button>
            </div>
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

function MiniRing({ score, color }: { score: number; color: string }) {
  const safeScore = Math.max(0, Math.min(100, score));
  const gapDegrees = (100 - safeScore) * 3.6;
  const scoreDegrees = safeScore * 3.6;
  const startAngle = 180 + gapDegrees / 2;

  return (
    <div className="relative h-[54px] w-[54px] shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from ${startAngle}deg, ${color} 0deg ${scoreDegrees}deg, #252832 ${scoreDegrees}deg 360deg)`,
        }}
      />

      <div className="absolute left-[5px] top-[5px] h-[44px] w-[44px] rounded-full bg-[#0B0C10]" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0">
        <p className="text-[18px] font-semibold leading-[20px] text-white">
          {safeScore}
        </p>
        <p className="text-[9px] font-normal leading-[11px] text-[#B3B3B3]">
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

// ─── Opening window analysis ────────────────────────────────────────────────
// The "opening window" is the first 1–2 sentences (or ~35 words).
// Many strong Shorts hooks work as a two-line unit:
//   Line 1: simple setup
//   Line 2: contrast / reveal / concrete image / consequence
// We must not judge only line 1 in isolation.

interface OpeningWindowSignals {
  // True if the window contains a structural reveal after a setup
  hasSetupReveal: boolean;
  // True if the window contains a concrete size/scale/measurement comparison
  hasConcreteComparison: boolean;
  // True if the window contains a causal connector leading to a consequence
  hasCausalConsequence: boolean;
  // True if window has a specific number with a unit
  hasNumericDetail: boolean;
  // True if window has a scenario opener (imagine / what if)
  hasScenarioOpener: boolean;
  // True if window scenario has any stakes / consequence / mystery
  scenarioHasStakes: boolean;
  // Structural strength 0–100 of the two-line opening
  windowStrength: number;
}

function extractOpeningWindow(scriptLines: string[]): string {
  // Take the first 2 lines, capped at ~35 words total
  const candidates = scriptLines.slice(0, 2);
  const joined = candidates.join(" ").trim();
  const words = joined.split(/\s+/).filter(Boolean);
  return words.slice(0, 35).join(" ");
}

function scoreOpeningWindow(openingWindow: string): OpeningWindowSignals {
  const lower = openingWindow.toLowerCase();

  // ── Concrete comparison (scale/size/distance/quantity) ──────────────────
  // Universal: any sentence that creates a visual by comparing scale.
  // Detected by structural patterns: "would disappear", "could fit",
  // "so [adj] that", "[subject] would [action]", etc.
  const hasConcreteComparison =
    /\bcould (disappear|fit|vanish|be buried|be swallowed|be hidden|be submerged)\b/i.test(openingWindow) ||
    /\bwould (disappear|fit|vanish|be hidden|still have|be buried)\b/i.test(openingWindow) ||
    /\bso (deep|tall|fast|slow|large|small|heavy|wide|far|long|short|hot|cold|dense|strong|weak)\b.{2,40}\bthat\b/i.test(openingWindow) ||
    /\b(more than|over|above|below|under|nearly|almost) (a mile|a kilometer|a foot|a meter|a year|a century|a billion|a million|a thousand)\b/i.test(openingWindow) ||
    /\b\w+ would (jump|reach|travel|move|fall|rise|grow|cover|span|stretch|sink)\b/i.test(openingWindow);

  // ── Causal consequence (something causes or reveals something else) ──────
  // Universal: "but [something unexpected]", "and it [verb consequence]"
  const hasCausalConsequence =
    /\b(but|however|yet)\b.{3,60}\b(would|could|can|will|does|is|was|disappeared|vanished|killed|destroyed|changed)\b/i.test(openingWindow) ||
    /\bif .{3,40}, (it|they|everything|the|your|that)\b/i.test(openingWindow) ||
    /\b(what happens|what would happen|the result|as a result|which means)\b/i.test(openingWindow);

  // ── Setup + reveal structure (line 1 = calm/normal, line 2 = contrast) ──
  // Universal: the window starts with an observation then contradicts it.
  const hasSetupReveal =
    (hasCausalConsequence || hasConcreteComparison) &&
    (lower.includes("but") || lower.includes("however") || lower.includes("yet") ||
     lower.includes("if ") || lower.includes("would") || lower.includes("could"));

  // ── Numeric detail ───────────────────────────────────────────────────────
  const hasNumericDetail =
    /\d/.test(openingWindow) &&
    /\b(percent|%|mile|foot|feet|meter|second|minute|hour|day|year|degree|kg|km|mph|kph|billion|million|thousand|\$)\b/i.test(lower);

  // ── Scenario opener ──────────────────────────────────────────────────────
  const hasScenarioOpener =
    /^(imagine|what if|picture this)\b/i.test(lower);

  // ── Scenario stakes: does the scenario have consequence/mystery? ─────────
  // A scenario opener alone is weak. It needs something to care about.
  const scenarioHasStakes =
    hasScenarioOpener && (
      hasCausalConsequence ||
      hasConcreteComparison ||
      hasNumericDetail ||
      // specific unresolved consequence or mystery after scenario
      /\b(terrifying|strange|impossible|wrong|wrong|dark|silent|gone|dead|broken|failed|changed|disappeared|nobody|no one|lost|destroyed)\b/i.test(lower)
    );

  // ── Window strength score ────────────────────────────────────────────────
  let windowStrength = 0;
  if (hasConcreteComparison) windowStrength += 30;
  if (hasCausalConsequence) windowStrength += 25;
  if (hasSetupReveal) windowStrength += 20;
  if (hasNumericDetail) windowStrength += 20;
  if (hasScenarioOpener && scenarioHasStakes) windowStrength += 15;
  else if (hasScenarioOpener && !scenarioHasStakes) windowStrength += 5;
  windowStrength = Math.min(windowStrength, 100);

  return {
    hasSetupReveal,
    hasConcreteComparison,
    hasCausalConsequence,
    hasNumericDetail,
    hasScenarioOpener,
    scenarioHasStakes,
    windowStrength,
  };
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
  genericPenalty: number;
}

// ─── Universal structure detection ──────────────────────────────────────────

interface ScriptStructures {
  hasListBuildup: boolean;
  hasMysteryClueBuildup: boolean;
  hasContradictionReversal: boolean;
  hasConsequencePayoff: boolean;
  hasStrongPayoffLate: boolean;
  hasNumericPremise: boolean;
  hasFillerIntro: boolean;
  hasExplanationChain: boolean;     // premise → mechanism → consequence → payoff
  hasWeakPayoff: boolean;           // script ends with no new consequence or vague summary
  hasNarrativeArc: boolean;
  narrativeArcIsEarly: boolean;
  hasPersistenceArc: boolean;
  hasCapabilityViolation: boolean;
  hasAnomalySequence: boolean;
  hasConsequenceProgression: boolean;
  escalationQuality: "list" | "mystery" | "reversal" | "explanation" | "flat" | "none";
}

function extractUniversalSignals(text: string): UniversalSignals {
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // ── Curiosity score ────────────────────────────────────────────────────────
  let curiosityScore = 0;
  const curiosityPhrases = [
    "what if", "did you know", "have you ever", "what really",
    "the real reason", "nobody knows", "no one knows",
    "still a mystery", "unsolved", "turns out", "the truth about",
    "most people don't", "most people do not", "disappeared", "vanished",
    "secret", "hidden", "what no one", "but the real",
  ];
  for (const p of curiosityPhrases) {
    if (lower.includes(p)) curiosityScore += 14;
  }
  if (text.includes("?")) curiosityScore += 10;
  curiosityScore = Math.min(curiosityScore, 100);

  // ── Contrast score ─────────────────────────────────────────────────────────
  let contrastScore = 0;
  const contrastPhrases = [
    " but ", "however", "not what", "most creators think",
    "most people think", "everyone thinks", "you probably think",
    "the problem is", "the real problem", "actually", "in reality",
    "it is not", "it's not", "not really", "does not", "doesn't",
    "at first", "turns out", "instead",
  ];
  for (const p of contrastPhrases) {
    if (lower.includes(p)) contrastScore += 12;
  }
  contrastScore = Math.min(contrastScore, 100);

  // ── Stakes score ───────────────────────────────────────────────────────────
  let stakesScore = 0;
  const stakesPhrases = [
    "lost", "destroyed", "cost", "danger", "changed", "forever",
    "collapse", "killed", "losing", "darker", "disappeared", "vanished",
    "impossible", "risk", "fail", "failure", "ruined", "dead", "died",
    "never recovered", "permanent", "consequences", "price",
  ];
  for (const p of stakesPhrases) {
    if (lower.includes(p)) stakesScore += 10;
  }
  // Emotional story stakes — human relationship + transformation signals
  const emotionalStakePhrases = [
    "cried", "crying", "tears", "sobbed", "broke down",
    "struggled", "starving", "hungry", "hardship", "poor",
    "never forgot", "changed her life", "changed his life", "changed their life",
    "years later", "after becoming", "kindness", "helped him", "helped her",
    "believed in him", "believed in her",
  ];
  for (const p of emotionalStakePhrases) {
    if (lower.includes(p)) stakesScore += 8;
  }
  stakesScore = Math.min(stakesScore, 100);

  // ── Specificity score ──────────────────────────────────────────────────────
  let specificityScore = 0;
  // Numbers
  const numberMatches = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  specificityScore += Math.min(numberMatches.length * 10, 30);
  // Units
  if (/\b(inch(?:es)?|feet|miles|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|kilograms|pounds|degrees|billion|million|thousand)\b/i.test(text)) {
    specificityScore += 20;
  }
  // Named entities
  if (/\b[A-Z][a-z]{2,}\b/.test(text)) specificityScore += 10;
  // Dollar amounts
  if (/\$\d/.test(text)) specificityScore += 15;
  specificityScore = Math.min(specificityScore, 100);

  // ── Open loop score ────────────────────────────────────────────────────────
  let openLoopScore = 0;
  const openLoopPhrases = [
    "but why", "the reason", "here is why", "here's why",
    "and that is", "and that's", "which means", "that means",
    "so what", "the question is", "the answer", "find out",
    "keep watching", "stay until", "before i explain",
  ];
  for (const p of openLoopPhrases) {
    if (lower.includes(p)) openLoopScore += 15;
  }
  if (text.includes("?")) openLoopScore += 10;
  openLoopScore = Math.min(openLoopScore, 100);

  // ── Payoff score ───────────────────────────────────────────────────────────
  let payoffScore = 0;
  const payoffPhrases = [
    "that is why", "that's why", "the result", "changed everything",
    "changed history", "never recovered", "to this day", "years later",
    "the aftermath", "what followed", "that decision", "it worked",
    "it failed", "turns out", "the answer", "the reason was",
    "it turned out", "turned out", "the truth was",
  ];
  for (const p of payoffPhrases) {
    if (lower.includes(p)) payoffScore += 14;
  }
  payoffScore = Math.min(payoffScore, 100);

  // ── Clarity score ──────────────────────────────────────────────────────────
  // Simple proxy: shorter sentences = clearer. Penalize very long word runs.
  let clarityScore = 60;
  if (wordCount > 0 && wordCount <= 80) clarityScore += 20;
  else if (wordCount > 120) clarityScore -= 15;
  const avgWordLength = text.replace(/\s+/g, "").length / Math.max(wordCount, 1);
  if (avgWordLength > 7) clarityScore -= 10;
  clarityScore = Math.min(Math.max(clarityScore, 0), 100);

  // ── Escalation score ───────────────────────────────────────────────────────
  let escalationScore = 0;
  const escalationPhrases = [
    "now imagine", "but then", "and then", "suddenly", "until",
    "and that is when", "then they found", "something was off",
    "one detail", "except", "but it gets", "it gets worse",
    "what followed", "and it gets",
  ];
  for (const p of escalationPhrases) {
    if (lower.includes(p)) escalationScore += 16;
  }
  escalationScore = Math.min(escalationScore, 100);

  // ── Consequence score ──────────────────────────────────────────────────────
  // Universal consequence signals — behavioral, causal, identity, or temporal outcomes.
  // No topic-specific phrases (no "brain", "online", "symbol", "shapes the next").
  let consequenceScore = 0;
  const consequencePhrases = [
    // behavioral outcome (universal)
    "trains your", "training your", "rewires", "builds the habit",
    // control / permanence (universal)
    "you do not control", "you lose control", "become permanent", "once it becomes",
    // continuation / unstoppable force (universal — any subject)
    "keeps going", "keeps moving", "keeps building", "keeps compounding",
    // causal wrap-up (universal)
    "that is why", "that is what makes", "that is what changes",
    // identity / social consequence (universal)
    "says about you", "says something about", "how people see", "proof that you",
    "what you become", "version of you",
    // temporal consequence (universal)
    "by the time", "too late", "before it starts", "shapes what comes next",
    // mechanism outcome (universal)
    "change how", "changes how", "changes what", "changes who",
    // stakes / loss (universal)
    "one moment can", "one decision can", "cost you",
  ];
  for (const p of consequencePhrases) {
    if (lower.includes(p)) consequenceScore += 14;
  }
  consequenceScore = Math.min(consequenceScore, 100);

  // ── Generic penalty — structural, not vocabulary-based ───────────────────
  // Instead of matching a phrase list, we score each sentence structurally:
  // abstract lines (broad claims, no grounding) raise the penalty,
  // concrete lines (numbers, events, causal structure) lower it.
  // This generalizes to any topic without needing to add new phrases.
  let genericPenalty = 0;

  const scriptSentences = text
    .split(/[.!?]/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).filter(Boolean).length >= 3);

  if (scriptSentences.length >= 2) {
    let abstractCount = 0;
    let concreteCount = 0;

    for (const sentence of scriptSentences) {
      const sl = sentence.toLowerCase();
      const sw = sl.split(/\s+/).filter(Boolean);

      // ── Concrete signals (structural, not vocabulary) ────────────────────
      const sentHasNumber = /\d/.test(sentence);
      const sentHasUnit = /\b(percent|%|mile|foot|feet|meter|second|minute|hour|day|week|year|degree|kg|km|mph|kph|billion|million|thousand|dollar|\$)\b/i.test(sl);
      const sentHasMidCapital = /[a-z,]\s+[A-Z][a-z]{2,}/.test(sentence);
      // Past-tense morphology: regular -ed verbs OR irregular past tense (closed class)
      const sentHasEvent =
        /\b\w+ed\b/.test(sl) ||
        /\b(found|lost|went|came|got|gave|took|made|saw|ran|fell|grew|flew|broke|drove|woke|won|built|caught|said|sent|spoke|stood|wrote|heard|kept|knew|left|met|paid|read|told|threw|thought)\b/i.test(sl);
      // Causal connectors (small, universal, grammar-level)
      const sentHasCausal = /\b(because|therefore|as a result|which means|that means|which caused|led to|resulted in|due to|consequently)\b/i.test(sl);
      // Contrast connectors (small, universal)
      const sentHasContrast = /\b(but|however|instead|yet|although|though|while|whereas|despite|even though)\b/i.test(sl);

      const isConcrete = sentHasNumber || sentHasUnit || sentHasMidCapital || sentHasEvent || sentHasCausal;

      // ── Abstract signals (structural patterns, not topic vocabulary) ─────
      // "X is [evaluative adjective]" with no grounding
      const isAbstractClaim =
        /^[a-z\s]+ (is|are|was|were) (very |extremely |really |so |quite )?(important|key|essential|crucial|critical|necessary|needed|useful|possible|impossible|hard|easy|powerful|valuable|effective|amazing|real|true|good|bad|great|terrible|wrong|right|different|better|worse|best|worst|enough)\.?$/i.test(sl);

      // Broad universal generalization with no example
      const isGeneralization =
        /^(many|most|all|everyone|everybody|people|nobody|no one|anyone|we|they|you) (want|need|think|believe|know|feel|can|should|must|have to|will|do|are|were|is|was)\b/i.test(sl) &&
        !isConcrete;

      // Generic imperative advice
      const isGenericAdvice =
        /^(you|we) (should|must|need to|have to|can|could|try to|want to) [a-z]/i.test(sl) &&
        !isConcrete;

      // Very short with no grounding (motivational fragment).
      // Exception: short parallel fragments that follow a scenario/scene-setting opener
      // (e.g. "No cars. No planes.") — these are cinematic buildup, not generic filler.
      // Detect: line starts with "no ", "not ", or a negation that describes a scene.
      const isCinematicNegation = /^(no |not a |not one |without |no one |nobody )/i.test(sl);
      const isShortFragment = sw.length <= 6 && !isConcrete && !sentHasContrast && !isCinematicNegation;

      const isAbstract = !isConcrete && (isAbstractClaim || isGeneralization || isGenericAdvice || isShortFragment);

      // Cinematic negation lines ("No cars.", "No planes.") are scene-builders,
      // not generic filler — count them as concrete to prevent false generic penalty.
      if (isConcrete || isCinematicNegation) concreteCount++;
      else if (isAbstract) abstractCount++;
    }

    const totalSentences = scriptSentences.length;
    const abstractRatio = abstractCount / totalSentences;
    const concreteRatio = concreteCount / totalSentences;

    // Scale penalty by how abstract the script is relative to how concrete it is
    if (concreteCount === 0 && abstractRatio >= 0.7) {
      genericPenalty = 55; // fully abstract, no grounding at all
    } else if (concreteCount === 0 && abstractRatio >= 0.5) {
      genericPenalty = 42;
    } else if (concreteRatio < 0.15 && abstractRatio >= 0.6) {
      genericPenalty = 35;
    } else if (concreteRatio < 0.25 && abstractRatio >= 0.5) {
      genericPenalty = 22;
    } else if (concreteRatio >= 0.3) {
      genericPenalty = 0; // script has real grounding — no penalty
    }

    // Reduce if strong contrast or specificity is already detected
    if (specificityScore >= 30) genericPenalty = Math.max(0, genericPenalty - 15);
    else if (specificityScore >= 15) genericPenalty = Math.max(0, genericPenalty - 8);
    if (contrastScore >= 30) genericPenalty = Math.max(0, genericPenalty - 10);
  }

  genericPenalty = Math.min(genericPenalty, 65);

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
    genericPenalty,
  };
}



function detectPersistenceArc(lines: string[]): { has: boolean; strong: boolean } {
  const text = lines.join(" ");
  const lower = text.toLowerCase();

  const hasDurationOrRepetition =
    /\d+\s*(years?|months?|weeks?|days?|hours?)\b/i.test(text) ||
    new RegExp(`\\b${SPELLED_OUT_NUMBERS}\\b\\s+(years?|months?|weeks?|days?|hours?)\\b`, "i").test(text) ||
    /\b(every day|each day|every morning|every night|every year|day after day|night after night|week after week|month after month|year after year|time after time|again and again|over and over)\b/i.test(lower);

  const hasResistance =
    /\b(tried to (stop|move|remove|change|take|force)|attempted to (stop|move|remove)|forced (it|him|her|them) (away|out|to leave)|kept (trying to|attempting to))\b/i.test(lower);

  const hasContinuation =
    /\b(kept (coming|returning|going|waiting|sitting|showing up)|continued to|never stopped|would not leave|refused to (leave|move|go)|never left|always (came|returned)( back)?|came back|returned again|went back|showed up again|remained there|stayed there|still (came|returned|waited|sat|stood|remained|stayed|showed up))\b/i.test(lower);

  const has = hasDurationOrRepetition && hasContinuation;
  const strong = has && hasResistance;
  return { has, strong };
}

function detectCapabilityViolation(lines: string[]): { has: boolean; strong: boolean } {
  const text = lines.join(" ");
  const lower = text.toLowerCase();

  const inabilityPattern =
    /\b(had never|has never|never (learned|trained|studied|practiced|spoken|performed|could|been able)|could not|couldn'?t|should not be able|wasn'?t supposed to|was not supposed to|was unable to|had no way to|did not know how to|didn'?t know how to|only (spoke|knew|used|could))\b/i;

  const abilityPattern =
    /\b(speaking|speak|spoke|answered|reading|read|writing|write|wrote|playing|play|played|performing|perform|performed|walking|walk|walked|running|run|ran|moving|move|moved|using|use|used|understanding|understand|understood|recognizing|recognize|recognized|solving|solve|solved|remembering|remember|remembered|managed to|was able to)\b/i;

  const hasInability = inabilityPattern.test(lower);
  const hasAbilityEvent = abilityPattern.test(lower);

  // Direct contradiction inside one sentence:
  // "speaking a language he had never learned"
  const hasDirectViolation = lines.some((line) => {
    const lineLower = line.toLowerCase();

    return (
      inabilityPattern.test(lineLower) &&
      abilityPattern.test(lineLower)
    );
  });

  // Contradiction spread across separate lines:
  // inability/setup first, unexpected ability later
  const hasContrastAbility = lines.some((line, index) => {
    if (index === 0) return false;

    const lineLower = line.toLowerCase();

    const hasContrastLead =
      /^(but|yet|however|even so|still|instead)\b/i.test(lineLower) ||
      /\b(and yet|but when|even though|despite that)\b/i.test(lineLower);

    return hasContrastLead && abilityPattern.test(lineLower);
  });

  const hasDoesItAnyway =
    /\b(but then|and yet|somehow|until one day|suddenly|minutes? later|moments? later|seconds? later|hours? later|shortly after|soon after|then,?\s+(he|she|it|they)|managed to|was able to)\b/i.test(lower) ||
    hasDirectViolation ||
    hasContrastAbility;

  // Ignore hypothetical comparisons such as
  // "moved like he had practiced for years". They describe how the
  // performance looked, not a real period of training.
  const acquisitionText = lower.replace(
    /\b(?:like|as if|as though)\s+(?:he|she|they|it|someone)\s+had\s+(?:trained|practiced|studied|learned)\b.{0,40}\b(?:for|over|during)\s+(?:several\s+|a few\s+|\d+\s+)?(?:hours?|days?|weeks?|months?|years?)\b/gi,
    "",
  );

  const hasExplainedAcquisition =
    /\b(trained|practiced|studied|took lessons|received training|enrolled in (classes|lessons)|learned)\b.{0,40}\b(for|over|during)\s+(several\s+|a few\s+|\d+\s+)?(hours?|days?|weeks?|months?|years?)\b/i.test(acquisitionText) ||
    /\bafter\s+(several\s+|a few\s+|\d+\s+)?(hours?|days?|weeks?|months?|years?)\s+of\s+(training|practice|lessons|study)\b/i.test(acquisitionText);

  const hasReversal =
    /\b(never did it again|lost the ability|could not do it again|just as suddenly|stopped working|never happened again|returned to normal|went back to normal|came back like nothing happened)\b/i.test(lower) ||
    /\b(ability|skill|language|voice|effect|symptom|power|memory|speech|spanish)\s+(slowly\s+|suddenly\s+)?(disappeared|faded|vanished|went away)\b/i.test(lower) ||
    /\bnormal (voice|speech|movement|ability)\s+came back\b/i.test(lower);

  const has =
    !hasExplainedAcquisition &&
    (
      hasDirectViolation ||
      (hasInability && hasAbilityEvent && hasDoesItAnyway)
    );

  const strong = has && hasReversal;

  return { has, strong };
}

function detectAnomalySequence(lines: string[]): { has: boolean; strong: boolean } {
  const text = lines.join(" ");
  const lower = text.toLowerCase();

  const hasAbnormalEvent =
    /\b(disappeared|vanished|went silent|stopped responding|stopped transmitting|ceased all communication|communication ceased|communications ceased|lost contact|contact was lost|found (empty|abandoned|drifting|deserted)|gone without (a trace|warning))\b/i.test(lower);

  const hasPhysicalClue =
    /\bstill (on|in|at|sitting|lying|running)\b|\buntouched\b|\bno signs of\b|\bleft behind\b|\bremained exactly where\b|\bwere exactly where\b/i.test(lower);

  const hasInvestigationOrNoResolution =
    /\b(searched|investigated|looked for|found no trace|no trace of|could not locate|couldn'?t locate|no one (knows|ever found|explained)|never (explained|found|solved|recovered)|remains a mystery|to this day)\b/i.test(lower);

  const hasOrdinaryResolution =
    /\b(was|were) (caused|explained) by\b/i.test(lower) ||
    /\b(because of|due to|after) (a |the )?(power cut|power outage|outage|maintenance|technical issue|equipment failure)\b/i.test(lower) ||
    /\b(restored|fixed|repaired|resolved) (the )?(power|electricity|connection|signal|system|problem)\b/i.test(lower);

  const has =
    hasAbnormalEvent &&
    !hasOrdinaryResolution &&
    (hasPhysicalClue || hasInvestigationOrNoResolution);
  const strong = hasAbnormalEvent && hasPhysicalClue && hasInvestigationOrNoResolution;
  return { has, strong };
}

function detectConsequenceProgression(lines: string[]): { has: boolean; strong: boolean } {
  const text = lines.join(" ");
  const lower = text.toLowerCase();

  const hasBadState =
    /\b(losing money|losing \$[\d,]+|losing thousands|losing millions|monthly losses?|running out of|could not pay|couldn'?t pay|in debt|shutting down|about to (close|fail|collapse)|failing|on the verge of|expenses exceeded revenue|costs exceeded revenue|costs? (were )?(higher|greater) than (sales|revenue|income)|spending (was )?(higher|greater) than (sales|revenue|income)|(sales|revenue|income) (was|were) (below|lower than) (costs?|expenses|spending))\b/i.test(lower);

  const hasAttemptedFix =
    /\b(tried to|attempted to|cut costs|changed (the|their)|switched to|decided to try|added (another|more|one more)|built (another|more|one more)|launched (another|more|one more)|thought .{0,50} would (save|fix|solve|help|work))\b/i.test(lower);

  const hasWorseResult =
    /\b(but it got worse|still wasn'?t enough|continued to (lose|fail|struggle)|even worse|nothing changed|failed to help|did not help|didn'?t help|kept losing|made (the )?losses worse|losses (grew|increased|worsened)|every launch made .{0,30} worse|each launch made .{0,30} worse)\b/i.test(lower);

  const hasDecisiveChange =
    /\b(finally|instead|decided to|pivoted|focused on|cut|dropped|removed|stopped|narrowed|simplified|reduced|limited)\b/i.test(lower) &&
    /\b(then|finally|instead|after that|so they|focused on|pivoted|removed|dropped|stopped|narrowed|simplified|reduced|limited)\b/i.test(lower);

  const hasMeasurableImprovement =
    /\b(grew|increased|recovered|turned around|doubled|tripled|saved the|became profitable|reached profitability|made a profit|broke even|revenue (grew|increased|doubled|passed|exceeded|overtook)|revenue finally (passed|exceeded|overtook)|profit finally|expenses fell below revenue|(income|sales|revenue) (was|were) (greater|higher) than (spending|costs?|expenses)|(income|sales|revenue) exceeded (spending|costs?|expenses))\b/i.test(lower);

  const hasExternalOutcomeShift =
    /\b(competitor|rival|another company|another business|other company|other business)\b.{0,60}\b(revenue|profit|sales|income)\s+(grew|increased|rose|improved|doubled|tripled|exceeded)\b/i.test(lower);

  const has =
    !hasExternalOutcomeShift &&
    hasBadState &&
    (hasAttemptedFix || hasWorseResult) &&
    hasDecisiveChange &&
    hasMeasurableImprovement;

  const strong =
    has &&
    hasWorseResult &&
    hasMeasurableImprovement;

  return { has, strong };
}

function detectNarrativeArc(lines: string[]): {
  hasNarrativeArc: boolean;
  turnIndex: number;
  arcIsEarly: boolean;
} {
  const TURN_MARKERS =
    /\b(but then|until one day|until|then one day|years later|months later|weeks later|days later|after that|suddenly|that was when|that is when|everything changed|things changed|from that (day|moment)|it wasn'?t until|never (again|the same)|kept (coming|going|waiting|returning))\b/i;

  let turnIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (TURN_MARKERS.test(lines[i])) {
      turnIndex = i;
      break;
    }
  }
  if (turnIndex < 0) return { hasNarrativeArc: false, turnIndex: -1, arcIsEarly: false };

  const setupText = lines.slice(0, Math.max(turnIndex, 1)).join(" ");
  const afterText = lines.slice(turnIndex + 1).join(" ");

  const setupIsConcrete =
    /\d/.test(setupText) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(setupText) ||
    /\b\w+ed\b/i.test(setupText) ||
    /\b(found|went|came|gave|took|saw|ran|fell|grew|broke|drove|woke|won|built|caught|heard|held|left|met|stood|wrote)\b/i.test(setupText);

  const hasResolution =
    afterText.trim().split(/\s+/).filter(Boolean).length >= 4;

  const hasNarrativeArc = setupIsConcrete && hasResolution;
  const arcIsEarly = turnIndex >= 1 && turnIndex <= Math.ceil(lines.length * 0.65);

  return { hasNarrativeArc, turnIndex, arcIsEarly };
}

function detectScriptStructures(lines: string[], fullText: string): ScriptStructures {
  const lower = fullText.toLowerCase();
  const totalLines = lines.length;

  // ── Filler intro ──────────────────────────────────────────────────────────
  const firstLine = lines[0] ?? "";
  const firstLower = firstLine.toLowerCase().trim();
  const hasFillerIntro =
    firstLower.startsWith("today i will") ||
    firstLower.startsWith("today i want") ||
    firstLower.startsWith("in this video") ||
    firstLower.startsWith("i will explain") ||
    firstLower.startsWith("i want to explain") ||
    firstLower.startsWith("let's talk about") ||
    firstLower.startsWith("let me explain") ||
    firstLower.startsWith("welcome back") ||
    firstLower.startsWith("hey guys");

  // ── List buildup ──────────────────────────────────────────────────────────
  const bodyLines = lines.slice(1);
  let consecutiveShortLines = 0;
  let maxConsecutiveShort = 0;
  for (const line of bodyLines) {
    const wc = line.split(/\s+/).filter(Boolean).length;
    if (wc <= 9) {
      consecutiveShortLines++;
      maxConsecutiveShort = Math.max(maxConsecutiveShort, consecutiveShortLines);
    } else {
      consecutiveShortLines = 0;
    }
  }
  const hasEscalationFollowUp =
    lower.includes("now imagine") || lower.includes("now think") ||
    lower.includes("millions") || lower.includes("permanent") ||
    lower.includes("once it") || lower.includes("you do not control") ||
    lower.includes("you lose control") || lower.includes("that is what") ||
    lower.includes("that is why");

  // Detect whether the short lines are concrete items (list buildup) vs generic filler.
  // Generic filler lines contain no specific nouns, numbers, or named objects.
  const concreteShortLineCount = bodyLines.filter(line => {
    const wc = line.split(/\s+/).filter(Boolean).length;
    if (wc > 9) return false;
    const ll = line.toLowerCase();

    return (
      // Any number makes a short line concrete
      /\d/.test(line) ||
      // Any unit of measurement (universal)
      /\b(percent|%|mile|foot|feet|meter|second|minute|hour|day|week|year|degree|kilogram|pound|dollar|euro|cent|billion|million|thousand|km|mph|kph)\b/i.test(ll) ||
      // Named entity MID-SENTENCE only — sentence-initial capitalization
      // (every sentence) must not count, or every line becomes "concrete".
      /[a-z,]\s+[A-Z][a-z]{2,}/.test(line) ||
      // Any concrete physical noun (universal — detects objects in any niche)
      /\b(table|floor|ground|wall|door|window|seat|screen|phone|bag|box|car|ship|boat|plane|building|room|street|road|field|stage|court|ring|track|lab|office|store|market|hospital|school|station|airport)\b/i.test(ll)
    );
  }).length;

  // Ranked comparisons can form a list even when individual lines
  // are longer than the normal short-line threshold.
  //
  // Guardrail: repeated measurements of the same subject over days,
  // weeks, or distances are progression, not a ranked comparison list.
  const rankedComparisonSubjects = new Set<string>();

  // Auto-caption normalization can split one semantic comparison sentence
  // into mechanical chunks. The first chunk may contain the first compared
  // subject, so ranked-comparison detection must inspect every chunk.
  // Other list heuristics still use bodyLines and continue excluding the hook.
  for (const line of lines) {
    const trimmed = line.trim();
    const lineLower = trimmed.toLowerCase();

    const hasComparisonMarker =
      /\b(higher|lower|further|farther|closer|close to|above|below|ahead|behind|more than|less than|almost|nearly|even higher|slightly above|slightly below|beats?|wins?|remains ahead)\b/i.test(
        lineLower
      );

    if (!hasComparisonMarker) continue;

    const subjectMatch = trimmed.match(
      /^(?:against\s+|but\s+|and\s+)?([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3})\b/
    );

    if (subjectMatch) {
      rankedComparisonSubjects.add(
        subjectMatch[1].toLowerCase()
      );
    }

    // Detect several compared subjects inside one long sentence:
    // "higher than A, below B, ahead of C".
    const inlineSubjectPattern =
      /\b(?:than|above|below|ahead of|behind|against|beats?)\s+([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,3})\b/g;

    for (const match of trimmed.matchAll(inlineSubjectPattern)) {
      rankedComparisonSubjects.add(
        match[1].toLowerCase()
      );
    }
  }

  const hasRankedComparisonBuildup =
    rankedComparisonSubjects.size >= 3;

  const hasListBuildup =
    hasRankedComparisonBuildup ||
    (maxConsecutiveShort >= 3 && concreteShortLineCount >= 2) ||
    (maxConsecutiveShort >= 2 && hasEscalationFollowUp && concreteShortLineCount >= 1);

  // ── Mystery clue buildup ──────────────────────────────────────────────────
  const mysteryCluePatterns = [
    /^no\b/i, /^there were no/i, /^no signs/i, /^nothing/i,
    /still (there|on|sitting|in)/i, /left behind/i, /still (the same|intact)/i,
    /cargo/i, /belongings/i, /personal/i, /disappeared/i, /vanished/i,
    /everybody had/i, /everyone had/i, /nobody knew/i, /no one knew/i,
    /looked like/i, /it looked/i, /appeared/i,
  ];
  const mysteryClueLines = lines.filter(l =>
    mysteryCluePatterns.some(p => p.test(l.trim()))
  );
  const hasMysteryClueBuildup = mysteryClueLines.length >= 3;

  // ── Contradiction / reversal ──────────────────────────────────────────────
  const hasContradictionReversal =
    (lower.includes("most people think") || lower.includes("most creators think") ||
     lower.includes("everyone thinks") || lower.includes("you probably think")) &&
    (lower.includes(" but ") || lower.includes("however") || lower.includes("actually") ||
     lower.includes("the real") || lower.includes("not really") || lower.includes("it does not") ||
     lower.includes("it is not"));

  // ── Explanation chain ─────────────────────────────────────────────────────
  // Universal: premise → number/mechanism → consequence → payoff
  // Detected by: specific number/unit present AND a mechanism word AND a consequence marker
  const hasSpecificNumber = /\d[\d,]*(?:\.\d+)?/.test(lower) &&
    /\b(feet|miles|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|billion|million|thousand|degrees)\b/i.test(lower);
  const hasMechanismWord =
    lower.includes("because") || lower.includes("which means") ||
    lower.includes("that means") || lower.includes("the reason") ||
    lower.includes("so ") || lower.includes("therefore") ||
    lower.includes("as a result") || lower.includes("this means") ||
    lower.includes("that is why") || lower.includes("the result") ||
    lower.includes("the mechanism") || lower.includes("as a consequence") ||
    lower.includes("which causes") || lower.includes("which creates");
  const hasConsequenceMarker =
    lower.includes("would") || lower.includes("keeps going") ||
    lower.includes("keeps moving") || lower.includes("keeps ") ||
    lower.includes("everything") || lower.includes("scariest") ||
    lower.includes("the real") || lower.includes("it is that") ||
    lower.includes("it is not") || lower.includes("the scary part") ||
    lower.includes("the crazy part") || lower.includes("the strange part") ||
    lower.includes("but ") || lower.includes("however");
  const hasExplanationChain = hasSpecificNumber && hasMechanismWord && hasConsequenceMarker;

  // ── Consequence payoff in last 30% ────────────────────────────────────────
  // Widened to catch structural endings, not just specific phrase matches.
  const lastThirdLines = lines.slice(Math.floor(totalLines * 0.70));
  const lastThirdText = lastThirdLines.join(" ").toLowerCase();

  // Universal consequence markers: any strong causal or consequential statement
  const hasConsequencePayoff =
    // explicit causal payoff
    /that is why|that's why|the real reason|the reason is|it turns out/.test(lastThirdText) ||
    // strong continuation / unstoppable force
    /keeps going|keeps moving|everything else keeps|keeps /.test(lastThirdText) ||
    // personal/identity/social consequence
    /says about you|what you (are|become)|how (people|everyone) (see|look)|proof that/.test(lastThirdText) ||
    // loss of control / permanence
    /you do not control|you lose control|become permanent|once it is/.test(lastThirdText) ||
    // brain/behavior consequence
    /training your brain|trains your brain|quit when|rewires/.test(lastThirdText) ||
    // reversal / twist payoff
    /it is not (just|about|the)|not just.*it is|the scary part|the crazy part/.test(lastThirdText) ||
    // status/symbol consequence
    /competing with|symbol of|proof that|what wearing/.test(lastThirdText) ||
    // history/mystery resolution
    /to this day|never recovered|was never found|changed everything|changed history/.test(lastThirdText);

  // ── Strong payoff appearing late (placement issue) ────────────────────
  // The last line contains a structural consequence but hook was a filler intro.
  const lastLine = lines[totalLines - 1] ?? "";
  const lastLineLower = lastLine.toLowerCase();
  // Widened: any line ending with a causal/consequence structure
  const lastLineIsStructuralConsequence =
    // consequence / behavioral outcome (universal)
    /training your (brain|mind|body)|controls (your|how)|permanent/.test(lastLineLower) ||
    /you do not control|you lose control|once it (is|becomes|goes)/.test(lastLineLower) ||
    // continuation / unstoppable force (universal — any subject)
    /keeps (going|moving|running|working|growing|building|compounding)/.test(lastLineLower) ||
    // identity / social consequence (universal)
    /says (about|something about) (you|them|us)|how (people|everyone|others) (see|look|judge)/.test(lastLineLower) ||
    /what you (are|become|represent)|proof that (you|they|it)/.test(lastLineLower) ||
    // explanation chain endings (universal — any premise/mechanism)
    /it is not (just|only|about)|the (real|actual|true) (reason|problem|issue|point)/.test(lastLineLower) ||
    /the (scary|strange|crazy|interesting|surprising|remarkable) part/.test(lastLineLower) ||
    /but (not|never|nowhere|nothing) (the|just|only|about)/.test(lastLineLower) ||
    /the whole (point|story|picture|idea)/.test(lastLineLower) ||
    // causal wrap-up (universal)
    /that is (why|what|how|when) (it|this|the|your|everything)/.test(lastLineLower) ||
    /not for the reason|not (what|how|why) (most|many|you)/.test(lastLineLower);
  // Note: hasConsequencePayoff is computed next and cannot be referenced here.
  // analyzeScript() will use lastLineIsStructuralConsequence || structures.hasConsequencePayoff
  // when it needs the combined check.

  const hasStrongPayoffLate = lastLineIsStructuralConsequence && hasFillerIntro;

  // ── Numeric premise + mechanism ───────────────────────────────────────────
  // Universal: detects any specific number with a unit paired with a mechanism word.
  // Does not reference topic-specific terms like "gravity" or "one sixth".
  const hasNumericPremise =
    hasSpecificQuantity(fullText) &&
    (lower.includes("because") || lower.includes("that means") ||
     lower.includes("which means") || lower.includes("the reason") ||
     lower.includes("mechanism") || lower.includes("as a result") ||
     lower.includes("the result") || lower.includes("not about") ||
     lower.includes("therefore") || lower.includes("this means") ||
     lower.includes("which causes") || lower.includes("which creates") ||
     /\b(came|comes|come|resulted|results?) from\b/i.test(lower) ||
     /\b(caused by|led to)\b/i.test(lower) ||
     /\b(then|after that|instead)\b.{0,120}\b(removed|replaced|changed|switched|focused|cut|reduced|added)\b/i.test(lower) ||
     /\bby (replacing|removing|adding|changing|using|switching|cutting|increasing|reducing)\b/i.test(lower));

  // ── Weak payoff ────────────────────────────────────────────────────────────
  // The last line offers no new consequence, result, or unresolved tension.
  const lastLineWordCount = lastLine.split(/\s+/).filter(Boolean).length;
  const lastLineIsGenericClose =
    /let me know|comment below|what do you think|share this|follow for more/.test(lastLineLower) ||
    /like and subscribe|stay tuned|hope this helps|that is all|that is it/.test(lastLineLower) ||
    (lastLineWordCount <= 8 && !lastLineIsStructuralConsequence && !hasMechanismWord);
  const hasWeakPayoff = lastLineIsGenericClose && !hasConsequencePayoff;

  // ── Escalation quality ─────────────────────────────────────────────────────
  let escalationQuality: ScriptStructures["escalationQuality"] = "none";
  if (hasListBuildup) escalationQuality = "list";
  else if (hasMysteryClueBuildup) escalationQuality = "mystery";
  else if (hasContradictionReversal) escalationQuality = "reversal";
  else if (hasExplanationChain) escalationQuality = "explanation";
  else if (lower.includes("but") || lower.includes("however") || lower.includes("then")) {
    escalationQuality = "flat";
  }

  const narrativeArc = detectNarrativeArc(lines);
  const persistence = detectPersistenceArc(lines);
  const capability = detectCapabilityViolation(lines);
  const anomaly = detectAnomalySequence(lines);
  const progression = detectConsequenceProgression(lines);

  return {
    hasListBuildup,
    hasMysteryClueBuildup,
    hasContradictionReversal,
    hasConsequencePayoff,
    hasStrongPayoffLate,
    hasNumericPremise,
    hasFillerIntro,
    hasExplanationChain,
    hasWeakPayoff,
    hasNarrativeArc: narrativeArc.hasNarrativeArc,
    narrativeArcIsEarly: narrativeArc.arcIsEarly,
    hasPersistenceArc: persistence.has,
    hasCapabilityViolation: capability.has,
    hasAnomalySequence: anomaly.has,
    hasConsequenceProgression: progression.has,
    escalationQuality,
  };
}

// ─── Specific quantity detection (numeral OR spelled-out word form) ───────
// Existing hasNumber/hasUnit checks only match digit characters (/\d/), so
// "six years" or "ten seconds" register as zero specificity even though
// they are exactly as specific as "6 years" or "10 seconds". This closes
// that gap without touching any existing digit-based detection.
const SPELLED_OUT_NUMBERS =
  "(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|" +
  "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|" +
  "thousand|million|billion|dozen)";

function hasSpecificQuantity(sentence: string): boolean {
  // Numeral + unit (covers existing digit-based cases plus dollar amounts)
  if (/\$[\d,]+/.test(sentence)) return true;
  if (
    /\d[\d,]*(?:\.\d+)?\s*(percent|%|inch(?:es)?|miles?|mph|kph|km|feet|foot|meters?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|degrees?|times|billion|million|thousand|dollars?)/i.test(
      sentence
    )
  ) {
    return true;
  }
  // Spelled-out number + unit: "six years", "ten seconds", "a dozen times"
  const wordUnitPattern = new RegExp(
    `\\b${SPELLED_OUT_NUMBERS}\\b\\s+(percent|inch(?:es)?|miles?|feet|foot|meters?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|degrees?|times)\\b`,
    "i"
  );
  return wordUnitPattern.test(sentence);
}

// ─── Hook strength ──────────────────────────────────────────────────────────

// ─── Hook strength ──────────────────────────────────────────────────────────

function calculateHookStrength(
  firstSentence: string,
  signals: UniversalSignals,
  script: string = ""
): number {
  const lower = firstSentence.toLowerCase();
  const wordCount = firstSentence.split(/\s+/).filter(Boolean).length;

  let score = 38;

// ── Tier-0: paradox / contradiction / mechanism hooks ─────────────────────
  // Detects "wins before he even leaves", "starts before defenders react",
  // "already ... before", "not because ... but because", "sounds strange but",
  // "the real reason is", etc. Universal — no hardcoded topics.
  //
  // Rules:
  // 1. First line matches a paradox/contrast/mechanism pattern.
  // 2. First line contains a concrete subject+action (not just the pattern).
  // 3. At least 2 body lines develop the mechanism (not just restate).
  const PARADOX_PATTERNS: RegExp[] = [
    /\bbefore (he|she|they|it) even\b/i,
    /\bbefore (he|she|they|it) (leaves?|left|jumps?|jumped|lands?|landed|reacts?|reacted|realizes?|realized|notices?|noticed)\b/i,
    /\bbefore (defenders?|people|anyone|everyone|viewers?)\b/i,
    /\balready .{2,40} before\b/i,
    /\bstarts? before\b/i,
    /\bwins? .{2,30} before\b/i,
    /\bnot because .{2,60} but because\b/i,
    /\bnot just .{2,40} but\b/i,
    /\bmost people think .{2,60} but\b/i,
    /\bsounds? (strange|odd|impossible|wrong|counterintuitive) but\b/i,
    /\bthe (strange|scary|real|hidden|surprising|counterintuitive) (part|reason|truth) is\b/i,
    /\bbefore (it even|they even|the ball|the cross|the pass|the shot)\b/i,
  ];
  const hasParadoxPattern = PARADOX_PATTERNS.some(p => p.test(firstSentence));

  // Concrete subject: named entity OR subject+verb with a physical/action noun
  const hasConcreteSubject =
    /\b[A-Z][a-z]{2,}\b/.test(firstSentence) ||
    /\b(jump|jumps|win|wins|score|scores|shoot|shoots|land|lands|react|reacts|move|moves|start|starts|reach|reaches|leave|leaves|defend|defends)\b/i.test(firstSentence) ||
    /\b(header|shot|pass|ball|defender|ground|air|cross|body)\b/i.test(firstSentence);

  // Mechanism development: body lines explain HOW/WHY, not just repeat
  const bodyForParadox = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean).slice(1);
  const mechanismLineCount = bodyForParadox.filter(line => {
    const ll = line.toLowerCase();
    return (
      /\b(because|which means|that means|as a result|the reason|so that|therefore|this means|which causes|in order to|due to|that is why|before the|while the|when the)\b/i.test(ll) ||
      /\b(body|force|timing|position|space|angle|balance|momentum|control|load|transfer|plant|explode|drive|push|reach|attack|create|set up)\b/i.test(ll) ||
      (ll.includes(" before ") && !ll.includes("before the script")) ||
      (ll.includes("not just") || ll.includes("it is not about") || ll.includes("but his") || ll.includes("but her") || ll.includes("but their"))
    );
  }).length;

  // Detect flat generic claims regardless of topic or subject name.
  const flatCopulaClaim =
    /^(?:[a-z][a-z'-]*)(?:\s+[a-z][a-z'-]*){0,3}\s+(is|are|was|were)\s+(very |extremely |really |so |quite |always |often )?(dangerous|important|key|essential|hard|easy|powerful|possible|incredible|amazing|necessary|needed|useful|real|true|common|rare|unique|special|good|bad|great|terrible|best|worst|only|enough)\.?$/i.test(
      firstSentence.trim()
    );

  const flatPerformanceClaim =
    /^(?:[A-Z][A-Za-z'-]*)(?:\s+[A-Z][A-Za-z'-]*){0,2}\s+[a-z]+s\s+(high|fast|well|hard|great|amazingly?)\s+(because\s+(he|she|they|it)\s+(is|are)|because of\s+(his|her|their|its))\s+(powerful|strong|fast|quick|talented|gifted|hard.?working|dedicated|focused|the best|the greatest)\.?$/i.test(
      firstSentence.trim()
    );

  const isGenericTopicAnnouncement =
    flatCopulaClaim || flatPerformanceClaim;

  let paradoxBonus = 0;
  if (hasParadoxPattern && hasConcreteSubject && !isGenericTopicAnnouncement) {
    paradoxBonus += 22; // base paradox bonus
    if (mechanismLineCount >= 2) paradoxBonus += 12; // script develops the mechanism
    if (mechanismLineCount >= 4) paradoxBonus += 8;  // deep mechanism development
  }
  score += paradoxBonus;

  // ── Generic topic announcement penalty ────────────────────────────────────
  // Penalizes hooks that just state a broad topic without consequence/contrast.
  // Only fires when NO paradox/curiosity signal rescued it.
  if (isGenericTopicAnnouncement && paradoxBonus === 0) {
    score -= 22;
  }

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
  score += tier2Hits * 10;

  // ── Tier-3: narrative / story-driven openers ───────────────────────────────
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

  // ── Tier-4: visual scale / comparative fact hooks ─────────────────────────
  // Hooks that state a surprising scale comparison, physical fact, or
  // counterintuitive consequence — without a question mark or "imagine".
  // Examples: "The ocean is so deep that Mount Everest could disappear inside it."
  //           "Ronaldo would jump over 20 feet high on the Moon."
  //           "You are moving over 1,000 miles per hour right now."
  const hasVisualScaleComparison =
    // "so [adj] that [something unexpected]" — universal scale comparison
    /\bso (deep|tall|fast|slow|heavy|large|small|big|wide|far|long|short|hot|cold|dense|thin|strong|weak)\b.{3,40}\bthat\b/i.test(firstSentence) ||
    // "could disappear / could fit / could be hidden" — scale consequence
    /\bcould (disappear|fit|be hidden|vanish|be buried|be swallowed|be submerged)\b/i.test(firstSentence) ||
    // "[named subject] would [action] [measurement]" — hypothetical numeric
    /\b\w+ would (jump|reach|travel|move|fall|rise|grow|shrink|expand|stretch)\b/i.test(firstSentence) ||
    // "feels [adj] before it even [verb]" — conceptual curiosity (elevator-style)
    /\bfeels? .{3,30} before it even\b/i.test(firstSentence) ||
    // "can feel [adj/adv] before" — same pattern
    /\bcan feel .{2,25} before\b/i.test(firstSentence) ||
    // "[noun] can change the way you [verb]" — consequence hook
    /\bcan change (the way|how) you\b/i.test(firstSentence) ||
    // "[noun] changes how/what you" — behavioral consequence
    /\b(changes|changed) (how|what|who|the way) you\b/i.test(firstSentence);

  if (hasVisualScaleComparison) score += 22;

  // ── Tier-5: contrast/consequence statement hooks ───────────────────────────
  // Strong statement hooks that use "not X, but Y" or "not in X, but in Y"
  // These are strong even without a question mark.
  // Example: "Most people lose money not in one big mistake, but in tiny decisions."
  const hasContrastStatementHook =
    // "not in X, but in Y" — universal contrast pattern
    /\bnot in .{3,60}, but in\b/i.test(firstSentence) ||
    // "not X, but Y" — universal "not A but B" reversal (any length)
    /\bnot .{3,60}, but \b/i.test(firstSentence) ||
    // "not in one X but in Y" — catches "not in one big mistake but in tiny decisions"
    /\bnot in one .{3,40} but\b/i.test(firstSentence) ||
    // "not X but Y" without comma
    /\bnot [a-z].{3,40} but [a-z]/i.test(firstSentence) ||
    // "X does not sell Y, it sells Z" — identity/status reversal
    /\bdoes not (sell|make|create|build|teach|earn|give|offer)\b.{2,30}\bit (sells|makes|creates|builds|teaches|earns|gives|offers)\b/i.test(firstSentence) ||
    // "cheap/expensive X can beat/outperform Y" — comparative reversal
    /\b(cheap|expensive|simple|complex|small|large|old|new) .{2,25} (can|could) (beat|outperform|outsell|win|replace)\b/i.test(firstSentence) ||
    // "most people lose/fail/miss X not because of Y but because of Z"
    /\bmost people (lose|fail|miss|struggle|spend|waste).{3,60}\bnot\b/i.test(firstSentence);

  if (hasContrastStatementHook) score += 20;

// ── Challenge / bet / stunt hooks ─────────────────────────────────────────
  // "Can you X?", "I bet $Y he couldn't", "Is it possible to X?" are strong
  // viral hook patterns that the general scoring misses.
  const isChallengeQuestion =
    /^(can you|could you|is it possible|would you|what if you)\b/i.test(lower) ||
    /\b(slice|cut|break|survive|catch|dodge|beat|outrun)\b.{0,30}\?/i.test(firstSentence);
  if (isChallengeQuestion) score += 22;

  const hasBetOrStake =
    /\$[\d,]+/.test(firstSentence) ||
    /\b\d[\d,]* (dollars?|bucks)\b/i.test(firstSentence) ||
    /\b(bet|wager|i don'?t believe|he couldn'?t|she couldn'?t|they couldn'?t)\b/i.test(lower);
  if (hasBetOrStake) score += 18;

  // Do not award extra hook points for a closed list of familiar objects.
  // The challenge structure itself is already rewarded above.

// ── Question mark in first sentence ───────────────────────────────────────
  // Questions are one valid hook type but NOT the only one.
  // Statement hooks with specificity can be equally strong.
  if (firstSentence.includes("?")) score += 8;

// ── Scenario / imagination hooks ──────────────────────────────────────────
  // "Imagine..." and "Imagine if..." create mental images and stakes.
  // These should not be penalized just because they are not questions.
  const scenarioHookPhrases = [
    "imagine someone", "imagine if", "imagine you", "imagine a ",
    "picture this", "what if your", "what if you woke",
  ];
  const isScenarioHook = scenarioHookPhrases.some(p => lower.startsWith(p) || lower.includes(p));
  if (isScenarioHook) score += 18;

  // ── Scenario hook with personal stakes bonus ──────────────────────────────
  // A scenario hook that also addresses the viewer directly with private/personal
  // language earns an additional bonus. This covers hooks like:
  // "Imagine someone was about to play back everything you said today."
  // which have: concrete scenario + "you" + private/personal stakes + time anchor.
  const hasPersonalStakeLanguage =
    (lower.includes(" you ") || lower.includes(" your ") || lower.startsWith("you ")) &&
    (lower.includes("private") || lower.includes("said") || lower.includes("wrote") ||
     lower.includes("sent") || lower.includes("thought") || lower.includes("today") ||
     lower.includes("play back") || lower.includes("replay") || lower.includes("heard") ||
     lower.includes("record") || lower.includes("message") || lower.includes("joke"));
  if (isScenarioHook && hasPersonalStakeLanguage) score += 10;

  // ── Specific numeric / measurement hooks ──────────────────────────────────
  // A hook with a specific number + named subject + unusual scenario is strong
  // without needing a question. "Ronaldo would jump over 20 feet" = strong.
  const hasNumber = /\d/.test(firstSentence);
  const hasUnit = /\b(inch(?:es)?|feet|foot|miles|km|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|kilograms|pounds|degrees|times|billion|million|thousand)\b/i.test(firstSentence);
  const hasNamedSubject = /\b[A-Z][a-z]{2,}\b/.test(firstSentence);
  const hasSpecificQuantityWord = hasSpecificQuantity(firstSentence);
  if (hasNumber && hasUnit) score += 16;
  else if (hasSpecificQuantityWord) score += 14; // spelled-out duration/quantity, e.g. "six years"
  else if (hasNumber) score += 8;
  if (hasNamedSubject && (hasNumber || hasSpecificQuantityWord)) score += 8;

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
  // Universal: detect concrete physical/event details structurally, not by topic.
  // These patterns work for any niche: crime, science, sports, business, etc.
  const hasConcreteAction =
    // physical state or location detail (universal)
    /\b(stopped|found|discovered|disappeared|arrived|recording|captured|caught|revealed)\b/i.test(firstSentence) ||
    // sensory or physical object detail (universal)
    /\b(footage|camera|recording|message|image|photo|signal|trace)\b/i.test(firstSentence) ||
    // comparative/competitive framing (universal)
    /\b(outjump|outsell|outperform|beats|beat|versus|compared to|vs\.?)\b/i.test(firstSentence) ||
    // functional vs symbolic framing (universal)
    /\b(tell time|keep time|measure|track|mark)\b/i.test(firstSentence);
  if (hasConcreteAction) score += Math.min(2, 1) * 8;

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

  // No curiosity/contrast/narrative/scenario/numeric signal — soft penalty only
  // Do NOT penalize numeric hooks or scenario hooks even if they lack question marks.
  const hasScenarioSignal = scenarioHookPhrases.some(p => lower.startsWith(p) || lower.includes(p));
  const hasNumericSignal = (hasNumber && (hasUnit || hasNamedSubject)) || hasSpecificQuantityWord;
  // Only apply no-signal penalty if NONE of the structural hook signals fired.
  // hasVisualScaleComparison and hasContrastStatementHook are declared above.
  if (
    tier1Hits === 0 && tier2Hits === 0 && tier3Hits === 0 &&
    !firstSentence.includes("?") && contrastHits === 0 &&
    !hasScenarioSignal && !hasNumericSignal &&
    !hasVisualScaleComparison && !hasContrastStatementHook
  ) {
    score -= 6;
  }

  // ── Generic hook penalty ──────────────────────────────────────────────────
  // Applies when the hook is a vague abstract claim with no concrete detail,
  // no consequence, no contrast, and no specific image.
  const genericHookPhrases = [
    "is very important", "is important in", "is something everyone",
    "is possible for anyone", "many people want", "everyone wants",
    "we all want", "is the key to", "takes hard work",
    "need to work hard", "never give up", "stay focused",
    "can reach your goals", "success is", "failure is",
    "time is ", "life is ", "people are ",
  ];
  const isGenericHook = genericHookPhrases.some(p => lower.includes(p)) || isGenericTopicAnnouncement;
  // Only penalize if no structural signal rescued it
  if (
    isGenericHook &&
    paradoxBonus === 0 &&
    tier1Hits === 0 && tier2Hits === 0 && tier3Hits === 0 &&
    !hasVisualScaleComparison && !hasContrastStatementHook &&
    !hasScenarioSignal && !hasNumericSignal
  ) {
    score -= 20;
  }
  const hasPersonalConcreteOpener =
    /^(her|his|their|my|our)\s+\w+(\s+\w+){0,3}\s+(had|was|were|did|would|never|always|hadn'?t|wasn'?t)\b/i.test(firstSentence);
  if (hasPersonalConcreteOpener) score += 12;

  const linesForArc = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean);
  const arcCheck = detectNarrativeArc(linesForArc);
  const persistenceCheck = detectPersistenceArc(linesForArc);
  const capabilityCheck = detectCapabilityViolation(linesForArc);
  const anomalyCheck = detectAnomalySequence(linesForArc);
  const progressionCheck = detectConsequenceProgression(linesForArc);

  const hasAnyUniversalNarrative =
    (arcCheck.hasNarrativeArc && arcCheck.arcIsEarly) ||
    persistenceCheck.has || capabilityCheck.has ||
    anomalyCheck.has || progressionCheck.has;

  if (hasAnyUniversalNarrative && !isGenericTopicAnnouncement) {
    score += 18;
    if (hasPersonalConcreteOpener || hasNamedSubject) score += 6;
  }

  // A confirmed impossible-skill contradiction is inherently a strong
  // curiosity hook. Prevent generic opener heuristics from leaving it
  // below the strong-hook threshold, without inflating stronger cases.
  if (capabilityCheck.has && !isGenericTopicAnnouncement) {
    score = Math.max(score, 75);
  }

  const signalFamiliesFired = [
    hasParadoxPattern || hasContrastStatementHook,
    hasNumber && hasUnit,
    tier1Hits > 0 || lower.includes("nobody") || lower.includes("no one") || lower.includes("disappeared"),
    stakesHits > 0,
    hasVisualScaleComparison,
    hasPersonalConcreteOpener || hasAnyUniversalNarrative,
  ].filter(Boolean).length;

  let eliteBonus = 0;
  if (signalFamiliesFired >= 4) eliteBonus = 14;
  else if (signalFamiliesFired === 3) eliteBonus = 8;
  else if (signalFamiliesFired === 2) eliteBonus = 3;

  score += eliteBonus;

  const hasStrongSpecificity = signals.specificityScore >= 30;
  const cap =
    signalFamiliesFired >= 3 ? 100 :
    hasStrongSpecificity ? 92 :
    88;

  return Math.min(cap, Math.max(0, Math.round(score)));
}



// ─── Retention structure ────────────────────────────────────────────────────

// ─── Retention structure ────────────────────────────────────────────────────

function calculateRetentionStructure(
  lines: string[],
  signals: UniversalSignals,
  structures?: ScriptStructures
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

  // ── Structure-based reductions (universal, not niche-specific) ─────────────
  if (structures) {
    // List buildup is a valid escalation structure — reduces risk meaningfully
    if (structures.hasListBuildup) risk -= 9;

    // Mystery clue buildup counts as structured escalation
    if (structures.hasMysteryClueBuildup) risk -= 8;

    // Contradiction/reversal structure is a strong retention signal
    if (structures.hasContradictionReversal) risk -= 7;

    // Consequence payoff in last third means the script has a destination
    if (structures.hasConsequencePayoff) risk -= 6;

    // Numeric premise + mechanism = structured explanation, not random info
    if (structures.hasNumericPremise) risk -= 5;

    // Explanation chain (premise → mechanism → consequence) = valid retention structure
    if (structures.hasExplanationChain) risk -= 7;

   // Narrative arc (setup → turn → consequence) = universal story structure
    if (structures.hasNarrativeArc) risk -= 8;
    if (structures.hasNarrativeArc && structures.narrativeArcIsEarly) risk -= 4;

    // Four narrow universal narrative structures
    if (structures.hasPersistenceArc) risk -= 8;
    if (structures.hasCapabilityViolation) risk -= 8;
    if (structures.hasAnomalySequence) risk -= 8;
    if (structures.hasConsequenceProgression) risk -= 8;
  }

  // ── Existing narrative structure bonuses ──────────────────────────────────
  const hasAtFirstBut =
    fullText.includes("at first") && (fullText.includes(" but ") || fullText.includes("however"));
  if (hasAtFirstBut) risk -= 5;

  const hasMostPeopleReversal =
    (fullText.includes("most people think") || fullText.includes("most creators think")) &&
    (fullText.includes(" but ") || fullText.includes("however") || fullText.includes("actually"));
  if (hasMostPeopleReversal) risk -= 5;

  // Universal mystery/reveal escalation: any clue-then-contrast sequence
  const hasMysterySequence =
    (fullText.includes("one detail") || fullText.includes("did not fit") ||
     fullText.includes("something was") || fullText.includes("something seemed") ||
     fullText.includes("nobody knew") || fullText.includes("no one knew") ||
     fullText.includes("then they found") || fullText.includes("then it turned out")) &&
    (fullText.includes("but") || fullText.includes("suddenly") || fullText.includes("until"));
  if (hasMysterySequence) risk -= 6;

  // Universal comparison escalation: any "but still X" or "but harder/bigger/deeper"
  const hasComparisonEscalation =
    fullText.includes("but") && fullText.includes("still") &&
    (fullText.includes("harder") || fullText.includes("bigger") || fullText.includes("deeper") ||
     fullText.includes("further") || fullText.includes("more than") || fullText.includes("gap"));
  if (hasComparisonEscalation) risk -= 4;

  // Universal soft consequence: any identity/social/behavioral implication at end
  const hasSoftConsequence =
    /that might be enough|proof that (you|it|they)|says (about|something) (you|them)/.test(fullText) ||
    /how (everyone|people|others) (see|look|judge)|version of (you|them|it)/.test(fullText) ||
    /much (harder|bigger|deeper|stranger|darker) (to|than)/.test(fullText) ||
    /competing with (a |the )?(symbol|status|identity|idea|concept)/.test(fullText);
  if (hasSoftConsequence) risk -= 4;

  // ── Flat middle penalty — ONLY fires when structure detection says it's flat ─
  if (totalLines >= 5) {
    const midStart = Math.floor(totalLines * 0.33);
    const midEnd = Math.floor(totalLines * 0.66);
    const middleText = lines.slice(midStart, midEnd).join(" ").toLowerCase();

    const middleHasSignal = [
      "but", "however", "then", "suddenly", "except", "actually",
      "the problem", "real problem", "if it", "that is why", "result",
      "at first", "one detail", "the scary part", "the truth",
    ].some(p => middleText.includes(p));

    // Only penalize if structure detection also says escalation is weak
    const structureIsFlat = !structures ||
      (structures.escalationQuality === "flat" || structures.escalationQuality === "none");

    if (!middleHasSignal && structureIsFlat) risk += 7;
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

 if (signals.genericPenalty >= 42) risk += 30;
  else if (signals.genericPenalty >= 28) risk += 22;
  else if (signals.genericPenalty >= 20) risk += 15;
  else if (signals.genericPenalty >= 12) risk += 8;
  else if (signals.genericPenalty >= 6) risk += 3;

  // ── Dynamic floor ─────────────────────────────────────────────────────────
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

  const narrativeBonusCount = [
    hasAtFirstBut, hasMostPeopleReversal, hasMysterySequence,
    hasComparisonEscalation, hasSoftConsequence,
    structures?.hasListBuildup ?? false,
    structures?.hasMysteryClueBuildup ?? false,
    structures?.hasContradictionReversal ?? false,
    structures?.hasConsequencePayoff ?? false,
    structures?.hasNarrativeArc ?? false,
    structures?.hasPersistenceArc ?? false,
    structures?.hasCapabilityViolation ?? false,
    structures?.hasAnomalySequence ?? false,
    structures?.hasConsequenceProgression ?? false,
  ].filter(Boolean).length;

  const combinedStrength = positiveSignalCount + narrativeBonusCount;

  const floor = combinedStrength >= 9 ? 18
    : combinedStrength >= 7 ? 22
    : combinedStrength >= 6 ? 25
    : combinedStrength >= 5 ? 28
    : combinedStrength >= 4 ? 32
    : combinedStrength >= 3 ? 35
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

  // ── Universal narrative / consequence / transformation endings ────────────
  // Detected via structural pattern, not topic-specific phrases.
  // Works for mystery, science, business, sports, psychology, or any niche.
  let narrativePayoffScore = 0;

  // Sudden reveal / transformation (universal)
  if (/suddenly (became|turned|changed|revealed|showed)/.test(lastThird)) narrativePayoffScore += 13;
  // "much [adjective] than" — any comparative escalation at end
  if (/much (harder|bigger|deeper|stranger|darker|worse|better|more) (to|than|for)/.test(lastThird)) narrativePayoffScore += 13;
  // Identity / social consequence (universal subject)
  if (/proof that (you|it|they|this)|says (about|something about) (you|them|it)/.test(lastThird)) narrativePayoffScore += 13;
  if (/how (everyone|people|others) (see|look|view|judge)/.test(lastThird)) narrativePayoffScore += 13;
  // Mystery resolution (universal)
  if (/(was|were|has been|have been) never (found|solved|explained|identified|recovered)/.test(lastThird)) narrativePayoffScore += 13;
  if (/(the case|the investigation|the inquiry) (remains|is still|has never)/.test(lastThird)) narrativePayoffScore += 10;
  // Consequence threshold / "might be enough" (universal)
  if (/that might be enough|might be enough to|just enough to/.test(lastThird)) narrativePayoffScore += 13;
  // Competing with / surpassing a concept (universal)
  if (/competing with (a |the )?(symbol|concept|idea|status|identity|image)/.test(lastThird)) narrativePayoffScore += 13;
  // Personal version / transformation (universal)
  if (/version of (you|them|it|this)|change (how|who|what) (you|they|everyone|people)/.test(lastThird)) narrativePayoffScore += 13;
  // General transformation ending (universal)
  if (/(changes|changed) (everything|the whole|how|what|who)/.test(lastThird)) narrativePayoffScore += 10;
  // Explanation-chain conclusion (universal — any topic)
  if (/that is (why|what makes|how|the reason)/.test(lastThird) && !/that is why one/.test(lastThird)) narrativePayoffScore += 10;

  strength += Math.min(narrativePayoffScore, 26); // cap so one script can't double-dip

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
    weakPayoffHits === 0 && narrativePayoffScore === 0 &&
    signals.consequenceScore === 0
  ) {
    strength -= 14;
  }

if (signals.genericPenalty >= 42) strength -= 22;
  else if (signals.genericPenalty >= 28) strength -= 16;
  else if (signals.genericPenalty >= 20) strength -= 12;
  else if (signals.genericPenalty >= 10) strength -= 6;

  return Math.min(100, Math.max(0, Math.round(strength)));
}



// ─── Script type detection ───────────────────────────────────────────────────

type ScriptType =
  | "viral_challenge"
  | "giveaway_or_prize"
  | "emotional_story"
  | "educational_explainer"
  | "auto_caption_transcript"
  | "generic_advice"
  | "general";

function detectScriptType(text: string): ScriptType {
  const lower = text.toLowerCase();

  // Auto-caption: messy transcript markers
  if (
    lower.includes("[music]") ||
    lower.includes(">>") ||
    (text.split(/\n/).filter(l => l.trim().length > 0).length >= 4 &&
      text.split(/[.!?]/).filter(Boolean).length < 3 &&
      lower === lower) // all lowercase signal
  ) {
    return "auto_caption_transcript";
  }

  // Viral challenge: impossible test + money/object stake
  const hasChallengeVerb =
    /\b(slice|cut|break|survive|smash|destroy|catch|dodge|block|stop|open|find|lift|throw|eat|drink|hold|beat|outrun|outlast|endure|withstand)\b/i.test(text) ||
    /\b(put it to the test|let's try|only one chance|one shot|final attempt|last try)\b/i.test(lower);
  // "wins/win" alone is too broad (e.g. "junk food wins") — require actual money/prize context
  const hasMoneySake =
    /\$[\d,]+|\b\d[\d,]* (dollars|dollar|bucks|usd)\b/i.test(text) ||
    /\b(bet|wager|prize|reward|keep it|gets to keep)\b/i.test(lower) ||
    (/\b(win|won|wins)\b/i.test(lower) && /\b(subscriber|challenge|prize|cash|giveaway|money|bet)\b/i.test(lower));
  // Structural viral-challenge signals.
  // Do not depend on a closed catalog of familiar objects.
  const hasDirectChallengeQuestion =
    /^(can you|could you|is it possible)\b/i.test(text.trim()) &&
    hasChallengeVerb;

  const hasAttemptSignal =
    /\b(test|tested|testing|attempt|attempted|try|tried|trying|final attempt|last try|finally began)\b/i.test(lower) ||
    /\bput .{0,30} to the test\b/i.test(lower);
  const hasImpossiblePremise =
    /\b(can you|could you|is it possible|sounds impossible|nobody thought|no one believed|they said it couldn't)\b/i.test(lower) ||
    /\b(impossible|unbreakable|unkillable|unbeatable|unstoppable|unsliceable)\b/i.test(lower);
  const hasSubscriberChallenge =
    /\b(subscriber|sub|subscribers)\b/i.test(lower) &&
    /\b(gets?|wins?|keeps?|chose|chosen|selected|picked|random)\b/i.test(lower);

  if (
    (hasChallengeVerb && hasMoneySake) ||
    (hasImpossiblePremise && hasMoneySake) ||
    (hasDirectChallengeQuestion && hasAttemptSignal)
  ) {
    return "viral_challenge";
  }

  // Giveaway / prize: subscriber reward or prize drop
  const hasGiveawaySignal =
    /\b(giveaway|give away|giving away|giving a|handed|handing out)\b/i.test(lower);
  const hasPrizeObject =
    /\b(iphone|ipad|ps5|xbox|car|truck|cash|money|\$[\d,]+|\d[\d,]* dollars?|laptop|macbook|drone|watch|airpods|tv|television)\b/i.test(lower);
  const hasRandomWinner =
    /\b(wherever|whatever|whichever|random|randomly|lands on|spins|points to|drops on|falls on)\b/i.test(lower) &&
    /\b(subscriber|person|winner|country|city|name)\b/i.test(lower);
  const hasPrizeCTA =
    /\b(subscribe|hit subscribe|smash subscribe)\b/i.test(lower) &&
    hasPrizeObject;

  if (
    (hasGiveawaySignal && hasPrizeObject) ||
    hasRandomWinner ||
    (hasSubscriberChallenge && hasPrizeObject) ||
    hasPrizeCTA
  ) {
    return "giveaway_or_prize";
  }

  // Emotional story: human relationship + stakes + transformation
  const hasEmotionalMarker =
    /\b(cried|crying|tears|sobbed|broke down|emotional|moved|touched)\b/i.test(lower) ||
    /\b(father|mother|dad|mom|parent|son|daughter|family|brother|sister|friend|wife|husband)\b/i.test(lower) ||
    /\b(poor|struggled|homeless|starving|hungry|hardship|difficult life|grew up without)\b/i.test(lower);
  const hasStoryArc =
    /\b(years later|after becoming|changed (his|her|their|my) life|never forgot|always remembered|went back|returned|finally|one day when)\b/i.test(lower) ||
    /\b(kindness|helped (him|her|them|me)|believed in (him|her|them|me)|gave (him|her|them|me))\b/i.test(lower);
  const hasNamedPerson =
    /\b[A-Z][a-z]{2,}\b/.test(text) &&
    (hasEmotionalMarker || hasStoryArc);

  if ((hasEmotionalMarker && hasStoryArc) || (hasNamedPerson && hasEmotionalMarker)) {
    return "emotional_story";
  }

  // Educational explainer: fact + mechanism + consequence
  const hasFactualPremise =
    /\b(did you know|the reason|the real reason|here's why|this is why|scientists|researchers|studies show|research shows|according to)\b/i.test(lower) ||
    /\d[\d,]*\s*(miles|km|feet|meters|percent|%|seconds|minutes|hours|days|years|degrees|mph|kph|billion|million|thousand)/i.test(lower);
  const hasMechanismExplain =
    /\b(because|which means|that means|as a result|the reason is|this happens|this causes|what happens|how this works)\b/i.test(lower);

  if (hasFactualPremise && hasMechanismExplain) {
    return "educational_explainer";
  }

  // Generic advice: mostly platitudes, no concrete anchor
  const genericPhrases = [
    "motivation is", "discipline is", "success is", "failure is",
    "never give up", "work hard", "stay focused", "believe in yourself",
    "is the key to", "is very important", "everyone wants", "most people want",
    "you can do it", "keep going", "keep working", "is possible for anyone",
  ];
  const genericHits = genericPhrases.filter(p => lower.includes(p)).length;
  const hasConcreteAnchor =
    /\d/.test(text) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(text) ||
    /\b(found|went|came|gave|took|saw|ran|broke|drove|won|built|caught|heard)\b/i.test(lower);

  if (genericHits >= 2 && !hasConcreteAnchor) {
    return "generic_advice";
  }

  return "general";
}

// ─── Auto-caption normalizer ─────────────────────────────────────────────────

function normalizeAutoCaptionScript(text: string): string {
  return text
    .replace(/\[music\]/gi, "")
    .replace(/^>>\s*/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type Weakness =
  | "weak-hook" | "weak-payoff" | "weak-middle" | "weak-stakes"
  | "weak-specificity" | "weak-mystery" | "weak-consequence"
  | "repetitive" | "excellent-hook" | "excellent-payoff" | "balanced-weak";

function hashPick<T>(seed: string, options: T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return options[h % options.length];
}

const TAKEAWAY_TEMPLATES: Record<Weakness, string[]> = {
  "weak-hook": [
    "The opening is the bottleneck here — everything after it is wasted if viewers swipe in the first two seconds.",
    "This script's biggest leak is at the very top. Fix the first line and the rest of the structure holds up.",
    "Strong material is buried behind a slow opening. Lead with it instead of working up to it.",
  ],
  "weak-payoff": [
    "The setup earns attention, but the ending doesn't cash it in. Viewers reach the end with no clear reward.",
    "This script builds tension well but resolves it too vaguely — the payoff needs a concrete result.",
    "Everything before the ending works. The last line is where retention quietly leaks out.",
  ],
  "weak-middle": [
    "The hook and ending both work — it's the middle that goes flat and risks losing viewers mid-watch.",
    "Strong bookends, soft middle. Add one more turn or contrast halfway through to hold attention.",
  ],
  "weak-stakes": [
    "Nothing in this script is clearly at risk. Add a consequence — what's lost, threatened, or on the line.",
  ],
  "weak-specificity": [
    "This script stays general throughout. A number, name, date, or measurable detail would ground it.",
  ],
  "weak-mystery": [
    "There's no unanswered question pulling viewers forward — consider an unresolved detail early on.",
  ],
  "weak-consequence": [
    "The script states what happened but not what it changed. Add a clear consequence to the outcome.",
  ],
  "repetitive": [
    "Several lines restate the same idea without adding new information — tighten for pace.",
  ],
  "excellent-hook": [
    "The opening does real work here — it creates a gap viewers want closed before they swipe away.",
  ],
  "excellent-payoff": [
    "The ending lands a real consequence, which is what makes this feel worth the watch time.",
  ],
  "balanced-weak": [
    "No single part is broken, but nothing is strong enough yet either — sharpen the hook, stakes, or payoff.",
  ],
};

function classifyPrimaryWeakness(
  hookScore: number, payoffStrength: number, retentionRisk: number,
  signals: UniversalSignals, structures: ScriptStructures
): Weakness {
  if (hookScore >= 85) return "excellent-hook";
  if (payoffStrength >= 80) return "excellent-payoff";
  if (signals.genericPenalty >= 25) return "repetitive";
  if (hookScore < 50) return "weak-hook";
  if (payoffStrength < 35 && !structures.hasConsequencePayoff) return "weak-payoff";
  if (retentionRisk >= 60 && hookScore >= 65) return "weak-middle";
  if (signals.stakesScore < 12) return "weak-stakes";
  if (signals.specificityScore < 12) return "weak-specificity";
  if (signals.curiosityScore < 12) return "weak-mystery";
  if (signals.consequenceScore < 12) return "weak-consequence";
  return "balanced-weak";
}

function buildMainTakeaway(
  script: string, hookScore: number, payoffStrength: number, retentionRisk: number,
  signals: UniversalSignals, structures: ScriptStructures
): string {
  const weakness = classifyPrimaryWeakness(hookScore, payoffStrength, retentionRisk, signals, structures);
  return hashPick(script + weakness, TAKEAWAY_TEMPLATES[weakness]);
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

  const scriptType = detectScriptType(text);

  // Normalize auto-caption transcripts before scoring
  const normalizedText = scriptType === "auto_caption_transcript"
    ? normalizeAutoCaptionScript(text)
    : text;
  const normalizedLines = scriptType === "auto_caption_transcript"
    ? createScriptLines(normalizedText)
    : lines;

  const firstSentence = normalizedText.split(/[.!?]/)[0]?.trim() ?? normalizedText.trim();
  const signals = extractUniversalSignals(normalizedText);
  const structures = detectScriptStructures(normalizedLines, normalizedText);

  const firstLower = firstSentence.toLowerCase();
  const bodyAfterHook = normalizedLines.slice(1).join(" ").toLowerCase();

  const hasVisualMysteryOpening =
    /\b(ship|boat|plane|camera|room|city|house|car|train|building|door|table|food|cargo|message|signal|footage)\b/i.test(firstSentence) &&
    /\b(found|discovered|drifting|empty|abandoned|open|untouched|still|gone|missing|disappeared|vanished|no signs|no emergency|no clear reason)\b/i.test(normalizedText) &&
    (
      /\b(still|untouched|gone|missing|disappeared|vanished|no signs|no emergency|no clear reason|every person|nobody|no one)\b/i.test(bodyAfterHook) ||
      /\bwith .{0,70} still\b/i.test(firstLower)
    );

  let hookScore = text.length > 0
    ? Math.max(18, clampScore(calculateHookStrength(firstSentence, signals, normalizedText)))
    : 0;

  if (hasVisualMysteryOpening && hookScore < 82) {
    hookScore = 82;
  }
  const structureRisk = calculateRetentionStructure(lines, signals, structures);
  const payoffStrength = calculatePayoffStrength(lines, signals);

  const payoffReduction = Math.min(payoffStrength * 0.10, 8);
  let retentionRisk = clampScore(Math.round(structureRisk - payoffReduction));

  if (structures.hasCapabilityViolation) {
    retentionRisk = Math.max(20, retentionRisk - 2);
  }

  if (structures.hasConsequenceProgression) {
    retentionRisk = Math.max(20, retentionRisk - 6);
  }

  if (retentionRisk < 20) retentionRisk = 20;

  // ── Hook + structure bonus: if hook is strong and escalation is detected,
  //    retention risk should not be High (≥65) ─────────────────────────────
const hasStructuredEscalation =
    structures.hasListBuildup ||
    structures.hasMysteryClueBuildup ||
    structures.hasContradictionReversal ||
    structures.hasConsequencePayoff ||
    structures.hasNumericPremise ||
    structures.hasExplanationChain ||
    structures.hasNarrativeArc ||
    structures.hasPersistenceArc ||
    structures.hasCapabilityViolation ||
    structures.hasAnomalySequence ||
    structures.hasConsequenceProgression;

  if (hookScore >= 70 && hasStructuredEscalation && retentionRisk >= 65) {
    retentionRisk = Math.min(retentionRisk, 58);
  }
  // Even with a decent hook (55+) and any buildup, cap at Medium
  if (hookScore >= 55 && hasStructuredEscalation && retentionRisk >= 65) {
    retentionRisk = Math.min(retentionRisk, 62);
  }

  const charCount = text.length;
  const hasNumericSpecificity = signals.specificityScore >= 30;
  const isShortSimple = charCount < 350 && totalLines <= 5;
  const isVeryShort = charCount < 130;

  const shortScriptSignalCount = [
    /\d/.test(text) && /\b(feet|miles|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|billion|million|thousand|degrees|\$)\b/i.test(text),
    structures.hasContradictionReversal || /\bbut\b|\bhowever\b|\bnot\b/i.test(text),
    signals.stakesScore >= 10,
    signals.consequenceScore >= 10 || structures.hasConsequencePayoff,
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(text),
  ].filter(Boolean).length;

  const isDenseDespiteShort = isVeryShort && shortScriptSignalCount >= 3;

 // Structure quality bonus — reward scripts that have valid escalation even if hook is weak.
  // This prevents a well-structured explanation chain or mystery from scoring very low
  // purely because the filler intro drags hook score down.
  const hasFillerOpener =
    structures.hasFillerIntro ||
    /^(today i|in this video|i will|i want to|let's talk|so today|hey guys|welcome|this video)/i.test(firstSentence);

  const hasGenericHookOpener =
    /\b(is very important|is important in|is possible for anyone|many people want|everyone wants|we all want|is the key to|takes hard work|success is|failure is|time is |life is )\b/i.test(firstSentence);

  const openingWindowText = extractOpeningWindow(lines);
  const openingWindowSignals = scoreOpeningWindow(openingWindowText);

  const openingWindowBonus =
    !hasFillerOpener && !hasGenericHookOpener
      ? Math.round(openingWindowSignals.windowStrength * 0.4)
      : 0;

  const effectiveHookScore = Math.min(88, hookScore + openingWindowBonus);

    const hookNeedsWork =
    !hasVisualMysteryOpening &&
    (
      effectiveHookScore < 58 ||
      hasFillerOpener ||
      hasGenericHookOpener ||
      (openingWindowSignals.hasScenarioOpener && !openingWindowSignals.scenarioHasStakes && effectiveHookScore < 55)
    );

  const hookIsAcceptable = !hookNeedsWork;
  const hookIsStrong = effectiveHookScore >= 70 && hookIsAcceptable;

  const displayHookScore = effectiveHookScore;

  const structureBonus =
    (structures.hasExplanationChain ? 6 : 0) +
    (structures.hasNumericPremise ? 4 : 0) +
    (structures.hasListBuildup ? 5 : 0) +
    (structures.hasMysteryClueBuildup ? 4 : 0) +
    (structures.hasContradictionReversal ? 4 : 0) +
    (structures.hasConsequencePayoff ? 3 : 0) +
    (structures.hasCapabilityViolation ? 4 : 0) +
    (structures.hasConsequenceProgression ? 4 : 0);
  // Cap bonus so it can't inflate a weak hook script into "Very Strong"
  const cappedStructureBonus = Math.min(structureBonus, 12);

  let overallScore = clampScore(
    Math.round(effectiveHookScore * 0.55 + (100 - retentionRisk) * 0.45 + cappedStructureBonus)
  );

  if (!hasNumericSpecificity && overallScore > 85) overallScore = 85;
  if (isShortSimple && !isDenseDespiteShort && overallScore > 82) overallScore = 82;
  if (isVeryShort && !isDenseDespiteShort && overallScore > 55) overallScore = 55;
  if (retentionRisk > 30 && overallScore > 88) overallScore = 88;
  if (payoffStrength < 40 && overallScore > 85) overallScore = 85;

  if (signals.genericPenalty >= 42) overallScore = Math.min(overallScore, 42);
  else if (signals.genericPenalty >= 28) overallScore = Math.min(overallScore, 52);
  else if (signals.genericPenalty >= 20) overallScore = Math.min(overallScore, 62);
  else if (signals.genericPenalty >= 12) overallScore = Math.min(overallScore, 72);

  // Keep extremely generic scripts weak, but avoid unusable edge scores.
  if (signals.genericPenalty >= 42) {
    overallScore = Math.max(overallScore, 15);
    retentionRisk = Math.min(retentionRisk, 90);
  }

  overallScore = clampScore(overallScore);

    if (hasVisualMysteryOpening) {
    if (overallScore < 72) overallScore = 72;
    if (retentionRisk > 45) retentionRisk = 45;
  }

  // ── Script-type calibration boosts ────────────────────────────────────────
  // These run AFTER the main score is computed and apply type-aware floors.

  // Viral challenge / giveaway: floor hook and overall when premise is clear.
  let calibratedHookScore = displayHookScore;

  if (scriptType === "viral_challenge" || scriptType === "giveaway_or_prize") {
    const firstLower2 = firstSentence.toLowerCase();
    const hasStakeInFirst =
      /\$[\d,]+|\b\d[\d,]* (dollars?|bucks|usd)\b/i.test(firstSentence) ||
      /\b(iphone|ipad|ps5|xbox|car|prize|giveaway|bet)\b/i.test(firstLower2) ||
      /\b(can you|impossible|wherever|whatever|whichever)\b/i.test(firstLower2);

    // If the first line has a clear challenge/stake signal, floor hook at 62
    if (hasStakeInFirst && calibratedHookScore < 62) {
      calibratedHookScore = 62;
    }

    const hasChallengePremise =
      /\$[\d,]+|\b\d[\d,]* (dollars?|bucks|usd)\b/i.test(normalizedText) ||
      /\b(iphone|ipad|ps5|xbox|car|prize|giveaway)\b/i.test(normalizedText.toLowerCase()) ||
      /\b(wherever|whatever|whichever).{3,40}\b(subscriber|person|country|city|name)\b/i.test(normalizedText.toLowerCase()) ||
      /\b(bet|challenge|impossible|can you)\b/i.test(normalizedText.toLowerCase());

    if (hasChallengePremise && overallScore < 58) {
      overallScore = 58;
    }
    if (hasChallengePremise && calibratedHookScore >= 55 && overallScore < 65) {
      overallScore = Math.max(overallScore, 63);
    }
  }

  // Emotional story: floor overall at 52 when emotional arc signals are present.
  // (stakesScore threshold lowered to 10 so emotional phrases from Patch 2 count)
  if (scriptType === "emotional_story") {
    if (overallScore < 52 && signals.stakesScore >= 10) {
      overallScore = 52;
    }
    // If the story has a clear named person + payoff arc, push to 55
    const hasNamedPersonAndArc =
      /\b[A-Z][a-z]{2,}\b/.test(text) &&
      /\b(years later|after becoming|changed (his|her|their) life|never forgot|went back|returned)\b/i.test(normalizedText.toLowerCase());
    if (hasNamedPersonAndArc && overallScore < 55) {
      overallScore = 55;
    }
  }

  // Auto-caption: reduce generic penalty impact (messy transcripts look generic)
  if (scriptType === "auto_caption_transcript") {
    if (overallScore < 50 && signals.genericPenalty < 42) {
      overallScore = Math.max(overallScore, 50);
    }
  }

  overallScore = clampScore(overallScore);

  // Final safety boundaries for non-empty scripts.
  if (text.length > 0) {
    overallScore = Math.max(15, overallScore);
    retentionRisk = Math.min(90, retentionRisk);
  }

  const hookRewriteSuggestion = createHookRewrite(text);

  // ── Hook status flags — drive risky parts, fixes, button label, scene breakdown ─
  // hookNeedsWork: the hook is weak enough that it should be the primary feedback.
  // hookIsAcceptable: the hook is decent; feedback should focus on middle/payoff.

  const isGoodScript = overallScore >= 70 && hookScore >= 65 && retentionRisk <= 35;
  const isStrongScript = overallScore >= 80;
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  type WeakArea = "hook" | "short" | "payoff" | "generic" | "middle" | "none";
  let primaryWeak: WeakArea = "none";
  if (isVeryShort || charCount < 180) {
    primaryWeak = "short";
  } else if (hookNeedsWork && effectiveHookScore < 45) {
    primaryWeak = "hook";
  } else if (signals.genericPenalty >= 20) {
    primaryWeak = "generic";
  } else if (payoffStrength < 28 && signals.consequenceScore < 15) {
    primaryWeak = "payoff";
  } else if (hookNeedsWork && effectiveHookScore < 65) {
    primaryWeak = "hook";
  }
  // If hookIsAcceptable, never set primaryWeak to "hook"

  const riskyParts: RiskyPart[] = [];
  const fixes: string[] = [];
  const riskyLineIndexes: number[] = [];
  const warningLineIndexes: number[] = [];

  const fixKeys = new Set<string>();
  function addFix(text: string) {
    const key = text.toLowerCase().slice(0, 60);
    if (!fixKeys.has(key)) {
      fixKeys.add(key);
      fixes.push(text);
    }
  }

  // ── Script-type context for risky parts ───────────────────────────────────
  const isViralOrGiveaway = scriptType === "viral_challenge" || scriptType === "giveaway_or_prize";
  const isEmotionalStory = scriptType === "emotional_story";

  // ── 1. Very short script ────────────────────────────────────────────────────
  if (charCount < 180) {
    riskyParts.push({
      time: createTimeRange(0.1, 0.8, duration),
      title: "Script may be too short.",
      description: "The idea may not feel developed enough before the ending.",
    });
    if (primaryWeak === "short") {
      addFix("Add one stronger example, specific detail, or consequence before the final payoff.");
      addFix("Include a number, result, or named reference to make the script feel grounded.");
      addFix("Expand the payoff — state clearly what changes, what was lost, or what the viewer should take away.");
    }
  }

  // Detect generic motivational endings before any risky part logic that depends on it.
  const lastLine = lines[totalLines - 1] ?? "";
  const lastLineLower = lastLine.toLowerCase();
 const lastLineWordCount2 = lastLine.split(/\s+/).filter(Boolean).length;
  const lastLineHasConcrete =
    /\d/.test(lastLine) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(lastLine) ||
    /\b\w+ed\b/i.test(lastLineLower) ||
    /\b(found|lost|went|came|got|gave|took|made|saw|ran|fell|grew|flew|broke|drove|woke|won|built|caught|said|sent|spoke|stood|wrote|heard|kept|knew|left|told|threw|thought)\b/i.test(lastLineLower);
  const lastLineIsStructurallyGeneric =
    !lastLineHasConcrete &&
    lastLineWordCount2 <= 12 &&
    /\b(is|are|will be|can be|was|were)\b/i.test(lastLineLower) &&
    /\b(possible|important|key|essential|necessary|real|true|good|great|better|best|amazing|powerful|possible|valuable|needed)\b/i.test(lastLineLower);

  const isGenericMotivationalEnding =
    /\b(possible for anyone|reach your goals|never give up|stay focused|hard work pays|believe in yourself|you can do it|keep working|keep going|just believe|work (hard|smart)|success takes|success is possible|everyone can|anyone can)\b/i.test(lastLineLower) ||
    (/\b(success|failure|life|time|things|people)\b/i.test(lastLineLower) &&
     /\b(is|are|will be|can be)\b/i.test(lastLineLower) &&
     !(/\d/.test(lastLine)) &&
     lastLine.split(/\s+/).length <= 10) ||
    lastLineIsStructurallyGeneric;

 // For viral/giveaway scripts with a clear premise, don't mark opening as weak
  const viralHasClearPremise =
    isViralOrGiveaway && (
      /\$[\d,]+|\b\d[\d,]* (dollars?|bucks|usd)\b/i.test(normalizedText) ||
      /\b(iphone|ipad|ps5|xbox|car|giveaway|wherever|whatever|whichever).{0,40}(lands?|wins?|gets?|keep)\b/i.test(normalizedText.toLowerCase()) ||
      /\b(bet|challenge|impossible|can you)\b/i.test(firstSentence.toLowerCase())
    );

 if (hookNeedsWork && effectiveHookScore < 45 && !viralHasClearPremise) {
    // Check if the script has a strong payoff/consequence that should be the hook
    // Do NOT label as "strong payoff" if the ending is generic/motivational — it is not a payoff worth moving
    if (!isGenericMotivationalEnding && (structures.hasStrongPayoffLate || structures.hasConsequencePayoff)) {
      riskyParts.push({
        time: createTimeRange(0, 0.25, duration),
        title: "Strong payoff appears too late.",
        description: "The opening announces the topic instead of leading with the strongest consequence or detail from the script.",
      });
    } else {
      const isLowStakesScenario = openingWindowSignals.hasScenarioOpener && !openingWindowSignals.scenarioHasStakes;
      riskyParts.push({
        time: createTimeRange(0, 0.25, duration),
        title: isLowStakesScenario ? "Opening lacks stakes or consequence." : "Weak opening.",
        description: isLowStakesScenario
          ? "The scenario creates an image but does not give viewers a strong reason to care. Add a consequence, mystery, or specific strange result."
          : "The first line may not stop viewers from swiping. It needs more curiosity, contrast, or a clear result.",
      });
    }
    riskyLineIndexes.push(0);
  } else if (hookNeedsWork && effectiveHookScore < 65) {
    warningLineIndexes.push(0);
  }
  // If hookIsAcceptable: never mark line 0 as risky or warning

  // No curiosity gap — only when hook is clearly weak (not just acceptable)
  if (hookNeedsWork && signals.curiosityScore < 12 && effectiveHookScore < 55) {
    if (!riskyParts.some(p => p.title === "Weak opening." || p.title === "Strong payoff appears too late.")) {
      riskyParts.push({
        time: createTimeRange(0, 0.3, duration),
        title: "No clear curiosity gap.",
        description: "The opening explains the topic but does not create enough tension or an unanswered question.",
      });
      if (!riskyLineIndexes.includes(0)) riskyLineIndexes.push(0);
    }
  }

  // ── 3. Generic/filler script ────────────────────────────────────────────────
  // Do not call a scenario-building script "generic" — use a more precise label.
  const hasScenarioStructure =
    openingWindowSignals.hasScenarioOpener ||
    /^(imagine|what if|picture this)\b/i.test(lines[0] ?? "");
  const genericLabel = hasScenarioStructure
    ? "Scenario lacks stakes or consequence."
    : "Script feels too generic.";
  const genericDescription = hasScenarioStructure
    ? "The scenario creates an image but the lines do not build toward a strong consequence, mystery, or specific tension."
    : "The lines repeat obvious ideas without a concrete example, number, twist, or consequence.";

  if (signals.genericPenalty >= 12 && overallScore < 72) {
    riskyParts.push({
      time: createTimeRange(0.2, 0.7, duration),
      title: genericLabel,
      description: genericDescription,
    });
    const midIdx = Math.floor(totalLines / 2);
    if (!riskyLineIndexes.includes(midIdx)) riskyLineIndexes.push(midIdx);
    if (totalLines > 3 && !riskyLineIndexes.includes(midIdx - 1)) {
      warningLineIndexes.push(midIdx - 1);
    }
  }

  // ── 4. Flat middle — only when structure detection confirms it ──────────────
  if (totalLines >= 5) {
    const middleLines = lines.slice(
      Math.floor(totalLines * 0.33),
      Math.floor(totalLines * 0.66)
    );
    const middleText = middleLines.join(" ").toLowerCase();
    const middleHasContrastSignal = [
      "but", "however", "then", "suddenly", "except", "actually",
      "the problem", "real problem", "if it", "that is why", "result",
    ].some(p => middleText.includes(p));

    // Use structure detection: list buildup and mystery buildup are NOT flat middle
    const middleIsStructured =
      structures.hasListBuildup ||
      structures.hasMysteryClueBuildup ||
      structures.hasContradictionReversal;

    const shortLineCount = middleLines.filter(l => l.split(/\s+/).length <= 7).length;
    const hasListBuildupPattern = shortLineCount >= 2;

    const postMiddleLines = lines.slice(Math.floor(totalLines * 0.66));
    const postMiddleText = postMiddleLines.join(" ").toLowerCase();
    const hasPostEscalation =
      postMiddleText.includes("now imagine") ||
      postMiddleText.includes("now think") ||
      postMiddleText.includes("millions") ||
      postMiddleText.includes("permanent") ||
      postMiddleText.includes("once it") ||
      postMiddleText.includes("everyone") ||
      postMiddleText.includes("the scary part") ||
      postMiddleText.includes("that is what") ||
      postMiddleText.includes("that is why");

    const middleFlat =
      !middleHasContrastSignal &&
      !hasListBuildupPattern &&
      !hasPostEscalation &&
      !middleIsStructured;

if (middleFlat && !isGoodScript && retentionRisk >= 35) {
      if (!riskyParts.some(p =>
        p.title === "Script feels too generic." ||
        p.title === "Middle may lose momentum."
      )) {
        // Give a more specific description based on what IS in the script
        const hasMystery = structures.hasMysteryClueBuildup;
        const description = hasMystery
          ? "The mystery buildup works, but the strongest clue could appear earlier to create a faster curiosity gap."
          : "No contrast, escalation, or new tension was found in the middle section.";

        riskyParts.push({
          time: createTimeRange(0.35, 0.65, duration),
          title: "Middle may lose momentum.",
          description,
        });
      }
      const midI = Math.floor(totalLines / 2);
      if (!riskyLineIndexes.includes(midI)) riskyLineIndexes.push(midI);
    }
  }

  // ── 5. Payoff / ending ──────────────────────────────────────────────────────
  // IMPORTANT: If the last line IS a strong consequence, don't call it weak payoff.
  // Instead, check if the issue is placement (strong payoff but hook was weak).
  // lastLine, lastLineLower, and isGenericMotivationalEnding are already declared above.

  const lastLineIsStrong =
    !isGenericMotivationalEnding && (
    // consequence / behavioral outcome (universal)
    /training your (brain|mind|body)|controls (your|how)|permanent/.test(lastLineLower) ||
    /you do not control|you lose control|once it (is|becomes|goes)/.test(lastLineLower) ||
    // continuation / unstoppable force (universal)
    /keeps (going|moving|running|working|growing|building|compounding)/.test(lastLineLower) ||
    // identity / social consequence (universal)
    /says (about|something about) (you|them|us)|how (people|everyone|others) (see|look|judge)/.test(lastLineLower) ||
    /what you (are|become|represent)|proof that (you|they|it)/.test(lastLineLower) ||
    // explanation chain endings (universal)
    /it is not (just|only|about)|the (real|actual|true) (reason|problem|issue|point)/.test(lastLineLower) ||
    /the (scary|strange|crazy|interesting|surprising|remarkable) part/.test(lastLineLower) ||
    /the whole (point|story|picture|idea)/.test(lastLineLower) ||
    // causal wrap-up (universal)
    /that is (why|what|how|when) (it|this|the|your|everything)/.test(lastLineLower) ||
    /not for the reason|not (what|how|why) (most|many|you)/.test(lastLineLower) ||
    // structure-level confirmation (only when not generic motivational)
    structures.hasConsequencePayoff
    );

  if (
    (payoffStrength < 28 && signals.consequenceScore < 15 && wordCount >= 20 && !isGoodScript && !lastLineIsStrong) ||
    (isGenericMotivationalEnding && !isGoodScript)
  ) {
    riskyParts.push({
      time: createTimeRange(0.75, 1.0, duration),
      title: isGenericMotivationalEnding ? "Weak or generic payoff." : "Payoff could be stronger.",
      description: isGenericMotivationalEnding
        ? "The ending is too vague to feel rewarding. Replace it with a specific consequence, result, or unresolved detail."
        : "The ending may not feel rewarding. A clearer result or consequence would help.",
    });
    riskyLineIndexes.push(Math.max(0, totalLines - 1));
  }

  // If hook needs work but ending IS strong: label as placement issue
  // Do NOT run when the ending is generic/motivational — isGenericMotivationalEnding already
  // sets lastLineIsStrong to false, but guard explicitly here for clarity and safety.
  if (
    !isGenericMotivationalEnding &&
    lastLineIsStrong &&
    hookNeedsWork &&
    effectiveHookScore < 55 &&
    !riskyParts.some(p => p.title === "Strong payoff appears too late.")
  ) {
    // Replace generic "Weak opening" with placement-specific feedback
    const weakOpeningIdx = riskyParts.findIndex(p => p.title === "Weak opening.");
    if (weakOpeningIdx >= 0) {
      riskyParts[weakOpeningIdx] = {
        time: riskyParts[weakOpeningIdx].time,
        title: "Strong payoff appears too late.",
        description: "The strongest consequence is at the end but not in the opening. Move it earlier to stop the scroll.",
      };
    }
  }

// ── 6. No open loop (very weak scripts only, and only when no valid structure) ──
  // Also suppress when the middle contains concrete scale, named references,
  // or explanatory content — these are not "no reason to keep watching".
  const middleSectionText = lines.slice(
    Math.floor(totalLines * 0.25),
    Math.floor(totalLines * 0.75)
  ).join(" ");
  const middleHasConcreteContent =
    /\d/.test(middleSectionText) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(middleSectionText) ||
    /\b(feet|miles|mph|kph|percent|%|seconds|minutes|hours|days|years|meters|billion|million|thousand|degrees)\b/i.test(middleSectionText) ||
    /\b(would|could) (disappear|fit|vanish|be hidden|be buried|be submerged|still have)\b/i.test(middleSectionText) ||
    /\bmore than (a mile|a kilometer|a foot|a meter|a year)\b/i.test(middleSectionText) ||
    hasStructuredEscalation;

  if (
    signals.openLoopScore === 0 &&
    signals.curiosityScore < 12 &&
    signals.contrastScore < 15 &&
    wordCount >= 35 &&
    overallScore < 58 &&
    !hasStructuredEscalation &&
    !middleHasConcreteContent &&
    !isViralOrGiveaway &&
    !isEmotionalStory
  ) {
    if (!riskyParts.some(p => p.title === "No reason to keep watching.")) {
      riskyParts.push({
        time: createTimeRange(0.3, 0.6, duration),
        title: "No reason to keep watching.",
        description: "The script may not give viewers enough curiosity or unresolved tension before the payoff.",
      });
    }
  }

  // ── 7. Filler phrases ────────────────────────────────────────────────────────
  const fluffPhrases = [
    "basically", "as you can see", "i just want to", "this is very important",
    "let's talk about", "i'm going to explain", "really important",
  ];
  if (fluffPhrases.some(p => lower.includes(p))) {
    if (!riskyParts.some(p => p.title === "Script feels too generic." || p.title === "Possible filler phrases.")) {
      riskyParts.push({
        time: createTimeRange(0.3, 0.6, duration),
        title: "Possible filler phrases.",
        description: "Some lines may sound like setup instead of real value.",
      });
    }
  }

  // ── 8. Script too long ──────────────────────────────────────────────────────
  if (charCount > 850) {
    riskyParts.push({
      time: createTimeRange(0.55, 0.85, duration),
      title: "Script may be too long.",
      description: "Viewers may lose focus before the ending.",
    });
  }

  // ── Build fixes — context-aware, not generic ────────────────────────────────

  // Script-type-specific fixes (prepended before generic logic)
  if (isViralOrGiveaway) {
    const lowerNorm = normalizedText.toLowerCase();
    const hasCTAInterrupt =
      /\b(subscribe|follow|hit subscribe|smash subscribe)\b/i.test(lowerNorm) &&
      normalizedLines.length >= 4 &&
      normalizedLines.slice(0, Math.floor(normalizedLines.length * 0.8)).some(l =>
        /\b(subscribe|follow)\b/i.test(l.toLowerCase())
      );
    if (hasCTAInterrupt) {
      addFix("Move the subscribe CTA to after the payoff — placing it before the challenge resolves may cause viewers to drop.");
    }
    if (payoffStrength < 40) {
      addFix("Add one clear consequence: what happens if the challenge fails or succeeds?");
    }
    if (!structures.hasConsequencePayoff && wordCount > 30) {
      addFix("Make the challenge outcome clearer before any CTA — viewers need to know if it worked.");
    }
  }

  if (isEmotionalStory) {
    if (payoffStrength < 35) {
      addFix("Make the emotional payoff more specific — what exactly changed, and how does the viewer feel the impact?");
    }
    if (hookNeedsWork && effectiveHookScore < 65) {
      addFix("Open with the most emotional or unexpected moment from the story — not just the setup.");
    }
    if (signals.specificityScore < 20) {
      addFix("Add one specific named detail, place, or action to make the story feel real rather than general.");
    }
  }

  // Primary weakness fix — only add hook rewrites when hook actually needs work
  if (primaryWeak === "hook" && hookNeedsWork && effectiveHookScore < 65) {
    if (structures.hasStrongPayoffLate || structures.hasConsequencePayoff) {
      // The consequence exists — just needs to move forward
      addFix("Lead with the consequence: move your strongest final line to the very beginning.");
   } else if (structures.hasMysteryClueBuildup) {
      // Universal: mystery/clue script — find the most concrete physical detail line
      const strongestMysteryClue = lines.slice(1).find(l => {
        const ll = l.toLowerCase();
        const wordCount = l.split(/\s+/).length;
        // A good clue line: concrete object/state + not too long + not a vague summary
        return wordCount >= 5 && wordCount <= 18 &&
          (ll.includes("still") || ll.includes("untouched") || ll.includes("left behind") ||
           ll.includes("no signs") || ll.includes("nothing was") || ll.includes("everything was") ||
           ll.includes("appeared") || ll.includes("looked like") || ll.includes("seemed"));
      });
      if (strongestMysteryClue) {
        addFix(`Open with the most specific physical detail: "${strongestMysteryClue.replace(/[.!?]+$/, "").trim()}" creates more tension than announcing the topic.`);
      } else {
        addFix("Open with the most specific clue or physical detail from the script instead of announcing the topic.");
      }
    } else {
      addFix("Rewrite the opening line — it should lead with the strongest detail, consequence, or contrast from your script, not just announce the topic.");
    }
  }
  if (primaryWeak === "generic") {
    addFix("Replace generic advice lines with a single concrete example, number, or real consequence.");
    addFix("Cut any sentence that could apply to any video — only keep lines specific to this topic.");
  }
  if (primaryWeak === "payoff") {
    addFix("Make the final payoff more specific — state the result, consequence, or unresolved mystery clearly.");
  }

  // Supporting fixes — only add hook-focused fixes when hook needs work
  if (hookNeedsWork && signals.curiosityScore < 12 && effectiveHookScore < 55) {
    addFix("Open with an unanswered question, a missing detail, or a surprising consequence.");
  }

  // Only suggest "add contrast" if the script truly lacks contrast AND escalation
  if (
    signals.contrastScore < 12 &&
    signals.openLoopScore < 12 &&
    !hasStructuredEscalation &&
    wordCount > 20 &&
    overallScore < 58
  ) {
    addFix('Add a contrast line mid-script — something like: "But that is not the real problem."');
  }

  if (signals.genericPenalty >= 12 && overallScore < 72) {
    addFix("Add one specific detail, number, named reference, or real-world example to make the script feel grounded.");
  }
  if (
    signals.stakesScore < 12 &&
    signals.consequenceScore < 10 &&
    wordCount >= 25 &&
    overallScore < 62
  ) {
    addFix("Raise the stakes: what is at risk, what was lost, or what changes if this is ignored?");
  }
  if (signals.specificityScore < 10 && wordCount >= 20 && overallScore < 70) {
    addFix("Add a more concrete detail, example, consequence, or measurable result to make the script feel grounded.");
  }

  // Payoff fix — only if last line is NOT already a strong consequence
  if (
    payoffStrength < 28 &&
    signals.consequenceScore < 15 &&
    wordCount >= 20 &&
    !isGoodScript &&
    !lastLineIsStrong &&
    primaryWeak !== "payoff"
  ) {
    addFix("Make the final payoff more specific — state the result, consequence, or unresolved mystery clearly.");
  }

  // If the last line IS strong but hook is weak — suggest moving it
  if (lastLineIsStrong && effectiveHookScore < 55 && !fixes.some(f => f.toLowerCase().includes("lead with"))) {
    addFix("Lead with your strongest consequence: the final line of your script would make a more powerful opening.");
  }

 if (
    hookNeedsWork &&
    signals.openLoopScore === 0 &&
    signals.curiosityScore < 12 &&
    signals.contrastScore < 15 &&
    !hasStructuredEscalation &&
    !middleHasConcreteContent &&
    wordCount >= 35 &&
    overallScore < 58
  ) {
    addFix("Add an unanswered question or a delayed reveal to keep viewers engaged through the middle.");
  }
  if (fluffPhrases.some(p => lower.includes(p))) {
    addFix("Replace filler phrases with a specific example, concrete consequence, or direct insight.");
  }
  if (charCount < 180 && primaryWeak !== "short") {
    addFix("Add one stronger example or consequence before the final payoff.");
  }
  if (charCount > 850) {
    addFix("Cut repeated explanations and keep only the strongest points.");
  }

 // Hook fix for medium-score scripts — only when hook actually needs work
  if (hookNeedsWork && effectiveHookScore < 65 && primaryWeak !== "hook" && !fixes.some(f => f.toLowerCase().includes("rewrite") || f.toLowerCase().includes("opening line") || f.toLowerCase().includes("lead with"))) {
    addFix("Rewrite the opening line — lead with the strongest consequence, number, or contradiction from the script.");
  } else if (hookIsAcceptable && effectiveHookScore < 75 && !isGoodScript && retentionRisk > 35) {
    addFix("Tighten the middle section — each line should add new information or tension.");
  }

  // Optional improvements for good-but-not-great scripts
  if (isGoodScript && !isStrongScript) {
    if (fixes.length === 0) {
      if (hookScore >= 65 && retentionRisk <= 35) {
        addFix("Add one more specific example, number, or concrete detail to make the payoff feel more earned.");
        addFix("Make the payoff more specific so the viewer feels clearly rewarded.");
        addFix("Tighten any line that does not add new information or tension.");
      } else {
        if (hookScore < 75) addFix("Sharpen the first line with a stronger curiosity gap or clearer contrast.");
        if (signals.specificityScore < 30) addFix("Add one more specific detail to make the payoff feel even more concrete.");
        if (fixes.length === 0) addFix("Tighten any line that does not add new information or tension.");
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
    const isGenericLine = signals.genericPenalty >= 12 && [
      "you should", "you need to", "this will help", "make sure",
      "try to", "get better", "improve your",
    ].some(p => ll.includes(p));
    if (isMediumLength || isVague || hasWarningPhrase || isGenericLine) {
      warningLineIndexes.push(index);
    }
  });

  // ── Deduplicate + sort ─────────────────────────────────────────────────────
  riskyParts.sort((a, b) => {
    const getStart = (timeStr: string) => {
      const match = timeStr.match(/(\d+):(\d+)/);
      return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
    };
    return getStart(a.time) - getStart(b.time);
  });

  function getStartSeconds(timeStr: string): number {
    const match = timeStr.match(/(\d+):(\d+)/);
    return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
  }

  const mergedRiskyParts: RiskyPart[] = [];
  for (const part of riskyParts) {
    const partStart = getStartSeconds(part.time);
    const overlapping = mergedRiskyParts.findIndex(existing => {
      const existingStart = getStartSeconds(existing.time);
      return Math.abs(partStart - existingStart) <= 3;
    });
    if (overlapping === -1) {
      mergedRiskyParts.push(part);
    } else {
      const existing = mergedRiskyParts[overlapping];
      if (part.title.length > (existing?.title.length ?? 0)) {
        mergedRiskyParts[overlapping] = part;
      }
    }
  }

  let uniqueRiskyParts = dedupeRiskyParts(mergedRiskyParts);
  let uniqueFixes = fixes.slice(0, 5);
  const uniqueRiskyIndexes = [...new Set(riskyLineIndexes)]
    .filter(i => i >= 0 && i < totalLines)
    .sort((a, b) => a - b);
  const uniqueWarningIndexes = [...new Set(warningLineIndexes)]
    .filter(i => i >= 0 && i < totalLines && !uniqueRiskyIndexes.includes(i))
    .sort((a, b) => a - b);

  // ── Enforce minimums for weak scripts ─────────────────────────────────────
  if (overallScore < 58) {
    const alreadyHasOpeningPart = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("weak opening") ||
      p.title.toLowerCase().includes("hook needs") ||
      p.title.toLowerCase().includes("curiosity gap") ||
      p.title.toLowerCase().includes("too short") ||
      p.title.toLowerCase().includes("strong payoff appears")
    );
    if (uniqueRiskyParts.length < 2 && effectiveHookScore < 65 && !alreadyHasOpeningPart) {
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
      if (hookNeedsWork && effectiveHookScore < 65 && !uniqueFixes.some(f => f.toLowerCase().includes("rewrite") || f.toLowerCase().includes("sharpen") || f.toLowerCase().includes("opening line") || f.toLowerCase().includes("lead with"))) {
        uniqueFixes.push("Rewrite the opening line — lead with the strongest consequence, contrast, or specific detail from your script.");
      } else if (!uniqueFixes.some(f => f.toLowerCase().includes("sharpen") || f.toLowerCase().includes("tighten") || f.toLowerCase().includes("payoff"))) {
        uniqueFixes.push("Make the payoff more specific so the viewer feels rewarded.");
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
    uniqueFixes = [...new Set(uniqueFixes)].slice(0, 5);
  } else if (overallScore < 75) {
    const alreadyHasOpeningPartMid = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("weak opening") ||
      p.title.toLowerCase().includes("hook needs") ||
      p.title.toLowerCase().includes("curiosity gap") ||
      p.title.toLowerCase().includes("strong payoff appears")
    );
    if (uniqueRiskyParts.length < 1 && uniqueFixes.length > 0) {
      if (effectiveHookScore < 65 && !alreadyHasOpeningPartMid) {
        uniqueRiskyParts.push({
          time: createTimeRange(0, 0.25, duration),
          title: "Hook needs more work.",
          description: "The opening does not clearly create curiosity, contrast, or a reason to stay.",
        });
        if (!uniqueRiskyIndexes.includes(0)) uniqueRiskyIndexes.push(0);
      } else if (signals.genericPenalty >= 12) {
        uniqueRiskyParts.push({
          time: createTimeRange(0.2, 0.7, duration),
          title: "Script feels too generic.",
          description: "The lines repeat obvious ideas without a concrete example, number, or consequence.",
        });
      } else if (payoffStrength < 35 && !lastLineIsStrong) {
        uniqueRiskyParts.push({
          time: createTimeRange(0.75, 1.0, duration),
          title: "Payoff could be stronger.",
          description: "The ending may not feel rewarding. A clearer result or consequence would help.",
        });
        uniqueRiskyIndexes.push(Math.max(0, totalLines - 1));
      }
    }
    if (uniqueFixes.length < 2) {
      if (hookNeedsWork && effectiveHookScore < 68 && !uniqueFixes.some(f => f.toLowerCase().includes("sharpen") || f.toLowerCase().includes("rewrite") || f.toLowerCase().includes("lead with"))) {
        uniqueFixes.push("Sharpen the first line with a stronger curiosity gap or clearer contrast.");
      }
      if (signals.contrastScore < 15 && signals.openLoopScore < 15 && !uniqueFixes.some(f => f.toLowerCase().includes("contrast") || f.toLowerCase().includes("turn"))) {
        uniqueFixes.push("Add a contrast or unexpected turn in the middle section.");
      }
      if (signals.payoffScore < 20 && signals.consequenceScore < 15 && !lastLineIsStrong && !uniqueFixes.some(f => f.toLowerCase().includes("payoff") || f.toLowerCase().includes("result"))) {
        uniqueFixes.push("End with a specific result, consequence, or unresolved detail the viewer will remember.");
      }
      if (uniqueFixes.length < 2) {
        uniqueFixes.push("Make each line earn its place — cut any sentence that does not add new information or tension.");
      }
    }
    uniqueRiskyParts = dedupeRiskyParts(uniqueRiskyParts);
    uniqueFixes = [...new Set(uniqueFixes)].slice(0, 5);
  }

 if (uniqueRiskyParts.length === 0 && overallScore >= 80) {
    uniqueFixes.length = 0;
    uniqueRiskyIndexes.length = 0;
    uniqueWarningIndexes.length = 0;
  }

  // If risky parts exist but fixes are empty, add at least one specific fix.
  // This prevents "No fixes needed" from appearing alongside risky parts.
  if (uniqueRiskyParts.length > 0 && uniqueFixes.length === 0) {
    const hasPayoffIssue = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("payoff") ||
      p.title.toLowerCase().includes("generic payoff") ||
      p.title.toLowerCase().includes("weak or generic")
    );
    const hasHookIssue = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("hook") ||
      p.title.toLowerCase().includes("opening") ||
      p.title.toLowerCase().includes("curiosity gap")
    );
    const hasMiddleIssue = uniqueRiskyParts.some(p =>
      p.title.toLowerCase().includes("middle") ||
      p.title.toLowerCase().includes("momentum")
    );
    if (hasPayoffIssue) {
      uniqueFixes.push("Replace the final line with a specific consequence, result, or unresolved detail that rewards viewers for watching.");
    }
    if (hasHookIssue && !uniqueFixes.some(f => f.toLowerCase().includes("opening") || f.toLowerCase().includes("hook"))) {
      uniqueFixes.push("Sharpen the opening line with a stronger curiosity gap, contrast, or concrete detail.");
    }
    if (hasMiddleIssue && !uniqueFixes.some(f => f.toLowerCase().includes("middle") || f.toLowerCase().includes("tension"))) {
      uniqueFixes.push("Tighten the middle section — each line should add new information or tension.");
    }
    if (uniqueFixes.length === 0) {
      uniqueFixes.push("Make each line earn its place — cut any sentence that does not add new information or tension.");
    }
  }

  const hasEndingFlagged = uniqueRiskyParts.some(p =>
    p.title.toLowerCase().includes("payoff") ||
    p.title.toLowerCase().includes("too long") ||
    p.title.toLowerCase().includes("drop-off")
  );

  const sceneSegments = createSceneSegments(
    effectiveHookScore,
    retentionRisk,
    overallScore,
    uniqueRiskyParts.length > 0,
    hasEndingFlagged,
    uniqueFixes.length,
    payoffStrength,
    structures,
  );

  const issueTitles = uniqueRiskyParts.map(p => p.title.toLowerCase());
  const mainTakeaway = buildMainTakeaway(text, calibratedHookScore, payoffStrength, retentionRisk, signals, structures);

  return {
    overall: {
      score: overallScore,
      label: getOverallLabel(overallScore),
      color: "#FFFFFF",
      ringColor: overallScore >= 75 ? "#22C55E" : overallScore >= 60 ? "#F59E0B" : "#EF4444",
      description: mainTakeaway,
    },
    hook: {
      score: calibratedHookScore,
      label: getHookLabel(calibratedHookScore),
      color: getHookColor(calibratedHookScore),
      ringColor: getHookColor(calibratedHookScore),
      description: getHookDescription(calibratedHookScore, issueTitles, structures),
    },
    risk: {
      score: retentionRisk,
      label: getRiskLabel(retentionRisk),
      color: getRiskColor(retentionRisk),
      ringColor: getRiskColor(retentionRisk),
      description: getRiskDescription(retentionRisk, issueTitles, structures, signals.genericPenalty),
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
  structures?: ScriptStructures,
): SceneSegment[] {
  const totalWidth = 1110;

  // ── Opening segment color ─────────────────────────────────────────────────
  // Use 70 as the threshold for green ("Strong hook") so that a score of 60
  // (Average) shows yellow ("Average hook") instead of green, keeping the
  // scene breakdown consistent with the hook score card.
  const hookAcceptableForScene = hookScore >= 70 && !(structures?.hasFillerIntro ?? false);

  const openingColor: string =
    hookAcceptableForScene ? "#22C55E"
    : hookScore < 50 ? "#EF4444"
    : "#F59E0B";

  // ── Middle segment color ──────────────────────────────────────────────────
  // If structure detection shows valid escalation (list buildup, mystery clue
  // buildup, or contradiction), do not color middle as risky even if riskScore
  // is elevated. The elevated risk comes from the hook, not the middle.
  const hasValidMiddleStructure =
    structures?.hasListBuildup ||
    structures?.hasMysteryClueBuildup ||
    structures?.hasContradictionReversal ||
    structures?.hasNumericPremise ||
    structures?.hasExplanationChain ||
    structures?.hasNarrativeArc ||
    structures?.hasPersistenceArc ||
    structures?.hasCapabilityViolation ||
    structures?.hasAnomalySequence ||
    structures?.hasConsequenceProgression;

  const effectiveMiddleRisk = hasValidMiddleStructure
    ? Math.min(riskScore, 44)  // cap middle color at "Average" if structure is valid
    : riskScore;

  const middleColor: string =
    effectiveMiddleRisk >= 60 ? "#EF4444"
    : effectiveMiddleRisk >= 35 ? "#F59E0B"
    : "#22C55E";

  // ── Ending segment color ──────────────────────────────────────────────────
  const endingColor: string =
    hasEndingFlagged && riskScore >= 45 ? "#EF4444"
    : hasEndingFlagged || (overallScore < 75 && fixCount > 0) || payoffStrength < 40 ? "#F59E0B"
    : overallScore >= 75 && riskScore < 35 && !hasRiskyParts ? "#22C55E"
    : "#F59E0B";

  // ── Labels — use distinct names to prevent duplicate legend entries ────────
  // Opening: Hook / Average Hook / Weak Hook
  const openingLabel =
    openingColor === "#EF4444" ? "Weak hook"
    : openingColor === "#F59E0B" ? "Average hook"
    : "Strong hook";

  const middleLabel =
    middleColor === "#EF4444" ? "Risky middle"
    : middleColor === "#F59E0B"
      ? (structures?.hasExplanationChain || structures?.hasNumericPremise
          ? "Explanation"
          : hasValidMiddleStructure
          ? "Buildup"
          : "Average middle")
      : (structures?.hasExplanationChain || structures?.hasNumericPremise
          ? "Explanation"
          : hasValidMiddleStructure
          ? "Buildup"
          : "Strong middle");

  const endingLabel =
    endingColor === "#EF4444" ? "Drop-off risk"
    : endingColor === "#F59E0B" ? "Average ending"
    : "Strong ending";

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
  let hasOpeningIssue = false;
  const openingKeywords = ["weak opening", "hook needs", "curiosity gap", "no clear curiosity", "opening does not"];
  return parts.filter(part => {
    const key = part.title.toLowerCase();
    const isOpeningIssue = openingKeywords.some(k => key.includes(k));
    if (isOpeningIssue) {
      if (hasOpeningIssue) return false;
      hasOpeningIssue = true;
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Hook rewrite (fallback) ─────────────────────────────────────────────────

// ─── Hook rewrite (fallback) ─────────────────────────────────────────────────

function createHookRewrite(script: string): string {
  const allLines = script
    .split(/[\n.!?]/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const firstLine = allLines[0] ?? "";
  const bodyLines = allLines.slice(1);
  const fullText = allLines.join(" ").toLowerCase();
  const firstLower = firstLine.toLowerCase();

  // ── Detect filler intro ────────────────────────────────────────────────────
  const isFillerIntro =
    firstLower.startsWith("today i") || firstLower.startsWith("in this video") ||
    firstLower.startsWith("i will") || firstLower.startsWith("i want to") ||
    firstLower.startsWith("let's talk") || firstLower.startsWith("so today") ||
    firstLower.startsWith("hey guys") || firstLower.startsWith("welcome") ||
    firstLower.startsWith("this video");

// ── Generic script guard ──────────────────────────────────────────────────
  // If the script has no concrete material, do not invent a fake hook.
  // Return a diagnostic message instead, consistent with the API response.
  
  function clientLineHasHardAnchor(line: string): boolean {
    const ll = line.toLowerCase();

    // Generic-advice lines never count as hard anchors (mirrors API guard).
    const CLIENT_GENERIC_ADVICE_PATTERNS: RegExp[] = [
      /\bwork(s|ed|ing)? hard\b/i,
      /\bevery\s*day\b/i,
      /\bdaily\b/i,
      /\bnever give up\b/i,
      /\bstay focus(ed)?\b/i,
      /\bkeep going\b/i,
      /\bbelieve in yourself\b/i,
      /\bsuccess is possible\b/i,
      /\bmotivation is\b/i,
      /\bdiscipline is\b/i,
      /\bconsistency is key\b/i,
      /\bis (the )?key to\b/i,
      /\bis (very |extremely |really |truly )?important\b/i,
      /\bis possible for anyone\b/i,
      /\byou (should|must|need to|have to) (work|try|stay|keep|believe|focus|push)\b/i,
      /\bif you keep going\b/i,
      /\byou (can|will) succeed\b/i,
      /\bwants? to (stay|be|feel) (motivated|focused|disciplined|inspired)\b/i,
    ];
    const matchesAdvice = CLIENT_GENERIC_ADVICE_PATTERNS.some(p => p.test(line));
    const hasRealAnchorDespiteAdvice =
      /\d/.test(line) ||
      /[a-z,]\s+[A-Z][a-z]{2,}/.test(line) ||
      /\$\s*\d/.test(line);
    if (matchesAdvice && !hasRealAnchorDespiteAdvice) return false;

    if (/\d/.test(line)) return true;
    if (/[a-z,]\s+[A-Z][a-z]{2,}/.test(line)) return true;
    if (/\b(percent|%|mile|miles|foot|feet|meter|meters|km|second|seconds|minute|minutes|hour|hours|degree|degrees|mph|kph|billion|million|thousand|dollar|\$)\b/i.test(ll)) return true;
    if (/\d\s*(days?|weeks?|years?)\b/i.test(line)) return true;
    if (/\b(because|therefore|as a result|which means|led to|resulted in|caused|triggered|due to)\b/i.test(ll)) return true;
    const _cln = /\b(table|chair|floor|wall|door|window|room|building|school|hospital|street|road|ship|boat|car|truck|plane|phone|screen|camera|footage|image|photo|food|fire|smoke|blood|hand|face)\b/i.test(ll);
    const _natln = /\b(mountain|ocean|river|lake|forest|water|body)\b/i.test(ll);
    const _staticln = /^[a-z\s,]+ (is|are|was|were) (a |an |the |very |extremely |really |so |quite )?\w/i.test(line);
    if (_cln) return true;
    if (_natln && !_staticln) return true;
    if (/\b(found|went|came|gave|took|saw|ran|fell|grew|flew|broke|drove|woke|won|built|bought|caught|dug|drew|drank|ate|fought|heard|held|led|lit|met|paid|shook|shot|slept|spoke|stood|stole|swam|taught|threw|thought|wrote)\b/i.test(ll)) return true;
    const CLIENT_STATIVE = new Set([
      "focused","motivated","inspired","excited","tired","worried","scared",
      "bored","stressed","frustrated","confused","determined","dedicated",
      "committed","interested","pleased","surprised","shocked","amazed",
      "disappointed","satisfied","annoyed","relaxed","concerned","involved",
      "attached","related","required","needed","expected","supposed","based",
      "used","blessed","gifted","skilled","talented","valued","named","called",
      "considered","regarded","known","designed","intended","allowed",
      "believed","understood",
    ]);
    const edMatches = ll.match(/\b(\w+)ed\b/g) ?? [];
    return edMatches.some(m => !CLIENT_STATIVE.has(m) && m.replace(/ed$/, "").length >= 4);
  }
  const allConcrete = allLines.filter(line => clientLineHasHardAnchor(line));
  if (allConcrete.length === 0 && allLines.length >= 3) {
    // Extract topic word for grounded diagnostic
    const firstWords = firstLine.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    const stopWords = new Set(["is","are","was","the","a","an","in","on","at","of","to","and","but","or","for","with","this","that","very","so","it","its","i","we","you","they"]);
    const topicWord = firstWords.find(w => !stopWords.has(w) && w.length >= 4) ?? "";
    const capitalizedTopic = topicWord ? topicWord.charAt(0).toUpperCase() + topicWord.slice(1) : "";
    return capitalizedTopic.length > 0
      ? `The script about ${capitalizedTopic} needs one specific example, result, or consequence before the hook can feel strong.`
      : "This script needs one specific example, result, or consequence before the hook can feel strong.";
  }

  // ── Step 0: scenario opener + final payoff combination ───────────────────
  // For "Imagine X / What if X" scripts, the strongest hook combines the opening
  // scenario premise with the final payoff/realization line.
  // E.g. "Imagine the world went silent for one minute" + "Even silence has a sound"
  // → "What if the world went silent for one minute — and even silence has a sound?"
  const isScenarioOpener =
    /^(imagine|what if|picture this)\b/i.test(firstLower);
  if (isScenarioOpener && bodyLines.length >= 3) {
    const finalPayoffLine = bodyLines[bodyLines.length - 1] ?? "";
    const secondToLastLine = bodyLines[bodyLines.length - 2] ?? "";
    // Pick the last line as payoff candidate — prefer it if it's a realization/paradox/twist
    const candidatePayoff = finalPayoffLine.trim();
    const candidateWc = candidatePayoff.split(/\s+/).length;
    const payoffLower = candidatePayoff.toLowerCase();
    const isStrongFinalLine =
      candidateWc >= 4 && candidateWc <= 14 &&
      !payoffLower.startsWith("but") && // avoid "But then you would notice..."
      (
        // Paradox / realization patterns
        /\b(never|always|still|even|only|just|yet)\b/i.test(candidatePayoff) ||
        // Identity / reversal
        /\b(has|have|is|are) (a|an|the)?\s*\w+/i.test(candidatePayoff) ||
        // Short punchy conclusion
        candidateWc <= 8
      );
    if (isStrongFinalLine) {
      // Extract the scenario premise from the first line (trim "Imagine" / "What if")
      const premiseCleaned = firstLine
        .replace(/^(imagine|what if|picture this)[,.]?\s*/i, "")
        .replace(/[.!?]+$/, "")
        .trim();
      const payoffCleaned = candidatePayoff.replace(/[.!?]+$/, "").trim().toLowerCase();
      const premiseWc = premiseCleaned.split(/\s+/).length;
      if (premiseWc >= 4 && premiseWc <= 14) {
        return `What if ${premiseCleaned.toLowerCase()} — and ${payoffCleaned}?`;
      }
    }
  }

  // ── Step 1: specific number + measurement unit (universal — any niche) ────
  // Priority: any body sentence with a specific number + named unit.
  const numberSentence = bodyLines.find(line => {
    return /\d[\d,]*(?:\.\d+)?/.test(line) &&
      /\b(feet|foot|miles|mile|mph|kph|km\/h|percent|%|seconds|minutes|hours|days|years|meters|kilograms|pounds|degrees|times|billion|million|thousand)\b/i.test(line);
  });
  if (numberSentence) {
    const cleaned = numberSentence.replace(/[.!?]+$/, "").trim();
    const wordCount = cleaned.split(/\s+/).length;
    if (wordCount <= 20) {
      return capitalizeFirst(cleaned) + ".";
    }
    return capitalizeFirst(cleaned.split(/\s+/).slice(0, 16).join(" ")) + ".";
  }

  // ── Step 2: strong consequence / payoff in the last third (universal) ─────
  // Any line that states what changes, what is lost, or what the outcome is.
  const totalBodyLines = bodyLines.length;
  const lastThirdStart = Math.floor(totalBodyLines * 0.6);
  const lastThirdLines = bodyLines.slice(lastThirdStart);

  const consequenceLine = lastThirdLines.find(line => {
    const ll = line.toLowerCase();
    const wc = line.split(/\s+/).length;
    return wc >= 5 && wc <= 22 && (
      // causal / outcome markers (universal)
      /that is why|that is what|the result|as a result/.test(ll) ||
      // continuation / unstoppable force (universal)
      /keeps (going|moving|running|building|compounding|growing)/.test(ll) ||
      // identity / social consequence (universal)
      /says (about|something about) (you|them|us)|how (people|everyone|others) (see|look|judge)/.test(ll) ||
      /what you (are|become|represent)|proof that (you|they|it)/.test(ll) ||
      // permanence / control (universal)
      /you do not control|become permanent|once it (is|becomes)/.test(ll) ||
      // explanation-chain ending (universal)
      /it is not (just|only|about)|the (real|actual|true) (reason|problem|issue)/.test(ll) ||
      /the (scary|strange|crazy|interesting|surprising) part/.test(ll) ||
      // behavioral / training consequence (universal)
      /trains (your|the)|training (your|the)|rewires|builds the habit/.test(ll) ||
      // comparative payoff (universal)
      /much (harder|bigger|deeper|stranger|worse|better) (to|than)/.test(ll)
    );
  });

  if (consequenceLine) {
    const cleaned = consequenceLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);
    if (words.length <= 18) return capitalizeFirst(cleaned) + ".";
    return capitalizeFirst(words.slice(0, 14).join(" ")) + ".";
  }

  // ── Step 3: concrete physical / visual detail (universal mystery/event) ───
  // Any line with a specific physical scene, object, or observable state.
  const visualDetailLine = bodyLines.find(line => {
    const ll = line.toLowerCase();
    const wc = line.split(/\s+/).length;
    return wc >= 5 && wc <= 22 && (
      // observable state (universal: any subject can be "still there")
      /\bstill\b/.test(ll) ||
      // absence / presence markers (universal)
      /\bleft behind\b|\buntouched\b|\bno signs of\b/.test(ll) ||
      // disappearance / discovery (universal)
      /\bdisappeared\b|\bvanished\b|\bfound\b|\bdiscovered\b/.test(ll) ||
      // specific named objects in context (universal — any physical object detail)
      (ll.includes("on the") && /\b(table|floor|ground|deck|shelf|wall|seat)\b/.test(ll)) ||
      // nobody / absence of people (universal)
      /\bnobody\b|\bno one\b|\bevery person\b|\beveryone (was gone|had left|disappeared)\b/.test(ll)
    );
  });

  if (visualDetailLine) {
    const cleaned = visualDetailLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);
    const hook = words.length <= 18
      ? capitalizeFirst(cleaned)
      : capitalizeFirst(words.slice(0, 14).join(" "));

    // Find a complementary second detail (any absence or contrast line)
    const secondDetail = bodyLines.find(line => {
      const ll = line.toLowerCase();
      return line !== visualDetailLine &&
        (ll.includes("but") || ll.includes("yet") || ll.includes("gone") ||
         ll.includes("missing") || ll.includes("nobody") || ll.includes("no one")) &&
        line.split(/\s+/).length >= 4 && line.split(/\s+/).length <= 14;
    });

    if (secondDetail) {
      const secondCleaned = secondDetail.replace(/[.!?]+$/, "").trim().toLowerCase();
      const secondWords = secondCleaned.split(/\s+/).slice(0, 8).join(" ");
      return `${hook} — ${secondWords}.`;
    }
    return `${hook} — and nobody knew why.`;
  }

  // ── Step 4: contradiction / reversal (universal) ──────────────────────────
  // Any line that reverses an assumption using "not" + a core concept.
  const reversalLine = bodyLines.find(line => {
    const ll = line.toLowerCase();
    const wc = line.split(/\s+/).length;
    return wc >= 5 && wc <= 22 && (
      (ll.includes(" not ") || ll.startsWith("not ")) &&
      (ll.includes("just") || ll.includes("about") || ll.includes("only") ||
       ll.includes("really") || ll.includes("the real") || ll.includes("selling") ||
       ll.includes("buying") || ll.includes("question") || ll.includes("point") ||
       ll.includes("reason") || ll.includes("idea"))
    );
  });
  if (reversalLine) {
    const cleaned = reversalLine.replace(/[.!?]+$/, "").trim();
    const words = cleaned.split(/\s+/);
    if (words.length <= 18) return capitalizeFirst(cleaned) + ".";
    return capitalizeFirst(words.slice(0, 14).join(" ")) + ".";
  }

  // ── Step 5: filler intro — anchor to best body line ───────────────────────
  if (isFillerIntro && bodyLines.length >= 2) {
    const bodyAnchor = bodyLines.find(l => {
      const wc = l.split(/\s+/).length;
      return wc >= 6 && wc <= 20;
    });
    if (bodyAnchor) {
      const cleaned = bodyAnchor.replace(/[.!?]+$/, "").trim();
      return `${capitalizeFirst(cleaned)} — and most people never realise it.`;
    }
    const firstBody = bodyLines[0]?.replace(/[.!?]+$/, "").trim() ?? "";
    return `${capitalizeFirst(firstBody)} — and that is what makes it interesting.`;
  }

  // ── Step 6: existing contrast hook — reinforce with body payoff ───────────
  if (
    firstLower.startsWith("most people think") ||
    firstLower.startsWith("most creators think") ||
    firstLower.includes(" but ") ||
    firstLower.includes(" not ")
  ) {
    const payoffLine = bodyLines[bodyLines.length - 2] ?? bodyLines[bodyLines.length - 1] ?? "";
    const cleaned = payoffLine.replace(/[.!?]+$/, "").trim().toLowerCase();
    const words = cleaned.split(/\s+/);
    if (words.length >= 4 && words.length <= 15) {
      return `${capitalizeFirst(firstLine.replace(/[.!?]+$/, ""))} — ${cleaned}.`;
    }
    const shortFirst = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 8).join(" ");
    return `${capitalizeFirst(shortFirst)} — but that is not what the script reveals.`;
  }

  // ── Default: contrast using first line ────────────────────────────────────
  const shortSubject = firstLine.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 7).join(" ");
  return `${capitalizeFirst(shortSubject)} — but not for the reason most people think.`;
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getHookRewriteReason(script: string): string {
  const lines = script.split(/[\n.!?]/).map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0]?.toLowerCase() ?? "";
  const bodyLines = lines.slice(1);
  const bodyText = bodyLines.join(" ").toLowerCase();

  // ── Detect the original hook's structural failure mode ──────────────────
  const isFillerOpener =
    firstLine.startsWith("hey guys") || firstLine.startsWith("welcome") ||
    firstLine.startsWith("in this video") || firstLine.startsWith("today i") ||
    firstLine.startsWith("i will") || firstLine.startsWith("i want to") ||
    firstLine.startsWith("let's talk") || firstLine.startsWith("so today") ||
    firstLine.startsWith("this video");

  const isBeliefReversal =
    firstLine.includes("most people think") || firstLine.includes("most creators think") ||
    firstLine.includes("everyone thinks") || firstLine.includes("you probably think");

  const isScenarioOpener =
    firstLine.startsWith("what if") || firstLine.startsWith("imagine");

  // ── Detect strongest body material (universal signal detection) ──────────
  const hasNumberAnchor = /\d[\d,]*\s*(miles|km|feet|meters|percent|%|million|billion|seconds|minutes|hours|days|years|degrees|times)/i.test(bodyText);

  const hasConsequenceAnchor =
    /that is why|that is what|keeps (going|moving|building)|says about you|proof that|become permanent|trains (your|the)|it is not (just|about)|the (scary|strange|real) (part|reason)/.test(bodyText);

  const hasVisualDetailAnchor =
    /\bstill\b|\bleft behind\b|\buntouched\b|\bno signs of\b|\bdisappeared\b|\bvanished\b|\bnobody\b|\bno one\b/.test(bodyText);

  const hasReversalAnchor =
    bodyLines.some(l => {
      const ll = l.toLowerCase();
      return (ll.includes(" not ") || ll.startsWith("not ")) &&
        (ll.includes("just") || ll.includes("about") || ll.includes("only") ||
         ll.includes("really") || ll.includes("the real") || ll.includes("reason"));
    });

  // ── Build reason based on structural failure + strongest anchor ──────────
  if (isFillerOpener) {
    if (hasNumberAnchor) {
      return "The original only announces the topic. The improved version leads with the most specific number or measurement from the script, which immediately shows viewers what the video reveals.";
    }
    if (hasConsequenceAnchor) {
      return "The original only announces the topic. The improved version leads with the strongest consequence from the script, giving viewers a reason to keep watching before they understand the setup.";
    }
    if (hasVisualDetailAnchor) {
      return "The original only announces the topic. The improved version opens with a specific physical detail from the script, pulling viewers into the scene before they have a chance to scroll.";
    }
    return "The original hook only announces the topic. The improved version leads with the most useful detail from the script so viewers have a reason to keep watching before they understand why it matters.";
  }

  if (isBeliefReversal) {
    return "It sharpens the contrast in the first line so viewers immediately sense the gap between what they assumed and what the script reveals.";
  }

  if (isScenarioOpener) {
    return "It focuses the scenario on a concrete consequence so viewers feel the stakes immediately rather than abstractly.";
  }

  if (hasNumberAnchor) {
    return "The original states the topic without using the most specific detail in the script. The improved version leads with the exact number or measurement, which makes the consequence immediate and concrete.";
  }

  if (hasConsequenceAnchor) {
    return "The original introduces the topic before the payoff. The improved version leads with the consequence, which gives viewers a clear reason to stay before they know how the script gets there.";
  }

  if (hasReversalAnchor) {
    return "The original states an assumption the script will later challenge. The improved version leads with the reversal so viewers feel the gap between assumption and truth from the first line.";
  }

  if (hasVisualDetailAnchor) {
    return "The original describes the subject at a distance. The improved version opens with a specific physical detail, making the tension concrete and immediate.";
  }

  // If the script has no concrete material at all, return a reason consistent
  // with the diagnostic hook text that createHookRewrite will have produced.
  const allBodyLines = bodyLines.join(" ");
  const hasSomeAnchor =
    /\d/.test(allBodyLines) ||
    /[a-z,]\s+[A-Z][a-z]{2,}/.test(allBodyLines) ||
    /\b(because|therefore|as a result|which means|led to|resulted in|caused|triggered)\b/i.test(allBodyLines.toLowerCase()) ||
    /\b(percent|%|mile|feet|meter|second|minute|hour|day|week|year|billion|million|thousand|\$)\b/i.test(allBodyLines.toLowerCase());

  if (!hasSomeAnchor) {
    return "The script is too abstract to rewrite without inventing unsupported ideas. Add one specific example, result, consequence, number, or real situation first.";
  }

  return "The original hook states the topic without creating tension. The improved version leads with the most specific detail or consequence in the script so the viewer has a reason to keep watching before they know where it ends.";
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
  if (score >= 55) return "Average";
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

function getOverallDescription(score: number, issues: string[], structures?: ScriptStructures, hookIsAcceptable?: boolean, scriptType?: ScriptType): string {
  if (scriptType === "viral_challenge" || scriptType === "giveaway_or_prize") {
    if (score >= 75) return "Strong viral premise with clear stakes. The challenge and payoff work well together.";
    if (score >= 60) return "Clear challenge premise. Tightening the payoff or moving the prize detail earlier could push it higher.";
    if (score >= 45) return "The premise is recognizable, but the structure could be tighter — lead with the strongest stake or challenge.";
    return "The challenge premise needs a clearer stake or more concrete outcome to hook viewers fast.";
  }
  if (scriptType === "emotional_story") {
    if (score >= 75) return "Strong emotional arc. The setup, story, and payoff connect well.";
    if (score >= 55) return "Clear emotional story. A sharper opening moment or more specific payoff detail would push it further.";
    return "The story has emotional potential but needs a clearer arc — set up the stakes earlier and make the payoff more specific.";
  }
  if (scriptType === "auto_caption_transcript") {
    if (score >= 65) return "Strong underlying structure despite transcript formatting. The hook and payoff work well.";
    if (score >= 50) return "Clear Shorts structure in the transcript. A tighter hook or cleaner payoff would improve retention.";
    return "The transcript has a workable structure, but the opening and payoff could be stronger.";
  }
  if (score < 60 && issues.some(i => i.includes("strong payoff appears too late"))) {
    return "The strongest consequence is buried at the end. Move it to the opening and the whole script improves.";
  }
  if (score < 60 && !hookIsAcceptable && issues.some(i => i.includes("weak opening") || i.includes("hook needs"))) {
    return "The main weakness is the opening. A stronger first line would improve the whole script.";
  }
  if (issues.some(i => i.includes("too short"))) {
    return "The hook works, but the script needs more development before the payoff feels complete.";
  }
  if (score >= 85) return "Very strong structure. The hook, pacing, and payoff work well together.";
  if (score >= 75) return "Strong foundation with good pacing. A sharper payoff or more specific detail could push it further.";
  if (score >= 60) {
    if (hookIsAcceptable) {
      if (structures?.hasExplanationChain || structures?.hasNumericPremise) {
        return "Has a solid hook, but the explanation or payoff could be sharper to push the score higher.";
      }
      if (structures?.hasListBuildup || structures?.hasMysteryClueBuildup) {
        return "Has a solid hook with clear escalation, but the middle or payoff could be tightened further.";
      }
      return "Has a solid hook, but needs a clearer payoff, stronger middle tension, or more specific stakes.";
    }
    if (structures?.hasExplanationChain || structures?.hasNumericPremise) {
      return "The explanation and consequence are solid, but leading with the strongest detail or number would improve the overall score.";
    }
    if (structures?.hasListBuildup || structures?.hasMysteryClueBuildup) {
      return "The structure has a clear escalation, but the opening could lead with the strongest detail to pull viewers in faster.";
    }
    return "The script has a clear direction, but the hook, middle, or payoff may still need some work.";
  }
  if (score >= 40) {
    if (hookIsAcceptable) {
      return "Has a solid hook, but needs a clearer payoff, stronger middle tension, or more specific stakes.";
    }
    return "Has some useful parts, but needs a stronger hook, clearer stakes, or better payoff.";
  }
  return "The script may lose viewers early. Strengthen the opening and remove slow setup.";
}

function getHookDescription(score: number, issues: string[], structures?: ScriptStructures): string {
  if (issues.some(i => i.includes("strong payoff appears too late"))) {
    return "The opening announces the topic instead of leading with the strongest consequence. Move the payoff earlier.";
  }
  if (score < 45 && issues.some(i => i.includes("weak opening") || i.includes("hook needs"))) {
    return "The opening feels too slow. Replace it with a question, contrast, or clear result.";
  }
  if (score < 65 && issues.some(i => i.includes("curiosity gap"))) {
    return "The hook is understandable, but it does not create enough curiosity yet.";
  }
  if (score >= 80) return "Strong opening. It creates curiosity and gives viewers a clear reason to keep watching.";
  if (score >= 65) {
    if (structures?.hasFillerIntro) {
      return "The script has strong content, but the opening still announces the topic instead of leading with it.";
    }
    return "The hook is clear, but it could create a slightly stronger curiosity gap or contrast.";
  }
  if (score >= 45) return "The opening is understandable, but may not stop viewers from scrolling fast enough.";
  return "The first line needs a stronger question, contrast, or promise to earn attention.";
}

function getRiskDescription(score: number, issues: string[], structures?: ScriptStructures, genericPenalty?: number): string {
  // Generic override — fires FIRST when the script is clearly filler/repetitive.
  // This prevents structure labels like "buildup escalates well" for generic scripts.
  const isGenericScript = (genericPenalty ?? 0) >= 20 ||
    issues.some(i => i.includes("generic") || i.includes("filler phrases"));

  if (isGenericScript) {
    if (score >= 65) {
      return "High risk. The script repeats obvious ideas, lacks concrete examples, and does not build enough tension or payoff.";
    }
    if (score >= 45) {
      return "Medium risk. The script relies on general statements. Adding a specific example or concrete consequence would lower the risk.";
    }
    return "Moderate risk. The ideas are too vague to hold attention. Replace generic lines with specific details or consequences.";
  }

  // Structure-aware descriptions — only reached when script is NOT generic
  if (structures?.hasExplanationChain || structures?.hasNumericPremise) {
    if (score >= 45) {
      return "The explanation is clear, but the middle or payoff may need to build more tension before the ending.";
    }
    if (score >= 26) {
      return "Moderate risk. The mechanism and consequence are clear but the script could escalate more before the payoff.";
    }
    return "Low retention risk. The script builds a clear chain from premise to consequence.";
  }
  if (structures?.hasListBuildup || structures?.hasMysteryClueBuildup) {
    if (score >= 45) {
      return "The buildup escalates well, but the script may still lose viewers before the payoff arrives.";
    }
    if (score >= 26) {
      return "Moderate risk. The escalation structure is solid but could carry more tension through the middle.";
    }
    return "Low retention risk. The script escalates clearly toward the payoff.";
  }
  if (structures?.hasContradictionReversal) {
    if (score >= 45) {
      return "The reversal structure creates contrast, but the opening could deliver the insight faster.";
    }
    return "The reversal structure works well. Viewers who reach the contrast are likely to stay.";
  }
  // Issue-driven overrides
  if (issues.some(i => i.includes("middle may lose"))) {
    return "The middle may feel flat. Add a new turn or contrast to restart attention.";
  }
  if (issues.some(i => i.includes("no reason to keep"))) {
    return "The script may lose momentum because it does not build enough unanswered curiosity.";
  }
  // Score-based fallback
  if (score >= 65) {
    return "Several drop-off points were detected. The structure may not hold attention through the middle and payoff.";
  }
  if (score >= 45) return "Some sections may slow viewers down, especially where the script explains without building tension.";
  if (score >= 26) return "Moderate risk. The structure mostly works but a few moments could be tightened.";
  return "Low retention risk. The script stays focused and moves clearly from hook to payoff.";
}