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

// Results-page Ask Climpy / Improve Script clarification — each tool's
// persistent, pre-click explanation of its own distinct purpose (explain
// vs. rewrite). Existing entry-point/button labels must stay unchanged.
assert.equal(
  getMessages("en").results.askClimpy.entryButton,
  "Ask Climpy"
);
assert.equal(
  getMessages("en").results.askClimpy.entryDescription,
  "Ask questions to better understand your analysis."
);
assert.equal(
  getMessages("ru").results.askClimpy.entryButton,
  "Спросить у Climpy"
);
assert.equal(
  getMessages("ru").results.askClimpy.entryDescription,
  "Задавайте вопросы, чтобы лучше разобраться в результатах анализа."
);

assert.equal(
  getMessages("en").results.suggestedFixes.improveScriptButton,
  "Improve Script"
);
assert.equal(
  getMessages("en").results.suggestedFixes.improveScriptDescription,
  "Rewrite your script using the suggested improvements."
);
assert.equal(
  getMessages("ru").results.suggestedFixes.improveScriptButton,
  "Улучшить сценарий"
);
assert.equal(
  getMessages("ru").results.suggestedFixes.improveScriptDescription,
  "Перепишите сценарий с учётом предложенных улучшений."
);

// The persistent script-limit explanation shown above the analyzer
// textarea — must explain both why the limit exists (Shorts-tuned) and
// what to paste, without duplicating that guidance elsewhere.
assert.equal(
  getMessages("en").landing.analyzer.scriptHelpDesktop,
  "Climpy is tuned for Shorts, so scripts are limited to 1,000 characters. Paste only the words spoken in the video — not the description or a list of ideas."
);
assert.equal(
  getMessages("en").landing.analyzer.scriptHelpMobile,
  "Climpy is tuned for Shorts, so scripts are limited to 1,000 characters. Paste only the words spoken in the video."
);
assert.equal(
  getMessages("ru").landing.analyzer.scriptHelpDesktop,
  "Climpy настроен на анализ Shorts, поэтому сценарий ограничен 1 000 символами. Вставляйте только текст, который будет произнесён в видео — не описание и не список идей."
);
assert.equal(
  getMessages("ru").landing.analyzer.scriptHelpMobile,
  "Climpy настроен на анализ Shorts, поэтому сценарий ограничен 1 000 символами. Вставляйте только текст, который будет произнесён в видео."
);

// The "Try an example" onboarding action and the localized example script
// it inserts into an empty analyzer. This is explicitly a hypothetical,
// illustrative script ("Imagine..." / "Представьте...") — not a claim about
// a real app, company, or outcome, and not tied to any precise statistic
// (dollar figures, timeframes, or "doubled"/"profitable" style claims).
assert.equal(
  getMessages("en").landing.analyzer.tryExampleAction,
  "Try an example"
);
assert.equal(
  getMessages("ru").landing.analyzer.tryExampleAction,
  "Попробовать пример"
);
assert.equal(
  getMessages("en").landing.analyzer.exampleScript,
  "Imagine building an app that keeps getting worse with every update. The team adds more features, but users only become more confused. So they remove the clutter and focus on the one problem people actually need solved. Suddenly, the app becomes faster, simpler, and far easier to use."
);
assert.equal(
  getMessages("ru").landing.analyzer.exampleScript,
  "Представьте приложение, которое становится хуже с каждым обновлением. Команда добавляет всё больше функций, но пользователи лишь сильнее путаются. Тогда разработчики убирают всё лишнее и сосредотачиваются на одной действительно важной проблеме. В итоге приложение становится быстрее, проще и гораздо удобнее."
);
assert.ok(
  getMessages("en").landing.analyzer.exampleScript.length < 1000,
  "EN example script must stay under the 1,000-character analyzer limit"
);
assert.ok(
  getMessages("ru").landing.analyzer.exampleScript.length < 1000,
  "RU example script must stay under the 1,000-character analyzer limit"
);
assert.ok(
  getMessages("en").landing.analyzer.exampleScript.startsWith("Imagine"),
  "The EN example script must be framed explicitly as hypothetical (\"Imagine...\")"
);
assert.ok(
  getMessages("ru").landing.analyzer.exampleScript.startsWith("Представьте"),
  "The RU example script must be framed explicitly as hypothetical (\"Представьте...\")"
);

// Persistent, pre-click clarification near the Analyze button: analyzing
// never requires an account, sign-in is only needed to save results. Fixes
// the first-use clarity gap where this was previously stated only inside a
// collapsed FAQ item.
assert.equal(
  getMessages("en").landing.analyzer.noAccountNeeded,
  "No account needed to analyze. Sign in only if you want to save your results."
);
assert.equal(
  getMessages("ru").landing.analyzer.noAccountNeeded,
  "Для анализа аккаунт не нужен. Войдите только в том случае, если хотите сохранить результаты."
);

// The pre-existing FAQ answers that already touched on account
// requirements must remain accurate and untouched by the new analyzer
// clarification — this is an addition, not a replacement.
assert.equal(
  getMessages("en").landing.faq.questions[0].answer,
  "Yes. Climpy is free to test right now. No signup is needed — just paste your Shorts script and get feedback in about 1 minute."
);
assert.equal(
  getMessages("ru").landing.faq.questions[0].answer,
  "Да. Сейчас Climpy можно протестировать бесплатно. Регистрация не нужна — просто вставьте сценарий Shorts и получите разбор примерно за 1 минуту."
);
assert.equal(
  getMessages("en").landing.faq.questions[5].answer,
  "Your script is only used to generate the analysis. Climpy does not require an account, and your script is not shown publicly."
);
assert.equal(
  getMessages("ru").landing.faq.questions[5].answer,
  "Ваш сценарий используется только для создания анализа. Climpy не требует аккаунта и не публикует ваш сценарий."
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
