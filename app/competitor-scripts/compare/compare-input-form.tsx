"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2, Loader2, Lock } from "lucide-react";
import type { Messages } from "../../../lib/messages";
import {
  isValidCompareSuccessPayload,
  writeStoredCompareResult,
} from "../../../lib/competitor-scripts/compare-result-storage";
import type { ComparisonLocale } from "../../../lib/competitor-scripts/comparison/types";
import {
  normalizeYouTubeVideoUrl,
  type YouTubeUrlErrorCode,
} from "../../../lib/competitor-scripts/youtube-url";
import { useLocale } from "../../locale-provider";

type CompareCopy = Messages["competitorScripts"]["compare"];
type ApiErrorCode = keyof CompareCopy["apiErrors"];

const MAX_SCRIPT_CHARACTERS = 1000;

// Every code the API route can currently return that isn't already
// prevented by this form's own client-side validation, mapped to a safe,
// localized message. A code the client already blocks locally (missing/
// too-long script, malformed/unsupported URL) still falls back to the
// generic requestInvalid copy below rather than being explicitly mapped —
// the server remains the source of truth regardless. Never shows a raw
// backend message: only ever this table's copy.
const API_ERROR_CODE_MAP: Record<string, ApiErrorCode> = {
  rate_limited: "rateLimited",
  transcript_not_found: "transcriptNotFound",
  transcript_unavailable: "transcriptUnavailable",
  video_unavailable: "videoUnavailable",
  transcript_rate_limited: "transcriptRateLimited",
  transcript_timeout: "transcriptTimeout",
  transcript_service_unavailable: "transcriptServiceUnavailable",
  invalid_transcript_response: "invalidTranscriptResponse",
  user_script_too_long_for_comparison: "userScriptTooLong",
  competitor_transcript_too_long_for_comparison: "competitorTranscriptTooLong",
  comparison_invalid_response: "comparisonInvalidResponse",
  comparison_unavailable: "comparisonUnavailable",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The app supports more locales than Compare does (SUPPORTED_LOCALES vs.
// the provider's launched en/ru) — anything other than "ru" maps to "en",
// mirroring the exact same fallback the Analyze form already applies
// (toAnalysisLocale in analyze-input-form.tsx) and the API route itself
// applies server-side, so the locale actually sent here is never a guess
// the server would then have re-derived differently.
function toCompareLocale(locale: string): ComparisonLocale {
  return locale === "ru" ? "ru" : "en";
}

// Every code normalizeYouTubeVideoUrl can return, mapped to this form's
// existing copy — no new strings. "invalid_url" gets its own message
// (malformed URL syntax); every other failure (wrong host, or a
// recognized-YouTube-host link that isn't a video/Shorts link — a
// channel, playlist, embed, or live URL) collapses into the same
// "unsupportedUrl" copy already shown for that case today.
function mapYouTubeUrlErrorToCopy(
  code: YouTubeUrlErrorCode,
  copy: CompareCopy
): string {
  switch (code) {
    case "empty":
      return copy.errors.emptyUrl;
    case "invalid_url":
      return copy.errors.invalidUrl;
    case "unsupported_host":
    case "unsupported_path":
    case "missing_video_id":
    case "invalid_video_id":
      return copy.errors.unsupportedUrl;
  }
}

// Local URL/script validation is convenience-only — it never replaces the
// server's own authoritative checks. This submits to
// POST /api/competitor-scripts/compare, shows a real loading state, maps
// safe API errors to localized copy, and only writes the sessionStorage
// handoff payload (and navigates) once the response has passed the
// lightweight transport guard (isValidCompareSuccessPayload) — never a
// bare cast. Neither the raw submitted URL nor the raw script ever leaves
// this component's state or the request body — never placed in a query
// string, never logged.
export function CompareInputForm({ copy }: { copy: CompareCopy }) {
  const router = useRouter();
  const { locale: appLocale } = useLocale();
  const urlInputId = useId();
  const urlErrorId = useId();
  const scriptInputId = useId();
  const scriptErrorId = useId();
  const scriptCounterId = useId();

  const [competitorUrl, setCompetitorUrl] = useState("");
  const [script, setScript] = useState("");
  const [urlError, setUrlError] = useState("");
  const [scriptError, setScriptError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const formErrorId = useId();

  const scriptOverLimit = script.length > MAX_SCRIPT_CHARACTERS;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInFlight.current) {
      return;
    }

    const trimmedUrl = competitorUrl.trim();
    let nextUrlError = "";

    if (trimmedUrl.length === 0) {
      nextUrlError = copy.errors.emptyUrl;
    } else {
      const urlResult = normalizeYouTubeVideoUrl(trimmedUrl);

      if (!urlResult.ok) {
        nextUrlError = mapYouTubeUrlErrorToCopy(urlResult.code, copy);
      }
    }

    const trimmedScript = script.trim();
    let nextScriptError = "";

    if (trimmedScript.length === 0) {
      nextScriptError = copy.errors.emptyScript;
    } else if (script.length > MAX_SCRIPT_CHARACTERS) {
      nextScriptError = copy.errors.scriptTooLong;
    }

    setUrlError(nextUrlError);
    setScriptError(nextScriptError);

    if (nextUrlError || nextScriptError) {
      return;
    }

    setFormError("");
    submissionInFlight.current = true;
    setIsSubmitting(true);

    const requestedLocale = toCompareLocale(appLocale);

    void (async () => {
      let response: Response;

      try {
        response = await fetch("/api/competitor-scripts/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userScript: script,
            competitorUrl,
            locale: requestedLocale,
          }),
        });
      } catch {
        submissionInFlight.current = false;
        setIsSubmitting(false);
        setFormError(copy.apiErrors.networkError);
        return;
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        submissionInFlight.current = false;
        setIsSubmitting(false);
        setFormError(copy.apiErrors.unexpectedError);
        return;
      }

      if (response.ok && isValidCompareSuccessPayload(payload)) {
        writeStoredCompareResult({
          comparison: payload.comparison,
          sourceMeta: payload.sourceMeta,
        });

        router.push("/competitor-scripts/compare/results");
        return;
      }

      submissionInFlight.current = false;
      setIsSubmitting(false);

      const code =
        isPlainObject(payload) &&
        isPlainObject(payload.error) &&
        typeof payload.error.code === "string"
          ? payload.error.code
          : null;

      const mappedKey = code ? API_ERROR_CODE_MAP[code] : undefined;

      setFormError(
        mappedKey ? copy.apiErrors[mappedKey] : copy.apiErrors.requestInvalid
      );
    })();
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-4 rounded-[28px] border border-[#22D3EE]/25 bg-gradient-to-b from-[#22D3EE]/[0.06] to-transparent p-6 lg:p-8"
    >
      <label
        htmlFor={urlInputId}
        className="text-[13px] font-semibold text-[#F5F5F7]"
      >
        {copy.urlLabel}
      </label>

      <div
        className={`mt-2.5 flex h-[56px] items-center gap-3 rounded-[14px] border bg-white/[0.03] px-4 ${
          urlError ? "border-[#EF4444]/60" : "border-white/10"
        }`}
      >
        <Link2
          size={18}
          className="shrink-0 text-[#6B7280]"
          aria-hidden="true"
        />
        <input
          id={urlInputId}
          type="url"
          inputMode="url"
          value={competitorUrl}
          disabled={isSubmitting}
          onChange={(event) => {
            setCompetitorUrl(event.target.value);
            if (urlError) setUrlError("");
            if (formError) setFormError("");
          }}
          placeholder={copy.urlPlaceholder}
          aria-invalid={urlError ? true : undefined}
          aria-describedby={urlError ? urlErrorId : undefined}
          className="h-full w-full bg-transparent text-[15px] text-[#F5F5F7] outline-none placeholder:text-[#6B7280] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67E8F9]"
        />
      </div>

      {urlError && (
        <p
          id={urlErrorId}
          role="alert"
          className="mt-2.5 text-[13px] font-medium text-[#EF4444]"
        >
          {urlError}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <label
          htmlFor={scriptInputId}
          className="text-[13px] font-semibold text-[#F5F5F7]"
        >
          {copy.scriptLabel}
        </label>
        <span
          id={scriptCounterId}
          className={`shrink-0 text-[12px] font-medium ${
            scriptOverLimit ? "text-[#EF4444]" : "text-[#9CA3AF]"
          }`}
        >
          {script.length}/{MAX_SCRIPT_CHARACTERS}
        </span>
      </div>

      <div
        className={`mt-2.5 rounded-[14px] border bg-white/[0.03] ${
          scriptError ? "border-[#EF4444]/60" : "border-white/10"
        }`}
      >
        <textarea
          id={scriptInputId}
          value={script}
          disabled={isSubmitting}
          onChange={(event) => {
            setScript(event.target.value);
            if (scriptError) setScriptError("");
            if (formError) setFormError("");
          }}
          placeholder={copy.scriptPlaceholder}
          rows={6}
          aria-invalid={scriptError ? true : undefined}
          aria-describedby={
            scriptError
              ? `${scriptCounterId} ${scriptErrorId}`
              : scriptCounterId
          }
          className="min-h-[165px] w-full resize-y bg-transparent px-4 py-3.5 text-[14px] leading-[1.65] text-[#F5F5F7] outline-none placeholder:text-[#6B7280] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67E8F9] lg:min-h-[135px]"
        />
      </div>

      <p className="mt-2 text-[12px] leading-[1.5] text-[#9CA3AF]">
        {copy.scriptHelper}
      </p>

      {scriptError && (
        <p
          id={scriptErrorId}
          role="alert"
          className="mt-1.5 text-[13px] font-medium text-[#EF4444]"
        >
          {scriptError}
        </p>
      )}

      {formError && (
        <p
          id={formErrorId}
          role="alert"
          className="mt-4 rounded-[12px] border border-[#EF4444]/30 bg-[#EF4444]/[0.06] px-4 py-3 text-[13px] font-medium text-[#FCA5A5]"
        >
          {formError}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3 lg:max-w-[420px]">
          <Lock
            size={15}
            className="mt-0.5 shrink-0 text-[#9CA3AF]"
            aria-hidden="true"
          />
          <div>
            <p className="text-[12.5px] font-semibold text-[#F5F5F7]">
              {copy.privacyNote.heading}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {copy.privacyNote.items.map((item) => (
                <li
                  key={item}
                  className="text-[12px] leading-[1.55] text-[#9CA3AF]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="submit"
          disabled={
            isSubmitting ||
            competitorUrl.trim().length === 0 ||
            script.trim().length === 0
          }
          aria-busy={isSubmitting}
          className="inline-flex h-[56px] w-full shrink-0 items-center justify-center gap-2.5 self-end rounded-[14px] bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#22D3EE] px-9 text-[15px] font-semibold text-white transition hover:from-[#2563EB] hover:via-[#3B82F6] hover:to-[#67E8F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67E8F9] disabled:cursor-not-allowed disabled:from-[#1E3A5F] disabled:via-[#1E3A5F] disabled:to-[#1E3A5F] disabled:text-[#7DA3B8] lg:w-auto"
        >
          {isSubmitting ? (
            <>
              <Loader2
                size={17}
                className="animate-spin"
                aria-hidden="true"
              />
              {copy.submittingLabel}
            </>
          ) : (
            <>
              {copy.submitLabel}
              <ArrowRight size={17} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
