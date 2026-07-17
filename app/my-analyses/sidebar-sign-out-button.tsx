"use client";

import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import { useMessages } from "../use-messages";

// Same sign-out mechanism as app/auth-nav.tsx's handleSignOut — duplicated
// here (not imported/reused from AuthNav) rather than adding a new AuthNav
// variant, so this dashboard redesign never touches the existing,
// already-covered authentication component.
export function SidebarSignOutButton({
  className = "",
}: {
  className?: string;
}) {
  const messages = useMessages();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);

    await supabaseBrowser.auth.signOut();

    setIsSigningOut(false);
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className={[
        "inline-flex h-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#6B7280] transition hover:border-white/20 hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {messages.common.signOut}
    </button>
  );
}
