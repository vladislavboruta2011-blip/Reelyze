import { readFileSync } from "node:fs";
import path from "node:path";

// useSearchParams() must be wrapped in a <Suspense> boundary, or `next
// build` fails at the static-prerender phase with "useSearchParams()
// should be wrapped in a suspense boundary" — a build-time failure that
// tsc/eslint cannot catch (it's a Next.js App Router prerender
// requirement, not a type or lint error). This repo has no build-running
// test harness, so this checks the source shape directly: the file must
// import Suspense, and useSearchParams must be called inside a component
// that is rendered under a <Suspense> boundary in the default export.

const loginPagePath = path.join(
  process.cwd(),
  "app",
  "login",
  "page.tsx"
);
const source = readFileSync(loginPagePath, "utf8");

let failures = 0;

const importsSuspense =
  /import\s*{[^}]*\bSuspense\b[^}]*}\s*from\s*"react"/.test(source);

if (importsSuspense) {
  console.log("PASS — app/login/page.tsx imports Suspense from react");
} else {
  console.error(
    "FAIL — app/login/page.tsx must import Suspense from react"
  );
  failures += 1;
}

const usesSearchParams = source.includes("useSearchParams(");

if (!usesSearchParams) {
  console.error(
    "FAIL — expected app/login/page.tsx to call useSearchParams(); this test is stale if that's intentionally no longer true"
  );
  failures += 1;
} else {
  console.log("PASS — app/login/page.tsx still calls useSearchParams()");
}

// The default export must wrap its returned JSX in <Suspense ...> — this
// is a source-level proxy for "the searchParams-consuming component is
// not rendered directly by the page's default export without a boundary".
const defaultExportStart = source.indexOf(
  "export default function LoginPage"
);
const defaultExportBody =
  defaultExportStart >= 0 ? source.slice(defaultExportStart) : "";

const defaultExportWrapsInSuspense =
  /return\s*\(\s*<Suspense[\s>]/.test(defaultExportBody);

if (defaultExportStart >= 0 && defaultExportWrapsInSuspense) {
  console.log(
    "PASS — LoginPage's default export renders its content inside <Suspense>"
  );
} else {
  console.error(
    "FAIL — LoginPage's default export must return <Suspense> wrapping the useSearchParams()-consuming component, or `next build` will fail at prerender time on /login"
  );
  failures += 1;
}

if (failures > 0) {
  console.error(`\nlogin page build-safety tests: ${failures} failed`);
  process.exitCode = 1;
} else {
  console.log("\nlogin page build-safety tests: all passed");
}
