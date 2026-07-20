import Link from "next/link";
import { getMessages } from "../../../lib/messages";
import { getServerLocale } from "../../../lib/server-locale";

// Renders whenever app/my-analyses/[id]/page.tsx calls notFound() — both
// for an id that never existed and for one owned by another user (RLS
// makes those indistinguishable; see fetch-analysis.ts). Resolves the same
// real locale app/my-analyses/page.tsx does, via the same climpy-locale
// cookie — see lib/server-locale.ts.
export default async function AnalysisNotFound() {
  const locale = await getServerLocale();
  const messages = getMessages(locale);
  const openMessages = messages.myAnalyses.open;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-6 text-[#111827]">
      <div className="w-full max-w-[420px] rounded-[22px] border border-[#E5E7EB] bg-white p-8 text-center">
        <h1 className="text-[18px] font-semibold text-[#111827]">
          {openMessages.notFoundHeading}
        </h1>
        <p className="mt-2 text-[13px] text-[#6B7280]">
          {openMessages.notFoundDescription}
        </p>
        <Link
          href="/my-analyses"
          className="mt-6 inline-flex h-[42px] items-center justify-center rounded-[12px] bg-[#7C3AED] px-5 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9]"
        >
          {openMessages.backLink}
        </Link>
      </div>
    </main>
  );
}
