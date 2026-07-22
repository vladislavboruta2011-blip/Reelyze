import assert from "node:assert/strict";

import {
  classifyAskClimpyLocalIntent,
  classifyAskClimpyRewriteIntent,
  isAskClimpyErrorReferencePhrase,
  normalizeAskClimpyUtterance,
} from "../app/results/ask-climpy-local-intents";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [
  // ── normalizeAskClimpyUtterance ───────────────────────────────────────
  {
    name: "normalizeAskClimpyUtterance trims, lowercases, drops trailing punctuation, and collapses repeated spaces",
    run: () => {
      assert.equal(normalizeAskClimpyUtterance("  Hi!!  "), "hi");
      assert.equal(normalizeAskClimpyUtterance("OK."), "ok");
      assert.equal(normalizeAskClimpyUtterance("Why?"), "why");
      assert.equal(
        normalizeAskClimpyUtterance("What   can   you    do?"),
        "what can you do"
      );
    },
  },

  // ── classifyAskClimpyLocalIntent: greeting ───────────────────────────
  {
    name: "EN/RU greeting phrases classify as greeting",
    run: () => {
      for (const phrase of ["hi", "hello", "hey", "Hi!", "  HELLO  "]) {
        assert.equal(classifyAskClimpyLocalIntent(phrase), "greeting", phrase);
      }
      for (const phrase of ["привет", "здравствуйте", "добрый день", "Привет!"]) {
        assert.equal(classifyAskClimpyLocalIntent(phrase), "greeting", phrase);
      }
    },
  },

  // ── thanks ────────────────────────────────────────────────────────────
  {
    name: "EN/RU thanks phrases classify as thanks",
    run: () => {
      for (const phrase of ["thanks", "thank you", "got it, thanks", "Thanks!"]) {
        assert.equal(classifyAskClimpyLocalIntent(phrase), "thanks", phrase);
      }
      for (const phrase of ["спасибо", "благодарю", "понятно, спасибо"]) {
        assert.equal(classifyAskClimpyLocalIntent(phrase), "thanks", phrase);
      }
    },
  },

  // ── acknowledgement ───────────────────────────────────────────────────
  {
    name: "EN/RU acknowledgement phrases classify as acknowledgement",
    run: () => {
      for (const phrase of ["okay", "ok", "got it", "understood", "Okay."]) {
        assert.equal(
          classifyAskClimpyLocalIntent(phrase),
          "acknowledgement",
          phrase
        );
      }
      for (const phrase of ["хорошо", "ок", "понятно", "понял"]) {
        assert.equal(
          classifyAskClimpyLocalIntent(phrase),
          "acknowledgement",
          phrase
        );
      }
    },
  },

  // ── farewell ──────────────────────────────────────────────────────────
  {
    name: "EN/RU farewell phrases classify as farewell",
    run: () => {
      for (const phrase of ["bye", "goodbye", "see you", "Bye!"]) {
        assert.equal(classifyAskClimpyLocalIntent(phrase), "farewell", phrase);
      }
      for (const phrase of ["пока", "до свидания"]) {
        assert.equal(classifyAskClimpyLocalIntent(phrase), "farewell", phrase);
      }
    },
  },

  // ── capability ────────────────────────────────────────────────────────
  {
    name: "EN/RU capability questions classify as capability",
    run: () => {
      for (const phrase of [
        "what can you do?",
        "how can you help?",
        "who are you?",
        "What can you do?",
      ]) {
        assert.equal(classifyAskClimpyLocalIntent(phrase), "capability", phrase);
      }
      for (const phrase of [
        "что ты умеешь?",
        "чем ты можешь помочь?",
        "кто ты?",
      ]) {
        assert.equal(classifyAskClimpyLocalIntent(phrase), "capability", phrase);
      }
    },
  },

  // ── punctuation/case/spacing normalization ───────────────────────────
  {
    name: "Punctuation, case, and extra whitespace variants of the same phrase all classify identically",
    run: () => {
      for (const phrase of ["hi", "Hi", "HI!", "  hi  ", "hi.", "hi,"]) {
        assert.equal(classifyAskClimpyLocalIntent(phrase), "greeting", phrase);
      }
      for (const phrase of [
        "what can you do?",
        "What Can You Do?",
        "  what   can   you   do?  ",
      ]) {
        assert.equal(classifyAskClimpyLocalIntent(phrase), "capability", phrase);
      }
    },
  },

  // ── no accidental classification of real analysis questions ─────────
  {
    name: "A real analysis question containing a greeting/ack word is never misclassified as a local intent",
    run: () => {
      const realQuestions = [
        "Hi, why is my hook weak?",
        "Ok so what should I fix first?",
        "Thanks, but can you explain the risky part simply?",
        "So bye, one more thing — what's my overall score?",
        "understood, but why is the retention risk high?",
      ];

      for (const question of realQuestions) {
        assert.equal(
          classifyAskClimpyLocalIntent(question),
          null,
          `Expected "${question}" to NOT be classified as a local intent`
        );
      }
    },
  },
  {
    name: "An empty or whitespace-only message never classifies as a local intent",
    run: () => {
      assert.equal(classifyAskClimpyLocalIntent(""), null);
      assert.equal(classifyAskClimpyLocalIntent("   "), null);
    },
  },
  {
    name: "The starter questions themselves are never misclassified as a local intent",
    run: () => {
      const starters = [
        "What should I fix first?",
        "Why is my hook weak?",
        "Explain the riskiest part simply.",
        "Rewrite the riskiest part without adding facts.",
        "Что исправить в первую очередь?",
        "Почему мой хук слабый?",
      ];

      for (const starter of starters) {
        assert.equal(classifyAskClimpyLocalIntent(starter), null, starter);
      }
    },
  },

  // ── isAskClimpyErrorReferencePhrase ───────────────────────────────────
  {
    name: "EN/RU short error-reference phrases are recognized",
    run: () => {
      for (const phrase of ["why?", "Why?", "why not?", "what happened?"]) {
        assert.equal(isAskClimpyErrorReferencePhrase(phrase), true, phrase);
      }
      for (const phrase of ["почему?", "Почему?", "почему нет?", "что случилось?"]) {
        assert.equal(isAskClimpyErrorReferencePhrase(phrase), true, phrase);
      }
    },
  },
  {
    name: "A real analysis question is never classified as an error-reference phrase",
    run: () => {
      assert.equal(
        isAskClimpyErrorReferencePhrase("Why is my hook weak?"),
        false
      );
      assert.equal(
        isAskClimpyErrorReferencePhrase("Почему мой хук слабый?"),
        false
      );
    },
  },
  {
    name: "Error-reference phrases and local courtesy intents are disjoint sets",
    run: () => {
      const errorReferencePhrases = [
        "why?",
        "why not?",
        "what happened?",
        "почему?",
        "почему нет?",
        "что случилось?",
      ];

      for (const phrase of errorReferencePhrases) {
        assert.equal(
          classifyAskClimpyLocalIntent(phrase),
          null,
          `"${phrase}" must not also be classified as a courtesy local intent`
        );
      }
    },
  },

  // ── classifyAskClimpyRewriteIntent (typed rewrite intent) ────────────
  {
    name: "The exact EN typed rewrite phrases classify as rewriteRiskiestPart",
    run: () => {
      for (const phrase of [
        "rewrite the riskiest part without adding facts",
        "rewrite the riskiest part",
        "rewrite this risky part without adding facts",
        "Rewrite the riskiest part without adding facts.",
      ]) {
        assert.equal(
          classifyAskClimpyRewriteIntent(phrase),
          "rewriteRiskiestPart",
          phrase
        );
      }
    },
  },
  {
    name: "The exact RU typed rewrite phrases classify as rewriteRiskiestPart",
    run: () => {
      for (const phrase of [
        "перепиши самый рискованный момент, не добавляя фактов",
        "перепиши самый рискованный момент",
        "перепиши этот рискованный фрагмент, не добавляя фактов",
        "Перепиши самый рискованный момент, не добавляя фактов.",
      ]) {
        assert.equal(
          classifyAskClimpyRewriteIntent(phrase),
          "rewriteRiskiestPart",
          phrase
        );
      }
    },
  },
  {
    name: "Trailing punctuation, case, and extra whitespace normalize safely for the typed rewrite intent",
    run: () => {
      for (const phrase of [
        "REWRITE THE RISKIEST PART WITHOUT ADDING FACTS.",
        "  rewrite   the   riskiest   part   without   adding   facts  ",
        "rewrite the riskiest part without adding facts!",
      ]) {
        assert.equal(
          classifyAskClimpyRewriteIntent(phrase),
          "rewriteRiskiestPart",
          phrase
        );
      }
    },
  },
  {
    name: "Arbitrary rewrite wording is NOT broadly classified — only the exact approved phrase set matches",
    run: () => {
      const notClassified = [
        "can you rewrite my whole script?",
        "rewrite the hook to be more exciting",
        "please rewrite everything",
        "перепиши весь сценарий",
        "перепиши хук поинтереснее",
        "rewrite this: hello world",
      ];

      for (const phrase of notClassified) {
        assert.equal(
          classifyAskClimpyRewriteIntent(phrase),
          null,
          `"${phrase}" must NOT be classified as the approved rewrite intent`
        );
      }
    },
  },
  {
    name: "An empty or whitespace-only message never classifies as the typed rewrite intent",
    run: () => {
      assert.equal(classifyAskClimpyRewriteIntent(""), null);
      assert.equal(classifyAskClimpyRewriteIntent("   "), null);
    },
  },
  {
    name: "The typed rewrite intent, local courtesy intents, and error-reference phrases are all mutually disjoint sets",
    run: () => {
      const rewritePhrases = [
        "rewrite the riskiest part without adding facts",
        "rewrite the riskiest part",
        "rewrite this risky part without adding facts",
        "перепиши самый рискованный момент, не добавляя фактов",
        "перепиши самый рискованный момент",
        "перепиши этот рискованный фрагмент, не добавляя фактов",
      ];

      for (const phrase of rewritePhrases) {
        assert.equal(
          classifyAskClimpyLocalIntent(phrase),
          null,
          `"${phrase}" must not also be classified as a courtesy local intent`
        );
        assert.equal(
          isAskClimpyErrorReferencePhrase(phrase),
          false,
          `"${phrase}" must not also be classified as an error-reference phrase`
        );
      }
    },
  },
];

async function main() {
  console.log("\nAsk Climpy Local Intents Tests\n");

  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
      console.log(`✅ PASS — ${test.name}`);
    } catch (error) {
      console.error(`❌ FAIL — ${test.name}`);
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }

  console.log(`\nAsk Climpy local intents tests: ${passed}/${tests.length} passed`);
}

main();
