import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, HelpCircle, History, PencilLine } from "lucide-react";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getMessages, type Messages } from "../../lib/messages";
import { DEFAULT_LOCALE, LOCALE_LABELS, type Locale } from "../../lib/i18n";
import { toSessionUser } from "../../lib/session-user";
import {
  fetchMyAnalyses,
  formatAnalysisCreatedAt,
  type MyAnalysesListItem,
} from "./analyses-list";
import {
  RiskIndicator,
  ScoreRing,
  ScoreUnavailableBadge,
} from "./score-visuals";
import { SidebarSignOutButton } from "./sidebar-sign-out-button";
import { DeleteAnalysisButton } from "./delete-analysis-button";

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

function localeLabel(locale: string): string {
  return locale in LOCALE_LABELS
    ? LOCALE_LABELS[locale as Locale]
    : locale.toUpperCase();
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

function ScriptCell({
  item,
  myAnalyses,
}: {
  item: MyAnalysesListItem;
  myAnalyses: Messages["myAnalyses"];
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <FileText
        size={18}
        className="mt-0.5 shrink-0 text-[#7C3AED]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-[#111827]">
          {item.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
            {localeLabel(item.locale)}
          </span>
          <span className="text-[11px] text-[#9CA3AF] lg:hidden">
            {formatAnalysisCreatedAt(item.createdAt)}
          </span>
        </div>
      </div>
      <span className="sr-only">{myAnalyses.table.columnScript}</span>
    </div>
  );
}

function ScoreCell({
  score,
  metricLabel,
  unavailableLabel,
}: {
  score: number | undefined;
  metricLabel: string;
  unavailableLabel: string;
}) {
  return score !== undefined ? (
    <ScoreRing value={score} metricLabel={metricLabel} />
  ) : (
    <ScoreUnavailableBadge label={unavailableLabel} />
  );
}

function OpenAnalysisButton({
  id,
  title,
  label,
  className = "",
}: {
  id: string;
  title: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={`/my-analyses/${id}`}
      aria-label={`${label}: ${title}`}
      className={[
        "inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-3 text-[11px] font-semibold text-[#7C3AED] transition hover:bg-[#EDE9FE]",
        className,
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function AnalysesTable({
  items,
  myAnalyses,
  results,
}: {
  items: MyAnalysesListItem[];
  myAnalyses: Messages["myAnalyses"];
  results: Messages["results"];
}) {
  const columnHeaderClasses =
    "px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]";

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#E5E7EB] bg-white">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#F8F8FC]">
            <th scope="col" className={`${columnHeaderClasses} text-left`}>
              {myAnalyses.table.columnScript}
            </th>
            <th scope="col" className={`${columnHeaderClasses} text-left`}>
              {myAnalyses.table.columnAnalyzed}
            </th>
            <th scope="col" className={`${columnHeaderClasses} text-center`}>
              {myAnalyses.table.columnOverall}
            </th>
            <th scope="col" className={`${columnHeaderClasses} text-center`}>
              {myAnalyses.table.columnHook}
            </th>
            <th scope="col" className={`${columnHeaderClasses} text-left`}>
              {myAnalyses.table.columnRisk}
            </th>
            <th scope="col" className={`${columnHeaderClasses} text-right`}>
              {myAnalyses.table.columnActions}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-[#E5E7EB] last:border-b-0 hover:bg-[#FAFAFA]"
            >
              <th
                scope="row"
                className="max-w-[320px] px-5 py-4 text-left align-middle font-normal"
              >
                <ScriptCell item={item} myAnalyses={myAnalyses} />
              </th>
              <td className="px-5 py-4 align-middle text-[13px] text-[#6B7280]">
                {formatAnalysisCreatedAt(item.createdAt)}
              </td>
              <td className="px-5 py-4 align-middle text-center">
                <div className="flex justify-center">
                  <ScoreCell
                    score={item.scores?.overall}
                    metricLabel={results.scoreCards.overall}
                    unavailableLabel={myAnalyses.list.scoreUnavailable}
                  />
                </div>
              </td>
              <td className="px-5 py-4 align-middle text-center">
                <div className="flex justify-center">
                  <ScoreCell
                    score={item.scores?.hook}
                    metricLabel={results.scoreCards.hook}
                    unavailableLabel={myAnalyses.list.scoreUnavailable}
                  />
                </div>
              </td>
              <td className="px-5 py-4 align-middle">
                {item.scores ? (
                  <RiskIndicator
                    value={item.scores.retentionRisk}
                    scoreLabels={results.scoreLabels.risk}
                  />
                ) : (
                  <ScoreUnavailableBadge
                    label={myAnalyses.list.scoreUnavailable}
                  />
                )}
              </td>
              <td className="px-5 py-4 align-middle text-right">
                <div className="ml-auto flex items-center justify-end gap-2">
                  <OpenAnalysisButton
                    id={item.id}
                    title={item.title}
                    label={myAnalyses.table.open}
                  />
                  <DeleteAnalysisButton id={item.id} title={item.title} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalysisMobileCard({
  item,
  myAnalyses,
  results,
}: {
  item: MyAnalysesListItem;
  myAnalyses: Messages["myAnalyses"];
  results: Messages["results"];
}) {
  return (
    <li className="rounded-[18px] border border-[#E5E7EB] bg-white p-5">
      <div className="flex items-start gap-3">
        <FileText
          size={18}
          className="mt-0.5 shrink-0 text-[#7C3AED]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-[#111827]">
            {item.title}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[#9CA3AF]">
              {formatAnalysisCreatedAt(item.createdAt)}
            </span>
            <span className="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B7280]">
              {localeLabel(item.locale)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <ScoreCell
              score={item.scores?.overall}
              metricLabel={results.scoreCards.overall}
              unavailableLabel={myAnalyses.list.scoreUnavailable}
            />
            <span className="text-[10px] text-[#6B7280]">
              {results.scoreCards.overall}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ScoreCell
              score={item.scores?.hook}
              metricLabel={results.scoreCards.hook}
              unavailableLabel={myAnalyses.list.scoreUnavailable}
            />
            <span className="text-[10px] text-[#6B7280]">
              {results.scoreCards.hook}
            </span>
          </div>
          <div className="flex flex-col items-start gap-1">
            {item.scores ? (
              <RiskIndicator
                value={item.scores.retentionRisk}
                scoreLabels={results.scoreLabels.risk}
              />
            ) : (
              <ScoreUnavailableBadge
                label={myAnalyses.list.scoreUnavailable}
              />
            )}
            <span className="text-[10px] text-[#6B7280]">
              {results.scoreCards.risk}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OpenAnalysisButton
            id={item.id}
            title={item.title}
            label={myAnalyses.table.open}
          />
          <DeleteAnalysisButton id={item.id} title={item.title} />
        </div>
      </div>
    </li>
  );
}

function EmptyState({
  myAnalyses,
  newAnalysisLabel,
}: {
  myAnalyses: Messages["myAnalyses"];
  newAnalysisLabel: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF]">
        <FileText size={20} className="text-[#7C3AED]" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-[18px] font-semibold text-[#111827]">
        {myAnalyses.empty.heading}
      </h2>
      <p className="mx-auto mt-2 max-w-[360px] text-[14px] leading-[1.6] text-[#6B7280]">
        {myAnalyses.empty.description}
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-[44px] items-center justify-center rounded-[12px] bg-[#7C3AED] px-6 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9]"
      >
        {newAnalysisLabel}
      </Link>
    </div>
  );
}

function ErrorState({ myAnalyses }: { myAnalyses: Messages["myAnalyses"] }) {
  return (
    <div
      role="alert"
      className="rounded-[18px] border border-[#7C3AED]/30 bg-[#F3E8FF] p-8 text-center"
    >
      <p className="text-[15px] font-semibold text-[#7C3AED]">
        {myAnalyses.error.heading}
      </p>
      <p className="mx-auto mt-2 max-w-[360px] text-[13px] text-[#6B7280]">
        {myAnalyses.error.description}
      </p>
    </div>
  );
}

// Display-only MVP: no open/delete/rename/rerun, no search/filters/custom
// sorting, no pagination UI — those all land in later PRs.
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

  // Session-bound, RLS-enforced client — the same one used to resolve the
  // user above. Never the service-role client: RLS's
  // analyses_select_own policy (auth.uid() = user_id) is what actually
  // restricts this to the signed-in user's own rows, and no user id is
  // ever passed into the query for that reason.
  const supabase = await createSupabaseServerClient();
  const result = await fetchMyAnalyses(supabase);

  const content = !result.ok ? (
    <ErrorState myAnalyses={myAnalyses} />
  ) : result.items.length === 0 ? (
    <EmptyState
      myAnalyses={myAnalyses}
      newAnalysisLabel={results.nav.newAnalysis}
    />
  ) : null;

  return (
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

            {content}

            {result.ok && result.items.length > 0 && (
              <AnalysesTable
                items={result.items}
                myAnalyses={myAnalyses}
                results={results}
              />
            )}
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
            {content}

            {result.ok && result.items.length > 0 && (
              <ul className="flex flex-col gap-3">
                {result.items.map((item) => (
                  <AnalysisMobileCard
                    key={item.id}
                    item={item}
                    myAnalyses={myAnalyses}
                    results={results}
                  />
                ))}
              </ul>
            )}
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
  );
}
