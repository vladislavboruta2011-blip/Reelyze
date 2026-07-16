"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SignInCardContent } from "./sign-in-card-content";
import { useMessages } from "./use-messages";

const HEADING_ID = "sign-in-modal-heading";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SignInModal({
  isOpen,
  onClose,
  nextPath,
}: {
  isOpen: boolean;
  onClose: () => void;
  nextPath: string;
}) {
  const messages = useMessages();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    panelRef.current?.focus();

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPaddingRight = document.body.style.paddingRight;
    // Locking scroll removes the scrollbar, which shifts page content
    // sideways by its width — pad the body by that same amount so nothing
    // visibly shifts while the modal is open.
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR
        )
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const outside =
        !active || !panelRef.current.contains(active);

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
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111827]/60 px-4 py-6 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={HEADING_ID}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-[28px] border border-[#DDD6FE] bg-white p-8 shadow-[0_32px_100px_rgba(124,58,237,0.25)] outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={messages.auth.modal.closeLabel}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
        >
          <X size={18} />
        </button>

        <SignInCardContent nextPath={nextPath} headingId={HEADING_ID} />
      </div>
    </div>,
    document.body
  );
}
