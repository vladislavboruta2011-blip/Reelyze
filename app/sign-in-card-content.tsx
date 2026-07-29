"use client";

import Image from "next/image";
import { useGoogleSignIn } from "./use-google-sign-in";
import { useMessages } from "./use-messages";

// Google's official unmodified multi-color "G" mark. Brand guidelines allow
// reusing this exact glyph on a "Continue/Sign in with Google" button as
// long as it isn't recolored or distorted — this path data is the standard
// four-color G used across countless compliant sign-in buttons.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C40.5 36.6 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

export function SignInCardContent({
  nextPath,
  errorMessage,
  headingId,
  variant = "light",
}: {
  nextPath: string | null | undefined;
  errorMessage?: string | null;
  headingId?: string;
  variant?: "light" | "dark";
}) {
  const messages = useMessages();
  const { startSignIn, isSigningIn } = useGoogleSignIn();
  const isDark = variant === "dark";

  return (
    <div className="text-center">
      <Image
        src="/logo.png"
        alt="Climpy"
        width={40}
        height={40}
        className="mx-auto h-10 w-10 object-contain"
        priority
      />

      <h2
        id={headingId}
        className={
          isDark
            ? "mt-5 text-[22px] font-semibold tracking-[-0.02em] text-[#F5F5F7]"
            : "mt-5 text-[22px] font-semibold tracking-[-0.02em] text-[#111827]"
        }
      >
        {messages.auth.login.heading}
      </h2>
      <p
        className={
          isDark
            ? "mt-2 text-[14px] leading-[1.6] text-[#9CA3AF]"
            : "mt-2 text-[14px] leading-[1.6] text-[#6B7280]"
        }
      >
        {messages.auth.login.description}
      </p>

      {errorMessage && (
        <p
          className={
            isDark
              ? "mt-4 rounded-[12px] border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-4 py-3 text-[13px] text-[#C4B5FD]"
              : "mt-4 rounded-[12px] border border-[#7C3AED]/30 bg-[#F3E8FF] px-4 py-3 text-[13px] text-[#7C3AED]"
          }
        >
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={() => startSignIn(nextPath)}
        disabled={isSigningIn}
        className="mt-6 inline-flex h-[48px] w-full items-center justify-center gap-3 rounded-[12px] bg-[#6D28D9] px-6 text-[15px] font-semibold text-white shadow-[0_0_32px_rgba(109,40,217,0.25)] transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4B5FD]"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
          <GoogleIcon />
        </span>
        {messages.auth.login.continueWithGoogle}
      </button>

      <p className="mt-4 text-[12px] leading-[1.5] text-[#9CA3AF]">
        {messages.auth.login.privacyNote}
      </p>
    </div>
  );
}
