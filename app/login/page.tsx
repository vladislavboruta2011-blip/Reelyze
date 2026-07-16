"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignInCardContent } from "../sign-in-card-content";
import { useMessages } from "../use-messages";

export default function LoginPage() {
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
