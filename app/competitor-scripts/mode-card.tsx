"use client";

import { useState } from "react";
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
    border: "border-[#7C3AED]/40",
    surface: "bg-gradient-to-b from-[#7C3AED]/[0.08] to-transparent",
    iconWrap: "border-[#7C3AED]/40 bg-[#7C3AED]/15 text-[#C4B5FD]",
    iconGlow: "shadow-[0_0_50px_rgba(124,58,237,0.35)]",
    subtitle: "text-[#C4B5FD]",
    checkWrap: "bg-[#7C3AED]/15 text-[#A78BFA]",
    check: "text-[#A78BFA]",
    button:
      "bg-gradient-to-r from-[#6D28D9] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#8B5CF6] focus-visible:outline-[#C4B5FD]",
  },
  blue: {
    border: "border-[#3B82F6]/40",
    surface: "bg-gradient-to-b from-[#3B82F6]/[0.08] to-transparent",
    iconWrap: "border-[#3B82F6]/40 bg-[#3B82F6]/15 text-[#93C5FD]",
    iconGlow: "shadow-[0_0_50px_rgba(59,130,246,0.35)]",
    subtitle: "text-[#93C5FD]",
    checkWrap: "bg-[#3B82F6]/15 text-[#60A5FA]",
    check: "text-[#60A5FA]",
    button:
      "bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#3B82F6] hover:to-[#60A5FA] focus-visible:outline-[#93C5FD]",
  },
};

// The CTA is a real, enabled <button> with no href — clicking it can never
// 404, it can only ever reveal this inline, localized "coming next" status
// (role="status"/aria-live="polite" since it's informational, not an
// error). Nothing here calls an API or navigates anywhere.
export function ModeCard({
  accent,
  icon,
  title,
  accentSubtitle,
  description,
  benefits,
  actionLabel,
  comingNextMessage,
}: {
  accent: Accent;
  icon: ReactNode;
  title: string;
  accentSubtitle: string;
  description: string;
  benefits: readonly string[];
  actionLabel: string;
  comingNextMessage: string;
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
        <h2 className="mt-4 text-[21px] font-semibold text-[#F5F5F7]">
          {title}
        </h2>
        <p className={`mt-1 text-[13px] font-medium ${styles.subtitle}`}>
          {accentSubtitle}
        </p>
        <p className="mt-3 max-w-[400px] text-[14px] leading-[1.6] text-[#9CA3AF]">
          {description}
        </p>
      </div>

      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {benefits.map((benefit) => (
          <li
            key={benefit}
            className="flex items-start gap-3 text-[14px] leading-[1.5] text-[#D1D5DB]"
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
        <button
          type="button"
          onClick={() => setShowComingNext(true)}
          className={`inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] px-6 text-[15px] font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${styles.button}`}
        >
          {actionLabel}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
        {showComingNext && (
          <p
            role="status"
            aria-live="polite"
            className="text-center text-[12px] text-[#9CA3AF]"
          >
            {comingNextMessage}
          </p>
        )}
      </div>
    </div>
  );
}
