"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LanguageSwitcher } from "../language-switcher";
import { SignInCardContent } from "../sign-in-card-content";
import { useMessages } from "../use-messages";

// Same restrained glow treatment as the landing Hero's own background
// (app/page.tsx's HeroBackground) — same base color and blur values,
// reused inline here rather than factored into a shared component since
// this is the only other place that needs it.
function LoginBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#07070B]" />
      <div className="absolute left-1/2 top-[-260px] h-[620px] w-[900px] -translate-x-1/2 rounded-full bg-[#7C3AED]/25 blur-[160px]" />
      <div className="absolute right-[-220px] top-[60px] h-[520px] w-[560px] rounded-full bg-[#3B82F6]/20 blur-[150px]" />
      <div className="absolute left-[-240px] top-[420px] h-[480px] w-[480px] rounded-full bg-[#6D28D9]/20 blur-[150px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.35]" />
    </div>
  );
}

function LoginPageContent() {
  const messages = useMessages();
  const searchParams = useSearchParams();

  const errorCode = searchParams.get("error");
  const errorMessage =
    errorCode === "missing_code"
      ? messages.auth.login.errorMissingCode
      : errorCode === "auth_failed"
        ? messages.auth.login.errorGeneric
        : null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#07070B] px-6 text-[#F5F5F7]">
      <LoginBackground />

      <LanguageSwitcher
        variant="dark"
        className="absolute right-5 top-5 z-10 sm:right-8 sm:top-8"
      />

      <div className="relative z-10 w-full max-w-[440px] rounded-[28px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <SignInCardContent
          nextPath={searchParams.get("next")}
          errorMessage={errorMessage}
          variant="dark"
        />

        <Link
          href="/"
          className="mt-5 block text-center text-[13px] font-medium text-white/55 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4B5FD]"
        >
          {messages.auth.login.backToHome}
        </Link>
      </div>
    </main>
  );
}

// useSearchParams() requires a Suspense boundary — without one, Next.js
// can't produce a static shell for this route and the production build
// fails at prerender time (a build-time failure, not a type error, so
// tsc alone won't catch it). The fallback matches the real page's
// background to avoid a flash of unstyled content during the brief
// client-side hydration gap.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#07070B]" />
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
