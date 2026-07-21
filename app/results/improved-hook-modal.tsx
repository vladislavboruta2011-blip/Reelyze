"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const HEADING_ID = "improved-hook-modal-heading";

// Matches the exact focus-trap selector already used by app/sign-in-modal.tsx
// and app/results/ask-climpy-panel.tsx — kept as its own local constant
// (not shared) consistent with how those two files each already do the same.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// One responsive flex-column layout for both desktop and mobile — replacing
// the previous two separate implementations (a fixed-size, absolutely-
// positioned desktop variant with a hard overflow:hidden explanation box,
// and an unbounded mobile variant with no max-height at all). Both of those
// caused the diagnosed overflow: desktop silently clipped long explanation
// text (no scrolling), and mobile could grow taller than the viewport with
// no way to reach the footer buttons.
//
// Structure required by the fix: header (shrink-0) -> scrollable body
// (min-h-0, flex-1, overflow-y-auto) -> footer (shrink-0) — exactly one
// scroll container, never nested scroll regions.
export function ImprovedHookModal({
  title,
  description,
  hookText,
  errorText,
  reasonLabel,
  reasonText,
  isCopyDisabled,
  copyButtonLabel,
  closeLabel,
  onCopy,
  onClose,
}: {
  title: string;
  description: string;
  hookText: string;
  errorText?: string;
  reasonLabel: string;
  reasonText: string;
  isCopyDisabled: boolean;
  copyButtonLabel: string;
  closeLabel: string;
  onCopy: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    panelRef.current?.focus();

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPaddingRight = document.body.style.paddingRight;
    // Locking scroll removes the scrollbar, which shifts page content
    // sideways by its width — pad the body by that same amount so nothing
    // visibly shifts while the modal is open (matches sign-in-modal.tsx /
    // ask-climpy-panel.tsx's own identical treatment).
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
    // Mount/unmount only — this component's lifecycle IS "open" (the parent
    // conditionally renders it), matching ask-climpy-panel.tsx's own
    // rationale for the identical pattern.
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] px-4"
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
        aria-labelledby={HEADING_ID}
        tabIndex={-1}
        // Bounded to the viewport (max-h-[calc(100dvh-32px)]) and laid out
        // as a flex column with overflow-hidden on this outer shell — the
        // ONLY child that ever scrolls is the body region below.
        className="relative flex w-full max-w-[360px] flex-col overflow-hidden rounded-[18px] border border-[#E5E7EB] bg-white outline-none max-h-[calc(100dvh-32px)] md:max-w-[560px] md:rounded-[20px]"
      >
        {/* Header — shrink-0, never scrolls away */}
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-3 md:px-[30px] md:pt-[30px] md:pb-4">
          <div className="min-w-0">
            <h2
              id={HEADING_ID}
              className="text-[18px] font-semibold leading-[24px] text-[#111827] md:text-[22px]"
            >
              {title}
            </h2>
            <p className="mt-1.5 text-[12px] font-normal leading-[20px] text-[#6B7280] md:mt-2 md:text-[14px] md:leading-[22px]">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label={closeLabel}
            className="shrink-0 text-[20px] font-normal leading-[24px] text-[#6B7280] transition hover:text-[#111827] md:text-[22px]"
          >
            x
          </button>
        </div>

        {/* Scrollable body — min-h-0 + flex-1 lets this region shrink below
            its content's natural height so overflow-y-auto actually takes
            effect (a bare flex-1 alone stays sized to content and never
            triggers scrolling). overscroll-contain stops an exhausted
            scroll here from scrolling the page behind the modal. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 md:px-[30px]">
          <div className="w-full rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-[14px] py-3 md:rounded-[14px] md:px-4 md:py-[14px]">
            <p className="whitespace-pre-wrap break-words text-[13px] font-normal leading-[21px] text-[#111827] [overflow-wrap:anywhere] md:text-[15px] md:leading-[22px]">
              &ldquo;{hookText}&rdquo;
            </p>
          </div>

          {errorText ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-[12px] font-normal leading-[18px] text-[#7C3AED] [overflow-wrap:anywhere] md:text-[13px] md:leading-[20px]">
              {errorText}
            </p>
          ) : (
            <div className="mt-3">
              <p className="whitespace-pre-wrap break-words text-[12px] font-normal leading-[18px] text-[#6B7280] [overflow-wrap:anywhere] md:text-[14px] md:leading-[21px]">
                {reasonLabel}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[12px] font-normal leading-[18px] text-[#6B7280] [overflow-wrap:anywhere] md:text-[14px] md:leading-[21px]">
                {reasonText}
              </p>
            </div>
          )}
        </div>

        {/* Footer — shrink-0, never scrolls away, respects the mobile
            safe-area bottom inset (matches ask-climpy-panel.tsx's own
            composer padding). */}
        <div className="flex shrink-0 gap-2.5 border-t border-[#E5E7EB] bg-white px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:px-[30px] md:pb-5">
          <button
            type="button"
            onClick={onCopy}
            disabled={isCopyDisabled}
            className="h-10 flex-1 rounded-[12px] border border-[#E5E7EB] bg-[#7C3AED] text-[13px] font-semibold text-[#111827] transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60 md:h-10 md:w-[130px] md:flex-none md:text-[14px]"
          >
            {copyButtonLabel}
          </button>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="h-10 flex-1 rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] text-[13px] font-semibold text-[#111827] transition hover:bg-[#F3E8FF] md:h-10 md:w-[100px] md:flex-none md:text-[14px]"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
