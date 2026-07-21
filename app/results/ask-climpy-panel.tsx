"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PencilLine, Send, X } from "lucide-react";
import type { Messages } from "../../lib/messages";
import type { SelectedContext } from "../../engine/ask-climpy-validation";
import {
  buildAskClimpyRevealPlan,
  sliceAskClimpyRevealPlan,
  type AskClimpyRevealPlan,
} from "./ask-climpy-reveal";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The exact failed user-triggered request a "Retry" action resends — kept
// alongside the error/local message it is attached to (rather than as
// separate top-level state) so it is automatically cleared the moment
// askClimpyMessages is reset on close+new-analysis (see page.tsx's
// askClimpyAnalysisIdentityKey effect) — an obsolete retry can never survive
// past that reset.
//
// `messageIdRoot` is the ORIGINAL failed turn's stable id root (the same
// root used to build that turn's `${root}-error`/`${root}-answer` message
// ids) — see page.tsx's sendAskClimpyRequest/handleRetryAskClimpy. Retrying
// always reuses this exact root rather than minting a new one, so a
// repeated failure updates the SAME error message in place instead of
// appending a second, duplicate error block (the diagnosed regression).
export type AskClimpyRetryableRequest = {
  question: string;
  selectedContext: SelectedContext;
  requestRewrite: boolean;
  rewriteFragment?: string;
  messageIdRoot: string;
};

// This is a LOCAL, client-only message shape for rendering — it is not the
// network contract. `originalFragment` in particular never comes from the
// API response (the approved AskClimpyResponse has no such field); it is
// the rewriteFragment the client itself already sent in the request, kept
// here only so the UI can render an original-vs-example comparison without
// the server needing to echo it back.
//
// "local" is a client-synthesized reply (a bounded conversational intent
// reply, or the post-error technical explanation) — never sent to the
// model, never counted toward the six-answer cap, and excluded from the
// history sent to the model exactly like "error" already is (see
// page.tsx's handleSendAskClimpy, which only ever includes "user"/
// "assistant" roles in that history).
export type AskClimpyDisplayMessage =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "assistant";
      content: string;
      action?: string;
      example?: string;
      cannotSafelyRewrite: boolean;
      originalFragment?: string;
    }
  | {
      id: string;
      role: "error";
      content: string;
      retryable?: AskClimpyRetryableRequest;
    }
  | {
      id: string;
      role: "local";
      content: string;
      retryable?: AskClimpyRetryableRequest;
    };

export type AskClimpyStarterQuestion = {
  id: string;
  label: string;
  question: string;
  selectedContext: SelectedContext;
  requestRewrite: boolean;
};

// The complete text a screen reader should hear once a message finishes
// revealing — used ONLY to populate the panel's single shared live-
// announcement region (see AskClimpyPanel), never rendered as a second,
// permanent copy of the message. "user"/"error" messages never actually
// reach this (isRevealing is only ever true for "assistant"/"local"
// messages — see page.tsx, which never sets revealMessageId to a user/error
// id), so the empty-string fallback below is defensive only.
function buildAskClimpyFullAnnouncement(message: AskClimpyDisplayMessage): string {
  if (message.role === "assistant") {
    return [message.content, message.action, message.example]
      .filter((part): part is string => Boolean(part))
      .join(". ");
  }

  if (message.role === "local") {
    return message.content;
  }

  return "";
}

// Rendered only while the panel should be visible (same "lifecycle IS open"
// convention as app/my-analyses/rename-analysis-dialog.tsx), but unlike that
// dialog, the message history is NOT reset by this component's own
// mount/unmount — it lives in app/results/page.tsx and is passed in as
// `messages`, so closing and reopening the panel for the same analysis keeps
// the conversation. Only a genuinely different analysis clears it (see
// page.tsx's savedAnalysisV2 identity-reset effect).
//
// Unlike RenameAnalysisDialog, Escape/backdrop/close are never gated by a
// "pending" ref — the parent's onClose is expected to abort any in-flight
// request rather than block the close.
export function AskClimpyPanel({
  askClimpy,
  messages,
  isPending,
  isCapped,
  starterQuestions,
  inputValue,
  onInputChange,
  onSend,
  onRetry,
  onClose,
  hasLocaleMismatch,
  revealMessageId,
  onRevealComplete,
}: {
  askClimpy: Messages["results"]["askClimpy"];
  messages: AskClimpyDisplayMessage[];
  isPending: boolean;
  isCapped: boolean;
  starterQuestions: AskClimpyStarterQuestion[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: (
    question: string,
    selectedContext: SelectedContext,
    requestRewrite: boolean
  ) => void;
  // Resends the exact failed request a "Retry" action is attached to (see
  // AskClimpyRetryableRequest) — never adds a new user bubble (see
  // page.tsx's handleRetryAskClimpy). Disabled/ignored while isPending.
  onRetry: (retryable: AskClimpyRetryableRequest) => void;
  onClose: () => void;
  // True when the underlying analysis's own prose was generated in a
  // different language than the current interface locale (the same
  // condition already used by the Results-page locale-mismatch notice —
  // see page.tsx's hasLocaleMismatch). Ask Climpy always answers in the
  // current interface locale regardless; this only controls a small
  // disclosure inside the panel, separate from that existing notice.
  hasLocaleMismatch: boolean;
  // The id of the one assistant message (if any) that should currently play
  // its word-by-word reveal animation. Every other message renders its
  // complete text immediately — this is never resumed/restarted on
  // close+reopen (see page.tsx's handleCloseAskClimpy, which clears this to
  // null on close).
  revealMessageId: string | null;
  onRevealComplete: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // ONE shared, transient live-announcement region for the whole panel —
  // replaces the old per-message sr-only "fullAnnouncement" span, which
  // duplicated every message's complete text as ordinary selectable DOM
  // content sitting right alongside the (aria-hidden, but still visible and
  // selectable) reveal text. aria-hidden only removes a node from the
  // accessibility tree; it does not stop the browser's Selection API from
  // including that text in a copy — so the old approach produced exactly
  // the diagnosed bug (every copied message appearing twice). This region
  // holds text only briefly (see the effect below), so it is never a
  // second permanent copy of any message; it merely lets a screen reader
  // hear the newly-completed message announced once via aria-live.
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  useEffect(() => {
    if (!liveAnnouncement) return;

    // Cleared shortly after being set — long enough for assistive tech to
    // pick up the aria-live mutation and announce it, short enough that the
    // announcement text is never sitting in the DOM as a lingering, stable,
    // copy-able duplicate of the (now accessible-visible) message itself.
    const timeoutId = window.setTimeout(() => setLiveAnnouncement(""), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [liveAnnouncement]);

  // onClose/onSend are inline callbacks recreated on every render of the
  // caller — read via refs (kept current by their own effects, never written
  // during render) so the mount effect below can keep an empty dependency
  // array, matching rename-analysis-dialog.tsx's own rationale.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const headingId = "ask-climpy-heading";

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    inputRef.current?.focus();

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const outside = !active || !panelRef.current.contains(active);

      if (event.shiftKey) {
        if (active === first || active === panelRef.current || outside) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || outside) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.paddingRight = originalBodyPaddingRight;
      previouslyFocusedElementRef.current?.focus();
    };
    // Mount/unmount only — this component's lifecycle IS "open".
  }, []);

  // Keeps the message list pinned to its bottom as new messages arrive AND
  // as the newest answer's word-by-word reveal grows its own height — but
  // only while the user was already near the bottom. A ResizeObserver on
  // the content wrapper fires for both cases uniformly (new DOM node vs.
  // growing text), so this single effect covers both without the parent
  // needing to know about per-word reveal ticks. If the user has
  // deliberately scrolled up, this never forces them back down.
  useEffect(() => {
    const container = scrollContainerRef.current;
    const content = scrollContentRef.current;
    if (!container || !content) return;

    const BOTTOM_THRESHOLD_PX = 80;

    function updateIsNearBottom() {
      if (!container) return;
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      isNearBottomRef.current = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
    }

    function scrollToBottomIfNearBottom() {
      if (!container || !isNearBottomRef.current) return;
      container.scrollTop = container.scrollHeight;
    }

    updateIsNearBottom();
    scrollToBottomIfNearBottom();

    container.addEventListener("scroll", updateIsNearBottom, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      scrollToBottomIfNearBottom();
    });
    resizeObserver.observe(content);

    return () => {
      container.removeEventListener("scroll", updateIsNearBottom);
      resizeObserver.disconnect();
    };
    // Mount/unmount only — the observer itself reacts to content changes,
    // it does not need to be re-subscribed on every message update.
  }, []);

  function submitQuestion() {
    const trimmed = inputValue.trim();
    if (trimmed.length === 0 || isPending || isCapped) return;
    onSend(trimmed, { type: "general" }, false);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 md:items-stretch md:justify-end md:bg-transparent md:p-5"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCloseRef.current();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="relative flex max-h-[85dvh] w-full flex-col rounded-t-[20px] border border-[#E5E7EB] bg-white shadow-[0_-16px_60px_rgba(17,24,39,0.18)] outline-none md:h-full md:max-h-[calc(100dvh-40px)] md:w-[480px] md:max-w-[calc(100vw-40px)] md:rounded-[20px] md:shadow-[0_20px_56px_rgba(17,24,39,0.16)]"
      >
        {/* ONE shared, transient live-announcement region for the whole
            panel — see the liveAnnouncement state/effect above. Never a
            second permanent copy of any message's text. */}
        <div role="status" aria-live="polite" className="sr-only">
          {liveAnnouncement}
        </div>
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] px-5 py-4 md:px-6">
          <div>
            <h2 id={headingId} className="text-[16px] font-semibold text-[#111827]">
              {askClimpy.panelHeading}
            </h2>
            <p className="mt-0.5 text-[12px] text-[#6B7280]">{askClimpy.panelSubheading}</p>
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label={askClimpy.closeLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40"
          >
            <X size={18} />
          </button>
        </div>

        {hasLocaleMismatch && (
          <p
            role="status"
            className="shrink-0 border-b border-[#E5E7EB] bg-[#F8F8FC] px-5 py-2 text-[11.5px] leading-[1.5] text-[#6B7280] md:px-6"
          >
            {askClimpy.localeMismatchNotice}
          </p>
        )}

        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6"
        >
          <div ref={scrollContentRef}>
            {messages.length === 0 ? (
              <div>
                <p className="text-[13.5px] leading-[1.6] text-[#6B7280]">{askClimpy.emptyState}</p>
                {starterQuestions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
                      {askClimpy.starterQuestionsHeading}
                    </p>
                    <div className="mt-2.5 flex flex-col gap-2">
                      {starterQuestions.map((starter) => (
                        <button
                          key={starter.id}
                          type="button"
                          onClick={() =>
                            onSend(starter.question, starter.selectedContext, starter.requestRewrite)
                          }
                          disabled={isPending || isCapped}
                          className="flex items-start gap-2.5 rounded-[10px] border border-[#E5E7EB] bg-[#F8F8FC] px-3.5 py-2.5 text-left text-[13px] leading-[1.45] text-[#374151] transition hover:border-[#DDD6FE] hover:bg-[#F3E8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {starter.requestRewrite && (
                            <PencilLine size={13} className="mt-0.5 shrink-0 text-[#7C3AED]" />
                          )}
                          <span className="break-words">{starter.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((message) => (
                  <AskClimpyMessageBubble
                    key={message.id}
                    message={message}
                    askClimpy={askClimpy}
                    isRevealing={message.id === revealMessageId}
                    onRevealComplete={() => {
                      // Announce THIS message once, via the single shared
                      // live region below — never a second permanent
                      // sr-only copy sitting next to the bubble itself.
                      setLiveAnnouncement(buildAskClimpyFullAnnouncement(message));
                      onRevealComplete();
                    }}
                    onRetry={onRetry}
                    isRetryDisabled={isPending || isCapped}
                  />
                ))}
                {isPending && (
                  <div className="w-fit self-start rounded-[12px] bg-[#F3F4F6] px-3 py-2 text-[13px] text-[#6B7280]">
                    {askClimpy.sending}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#E5E7EB] bg-[#FAFAFA] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 md:px-6">
          {isCapped ? (
            <p role="status" className="text-[12.5px] text-[#6B7280]">
              {askClimpy.capReached}
            </p>
          ) : (
            <div className="flex items-end gap-2">
              <label htmlFor="ask-climpy-input" className="sr-only">
                {askClimpy.inputLabel}
              </label>
              <textarea
                ref={inputRef}
                id="ask-climpy-input"
                value={inputValue}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitQuestion();
                  }
                }}
                placeholder={askClimpy.inputPlaceholder}
                rows={1}
                disabled={isPending}
                className="h-11 max-h-28 flex-1 resize-none rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2.5 text-[13px] text-[#111827] outline-none focus:border-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={submitQuestion}
                disabled={isPending || inputValue.trim().length === 0}
                aria-label={askClimpy.send}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#7C3AED] text-white transition hover:bg-[#6D28D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={16} />
              </button>
            </div>
          )}
          <p className="mt-2 text-[11px] text-[#9CA3AF]">{askClimpy.poweredByNotice}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Ticks a local `tickedWordCount` from 0 up to plan.totalWords at a fixed
// interval derived from plan.durationMs, purely as LOCAL, ephemeral,
// per-message animation state — it never mutates or duplicates the actual
// stored message text (that already lives, complete, in page.tsx's
// askClimpyMessages). The word count this hook RETURNS is a derived value,
// not synchronized via an effect: whenever this message is not the actively
// animating one (never started, superseded by a newer message, or the panel
// was closed and reopened), it simply returns plan.totalWords directly —
// there is no "reset to complete" effect branch to keep in sync.
function useAskClimpyRevealedWordCount(
  plan: AskClimpyRevealPlan,
  isRevealing: boolean,
  onComplete: () => void
): number {
  const shouldAnimate =
    isRevealing && plan.totalWords > 0 && !prefersReducedMotion();

  const [tickedWordCount, setTickedWordCount] = useState(0);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!shouldAnimate) {
      return;
    }

    const intervalMs = Math.max(16, plan.durationMs / plan.totalWords);
    let revealed = 0;

    const intervalId = window.setInterval(() => {
      revealed += 1;
      setTickedWordCount(revealed);

      if (revealed >= plan.totalWords) {
        window.clearInterval(intervalId);
        onCompleteRef.current();
      }
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
    // shouldAnimate is only ever true once per message instance (each
    // bubble is keyed by message.id and mounts fresh exactly once) — this
    // is intentionally a one-shot ticker, never restarted mid-reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate]);

  useEffect(() => {
    // Reduced motion (or the rare zero-word case) skips the ticker above
    // entirely — this still owes the parent exactly one onComplete call so
    // askClimpyRevealMessageId gets cleared and the next message can reveal.
    if (isRevealing && !shouldAnimate) {
      onCompleteRef.current();
    }
  }, [isRevealing, shouldAnimate]);

  return shouldAnimate ? tickedWordCount : plan.totalWords;
}

function AskClimpyMessageBubble({
  message,
  askClimpy,
  isRevealing,
  onRevealComplete,
  onRetry,
  isRetryDisabled,
}: {
  message: AskClimpyDisplayMessage;
  askClimpy: Messages["results"]["askClimpy"];
  isRevealing: boolean;
  onRevealComplete: () => void;
  onRetry: (retryable: AskClimpyRetryableRequest) => void;
  isRetryDisabled: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="ml-auto w-fit max-w-[75%] rounded-[12px] bg-[#7C3AED] px-3.5 py-2.5 text-[13px] leading-[1.5] text-white">
        {message.content}
      </div>
    );
  }

  // Compact error block (Phase 4): localized safe error text plus a visible
  // Retry button whenever this specific error carries a retryable failed
  // request — never the raw server `reason`/status (see route.ts's
  // AskClimpyErrorResponse, which is never rendered directly).
  if (message.role === "error") {
    return (
      <div
        role="alert"
        className="w-fit max-w-[88%] rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-2.5 text-[13px] leading-[1.5] text-[#B91C1C]"
      >
        <p>{message.content}</p>
        {message.retryable && (
          <button
            type="button"
            onClick={() => onRetry(message.retryable!)}
            disabled={isRetryDisabled}
            className="mt-2 rounded-[8px] border border-[#B91C1C]/30 bg-white px-2.5 py-1 text-[12px] font-medium text-[#B91C1C] transition hover:bg-[#FEE2E2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {askClimpy.retryLabel}
          </button>
        )}
      </div>
    );
  }

  // Local, client-synthesized reply (Phase 2/3): a bounded conversational
  // intent reply, or the post-error technical explanation. Uses the SAME
  // word-reveal system as a model answer (see AskClimpyAssistantMessage
  // below) but the faster "local" timing window — see
  // ask-climpy-reveal.ts's ASK_CLIMPY_LOCAL_REVEAL_MIN/MAX_DURATION_MS —
  // since it never made a model round trip. The animation type is driven
  // purely by message.role (an explicit discriminant), never inferred from
  // the message text itself.
  if (message.role === "local") {
    return (
      <AskClimpyLocalMessage
        message={message}
        askClimpy={askClimpy}
        isRevealing={isRevealing}
        onRevealComplete={onRevealComplete}
        onRetry={onRetry}
        isRetryDisabled={isRetryDisabled}
      />
    );
  }

  return (
    <AskClimpyAssistantMessage
      message={message}
      askClimpy={askClimpy}
      isRevealing={isRevealing}
      onRevealComplete={onRevealComplete}
    />
  );
}

// Split out from AskClimpyMessageBubble specifically so the reveal hook
// below is always called unconditionally (Rules of Hooks) — this component
// only ever renders for the "local" branch, never for "user"/"error"/
// "assistant". Deliberately simpler than AskClimpyAssistantMessage (a local
// reply only ever has a single `content` string — never action/example/
// cannotSafelyRewrite), but reuses the exact same reveal primitives
// (buildAskClimpyRevealPlan / useAskClimpyRevealedWordCount /
// sliceAskClimpyRevealPlan) at the faster "local" speed — never a second,
// parallel animation implementation.
function AskClimpyLocalMessage({
  message,
  askClimpy,
  isRevealing,
  onRevealComplete,
  onRetry,
  isRetryDisabled,
}: {
  message: Extract<AskClimpyDisplayMessage, { role: "local" }>;
  askClimpy: Messages["results"]["askClimpy"];
  isRevealing: boolean;
  onRevealComplete: () => void;
  onRetry: (retryable: AskClimpyRetryableRequest) => void;
  isRetryDisabled: boolean;
}) {
  const plan = buildAskClimpyRevealPlan({ answer: message.content }, "local");
  const revealedWordCount = useAskClimpyRevealedWordCount(
    plan,
    isRevealing,
    onRevealComplete
  );
  const slice = sliceAskClimpyRevealPlan(plan, revealedWordCount);

  // True once every word has revealed (including immediately for a message
  // that was never the animating one, or for reduced motion — see the hook
  // above, which returns plan.totalWords directly in both cases). Only
  // while NOT yet complete is the visible text hidden from the
  // accessibility tree (aria-hidden) — the SAME visible DOM text becomes
  // the accessible content the instant it completes, rather than a second,
  // separate sr-only copy (see buildAskClimpyFullAnnouncement/
  // liveAnnouncement above, which announce it exactly once instead).
  const isRevealComplete = revealedWordCount >= plan.totalWords;

  return (
    <div className="w-fit max-w-[88%] rounded-[14px] bg-[#F3F4F6] px-4 py-3 text-[13.5px] leading-[1.65] text-[#111827]">
      <p aria-hidden={isRevealComplete ? undefined : true}>{slice.answer}</p>
      {/* The Retry button/label itself is static UI chrome, never part of
          the word reveal — always fully visible immediately, same as the
          error bubble's own Retry button. */}
      {message.retryable && (
        <button
          type="button"
          onClick={() => onRetry(message.retryable!)}
          disabled={isRetryDisabled}
          className="mt-2 rounded-[8px] border border-[#DDD6FE] bg-white px-2.5 py-1 text-[12px] font-medium text-[#7C3AED] transition hover:bg-[#F3E8FF] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {askClimpy.retryLabel}
        </button>
      )}
    </div>
  );
}

// Split out from AskClimpyMessageBubble specifically so the reveal hook
// below is always called unconditionally (Rules of Hooks) — this component
// only ever renders for the "assistant" branch, never for "user"/"error".
function AskClimpyAssistantMessage({
  message,
  askClimpy,
  isRevealing,
  onRevealComplete,
}: {
  message: Extract<AskClimpyDisplayMessage, { role: "assistant" }>;
  askClimpy: Messages["results"]["askClimpy"];
  isRevealing: boolean;
  onRevealComplete: () => void;
}) {
  const plan = buildAskClimpyRevealPlan({
    answer: message.content,
    action: message.action,
    example: message.example,
  });
  const revealedWordCount = useAskClimpyRevealedWordCount(
    plan,
    isRevealing,
    onRevealComplete
  );
  const slice = sliceAskClimpyRevealPlan(plan, revealedWordCount);

  // True once every word has revealed (including immediately for a message
  // that was never the animating one, or for reduced motion). Only while
  // NOT yet complete is the visible text hidden from the accessibility tree
  // (aria-hidden) so a screen reader never narrates it word by word or
  // reads a half-finished sentence — the instant it completes, this SAME
  // visible DOM text becomes the accessible content (no second, separate
  // sr-only copy). The panel's shared liveAnnouncement region (see
  // buildAskClimpyFullAnnouncement) additionally announces it once at that
  // moment, so a screen reader user waiting on the region still hears it
  // proactively rather than only on next navigation.
  const isRevealComplete = revealedWordCount >= plan.totalWords;
  const hiddenWhileRevealing = isRevealComplete ? undefined : true;

  // example is only ever populated for a rewrite request (see
  // validateAskClimpyModelResult), and the client always attaches
  // originalFragment alongside it whenever a rewrite was requested — so in
  // practice this is always true when slice.example is non-empty. The
  // fallback to the generic "Example" label is defensive only.
  const isRewriteComparison = Boolean(message.originalFragment);

  return (
    <div className="w-fit max-w-[92%] rounded-[14px] bg-[#F3F4F6] px-4 py-3 text-[#111827]">
      <p className="text-[13.5px] leading-[1.65]" aria-hidden={hiddenWhileRevealing}>
        {slice.answer}
      </p>
      {slice.action && (
        <div
          className="mt-2.5 border-l-[3px] border-[#DDD6FE] pl-2.5"
          aria-hidden={hiddenWhileRevealing}
        >
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#7C3AED]">
            {askClimpy.actionLabel}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[#374151]">{slice.action}</p>
        </div>
      )}
      {slice.example && (
        <div
          className="mt-2.5 rounded-[10px] border border-[#DDD6FE] bg-[#F3E8FF] p-3"
          aria-hidden={hiddenWhileRevealing}
        >
          {isRewriteComparison && (
            <div className="mb-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#7C3AED]">
                {askClimpy.originalLabel}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[#6B7280] line-through">
                {message.originalFragment}
              </p>
            </div>
          )}
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#7C3AED]">
            {isRewriteComparison ? askClimpy.suggestedRewriteLabel : askClimpy.exampleLabel}
          </p>
          <p className="mt-0.5 text-[13px] font-medium leading-[1.5] text-[#5B21B6]">
            {slice.example}
          </p>
        </div>
      )}
      {message.cannotSafelyRewrite && (
        <p className="mt-2 text-[11.5px] italic text-[#9CA3AF]" aria-hidden={hiddenWhileRevealing}>
          {askClimpy.rewriteUnavailable}
        </p>
      )}
    </div>
  );
}
