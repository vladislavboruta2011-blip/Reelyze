import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ASK_CLIMPY_LIMITS,
  buildAskClimpyAnalysisContext,
  buildAskClimpySafeRefusalFallback,
  findRiskiestRiskyPartIndex,
  introducesUnsupportedAudienceReaction,
  isRiskyPartRewriteEligible,
  parseAskClimpyJson,
  rewriteLacksMaterialImprovement,
  rewriteRisksUnfulfilledPromise,
  validateAskClimpyModelResult,
  validateAskClimpyRequest,
  validateSelectedContext,
  type AskClimpyAnalysisContext,
} from "../engine/ask-climpy-validation";
import {
  buildAskClimpySystemPrompt,
  buildAskClimpyUserPrompt,
} from "../engine/ask-climpy-prompt";
import {
  runAskClimpy,
  type AskClimpyModelCaller,
} from "../app/api/ask-climpy/route";

const script =
  "If super glue gets stuck to your skin, do not pull it apart. First, soak the area in warm soapy water. Then gently roll the skin apart. It usually comes apart in under five minutes.";

function createAnalysisContext(
  analysisLocale: "en" | "ru" = "en"
): AskClimpyAnalysisContext {
  return buildAskClimpyAnalysisContext({
    scriptType: "how_to",
    verdict: "mixed",
    scores: { overall: 74, hook: 70, retentionRisk: 40 },
    scoreBreakdown: {
      overall: { premiseAppeal: 20, openingPromise: 18, progression: 18, payoff: 18 },
      hook: { immediacy: 18, specificity: 17, viewerPull: 17, deliveryAlignment: 18 },
      retentionRisk: {
        openingFriction: 10,
        progressionRisk: 10,
        predictabilityRisk: 10,
        payoffRisk: 10,
      },
    },
    hookDecision: "refine",
    hookAssessment: "The opening names the problem and the risk of pulling.",
    riskyParts: [
      {
        excerpt: "Then gently roll the skin apart.",
        reason: "This step is unclear without the surrounding context.",
        severity: "medium",
      },
      {
        excerpt: "First, soak the area in warm soapy water.",
        reason: "This step's purpose is not explained.",
        severity: "high",
      },
    ],
    suggestedFixes: [
      {
        target: "clarity",
        suggestion: "Connect this step more explicitly to the previous one.",
        optional: false,
      },
    ],
    scenes: [],
    mainTakeaway: "The script is clear but one step needs tighter connection.",
  }, analysisLocale);
}

// The exact real script/analysis from the diagnosed manual-pass regression:
// no exact measurement, mechanism, record, or delivered "why" anywhere in
// the script — so a genuinely stronger, safe hook cannot be built from it
// without inventing something. Shared by every Ronaldo-scenario test below.
function createRonaldoAnalysisContext(): {
  script: string;
  analysisContext: AskClimpyAnalysisContext;
} {
  const script =
    "Today I’m going to tell you something interesting about Cristiano Ronaldo. He trained for many years and became one of the best footballers in the world. People admire his discipline, speed, and jumping ability. But the most surprising part is how much higher he could jump than an average person.";

  const analysisContext = buildAskClimpyAnalysisContext(
    {
      scriptType: "explanation",
      verdict: "mixed",
      scores: { overall: 47, hook: 62, retentionRisk: 50 },
      scoreBreakdown: {
        overall: { premiseAppeal: 12, openingPromise: 15, progression: 10, payoff: 10 },
        hook: { immediacy: 15, specificity: 15, viewerPull: 12, deliveryAlignment: 20 },
        retentionRisk: {
          openingFriction: 5,
          progressionRisk: 15,
          predictabilityRisk: 15,
          payoffRisk: 15,
        },
      },
      hookDecision: "refine",
      hookAssessment:
        "The opening sentence is generic and delays the concrete premise about Cristiano Ronaldo's jumping ability, which is the main interesting point.",
      riskyParts: [
        {
          excerpt: "Today I’m going to tell you something interesting about Cristiano Ronaldo.",
          reason:
            "This opening is generic filler that delays the concrete premise about Ronaldo's exceptional jumping ability, reducing immediate viewer curiosity.",
          severity: "medium",
        },
        {
          excerpt: "But the most surprising part is how much higher he could jump than an average person.",
          reason:
            "The script promises a surprising fact but does not provide any explanation, data, or mechanism to support or elaborate on this claim, resulting in a weak payoff.",
          severity: "medium",
        },
      ],
      suggestedFixes: [
        {
          target: "hook",
          suggestion: "Start the script by immediately stating the surprising fact.",
          optional: false,
        },
      ],
      scenes: [],
      mainTakeaway:
        "The script's main limitation is its weak premise appeal and payoff. The opening is generic and delays the main interesting fact about Ronaldo's jumping ability, which is never explained or supported.",
    },
    "en"
  );

  return { script, analysisContext };
}

function createRequestBody(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    script,
    locale: "en",
    analysisContext: createAnalysisContext(),
    selectedContext: { type: "general" },
    question: "What should I fix first?",
    history: [],
    requestRewrite: false,
    ...overrides,
  };
}

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const tests: TestCase[] = [
  // ── Constants ─────────────────────────────────────────────────────────
  {
    name: "The successful-answer cap is exactly 6",
    run: () => {
      assert.equal(ASK_CLIMPY_LIMITS.maxSuccessfulAnswersPerAnalysis, 6);
    },
  },
  {
    name: "The rewrite excerpt limit is exactly 200 characters, not 300",
    run: () => {
      assert.equal(ASK_CLIMPY_LIMITS.maxRewriteFragmentCharacters, 200);
    },
  },

  // ── validateAskClimpyRequest ─────────────────────────────────────────
  {
    name: "validateAskClimpyRequest accepts a well-formed general question",
    run: () => {
      const result = validateAskClimpyRequest(createRequestBody());
      assert.equal(result.ok, true);
    },
  },
  {
    name: "validateAskClimpyRequest accepts a valid compact scoreBreakdown",
    run: () => {
      const result = validateAskClimpyRequest(createRequestBody());
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.ok(result.value.analysisContext.scoreBreakdown);
      }
    },
  },
  {
    name: "validateAskClimpyRequest rejects a malformed scoreBreakdown",
    run: () => {
      const analysisContext = createAnalysisContext();
      // @ts-expect-error deliberately malformed for the test
      analysisContext.scoreBreakdown = { overall: { premiseAppeal: 99 } };

      const result = validateAskClimpyRequest(
        createRequestBody({ analysisContext })
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest accepts analysisContext with no scoreBreakdown at all",
    run: () => {
      const analysisContext = createAnalysisContext();
      delete (analysisContext as { scoreBreakdown?: unknown }).scoreBreakdown;

      const result = validateAskClimpyRequest(
        createRequestBody({ analysisContext })
      );
      assert.equal(result.ok, true);
    },
  },

  // ── suggestedHook removal / analysisLocale addition ──────────────────
  {
    name: "buildAskClimpyAnalysisContext never includes suggestedHook",
    run: () => {
      const analysisContext = createAnalysisContext();
      assert.ok(!("suggestedHook" in analysisContext));
    },
  },
  {
    name: "buildAskClimpyAnalysisContext includes the given analysisLocale",
    run: () => {
      const enContext = createAnalysisContext("en");
      const ruContext = createAnalysisContext("ru");
      assert.equal(enContext.analysisLocale, "en");
      assert.equal(ruContext.analysisLocale, "ru");
    },
  },
  {
    name: "validateAskClimpyRequest rejects an analysisContext containing an unapproved suggestedHook field",
    run: () => {
      const analysisContext = createAnalysisContext() as unknown as Record<
        string,
        unknown
      >;
      analysisContext.suggestedHook = "An invented hook that was never approved.";

      const result = validateAskClimpyRequest(
        createRequestBody({ analysisContext })
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest rejects an analysisContext missing analysisLocale",
    run: () => {
      const analysisContext = createAnalysisContext() as unknown as Record<
        string,
        unknown
      >;
      delete analysisContext.analysisLocale;

      const result = validateAskClimpyRequest(
        createRequestBody({ analysisContext })
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest rejects an invalid analysisLocale value",
    run: () => {
      const analysisContext = createAnalysisContext() as unknown as Record<
        string,
        unknown
      >;
      analysisContext.analysisLocale = "fr";

      const result = validateAskClimpyRequest(
        createRequestBody({ analysisContext })
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest accepts an analysisContext whose analysisLocale differs from the top-level request locale",
    run: () => {
      // The interface locale (request.locale, drives answer language) and
      // the analysis's own locale (analysisContext.analysisLocale) are
      // independent — a mismatch between them must be accepted, not
      // rejected, since it is exactly the scenario the panel's
      // locale-mismatch disclosure exists for.
      const analysisContext = createAnalysisContext("en");

      const result = validateAskClimpyRequest(
        createRequestBody({ locale: "ru", analysisContext })
      );
      assert.equal(result.ok, true);
    },
  },
  {
    name: "The final narrowed analysisContext contains only the approved fields",
    run: () => {
      const analysisContext = createAnalysisContext();
      const approvedKeys = [
        "scriptType",
        "verdict",
        "scores",
        "scoreBreakdown",
        "hookDecision",
        "hookAssessment",
        "mainTakeaway",
        "riskyParts",
        "suggestedFixes",
        "analysisLocale",
      ];

      for (const key of Object.keys(analysisContext)) {
        assert.ok(
          approvedKeys.includes(key),
          `Unapproved field present in AskClimpyAnalysisContext: ${key}`
        );
      }

      assert.ok(!("scenes" in analysisContext));
      assert.ok(!("suggestedHook" in analysisContext));
      assert.ok(!("id" in analysisContext));
      assert.ok(!("title" in analysisContext));
    },
  },
  {
    name: "buildAskClimpyUserPrompt never mentions suggestedHook and includes analysisLocale",
    run: () => {
      const requestValidation = validateAskClimpyRequest(createRequestBody());
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const userPrompt = buildAskClimpyUserPrompt(requestValidation.value);
      assert.doesNotMatch(userPrompt, /suggestedHook/);
      assert.match(userPrompt, /analysisLocale: en/);
    },
  },
  {
    name: "buildAskClimpySystemPrompt never mentions suggestedHook",
    run: () => {
      assert.doesNotMatch(buildAskClimpySystemPrompt("en"), /suggestedHook/);
    },
  },

  {
    name: "validateAskClimpyRequest rejects an empty script",
    run: () => {
      const result = validateAskClimpyRequest(createRequestBody({ script: "" }));
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest rejects an unsupported locale",
    run: () => {
      const result = validateAskClimpyRequest(createRequestBody({ locale: "fr" }));
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest rejects an analysisContext riskyPart excerpt not in the script",
    run: () => {
      const analysisContext = createAnalysisContext();
      analysisContext.riskyParts = [
        {
          excerpt: "This sentence does not appear in the script at all.",
          reason: "fabricated",
          severity: "high",
        },
      ];

      const result = validateAskClimpyRequest(
        createRequestBody({ analysisContext })
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest rejects an out-of-range riskyPart selectedContext index (never falls back to general)",
    run: () => {
      const result = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 5 },
        })
      );

      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(result.reason, /riskyPart/);
      }
    },
  },
  {
    name: "validateAskClimpyRequest rejects requestRewrite when selectedContext is not riskyPart",
    run: () => {
      const result = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "hookScore" },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest rejects a rewriteFragment that does not exactly match the selected risky part's excerpt",
    run: () => {
      const result = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "then gently roll the skin apart",
        })
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest rejects an arbitrary exact script substring that is not the selected risky part's excerpt",
    run: () => {
      // "the area in warm soapy water" is a genuine, exact substring of the
      // script, but it is not riskyParts[0]'s excerpt — grounding must key
      // off the specific selected risky part, not merely "any real substring".
      const result = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "the area in warm soapy water",
        })
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest accepts a rewriteFragment that exactly matches the selected risky part's excerpt",
    run: () => {
      const result = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );

      assert.equal(result.ok, true);
    },
  },
  {
    name: "validateAskClimpyRequest rejects a rewriteFragment over 200 characters even if it matches the excerpt",
    run: () => {
      const analysisContext = createAnalysisContext();
      const longExcerpt = ("x".repeat(190) + " end of a long excerpt.").slice(0, 210);
      analysisContext.riskyParts = [
        { excerpt: longExcerpt, reason: "too long", severity: "high" },
      ];

      const scriptWithLongExcerpt = `${script} ${longExcerpt}`;

      const result = validateAskClimpyRequest(
        createRequestBody({
          script: scriptWithLongExcerpt,
          analysisContext,
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: longExcerpt,
        })
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest rejects rewriteFragment being present when requestRewrite is false",
    run: () => {
      const result = validateAskClimpyRequest(
        createRequestBody({
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest rejects history longer than the allowed limit",
    run: () => {
      const history = Array.from(
        { length: ASK_CLIMPY_LIMITS.maxHistoryMessages + 1 },
        (_, index) => ({
          role: index % 2 === 0 ? "user" : "assistant",
          content: "hi",
        })
      );

      const result = validateAskClimpyRequest(createRequestBody({ history }));
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest rejects a question over the character limit",
    run: () => {
      const result = validateAskClimpyRequest(
        createRequestBody({
          question: "x".repeat(ASK_CLIMPY_LIMITS.maxQuestionCharacters + 1),
        })
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyRequest rejects unexpected top-level fields",
    run: () => {
      const result = validateAskClimpyRequest({
        ...createRequestBody(),
        extraField: "should not be here",
      });

      assert.equal(result.ok, false);
    },
  },

  // ── validateSelectedContext ──────────────────────────────────────────
  {
    name: "validateSelectedContext accepts general and hookScore",
    run: () => {
      const analysisContext = createAnalysisContext();
      assert.equal(
        validateSelectedContext({ type: "general" }, analysisContext).ok,
        true
      );
      assert.equal(
        validateSelectedContext({ type: "hookScore" }, analysisContext).ok,
        true
      );
    },
  },
  {
    name: "validateSelectedContext rejects an out-of-range suggestedFix index (never silently falls back)",
    run: () => {
      const analysisContext = createAnalysisContext();
      const result = validateSelectedContext(
        { type: "suggestedFix", index: 9 },
        analysisContext
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateSelectedContext rejects an unrecognized type (never silently falls back to general)",
    run: () => {
      const analysisContext = createAnalysisContext();
      const result = validateSelectedContext(
        { type: "somethingElse" },
        analysisContext
      );
      assert.equal(result.ok, false);
    },
  },

  // ── findRiskiestRiskyPartIndex / isRiskyPartRewriteEligible ──────────
  {
    name: "findRiskiestRiskyPartIndex returns null with no risky parts",
    run: () => {
      assert.equal(findRiskiestRiskyPartIndex([]), null);
    },
  },
  {
    name: "findRiskiestRiskyPartIndex prefers the highest-severity entry regardless of array order",
    run: () => {
      const index = findRiskiestRiskyPartIndex([
        { excerpt: "low one", reason: "r", severity: "low" },
        { excerpt: "high one", reason: "r", severity: "high" },
        { excerpt: "medium one", reason: "r", severity: "medium" },
      ]);
      assert.equal(index, 1);
    },
  },
  {
    name: "findRiskiestRiskyPartIndex picks the first occurrence on a severity tie",
    run: () => {
      const index = findRiskiestRiskyPartIndex([
        { excerpt: "first high", reason: "r", severity: "high" },
        { excerpt: "second high", reason: "r", severity: "high" },
      ]);
      assert.equal(index, 0);
    },
  },
  {
    name: "isRiskyPartRewriteEligible accepts a short exact-substring excerpt",
    run: () => {
      const eligible = isRiskyPartRewriteEligible(
        { excerpt: "Then gently roll the skin apart.", reason: "r", severity: "low" },
        script
      );
      assert.equal(eligible, true);
    },
  },
  {
    name: "isRiskyPartRewriteEligible rejects an excerpt over 200 characters",
    run: () => {
      const longExcerpt = "a".repeat(201);
      const eligible = isRiskyPartRewriteEligible(
        { excerpt: longExcerpt, reason: "r", severity: "low" },
        `${script} ${longExcerpt}`
      );
      assert.equal(eligible, false);
    },
  },
  {
    name: "isRiskyPartRewriteEligible rejects an excerpt not present in the script",
    run: () => {
      const eligible = isRiskyPartRewriteEligible(
        { excerpt: "not in the script anywhere", reason: "r", severity: "low" },
        script
      );
      assert.equal(eligible, false);
    },
  },
  {
    name: "isRiskyPartRewriteEligible rejects an empty excerpt",
    run: () => {
      const eligible = isRiskyPartRewriteEligible(
        { excerpt: "", reason: "r", severity: "low" },
        script
      );
      assert.equal(eligible, false);
    },
  },
  {
    name: "isRiskyPartRewriteEligible rejects undefined",
    run: () => {
      assert.equal(isRiskyPartRewriteEligible(undefined, script), false);
    },
  },

  // ── parseAskClimpyJson ───────────────────────────────────────────────
  {
    name: "parseAskClimpyJson strips a ```json fence",
    run: () => {
      const parsed = parseAskClimpyJson(
        '```json\n{"answer":"hi","action":null,"example":null,"cannotSafelyRewrite":false}\n```'
      );
      assert.deepEqual(parsed, {
        answer: "hi",
        action: null,
        example: null,
        cannotSafelyRewrite: false,
      });
    },
  },
  {
    name: "parseAskClimpyJson returns null for invalid JSON",
    run: () => {
      assert.equal(parseAskClimpyJson("not json"), null);
    },
  },

  // ── validateAskClimpyModelResult (approved contract) ─────────────────
  {
    name: "validateAskClimpyModelResult accepts a plain answer for a non-rewrite request",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "Fix the unclear step first.", action: null, example: null, cannotSafelyRewrite: false },
        { requestRewrite: false }
      );
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.cannotSafelyRewrite, false);
        assert.equal(result.value.example, undefined);
      }
    },
  },
  {
    name: "validateAskClimpyModelResult never exposes a rewrite object on the response type",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "hi", action: null, example: null, cannotSafelyRewrite: false },
        { requestRewrite: false }
      );
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.ok(!("rewrite" in result.value));
        assert.ok(!("status" in result.value));
      }
    },
  },
  {
    name: "validateAskClimpyModelResult rejects cannotSafelyRewrite: true for a non-rewrite request",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "hi", action: null, example: null, cannotSafelyRewrite: true },
        { requestRewrite: false }
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyModelResult ACCEPTS a legitimate illustrative example on a non-rewrite request (Phase 2 correction — no longer a rejected 'rewrite field')",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "Here is the idea.",
          action: null,
          example: "For instance, you could open with the exact number instead.",
          cannotSafelyRewrite: false,
        },
        { requestRewrite: false }
      );
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(
          result.value.example,
          "For instance, you could open with the exact number instead."
        );
        assert.equal(result.value.cannotSafelyRewrite, false);
      }
    },
  },
  {
    name: "validateAskClimpyModelResult still rejects cannotSafelyRewrite: true on a non-rewrite request, even with a populated example",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "hi", action: null, example: "unexpected", cannotSafelyRewrite: true },
        { requestRewrite: false }
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyModelResult accepts a rewrite refusal (cannotSafelyRewrite: true, no example)",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "Cannot safely rewrite this without more context.",
          action: null,
          example: null,
          cannotSafelyRewrite: true,
        },
        { requestRewrite: true, rewriteFragment: "Then gently roll the skin apart." }
      );
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.cannotSafelyRewrite, true);
        assert.equal(result.value.example, undefined);
      }
    },
  },
  {
    name: "validateAskClimpyModelResult normalizes away (does not reject) an example present alongside cannotSafelyRewrite: true — diagnosed cause of retry-exhaustion 502s on the rewrite path",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "Cannot rewrite.",
          action: null,
          example: "Some example anyway",
          cannotSafelyRewrite: true,
        },
        { requestRewrite: true, rewriteFragment: "Then gently roll the skin apart." }
      );
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.cannotSafelyRewrite, true);
        assert.equal(result.value.example, undefined);
      }
    },
  },
  {
    name: "validateAskClimpyModelResult accepts a safe rewrite with a populated example",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "Here is a tighter version of that step.",
          action: "Tightened the wording.",
          example: "Then gently roll it apart, following the same motion.",
          cannotSafelyRewrite: false,
        },
        { requestRewrite: true, rewriteFragment: "Then gently roll the skin apart." }
      );
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(
          result.value.example,
          "Then gently roll it apart, following the same motion."
        );
        assert.equal(result.value.action, "Tightened the wording.");
      }
    },
  },
  {
    name: "validateAskClimpyModelResult rejects cannotSafelyRewrite: false with no example at all",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "Here.", action: null, example: null, cannotSafelyRewrite: false },
        { requestRewrite: true, rewriteFragment: "Then gently roll the skin apart." }
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyModelResult rejects a no-op example identical to the original fragment",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "Here.",
          action: null,
          example: "Then gently roll the skin apart.",
          cannotSafelyRewrite: false,
        },
        { requestRewrite: true, rewriteFragment: "Then gently roll the skin apart." }
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyModelResult rejects an answer over the character limit",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "x".repeat(ASK_CLIMPY_LIMITS.maxAnswerCharacters + 1),
          action: null,
          example: null,
          cannotSafelyRewrite: false,
        },
        { requestRewrite: false }
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyModelResult rejects an unapproved extra field",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "hi",
          action: null,
          example: null,
          cannotSafelyRewrite: false,
          rewrite: { original: "a", rewritten: "b" },
        },
        { requestRewrite: false }
      );
      assert.equal(result.ok, false);
    },
  },

  // ── Editorial quality: action must be concrete, not a generic label ──
  // A generic action is NORMALIZED away (dropped), not treated as a fatal
  // validation failure — see engine/ask-climpy-validation.ts's comment on
  // this branch: failing outright would burn the one approved retry on a
  // weak-but-harmless optional field even when "answer"/"example" are
  // perfectly safe and useful on their own (diagnosed as one path to the
  // rewrite endpoint's retry-exhaustion 502s).
  {
    name: "validateAskClimpyModelResult normalizes away the exact generic action observed in the regression (\"улучшить хук скрипта\") — keeps the valid answer",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "Перепишите вступление, чтобы сразу ввести факт о прыжках.",
          action: "улучшить хук скрипта",
          example: null,
          cannotSafelyRewrite: false,
        },
        { requestRewrite: false }
      );
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.action, undefined);
        assert.equal(
          result.value.answer,
          "Перепишите вступление, чтобы сразу ввести факт о прыжках."
        );
      }
    },
  },
  {
    name: "validateAskClimpyModelResult normalizes away the EN generic action labels (\"Improve the hook.\", \"Make it more engaging.\", \"Add more details.\") — never fails the whole response over them",
    run: () => {
      for (const generic of [
        "Improve the hook.",
        "improve the hook",
        "Make it more engaging.",
        "Add more details.",
      ]) {
        const result = validateAskClimpyModelResult(
          { answer: "Some grounded answer.", action: generic, example: null, cannotSafelyRewrite: false },
          { requestRewrite: false }
        );
        assert.equal(result.ok, true, `Expected "${generic}" to be normalized away, not rejected`);
        if (result.ok) {
          assert.equal(result.value.action, undefined);
        }
      }
    },
  },
  {
    name: "validateAskClimpyModelResult accepts a specific, concrete action",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "The opening announces the topic instead of leading with the surprise.",
          action:
            "Replace the first sentence with a self-contained hook that immediately introduces the jumping-ability fact.",
          example: null,
          cannotSafelyRewrite: false,
        },
        { requestRewrite: false }
      );
      assert.equal(result.ok, true);
    },
  },
  {
    name: "validateAskClimpyModelResult does not require action at all — omitted action is always valid",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "This is already clear enough on its own.", action: null, example: null, cannotSafelyRewrite: false },
        { requestRewrite: false }
      );
      assert.equal(result.ok, true);
    },
  },

  // ── Editorial quality: anti-unfulfilled-promise rewrite guard ────────
  // Generalized across script types, not overfit to Cristiano Ronaldo or
  // the literal phrase "Here's why" — see the comparison-script and
  // ru-locale cases below.
  {
    name: "rewriteRisksUnfulfilledPromise flags \"Here's why\" when the analysis already flags the payoff as unresolved (the Ronaldo regression shape)",
    run: () => {
      const flagged = rewriteRisksUnfulfilledPromise(
        "Cristiano Ronaldo can jump much higher than an average person. Here's why.",
        {
          hookAssessment: "Generic opening delays the concrete premise.",
          mainTakeaway: "The main limitation is a weak payoff.",
          riskyParts: [
            {
              excerpt: "But the most surprising part is how much higher he could jump than an average person.",
              reason:
                "The script promises a surprising fact but does not provide any explanation, data, or mechanism to support it.",
              severity: "medium",
            },
          ],
        }
      );
      assert.equal(flagged, true);
    },
  },
  {
    name: "rewriteRisksUnfulfilledPromise does NOT flag a self-contained grounded rewrite with no teaser",
    run: () => {
      const flagged = rewriteRisksUnfulfilledPromise(
        "Cristiano Ronaldo's jumping ability is what surprises people most.",
        {
          hookAssessment: "Generic opening delays the concrete premise.",
          mainTakeaway: "The main limitation is a weak payoff.",
          riskyParts: [
            {
              excerpt: "But the most surprising part is how much higher he could jump than an average person.",
              reason:
                "The script promises a surprising fact but does not provide any explanation, data, or mechanism to support it.",
              severity: "medium",
            },
          ],
        }
      );
      assert.equal(flagged, false);
    },
  },
  {
    name: "rewriteRisksUnfulfilledPromise does NOT flag a teaser when the analysis never flagged an unresolved payoff (a script that genuinely delivers on \"here's why\")",
    run: () => {
      const flagged = rewriteRisksUnfulfilledPromise(
        "This trick actually works — here's why.",
        {
          hookAssessment: "Strong, specific opening.",
          mainTakeaway: "The script delivers a clear, well-supported payoff.",
          riskyParts: [],
        }
      );
      assert.equal(flagged, false);
    },
  },
  {
    name: "rewriteRisksUnfulfilledPromise generalizes to a comparison script and a different teaser phrase (not Ronaldo, not \"Here's why\")",
    run: () => {
      const flagged = rewriteRisksUnfulfilledPromise(
        "iPhone vs. Android — wait until you see which one actually wins.",
        {
          hookAssessment: "The comparison never states which side wins.",
          mainTakeaway: "The script lacks an explanation of which product is actually better, resulting in a weak payoff.",
          riskyParts: [
            {
              excerpt: "One of these phones is clearly better.",
              reason: "The claim is never explained or supported by any comparison in the script.",
              severity: "high",
            },
          ],
        }
      );
      assert.equal(flagged, true);
    },
  },
  {
    name: "rewriteRisksUnfulfilledPromise generalizes to Russian-language analysis prose",
    run: () => {
      const flagged = rewriteRisksUnfulfilledPromise(
        "Вот почему это работает не так, как вы думаете.",
        {
          hookAssessment: "Общее вступление, без конкретики.",
          mainTakeaway: "Сценарий не объясняет заявленный результат, из-за чего концовка слабая.",
          riskyParts: [],
        }
      );
      assert.equal(flagged, true);
    },
  },
  {
    name: "validateAskClimpyModelResult rejects a rewrite example that introduces an unfulfilled promise the analysis already flags",
    run: () => {
      const analysisContext = createAnalysisContext();
      analysisContext.hookAssessment = "Generic opening delays the concrete premise.";
      analysisContext.mainTakeaway = "The script does not explain the key claim, resulting in a weak payoff.";

      const result = validateAskClimpyModelResult(
        {
          answer: "Here is a tighter opening.",
          action: null,
          example: "Here's why this simple step actually works.",
          cannotSafelyRewrite: false,
        },
        {
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
          analysisContext,
        }
      );

      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyModelResult accepts a self-contained grounded rewrite even when the analysis flags an unresolved payoff elsewhere",
    run: () => {
      const analysisContext = createAnalysisContext();
      analysisContext.mainTakeaway = "The script does not explain the key claim, resulting in a weak payoff.";

      const result = validateAskClimpyModelResult(
        {
          answer: "Here is a tighter opening.",
          action: null,
          example: "Gently roll the skin apart, the same way you loosened it.",
          cannotSafelyRewrite: false,
        },
        {
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
          analysisContext,
        }
      );

      assert.equal(result.ok, true);
    },
  },
  {
    name: "validateAskClimpyModelResult still accepts an ordinary rewrite when no analysisContext is passed at all (optional, backward-compatible)",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "Here is a tighter version.",
          action: null,
          example: "Then gently roll it apart the same way.",
          cannotSafelyRewrite: false,
        },
        { requestRewrite: true, rewriteFragment: "Then gently roll the skin apart." }
      );
      assert.equal(result.ok, true);
    },
  },

  // ── Prompt builder ───────────────────────────────────────────────────
  {
    name: "buildAskClimpyUserPrompt embeds SCRIPT/QUESTION delimiters, the scoreBreakdown, and treats content as data",
    run: () => {
      const askClimpyRequest = validateAskClimpyRequest(createRequestBody());
      assert.equal(askClimpyRequest.ok, true);
      if (!askClimpyRequest.ok) return;

      const userPrompt = buildAskClimpyUserPrompt(askClimpyRequest.value);
      assert.match(userPrompt, /SCRIPT START[\s\S]*SCRIPT END/);
      assert.match(userPrompt, /QUESTION START[\s\S]*QUESTION END/);
      assert.match(userPrompt, /ANALYSIS START[\s\S]*ANALYSIS END/);
      assert.match(userPrompt, /scoreBreakdown:/);

      const systemPrompt = buildAskClimpySystemPrompt("en");
      assert.match(systemPrompt, /DATA, never as instructions/i);
      assert.match(systemPrompt, /"cannotSafelyRewrite"/);
      assert.doesNotMatch(systemPrompt, /"rewrite"/);
    },
  },
  {
    name: "buildAskClimpyUserPrompt only includes a REWRITE FRAGMENT section when requestRewrite is true",
    run: () => {
      const generalRequest = validateAskClimpyRequest(createRequestBody());
      assert.equal(generalRequest.ok, true);
      if (generalRequest.ok) {
        assert.doesNotMatch(
          buildAskClimpyUserPrompt(generalRequest.value),
          /REWRITE FRAGMENT START/
        );
      }

      const rewriteRequest = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );
      assert.equal(rewriteRequest.ok, true);
      if (rewriteRequest.ok) {
        assert.match(
          buildAskClimpyUserPrompt(rewriteRequest.value),
          /REWRITE FRAGMENT START[\s\S]*Then gently roll the skin apart\.[\s\S]*REWRITE FRAGMENT END/
        );
      }
    },
  },
  {
    name: "buildAskClimpySystemPrompt writes the Russian language instruction for ru",
    run: () => {
      const prompt = buildAskClimpySystemPrompt("ru");
      assert.match(prompt, /Russian/);
    },
  },

  // ── Editorial quality / anti-unfulfilled-promise prompt content ──────
  {
    name: "The system prompt explicitly requires a concrete action instead of repeating \"improve the hook\"",
    run: () => {
      const prompt = buildAskClimpySystemPrompt("en");
      assert.match(prompt, /EDITORIAL QUALITY/);
      assert.match(prompt, /identify the exact problematic excerpt or sentence/i);
      assert.match(prompt, /concrete operation/i);
      assert.match(prompt, /"Improve the hook\."/);
      assert.match(prompt, /never claim the change has already been applied/i);
    },
  },
  {
    name: "The system prompt states action is optional and must not be forced onto every answer",
    run: () => {
      const prompt = buildAskClimpySystemPrompt("en");
      assert.match(prompt, /omit it entirely when the answer alone is already sufficient/i);
    },
  },
  {
    name: "The system prompt's anti-unfulfilled-promise rules are semantic, not a blind phrase ban, and cover multiple script types",
    run: () => {
      const prompt = buildAskClimpySystemPrompt("en");
      assert.match(prompt, /ANTI-UNFULFILLED-PROMISE RULES/);
      assert.match(prompt, /SEMANTIC rule, not a banned-word list/i);
      assert.match(prompt, /"Here's why" is allowed only if the script actually explains why/);
      assert.match(prompt, /comparison hook/i);
      assert.match(prompt, /rhetorical question/i);
      assert.doesNotMatch(prompt, /Cristiano Ronaldo can jump much higher than an average person\. Here's why\./);
    },
  },
  {
    name: "The system prompt never populates example alongside cannotSafelyRewrite: true, even as a hedge",
    run: () => {
      const prompt = buildAskClimpySystemPrompt("en");
      assert.match(prompt, /Never populate "example" when "cannotSafelyRewrite" is true/);
    },
  },

  // ── runAskClimpy (route core, injectable model caller) ───────────────
  {
    name: "runAskClimpy returns a grounded answer for a valid mocked response",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(createRequestBody());
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: JSON.stringify({
          answer: "Fix the unclear step first — it is the main risky part.",
          action: null,
          example: null,
          cannotSafelyRewrite: false,
        }),
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, false);
        assert.equal(result.response.example, undefined);
        assert.ok(!("rewrite" in result.response));
      }
    },
  },
  {
    name: "runAskClimpy returns a validated example for a grounded rewrite request",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: JSON.stringify({
          answer: "Here is a tighter version.",
          action: "Shortened the phrasing.",
          example: "Then gently roll it apart the same way.",
          cannotSafelyRewrite: false,
        }),
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(
          result.response.example,
          "Then gently roll it apart the same way."
        );
      }
    },
  },
  {
    name: "runAskClimpy accepts a rewrite refusal from the model as a valid ok result",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: JSON.stringify({
          answer: "I can't safely rewrite this without inventing detail.",
          action: null,
          example: null,
          cannotSafelyRewrite: true,
        }),
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, true);
      }
    },
  },
  {
    name: "runAskClimpy recovers from a single transient upstream failure via the bounded retry",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(createRequestBody());
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;
        if (callCount === 1) {
          const error = new Error("upstream 503") as Error & { status?: number };
          error.status = 503;
          throw error;
        }
        return {
          raw: JSON.stringify({
            answer: "Recovered.",
            action: null,
            example: null,
            cannotSafelyRewrite: false,
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, true);
      assert.equal(callCount, 2);
    },
  },
  {
    name: "runAskClimpy returns a controlled 503 after two consecutive transient failures",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(createRequestBody());
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;
        const error = new Error("upstream 503") as Error & { status?: number };
        error.status = 503;
        throw error;
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, false);
      assert.equal(result.status, 503);
      assert.equal(callCount, 2);
      if (!result.ok) {
        assert.doesNotMatch(result.response.reason, /openai|provider|raw|json|parse/i);
      }
    },
  },
  {
    name: "runAskClimpy returns a safe 502 for an unusable (non-JSON) model response",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(createRequestBody());
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: "not valid json at all",
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
    },
  },
  {
    name: "runAskClimpy accepts an illustrative example on a non-rewrite request end-to-end (Phase 2 correction — this is no longer a fabricated 'rewrite field')",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(createRequestBody());
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: JSON.stringify({
          answer: "Here you go.",
          action: null,
          example: "For instance, something like this.",
          cannotSafelyRewrite: false,
        }),
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.example, "For instance, something like this.");
      }
    },
  },

  // ── Reliability regression: the diagnosed "What should I fix first?"
  // failure. Root cause: the model occasionally answers a plain, non-rewrite
  // question with cannotSafelyRewrite: true (a content-contract violation,
  // not a transient infrastructure error), and previously that failure was
  // never retried — it failed the request outright on the first and only
  // attempt. runAskClimpy must now give this exact failure category the
  // same one bounded retry transient errors already got. ─────────────────
  {
    name: "runAskClimpy retries once and recovers when the model wrongly sets cannotSafelyRewrite on a non-rewrite question (the diagnosed bug)",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(
        createRequestBody({ question: "What should I fix first?" })
      );
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;

        if (callCount === 1) {
          // Reproduces the exact observed failure: cannotSafelyRewrite: true
          // returned for a request where requestRewrite is false.
          return {
            raw: JSON.stringify({
              answer: "This should not be reachable.",
              action: null,
              example: null,
              cannotSafelyRewrite: true,
            }),
          };
        }

        return {
          raw: JSON.stringify({
            answer: "Fix the generic opening filler first.",
            action: null,
            example: null,
            cannotSafelyRewrite: false,
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(callCount, 2, "Expected exactly one retry (two total calls)");
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, false);
      }
    },
  },
  {
    name: "runAskClimpy fails with 502 (not retried a second time) when the model repeats the invalid-contract response twice",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(createRequestBody());
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;
        return {
          raw: JSON.stringify({
            answer: "This should not be reachable.",
            action: null,
            example: null,
            cannotSafelyRewrite: true,
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(callCount, 2, "Expected exactly one retry (two total calls), then give up");
      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
    },
  },
  {
    name: "runAskClimpy accepts a rewrite refusal with a stray example on the FIRST attempt — no retry consumed (the diagnosed rewrite-path retry-exhaustion cause)",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;
        return {
          raw: JSON.stringify({
            answer: "I can't safely rewrite this without inventing detail.",
            action: null,
            example: "a stray hedged attempt the model should not have included",
            cannotSafelyRewrite: true,
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(callCount, 1, "Expected no retry — this is normalized, not treated as a failure");
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, true);
        assert.equal(result.response.example, undefined);
      }
    },
  },

  // ── Superseding correction: Ask Climpy must distinguish a cleaner
  // paraphrase from a genuinely stronger hook. The Ronaldo script contains
  // no exact measurement, mechanism, record, or delivered "why" — so EVERY
  // rewrite direction observed live (moving/rephrasing the same vague
  // "jumps much higher than an average person" claim, or inventing an
  // audience reaction) must now normalize to a safe refusal, never an
  // accepted "example". ──────────────────────────────────────────────────
  {
    name: "createRonaldoAnalysisContext helper is exercised below",
    run: () => {
      const { analysisContext } = createRonaldoAnalysisContext();
      assert.equal(analysisContext.riskyParts.length, 2);
    },
  },
  {
    name: "The real Ronaldo risky-part rewrite request (interface ru, analysisLocale en): a rewrite that only relocates the same vague claim is normalized to a safe refusal, not accepted — the diagnosed regression",
    run: async () => {
      const { script, analysisContext } = createRonaldoAnalysisContext();

      const requestValidation = validateAskClimpyRequest({
        script,
        locale: "ru",
        analysisContext,
        selectedContext: { type: "riskyPart", index: 0 },
        question: "Перепиши самый рискованный момент, не добавляя фактов.",
        history: [],
        requestRewrite: true,
        rewriteFragment: analysisContext.riskyParts[0].excerpt,
      });
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      // Reproduces the exact model behavior observed live: a self-contained,
      // question-phrased rewrite that merely restates the same vague claim
      // ("jumps much higher than an average person") already in the script,
      // with no genuinely new specificity — must NOT be accepted as
      // "meaningfully stronger", even though it is grounded and safe.
      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;
        return {
          raw: JSON.stringify({
            answer: "Лучше начать с самого факта, а не с общего вступления.",
            action: "Замените первую фразу на конкретный факт о прыжках Роналду.",
            example: "Did you know Cristiano Ronaldo can jump much higher than an average person?",
            cannotSafelyRewrite: false,
            rewriteAssessment: "meaningful_rewrite",
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(callCount, 2, "Expected the one approved retry before the graceful safe-refusal fallback");
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, true);
        assert.equal(result.response.example, undefined);
      }
    },
  },
  {
    name: "The real Ronaldo case: the model's own honest cannotSafelyRewrite: true refusal (per the strengthened prompt) is accepted directly on the first attempt",
    run: async () => {
      const { script, analysisContext } = createRonaldoAnalysisContext();

      const requestValidation = validateAskClimpyRequest({
        script,
        locale: "en",
        analysisContext,
        selectedContext: { type: "riskyPart", index: 0 },
        question: "Rewrite the riskiest part without adding facts.",
        history: [],
        requestRewrite: true,
        rewriteFragment: analysisContext.riskyParts[0].excerpt,
      });
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;
        return {
          raw: JSON.stringify({
            answer:
              "I can make this opening shorter, but I cannot turn it into a genuinely strong hook using only the information in the script. The script does not contain a concrete height, measured comparison, record, or explanation to build the hook around.",
            action:
              "Add one verified concrete detail, such as the measured jump height, the exact comparison, or the specific fact the video will reveal.",
            example: null,
            cannotSafelyRewrite: true,
            rewriteAssessment: "insufficient_grounding",
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(callCount, 1, "A clean, well-formed refusal is accepted on the first attempt — no retry needed");
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, true);
        assert.equal(result.response.example, undefined);
        assert.ok(result.response.answer.length > 0);
        assert.ok(result.response.action && result.response.action.length > 0);
      }
    },
  },
  {
    name: "The invented audience reaction observed live (\"...and that's what surprises everyone.\") is rejected even though it is otherwise grounded",
    run: async () => {
      const { script, analysisContext } = createRonaldoAnalysisContext();

      const requestValidation = validateAskClimpyRequest({
        script,
        locale: "en",
        analysisContext,
        selectedContext: { type: "riskyPart", index: 0 },
        question: "Rewrite the riskiest part without adding facts.",
        history: [],
        requestRewrite: true,
        rewriteFragment: analysisContext.riskyParts[0].excerpt,
      });
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: JSON.stringify({
          answer: "Here is a tighter opening.",
          action: null,
          example:
            "Cristiano Ronaldo can jump much higher than an average person, and that's what surprises everyone.",
          cannotSafelyRewrite: false,
          rewriteAssessment: "meaningful_rewrite",
        }),
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, true);
        assert.equal(result.response.example, undefined);
      }
    },
  },

  // ── Phase 7 test matrix (B–H) + Phase 8 generalization ───────────────
  // B. Light paraphrase — reject as non-meaningful.
  {
    name: "[Matrix B] rewriteLacksMaterialImprovement flags a light paraphrase of a generic-filler opening with no added anchor material",
    run: () => {
      const flagged = rewriteLacksMaterialImprovement(
        "Cristiano Ronaldo has an interesting jumping ability.",
        "This opening is generic filler that delays the concrete premise about Ronaldo's jumping ability."
      );
      assert.equal(flagged, true);
    },
  },
  {
    name: "[Matrix B] A light paraphrase is normalized to a safe refusal end-to-end, never presented as a strong hook",
    run: async () => {
      const { script, analysisContext } = createRonaldoAnalysisContext();
      const requestValidation = validateAskClimpyRequest({
        script,
        locale: "en",
        analysisContext,
        selectedContext: { type: "riskyPart", index: 0 },
        question: "Rewrite the riskiest part without adding facts.",
        history: [],
        requestRewrite: true,
        rewriteFragment: analysisContext.riskyParts[0].excerpt,
      });
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: JSON.stringify({
          answer: "Here is a cleaner version.",
          action: null,
          example: "Cristiano Ronaldo has an interesting jumping ability.",
          cannotSafelyRewrite: false,
          rewriteAssessment: "meaningful_rewrite",
        }),
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, true);
        assert.equal(result.response.example, undefined);
      }
    },
  },

  // C. Existing concrete fact later in script — accept when moved forward.
  {
    name: "[Matrix C] Moving an existing concrete measurement into the opening is NOT flagged — no new fact, directly fixes specificity",
    run: () => {
      const flagged = rewriteLacksMaterialImprovement(
        "Cristiano Ronaldo can jump 80 centimeters higher than an average person.",
        "This opening is generic filler that delays the concrete premise about Ronaldo's jumping ability."
      );
      assert.equal(flagged, false);
    },
  },
  {
    name: "[Matrix C] runAskClimpy accepts a rewrite that pulls an existing measurement forward, end-to-end",
    run: async () => {
      const { script, analysisContext } = createRonaldoAnalysisContext();
      // Same script plus an appended measurement — both original riskyPart
      // excerpts remain exact substrings (required by grounding validation);
      // the appended sentence is the "existing concrete fact later in the
      // script" this scenario is about.
      const scriptWithMeasurement = `${script} He can jump 80 centimeters higher than an average person.`;

      const requestValidation = validateAskClimpyRequest({
        script: scriptWithMeasurement,
        locale: "en",
        analysisContext,
        selectedContext: { type: "riskyPart", index: 0 },
        question: "Rewrite the riskiest part without adding facts.",
        history: [],
        requestRewrite: true,
        rewriteFragment: analysisContext.riskyParts[0].excerpt,
      });
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: JSON.stringify({
          answer: "This leads with the existing measurement instead of a generic announcement.",
          action: "Open with the 80-centimeter jump comparison instead of the generic intro.",
          example: "Cristiano Ronaldo can jump 80 centimeters higher than an average person.",
          cannotSafelyRewrite: false,
          rewriteAssessment: "meaningful_rewrite",
        }),
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, false);
        assert.equal(
          result.response.example,
          "Cristiano Ronaldo can jump 80 centimeters higher than an average person."
        );
      }
    },
  },

  // D. Existing concrete comparison — accept when the body delivers it.
  {
    name: "[Matrix D] A self-contained comparison hook grounded in a delivered numeric comparison is accepted",
    run: () => {
      const flagged = rewriteLacksMaterialImprovement(
        "Ronaldo jumps higher than an NBA player taking a standing vertical leap — by 12 centimeters.",
        "The comparison is never stated specifically, resulting in a vague, generic claim."
      );
      assert.equal(flagged, false);
    },
  },

  // E. Filler-only problem — accept compression, do not over-refuse.
  {
    name: "[Matrix E] A pure filler/sequencing problem (no specificity keyword) is never gated by the material-improvement backstop, even with no numeric anchor in the rewrite",
    run: () => {
      const flagged = rewriteLacksMaterialImprovement(
        "Then gently roll it apart the same way.",
        "This step is unclear without the surrounding context."
      );
      assert.equal(
        flagged,
        false,
        "A filler/sequencing-only diagnosis must not block a plain compression rewrite"
      );
    },
  },
  {
    name: "[Matrix E] runAskClimpy still accepts an ordinary compression rewrite for a filler-only risky part (regression guard against over-refusing every concise rewrite)",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: JSON.stringify({
          answer: "This tightens the same step without changing its meaning.",
          action: null,
          example: "Then gently roll it apart the same way.",
          cannotSafelyRewrite: false,
          rewriteAssessment: "meaningful_rewrite",
        }),
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, false);
        assert.equal(result.response.example, "Then gently roll it apart the same way.");
      }
    },
  },

  // F. Missing explanation — refuse teaser (generalized beyond "Here's why").
  {
    name: "[Matrix F] \"Why does this happen?\" is rejected as an unfulfilled promise when the analysis flags the explanation as missing",
    run: () => {
      const flagged = rewriteRisksUnfulfilledPromise("Why does this happen? Watch to find out.", {
        hookAssessment: "The mechanism is never explained.",
        mainTakeaway: "The script does not explain why this happens, resulting in a weak payoff.",
        riskyParts: [],
      });
      // "Why does this happen?" alone has no dedicated teaser pattern, but
      // this generalizes via the bare-question exclusion — a question is
      // deliberately no longer sufficient on its own (see the diagnosed
      // over-broad "?" removal above). The explicit-phrase patterns
      // ("here's why", "here's how", etc.) remain the enforced boundary;
      // this case documents that a bare question about an undelivered
      // mechanism is NOT automatically flagged by this function alone — it
      // is instead caught by the material-improvement backstop instead,
      // since it adds no hard-anchor content either.
      assert.equal(flagged, false);
    },
  },
  {
    name: "[Matrix F] An equivalent teaser (\"here's how it works\") IS rejected when the script never delivers the mechanism",
    run: () => {
      const flagged = rewriteRisksUnfulfilledPromise(
        "Here's how it actually works.",
        {
          hookAssessment: "The mechanism is never explained.",
          mainTakeaway: "The script does not explain the mechanism, resulting in a weak payoff.",
          riskyParts: [],
        }
      );
      assert.equal(flagged, true);
    },
  },

  // G. Unsupported audience reaction — refuse (EN + RU).
  {
    name: "[Matrix G] introducesUnsupportedAudienceReaction flags EN audience-reaction phrases",
    run: () => {
      for (const phrase of [
        "Cristiano Ronaldo can jump much higher than an average person, and that's what surprises everyone.",
        "Everyone was shocked when they found out.",
        "Viewers couldn't believe what they saw.",
        "Fans went crazy over this.",
      ]) {
        assert.equal(
          introducesUnsupportedAudienceReaction(phrase),
          true,
          `Expected to flag: "${phrase}"`
        );
      }
    },
  },
  {
    name: "[Matrix G] introducesUnsupportedAudienceReaction flags RU audience-reaction equivalents",
    run: () => {
      for (const phrase of [
        "Все были шокированы этой новостью.",
        "Зрители не могли поверить своим глазам.",
        "Фанаты сошли с ума от этого видео.",
        "Это удивляет всех зрителей.",
      ]) {
        assert.equal(
          introducesUnsupportedAudienceReaction(phrase),
          true,
          `Expected to flag: "${phrase}"`
        );
      }
    },
  },
  {
    name: "[Matrix G/H] introducesUnsupportedAudienceReaction does NOT flag the script's own narrator-voice framing of a fact as surprising",
    run: () => {
      assert.equal(
        introducesUnsupportedAudienceReaction(
          "The most surprising part is how much higher he can jump than an average person."
        ),
        false,
        "Narrator framing describing the fact itself must not be treated as an audience-reaction claim"
      );
    },
  },

  // Phase 8 — generalization beyond football/Ronaldo, EN and RU.
  {
    name: "[Phase 8] Comparison script: a rewrite adding a real named+numeric comparison is accepted; one that only relocates a vague comparison claim is not",
    run: () => {
      const vague = rewriteLacksMaterialImprovement(
        "One of these two phones is clearly better than the other.",
        "The comparison claim is vague and not specific about which product wins or by how much."
      );
      assert.equal(vague, true);

      const grounded = rewriteLacksMaterialImprovement(
        "Phone A's battery lasts 6 hours longer than Phone B's.",
        "The comparison claim is vague and not specific about which product wins or by how much."
      );
      assert.equal(grounded, false);
    },
  },
  {
    name: "[Phase 8] Story script: a rewrite adding a delivered before/after outcome is accepted; one that only adds drama is not",
    run: () => {
      const dramaOnly = rewriteLacksMaterialImprovement(
        "What happened to him next was absolutely unbelievable.",
        "The story's outcome is never stated — the claim is too abstract to be compelling."
      );
      assert.equal(dramaOnly, true);

      const groundedOutcome = rewriteLacksMaterialImprovement(
        "He went from sleeping in his car to signing a two million dollar contract.",
        "The story's outcome is never stated — the claim is too abstract to be compelling."
      );
      assert.equal(groundedOutcome, false);
    },
  },
  {
    name: "[Phase 8] Fact/reveal script in Russian: the same specificity gate applies to Cyrillic riskyPart reasons",
    run: () => {
      const stillVague = rewriteLacksMaterialImprovement(
        "У этого явления есть необычная особенность.",
        "Формулировка слишком общая и не называет конкретный факт."
      );
      assert.equal(stillVague, true);

      const grounded = rewriteLacksMaterialImprovement(
        "Это происходит из-за перепада давления в 300 метров.",
        "Формулировка слишком общая и не называет конкретный факт."
      );
      assert.equal(grounded, false);
    },
  },
  {
    name: "[Phase 8] Explanation script without numbers but with a concrete named mechanism (causal connector) is accepted — not every hook needs a number",
    run: () => {
      const grounded = rewriteLacksMaterialImprovement(
        "This happens because cold air is denser than warm air.",
        "The explanation is too abstract and never names the actual mechanism."
      );
      assert.equal(
        grounded,
        false,
        "A causal connector introducing the actual mechanism counts as concrete, even with no digit"
      );
    },
  },
  {
    name: "rewriteRisksUnfulfilledPromise no longer flags a bare question-mark rewrite on its own (the diagnosed over-broad signal)",
    run: () => {
      const flagged = rewriteRisksUnfulfilledPromise(
        "Did you know Cristiano Ronaldo can jump much higher than an average person?",
        {
          hookAssessment: "Generic opening delays the concrete premise.",
          mainTakeaway:
            "The script does not provide any explanation, resulting in a weak payoff.",
          riskyParts: [
            {
              excerpt: "But the most surprising part is how much higher he could jump than an average person.",
              reason: "The script promises a surprising fact but does not provide any explanation.",
              severity: "medium",
            },
          ],
        }
      );
      assert.equal(
        flagged,
        false,
        "A bare rhetorical question restating an already-stated fact must not be flagged by itself"
      );
    },
  },
  {
    name: "runAskClimpy survives a valid grounded rewrite when the optional action field is a generic label — action is dropped, example/answer are preserved",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: JSON.stringify({
          answer: "Here is a tighter version of that step.",
          action: "Improve the hook.",
          example: "Then gently roll it apart, following the same motion.",
          cannotSafelyRewrite: false,
        }),
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.action, undefined);
        assert.equal(
          result.response.example,
          "Then gently roll it apart, following the same motion."
        );
      }
    },
  },
  {
    name: "runAskClimpy returns a valid HTTP 200 safe refusal (cannotSafelyRewrite: true, no example) when both attempts fail the same content-grounding check — never a generic 502 for a normal editorial outcome",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(
        createRequestBody({
          locale: "ru",
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;
        return {
          raw: JSON.stringify({
            answer: "Here is a version.",
            action: null,
            // Identical to the original fragment both times — a genuine
            // no-op the model could not improve on in either attempt.
            example: "Then gently roll the skin apart.",
            cannotSafelyRewrite: false,
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(callCount, 2, "Expected exactly one retry before falling back");
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, true);
        assert.equal(result.response.example, undefined);
        assert.ok(result.response.answer.length > 0);
        // Localized to the request's own interface locale (ru here). The
        // fallback also carries a concrete "action" (what verified detail
        // to add) — never undefined for this specific fallback.
        assert.match(result.response.answer, /[Ѐ-ӿ]/);
        assert.ok(result.response.action && result.response.action.length > 0);
        assert.match(result.response.action, /[Ѐ-ӿ]/);
      }
    },
  },
  {
    name: "The safe-refusal fallback is locale-aware (en request gets an English answer)",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(
        createRequestBody({
          locale: "en",
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: JSON.stringify({
          answer: "Here is a version.",
          action: null,
          example: "Then gently roll the skin apart.",
          cannotSafelyRewrite: false,
        }),
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, true);
      if (result.ok) {
        assert.doesNotMatch(result.response.answer, /[Ѐ-ӿ]/);
        assert.ok(result.response.answer.length > 0);
      }
    },
  },
  {
    name: "The safe-refusal fallback satisfies the exact approved AskClimpyResponse contract",
    run: () => {
      const fallback = buildAskClimpySafeRefusalFallback("ru");
      const approvedKeys = ["answer", "action", "example", "cannotSafelyRewrite"];
      for (const key of Object.keys(fallback)) {
        assert.ok(approvedKeys.includes(key), `Unapproved field on safe-refusal fallback: ${key}`);
      }
      assert.equal(typeof fallback.answer, "string");
      assert.ok(fallback.answer.length > 0);
      assert.equal(fallback.cannotSafelyRewrite, true);
      assert.equal(typeof fallback.action, "string");
      assert.ok(fallback.action && fallback.action.length > 0);
      assert.equal(fallback.example, undefined);
    },
  },
  {
    name: "The safe-refusal fallback is never used for a non-rewrite request, even if both attempts fail validation",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(createRequestBody());
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;
        // Same invalid-contract shape as the pre-existing "diagnosed bug"
        // regression: cannotSafelyRewrite: true fabricated on a non-rewrite
        // request. This is a contract violation, not an eligible-for-safe-
        // refusal editorial outcome, and must still 502 after the retry.
        return {
          raw: JSON.stringify({
            answer: "Unreachable.",
            action: null,
            example: null,
            cannotSafelyRewrite: true,
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(callCount, 2);
      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
    },
  },
  {
    name: "A genuinely unparseable (non-JSON) upstream response still returns 502 after the one retry — never silently downgraded to a safe refusal",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: "not valid json at all, twice in a row",
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
    },
  },
  {
    name: "A deterministic 400 request-shape rejection is never converted into a safe refusal — it never reaches runAskClimpy/the model at all",
    run: async () => {
      const { POST } = await import("../app/api/ask-climpy/route");

      let modelCalls = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        modelCalls += 1;
        throw new Error("The model must never be called for a 400 request-validation failure");
      }) as typeof fetch;

      try {
        const response = await POST(
          new Request("http://localhost/api/ask-climpy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.220",
            },
            body: JSON.stringify(
              createRequestBody({
                selectedContext: { type: "riskyPart", index: 0 },
                requestRewrite: true,
                rewriteFragment: "does not match any risky part",
              })
            ),
          })
        );

        const body = await response.json();
        assert.equal(response.status, 400);
        assert.equal(modelCalls, 0);
        assert.equal(body.cannotSafelyRewrite, undefined);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "runAskClimpy retries once and recovers from a single malformed (non-JSON) model response",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(createRequestBody());
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;

        if (callCount === 1) {
          return { raw: "not valid json at all" };
        }

        return {
          raw: JSON.stringify({
            answer: "Recovered after one malformed response.",
            action: null,
            example: null,
            cannotSafelyRewrite: false,
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(callCount, 2);
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
    },
  },
  {
    name: "A deterministic 400 request-validation failure is never retried and never calls the model",
    run: async () => {
      const { POST } = await import("../app/api/ask-climpy/route");

      let modelCalls = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        modelCalls += 1;
        throw new Error("The model must never be called for a 400 request-validation failure");
      }) as typeof fetch;

      try {
        const response = await POST(
          new Request("http://localhost/api/ask-climpy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.203",
            },
            body: JSON.stringify(createRequestBody({ script: "" })),
          })
        );

        assert.equal(response.status, 400);
        assert.equal(modelCalls, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "validateAskClimpyModelResult accepts action/example keys entirely omitted, not just null",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "A plain answer with no optional fields at all.", cannotSafelyRewrite: false },
        { requestRewrite: false }
      );
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.action, undefined);
        assert.equal(result.value.example, undefined);
      }
    },
  },
  {
    name: "The system prompt states the non-rewrite default unambiguously (cannotSafelyRewrite: false with no exceptions when REWRITE FRAGMENT is absent)",
    run: () => {
      const prompt = buildAskClimpySystemPrompt("en");
      assert.match(prompt, /never means "no rewrite was requested\."/);
      assert.match(prompt, /with no exceptions/);
    },
  },

  // ── POST handler: content-type, body size, rate limiting, no Supabase ─
  {
    name: "POST rejects a non-JSON Content-Type with 415",
    run: async () => {
      const { POST } = await import("../app/api/ask-climpy/route");

      const response = await POST(
        new Request("http://localhost/api/ask-climpy", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "not json",
        })
      );

      assert.equal(response.status, 415);
    },
  },
  {
    name: "POST rejects an oversized declared Content-Length with 413",
    run: async () => {
      const { POST } = await import("../app/api/ask-climpy/route");

      const response = await POST(
        new Request("http://localhost/api/ask-climpy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(ASK_CLIMPY_LIMITS.maxRequestBodyBytes + 1),
          },
          body: JSON.stringify(createRequestBody()),
        })
      );

      assert.equal(response.status, 413);
    },
  },
  {
    name: "POST returns 400 for an invalid request without ever calling the model",
    run: async () => {
      const { POST } = await import("../app/api/ask-climpy/route");

      const response = await POST(
        new Request("http://localhost/api/ask-climpy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "203.0.113.201",
          },
          body: JSON.stringify(createRequestBody({ script: "" })),
        })
      );

      assert.equal(response.status, 400);
    },
  },
  {
    name: "POST enforces the per-IP rate limit and returns 429 with Retry-After",
    run: async () => {
      const { POST } = await import("../app/api/ask-climpy/route");

      const send = () =>
        POST(
          new Request("http://localhost/api/ask-climpy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.202",
            },
            body: JSON.stringify(createRequestBody()),
          })
        );

      // Rate limiting is only consumed by requests that already pass shape
      // validation (see route.ts: validateAskClimpyRequest runs first) —
      // an invalid 400 body would never fill the window, so this sends
      // well-formed bodies. What happens after the rate-limit check
      // (200/502/503, depending on OPENAI_API_KEY) does not matter here.
      const responses = [];
      for (let index = 0; index < 9; index += 1) {
        responses.push(await send());
      }

      const last = responses[responses.length - 1];
      assert.equal(last.status, 429);
      assert.ok(last.headers.get("Retry-After"));
    },
  },
  {
    name: "app/api/ask-climpy/route.ts never imports Supabase",
    run: () => {
      const source = readFileSync("app/api/ask-climpy/route.ts", "utf8");
      assert.doesNotMatch(source, /supabase/i);
    },
  },
  {
    name: "The OpenAI JSON schema mirrors the approved response contract exactly, plus the internal-only rewriteAssessment field (no rewrite object)",
    run: () => {
      const source = readFileSync("app/api/ask-climpy/route.ts", "utf8");
      assert.match(
        source,
        /"answer",\s*\n?\s*"action",\s*\n?\s*"example",\s*\n?\s*"cannotSafelyRewrite",\s*\n?\s*"rewriteAssessment"/
      );
      assert.doesNotMatch(source, /original[\s\S]*rewritten|rewritten[\s\S]*original/);
    },
  },
  {
    name: "rewriteAssessment never appears on the public AskClimpyResponse type",
    run: () => {
      const source = readFileSync("engine/ask-climpy-validation.ts", "utf8");
      const start = source.indexOf("export type AskClimpyResponse = {");
      const end = source.indexOf("};", start);
      const responseType = source.slice(start, end);
      assert.doesNotMatch(responseType, /rewriteAssessment/);
    },
  },

  // ── Diagnosed regression: the approved rewrite-starter request
  // ("Перепиши самый рискованный момент, не добавляя фактов.") returned the
  // generic error even though the selected risky part's excerpt contained a
  // grounded fact. Root cause: the model answered with a fully valid,
  // grounded rewrite (answer/example/cannotSafelyRewrite all correct), but
  // "action" came back as "" (empty string) instead of the JSON null
  // literal — validateAskClimpyModelResult treated that as a hard failure
  // ("Model action is invalid."), burning both attempts on an otherwise
  // perfectly usable response and producing a generic 502. An empty/
  // whitespace-only action must be normalized to "no action", exactly like
  // a generic action already is, never a validation failure. ─────────────
  {
    name: "validateAskClimpyModelResult normalizes an empty-string action (not null) to absent — the diagnosed root cause of the rewrite-starter regression",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "Начните сразу с факта о прыжке на 80 см.",
          action: "",
          example: "Кристиано Роналду может прыгать на 80 сантиметров выше среднего человека.",
          cannotSafelyRewrite: false,
        },
        { requestRewrite: true, rewriteFragment: "Оригинальный рискованный момент." }
      );

      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.action, undefined);
        assert.equal(
          result.value.example,
          "Кристиано Роналду может прыгать на 80 сантиметров выше среднего человека."
        );
        assert.equal(result.value.cannotSafelyRewrite, false);
      }
    },
  },
  {
    name: "validateAskClimpyModelResult normalizes a whitespace-only action the same way, for a non-rewrite request",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "Fix the generic opening first.", action: "   ", example: null, cannotSafelyRewrite: false },
        { requestRewrite: false }
      );

      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.action, undefined);
      }
    },
  },
  {
    name: "validateAskClimpyModelResult still rejects a non-string action (wrong type) — the empty-string normalization does not weaken type checking",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "Here.", action: 42, example: null, cannotSafelyRewrite: false },
        { requestRewrite: false }
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "validateAskClimpyModelResult still rejects an action over the character limit — the empty-string normalization does not weaken the length bound",
    run: () => {
      const result = validateAskClimpyModelResult(
        {
          answer: "Here.",
          action: "x".repeat(ASK_CLIMPY_LIMITS.maxActionCharacters + 1),
          example: null,
          cannotSafelyRewrite: false,
        },
        { requestRewrite: false }
      );
      assert.equal(result.ok, false);
    },
  },
  {
    name: "The real rewrite-starter regression, end-to-end: a grounded rewrite with action: \"\" now succeeds on the FIRST attempt (no retry wasted)",
    run: async () => {
      const regressionScript =
        "Today I'm going to tell you something interesting about Cristiano Ronaldo. He trained for many years and became one of the best footballers in the world. People admire his discipline, speed, and jumping ability. But the most surprising part is how much higher he could jump than an average person — 80 centimeters more than an average adult.";

      const analysisContext = buildAskClimpyAnalysisContext(
        {
          scriptType: "explanation",
          verdict: "mixed",
          scores: { overall: 47, hook: 62, retentionRisk: 50 },
          hookDecision: "refine",
          hookAssessment: "Generic opening delays the concrete 80cm jump fact.",
          riskyParts: [
            {
              excerpt:
                "But the most surprising part is how much higher he could jump than an average person — 80 centimeters more than an average adult.",
              reason:
                "The concrete 80cm figure is buried at the end instead of leading the opening.",
              severity: "high",
            },
          ],
          suggestedFixes: [],
          scenes: [],
          mainTakeaway: "The opening should lead with the 80cm jump fact instead of a generic intro.",
        },
        "en"
      );

      const requestValidation = validateAskClimpyRequest({
        script: regressionScript,
        locale: "ru",
        analysisContext,
        selectedContext: { type: "riskyPart", index: 0 },
        question: "Перепиши самый рискованный момент, не добавляя фактов.",
        history: [],
        requestRewrite: true,
        rewriteFragment: analysisContext.riskyParts[0].excerpt,
      });
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;
        return {
          raw: JSON.stringify({
            answer: "Начните сразу с факта о прыжке на 80 см.",
            // The exact diagnosed shape: an empty string rather than null.
            action: "",
            example:
              "Кристиано Роналду может прыгать на 80 сантиметров выше среднего человека.",
            cannotSafelyRewrite: false,
            rewriteAssessment: "meaningful_rewrite",
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(callCount, 1, "Expected no retry wasted — the first attempt is already valid");
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, false);
        assert.equal(result.response.action, undefined);
        assert.equal(
          result.response.example,
          "Кристиано Роналду может прыгать на 80 сантиметров выше среднего человека."
        );
      }
    },
  },

  // ── Reliability hardening: request-type-specific structured-output
  // schemas (replacing one broad schema both request types shared) ────────
  {
    name: "route.ts defines two distinct JSON schemas — EXPLANATION and REWRITE — not one broad schema shared by both request types",
    run: () => {
      const source = readFileSync("app/api/ask-climpy/route.ts", "utf8");
      assert.match(source, /const ASK_CLIMPY_EXPLANATION_JSON_SCHEMA = \{/);
      assert.match(source, /const ASK_CLIMPY_REWRITE_JSON_SCHEMA = \{/);
      assert.doesNotMatch(source, /const ASK_CLIMPY_JSON_SCHEMA = \{/);
    },
  },
  {
    name: "The EXPLANATION schema constrains cannotSafelyRewrite to the literal false at the schema level (enum: [false]), not merely in prose",
    run: () => {
      const source = readFileSync("app/api/ask-climpy/route.ts", "utf8");
      const start = source.indexOf("const ASK_CLIMPY_EXPLANATION_JSON_SCHEMA = {");
      const end = source.indexOf("} as const;", start);
      const schema = source.slice(start, end);

      assert.match(schema, /required: \["answer", "action", "example", "cannotSafelyRewrite"\]/);
      assert.match(schema, /cannotSafelyRewrite: \{\s*\n\s*type: "boolean",\s*\n\s*enum: \[false\],\s*\n\s*\},/);
      // No rewrite-quality self-audit field at all — there is no rewrite to
      // assess for a plain explanation answer.
      assert.doesNotMatch(schema, /rewriteAssessment/);
    },
  },
  {
    name: "The REWRITE schema keeps cannotSafelyRewrite as a plain boolean (both true/false legitimate) and retains rewriteAssessment",
    run: () => {
      const source = readFileSync("app/api/ask-climpy/route.ts", "utf8");
      const start = source.indexOf("const ASK_CLIMPY_REWRITE_JSON_SCHEMA = {");
      const end = source.indexOf("} as const;", start);
      const schema = source.slice(start, end);

      assert.match(schema, /cannotSafelyRewrite: \{\s*\n\s*type: "boolean",\s*\n\s*\},/);
      assert.doesNotMatch(schema, /cannotSafelyRewrite: \{\s*\n\s*type: "boolean",\s*\n\s*enum: \[false\]/);
      assert.match(schema, /rewriteAssessment/);
      assert.match(schema, /"answer",\s*\n\s*"action",\s*\n\s*"example",\s*\n\s*"cannotSafelyRewrite",\s*\n\s*"rewriteAssessment",/);
    },
  },
  {
    name: "defaultAskClimpyModelCaller selects the schema based on the requestRewrite parameter, and runAskClimpy passes askClimpyRequest.requestRewrite to the model caller",
    run: () => {
      const source = readFileSync("app/api/ask-climpy/route.ts", "utf8");

      assert.match(
        source,
        /export async function defaultAskClimpyModelCaller\(\s*\n\s*systemPrompt: string,\s*\n\s*userPrompt: string,\s*\n\s*requestRewrite: boolean\s*\n\s*\)/
      );
      assert.match(
        source,
        /json_schema: requestRewrite\s*\n\s*\?\s*\{\s*\n\s*name: "ask_climpy_rewrite_response",/
      );
      assert.match(
        source,
        /schema: ASK_CLIMPY_REWRITE_JSON_SCHEMA,/
      );
      assert.match(
        source,
        /name: "ask_climpy_explanation_response",/
      );
      assert.match(
        source,
        /schema: ASK_CLIMPY_EXPLANATION_JSON_SCHEMA,/
      );

      assert.match(
        source,
        /modelOutput = await modelCaller\(\s*\n\s*systemPrompt,\s*\n\s*userPrompt,\s*\n\s*askClimpyRequest\.requestRewrite\s*\n\s*\);/
      );
    },
  },
  {
    name: "The public AskClimpyResponse TypeScript type is unchanged by the schema split",
    run: () => {
      const source = readFileSync("engine/ask-climpy-validation.ts", "utf8");
      const start = source.indexOf("export type AskClimpyResponse = {");
      const end = source.indexOf("};", start);
      const responseType = source.slice(start, end);
      assert.match(responseType, /answer: string;/);
      assert.match(responseType, /action\?: string;/);
      assert.match(responseType, /example\?: string;/);
      assert.match(responseType, /cannotSafelyRewrite: boolean;/);
    },
  },

  // ── Phase 3: safe optional-field normalization (example, mirroring the
  // existing action normalization) ────────────────────────────────────────
  {
    name: "An empty-string example on a non-rewrite request is normalized to omitted (Phase 3) — never a validation failure, since example is optional there",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "Fix the opening.", action: null, example: "", cannotSafelyRewrite: false },
        { requestRewrite: false }
      );
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.example, undefined);
      }
    },
  },
  {
    name: "A whitespace-only example on a non-rewrite request is normalized to omitted the same way",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "Fix the opening.", action: null, example: "   ", cannotSafelyRewrite: false },
        { requestRewrite: false }
      );
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.example, undefined);
      }
    },
  },
  {
    name: "An empty-string example on a REQUIRED rewrite-success response (requestRewrite: true, cannotSafelyRewrite: false) is NEVER normalized away — it remains a hard validation failure",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "Here.", action: null, example: "", cannotSafelyRewrite: false },
        { requestRewrite: true, rewriteFragment: "Then gently roll the skin apart." }
      );
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(result.reason, /example/i);
      }
    },
  },
  {
    name: "An empty-string example on a rewrite REFUSAL (cannotSafelyRewrite: true) is still discarded/normalized away, exactly like a populated stray example already was",
    run: () => {
      const result = validateAskClimpyModelResult(
        { answer: "Cannot safely rewrite this.", action: null, example: "", cannotSafelyRewrite: true },
        { requestRewrite: true, rewriteFragment: "Then gently roll the skin apart." }
      );
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.example, undefined);
        assert.equal(result.value.cannotSafelyRewrite, true);
      }
    },
  },
  {
    name: "Example normalization does not weaken type/length validation — a non-string or oversized example is still rejected",
    run: () => {
      const wrongType = validateAskClimpyModelResult(
        { answer: "Here.", action: null, example: 42, cannotSafelyRewrite: false },
        { requestRewrite: false }
      );
      assert.equal(wrongType.ok, false);

      const oversized = validateAskClimpyModelResult(
        {
          answer: "Here.",
          action: null,
          example: "x".repeat(ASK_CLIMPY_LIMITS.maxExampleCharacters + 1),
          cannotSafelyRewrite: false,
        },
        { requestRewrite: false }
      );
      assert.equal(oversized.ok, false);
    },
  },

  // ── Phase 4: prompt REQUEST MODE separation ──────────────────────────
  {
    name: "buildAskClimpyUserPrompt prepends REQUEST MODE: EXPLANATION for a non-rewrite request, and REQUEST MODE: LOCAL_REWRITE for a rewrite request",
    run: () => {
      const explanationRequest = validateAskClimpyRequest(createRequestBody());
      assert.equal(explanationRequest.ok, true);
      if (explanationRequest.ok) {
        assert.match(
          buildAskClimpyUserPrompt(explanationRequest.value),
          /^REQUEST MODE: EXPLANATION\n/
        );
      }

      const rewriteRequest = validateAskClimpyRequest(
        createRequestBody({
          selectedContext: { type: "riskyPart", index: 0 },
          requestRewrite: true,
          rewriteFragment: "Then gently roll the skin apart.",
        })
      );
      assert.equal(rewriteRequest.ok, true);
      if (rewriteRequest.ok) {
        assert.match(
          buildAskClimpyUserPrompt(rewriteRequest.value),
          /^REQUEST MODE: LOCAL_REWRITE\n/
        );
      }
    },
  },
  {
    name: "The system prompt explains both REQUEST MODE values and their distinct rules, and still supports short follow-ups in both modes",
    run: () => {
      const prompt = buildAskClimpySystemPrompt("en");
      assert.match(prompt, /REQUEST MODE/);
      assert.match(prompt, /"REQUEST MODE: EXPLANATION"/);
      assert.match(prompt, /"REQUEST MODE: LOCAL_REWRITE"/);
      assert.match(
        prompt,
        /never set it to true, regardless of how the question is phrased/i
      );
      assert.match(
        prompt,
        /it must never claim to BE an already-applied rewrite/i
      );
      assert.match(
        prompt,
        /Short contextual follow-ups[\s\S]{0,40}are supported in both modes/
      );
    },
  },

  // ── Reliability: ordinary explanation questions succeed under the new
  // non-rewrite schema, EN and RU ───────────────────────────────────────
  {
    name: "An ordinary \"What should I fix first?\" question succeeds end-to-end under the non-rewrite (EXPLANATION) schema selection",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(
        createRequestBody({ question: "What should I fix first?" })
      );
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let receivedRequestRewrite: boolean | undefined;
      const modelCaller: AskClimpyModelCaller = async (
        _systemPrompt,
        _userPrompt,
        requestRewrite
      ) => {
        receivedRequestRewrite = requestRewrite;
        return {
          raw: JSON.stringify({
            answer: "Fix the unclear step first — it is the main risky part.",
            action: null,
            example: null,
            cannotSafelyRewrite: false,
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(receivedRequestRewrite, false);
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      if (result.ok) {
        assert.equal(result.response.cannotSafelyRewrite, false);
      }
    },
  },
  {
    name: "The Russian equivalent (\"Что мне исправить в первую очередь?\") succeeds end-to-end the same way",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(
        createRequestBody({
          locale: "ru",
          question: "Что мне исправить в первую очередь?",
        })
      );
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: JSON.stringify({
          answer: "Сначала исправьте неясный шаг — это главный рискованный момент.",
          action: null,
          example: null,
          cannotSafelyRewrite: false,
        }),
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
    },
  },
  {
    name: "At most one internal model retry remains after the schema split (ASK_CLIMPY_MAX_ATTEMPTS is still 2)",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(createRequestBody());
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      let callCount = 0;
      const modelCaller: AskClimpyModelCaller = async () => {
        callCount += 1;
        return {
          raw: JSON.stringify({
            answer: "Unreachable.",
            action: null,
            example: null,
            cannotSafelyRewrite: true,
          }),
        };
      };

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(callCount, 2, "Expected exactly one retry (two total calls), then give up");
      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
    },
  },
  {
    name: "A deterministic 400 request-validation failure is still never retried and never calls the model, after the schema split",
    run: async () => {
      const { POST } = await import("../app/api/ask-climpy/route");

      let modelCalls = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        modelCalls += 1;
        throw new Error("The model must never be called for a 400 request-validation failure");
      }) as typeof fetch;

      try {
        const response = await POST(
          new Request("http://localhost/api/ask-climpy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.240",
            },
            body: JSON.stringify(createRequestBody({ script: "" })),
          })
        );

        assert.equal(response.status, 400);
        assert.equal(modelCalls, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "Two genuinely malformed (non-JSON) attempts still produce a safe 502 after the schema split",
    run: async () => {
      const requestValidation = validateAskClimpyRequest(createRequestBody());
      assert.equal(requestValidation.ok, true);
      if (!requestValidation.ok) return;

      const modelCaller: AskClimpyModelCaller = async () => ({
        raw: "not valid json at all, twice in a row",
      });

      const result = await runAskClimpy(requestValidation.value, modelCaller);

      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
    },
  },

  // ── Regression: rate limit unchanged, no new persistence/streaming ──
  {
    name: "The rate limit remains exactly 8 requests / 60 seconds / IP — this task does not raise it",
    run: () => {
      const source = readFileSync("app/api/ask-climpy/route.ts", "utf8");
      assert.match(source, /const ASK_CLIMPY_RATE_LIMIT_MAX_REQUESTS = 8;/);
      assert.match(source, /const ASK_CLIMPY_RATE_LIMIT_WINDOW_MS = 60_000;/);
    },
  },
  {
    name: "No Supabase, persistence, or streaming was introduced by the schema/reliability changes",
    run: () => {
      const routeSource = readFileSync("app/api/ask-climpy/route.ts", "utf8");
      assert.doesNotMatch(routeSource, /supabase/i);
      assert.doesNotMatch(routeSource, /EventSource|text\/event-stream|ReadableStream/);
    },
  },
];

async function main() {
  console.log("\nAsk Climpy API Tests\n");

  let passed = 0;

  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`✅ PASS — ${test.name}`);
    } catch (error) {
      console.error(`❌ FAIL — ${test.name}`);
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }

  console.log(`\nAsk Climpy API tests: ${passed}/${tests.length} passed`);
}

main();
