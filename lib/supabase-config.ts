// Both NEXT_PUBLIC_SUPABASE_ANON_KEY (this project's original naming, and
// still what the installed @supabase/ssr version's own createServerClient/
// createBrowserClient JSDoc calls it) and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// (the name shown in newer Supabase dashboards, for projects issued the
// newer non-JWT-format public key) are accepted — whichever the owner
// actually sets when configuring the project. Used by every place that
// builds a Supabase client with the public key: proxy.ts,
// lib/supabase/server.ts, and lib/supabase/browser.ts.
export function getSupabasePublicKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
