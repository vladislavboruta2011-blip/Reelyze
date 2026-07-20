"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
  LAUNCHED_LOCALES,
  buildLocaleCookieString,
  planLocaleCookieSync,
  readLocaleCookieValue,
  readStoredLocale,
  writeStoredLocale,
  type Locale,
} from "../lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  isLocaleReady: boolean;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isLocaleReady, setIsLocaleReady] = useState(false);
  const router = useRouter();

  // Guards the one-time migration refresh below to at-most-once per mount,
  // independent of (and in addition to) this effect's own empty
  // dependency array already only running once. See the effect's own
  // comment for why a second refresh can never actually fire even without
  // this ref — this just makes that invariant explicit and directly
  // verifiable rather than only implied by the deps array.
  const hasSyncedLocaleCookieRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedLocale = readStoredLocale(
        window.localStorage,
        LAUNCHED_LOCALES
      );
      const currentCookieRawValue = readLocaleCookieValue(document.cookie);
      // A new visitor always starts on DEFAULT_LOCALE, regardless of
      // navigator.language — only an explicit, previously saved choice
      // changes the starting locale. planLocaleCookieSync (lib/i18n.ts)
      // encodes that same rule plus the cookie-sync/refresh decision as a
      // pure, independently-tested function — see its own tests for the
      // full matrix (new visitor, returning visitor already synced,
      // existing localStorage-only visitor migrating for the first time).
      const plan = planLocaleCookieSync(
        storedLocale,
        currentCookieRawValue,
        LAUNCHED_LOCALES
      );

      setLocaleState(plan.locale);
      document.documentElement.lang = plan.locale;

      if (storedLocale === null) {
        writeStoredLocale(window.localStorage, plan.locale);
      }

      // Always (re)written, unconditionally — idempotent when it already
      // matches, and what actually keeps localStorage and the cookie in
      // sync on every load, not just the first one.
      document.cookie = buildLocaleCookieString(plan.cookieValueToWrite);

      // The one-time migration case: an existing user whose locale
      // preference currently lives only in localStorage (from before this
      // cookie existed, or after clearing cookies but not localStorage).
      // The page was already server-rendered — using either no cookie or a
      // stale one — before this effect ever ran, so only a refresh fixes
      // *this* load's already-sent markup; every later load already
      // carries the correct cookie via the request itself, needing no
      // refresh at all. router.refresh() re-renders Server Components in
      // place — it does not remount this provider or re-run this
      // mount-only effect, so there is no path back into this branch
      // afterward, and the ref guard below makes that independently true
      // even if that ever changed.
      if (!hasSyncedLocaleCookieRef.current) {
        hasSyncedLocaleCookieRef.current = true;

        if (plan.shouldRefresh) {
          router.refresh();
        }
      }

      setIsLocaleReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
    // router is included per exhaustive-deps; Next.js's App Router
    // guarantees a stable router instance across renders (it is not
    // recreated on navigation or refresh), so this does not cause the
    // effect to re-run — it remains mount-only in practice, matching the
    // empty-array behavior this effect had before router.refresh() was
    // added.
  }, [router]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    document.documentElement.lang = nextLocale;
    writeStoredLocale(window.localStorage, nextLocale);
    // Keeps the cookie synchronized with every explicit choice too — no
    // refresh needed here: the next navigation's own request (including a
    // client-side RSC fetch) already carries this updated cookie, so the
    // next Server Component render picks it up naturally. A refresh is
    // only ever needed for the one already-rendered page from the mount
    // effect above.
    document.cookie = buildLocaleCookieString(nextLocale);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      isLocaleReady,
      setLocale,
    }),
    [isLocaleReady, locale, setLocale]
  );

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);

  if (context === null) {
    throw new Error("useLocale must be used within LocaleProvider");
  }

  return context;
}
