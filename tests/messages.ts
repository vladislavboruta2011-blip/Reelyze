import assert from "node:assert/strict";

import {
  LAUNCHED_LOCALES,
} from "../lib/i18n";
import {
  getMessages,
  messagesByLocale,
} from "../lib/messages";

assert.deepEqual(
  Object.keys(messagesByLocale),
  [...LAUNCHED_LOCALES]
);

assert.equal(
  getMessages("en").landing.nav.startFree,
  "Start free"
);

assert.equal(
  getMessages("ru").landing.nav.startFree,
  "Попробовать бесплатно"
);

assert.equal(
  getMessages("fr").landing.nav.startFree,
  "Start free"
);

assert.equal(
  getMessages("en").landing.analyzer.scriptOverLimit(1),
  "Your script is 1 character over the current limit. Shorten it to enable Analyze Script."
);

assert.equal(
  getMessages("en").landing.analyzer.scriptOverLimit(2),
  "Your script is 2 characters over the current limit. Shorten it to enable Analyze Script."
);

assert.match(
  getMessages("ru").landing.analyzer.scriptOverLimit(1),
  /1 символ\./
);

assert.match(
  getMessages("ru").landing.analyzer.scriptOverLimit(2),
  /2 символа\./
);

assert.match(
  getMessages("ru").landing.analyzer.scriptOverLimit(5),
  /5 символов\./
);

assert.match(
  getMessages("ru").landing.analyzer.scriptOverLimit(11),
  /11 символов\./
);

assert.match(
  getMessages("ru").landing.analyzer.scriptOverLimit(21),
  /21 символ\./
);

assert.match(
  getMessages("ru").landing.analyzer.scriptOverLimit(22),
  /22 символа\./
);

// Locale-mismatch notice shown on /results when the saved analysis's
// locale differs from the current UI locale.
assert.equal(
  getMessages("en").results.localeMismatch.message,
  "This analysis was generated in Russian. Run a new analysis to receive AI explanations in English."
);

assert.equal(
  getMessages("ru").results.localeMismatch.message,
  "Этот анализ был создан на английском. Запустите новый анализ, чтобы получить объяснения ИИ на русском."
);

// The three /api/analyze-v2 client-side error strings shown to the user.
// The unexpectedResponse diagnostic hardening only adds *logging* around
// this branch — the shown, localized text itself must not change.
assert.equal(
  getMessages("en").landing.errors.invalidResponse,
  "The analysis returned an invalid response. Please try again."
);
assert.equal(
  getMessages("ru").landing.errors.invalidResponse,
  "Сервис вернул некорректный ответ. Попробуйте ещё раз."
);

assert.equal(
  getMessages("en").landing.errors.unexpectedResponse,
  "The analysis returned an unexpected response. Please try again."
);
assert.equal(
  getMessages("ru").landing.errors.unexpectedResponse,
  "Сервис вернул неожиданный ответ. Попробуйте ещё раз."
);

assert.equal(
  getMessages("en").landing.errors.analysisFailed,
  "Analysis failed. Please try again."
);
assert.equal(
  getMessages("ru").landing.errors.analysisFailed,
  "Не удалось выполнить анализ. Попробуйте ещё раз."
);

console.log("localized message tests: all passed");
