import { sanitizeNextPath } from "../lib/auth-redirect";

// app/auth/callback/route.ts's cookies()-dependent flow requires a live
// Next.js request scope (next/headers's AsyncLocalStorage) that isn't
// available when running this file directly with tsx, so it can't be
// exercised end-to-end the way tests/feedback-api.ts exercises a plain
// Route Handler over mocked fetch. This suite instead gives full coverage
// to sanitizeNextPath — the exact open-redirect guard the callback route
// and app/login/page.tsx / app/auth-nav.tsx all rely on — since that's
// the security-relevant logic PR 1 introduces.

type Case = {
  input: string | null | undefined;
  expected: string;
  label: string;
};

const cases: Case[] = [
  { input: null, expected: "/", label: "null falls back to /" },
  { input: undefined, expected: "/", label: "undefined falls back to /" },
  { input: "", expected: "/", label: "empty string falls back to /" },
  {
    input: "/results",
    expected: "/results",
    label: "same-origin relative path is preserved",
  },
  {
    input: "/my-analyses",
    expected: "/my-analyses",
    label: "another same-origin relative path is preserved",
  },
  {
    input: "/a/b?x=1&y=2",
    expected: "/a/b?x=1&y=2",
    label: "query string on a relative path is preserved",
  },
  {
    input: "https://evil.example",
    expected: "/",
    label: "absolute URL is rejected",
  },
  {
    input: "http://evil.example/results",
    expected: "/",
    label: "absolute http URL is rejected",
  },
  {
    input: "//evil.example",
    expected: "/",
    label: "protocol-relative URL is rejected",
  },
  {
    input: "/\\evil.example",
    expected: "/",
    label: "backslash-prefixed path is rejected",
  },
  {
    input: "not-a-path",
    expected: "/",
    label: "value without a leading slash is rejected",
  },
  {
    input: "results",
    expected: "/",
    label: "bare word without a leading slash is rejected",
  },
  // The WHATWG URL parser strips every ASCII tab/newline/CR from its input
  // before parsing — not just from the edges — so these don't start with
  // "//" as a string, but new URL(next, origin) resolves them to a
  // protocol-relative redirect (host "evil.example"). Confirmed exploitable
  // against the pre-fix version of sanitizeNextPath.
  {
    input: "/\t/evil.example",
    expected: "/",
    label: "embedded tab before a protocol-relative host is rejected",
  },
  {
    input: "/\n/evil.example",
    expected: "/",
    label: "embedded newline before a protocol-relative host is rejected",
  },
  {
    input: "/\r/evil.example",
    expected: "/",
    label: "embedded carriage return before a protocol-relative host is rejected",
  },
  {
    input: "/a\t/evil.example",
    expected: "/",
    label: "tab later in the path before a protocol-relative host is rejected",
  },
];

// NUL and other C0 control characters aren't part of the confirmed
// tab/newline/CR bypass above (the WHATWG URL parser's mid-string strip
// step only removes U+0009/U+000A/U+000D), but CONTROL_CHARACTER_PATTERN
// in lib/auth-redirect.ts rejects the full \x00-\x1F,\x7F range
// defensively — verified by direct inspection of that regex rather than
// a runtime case here.

// Beyond string-matching the sanitized value, this asserts the actual
// security property that matters: resolving the sanitized output against
// the app's own origin must never produce a different host. This catches
// any future variant of the control-character bypass class, not just the
// specific characters listed above.
function assertResolvesToOwnOrigin(sanitized: string, label: string): void {
  const origin = "https://climpy.example";
  const resolved = new URL(sanitized, origin);

  if (resolved.origin !== origin) {
    throw new Error(
      `${label}: sanitized value ${JSON.stringify(sanitized)} resolves to a different origin (${resolved.origin}).`
    );
  }
}

function main(): void {
  let failures = 0;

  for (const { input, expected, label } of cases) {
    const actual = sanitizeNextPath(input);

    if (actual !== expected) {
      failures += 1;
      console.error(
        `FAIL — ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      );
      continue;
    }

    try {
      assertResolvesToOwnOrigin(actual, label);
    } catch (error) {
      failures += 1;
      console.error(
        `FAIL — ${label}: ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }

    console.log(`PASS — ${label}`);
  }

  if (failures > 0) {
    console.error(`\nauth-redirect tests: ${failures} failed`);
    process.exitCode = 1;
    return;
  }

  console.log("\nauth-redirect tests: all passed");
}

main();
