import assert from "node:assert/strict";

import {
  ANALYSIS_V2_HOOK_STRONG_THRESHOLD,
  type AnalysisV2Result,
  type AnalysisV2SuccessResponse,
} from "../engine/analysis-v2-schema";
import {
  adaptAnalysisV2ForResults,
  checkAnalysisV2ResponseContract,
  isAnalysisV2SuccessResponse,
  parseAnalysisV2ResponseContract,
  parseStoredAnalysisV2,
} from "../engine/analysis-v2-ui-adapter";
import { buildAnalysisV2UnexpectedResponseLog, logAnalysisV2UnexpectedResponse } from "../engine/analysis-v2-diagnostics";

const strongScript =
  "If super glue gets stuck to your skin, do not pull it apart. First, soak the area in warm soapy water. Then gently roll the skin apart.";

const strongResult: AnalysisV2Result = {
  scriptType: "how_to",
  verdict: "strong",
  scores: {
    overall: 88,
    hook: 82,
    retentionRisk: 22,
  },
  hookDecision: "keep",
  hookAssessment:
    "The opening names the problem and immediately gives a useful warning.",
  riskyParts: [],
  suggestedFixes: [],
  scenes: [
    {
      excerpt:
        "If super glue gets stuck to your skin, do not pull it apart.",
      label: "Problem and warning",
      status: "strong",
    },
    {
      excerpt:
        "First, soak the area in warm soapy water.",
      label: "First step",
      status: "strong",
    },
    {
      excerpt: "Then gently roll the skin apart.",
      label: "Resolution",
      status: "strong",
    },
  ],
  mainTakeaway:
    "The script is focused, useful, and structurally strong.",
};

const strongResponse: AnalysisV2SuccessResponse = {
  status: "ok",
  result: strongResult,
  modelUsed: "test-model",
};

const mixedScript =
  "Start with a clear result. This middle line is vague and repeats itself. End with a specific payoff.";

const mixedResponse: AnalysisV2SuccessResponse = {
  status: "ok",
  modelUsed: "test-model",
  result: {
    scriptType: "explanation",
    verdict: "mixed",
    scores: {
      overall: 61,
      hook: 68,
      retentionRisk: 52,
    },
    hookDecision: "refine",
    hookAssessment:
      "The opening is understandable but could create more tension.",
    suggestedHook:
      "Start with the specific result before explaining why it happens.",
    riskyParts: [
      {
        excerpt:
          "This middle line is vague and repeats itself.",
        reason:
          "The middle loses momentum because it repeats an abstract point.",
        severity: "medium",
      },
      {
        excerpt:
          "End with a specific payoff.",
        reason:
          "The ending is usable but could be more concrete.",
        severity: "low",
      },
    ],
    suggestedFixes: [
      {
        target: "middle",
        suggestion:
          "Replace the vague middle line with one concrete mechanism.",
        optional: false,
      },
    ],
    scenes: [
      {
        excerpt: "Start with a clear result.",
        label: "Opening",
        status: "average",
      },
      {
        excerpt:
          "This middle line is vague and repeats itself.",
        label: "Weak middle",
        status: "risky",
      },
      {
        excerpt: "End with a specific payoff.",
        label: "Ending",
        status: "average",
      },
    ],
    mainTakeaway:
      "The script has a workable structure, but the middle needs more specificity.",
  },
};

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [
  {
    name: "accepts a valid success response",
    run: () => {
      assert.equal(
        isAnalysisV2SuccessResponse(
          strongResponse,
          strongScript
        ),
        true
      );
    },
  },
  {
    name: "rejects malformed stored JSON",
    run: () => {
      assert.equal(
        parseStoredAnalysisV2("{invalid", strongScript),
        null
      );
    },
  },
  {
    name: "checkAnalysisV2ResponseContract accepts a genuine success payload",
    run: () => {
      const result = checkAnalysisV2ResponseContract(
        strongResponse,
        strongScript
      );

      assert.equal(result.valid, true);
    },
  },
  {
    name: "checkAnalysisV2ResponseContract reports payload-not-object for null and arrays",
    run: () => {
      const nullResult = checkAnalysisV2ResponseContract(
        null,
        strongScript
      );
      const arrayResult = checkAnalysisV2ResponseContract(
        ["not", "an", "object"],
        strongScript
      );

      assert.equal(nullResult.valid, false);
      assert.equal(arrayResult.valid, false);

      if (!nullResult.valid) {
        assert.equal(
          nullResult.reason,
          "payload-not-object"
        );
      }

      if (!arrayResult.valid) {
        assert.equal(
          arrayResult.reason,
          "payload-not-object"
        );
      }
    },
  },
  {
    name: "checkAnalysisV2ResponseContract reports missing-status when the status field is absent",
    run: () => {
      const result = checkAnalysisV2ResponseContract(
        { modelUsed: "mock-model" },
        strongScript
      );

      assert.equal(result.valid, false);

      if (!result.valid) {
        assert.equal(result.reason, "missing-status");
      }
    },
  },
  {
    name: "checkAnalysisV2ResponseContract reports invalid-error-shape for a 200-shaped error body",
    run: () => {
      const result = checkAnalysisV2ResponseContract(
        {
          status: "error",
          reason: "Analysis V2 is temporarily unavailable.",
        },
        strongScript
      );

      assert.equal(result.valid, false);

      if (!result.valid) {
        assert.equal(result.reason, "invalid-error-shape");
      }
    },
  },
  {
    name: "checkAnalysisV2ResponseContract reports invalid-success-shape for a status:ok payload that fails the type guard",
    run: () => {
      const result = checkAnalysisV2ResponseContract(
        {
          status: "ok",
          // modelUsed empty makes this fail isAnalysisV2SuccessResponse
          // while still declaring status "ok".
          modelUsed: "",
          result: strongResponse.result,
        },
        strongScript
      );

      assert.equal(result.valid, false);

      if (!result.valid) {
        assert.equal(
          result.reason,
          "invalid-success-shape"
        );
      }
    },
  },
  {
    name: "parseAnalysisV2ResponseContract reports invalid-json for unparseable text",
    run: () => {
      const result = parseAnalysisV2ResponseContract(
        "{not valid json",
        strongScript
      );

      assert.equal(result.valid, false);

      if (!result.valid) {
        assert.equal(result.reason, "invalid-json");
      }
    },
  },
  {
    name: "parseAnalysisV2ResponseContract accepts valid JSON text matching the success contract",
    run: () => {
      const result = parseAnalysisV2ResponseContract(
        JSON.stringify(strongResponse),
        strongScript
      );

      assert.equal(result.valid, true);
    },
  },
  {
    name: "buildAnalysisV2UnexpectedResponseLog excludes script content and the full payload",
    run: () => {
      const sensitiveScript =
        "UNIQUE_SECRET_SCRIPT_TOKEN_98213_do_not_log";

      const payload = {
        status: "ok",
        modelUsed: "mock-model",
        result: {
          mainTakeaway: sensitiveScript,
        },
      };

      const entry = buildAnalysisV2UnexpectedResponseLog({
        endpoint: "/api/analyze-v2",
        httpStatus: 200,
        contentType: "application/json",
        uiLocale: "ru",
        reason: "invalid-success-shape",
        payload,
        requestId: "test-request-id",
        retryCount: 0,
      });

      const serialized = JSON.stringify(entry);

      assert.equal(
        serialized.includes(sensitiveScript),
        false
      );
      assert.deepEqual(
        [...entry.payloadKeys].sort(),
        ["modelUsed", "result", "status"].sort()
      );
      assert.equal(entry.payloadStatus, "ok");
      assert.equal(entry.reason, "invalid-success-shape");
      assert.equal(entry.httpStatus, 200);
      assert.equal(entry.uiLocale, "ru");
      assert.equal(entry.requestId, "test-request-id");
      assert.equal(entry.retryCount, 0);
    },
  },
  {
    name: "logAnalysisV2UnexpectedResponse logs exactly one structured entry derived from the same builder",
    run: () => {
      const originalConsoleError = console.error;
      const calls: unknown[][] = [];

      console.error = (...args: unknown[]) => {
        calls.push(args);
      };

      try {
        logAnalysisV2UnexpectedResponse({
          endpoint: "/api/analyze-v2",
          httpStatus: 200,
          contentType: "application/json",
          uiLocale: "en",
          reason: "invalid-success-shape",
          payload: {
            status: "ok",
            modelUsed: "m",
            result: {},
          },
          requestId: "abc-123",
          retryCount: 1,
        });
      } finally {
        console.error = originalConsoleError;
      }

      assert.equal(calls.length, 1);

      const [, loggedEntry] = calls[0];

      assert.deepEqual(
        loggedEntry,
        buildAnalysisV2UnexpectedResponseLog({
          endpoint: "/api/analyze-v2",
          httpStatus: 200,
          contentType: "application/json",
          uiLocale: "en",
          reason: "invalid-success-shape",
          payload: {
            status: "ok",
            modelUsed: "m",
            result: {},
          },
          requestId: "abc-123",
          retryCount: 1,
        })
      );
    },
  },
  {
    name: "rejects stored analysis for a different script",
    run: () => {
      assert.equal(
        parseStoredAnalysisV2(
          JSON.stringify(strongResponse),
          "A completely different script."
        ),
        null
      );
    },
  },
  {
    name: "old saved analysis without a locale field still parses and is treated as en",
    run: () => {
      // strongResponse has no `locale` key at all — simulates an analysis
      // saved before this feature existed.
      assert.equal("locale" in strongResponse, false);

      const parsed = parseStoredAnalysisV2(
        JSON.stringify(strongResponse),
        strongScript
      );

      assert.notEqual(parsed, null);
      assert.equal(parsed!.locale, undefined);
      assert.equal(parsed!.locale ?? "en", "en");
    },
  },
  {
    name: "a stored ru analysis round-trips its locale",
    run: () => {
      const ruResponse: AnalysisV2SuccessResponse = {
        ...strongResponse,
        locale: "ru",
      };

      assert.equal(
        isAnalysisV2SuccessResponse(ruResponse, strongScript),
        true
      );

      const parsed = parseStoredAnalysisV2(
        JSON.stringify(ruResponse),
        strongScript
      );

      assert.notEqual(parsed, null);
      assert.equal(parsed!.locale, "ru");
    },
  },
  {
    // Regression test for a real reported bug: a genuinely valid ru
    // AnalysisV2 result with an overall score below 80 was rejected by
    // isAnalysisV2SuccessResponse/parseStoredAnalysisV2 because both
    // called validateAnalysisV2Result without the response's own locale,
    // silently defaulting to "en". The below-80 mainTakeaway check is
    // locale-gated (it matches component/limitation terms in the
    // takeaway text), so a correct Russian mainTakeaway was checked
    // against English-only term tables and failed to match — the
    // *strong* ru fixture above (score 88) never exercises this branch,
    // which is exactly why it didn't already catch this.
    name: "ru: a below-80 result is accepted by isAnalysisV2SuccessResponse, not rejected under the en default",
    run: () => {
      const belowEightyScript =
        "Success is very important in life. Many people want to become successful, but they do not know what to do. You should work hard, believe in yourself, and never give up.";

      const belowEightyRuResult: AnalysisV2Result = {
        scriptType: "generic_advice",
        verdict: "mixed",
        scores: { overall: 58, hook: 70, retentionRisk: 55 },
        scoreBreakdown: {
          overall: {
            premiseAppeal: 13,
            openingPromise: 15,
            progression: 15,
            payoff: 15,
          },
          hook: {
            immediacy: 18,
            specificity: 17,
            viewerPull: 17,
            deliveryAlignment: 18,
          },
          retentionRisk: {
            openingFriction: 14,
            progressionRisk: 14,
            predictabilityRisk: 13,
            payoffRisk: 14,
          },
        },
        hookDecision: "diagnostic",
        hookAssessment: "Хук ставит тему сразу и понятен.",
        riskyParts: [
          {
            excerpt:
              "Many people want to become successful, but they do not know what to do.",
            reason:
              "Эта идея звучит очень обобщённо и не создаёт конкретного любопытства.",
            severity: "medium",
          },
        ],
        suggestedFixes: [
          {
            target: "clarity",
            suggestion:
              "Сделайте совет более конкретным, добавив один пример из личного опыта.",
            optional: false,
          },
        ],
        scenes: [
          {
            excerpt: belowEightyScript,
            label: "Общий совет",
            status: "average",
          },
        ],
        mainTakeaway:
          "Сценарий понятен, но привлекательность идеи ограничивает общую оценку, потому что идея слабо привлекает аудиторию.",
      };

      const belowEightyRuResponse: AnalysisV2SuccessResponse = {
        status: "ok",
        modelUsed: "test-model",
        locale: "ru",
        result: belowEightyRuResult,
      };

      // The exact function app/page.tsx calls right after a 200 response,
      // before storing the analysis and navigating to /results.
      assert.equal(
        isAnalysisV2SuccessResponse(
          belowEightyRuResponse,
          belowEightyScript
        ),
        true,
        "a genuinely valid ru result with overall < 80 must not be rejected"
      );
    },
  },
  {
    name: "ru: the same below-80 result round-trips through parseStoredAnalysisV2 without being wrongly rejected",
    run: () => {
      const belowEightyScript =
        "Success is very important in life. Many people want to become successful, but they do not know what to do. You should work hard, believe in yourself, and never give up.";

      const belowEightyRuResponse: AnalysisV2SuccessResponse = {
        status: "ok",
        modelUsed: "test-model",
        locale: "ru",
        result: {
          scriptType: "generic_advice",
          verdict: "mixed",
          scores: { overall: 58, hook: 70, retentionRisk: 55 },
          scoreBreakdown: {
            overall: {
              premiseAppeal: 13,
              openingPromise: 15,
              progression: 15,
              payoff: 15,
            },
            hook: {
              immediacy: 18,
              specificity: 17,
              viewerPull: 17,
              deliveryAlignment: 18,
            },
            retentionRisk: {
              openingFriction: 14,
              progressionRisk: 14,
              predictabilityRisk: 13,
              payoffRisk: 14,
            },
          },
          hookDecision: "diagnostic",
          hookAssessment: "Хук ставит тему сразу и понятен.",
          riskyParts: [
            {
              excerpt:
                "Many people want to become successful, but they do not know what to do.",
              reason:
                "Эта идея звучит очень обобщённо и не создаёт конкретного любопытства.",
              severity: "medium",
            },
          ],
          suggestedFixes: [
            {
              target: "clarity",
              suggestion:
                "Сделайте совет более конкретным, добавив один пример из личного опыта.",
              optional: false,
            },
          ],
          scenes: [
            {
              excerpt: belowEightyScript,
              label: "Общий совет",
              status: "average",
            },
          ],
          mainTakeaway:
            "Сценарий понятен, но привлекательность идеи ограничивает общую оценку, потому что идея слабо привлекает аудиторию.",
        },
      };

      // Same path the /results page uses to load a saved analysis from
      // sessionStorage.
      const parsed = parseStoredAnalysisV2(
        JSON.stringify(belowEightyRuResponse),
        belowEightyScript
      );

      assert.notEqual(
        parsed,
        null,
        "a genuinely valid stored ru result with overall < 80 must not parse as null"
      );
      assert.equal(parsed!.locale, "ru");
      assert.equal(
        parsed!.result.mainTakeaway,
        "Сценарий понятен, но привлекательность идеи ограничивает общую оценку, потому что идея слабо привлекает аудиторию."
      );
    },
  },
  {
    name: "adapts scores and main takeaway",
    run: () => {
      const adapted = adaptAnalysisV2ForResults(
        strongResponse,
        strongScript,
        [
          "If super glue gets stuck to your skin, do not pull it apart.",
          "First, soak the area in warm soapy water.",
          "Then gently roll the skin apart.",
        ],
        12
      );

      assert.equal(adapted.overall.score, 88);
      assert.equal(adapted.hook.score, 82);
      assert.equal(adapted.risk.score, 22);
      assert.equal(
        adapted.overall.description,
        strongResult.mainTakeaway
      );
      assert.equal(adapted.mainTakeaway, strongResult.mainTakeaway);
      assert.equal(adapted.suggestedHook, "");
      assert.deepEqual(adapted.riskyLineIndexes, []);
      assert.deepEqual(adapted.warningLineIndexes, []);
    },
  },
  {
    name: "hook label uses the centralized Strong threshold — a normalized (post-validation) below-threshold score never renders as Strong, and no separate UI-only workaround hides a server inconsistency",
    run: () => {
      const belowThresholdResult: AnalysisV2Result = {
        ...strongResult,
        scores: {
          ...strongResult.scores,
          hook: ANALYSIS_V2_HOOK_STRONG_THRESHOLD - 1,
        },
      };

      const atThresholdResult: AnalysisV2Result = {
        ...strongResult,
        scores: {
          ...strongResult.scores,
          hook: ANALYSIS_V2_HOOK_STRONG_THRESHOLD,
        },
      };

      const belowAdapted = adaptAnalysisV2ForResults(
        {
          status: "ok",
          result: belowThresholdResult,
          modelUsed: "test-model",
        },
        strongScript,
        [strongScript],
        12
      );

      const atAdapted = adaptAnalysisV2ForResults(
        {
          status: "ok",
          result: atThresholdResult,
          modelUsed: "test-model",
        },
        strongScript,
        [strongScript],
        12
      );

      assert.notEqual(belowAdapted.hook.label, "Strong");
      assert.equal(atAdapted.hook.label, "Strong");
    },
  },
  {
    name: "maps medium and low risks to line indexes",
    run: () => {
      const adapted = adaptAnalysisV2ForResults(
        mixedResponse,
        mixedScript,
        [
          "Start with a clear result.",
          "This middle line is vague and repeats itself.",
          "End with a specific payoff.",
        ],
        10
      );

      assert.deepEqual(adapted.riskyLineIndexes, [1]);
      assert.deepEqual(adapted.warningLineIndexes, [2]);
      assert.equal(adapted.riskyParts.length, 2);
      assert.equal(adapted.fixes.length, 1);
      assert.equal(
        adapted.suggestedHook,
        mixedResponse.result.suggestedHook
      );
    },
  },
  {
    name: "ru: riskyParts[].title is localized via the response's own locale, not the raw AI text",
    run: () => {
      const ruMixedResponse: AnalysisV2SuccessResponse = {
        ...mixedResponse,
        locale: "ru",
      };

      const adapted = adaptAnalysisV2ForResults(
        ruMixedResponse,
        mixedScript,
        [
          "Start with a clear result.",
          "This middle line is vague and repeats itself.",
          "End with a specific payoff.",
        ],
        10
      );

      assert.equal(adapted.riskyParts.length, 2);
      assert.equal(
        adapted.riskyParts[0].title,
        "Возможная точка оттока."
      );
      assert.equal(
        adapted.riskyParts[1].title,
        "Незначительный риск удержания."
      );
      // The AI-authored reason is untouched by this locale mapping — it is
      // only as localized as the AI actually made it.
      assert.equal(
        adapted.riskyParts[0].description,
        mixedResponse.result.riskyParts[0].reason
      );
    },
  },
  {
    name: "ru: risk fallback description (no riskyParts) is localized instead of English",
    run: () => {
      const ruStrongResponse: AnalysisV2SuccessResponse = {
        ...strongResponse,
        locale: "ru",
      };

      const adapted = adaptAnalysisV2ForResults(
        ruStrongResponse,
        strongScript,
        [
          "If super glue gets stuck to your skin, do not pull it apart.",
          "First, soak the area in warm soapy water.",
          "Then gently roll the skin apart.",
        ],
        12
      );

      // strongResult has retentionRisk: 22 and no riskyParts, so this hits
      // the deterministic "low" fallback description.
      assert.equal(
        adapted.risk.description,
        "Низкий риск удержания. Сценарий остаётся сфокусированным и сохраняет чёткое развитие."
      );
    },
  },
  {
    name: "en flow is unchanged: risk title and fallback description stay English by default",
    run: () => {
      const adapted = adaptAnalysisV2ForResults(
        mixedResponse,
        mixedScript,
        [
          "Start with a clear result.",
          "This middle line is vague and repeats itself.",
          "End with a specific payoff.",
        ],
        10
      );

      assert.equal(
        adapted.riskyParts[0].title,
        "Potential drop-off point."
      );
      assert.equal(
        adapted.riskyParts[1].title,
        "Minor retention risk."
      );
    },
  },
      {
        name: "dedupes semantically overlapping suggested fixes for results UI",
        run: () => {
          const duplicatedFixResponse: AnalysisV2SuccessResponse = {
            ...mixedResponse,
            result: {
              ...mixedResponse.result,
              suggestedFixes: [
                {
                  target: "hook",
                  suggestion:
                    "Rewrite the opening around one specific visual consequence.",
                  optional: false,
                },
                {
                  target: "hook",
                  suggestion:
                    "Open with the specific visual consequence before explaining the setup.",
                  optional: false,
                },
                {
                  target: "payoff",
                  suggestion:
                    "End with a clearer payoff that rewards the viewer.",
                  optional: false,
                },
              ],
            },
          };

          const adapted = adaptAnalysisV2ForResults(
            duplicatedFixResponse,
            mixedScript,
            [
              "Start with a clear result.",
              "This middle line is vague and repeats itself.",
              "End with a specific payoff.",
            ],
            10
          );

          assert.deepEqual(adapted.fixes, [
            "Rewrite the opening around one specific visual consequence.",
            "End with a clearer payoff that rewards the viewer.",
          ]);
        },
      },
    {
      name: "keeps score breakdown optional for legacy results",
      run: () => {
        const adapted =
          adaptAnalysisV2ForResults(
            mixedResponse,
            mixedScript,
            [mixedScript],
            10
          );

        assert.equal(
          adapted.scoreBreakdown,
          undefined
        );
      },
    },
    {
      name: "adapts score breakdown into user-facing groups",
      run: () => {
        const responseWithBreakdown:
          AnalysisV2SuccessResponse = {
            ...mixedResponse,
            result: {
              ...mixedResponse.result,
              scoreBreakdown: {
                overall: {
                  premiseAppeal: 15,
                  openingPromise: 15,
                  progression: 15,
                  payoff: 16,
                },
                hook: {
                  immediacy: 17,
                  specificity: 17,
                  viewerPull: 17,
                  deliveryAlignment: 17,
                },
                retentionRisk: {
                  openingFriction: 13,
                  progressionRisk: 13,
                  predictabilityRisk: 13,
                  payoffRisk: 13,
                },
              },
            },
          };

        const adapted =
          adaptAnalysisV2ForResults(
            responseWithBreakdown,
            mixedScript,
            [mixedScript],
            10
          );

        const breakdown =
          adapted.scoreBreakdown;

        assert.ok(breakdown);

        assert.equal(
          breakdown.overall.title,
          "Overall Score"
        );
        assert.equal(
          breakdown.overall.total,
          mixedResponse.result.scores.overall
        );
        assert.deepEqual(
          breakdown.overall.items.map(
            (item) => [
              item.label,
              item.score,
              item.maxScore,
            ]
          ),
          [
            ["Premise Appeal", 15, 25],
            ["Opening Promise", 15, 25],
            ["Progression", 15, 25],
            ["Payoff", 16, 25],
          ]
        );

        assert.equal(
          breakdown.hook.items[2].label,
          "Viewer Pull"
        );
        assert.equal(
          breakdown.hook.items[2].score,
          17
        );

        assert.equal(
          breakdown.risk.direction,
          "higher-is-riskier"
        );
        assert.equal(
          breakdown.risk.items[0].label,
          "Opening Friction"
        );
        assert.equal(
          breakdown.risk.items[0].score,
          13
        );
      },
    },
  {
    name: "mixed verdict overrides a strong score label",
    run: () => {
      const highMixedResponse: AnalysisV2SuccessResponse = {
        ...mixedResponse,
        result: {
          ...mixedResponse.result,
          scores: {
            ...mixedResponse.result.scores,
            overall: 75,
          },
        },
      };

      const adapted = adaptAnalysisV2ForResults(
        highMixedResponse,
        mixedScript,
        [
          "Start with a clear result.",
          "This middle line is vague and repeats itself.",
          "End with a specific payoff.",
        ],
        10
      );

      assert.equal(adapted.overall.label, "Mixed");
    },
  },
  {
    name: "mixed verdict overrides a green score color",
    run: () => {
      const highMixedResponse: AnalysisV2SuccessResponse = {
        ...mixedResponse,
        result: {
          ...mixedResponse.result,
          scores: {
            ...mixedResponse.result.scores,
            overall: 75,
          },
        },
      };

      const adapted = adaptAnalysisV2ForResults(
        highMixedResponse,
        mixedScript,
        [
          "Start with a clear result.",
          "This middle line is vague and repeats itself.",
          "End with a specific payoff.",
        ],
        10
      );

      assert.equal(adapted.overall.ringColor, "#F59E0B");
    },
  },
  {
    name: "creates scene widths that exactly fill the bar",
    run: () => {
      const adapted = adaptAnalysisV2ForResults(
        mixedResponse,
        mixedScript,
        [
          "Start with a clear result.",
          "This middle line is vague and repeats itself.",
          "End with a specific payoff.",
        ],
        10
      );

      const totalWidth = adapted.sceneSegments.reduce(
        (sum, segment) => sum + segment.width,
        0
      );

      assert.equal(totalWidth, 1110);
      assert.equal(adapted.sceneSegments.length, 3);
      assert.deepEqual(
        adapted.sceneSegments.map((segment) => segment.color),
        ["#F59E0B", "#EF4444", "#F59E0B"]
      );
    },
  },

  {
    name: "returns the normalized result when loading stored analysis",
    run: () => {
      const storedScript =
        "Start with a clear result. Explain why viewers should care. This middle line is vague and repeats itself. End with a specific payoff.";

      const staleResponse: AnalysisV2SuccessResponse = {
        status: "ok",
        modelUsed: "old-model",
        result: {
          scriptType: "explanation",
          verdict: "mixed",
          scores: {
            overall: 61,
            hook: 68,
            retentionRisk: 52,
          },
          hookDecision: "refine",
          hookAssessment:
            "The opening is clear, but the middle needs more specificity.",
          suggestedHook:
            "Start with the specific result before explaining why it happens.",
          riskyParts: [
            {
              excerpt:
                "This middle line is vague and repeats itself.",
              reason:
                "The middle loses momentum because it repeats an abstract point.",
              severity: "medium",
            },
          ],
          suggestedFixes: [
            {
              target: "middle",
              suggestion:
                "Replace the vague middle line with one concrete mechanism.",
              optional: false,
            },
          ],
          scenes: [
            {
              excerpt: "Start with a clear result.",
              label: "Opening",
              status: "average",
            },
            {
              excerpt:
                "This middle line is vague and repeats itself.",
              label: "Weak middle",
              status: "risky",
            },
            {
              excerpt: "End with a specific payoff.",
              label: "Ending",
              status: "average",
            },
          ],
          mainTakeaway:
            "The script has a workable structure, but the middle needs more specificity.",
        },
      };

      const parsed = parseStoredAnalysisV2(
        JSON.stringify(staleResponse),
        storedScript
      );

      assert.ok(parsed);
      assert.equal(parsed.result.hookDecision, "keep");
      assert.equal(parsed.result.suggestedHook, undefined);
    },
  },
];

console.log("\nAnalysis V2 UI Adapter Tests\n");

let failures = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`✅ PASS — ${test.name}`);
  } catch (error) {
    failures += 1;
    console.error(`❌ FAIL — ${test.name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length}/${tests.length} tests passed.\n`);
}
