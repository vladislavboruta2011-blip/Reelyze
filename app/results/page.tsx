"use client";

import Image from "next/image";
import { Inter } from "next/font/google";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  AnalysisV2SuccessResponse,
} from "../../engine/analysis-v2-schema";
import {
  ANALYSIS_V2_STORAGE_KEY,
  adaptAnalysisV2ForResults,
  parseStoredAnalysisV2,
} from "../../engine/analysis-v2-ui-adapter";
import {
  analyzeScript,
  createHookRewrite,
  createScriptLines,
  estimateDuration,
  formatTime,
  getHookRewriteReason,
  type AnalysisResult,
  type RiskyPart,
  type SceneSegment,
  type ScoreData,
} from "../../engine/scoring";
import {
  createLineTimestamps,
  createScaleLabels,
} from "./timing-helpers";
import { Card, IconBox } from "./ui-components";
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
  Target,
  ShieldCheck,
} from "lucide-react";

const inter = Inter({
  subsets: ["latin"],
});

type LineStatus = "normal" | "warning" | "risky";

const MAX_SCRIPT_CHARACTERS = 1000;
const MAX_TITLE_CHARACTERS = 200;

const fallbackScript =
  "What if one small change could make viewers watch until the end? But the real problem is not editing speed. It is that the first line gives viewers no reason to stay.";

function pluralize(count: number, singular: string, plural: string) {
  return count === 1
    ? `${count} ${singular}`
    : `${count} ${plural}`;
}

type ImproveSuccessPayload = {
  status: "good" | "improved";
  improvedHook: string;
  reason: string;
  mode?: "diagnostic" | "rewrite";
};

function isValidImproveSuccessPayload(
  value: unknown
): value is ImproveSuccessPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Record<string, unknown>;

  return (
    (payload.status === "good" || payload.status === "improved") &&
    typeof payload.improvedHook === "string" &&
    payload.improvedHook.trim().length > 0 &&
    typeof payload.reason === "string" &&
    payload.reason.trim().length > 0 &&
    (payload.mode === undefined ||
      payload.mode === "diagnostic" ||
      payload.mode === "rewrite")
  );
}

export default function ResultsPage() {
 const [savedScript, setSavedScript] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [savedAnalysisV2, setSavedAnalysisV2] =
    useState<AnalysisV2SuccessResponse | null>(null);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isHookModalOpen, setIsHookModalOpen] = useState(false);
  const [copiedHook, setCopiedHook] = useState(false);
  const [aiHook, setAiHook] = useState("");
  const [aiHookReason, setAiHookReason] = useState("");
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
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitError, setFeedbackSubmitError] = useState("");
  
    useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedScript = sessionStorage.getItem("reelyze-script");
        const storedTitle = sessionStorage.getItem("reelyze-title");
        const storedAnalysis = sessionStorage.getItem(
          ANALYSIS_V2_STORAGE_KEY
        );

        const isValidStoredScript =
          storedScript !== null &&
          storedScript.trim().length > 0 &&
          storedScript.length <= MAX_SCRIPT_CHARACTERS;

        const isValidStoredTitle =
          storedTitle === null ||
          (storedTitle.trim().length <= MAX_TITLE_CHARACTERS &&
            storedTitle.length <= MAX_TITLE_CHARACTERS);

        const parsedAnalysis =
          isValidStoredScript && storedAnalysis !== null
            ? parseStoredAnalysisV2(
                storedAnalysis,
                storedScript.trim()
              )
            : null;

        if (
          !isValidStoredScript ||
          !isValidStoredTitle ||
          parsedAnalysis === null
        ) {
          setStorageError(
            "Your saved analysis is invalid. Please go back and analyze the script again."
          );
          return;
        }

        if (isValidStoredScript) {
          setSavedScript(storedScript.trim());
          setSavedAnalysisV2(parsedAnalysis);
        }

        if (
          storedTitle !== null &&
          storedTitle.trim().length <= MAX_TITLE_CHARACTERS &&
          storedTitle.length <= MAX_TITLE_CHARACTERS
        ) {
          setSavedTitle(storedTitle.trim());
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
    if (savedAnalysisV2) {
      return adaptAnalysisV2ForResults(
        savedAnalysisV2,
        activeScript,
        scriptLines,
        estimatedDuration
      );
    }

    return analyzeScript(
      activeScript,
      estimatedDuration,
      scriptLines
    );
  }, [
    savedAnalysisV2,
    activeScript,
    estimatedDuration,
    scriptLines,
  ]);
  
  const fallbackImprovedHook = useMemo(() => {
  return createHookRewrite(activeScript);
}, [activeScript]);

const improvedHook = aiHook || fallbackImprovedHook;
const modalHookText = improveError ? "No improved hook was generated." : improvedHook;

const hookDecision = savedAnalysisV2?.result.hookDecision ?? "keep";
const shouldShowHookAction = savedAnalysisV2
  ? hookDecision !== "keep"
  : analysis.fixes.length > 0 && analysis.hook.score < 75;
const hookActionLabel = savedAnalysisV2
  ? hookDecision === "diagnostic"
    ? "Improve Script"
    : hookDecision === "refine"
      ? "Refine Hook"
      : "Improve Hook"
  : analysis.hook.score >= 70
    ? "Refine Script"
    : "Improve Hook";

async function submitFeedback(
  rating: "helpful" | "unhelpful",
  reason: string | null,
  text: string | null = null
): Promise<boolean> {
  if (feedbackSubmitting) {
    return false;
  }

  setFeedbackSubmitting(true);
  setFeedbackSubmitError("");

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rating,
        reason,
        text,
        title: savedTitle || "YouTube Shorts Script",
        script: activeScript,
        overallScore: analysis.overall.score,
        hookScore: analysis.hook.score,
        retentionRisk: analysis.risk.score,
        mainTakeaway: analysis.overall.description,
        currentPath:
          typeof window === "undefined"
            ? null
            : window.location.pathname,
      }),
    });

    if (!response.ok) {
      setFeedbackSubmitError("Feedback could not be sent. Please try again.");
      return false;
    }

    return true;
  } catch {
    setFeedbackSubmitError("Feedback could not be sent. Please try again.");
    return false;
  } finally {
    setFeedbackSubmitting(false);
  }
}

// The score-based "already good" state is retained only for the unreachable
// legacy fallback. Valid production results use Analysis V2 hookDecision.
const shouldShowHookAnalysis = !savedAnalysisV2 && analysis.hook.score >= 80;

const hookModalTitle =
  aiHookMode === "diagnostic"
    ? "Needs More Specific Material"
    : savedAnalysisV2
      ? hookDecision === "refine"
        ? "Refined Hook"
        : "Improved Hook"
      : shouldShowHookAnalysis
        ? "Hook Analysis"
        : analysis.hook.score >= 70
          ? "Refine Script"
          : "Improved Hook";

const hookModalDescription =
  aiHookMode === "diagnostic"
    ? "This script is too broad to rewrite into a stronger hook without inventing ideas."
    : savedAnalysisV2
      ? hookDecision === "refine"
        ? "This version keeps the same promise while making the opening sharper and clearer."
        : "Use this version to make the opening clearer, stronger, and more curiosity-driven."
      : shouldShowHookAnalysis
        ? "This opening already creates a clear reason to keep watching."
        : analysis.hook.score >= 70
          ? "The hook is working. This refinement focuses on making the opening or payoff land stronger."
          : "Use this version to make the opening clearer, stronger, and more curiosity-driven.";

const hookModalReasonLabel =
  aiHookMode === "diagnostic"
    ? "Why no hook was generated:"
    : savedAnalysisV2
      ? hookDecision === "refine"
        ? "What this version improves:"
        : "Why it is better:"
      : shouldShowHookAnalysis
        ? "Why this hook works:"
        : analysis.hook.score >= 70
          ? "What this version improves:"
          : "Why it is better:";

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
    : savedAnalysisV2
      ? hookDecision === "refine"
        ? "Copy Version"
        : "Copy Hook"
      : analysis.hook.score >= 70
        ? "Copy Version"
        : "Copy Hook";

  async function handleCopyHook() {
    if (isImprovingHook || improveError) return;

    setCopiedHook(false);

    try {
      await navigator.clipboard.writeText(improvedHook);
      setCopiedHook(true);

      setTimeout(() => {
        setCopiedHook(false);
      }, 1500);
    } catch {
      setCopiedHook(false);
    }
  }

  async function handleImproveHook() {
    if (isImprovingHook) return;

    setCopiedHook(false);
    setImproveError("");
    setAiHook("");
    setAiHookReason("");
    setAiHookMode("");
    setIsHookModalOpen(true);

    if (savedAnalysisV2) {
      const hookDecision = savedAnalysisV2.result.hookDecision;
      const suggestedHook =
        savedAnalysisV2.result.suggestedHook?.trim() ?? "";
      const hookAssessment =
        savedAnalysisV2.result.hookAssessment.trim();

      if (hookDecision === "keep") {
        setIsHookModalOpen(false);
        return;
      }

      if (hookDecision === "diagnostic") {
        setAiHook(
          "Add specific material to the script before generating a new hook."
        );
        setAiHookReason(hookAssessment);
        setAiHookMode("diagnostic");
        return;
      }

      if (!suggestedHook) {
        setImproveError(
          "No validated hook suggestion is available for this analysis."
        );
        return;
      }

      setAiHook(suggestedHook);
      setAiHookReason(hookAssessment);
      setAiHookMode("rewrite");
      return;
    }

    setIsImprovingHook(true);

    try {
      const response = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: activeScript,
          title: savedTitle,
        }),
      });

      const data: {
        status?: string;
        improvedHook?: string;
        reason?: string;
        mode?: string;
      } = await response.json().catch(() => ({}));

      if (!response.ok) {
        const apiReason =
          typeof data.reason === "string" && data.reason.trim().length > 0
            ? data.reason.trim()
            : "Could not improve hook. Please try again.";

        setImproveError(apiReason);
        return;
      }

      if (!isValidImproveSuccessPayload(data)) {
        setImproveError("Could not improve hook. Please try again.");
        return;
      }

      const hookText =
        typeof data.improvedHook === "string" &&
        data.improvedHook.trim().length > 0
          ? data.improvedHook.trim()
          : "AI hook improvement is unavailable right now.";

      const hookReason =
        typeof data.reason === "string" && data.reason.trim().length > 0
          ? data.reason.trim()
          : data.status === "good"
            ? "The hook is already clear, specific, and creates curiosity without needing a rewrite."
            : "The hook was adjusted to improve clarity, curiosity, or payoff connection.";

      setAiHook(hookText);
      setAiHookReason(hookReason);
      setAiHookMode(data.mode === "diagnostic" ? "diagnostic" : "rewrite");
    } catch {
      setImproveError("Could not improve hook. Please try again.");
    } finally {
      setIsImprovingHook(false);
    }
  }

  async function handleShare() {
    if (!isStorageLoaded || storageError || !hasAnalyzedScript) return;

    const reviewText = [
      savedTitle || "Climpy Script Review",
      `Overall Score: ${analysis.overall.score}/100`,
      `Hook Score: ${analysis.hook.score}/100`,
      `Retention Risk: ${analysis.risk.score}/100`,
      "",
      activeScript,
    ].join("\n");

    const shareData = {
      title: savedTitle || "Climpy Script Review",
      text: reviewText,
    };

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
        setShareMessage("Shared.");
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(reviewText);
        setShareMessage("Review copied.");
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
      className={`${inter.className} min-h-screen bg-[#FAFAFA] text-[#111827] antialiased`}
    >
      {/* DESKTOP */}
      <div className="hidden lg:flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 z-30 flex h-screen w-[230px] flex-col border-r border-[#E5E7EB]/60 bg-[#FAFAFA]">
          <div className="flex items-center gap-3 px-6 py-7">
            <Image src="/logo.png" alt="Climpy" width={36} height={36} className="h-9 w-9 object-contain" priority />
            <span className="text-[15px] font-bold tracking-[0.16em] text-[#111827]">CLIMPY</span>
          </div>
          <nav className="flex flex-col gap-1.5 px-4">
            <Link href="/results" className="flex h-[46px] items-center gap-3 rounded-[12px] border border-[#DDD6FE] bg-[#F3E8FF] px-4">
              <SquarePen size={16} className="text-[#7C3AED]" />
              <span className="text-[14px] font-semibold text-[#7C3AED]">Results</span>
            </Link>
            <Link href="/" className="flex h-[46px] items-center gap-3 rounded-[12px] px-4 transition hover:bg-white/[0.03]">
              <PencilLine size={16} className="text-[#6B7280]" />
              <span className="text-[14px] font-medium text-[#6B7280]">New Analysis</span>
            </Link>
          </nav>
          {isStorageLoaded && !storageError && hasAnalyzedScript && (
            <div className="mt-auto px-4 pb-10 pt-8">
              <div className="rounded-[18px] border border-[#E5E7EB]/70 bg-white p-5">
              <p className="text-[14px] font-semibold text-[#111827]">Rate this analysis</p>
              <p className="mt-1.5 text-[12px] text-[#6B7280]">Was this review helpful?</p>
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={() => { setDesktopFeedback("helpful"); setDesktopSelectedReason(null); setDesktopFeedbackSubmitted(false); }}
                  className={["flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border text-[13px] font-medium transition", desktopFeedback === "helpful" ? "border-[#22C55E]/60 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#E5E7EB] text-[#6B7280] hover:border-[#22C55E]/40 hover:text-[#111827]"].join(" ")}
                >
                  <ThumbsUp size={14} />
                  Helpful
                </button>
                <button
                  onClick={() => { setDesktopFeedback(desktopFeedback === "dislike" ? null : "dislike"); setDesktopSelectedReason(null); setDesktopFeedbackSubmitted(false); }}
                  className={["flex h-[38px] w-[42px] items-center justify-center rounded-[10px] border transition", desktopFeedback === "dislike" ? "border-[#7C3AED]/60 bg-[#7C3AED]/10 text-[#7C3AED]" : "border-[#E5E7EB] text-[#6B7280] hover:border-white/20 hover:text-[#111827]"].join(" ")}
                >
                  <ThumbsDown size={14} />
                </button>
              </div>

              {desktopFeedback === "helpful" && !desktopFeedbackSubmitted && (
                <div className="mt-3">
                  <p className="text-[11px] text-[#6B7280] mb-1.5">What was helpful?</p>
                  <div className="flex flex-col gap-1.5">
                    {["Accurate score", "Useful fixes", "Clear explanation", "Other"].map((reason) => (
                      <button
                        key={reason}
                        disabled={feedbackSubmitting}
                        onClick={() => {
                          if (reason === "Other") { setDesktopOtherFeedbackOpen(true); return; }
                          setDesktopSelectedReason(reason);
                          void submitFeedback("helpful", reason).then((ok) => {
                            if (ok) setDesktopFeedbackSubmitted(true);
                          });
                        }}
                        className={["w-full rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-medium transition", desktopSelectedReason === reason ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#E5E7EB] text-[#6B7280] hover:border-[#22C55E]/30 hover:text-[#6B7280]"].join(" ")}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {desktopFeedback === "dislike" && !desktopFeedbackSubmitted && (
                <div className="mt-3">
                  <p className="text-[11px] text-[#6B7280] mb-1.5">What was wrong?</p>
                  <div className="flex flex-col gap-1.5">
                    {["Wrong score", "Bad suggestions", "Not specific enough", "Other"].map((reason) => (
                      <button
                        key={reason}
                        disabled={feedbackSubmitting}
                        onClick={() => {
                          if (reason === "Other") { setDesktopOtherFeedbackOpen(true); return; }
                          setDesktopSelectedReason(reason);
                          void submitFeedback("unhelpful", reason).then((ok) => {
                            if (ok) setDesktopFeedbackSubmitted(true);
                          });
                        }}
                        className={["w-full rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-medium transition", desktopSelectedReason === reason ? "border-[#7C3AED]/50 bg-[#7C3AED]/10 text-[#7C3AED]" : "border-[#E5E7EB] text-[#6B7280] hover:border-[#7C3AED]/30 hover:text-[#6B7280]"].join(" ")}
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

              {feedbackSubmitting && (
                <p className="mt-2 text-[12px] text-[#6B7280]">
                  Sending feedback...
                </p>
              )}

              {feedbackSubmitError && (
                <p className="mt-2 text-[12px] text-[#7C3AED]">
                  {feedbackSubmitError}
                </p>
              )}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <section className="min-h-screen w-full pl-[230px]">
          <div className="mx-auto w-full max-w-[1320px] px-9 py-11">

            {/* Header */}
            <div className="mb-7 flex items-start justify-between gap-6">
              <div>
                <h1 className="text-[36px] font-semibold tracking-[-0.02em] text-[#111827]">Script Review</h1>
                <p className="mt-1.5 text-[14px] text-[#6B7280]">
                  Analyzed just now —{" "}
                  <span className="text-[#6B7280]">{savedTitle || "YouTube Shorts Script"}</span>
                </p>
              </div>
              <Link href="/" className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 text-[14px] font-semibold text-[#111827] transition hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/10">
                <PencilLine size={15} />
                New Analysis
              </Link>
            </div>

            {/* Loading state */}
            {!isStorageLoaded && (
              <Card className="p-8 mb-6">
                <p className="text-[20px] font-semibold text-[#111827]">Loading results...</p>
                <p className="mt-3 text-[14px] text-[#6B7280]">Please wait while Climpy checks your latest analysis.</p>
              </Card>
            )}

            {/* Error state */}
            {storageError && (
              <div className="mb-6 rounded-[22px] border border-[#7C3AED]/30 bg-[#F3E8FF] p-8">
                <p className="text-[15px] text-[#7C3AED]">{storageError}</p>
              </div>
            )}

            {/* Empty state */}
            {isStorageLoaded && !storageError && !hasAnalyzedScript && (
              <Card className="p-8 mb-6">
                <h2 className="text-[26px] font-semibold text-[#111827]">No script analyzed yet.</h2>
                <p className="mt-4 text-[15px] text-[#6B7280]">Go to New Analysis and paste your YouTube Shorts script first. After you click Analyze Script, your results will appear here.</p>
                <Link href="/" className="mt-6 inline-flex h-[48px] items-center justify-center rounded-[12px] bg-[#7C3AED] px-6 text-[15px] font-semibold text-[#111827] transition hover:bg-[#6D28D9]">New Analysis</Link>
              </Card>
            )}

            {/* Results */}
            {isStorageLoaded && !storageError && hasAnalyzedScript && (
              <>
                {/* Score cards */}
                <div className="mb-6 grid grid-cols-3 gap-5">
                  <Card className="p-6">
                    <p className="text-[13px] font-medium text-[#6B7280]">Overall Score</p>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-[40px] font-bold leading-none tracking-[-0.03em] text-[#111827]">{analysis.overall.score}</span>
                      <span className="text-[14px] text-[#6B7280]">/100</span>
                    </div>
                    <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-[#E5E7EB]">
                      <div className="h-full rounded-full" style={{ width: `${analysis.overall.score}%`, backgroundColor: analysis.overall.ringColor, boxShadow: `0 0 8px ${analysis.overall.ringColor}55` }} />
                    </div>
                    <p className="mt-3.5 text-[14px] font-semibold" style={{ color: analysis.overall.ringColor }}>{analysis.overall.label}</p>
                    <p className="mt-1 text-[13px] leading-[1.55] text-[#6B7280] line-clamp-2">{analysis.overall.description}</p>
                  </Card>
                  <Card className="p-6">
                    <p className="text-[13px] font-medium text-[#6B7280]">Hook Score</p>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-[40px] font-bold leading-none tracking-[-0.03em] text-[#111827]">{analysis.hook.score}</span>
                      <span className="text-[14px] text-[#6B7280]">/100</span>
                    </div>
                    <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-[#E5E7EB]">
                      <div className="h-full rounded-full" style={{ width: `${analysis.hook.score}%`, backgroundColor: analysis.hook.color, boxShadow: `0 0 8px ${analysis.hook.color}55` }} />
                    </div>
                    <p className="mt-3.5 text-[14px] font-semibold" style={{ color: analysis.hook.color }}>{analysis.hook.label}</p>
                    <p className="mt-1 text-[13px] leading-[1.55] text-[#6B7280] line-clamp-2">{analysis.hook.description}</p>
                  </Card>
                  <Card className="p-6">
                    <p className="text-[13px] font-medium text-[#6B7280]">Retention Risk</p>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-[40px] font-bold leading-none tracking-[-0.03em] text-[#111827]">{analysis.risk.score}</span>
                      <span className="text-[14px] text-[#6B7280]">/100</span>
                    </div>
                    <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-[#E5E7EB]">
                      <div className="h-full rounded-full" style={{ width: `${analysis.risk.score}%`, backgroundColor: analysis.risk.color, boxShadow: `0 0 8px ${analysis.risk.color}55` }} />
                    </div>
                    <p className="mt-3.5 text-[14px] font-semibold" style={{ color: analysis.risk.color }}>{analysis.risk.label}</p>
                    <p className="mt-1 text-[13px] leading-[1.55] text-[#6B7280] line-clamp-2">{analysis.risk.description}</p>
                  </Card>
                </div>

                {/* Main Takeaway */}
                <div className="mb-6 rounded-[16px] border border-[#DDD6FE] bg-[#F3E8FF] px-5 py-4 shadow-[0_0_28px_rgba(124,58,237,0.07)]">
                  <div className="flex items-start gap-3">
                    <Target size={16} className="mt-0.5 shrink-0 text-[#7C3AED]" />
                    <div>
                      <p className="text-[12.5px] font-semibold text-[#7C3AED]">Main Takeaway</p>
                      <p className="mt-1 text-[13px] leading-[1.6] text-[#5B21B6]">{analysis.overall.description}</p>
                    </div>
                  </div>
                </div>

                {/* Script + right column */}
                <div className="grid grid-cols-[1.35fr_0.9fr] items-start gap-5">
                  {/* Script card */}
                  <Card className="p-6">
                    <div className="mb-4">
                      <h2 className="text-[17px] font-semibold text-[#111827]">Your Script</h2>
                      {savedTitle && (
                        <div className="mt-3 rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 py-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6B7280]">Title</p>
                          <p className="mt-1 text-[14px] font-semibold leading-[1.45] text-[#111827]">{savedTitle}</p>
                        </div>
                      )}
                    </div>
                    <div className="max-h-[480px] min-w-0 overflow-y-auto overflow-x-hidden rounded-[16px] border border-[#E5E7EB] bg-[#F8F8FC] p-4">
                      <div className="flex flex-col gap-2">
                        {scriptLines.map((line, index) => {
                          const status: LineStatus = analysis.riskyLineIndexes.includes(index) ? "risky" : analysis.warningLineIndexes.includes(index) ? "warning" : "normal";
                          const isRisky = status === "risky";
                          const isWarning = status === "warning";
                          return (
                            <div key={`${lineTimestamps[index] ?? index}-${line}`}
                              className={["grid min-w-0 grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.6]", isRisky ? "border border-[#DDD6FE] bg-[#F3E8FF]" : isWarning ? "border border-[#FF9A1F]/25 bg-[#FF9A1F]/[0.06]" : "border border-transparent"].join(" ")}
                            >
                              <span className={isRisky ? "text-[#7C3AED]" : isWarning ? "text-[#FF9A1F]" : "text-[#6B7280]"}>{lineTimestamps[index] ?? formatTime(estimatedDuration)}</span>
                              <span className={`${isRisky ? "text-[#7C3AED]" : isWarning ? "text-[#FF9A1F]" : "text-[#6B7280]"} min-w-0 break-words [overflow-wrap:anywhere]`}>
  {line}
</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="mt-4 text-[12px] text-[#6B7280]">
  {characterCount} / 1000 Characters — ~{formatTime(estimatedDuration)} estimated
</p>
                  </Card>

                  {/* Right column */}
                  <div className="flex flex-col gap-6">
                    {/* Risky Parts */}
                    <Card className="p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-[17px] font-semibold text-[#111827]">Risky Parts</h2>
                        <span className="text-[12px] font-medium text-[#6B7280]">{pluralize(analysis.riskyParts.length, "found", "found")}</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {analysis.riskyParts.length === 0 ? (
                          <div>
                            <p className="text-[14px] font-medium text-[#111827]">{analysis.fixes.length > 0 ? "No major risky parts found." : "No risky parts found."}</p>
                            <p className="mt-1 text-[13px] leading-[1.55] text-[#6B7280]">{analysis.fixes.length > 0 ? "No material drop-off points were found; the suggestions below are optional refinements." : "This script stays focused and does not contain any major drop-off points."}</p>
                          </div>
                        ) : (
                          analysis.riskyParts.map((part) => (
                            <div key={`${part.time}-${part.title}`} className="rounded-[14px] border border-[#E5E7EB] bg-[#F8F8FC] p-4">
                              <p className="text-[12px] font-semibold text-[#7C3AED]">{part.time}</p>
                              <p className="mt-1.5 text-[14px] font-medium text-[#111827]">{part.title}</p>
                              <p className="mt-1 text-[13px] leading-[1.55] text-[#6B7280]">{part.description}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>

                    {/* Suggested Fixes */}
                    <Card className="p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-[17px] font-semibold text-[#111827]">Suggested Fixes</h2>
                        <span className="text-[12px] font-medium text-[#6B7280]">{pluralize(displayFixes.length, "suggestion", "suggestions")}</span>
                      </div>
                      {shouldShowHookAction && (
                        <button
                          onClick={handleImproveHook}
                          disabled={isImprovingHook}
                          className="mb-5 inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-[#6D28D9] px-4 text-[13px] font-semibold text-[#111827] shadow-[0_0_32px_rgba(109,40,217,0.30)] transition hover:bg-[#7C3AED]"
                        >
                          <ShieldCheck size={15} />
                          {hookActionLabel}
                        </button>
                      )}
                      <div className="flex flex-col gap-3">
                        {displayFixes.length === 0 ? (
                          <div>
                            <p className="text-[14px] font-medium text-[#111827]">No fixes needed.</p>
                            <p className="mt-1 text-[13px] leading-[1.55] text-[#6B7280]">The script already performs well based on the current analysis.</p>
                          </div>
                        ) : (
                          displayFixes.map((fix, index) => (
                            <div key={`${fix}-${index}`} className="flex items-start gap-3 rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-3 py-3">
                              <IconBox>
                                {index % 3 === 0 ? <AudioLines size={18} /> : index % 3 === 1 ? <Scissors size={18} /> : <FastForward size={18} />}
                              </IconBox>
                              <p className="text-[13px] leading-[1.65] text-[#6B7280]">{fix}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Scene Breakdown */}
                <Card className="mt-5 p-6">
                  <h2 className="mb-4 text-[17px] font-semibold text-[#111827]">Scene Breakdown</h2>
                  <div className="flex h-[7px] w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    {analysis.sceneSegments.map((segment, index) => {
                      const totalDesktopWidth = 1110;
                      const pct = segment.width / totalDesktopWidth;
                      return (
                        <div key={`${segment.label}-${index}`} className="h-full" style={{ width: `${pct * 100}%`, backgroundColor: segment.color, opacity: 0.88 }} />
                      );
                    })}
                  </div>
                  <div className="mt-3 grid grid-cols-5 text-[11.5px] text-[#9CA3AF]">
                    {scaleLabels.map((label, i) => (
                      <p key={label} className={i === 4 ? "text-right" : ""}>{label}</p>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-6">
                    {analysis.sceneSegments.map((segment, index) => (
                      <div key={`${segment.label}-${index}`} className="flex items-center gap-2">
                        <span className="h-[4px] w-[16px] rounded-full" style={{ backgroundColor: segment.color }} />
                        <span className="text-[12px] text-[#6B7280]">{segment.label}</span>
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
          <div className="relative w-full max-w-[460px] rounded-[24px] border border-[#E5E7EB] bg-white p-8 shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
            <button onClick={() => setDesktopOtherFeedbackOpen(false)} className="absolute right-5 top-5 text-[20px] text-[#6B7280] transition hover:text-[#111827]">×</button>
            <h2 className="text-[20px] font-semibold text-[#111827]">{desktopFeedback === "helpful" ? "What did you like?" : "What did not work?"}</h2>
            <p className="mt-1.5 text-[13px] text-[#6B7280]">Your feedback helps improve Climpy.</p>
            <textarea
              value={desktopOtherFeedbackText}
              onChange={(e) => setDesktopOtherFeedbackText(e.target.value)}
              placeholder={desktopFeedback === "helpful" ? "Tell us what you liked about this analysis..." : "Tell us what was wrong or missing..."}
              rows={5}
              className="mt-5 w-full resize-none rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 py-3 text-[13px] leading-[1.65] text-[#6B7280] outline-none placeholder:text-[#9CA3AF]"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  const rating = desktopFeedback === "helpful" ? "helpful" : "unhelpful";
                  void submitFeedback(rating, "Other", desktopOtherFeedbackText).then((ok) => {
                    if (!ok) return;
                    setDesktopOtherFeedbackOpen(false);
                    setDesktopOtherFeedbackText("");
                    setDesktopSelectedReason("Other");
                    setDesktopFeedbackSubmitted(true);
                  });
                }}
                disabled={feedbackSubmitting}
                className="h-[40px] rounded-[10px] bg-[#6D28D9] px-5 text-[13px] font-semibold text-[#111827] transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {feedbackSubmitting ? "Submitting..." : "Submit"}
              </button>
              <button onClick={() => setDesktopOtherFeedbackOpen(false)} className="h-[40px] rounded-[10px] border border-[#E5E7EB] bg-[#F8F8FC] px-5 text-[13px] font-semibold text-[#111827] transition hover:bg-[#F3F4F6]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE */}
      <div className="block lg:hidden bg-[#FAFAFA] min-h-screen">
        <div className="mx-auto w-full max-w-[430px] flex flex-col pb-[100px]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-11 pb-4">
            <Link href="/" className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white">
              <ArrowLeft size={17} className="text-[#7C3AED]" />
            </Link>
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="Climpy" width={28} height={28} className="h-7 w-7 object-contain" priority />
              <span className="text-[14px] font-bold tracking-[0.16em] text-[#111827]">CLIMPY</span>
            </div>
            <button
              onClick={handleShare}
              disabled={!isStorageLoaded || Boolean(storageError) || !hasAnalyzedScript}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Share2 size={17} className="text-[#6B7280]" />
            </button>
          </div>

          {shareMessage && (
            <p className="px-5 -mt-1 mb-2 text-[11px] text-[#6B7280]">{shareMessage}</p>
          )}

          {/* Title */}
          <div className="px-5 mb-5">
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#111827]">Script Review</h1>
            <p className="mt-1 text-[12px] text-[#6B7280]">
              Analyzed just now — <span className="text-[#6B7280]">{savedTitle || "YouTube Shorts Script"}</span>
            </p>
          </div>

          {/* Loading */}
          {!isStorageLoaded && (
            <div className="mx-5 mb-4 rounded-[18px] border border-[#E5E7EB] bg-white p-5">
              <p className="text-[15px] font-semibold text-[#111827]">Loading results...</p>
              <p className="mt-1.5 text-[13px] text-[#6B7280]">Please wait a moment.</p>
            </div>
          )}

          {/* Error */}
          {storageError && (
            <div className="mx-5 mb-4 rounded-[18px] border border-[#7C3AED]/30 bg-[#F3E8FF] p-5">
              <p className="text-[13px] text-[#7C3AED]">{storageError}</p>
            </div>
          )}

          {/* Empty state */}
          {isStorageLoaded && !storageError && !hasAnalyzedScript && (
            <div className="mx-5 mb-4 rounded-[18px] border border-[#E5E7EB] bg-white p-6">
              <p className="text-[18px] font-semibold text-[#111827] mb-2">No script analyzed yet.</p>
              <p className="text-[13px] leading-[1.6] text-[#6B7280] mb-5">Go to New Analysis and paste your script first.</p>
              <Link href="/" className="flex h-[44px] w-full items-center justify-center rounded-[12px] bg-[#6D28D9] text-[14px] font-semibold text-[#111827]">New Analysis</Link>
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
                  <div key={item.label} className="flex flex-col items-center justify-center gap-1 rounded-[16px] border border-[#E5E7EB] bg-white py-4 px-2">
                    <p className="text-[10px] font-medium text-[#6B7280] text-center">{item.label}</p>
                    <span className="text-[32px] font-bold leading-none tracking-[-0.03em] text-[#111827]">{item.score}</span>
                    <div className="w-full h-[3px] rounded-full bg-[#E5E7EB] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${item.score}%`, backgroundColor: item.color }} />
                    </div>
                    <p className="text-[10px] font-semibold" style={{ color: item.color }}>{item.status}</p>
                  </div>
                ))}
              </div>

              {/* Main Takeaway */}
              <div className="rounded-[18px] border border-[#DDD6FE] bg-[#F3E8FF] px-4 py-4 shadow-[0_0_24px_rgba(124,58,237,0.07)]">
                <div className="flex items-start gap-3">
                  <Target size={15} className="mt-0.5 shrink-0 text-[#7C3AED]" />
                  <div>
                    <p className="text-[11px] font-semibold text-[#7C3AED] mb-1">Main Takeaway</p>
                    <p className="text-[13px] leading-[1.6] text-[#5B21B6]">{analysis.overall.description}</p>
                  </div>
                </div>
                {shouldShowHookAction && (
                  <button
                    onClick={handleImproveHook}
                    disabled={isImprovingHook}
                    className="mt-4 w-full h-[44px] inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#6D28D9] text-[14px] font-semibold text-[#111827] shadow-[0_0_24px_rgba(109,40,217,0.25)] transition hover:bg-[#7C3AED]"
                  >
                    <ShieldCheck size={15} />
                    {hookActionLabel}
                  </button>
                )}
              </div>

              {/* Risky Parts */}
              <div className="rounded-[18px] border border-[#E5E7EB] bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <h2 className="text-[15px] font-semibold text-[#111827]">Risky Parts</h2>
                  <span className="text-[11px] font-medium text-[#6B7280]">{pluralize(analysis.riskyParts.length, "found", "found")}</span>
                </div>
                <div className="px-4 pb-4 flex flex-col gap-2.5">
                  {analysis.riskyParts.length === 0 ? (
                    <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 py-3">
                      <p className="text-[13px] font-medium text-[#111827]">{analysis.fixes.length > 0 ? "No major risky parts found." : "No risky parts found."}</p>
                      <p className="mt-1 text-[12px] leading-[1.5] text-[#6B7280]">{analysis.fixes.length > 0 ? "No material drop-off points were found; the suggestions below are optional refinements." : "This script stays focused and does not contain any major drop-off points."}</p>
                    </div>
                  ) : (
                    analysis.riskyParts.map((part) => (
                      <div key={`${part.time}-${part.title}`} className="rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] p-4">
                        <p className="text-[11px] font-semibold text-[#7C3AED]">{part.time}</p>
                        <p className="mt-1 text-[13px] font-medium text-[#111827]">{part.title}</p>
                        <p className="mt-0.5 text-[12px] leading-[1.5] text-[#6B7280]">{part.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Suggested Fixes */}
              <div className="rounded-[18px] border border-[#E5E7EB] bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <h2 className="text-[15px] font-semibold text-[#111827]">Suggested Fixes</h2>
                  <span className="text-[11px] font-medium text-[#6B7280]">{pluralize(displayFixes.length, "suggestion", "suggestions")}</span>
                </div>
                <div className="px-4 pb-4 flex flex-col gap-2.5">
                  {displayFixes.length === 0 ? (
                    <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 py-3">
                      <p className="text-[13px] font-medium text-[#111827]">No fixes needed.</p>
                      <p className="mt-1 text-[12px] text-[#6B7280]">The script already performs well.</p>
                    </div>
                  ) : (
                    (mobileFixesOpen ? displayFixes : displayFixes.slice(0, 3)).map((fix, index) => (
                      <div key={`${fix}-${index}`} className="flex items-start gap-3 rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-3 py-3">
                        <IconBox>
                          {index % 3 === 0 ? <AudioLines size={16} /> : index % 3 === 1 ? <Scissors size={16} /> : <FastForward size={16} />}
                        </IconBox>
                        <p className="flex-1 text-[12px] leading-[1.6] text-[#6B7280]">{fix}</p>
                      </div>
                    ))
                  )}
                  {displayFixes.length > 3 && (
                    <button onClick={() => setMobileFixesOpen(!mobileFixesOpen)} className="flex w-full items-center justify-center gap-1.5 pt-1">
                      <span className="text-[12px] font-semibold text-[#6B7280]">{mobileFixesOpen ? "Show fewer" : "View all suggestions"}</span>
                      <ChevronRight size={12} className={`text-[#6B7280] transition-transform ${mobileFixesOpen ? "rotate-90" : ""}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Your Script — accordion */}
              <div className="rounded-[18px] border border-[#E5E7EB] bg-white overflow-hidden">
                <button
                  onClick={() => setMobileScriptOpen(!mobileScriptOpen)}
                  className="flex w-full items-center justify-between px-5 py-4"
                >
                  <h2 className="text-[15px] font-semibold text-[#111827]">Your Script</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#6B7280]">{characterCount} / 1000 Characters</span>
                    <ChevronDown size={15} className={`text-[#6B7280] transition-transform ${mobileScriptOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {mobileScriptOpen && (
                  <div className="px-4 pb-4">
                    {savedTitle && (
                      <div className="mb-3 rounded-[10px] border border-[#E5E7EB] bg-[#F8F8FC] px-3 py-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B7280]">Title</p>
                        <p className="mt-1 text-[12px] font-semibold leading-[1.45] text-[#111827]">{savedTitle}</p>
                      </div>
                    )}
                    <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] p-3 max-h-[300px] overflow-y-auto">
                      <div className="flex flex-col gap-1.5">
                        {scriptLines.map((line, index) => {
                          const status: LineStatus = analysis.riskyLineIndexes.includes(index) ? "risky" : analysis.warningLineIndexes.includes(index) ? "warning" : "normal";
                          const isRisky = status === "risky";
                          const isWarning = status === "warning";
                          return (
                            <div key={`${lineTimestamps[index] ?? index}-${line}`}
                              className={["grid grid-cols-[44px_1fr] gap-2.5 rounded-[8px] px-2.5 py-2 text-[12px] leading-[1.55]", isRisky ? "border border-[#DDD6FE] bg-[#F3E8FF]" : isWarning ? "border border-[#FF9A1F]/20 bg-[#FF9A1F]/[0.05]" : "border border-transparent"].join(" ")}
                            >
                              <span className={isRisky ? "text-[#7C3AED]" : isWarning ? "text-[#FF9A1F]" : "text-[#9CA3AF]"}>{lineTimestamps[index] ?? formatTime(estimatedDuration)}</span>
                              <span className={isRisky ? "text-[#7C3AED]" : isWarning ? "text-[#FF9A1F]" : "text-[#6B7280]"}>{line}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-[#9CA3AF]">~{formatTime(estimatedDuration)} estimated</p>
                  </div>
                )}
              </div>

              {/* Scene Breakdown — accordion */}
              <div className="rounded-[18px] border border-[#E5E7EB] bg-white overflow-hidden">
                <button
                  onClick={() => setMobileSceneOpen(!mobileSceneOpen)}
                  className="flex w-full items-center justify-between px-5 py-4"
                >
                  <h2 className="text-[15px] font-semibold text-[#111827]">Scene Breakdown</h2>
                  <ChevronDown size={15} className={`text-[#6B7280] transition-transform ${mobileSceneOpen ? "rotate-180" : ""}`} />
                </button>
                {mobileSceneOpen && (
                  <div className="px-4 pb-4">
                    <div className="flex h-[6px] w-full overflow-hidden rounded-full bg-[#E5E7EB] mb-3">
                      {analysis.sceneSegments.map((segment, index) => {
                        const pct = segment.width / 1110;
                        return <div key={`${segment.label}-${index}`} className="h-full" style={{ width: `${pct * 100}%`, backgroundColor: segment.color, opacity: 0.9 }} />;
                      })}
                    </div>
                    <div className="grid grid-cols-5 text-[10px] text-[#9CA3AF] mb-3">
                      {scaleLabels.map((label, i) => (
                        <p key={label} className={i === 4 ? "text-right" : ""}>{label}</p>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {analysis.sceneSegments.map((segment, index) => (
                        <div key={`${segment.label}-${index}`} className="flex items-center gap-1.5">
                          <span className="h-[3px] w-[14px] rounded-full" style={{ backgroundColor: segment.color }} />
                          <span className="text-[11px] text-[#6B7280]">{segment.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rate This Analysis */}
              <div className="rounded-[18px] border border-[#E5E7EB] bg-white px-5 py-4">
                <p className="text-[14px] font-semibold text-[#111827]">Rate this analysis</p>
                <p className="mt-1 text-[12px] text-[#6B7280]">Was this review helpful?</p>
                <div className="mt-3 flex gap-2.5">
                  <button
                    onClick={() => { setMobileFeedback("helpful"); setMobileSelectedReason(null); setMobileFeedbackSubmitted(false); }}
                    className={["flex h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border text-[13px] font-semibold transition", mobileFeedback === "helpful" ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#E5E7EB] bg-[#F8F8FC] text-[#6B7280]"].join(" ")}
                  >
                    <ThumbsUp size={13} />
                    Helpful
                  </button>
                  <button
                    onClick={() => { setMobileFeedback(mobileFeedback === "dislike" ? null : "dislike"); setMobileSelectedReason(null); setMobileFeedbackSubmitted(false); }}
                    className={["flex h-[40px] w-[48px] items-center justify-center rounded-[10px] border transition", mobileFeedback === "dislike" ? "border-[#7C3AED]/50 bg-[#7C3AED]/10 text-[#7C3AED]" : "border-[#E5E7EB] bg-[#F8F8FC] text-[#6B7280]"].join(" ")}
                  >
                    <ThumbsDown size={14} />
                  </button>
                </div>

                {mobileFeedback === "helpful" && !mobileFeedbackSubmitted && (
                  <div className="mt-3">
                    <p className="text-[11px] text-[#6B7280] mb-1.5">What was helpful?</p>
                    <div className="flex flex-col gap-1.5">
                      {["Accurate score", "Useful fixes", "Clear explanation", "Other"].map((reason) => (
                        <button
                          key={reason}
                          disabled={feedbackSubmitting}
                          onClick={() => {
                            if (reason === "Other") { setIsFeedbackOpen(true); return; }
                            setMobileSelectedReason(reason);
                            void submitFeedback("helpful", reason).then((ok) => {
                              if (ok) setMobileFeedbackSubmitted(true);
                            });
                          }}
                          className={["w-full rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-medium transition", mobileSelectedReason === reason ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#E5E7EB] bg-[#F8F8FC] text-[#6B7280] hover:border-[#22C55E]/30 hover:text-[#6B7280]"].join(" ")}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mobileFeedback === "dislike" && !mobileFeedbackSubmitted && (
                  <div className="mt-3">
                    <p className="text-[11px] text-[#6B7280] mb-1.5">What was wrong?</p>
                    <div className="flex flex-col gap-1.5">
                      {["Wrong score", "Bad suggestions", "Not specific enough", "Other"].map((reason) => (
                        <button
                          key={reason}
                          disabled={feedbackSubmitting}
                          onClick={() => {
                            if (reason === "Other") { setIsFeedbackOpen(true); return; }
                            setMobileSelectedReason(reason);
                            void submitFeedback("unhelpful", reason).then((ok) => {
                              if (ok) setMobileFeedbackSubmitted(true);
                            });
                          }}
                          className={["w-full rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-medium transition", mobileSelectedReason === reason ? "border-[#7C3AED]/50 bg-[#7C3AED]/10 text-[#7C3AED]" : "border-[#E5E7EB] bg-[#F8F8FC] text-[#6B7280] hover:border-[#7C3AED]/30 hover:text-[#6B7280]"].join(" ")}
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

                {feedbackSubmitting && (
                  <p className="mt-2 text-[12px] text-[#6B7280]">
                    Sending feedback...
                  </p>
                )}

                {feedbackSubmitError && (
                  <p className="mt-2 text-[12px] text-[#7C3AED]">
                    {feedbackSubmitError}
                  </p>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 z-50 h-[76px] border-t border-[#E5E7EB] bg-[#FAFAFA]/95 backdrop-blur-[8px]">
          <div className="mx-auto flex h-full w-full max-w-[430px] items-center justify-between px-5">
            <Link href="/" className="flex h-[40px] items-center justify-center gap-2 rounded-[12px] border border-[#E5E7EB] bg-white px-5 text-[13px] font-semibold text-[#111827]">
              <PencilLine size={14} className="text-[#6B7280]" />
              New analysis
            </Link>
            <Link href="/results" className="flex h-[40px] items-center justify-center gap-2 rounded-[12px] border border-[#DDD6FE] bg-[#F3E8FF] px-5 text-[13px] font-semibold text-[#7C3AED]">
              <SquarePen size={13} />
              Results
            </Link>
          </div>
        </div>

      </div>

            {isFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-[2px]">
          <div className="relative w-full max-w-[360px] rounded-[22px] border border-[#E5E7EB] bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.70)]">
            <button
              onClick={() => setIsFeedbackOpen(false)}
              className="absolute right-4 top-4 text-[22px] font-normal leading-none text-[#6B7280] transition hover:text-[#111827]"
            >
              ×
            </button>

            <h2 className="pr-8 text-[22px] font-semibold leading-[28px] tracking-[-0.03em] text-[#111827]">
  {mobileFeedback === "helpful" ? "What did you like?" : "What was wrong?"}
</h2>

            <p className="mt-2 text-[13px] font-normal leading-[21px] text-[#6B7280]">
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
              className="mt-4 w-full resize-none rounded-[14px] border border-[#E5E7EB] bg-[#F8F8FC] px-3.5 py-3 text-[13px] font-normal leading-[20px] text-[#111827] outline-none placeholder:text-[#6B7280] focus:border-[#DDD6FE]"
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const rating = mobileFeedback === "helpful" ? "helpful" : "unhelpful";
                  void submitFeedback(rating, "Other", feedbackText).then((ok) => {
                    if (!ok) return;
                    setIsFeedbackOpen(false);
                    setFeedbackText("");
                    setMobileSelectedReason("Other");
                    setMobileFeedbackSubmitted(true);
                  });
                }}
                disabled={feedbackSubmitting}
                className="h-[44px] rounded-[12px] bg-[#6D28D9] text-[13px] font-semibold text-[#111827] transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {feedbackSubmitting ? "Sending..." : "Send feedback"}
              </button>

              <button
                onClick={() => setIsFeedbackOpen(false)}
                className="h-[44px] rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] text-[13px] font-semibold text-[#111827] transition hover:bg-[#F3F4F6]"
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
          <div className="relative hidden lg:block h-[410px] w-[560px] rounded-[20px] border border-[#E5E7EB] bg-white">
            <button
              onClick={() => setIsHookModalOpen(false)}
              className="absolute right-[20px] top-[18px] text-[22px] font-normal leading-[24px] text-[#6B7280] transition hover:text-[#111827]"
            >
              x
            </button>

            <h2 className="absolute left-[30px] top-[30px] text-[22px] font-semibold leading-[24px] text-[#111827]">
              {hookModalTitle}
            </h2>

            <p className="absolute left-[30px] top-[65px] w-[430px] text-[14px] font-normal leading-[22px] text-[#6B7280]">
              {hookModalDescription}
            </p>

            <div className="absolute left-[30px] top-[115px] h-[86px] w-[460px] rounded-[14px] border border-[#E5E7EB] bg-[#F8F8FC] px-[16px] py-[14px]">
              <p className="text-[15px] font-normal leading-[22px] text-[#111827]">
                &ldquo;{isImprovingHook ? "Improving hook..." : modalHookText}&rdquo;
              </p>
            </div>

            <div className="absolute left-[30px] top-[220px] w-[500px] max-h-[115px] overflow-hidden">
              {improveError ? (
                <p className="mt-[6px] text-[13px] font-normal leading-[20px] text-[#7C3AED]">
                  {improveError}
                </p>
              ) : (
                <>
                  <p className="mt-[6px] text-[14px] font-normal leading-[21px] text-[#6B7280] break-words whitespace-normal">
                    {hookModalReasonLabel}
                  </p>
                  <p className="mt-[6px] text-[14px] font-normal leading-[21px] text-[#6B7280] break-words whitespace-normal">
                    {isImprovingHook
                      ? "Climpy is rewriting the opening based on your script."
                      : improvedHookReason}
                  </p>
                </>
              )}
            </div>

            <button
              onClick={handleCopyHook}
              disabled={isImprovingHook || Boolean(improveError)}
              className="absolute left-[30px] top-[360px] h-[40px] w-[130px] rounded-[12px] border border-[#E5E7EB] bg-[#7C3AED] text-[14px] font-semibold leading-[24px] text-[#111827] transition hover:bg-[#6D28D9]"
            >
              {copiedHook ? "Copied!" : hookCopyButtonLabel}
            </button>

            <button
              onClick={() => setIsHookModalOpen(false)}
              className="absolute left-[175px] top-[360px] h-[40px] w-[100px] rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] text-[14px] font-semibold leading-[24px] text-[#111827] transition hover:bg-[#F3E8FF]"
            >
              Close
            </button>
          </div>

          {/* Mobile modal */}
          <div className="relative flex flex-col lg:hidden w-full max-w-[360px] rounded-[18px] border border-[#E5E7EB] bg-white p-[22px]">
            <button
              onClick={() => setIsHookModalOpen(false)}
              className="absolute right-[16px] top-[14px] text-[20px] font-normal text-[#6B7280] focus:outline-none focus:ring-0"
            >
              x
            </button>

            <h2 className="text-[18px] font-semibold leading-[24px] text-[#111827] mb-[8px] pr-[24px]">
              {hookModalTitle}
            </h2>

            <p className="text-[12px] font-normal leading-[20px] text-[#6B7280] mb-[14px]">
              {hookModalDescription}
            </p>

            <div className="w-full rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-[14px] py-[12px] mb-[14px]">
              <p className="text-[13px] font-normal leading-[21px] text-[#111827] break-words">
                &ldquo;{isImprovingHook ? "Improving hook..." : modalHookText}&rdquo;
              </p>
            </div>

            {improveError ? (
              <p className="text-[12px] font-normal leading-[18px] text-[#7C3AED] mb-[16px]">
                {improveError}
              </p>
            ) : (
              <div className="mb-[16px]">
                <p className="text-[12px] font-normal leading-[18px] text-[#6B7280]">
                  {hookModalReasonLabel}
                </p>
                <p className="text-[12px] font-normal leading-[18px] text-[#6B7280] mt-[4px] break-words">
                  {isImprovingHook
                    ? "Climpy is rewriting the opening based on your script."
                    : improvedHookReason}
                </p>
              </div>
            )}

            <div className="flex gap-[10px]">
              <button
                onClick={handleCopyHook}
                disabled={isImprovingHook || Boolean(improveError)}
                className="flex-1 h-[40px] rounded-[12px] border border-[#E5E7EB] bg-[#7C3AED] text-[13px] font-semibold text-[#111827] focus:outline-none focus:ring-0"
              >
                {copiedHook ? "Copied!" : hookCopyButtonLabel}
              </button>
              <button
                onClick={() => setIsHookModalOpen(false)}
                className="flex-1 h-[40px] rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] text-[13px] font-semibold text-[#111827] focus:outline-none focus:ring-0"
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
