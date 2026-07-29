"use client";

import {
  LAUNCHED_LOCALES,
  LOCALE_LABELS,
  type Locale,
} from "../lib/i18n";
import { useLocale } from "./locale-provider";

const SHORT_LOCALE_LABELS = {
  en: "EN",
  ru: "RU",
} satisfies Record<(typeof LAUNCHED_LOCALES)[number], string>;

export function LanguageSwitcher({
  className = "",
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const {
    locale,
    isLocaleReady,
    setLocale,
  } = useLocale();

  const isDark = variant === "dark";

  return (
    <div
      role="group"
      aria-label="Language"
      aria-busy={!isLocaleReady}
      className={[
        isDark
          ? "inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] p-1"
          : "inline-flex items-center rounded-full border border-[#E5E7EB] bg-white/80 p-1 shadow-sm",
        className,
      ].join(" ")}
    >
      {LAUNCHED_LOCALES.map((option) => {
        const isSelected = locale === option;

        return (
          <button
            key={option}
            type="button"
            disabled={!isLocaleReady}
            aria-label={LOCALE_LABELS[option]}
            aria-pressed={isSelected}
            title={LOCALE_LABELS[option]}
            onClick={() => setLocale(option as Locale)}
            className={[
              "inline-flex h-7 min-w-9 items-center justify-center rounded-full px-2 text-[11px] font-bold transition",
              isSelected
                ? "bg-[#6D28D9] text-white shadow-sm"
                : isDark
                  ? "text-white/50 hover:bg-white/10 hover:text-white"
                  : "text-[#6B7280] hover:bg-[#F3E8FF] hover:text-[#6D28D9]",
              !isLocaleReady
                ? "cursor-not-allowed opacity-50"
                : "",
            ].join(" ")}
          >
            {SHORT_LOCALE_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
