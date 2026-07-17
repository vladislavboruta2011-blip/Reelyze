import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getMessages, type Messages } from "../../lib/messages";
import { DEFAULT_LOCALE, LOCALE_LABELS, type Locale } from "../../lib/i18n";
import {
  fetchMyAnalyses,
  formatAnalysisCreatedAt,
  type MyAnalysesListItem,
} from "./analyses-list";

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

function AnalysisListCard({
  item,
  results,
  scoreUnavailableLabel,
}: {
  item: MyAnalysesListItem;
  results: Messages["results"];
  scoreUnavailableLabel: string;
}) {
  return (
    <li className="rounded-[18px] border border-[#E5E7EB] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[#111827]">
          {item.title}
        </h2>
        <span className="rounded-full border border-[#E5E7EB] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">
          {localeLabel(item.locale)}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-[#9CA3AF]">
        {formatAnalysisCreatedAt(item.createdAt)}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[12px] text-[#6B7280]">
        <p>
          {results.scoreCards.overall}:{" "}
          {item.scores ? item.scores.overall : scoreUnavailableLabel}
        </p>
        <p>
          {results.scoreCards.hook}:{" "}
          {item.scores ? item.scores.hook : scoreUnavailableLabel}
        </p>
        <p>
          {results.scoreCards.risk}:{" "}
          {item.scores ? item.scores.retentionRisk : scoreUnavailableLabel}
        </p>
      </div>
    </li>
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

  // Session-bound, RLS-enforced client — the same one used to resolve the
  // user above. Never the service-role client: RLS's
  // analyses_select_own policy (auth.uid() = user_id) is what actually
  // restricts this to the signed-in user's own rows, and no user id is
  // ever passed into the query for that reason.
  const supabase = await createSupabaseServerClient();
  const result = await fetchMyAnalyses(supabase);

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-6 py-12 text-[#111827]">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="mb-8 flex items-start justify-between gap-4">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
            {myAnalyses.heading}
          </h1>
          <Link
            href="/"
            className="inline-flex h-[42px] shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-5 text-[14px] font-semibold text-[#111827] transition hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/10"
          >
            {results.nav.newAnalysis}
          </Link>
        </div>

        {!result.ok && (
          <div className="rounded-[18px] border border-[#7C3AED]/30 bg-[#F3E8FF] p-6 text-center">
            <p className="text-[15px] font-semibold text-[#7C3AED]">
              {myAnalyses.error.heading}
            </p>
            <p className="mt-2 text-[13px] text-[#6B7280]">
              {myAnalyses.error.description}
            </p>
          </div>
        )}

        {result.ok && result.items.length === 0 && (
          <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-8 text-center">
            <p className="text-[18px] font-semibold text-[#111827]">
              {myAnalyses.empty.heading}
            </p>
            <p className="mt-2 text-[14px] leading-[1.6] text-[#6B7280]">
              {myAnalyses.empty.description}
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex h-[44px] items-center justify-center rounded-[12px] bg-[#7C3AED] px-6 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9]"
            >
              {results.nav.newAnalysis}
            </Link>
          </div>
        )}

        {result.ok && result.items.length > 0 && (
          <ul className="flex flex-col gap-3">
            {result.items.map((item) => (
              <AnalysisListCard
                key={item.id}
                item={item}
                results={results}
                scoreUnavailableLabel={myAnalyses.list.scoreUnavailable}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
