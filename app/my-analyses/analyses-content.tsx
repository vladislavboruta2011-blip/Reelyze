import { cache } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import type { Messages } from "../../lib/messages";
import type { Locale } from "../../lib/i18n";
import { fetchMyAnalyses, type FetchMyAnalysesResult } from "./analyses-list";
import {
  AnalysesSearchBar,
  AnalysesFilterBar,
  AnalysesSearchDesktopResults,
  AnalysesSearchMobileResults,
  type SearchMyAnalyses,
  type SearchResults,
} from "./analyses-search";
import { RetryListErrorButton } from "./retry-list-error";

// The list query itself: page.tsx's chrome (sidebar, mobile nav, page
// heading, "New Analysis" CTA) must stay outside any data-dependent
// Suspense boundary so it renders immediately (see page.tsx's own
// rationale), which means this fetch can no longer be a single top-level
// `await` in page.tsx the way it was before this feature — that would
// block the whole page's first byte on the query again, exactly the gap
// this feature closes. It has to live in a component nested under
// <Suspense> instead.
//
// But page.tsx's desktop and mobile trees are two structurally different,
// always-mounted, CSS-hidden-per-breakpoint siblings (different chrome
// nesting per breakpoint — see page.tsx), not one shared insertion point a
// single component's output could occupy twice. So DesktopAnalysesContent
// and MobileAnalysesContent below are two separate async Server Component
// instances, each under its own <Suspense> boundary in page.tsx. Wrapping
// the fetch in React's cache() is what still guarantees exactly one
// Supabase query per request despite that: cache() memoizes a
// zero-argument async function for the lifetime of a single server
// request, so whichever of the two components renders/suspends first
// actually runs the query, and the other one reuses that same result
// instead of firing a second one. (tests/my-analyses.ts's architecture
// check asserts fetchMyAnalyses is only ever called from this one place,
// via this cache()-wrapped function.)
const getMyAnalysesResult = cache(
  async (): Promise<FetchMyAnalysesResult> => {
    const supabase = await createSupabaseServerClient();
    return fetchMyAnalyses(supabase);
  }
);

function EmptyState({
  myAnalyses,
  newAnalysisLabel,
}: {
  myAnalyses: Pick<Messages["myAnalyses"], "empty">;
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

// Retry is a small Client Component (retry-list-error.tsx) mounted here —
// only its single `label` string prop crosses that boundary, never this
// wider myAnalyses.error subtree (which also holds heading/description,
// read directly here since ErrorState itself is a Server Component).
function ErrorState({ myAnalyses }: { myAnalyses: Pick<Messages["myAnalyses"], "error"> }) {
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
      <RetryListErrorButton label={myAnalyses.error.retryLabel} />
    </div>
  );
}

// Builds the same narrow, function-free message objects page.tsx used to
// build inline before this feature (see analyses-search.tsx's own comment
// on SearchMyAnalyses/SearchResults for why: Client Components can only
// receive plain serializable props, and the wider Messages["myAnalyses"]/
// Messages["results"] objects contain function-valued keys elsewhere).
function toSearchMessages(myAnalyses: Messages["myAnalyses"]): SearchMyAnalyses {
  return {
    table: myAnalyses.table,
    list: myAnalyses.list,
    search: myAnalyses.search,
    filters: myAnalyses.filters,
    pagination: myAnalyses.pagination,
  };
}

function toSearchResults(results: Messages["results"]): SearchResults {
  return {
    scoreCards: results.scoreCards,
    scoreLabels: results.scoreLabels,
  };
}

type AnalysesContentProps = {
  myAnalyses: Messages["myAnalyses"];
  results: Messages["results"];
  newAnalysisLabel: string;
  // The already-resolved interface locale (see page.tsx's own comment on
  // getServerLocale) — a plain string, not a message object, so it's
  // threaded down as its own prop rather than folded into
  // searchMyAnalyses/searchResults. Used only for date formatting
  // (analyses-search.tsx's formatAnalysisCreatedAt call sites); it never
  // changes which messages are shown, only how a date/timestamp renders.
  locale: Locale;
};

export async function DesktopAnalysesContent({
  myAnalyses,
  results,
  newAnalysisLabel,
  locale,
}: AnalysesContentProps) {
  const result = await getMyAnalysesResult();

  if (!result.ok) {
    return <ErrorState myAnalyses={myAnalyses} />;
  }

  if (result.items.length === 0) {
    return (
      <EmptyState myAnalyses={myAnalyses} newAnalysisLabel={newAnalysisLabel} />
    );
  }

  const searchMyAnalyses = toSearchMessages(myAnalyses);
  const searchResults = toSearchResults(results);

  return (
    <>
      <AnalysesSearchBar myAnalyses={searchMyAnalyses} />
      <AnalysesFilterBar myAnalyses={searchMyAnalyses} results={searchResults} />
      <AnalysesSearchDesktopResults
        items={result.items}
        myAnalyses={searchMyAnalyses}
        results={searchResults}
        locale={locale}
      />
    </>
  );
}

export async function MobileAnalysesContent({
  myAnalyses,
  results,
  newAnalysisLabel,
  locale,
}: AnalysesContentProps) {
  const result = await getMyAnalysesResult();

  if (!result.ok) {
    return <ErrorState myAnalyses={myAnalyses} />;
  }

  if (result.items.length === 0) {
    return (
      <EmptyState myAnalyses={myAnalyses} newAnalysisLabel={newAnalysisLabel} />
    );
  }

  const searchMyAnalyses = toSearchMessages(myAnalyses);
  const searchResults = toSearchResults(results);

  return (
    <>
      <AnalysesSearchBar myAnalyses={searchMyAnalyses} />
      <AnalysesFilterBar myAnalyses={searchMyAnalyses} results={searchResults} />
      <AnalysesSearchMobileResults
        items={result.items}
        myAnalyses={searchMyAnalyses}
        results={searchResults}
        locale={locale}
      />
    </>
  );
}
