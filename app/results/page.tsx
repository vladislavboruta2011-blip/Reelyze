"use client";

import Image from "next/image";
import { Inter } from "next/font/google";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthNav } from "../auth-nav";
import { LanguageSwitcher } from "../language-switcher";
import { SignInModal } from "../sign-in-modal";
import { useSession } from "../session-provider";
import { useMessages } from "../use-messages";
import { useLocale } from "../locale-provider";
import { supabaseBrowser } from "../../lib/supabase/browser";
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
  SaveAnalysisAction,
  ScoreBreakdownCard,
  RiskyPartsContent,
  SceneBreakdownContent,
  ScriptLinesContent,
  SuggestedFixesContent,
} from "./ui-components";
import {
  clearPendingSaveIntent,
  createSaveAnalysisFingerprint,
  generateDefaultAnalysisTitle,
  insertAnalysis,
  readPendingSaveIntent,
  validateAnalysisForSave,
  writePendingSaveIntent,
} from "./save-analysis";
import { readAndClearReopenedAnalysisId } from "./reopened-analysis";
import { ImprovedHookModal } from "./improved-hook-modal";
import {
  AskClimpyPanel,
  type AskClimpyDisplayMessage,
  type AskClimpyRetryableRequest,
  type AskClimpyStarterQuestion,
} from "./ask-climpy-panel";
import {
  classifyAskClimpyLocalIntent,
  classifyAskClimpyRewriteIntent,
  isAskClimpyErrorReferencePhrase,
} from "./ask-climpy-local-intents";
import {
  ASK_CLIMPY_LIMITS,
  buildAskClimpyAnalysisContext,
  findRiskiestRiskyPartIndex,
  isRiskyPartRewriteEligible,
  type AskClimpyResponse,
  type SelectedContext,
} from "../../engine/ask-climpy-validation";
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
  Sparkles,
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

// Client-side re-validation of the approved Ask Climpy response shape
// (answer/action?/example?/cannotSafelyRewrite — no "rewrite" object, no
// "status" field). This is deliberately shallow (it does not re-check
// rewrite grounding, which is already enforced server-side by
// validateAskClimpyModelResult) — it only guards against a malformed/
// unexpected payload before it is rendered.
function isValidAskClimpyResponse(value: unknown): value is AskClimpyResponse {
  if (!value || typeof value !== "object") return false;

  const payload = value as Record<string, unknown>;

  if (typeof payload.answer !== "string" || payload.answer.trim().length === 0) {
    return false;
  }

  if (typeof payload.cannotSafelyRewrite !== "boolean") return false;

  if (
    payload.action !== undefined &&
    (typeof payload.action !== "string" || payload.action.trim().length === 0)
  ) {
    return false;
  }

  if (
    payload.example !== undefined &&
    (typeof payload.example !== "string" || payload.example.trim().length === 0)
  ) {
    return false;
  }

  return true;
}

// Replaces an existing message with the same `id` in place (preserving its
// position) or appends `message` when no such id exists yet. Used by
// sendAskClimpyRequest so a retried failure UPDATES the same error message
// instead of appending a second, duplicate error block — the diagnosed
// regression (one user-triggered submission followed by a failed Retry
// produced two visually identical error blocks, since the retry path used
// to mint a brand-new message id every time instead of reusing the
// original failed turn's id).
function upsertAskClimpyMessage(
  previous: AskClimpyDisplayMessage[],
  message: AskClimpyDisplayMessage
): AskClimpyDisplayMessage[] {
  const existingIndex = previous.findIndex((existing) => existing.id === message.id);

  if (existingIndex === -1) {
    return [...previous, message];
  }

  const next = [...previous];
  next[existingIndex] = message;
  return next;
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
  const { user } = useSession();
  const [saveState, setSaveState] =
    useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveErrorReason, setSaveErrorReason] =
    useState<"auth" | "validation" | "database" | "">("");
  const [isSaveSignInModalOpen, setIsSaveSignInModalOpen] = useState(false);
  const savedAnalysisIdRef = useRef<string | null>(null);

  const [isAskClimpyOpen, setIsAskClimpyOpen] = useState(false);
  const [askClimpyMessages, setAskClimpyMessages] = useState<
    AskClimpyDisplayMessage[]
  >([]);
  const [askClimpyInput, setAskClimpyInput] = useState("");
  const [isAskClimpyPending, setIsAskClimpyPending] = useState(false);
  const [isAskClimpyCapped, setIsAskClimpyCapped] = useState(false);
  // The id of the one assistant message (if any) that should currently play
  // its word-by-word reveal animation — never more than one at a time, and
  // only ever the message that was just accepted by the success branch of
  // handleSendAskClimpy below. Cleared (a) by the panel itself once the
  // reveal finishes, (b) on close (so reopening shows the complete answer,
  // never a resumed/restarted animation), and (c) on analysis-identity
  // change alongside the rest of the conversation reset.
  const [askClimpyRevealMessageId, setAskClimpyRevealMessageId] = useState<
    string | null
  >(null);
  const askClimpyAbortControllerRef = useRef<AbortController | null>(null);
  const askClimpyRequestIdRef = useRef(0);
  const askClimpyMountedRef = useRef(false);
  // Synchronous re-entrancy guard for handleSendAskClimpy/handleRetryAskClimpy
  // — closes the race where two submissions (Enter + click, a fast double
  // click/tap, or a rapid double Retry click) both read isAskClimpyPending
  // as false from the SAME pre-update render closure before React commits
  // the first setIsAskClimpyPending(true). A ref mutates synchronously and
  // is shared across every closure of this component instance, so it blocks
  // a second call in the exact same tick that the state-based check cannot.
  const askClimpyIsSubmittingRef = useRef(false);

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

        // Read and cleared unconditionally, on every /results mount,
        // regardless of whether this session's stored data turns out to be
        // valid below — never only inside the success branch. Otherwise a
        // marker left over from a discarded/invalid handoff could survive
        // this mount and incorrectly mark a later, genuinely unsaved fresh
        // analysis in the same tab as already "saved".
        const reopenedAnalysisId = readAndClearReopenedAnalysisId();

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

          // Set only when app/my-analyses/[id] just handed this analysis
          // off — never for a fresh analysis, which never writes this key.
          // Reusing the existing "saved" SaveAnalysisAction state (instead
          // of a bespoke one) is what stops Save from silently inserting a
          // duplicate row for content that is already persisted.
          if (reopenedAnalysisId) {
            savedAnalysisIdRef.current = reopenedAnalysisId;
            setSaveState("saved");
          }
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

  // The smallest reliable stable identity for "this analysis" — a
  // deterministic serialization of the active script plus the validated
  // Analysis V2 result, following the same JSON.stringify-based fingerprint
  // pattern already used by createImproveScriptFingerprint below (rather
  // than introducing a new hashing utility). Deliberately excludes locale —
  // switching languages must not clear the conversation — and is plain
  // value equality, not React object-reference equality, so it does not
  // depend on savedAnalysisV2 (or activeScript) being the exact same object
  // across renders, only on having the same content.
  const askClimpyAnalysisIdentityKey = useMemo(() => {
    if (!savedAnalysisV2) return null;

    return JSON.stringify({
      script: activeScript,
      result: savedAnalysisV2.result,
    });
  }, [activeScript, savedAnalysisV2]);

  // Clears the Ask Climpy conversation only when the identity key above
  // actually changes value — not on every render, and not merely because
  // savedAnalysisV2 becomes a new object with the same content. Closing and
  // reopening the panel for the SAME analysis must keep the conversation
  // (see ask-climpy-panel.tsx), so the reset must key off analysis identity,
  // not panel open/close. In practice /results is only ever reached via a
  // fresh navigation and savedAnalysisV2 is set exactly once per mount (see
  // the mount-only effect above), so this mostly guards a defensive edge
  // case rather than a commonly hit path.
  useEffect(() => {
    if (!askClimpyMountedRef.current) {
      askClimpyMountedRef.current = true;
      return;
    }

    askClimpyAbortControllerRef.current?.abort();
    askClimpyAbortControllerRef.current = null;
    askClimpyRequestIdRef.current += 1;
    setAskClimpyMessages([]);
    setAskClimpyInput("");
    setIsAskClimpyPending(false);
    setIsAskClimpyCapped(false);
    setIsAskClimpyOpen(false);
    setAskClimpyRevealMessageId(null);
  }, [askClimpyAnalysisIdentityKey]);

  // Aborts any in-flight Ask Climpy request on unmount (navigating away from
  // /results entirely) — the close button and the identity-reset effect
  // above both already abort on their own triggers; this covers the third
  // required case (see ask-climpy-panel.tsx's own comment).
  useEffect(() => {
    return () => {
      askClimpyAbortControllerRef.current?.abort();
    };
  }, []);

  // Old saved analyses have no `locale` field — treat them as "en" rather
  // than assuming they match the current UI locale.
  const savedAnalysisLocale = savedAnalysisV2?.locale ?? "en";
  const hasLocaleMismatch =
    hasAnalyzedScript &&
    Boolean(savedAnalysisV2) &&
    savedAnalysisLocale !== locale;

  // Save Analysis is only ever offered for a validated Analysis V2 result —
  // the legacy client-only heuristic fallback (savedAnalysisV2 === null)
  // has no model identifier or validated result shape to persist, so it
  // can never satisfy public.analyses's schema.
  const saveTitle = useMemo(() => {
    return generateDefaultAnalysisTitle(
      savedTitle,
      activeScript,
      results.save.untitled,
      MAX_TITLE_CHARACTERS
    );
  }, [savedTitle, activeScript, results.save.untitled]);

  // Computed on demand (never memoized/stored as plain state) — this digest
  // is only ever needed at the exact moments Save is clicked or a pending
  // intent is being verified, and computing it fresh each time means the
  // hashed script/title/model never sit around in component state, only
  // the SHA-256 result briefly does at the two call sites below.
  async function computeCurrentSaveFingerprint(): Promise<string> {
    if (!savedAnalysisV2) return "";

    return createSaveAnalysisFingerprint({
      script: activeScript,
      title: saveTitle,
      locale: savedAnalysisLocale,
      modelUsed: savedAnalysisV2.modelUsed,
    });
  }

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
        locale,
      }),
    });

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    // A 200 response alone is not proof feedback was actually stored —
    // only an explicit stored: true from the API counts as success. This
    // must never say "saved" when it wasn't.
    const stored =
      response.ok &&
      typeof payload === "object" &&
      payload !== null &&
      (payload as { stored?: unknown }).stored === true;

    if (!stored) {
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

    const analysisResult = savedAnalysisV2?.result ?? null;

    // The validated Analysis V2 result is the single source of truth for
    // the approved refined hook whenever one exists — Improve Script must
    // use it deterministically, not only when the Improve Hook modal
    // happens to have been opened first in this session. Relying solely on
    // aiHook/aiHookMode (an ephemeral UI mirror populated only as a
    // side-effect of that separate action) let Improve Script silently
    // invent its own opening — including a question-style hook — whenever
    // the user ran Improve Script without first opening Improve Hook.
    const analysisApprovedHook =
      analysisResult &&
      (analysisResult.hookDecision === "refine" ||
        analysisResult.hookDecision === "rewrite")
        ? (analysisResult.suggestedHook ?? "").trim()
        : "";

    const refinedHook =
      analysisApprovedHook.length > 0
        ? analysisApprovedHook
        : aiHookMode === "rewrite" && aiHook.trim().length > 0
          ? aiHook.trim()
          : "";

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

  // Only offered for a validated Analysis V2 result — Ask Climpy grounds
  // every answer in analysisContext fields that only exist on
  // AnalysisV2Result, so the legacy client-only heuristic fallback
  // (savedAnalysisV2 === null) has nothing valid to ground against.
  // Exactly the four approved starter questions, each independently
  // conditional — "What should I fix first?" is always offered; the other
  // three only appear when they are actually relevant/eligible, so the
  // final list is never more than four.
  const askClimpyStarterQuestions = useMemo<AskClimpyStarterQuestion[]>(() => {
    if (!savedAnalysisV2) return [];

    const askClimpyMessagesText = results.askClimpy;
    const analysisContext = buildAskClimpyAnalysisContext(
      savedAnalysisV2.result,
      savedAnalysisLocale
    );

    const starters: AskClimpyStarterQuestion[] = [
      {
        id: "whatToFixFirst",
        label: askClimpyMessagesText.starterQuestions.whatToFixFirst,
        question: askClimpyMessagesText.starterQuestions.whatToFixFirst,
        selectedContext: { type: "general" },
        requestRewrite: false,
      },
    ];

    // Reuses the same hookDecision !== "keep" signal that already gates the
    // production Improve Hook button (see shouldShowHookAction above) as
    // the "a hook-focused question is relevant" condition.
    if (savedAnalysisV2.result.hookDecision !== "keep") {
      starters.push({
        id: "whyHookWeak",
        label: askClimpyMessagesText.starterQuestions.whyHookWeak,
        question: askClimpyMessagesText.starterQuestions.whyHookWeak,
        selectedContext: { type: "hookScore" },
        requestRewrite: false,
      });
    }

    // Both riskiest-part starters always refer to the SAME risky part (the
    // highest-severity entry), so "explain" and "rewrite" never disagree
    // about which part they mean.
    const riskiestIndex = findRiskiestRiskyPartIndex(analysisContext.riskyParts);

    if (riskiestIndex !== null) {
      starters.push({
        id: "explainRiskiestPart",
        label: askClimpyMessagesText.starterQuestions.explainRiskiestPart,
        question: askClimpyMessagesText.starterQuestions.explainRiskiestPart,
        selectedContext: { type: "riskyPart", index: riskiestIndex },
        requestRewrite: false,
      });

      const riskiestPart = analysisContext.riskyParts[riskiestIndex];

      if (isRiskyPartRewriteEligible(riskiestPart, activeScript)) {
        starters.push({
          id: "rewriteRiskiestPart",
          label: askClimpyMessagesText.starterQuestions.rewriteRiskiestPart,
          question: askClimpyMessagesText.starterQuestions.rewriteRiskiestPart,
          selectedContext: { type: "riskyPart", index: riskiestIndex },
          requestRewrite: true,
        });
      }
    }

    return starters;
  }, [savedAnalysisV2, results, activeScript, savedAnalysisLocale]);

  function handleOpenAskClimpy() {
    if (!savedAnalysisV2) return;
    setIsAskClimpyOpen(true);
  }

  // Never gated on isAskClimpyPending — closing always succeeds and simply
  // aborts whatever request was in flight, rather than blocking the user
  // from closing the panel while Climpy is still "thinking".
  function handleCloseAskClimpy() {
    askClimpyAbortControllerRef.current?.abort();
    askClimpyAbortControllerRef.current = null;
    askClimpyRequestIdRef.current += 1;
    setIsAskClimpyPending(false);
    setIsAskClimpyOpen(false);
    // Stops any active reveal animation immediately — reopening the same
    // panel later must show the complete answer, never a resumed or
    // restarted animation (the message text itself was already stored in
    // full the moment it was accepted; only the visual reveal stops here).
    setAskClimpyRevealMessageId(null);
  }

  // The actual network call — factored out of handleSendAskClimpy so
  // handleRetryAskClimpy can resend the exact same failed request without
  // pushing a second/duplicate user bubble (see AskClimpyRetryableRequest).
  // Never appends a user message itself; the caller owns that.
  async function sendAskClimpyRequest(
    question: string,
    selectedContext: SelectedContext,
    requestRewrite: boolean,
    messageIdRoot: string,
    // True only when THIS call is itself the one manual Retry attempt for
    // messageIdRoot (see handleRetryAskClimpy) — never set for the original
    // send. Drives the approved retry-UX policy below: a first failure gets
    // a visible Retry button; if that one manual retry ALSO fails, Retry is
    // hidden entirely (never an unlimited "keep clicking" affordance) and a
    // distinct "still failing" message replaces the standard one.
    hasBeenRetried: boolean = false
  ) {
    if (!savedAnalysisV2) return;

    const analysisContext = buildAskClimpyAnalysisContext(
      savedAnalysisV2.result,
      savedAnalysisLocale
    );

    const rewriteFragment =
      requestRewrite && selectedContext.type === "riskyPart"
        ? analysisContext.riskyParts[selectedContext.index]?.excerpt
        : undefined;

    if (requestRewrite && rewriteFragment === undefined) {
      return;
    }

    // The retry metadata attached to an error/local message if this specific
    // attempt fails — resending it later must reproduce this exact request
    // (same question, selectedContext, requestRewrite, rewriteFragment) AND
    // reuse the SAME messageIdRoot, so a retried failure updates this exact
    // error message in place instead of appending a second, duplicate one
    // (see upsertAskClimpyMessage above and handleRetryAskClimpy below).
    const retryable: AskClimpyRetryableRequest = {
      question,
      selectedContext,
      requestRewrite,
      ...(rewriteFragment !== undefined ? { rewriteFragment } : {}),
      messageIdRoot,
    };

    const history = askClimpyMessages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-ASK_CLIMPY_LIMITS.maxHistoryMessages)
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }));

    askClimpyAbortControllerRef.current?.abort();
    const controller = new AbortController();
    askClimpyAbortControllerRef.current = controller;

    const requestId = askClimpyRequestIdRef.current + 1;
    askClimpyRequestIdRef.current = requestId;

    setIsAskClimpyPending(true);

    const askClimpyMessagesText = results.askClimpy;

    try {
      const response = await fetch("/api/ask-climpy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          script: activeScript,
          // The current interface locale — this is the language Ask Climpy
          // must answer in, which may differ from analysisContext's own
          // analysisLocale (the language the analysis prose was generated
          // in). See ask-climpy-panel.tsx's locale-mismatch disclosure.
          locale,
          analysisContext,
          selectedContext,
          question,
          history,
          requestRewrite,
          ...(rewriteFragment !== undefined ? { rewriteFragment } : {}),
        }),
      });

      if (askClimpyRequestIdRef.current !== requestId) {
        return;
      }

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok || !isValidAskClimpyResponse(data)) {
        // Mapped purely from the HTTP status/category — the API's `reason`
        // (see AskClimpyErrorResponse) is a technical/debug string and must
        // never be rendered to the user directly, in any locale.
        //
        // 429 (Phase 6) is handled first and always the same way regardless
        // of hasBeenRetried: its own localized rate-limit copy, and NEVER a
        // clickable Retry — clicking Retry would just re-trigger the same
        // limit; the creator should wait and can still ask a new question
        // once the window clears (a fresh send re-checks the limit itself).
        if (response.status === 429) {
          setAskClimpyMessages((previous) =>
            upsertAskClimpyMessage(previous, {
              id: `${messageIdRoot}-error`,
              role: "error",
              content: askClimpyMessagesText.errorRateLimited,
            })
          );
          return;
        }

        // Phase 5 retry-UX policy: the FIRST failure for this messageIdRoot
        // gets the normal status-mapped error (a deterministic 400/413/415
        // request-shape rejection gets its own copy; every other case —
        // 502/503 or an unexpected status — falls back to the generic
        // localized error) plus a visible Retry button. If this call IS
        // that one manual Retry attempt and it ALSO failed, Retry is hidden
        // entirely (no retryable attached) and the message is replaced with
        // a distinct "still failing, try later or rephrase" copy — the
        // creator is never invited to keep clicking indefinitely; a brand
        // new question remains fully available afterward.
        if (hasBeenRetried) {
          setAskClimpyMessages((previous) =>
            upsertAskClimpyMessage(previous, {
              id: `${messageIdRoot}-error`,
              role: "error",
              content: askClimpyMessagesText.errorRetryFailed,
            })
          );
          return;
        }

        const errorText =
          response.status === 400 ||
          response.status === 413 ||
          response.status === 415
            ? askClimpyMessagesText.errorRequestInvalid
            : askClimpyMessagesText.errorGeneric;

        // upsert (not append): the FIRST failure for this messageIdRoot has
        // no existing message with this id yet, so this behaves exactly
        // like the old unconditional append — but a RETRY of the same
        // failed turn reuses this same id (see handleRetryAskClimpy), so a
        // repeated failure updates that one error message in place instead
        // of stacking a second, visually identical error block.
        setAskClimpyMessages((previous) =>
          upsertAskClimpyMessage(previous, {
            id: `${messageIdRoot}-error`,
            role: "error",
            content: errorText,
            retryable,
          })
        );
        return;
      }

      // data: AskClimpyResponse — a valid, successful answer. This is the
      // only branch that ever pushes an assistant-role message, so counting
      // assistant messages below exactly implements "a slot is consumed
      // only after a valid successful Ask Climpy response is accepted":
      // network failures, timeouts, non-ok statuses, and aborted/superseded
      // requests all return above without reaching this point.
      const assistantMessageId = `${messageIdRoot}-answer`;

      setAskClimpyMessages((previous) => {
        // A successful Retry resolves/removes the prior error block for
        // this exact turn (if any — a first-time success has none to
        // remove) rather than leaving it behind alongside the new answer.
        const withoutStaleError = previous.filter(
          (message) => message.id !== `${messageIdRoot}-error`
        );

        const next: AskClimpyDisplayMessage[] = [
          ...withoutStaleError,
          {
            id: assistantMessageId,
            role: "assistant",
            content: data.answer,
            ...(data.action !== undefined ? { action: data.action } : {}),
            ...(data.example !== undefined ? { example: data.example } : {}),
            cannotSafelyRewrite: data.cannotSafelyRewrite,
            ...(rewriteFragment !== undefined
              ? { originalFragment: rewriteFragment }
              : {}),
          },
        ];

        const successfulAnswerCount = next.filter(
          (message) => message.role === "assistant"
        ).length;

        if (
          successfulAnswerCount >=
          ASK_CLIMPY_LIMITS.maxSuccessfulAnswersPerAnalysis
        ) {
          setIsAskClimpyCapped(true);
        }

        return next;
      });

      // Triggers the panel's word-by-word reveal for exactly this message —
      // the message text itself is already fully stored above; this only
      // marks which message should currently animate its visual display.
      setAskClimpyRevealMessageId(assistantMessageId);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (askClimpyRequestIdRef.current !== requestId) {
        return;
      }

      // A thrown network/timeout exception follows the same Phase 5 policy
      // as a non-ok HTTP response: hide Retry and swap in the "still
      // failing" copy once this exception happens on the one manual retry
      // attempt itself.
      setAskClimpyMessages((previous) =>
        upsertAskClimpyMessage(
          previous,
          hasBeenRetried
            ? {
                id: `${messageIdRoot}-error`,
                role: "error",
                content: askClimpyMessagesText.errorRetryFailed,
              }
            : {
                id: `${messageIdRoot}-error`,
                role: "error",
                content: askClimpyMessagesText.errorGeneric,
                retryable,
              }
        )
      );
    } finally {
      if (askClimpyRequestIdRef.current === requestId) {
        setIsAskClimpyPending(false);
      }
    }
  }

  function generateAskClimpyMessageId(prefix: string): string {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${prefix}-${Date.now()}`;
  }

  async function handleSendAskClimpy(
    question: string,
    selectedContext: SelectedContext,
    requestRewrite: boolean
  ) {
    if (
      !savedAnalysisV2 ||
      isAskClimpyPending ||
      isAskClimpyCapped ||
      askClimpyIsSubmittingRef.current
    ) {
      return;
    }

    // Set synchronously, before any await — see askClimpyIsSubmittingRef's
    // own comment. Cleared in the finally block below no matter which
    // branch this call takes (local intent / error reference / network),
    // so a second Enter/click/tap that slips in during the exact same tick
    // is blocked immediately, closing the race the state-based guards above
    // cannot (isAskClimpyPending only takes effect on the next render).
    askClimpyIsSubmittingRef.current = true;

    try {
      const userMessageId = generateAskClimpyMessageId("ask-climpy-user");

      // Phase 2A — a small, bounded set of courtesy/small-talk intents
      // (greeting/thanks/acknowledgement/farewell/capability), matched by
      // normalized exact/near-exact phrase only (see
      // ask-climpy-local-intents.ts) — never a fetch, never counted toward
      // the six-answer cap, always checked first regardless of conversation
      // state.
      const localIntent = classifyAskClimpyLocalIntent(question);

      if (localIntent) {
        const localMessageId = `${userMessageId}-local`;

        setAskClimpyMessages((previous) => [
          ...previous,
          { id: userMessageId, role: "user", content: question },
          {
            id: localMessageId,
            role: "local",
            content: results.askClimpy.localIntents[localIntent],
          },
        ]);
        setAskClimpyInput("");

        // Triggers the SAME word-reveal presentation used for a model
        // answer (just the faster "local" timing — see
        // ask-climpy-reveal.ts) — the message text itself is already stored
        // in full above; this only marks which message should currently
        // animate its visual display.
        setAskClimpyRevealMessageId(localMessageId);
        return;
      }

      // Phase 3 — a short, explicit reference to "what just happened" (e.g.
      // "Why?"/"Почему?") is answered locally, without calling the model,
      // ONLY when the immediately preceding visible message is a technical
      // error (never a successful answer) — see
      // ask-climpy-local-intents.ts's isAskClimpyErrorReferencePhrase. The
      // SAME phrases following a successful answer instead fall through to
      // the normal API path below as an ordinary contextual follow-up (see
      // buildAskClimpySystemPrompt's SHORT FOLLOW-UP QUESTIONS section).
      const lastMessage = askClimpyMessages[askClimpyMessages.length - 1];

      if (
        lastMessage?.role === "error" &&
        isAskClimpyErrorReferencePhrase(question)
      ) {
        const localMessageId = `${userMessageId}-local`;

        setAskClimpyMessages((previous) => [
          ...previous,
          { id: userMessageId, role: "user", content: question },
          {
            id: localMessageId,
            role: "local",
            content: results.askClimpy.errorTechnicalExplanation,
            retryable: lastMessage.retryable,
          },
        ]);
        setAskClimpyInput("");
        setAskClimpyRevealMessageId(localMessageId);
        return;
      }

      // Phase 4 — the approved typed rewrite intent: a creator TYPING the
      // same core action the "Rewrite the riskiest part" starter button
      // already offers is recognized (normalized exact/near-exact phrase
      // match only — see ask-climpy-local-intents.ts's
      // classifyAskClimpyRewriteIntent), so they are never required to
      // click only the button for this one approved action. Only consulted
      // when the caller did not already resolve requestRewrite/
      // selectedContext itself (i.e. never for the starter button's own
      // call, which already passes requestRewrite: true directly) — this
      // keeps starter-button behavior completely unchanged.
      let effectiveSelectedContext = selectedContext;
      let effectiveRequestRewrite = requestRewrite;

      if (!requestRewrite && savedAnalysisV2) {
        const rewriteIntent = classifyAskClimpyRewriteIntent(question);

        if (rewriteIntent === "rewriteRiskiestPart") {
          const analysisContext = buildAskClimpyAnalysisContext(
            savedAnalysisV2.result,
            savedAnalysisLocale
          );
          // The SAME deterministic riskiest-part index and eligibility
          // check the starter button itself uses — never a fragment chosen
          // from the question text, never broadened beyond validated
          // riskyParts[index].excerpt.
          const riskiestIndex = findRiskiestRiskyPartIndex(
            analysisContext.riskyParts
          );
          const riskiestPart =
            riskiestIndex !== null
              ? analysisContext.riskyParts[riskiestIndex]
              : undefined;

          if (
            riskiestIndex !== null &&
            isRiskyPartRewriteEligible(riskiestPart, activeScript)
          ) {
            effectiveSelectedContext = {
              type: "riskyPart",
              index: riskiestIndex,
            };
            effectiveRequestRewrite = true;
          } else {
            // No eligible risky part — never a fake rewrite request; a
            // local explanation only (no fetch, no cap consumption).
            const localMessageId = `${userMessageId}-local`;

            setAskClimpyMessages((previous) => [
              ...previous,
              { id: userMessageId, role: "user", content: question },
              {
                id: localMessageId,
                role: "local",
                content: results.askClimpy.noEligibleRewriteExplanation,
              },
            ]);
            setAskClimpyInput("");
            setAskClimpyRevealMessageId(localMessageId);
            return;
          }
        }
      }

      setAskClimpyMessages((previous) => [
        ...previous,
        { id: userMessageId, role: "user", content: question },
      ]);
      setAskClimpyInput("");

      await sendAskClimpyRequest(
        question,
        effectiveSelectedContext,
        effectiveRequestRewrite,
        userMessageId
      );
    } finally {
      askClimpyIsSubmittingRef.current = false;
    }
  }

  // Resends the exact failed request a "Retry" action is attached to —
  // never adds a new user bubble (the original one is already in
  // askClimpyMessages). Disabled while pending/capped by the panel itself
  // (see ask-climpy-panel.tsx's isRetryDisabled); an obsolete retry can
  // never fire after a new analysis, since that resets askClimpyMessages
  // (and closes the panel) before this could be clicked again. Reuses the
  // ORIGINAL failed turn's messageIdRoot (never mints a new one) so a
  // repeated failure updates that same error message in place instead of
  // appending a second, duplicate error block — see
  // upsertAskClimpyMessage/sendAskClimpyRequest above. Always passes
  // hasBeenRetried: true — this handler IS the one approved manual Retry
  // attempt for a turn (Phase 5); if it also fails, sendAskClimpyRequest
  // hides Retry and swaps in the "still failing" copy, so this function is
  // never invoked a second time for the same turn (there is no button left
  // to click).
  async function handleRetryAskClimpy(retryable: AskClimpyRetryableRequest) {
    if (
      !savedAnalysisV2 ||
      isAskClimpyPending ||
      isAskClimpyCapped ||
      askClimpyIsSubmittingRef.current
    ) {
      return;
    }

    askClimpyIsSubmittingRef.current = true;

    try {
      await sendAskClimpyRequest(
        retryable.question,
        retryable.selectedContext,
        retryable.requestRewrite,
        retryable.messageIdRoot,
        true
      );
    } finally {
      askClimpyIsSubmittingRef.current = false;
    }
  }

  // Performs the actual insert. Called either directly (already signed in)
  // or from the pending-save-intent effect below (just returned from the
  // Google OAuth redirect). Never called merely because a session appeared
  // — only in response to this specific analysis's own explicit Save
  // click, current or previously pending.
  async function performSave() {
    if (!savedAnalysisV2 || saveState === "saving" || saveState === "saved") {
      return;
    }

    // Consumed unconditionally up front: whether this attempt succeeds or
    // fails, it has been acted on and must not fire again on a later
    // render/reload. A failed save is retried by a manual Save click, not
    // by the pending intent.
    clearPendingSaveIntent();

    setSaveState("saving");
    setSaveErrorReason("");

    const validation = validateAnalysisForSave({
      hasSession: Boolean(user),
      script: activeScript,
      title: saveTitle,
      locale: savedAnalysisLocale,
      result: savedAnalysisV2.result,
      modelUsed: savedAnalysisV2.modelUsed,
    });

    if (!validation.ok) {
      setSaveState("error");
      setSaveErrorReason(validation.reason);
      return;
    }

    const result = await insertAnalysis(supabaseBrowser, {
      user_id: user!.id,
      title: saveTitle,
      script: activeScript,
      locale: savedAnalysisLocale,
      result_json: savedAnalysisV2.result,
      model_used: savedAnalysisV2.modelUsed,
    });

    if (!result.ok) {
      setSaveState("error");
      setSaveErrorReason(result.reason);
      return;
    }

    savedAnalysisIdRef.current = result.id;
    setSaveState("saved");
  }

  async function handleSaveClick() {
    if (!savedAnalysisV2 || saveState === "saving" || saveState === "saved") {
      return;
    }

    if (!user) {
      // Pending intent is written here — at the explicit Save click —
      // never merely because the user later happens to sign in some other
      // way. Closing the modal without completing sign-in clears it again
      // (see onClose below). Only the digest is ever written, never the
      // script/title/model themselves.
      const fingerprint = await computeCurrentSaveFingerprint();
      writePendingSaveIntent(fingerprint);
      setIsSaveSignInModalOpen(true);
      return;
    }

    void performSave();
  }

  // Completes a Save that was requested before sign-in, immediately after
  // the OAuth redirect lands back on this page signed in. Runs at most
  // once per pending intent: performSave() clears the intent up front, and
  // saveState leaving "idle" prevents this effect from re-triggering it.
  useEffect(() => {
    if (!isStorageLoaded || storageError || !savedAnalysisV2 || !user) {
      return;
    }

    if (saveState !== "idle") {
      return;
    }

    const pending = readPendingSaveIntent();

    if (!pending) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    void (async () => {
      const currentFingerprint = await computeCurrentSaveFingerprint();

      if (cancelled) {
        return;
      }

      if (pending.fingerprint !== currentFingerprint) {
        // Belongs to a different analysis, or is left over from an
        // abandoned/expired flow — never acted on for the wrong content.
        clearPendingSaveIntent();
        return;
      }

      // Deferred a tick, matching this page's other mount-time effect
      // (loading sessionStorage above) — avoids calling setState
      // synchronously within the effect body itself.
      timer = window.setTimeout(() => {
        if (!cancelled) {
          void performSave();
        }
      }, 0);
    })();

    return () => {
      cancelled = true;

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStorageLoaded, storageError, savedAnalysisV2, user, saveState, activeScript, saveTitle, savedAnalysisLocale]);

  const saveErrorMessage =
    saveErrorReason === "auth"
      ? results.save.errorAuth
      : saveErrorReason === "database"
        ? results.save.errorDatabase
        : saveErrorReason === "validation"
          ? results.save.errorValidation
          : "";

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
          <div className="flex flex-col items-center gap-2 px-4 pt-3">
            <LanguageSwitcher className="w-full justify-center" />
            <AuthNav variant="results" />
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
              <div className="flex shrink-0 items-start gap-3">
                {isStorageLoaded && !storageError && hasAnalyzedScript && savedAnalysisV2 && (
                  <SaveAnalysisAction
                    state={saveState}
                    errorMessage={saveErrorMessage}
                    onSave={handleSaveClick}
                    labels={{
                      action: results.save.action,
                      saving: results.save.saving,
                      saved: results.save.saved,
                      retry: results.save.retry,
                    }}
                  />
                )}
                <Link href="/" className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 text-[14px] font-semibold text-[#111827] transition hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/10">
                  <PencilLine size={15} />
                  {results.nav.newAnalysis}
                </Link>
              </div>
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
                  {savedAnalysisV2 && (
                    <button
                      onClick={handleOpenAskClimpy}
                      className="mt-3 inline-flex h-[34px] items-center gap-2 rounded-[10px] border border-[#DDD6FE] bg-white px-3 text-[12.5px] font-semibold text-[#7C3AED] transition hover:bg-[#F3E8FF]"
                    >
                      <Sparkles size={14} />
                      {results.askClimpy.entryButton}
                    </button>
                  )}
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

          <div className="flex flex-col items-center gap-2 px-5 pb-2">
            <LanguageSwitcher />
            <AuthNav variant="results" />
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

              {savedAnalysisV2 && (
                <SaveAnalysisAction
                  state={saveState}
                  errorMessage={saveErrorMessage}
                  onSave={handleSaveClick}
                  labels={{
                    action: results.save.action,
                    saving: results.save.saving,
                    saved: results.save.saved,
                    retry: results.save.retry,
                  }}
                  compact
                />
              )}

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
                {savedAnalysisV2 && (
                  <button
                    onClick={handleOpenAskClimpy}
                    className="mt-3 w-full h-[40px] inline-flex items-center justify-center gap-2 rounded-[12px] border border-[#DDD6FE] bg-white text-[13px] font-semibold text-[#7C3AED] transition hover:bg-[#F3E8FF]"
                  >
                    <Sparkles size={14} />
                    {results.askClimpy.entryButton}
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
              {improveScriptStatus === "diagnostic"
                ? results.improveScriptModal.diagnosticTitle
                : improveScriptStatus === "preserve"
                  ? results.improveScriptModal.originalPreservedTitle
                  : results.improveScriptModal.improvedTitle}
            </h2>

            <p className="mt-2 text-[13px] leading-5 text-[#6B7280] sm:text-[14px]">
              {improveScriptStatus === "diagnostic"
                ? // Two distinct diagnostic causes, two distinct messages —
                  // missingMaterial is only ever populated when the source
                  // genuinely lacks concrete material (see
                  // engine/improve-script.ts's buildFailedCandidateDiagnosticResponse).
                  // A candidate-quality diagnostic (material was adequate,
                  // this attempt just wasn't strong enough) must never claim
                  // facts are missing when they visibly are not.
                  improvedScriptMissingMaterial.length > 0
                  ? results.improveScriptModal.diagnosticDescription
                  : results.improveScriptModal.diagnosticRetryDescription
                : improveScriptStatus === "preserve"
                  ? results.improveScriptModal.preservedDescription
                  : results.improveScriptModal.defaultDescription}
            </p>

            {/* A successful diagnostic result never shows a script-preview
                box — there is no unchanged/improved script to display, only
                the reason + "what to add" guidance below. Loading and error
                states still use this box for their own status text. */}
            {(isImprovingScript ||
              improveScriptError ||
              improveScriptStatus !== "diagnostic") && (
              <div className="mt-5 max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-[14px] border border-[#E5E7EB] bg-[#F8F8FC] p-4 text-[13px] leading-6 text-[#111827] sm:text-[14px]">
                {isImprovingScript
                  ? results.improveScriptModal.improving
                  : improveScriptError
                    ? results.improveScriptModal.noScriptGenerated
                    : improvedScript}
              </div>
            )}

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
              {improveScriptStatus !== "diagnostic" && (
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
              )}

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
        <ImprovedHookModal
          title={hookModalTitle}
          description={hookModalDescription}
          hookText={isImprovingHook ? results.hookModal.improving : modalHookText}
          errorText={improveError || undefined}
          reasonLabel={hookModalReasonLabel}
          reasonText={
            isImprovingHook
              ? results.hookModal.rewritingDescription
              : improvedHookReason
          }
          isCopyDisabled={isImprovingHook || Boolean(improveError)}
          copyButtonLabel={copiedHook ? results.hookModal.copied : hookCopyButtonLabel}
          closeLabel={results.hookModal.close}
          onCopy={handleCopyHook}
          onClose={() => setIsHookModalOpen(false)}
        />
      )}

      {isAskClimpyOpen && savedAnalysisV2 && (
        <AskClimpyPanel
          askClimpy={results.askClimpy}
          messages={askClimpyMessages}
          isPending={isAskClimpyPending}
          isCapped={isAskClimpyCapped}
          starterQuestions={askClimpyStarterQuestions}
          inputValue={askClimpyInput}
          onInputChange={setAskClimpyInput}
          onSend={handleSendAskClimpy}
          onRetry={handleRetryAskClimpy}
          onClose={handleCloseAskClimpy}
          hasLocaleMismatch={hasLocaleMismatch}
          revealMessageId={askClimpyRevealMessageId}
          onRevealComplete={() => setAskClimpyRevealMessageId(null)}
        />
      )}

      <SignInModal
        isOpen={isSaveSignInModalOpen}
        onClose={() => {
          setIsSaveSignInModalOpen(false);
          // Dismissed without completing sign-in — this explicit Save
          // request is abandoned, not merely paused. Clearing it here is
          // what stops a later, unrelated sign-in (e.g. from the nav) from
          // ever being mistaken for this one.
          clearPendingSaveIntent();
        }}
        nextPath="/results"
      />
    </main>
  );
}
