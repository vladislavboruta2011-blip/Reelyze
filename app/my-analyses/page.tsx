import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HelpCircle, History, Loader2, PencilLine } from "lucide-react";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getMessages, type Messages } from "../../lib/messages";
import { DEFAULT_LOCALE } from "../../lib/i18n";
import { toSessionUser } from "../../lib/session-user";
import { SidebarSignOutButton } from "./sidebar-sign-out-button";
import { AnalysesSearchProvider } from "./analyses-search";
import { DesktopAnalysesContent, MobileAnalysesContent } from "./analyses-content";

// Always re-runs the query on navigation/refresh — a newly saved analysis
// must show up without a stale cached render. No real-time subscription is
// needed for that; a fresh server fetch per visit is enough for this MVP.
export const dynamic = "force-dynamic";

// Never throws: missing Supabase config or a failed session check are
// both treated as "not signed in" so this page can only ever redirect to
// /login, never crash with an unhandled error.
async function getCurrentUserOrNull() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } catch {
    return null;
  }
}

// Generated from the user's real display name only — never a fetched
// avatar image (no external image requests) and never the email address.
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";

  return (first + last).toUpperCase();
}

// The Suspense fallback for both DesktopAnalysesContent and
// MobileAnalysesContent (analyses-content.tsx) — a static, non-interactive
// card, so this stays a plain Server Component (no "use client" needed).
// Deliberately the same rounded-card shape as analyses-content.tsx's
// Empty/Error states for visual consistency, and deliberately just a small
// spin icon plus heading and description — no per-row placeholder rows or
// per-card mobile shapes, out of scope for this feature. The status/polite
// ARIA pairing below (distinct from the alert role ErrorState uses) is the
// correct pairing for a non-error, in-progress announcement.
function AnalysesLoadingCard({
  myAnalyses,
}: {
  myAnalyses: Pick<Messages["myAnalyses"], "loading">;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[18px] border border-[#E5E7EB] bg-white p-10 text-center"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF]">
        <Loader2
          size={20}
          className="animate-spin text-[#7C3AED]"
          aria-hidden="true"
        />
      </div>
      <h2 className="mt-4 text-[18px] font-semibold text-[#111827]">
        {myAnalyses.loading.heading}
      </h2>
      <p className="mx-auto mt-2 max-w-[360px] text-[14px] leading-[1.6] text-[#6B7280]">
        {myAnalyses.loading.description}
      </p>
    </div>
  );
}

// Open is implemented as its own standalone action; Rename and Delete both
// live inside the row's overflow menu (see AnalysisActionsMenu). Title
// Search, the Risk filter, and Pagination all live in analyses-search.tsx.
// No rerun or custom sorting — those remain out of scope.
export default async function MyAnalysesPage() {
  const user = await getCurrentUserOrNull();

  if (!user) {
    redirect("/login?next=/my-analyses");
  }

  // Locale isn't yet threaded through server-rendered routes (LocaleProvider
  // is a client-only, localStorage-backed context) — this page uses the
  // default locale until that's wired up.
  const messages = getMessages(DEFAULT_LOCALE);
  const results = messages.results;
  const myAnalyses = messages.myAnalyses;

  // Real authenticated user data only (name for the account area) — never
  // the email address, matching how AuthNav (app/auth-nav.tsx) already
  // avoids showing it anywhere in the UI. No avatar image is fetched: the
  // initials circle below is generated from this name locally, so nothing
  // here makes an external image request.
  const sessionUser = toSessionUser(user);

  // The analyses list query itself (and the narrow, function-free message
  // objects Client Components further down need) now live in
  // analyses-content.tsx, awaited lazily inside DesktopAnalysesContent /
  // MobileAnalysesContent under the <Suspense> boundaries below — not here
  // — so this chrome (sidebar, heading, "New Analysis" CTA, mobile nav)
  // renders immediately instead of blocking on that fetch. See
  // analyses-content.tsx's own comment for why there are two content
  // components/boundaries (one per breakpoint) sharing one cache()-backed
  // query rather than a single shared boundary.
  return (
    <AnalysesSearchProvider>
      <main className="min-h-screen bg-[#FAFAFA] text-[#111827]">
        {/* DESKTOP */}
        <div className="hidden lg:flex">
          <aside className="fixed left-0 top-0 z-30 flex h-screen w-[230px] flex-col border-r border-[#E5E7EB]/60 bg-[#FAFAFA]">
            <div className="flex items-center gap-3 px-6 py-7">
              <Image
                src="/logo.png"
                alt="Climpy"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
                priority
              />
              <span className="text-[15px] font-bold tracking-[0.16em] text-[#111827]">
                CLIMPY
              </span>
            </div>
            <nav
              className="flex flex-col gap-1.5 px-4"
              aria-label={myAnalyses.heading}
            >
              <Link
                href="/"
                className="flex h-[46px] items-center gap-3 rounded-[12px] px-4 transition hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
              >
                <PencilLine size={16} className="text-[#6B7280]" />
                <span className="text-[14px] font-medium text-[#6B7280]">
                  {results.nav.newAnalysis}
                </span>
              </Link>
              <Link
                href="/my-analyses"
                aria-current="page"
                className="flex h-[46px] items-center gap-3 rounded-[12px] border border-[#DDD6FE] bg-[#F3E8FF] px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
              >
                <History size={16} className="text-[#7C3AED]" />
                <span className="text-[14px] font-semibold text-[#7C3AED]">
                  {messages.common.myAnalyses}
                </span>
              </Link>
              <Link
                href="/#how-it-works"
                className="flex h-[46px] items-center gap-3 rounded-[12px] px-4 transition hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
              >
                <HelpCircle size={16} className="text-[#6B7280]" />
                <span className="text-[14px] font-medium text-[#6B7280]">
                  {messages.landing.nav.howItWorks}
                </span>
              </Link>
            </nav>

            <div className="mt-auto border-t border-[#E5E7EB]/70 px-4 py-5">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[12px] font-semibold text-[#7C3AED]"
                >
                  {sessionUser?.name ? initialsFromName(sessionUser.name) : ""}
                </div>
                {sessionUser?.name && (
                  <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#111827]">
                    {sessionUser.name}
                  </p>
                )}
              </div>
              <SidebarSignOutButton className="mt-3 w-full" />
            </div>
          </aside>

          <section className="min-h-screen w-full pl-[230px]">
            <div className="mx-auto w-full max-w-[1100px] px-9 py-11">
              <div className="mb-8 flex items-start justify-between gap-6">
                <div>
                  <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#111827]">
                    {myAnalyses.heading}
                  </h1>
                  <p className="mt-1.5 text-[14px] text-[#6B7280]">
                    {myAnalyses.subtitle}
                  </p>
                </div>
                <Link
                  href="/"
                  className="inline-flex h-[44px] shrink-0 items-center gap-2 rounded-full bg-[#7C3AED] px-5 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9]"
                >
                  <PencilLine size={15} />
                  {results.nav.newAnalysis}
                </Link>
              </div>

              <Suspense fallback={<AnalysesLoadingCard myAnalyses={myAnalyses} />}>
                <DesktopAnalysesContent
                  myAnalyses={myAnalyses}
                  results={results}
                  newAnalysisLabel={results.nav.newAnalysis}
                />
              </Suspense>
            </div>
          </section>
        </div>

        {/* MOBILE */}
        <div className="block lg:hidden">
          <div className="mx-auto w-full max-w-[430px] pb-[100px]">
            <div className="flex items-center justify-center gap-2.5 px-5 pt-9 pb-3">
              <Image
                src="/logo.png"
                alt="Climpy"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
                priority
              />
              <span className="text-[14px] font-bold tracking-[0.16em] text-[#111827]">
                CLIMPY
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 px-5 pb-5">
              <Link
                href="/"
                className="inline-flex h-9 items-center justify-center rounded-full bg-[#7C3AED] px-4 text-[13px] font-semibold text-white"
              >
                {results.nav.newAnalysis}
              </Link>
              <SidebarSignOutButton />
            </div>

            <div className="px-5">
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111827]">
                {myAnalyses.heading}
              </h1>
              <p className="mt-1 text-[13px] text-[#6B7280]">
                {myAnalyses.subtitle}
              </p>
            </div>

            <div className="mt-6 px-5">
              <Suspense fallback={<AnalysesLoadingCard myAnalyses={myAnalyses} />}>
                <MobileAnalysesContent
                  myAnalyses={myAnalyses}
                  results={results}
                  newAnalysisLabel={results.nav.newAnalysis}
                />
              </Suspense>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-50 h-[76px] border-t border-[#E5E7EB] bg-[#FAFAFA]/95 backdrop-blur-[8px]">
            <div className="mx-auto flex h-full w-full max-w-[430px] items-center justify-between px-5">
              <Link
                href="/"
                className="flex h-[46px] flex-1 items-center justify-center gap-1.5 rounded-[12px] text-[12px] font-semibold text-[#6B7280]"
              >
                <PencilLine size={14} />
                {results.nav.newAnalysisMobileNav}
              </Link>
              <Link
                href="/my-analyses"
                aria-current="page"
                className="mx-1 flex h-[46px] flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-[#F3E8FF] text-[12px] font-semibold text-[#7C3AED]"
              >
                <History size={14} />
                {messages.common.myAnalyses}
              </Link>
              <Link
                href="/#how-it-works"
                className="flex h-[46px] flex-1 items-center justify-center gap-1.5 rounded-[12px] text-[12px] font-semibold text-[#6B7280]"
              >
                <HelpCircle size={14} />
                {messages.landing.nav.howItWorks}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </AnalysesSearchProvider>
  );
}
