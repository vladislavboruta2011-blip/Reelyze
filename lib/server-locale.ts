import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, normalizeApiLocale, type Locale } from "./i18n";

// The one server-only piece of the locale-cookie feature — isolated into
// its own file specifically so lib/i18n.ts (imported by both Server and
// Client Components, e.g. app/locale-provider.tsx) never has to import
// next/headers itself. normalizeApiLocale (lib/i18n.ts) is what actually
// validates the raw cookie value — an exact LAUNCHED_LOCALES match or
// DEFAULT_LOCALE, same rule a client-supplied API locale already gets, so
// this is the same trust boundary the codebase already established, not a
// new one.
export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();

  return normalizeApiLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}
