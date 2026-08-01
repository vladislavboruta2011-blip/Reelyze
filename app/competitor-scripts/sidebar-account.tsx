"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import { SignInModal } from "../sign-in-modal";
import { useSession } from "../session-provider";
import { useMessages } from "../use-messages";

// A compact profile row for the dark Competitor Scripts sidebar/mobile
// header. Deliberately built from real session fields only (email/name/
// avatarUrl from SessionUser) — never a fabricated identity — and reuses
// the same supabaseBrowser sign-out call AuthNav already uses, so signing
// out here has identical behavior to every other AuthNav instance.
export function SidebarAccount({ compact = false }: { compact?: boolean }) {
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
    return (
      <>
        <button
          type="button"
          onClick={() => setIsSignInModalOpen(true)}
          className="flex h-[44px] w-full items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#111827] transition hover:border-[#DDD6FE] hover:bg-[#F3E8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
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

  const displayName = user.name ?? user.email ?? "";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={
        compact
          ? "flex items-center gap-2.5"
          : "flex items-center gap-3 rounded-[14px] border border-[#E5E7EB] bg-[#F8F8FC] p-3"
      }
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[13px] font-semibold text-[#7C3AED]"
          aria-hidden="true"
        >
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[#111827]">
          {displayName || messages.common.signIn}
        </p>
        {user.email && user.name && (
          <p className="truncate text-[11px] text-[#6B7280]">
            {user.email}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        aria-label={messages.common.signOut}
        title={messages.common.signOut}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
      >
        <LogOut size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
