"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "../../lib/supabase/browser";
import { useMessages } from "../use-messages";
import {
  MAX_TITLE_CHARACTERS,
  renameAnalysis,
  validateRenameTitle,
} from "./rename-analysis";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Controlled by mount/unmount rather than an isOpen prop — the caller
// (AnalysisActionsMenu) renders this component only while the dialog
// should be visible, so this component's own lifecycle IS "open". That's
// what lets useState(title) give the right initial value on every open
// with no reset-on-reopen effect, and lets the mount effect below run with
// an empty dependency array — no isOpen prop needed at all.
//
// Unlike app/my-analyses/delete-analysis-button.tsx's self-contained
// button+dialog, this has no trigger of its own: any future caller (e.g. a
// later Delete-in-menu refactor's sibling) can reuse it unchanged by
// conditionally rendering it the same way.
export function RenameAnalysisDialog({
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
  const renameMessages = messages.myAnalyses.rename;

  const [inputValue, setInputValue] = useState(title);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Mirrors delete-analysis-button.tsx's isDeletingRef pattern: the mount
  // effect below has an empty dependency array, so isSaving must be read
  // from a ref inside its keydown handler rather than added to that
  // effect's own dependencies (which would re-run the effect's cleanup —
  // restoring focus, unlocking scroll — on every isSaving flip, i.e.
  // mid-save, fighting the dialog while it's still open).
  const isSavingRef = useRef(false);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  // onClose is an inline callback recreated on every render of the caller —
  // reading it via a ref (kept current by its own effect, never written
  // during render) keeps the mount effect from needing onClose in its
  // dependency array.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const headingId = `rename-analysis-heading-${id}`;

  function closeDialog() {
    if (isSavingRef.current) return;
    onCloseRef.current();
  }

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();

    if (isSavingRef.current) return;

    const validation = validateRenameTitle(inputValue);

    if (!validation.ok) {
      setErrorMessage(
        validation.reason === "empty"
          ? renameMessages.errorEmpty
          : renameMessages.errorTooLong
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const result = await renameAnalysis(supabaseBrowser, id, validation.title);

    if (!result.ok) {
      // Every failure reason (invalid-title, not-found/unauthorized,
      // database) shows the exact same generic message — never revealing
      // which case occurred, matching deleteAnalysis's own rationale.
      setIsSaving(false);
      setErrorMessage(renameMessages.errorDescription);
      return;
    }

    setIsSaving(false);
    router.refresh();
    onCloseRef.current();
  }

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Autofocus the input with its existing text selected — the standard
    // rename-field convention (Finder/Explorer/GitHub repo rename). Safe
    // to default to, unlike Delete's destructive Confirm action.
    inputRef.current?.focus();
    inputRef.current?.select();

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
        if (isSavingRef.current) return;
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
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="relative w-full max-w-[420px] rounded-[22px] border border-[#E5E7EB] bg-white p-6 shadow-[0_32px_100px_rgba(17,24,39,0.18)] outline-none"
      >
        <h2 id={headingId} className="text-[16px] font-semibold text-[#111827]">
          {renameMessages.dialogHeading}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4">
          <label
            htmlFor={`rename-analysis-input-${id}`}
            className="sr-only"
          >
            {renameMessages.inputLabel}
          </label>
          <input
            ref={inputRef}
            id={`rename-analysis-input-${id}`}
            type="text"
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
            maxLength={MAX_TITLE_CHARACTERS}
            disabled={isSaving}
            className="h-11 w-full rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 text-[14px] text-[#111827] outline-none focus:border-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"
          />

          {errorMessage && (
            <p role="alert" className="mt-3 text-[13px] text-[#EF4444]">
              {errorMessage}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeDialog}
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#6B7280] transition hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {renameMessages.cancel}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[#7C3AED] px-4 text-[13px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? renameMessages.saving : renameMessages.confirm}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
