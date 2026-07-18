"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "../../lib/supabase/browser";
import { useMessages } from "../use-messages";
import { deleteAnalysis } from "./delete-analysis";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// One reusable component owns both the trigger and its own confirmation
// dialog, matching app/sign-in-modal.tsx's focus-trap/Escape/backdrop
// pattern. Each rendered instance (one per desktop row, one per mobile
// card — both always exist in the DOM at once, only one visible per
// breakpoint) keeps entirely local isOpen/isDeleting state, so there is no
// shared/global dialog state and no risk of two instances for the same
// item conflicting with each other.
//
// Success deliberately does not remove the row via local optimistic
// state: the same item is rendered twice (desktop table + mobile card),
// each with its own independent DeleteAnalysisButton instance, so a
// locally-tracked "removed" flag in just one of them couldn't be kept in
// sync with the other without shared state. router.refresh() re-runs
// app/my-analyses/page.tsx's server fetch instead — a single source of
// truth that updates both renderings identically, with no manual reload.
export function DeleteAnalysisButton({
  id,
  title,
  className = "",
}: {
  id: string;
  title: string;
  className?: string;
}) {
  const router = useRouter();
  const messages = useMessages();
  const deleteMessages = messages.myAnalyses.delete;

  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Mirrors isDeleting into a ref so the open/close lifecycle effect below
  // can read the *current* pending state from its keydown handler without
  // needing isDeleting in that effect's own dependency array — adding it
  // there would re-run the effect's cleanup (which restores focus and
  // unlocks body scroll) on every isDeleting flip, i.e. mid-deletion,
  // fighting the dialog while it's still open.
  const isDeletingRef = useRef(false);

  useEffect(() => {
    isDeletingRef.current = isDeleting;
  }, [isDeleting]);

  const headingId = `delete-analysis-heading-${id}`;
  const descriptionId = `delete-analysis-description-${id}`;

  function openDialog() {
    if (isDeletingRef.current) return;
    setErrorMessage(null);
    setIsOpen(true);
  }

  function closeDialog() {
    if (isDeletingRef.current) return;
    setIsOpen(false);
    setErrorMessage(null);
  }

  async function handleConfirm() {
    if (isDeletingRef.current) return;

    setIsDeleting(true);
    setErrorMessage(null);

    const result = await deleteAnalysis(supabaseBrowser, id);

    if (!result.ok) {
      // Both "not-found" (missing or belongs to someone else) and
      // "database" (a real failure) show the exact same generic message —
      // never revealing which case occurred, matching
      // fetchAnalysisById/fetchAnalysisById's own not-found rationale.
      setIsDeleting(false);
      setErrorMessage(deleteMessages.errorDescription);
      return;
    }

    setIsOpen(false);
    setIsDeleting(false);
    router.refresh();
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Cancel — not the destructive Confirm action — gets initial focus, so
    // a stray Enter keypress right after opening can never delete anything.
    cancelButtonRef.current?.focus();

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
        // Reads the ref (not closeDialog(), which isn't a dependency of
        // this effect) so the always-current pending state is respected
        // without re-running this effect's cleanup on every isDeleting
        // change.
        if (isDeletingRef.current) return;
        event.preventDefault();
        setIsOpen(false);
        setErrorMessage(null);
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
  }, [isOpen]);

  const trimmedTitle = title.trim();

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label={`${deleteMessages.triggerLabel}: ${title}`}
        className={[
          "inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-[#FCA5A5] bg-[#FEF2F2] px-3 text-[11px] font-semibold text-[#EF4444] transition hover:bg-[#FEE2E2]",
          className,
        ].join(" ")}
      >
        {deleteMessages.triggerLabel}
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/60 px-4 py-6 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeDialog();
              }
            }}
          >
            <div
              ref={panelRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={headingId}
              aria-describedby={descriptionId}
              tabIndex={-1}
              className="relative w-full max-w-[420px] rounded-[22px] border border-[#FCA5A5] bg-white p-6 shadow-[0_32px_100px_rgba(239,68,68,0.2)] outline-none"
            >
              <h2
                id={headingId}
                className="text-[16px] font-semibold text-[#111827]"
              >
                {deleteMessages.dialogHeading}
              </h2>
              <p id={descriptionId} className="mt-2 text-[13px] text-[#6B7280]">
                {trimmedTitle.length > 0
                  ? deleteMessages.dialogDescriptionWithTitle(trimmedTitle)
                  : deleteMessages.dialogDescription}
              </p>
              <p className="mt-2 text-[13px] font-medium text-[#EF4444]">
                {deleteMessages.permanentWarning}
              </p>

              {errorMessage && (
                <p role="alert" className="mt-3 text-[13px] text-[#EF4444]">
                  {errorMessage}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  ref={cancelButtonRef}
                  type="button"
                  onClick={closeDialog}
                  disabled={isDeleting}
                  className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#6B7280] transition hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteMessages.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isDeleting}
                  className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[#EF4444] px-4 text-[13px] font-semibold text-white transition hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? deleteMessages.deleting : deleteMessages.confirm}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
