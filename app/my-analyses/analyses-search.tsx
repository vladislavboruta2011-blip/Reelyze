"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { FileText, Search, X } from "lucide-react";
import type { Messages } from "../../lib/messages";
import { LOCALE_LABELS, type Locale } from "../../lib/i18n";
import {
  formatAnalysisCreatedAt,
  type MyAnalysesListItem,
} from "./analyses-list";
import {
  RiskIndicator,
  ScoreRing,
  ScoreUnavailableBadge,
  riskTier,
} from "./score-visuals";
import { AnalysisActionsMenu } from "./analysis-actions-menu";

// The desktop table and mobile card list (app/my-analyses/page.tsx's
// former AnalysesTable/AnalysisMobileCard) live here now, alongside the
// search state that drives which of their rows are shown — they're never
// rendered with the unfiltered list anymore, so this is their one caller.

// This whole module is a Client Component tree, rendered from the Server
// Component page.tsx. React Server Components can only pass plain
// serializable values as props across that boundary — never functions
// (see e.g. myAnalyses.delete.dialogDescriptionWithTitle, a template
// function used elsewhere via the useMessages hook, never as a prop here). These
// narrowed types document exactly which plain-string subtrees this module
// reads. TypeScript's structural typing won't stop page.tsx from passing
// the full Messages["myAnalyses"]/Messages["results"] objects here instead
// (both contain function-valued keys elsewhere) — Pick<> only narrows the
// type, not the runtime object — so page.tsx must actually construct a
// plain object with just these keys before passing it down, not just
// annotate a wider one.
export type SearchMyAnalyses = Pick<Messages["myAnalyses"], "table" | "list" | "search" | "filters" | "pagination">;
export type SearchResults = Pick<Messages["results"], "scoreCards" | "scoreLabels">;

function localeLabel(locale: string): string {
  return locale in LOCALE_LABELS
    ? LOCALE_LABELS[locale as Locale]
    : locale.toUpperCase();
}

function ScriptCell({
  item,
  myAnalyses,
}: {
  item: MyAnalysesListItem;
  myAnalyses: SearchMyAnalyses;
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
          <span className="text-[11px] text-[#6B7280] lg:hidden">
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
        "inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-3 text-[11px] font-semibold text-[#7C3AED] transition hover:bg-[#EDE9FE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]",
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
  myAnalyses: SearchMyAnalyses;
  results: SearchResults;
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
                  <AnalysisActionsMenu id={item.id} title={item.title} />
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
  myAnalyses: SearchMyAnalyses;
  results: SearchResults;
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
            <span className="text-[11px] text-[#6B7280]">
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
              <ScoreUnavailableBadge label={myAnalyses.list.scoreUnavailable} />
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
          <AnalysisActionsMenu id={item.id} title={item.title} />
        </div>
      </div>
    </li>
  );
}

// --- Search + Filters + Pagination state ---------------------------------
//
// One Context instance, provided once by AnalysesSearchProvider around
// both the desktop and mobile trees in page.tsx (they're both always
// mounted, only CSS-hidden per breakpoint — see page.tsx's own comment).
// AnalysesSearchBar/AnalysesFilterBar and the two results components below
// are each rendered once per breakpoint but all read/write the same
// `query`/`riskFilter`/`page` values, so typing, picking a filter, or
// paging in either breakpoint stays in sync with the other without lifting
// state into page.tsx itself (a Server Component, which can't hold state)
// or reaching for URL search params/a server round-trip for a list this
// small (see app/my-analyses/analyses-list.ts's fixed 200-row cap). Search
// and the risk filter are deliberately independent fields on this one
// shared context, not a second provider — the search "Clear" only resets
// `query`, and picking "All" only resets `riskFilter`; there is no combined
// reset in v1. `page` resets to 1 whenever `query` or `riskFilter` changes
// (below) — but never on its own from Rename/Delete, which only refetch
// `items` via router.refresh() without touching `query`/`riskFilter`; the
// separate render-time clamp in useSearchedAndFilteredAnalyses is what
// keeps `page` in range when that refetch (or a Rename that changes search
// membership) shrinks the composed result out from under the current page.
export type RiskFilterValue = "all" | "high" | "medium" | "low";

type SearchContextValue = {
  query: string;
  setQuery: (query: string) => void;
  riskFilter: RiskFilterValue;
  setRiskFilter: (riskFilter: RiskFilterValue) => void;
  page: number;
  setPage: (page: number) => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

function useSearchContext(): SearchContextValue {
  const context = useContext(SearchContext);

  if (!context) {
    throw new Error(
      "useSearchContext must be used within AnalysesSearchProvider",
    );
  }

  return context;
}

export function AnalysesSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilterValue>("all");
  const [page, setPage] = useState(1);
  // Tracks the (query, riskFilter) pair `page` was last reset for. Adjusted
  // during render (React's documented pattern for resetting state when an
  // input changes — see "You might not need an Effect"), not in a
  // useEffect: an effect here would commit the stale page for one extra
  // render before resetting it, and calling setState synchronously inside
  // an effect is exactly what react-hooks/set-state-in-effect exists to
  // catch. The condition is self-correcting (false again immediately after
  // the reset), so this can't loop.
  const [lastResetFor, setLastResetFor] = useState({ query, riskFilter });

  if (lastResetFor.query !== query || lastResetFor.riskFilter !== riskFilter) {
    setLastResetFor({ query, riskFilter });
    setPage(1);
  }

  return (
    <SearchContext.Provider
      value={{ query, setQuery, riskFilter, setRiskFilter, page, setPage }}
    >
      {children}
    </SearchContext.Provider>
  );
}

// Case-insensitive substring match on title only — the only field this
// feature searches (see app/my-analyses/analyses-list.ts: no other column
// is even fetched). A blank/whitespace-only query is treated as "no
// filter", returning every item unchanged.
export function filterAnalysesByTitle(
  items: MyAnalysesListItem[],
  query: string,
): MyAnalysesListItem[] {
  const trimmedQuery = query.trim().toLowerCase();

  if (trimmedQuery.length === 0) {
    return items;
  }

  return items.filter((item) =>
    item.title.toLowerCase().includes(trimmedQuery),
  );
}

// Reuses score-visuals.tsx's riskTier (same >=65/>=45 thresholds already
// shown by each row's own RiskIndicator dot) rather than duplicating them.
// "all" is a no-op. A null `scores` (the "Unavailable" badge case) never
// gets an invented tier — those rows are excluded from every specific
// High/Medium/Low selection, and only ever visible under "all".
export function filterAnalysesByRisk(
  items: MyAnalysesListItem[],
  riskFilter: RiskFilterValue,
): MyAnalysesListItem[] {
  if (riskFilter === "all") {
    return items;
  }

  return items.filter(
    (item) =>
      item.scores !== null &&
      riskTier(item.scores.retentionRisk) === riskFilter,
  );
}

// --- Pagination -----------------------------------------------------------
//
// Client-side only, over whatever page.tsx already fetched (see
// app/my-analyses/analyses-list.ts's fixed 200-row cap) — no `.range()`,
// no count query, no new Supabase request. Pure and dependency-free (no
// React/context), so it's testable on its own without a component tree.
export const PAGE_SIZE = 10;

export function getTotalPages(itemCount: number): number {
  return Math.max(1, Math.ceil(itemCount / PAGE_SIZE));
}

export function paginateAnalyses(
  items: MyAnalysesListItem[],
  page: number,
): MyAnalysesListItem[] {
  const startIndex = (page - 1) * PAGE_SIZE;
  return items.slice(startIndex, startIndex + PAGE_SIZE);
}

// Applies Search, then the Risk filter, then Pagination, always in that
// exact order — pagination must operate on the complete combined
// Search+Filter result, never on the raw list. Both
// AnalysesSearchDesktopResults and AnalysesSearchMobileResults call this
// identical hook with the identical `items` prop from page.tsx, the same
// way they already independently call filterAnalysesByTitle/
// filterAnalysesByRisk above — not new duplication, the same established
// per-breakpoint pattern.
//
// The clamp below MUST run inside a useEffect, not directly in this
// function's body. `page`/`setPage` are owned by AnalysesSearchProvider's
// own useState (see its `lastResetFor` comment for the *same-component*
// case, where a render-time adjustment is correct) — but this hook runs
// inside a *different* component (whichever of
// AnalysesSearchDesktopResults/AnalysesSearchMobileResults called it).
// Calling `setPage` synchronously during that child's render would be
// React's "Cannot update a component while rendering a different
// component" case, not the safe "adjust your own state during render"
// case: React can only safely discard-and-immediately-rerender the
// *currently rendering* component's own output, not retroactively patch a
// different component's (the Provider's) state mid-render. A useEffect
// runs after render commits, which is the correct place to synchronize a
// value owned by another component/context. `pageItems` below still reads
// `Math.min(page, totalPages)` rather than raw `page`, so this same render
// already shows the right slice even before the effect flushes the
// persisted `page` value for the Previous/Next boundary buttons.
function useSearchedAndFilteredAnalyses(items: MyAnalysesListItem[]): {
  pageItems: MyAnalysesListItem[];
  totalPages: number;
} {
  const { query, riskFilter, page, setPage } = useSearchContext();
  const combinedItems = filterAnalysesByRisk(
    filterAnalysesByTitle(items, query),
    riskFilter,
  );
  const totalPages = getTotalPages(combinedItems.length);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages, setPage]);

  return {
    pageItems: paginateAnalyses(combinedItems, Math.min(page, totalPages)),
    totalPages,
  };
}

// Real <button>s (native `disabled`, not just a visual style) inside a
// labelled <nav> landmark — an accessible pagination region, not just a
// styled div. The "Page X of Y" text is built here, in the Client
// Component, from three plain strings (pageLabel/ofLabel) plus the
// component's own numeric `page`/`totalPages` state — deliberately never a
// message *function* (see SearchMyAnalyses's comment on why a resolved
// function crossing the Server/Client boundary is the one thing to avoid
// here). aria-live="polite" announces the page change without stealing
// focus from the button that was just clicked. Hidden entirely (not
// rendered disabled) when the composed result fits on a single page.
function PaginationControls({
  myAnalyses,
  totalPages,
}: {
  myAnalyses: SearchMyAnalyses;
  totalPages: number;
}) {
  const { page, setPage } = useSearchContext();
  const paginationMessages = myAnalyses.pagination;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label={paginationMessages.ariaLabel}
      className="mt-4 flex items-center justify-center gap-4"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
        className="inline-flex h-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 text-[13px] font-medium text-[#6B7280] transition hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-[#6B7280]"
      >
        {paginationMessages.previousLabel}
      </button>
      <span
        aria-live="polite"
        className="text-[13px] font-medium text-[#6B7280]"
      >
        {paginationMessages.pageLabel} {page} {paginationMessages.ofLabel}{" "}
        {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => setPage(page + 1)}
        className="inline-flex h-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 text-[13px] font-medium text-[#6B7280] transition hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-[#6B7280]"
      >
        {paginationMessages.nextLabel}
      </button>
    </nav>
  );
}

export function AnalysesSearchBar({
  myAnalyses,
}: {
  myAnalyses: SearchMyAnalyses;
}) {
  const { query, setQuery } = useSearchContext();
  const searchMessages = myAnalyses.search;
  const inputId = useId();

  return (
    <div className="mb-4 flex h-11 items-center gap-2 rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-4">
      <Search
        size={16}
        className="shrink-0 text-[#6B7280]"
        aria-hidden="true"
      />
      <label htmlFor={inputId} className="sr-only">
        {searchMessages.inputLabel}
      </label>
      <input
        id={inputId}
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchMessages.placeholder}
        className="h-full w-full bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#6B7280] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
      />
      {query.length > 0 && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label={searchMessages.clearLabel}
          className="shrink-0 rounded-full p-1 text-[#6B7280] transition hover:bg-[#F3E8FF] hover:text-[#7C3AED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const RISK_FILTER_OPTIONS: RiskFilterValue[] = ["all", "high", "medium", "low"];

// Compact accessible chip/button group (deliberately not a native select
// element) — mirrors the pill styling already used for the locale badge /
// RiskIndicator dot elsewhere on this page. role="group" + aria-label
// names the whole control; each button reports its own selected state via
// aria-pressed rather than relying on color alone.
// "High"/"Medium"/"Low" reuse the already-launched
// results.scoreLabels.risk translations (the same ones each row's own
// RiskIndicator already renders) instead of new duplicate strings — only
// "All" and the no-results copy are new keys (myAnalyses.filters).
export function AnalysesFilterBar({
  myAnalyses,
  results,
}: {
  myAnalyses: SearchMyAnalyses;
  results: SearchResults;
}) {
  const { riskFilter, setRiskFilter } = useSearchContext();
  const filtersMessages = myAnalyses.filters;
  const riskLabels = results.scoreLabels.risk;

  const labelFor = (value: RiskFilterValue): string => {
    switch (value) {
      case "all":
        return filtersMessages.all;
      case "high":
        return riskLabels.high;
      case "medium":
        return riskLabels.medium;
      case "low":
        return riskLabels.low;
    }
  };

  return (
    <div
      role="group"
      aria-label={filtersMessages.groupLabel}
      className="mb-4 flex flex-wrap items-center gap-2"
    >
      {RISK_FILTER_OPTIONS.map((value) => {
        const isActive = riskFilter === value;

        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            onClick={() => setRiskFilter(value)}
            className={
              isActive
                ? "inline-flex h-9 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-4 text-[13px] font-semibold text-[#7C3AED] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
                : "inline-flex h-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 text-[13px] font-medium text-[#6B7280] transition hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
            }
          >
            {labelFor(value)}
          </button>
        );
      })}
    </div>
  );
}

// Covers three reachable no-results cases (the fourth — no query and no
// filter — can't reach here, since the caller only renders this once the
// unfiltered items list is already non-empty): search text alone keeps the
// exact pre-Filters copy/behavior (quoted query + "Clear search"); the risk
// filter alone, or both together, use the new myAnalyses.filters copy. The
// "Clear search" button only ever clears the query — resetting the risk
// filter is done via the still-visible "All" chip in AnalysesFilterBar
// above, matching the independent-reset requirement (no combined "Clear
// all" control in v1).
function NoResults({
  myAnalyses,
}: {
  myAnalyses: SearchMyAnalyses;
}) {
  const { query, setQuery, riskFilter } = useSearchContext();
  const searchMessages = myAnalyses.search;
  const filtersMessages = myAnalyses.filters;
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const hasRiskFilter = riskFilter !== "all";

  const heading = !hasRiskFilter
    ? searchMessages.noResultsHeading
    : hasQuery
      ? filtersMessages.noResultsCombinedHeading
      : filtersMessages.noResultsHeading;

  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF]">
        <Search size={20} className="text-[#7C3AED]" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-[18px] font-semibold text-[#111827]">
        {heading}
      </h2>
      <p className="mx-auto mt-2 max-w-[360px] text-[14px] leading-[1.6] text-[#6B7280]">
        {!hasRiskFilter ? (
          <>
            {searchMessages.noResultsDescriptionPrefix}
            {trimmedQuery}
            {searchMessages.noResultsDescriptionSuffix}
          </>
        ) : hasQuery ? (
          filtersMessages.noResultsCombinedDescription
        ) : (
          filtersMessages.noResultsDescription
        )}
      </p>
      {hasQuery && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="mt-6 inline-flex h-[44px] items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white px-6 text-[14px] font-semibold text-[#6B7280] transition hover:text-[#111827]"
        >
          {searchMessages.clearLabel}
        </button>
      )}
    </div>
  );
}

export function AnalysesSearchDesktopResults({
  items,
  myAnalyses,
  results,
}: {
  items: MyAnalysesListItem[];
  myAnalyses: SearchMyAnalyses;
  results: SearchResults;
}) {
  const { pageItems, totalPages } = useSearchedAndFilteredAnalyses(items);

  return pageItems.length === 0 ? (
    <NoResults myAnalyses={myAnalyses} />
  ) : (
    <>
      <AnalysesTable
        items={pageItems}
        myAnalyses={myAnalyses}
        results={results}
      />
      <PaginationControls myAnalyses={myAnalyses} totalPages={totalPages} />
    </>
  );
}

export function AnalysesSearchMobileResults({
  items,
  myAnalyses,
  results,
}: {
  items: MyAnalysesListItem[];
  myAnalyses: SearchMyAnalyses;
  results: SearchResults;
}) {
  const { pageItems, totalPages } = useSearchedAndFilteredAnalyses(items);

  return pageItems.length === 0 ? (
    <NoResults myAnalyses={myAnalyses} />
  ) : (
    <>
      <ul className="flex flex-col gap-3">
        {pageItems.map((item) => (
          <AnalysisMobileCard
            key={item.id}
            item={item}
            myAnalyses={myAnalyses}
            results={results}
          />
        ))}
      </ul>
      <PaginationControls myAnalyses={myAnalyses} totalPages={totalPages} />
    </>
  );
}
