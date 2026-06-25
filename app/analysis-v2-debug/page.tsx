"use client";

import { useState } from "react";
import type {
  AnalysisV2Result,
  AnalysisV2SuccessResponse,
} from "../../engine/analysis-v2-schema";

const DEFAULT_TITLE = "Why your hands shake after stress";

const DEFAULT_SCRIPT =
  "Your hands can start shaking after a stressful moment because your body releases adrenaline. That hormone prepares your muscles to react quickly, but it can also make them tremble until your nervous system calms down.";

function isSuccessResponse(
  value: unknown
): value is AnalysisV2SuccessResponse {
  if (
    typeof value !== "object"
    || value === null
    || !("status" in value)
    || value.status !== "ok"
    || !("result" in value)
    || typeof value.result !== "object"
    || value.result === null
    || !("modelUsed" in value)
    || typeof value.modelUsed !== "string"
  ) {
    return false;
  }

  return true;
}

function scoreTone(
  kind: "overall" | "hook" | "retentionRisk",
  value: number
): string {
  const positive =
    kind === "retentionRisk"
      ? value <= 45
      : value >= 70;

  const negative =
    kind === "retentionRisk"
      ? value >= 60
      : value <= 45;

  if (positive) {
    return "text-emerald-400";
  }

  if (negative) {
    return "text-red-400";
  }

  return "text-amber-400";
}

function ResultPanel({
  result,
  modelUsed,
}: {
  result: AnalysisV2Result;
  modelUsed: string;
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">
              Script type
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {result.scriptType}
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm text-zinc-500">
              Verdict
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {result.verdict}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            {
              key: "overall" as const,
              label: "Overall",
              value: result.scores.overall,
            },
            {
              key: "hook" as const,
              label: "Hook",
              value: result.scores.hook,
            },
            {
              key: "retentionRisk" as const,
              label: "Retention risk",
              value: result.scores.retentionRisk,
            },
          ].map((score) => (
            <div
              key={score.key}
              className="rounded-xl border border-white/10 bg-black/30 p-4"
            >
              <p className="text-sm text-zinc-500">
                {score.label}
              </p>
              <p
                className={[
                  "mt-2 text-3xl font-bold",
                  scoreTone(score.key, score.value),
                ].join(" ")}
              >
                {score.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-red-400">
          Hook decision
        </p>
        <p className="mt-2 text-lg font-semibold text-white">
          {result.hookDecision}
        </p>
        <p className="mt-3 leading-7 text-zinc-300">
          {result.hookAssessment}
        </p>

        {result.suggestedHook ? (
          <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
            <p className="text-sm font-medium text-red-300">
              Suggested hook
            </p>
            <p className="mt-2 leading-7 text-white">
              {result.suggestedHook}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="text-lg font-semibold text-white">
            Risky parts
          </h2>

          {result.riskyParts.length === 0 ? (
            <p className="mt-4 text-zinc-500">
              No risky parts detected.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {result.riskyParts.map((part, index) => (
                <div
                  key={`${part.excerpt}-${index}`}
                  className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-400">
                    {part.severity}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    “{part.excerpt}”
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {part.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="text-lg font-semibold text-white">
            Suggested fixes
          </h2>

          {result.suggestedFixes.length === 0 ? (
            <p className="mt-4 text-zinc-500">
              No fixes required.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {result.suggestedFixes.map((fix, index) => (
                <div
                  key={`${fix.target}-${index}`}
                  className="rounded-xl border border-white/10 bg-black/25 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                      {fix.target}
                    </p>
                    <span className="text-xs text-zinc-500">
                      {fix.optional ? "optional" : "required"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {fix.suggestion}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <h2 className="text-lg font-semibold text-white">
          Scene breakdown
        </h2>

        <div className="mt-4 space-y-3">
          {result.scenes.map((scene, index) => (
            <div
              key={`${scene.excerpt}-${index}`}
              className="rounded-xl border border-white/10 bg-black/25 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  {scene.label}
                </p>
                <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  {scene.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {scene.excerpt}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6">
        <p className="text-sm font-medium text-red-300">
          Main takeaway
        </p>
        <p className="mt-2 leading-7 text-white">
          {result.mainTakeaway}
        </p>
      </div>

      <p className="text-center text-xs text-zinc-600">
        Model: {modelUsed}
      </p>
    </section>
  );
}

export default function AnalysisV2DebugPage() {
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [result, setResult] =
    useState<AnalysisV2SuccessResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function analyze(): Promise<void> {
    const normalizedScript = script.trim();

    if (!normalizedScript) {
      setError("Enter a script before analyzing.");
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/analyze-v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          script: normalizedScript,
        }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const reason =
          typeof payload === "object"
          && payload !== null
          && "reason" in payload
          && typeof payload.reason === "string"
            ? payload.reason
            : "Analysis request failed.";

        throw new Error(reason);
      }

      if (!isSuccessResponse(payload)) {
        throw new Error(
          "The API returned an unexpected response."
        );
      }

      setResult(payload);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Analysis request failed."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-400">
            Internal debug route
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Analysis V2 tester
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-zinc-400">
            This page calls the isolated AI-first analysis endpoint.
            It is not linked from the production interface.
          </p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[420px_1fr]">
          <section className="rounded-2xl border border-white/10 bg-[#0B0C10] p-5 lg:sticky lg:top-6">
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Title
              </span>
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                maxLength={200}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-red-500/60"
                placeholder="Optional title"
              />
              <span className="mt-2 block text-right text-xs text-zinc-600">
                {title.length}/200
              </span>
            </label>

            <label className="mt-5 block">
              <span className="text-sm font-medium text-zinc-300">
                Script
              </span>
              <textarea
                value={script}
                onChange={(event) => {
                  setScript(event.target.value);
                }}
                maxLength={1000}
                rows={14}
                className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-red-500/60"
                placeholder="Paste a Shorts script"
              />
              <span className="mt-2 block text-right text-xs text-zinc-600">
                {script.length}/1000
              </span>
            </label>

            <button
              type="button"
              onClick={() => {
                void analyze();
              }}
              disabled={
                isLoading
                || script.trim().length === 0
              }
              className="mt-5 w-full rounded-xl bg-red-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading
                ? "Analyzing..."
                : "Run Analysis V2"}
            </button>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4 text-sm leading-6 text-red-300">
                {error}
              </div>
            ) : null}
          </section>

          <div>
            {isLoading ? (
              <div className="rounded-2xl border border-white/10 bg-[#0B0C10] p-8 text-center text-zinc-400">
                Waiting for the model response...
              </div>
            ) : null}

            {!isLoading && !result && !error ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0B0C10] p-10 text-center text-zinc-500">
                Run an analysis to inspect the complete V2 response.
              </div>
            ) : null}

            {result ? (
              <ResultPanel
                result={result.result}
                modelUsed={result.modelUsed}
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
