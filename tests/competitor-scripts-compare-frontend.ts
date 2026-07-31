import { readFileSync } from "node:fs";
import { getMessages } from "../lib/messages";
import { LAUNCHED_LOCALES } from "../lib/i18n";
import {
  COMPARE_RESULT_STORAGE_KEY,
  isValidCompareSuccessPayload,
  validateStoredCompareResult,
} from "../lib/competitor-scripts/compare-result-storage";
import {
  COMPARISON_DIMENSIONS,
  type ComparisonLocale,
  type CompetitorScriptComparison,
  type GapLevel,
  type StrongerSide,
} from "../lib/competitor-scripts/comparison/types";
import {
  MAX_CAUTIONS,
  MAX_PRIORITIES,
} from "../lib/competitor-scripts/comparison/constants";
import { selectFeaturedDimension } from "../lib/competitor-scripts/compare-featured-dimension";

let failures = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    console.log(`✅ PASS — ${name}`);
  } else {
    console.error(`❌ FAIL — ${name}`);
    failures += 1;
  }
}

console.log("\nCompetitor Scripts Compare Frontend Tests\n");

// Used only when a check must scan for the absence of a word/phrase in
// actual code — explanatory comments in this codebase legitimately discuss
// what a file does NOT do, which would otherwise self-trigger a naive
// substring/regex check.
function stripComments(source: string): string {
  return source.replace(/\/\/.*$/gm, "");
}

// ── Fixtures ────────────────────────────────────────────────────────────
// This lightweight transport guard never re-runs grounding, so — unlike
// tests/competitor-scripts-comparison-{provider,api}.ts's own fixtures —
// the excerpt/prose text here doesn't need to satisfy the real semantic
// validator (no claim-pattern/quote/number checks apply at this layer).
// Only shape matters.

function makeDimensionFinding(
  dimension: (typeof COMPARISON_DIMENSIONS)[number],
  strongerSide: StrongerSide,
  gap: GapLevel | null
) {
  return {
    dimension,
    strongerSide,
    gap,
    conclusion: `Conclusion for ${dimension}.`,
    userObservation: `User observation for ${dimension}.`,
    competitorObservation: `Competitor observation for ${dimension}.`,
    evidence: {
      user: { source: "user" as const, excerpt: `user excerpt ${dimension}` },
      competitor: {
        source: "competitor" as const,
        excerpt: `competitor excerpt ${dimension}`,
        startMs: 1000,
        endMs: 2000,
      },
    },
  };
}

function makeValidComparison(
  locale: ComparisonLocale,
  cautionCount: 0 | 1 = 1
): CompetitorScriptComparison {
  return {
    schemaVersion: 1,
    locale,
    comparisonSummary: { headline: "Headline text.", mainTakeaway: "Main takeaway text." },
    dimensionFindings: [
      makeDimensionFinding("hook", "competitor", "meaningful"),
      makeDimensionFinding("structure", "similar", null),
      makeDimensionFinding("momentum", "user", "small"),
      makeDimensionFinding("payoff_clarity", "competitor", "large"),
    ],
    priorities: [
      {
        rank: 1,
        problem: "Problem text.",
        competitorPrinciple: "Competitor principle text.",
        howToApply: "How to apply text.",
        evidence: {
          user: { source: "user", excerpt: "priority user excerpt" },
          competitor: {
            source: "competitor",
            excerpt: "priority competitor excerpt",
            startMs: 3000,
            endMs: null,
          },
        },
      },
    ],
    cautions:
      cautionCount === 0
        ? []
        : [
            {
              whatNotToCopy: "What not to copy.",
              reason: "Reason text.",
              evidence: {
                competitor: {
                  source: "competitor",
                  excerpt: "caution excerpt",
                  startMs: 500,
                  endMs: 1500,
                },
                user: null,
              },
            },
          ],
  };
}

const VALID_SOURCE_META = {
  videoId: "dQw4w9WgXcQ",
  canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  durationMs: 18000,
  userScriptCharacterCount: 240,
};

function cloneComparison(locale: ComparisonLocale = "en", cautionCount: 0 | 1 = 1) {
  return JSON.parse(JSON.stringify(makeValidComparison(locale, cautionCount)));
}

function validStoredResult(): Record<string, unknown> {
  return {
    v: 1,
    createdAt: 1_700_000_000_000,
    comparison: cloneComparison("en", 1),
    sourceMeta: { ...VALID_SOURCE_META },
  };
}

// ── Transport guard: validateStoredCompareResult / isValidCompareSuccessPayload ─

function testTransportGuard() {
  check(
    "a fully valid stored result passes and round-trips every field",
    (() => {
      const result = validateStoredCompareResult(validStoredResult());
      return (
        result !== null &&
        result.v === 1 &&
        result.comparison.locale === "en" &&
        result.sourceMeta.videoId === VALID_SOURCE_META.videoId
      );
    })()
  );

  check("null/undefined/primitive input is rejected, never throws", validateStoredCompareResult(null) === null && validateStoredCompareResult(undefined) === null && validateStoredCompareResult("string") === null && validateStoredCompareResult(42) === null);

  check(
    "wrong transport version is rejected",
    validateStoredCompareResult({ ...validStoredResult(), v: 2 }) === null
  );

  check(
    "missing/non-numeric createdAt is rejected",
    validateStoredCompareResult({ ...validStoredResult(), createdAt: "not-a-number" }) === null
  );

  check(
    "missing comparison field entirely is rejected",
    (() => {
      const value = validStoredResult();
      delete value.comparison;
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "comparison.schemaVersion !== 1 is rejected",
    (() => {
      const value = validStoredResult();
      (value.comparison as Record<string, unknown>).schemaVersion = 2;
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "an unsupported comparison.locale is rejected",
    (() => {
      const value = validStoredResult();
      (value.comparison as Record<string, unknown>).locale = "fr";
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "a valid ru comparison locale is accepted",
    (() => {
      const value = { ...validStoredResult(), comparison: cloneComparison("ru", 1) };
      return validateStoredCompareResult(value) !== null;
    })()
  );

  check(
    "missing comparisonSummary.headline is rejected",
    (() => {
      const value = validStoredResult();
      delete (value.comparison as Record<string, Record<string, unknown>>).comparisonSummary.headline;
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "a dimensionFindings array with the wrong count (3 instead of 4) is rejected",
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, unknown[]>;
      comparison.dimensionFindings = comparison.dimensionFindings.slice(0, 3);
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "dimensionFindings out of the fixed hook/structure/momentum/payoff_clarity order is rejected",
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, unknown[]>;
      const [first, second, ...rest] = comparison.dimensionFindings;
      comparison.dimensionFindings = [second, first, ...rest];
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "an invalid strongerSide value is rejected",
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, Array<Record<string, unknown>>>;
      comparison.dimensionFindings[0].strongerSide = "everyone";
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "gap non-null when strongerSide is similar is rejected",
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, Array<Record<string, unknown>>>;
      comparison.dimensionFindings[1].gap = "small";
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "gap null when strongerSide is not similar is rejected",
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, Array<Record<string, unknown>>>;
      comparison.dimensionFindings[0].gap = null;
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "an invalid gap enum value is rejected",
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, Array<Record<string, unknown>>>;
      comparison.dimensionFindings[0].gap = "enormous";
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "user evidence with the wrong source discriminator is rejected",
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, Array<Record<string, Record<string, Record<string, unknown>>>>>;
      comparison.dimensionFindings[0].evidence.user.source = "competitor";
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "competitor evidence with a negative startMs is rejected",
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, Array<Record<string, Record<string, Record<string, unknown>>>>>;
      comparison.dimensionFindings[0].evidence.competitor.startMs = -100;
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "competitor evidence with a null endMs is accepted (endMs is required-but-nullable)",
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, Array<Record<string, Record<string, Record<string, unknown>>>>>;
      comparison.dimensionFindings[0].evidence.competitor.endMs = null;
      return validateStoredCompareResult(value) !== null;
    })()
  );

  check(
    "competitor evidence with a negative endMs is rejected",
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, Array<Record<string, Record<string, Record<string, unknown>>>>>;
      comparison.dimensionFindings[0].evidence.competitor.endMs = -5;
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    `priorities beyond the max (${MAX_PRIORITIES}) count is rejected`,
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, unknown[]>;
      const extra = comparison.priorities[0];
      comparison.priorities = Array.from({ length: MAX_PRIORITIES + 1 }, () => JSON.parse(JSON.stringify(extra)));
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "an empty priorities array (below the minimum) is rejected",
    (() => {
      const value = validStoredResult();
      const comparison = value.comparison as Record<string, unknown[]>;
      comparison.priorities = [];
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    `cautions beyond the max (${MAX_CAUTIONS}) count is rejected`,
    (() => {
      const value = { ...validStoredResult(), comparison: cloneComparison("en", 1) };
      const comparison = value.comparison as Record<string, unknown[]>;
      const extra = comparison.cautions[0];
      comparison.cautions = Array.from({ length: MAX_CAUTIONS + 1 }, () => JSON.parse(JSON.stringify(extra)));
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "zero cautions (empty array) is accepted as valid",
    (() => {
      const value = { ...validStoredResult(), comparison: cloneComparison("en", 0) };
      return validateStoredCompareResult(value) !== null;
    })()
  );

  check(
    "a caution with evidence.user entirely absent (not even null) is rejected — a required key can never be silently omitted",
    (() => {
      const value = { ...validStoredResult(), comparison: cloneComparison("en", 1) };
      const comparison = value.comparison as Record<string, Array<Record<string, Record<string, unknown>>>>;
      delete comparison.cautions[0].evidence.user;
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "a caution with a real (non-null) evidence.user object is accepted",
    (() => {
      const value = { ...validStoredResult(), comparison: cloneComparison("en", 1) };
      const comparison = value.comparison as Record<string, Array<Record<string, Record<string, unknown>>>>;
      comparison.cautions[0].evidence.user = { source: "user", excerpt: "a real user excerpt" };
      return validateStoredCompareResult(value) !== null;
    })()
  );

  check(
    "a missing/invalid sourceMeta.videoId is rejected",
    (() => {
      const value = validStoredResult();
      (value.sourceMeta as Record<string, unknown>).videoId = "not-11-chars";
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "a sourceMeta.canonicalUrl whose embedded videoId disagrees with sourceMeta.videoId is rejected",
    (() => {
      const value = validStoredResult();
      (value.sourceMeta as Record<string, unknown>).canonicalUrl =
        "https://www.youtube.com/watch?v=AAAAAAAAAAA";
      return validateStoredCompareResult(value) === null;
    })()
  );

  check(
    "a negative sourceMeta.durationMs is rejected, but null is accepted",
    (() => {
      const negative = validStoredResult();
      (negative.sourceMeta as Record<string, unknown>).durationMs = -1;
      const nullDuration = validStoredResult();
      (nullDuration.sourceMeta as Record<string, unknown>).durationMs = null;
      return (
        validateStoredCompareResult(negative) === null &&
        validateStoredCompareResult(nullDuration) !== null
      );
    })()
  );

  check(
    "a negative sourceMeta.userScriptCharacterCount is rejected",
    (() => {
      const value = validStoredResult();
      (value.sourceMeta as Record<string, unknown>).userScriptCharacterCount = -1;
      return validateStoredCompareResult(value) === null;
    })()
  );

  // ── isValidCompareSuccessPayload (fresh API response, pre-storage) ──

  check(
    "a valid {ok:true, comparison, sourceMeta} API response passes the payload guard",
    isValidCompareSuccessPayload({
      ok: true,
      comparison: cloneComparison("en", 1),
      sourceMeta: { ...VALID_SOURCE_META },
    })
  );

  check(
    "an {ok:false, ...} response never passes the payload guard, even with an otherwise-valid comparison shape",
    !isValidCompareSuccessPayload({
      ok: false,
      comparison: cloneComparison("en", 1),
      sourceMeta: { ...VALID_SOURCE_META },
    })
  );

  check(
    "a response missing the ok discriminator entirely is rejected",
    !isValidCompareSuccessPayload({
      comparison: cloneComparison("en", 1),
      sourceMeta: { ...VALID_SOURCE_META },
    })
  );
}

// ── sessionStorage round-trip ──────────────────────────────────────────

function testStorageRoundTrip() {
  class FakeSessionStorage {
    private store = new Map<string, string>();
    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null;
    }
    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    clear(): void {
      this.store.clear();
    }
  }

  return (async () => {
    const fakeStorage = new FakeSessionStorage();
    (globalThis as { sessionStorage?: unknown }).sessionStorage = fakeStorage;

    const { readStoredCompareResult, writeStoredCompareResult } = await import(
      "../lib/competitor-scripts/compare-result-storage"
    );

    check(
      "reading with nothing stored returns null, never throws",
      readStoredCompareResult() === null
    );

    fakeStorage.setItem(COMPARE_RESULT_STORAGE_KEY, "{not valid json");
    check(
      "reading malformed JSON returns null, never throws",
      readStoredCompareResult() === null
    );

    fakeStorage.setItem(COMPARE_RESULT_STORAGE_KEY, JSON.stringify({ v: 1, tampered: true }));
    check(
      "reading a structurally-invalid-but-valid-JSON value returns null",
      readStoredCompareResult() === null
    );

    writeStoredCompareResult({
      comparison: cloneComparison("en", 1),
      sourceMeta: { ...VALID_SOURCE_META },
    });
    const roundTripped = readStoredCompareResult();
    check(
      "a value written by writeStoredCompareResult reads back valid, with every field intact",
      roundTripped !== null &&
        roundTripped.v === 1 &&
        roundTripped.comparison.locale === "en" &&
        roundTripped.sourceMeta.videoId === VALID_SOURCE_META.videoId &&
        roundTripped.sourceMeta.userScriptCharacterCount === VALID_SOURCE_META.userScriptCharacterCount
    );

    check(
      "the persisted raw JSON never contains a userScript, transcript, raw, or modelUsed key — only v/createdAt/comparison/sourceMeta",
      (() => {
        const raw = fakeStorage.getItem(COMPARE_RESULT_STORAGE_KEY);
        if (raw === null) return false;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return (
          JSON.stringify(Object.keys(parsed).sort()) ===
            JSON.stringify(["comparison", "createdAt", "sourceMeta", "v"].sort()) &&
          // The exact raw-script key, not a bare substring match — the
          // approved sourceMeta.userScriptCharacterCount field legitimately
          // contains "userScript" as a substring of its own name.
          !raw.includes('"userScript":') &&
          !raw.includes("transcript") &&
          !raw.includes("modelUsed") &&
          !("raw" in parsed)
        );
      })()
    );

    writeStoredCompareResult({
      comparison: cloneComparison("ru", 0),
      sourceMeta: { ...VALID_SOURCE_META, videoId: "dQw4w9WgXcR", canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcR" },
    });
    const overwritten = readStoredCompareResult();
    check(
      "a new successful write overwrites the previous stored result rather than merging with it",
      overwritten !== null &&
        overwritten.sourceMeta.videoId === "dQw4w9WgXcR" &&
        overwritten.comparison.locale === "ru" &&
        overwritten.comparison.cautions.length === 0
    );

    check(
      "storage-unavailable (getItem throws) is handled without throwing",
      (() => {
        const throwingStorage = {
          getItem: () => {
            throw new Error("storage disabled");
          },
        };
        (globalThis as { sessionStorage?: unknown }).sessionStorage = throwingStorage;
        const result = readStoredCompareResult();
        (globalThis as { sessionStorage?: unknown }).sessionStorage = fakeStorage;
        return result === null;
      })()
    );
  })();
}

// ── positioning copy: Compare must never read as a contest/scoreboard ──
// Per docs/product/compare/CONSTITUTION.md ("Not a competition or a
// scoreboard. No scores, no rankings, no declared winner" / "There are no
// winners"). Scoped only to the two copy subtrees that actually carry
// Compare's pitch (the mode-selection card and the pre-submission
// "planned stages" workflow) — not the whole messages file, since
// unrelated Analyze retention copy legitimately uses "lose" (as in "lose
// interest") and must not be flagged.
function testNoCompetitiveFraming() {
  const FORBIDDEN_EN: RegExp[] = [
    /\bwins?\b/i,
    /\bwinning\b/i,
    /\bloses?\b/i,
    /\blost\b/i,
    /\bbeats?\b/i,
    /stacks? up/i,
    /better than/i,
    /\bversus\b/i,
    /\bwinner\b/i,
    /\bloser\b/i,
    /scoreboard/i,
  ];
  const FORBIDDEN_RU: RegExp[] = [
    /выигрыва/i,
    /побежда/i,
    /проигрыва/i,
    /обгоня/i,
    /соперник/i,
    /соревнова/i,
  ];

  for (const locale of LAUNCHED_LOCALES) {
    const modeSelection = getMessages(locale).competitorScripts.modeSelection;
    const compare = getMessages(locale).competitorScripts.compare;
    const forbidden = locale === "ru" ? FORBIDDEN_RU : FORBIDDEN_EN;

    const compareCardText = [
      modeSelection.compareCard.accentSubtitle,
      modeSelection.compareCard.description,
      ...modeSelection.compareCard.benefits,
    ].join("\n");

    check(
      `${locale}: the Compare mode-selection card never uses win/lose/scoreboard language`,
      forbidden.every((pattern) => !pattern.test(compareCardText))
    );

    const workflowText = compare.workflow.stages
      .map((stage) => `${stage.title} ${stage.description}`)
      .join("\n");

    check(
      `${locale}: the Compare "planned stages" workflow copy never uses win/lose/scoreboard language`,
      forbidden.every((pattern) => !pattern.test(workflowText))
    );
  }
}

// ── message coverage: compareResults namespace exists for every launched locale ─

function testMessages() {
  for (const locale of LAUNCHED_LOCALES) {
    const copy = getMessages(locale).competitorScripts.compareResults;

    check(
      `${locale}: compareResults has all top-level section keys`,
      typeof copy.backToCompare === "string" &&
        typeof copy.heroEyebrow === "string" &&
        typeof copy.pageTitle === "string" &&
        typeof copy.description === "string" &&
        typeof copy.missingState.heading === "string" &&
        typeof copy.missingState.action === "string"
    );

    check(
      `${locale}: compareResults.dimensions has a label for every real contract dimension`,
      COMPARISON_DIMENSIONS.every(
        (dimension) => typeof copy.dimensions.labels[dimension] === "string" && copy.dimensions.labels[dimension].length > 0
      )
    );

    check(
      `${locale}: compareResults.strongerSide has user/competitor/similar labels`,
      typeof copy.strongerSide.user === "string" &&
        typeof copy.strongerSide.competitor === "string" &&
        typeof copy.strongerSide.similar === "string"
    );

    check(
      `${locale}: compareResults.gap has small/meaningful/large labels`,
      typeof copy.gap.small === "string" &&
        typeof copy.gap.meaningful === "string" &&
        typeof copy.gap.large === "string"
    );

    check(
      `${locale}: compare.apiErrors and compare.submittingLabel exist (the real-API wiring's message surface)`,
      typeof getMessages(locale).competitorScripts.compare.submittingLabel === "string" &&
        typeof getMessages(locale).competitorScripts.compare.apiErrors.networkError === "string"
    );
  }

  check(
    "EN and RU expose the exact same compareResults key structure",
    JSON.stringify(Object.keys(getMessages("en").competitorScripts.compareResults).sort()) ===
      JSON.stringify(Object.keys(getMessages("ru").competitorScripts.compareResults).sort())
  );

  check(
    "EN and RU expose the exact same compare.apiErrors key structure",
    JSON.stringify(Object.keys(getMessages("en").competitorScripts.compare.apiErrors).sort()) ===
      JSON.stringify(Object.keys(getMessages("ru").competitorScripts.compare.apiErrors).sort())
  );
}

// ── selectFeaturedDimension: real behavioral checks against the actual
// pure function (not source-text regexes) ────────────────────────────────

function testFeaturedDimensionSelection() {
  // Fixed dimension order is always hook, structure, momentum, payoff_clarity
  // — mirrored here via makeDimensionFinding's own dimension arg order.
  check(
    "the dimension with the largest gap (large > meaningful > small > similar) is selected as featured — using the fixture where payoff_clarity is the sole 'large' gap",
    (() => {
      const findings = makeValidComparison("en").dimensionFindings;
      const { featured, secondary } = selectFeaturedDimension(findings);
      return (
        featured.dimension === "payoff_clarity" &&
        secondary.map((f) => f.dimension).join(",") === "hook,structure,momentum"
      );
    })()
  );

  check(
    "ties are broken by the existing fixed dimension order (earliest wins), never by any other criterion",
    (() => {
      const findings = [
        makeDimensionFinding("hook", "competitor", "large"),
        makeDimensionFinding("structure", "user", "large"),
        makeDimensionFinding("momentum", "user", "small"),
        makeDimensionFinding("payoff_clarity", "competitor", "large"),
      ];
      const { featured, secondary } = selectFeaturedDimension(findings);
      return (
        featured.dimension === "hook" &&
        secondary.map((f) => f.dimension).join(",") === "structure,momentum,payoff_clarity"
      );
    })()
  );

  check(
    "when every dimension is 'similar' (gap: null), the first dimension in fixed order is selected — an explicit gap always outranks 'similar', and among equal 'similar' findings the earliest wins",
    (() => {
      const findings = [
        makeDimensionFinding("hook", "similar", null),
        makeDimensionFinding("structure", "similar", null),
        makeDimensionFinding("momentum", "similar", null),
        makeDimensionFinding("payoff_clarity", "similar", null),
      ];
      const { featured, secondary } = selectFeaturedDimension(findings);
      return (
        featured.dimension === "hook" &&
        secondary.map((f) => f.dimension).join(",") === "structure,momentum,payoff_clarity"
      );
    })()
  );

  check(
    "selectFeaturedDimension never mutates or reorders its input array — same length, same elements, same order, same references after the call",
    (() => {
      const findings = makeValidComparison("en").dimensionFindings;
      const originalOrder = findings.map((f) => f.dimension);
      const originalRefs = [...findings];
      selectFeaturedDimension(findings);
      return (
        findings.map((f) => f.dimension).join(",") === originalOrder.join(",") &&
        findings.every((f, index) => f === originalRefs[index])
      );
    })()
  );

  check(
    "secondary always contains exactly the other three findings, in their original relative order, as a fresh array distinct from the input",
    (() => {
      const findings = makeValidComparison("en").dimensionFindings;
      const { featured, secondary } = selectFeaturedDimension(findings);
      return (
        secondary.length === 3 &&
        !secondary.includes(featured) &&
        secondary !== findings &&
        secondary.every((f, index) => f === findings.filter((x) => x !== featured)[index])
      );
    })()
  );
}

// ── structural checks: submission flow, storage usage, correct routes ────

function testStructural() {
  const formSource = readFileSync(
    "app/competitor-scripts/compare/compare-input-form.tsx",
    "utf8"
  );
  const formCodeOnly = stripComments(formSource);
  const resultsContentSource = readFileSync(
    "app/competitor-scripts/compare/results/compare-results-content.tsx",
    "utf8"
  );
  const resultsPageSource = readFileSync(
    "app/competitor-scripts/compare/results/page.tsx",
    "utf8"
  );
  const featuredDimensionModuleSource = readFileSync(
    "lib/competitor-scripts/compare-featured-dimension.ts",
    "utf8"
  );
  const storageModuleSource = readFileSync(
    "lib/competitor-scripts/compare-result-storage.ts",
    "utf8"
  );
  const storageModuleCodeOnly = stripComments(storageModuleSource);

  // ── The exact route regression this phase called out explicitly ────

  check(
    "the compare form navigates to the correct Compare results route after a successful submission",
    formSource.includes('router.push("/competitor-scripts/compare/results")')
  );

  check(
    "the compare form never navigates to the Analyze results route (would silently show Analyze's own stale/foreign results page)",
    !formSource.includes("/competitor-scripts/analyze/results")
  );

  check(
    "the compare results page/content never reference the Analyze results route either",
    !resultsPageSource.includes("/competitor-scripts/analyze/results") &&
      !resultsContentSource.includes("/competitor-scripts/analyze/results")
  );

  // ── Form: request shape, duplicate-submit guard, loading, error handling ─

  check(
    "the request body is built with exactly userScript/competitorUrl/locale",
    /body:\s*JSON\.stringify\(\{\s*userScript:\s*script,\s*competitorUrl,\s*locale:\s*requestedLocale,?\s*\}\)/.test(
      formCodeOnly
    )
  );

  check(
    "the form posts to /api/competitor-scripts/compare",
    formSource.includes('fetch("/api/competitor-scripts/compare"')
  );

  check(
    "a synchronous in-flight ref blocks duplicate submissions before any async work starts",
    /const submissionInFlight = useRef\(false\)/.test(formCodeOnly) &&
      /if \(submissionInFlight\.current\) \{\s*return;\s*\}/.test(formCodeOnly)
  );

  check(
    "isSubmitting disables both the URL input and the script textarea",
    (formCodeOnly.match(/disabled=\{isSubmitting\}/g) ?? []).length >= 2
  );

  check(
    "the submit button is disabled while submitting and shows aria-busy",
    /disabled=\{\s*isSubmitting/.test(formCodeOnly) && formCodeOnly.includes("aria-busy={isSubmitting}")
  );

  check(
    "on any failed submission, the previously entered URL and script are never cleared",
    !/setCompetitorUrl\(""\)/.test(formCodeOnly) && !/setScript\(""\)/.test(formCodeOnly)
  );

  check(
    "writeStoredCompareResult is only ever called inside the validated-success branch",
    /isValidCompareSuccessPayload\(payload\)\)\s*\{[\s\S]{0,400}writeStoredCompareResult\(/.test(
      formCodeOnly
    )
  );

  check(
    "the too-long/empty script checks run entirely client-side before any fetch call",
    /scriptTooLong[\s\S]{0,2000}fetch\(/.test(formCodeOnly)
  );

  // ── URL validation: reuses the real, server-shared validator ───────────

  check(
    "the form validates the competitor URL with the same normalizeYouTubeVideoUrl validator the API route/server also uses, instead of a separate, looser client-only check",
    formSource.includes(
      'from "../../../lib/competitor-scripts/youtube-url"'
    ) && /normalizeYouTubeVideoUrl\(trimmedUrl\)/.test(formCodeOnly)
  );

  check(
    "the old hostname-only isSupportedVideoUrl check has been removed from the compare form",
    !formCodeOnly.includes("isSupportedVideoUrl")
  );

  check(
    "a YouTube host with an unsupported path (channel, playlist, embed, live, etc.) is rejected client-side, before any fetch call, not just a malformed URL string",
    (() => {
      const unsupportedPathIndex = formCodeOnly.indexOf("unsupported_path");
      const fetchIndex = formCodeOnly.indexOf(
        'fetch("/api/competitor-scripts/compare"'
      );
      return (
        unsupportedPathIndex !== -1 &&
        fetchIndex !== -1 &&
        unsupportedPathIndex < fetchIndex
      );
    })()
  );

  check(
    "every error code the shared URL validator can return is handled by name in the form's mapping (no default/catch-all branch silently swallowing a new code)",
    [
      "empty",
      "invalid_url",
      "unsupported_host",
      "unsupported_path",
      "missing_video_id",
      "invalid_video_id",
    ].every((code) => formCodeOnly.includes(`"${code}"`))
  );

  check(
    "no console call anywhere in the form references the raw script or competitorUrl variables",
    !/console\.(info|error|log|warn)\([^)]*\bscript\b[^)]*\)/.test(formCodeOnly) &&
      !/console\.(info|error|log|warn)\([^)]*\bcompetitorUrl\b[^)]*\)/.test(formCodeOnly)
  );

  check(
    "toCompareLocale narrows to exactly en/ru, mirroring Analyze's own toAnalysisLocale fallback",
    /function toCompareLocale\(locale: string\): ComparisonLocale \{\s*return locale === "ru" \? "ru" : "en";\s*\}/.test(
      formCodeOnly
    )
  );

  check(
    "API errors are shown as a distinct form-level error, never silently attached to the URL field's own error slot",
    formCodeOnly.includes("setFormError(") && !/setUrlError\(copy\.apiErrors/.test(formCodeOnly)
  );

  // ── Results content: loading/missing/ready states, no re-sorting ───

  check(
    "CompareResultsContent starts in a loading state (avoids a server/client hydration mismatch)",
    /useState<ContentState>\(\{\s*status:\s*"loading"\s*\}\)/.test(resultsContentSource)
  );

  check(
    "CompareResultsContent reads sessionStorage inside a mount-only effect (empty dependency array), not during render",
    /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,500}readStoredCompareResult\(\)[\s\S]{0,300}\},\s*\[\]\)/.test(
      resultsContentSource
    )
  );

  check(
    "the sessionStorage read is deferred via a cleaned-up zero-delay timer, matching the repo's react-hooks/set-state-in-effect-safe convention",
    /window\.setTimeout\([\s\S]{0,300}\},\s*0\)/.test(resultsContentSource) &&
      /window\.clearTimeout\(timer\)/.test(resultsContentSource)
  );

  check(
    "selectFeaturedDimension (in its own pure module) never sorts or mutates the input array — only .filter() derives the secondary array, and the featured pick is a plain index read",
    !featuredDimensionModuleSource.includes("findings.sort(") &&
      !featuredDimensionModuleSource.includes("findings].sort(") &&
      /findings\.filter\(\(_, index\) => index !== featuredIndex\)/.test(
        featuredDimensionModuleSource
      ) &&
      /findings\[featuredIndex\]/.test(featuredDimensionModuleSource)
  );

  check(
    "compare-results-content.tsx never re-implements its own sort/reorder of dimensionFindings — the featured/secondary split is delegated entirely to the imported selectFeaturedDimension",
    !resultsContentSource.includes("dimensionFindings.sort(") &&
      !resultsContentSource.includes("dimensionFindings].sort(") &&
      resultsContentSource.includes(
        'import { selectFeaturedDimension } from "../../../../lib/competitor-scripts/compare-featured-dimension"'
      )
  );

  check(
    "the featured dimension card and the three secondary dimension cards are both rendered from the same selectFeaturedDimension split, never a second independent selection",
    resultsContentSource.includes("selectFeaturedDimension(comparison.dimensionFindings)") &&
      resultsContentSource.includes("<FeaturedDimensionCard copy={copy} finding={featured} />") &&
      /secondary\.map\(\(finding\) => \(\s*<SecondaryDimensionCard/.test(resultsContentSource)
  );

  check(
    "Priority 1 renders with the primary (dominant) variant and every other priority renders compact",
    /<PriorityCard copy=\{copy\} priority=\{primaryPriority\} variant="primary" \/>/.test(
      resultsContentSource
    ) &&
      /compactPriorities\.map\(\(priority\) => \(\s*<PriorityCard key=\{priority\.rank\} copy=\{copy\} priority=\{priority\} variant="compact" \/>/.test(
        resultsContentSource
      )
  );

  check(
    "priority order is a direct, unmodified read of comparison.priorities (array destructuring only, never a sort/reverse)",
    /const \[primaryPriority, \.\.\.compactPriorities\] = comparison\.priorities;/.test(
      resultsContentSource
    ) &&
      !resultsContentSource.includes("priorities.sort(") &&
      !resultsContentSource.includes("priorities.reverse(")
  );

  check(
    "the cautions section is conditionally rendered and entirely omitted when empty",
    /\{comparison\.cautions\.length > 0 && \(/.test(resultsContentSource)
  );

  check(
    "a caution's optional user evidence is only rendered when non-null",
    /caution\.evidence\.user !== null &&/.test(resultsContentSource)
  );

  check(
    "the results-ready container reuses the existing .animate-result-enter entrance class — no new animation is introduced",
    resultsContentSource.includes("animate-result-enter") &&
      !/@keyframes/.test(resultsContentSource)
  );

  check(
    "no scores, verdict, or performance-prediction field is ever rendered on the results page",
    !/\.scores\b/.test(resultsContentSource) &&
      !/\bverdict\b/i.test(resultsContentSource) &&
      !/performance/i.test(resultsContentSource)
  );

  check(
    "the full competitor transcript is never referenced on the results page (the API never returns one)",
    !/\.text\b.*transcript/i.test(resultsContentSource) && !resultsContentSource.toLowerCase().includes("transcript.text")
  );

  check(
    "sourceMeta fields (videoId, canonicalUrl, durationMs, userScriptCharacterCount) are all rendered",
    resultsContentSource.includes("sourceMeta.videoId") &&
      resultsContentSource.includes("sourceMeta.canonicalUrl") &&
      resultsContentSource.includes("sourceMeta.durationMs") &&
      resultsContentSource.includes("sourceMeta.userScriptCharacterCount")
  );

  // ── Storage module: no server-only imports, no legacy/transcript leakage ─

  check(
    "the storage module never imports a server-only module (no OpenAI, no process.env, no Next headers)",
    !storageModuleCodeOnly.includes("process.env") &&
      !/from\s+["']openai["']/.test(storageModuleCodeOnly) &&
      !storageModuleCodeOnly.includes("next/headers")
  );

  check(
    "the storage module's persisted type never includes a userScript, transcript, or locale field of its own (locale already lives inside comparison)",
    !/userScript:/.test(storageModuleCodeOnly) &&
      !/transcript:/.test(storageModuleCodeOnly) &&
      !/\n\s*locale:/.test(storageModuleCodeOnly)
  );
}

async function main() {
  testTransportGuard();
  await testStorageRoundTrip();
  testNoCompetitiveFraming();
  testMessages();
  testFeaturedDimensionSelection();
  testStructural();

  if (failures > 0) {
    process.exitCode = 1;
    console.error(`\n${failures} check(s) failed.`);
  } else {
    console.log("\nResult: all Competitor Scripts Compare Frontend tests passed.");
  }
}

void main();
