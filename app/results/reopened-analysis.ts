// Reopened-saved-analysis marker ------------------------------------------
//
// Written once by app/my-analyses/[id]'s client handoff component,
// immediately before it writes the same three sessionStorage keys a fresh
// analysis writes (reelyze-script / reelyze-title / the analysis-v2 result)
// and hands off to /results. This is the only signal /results has that the
// analysis it is about to render already has a database row — without it,
// /results would show its normal "idle" Save Analysis button and clicking
// it would insert a second, duplicate row for content that is already
// saved.
//
// Deliberately kept out of app/results/save-analysis.ts: this file only
// ever influences the *initial* saveState /results reads on mount — it
// does not change validateAnalysisForSave, insertAnalysis, or any other
// part of the actual save flow, which remain exactly as they were before
// the "open saved analysis" feature existed.
export const REOPENED_ANALYSIS_ID_STORAGE_KEY =
  "climpy-reopened-analysis-id";

// Consumed at most once: read and immediately cleared, so a later fresh
// analysis in the same tab (sessionStorage persists per-tab, not per-page)
// can never be mistaken for a reopened one.
export function readAndClearReopenedAnalysisId(): string | null {
  try {
    const value = sessionStorage.getItem(
      REOPENED_ANALYSIS_ID_STORAGE_KEY
    );

    sessionStorage.removeItem(REOPENED_ANALYSIS_ID_STORAGE_KEY);

    return value && value.trim().length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeReopenedAnalysisId(id: string): void {
  try {
    sessionStorage.setItem(REOPENED_ANALYSIS_ID_STORAGE_KEY, id);
  } catch {
    // sessionStorage unavailable — /results simply won't know this was
    // reopened and will show its normal idle Save button. Functionally
    // safe either way: worst case is an avoidable extra row, not a crash.
  }
}
