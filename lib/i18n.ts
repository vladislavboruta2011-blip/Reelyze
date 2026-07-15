export const SUPPORTED_LOCALES = [
  "en",
  "ru",
  "es",
  "pt-BR",
  "fr",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LAUNCHED_LOCALES = [
  "en",
  "ru",
] as const satisfies readonly Locale[];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "climpy-locale";

export const LOCALE_LABELS = {
  en: "English",
  ru: "Русский",
  es: "Español",
  "pt-BR": "Português (Brasil)",
  fr: "Français",
} satisfies Record<Locale, string>;

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    SUPPORTED_LOCALES.some((locale) => locale === value)
  );
}

export function normalizeLocale(
  value: string | null | undefined
): Locale | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/_/g, "-")
    .toLowerCase();

  if (normalized.length === 0) {
    return null;
  }

  const language = normalized.split("-")[0];

  switch (language) {
    case "en":
      return "en";
    case "ru":
      return "ru";
    case "es":
      return "es";
    case "pt":
      return "pt-BR";
    case "fr":
      return "fr";
    default:
      return null;
  }
}

export function detectPreferredLocale(
  browserLanguages: readonly string[],
  availableLocales: readonly Locale[] = SUPPORTED_LOCALES
): Locale {
  for (const language of browserLanguages) {
    const locale = normalizeLocale(language);

    if (
      locale &&
      availableLocales.some(
        (availableLocale) => availableLocale === locale
      )
    ) {
      return locale;
    }
  }

  if (
    availableLocales.some(
      (availableLocale) => availableLocale === DEFAULT_LOCALE
    )
  ) {
    return DEFAULT_LOCALE;
  }

  return availableLocales[0] ?? DEFAULT_LOCALE;
}

// Strict server-side check: only an exact LAUNCHED_LOCALES value is trusted.
// Unlike normalizeLocale (which fuzzy-parses browser-language strings like
// "en-US"), this never guesses from an arbitrary client-supplied string —
// anything else falls back to DEFAULT_LOCALE.
export function normalizeApiLocale(
  value: unknown,
  availableLocales: readonly Locale[] = LAUNCHED_LOCALES
): Locale {
  if (
    typeof value === "string" &&
    availableLocales.some((availableLocale) => availableLocale === value)
  ) {
    return value as Locale;
  }

  return DEFAULT_LOCALE;
}

export function readStoredLocale(
  storage: Pick<Storage, "getItem">,
  availableLocales: readonly Locale[] = SUPPORTED_LOCALES
): Locale | null {
  try {
    const locale = normalizeLocale(
      storage.getItem(LOCALE_STORAGE_KEY)
    );

    if (
      locale &&
      availableLocales.some(
        (availableLocale) => availableLocale === locale
      )
    ) {
      return locale;
    }

    return null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(
  storage: Pick<Storage, "setItem">,
  locale: Locale
): boolean {
  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}
