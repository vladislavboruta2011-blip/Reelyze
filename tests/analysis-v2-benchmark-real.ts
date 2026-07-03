import { loadEnvConfig } from "@next/env";

import { runAnalysisV2 } from "../app/api/analyze-v2/route";
import type { AnalysisV2Result } from "../engine/analysis-v2-schema";
import {
  ANALYSIS_V2_BENCHMARK_CASES,
  type AnalysisV2BenchmarkCase,
  type AnalysisV2ScoreRange,
} from "./fixtures/analysis-v2-benchmark";

type BenchmarkEvaluation = {
  passed: boolean;
  failures: string[];
};

const REAL_BENCHMARK_PROVIDER_MAX_ATTEMPTS = 3;
const REAL_BENCHMARK_PROVIDER_RETRY_DELAY_MS =
  2_000;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function checkScoreRange(
  label: string,
  value: number,
  range: AnalysisV2ScoreRange | undefined,
  failures: string[]
): void {
  if (!range) {
    return;
  }

  if (range.min !== undefined && value < range.min) {
    failures.push(
      `${label} ${value} is below expected minimum ${range.min}.`
    );
  }

  if (range.max !== undefined && value > range.max) {
    failures.push(
      `${label} ${value} is above expected maximum ${range.max}.`
    );
  }
}

function collectFeedback(result: AnalysisV2Result): string {
  return [
    result.hookAssessment,
    result.suggestedHook ?? "",
    result.mainTakeaway,
    ...result.riskyParts.flatMap((part) => [
      part.excerpt,
      part.reason,
    ]),
    ...result.suggestedFixes.map((fix) => fix.suggestion),
    ...result.scenes.map((scene) => scene.label),
  ]
    .join("\n")
    .toLowerCase();
}

function collectHookFeedback(
  result: AnalysisV2Result
): string {
  return [
    result.hookAssessment,
    result.suggestedHook ?? "",
  ]
    .join("\n")
    .toLowerCase();
}

function evaluateBenchmarkCase(
  benchmarkCase: AnalysisV2BenchmarkCase,
  result: AnalysisV2Result
): BenchmarkEvaluation {
  const { expected } = benchmarkCase;
  const failures: string[] = [];

  if (!expected.scriptTypes.includes(result.scriptType)) {
    failures.push(
      `scriptType ${result.scriptType} is not one of: ${expected.scriptTypes.join(
        ", "
      )}.`
    );
  }

  if (!expected.verdicts.includes(result.verdict)) {
    failures.push(
      `verdict ${result.verdict} is not one of: ${expected.verdicts.join(
        ", "
      )}.`
    );
  }

  checkScoreRange(
    "overall",
    result.scores.overall,
    expected.overall,
    failures
  );
  checkScoreRange(
    "hook",
    result.scores.hook,
    expected.hook,
    failures
  );
  checkScoreRange(
    "retentionRisk",
    result.scores.retentionRisk,
    expected.retentionRisk,
    failures
  );

  if (
    expected.hookDecisions &&
    !expected.hookDecisions.includes(result.hookDecision)
  ) {
    failures.push(
      `hookDecision ${result.hookDecision} is not one of: ${expected.hookDecisions.join(
        ", "
      )}.`
    );
  }

  if (
    expected.minRiskyParts !== undefined &&
    result.riskyParts.length < expected.minRiskyParts
  ) {
    failures.push(
      `riskyParts count ${result.riskyParts.length} is below expected minimum ${expected.minRiskyParts}.`
    );
  }

  if (
    expected.maxRiskyParts !== undefined &&
    result.riskyParts.length > expected.maxRiskyParts
  ) {
    failures.push(
      `riskyParts count ${result.riskyParts.length} exceeds expected maximum ${expected.maxRiskyParts}.`
    );
  }

  if (
    expected.minSuggestedFixes !== undefined &&
    result.suggestedFixes.length <
      expected.minSuggestedFixes
  ) {
    failures.push(
      `suggestedFixes count ${result.suggestedFixes.length} is below expected minimum ${expected.minSuggestedFixes}.`
    );
  }

  if (
    expected.maxSuggestedFixes !== undefined &&
    result.suggestedFixes.length >
      expected.maxSuggestedFixes
  ) {
    failures.push(
      `suggestedFixes count ${result.suggestedFixes.length} exceeds expected maximum ${expected.maxSuggestedFixes}.`
    );
  }

  if (expected.forbiddenFeedback) {
    const feedback = collectFeedback(result);

    for (const forbiddenPhrase of expected.forbiddenFeedback) {
      if (feedback.includes(forbiddenPhrase.toLowerCase())) {
        failures.push(
          `feedback contains forbidden phrase: "${forbiddenPhrase}".`
        );
      }
    }
  }

  if (expected.forbiddenHookFeedback) {
    const hookFeedback = collectHookFeedback(result);

    for (
      const forbiddenPhrase of
      expected.forbiddenHookFeedback
    ) {
      if (
        hookFeedback.includes(
          forbiddenPhrase.toLowerCase()
        )
      ) {
        failures.push(
          `hook feedback contains forbidden phrase: "${forbiddenPhrase}".`
        );
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

function printResult(
  benchmarkCase: AnalysisV2BenchmarkCase,
  result: AnalysisV2Result,
  modelUsed: string,
  evaluation: BenchmarkEvaluation
): void {
  console.log("\n" + "=".repeat(80));
  console.log(
    `[${benchmarkCase.category.toUpperCase()}] ${benchmarkCase.id}`
  );
  console.log(`Model: ${modelUsed}`);
  console.log(`Detected type: ${result.scriptType}`);
  console.log(`Verdict: ${result.verdict}`);
  console.log(
    `Scores: overall=${result.scores.overall}, hook=${result.scores.hook}, retentionRisk=${result.scores.retentionRisk}`
  );
  console.log(`Hook decision: ${result.hookDecision}`);
  console.log(`Hook assessment: ${result.hookAssessment}`);
  console.log(
    `Suggested hook: ${result.suggestedHook ?? "(none)"}`
  );

  console.log("Risky parts:");
  if (result.riskyParts.length === 0) {
    console.log("  (none)");
  } else {
    for (const part of result.riskyParts) {
      console.log(
        `  - [${part.severity}] "${part.excerpt}" — ${part.reason}`
      );
    }
  }

  console.log("Suggested fixes:");
  if (result.suggestedFixes.length === 0) {
    console.log("  (none)");
  } else {
    for (const fix of result.suggestedFixes) {
      console.log(
        `  - [${fix.target}]${fix.optional ? " optional" : ""}: ${fix.suggestion}`
      );
    }
  }

  console.log(
    `Result: ${evaluation.passed ? "PASS" : "FAIL"}`
  );

  for (const failure of evaluation.failures) {
    console.log(`  - ${failure}`);
  }
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error(
      "OPENAI_API_KEY is missing. Real Analysis V2 benchmark was not run."
    );
  }

  console.log(
    `Running ${ANALYSIS_V2_BENCHMARK_CASES.length} real-model Analysis V2 benchmark cases sequentially.`
  );

  let passed = 0;
  let failed = 0;
  const scoreTripletCounts = new Map<string, number>();

  for (const benchmarkCase of ANALYSIS_V2_BENCHMARK_CASES) {
    let providerAttempt = 1;
    let runResult = await runAnalysisV2(
      benchmarkCase.script,
      benchmarkCase.title
    );

    while (
      !runResult.ok &&
      runResult.status === 503 &&
      providerAttempt <
        REAL_BENCHMARK_PROVIDER_MAX_ATTEMPTS
    ) {
      const nextAttempt = providerAttempt + 1;

      console.warn(
        `Provider unavailable for ${benchmarkCase.id}. Retrying case (${nextAttempt}/${REAL_BENCHMARK_PROVIDER_MAX_ATTEMPTS})...`
      );

      await wait(
        REAL_BENCHMARK_PROVIDER_RETRY_DELAY_MS *
          providerAttempt
      );

      providerAttempt = nextAttempt;
      runResult = await runAnalysisV2(
        benchmarkCase.script,
        benchmarkCase.title
      );
    }

    if (!runResult.ok) {
      console.error("\n" + "=".repeat(80));
      console.error(
        `ERROR: ${benchmarkCase.id} returned status ${runResult.status}.`
      );
      console.error(runResult.response.reason);
      throw new Error(
        `Real benchmark stopped because ${benchmarkCase.id} did not produce a valid analysis.`
      );
    }

    const evaluation = evaluateBenchmarkCase(
      benchmarkCase,
      runResult.response.result
    );

    const scoreTriplet = [
      runResult.response.result.scores.overall,
      runResult.response.result.scores.hook,
      runResult.response.result.scores.retentionRisk,
    ].join("/");

    scoreTripletCounts.set(
      scoreTriplet,
      (scoreTripletCounts.get(scoreTriplet) ?? 0) + 1
    );

    printResult(
      benchmarkCase,
      runResult.response.result,
      runResult.response.modelUsed,
      evaluation
    );

    if (evaluation.passed) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  const maximumRepeatedTripletCount = Math.max(
    3,
    Math.floor(
      ANALYSIS_V2_BENCHMARK_CASES.length * 0.3
    )
  );
  const repeatedScoreTriplets = [
    ...scoreTripletCounts.entries(),
  ].filter(
    ([, count]) => count > maximumRepeatedTripletCount
  );

  const minimumUniqueTriplets = Math.ceil(
    ANALYSIS_V2_BENCHMARK_CASES.length * 0.4
  );
  const hasLowScoreDiversity =
    scoreTripletCounts.size < minimumUniqueTriplets;

  console.log("\n" + "=".repeat(80));
  console.log(
    `Analysis V2 real benchmark: ${passed}/${ANALYSIS_V2_BENCHMARK_CASES.length} passed, ${failed} failed.`
  );
  console.log(
    `Unique score triplets: ${scoreTripletCounts.size}/${ANALYSIS_V2_BENCHMARK_CASES.length}.`
  );

  for (const [triplet, count] of repeatedScoreTriplets) {
    console.error(
      `Score clustering failure: ${triplet} was returned ${count} times; maximum allowed is ${maximumRepeatedTripletCount}.`
    );
  }

  if (hasLowScoreDiversity) {
    console.error(
      `Score diversity failure: expected at least ${minimumUniqueTriplets} unique triplets.`
    );
  }

  if (
    failed > 0 ||
    repeatedScoreTriplets.length > 0 ||
    hasLowScoreDiversity
  ) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown benchmark error.";

  console.error(`\nAnalysis V2 real benchmark failed: ${message}`);
  process.exitCode = 1;
});
