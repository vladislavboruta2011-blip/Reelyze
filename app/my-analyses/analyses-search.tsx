"use client";

import {
  createContext,
  useContext,
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
export type SearchMyAnalyses = Pick<Messages["myAnalyses"], "table" | "list" | "search" | "filters">;
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

// --- Search + Filters state ---------------------------------------------
//
// One Context instance, provided once by AnalysesSearchProvider around
// both the desktop and mobile trees in page.tsx (they're both always
// mounted, only CSS-hidden per breakpoint — see page.tsx's own comment).
// AnalysesSearchBar/AnalysesFilterBar and the two results components below
// are each rendered once per breakpoint but all read/write the same
// `query`/`riskFilter` values, so typing or picking a filter in either
// breakpoint stays in sync with the other without lifting state into
// page.tsx itself (a Server Component, which can't hold state) or reaching
// for URL search params/a server round-trip for a list this small (see
// app/my-analyses/analyses-list.ts's fixed 50-row cap). Search and the risk
// filter are deliberately independent fields on this one shared context,
// not a second provider — the search "Clear" only resets `query`, and
// picking "All" only resets `riskFilter`; there is no combined reset in v1.
export type RiskFilterValue = "all" | "high" | "medium" | "low";

type SearchContextValue = {
  query: string;
  setQuery: (query: string) => void;
  riskFilter: RiskFilterValue;
  setRiskFilter: (riskFilter: RiskFilterValue) => void;
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

  return (
    <SearchContext.Provider
      value={{ query, setQuery, riskFilter, setRiskFilter }}
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
        className="h-full w-full bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#9CA3AF]"
      />
      {query.length > 0 && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label={searchMessages.clearLabel}
          className="shrink-0 rounded-full p-1 text-[#9CA3AF] transition hover:bg-[#F3E8FF] hover:text-[#7C3AED]"
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
                ? "inline-flex h-9 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-4 text-[13px] font-semibold text-[#7C3AED] transition"
                : "inline-flex h-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 text-[13px] font-medium text-[#6B7280] transition hover:text-[#111827]"
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
  const { query, riskFilter } = useSearchContext();
  const filteredItems = filterAnalysesByRisk(
    filterAnalysesByTitle(items, query),
    riskFilter,
  );

  return filteredItems.length === 0 ? (
    <NoResults myAnalyses={myAnalyses} />
  ) : (
    <AnalysesTable
      items={filteredItems}
      myAnalyses={myAnalyses}
      results={results}
    />
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
  const { query, riskFilter } = useSearchContext();
  const filteredItems = filterAnalysesByRisk(
    filterAnalysesByTitle(items, query),
    riskFilter,
  );

  return filteredItems.length === 0 ? (
    <NoResults myAnalyses={myAnalyses} />
  ) : (
    <ul className="flex flex-col gap-3">
      {filteredItems.map((item) => (
        <AnalysisMobileCard
          key={item.id}
          item={item}
          myAnalyses={myAnalyses}
          results={results}
        />
      ))}
    </ul>
  );
}
