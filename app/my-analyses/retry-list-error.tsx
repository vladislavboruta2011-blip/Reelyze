"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

// Only a plain string crosses this Server/Client boundary — never the
// wider myAnalyses.error message subtree (which also holds
// heading/description, read directly by the Server Component ErrorState
// that renders alongside this button; see analyses-content.tsx).
//
// useTransition (not a local isLoading useState) is what makes the native
// `disabled` attribute below track the real pending router.refresh() —
// startTransition's isPending flips back to false only once the refreshed
// Server Component tree has actually committed, so a second click during
// that window is natively blocked rather than queuing a redundant refresh.
export function RetryListErrorButton({ label }: { label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
      className="mt-6 inline-flex h-[44px] items-center justify-center rounded-[10px] border border-[#7C3AED]/30 bg-white px-5 text-[13px] font-semibold text-[#7C3AED] transition hover:bg-[#F3E8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}
