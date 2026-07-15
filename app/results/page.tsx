"use client";

import Image from "next/image";
import { Inter } from "next/font/google";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LanguageSwitcher } from "../language-switcher";
import { useMessages } from "../use-messages";
import { useLocale } from "../locale-provider";
import type { Locale } from "../../lib/i18n";
import type {
  AnalysisV2SuccessResponse,
} from "../../engine/analysis-v2-schema";
import {
  ANALYSIS_V2_STORAGE_KEY,
  adaptAnalysisV2ForResults,
  parseStoredAnalysisV2,
  type AnalysisV2UiResult,
} from "../../engine/analysis-v2-ui-adapter";
import {
  analyzeScript,
  createHookRewrite,
  createScriptLines,
  estimateDuration,
  formatTime,
  getHookRewriteReason,
  type AnalysisResult,
} from "../../engine/scoring";
import {
  createLineTimestamps,
  createScaleLabels,
} from "./timing-helpers";
import { createDisplayFixes } from "./fixes-helpers";
import {
  Card,
  DesktopScoreCard,
  FeedbackReasonOptions,
  MobileScoreCards,
  ScoreBreakdownCard,
  RiskyPartsContent,
  SceneBreakdownContent,
  ScriptLinesContent,
  SuggestedFixesContent,
} from "./ui-components";
import {
  SquarePen,
  PencilLine,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  Share2,
  ChevronDown,
  ChevronRight,
  Target,
  ShieldCheck,
} from "lucide-react";

type ResultsPageAnalysis = AnalysisResult & {
  scoreBreakdown?:
    AnalysisV2UiResult["scoreBreakdown"];
};

const inter = Inter({
  subsets: ["latin"],
});

const MAX_SCRIPT_CHARACTERS = 1000;
const MAX_TITLE_CHARACTERS = 200;
const IMPROVE_SCRIPT_CACHE_VERSION = "3";
const IMPROVE_SCRIPT_CACHE_STORAGE_KEY =
  "climpy-improve-script-cache";

const fallbackScript =
  "What if one small change could make viewers watch until the end? But the real problem is not editing speed. It is that the first line gives viewers no reason to stay.";

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

type ImproveScriptSuccessPayload = {
  status: "improved" | "diagnostic" | "preserve";
  improvedScript: string;
  changes: string[];
  reason: string;
  missingMaterial?: string[];
};

type StoredImproveScriptCache = {
  fingerprint: string;
  result: ImproveScriptSuccessPayload;
};

function createImproveScriptFingerprint({
  script,
  title,
  refinedHook,
  analysisResult,
  locale,
}: {
  script: string;
  title: string;
  refinedHook: string;
  analysisResult: AnalysisV2SuccessResponse["result"] | null;
  locale: Locale;
}): string {
  return JSON.stringify({
    version: IMPROVE_SCRIPT_CACHE_VERSION,
    script: script.trim(),
    title: title.trim(),
    refinedHook: refinedHook.trim(),
    analysisResult,
    locale,
  });
}

function isValidImproveScriptSuccessPayload(
  value: unknown
): value is ImproveScriptSuccessPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Record<string, unknown>;

  return (
    (payload.status === "improved" ||
      payload.status === "diagnostic" ||
      payload.status === "preserve") &&
    typeof payload.improvedScript === "string" &&
    payload.improvedScript.trim().length > 0 &&
    Array.isArray(payload.changes) &&
    payload.changes.every((item) => typeof item === "string") &&
    typeof payload.reason === "string" &&
    payload.reason.trim().length > 0 &&
    (payload.missingMaterial === undefined ||
      (Array.isArray(payload.missingMaterial) &&
        payload.missingMaterial.every((item) => typeof item === "string")))
  );
}

function parseStoredImproveScriptCache(
  value: string
): StoredImproveScriptCache | null {
  try {
    const parsed: unknown = JSON.parse(value);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const cache = parsed as Record<string, unknown>;

    if (
      typeof cache.fingerprint !== "string" ||
      cache.fingerprint.length === 0 ||
      !isValidImproveScriptSuccessPayload(cache.result)
    ) {
      return null;
    }

    return {
      fingerprint: cache.fingerprint,
      result: cache.result,
    };
  } catch {
    return null;
  }
}

export default function ResultsPage() {
  const { locale } = useLocale();
  const messages = useMessages();
  const results = messages.results;
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
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [improvedScript, setImprovedScript] = useState("");
  const [improvedScriptReason, setImprovedScriptReason] = useState("");
  const [improvedScriptChanges, setImprovedScriptChanges] = useState<string[]>([]);
  const [improvedScriptMissingMaterial, setImprovedScriptMissingMaterial] =
    useState<string[]>([]);
  const [improveScriptStatus, setImproveScriptStatus] =
    useState<ImproveScriptSuccessPayload["status"] | "">("");
  const [isImprovingScript, setIsImprovingScript] = useState(false);
  const [improveScriptError, setImproveScriptError] = useState("");
  const [copiedScript, setCopiedScript] = useState(false);
  const improveScriptRequestRef = useRef<{
    fingerprint: string;
    requestId: number;
  } | null>(null);
  const latestImproveScriptFingerprintRef = useRef("");
  const improveScriptRequestIdRef = useRef(0);
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
          setStorageError(results.error.invalidAnalysis);
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
        setStorageError(results.error.couldNotLoad);
      } finally {
        setIsStorageLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
    // Intentionally mount-only: this reads sessionStorage once. The error
    // strings are captured at first render, matching this effect's existing
    // run-once behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasAnalyzedScript = savedScript.trim().length > 0;
  const activeScript = hasAnalyzedScript ? savedScript.trim() : fallbackScript;

  // Old saved analyses have no `locale` field — treat them as "en" rather
  // than assuming they match the current UI locale.
  const savedAnalysisLocale = savedAnalysisV2?.locale ?? "en";
  const hasLocaleMismatch =
    hasAnalyzedScript &&
    Boolean(savedAnalysisV2) &&
    savedAnalysisLocale !== locale;

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

  const analysis = useMemo<ResultsPageAnalysis>(() => {
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
const modalHookText = improveError ? results.hookModal.noImprovedHookGenerated : improvedHook;

const hookDecision = savedAnalysisV2?.result.hookDecision ?? "keep";
const shouldShowHookAction = savedAnalysisV2
  ? hookDecision !== "keep"
  : analysis.fixes.length > 0 && analysis.hook.score < 75;
const hookActionLabel = savedAnalysisV2
  ? hookDecision === "diagnostic"
    ? results.suggestedFixes.hookActionNeedsDetails
    : hookDecision === "refine"
      ? results.suggestedFixes.hookActionRefine
      : results.suggestedFixes.hookActionImprove
  : analysis.hook.score >= 70
    ? results.suggestedFixes.hookActionRefine
    : results.suggestedFixes.hookActionImprove;

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
      setFeedbackSubmitError(results.feedback.submitError);
      return false;
    }

    return true;
  } catch {
    setFeedbackSubmitError(results.feedback.submitError);
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
    ? results.hookModal.needsMoreSpecificMaterialTitle
    : savedAnalysisV2
      ? hookDecision === "refine"
        ? results.hookModal.refinedHookTitle
        : results.hookModal.improvedHookTitle
      : shouldShowHookAnalysis
        ? results.hookModal.hookAnalysisTitle
        : analysis.hook.score >= 70
          ? results.hookModal.refineHookTitle
          : results.hookModal.improvedHookTitle;

const hookModalDescription =
  aiHookMode === "diagnostic"
    ? results.hookModal.tooBroadDescription
    : savedAnalysisV2
      ? hookDecision === "refine"
        ? results.hookModal.refineSameDescription
        : results.hookModal.usePromptDescription
      : shouldShowHookAnalysis
        ? results.hookModal.alreadyWorksDescription
        : analysis.hook.score >= 70
          ? results.hookModal.workingRefineDescription
          : results.hookModal.usePromptDescription;

const hookModalReasonLabel =
  aiHookMode === "diagnostic"
    ? results.hookModal.whyNoHookGenerated
    : savedAnalysisV2
      ? hookDecision === "refine"
        ? results.hookModal.whatThisVersionImproves
        : results.hookModal.whyItIsBetter
      : shouldShowHookAnalysis
        ? results.hookModal.whyThisHookWorks
        : analysis.hook.score >= 70
          ? results.hookModal.whatThisVersionImproves
          : results.hookModal.whyItIsBetter;

const displayFixes = createDisplayFixes(analysis.fixes, aiHook);

 const improvedHookReason =
  aiHookReason || getHookRewriteReason(activeScript);

const hookCopyButtonLabel =
  aiHookMode === "diagnostic"
    ? results.hookModal.copyAdvice
    : results.hookModal.copyHook;

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
        setAiHook(results.hookModal.addSpecificMaterial);
        setAiHookReason(hookAssessment);
        setAiHookMode("diagnostic");
        return;
      }

      if (!suggestedHook) {
        setImproveError(results.hookModal.noValidatedHookSuggestion);
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
          locale,
        }),
      });

      const data: {
        status?: string;
        improvedHook?: string;
        reason?: string;
        mode?: string;
      } = await response.json().catch(() => ({}));

      if (!response.ok) {
        // The API's `reason` here is a technical/debug message (rate limit,
        // bad request, provider outage) and must not be shown raw — always
        // use the localized fallback instead.
        setImproveError(results.hookModal.genericError);
        return;
      }

      if (!isValidImproveSuccessPayload(data)) {
        setImproveError(results.hookModal.genericError);
        return;
      }

      const hookText =
        typeof data.improvedHook === "string" &&
        data.improvedHook.trim().length > 0
          ? data.improvedHook.trim()
          // Unreachable: isValidImproveSuccessPayload already guarantees a
          // non-empty improvedHook. Left in English on purpose — this value
          // can flow into Improve Script's refinedHook/cache fingerprint, so
          // it must never depend on locale.
          : "AI hook improvement is unavailable right now.";

      const hookReason =
        typeof data.reason === "string" && data.reason.trim().length > 0
          ? data.reason.trim()
          : data.status === "good"
            ? results.hookModal.alreadyGoodReason
            : results.hookModal.adjustedReason;

      setAiHook(hookText);
      setAiHookReason(hookReason);
      setAiHookMode(data.mode === "diagnostic" ? "diagnostic" : "rewrite");
    } catch {
      setImproveError(results.hookModal.genericError);
    } finally {
      setIsImprovingHook(false);
    }
  }

  async function handleImproveScript() {
    function applyImproveScriptResult(
      data: ImproveScriptSuccessPayload
    ) {
      setImproveScriptStatus(data.status);
      setImprovedScript(data.improvedScript.trim());
      setImprovedScriptReason(data.reason.trim());
      setImprovedScriptChanges(
        data.changes.map((item) => item.trim()).filter(Boolean)
      );
      setImprovedScriptMissingMaterial(
        (data.missingMaterial ?? [])
          .map((item) => item.trim())
          .filter(Boolean)
      );
    }

    const refinedHook =
      aiHookMode === "rewrite" && aiHook.trim().length > 0
        ? aiHook.trim()
        : "";
    const analysisResult = savedAnalysisV2?.result ?? null;

    const improveScriptFingerprint =
      createImproveScriptFingerprint({
        script: activeScript,
        title: savedTitle,
        refinedHook,
        analysisResult,
        locale,
      });

    setCopiedScript(false);
    setImproveScriptError("");
    setIsScriptModalOpen(true);

    latestImproveScriptFingerprintRef.current =
      improveScriptFingerprint;

    let cachedImproveScript: StoredImproveScriptCache | null =
      null;

    try {
      const storedImproveScript =
        sessionStorage.getItem(IMPROVE_SCRIPT_CACHE_STORAGE_KEY);

      if (storedImproveScript !== null) {
        cachedImproveScript =
          parseStoredImproveScriptCache(storedImproveScript);
      }
    } catch {
      // Cache availability must not block Improve Script.
    }

    if (
      cachedImproveScript !== null &&
      cachedImproveScript.fingerprint === improveScriptFingerprint
    ) {
      setIsImprovingScript(false);
      applyImproveScriptResult(cachedImproveScript.result);
      return;
    }

    if (
      improveScriptRequestRef.current?.fingerprint === improveScriptFingerprint
    ) {
      return;
    }

    setImprovedScript("");
    setImprovedScriptReason("");
    setImprovedScriptChanges([]);
    setImprovedScriptMissingMaterial([]);
    setImproveScriptStatus("");
    setIsImprovingScript(true);

    const requestId =
      improveScriptRequestIdRef.current + 1;

    improveScriptRequestIdRef.current = requestId;
    improveScriptRequestRef.current = {
      fingerprint: improveScriptFingerprint,
      requestId,
    };

    try {
      const response = await fetch("/api/improve-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: activeScript,
          title: savedTitle,
          refinedHook: refinedHook || undefined,
          analysisResult: analysisResult ?? undefined,
          locale,
        }),
      });

      const data: unknown =
        await response.json().catch(() => ({}));

      if (
        latestImproveScriptFingerprintRef.current !== improveScriptFingerprint
      ) {
        return;
      }

      if (!response.ok) {
        // The API's `reason` here is a technical/debug message (rate limit,
        // bad request, provider outage) and must not be shown raw — always
        // use the localized fallback instead.
        setImproveScriptError(results.improveScriptModal.genericError);
        return;
      }

      if (!isValidImproveScriptSuccessPayload(data)) {
        setImproveScriptError(
          results.improveScriptModal.genericError
        );
        return;
      }

      if (
        latestImproveScriptFingerprintRef.current !== improveScriptFingerprint
      ) {
        return;
      }

      try {
        sessionStorage.setItem(
          IMPROVE_SCRIPT_CACHE_STORAGE_KEY,
          JSON.stringify({
            fingerprint: improveScriptFingerprint,
            result: data,
          })
        );
      } catch {
        // The validated result remains usable without storage.
      }

      applyImproveScriptResult(data);
    } catch {
      if (
        latestImproveScriptFingerprintRef.current !== improveScriptFingerprint
      ) {
        return;
      }

      setImproveScriptError(
        results.improveScriptModal.genericError
      );
    } finally {
      if (
        improveScriptRequestRef.current?.requestId === requestId
      ) {
        improveScriptRequestRef.current = null;
      }

      if (
        latestImproveScriptFingerprintRef.current === improveScriptFingerprint
      ) {
        setIsImprovingScript(false);
      }
    }
  }

  async function handleCopyImprovedScript() {
    if (isImprovingScript || improveScriptError) return;

    setCopiedScript(false);

    try {
      await navigator.clipboard.writeText(improvedScript);
      setCopiedScript(true);

      setTimeout(() => {
        setCopiedScript(false);
      }, 1500);
    } catch {
      setCopiedScript(false);
    }
  }

  async function handleShare() {
    if (!isStorageLoaded || storageError || !hasAnalyzedScript) return;

    const reviewText = [
      savedTitle || results.share.fallbackTitle,
      `${results.scoreCards.overallScore}: ${analysis.overall.score}/100`,
      `${results.scoreCards.hookScore}: ${analysis.hook.score}/100`,
      `${results.scoreCards.retentionRisk}: ${analysis.risk.score}/100`,
      "",
      activeScript,
    ].join("\n");

    const shareData = {
      title: savedTitle || results.share.fallbackTitle,
      text: reviewText,
    };

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
        setShareMessage(results.share.shared);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(reviewText);
        setShareMessage(results.share.reviewCopied);
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
              <span className="text-[14px] font-semibold text-[#7C3AED]">{messages.common.results}</span>
            </Link>
            <Link href="/" className="flex h-[46px] items-center gap-3 rounded-[12px] px-4 transition hover:bg-white/[0.03]">
              <PencilLine size={16} className="text-[#6B7280]" />
              <span className="text-[14px] font-medium text-[#6B7280]">{results.nav.newAnalysis}</span>
            </Link>
          </nav>
          <div className="px-4 pt-3">
            <LanguageSwitcher className="w-full justify-center" />
          </div>
          {isStorageLoaded && !storageError && hasAnalyzedScript && (
            <div className="mt-auto px-4 pb-10 pt-8">
              <div className="rounded-[18px] border border-[#E5E7EB]/70 bg-white p-5">
              <p className="text-[14px] font-semibold text-[#111827]">{results.feedback.heading}</p>
              <p className="mt-1.5 text-[12px] text-[#6B7280]">{results.feedback.subheading}</p>
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={() => { setDesktopFeedback("helpful"); setDesktopSelectedReason(null); setDesktopFeedbackSubmitted(false); }}
                  className={["flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border text-[13px] font-medium transition", desktopFeedback === "helpful" ? "border-[#22C55E]/60 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#E5E7EB] text-[#6B7280] hover:border-[#22C55E]/40 hover:text-[#111827]"].join(" ")}
                >
                  <ThumbsUp size={14} />
                  {results.feedback.helpful}
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
                  <p className="text-[11px] text-[#6B7280] mb-1.5">{results.feedback.whatWasHelpful}</p>
                  <FeedbackReasonOptions
                    rating="helpful"
                    selectedReason={desktopSelectedReason}
                    disabled={feedbackSubmitting}
                    onSelect={(reason) => {
                      if (reason === "Other") {
                        setDesktopOtherFeedbackOpen(true);
                        return;
                      }

                      setDesktopSelectedReason(reason);
                      void submitFeedback("helpful", reason).then((ok) => {
                        if (ok) setDesktopFeedbackSubmitted(true);
                      });
                    }}
                  />
                </div>
              )}

              {desktopFeedback === "dislike" && !desktopFeedbackSubmitted && (
                <div className="mt-3">
                  <p className="text-[11px] text-[#6B7280] mb-1.5">{results.feedback.whatWasWrong}</p>
                  <FeedbackReasonOptions
                    rating="unhelpful"
                    selectedReason={desktopSelectedReason}
                    disabled={feedbackSubmitting}
                    onSelect={(reason) => {
                      if (reason === "Other") {
                        setDesktopOtherFeedbackOpen(true);
                        return;
                      }

                      setDesktopSelectedReason(reason);
                      void submitFeedback("unhelpful", reason).then((ok) => {
                        if (ok) setDesktopFeedbackSubmitted(true);
                      });
                    }}
                  />
                </div>
              )}

              {desktopFeedbackSubmitted && (
                <p className="mt-2.5 text-[12px]" style={{ color: desktopFeedback === "helpful" ? "#22C55E" : "#EF4444" }}>
                  {desktopFeedback === "helpful" ? results.feedback.thanksHelpful : results.feedback.thanksUnhelpful}
                </p>
              )}

              {feedbackSubmitting && (
                <p className="mt-2 text-[12px] text-[#6B7280]">
                  {results.feedback.sending}
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
                <h1 className="text-[36px] font-semibold tracking-[-0.02em] text-[#111827]">{results.header.title}</h1>
                <p className="mt-1.5 text-[14px] text-[#6B7280]">
                  {results.header.analyzedPrefix}{" "}
                  <span className="text-[#6B7280]">{savedTitle || results.header.fallbackTitle}</span>
                </p>
                {hasLocaleMismatch && (
                  <p className="mt-1 text-[12px] text-[#9CA3AF]">
                    {results.localeMismatch.message}
                  </p>
                )}
              </div>
              <Link href="/" className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 text-[14px] font-semibold text-[#111827] transition hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/10">
                <PencilLine size={15} />
                {results.nav.newAnalysis}
              </Link>
            </div>

            {/* Loading state */}
            {!isStorageLoaded && (
              <Card className="p-8 mb-6">
                <p className="text-[20px] font-semibold text-[#111827]">{results.loading.title}</p>
                <p className="mt-3 text-[14px] text-[#6B7280]">{results.loading.descriptionDesktop}</p>
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
                <h2 className="text-[26px] font-semibold text-[#111827]">{results.empty.headingDesktop}</h2>
                <p className="mt-4 text-[15px] text-[#6B7280]">{results.empty.descriptionDesktop}</p>
                <Link href="/" className="mt-6 inline-flex h-[48px] items-center justify-center rounded-[12px] bg-[#7C3AED] px-6 text-[15px] font-semibold text-[#111827] transition hover:bg-[#6D28D9]">{results.nav.newAnalysis}</Link>
              </Card>
            )}

            {/* Results */}
            {isStorageLoaded && !storageError && hasAnalyzedScript && (
              <>
                {/* Score cards */}
                <div className="mb-6 grid grid-cols-3 gap-5">
                  <DesktopScoreCard
                    title={results.scoreCards.overallScore}
                    data={analysis.overall}
                    accentColor={analysis.overall.ringColor}
                    category="overall"
                  />
                  <DesktopScoreCard
                    title={results.scoreCards.hookScore}
                    data={analysis.hook}
                    accentColor={analysis.hook.color}
                    category="hook"
                  />
                  <DesktopScoreCard
                    title={results.scoreCards.retentionRisk}
                    data={analysis.risk}
                    accentColor={analysis.risk.color}
                    category="risk"
                  />
                </div>

                  {analysis.scoreBreakdown && (
                    <div className="mb-6">
                      <ScoreBreakdownCard
                        breakdown={
                          analysis.scoreBreakdown
                        }
                      />
                    </div>
                  )}

                {/* Main Takeaway */}
                <div className="mb-6 rounded-[16px] border border-[#DDD6FE] bg-[#F3E8FF] px-5 py-4 shadow-[0_0_28px_rgba(124,58,237,0.07)]">
                  <div className="flex items-start gap-3">
                    <Target size={16} className="mt-0.5 shrink-0 text-[#7C3AED]" />
                    <div>
                      <p className="text-[12.5px] font-semibold text-[#7C3AED]">{results.mainTakeaway.label}</p>
                      <p className="mt-1 text-[13px] leading-[1.6] text-[#5B21B6]">{analysis.overall.description}</p>
                    </div>
                  </div>
                </div>

                {/* Script + right column */}
                <div className="grid grid-cols-[1.35fr_0.9fr] items-start gap-5">
                  {/* Script card */}
                  <Card className="p-6">
                    <div className="mb-4">
                      <h2 className="text-[17px] font-semibold text-[#111827]">{results.script.heading}</h2>
                      {savedTitle && (
                        <div className="mt-3 rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 py-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6B7280]">{results.script.titleLabel}</p>
                          <p className="mt-1 text-[14px] font-semibold leading-[1.45] text-[#111827]">{savedTitle}</p>
                        </div>
                      )}
                    </div>
                    <div className="max-h-[480px] min-w-0 overflow-y-auto overflow-x-hidden rounded-[16px] border border-[#E5E7EB] bg-[#F8F8FC] p-4">
                      <ScriptLinesContent
                        lines={scriptLines}
                        timestamps={lineTimestamps}
                        riskyLineIndexes={analysis.riskyLineIndexes}
                        warningLineIndexes={analysis.warningLineIndexes}
                        fallbackTimestamp={formatTime(estimatedDuration)}
                      />
                    </div>
                    <p className="mt-4 text-[12px] text-[#6B7280]">
  {results.script.characterCount(characterCount)} — {results.script.estimatedDuration(formatTime(estimatedDuration))}
</p>
                  </Card>

                  {/* Right column */}
                  <div className="flex flex-col gap-6">
                    {/* Risky Parts */}
                    <Card className="p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-[17px] font-semibold text-[#111827]">{results.riskyParts.heading}</h2>
                        <span className="text-[12px] font-medium text-[#6B7280]">{results.riskyParts.found(analysis.riskyParts.length)}</span>
                      </div>
                      <RiskyPartsContent
                        parts={analysis.riskyParts}
                        hasFixes={analysis.fixes.length > 0}
                      />
                    </Card>

                    {/* Suggested Fixes */}
                    <Card className="p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-[17px] font-semibold text-[#111827]">{results.suggestedFixes.heading}</h2>
                        <span className="text-[12px] font-medium text-[#6B7280]">{results.suggestedFixes.count(displayFixes.length)}</span>
                      </div>
                      <button
                        onClick={handleImproveScript}
                        disabled={isImprovingScript}
                        className="mb-3 mr-3 inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-[#DDD6FE] bg-[#F3E8FF] px-4 text-[13px] font-semibold text-[#7C3AED] transition hover:bg-[#EDE9FE] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <PencilLine size={15} />
                        {results.suggestedFixes.improveScriptButton}
                      </button>
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
                        <SuggestedFixesContent fixes={displayFixes} />
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Scene Breakdown */}
                <Card className="mt-5 p-6">
                  <h2 className="mb-4 text-[17px] font-semibold text-[#111827]">{results.sceneBreakdown.heading}</h2>
                  <SceneBreakdownContent
                    segments={analysis.sceneSegments}
                    scaleLabels={scaleLabels}
                  />
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
            <h2 className="text-[20px] font-semibold text-[#111827]">{desktopFeedback === "helpful" ? results.feedback.otherModal.likedTitle : results.feedback.otherModal.wrongTitle}</h2>
            <p className="mt-1.5 text-[13px] text-[#6B7280]">{results.feedback.otherModal.helperText}</p>
            <textarea
              value={desktopOtherFeedbackText}
              onChange={(e) => setDesktopOtherFeedbackText(e.target.value)}
              placeholder={desktopFeedback === "helpful" ? results.feedback.otherModal.placeholderLiked : results.feedback.otherModal.placeholderWrong}
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
                {feedbackSubmitting ? results.feedback.otherModal.submitting : results.feedback.otherModal.submit}
              </button>
              <button onClick={() => setDesktopOtherFeedbackOpen(false)} className="h-[40px] rounded-[10px] border border-[#E5E7EB] bg-[#F8F8FC] px-5 text-[13px] font-semibold text-[#111827] transition hover:bg-[#F3F4F6]">{results.feedback.otherModal.cancel}</button>
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

          <div className="flex justify-center px-5 pb-2">
            <LanguageSwitcher />
          </div>

          {shareMessage && (
            <p className="px-5 -mt-1 mb-2 text-[11px] text-[#6B7280]">{shareMessage}</p>
          )}

          {/* Title */}
          <div className="px-5 mb-5">
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#111827]">{results.header.title}</h1>
            <p className="mt-1 text-[12px] text-[#6B7280]">
              {results.header.analyzedPrefix} <span className="text-[#6B7280]">{savedTitle || results.header.fallbackTitle}</span>
            </p>
            {hasLocaleMismatch && (
              <p className="mt-1 text-[11px] text-[#9CA3AF]">
                {results.localeMismatch.message}
              </p>
            )}
          </div>

          {/* Loading */}
          {!isStorageLoaded && (
            <div className="mx-5 mb-4 rounded-[18px] border border-[#E5E7EB] bg-white p-5">
              <p className="text-[15px] font-semibold text-[#111827]">{results.loading.title}</p>
              <p className="mt-1.5 text-[13px] text-[#6B7280]">{results.loading.descriptionMobile}</p>
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
              <p className="text-[18px] font-semibold text-[#111827] mb-2">{results.empty.headingMobile}</p>
              <p className="text-[13px] leading-[1.6] text-[#6B7280] mb-5">{results.empty.descriptionMobile}</p>
              <Link href="/" className="flex h-[44px] w-full items-center justify-center rounded-[12px] bg-[#6D28D9] text-[14px] font-semibold text-[#111827]">{results.nav.newAnalysis}</Link>
            </div>
          )}

          {isStorageLoaded && !storageError && hasAnalyzedScript && (
            <div className="flex flex-col gap-3 px-5">

              {/* Score cards — horizontal row */}
              <MobileScoreCards
                overall={analysis.overall}
                hook={analysis.hook}
                risk={analysis.risk}
              />

                {analysis.scoreBreakdown && (
                  <ScoreBreakdownCard
                    breakdown={
                      analysis.scoreBreakdown
                    }
                    compact
                  />
                )}

              {/* Main Takeaway */}
              <div className="rounded-[18px] border border-[#DDD6FE] bg-[#F3E8FF] px-4 py-4 shadow-[0_0_24px_rgba(124,58,237,0.07)]">
                <div className="flex items-start gap-3">
                  <Target size={15} className="mt-0.5 shrink-0 text-[#7C3AED]" />
                  <div>
                    <p className="text-[11px] font-semibold text-[#7C3AED] mb-1">{results.mainTakeaway.label}</p>
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
                  <h2 className="text-[15px] font-semibold text-[#111827]">{results.riskyParts.heading}</h2>
                  <span className="text-[11px] font-medium text-[#6B7280]">{results.riskyParts.found(analysis.riskyParts.length)}</span>
                </div>
                <RiskyPartsContent
                  parts={analysis.riskyParts}
                  hasFixes={analysis.fixes.length > 0}
                  compact
                />
              </div>

              {/* Suggested Fixes */}
              <div className="rounded-[18px] border border-[#E5E7EB] bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <h2 className="text-[15px] font-semibold text-[#111827]">{results.suggestedFixes.heading}</h2>
                  <span className="text-[11px] font-medium text-[#6B7280]">{results.suggestedFixes.count(displayFixes.length)}</span>
                </div>
                <div className="px-4 pb-4 flex flex-col gap-2.5">
                  <button
                    onClick={handleImproveScript}
                    disabled={isImprovingScript}
                    className="h-[42px] w-full rounded-[12px] border border-[#DDD6FE] bg-[#F3E8FF] text-[13px] font-semibold text-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {results.suggestedFixes.improveScriptButton}
                  </button>
                  <SuggestedFixesContent
                    fixes={mobileFixesOpen ? displayFixes : displayFixes.slice(0, 3)}
                    compact
                  />
                  {displayFixes.length > 3 && (
                    <button onClick={() => setMobileFixesOpen(!mobileFixesOpen)} className="flex w-full items-center justify-center gap-1.5 pt-1">
                      <span className="text-[12px] font-semibold text-[#6B7280]">{mobileFixesOpen ? results.suggestedFixes.showFewer : results.suggestedFixes.viewAll}</span>
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
                  <h2 className="text-[15px] font-semibold text-[#111827]">{results.script.heading}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#6B7280]">{results.script.characterCount(characterCount)}</span>
                    <ChevronDown size={15} className={`text-[#6B7280] transition-transform ${mobileScriptOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {mobileScriptOpen && (
                  <div className="px-4 pb-4">
                    {savedTitle && (
                      <div className="mb-3 rounded-[10px] border border-[#E5E7EB] bg-[#F8F8FC] px-3 py-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B7280]">{results.script.titleLabel}</p>
                        <p className="mt-1 text-[12px] font-semibold leading-[1.45] text-[#111827]">{savedTitle}</p>
                      </div>
                    )}
                    <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] p-3 max-h-[300px] overflow-y-auto">
                      <ScriptLinesContent
                        lines={scriptLines}
                        timestamps={lineTimestamps}
                        riskyLineIndexes={analysis.riskyLineIndexes}
                        warningLineIndexes={analysis.warningLineIndexes}
                        fallbackTimestamp={formatTime(estimatedDuration)}
                        compact
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-[#9CA3AF]">{results.script.estimatedDuration(formatTime(estimatedDuration))}</p>
                  </div>
                )}
              </div>

              {/* Scene Breakdown — accordion */}
              <div className="rounded-[18px] border border-[#E5E7EB] bg-white overflow-hidden">
                <button
                  onClick={() => setMobileSceneOpen(!mobileSceneOpen)}
                  className="flex w-full items-center justify-between px-5 py-4"
                >
                  <h2 className="text-[15px] font-semibold text-[#111827]">{results.sceneBreakdown.heading}</h2>
                  <ChevronDown size={15} className={`text-[#6B7280] transition-transform ${mobileSceneOpen ? "rotate-180" : ""}`} />
                </button>
                {mobileSceneOpen && (
                  <div className="px-4 pb-4">
                    <SceneBreakdownContent
                      segments={analysis.sceneSegments}
                      scaleLabels={scaleLabels}
                      compact
                    />
                  </div>
                )}
              </div>

              {/* Rate This Analysis */}
              <div className="rounded-[18px] border border-[#E5E7EB] bg-white px-5 py-4">
                <p className="text-[14px] font-semibold text-[#111827]">{results.feedback.heading}</p>
                <p className="mt-1 text-[12px] text-[#6B7280]">{results.feedback.subheading}</p>
                <div className="mt-3 flex gap-2.5">
                  <button
                    onClick={() => { setMobileFeedback("helpful"); setMobileSelectedReason(null); setMobileFeedbackSubmitted(false); }}
                    className={["flex h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border text-[13px] font-semibold transition", mobileFeedback === "helpful" ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#22C55E]" : "border-[#E5E7EB] bg-[#F8F8FC] text-[#6B7280]"].join(" ")}
                  >
                    <ThumbsUp size={13} />
                    {results.feedback.helpful}
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
                    <p className="text-[11px] text-[#6B7280] mb-1.5">{results.feedback.whatWasHelpful}</p>
                    <FeedbackReasonOptions
                      rating="helpful"
                      selectedReason={mobileSelectedReason}
                      disabled={feedbackSubmitting}
                      compact
                      onSelect={(reason) => {
                        if (reason === "Other") {
                          setIsFeedbackOpen(true);
                          return;
                        }

                        setMobileSelectedReason(reason);
                        void submitFeedback("helpful", reason).then((ok) => {
                          if (ok) setMobileFeedbackSubmitted(true);
                        });
                      }}
                    />
                  </div>
                )}

                {mobileFeedback === "dislike" && !mobileFeedbackSubmitted && (
                  <div className="mt-3">
                    <p className="text-[11px] text-[#6B7280] mb-1.5">{results.feedback.whatWasWrong}</p>
                    <FeedbackReasonOptions
                      rating="unhelpful"
                      selectedReason={mobileSelectedReason}
                      disabled={feedbackSubmitting}
                      compact
                      onSelect={(reason) => {
                        if (reason === "Other") {
                          setIsFeedbackOpen(true);
                          return;
                        }

                        setMobileSelectedReason(reason);
                        void submitFeedback("unhelpful", reason).then((ok) => {
                          if (ok) setMobileFeedbackSubmitted(true);
                        });
                      }}
                    />
                  </div>
                )}

                {mobileFeedbackSubmitted && (
                  <p className="mt-2 text-[12px]" style={{ color: mobileFeedback === "helpful" ? "#22C55E" : "#EF4444" }}>
                    {mobileFeedback === "helpful" ? results.feedback.thanksHelpful : results.feedback.thanksUnhelpful}
                  </p>
                )}

                {feedbackSubmitting && (
                  <p className="mt-2 text-[12px] text-[#6B7280]">
                    {results.feedback.sending}
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
              {results.nav.newAnalysisMobileNav}
            </Link>
            <Link href="/results" className="flex h-[40px] items-center justify-center gap-2 rounded-[12px] border border-[#DDD6FE] bg-[#F3E8FF] px-5 text-[13px] font-semibold text-[#7C3AED]">
              <SquarePen size={13} />
              {messages.common.results}
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
  {mobileFeedback === "helpful" ? results.feedback.mobileModal.likedTitle : results.feedback.mobileModal.wrongTitle}
</h2>

            <p className="mt-2 text-[13px] font-normal leading-[21px] text-[#6B7280]">
  {mobileFeedback === "helpful"
    ? results.feedback.mobileModal.likedDescription
    : results.feedback.mobileModal.wrongDescription}
</p>

            <textarea
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder={
  mobileFeedback === "helpful"
    ? results.feedback.mobileModal.placeholderLiked
    : results.feedback.mobileModal.placeholderWrong
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
                {feedbackSubmitting ? results.feedback.mobileModal.sending : results.feedback.mobileModal.send}
              </button>

              <button
                onClick={() => setIsFeedbackOpen(false)}
                className="h-[44px] rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] text-[13px] font-semibold text-[#111827] transition hover:bg-[#F3F4F6]"
              >
                {results.feedback.mobileModal.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] px-[16px]">
          <div className="relative w-full max-w-[680px] rounded-[20px] border border-[#E5E7EB] bg-white p-5 sm:p-7">
            <button
              onClick={() => setIsScriptModalOpen(false)}
              className="absolute right-5 top-4 text-[22px] leading-none text-[#6B7280] transition hover:text-[#111827]"
            >
              x
            </button>

            <h2 className="pr-8 text-[20px] font-semibold text-[#111827] sm:text-[22px]">
              {improvedScriptMissingMaterial.length > 0
                ? results.improveScriptModal.needsMoreMaterialTitle
                : improveScriptStatus === "preserve"
                  ? results.improveScriptModal.originalPreservedTitle
                  : results.improveScriptModal.improvedTitle}
            </h2>

            <p className="mt-2 text-[13px] leading-5 text-[#6B7280] sm:text-[14px]">
              {improveScriptStatus === "preserve"
                ? results.improveScriptModal.preservedDescription
                : results.improveScriptModal.defaultDescription}
            </p>

            <div className="mt-5 max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-[14px] border border-[#E5E7EB] bg-[#F8F8FC] p-4 text-[13px] leading-6 text-[#111827] sm:text-[14px]">
              {isImprovingScript
                ? results.improveScriptModal.improving
                : improveScriptError
                  ? results.improveScriptModal.noScriptGenerated
                  : improvedScript}
            </div>

            {improveScriptError ? (
              <p className="mt-4 text-[13px] leading-5 text-[#7C3AED]">
                {improveScriptError}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {improvedScriptReason && (
                  <p className="text-[13px] leading-5 text-[#6B7280]">
                    {improvedScriptReason}
                  </p>
                )}

                {improvedScriptChanges.length > 0 && (
                  <ul className="space-y-1 text-[12px] leading-5 text-[#6B7280] sm:text-[13px]">
                    {improvedScriptChanges.map((change) => (
                      <li key={change}>• {change}</li>
                    ))}
                  </ul>
                )}

                {improvedScriptMissingMaterial.length > 0 && (
                  <p className="text-[12px] leading-5 text-[#6B7280] sm:text-[13px]">
                    {results.improveScriptModal.addMissingMaterial(improvedScriptMissingMaterial)}
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCopyImprovedScript}
                disabled={
                  isImprovingScript || Boolean(improveScriptError)
                }
                className="h-[42px] flex-1 rounded-[12px] bg-[#7C3AED] text-[13px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copiedScript ? results.improveScriptModal.copied : improveScriptStatus === "preserve"
                ? results.improveScriptModal.copyOriginal
                : results.improveScriptModal.copyScript}
              </button>

              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="h-[42px] flex-1 rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] text-[13px] font-semibold text-[#111827] transition hover:bg-[#F3F4F6]"
              >
                {results.improveScriptModal.close}
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
                &ldquo;{isImprovingHook ? results.hookModal.improving : modalHookText}&rdquo;
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
                      ? results.hookModal.rewritingDescription
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
              {copiedHook ? results.hookModal.copied : hookCopyButtonLabel}
            </button>

            <button
              onClick={() => setIsHookModalOpen(false)}
              className="absolute left-[175px] top-[360px] h-[40px] w-[100px] rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] text-[14px] font-semibold leading-[24px] text-[#111827] transition hover:bg-[#F3E8FF]"
            >
              {results.hookModal.close}
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
                &ldquo;{isImprovingHook ? results.hookModal.improving : modalHookText}&rdquo;
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
                    ? results.hookModal.rewritingDescription
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
                {copiedHook ? results.hookModal.copied : hookCopyButtonLabel}
              </button>
              <button
                onClick={() => setIsHookModalOpen(false)}
                className="flex-1 h-[40px] rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] text-[13px] font-semibold text-[#111827] focus:outline-none focus:ring-0"
              >
                {results.hookModal.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
