"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "../../lib/supabase/browser";
import { useMessages } from "../use-messages";
import { deleteAnalysis } from "./delete-analysis";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Controlled by mount/unmount rather than an isOpen prop — mirrors
// rename-analysis-dialog.tsx's rationale: the caller (AnalysisActionsMenu)
// renders this component only while the dialog should be visible, so this
// component's own lifecycle IS "open". No trigger of its own — Delete's
// trigger is now the shared overflow menu item, not a standalone button.
export function DeleteAnalysisDialog({
  id,
  title,
  onClose,
}: {
  id: string;
  title: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const messages = useMessages();
  const deleteMessages = messages.myAnalyses.delete;

  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Mirrors rename-analysis-dialog.tsx's isSavingRef pattern: the mount
  // effect below has an empty dependency array, so isDeleting must be read
  // from a ref inside its keydown handler rather than added to that
  // effect's own dependencies (which would re-run the effect's cleanup —
  // restoring focus, unlocking scroll — on every isDeleting flip, i.e.
  // mid-deletion, fighting the dialog while it's still open).
  const isDeletingRef = useRef(false);

  useEffect(() => {
    isDeletingRef.current = isDeleting;
  }, [isDeleting]);

  // onClose is an inline callback recreated on every render of the caller —
  // reading it via a ref (kept current by its own effect, never written
  // during render) keeps the mount effect from needing onClose in its
  // dependency array.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const headingId = `delete-analysis-heading-${id}`;
  const descriptionId = `delete-analysis-description-${id}`;

  function closeDialog() {
    if (isDeletingRef.current) return;
    onCloseRef.current();
  }

  async function handleConfirm() {
    if (isDeletingRef.current) return;

    setIsDeleting(true);
    setErrorMessage(null);

    const result = await deleteAnalysis(supabaseBrowser, id);

    if (!result.ok) {
      // Both "not-found" (missing or belongs to someone else) and
      // "database" (a real failure) show the exact same generic message —
      // never revealing which case occurred, matching deleteAnalysis's own
      // not-found rationale.
      setIsDeleting(false);
      setErrorMessage(deleteMessages.errorDescription);
      return;
    }

    setIsDeleting(false);
    router.refresh();
    onCloseRef.current();
  }

  useEffect(() => {
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
    // Mount/unmount only — this component's lifecycle IS "open" (see the
    // comment above the component), so there is nothing to resync here.
  }, []);

  const trimmedTitle = title.trim();

  return createPortal(
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
  );
}
