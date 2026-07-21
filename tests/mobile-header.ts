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
      const mobileWrapperMarker =
        '<div className="relative block min-h-screen overflow-x-hidden bg-[#FAFAFA] lg:hidden">';
      const mobileStart = pageSource.indexOf(mobileWrapperMarker);
      const mobileBlock =
        mobileStart >= 0 ? pageSource.slice(mobileStart) : "";
      return mobileStart >= 0 && !mobileBlock.includes("<AuthNav");
    })()
  );
}

// --- Bounded-width mobile structure -------------------------------------

const MOBILE_WRAPPER_MARKER =
  '<div className="relative block min-h-screen overflow-x-hidden bg-[#FAFAFA] lg:hidden">';

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
    "The desktop Navbar still renders LanguageSwitcher + AuthNav (default variant) + the Start Free CTA, untouched",
    (() => {
      const navbarStart = pageSource.indexOf("function Navbar() {");
      const navbarEnd = pageSource.indexOf(
        "// ─── Desktop landing: hero preview card"
      );
      const navbar = pageSource.slice(navbarStart, navbarEnd);
      return (
        navbar.includes("<LanguageSwitcher />") &&
        navbar.includes("<AuthNav />") &&
        navbar.includes("{messages.landing.nav.startFree}")
      );
    })()
  );

  check(
    "The desktop layout wrapper (hidden lg:block) and the mobile layout wrapper (lg:hidden) remain the complementary breakpoint pair — no overlap window where both could render simultaneously",
    pageSource.includes('<div className="hidden lg:block">') &&
      /lg:hidden"/.test(pageSource)
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
    "AuthNav is rendered exactly once in app/page.tsx (the desktop Navbar) — never duplicated for mobile now that the mobile header uses the shared menu instead",
    (pageSource.match(/<AuthNav\s*\/>/g) ?? []).length === 1
  );

  check(
    "LanguageSwitcher is rendered exactly twice — once for desktop (inside the hidden lg:block wrapper) and once for mobile (inside the lg:hidden wrapper) — never both visible at the same breakpoint",
    (pageSource.match(/<LanguageSwitcher \/>/g) ?? []).length === 2
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
