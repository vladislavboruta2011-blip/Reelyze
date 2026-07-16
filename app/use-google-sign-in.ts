"use client";

import { useState } from "react";
import { sanitizeNextPath } from "../lib/auth-redirect";
import { supabaseBrowser } from "../lib/supabase/browser";

// The single place that starts the Google OAuth flow — both the sign-in
// modal (app/sign-in-card-content.tsx, opened from app/auth-nav.tsx) and
// the /login page route through this, so there is exactly one call site
// building the callback URL and invoking signInWithOAuth in the whole app.
export function useGoogleSignIn() {
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function startSignIn(
    rawNextPath: string | null | undefined
  ): Promise<void> {
    if (isSigningIn) return;

    setIsSigningIn(true);

    const next = sanitizeNextPath(rawNextPath);
    const callbackUrl = new URL(
      "/auth/callback",
      window.location.origin
    );
    callbackUrl.searchParams.set("next", next);

    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      setIsSigningIn(false);
    }
  }

  return { startSignIn, isSigningIn };
}
