"use client";

import { useId, useState } from "react";
import { ArrowRight, Link2, Lock } from "lucide-react";
import type { Messages } from "../../../lib/messages";
import { isSupportedVideoUrl } from "../url-validation";

type CompareCopy = Messages["competitorScripts"]["compare"];

const MAX_SCRIPT_CHARACTERS = 1000;

// No API call, no navigation. A well-formed competitor URL plus a
// non-empty, in-limit script only ever reveals the same safe, localized
// "coming next" status pattern already used on the mode-selection cards
// and the Analyze page (role="status"/aria-live="polite") — this page
// can't yet produce a real comparison, so it must not pretend to. The
// submit button is disabled only while either field is empty (a plain,
// native disabled state) — the full validation below still runs on submit
// regardless, and both fields' errors are reported independently rather
// than stopping at the first failure.
export function CompareInputForm({ copy }: { copy: CompareCopy }) {
  const urlInputId = useId();
  const urlErrorId = useId();
  const scriptInputId = useId();
  const scriptErrorId = useId();
  const scriptCounterId = useId();

  const [competitorUrl, setCompetitorUrl] = useState("");
  const [script, setScript] = useState("");
  const [urlError, setUrlError] = useState("");
  const [scriptError, setScriptError] = useState("");
  const [showComingNext, setShowComingNext] = useState(false);

  const scriptOverLimit = script.length > MAX_SCRIPT_CHARACTERS;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowComingNext(false);

    const trimmedUrl = competitorUrl.trim();
    let nextUrlError = "";

    if (trimmedUrl.length === 0) {
      nextUrlError = copy.errors.emptyUrl;
    } else {
      let isWellFormed = true;
      try {
        new URL(trimmedUrl);
      } catch {
        isWellFormed = false;
      }

      if (!isWellFormed) {
        nextUrlError = copy.errors.invalidUrl;
      } else if (!isSupportedVideoUrl(trimmedUrl)) {
        nextUrlError = copy.errors.unsupportedUrl;
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

    if (!nextUrlError && !nextScriptError) {
      setShowComingNext(true);
    }
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
          onChange={(event) => {
            setCompetitorUrl(event.target.value);
            setShowComingNext(false);
            if (urlError) setUrlError("");
          }}
          placeholder={copy.urlPlaceholder}
          aria-invalid={urlError ? true : undefined}
          aria-describedby={urlError ? urlErrorId : undefined}
          className="h-full w-full bg-transparent text-[15px] text-[#F5F5F7] outline-none placeholder:text-[#6B7280]"
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
          onChange={(event) => {
            setScript(event.target.value);
            setShowComingNext(false);
            if (scriptError) setScriptError("");
          }}
          placeholder={copy.scriptPlaceholder}
          rows={6}
          aria-invalid={scriptError ? true : undefined}
          aria-describedby={
            scriptError
              ? `${scriptCounterId} ${scriptErrorId}`
              : scriptCounterId
          }
          className="min-h-[165px] w-full resize-y bg-transparent px-4 py-3.5 text-[14px] leading-[1.65] text-[#F5F5F7] outline-none placeholder:text-[#6B7280] lg:min-h-[135px]"
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
            competitorUrl.trim().length === 0 || script.trim().length === 0
          }
          className="inline-flex h-[56px] w-full shrink-0 items-center justify-center gap-2.5 self-end rounded-[14px] bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#22D3EE] px-9 text-[15px] font-semibold text-white transition hover:from-[#2563EB] hover:via-[#3B82F6] hover:to-[#67E8F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67E8F9] disabled:cursor-not-allowed disabled:from-[#1E3A5F] disabled:via-[#1E3A5F] disabled:to-[#1E3A5F] disabled:text-[#7DA3B8] lg:w-auto"
        >
          {copy.submitLabel}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>

      {showComingNext && (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-[13px] text-[#9CA3AF]"
        >
          {copy.comingNextMessage}
        </p>
      )}
    </form>
  );
}
