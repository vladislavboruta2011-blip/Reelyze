"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { ReactNode } from "react";

type Accent = "purple" | "blue";

const ACCENT_STYLES: Record<
  Accent,
  {
    border: string;
    surface: string;
    iconWrap: string;
    iconGlow: string;
    subtitle: string;
    checkWrap: string;
    check: string;
    button: string;
  }
> = {
  purple: {
    border: "border-[#DDD6FE]",
    surface: "bg-[#FAF7FF]",
    iconWrap: "border-[#DDD6FE] bg-[#F3E8FF] text-[#7C3AED]",
    iconGlow: "",
    subtitle: "text-[#7C3AED]",
    checkWrap: "bg-[#F3E8FF] text-[#7C3AED]",
    check: "text-[#7C3AED]",
    button:
      "bg-gradient-to-r from-[#6D28D9] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#8B5CF6] focus-visible:outline-[#7C3AED]",
  },
  blue: {
    border: "border-[#BFDBFE]",
    surface: "bg-[#EFF6FF]",
    iconWrap: "border-[#BFDBFE] bg-[#DBEAFE] text-[#2563EB]",
    iconGlow: "",
    subtitle: "text-[#2563EB]",
    checkWrap: "bg-[#DBEAFE] text-[#2563EB]",
    check: "text-[#2563EB]",
    button:
      "bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#3B82F6] hover:to-[#60A5FA] focus-visible:outline-[#2563EB]",
  },
};

// When `href` is omitted, the CTA is a real, enabled <button> with no
// href — clicking it can never 404, it can only ever reveal this inline,
// localized "coming next" status (role="status"/aria-live="polite" since
// it's informational, not an error). Nothing here calls an API. When
// `href` is provided, it must point at a real, already-implemented route
// (never a placeholder) — the button becomes a real navigation link
// instead, since there's now something real to go to.
export function ModeCard({
  accent,
  icon,
  title,
  accentSubtitle,
  description,
  benefits,
  actionLabel,
  comingNextMessage,
  href,
}: {
  accent: Accent;
  icon: ReactNode;
  title: string;
  accentSubtitle: string;
  description: string;
  benefits: readonly string[];
  actionLabel: string;
  comingNextMessage: string;
  href?: string;
}) {
  const [showComingNext, setShowComingNext] = useState(false);
  const styles = ACCENT_STYLES[accent];

  return (
    <div
      className={`flex h-full flex-col rounded-[28px] border-2 ${styles.border} ${styles.surface} p-6 lg:p-7`}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border ${styles.iconWrap} ${styles.iconGlow}`}
        >
          {icon}
        </div>
        <h2 className="mt-4 text-[21px] font-semibold text-[#111827]">
          {title}
        </h2>
        <p className={`mt-1 text-[13px] font-medium ${styles.subtitle}`}>
          {accentSubtitle}
        </p>
        <p className="mt-3 max-w-[400px] text-[14px] leading-[1.6] text-[#6B7280]">
          {description}
        </p>
      </div>

      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {benefits.map((benefit) => (
          <li
            key={benefit}
            className="flex items-start gap-3 text-[14px] leading-[1.5] text-[#374151]"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${styles.checkWrap}`}
            >
              <Check size={12} aria-hidden="true" />
            </span>
            {benefit}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-2">
        {href ? (
          <Link
            href={href}
            className={`inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] px-6 text-[15px] font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${styles.button}`}
          >
            {actionLabel}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setShowComingNext(true)}
            className={`inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] px-6 text-[15px] font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${styles.button}`}
          >
            {actionLabel}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        )}
        {!href && showComingNext && (
          <p
            role="status"
            aria-live="polite"
            className="text-center text-[12px] text-[#6B7280]"
          >
            {comingNextMessage}
          </p>
        )}
      </div>
    </div>
  );
}
