"use client";

import { useId, useState } from "react";
import { ArrowRight, Link2, Lock } from "lucide-react";
import type { Messages } from "../../../lib/messages";
import { isSupportedVideoUrl } from "../url-validation";

type AnalyzeCopy = Messages["competitorScripts"]["analyze"];

// No API call, no navigation. A well-formed, YouTube-shaped URL only ever
// reveals the same safe, localized "coming next" status the mode-selection
// cards already use (role="status"/aria-live="polite") — this page can't
// yet produce a real result, so it must not pretend to. The submit button
// is disabled only while the field is empty (a plain, native disabled
// state, not a stand-in for real validation) — the full empty/invalid/
// unsupported checks below still run on submit regardless.
export function AnalyzeInputForm({
  copy,
  comingNextMessage,
}: {
  copy: AnalyzeCopy;
  comingNextMessage: string;
}) {
  const inputId = useId();
  const errorId = useId();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [showComingNext, setShowComingNext] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowComingNext(false);

    const trimmed = url.trim();

    if (trimmed.length === 0) {
      setError(copy.errors.emptyUrl);
      return;
    }

    let isWellFormed = true;
    try {
      new URL(trimmed);
    } catch {
      isWellFormed = false;
    }

    if (!isWellFormed) {
      setError(copy.errors.invalidUrl);
      return;
    }

    if (!isSupportedVideoUrl(trimmed)) {
      setError(copy.errors.unsupportedUrl);
      return;
    }

    setError("");
    setShowComingNext(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-4 rounded-[28px] border border-[#7C3AED]/25 bg-gradient-to-b from-[#7C3AED]/[0.06] to-transparent p-6 lg:p-8"
    >
      <label
        htmlFor={inputId}
        className="text-[13px] font-semibold text-[#F5F5F7]"
      >
        {copy.urlLabel}
      </label>

      <div
        className={`mt-2.5 flex h-[56px] items-center gap-3 rounded-[14px] border bg-white/[0.03] px-4 ${
          error ? "border-[#EF4444]/60" : "border-white/10"
        }`}
      >
        <Link2
          size={18}
          className="shrink-0 text-[#6B7280]"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setShowComingNext(false);
            if (error) setError("");
          }}
          placeholder={copy.urlPlaceholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-full w-full bg-transparent text-[15px] text-[#F5F5F7] outline-none placeholder:text-[#6B7280]"
        />
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-2.5 text-[13px] font-medium text-[#EF4444]"
        >
          {error}
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
          disabled={url.trim().length === 0}
          className="inline-flex h-[52px] w-full shrink-0 items-center justify-center gap-2.5 rounded-[14px] bg-gradient-to-r from-[#6D28D9] to-[#7C3AED] px-7 text-[15px] font-semibold text-white transition hover:from-[#7C3AED] hover:to-[#8B5CF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4B5FD] disabled:cursor-not-allowed disabled:from-[#3D2A66] disabled:to-[#3D2A66] disabled:text-[#8B7BAE] lg:w-auto"
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
          {comingNextMessage}
        </p>
      )}
    </form>
  );
}
