import assert from "node:assert/strict";

import {
  DEFAULT_LOCALE,
  LAUNCHED_LOCALES,
  LOCALE_COOKIE_NAME,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  buildLocaleCookieString,
  detectPreferredLocale,
  isLocale,
  normalizeApiLocale,
  normalizeLocale,
  planLocaleCookieSync,
  readLocaleCookieValue,
  readStoredLocale,
  writeStoredLocale,
} from "../lib/i18n";

assert.deepEqual(SUPPORTED_LOCALES, [
  "en",
  "ru",
  "es",
  "pt-BR",
  "fr",
]);

assert.deepEqual(LAUNCHED_LOCALES, [
  "en",
  "ru",
]);

assert.equal(DEFAULT_LOCALE, "en");
assert.equal(LOCALE_LABELS["pt-BR"], "Português (Brasil)");

assert.equal(isLocale("en"), true);
assert.equal(isLocale("pt-BR"), true);
assert.equal(isLocale("de"), false);
assert.equal(isLocale(null), false);

assert.equal(normalizeLocale("en-US"), "en");
assert.equal(normalizeLocale("RU_ru"), "ru");
assert.equal(normalizeLocale("es-MX"), "es");
assert.equal(normalizeLocale("pt_BR"), "pt-BR");
assert.equal(normalizeLocale("pt-PT"), "pt-BR");
assert.equal(normalizeLocale("fr-CA"), "fr");
assert.equal(normalizeLocale("de-DE"), null);
assert.equal(normalizeLocale(""), null);
assert.equal(normalizeLocale(undefined), null);

assert.equal(
  detectPreferredLocale(["de-DE", "fr-FR", "en-US"]),
  "fr"
);
assert.equal(
  detectPreferredLocale(["uk-UA", "ru-UA"]),
  "ru"
);
assert.equal(
  detectPreferredLocale(["de-DE", "uk-UA"]),
  "en"
);
assert.equal(detectPreferredLocale([]), "en");
assert.equal(
  detectPreferredLocale(
    ["es-MX", "fr-FR"],
    LAUNCHED_LOCALES
  ),
  "en"
);
assert.equal(
  detectPreferredLocale(
    ["fr-FR", "ru-UA"],
    LAUNCHED_LOCALES
  ),
  "ru"
);

let storedValue: string | null = "es-MX";

const readableStorage = {
  getItem(key: string) {
    assert.equal(key, LOCALE_STORAGE_KEY);
    return storedValue;
  },
};

assert.equal(readStoredLocale(readableStorage), "es");
assert.equal(
  readStoredLocale(
    readableStorage,
    LAUNCHED_LOCALES
  ),
  null
);

const writableStorage = {
  setItem(key: string, value: string) {
    assert.equal(key, LOCALE_STORAGE_KEY);
    storedValue = value;
  },
};

assert.equal(writeStoredLocale(writableStorage, "fr"), true);
assert.equal(storedValue, "fr");

const unavailableReadableStorage = {
  getItem() {
    throw new Error("Storage unavailable");
  },
};

const unavailableWritableStorage = {
  setItem() {
    throw new Error("Storage unavailable");
  },
};

assert.equal(readStoredLocale(unavailableReadableStorage), null);
assert.equal(
  writeStoredLocale(unavailableWritableStorage, "ru"),
  false
);

// normalizeApiLocale — strict server-side validation, no browser-string parsing.
assert.equal(normalizeApiLocale("ru"), "ru");
assert.equal(normalizeApiLocale("en"), "en");
assert.equal(normalizeApiLocale(undefined), DEFAULT_LOCALE);
assert.equal(normalizeApiLocale(null), DEFAULT_LOCALE);
assert.equal(normalizeApiLocale(""), DEFAULT_LOCALE);
assert.equal(normalizeApiLocale("ru-RU"), DEFAULT_LOCALE);
assert.equal(normalizeApiLocale("RU"), DEFAULT_LOCALE);
assert.equal(normalizeApiLocale("fr"), DEFAULT_LOCALE);
assert.equal(normalizeApiLocale("es"), DEFAULT_LOCALE);
assert.equal(normalizeApiLocale(123), DEFAULT_LOCALE);
assert.equal(normalizeApiLocale({ locale: "ru" }), DEFAULT_LOCALE);
assert.equal(
  normalizeApiLocale("fr", SUPPORTED_LOCALES),
  "fr"
);

// --- Locale cookie (server-readable signal) ---------------------------

assert.equal(LOCALE_COOKIE_NAME, "climpy-locale");

// readLocaleCookieValue — parses a raw `document.cookie` string, never
// touches `document` itself (takes the string as a parameter), matching
// readStoredLocale's own injected-storage testability pattern above.
assert.equal(readLocaleCookieValue("climpy-locale=ru"), "ru");
assert.equal(
  readLocaleCookieValue("other=1; climpy-locale=en; another=2"),
  "en"
);
assert.equal(readLocaleCookieValue(""), null);
assert.equal(readLocaleCookieValue("other=1; another=2"), null);
// A stray "=" inside an unrelated cookie's value must never be mistaken
// for this cookie — only an exact name match before "=" counts.
assert.equal(
  readLocaleCookieValue("not-climpy-locale=ru; other=a=b"),
  null
);
assert.equal(
  readLocaleCookieValue("climpy-locale=ru%2Dvalue"),
  "ru-value"
);

// buildLocaleCookieString — the exact string LocaleProvider assigns to
// `document.cookie`. Path=/ and a ~1 year max-age are load-bearing (every
// route must see it, and it must outlive a typical session).
assert.match(
  buildLocaleCookieString("ru"),
  /^climpy-locale=ru; path=\/; max-age=31536000; SameSite=Lax$/
);
assert.match(buildLocaleCookieString("en"), /^climpy-locale=en;/);

// planLocaleCookieSync — the pure decision function LocaleProvider's mount
// effect delegates to. Covers: a brand-new visitor, a returning visitor
// already fully synced, and the one-time existing-user migration case
// (localStorage has a preference, no cookie yet) — including proving a
// second application with the now-synced cookie never asks for another
// refresh, which is the crux of "no refresh loop."

// Brand-new visitor: no stored preference, no cookie. Resolves to
// DEFAULT_LOCALE, and since the server would have defaulted to the exact
// same locale for a missing cookie, no refresh is needed.
assert.deepEqual(planLocaleCookieSync(null, null), {
  locale: "en",
  cookieValueToWrite: "en",
  shouldRefresh: false,
});

// Existing user: "ru" already in localStorage, but no cookie yet (the
// exact migration case this feature exists to handle) — the page was just
// server-rendered assuming DEFAULT_LOCALE, so this needs a refresh.
assert.deepEqual(planLocaleCookieSync("ru", null), {
  locale: "ru",
  cookieValueToWrite: "ru",
  shouldRefresh: true,
});

// Returning user, already fully synced on a previous visit: localStorage
// and the cookie already agree — no refresh needed.
assert.deepEqual(planLocaleCookieSync("ru", "ru"), {
  locale: "ru",
  cookieValueToWrite: "ru",
  shouldRefresh: false,
});

// An invalid/garbage cookie value is treated exactly like a missing one
// (normalizeApiLocale's own fallback rule, reused here rather than
// duplicated) — still triggers exactly one refresh to correct it.
assert.deepEqual(planLocaleCookieSync("ru", "not-a-real-locale"), {
  locale: "ru",
  cookieValueToWrite: "ru",
  shouldRefresh: true,
});

// No-loop proof: feed the *previous* call's own cookieValueToWrite back in
// as the next call's currentCookieRawValue (exactly what LocaleProvider's
// unconditional `document.cookie = buildLocaleCookieString(...)` write
// guarantees is true on any subsequent read) — shouldRefresh must flip to
// false, so a second, third, ... application of this same function can
// never ask for another refresh once the first one already ran.
const firstSync = planLocaleCookieSync("ru", null);
assert.equal(firstSync.shouldRefresh, true);
const secondSync = planLocaleCookieSync(
  "ru",
  firstSync.cookieValueToWrite
);
assert.equal(secondSync.shouldRefresh, false);

// An explicit EN preference with no cookie never needs a refresh either —
// DEFAULT_LOCALE is what the server already rendered for a missing
// cookie, so this is already consistent.
assert.deepEqual(planLocaleCookieSync("en", null), {
  locale: "en",
  cookieValueToWrite: "en",
  shouldRefresh: false,
});

console.log("i18n foundation tests: all passed");
