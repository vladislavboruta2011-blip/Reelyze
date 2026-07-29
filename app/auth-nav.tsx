"use client";

import { History } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "../lib/supabase/browser";
import { SignInModal } from "./sign-in-modal";
import { useSession } from "./session-provider";
import { useMessages } from "./use-messages";

type AuthNavVariant = "default" | "results" | "dark";

export function AuthNav({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: AuthNavVariant;
}) {
  const messages = useMessages();
  const pathname = usePathname();
  const { user } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);

    await supabaseBrowser.auth.signOut();

    setIsSigningOut(false);
  }

  if (!user) {
    // Signed-out behavior is identical across variants — only the
    // authenticated account actions below change shape on /results, and the
    // "dark" variant only ever changes surface colors (for the black-
    // background marketing Hero), never structure/behavior.
    return (
      <>
        <button
          type="button"
          onClick={() => setIsSignInModalOpen(true)}
          className={[
            variant === "dark"
              ? "inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-[13px] font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
              : "inline-flex h-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] transition hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/10",
            className,
          ].join(" ")}
        >
          {messages.common.signIn}
        </button>
        <SignInModal
          isOpen={isSignInModalOpen}
          onClose={() => setIsSignInModalOpen(false)}
          nextPath={pathname}
        />
      </>
    );
  }

  if (variant === "results") {
    // /results keeps the sidebar to a single account action so it doesn't
    // compete with the analysis content — Sign out is still reachable from
    // My Analyses (and everywhere else AuthNav renders with the default
    // variant), so no functionality is lost, only this page's visual
    // weight.
    //
    // Reopen/rerun/rename/delete and search/sort for saved analyses belong
    // on the My Analyses page itself in a later PR — this link is the only
    // account action needed here.
    return (
      <Link
        href="/my-analyses"
        className={[
          "flex h-[46px] w-full items-center gap-3 rounded-[12px] border border-[#DDD6FE]/70 bg-[#F3E8FF]/60 px-4 text-[14px] font-semibold text-[#7C3AED] transition hover:border-[#DDD6FE] hover:bg-[#F3E8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]",
          className,
        ].join(" ")}
      >
        <History size={16} aria-hidden="true" />
        {messages.common.myAnalyses}
      </Link>
    );
  }

  const isDark = variant === "dark";

  return (
    <div className={["flex items-center gap-2", className].join(" ")}>
      <Link
        href="/my-analyses"
        className={
          isDark
            ? "inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-[13px] font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
            : "inline-flex h-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#111827] transition hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/10"
        }
      >
        {messages.common.myAnalyses}
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className={
          isDark
            ? "inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-[13px] font-semibold text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            : "inline-flex h-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#6B7280] transition hover:border-white/20 hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {messages.common.signOut}
      </button>
    </div>
  );
}
