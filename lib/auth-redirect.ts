// Every caller (app/auth/callback/route.ts, app/login/page.tsx, and
// app/auth-nav.tsx) eventually passes the sanitized value into
// `new URL(next, origin)` to build the actual redirect target. The WHATWG
// URL parser strips every ASCII tab/newline/CR from the input *before*
// parsing — not just from the edges — so a value like "/\t/evil.example"
// does not start with "//" as a string, but resolves to a protocol-relative
// redirect (host "evil.example") once new URL() processes it. Rejecting any
// C0 control character anywhere in the input closes that gap, matching what
// the URL parser itself will actually see.
const CONTROL_CHARACTER_PATTERN = /[\x00-\x1F\x7F]/;

// Only a same-origin, single-leading-slash relative path is ever honored.
// Anything else (absolute URLs, protocol-relative "//host" paths, a
// backslash variant, an embedded control character, or a missing value)
// falls back to "/" — this is the open-redirect guard for the OAuth "next"
// parameter.
export function sanitizeNextPath(
  rawNext: string | null | undefined
): string {
  if (
    !rawNext ||
    !rawNext.startsWith("/") ||
    rawNext.startsWith("//") ||
    rawNext.startsWith("/\\") ||
    CONTROL_CHARACTER_PATTERN.test(rawNext)
  ) {
    return "/";
  }

  return rawNext;
}
