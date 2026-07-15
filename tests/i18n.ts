import assert from "node:assert/strict";

import {
  DEFAULT_LOCALE,
  LAUNCHED_LOCALES,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  detectPreferredLocale,
  isLocale,
  normalizeApiLocale,
  normalizeLocale,
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

console.log("i18n foundation tests: all passed");
