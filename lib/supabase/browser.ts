import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicKey } from "../supabase-config";

// Session-aware client for Client Components (sign-in, sign-out, and the
// live auth-state listener in app/session-provider.tsx). Uses the public
// (anon/publishable) key only — never the service-role key from
// lib/supabase.ts.
//
// Falls back to inert placeholder values when NEXT_PUBLIC_SUPABASE_URL /
// NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
// aren't configured yet, so importing this module — every page that
// renders AuthNav does — never crashes the client bundle. Before real
// configuration exists, an actual sign-in attempt fails visibly at the
// browser/network level instead of as a React render crash.
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://supabase-not-configured.invalid",
  getSupabasePublicKey() || "supabase-not-configured"
);
