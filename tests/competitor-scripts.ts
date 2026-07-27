import { existsSync, readFileSync } from "node:fs";
import { LAUNCHED_LOCALES } from "../lib/i18n";
import { getMessages } from "../lib/messages";

let failures = 0;

function check(label: string, pass: boolean, detail?: string): void {
  if (pass) {
    console.log(`PASS — ${label}`);
    return;
  }

  failures += 1;
  console.error(`FAIL — ${label}${detail ? `: ${detail}` : ""}`);
}

console.log("\nCompetitor Scripts structural tests\n");

// ── mode-selection message coverage across every launched locale ───────

for (const locale of LAUNCHED_LOCALES) {
  const copy = getMessages(locale).competitorScripts.modeSelection;

  check(
    `${locale}: modeSelection has all top-level keys`,
    typeof copy.pageTitle === "string" &&
      typeof copy.heading === "string" &&
      typeof copy.subheading === "string" &&
      typeof copy.note === "string" &&
      typeof copy.comingNextMessage === "string" &&
      typeof copy.sidebar.freePlan === "string"
  );

  check(
    `${locale}: analyzeCard has title/accentSubtitle/description/action and 5 benefits`,
    typeof copy.analyzeCard.title === "string" &&
      typeof copy.analyzeCard.accentSubtitle === "string" &&
      typeof copy.analyzeCard.description === "string" &&
      typeof copy.analyzeCard.action === "string" &&
      copy.analyzeCard.benefits.length === 5
  );

  check(
    `${locale}: compareCard has title/accentSubtitle/description/action and 5 benefits`,
    typeof copy.compareCard.title === "string" &&
      typeof copy.compareCard.accentSubtitle === "string" &&
      typeof copy.compareCard.description === "string" &&
      typeof copy.compareCard.action === "string" &&
      copy.compareCard.benefits.length === 5
  );

  check(
    `${locale}: modeSelection has no empty field`,
    copy.pageTitle.length > 0 &&
      copy.heading.length > 0 &&
      copy.subheading.length > 0 &&
      copy.note.length > 0 &&
      copy.comingNextMessage.length > 0 &&
      copy.sidebar.freePlan.length > 0 &&
      copy.analyzeCard.benefits.every((benefit) => benefit.length > 0) &&
      copy.compareCard.benefits.every((benefit) => benefit.length > 0)
  );
}

check(
  "EN and RU expose the exact same modeSelection key structure",
  JSON.stringify(
    Object.keys(getMessages("en").competitorScripts.modeSelection).sort()
  ) ===
    JSON.stringify(
      Object.keys(getMessages("ru").competitorScripts.modeSelection).sort()
    )
);

check(
  "EN and RU analyzeCard/compareCard have the same key structure",
  JSON.stringify(
    Object.keys(getMessages("en").competitorScripts.modeSelection.analyzeCard).sort()
  ) ===
    JSON.stringify(
      Object.keys(getMessages("ru").competitorScripts.modeSelection.analyzeCard).sort()
    ) &&
    JSON.stringify(
      Object.keys(getMessages("en").competitorScripts.modeSelection.compareCard).sort()
    ) ===
      JSON.stringify(
        Object.keys(getMessages("ru").competitorScripts.modeSelection.compareCard).sort()
      )
);

check(
  "EN and RU copy actually differ (translation isn't just copied through)",
  getMessages("en").competitorScripts.modeSelection.heading !==
    getMessages("ru").competitorScripts.modeSelection.heading
);

check(
  "no Ukrainian locale was introduced",
  !readFileSync("lib/messages.ts", "utf8").includes('"uk"')
);

// ── analyze-page message coverage across every launched locale ─────────

for (const locale of LAUNCHED_LOCALES) {
  const copy = getMessages(locale).competitorScripts.analyze;

  check(
    `${locale}: analyze has all top-level keys`,
    typeof copy.backToSelection === "string" &&
      typeof copy.heroEyebrow === "string" &&
      typeof copy.pageTitle === "string" &&
      typeof copy.headingPrefix === "string" &&
      typeof copy.headingAccent === "string" &&
      typeof copy.description === "string" &&
      typeof copy.urlLabel === "string" &&
      typeof copy.urlPlaceholder === "string" &&
      typeof copy.submitLabel === "string"
  );

  check(
    `${locale}: heroEyebrow/headingPrefix/headingAccent are non-empty and headingPrefix+headingAccent together form the same sentence as pageTitle would suggest`,
    copy.heroEyebrow.length > 0 &&
      copy.headingPrefix.length > 0 &&
      copy.headingAccent.length > 0
  );

  check(
    `${locale}: analyze.privacyNote has a heading and 2 items`,
    typeof copy.privacyNote.heading === "string" &&
      copy.privacyNote.items.length === 2
  );

  check(
    `${locale}: analyze.workflow has a section label and exactly 5 stages`,
    typeof copy.workflow.sectionLabel === "string" &&
      copy.workflow.stages.length === 5 &&
      copy.workflow.stages.every(
        (stage) => stage.title.length > 0 && stage.description.length > 0
      )
  );

  check(
    `${locale}: analyze.breakdown has a heading and exactly 8 items`,
    typeof copy.breakdown.heading === "string" &&
      copy.breakdown.items.length === 8 &&
      copy.breakdown.items.every(
        (item) => item.title.length > 0 && item.description.length > 0
      )
  );

  check(
    `${locale}: analyze.example has a heading, an explicit illustrative disclaimer, 6 stages and 6 script lines`,
    typeof copy.example.heading === "string" &&
      typeof copy.example.disclaimer === "string" &&
      copy.example.disclaimer.length > 0 &&
      copy.example.stages.length === 6 &&
      copy.example.scriptLines.length === 6
  );

  check(
    `${locale}: analyze.errors has emptyUrl/invalidUrl/unsupportedUrl`,
    typeof copy.errors.emptyUrl === "string" &&
      typeof copy.errors.invalidUrl === "string" &&
      typeof copy.errors.unsupportedUrl === "string" &&
      copy.errors.emptyUrl !== copy.errors.invalidUrl &&
      copy.errors.invalidUrl !== copy.errors.unsupportedUrl
  );

  check(
    `${locale}: analyze has no empty field`,
    copy.backToSelection.length > 0 &&
      copy.heroEyebrow.length > 0 &&
      copy.pageTitle.length > 0 &&
      copy.headingPrefix.length > 0 &&
      copy.headingAccent.length > 0 &&
      copy.description.length > 0 &&
      copy.urlLabel.length > 0 &&
      copy.submitLabel.length > 0 &&
      copy.privacyNote.items.every((item) => item.length > 0)
  );
}

check(
  "EN and RU expose the exact same analyze key structure",
  JSON.stringify(Object.keys(getMessages("en").competitorScripts.analyze).sort()) ===
    JSON.stringify(Object.keys(getMessages("ru").competitorScripts.analyze).sort())
);

check(
  "EN and RU analyze.errors have the same key structure",
  JSON.stringify(
    Object.keys(getMessages("en").competitorScripts.analyze.errors).sort()
  ) ===
    JSON.stringify(
      Object.keys(getMessages("ru").competitorScripts.analyze.errors).sort()
    )
);

check(
  "EN and RU analyze copy actually differ",
  getMessages("en").competitorScripts.analyze.pageTitle !==
    getMessages("ru").competitorScripts.analyze.pageTitle
);

check(
  "EN and RU analyze.workflow/breakdown/example have the same key structure",
  JSON.stringify(
    Object.keys(getMessages("en").competitorScripts.analyze.workflow).sort()
  ) ===
    JSON.stringify(
      Object.keys(getMessages("ru").competitorScripts.analyze.workflow).sort()
    ) &&
    JSON.stringify(
      Object.keys(getMessages("en").competitorScripts.analyze.breakdown).sort()
    ) ===
      JSON.stringify(
        Object.keys(getMessages("ru").competitorScripts.analyze.breakdown).sort()
      ) &&
    JSON.stringify(
      Object.keys(getMessages("en").competitorScripts.analyze.example).sort()
    ) ===
      JSON.stringify(
        Object.keys(getMessages("ru").competitorScripts.analyze.example).sort()
      )
);

check(
  "EN and RU workflow/breakdown/example items each have the same per-item key structure",
  JSON.stringify(
    Object.keys(getMessages("en").competitorScripts.analyze.workflow.stages[0]).sort()
  ) ===
    JSON.stringify(
      Object.keys(getMessages("ru").competitorScripts.analyze.workflow.stages[0]).sort()
    ) &&
    JSON.stringify(
      Object.keys(getMessages("en").competitorScripts.analyze.breakdown.items[0]).sort()
    ) ===
      JSON.stringify(
        Object.keys(getMessages("ru").competitorScripts.analyze.breakdown.items[0]).sort()
      ) &&
    JSON.stringify(
      Object.keys(getMessages("en").competitorScripts.analyze.example.stages[0]).sort()
    ) ===
      JSON.stringify(
        Object.keys(getMessages("ru").competitorScripts.analyze.example.stages[0]).sort()
      )
);

// ── compare-page message coverage across every launched locale ─────────

for (const locale of LAUNCHED_LOCALES) {
  const copy = getMessages(locale).competitorScripts.compare;

  check(
    `${locale}: compare has all top-level keys`,
    typeof copy.backToSelection === "string" &&
      typeof copy.heroEyebrow === "string" &&
      typeof copy.pageTitle === "string" &&
      typeof copy.headingPrefix === "string" &&
      typeof copy.headingAccent === "string" &&
      typeof copy.description === "string" &&
      typeof copy.urlLabel === "string" &&
      typeof copy.urlPlaceholder === "string" &&
      typeof copy.scriptLabel === "string" &&
      typeof copy.scriptPlaceholder === "string" &&
      typeof copy.scriptHelper === "string" &&
      typeof copy.submitLabel === "string" &&
      typeof copy.comingNextMessage === "string"
  );

  check(
    `${locale}: compare.privacyNote has a heading and 3 items`,
    typeof copy.privacyNote.heading === "string" &&
      copy.privacyNote.items.length === 3
  );

  check(
    `${locale}: compare.errors has all 5 keys, each distinct`,
    typeof copy.errors.emptyUrl === "string" &&
      typeof copy.errors.invalidUrl === "string" &&
      typeof copy.errors.unsupportedUrl === "string" &&
      typeof copy.errors.emptyScript === "string" &&
      typeof copy.errors.scriptTooLong === "string" &&
      new Set([
        copy.errors.emptyUrl,
        copy.errors.invalidUrl,
        copy.errors.unsupportedUrl,
        copy.errors.emptyScript,
        copy.errors.scriptTooLong,
      ]).size === 5
  );

  check(
    `${locale}: compare.workflow has a section label and exactly 4 stages`,
    typeof copy.workflow.sectionLabel === "string" &&
      copy.workflow.stages.length === 4 &&
      copy.workflow.stages.every(
        (stage) => stage.title.length > 0 && stage.description.length > 0
      )
  );

  check(
    `${locale}: compare.coverage has a heading and exactly 8 items`,
    typeof copy.coverage.heading === "string" &&
      copy.coverage.items.length === 8 &&
      copy.coverage.items.every(
        (item) => item.title.length > 0 && item.description.length > 0
      )
  );

  check(
    `${locale}: compare.example has a heading, an explicit illustrative disclaimer, matching-length columns, and a summary`,
    typeof copy.example.heading === "string" &&
      typeof copy.example.disclaimer === "string" &&
      copy.example.disclaimer.length > 0 &&
      copy.example.competitorLines.length ===
        copy.example.yourScriptLines.length &&
      copy.example.competitorLines.length > 0 &&
      typeof copy.example.summaryHeading === "string" &&
      copy.example.summaryItems.length > 0
  );

  check(
    `${locale}: compare has no empty field`,
    copy.backToSelection.length > 0 &&
      copy.heroEyebrow.length > 0 &&
      copy.headingPrefix.length > 0 &&
      copy.headingAccent.length > 0 &&
      copy.description.length > 0 &&
      copy.urlLabel.length > 0 &&
      copy.scriptLabel.length > 0 &&
      copy.scriptHelper.length > 0 &&
      copy.submitLabel.length > 0 &&
      copy.privacyNote.items.every((item) => item.length > 0)
  );
}

check(
  "EN and RU expose the exact same compare key structure",
  JSON.stringify(Object.keys(getMessages("en").competitorScripts.compare).sort()) ===
    JSON.stringify(Object.keys(getMessages("ru").competitorScripts.compare).sort())
);

check(
  "EN and RU compare.errors/workflow/coverage/example have the same key structure",
  JSON.stringify(
    Object.keys(getMessages("en").competitorScripts.compare.errors).sort()
  ) ===
    JSON.stringify(
      Object.keys(getMessages("ru").competitorScripts.compare.errors).sort()
    ) &&
    JSON.stringify(
      Object.keys(getMessages("en").competitorScripts.compare.workflow).sort()
    ) ===
      JSON.stringify(
        Object.keys(getMessages("ru").competitorScripts.compare.workflow).sort()
      ) &&
    JSON.stringify(
      Object.keys(getMessages("en").competitorScripts.compare.coverage).sort()
    ) ===
      JSON.stringify(
        Object.keys(getMessages("ru").competitorScripts.compare.coverage).sort()
      ) &&
    JSON.stringify(
      Object.keys(getMessages("en").competitorScripts.compare.example).sort()
    ) ===
      JSON.stringify(
        Object.keys(getMessages("ru").competitorScripts.compare.example).sort()
      )
);

check(
  "EN and RU compare.workflow.stages/coverage.items each have the same per-item key structure",
  JSON.stringify(
    Object.keys(getMessages("en").competitorScripts.compare.workflow.stages[0]).sort()
  ) ===
    JSON.stringify(
      Object.keys(getMessages("ru").competitorScripts.compare.workflow.stages[0]).sort()
    ) &&
    JSON.stringify(
      Object.keys(getMessages("en").competitorScripts.compare.coverage.items[0]).sort()
    ) ===
      JSON.stringify(
        Object.keys(getMessages("ru").competitorScripts.compare.coverage.items[0]).sort()
      )
);

check(
  "EN and RU compare copy actually differ",
  getMessages("en").competitorScripts.compare.pageTitle !==
    getMessages("ru").competitorScripts.compare.pageTitle
);

// ── ModeCard: safe by default, real navigation only when given a real href ──

const modeCardSource = readFileSync(
  "app/competitor-scripts/mode-card.tsx",
  "utf8"
);

check(
  "ModeCard's CTA is never a native disabled control",
  !modeCardSource.includes("disabled")
);
check(
  "ModeCard falls back to a real <button type=\"button\"> when no href is given",
  modeCardSource.includes('type="button"')
);
check(
  "the coming-next message uses role=\"status\"/aria-live=\"polite\", not an alert, and only renders when there's no href",
  modeCardSource.includes('role="status"') &&
    modeCardSource.includes('aria-live="polite"') &&
    !modeCardSource.includes('role="alert"') &&
    modeCardSource.includes("{!href && showComingNext")
);

// ── Every ModeCard/Sidebar href actually resolves to a real page on disk ────
//
// This is the actual anti-404 guarantee: rather than trust a hand-maintained
// allowlist of "real" paths, this derives the same check the App Router
// itself uses — a route only exists if app/<route>/page.tsx exists.

function routeToPageFile(route: string): string {
  return route === "/" ? "app/page.tsx" : `app${route}/page.tsx`;
}

const analyzeComponentPaths = [
  "app/competitor-scripts/analyze/page.tsx",
  "app/competitor-scripts/analyze/analyze-input-form.tsx",
  "app/competitor-scripts/analyze/hero-illustration.tsx",
  "app/competitor-scripts/analyze/workflow-steps.tsx",
  "app/competitor-scripts/analyze/breakdown-section.tsx",
  "app/competitor-scripts/analyze/example-preview.tsx",
];

const compareComponentPaths = [
  "app/competitor-scripts/compare/page.tsx",
  "app/competitor-scripts/compare/compare-input-form.tsx",
  "app/competitor-scripts/compare/hero-illustration.tsx",
  "app/competitor-scripts/compare/workflow-steps.tsx",
  "app/competitor-scripts/compare/coverage-section.tsx",
  "app/competitor-scripts/compare/example-comparison.tsx",
];

const allSourceFiles = [
  "app/competitor-scripts/page.tsx",
  "app/competitor-scripts/mode-card.tsx",
  "app/competitor-scripts/sidebar.tsx",
  "app/competitor-scripts/url-validation.ts",
  ...analyzeComponentPaths,
  ...compareComponentPaths,
]
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, "utf8"));

const allHrefs = allSourceFiles.flatMap((source) =>
  [...source.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
);

check(
  "every href found across the Competitor Scripts feature resolves to a real app/**/page.tsx",
  allHrefs.length > 0 &&
    allHrefs.every((href) => existsSync(routeToPageFile(href)))
);

check(
  "the /competitor-scripts/compare route exists on disk",
  existsSync("app/competitor-scripts/compare/page.tsx")
);

check(
  "no compare RESULT route exists yet (no app/competitor-scripts/compare/result*)",
  !existsSync("app/competitor-scripts/compare/result") &&
    !existsSync("app/competitor-scripts/compare/results")
);

const modeSelectionPageSource = readFileSync(
  "app/competitor-scripts/page.tsx",
  "utf8"
);

check(
  "the mode-selection Compare card now links to the real /competitor-scripts/compare route",
  /href="\/competitor-scripts\/compare"/.test(modeSelectionPageSource)
);

check(
  "the mode-selection Analyze card still links to /competitor-scripts/analyze",
  /href="\/competitor-scripts\/analyze"/.test(modeSelectionPageSource)
);

// ── Sidebar: only real routes, no fabricated usage numbers ─────────────

const sidebarSource = readFileSync("app/competitor-scripts/sidebar.tsx", "utf8");

check(
  "the plan card shows no fabricated usage numbers (no digit/digit pattern)",
  !/\d+\s*\/\s*\d+/.test(sidebarSource)
);

check(
  "Competitor Scripts nav item is hardcoded active",
  sidebarSource.includes('label={copy.pageTitle}') &&
    /label=\{copy\.pageTitle\}\s*\n\s*active/.test(sidebarSource)
);

// ── SidebarAccount: real session fields only ────────────────────────────

const sidebarAccountSource = readFileSync(
  "app/competitor-scripts/sidebar-account.tsx",
  "utf8"
);

check(
  "SidebarAccount reads only real session fields (name/email/avatarUrl), never a fabricated identity",
  sidebarAccountSource.includes("user.name") &&
    sidebarAccountSource.includes("user.email") &&
    sidebarAccountSource.includes("user.avatarUrl")
);

check(
  "SidebarAccount reuses the shared supabaseBrowser sign-out call, not a bespoke one",
  sidebarAccountSource.includes("supabaseBrowser.auth.signOut()")
);

// ── AnalyzeInputForm: no network calls, correct validation order ───────

const analyzeFormSource = readFileSync(
  "app/competitor-scripts/analyze/analyze-input-form.tsx",
  "utf8"
);

check(
  "AnalyzeInputForm never calls fetch or any API",
  !/\bfetch\(/.test(analyzeFormSource)
);

check(
  "AnalyzeInputForm never imports next/navigation's router (no client-side navigation on submit)",
  !analyzeFormSource.includes("useRouter")
);

check(
  "empty-URL is checked before the URL is parsed",
  analyzeFormSource.indexOf("errors.emptyUrl") <
    analyzeFormSource.indexOf("new URL(trimmed)")
);

check(
  "malformed-URL is checked before the supported-host check",
  analyzeFormSource.indexOf("errors.invalidUrl") <
    analyzeFormSource.indexOf("isSupportedVideoUrl(trimmed)")
);

check(
  "only a well-formed, YouTube-hostname URL ever reveals the coming-next status",
  /isSupportedVideoUrl\(trimmed\)\) \{\s*\n\s*setError\(copy\.errors\.unsupportedUrl\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*\n\s*setError\(""\);\s*\n\s*setShowComingNext\(true\);/.test(
    analyzeFormSource
  )
);

check(
  "validation errors use role=\"alert\", the coming-next status uses role=\"status\"/aria-live=\"polite\"",
  analyzeFormSource.includes('role="alert"') &&
    analyzeFormSource.includes('role="status"') &&
    analyzeFormSource.includes('aria-live="polite"')
);

check(
  "the URL input is associated with its error via aria-describedby/aria-invalid, not color alone",
  analyzeFormSource.includes("aria-describedby") &&
    analyzeFormSource.includes("aria-invalid")
);

// ── analyze page: back link, no fake result/timeline before submission ──

const analyzePageSource = readFileSync(
  "app/competitor-scripts/analyze/page.tsx",
  "utf8"
);

check(
  "the hero heading is localized (headingPrefix/headingAccent), not hardcoded English text",
  analyzePageSource.includes("{copy.headingPrefix}") &&
    analyzePageSource.includes("{copy.headingAccent}") &&
    !/<h1[^>]*>\s*Analyze/.test(analyzePageSource)
);

check(
  "the accent gradient (horizontal, bg-clip-text) is applied only to the headingAccent span, and both visual spans stay in sync with the full-sentence aria-label",
  /aria-label=\{copy\.pageTitle\}/.test(analyzePageSource) &&
    /bg-gradient-to-r[\s\S]{0,160}bg-clip-text[\s\S]{0,80}text-transparent[\s\S]{0,400}>\s*\{copy\.headingAccent\}/.test(
      analyzePageSource
    ) &&
    !/bg-clip-text[\s\S]{0,400}\{copy\.headingPrefix\}/.test(analyzePageSource)
);

check(
  "both heading spans are aria-hidden (the h1's own aria-label carries the accessible name instead)",
  (analyzePageSource.match(/aria-hidden="true"/g) ?? []).length >= 2
);

check(
  "the hero eyebrow is localized, not hardcoded 'COMPETITOR ANALYSIS' text",
  analyzePageSource.includes("{copy.heroEyebrow}") &&
    !/>COMPETITOR ANALYSIS</.test(analyzePageSource)
);

check(
  "the decorative accent underline is aria-hidden and purely decorative (no visible/localized text inside it)",
  /rounded-full bg-gradient-to-r[\s\S]{0,80}aria-hidden="true"|aria-hidden="true"[\s\S]{0,120}rounded-full bg-gradient-to-r/.test(
    analyzePageSource
  )
);

check(
  "the forward-slant skew is applied only to the accent line, never the first line",
  !/headingPrefix[\s\S]{0,300}skew-x-\[/.test(analyzePageSource) &&
    /skew-x-\[/.test(analyzePageSource)
);

check(
  "no new font import was introduced (still only next/font's existing Geist)",
  (analyzePageSource.match(/^import /gm) ?? []).every(
    (line) => !/font/i.test(line)
  )
);

check(
  "the analyze page links back to mode selection, not home",
  /href="\/competitor-scripts"/.test(analyzePageSource)
);

// ── new lower sections: static/informational, never live, never fake data ──

const analyzeFeatureSource = allSourceFiles.join("\n");

check(
  "no timer-driven fake processing exists anywhere in the Competitor Scripts feature (no setInterval/setTimeout)",
  !/setInterval\(|setTimeout\(/.test(analyzeFeatureSource)
);

check(
  "no fake live-progress semantics exist (no progressbar role, no animate-spin, no 'in progress' copy)",
  !/role="progressbar"|animate-spin|in[- ]progress/i.test(analyzeFeatureSource)
);

check(
  "the workflow section is a static <ol> with real stage content, not conditionally revealed by form/submit state",
  /<ol className="relative mt-5/.test(readFileSync(
    "app/competitor-scripts/analyze/workflow-steps.tsx",
    "utf8"
  )) &&
    !readFileSync(
      "app/competitor-scripts/analyze/workflow-steps.tsx",
      "utf8"
    ).includes("useState")
);

check(
  "the example preview visibly renders its illustrative disclaimer text, not just in a title/tooltip attribute",
  readFileSync("app/competitor-scripts/analyze/example-preview.tsx", "utf8").includes(
    "{example.disclaimer}"
  )
);

check(
  "no real creator, channel, or video reference (no embedded URL/link) appears in the example preview's fictional script",
  !/https?:\/\//.test(
    readFileSync("app/competitor-scripts/analyze/example-preview.tsx", "utf8")
  )
);

check(
  "the decorative hero illustration is hidden from assistive tech (aria-hidden on its root)",
  /export function HeroIllustration[\s\S]*?aria-hidden="true"/.test(
    readFileSync("app/competitor-scripts/analyze/hero-illustration.tsx", "utf8")
  )
);

check(
  "the hero illustration contains no visible text content (only shapes/icons), avoiding any hardcoded or mixed-language string",
  !/>[A-Za-z]{2,}</.test(
    readFileSync("app/competitor-scripts/analyze/hero-illustration.tsx", "utf8")
  )
);

check(
  "the Analyze submit button is disabled only while the URL field is empty (native disabled attribute)",
  readFileSync(
    "app/competitor-scripts/analyze/analyze-input-form.tsx",
    "utf8"
  ).includes('disabled={url.trim().length === 0}')
);

// ── CompareInputForm: two fields, local-only, correct validation ───────

const compareFormSource = readFileSync(
  "app/competitor-scripts/compare/compare-input-form.tsx",
  "utf8"
);

check(
  "CompareInputForm reuses the shared isSupportedVideoUrl helper instead of redefining it",
  compareFormSource.includes(
    'import { isSupportedVideoUrl } from "../url-validation"'
  ) && !/function isSupportedVideoUrl/.test(compareFormSource)
);

check(
  "the shared url-validation helper exists and is the single definition used by both forms",
  existsSync("app/competitor-scripts/url-validation.ts") &&
    (
      readFileSync(
        "app/competitor-scripts/analyze/analyze-input-form.tsx",
        "utf8"
      ).match(/function isSupportedVideoUrl/g) ?? []
    ).length === 0
);

check(
  "the form has exactly one URL input and one textarea",
  (compareFormSource.match(/type="url"/g) ?? []).length === 1 &&
    (compareFormSource.match(/<textarea/g) ?? []).length === 1
);

check(
  "the script field has a 1000-character maximum, tracked without silent truncation (no maxLength attribute)",
  compareFormSource.includes("MAX_SCRIPT_CHARACTERS = 1000") &&
    !compareFormSource.includes("maxLength")
);

check(
  "a visible current/1000 character counter is rendered",
  /\{script\.length\}\/\{MAX_SCRIPT_CHARACTERS\}/.test(compareFormSource)
);

check(
  "empty-script and over-limit-script validation both exist and are distinct",
  compareFormSource.includes("errors.emptyScript") &&
    compareFormSource.includes("errors.scriptTooLong") &&
    compareFormSource.includes("script.length > MAX_SCRIPT_CHARACTERS")
);

check(
  "empty/malformed/unsupported competitor-URL validation exists, in that order",
  compareFormSource.indexOf("errors.emptyUrl") <
    compareFormSource.indexOf("isSupportedVideoUrl(trimmedUrl)") &&
    compareFormSource.indexOf("errors.invalidUrl") <
      compareFormSource.indexOf("isSupportedVideoUrl(trimmedUrl)")
);

check(
  "CompareInputForm never calls fetch or any API",
  !/\bfetch\(/.test(compareFormSource)
);

check(
  "CompareInputForm never imports next/navigation's router (no client-side navigation on submit)",
  !compareFormSource.includes("useRouter")
);

check(
  "the submit button is disabled only while either field is empty (native disabled attribute)",
  compareFormSource.includes(
    "disabled={\n            competitorUrl.trim().length === 0 || script.trim().length === 0\n          }"
  ) ||
    /disabled=\{[\s\S]{0,120}competitorUrl\.trim\(\)\.length === 0[\s\S]{0,40}script\.trim\(\)\.length === 0/.test(
      compareFormSource
    )
);

check(
  "validation errors use role=\"alert\" for both fields; the coming-next status uses role=\"status\"/aria-live=\"polite\"",
  (compareFormSource.match(/role="alert"/g) ?? []).length === 2 &&
    compareFormSource.includes('role="status"') &&
    compareFormSource.includes('aria-live="polite"')
);

check(
  "both the URL input and the textarea are associated with their errors via aria-describedby/aria-invalid, not color alone",
  compareFormSource.includes("aria-describedby={urlError ? urlErrorId") &&
    compareFormSource.includes("aria-describedby={\n            scriptError") &&
    (compareFormSource.match(/aria-invalid=\{/g) ?? []).length === 2
);

check(
  "the textarea's aria-describedby includes the character-counter id",
  compareFormSource.includes("scriptCounterId")
);

// ── compare page: back link, hero, illustration, workflow, coverage ────

const comparePageSource = readFileSync(
  "app/competitor-scripts/compare/page.tsx",
  "utf8"
);

check(
  "the compare page links back to mode selection, not home",
  /href="\/competitor-scripts"/.test(comparePageSource)
);

check(
  "the compare hero heading is localized (headingPrefix/headingAccent), not hardcoded text",
  comparePageSource.includes("{copy.headingPrefix}") &&
    comparePageSource.includes("{copy.headingAccent}") &&
    /aria-label=\{copy\.pageTitle\}/.test(comparePageSource)
);

check(
  "both compare heading spans are aria-hidden (the h1's own aria-label carries the accessible name instead)",
  (comparePageSource.match(/aria-hidden="true"/g) ?? []).length >= 2
);

check(
  "the compare hero eyebrow is localized, not hardcoded text",
  comparePageSource.includes("{copy.heroEyebrow}") &&
    !/>SCRIPT COMPARISON</.test(comparePageSource)
);

const compareWorkflowSource = readFileSync(
  "app/competitor-scripts/compare/workflow-steps.tsx",
  "utf8"
);

check(
  "the compare workflow section is static (no useState, no timers)",
  !compareWorkflowSource.includes("useState") &&
    !/setInterval\(|setTimeout\(/.test(compareWorkflowSource)
);

check(
  "no fake live-progress semantics exist anywhere in the compare feature (no progressbar role, no animate-spin)",
  !/role="progressbar"|animate-spin/i.test(
    [comparePageSource, compareFormSource, compareWorkflowSource].join("\n")
  )
);

const compareExampleSource = readFileSync(
  "app/competitor-scripts/compare/example-comparison.tsx",
  "utf8"
);

check(
  "the compare example preview visibly renders its illustrative disclaimer text",
  compareExampleSource.includes("{example.disclaimer}")
);

check(
  "no real creator, channel, or video reference (no embedded URL/link) appears in the compare example's fictional content",
  !/https?:\/\//.test(compareExampleSource)
);

const compareHeroIllustrationSource = readFileSync(
  "app/competitor-scripts/compare/hero-illustration.tsx",
  "utf8"
);

check(
  "the compare decorative hero illustration is hidden from assistive tech (aria-hidden on its root)",
  /export function HeroIllustration[\s\S]*?aria-hidden="true"/.test(
    compareHeroIllustrationSource
  )
);

check(
  "the compare hero illustration contains no visible text content (only shapes/icons)",
  !/>[A-Za-z]{2,}</.test(compareHeroIllustrationSource)
);

check(
  "the compare illustration is not a copy of the Analyze illustration (distinct motif, no Search/magnifying-glass icon)",
  !compareHeroIllustrationSource.includes("Search") &&
    compareHeroIllustrationSource.includes("ArrowLeftRight")
);

async function main() {
  if (failures > 0) {
    process.exitCode = 1;
  } else {
    console.log(
      "\nResult: all Competitor Scripts structural tests passed."
    );
  }
}

void main();
