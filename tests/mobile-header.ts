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
// tests/move-delete-into-overflow-menu.ts's own rationale) — the mobile
// header fix is verified against the component's source shape, matching
// that file's established pattern, plus lib/messages.ts's own EN/RU
// literal-copy assertions (see tests/messages.ts).

const pageSource = readFileSync("app/page.tsx", "utf8");
const overflowMenuSource = readFileSync(
  "app/my-analyses/overflow-menu.tsx",
  "utf8"
);
const messagesSource = readFileSync("lib/messages.ts", "utf8");

// --- Root cause: the old un-wrapped mobile header row ------------------

function checkOldOverflowingRowIsGone(): void {
  check(
    "The old mobile header no longer packs LanguageSwitcher + AuthNav + a separate Results link into one un-wrapped row",
    !/<LanguageSwitcher \/>\s*\n\s*<AuthNav \/>\s*\n\s*<Link\s*\n\s*href="\/results"/.test(
      pageSource
    )
  );

  check(
    "AuthNav is no longer imported/rendered directly inside the MOBILE LAYOUT block (only the desktop Navbar still uses it)",
    (() => {
      const mobileWrapperMarker = MOBILE_WRAPPER_MARKER;
      const mobileStart = pageSource.indexOf(mobileWrapperMarker);
      const mobileBlock =
        mobileStart >= 0 ? pageSource.slice(mobileStart) : "";
      return mobileStart >= 0 && !mobileBlock.includes("<AuthNav");
    })()
  );
}

// --- Bounded-width mobile structure -------------------------------------

const MOBILE_WRAPPER_MARKER =
  '<div className="relative block min-h-screen overflow-x-hidden bg-[#FAFAFA] min-[900px]:hidden">';
const DESKTOP_WRAPPER_MARKER =
  '<div className="hidden min-[900px]:block">';

function checkBoundedWidthStructure(): void {
  check(
    "The mobile layout wrapper caps content width (max-w-[430px]) rather than growing unbounded",
    (() => {
      const start = pageSource.indexOf(MOBILE_WRAPPER_MARKER);
      return start >= 0 && pageSource.slice(start, start + 700).includes("max-w-[430px]");
    })()
  );

  check(
    "The mobile layout wrapper suppresses horizontal overflow at the document level (overflow-x-hidden)",
    pageSource.includes(MOBILE_WRAPPER_MARKER) &&
      MOBILE_WRAPPER_MARKER.includes("overflow-x-hidden")
  );

  check(
    "The new mobile header right-side group is a small, fixed set (LanguageSwitcher + one menu trigger) — not an unbounded list of pills",
    (() => {
      const headerStart = pageSource.indexOf("{/* Header */}");
      const headerEnd = pageSource.indexOf("{/* Hero */}");
      const header =
        headerStart >= 0 && headerEnd > headerStart
          ? pageSource.slice(headerStart, headerEnd)
          : "";
      return (
        header.includes("<LanguageSwitcher />") &&
        header.includes("<OverflowMenu") &&
        !header.includes("<AuthNav") &&
        !header.includes('href="/results"')
      );
    })()
  );
}

// --- Logo remains visible -----------------------------------------------

function checkLogoVisible(): void {
  check(
    "The Climpy logo (Image) and wordmark remain in the mobile header, unconditionally rendered (not hidden behind the menu)",
    (() => {
      const headerStart = pageSource.indexOf("{/* Header */}");
      const headerEnd = pageSource.indexOf("{/* Hero */}");
      const header =
        headerStart >= 0 && headerEnd > headerStart
          ? pageSource.slice(headerStart, headerEnd)
          : "";
      return (
        header.includes('src="/logo.png"') && header.includes("CLIMPY")
      );
    })()
  );
}

// --- All navigation actions remain reachable (via the menu) -------------

function checkAllActionsReachableViaMenu(): void {
  check(
    "mobileMenuItems always includes Results",
    /const mobileMenuItems: OverflowMenuItem\[\] = \[\s*\{\s*key: "results",/.test(
      pageSource
    )
  );

  check(
    "mobileMenuItems includes My Analyses and Sign out when signed in (user truthy)",
    /\?\s*\[\s*\{\s*key: "myAnalyses",[\s\S]{0,150}\{\s*key: "signOut",/.test(
      pageSource
    )
  );

  check(
    "mobileMenuItems includes Sign in when signed out (user falsy)",
    /:\s*\[\s*\{\s*key: "signIn",/.test(pageSource)
  );

  check(
    "No new destination was invented — every menu item routes to an existing route (/results, /my-analyses) or an existing auth action (sign in modal, sign out)",
    (() => {
      const itemsStart = pageSource.indexOf(
        "const mobileMenuItems: OverflowMenuItem[] = ["
      );
      const itemsEnd = pageSource.indexOf("];", itemsStart);
      const itemsBlock = pageSource.slice(itemsStart, itemsEnd);
      return (
        itemsBlock.includes('router.push("/results")') &&
        itemsBlock.includes('router.push("/my-analyses")') &&
        itemsBlock.includes("handleMobileSignOut") &&
        itemsBlock.includes("setIsMobileSignInModalOpen(true)")
      );
    })()
  );

  check(
    "Sign-out reuses the exact same supabaseBrowser.auth.signOut() call AuthNav itself uses — no duplicated auth logic",
    /async function handleMobileSignOut\(\) \{[\s\S]{0,200}supabaseBrowser\.auth\.signOut\(\)/.test(
      pageSource
    )
  );

  check(
    "Sign-in reuses the exact same SignInModal component AuthNav itself uses",
    pageSource.includes('import { SignInModal } from "./sign-in-modal";') &&
      /<SignInModal\s*\n\s*isOpen=\{isMobileSignInModalOpen\}/.test(
        pageSource
      )
  );
}

// --- Desktop navigation unchanged ---------------------------------------

function checkDesktopNavUnchanged(): void {
  check(
    "The desktop Navbar still renders exactly one LanguageSwitcher + one AuthNav + the Start Free CTA (now styled via each component's own 'dark' variant for the black Hero band — an additive, backward-compatible prop, not a structural change)",
    (() => {
      const navbarStart = pageSource.indexOf("function Navbar() {");
      const navbarEnd = pageSource.indexOf(
        "// ─── Desktop landing: hero app-preview card"
      );
      const navbar = pageSource.slice(navbarStart, navbarEnd);
      return (
        navbar.includes("<LanguageSwitcher variant=\"dark\" />") &&
        navbar.includes("<AuthNav variant=\"dark\" />") &&
        navbar.includes("{messages.landing.nav.startFree}")
      );
    })()
  );

  check(
    "The desktop layout wrapper (hidden min-[900px]:block) and the mobile layout wrapper (min-[900px]:hidden) remain the complementary breakpoint pair — no overlap window where both could render simultaneously, and neither is still gated on the default lg (1024px) breakpoint",
    pageSource.includes(DESKTOP_WRAPPER_MARKER) &&
      pageSource.includes(MOBILE_WRAPPER_MARKER) &&
      !pageSource.includes('<div className="hidden lg:block">') &&
      !/relative block min-h-screen overflow-x-hidden bg-\[#FAFAFA\] lg:hidden/.test(
        pageSource
      )
  );
}

// --- Responsive breakpoint contract (compact-desktop/tablet fix) -------
//
// Regression coverage for the reported bug: a non-maximized Chrome window
// in the ~900-1023px range showed the phone-width MOBILE LAYOUT (hamburger,
// max-w-[430px] hero) instead of a compact desktop/tablet presentation,
// because the switch was gated on the default lg breakpoint (1024px). These
// checks validate the actual responsive INTENT (the numeric threshold and
// its relationship to the true-mobile band and the tablet-width fix), not
// just the literal min-[900px] string, so a future regression to 1024px —
// or any other value outside the required 769-900px window — is caught
// even if someone keeps the min-[...] syntax but changes the number.

function extractBreakpointPx(marker: string): number | null {
  const match = /min-\[(\d+)px\]/.exec(marker);
  return match ? Number(match[1]) : null;
}

function checkResponsiveBreakpointContract(): void {
  const desktopBreakpoint = extractBreakpointPx(
    DESKTOP_WRAPPER_MARKER
  );
  const mobileBreakpoint = extractBreakpointPx(
    MOBILE_WRAPPER_MARKER
  );

  check(
    "The desktop-layout wrapper switches on at a genuine compact-desktop width (900-1023px), not delayed until the default lg breakpoint (1024px) that caused the reported bug",
    desktopBreakpoint !== null &&
      desktopBreakpoint >= 900 &&
      desktopBreakpoint < 1024
  );

  check(
    "The mobile-layout wrapper hides at the exact same width the desktop wrapper appears — no gap or overlap window between the two",
    desktopBreakpoint !== null &&
      mobileBreakpoint !== null &&
      desktopBreakpoint === mobileBreakpoint
  );

  check(
    "The chosen breakpoint stays above the true-mobile band (>768px) — it does not eliminate or shrink the existing 320-767px mobile experience",
    desktopBreakpoint !== null && desktopBreakpoint > 768
  );

  check(
    "The desktop Navbar's own internal md:flex (768px) reveal for nav links/actions is already satisfied by the time the desktop wrapper itself becomes visible — no dead zone where the desktop wrapper is visible but its nav links are still hidden",
    desktopBreakpoint !== null && desktopBreakpoint >= 768
  );
}

// --- Tablet band is not artificially phone-width ------------------------

function checkTabletWidthNotPhoneConstrained(): void {
  check(
    "The mobile-layout tree's outer content container widens past the 430px true-mobile cap once the viewport reaches the tablet band (md/768px) that this same tree still serves below the 900px switch, instead of staying phone-width all the way up to the desktop switch",
    (() => {
      const start = pageSource.indexOf(MOBILE_WRAPPER_MARKER);
      const snippet =
        start >= 0 ? pageSource.slice(start, start + 1300) : "";
      const widerMatch = /md:max-w-\[(\d+)px\]/.exec(snippet);

      return (
        snippet.includes("max-w-[430px]") &&
        widerMatch !== null &&
        Number(widerMatch[1]) > 430
      );
    })()
  );

  check(
    "The true-mobile cap (max-w-[430px]) remains the plain, unqualified base value in its original position — the wider tablet override is additive via a responsive variant, not a replacement of the existing mobile design",
    (() => {
      const start = pageSource.indexOf(MOBILE_WRAPPER_MARKER);
      const snippet =
        start >= 0 ? pageSource.slice(start, start + 1300) : "";
      return (
        snippet.includes("w-full max-w-[430px] flex-col") &&
        !snippet.includes("md:max-w-[430px]")
      );
    })()
  );
}

// --- Mobile menu accessibility (reused OverflowMenu) --------------------

function checkMenuAccessibility(): void {
  check(
    "The trigger exposes aria-haspopup, aria-expanded, and aria-controls",
    overflowMenuSource.includes('aria-haspopup="menu"') &&
      overflowMenuSource.includes("aria-expanded={isOpen}") &&
      overflowMenuSource.includes("aria-controls={menuId}")
  );

  check(
    "aria-controls references a stable id (useId) that is actually set on the portal-rendered menu container",
    overflowMenuSource.includes("const menuId = useId();") &&
      /id=\{menuId\}\s*\n\s*ref=\{menuRef\}\s*\n\s*role="menu"/.test(
        overflowMenuSource
      )
  );

  check(
    "Escape closes the menu and returns focus to the trigger",
    overflowMenuSource.includes('if (event.key === "Escape") {') &&
      overflowMenuSource.includes("closeMenu();") &&
      overflowMenuSource.includes("triggerRef.current?.focus();")
  );

  check(
    "Outside click (and click on the trigger itself) closes the menu",
    overflowMenuSource.includes("handlePointerDown") &&
      overflowMenuSource.includes("menuRef.current?.contains(target)") &&
      overflowMenuSource.includes("triggerRef.current?.contains(target)")
  );

  check(
    "The trigger has focus-visible styling",
    overflowMenuSource.includes("focus-visible:outline")
  );

  check(
    "Selecting any menu item closes the menu before running its action (never leaves an open menu/overlay behind)",
    (() => {
      const idx = overflowMenuSource.indexOf("onClick={() => {");
      const snippet = idx >= 0 ? overflowMenuSource.slice(idx, idx + 200) : "";
      return (
        snippet.indexOf("setIsOpen(false);") >= 0 &&
        snippet.indexOf("setIsOpen(false);") < snippet.indexOf("item.onSelect();")
      );
    })()
  );

  check(
    "The dropdown is only ever mounted while isOpen is true — no invisible overlay lingers in the DOM after closing",
    /\{isOpen &&\s*\n\s*position &&\s*\n\s*createPortal\(/.test(
      overflowMenuSource
    )
  );

  check(
    "The trigger icon is customizable (optional icon prop, defaulting to the existing MoreVertical) — the landing page's nav menu can use a conventional hamburger icon instead of the per-row 'more actions' dots",
    /icon: Icon = MoreVertical,/.test(overflowMenuSource) &&
      pageSource.includes("icon={Menu}")
  );
}

// --- No duplicated interactive controls at the same breakpoint ---------

function checkNoDuplicateControlsAtSameBreakpoint(): void {
  check(
    "AuthNav is rendered exactly once in app/page.tsx (the desktop Navbar) — never duplicated for mobile now that the mobile header uses the shared menu instead (an optional variant=\"dark\" prop on that one instance is fine — still one render site)",
    (pageSource.match(/<AuthNav(\s+variant="[^"]*")?\s*\/>/g) ?? []).length === 1
  );

  check(
    "LanguageSwitcher is rendered exactly twice — once for desktop (inside the hidden min-[900px]:block wrapper, using its own variant=\"dark\" prop for the black Hero band) and once for mobile (inside the min-[900px]:hidden wrapper) — never both visible at the same breakpoint",
    (pageSource.match(/<LanguageSwitcher(\s+variant="[^"]*")?\s*\/>/g) ?? []).length === 2
  );
}

// --- Localization: EN/RU parity for the new labels ----------------------

function checkLocalization(): void {
  check(
    "common.menu (the menu trigger's aria-label) is defined for both locales, EN and RU",
    /menu: "Menu",/.test(messagesSource) && /menu: "Меню",/.test(messagesSource)
  );

  check(
    "No Ukrainian text was introduced for the new label",
    !/menu:\s*"[^"]*ї[^"]*"/i.test(messagesSource)
  );

  check(
    "Reachability in every locale/session combination relies on labels that already exist for both locales (results, myAnalyses, signIn, signOut) — no new per-locale copy needed for the menu items themselves",
    /results: "Results"/.test(messagesSource) &&
      /results: "Результаты"/.test(messagesSource) &&
      /myAnalyses: "My analyses"/.test(messagesSource) &&
      /myAnalyses: "Мои анализы"/.test(messagesSource) &&
      /signIn: "Sign in"/.test(messagesSource) &&
      /signIn: "Войти"/.test(messagesSource) &&
      /signOut: "Sign out"/.test(messagesSource) &&
      /signOut: "Выйти"/.test(messagesSource)
  );
}

// --- Scope: no unrelated pages/behavior touched -------------------------

function checkScope(): void {
  const resultsSource = readFileSync("app/results/page.tsx", "utf8");
  const myAnalysesSource = readFileSync("app/my-analyses/page.tsx", "utf8");

  check(
    "/results' mobile header still stacks LanguageSwitcher/AuthNav on their own row below the icon-only top row — unchanged, since it never exhibited the overflow bug",
    /flex flex-col items-center gap-2 px-5 pb-2">\s*\n\s*<LanguageSwitcher \/>\s*\n\s*<AuthNav variant="results" \/>/.test(
      resultsSource
    )
  );

  check(
    "/my-analyses' mobile header still has no LanguageSwitcher row at all and only its own New Analysis + sign-out pills — unchanged, since it never exhibited the overflow bug",
    /justify-center gap-2 px-5 pb-5">\s*\n\s*<Link\s*\n\s*href="\/"/.test(
      myAnalysesSource
    ) && !myAnalysesSource.includes("<OverflowMenu")
  );

  check(
    "No new npm package was introduced — OverflowMenu still only imports react/react-dom/lucide-react/local modules",
    Array.from(
      overflowMenuSource.matchAll(/^import .* from "([^"]+)";$/gm)
    ).every(
      ([, specifier]) =>
        specifier.startsWith(".") ||
        specifier === "react" ||
        specifier === "react-dom" ||
        specifier === "lucide-react"
    )
  );
}

async function main(): Promise<void> {
  checkOldOverflowingRowIsGone();
  checkBoundedWidthStructure();
  checkLogoVisible();
  checkAllActionsReachableViaMenu();
  checkDesktopNavUnchanged();
  checkResponsiveBreakpointContract();
  checkTabletWidthNotPhoneConstrained();
  checkMenuAccessibility();
  checkNoDuplicateControlsAtSameBreakpoint();
  checkLocalization();
  checkScope();

  if (failures > 0) {
    console.error(`\nMobile header tests: ${failures} failed`);
    process.exitCode = 1;
  } else {
    console.log("\nMobile header tests: all passed");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL — unexpected error: ${message}`);
  process.exitCode = 1;
});
