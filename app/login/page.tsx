"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignInCardContent } from "../sign-in-card-content";
import { useMessages } from "../use-messages";

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-6 text-[#111827]">
      <div className="w-full max-w-[440px] rounded-[28px] border border-[#DDD6FE] bg-white p-8 shadow-[0_24px_80px_rgba(17,24,39,0.06)]">
        <SignInCardContent
          nextPath={searchParams.get("next")}
          errorMessage={errorMessage}
        />

        <Link
          href="/"
          className="mt-5 block text-center text-[13px] font-medium text-[#6B7280] transition hover:text-[#111827]"
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
        <main className="min-h-screen bg-[#FAFAFA]" />
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
