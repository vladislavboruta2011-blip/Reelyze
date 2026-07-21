import { readFileSync } from "node:fs";

let failures = 0;

function check(label: string, pass: boolean, detail?: string): void {
  if (pass) {
    console.log(`PASS — ${label}`);
    return;
  }

  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ""}`);
}

// No React/DOM test harness exists in this repo's test suite (see
// tests/move-delete-into-overflow-menu.ts's own rationale) — the modal's
// scrolling/accessibility structure is verified against its source shape.

const modalSource = readFileSync("app/results/improved-hook-modal.tsx", "utf8");
const pageSource = readFileSync("app/results/page.tsx", "utf8");

// --- Diagnosed root cause is gone -------------------------------------

function checkOldOverflowCauseIsGone(): void {
  check(
    "The old fixed-height desktop shell (h-[410px], absolute positioning) is gone",
    !modalSource.includes("h-[410px]") && !pageSource.includes("h-[410px] w-[560px]")
  );

  check(
    "The old hard-clipping explanation box (max-h-[115px] overflow-hidden, no scrolling) is gone",
    !modalSource.includes("max-h-[115px]") &&
      !pageSource.includes("max-h-[115px] overflow-hidden")
  );

  check(
    "There is only ONE modal implementation now (no separate 'Desktop modal' / 'Mobile modal' duplicated blocks in page.tsx)",
    !pageSource.includes("{/* Desktop modal */}") &&
      !pageSource.includes("{/* Mobile modal */}") &&
      pageSource.split("<ImprovedHookModal").length - 1 === 1
  );
}

// --- Required structure: shell / header / body / footer -----------------

function checkOuterShellBounded(): void {
  check(
    "The dialog panel is viewport-bounded via max-h-[calc(100dvh-32px)]",
    modalSource.includes("max-h-[calc(100dvh-32px)]")
  );

  check(
    "The dialog panel uses a flex-column layout",
    /className="relative flex w-full max-w-\[360px\] flex-col overflow-hidden/.test(
      modalSource
    )
  );

  check(
    "The outer modal shell uses overflow-hidden (only the body region below scrolls)",
    /flex-col overflow-hidden rounded-\[18px\]/.test(modalSource)
  );

  check(
    "Desktop width/rounding is preserved (md:max-w-[560px], md:rounded-[20px]) while mobile keeps max-w-[360px]/rounded-[18px]",
    modalSource.includes("max-w-[360px]") &&
      modalSource.includes("rounded-[18px]") &&
      modalSource.includes("md:max-w-[560px]") &&
      modalSource.includes("md:rounded-[20px]")
  );
}

function checkHeaderNonScrolling(): void {
  const headerStart = modalSource.indexOf("{/* Header");
  const headerEnd = modalSource.indexOf("{/* Scrollable body");
  const header =
    headerStart >= 0 && headerEnd > headerStart
      ? modalSource.slice(headerStart, headerEnd)
      : "";

  check(
    "The header region is shrink-0 (never scrolls away)",
    header.includes('className="flex shrink-0 items-start justify-between')
  );

  check(
    "The header contains the title (h2, labelled) and the close button, and nothing else scrollable",
    header.includes("<h2") &&
      header.includes("id={HEADING_ID}") &&
      header.includes("{title}") &&
      header.includes("{description}") &&
      /<button[\s\S]*?aria-label=\{closeLabel\}/.test(header)
  );
}

function checkContentAreaScrollable(): void {
  const bodyStart = modalSource.indexOf("{/* Scrollable body");
  const bodyEnd = modalSource.indexOf("{/* Footer");
  const body =
    bodyStart >= 0 && bodyEnd > bodyStart
      ? modalSource.slice(bodyStart, bodyEnd)
      : "";

  check(
    "The body region uses min-h-0 AND flex-1 AND overflow-y-auto (min-h-0 is required for overflow-y-auto to actually trigger inside a flex column)",
    /className="min-h-0 flex-1 overflow-y-auto overscroll-contain/.test(
      modalSource
    )
  );

  check(
    "The body region uses overscroll-contain (an exhausted scroll here does not scroll the page behind the modal)",
    modalSource.includes("overscroll-contain")
  );

  check(
    "The body contains the hook text and the explanation/reason text",
    body.includes("{hookText}") &&
      (body.includes("{reasonLabel}") || body.includes("{errorText}")) &&
      (body.includes("{reasonText}") || body.includes("{errorText}"))
  );

  check(
    "The body has sufficient internal padding (px-5, pb-4 mobile; md:px-[30px] desktop)",
    body.includes("px-5 pb-4") && body.includes("md:px-[30px]")
  );

  check(
    "There is exactly ONE scroll container (className attribute containing overflow-y-auto) — no nested scroll region inside the hook-text block itself",
    (modalSource.match(/className="[^"]*overflow-y-auto[^"]*"/g) ?? [])
      .length === 1 &&
      !/rounded-\[12px\] border border-\[#E5E7EB\] bg-\[#F8F8FC\][^"]*overflow-y-auto/.test(
        modalSource
      )
  );
}

function checkFooterNonScrollingAndReachable(): void {
  const footerStart = modalSource.indexOf("{/* Footer");
  const footer = footerStart >= 0 ? modalSource.slice(footerStart) : "";

  check(
    "The footer region is shrink-0 (never scrolls away, always visible)",
    footer.includes('className="flex shrink-0 gap-2.5 border-t')
  );

  check(
    "The footer is visually separated from the scrollable body with a top border",
    footer.includes("border-t border-[#E5E7EB]")
  );

  check(
    "The footer respects the mobile safe-area bottom inset",
    footer.includes("env(safe-area-inset-bottom)")
  );

  check(
    "Copy Hook and Close are both rendered inside the footer (outside the scrollable body region)",
    footer.includes("{copyButtonLabel}") && footer.includes("{closeLabel}")
  );

  check(
    "Copy Hook is guarded by isCopyDisabled and Close always closes the modal",
    /onClick=\{onCopy\}\s*\n\s*disabled=\{isCopyDisabled\}/.test(footer) &&
      footer.includes("onClick={() => onCloseRef.current()}")
  );
}

// --- Text overflow protection --------------------------------------------

function checkTextOverflowProtection(): void {
  check(
    "The hook text is never truncated: no line-clamp, no fixed-height box, no overflow-hidden wrapping it",
    !modalSource.includes("line-clamp") &&
      !/h-\[\d+px\][^"]*bg-\[#F8F8FC\]/.test(modalSource)
  );

  check(
    "The hook text wraps safely (break-words + overflow-wrap:anywhere) and preserves intentional paragraph breaks (whitespace-pre-wrap)",
    /whitespace-pre-wrap break-words text-\[13px\][\s\S]{0,80}\[overflow-wrap:anywhere\][\s\S]{0,80}\{hookText\}/.test(
      modalSource
    )
  );

  check(
    "The explanation/reason text also has the same wrap protection (break-words + overflow-wrap:anywhere)",
    (modalSource.match(/break-words[\s\S]{0,100}\[overflow-wrap:anywhere\]/g) ?? [])
      .length >= 3
  );

  check(
    "The error text also has the same wrap protection",
    /whitespace-pre-wrap break-words[\s\S]{0,80}text-\[#7C3AED\][\s\S]{0,80}\[overflow-wrap:anywhere\]/.test(
      modalSource
    )
  );

  check(
    "No text is hidden via overflow:hidden without an accompanying scroll container",
    !/max-h-\[\d+px\]\s+overflow-hidden/.test(modalSource)
  );
}

// --- Accessibility --------------------------------------------------------

function checkAccessibility(): void {
  check(
    "role=dialog, aria-modal, aria-labelledby, and a focusable tabIndex are present",
    modalSource.includes('role="dialog"') &&
      modalSource.includes('aria-modal="true"') &&
      modalSource.includes("aria-labelledby={HEADING_ID}") &&
      modalSource.includes("tabIndex={-1}")
  );

  check(
    "The title has the matching id (HEADING_ID) so aria-labelledby actually resolves",
    /id=\{HEADING_ID\}\s*\n\s*className="text-\[18px\]/.test(modalSource)
  );

  check(
    "Escape closes the modal",
    modalSource.includes('if (event.key === "Escape") {') &&
      modalSource.includes("onCloseRef.current();")
  );

  check(
    "A focus trap cycles Tab/Shift+Tab within the panel using the shared FOCUSABLE_SELECTOR pattern",
    modalSource.includes("FOCUSABLE_SELECTOR") &&
      modalSource.includes('event.key !== "Tab"') &&
      modalSource.includes("panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)")
  );

  check(
    "Body scroll is locked while open and restored (with scrollbar-width compensation) on close",
    modalSource.includes('document.body.style.overflow = "hidden";') &&
      modalSource.includes("originalBodyOverflow") &&
      modalSource.includes("scrollbarWidth")
  );

  check(
    "Focus moves into the panel on open and returns to the previously focused element on close",
    modalSource.includes("panelRef.current?.focus();") &&
      modalSource.includes("previouslyFocusedElementRef.current?.focus();")
  );

  check(
    "The close button has an accessible label (aria-label) — not just a bare 'x' glyph",
    /aria-label=\{closeLabel\}/.test(modalSource)
  );

  check(
    "Backdrop click (outside the panel) closes the modal, exactly like clicking the panel's own content does not",
    /onClick=\{\(event\) => \{\s*\n\s*if \(event\.target === event\.currentTarget\) \{\s*\n\s*onCloseRef\.current\(\);/.test(
      modalSource
    )
  );

  check(
    "Rendered via a portal to document.body (matches ask-climpy-panel.tsx / sign-in-modal.tsx's own convention)",
    modalSource.includes("createPortal(") && modalSource.includes("document.body")
  );
}

// --- Scope: Improve Script / Ask Climpy / mobile header untouched -------

function checkScopeUnaffected(): void {
  check(
    "The Improve Script modal (isScriptModalOpen) is untouched — still its own separate inline block in page.tsx, not merged with or replaced by ImprovedHookModal",
    pageSource.includes("{isScriptModalOpen && (") &&
      pageSource.includes("results.improveScriptModal.improvedTitle")
  );

  check(
    "ImprovedHookModal is only ever used for the Improved Hook modal (isHookModalOpen), never for Improve Script",
    /\{isHookModalOpen && \(\s*\n\s*<ImprovedHookModal/.test(pageSource) &&
      !/isScriptModalOpen[\s\S]{0,50}<ImprovedHookModal/.test(pageSource)
  );

  check(
    "improved-hook-modal.tsx has no knowledge of Ask Climpy or the mobile header — a standalone component",
    !modalSource.includes("AskClimpy") &&
      !modalSource.includes("OverflowMenu") &&
      !modalSource.includes("LanguageSwitcher")
  );

  check(
    "No new npm package was introduced — only react/react-dom imports",
    Array.from(modalSource.matchAll(/^import .* from "([^"]+)";$/gm)).every(
      ([, specifier]) => specifier === "react" || specifier === "react-dom"
    )
  );
}

async function main(): Promise<void> {
  checkOldOverflowCauseIsGone();
  checkOuterShellBounded();
  checkHeaderNonScrolling();
  checkContentAreaScrollable();
  checkFooterNonScrollingAndReachable();
  checkTextOverflowProtection();
  checkAccessibility();
  checkScopeUnaffected();

  if (failures > 0) {
    console.error(`\nImproved Hook modal tests: ${failures} failed`);
    process.exitCode = 1;
  } else {
    console.log("\nImproved Hook modal tests: all passed");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL — unexpected error: ${message}`);
  process.exitCode = 1;
});
