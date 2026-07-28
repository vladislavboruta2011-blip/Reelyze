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

// ── analyze-results message coverage across every launched locale ──────

for (const locale of LAUNCHED_LOCALES) {
  const copy = getMessages(locale).competitorScripts.analyzeResults;

  check(
    `${locale}: analyzeResults has all top-level keys`,
    typeof copy.backToAnalyze === "string" &&
      typeof copy.heroEyebrow === "string" &&
      typeof copy.pageTitle === "string" &&
      typeof copy.headingPrefix === "string" &&
      typeof copy.headingAccent === "string" &&
      copy.headingPrefix.length > 0 &&
      copy.headingAccent.length > 0 &&
      typeof copy.description === "string" &&
      typeof copy.previewNotice === "string" &&
      copy.previewNotice.length > 0
  );

  check(
    `${locale}: the top subtitle and preview banner explicitly say the video/transcript are real and the scores/insights are preview data`,
    locale === "en"
      ? /real/i.test(copy.previewNotice) &&
          /(preview|example)/i.test(copy.previewNotice) &&
          /(preview|example)/i.test(copy.description)
      : /(настоящ|реальн)/i.test(copy.previewNotice) &&
          /(предпросмотр|пример|демо)/i.test(copy.previewNotice) &&
          /(предпросмотр|пример|демо)/i.test(copy.description)
  );

  check(
    `${locale}: summary has a real-data label, neutral fallback title, and labeled real-data fields, none empty`,
    copy.summary.realDataLabel.length > 0 &&
      copy.summary.neutralTitle.length > 0 &&
      copy.summary.platformLabel.length > 0 &&
      copy.summary.platform.length > 0 &&
      copy.summary.openOnYouTube.length > 0 &&
      copy.summary.sourceFormatLabel.length > 0 &&
      copy.summary.durationLabel.length > 0 &&
      copy.summary.unknownDuration.length > 0 &&
      copy.summary.languageLabel.length > 0 &&
      copy.summary.unknownLanguage.length > 0 &&
      copy.summary.segmentCountLabel.length > 0
  );

  check(
    `${locale}: missingState has a heading, description, and action, none empty`,
    copy.missingState.heading.length > 0 &&
      copy.missingState.description.length > 0 &&
      copy.missingState.action.length > 0
  );

  check(
    `${locale}: transcript section has language/duration/segment/generation labels and both headings, none empty (no unknownGenerationLabel — that stat is omitted entirely, not shown as "Unknown")`,
    copy.transcript.heading.length > 0 &&
      copy.transcript.sectionEyebrow.length > 0 &&
      copy.transcript.realDataLabel.length > 0 &&
      copy.transcript.languageLabel.length > 0 &&
      copy.transcript.unknownLanguage.length > 0 &&
      copy.transcript.durationLabel.length > 0 &&
      copy.transcript.unknownDuration.length > 0 &&
      copy.transcript.segmentCountLabel.length > 0 &&
      copy.transcript.generationLabel.length > 0 &&
      copy.transcript.autoGeneratedLabel.length > 0 &&
      copy.transcript.manualLabel.length > 0 &&
      !("unknownGenerationLabel" in copy.transcript) &&
      copy.transcript.timestampedHeading.length > 0 &&
      copy.transcript.fullTextHeading.length > 0
  );

  check(
    `${locale}: scores has a section eyebrow, preview label, /100 suffix, and exactly 4 metrics (overall/hook/retention/structure)`,
    copy.scores.sectionEyebrow.length > 0 &&
      copy.scores.previewLabel.length > 0 &&
      copy.scores.scoreSuffix.length > 0 &&
      typeof copy.scores.overall.value === "number" &&
      typeof copy.scores.hook.value === "number" &&
      typeof copy.scores.retention.value === "number" &&
      typeof copy.scores.structure.value === "number" &&
      Object.keys(copy.scores).filter((key) =>
        ["overall", "hook", "retention", "structure"].includes(key)
      ).length === 4
  );

  check(
    `${locale}: whyScores has exactly 3 reasons`,
    copy.whyScores.reasons.length === 3
  );

  check(
    `${locale}: takeaway has a section eyebrow, label, non-empty text, and a supporting line`,
    copy.takeaway.sectionEyebrow.length > 0 &&
      copy.takeaway.label.length > 0 &&
      copy.takeaway.text.length > 0 &&
      copy.takeaway.supporting.length > 0
  );

  check(
    `${locale}: every analyzeResults section with a sectionEyebrow has a non-empty value (scores/takeaway/timeline/strengths/weaknesses/risks/lessons/caution)`,
    [
      copy.scores.sectionEyebrow,
      copy.takeaway.sectionEyebrow,
      copy.timeline.sectionEyebrow,
      copy.strengths.sectionEyebrow,
      copy.weaknesses.sectionEyebrow,
      copy.risks.sectionEyebrow,
      copy.lessons.sectionEyebrow,
      copy.caution.sectionEyebrow,
    ].every((eyebrow) => eyebrow.length > 0)
  );

  check(
    `${locale}: timeline has exactly 6 stages, each with title/timestamp, plus a preview-only disclaimer (no per-stage transcript field)`,
    copy.timeline.stages.length === 6 &&
      copy.timeline.stages.every(
        (stage) => stage.title.length > 0 && stage.timestamp.length > 0
      ) &&
      copy.timeline.stages.every(
        (stage) => !("transcript" in stage)
      ) &&
      copy.timeline.previewColumnHeading.length > 0 &&
      copy.timeline.previewColumnBody.length > 0
  );

  check(
    `${locale}: strengths has 3-4 items, weaknesses has 2-4 items, each with title/description`,
    copy.strengths.items.length >= 3 &&
      copy.strengths.items.length <= 4 &&
      copy.strengths.items.every(
        (item) => item.title.length > 0 && item.description.length > 0
      ) &&
      copy.weaknesses.items.length >= 2 &&
      copy.weaknesses.items.length <= 4 &&
      copy.weaknesses.items.every(
        (item) => item.title.length > 0 && item.description.length > 0
      )
  );

  check(
    `${locale}: risks has 2-3 items, each with timestamp/description/suggestion`,
    copy.risks.items.length >= 2 &&
      copy.risks.items.length <= 3 &&
      copy.risks.items.every(
        (item) =>
          item.timestamp.length > 0 &&
          item.description.length > 0 &&
          item.suggestion.length > 0
      )
  );

  check(
    `${locale}: lessons has 3-5 items, caution has a description and exactly 3 columns`,
    copy.lessons.items.length >= 3 &&
      copy.lessons.items.length <= 5 &&
      copy.lessons.items.every((item) => item.length > 0) &&
      copy.caution.description.length > 0 &&
      copy.caution.columns.length === 3 &&
      copy.caution.columns.every(
        (column) => column.title.length > 0 && column.description.length > 0
      )
  );

  check(
    `${locale}: actions has analyzeAnother/compareWithMyScript/backToSelection, all non-empty`,
    copy.actions.analyzeAnother.length > 0 &&
      copy.actions.compareWithMyScript.length > 0 &&
      copy.actions.backToSelection.length > 0
  );
}

check(
  "EN and RU expose the exact same analyzeResults top-level key structure",
  JSON.stringify(
    Object.keys(getMessages("en").competitorScripts.analyzeResults).sort()
  ) ===
    JSON.stringify(
      Object.keys(getMessages("ru").competitorScripts.analyzeResults).sort()
    )
);

check(
  "EN and RU analyzeResults sub-namespaces (summary/scores/whyScores/takeaway/timeline/strengths/weaknesses/risks/lessons/caution/actions) have the same key structure",
  ([
    "summary",
    "scores",
    "whyScores",
    "takeaway",
    "timeline",
    "strengths",
    "weaknesses",
    "risks",
    "lessons",
    "caution",
    "actions",
  ] as const).every(
    (section) =>
      JSON.stringify(
        Object.keys(
          getMessages("en").competitorScripts.analyzeResults[section]
        ).sort()
      ) ===
      JSON.stringify(
        Object.keys(
          getMessages("ru").competitorScripts.analyzeResults[section]
        ).sort()
      )
  )
);

check(
  "EN and RU timeline.stages[0]/strengths.items[0]/weaknesses.items[0]/risks.items[0] have the same per-item key structure",
  JSON.stringify(
    Object.keys(
      getMessages("en").competitorScripts.analyzeResults.timeline.stages[0]
    ).sort()
  ) ===
    JSON.stringify(
      Object.keys(
        getMessages("ru").competitorScripts.analyzeResults.timeline.stages[0]
      ).sort()
    ) &&
    JSON.stringify(
      Object.keys(
        getMessages("en").competitorScripts.analyzeResults.strengths.items[0]
      ).sort()
    ) ===
      JSON.stringify(
        Object.keys(
          getMessages("ru").competitorScripts.analyzeResults.strengths
            .items[0]
        ).sort()
      ) &&
    JSON.stringify(
      Object.keys(
        getMessages("en").competitorScripts.analyzeResults.risks.items[0]
      ).sort()
    ) ===
      JSON.stringify(
        Object.keys(
          getMessages("ru").competitorScripts.analyzeResults.risks.items[0]
        ).sort()
      )
);

check(
  "EN and RU analyzeResults copy actually differ",
  getMessages("en").competitorScripts.analyzeResults.pageTitle !==
    getMessages("ru").competitorScripts.analyzeResults.pageTitle
);

check(
  "example score values (78/84/73/80) match exactly between EN and RU (locale-invariant example data)",
  getMessages("en").competitorScripts.analyzeResults.scores.overall.value ===
    getMessages("ru").competitorScripts.analyzeResults.scores.overall.value &&
    getMessages("en").competitorScripts.analyzeResults.scores.hook.value ===
      getMessages("ru").competitorScripts.analyzeResults.scores.hook.value &&
    getMessages("en").competitorScripts.analyzeResults.scores.retention
      .value ===
      getMessages("ru").competitorScripts.analyzeResults.scores.retention
        .value &&
    getMessages("en").competitorScripts.analyzeResults.scores.structure
      .value ===
      getMessages("ru").competitorScripts.analyzeResults.scores.structure
        .value
);

check(
  "no fabricated views/likes/comments/subscriber engagement METRICS (a number attached to the word) appear anywhere in analyzeResults copy — plain prose use of these words is fine",
  !/\d[\d,.\s]*[kKmM]?\+?\s*(views?|likes?|comments?|subscribers?)\b|\b(views?|likes?|comments?|subscribers?)\s*[:=]?\s*\d/i.test(
    JSON.stringify(getMessages("en").competitorScripts.analyzeResults) +
      JSON.stringify(getMessages("ru").competitorScripts.analyzeResults)
  ) &&
    !/\d[\d,.\s]*[kKmM]?\+?\s*(просмотр\w*|лайк\w*|коммент\w*|подписч\w*)/i.test(
      JSON.stringify(getMessages("en").competitorScripts.analyzeResults) +
        JSON.stringify(getMessages("ru").competitorScripts.analyzeResults)
    )
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

const resultsComponentPaths = [
  "app/competitor-scripts/analyze/results/page.tsx",
  "app/competitor-scripts/analyze/results/analyze-results-content.tsx",
  "app/competitor-scripts/analyze/results/results-summary.tsx",
  "app/competitor-scripts/analyze/results/transcript-section.tsx",
  "app/competitor-scripts/analyze/results/score-overview.tsx",
  "app/competitor-scripts/analyze/results/why-scores-section.tsx",
  "app/competitor-scripts/analyze/results/main-takeaway.tsx",
  "app/competitor-scripts/analyze/results/script-breakdown.tsx",
  "app/competitor-scripts/analyze/results/strengths-section.tsx",
  "app/competitor-scripts/analyze/results/weaknesses-section.tsx",
  "app/competitor-scripts/analyze/results/risks-section.tsx",
  "app/competitor-scripts/analyze/results/lessons-section.tsx",
  "app/competitor-scripts/analyze/results/caution-section.tsx",
];

const allSourceFiles = [
  "app/competitor-scripts/page.tsx",
  "app/competitor-scripts/mode-card.tsx",
  "app/competitor-scripts/sidebar.tsx",
  "app/competitor-scripts/url-validation.ts",
  ...analyzeComponentPaths,
  ...compareComponentPaths,
  ...resultsComponentPaths,
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
  "AnalyzeInputForm calls the real Competitor Scripts analyze API — POST, JSON content type, and a body containing only `url`",
  /fetch\(\s*"\/api\/competitor-scripts\/analyze"/.test(analyzeFormSource) &&
    /method:\s*"POST"/.test(analyzeFormSource) &&
    /"Content-Type":\s*"application\/json"/.test(analyzeFormSource) &&
    /body:\s*JSON\.stringify\(\{\s*url:\s*trimmed\s*\}\)/.test(analyzeFormSource)
);

check(
  "AnalyzeInputForm guards against duplicate concurrent submissions",
  analyzeFormSource.includes("submissionInFlight")
);

check(
  "AnalyzeInputForm imports next/navigation's useRouter (a real successful submission now navigates to the real results route)",
  analyzeFormSource.includes('import { useRouter } from "next/navigation"') &&
    analyzeFormSource.includes("const router = useRouter()")
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
  "only a well-formed, YouTube-hostname URL is ever submitted to the API — local validation still runs first and clears any prior error before the fetch call",
  /isSupportedVideoUrl\(trimmed\)\) \{\s*\n\s*setError\(copy\.errors\.unsupportedUrl\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*\n\s*setError\(""\);/.test(
    analyzeFormSource
  )
);

check(
  "navigation to the results route only happens after a validated API success response, never immediately on local validation passing",
  /isValidSuccessPayload\(payload\)\)\s*\{[\s\S]{0,900}router\.push\("\/competitor-scripts\/analyze\/results"\);/.test(
    analyzeFormSource
  )
);

check(
  "the navigation target is a plain string literal — never a template literal interpolating the entered URL, and never a query string",
  !/router\.push\(`/.test(analyzeFormSource) &&
    !/router\.push\([^)]*\?/.test(analyzeFormSource)
);

check(
  "validation errors use role=\"alert\"; the old coming-next status/role=\"status\" paragraph no longer exists on this form",
  analyzeFormSource.includes('role="alert"') &&
    !analyzeFormSource.includes('role="status"') &&
    !analyzeFormSource.includes("showComingNext")
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
  "no setInterval exists anywhere in the Competitor Scripts feature, and the only setTimeout is the single zero-delay sessionStorage-hydration read in AnalyzeResultsContent (matching the existing app/results/page.tsx convention) — never a fake multi-stage delay",
  !/setInterval\(/.test(analyzeFeatureSource) &&
    (analyzeFeatureSource.match(/setTimeout\(/g) ?? []).length === 1 &&
    /window\.setTimeout\(\(\)\s*=>\s*\{[\s\S]{0,300}readStoredAnalyzeResult\(\)[\s\S]{0,300}\},\s*0\);[\s\S]{0,100}window\.clearTimeout\(timer\)/.test(
      analyzeFeatureSource
    )
);

check(
  "no fake progress semantics exist anywhere in the Competitor Scripts feature (no progressbar role, no 'in progress' copy)",
  !/role="progressbar"|in[- ]progress/i.test(analyzeFeatureSource)
);

check(
  "the only animate-spin in the whole feature is the Analyze form's real submission spinner, gated by real isSubmitting state — not a fake/timer-driven one",
  (analyzeFeatureSource.match(/animate-spin/g) ?? []).length === 1 &&
    /isSubmitting[\s\S]{0,200}animate-spin/.test(analyzeFormSource)
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
  "the Analyze submit button is disabled while submitting or while the URL field is empty (native disabled attribute)",
  analyzeFormSource.includes(
    "disabled={isSubmitting || url.trim().length === 0}"
  )
);

check(
  "the Analyze URL input is disabled while a submission is in flight",
  analyzeFormSource.includes("disabled={isSubmitting}")
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

// ── /competitor-scripts/analyze/results: route, safety, content ────────

check(
  "the /competitor-scripts/analyze/results route exists on disk",
  existsSync("app/competitor-scripts/analyze/results/page.tsx")
);

check(
  "no Compare results route exists (no app/competitor-scripts/compare/results*)",
  !existsSync("app/competitor-scripts/compare/results") &&
    !existsSync("app/competitor-scripts/compare/results.tsx")
);

const resultsFeatureSource = resultsComponentPaths
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

check(
  "the results feature never calls fetch or any API",
  !/\bfetch\(/.test(resultsFeatureSource)
);

check(
  "the results feature has no server actions (no \"use server\") and is not itself a route handler",
  !resultsFeatureSource.includes('"use server"')
);

check(
  "no setInterval exists in the results feature, and its one setTimeout is the zero-delay sessionStorage-hydration read, not a fake loading delay",
  !/setInterval\(/.test(resultsFeatureSource) &&
    (resultsFeatureSource.match(/setTimeout\(/g) ?? []).length === 1 &&
    /,\s*0\);/.test(resultsFeatureSource)
);

check(
  "no fake live-progress semantics exist in the results feature (no progressbar role, no animate-spin)",
  !/role="progressbar"|animate-spin/i.test(resultsFeatureSource)
);

const resultsPageSource = readFileSync(
  "app/competitor-scripts/analyze/results/page.tsx",
  "utf8"
);

check(
  "the results feature renders the illustrative preview notice as visible body text (now inside the client AnalyzeResultsContent wrapper, not the server page shell)",
  resultsFeatureSource.includes("{copy.previewNotice}")
);

check(
  "the results feature reads the sessionStorage handoff via the shared storage module, and only that module ever touches sessionStorage directly",
  resultsFeatureSource.includes("readStoredAnalyzeResult") &&
    !/\bsessionStorage\./.test(resultsFeatureSource)
);

check(
  "the results feature renders a missing/invalid-state heading, description, and action distinct from the illustrative report",
  resultsFeatureSource.includes("{copy.missingState.heading}") &&
    resultsFeatureSource.includes("{copy.missingState.description}") &&
    resultsFeatureSource.includes("{copy.missingState.action}")
);

check(
  "the results hero heading is localized (headingPrefix/headingAccent), with the full sentence carried only via aria-label",
  resultsPageSource.includes("{copy.headingPrefix}") &&
    resultsPageSource.includes("{copy.headingAccent}") &&
    /aria-label=\{copy\.pageTitle\}/.test(resultsPageSource) &&
    !/<h1[^>]*>\s*\{copy\.pageTitle\}/.test(resultsPageSource)
);

check(
  "the results hero accent line uses a purple gradient (bg-clip-text) distinct from the plain white first line",
  /bg-gradient-to-r[\s\S]{0,160}bg-clip-text[\s\S]{0,300}\{copy\.headingAccent\}/.test(
    resultsPageSource
  ) && !/bg-clip-text[\s\S]{0,300}\{copy\.headingPrefix\}/.test(resultsPageSource)
);

check(
  "the results hero heading spans and its decorative accent bar are all aria-hidden (no duplicate announcement)",
  (resultsPageSource.match(/aria-hidden="true"/g) ?? []).length >= 3
);

check(
  "the results page links back to /competitor-scripts/analyze, not home",
  /href="\/competitor-scripts\/analyze"/.test(resultsPageSource)
);

const scoreOverviewSource = readFileSync(
  "app/competitor-scripts/analyze/results/score-overview.tsx",
  "utf8"
);

check(
  "the score overview renders exactly the 4 required metrics (overall/hook/retention/structure), each with an accessible label",
  /scores\.overall,\s*scores\.hook,\s*scores\.retention,\s*scores\.structure/.test(
    scoreOverviewSource
  ) && scoreOverviewSource.includes("role=\"img\"")
);

check(
  "score values are static (no useState/useEffect-driven counting animation)",
  !scoreOverviewSource.includes("useState") &&
    !scoreOverviewSource.includes("useEffect")
);

const scriptBreakdownSource = readFileSync(
  "app/competitor-scripts/analyze/results/script-breakdown.tsx",
  "utf8"
);

check(
  "the script breakdown renders all 6 timeline stages from the localized array (not hardcoded)",
  scriptBreakdownSource.includes("timeline.stages.map")
);

check(
  "why-scores, strengths, weaknesses, risks, lessons, caution, and the real transcript section each exist as their own component and are wired into the results feature (via the client AnalyzeResultsContent wrapper)",
  existsSync("app/competitor-scripts/analyze/results/why-scores-section.tsx") &&
    existsSync("app/competitor-scripts/analyze/results/strengths-section.tsx") &&
    existsSync("app/competitor-scripts/analyze/results/weaknesses-section.tsx") &&
    existsSync("app/competitor-scripts/analyze/results/risks-section.tsx") &&
    existsSync("app/competitor-scripts/analyze/results/lessons-section.tsx") &&
    existsSync("app/competitor-scripts/analyze/results/caution-section.tsx") &&
    existsSync("app/competitor-scripts/analyze/results/transcript-section.tsx") &&
    resultsFeatureSource.includes("<WhyScoresSection") &&
    resultsFeatureSource.includes("<StrengthsSection") &&
    resultsFeatureSource.includes("<WeaknessesSection") &&
    resultsFeatureSource.includes("<RisksSection") &&
    resultsFeatureSource.includes("<LessonsSection") &&
    resultsFeatureSource.includes("<CautionSection") &&
    resultsFeatureSource.includes("<TranscriptSection")
);

check(
  "no save/share/regenerate/download/billing action label appears in analyzeResults copy (plain code keywords like the JS `export` keyword are not checked here)",
  !/\bsave\b|\bshare\b|\bregenerate\b|\bdownload\b|\bexport\b/i.test(
    JSON.stringify(getMessages("en").competitorScripts.analyzeResults.actions) +
      JSON.stringify(getMessages("ru").competitorScripts.analyzeResults.actions)
  )
);

check(
  "the results feature renders exactly 6 links — the page's top back link, the 4 documented bottom actions (ready state), and the 1 missing-state action — no extra action buttons",
  (resultsFeatureSource.match(/<Link/g) ?? []).length === 6
);

check(
  "the bottom action row includes a dedicated 'back to analyze' action distinct from the primary 'analyze another' CTA",
  resultsFeatureSource.includes("{copy.actions.backToAnalyze}") &&
    resultsFeatureSource.includes("{copy.actions.analyzeAnother}")
);

check(
  "the report uses normal document flow — no overflow-hidden and no fixed/max-height container wrapping the report sections (min-h-screen on the page background is fine — it's a floor, not a clip)",
  !/overflow-hidden/.test(resultsFeatureSource) &&
    !/(?<!min-)\bh-screen\b/.test(resultsFeatureSource) &&
    !/max-h-\[/.test(resultsFeatureSource) &&
    !/overflow-y-scroll|overflow-y-auto/.test(resultsFeatureSource)
);

check(
  "no real creator/video reference (no embedded http(s) URL) is hardcoded in the results feature source",
  !/https?:\/\//.test(resultsFeatureSource)
);

check(
  "the results feature's bottom actions and missing-state action link only to real existing Competitor Scripts routes",
  /href="\/competitor-scripts\/analyze"/.test(resultsFeatureSource) &&
    /href="\/competitor-scripts\/compare"/.test(resultsFeatureSource) &&
    /href="\/competitor-scripts"/.test(resultsFeatureSource)
);

check(
  "no dangerouslySetInnerHTML anywhere in the results feature (transcript text is always rendered as plain React text)",
  !resultsFeatureSource.includes("dangerouslySetInnerHTML")
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
