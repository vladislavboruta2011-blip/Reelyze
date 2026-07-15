"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LAUNCHED_LOCALES,
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedLocale = readStoredLocale(
        window.localStorage,
        LAUNCHED_LOCALES
      );
      // A new visitor always starts on DEFAULT_LOCALE, regardless of
      // navigator.language — only an explicit, previously saved choice
      // changes the starting locale.
      const preferredLocale = storedLocale ?? DEFAULT_LOCALE;

      setLocaleState(preferredLocale);
      document.documentElement.lang = preferredLocale;

      if (storedLocale === null) {
        writeStoredLocale(window.localStorage, preferredLocale);
      }

      setIsLocaleReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    document.documentElement.lang = nextLocale;
    writeStoredLocale(window.localStorage, nextLocale);
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
