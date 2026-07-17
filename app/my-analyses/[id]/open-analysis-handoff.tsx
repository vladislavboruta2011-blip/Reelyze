"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ANALYSIS_V2_STORAGE_KEY } from "../../../engine/analysis-v2-ui-adapter";
import type { AnalysisV2SuccessResponse } from "../../../engine/analysis-v2-schema";
import { writeReopenedAnalysisId } from "../../results/reopened-analysis";
import { useMessages } from "../../use-messages";
import type { SavedAnalysis } from "./fetch-analysis";

// Writes the exact same three sessionStorage keys a fresh analysis writes
// (reelyze-script / reelyze-title / the analysis-v2 result), then hands off
// to /results — the same page, same code path, same "no AI call" guarantee
// it already has. Nothing here runs a new analysis, calls OpenAI, or
// recomputes anything: analysis.result is the row's own result_json,
// already validated server-side in fetch-analysis.ts.
export function OpenAnalysisHandoff({
  analysis,
}: {
  analysis: SavedAnalysis;
}) {
  const router = useRouter();
  const messages = useMessages();
  const openMessages = messages.myAnalyses.open;

  useEffect(() => {
    try {
      const response: AnalysisV2SuccessResponse = {
        status: "ok",
        result: analysis.result,
        modelUsed: analysis.modelUsed,
        locale: analysis.locale,
      };

      sessionStorage.setItem("reelyze-script", analysis.script);
      sessionStorage.setItem("reelyze-title", analysis.title);
      sessionStorage.setItem(
        ANALYSIS_V2_STORAGE_KEY,
        JSON.stringify(response)
      );

      writeReopenedAnalysisId(analysis.id);
    } catch {
      // sessionStorage unavailable — /results will fall back to its own
      // "could not load" state instead of showing this saved analysis.
    }

    router.replace("/results");
  }, [analysis, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-6 text-[#111827]">
      <div className="w-full max-w-[420px] rounded-[22px] border border-[#E5E7EB] bg-white p-8 text-center">
        <p className="text-[16px] font-semibold text-[#111827]">
          {openMessages.loadingHeading}
        </p>
        <p className="mt-2 text-[13px] text-[#6B7280]">
          {openMessages.loadingDescription}
        </p>
      </div>
    </main>
  );
}
