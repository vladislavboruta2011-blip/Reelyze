import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getMessages } from "../../lib/messages";
import { DEFAULT_LOCALE } from "../../lib/i18n";

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

// Placeholder only — the real history list, reopen/rename/delete actions,
// and the analyses table itself land in a later PR. This page exists so
// the nav's "My analyses" link (shown once a user is signed in) has a
// safe, auth-gated destination instead of a 404.
export default async function MyAnalysesPage() {
  const user = await getCurrentUserOrNull();

  if (!user) {
    redirect("/login?next=/my-analyses");
  }

  // Locale isn't yet threaded through server-rendered routes (LocaleProvider
  // is a client-only, localStorage-backed context) — this placeholder uses
  // the default locale until that's wired up alongside the real page.
  const messages = getMessages(DEFAULT_LOCALE);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-6 text-center text-[#111827]">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
        {messages.myAnalyses.heading}
      </h1>
      <p className="mt-3 max-w-[420px] text-[14px] leading-[1.6] text-[#6B7280]">
        {messages.myAnalyses.comingSoon}
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-[44px] items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white px-6 text-[14px] font-semibold text-[#111827] transition hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/10"
      >
        {messages.auth.login.backToHome}
      </Link>
    </main>
  );
}
