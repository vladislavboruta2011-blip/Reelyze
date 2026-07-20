"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export type OverflowMenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  // The only generic extension destructive actions (e.g. Delete) need —
  // styling only, no analysis-specific meaning lives here. Omitted/
  // "default" renders identically to before this existed.
  variant?: "default" | "destructive";
};

// Generic accessible menu-button primitive (ARIA "menu button" pattern) —
// has no knowledge of analyses, Rename, or Delete at all, only a trigger
// label and an items array. Deliberately the reusable seam: a caller adds
// a new action by growing `items` by one entry — nothing here needs to
// change.
//
// The dropdown is rendered via a portal to document.body (matching
// app/sign-in-modal.tsx's / app/my-analyses/delete-analysis-dialog.tsx's
// own createPortal pattern), positioned from the trigger's live
// getBoundingClientRect() rather than plain CSS-relative absolute
// positioning — this row lives inside the desktop table's
// `overflow-hidden` rounded-corner wrapper (app/my-analyses/page.tsx),
// which would otherwise clip a dropdown that opens near the table's edge.
export function OverflowMenu({
  triggerLabel,
  items,
}: {
  triggerLabel: string;
  items: OverflowMenuItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(
    null
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();

    if (!rect) return;

    setPosition({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
    setIsOpen(true);
  }

  function closeMenu() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Standard ARIA menu-button behavior: opening the menu moves focus to
    // its first item, not the menu container itself.
    itemRefs.current[0]?.focus();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
    }

    // The menu's fixed position is computed once, on open, from the
    // trigger's coordinates — rather than tracking scroll/resize
    // continuously, closing on scroll avoids the dropdown drifting away
    // from its trigger.
    function handleScroll() {
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      const enabledIndices = items
        .map((item, index) => (item.disabled ? -1 : index))
        .filter((index) => index >= 0);

      if (enabledIndices.length === 0) {
        return;
      }

      const currentIndex = itemRefs.current.findIndex(
        (element) => element === document.activeElement
      );
      const currentPosition = enabledIndices.indexOf(currentIndex);

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const nextPosition =
          (currentPosition + delta + enabledIndices.length) %
          enabledIndices.length;
        itemRefs.current[enabledIndices[nextPosition]]?.focus();
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        itemRefs.current[enabledIndices[0]]?.focus();
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        itemRefs.current[enabledIndices[enabledIndices.length - 1]]?.focus();
        return;
      }

      if (event.key === "Tab") {
        // Matches the ARIA APG menu-button pattern: Tab moves focus out of
        // the menu entirely (to whatever's next in the page) and closes
        // it, rather than being trapped like a modal dialog.
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, items]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={triggerLabel}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] transition hover:border-[#DDD6FE] hover:text-[#7C3AED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={triggerLabel}
            style={{
              position: "fixed",
              top: position.top,
              right: position.right,
            }}
            className="z-[100] min-w-[160px] rounded-[12px] border border-[#E5E7EB] bg-white p-1.5 shadow-[0_16px_48px_rgba(17,24,39,0.14)]"
          >
            {items.map((item, index) => (
              <button
                key={item.key}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  item.onSelect();
                }}
                className={
                  item.variant === "destructive"
                    ? "flex h-9 w-full items-center rounded-[8px] px-3 text-left text-[13px] font-medium text-[#EF4444] transition hover:bg-[#FEF2F2] hover:text-[#DC2626] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[#EF4444]"
                    : "flex h-9 w-full items-center rounded-[8px] px-3 text-left text-[13px] font-medium text-[#111827] transition hover:bg-[#F3E8FF] hover:text-[#7C3AED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[#111827]"
                }
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
