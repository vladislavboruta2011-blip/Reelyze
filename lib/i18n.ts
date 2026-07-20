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

// --- Locale cookie (server-readable signal) --------------------------------
//
// localStorage remains the source of truth for the user's explicit choice —
// this cookie exists only so a Server Component (which can never read
// localStorage) can resolve the same locale on the same request, closing
// the gap documented on app/my-analyses/page.tsx and its siblings. Kept
// deliberately small: a name, a raw-string reader, a cookie-string builder,
// and normalizeApiLocale (above) for validation — no new locale system, no
// second source of truth. The functions below are pure (take/return plain
// values, never touch `document`/`cookies()` themselves) so the actual
// browser/server I/O — and the one-time-refresh decision it feeds — stays
// small, isolated, and directly testable without a DOM or a request.
export const LOCALE_COOKIE_NAME = "climpy-locale";

// One year — matches how a saved localStorage choice is effectively
// permanent already; the cookie should persist at least as long.
const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Parses a raw `document.cookie` string (";"-joined "name=value" pairs) and
// returns this cookie's own decoded value, or null if absent. Takes the
// already-read string as a parameter (never reads `document` itself) so
// this is testable with a plain string literal, matching
// readStoredLocale's/writeStoredLocale's own injected-storage pattern.
export function readLocaleCookieValue(
  documentCookieString: string
): string | null {
  for (const entry of documentCookieString.split(";")) {
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const name = entry.slice(0, separatorIndex).trim();

    if (name !== LOCALE_COOKIE_NAME) {
      continue;
    }

    try {
      return decodeURIComponent(entry.slice(separatorIndex + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

// Builds the literal string to assign to `document.cookie`. Path=/ so
// every route (including app/my-analyses/[id]/*) sees it; SameSite=Lax is
// the same-site-navigation-safe default and needs no Secure flag
// consideration here since this carries no sensitive data.
export function buildLocaleCookieString(locale: Locale): string {
  return `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export type LocaleCookieSyncPlan = {
  // The locale this client has now resolved (from localStorage, or
  // DEFAULT_LOCALE for a brand-new visitor) — what LocaleProvider's own
  // state and <html lang> should be set to.
  locale: Locale;
  // Always write the cookie to this value — keeps it synchronized with
  // localStorage on every mount, unconditionally and idempotently (writing
  // the same value again is a harmless no-op).
  cookieValueToWrite: Locale;
  // True only when the cookie's previous value didn't already match
  // `locale` — i.e. the page that was just server-rendered (using either a
  // missing cookie, defaulting to DEFAULT_LOCALE, or a stale one) doesn't
  // match this client's real locale, so only a refresh will fix the
  // already-sent markup for *this* load. False in the steady state (new
  // visitor whose cookie legitimately doesn't exist yet but who also has
  // no stored preference yet, or a returning visitor whose cookie already
  // agrees with localStorage) — never true on a second call with the
  // now-synced cookie as input, which is what makes the at-most-once
  // guard in LocaleProvider provably correct rather than just assumed.
  shouldRefresh: boolean;
};

// Pure decision function — no DOM, no router, no timers — so the
// synchronization logic itself (not just its wiring inside a React effect)
// is directly unit-testable. `currentCookieRawValue` is whatever
// readLocaleCookieValue(document.cookie) returned (or null) *before* this
// sync writes anything.
export function planLocaleCookieSync(
  storedLocale: Locale | null,
  currentCookieRawValue: string | null,
  availableLocales: readonly Locale[] = LAUNCHED_LOCALES
): LocaleCookieSyncPlan {
  const locale = storedLocale ?? DEFAULT_LOCALE;
  // normalizeApiLocale never returns null — a missing cookie and a cookie
  // that already happens to equal DEFAULT_LOCALE are treated identically
  // here, which is correct: the server-side resolver (lib/server-locale.ts)
  // falls back to that exact same DEFAULT_LOCALE for a missing cookie, so
  // this always reflects what the server actually just rendered with.
  const previousCookieLocale = normalizeApiLocale(
    currentCookieRawValue,
    availableLocales
  );

  return {
    locale,
    cookieValueToWrite: locale,
    shouldRefresh: previousCookieLocale !== locale,
  };
}
