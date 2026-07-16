import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicKey } from "../supabase-config";

// Thrown instead of letting supabase-js fail with an opaque internal
// error when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) aren't configured yet (e.g.
// before the Supabase dashboard setup for Google OAuth is done). Every
// caller must decide what "no session available" means for its own route
// rather than crashing — see app/layout.tsx, app/my-analyses/page.tsx, and
// app/auth/callback/route.ts.
export class MissingSupabaseConfigError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) must be configured."
    );
    this.name = "MissingSupabaseConfigError";
  }
}

// Session-aware, RLS-enforced client for Server Components and Route
// Handlers. Uses the anon key plus the caller's own cookies — this is
// deliberately separate from lib/supabase.ts's service-role client, which
// bypasses RLS and must never be used for anything done "as the user."
//
// A new instance is created per call (never a module-level singleton): it
// closes over this request's cookie jar, which is only valid for the
// lifetime of that request.
export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = getSupabasePublicKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new MissingSupabaseConfigError();
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Thrown when called during a Server Component render pass,
          // where cookies() is read-only. Safe to ignore here — proxy.ts
          // refreshes the session cookie on every request instead.
        }
      },
    },
  });
}
