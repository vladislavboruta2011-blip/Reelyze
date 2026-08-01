import { readFileSync } from "node:fs";
import { getMessages } from "../lib/messages";

// Focused regression coverage for the /competitor-scripts mode-selection
// visual refresh. This is a source-shape test (no DOM renderer available),
// matching the convention already used by tests/competitor-scripts.ts —
// it checks the real source files directly. Scope is narrow on purpose:
// prove the new badge/glow treatment was added without disturbing the
// literal structural contracts tests/competitor-scripts.ts already
// enforces (the animate-page-enter wrapper, the Sidebar/ModeCard hrefs,
// no "use client").

let failures = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    console.log(`PASS — ${name}`);
  } else {
    console.error(`FAIL — ${name}`);
    failures += 1;
  }
}

console.log("\nCompetitor Scripts Mode-Selection Visual Refresh Tests\n");

const pageSource = readFileSync("app/competitor-scripts/page.tsx", "utf8");

// ── copy: new badge key ─────────────────────────────────────────────────

for (const locale of ["en", "ru"] as const) {
  const copy = getMessages(locale).competitorScripts.modeSelection;

  check(
    `${locale}: modeSelection.badge is a non-empty string`,
    typeof copy.badge === "string" && copy.badge.length > 0
  );
}

check(
  "EN and RU expose different badge copy (not left untranslated)",
  getMessages("en").competitorScripts.modeSelection.badge !==
    getMessages("ru").competitorScripts.modeSelection.badge
);

check(
  "pageTitle is untouched and still distinct from the new badge copy — sidebar.tsx still reads pageTitle for its own nav label, unaffected by this page-level change",
  getMessages("en").competitorScripts.modeSelection.pageTitle ===
    "Competitor Scripts" &&
    getMessages("en").competitorScripts.modeSelection.pageTitle !==
      getMessages("en").competitorScripts.modeSelection.badge
);

// ── page.tsx: badge is actually rendered ────────────────────────────────

check(
  "page.tsx renders the new badge copy",
  pageSource.includes("{copy.badge}")
);

check(
  "the badge pill is purely presentational — its icon is aria-hidden",
  /<Sparkles[^>]*aria-hidden="true"/.test(pageSource)
);

// ── page.tsx: the dark-theme decorative glow layer was removed ─────────
// The card previously carried a purple/blue blurred glow layer tuned for
// the old black card background. The light-theme conversion moved the
// card to a plain white surface, and the glow was dropped entirely rather
// than re-tinted for light — restraint over decoration, consistent with
// the rest of this conversion.

check(
  "the old dark-theme glow-background layer no longer exists on the mode-selection card",
  !pageSource.includes(
    'className="pointer-events-none absolute inset-0 z-0 overflow-hidden"'
  )
);

check(
  "the mode-selection card is a plain light surface (white background, neutral border), not the old dark/glow treatment",
  pageSource.includes("border-[#E5E7EB] bg-white") &&
    !pageSource.includes("bg-[#0A0A12]") &&
    !pageSource.includes("border-white/[0.12]")
);

// ── structural contracts already enforced by tests/competitor-scripts.ts —
//    re-checked here too, scoped to this change, as a fast focused signal ──

check(
  "the animate-page-enter content wrapper's className is still exactly preserved",
  pageSource.includes('className="animate-page-enter lg:ml-[260px]"')
);

check(
  "<Sidebar messages={messages} /> is still immediately followed by the animate-page-enter wrapper — the persistent shell still isn't animated",
  /<Sidebar messages=\{messages\} \/>\s*\n\s*<div className="animate-page-enter/.test(
    pageSource
  )
);

check(
  "both ModeCard hrefs are still real, unchanged routes",
  pageSource.includes('href="/competitor-scripts/analyze"') &&
    pageSource.includes('href="/competitor-scripts/compare"')
);

check(
  "page.tsx did not gain a \"use client\" directive — the refresh is pure CSS/markup and requires no Client Component conversion",
  !pageSource.includes('"use client"')
);

check(
  "ModeCard is still imported and still used for both cards — its mechanics were not reimplemented inline",
  pageSource.includes('import { ModeCard } from "./mode-card"') &&
    (pageSource.match(/<ModeCard/g) ?? []).length === 2
);

if (failures > 0) {
  console.error(
    `\nCompetitor Scripts mode-selection visual refresh tests: ${failures} failed`
  );
  process.exitCode = 1;
} else {
  console.log(
    "\nCompetitor Scripts mode-selection visual refresh tests: all passed"
  );
}
