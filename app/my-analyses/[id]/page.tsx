import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getMessages } from "../../../lib/messages";
import { DEFAULT_LOCALE } from "../../../lib/i18n";
import {
  fetchAnalysisById,
  isValidAnalysisId,
  type AnalysisByIdClient,
} from "./fetch-analysis";
import { OpenAnalysisHandoff } from "./open-analysis-handoff";

// Always re-checks ownership and freshness on navigation — matching
// app/my-analyses/page.tsx's own force-dynamic rationale (no stale cached
// render of another user's — or a since-deleted — analysis).
export const dynamic = "force-dynamic";

// Never throws: missing Supabase config or a failed session check are both
// treated as "not signed in", matching app/my-analyses/page.tsx exactly.
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

function OpenAnalysisErrorState({
  heading,
  description,
}: {
  heading: string;
  description: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-6 text-[#111827]">
      <div
        role="alert"
        className="w-full max-w-[420px] rounded-[22px] border border-[#7C3AED]/30 bg-[#F3E8FF] p-8 text-center"
      >
        <p className="text-[15px] font-semibold text-[#7C3AED]">{heading}</p>
        <p className="mt-2 text-[13px] text-[#6B7280]">{description}</p>
      </div>
    </main>
  );
}

export default async function OpenSavedAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUserOrNull();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/my-analyses/${id}`)}`);
  }

  // Never a real row id — treated as not-found without a database
  // round-trip, and without depending on how Postgres reports an invalid
  // uuid literal (see fetch-analysis.ts for the full rationale).
  if (!isValidAnalysisId(id)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  // supabase-js's real query-builder type is generic enough that checking
  // it directly against AnalysisByIdClient's narrow structural type (with
  // an .eq() filter in the chain) makes tsc give up with "Type
  // instantiation is excessively deep" — a compiler limitation, not a real
  // mismatch (the client genuinely has from/select/eq/maybeSingle). The
  // other narrow client types in this codebase (AnalysesListClient,
  // AnalysesInsertClient) avoid .eq() and don't hit this.
  const result = await fetchAnalysisById(
    supabase as unknown as AnalysisByIdClient,
    id
  );

  if (result.status === "not-found") {
    // Also covers "belongs to another user" — RLS's analyses_select_own
    // policy makes that row invisible to this query, identical to it never
    // having existed. Deliberately never distinguished from a real
    // not-found: doing so would leak which ids belong to someone else.
    notFound();
  }

  // Locale isn't yet threaded through server-rendered routes
  // (LocaleProvider is a client-only, localStorage-backed context) —
  // matching app/my-analyses/page.tsx's own default-locale limitation.
  const messages = getMessages(DEFAULT_LOCALE);
  const openMessages = messages.myAnalyses.open;

  if (result.status === "database-error" || result.status === "invalid") {
    return (
      <OpenAnalysisErrorState
        heading={openMessages.errorHeading}
        description={openMessages.errorDescription}
      />
    );
  }

  return <OpenAnalysisHandoff analysis={result.analysis} />;
}
