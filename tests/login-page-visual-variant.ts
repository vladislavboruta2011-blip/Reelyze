import { readFileSync } from "node:fs";
import path from "node:path";

// Source-shape regression coverage for the login-page Hero visual refresh.
// This has no DOM renderer available, so — matching the existing
// convention in tests/mobile-header.ts and tests/login-page-build-safety.ts
// — it checks the real source files directly rather than mounting
// components. The goal is narrow: prove the new dark variant is additive
// and opt-in only, that /login is the one place that opts into it, that
// SignInModal never does, and that no auth/redirect logic moved.

let failures = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    console.log(`PASS — ${name}`);
  } else {
    console.error(`FAIL — ${name}`);
    failures += 1;
  }
}

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

console.log("\nLogin Page Visual Variant Tests\n");

const signInCardContentSource = read("app/sign-in-card-content.tsx");
const loginPageSource = read("app/login/page.tsx");
const signInModalSource = read("app/sign-in-modal.tsx");
const authRedirectSource = read("lib/auth-redirect.ts");
const authCallbackSource = read("app/auth/callback/route.ts");

// 1. SignInCardContent defaults to the light variant
check(
  "SignInCardContent declares an optional variant prop defaulting to 'light'",
  /variant\?:\s*"light"\s*\|\s*"dark"/.test(signInCardContentSource) &&
    /variant\s*=\s*"light"/.test(signInCardContentSource)
);

// 2. /login explicitly uses the dark variant
check(
  "/login passes variant=\"dark\" to SignInCardContent",
  /<SignInCardContent[\s\S]*?variant="dark"/.test(loginPageSource)
);

// 3. SignInModal remains untouched and does not opt into the dark variant
check(
  "SignInModal never passes a variant prop to SignInCardContent (still relies on the light default)",
  !/<SignInCardContent[\s\S]*?variant=/.test(signInModalSource)
);

// 4. /login still retains the required Suspense/build-safe structure
check(
  "/login still imports Suspense and calls useSearchParams()",
  /import\s*{[^}]*\bSuspense\b[^}]*}\s*from\s*"react"/.test(loginPageSource) &&
    loginPageSource.includes("useSearchParams(")
);

// 5. Existing OAuth hook usage remains present
check(
  "SignInCardContent still calls useGoogleSignIn() and startSignIn is still wired to the button's onClick",
  signInCardContentSource.includes("useGoogleSignIn()") &&
    /onClick=\{\(\)\s*=>\s*startSignIn\(nextPath\)\}/.test(
      signInCardContentSource
    )
);

// 6. No auth callback or redirect logic was changed
check(
  "lib/auth-redirect.ts still exports sanitizeNextPath with its open-redirect guard intact",
  authRedirectSource.includes("export function sanitizeNextPath") &&
    authRedirectSource.includes("CONTROL_CHARACTER_PATTERN")
);
check(
  "app/auth/callback/route.ts still exchanges the OAuth code for a session and redirects with no-store headers",
  authCallbackSource.includes("exchangeCodeForSession(code)") &&
    authCallbackSource.includes("NO_STORE_HEADERS")
);
check(
  "app/login/page.tsx still reads the same error/next query params it always did",
  loginPageSource.includes('searchParams.get("error")') &&
    loginPageSource.includes('searchParams.get("next")')
);

// 7. LanguageSwitcher uses its dark variant on /login
check(
  "/login renders LanguageSwitcher with variant=\"dark\"",
  /<LanguageSwitcher[\s\S]*?variant="dark"/.test(loginPageSource)
);

if (failures > 0) {
  console.error(`\nLogin page visual variant tests: ${failures} failed`);
  process.exitCode = 1;
} else {
  console.log("\nLogin page visual variant tests: all passed");
}
