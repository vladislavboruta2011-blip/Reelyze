import {
  LAUNCHED_LOCALES,
  type Locale,
} from "./i18n";

function pluralizeRu(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  const absoluteCount = Math.abs(count);
  const lastTwoDigits = absoluteCount % 100;
  const lastDigit = absoluteCount % 10;

  if (
    lastDigit === 1 &&
    lastTwoDigits !== 11
  ) {
    return one;
  }

  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return few;
  }

  return many;
}

function formatRussianCharacterCount(count: number): string {
  return pluralizeRu(count, "символ", "символа", "символов");
}

const enMessages = {
  common: {
    language: "Language",
    results: "Results",
    signIn: "Sign in",
    signOut: "Sign out",
    myAnalyses: "My analyses",
    home: "Home",
    // aria-label for the compact mobile-header menu trigger (see
    // app/page.tsx's mobile Navbar) — the button itself is icon-only.
    menu: "Menu",
  },
  landing: {
    nav: {
      features: "Features",
      howItWorks: "How it works",
      analyze: "Analyze",
      startFree: "Start free",
      results: "Results",
    },
    hero: {
      desktopBadge: "Made for creators",
      desktopHeadlinePrefix: "Analyze your scripts before",
      desktopHeadlineHighlight: "you upload.",
      desktopDescription:
        "Climpy helps creators improve hooks, pacing, and retention before the video goes live.",
      mobileBadge: "YouTube Shorts script analyzer",
      mobileHeadlinePrefix: "Fix weak scripts before",
      mobileHeadlineHighlight: "viewers scroll.",
      mobileDescription:
        "Climpy reviews your hook, pacing, risky moments, and payoff before you upload your Short.",
      primaryAction: "Start Analyzing",
      secondaryAction: "See How It Works",
      trustFindWeakLines: "Find weak lines",
      trustImprovePacing: "Improve pacing",
      trustFixBeforeUpload: "Fix before upload",
      shortsFirst: "Shorts-first",
      characterLimit: "1,000 characters",
      noUploadNeeded: "No upload needed",
    },
    desktopPreview: {
      title: "Script Review",
      aiReview: "AI review",
      analyzedIn: "Analyzed in 8 seconds",
      reanalyze: "Re-analyze",
      scores: {
        overall: "Overall",
        hook: "Hook",
        risk: "Risk",
        medium: "Med",
      },
      scriptLabel: "Your Script",
      scriptLines: {
        opening:
          "If your first 3 seconds feel slow, most viewers are already gone.",
        retention:
          "Climpy finds the exact moment where retention starts dropping.",
        payoff:
          "This line needs a stronger visual payoff.",
        fixes:
          "Then it gives you clearer fixes before you upload.",
      },
      mainTakeawayLabel: "Main Takeaway",
      mainTakeaway:
        "Strong hook, but the middle section needs a clearer payoff.",
      retentionCurve: "Retention Curve",
      suggestedFixLabel: "Suggested Fix",
      suggestedFix:
        "Add a sharper contrast in the first line. Make the viewer feel what they lose if they scroll.",
    },
    value: {
      badge: "Before you publish",
      headingPrefix: "Built to find what viewers",
      headingHighlight: "skip.",
      description:
        "Climpy turns your script into clear feedback: what works, what feels slow, and what to improve before you post.",
      hook: {
        title: "Hook Analysis",
        description:
          "Find out if your first line creates curiosity or feels too generic.",
        previewLabel: "Hook Score",
        previewDescription:
          "Strong contrast, clear tension, and a reason to keep watching.",
      },
      retention: {
        title: "Retention Feedback",
        description:
          "See where the script slows down, repeats itself, or loses payoff.",
        previewLabel: "Risk Timeline",
        strong: "Strong",
        medium: "Medium",
        risky: "Risky",
      },
      fixes: {
        title: "Retention Fixes",
        description:
          "Get specific changes you can make before recording or editing.",
        previewLabel: "Fix suggestion",
        previewDescription:
          "Replace the generic setup with a specific visual outcome in the first sentence.",
        action: "Improve Hook",
      },
    },
    comparison: {
      badge: "Why Climpy",
      headingPrefix: "No prompt setup. Just a",
      headingHighlight: "Shorts script review",
      description:
        "Climpy is built for one job: checking if your Shorts script is actually ready to publish.",
      withoutLabel: "Without Climpy",
      withoutHeading: "You’re guessing what to fix.",
      withoutDescription:
        "General AI tools can help, but for Shorts feedback you often still have to build the review yourself.",
      withoutItems: [
        "Define what makes a strong Shorts hook",
        "Find where viewers may lose interest",
        "Judge pacing and payoff on your own",
        "Turn broad feedback into actual script fixes",
      ],
      withHeading: "Get a structured review in seconds.",
      aiReview: "AI review",
      scores: {
        hookScore: "Hook Score",
        risk: "Risk",
        medium: "Med",
        riskyPart: "Risky Part",
      },
      mainIssueLabel: "Main Issue",
      mainIssue:
        "The setup takes too long before the main promise appears.",
      suggestedFixLabel: "Suggested Fix",
      suggestedFix:
        "Move the main conflict into the first sentence and tighten the setup.",
    },
    faq: {
      badge: "FAQs",
      headingPrefix: "Frequently asked",
      headingHighlight: "questions",
      description:
        "Everything you need to know before testing Climpy with your first Shorts script.",
      questions: [
        {
          question: "Is Climpy free to test?",
          answer:
            "Yes. Climpy is free to test right now. No signup is needed — just paste your Shorts script and get feedback in about 1 minute.",
        },
        {
          question: "What does Climpy actually check?",
          answer:
            "Climpy reviews your script for hook strength, retention risk, risky parts, pacing problems, unclear payoff, and suggested fixes before publishing.",
        },
        {
          question: "Do I need to upload a video?",
          answer:
            "No. Climpy works with script text. You can paste a script from Google Docs, Notion, Notes, your phone, or any other writing tool.",
        },
        {
          question: "Does Climpy work for all videos?",
          answer:
            "Right now, Climpy works best for YouTube Shorts scripts, especially short videos around 15–60 seconds. We also plan to support long-form YouTube videos in the future.",
        },
        {
          question: "What if I don’t agree with the feedback?",
          answer:
            "You don’t have to follow every suggestion. Climpy is a script reviewer that helps you spot possible weak parts before posting. After every analysis, you can also rate the result and tell us what you wanted Climpy to fix better.",
        },
        {
          question: "Is my script stored or used anywhere else?",
          answer:
            "Your script is only used to generate the analysis. Climpy does not require an account, and your script is not shown publicly.",
        },
      ],
      ctaHeading: "Ready to test your script?",
      ctaDescription:
        "Paste one real Shorts script and get a review in about 1 minute.",
      ctaAction: "Analyze your script",
    },
    analyzer: {
      eyebrow: "Try it now",
      heading: "Paste your script. Get instant feedback.",
      supportingText:
        "Works best for YouTube Shorts (15–60 seconds).",
      instructionsLabel: "How to use Climpy",
      steps: {
        paste: {
          title: "Paste your script",
          desktopDescription:
            "Paste only the words that will be spoken in your Short.",
          mobileDescription:
            "Paste the words spoken in your Short.",
        },
        analyze: {
          title: "Run the analysis",
          desktopDescription:
            "Click Analyze Script and wait for your results.",
          mobileDescription: "Tap Analyze Script.",
        },
        review: {
          title: "Review the fixes",
          desktopDescription:
            "See weak moments, retention risks, and specific fixes.",
          mobileDescription:
            "Review the weak moments and suggested fixes.",
        },
      },
      videoTitle: "Video title",
      optionalDesktop: "(optional)",
      optionalMobile: "Optional",
      titleHelp: "Helps Climpy understand context.",
      titlePlaceholder: "Add your video title or topic",
      titleTooLong:
        "Title is too long. Please shorten it to 200 characters or less.",
      scriptLabel: "Your Script",
      scriptHelpDesktop:
        "Climpy is tuned for Shorts, so scripts are limited to 1,000 characters. Paste only the words spoken in the video — not the description or a list of ideas.",
      scriptHelpMobile:
        "Climpy is tuned for Shorts, so scripts are limited to 1,000 characters. Paste only the words spoken in the video.",
      scriptPlaceholderDesktop: "Paste your script here...",
      scriptPlaceholderMobile: "Paste your script here.",
      copyHint:
        "You can copy it from Google Docs, Notion, or any other tool.",
      tryExampleAction: "Try an example",
      exampleScript:
        "Imagine building an app that keeps getting worse with every update. The team adds more features, but users only become more confused. So they remove the clutter and focus on the one problem people actually need solved. Suddenly, the app becomes faster, simpler, and far easier to use.",
      scriptOverLimit: (count: number) =>
        `Your script is ${count} ${
          count === 1 ? "character" : "characters"
        } over the current limit. Shorten it to enable Analyze Script.`,
      analyzing: "Analyzing...",
      analyzeScript: "Analyze Script",
      privacy:
        "Your script is only used to generate this analysis.",
      noAccountNeeded:
        "No account needed to analyze. Sign in only if you want to save your results.",
      whatYouWillGet: "What you’ll get",
      whatYouWillGetItems: {
        overallScore: {
          title: "Overall Score",
          desc: "See how strong your script is before posting.",
        },
        hookAnalysis: {
          title: "Hook Analysis",
          desc: "Find out if your opening stops the scroll.",
        },
        retentionRisk: {
          title: "Retention Risk",
          desc: "Spot moments where viewers may lose interest.",
        },
        riskyTimestamps: {
          title: "Risky Timestamps",
          desc: "Get specific lines and moments to improve.",
        },
        suggestedFixes: {
          title: "Suggested Fixes",
          desc: "Receive clear fixes for hooks, pacing, and payoff.",
        },
      },
      shortsOnly: "Shorts only",
    },
    errors: {
      emptyScript: "Please paste your script before analyzing.",
      scriptTooLong:
        "Script is too long. Please shorten it to 1,000 characters or less.",
      titleTooLong:
        "Title is too long. Please shorten it to 200 characters or less.",
      invalidResponse:
        "The analysis returned an invalid response. Please try again.",
      unexpectedResponse:
        "The analysis returned an unexpected response. Please try again.",
      analysisFailed: "Analysis failed. Please try again.",
      generic: "Something went wrong. Please try again.",
    },
    mobile: {
      previewTitle: "Script Review",
      previewLabel: "Preview result",
      aiFeedback: "AI feedback",
      previewScores: {
        overall: "Overall",
        hook: "Hook",
        risk: "Risk",
        medium: "Med",
      },
      previewHookIssue: "0:00 Hook issue",
      previewHookIssueDescription:
        "Opening needs a clearer reason to keep watching.",
      previewSuggestedFix: "Suggested fix",
      previewSuggestedFixDescription:
        "Add a sharper contrast or specific outcome in the first line.",
      estimatedDuration: (duration: string) =>
        `~${duration} estimated`,
      newAnalysis: "New analysis",
      newAnalysisHeading: "Paste your script.",
      newAnalysisDescription:
        "Get a hook score, retention risk, risky timestamps, and specific fixes.",
      checksHeading: "What Climpy checks",
      checks: {
        hookStrength: {
          title: "Hook strength",
          desc: "Scores your opening line.",
        },
        retentionRisk: {
          title: "Retention risk",
          desc: "Finds where viewers may drop.",
        },
        payoffQuality: {
          title: "Payoff quality",
          desc: "Checks if the ending feels worth it.",
        },
        suggestedFixes: {
          title: "Suggested fixes",
          desc: "Gives specific improvements.",
        },
      },
      improveBeforeRecording:
        "Improve the script before recording.",
      nextIdea:
        "Paste your next Short idea and see where viewers may lose interest.",
      tryClimpy: "Try Climpy",
    },
    footer: {
      tagline: "AI Shorts script checker",
      description:
        "Check your Shorts script before publishing. Spot weak hooks, retention risks, unclear payoff, and easy fixes in about 1 minute.",
      productHeading: "Product",
      analyzeScript: "Analyze script",
      faqs: "FAQs",
      tryClimpy: "Try Climpy",
      builtForHeading: "Built for",
      builtForItems: [
        "YouTube Shorts creators",
        "Script testing",
        "Faster pre-publish review",
      ],
      copyright: "© 2026 Climpy. Built for short-form creators.",
      processTagline: "Paste. Review. Improve. Publish.",
    },
  },
  results: {
    nav: {
      newAnalysis: "New Analysis",
      newAnalysisMobileNav: "New analysis",
    },
    header: {
      title: "Script Review",
      analyzedPrefix: "Analyzed just now —",
      fallbackTitle: "YouTube Shorts Script",
    },
    localeMismatch: {
      message:
        "This analysis was generated in Russian. Run a new analysis to receive AI explanations in English.",
    },
    loading: {
      title: "Loading results...",
      descriptionDesktop:
        "Please wait while Climpy checks your latest analysis.",
      descriptionMobile: "Please wait a moment.",
    },
    error: {
      invalidAnalysis:
        "Your saved analysis is invalid. Please go back and analyze the script again.",
      couldNotLoad:
        "Could not load your script. Please go back and try again.",
    },
    empty: {
      headingDesktop: "No script analyzed yet.",
      descriptionDesktop:
        "Go to New Analysis and paste your YouTube Shorts script first. After you click Analyze Script, your results will appear here.",
      headingMobile: "No script analyzed yet.",
      descriptionMobile: "Go to New Analysis and paste your script first.",
    },
    scoreCards: {
      overallScore: "Overall Score",
      hookScore: "Hook Score",
      retentionRisk: "Retention Risk",
      overall: "Overall",
      hook: "Hook",
      risk: "Risk",
    },
    scoreLabels: {
      overall: {
        veryStrong: "Very Strong",
        strong: "Strong",
        mixed: "Mixed",
        average: "Average",
        needsWork: "Needs Work",
        weak: "Weak",
      },
      hook: {
        strong: "Strong",
        good: "Good",
        average: "Average",
        weak: "Weak",
      },
      risk: {
        high: "High",
        medium: "Medium",
        lowMedium: "Low-Medium",
        low: "Low",
      },
    },
    scoreBreakdown: {
      heading: "Why these scores?",
      description:
        "Each total is built from four components scored out of 25. Lower is better for Retention Risk.",
      lowerIsBetter: "Lower is better",
      higherIsBetter: "Higher is better",
      items: {
        premiseAppeal: {
          label: "Premise Appeal",
          description:
            "How interesting and rewarding the underlying idea is.",
        },
        openingPromise: {
          label: "Opening Promise",
          description:
            "How clearly the opening promises value that the script delivers.",
        },
        progression: {
          label: "Progression",
          description:
            "How well each beat adds another reason to keep watching.",
        },
        payoff: {
          label: "Payoff",
          description:
            "How strongly the ending completes the promised value.",
        },
        immediacy: {
          label: "Immediacy",
          description:
            "How quickly the script reaches its concrete premise.",
        },
        specificity: {
          label: "Specificity",
          description:
            "How concrete and easy to understand the opening is.",
        },
        viewerPull: {
          label: "Viewer Pull",
          description:
            "How much curiosity, relevance, contrast, or stakes the opening creates.",
        },
        deliveryAlignment: {
          label: "Delivery Alignment",
          description:
            "How accurately the hook matches what the script delivers.",
        },
        openingFriction: {
          label: "Opening Friction",
          description:
            "Delay, filler, or confusion before the premise begins.",
        },
        progressionRisk: {
          label: "Progression Risk",
          description:
            "Repetition, stalled development, or low information density.",
        },
        predictabilityRisk: {
          label: "Predictability Risk",
          description:
            "How easily viewers can predict the script's next beats.",
        },
        payoffRisk: {
          label: "Payoff Risk",
          description:
            "Risk that the ending feels weak, incomplete, or contradictory.",
        },
      },
    },
    mainTakeaway: {
      label: "Main Takeaway",
    },
    script: {
      heading: "Your Script",
      titleLabel: "Title",
      characterCount: (count: number) =>
        `${count} / 1000 Characters`,
      estimatedDuration: (duration: string) =>
        `~${duration} estimated`,
    },
    riskyParts: {
      heading: "Risky Parts",
      found: (count: number) => `${count} found`,
      noneWithFixesTitle: "No major risky parts found.",
      noneWithFixesDescription:
        "No material drop-off points were found; the suggestions below are optional refinements.",
      noneTitle: "No risky parts found.",
      noneDescription:
        "This script stays focused and does not contain any major drop-off points.",
    },
    suggestedFixes: {
      heading: "Suggested Fixes",
      count: (count: number) =>
        `${count} ${count === 1 ? "suggestion" : "suggestions"}`,
      improveScriptButton: "Improve Script",
      improveScriptDescription:
        "Rewrite your script using the suggested improvements.",
      hookActionNeedsDetails: "Needs Details",
      hookActionRefine: "Refine Hook",
      hookActionImprove: "Improve Hook",
      noFixesTitle: "No fixes needed.",
      noFixesDescriptionCompact: "The script already performs well.",
      noFixesDescription:
        "The script already performs well based on the current analysis.",
      showFewer: "Show fewer",
      viewAll: "View all suggestions",
    },
    sceneBreakdown: {
      heading: "Scene Breakdown",
    },
    feedback: {
      heading: "Rate this analysis",
      subheading: "Was this review helpful?",
      helpful: "Helpful",
      whatWasHelpful: "What was helpful?",
      whatWasWrong: "What was wrong?",
      thanksHelpful: "Thanks — feedback noted.",
      thanksUnhelpful: "Thanks — we'll use this to improve.",
      sending: "Sending feedback...",
      submitError: "Feedback could not be sent. Please try again.",
      helpfulReasonLabels: {
        accurateScore: "Accurate score",
        usefulFixes: "Useful fixes",
        clearExplanation: "Clear explanation",
        other: "Other",
      },
      unhelpfulReasonLabels: {
        wrongScore: "Wrong score",
        badSuggestions: "Bad suggestions",
        notSpecific: "Not specific enough",
        other: "Other",
      },
      otherModal: {
        likedTitle: "What did you like?",
        wrongTitle: "What did not work?",
        helperText: "Your feedback helps improve Climpy.",
        placeholderLiked:
          "Tell us what you liked about this analysis...",
        placeholderWrong: "Tell us what was wrong or missing...",
        submit: "Submit",
        submitting: "Submitting...",
        cancel: "Cancel",
      },
      mobileModal: {
        likedTitle: "What did you like?",
        wrongTitle: "What was wrong?",
        likedDescription:
          "Tell us what felt useful, accurate, or helpful in this analysis.",
        wrongDescription:
          "Tell us what felt inaccurate, confusing, or not useful in this analysis.",
        placeholderLiked: "Tell us what you liked...",
        placeholderWrong: "Write your feedback here...",
        send: "Send feedback",
        sending: "Sending...",
        cancel: "Cancel",
      },
    },
    share: {
      shared: "Shared.",
      reviewCopied: "Review copied.",
      fallbackTitle: "Climpy Script Review",
    },
    improveScriptModal: {
      originalPreservedTitle: "Original Script Preserved",
      improvedTitle: "Improved Script",
      // Diagnostic state: shown whenever Improve Script could not produce a
      // meaningfully stronger, safe result — whether the script was too
      // generic to attempt at all, or a rewrite was attempted but failed to
      // materially resolve the diagnosed weakness (a light paraphrase, a
      // close copy, or a candidate that didn't survive the safety/quality
      // checks). This is a distinct outcome from "preserve" (which means
      // the original itself needs no change) — never implies the original
      // is good, and never shows the original as if it were the result.
      diagnosticTitle: "Climpy couldn't safely improve this script yet",
      diagnosticDescription:
        "The script needs a more concrete fact, comparison, event, or payoff before Climpy can create a meaningfully stronger version without inventing information.",
      // Distinct from diagnosticDescription above: shown when the script
      // already has enough concrete material but this specific attempt
      // wasn't a strong enough improvement — never implies facts are
      // missing when they visibly are not.
      diagnosticRetryDescription:
        "Climpy has enough material to work with, but this attempt wasn't a strong enough improvement. Try running Improve Script again.",
      preservedDescription:
        "Climpy kept your original script — it already works well, and a rewrite would not add meaningful value.",
      defaultDescription:
        "Climpy rewrites the complete Short while preserving the facts in your original script.",
      improving: "Improving the full script...",
      noScriptGenerated: "No improved script was generated.",
      addMissingMaterial: (items: string[]) =>
        `Add: ${items.join(", ")}.`,
      copyOriginal: "Copy Original",
      copyScript: "Copy Script",
      copied: "Copied!",
      close: "Close",
      genericError: "Could not improve script. Please try again.",
    },
    hookModal: {
      needsMoreSpecificMaterialTitle: "Needs More Specific Material",
      refinedHookTitle: "Refined Hook",
      improvedHookTitle: "Improved Hook",
      hookAnalysisTitle: "Hook Analysis",
      refineHookTitle: "Refine Hook",
      tooBroadDescription:
        "This script is too broad to rewrite into a stronger hook without inventing ideas.",
      refineSameDescription:
        "This version keeps the same promise while making the opening sharper and clearer.",
      usePromptDescription:
        "Use this version to make the opening clearer, stronger, and more curiosity-driven.",
      alreadyWorksDescription:
        "This opening already creates a clear reason to keep watching.",
      workingRefineDescription:
        "The hook is working. This refinement focuses on making the opening or payoff land stronger.",
      whyNoHookGenerated: "Why no hook was generated:",
      whatThisVersionImproves: "What this version improves:",
      whyItIsBetter: "Why it is better:",
      whyThisHookWorks: "Why this hook works:",
      improving: "Improving hook...",
      rewritingDescription:
        "Climpy is rewriting the opening based on your script.",
      noImprovedHookGenerated: "No improved hook was generated.",
      addSpecificMaterial:
        "Add specific material to the script before generating a new hook.",
      alreadyGoodReason:
        "The hook is already clear, specific, and creates curiosity without needing a rewrite.",
      adjustedReason:
        "The hook was adjusted to improve clarity, curiosity, or payoff connection.",
      copyAdvice: "Copy Advice",
      copyHook: "Copy Hook",
      copied: "Copied!",
      close: "Close",
      genericError: "Could not improve hook. Please try again.",
      noValidatedHookSuggestion:
        "No validated hook suggestion is available for this analysis.",
    },
    save: {
      action: "Save analysis",
      saving: "Saving...",
      saved: "Saved",
      retry: "Try again",
      errorAuth: "Sign in to save this analysis.",
      errorValidation:
        "This analysis can't be saved. Please try analyzing again.",
      errorDatabase: "Could not save your analysis. Please try again.",
      untitled: "Untitled analysis",
    },
    askClimpy: {
      entryButton: "Ask Climpy",
      entryDescription:
        "Ask questions to better understand your analysis.",
      panelHeading: "Ask Climpy",
      panelSubheading: "Ask about this analysis.",
      closeLabel: "Close",
      inputLabel: "Your question",
      inputPlaceholder: "Ask about your hook, risk, or fixes...",
      send: "Send",
      sending: "Thinking...",
      starterQuestionsHeading: "Try asking",
      starterQuestions: {
        whatToFixFirst: "What should I fix first?",
        whyHookWeak: "Why is my hook weak?",
        explainRiskiestPart: "Explain the riskiest part simply.",
        rewriteRiskiestPart: "Rewrite the riskiest part without adding facts.",
      },
      actionLabel: "What to change",
      exampleLabel: "Example",
      originalLabel: "Original",
      suggestedRewriteLabel: "Suggested rewrite",
      rewriteUnavailable:
        "Climpy can't safely rewrite this without more context from your script.",
      capReached:
        "You've reached the question limit for this analysis. Start a new analysis to keep asking.",
      errorGeneric: "Climpy couldn't answer that. Please try again.",
      errorRateLimited:
        "You're asking a bit fast. Please wait a moment and try again.",
      errorRequestInvalid:
        "Something about that request wasn't right. Please try again.",
      // Shown instead of the standard error text once the one approved
      // manual Retry for a turn has ALSO failed (see page.tsx's
      // sendAskClimpyRequest/hasBeenRetried) — Retry is hidden at that
      // point (Phase 5 policy), so this message never offers another Retry
      // action; the creator may ask a new question normally instead.
      errorRetryFailed:
        "Climpy couldn't get a valid response after trying again. Please wait a moment or ask the question in another way.",
      // Shown only as a follow-up local reply when the immediately preceding
      // visible event was a technical error and the next message is a short
      // error-reference phrase ("Why?", "What happened?") — never sent to
      // the model, never counted toward the six-answer cap. Distinct from
      // errorGeneric (shown on the error itself) — this explains that the
      // prior failure was technical, not caused by how the question was
      // phrased.
      errorTechnicalExplanation:
        "That request failed because Climpy couldn't get a valid response. It wasn't caused by the way you asked. Try the request again.",
      // Label for the retry action attached to a retryable failed request
      // (shown on the error bubble itself, and again on the local
      // technical-explanation reply above).
      retryLabel: "Try again",
      // Shown as a local reply (no API call, no cap consumption) when the
      // creator types the approved rewrite-riskiest-part intent (see
      // ask-climpy-local-intents.ts's classifyAskClimpyRewriteIntent) but no
      // risky part is currently eligible for a safe rewrite — never a fake
      // rewrite request sent to the model.
      noEligibleRewriteExplanation:
        "There's no validated risky part Climpy can safely rewrite right now. Try asking a specific question about your analysis instead.",
      // Small, bounded set of local conversational replies — handled
      // entirely client-side (no fetch, no model call, no cap consumption).
      // See app/results/ask-climpy-local-intents.ts for the matching logic.
      localIntents: {
        greeting:
          "Hi! Ask me about this analysis, and I'll help you decide what to fix.",
        thanks: "You're welcome.",
        acknowledgement: "Got it.",
        farewell: "See you.",
        capability:
          "I can explain your scores and risky parts, help you decide what to fix first, simplify a recommendation, or rewrite one validated risky fragment without inventing facts.",
      },
      // Ask Climpy's own analysisLocale/AskClimpyRequest.locale are strictly
      // "en" | "ru" (see engine/analysis-v2-schema.ts), so a mismatch here
      // always pairs the same way for this interface locale — this is never
      // shown when the analysis is also English, so it can safely name
      // Russian directly rather than a generic "a different language".
      // Content itself (mainTakeaway, riskyParts, suggestedFixes, prior
      // conversation turns) is never translated — only NEW answers from
      // here on use this interface's language.
      localeMismatchNotice:
        "This analysis was created in Russian. Climpy will explain it in English.",
      emptyState:
        "Ask a question about your hook, risky parts, or suggested fixes.",
      poweredByNotice:
        "Answers are grounded in this analysis and your script only.",
    },
  },
  auth: {
    login: {
      heading: "Welcome to Climpy",
      description:
        "Sign in to save and revisit your script analyses.",
      continueWithGoogle: "Continue with Google",
      privacyNote:
        "We only use your Google sign-in to identify you — never to post or share anything.",
      errorGeneric:
        "Something went wrong signing you in. Please try again.",
      errorMissingCode: "The sign-in link was invalid or expired.",
      backToHome: "Back to home",
    },
    modal: {
      closeLabel: "Close",
    },
  },
  myAnalyses: {
    heading: "My analyses",
    subtitle: "All your saved script analyses in one place.",
    empty: {
      heading: "No saved analyses yet.",
      description:
        "Analyze a script and save it to see it listed here.",
    },
    loading: {
      heading: "Loading your analyses...",
      description: "This should only take a moment.",
    },
    error: {
      heading: "Could not load your analyses.",
      description: "Please refresh the page to try again.",
      retryLabel: "Try again",
    },
    list: {
      scoreUnavailable: "Unavailable",
    },
    table: {
      columnScript: "Script",
      columnAnalyzed: "Analyzed",
      columnOverall: "Overall",
      columnHook: "Hook",
      columnRisk: "Risk",
      columnActions: "Actions",
      open: "Open",
    },
    open: {
      loadingHeading: "Opening your analysis...",
      loadingDescription: "Please wait a moment.",
      notFoundHeading: "Analysis not found.",
      notFoundDescription:
        "This analysis may have been removed, or the link may be incorrect.",
      backLink: "Back to My Analyses",
      errorHeading: "Could not open this analysis.",
      errorDescription: "Please refresh the page to try again.",
    },
    delete: {
      triggerLabel: "Delete",
      dialogHeading: "Delete analysis",
      dialogDescription:
        "Are you sure you want to delete this analysis?",
      dialogDescriptionWithTitle: (title: string) =>
        `Are you sure you want to delete "${title}"?`,
      permanentWarning:
        "This action is permanent and cannot be undone.",
      cancel: "Cancel",
      confirm: "Delete",
      deleting: "Deleting...",
      errorHeading: "Delete failed",
      errorDescription:
        "Could not delete this analysis. Please try again.",
    },
    rename: {
      triggerLabel: "Rename",
      dialogHeading: "Rename analysis",
      inputLabel: "Analysis title",
      cancel: "Cancel",
      confirm: "Save",
      saving: "Saving...",
      errorEmpty: "Title cannot be empty.",
      errorTooLong: "Title is too long.",
      errorHeading: "Rename failed",
      errorDescription:
        "Could not rename this analysis. Please try again.",
    },
    actionsMenu: {
      triggerLabel: "More actions",
    },
    search: {
      inputLabel: "Search analyses by title",
      placeholder: "Search by title...",
      clearLabel: "Clear search",
      noResultsHeading: "No analyses match your search.",
      noResultsDescriptionPrefix: 'No saved analyses match "',
      noResultsDescriptionSuffix: '".',
    },
    filters: {
      groupLabel: "Filter by risk",
      all: "All",
      noResultsHeading: "No analyses match this filter",
      noResultsDescription: "Try selecting a different risk level.",
      noResultsCombinedHeading: "No analyses match your search and filter",
      noResultsCombinedDescription:
        "Try changing your search or selecting a different risk level.",
    },
    pagination: {
      ariaLabel: "Analyses pagination",
      previousLabel: "Previous",
      nextLabel: "Next",
      pageLabel: "Page",
      ofLabel: "of",
    },
  },
  competitorScripts: {
    modeSelection: {
      backLabel: "Back",
      pageTitle: "Competitor Scripts",
      heading: "What do you want to analyze?",
      subheading:
        "Choose how you want to use a competitor's script. Each option gives you unique insights to help you create better content.",
      note: "For the most accurate comparison, both scripts should cover the same or a closely related topic.",
      comingNext: "Coming next",
      comingNextMessage:
        "This is coming soon — thanks for checking it out early.",
      sidebar: {
        freePlan: "Free plan",
      },
      analyzeCard: {
        title: "Analyze a competitor",
        accentSubtitle: "Understand how their script works",
        description:
          "Paste a competitor's video link and get a full breakdown of their script and strategy.",
        benefits: [
          "Script structure breakdown",
          "Hook and retention mechanics",
          "What works and what doesn't",
          "Filler, repeats and weak points",
          "What you can learn and adapt",
        ],
        action: "Analyze competitor",
      },
      compareCard: {
        title: "Compare with my script",
        accentSubtitle: "See how your script stacks up",
        description:
          "Compare a competitor's script with your own to find strengths, weaknesses, and opportunities.",
        benefits: [
          "Side-by-side script comparison",
          "Hook, progression and payoff analysis",
          "Where you win and where they win",
          "Similarity check to avoid copying",
          "Actionable tips to improve your script",
        ],
        action: "Compare scripts",
      },
    },
    analyze: {
      backToSelection: "Back to selection",
      heroEyebrow: "Competitor analysis",
      pageTitle: "Analyze a competitor script",
      headingPrefix: "Analyze a",
      headingAccent: "competitor script",
      description:
        "Paste a public YouTube Shorts link and Climpy will extract the spoken script and explain how it works.",
      urlLabel: "Paste YouTube Shorts link",
      urlPlaceholder: "https://www.youtube.com/shorts/...",
      submitLabel: "Analyze script",
      submittingLabel: "Fetching transcript…",
      privacyNote: {
        heading: "Before you paste a link",
        items: [
          "Public YouTube Shorts only — transcript availability may vary.",
          "Only public content and spoken words are intended to be used.",
        ],
      },
      workflow: {
        sectionLabel: "Planned analysis stages",
        stages: [
          {
            title: "Fetching video",
            description: "Getting video details",
          },
          {
            title: "Extracting transcript",
            description: "Getting the spoken script",
          },
          {
            title: "Analyzing script",
            description: "Breaking down the structure",
          },
          {
            title: "Generating insights",
            description: "Finding what works",
          },
          {
            title: "Done",
            description: "Results ready",
          },
        ],
      },
      breakdown: {
        heading: "You'll get a full breakdown",
        items: [
          {
            title: "Script structure",
            description:
              "See how the script is built from start to finish.",
          },
          {
            title: "Hook analysis",
            description: "Understand the hook type and how it works.",
          },
          {
            title: "What works",
            description: "Identify the strongest elements and why.",
          },
          {
            title: "What's weak",
            description:
              "Find the weak points that may hurt retention.",
          },
          {
            title: "Retention factors",
            description:
              "See what keeps viewers watching or makes them leave.",
          },
          {
            title: "Filler & repeats",
            description: "Spot unnecessary or repeated ideas.",
          },
          {
            title: "What to learn",
            description: "Find patterns and lessons you can adapt.",
          },
          {
            title: "What to avoid",
            description: "See which choices may weaken the script.",
          },
        ],
      },
      example: {
        heading: "Example of what you'll see",
        disclaimer:
          "Illustrative preview — actual results will depend on the submitted video.",
        structureLabel: "Script structure",
        scriptLabel: "Example script",
        stages: [
          { label: "Hook", timestamp: "0:00" },
          { label: "Setup", timestamp: "0:03" },
          { label: "Progression", timestamp: "0:08" },
          { label: "Tension", timestamp: "0:14" },
          { label: "Payoff", timestamp: "0:20" },
          { label: "CTA", timestamp: "0:26" },
        ],
        scriptLines: [
          "Wait — this one mistake is costing you views.",
          "Here's what most people get wrong.",
          "So here's the fix, step by step.",
          "But there's a catch most people miss.",
          "Once you see it, you can't unsee it.",
          "Try this on your next video.",
        ],
      },
      errors: {
        emptyUrl: "Paste a competitor video URL to continue.",
        invalidUrl: "That doesn't look like a valid URL.",
        unsupportedUrl:
          "This doesn't look like a public YouTube Shorts link.",
      },
      apiErrors: {
        rateLimited: "Too many requests. Please try again shortly.",
        transcriptNotFound:
          "We couldn't find a transcript for this video.",
        transcriptUnavailable: "This video's transcript isn't available.",
        videoUnavailable: "This video is unavailable or can't be accessed.",
        transcriptRateLimited:
          "Transcript service is busy right now. Please try again shortly.",
        transcriptTimeout:
          "Transcript retrieval took too long. Please try again.",
        transcriptServiceUnavailable:
          "Transcript service is temporarily unavailable.",
        invalidTranscriptResponse:
          "We couldn't process this video's transcript.",
        networkError:
          "Couldn't connect. Check your connection and try again.",
        unexpectedError: "Something went wrong. Please try again.",
        requestInvalid: "Something went wrong. Please try again.",
      },
    },
    compare: {
      backToSelection: "Back to selection",
      heroEyebrow: "Script comparison",
      headingPrefix: "Compare their script",
      headingAccent: "with yours",
      pageTitle: "Compare their script with yours",
      description:
        "Paste a competitor's video and your own script. Comparison works best when both scripts cover the same or a closely related topic.",
      urlLabel: "Competitor video URL",
      urlPlaceholder: "https://www.youtube.com/shorts/...",
      scriptLabel: "Your script",
      scriptPlaceholder: "Paste your script here...",
      scriptHelper: "Paste only the words that will be spoken.",
      submitLabel: "Compare scripts",
      comingNextMessage:
        "Real comparison is coming in the next phase — thanks for checking it out early.",
      privacyNote: {
        heading: "Before you compare",
        items: [
          "Public YouTube Shorts only — transcript availability may vary.",
          "Works best when both scripts cover the same or a closely related topic.",
          "Paste only the spoken words of your own script.",
        ],
      },
      errors: {
        emptyUrl: "Paste a competitor video URL to continue.",
        invalidUrl: "That doesn't look like a valid URL.",
        unsupportedUrl:
          "This doesn't look like a public YouTube Shorts link.",
        emptyScript: "Paste your script to continue.",
        scriptTooLong: "Your script is over the 1,000-character limit.",
      },
      workflow: {
        sectionLabel: "Planned comparison stages",
        stages: [
          {
            title: "Reading both scripts",
            description: "Taking in the competitor's script and yours",
          },
          {
            title: "Mapping the structure",
            description: "Lining up hook, setup, and payoff",
          },
          {
            title: "Comparing strengths and weaknesses",
            description: "Seeing where each script wins",
          },
          {
            title: "Creating actionable improvements",
            description: "Turning the comparison into next steps",
          },
        ],
      },
      coverage: {
        heading: "What the comparison will cover",
        items: [
          {
            title: "Hook strength",
            description: "How well each opening grabs attention.",
          },
          {
            title: "Opening clarity",
            description: "How quickly the premise becomes clear.",
          },
          {
            title: "Script structure",
            description: "How each script is built from start to finish.",
          },
          {
            title: "Retention mechanics",
            description: "What keeps viewers watching through both.",
          },
          {
            title: "Payoff quality",
            description: "How satisfying each ending lands.",
          },
          {
            title: "Unnecessary filler",
            description: "Where either script could be tighter.",
          },
          {
            title: "Similarities and differences",
            description: "Where the two scripts overlap or diverge.",
          },
          {
            title: "Actionable improvements",
            description: "Concrete changes you could make.",
          },
        ],
      },
      example: {
        heading: "Example comparison",
        disclaimer:
          "Illustrative preview — actual results will depend on both submitted scripts.",
        competitorLabel: "Competitor script",
        yourScriptLabel: "Your script",
        competitorLines: [
          "Hook — opens with a bold claim.",
          "Setup — introduces the premise fast.",
          "Progression — builds through one idea.",
          "Payoff — lands a quick takeaway.",
        ],
        yourScriptLines: [
          "Hook — opens with a question.",
          "Setup — takes a bit longer to land.",
          "Progression — builds through two ideas.",
          "Payoff — lands a broader takeaway.",
        ],
        summaryHeading: "In this example",
        summaryItems: [
          "Stronger opening",
          "Clearer progression",
          "Faster payoff",
        ],
      },
    },
    analyzeResults: {
      backToAnalyze: "Back to analyze",
      heroEyebrow: "Analysis results",
      pageTitle: "Competitor script breakdown",
      headingPrefix: "Competitor script",
      headingAccent: "breakdown",
      description: "Review the submitted video, transcript, and script analysis.",
      missingState: {
        heading: "No analysis data found",
        description:
          "Submit a competitor video on the Analyze page first — this page only shows results for a video you've just submitted.",
        action: "Go to Analyze Competitor",
      },
      summary: {
        realDataLabel: "From your submitted video",
        neutralTitle: "Competitor YouTube video",
        embedTitle: "Submitted competitor video player",
        openOnYouTube: "Open on YouTube",
        platformLabel: "Platform",
        platform: "YouTube",
        sourceFormatLabel: "Format",
        durationLabel: "Transcript duration",
        unknownDuration: "Unknown",
        languageLabel: "Language",
        unknownLanguage: "Unknown",
        segmentCountLabel: "Segments",
        analysisOverviewHeading: "Analysis overview",
      },
      transcript: {
        heading: "Transcript",
        sectionEyebrow: "Transcript · From your submitted video",
        realDataLabel: "Real transcript",
        languageLabel: "Language",
        unknownLanguage: "Unknown",
        durationLabel: "Transcript duration",
        unknownDuration: "Unknown",
        segmentCountLabel: "Segments",
        generationLabel: "Source",
        autoGeneratedLabel: "Auto-generated",
        manualLabel: "Manual",
        timestampedHeading: "Timestamped segments",
        fullTextHeading: "Full transcript",
        showAllSegments: "Show all segments",
        showFewerSegments: "Show fewer",
        showFullTranscript: "Show full transcript",
        showLessTranscript: "Show less",
      },
      scores: {
        heading: "Score overview",
        sectionEyebrow: "Script analysis",
        scoreSuffix: "/100",
        overall: {
          label: "Overall",
          explanation: "How the script performs as a whole.",
        },
        hook: {
          label: "Hook",
          explanation: "How strongly the opening grabs attention.",
        },
        retention: {
          label: "Retention",
          explanation: "How well the script sustains pacing and momentum.",
        },
        structure: {
          label: "Structure",
          explanation: "How clearly the script is organized.",
        },
      },
      verdict: {
        strong: "Strong",
        mixed: "Mixed",
        weak: "Weak",
      },
      whyScores: {
        heading: "Why these scores",
      },
      takeaway: {
        heading: "Main takeaway",
        sectionEyebrow: "Main takeaway",
      },
      structure: {
        heading: "Script structure",
        sectionEyebrow: "Script structure",
        beatLabels: {
          hook: "Hook",
          setup: "Setup",
          context: "Context",
          escalation: "Escalation",
          reveal: "Reveal",
          payoff: "Payoff",
          cta: "Call to action",
          digression: "Digression",
          recap: "Recap",
          other: "Other",
        },
        showDetails: "Show details",
        hideDetails: "Hide details",
        showFullStructure: "Show full structure",
        hideFullStructure: "Hide full structure",
      },
      strengths: {
        heading: "What works",
        sectionEyebrow: "What works",
      },
      weaknesses: {
        heading: "Weak points",
        sectionEyebrow: "Weak points",
        emptyState: "No major weaknesses identified from the transcript.",
      },
      risks: {
        heading: "Retention risks",
        sectionEyebrow: "Retention risks",
        emptyState: "No notable retention risks identified from the transcript.",
      },
      lessons: {
        heading: "Actionable lessons",
        sectionEyebrow: "Actionable lessons",
      },
      caution: {
        heading: "What not to copy",
        sectionEyebrow: "What not to copy",
        description:
          "Adapt the pattern, not the wording — copying exact phrasing or claims can work against you.",
        emptyState:
          "No specific cautions identified — still adapt the pattern, not the wording.",
      },
      severity: {
        minor: "Minor",
        moderate: "Moderate",
        major: "Major",
      },
      analysisUnavailable: {
        transcriptTooLong: {
          heading: "Analysis unavailable",
          description: "This transcript is too long to analyze right now.",
        },
        invalidResponse: {
          heading: "Analysis unavailable",
          description:
            "We couldn't generate a reliable analysis for this script. Please try analyzing it again.",
        },
        unavailable: {
          heading: "Analysis unavailable",
          description:
            "Script analysis is temporarily unavailable. Please try again shortly.",
        },
        legacy: {
          heading: "Analysis unavailable",
          description:
            "This result was saved before script analysis was available. Submit the video again to get a full analysis.",
        },
      },
      actions: {
        backToAnalyze: "Back to Analyze Competitor",
        analyzeAnother: "Analyze another competitor",
        compareWithMyScript: "Compare with my script",
        backToSelection: "Back to Competitor Scripts",
      },
    },
  },
} as const;

type WidenMessageValues<T> =
  T extends (...args: infer Arguments) => infer Result
    ? (...args: Arguments) => Result
    : T extends string
      ? string
      : T extends object
        ? {
            readonly [Key in keyof T]: WidenMessageValues<T[Key]>;
          }
        : T;

export type Messages = WidenMessageValues<typeof enMessages>;

const ruMessages = {
  common: {
    language: "Язык",
    results: "Результаты",
    signIn: "Войти",
    signOut: "Выйти",
    myAnalyses: "Мои анализы",
    home: "Главная",
    menu: "Меню",
  },
  landing: {
    nav: {
      features: "Возможности",
      howItWorks: "Как это работает",
      analyze: "Анализировать",
      startFree: "Попробовать бесплатно",
      results: "Результаты",
    },
    hero: {
      desktopBadge: "Для авторов",
      desktopHeadlinePrefix: "Проверьте сценарий до",
      desktopHeadlineHighlight: "публикации.",
      desktopDescription:
        "Climpy помогает улучшить хук, темп и удержание до публикации видео.",
      mobileBadge: "Анализатор сценариев YouTube Shorts",
      mobileHeadlinePrefix: "Исправьте слабый сценарий, пока",
      mobileHeadlineHighlight: "зритель не пролистнул.",
      mobileDescription:
        "Climpy проверяет хук, темп, рискованные моменты и концовку до публикации вашего Short.",
      primaryAction: "Начать анализ",
      secondaryAction: "Как это работает",
      trustFindWeakLines: "Найти слабые строки",
      trustImprovePacing: "Улучшить темп",
      trustFixBeforeUpload: "Исправить до публикации",
      shortsFirst: "Для Shorts",
      characterLimit: "1 000 символов",
      noUploadNeeded: "Без загрузки видео",
    },
    desktopPreview: {
      title: "Разбор сценария",
      aiReview: "AI-разбор",
      analyzedIn: "Проанализировано за 8 секунд",
      reanalyze: "Анализировать снова",
      scores: {
        overall: "Итог",
        hook: "Хук",
        risk: "Риск",
        medium: "Сред.",
      },
      scriptLabel: "Ваш сценарий",
      scriptLines: {
        opening:
          "Если первые 3 секунды кажутся медленными, большинство зрителей уже ушли.",
        retention:
          "Climpy находит точный момент, где начинает падать удержание.",
        payoff:
          "Этой фразе нужна более сильная визуальная развязка.",
        fixes:
          "Затем Climpy предлагает более ясные правки до публикации.",
      },
      mainTakeawayLabel: "Главный вывод",
      mainTakeaway:
        "Сильный хук, но средней части нужна более ясная развязка.",
      retentionCurve: "Кривая удержания",
      suggestedFixLabel: "Предлагаемая правка",
      suggestedFix:
        "Добавьте более резкий контраст в первую фразу. Покажите зрителю, что он потеряет, если пролистнёт.",
    },
    value: {
      badge: "До публикации",
      headingPrefix: "Находит то, что зрители",
      headingHighlight: "пролистывают.",
      description:
        "Climpy превращает сценарий в понятный разбор: что работает, что кажется затянутым и что улучшить до публикации.",
      hook: {
        title: "Анализ хука",
        description:
          "Узнайте, вызывает ли первая фраза любопытство или звучит слишком обобщённо.",
        previewLabel: "Оценка хука",
        previewDescription:
          "Сильный контраст, понятное напряжение и причина продолжить просмотр.",
      },
      retention: {
        title: "Разбор удержания",
        description:
          "Узнайте, где сценарий замедляется, повторяется или теряет развязку.",
        previewLabel: "Шкала риска",
        strong: "Сильно",
        medium: "Средне",
        risky: "Рискованно",
      },
      fixes: {
        title: "Правки удержания",
        description:
          "Получите конкретные изменения, которые можно внести до записи или монтажа.",
        previewLabel: "Предлагаемая правка",
        previewDescription:
          "Замените общее вступление конкретным визуальным результатом в первой фразе.",
        action: "Улучшить хук",
      },
    },
    comparison: {
      badge: "Почему Climpy",
      headingPrefix: "Без настройки промптов. Только",
      headingHighlight: "разбор сценария Shorts",
      description:
        "Climpy создан для одной задачи: проверить, готов ли сценарий Shorts к публикации.",
      withoutLabel: "Без Climpy",
      withoutHeading: "Вы гадаете, что исправить.",
      withoutDescription:
        "Обычные AI-инструменты могут помочь, но для обратной связи по Shorts вам часто всё равно приходится самостоятельно строить весь разбор.",
      withoutItems: [
        "Определить, каким должен быть сильный хук для Shorts",
        "Найти, где зрители могут потерять интерес",
        "Самостоятельно оценить темп и развязку",
        "Превратить общие советы в реальные правки сценария",
      ],
      withHeading: "Получите структурированный разбор за несколько секунд.",
      aiReview: "AI-разбор",
      scores: {
        hookScore: "Оценка хука",
        risk: "Риск",
        medium: "Сред.",
        riskyPart: "Проблемный фрагмент",
      },
      mainIssueLabel: "Главная проблема",
      mainIssue:
        "Подводка длится слишком долго до появления главного обещания.",
      suggestedFixLabel: "Предлагаемая правка",
      suggestedFix:
        "Перенесите основной конфликт в первую фразу и сократите подводку.",
    },
    faq: {
      badge: "Частые вопросы",
      headingPrefix: "Часто задаваемые",
      headingHighlight: "вопросы",
      description:
        "Всё, что нужно знать перед первым тестированием сценария Shorts в Climpy.",
      questions: [
        {
          question: "Можно ли бесплатно протестировать Climpy?",
          answer:
            "Да. Сейчас Climpy можно протестировать бесплатно. Регистрация не нужна — просто вставьте сценарий Shorts и получите разбор примерно за 1 минуту.",
        },
        {
          question: "Что именно проверяет Climpy?",
          answer:
            "Climpy проверяет силу хука, риск удержания, проблемные фрагменты, темп, понятность развязки и предлагает конкретные правки до публикации.",
        },
        {
          question: "Нужно ли загружать видео?",
          answer:
            "Нет. Climpy работает с текстом сценария. Его можно вставить из Google Docs, Notion, заметок, телефона или любого другого приложения.",
        },
        {
          question: "Climpy подходит для всех видео?",
          answer:
            "Сейчас Climpy лучше всего работает со сценариями YouTube Shorts, особенно с короткими видео длительностью около 15–60 секунд. В будущем мы также планируем добавить поддержку длинных YouTube-видео.",
        },
        {
          question: "Что делать, если я не согласен с разбором?",
          answer:
            "Вам не обязательно применять каждую рекомендацию. Climpy помогает заметить возможные слабые места до публикации. После анализа вы также можете оценить результат и написать, что Climpy должен был исправить лучше.",
        },
        {
          question: "Сохраняется ли мой сценарий или используется где-то ещё?",
          answer:
            "Ваш сценарий используется только для создания анализа. Climpy не требует аккаунта и не публикует ваш сценарий.",
        },
      ],
      ctaHeading: "Готовы проверить сценарий?",
      ctaDescription:
        "Вставьте один настоящий сценарий Shorts и получите разбор примерно за 1 минуту.",
      ctaAction: "Анализировать сценарий",
    },
    analyzer: {
      eyebrow: "Попробуйте сейчас",
      heading: "Вставьте сценарий. Получите мгновенный разбор.",
      supportingText:
        "Лучше всего подходит для YouTube Shorts длительностью 15–60 секунд.",
      instructionsLabel: "Как пользоваться Climpy",
      steps: {
        paste: {
          title: "Вставьте сценарий",
          desktopDescription:
            "Вставьте только слова, которые будут произнесены в вашем Short.",
          mobileDescription:
            "Вставьте слова, которые будут произнесены в вашем Short.",
        },
        analyze: {
          title: "Запустите анализ",
          desktopDescription:
            "Нажмите «Анализировать сценарий» и дождитесь результатов.",
          mobileDescription:
            "Нажмите «Анализировать сценарий».",
        },
        review: {
          title: "Просмотрите исправления",
          desktopDescription:
            "Проверьте слабые моменты, риск удержания и конкретные исправления.",
          mobileDescription:
            "Проверьте слабые моменты и предложенные исправления.",
        },
      },
      videoTitle: "Название видео",
      optionalDesktop: "(необязательно)",
      optionalMobile: "Необязательно",
      titleHelp: "Помогает Climpy понять контекст.",
      titlePlaceholder: "Добавьте название или тему видео",
      titleTooLong:
        "Название слишком длинное. Сократите его до 200 символов.",
      scriptLabel: "Ваш сценарий",
      scriptHelpDesktop:
        "Climpy настроен на анализ Shorts, поэтому сценарий ограничен 1 000 символами. Вставляйте только текст, который будет произнесён в видео — не описание и не список идей.",
      scriptHelpMobile:
        "Climpy настроен на анализ Shorts, поэтому сценарий ограничен 1 000 символами. Вставляйте только текст, который будет произнесён в видео.",
      scriptPlaceholderDesktop: "Вставьте сценарий...",
      scriptPlaceholderMobile: "Вставьте сценарий.",
      copyHint:
        "Можно скопировать его из Google Docs, Notion или любого другого инструмента.",
      tryExampleAction: "Попробовать пример",
      exampleScript:
        "Представьте приложение, которое становится хуже с каждым обновлением. Команда добавляет всё больше функций, но пользователи лишь сильнее путаются. Тогда разработчики убирают всё лишнее и сосредотачиваются на одной действительно важной проблеме. В итоге приложение становится быстрее, проще и гораздо удобнее.",
      scriptOverLimit: (count: number) =>
        `Ваш сценарий превышает текущий лимит на ${count} ${formatRussianCharacterCount(
          count
        )}. Сократите его, чтобы включить кнопку «Анализировать сценарий».`,
      analyzing: "Анализируем...",
      analyzeScript: "Анализировать сценарий",
      privacy:
        "Сценарий используется только для создания этого анализа.",
      noAccountNeeded:
        "Для анализа аккаунт не нужен. Войдите только в том случае, если хотите сохранить результаты.",
      whatYouWillGet: "Что вы получите",
      whatYouWillGetItems: {
        overallScore: {
          title: "Общая оценка",
          desc: "Узнайте силу сценария до публикации.",
        },
        hookAnalysis: {
          title: "Анализ хука",
          desc: "Узнайте, способен ли хук остановить прокрутку.",
        },
        retentionRisk: {
          title: "Риск удержания",
          desc: "Найдите моменты, где зрители могут потерять интерес.",
        },
        riskyTimestamps: {
          title: "Проблемные таймкоды",
          desc: "Получите конкретные строки и моменты для улучшения.",
        },
        suggestedFixes: {
          title: "Предлагаемые правки",
          desc: "Получите ясные правки для хука, темпа и развязки.",
        },
      },
      shortsOnly: "Только Shorts",
    },
    errors: {
      emptyScript: "Сначала вставьте сценарий.",
      scriptTooLong:
        "Сценарий слишком длинный. Сократите его до 1 000 символов или меньше.",
      titleTooLong:
        "Название слишком длинное. Сократите его до 200 символов.",
      invalidResponse:
        "Сервис вернул некорректный ответ. Попробуйте ещё раз.",
      unexpectedResponse:
        "Сервис вернул неожиданный ответ. Попробуйте ещё раз.",
      analysisFailed:
        "Не удалось выполнить анализ. Попробуйте ещё раз.",
      generic: "Что-то пошло не так. Попробуйте ещё раз.",
    },
    mobile: {
      previewTitle: "Разбор сценария",
      previewLabel: "Пример результата",
      aiFeedback: "AI-разбор",
      previewScores: {
        overall: "Итог",
        hook: "Хук",
        risk: "Риск",
        medium: "Сред.",
      },
      previewHookIssue: "0:00 Проблема с хуком",
      previewHookIssueDescription:
        "В начале не хватает ясной причины продолжить просмотр.",
      previewSuggestedFix: "Предлагаемая правка",
      previewSuggestedFixDescription:
        "Добавьте в первую фразу более резкий контраст или конкретный результат.",
      estimatedDuration: (duration: string) =>
        `Примерно ${duration}`,
      newAnalysis: "Новый анализ",
      newAnalysisHeading: "Вставьте сценарий.",
      newAnalysisDescription:
        "Получите оценку хука, риск удержания, проблемные таймкоды и конкретные исправления.",
      checksHeading: "Что проверяет Climpy",
      checks: {
        hookStrength: {
          title: "Сила хука",
          desc: "Оценивает первую фразу.",
        },
        retentionRisk: {
          title: "Риск удержания",
          desc: "Показывает, где зрители могут уйти.",
        },
        payoffQuality: {
          title: "Сила развязки",
          desc: "Проверяет, оправдывает ли концовка ожидание.",
        },
        suggestedFixes: {
          title: "Предлагаемые правки",
          desc: "Даёт конкретные улучшения.",
        },
      },
      improveBeforeRecording:
        "Улучшите сценарий до начала записи.",
      nextIdea:
        "Вставьте идею следующего Short и узнайте, где зрители могут потерять интерес.",
      tryClimpy: "Попробовать Climpy",
    },
    footer: {
      tagline: "ИИ-проверка сценариев Shorts",
      description:
        "Проверьте сценарий Shorts перед публикацией. Найдите слабые хуки, риски удержания, неясную развязку и простые исправления примерно за 1 минуту.",
      productHeading: "Продукт",
      analyzeScript: "Анализировать сценарий",
      faqs: "Частые вопросы",
      tryClimpy: "Попробовать Climpy",
      builtForHeading: "Для кого",
      builtForItems: [
        "Авторы YouTube Shorts",
        "Тестирование сценариев",
        "Быстрая проверка перед публикацией",
      ],
      copyright: "© 2026 Climpy. Создано для авторов коротких видео.",
      processTagline: "Вставьте. Проверьте. Улучшите. Опубликуйте.",
    },
  },
  results: {
    nav: {
      newAnalysis: "Новый анализ",
      newAnalysisMobileNav: "Новый анализ",
    },
    header: {
      title: "Разбор сценария",
      analyzedPrefix: "Проанализировано только что —",
      fallbackTitle: "Сценарий YouTube Shorts",
    },
    localeMismatch: {
      message:
        "Этот анализ был создан на английском. Запустите новый анализ, чтобы получить объяснения ИИ на русском.",
    },
    loading: {
      title: "Загрузка результатов...",
      descriptionDesktop:
        "Подождите, пока Climpy проверяет ваш последний анализ.",
      descriptionMobile: "Подождите немного.",
    },
    error: {
      invalidAnalysis:
        "Сохранённый анализ повреждён. Вернитесь назад и проанализируйте сценарий заново.",
      couldNotLoad:
        "Не удалось загрузить сценарий. Вернитесь назад и попробуйте снова.",
    },
    empty: {
      headingDesktop: "Сценарий ещё не проанализирован.",
      descriptionDesktop:
        "Перейдите в «Новый анализ» и сначала вставьте сценарий YouTube Shorts. После нажатия «Анализировать сценарий» результаты появятся здесь.",
      headingMobile: "Сценарий ещё не проанализирован.",
      descriptionMobile:
        "Перейдите в «Новый анализ» и сначала вставьте сценарий.",
    },
    scoreCards: {
      overallScore: "Общая оценка",
      hookScore: "Оценка хука",
      retentionRisk: "Риск удержания",
      overall: "Итог",
      hook: "Хук",
      risk: "Риск",
    },
    scoreLabels: {
      overall: {
        veryStrong: "Очень сильно",
        strong: "Сильно",
        mixed: "Смешанно",
        average: "Средне",
        needsWork: "Требует доработки",
        weak: "Слабо",
      },
      hook: {
        strong: "Сильно",
        good: "Хорошо",
        average: "Средне",
        weak: "Слабо",
      },
      risk: {
        high: "Высокий",
        medium: "Средний",
        lowMedium: "Ниже среднего",
        low: "Низкий",
      },
    },
    scoreBreakdown: {
      heading: "Почему такие оценки?",
      description:
        "Каждый итог складывается из четырёх компонентов по 25 баллов. Для риска удержания меньше — лучше.",
      lowerIsBetter: "Меньше — лучше",
      higherIsBetter: "Больше — лучше",
      items: {
        premiseAppeal: {
          label: "Привлекательность идеи",
          description:
            "Насколько интересна и ценна сама идея сценария.",
        },
        openingPromise: {
          label: "Обещание в начале",
          description:
            "Насколько чётко начало обещает ценность, которую сценарий раскрывает.",
        },
        progression: {
          label: "Развитие",
          description:
            "Насколько каждый бит добавляет ещё одну причину смотреть дальше.",
        },
        payoff: {
          label: "Развязка",
          description:
            "Насколько сильно концовка раскрывает обещанную ценность.",
        },
        immediacy: {
          label: "Скорость подачи",
          description:
            "Как быстро сценарий доходит до конкретной сути.",
        },
        specificity: {
          label: "Конкретность",
          description:
            "Насколько начало конкретно и легко для понимания.",
        },
        viewerPull: {
          label: "Притяжение внимания",
          description:
            "Сколько любопытства, актуальности, контраста или ставок создаёт начало.",
        },
        deliveryAlignment: {
          label: "Соответствие ожиданиям",
          description:
            "Насколько точно хук соответствует тому, что раскрывает сценарий.",
        },
        openingFriction: {
          label: "Затянутое начало",
          description:
            "Задержка, лишние слова или путаница до появления сути.",
        },
        progressionRisk: {
          label: "Риск развития",
          description:
            "Повторы, застой в развитии или низкая плотность информации.",
        },
        predictabilityRisk: {
          label: "Риск предсказуемости",
          description:
            "Насколько легко зрители могут предугадать следующие моменты сценария.",
        },
        payoffRisk: {
          label: "Риск развязки",
          description:
            "Риск того, что концовка покажется слабой, незавершённой или противоречивой.",
        },
      },
    },
    mainTakeaway: {
      label: "Главный вывод",
    },
    script: {
      heading: "Ваш сценарий",
      titleLabel: "Название",
      characterCount: (count: number) =>
        `${count} из 1000 символов`,
      estimatedDuration: (duration: string) =>
        `Примерно ${duration}`,
    },
    riskyParts: {
      heading: "Рискованные моменты",
      found: (count: number) => `Найдено: ${count}`,
      noneWithFixesTitle: "Существенных рискованных моментов не найдено.",
      noneWithFixesDescription:
        "Существенных точек оттока зрителей не найдено; предложения ниже — необязательные улучшения.",
      noneTitle: "Рискованных моментов не найдено.",
      noneDescription:
        "Сценарий остаётся сфокусированным и не содержит существенных точек оттока.",
    },
    suggestedFixes: {
      heading: "Предлагаемые правки",
      count: (count: number) =>
        `${count} ${pluralizeRu(count, "предложение", "предложения", "предложений")}`,
      improveScriptButton: "Улучшить сценарий",
      improveScriptDescription:
        "Перепишите сценарий с учётом предложенных улучшений.",
      hookActionNeedsDetails: "Нужны детали",
      hookActionRefine: "Доработать хук",
      hookActionImprove: "Улучшить хук",
      noFixesTitle: "Правки не нужны.",
      noFixesDescriptionCompact: "Сценарий уже хорошо работает.",
      noFixesDescription:
        "По результатам текущего анализа сценарий уже хорошо работает.",
      showFewer: "Показать меньше",
      viewAll: "Показать все предложения",
    },
    sceneBreakdown: {
      heading: "Разбор по сценам",
    },
    feedback: {
      heading: "Оцените этот анализ",
      subheading: "Разбор оказался полезным?",
      helpful: "Полезно",
      whatWasHelpful: "Что было полезным?",
      whatWasWrong: "Что было не так?",
      thanksHelpful: "Спасибо — отзыв учтён.",
      thanksUnhelpful: "Спасибо — мы используем это для улучшений.",
      sending: "Отправка отзыва...",
      submitError: "Не удалось отправить отзыв. Попробуйте ещё раз.",
      helpfulReasonLabels: {
        accurateScore: "Точная оценка",
        usefulFixes: "Полезные правки",
        clearExplanation: "Понятное объяснение",
        other: "Другое",
      },
      unhelpfulReasonLabels: {
        wrongScore: "Неверная оценка",
        badSuggestions: "Плохие предложения",
        notSpecific: "Недостаточно конкретно",
        other: "Другое",
      },
      otherModal: {
        likedTitle: "Что вам понравилось?",
        wrongTitle: "Что не сработало?",
        helperText: "Ваш отзыв помогает улучшать Climpy.",
        placeholderLiked:
          "Расскажите, что вам понравилось в этом анализе...",
        placeholderWrong:
          "Расскажите, что было не так или чего не хватило...",
        submit: "Отправить",
        submitting: "Отправка...",
        cancel: "Отмена",
      },
      mobileModal: {
        likedTitle: "Что вам понравилось?",
        wrongTitle: "Что было не так?",
        likedDescription:
          "Расскажите, что показалось полезным, точным или уместным в этом анализе.",
        wrongDescription:
          "Расскажите, что показалось неточным, запутанным или бесполезным в этом анализе.",
        placeholderLiked: "Расскажите, что вам понравилось...",
        placeholderWrong: "Напишите свой отзыв здесь...",
        send: "Отправить отзыв",
        sending: "Отправка...",
        cancel: "Отмена",
      },
    },
    share: {
      shared: "Отправлено.",
      reviewCopied: "Разбор скопирован.",
      fallbackTitle: "Разбор сценария Climpy",
    },
    improveScriptModal: {
      originalPreservedTitle: "Исходный сценарий сохранён",
      improvedTitle: "Улучшенный сценарий",
      diagnosticTitle: "Climpy пока не может безопасно улучшить этот сценарий",
      diagnosticDescription:
        "Сценарию не хватает конкретного факта, сравнения, события или развязки, чтобы Climpy мог создать заметно более сильную версию без выдумывания информации.",
      diagnosticRetryDescription:
        "В сценарии достаточно материала, но эта попытка не стала заметным улучшением. Попробуйте запустить улучшение сценария ещё раз.",
      preservedDescription:
        "Climpy сохранил ваш исходный сценарий — он уже работает хорошо, и переписывание не добавило бы значимой ценности.",
      defaultDescription:
        "Climpy переписывает весь Short, сохраняя факты из вашего исходного сценария.",
      improving: "Улучшаем весь сценарий...",
      noScriptGenerated: "Улучшенный сценарий не был создан.",
      addMissingMaterial: (items: string[]) =>
        `Добавьте: ${items.join(", ")}.`,
      copyOriginal: "Копировать оригинал",
      copyScript: "Копировать сценарий",
      copied: "Скопировано!",
      close: "Закрыть",
      genericError: "Не удалось улучшить сценарий. Попробуйте ещё раз.",
    },
    hookModal: {
      needsMoreSpecificMaterialTitle: "Нужен более конкретный материал",
      refinedHookTitle: "Доработанный хук",
      improvedHookTitle: "Улучшенный хук",
      hookAnalysisTitle: "Анализ хука",
      refineHookTitle: "Доработать хук",
      tooBroadDescription:
        "Этот сценарий слишком общий, чтобы переписать более сильный хук без выдумывания фактов.",
      refineSameDescription:
        "Эта версия сохраняет то же обещание, делая начало более чётким и острым.",
      usePromptDescription:
        "Используйте эту версию, чтобы сделать начало более чётким, сильным и интригующим.",
      alreadyWorksDescription:
        "Это начало уже создаёт понятную причину смотреть дальше.",
      workingRefineDescription:
        "Хук уже работает. Эта доработка помогает усилить начало или развязку.",
      whyNoHookGenerated: "Почему хук не был создан:",
      whatThisVersionImproves: "Что улучшает эта версия:",
      whyItIsBetter: "Почему это лучше:",
      whyThisHookWorks: "Почему этот хук работает:",
      improving: "Улучшаем хук...",
      rewritingDescription:
        "Climpy переписывает начало на основе вашего сценария.",
      noImprovedHookGenerated: "Улучшенный хук не был создан.",
      addSpecificMaterial:
        "Добавьте в сценарий конкретный материал, прежде чем создавать новый хук.",
      alreadyGoodReason:
        "Хук уже понятен, конкретен и вызывает любопытство без необходимости переписывать его.",
      adjustedReason:
        "Хук был скорректирован для большей ясности, интриги или связи с развязкой.",
      copyAdvice: "Копировать совет",
      copyHook: "Копировать хук",
      copied: "Скопировано!",
      close: "Закрыть",
      genericError: "Не удалось улучшить хук. Попробуйте ещё раз.",
      noValidatedHookSuggestion:
        "Для этого анализа нет проверенного варианта хука.",
    },
    save: {
      action: "Сохранить анализ",
      saving: "Сохранение...",
      saved: "Сохранено",
      retry: "Повторить",
      errorAuth: "Войдите, чтобы сохранить этот анализ.",
      errorValidation:
        "Этот анализ нельзя сохранить. Попробуйте проанализировать сценарий заново.",
      errorDatabase: "Не удалось сохранить анализ. Попробуйте ещё раз.",
      untitled: "Анализ без названия",
    },
    askClimpy: {
      entryButton: "Спросить у Climpy",
      entryDescription:
        "Задавайте вопросы, чтобы лучше разобраться в результатах анализа.",
      panelHeading: "Спросить у Climpy",
      panelSubheading: "Задайте вопрос об этом анализе.",
      closeLabel: "Закрыть",
      inputLabel: "Ваш вопрос",
      inputPlaceholder: "Спросите про хук, риск или правки...",
      send: "Отправить",
      sending: "Думаю...",
      starterQuestionsHeading: "Например",
      starterQuestions: {
        whatToFixFirst: "Что исправить в первую очередь?",
        whyHookWeak: "Почему мой хук слабый?",
        explainRiskiestPart: "Объясни самый рискованный момент простыми словами.",
        rewriteRiskiestPart: "Перепиши самый рискованный момент, не добавляя фактов.",
      },
      actionLabel: "Что изменить",
      exampleLabel: "Пример",
      originalLabel: "Оригинал",
      suggestedRewriteLabel: "Предлагаемый вариант",
      rewriteUnavailable:
        "Climpy не может безопасно переписать это без дополнительного контекста из сценария.",
      capReached:
        "Вы достигли лимита вопросов для этого анализа. Начните новый анализ, чтобы продолжить.",
      errorGeneric: "Climpy не смог ответить. Попробуйте ещё раз.",
      errorRateLimited:
        "Вы спрашиваете слишком быстро. Подождите немного и попробуйте снова.",
      errorRequestInvalid:
        "С этим запросом что-то не так. Попробуйте ещё раз.",
      errorRetryFailed:
        "Climpy снова не смог получить корректный ответ. Подождите немного или сформулируйте вопрос иначе.",
      errorTechnicalExplanation:
        "Запрос завершился технической ошибкой ответа. Это произошло не из-за формулировки вашего вопроса. Попробуйте отправить запрос ещё раз.",
      retryLabel: "Повторить",
      noEligibleRewriteExplanation:
        "Сейчас нет проверенного рискованного фрагмента, который Climpy может безопасно переписать. Попробуйте задать конкретный вопрос об анализе.",
      localIntents: {
        greeting:
          "Привет! Спросите меня об этом анализе — я помогу понять, что исправить.",
        thanks: "Пожалуйста.",
        acknowledgement: "Хорошо.",
        farewell: "До встречи.",
        capability:
          "Я могу объяснить ваши оценки и рискованные моменты, помочь понять, что исправить в первую очередь, упростить рекомендацию или переписать один проверенный рискованный фрагмент, не выдумывая факты.",
      },
      localeMismatchNotice:
        "Этот анализ создан на английском. Climpy объяснит его на русском.",
      emptyState:
        "Задайте вопрос о хуке, рискованных моментах или предложенных правках.",
      poweredByNotice:
        "Ответы основаны только на этом анализе и вашем сценарии.",
    },
  },
  auth: {
    login: {
      heading: "Добро пожаловать в Climpy",
      description:
        "Войдите, чтобы сохранять и просматривать анализы сценариев.",
      continueWithGoogle: "Продолжить с Google",
      privacyNote:
        "Мы используем вход через Google только для подтверждения личности — мы ничего не публикуем и не передаём третьим лицам.",
      errorGeneric:
        "Не удалось выполнить вход. Попробуйте ещё раз.",
      errorMissingCode:
        "Ссылка для входа недействительна или устарела.",
      backToHome: "На главную",
    },
    modal: {
      closeLabel: "Закрыть",
    },
  },
  myAnalyses: {
    heading: "Мои анализы",
    subtitle: "Все ваши сохранённые анализы сценариев в одном месте.",
    empty: {
      heading: "Пока нет сохранённых анализов.",
      description:
        "Проанализируйте сценарий и сохраните его, чтобы увидеть здесь.",
    },
    loading: {
      heading: "Загружаем ваши анализы...",
      description: "Это займёт всего мгновение.",
    },
    error: {
      heading: "Не удалось загрузить ваши анализы.",
      description: "Обновите страницу, чтобы попробовать ещё раз.",
      retryLabel: "Повторить",
    },
    list: {
      scoreUnavailable: "Недоступно",
    },
    table: {
      columnScript: "Сценарий",
      columnAnalyzed: "Дата анализа",
      columnOverall: "Общая оценка",
      columnHook: "Хук",
      columnRisk: "Риск",
      columnActions: "Действия",
      open: "Открыть",
    },
    open: {
      loadingHeading: "Открываем ваш анализ...",
      loadingDescription: "Подождите немного.",
      notFoundHeading: "Анализ не найден.",
      notFoundDescription:
        "Возможно, этот анализ был удалён, либо ссылка неверна.",
      backLink: "Назад к «Мои анализы»",
      errorHeading: "Не удалось открыть этот анализ.",
      errorDescription: "Обновите страницу, чтобы попробовать ещё раз.",
    },
    delete: {
      triggerLabel: "Удалить",
      dialogHeading: "Удалить анализ",
      dialogDescription:
        "Вы уверены, что хотите удалить этот анализ?",
      dialogDescriptionWithTitle: (title: string) =>
        `Вы уверены, что хотите удалить «${title}»?`,
      permanentWarning:
        "Это действие необратимо и не может быть отменено.",
      cancel: "Отмена",
      confirm: "Удалить",
      deleting: "Удаление...",
      errorHeading: "Не удалось удалить",
      errorDescription:
        "Не удалось удалить этот анализ. Попробуйте ещё раз.",
    },
    rename: {
      triggerLabel: "Переименовать",
      dialogHeading: "Переименовать анализ",
      inputLabel: "Название анализа",
      cancel: "Отмена",
      confirm: "Сохранить",
      saving: "Сохранение...",
      errorEmpty: "Название не может быть пустым.",
      errorTooLong: "Название слишком длинное.",
      errorHeading: "Не удалось переименовать",
      errorDescription:
        "Не удалось переименовать этот анализ. Попробуйте ещё раз.",
    },
    actionsMenu: {
      triggerLabel: "Другие действия",
    },
    search: {
      inputLabel: "Поиск анализов по названию",
      placeholder: "Поиск по названию...",
      clearLabel: "Очистить поиск",
      noResultsHeading: "Нет анализов, соответствующих запросу.",
      noResultsDescriptionPrefix:
        "Нет сохранённых анализов, соответствующих запросу «",
      noResultsDescriptionSuffix: "».",
    },
    filters: {
      groupLabel: "Фильтр по риску",
      all: "Все",
      noResultsHeading: "Нет анализов, соответствующих этому фильтру",
      noResultsDescription: "Попробуйте выбрать другой уровень риска.",
      noResultsCombinedHeading:
        "Нет анализов, соответствующих поиску и фильтру",
      noResultsCombinedDescription:
        "Попробуйте изменить поисковый запрос или выбрать другой уровень риска.",
    },
    pagination: {
      ariaLabel: "Навигация по страницам анализов",
      previousLabel: "Назад",
      nextLabel: "Далее",
      pageLabel: "Страница",
      ofLabel: "из",
    },
  },
  competitorScripts: {
    modeSelection: {
      backLabel: "Назад",
      pageTitle: "Сценарии конкурентов",
      heading: "Что вы хотите проанализировать?",
      subheading:
        "Выберите, как использовать сценарий конкурента. Каждый вариант даёт свои инсайты, чтобы помочь вам создавать контент лучше.",
      note: "Для наиболее точного сравнения оба сценария должны быть на одну и ту же или близкую тему.",
      comingNext: "Скоро",
      comingNextMessage:
        "Этот раздел скоро появится — спасибо, что заглянули так рано.",
      sidebar: {
        freePlan: "Бесплатный план",
      },
      analyzeCard: {
        title: "Проанализировать конкурента",
        accentSubtitle: "Поймите, как устроен их сценарий",
        description:
          "Вставьте ссылку на видео конкурента и получите полный разбор его сценария и стратегии.",
        benefits: [
          "Разбор структуры сценария",
          "Механика хука и удержания",
          "Что работает, а что нет",
          "Вода, повторы и слабые места",
          "Что можно перенять и адаптировать",
        ],
        action: "Проанализировать конкурента",
      },
      compareCard: {
        title: "Сравнить со своим сценарием",
        accentSubtitle: "Узнайте, как ваш сценарий выглядит на фоне конкурента",
        description:
          "Сравните сценарий конкурента со своим, чтобы найти сильные стороны, слабые места и возможности.",
        benefits: [
          "Сравнение сценариев бок о бок",
          "Анализ хука, развития и развязки",
          "Где выигрываете вы, а где конкурент",
          "Проверка на схожесть, чтобы избежать копирования",
          "Конкретные советы по улучшению сценария",
        ],
        action: "Сравнить сценарии",
      },
    },
    analyze: {
      backToSelection: "Назад к выбору",
      heroEyebrow: "Анализ конкурентов",
      pageTitle: "Проанализировать сценарий конкурента",
      headingPrefix: "Проанализировать",
      headingAccent: "сценарий конкурента",
      description:
        "Вставьте ссылку на публичное видео YouTube Shorts, и Climpy извлечёт произнесённый сценарий и объяснит, как он работает.",
      urlLabel: "Вставьте ссылку YouTube Shorts",
      urlPlaceholder: "https://www.youtube.com/shorts/...",
      submitLabel: "Проанализировать сценарий",
      submittingLabel: "Получаем транскрипт…",
      privacyNote: {
        heading: "Перед тем как вставить ссылку",
        items: [
          "Только публичные YouTube Shorts — доступность транскрипта может отличаться.",
          "Используются только публичные материалы и произнесённый текст.",
        ],
      },
      workflow: {
        sectionLabel: "Запланированные этапы анализа",
        stages: [
          {
            title: "Получение видео",
            description: "Получаем детали видео",
          },
          {
            title: "Извлечение транскрипта",
            description: "Получаем произнесённый текст",
          },
          {
            title: "Анализ сценария",
            description: "Разбираем структуру",
          },
          {
            title: "Формирование инсайтов",
            description: "Находим, что работает",
          },
          {
            title: "Готово",
            description: "Результаты готовы",
          },
        ],
      },
      breakdown: {
        heading: "Вы получите полный разбор",
        items: [
          {
            title: "Структура сценария",
            description:
              "Посмотрите, как сценарий построен от начала до конца.",
          },
          {
            title: "Анализ хука",
            description: "Поймите тип хука и то, как он работает.",
          },
          {
            title: "Что работает",
            description: "Определите самые сильные элементы и почему.",
          },
          {
            title: "Что слабо",
            description:
              "Найдите слабые места, которые могут снижать удержание.",
          },
          {
            title: "Факторы удержания",
            description:
              "Узнайте, что удерживает зрителей, а что заставляет уйти.",
          },
          {
            title: "Вода и повторы",
            description: "Найдите лишние или повторяющиеся идеи.",
          },
          {
            title: "Что перенять",
            description:
              "Найдите паттерны и уроки, которые можно адаптировать.",
          },
          {
            title: "Чего избегать",
            description: "Узнайте, какие решения могут ослабить сценарий.",
          },
        ],
      },
      example: {
        heading: "Пример того, что вы увидите",
        disclaimer:
          "Иллюстративный пример — реальный результат зависит от загруженного видео.",
        structureLabel: "Структура сценария",
        scriptLabel: "Пример сценария",
        stages: [
          { label: "Хук", timestamp: "0:00" },
          { label: "Завязка", timestamp: "0:03" },
          { label: "Развитие", timestamp: "0:08" },
          { label: "Напряжение", timestamp: "0:14" },
          { label: "Развязка", timestamp: "0:20" },
          { label: "Призыв к действию", timestamp: "0:26" },
        ],
        scriptLines: [
          "Стоп — вот из-за чего вы теряете просмотры.",
          "Вот в чём чаще всего ошибаются.",
          "А вот как это исправить, шаг за шагом.",
          "Но есть нюанс, который почти все упускают.",
          "Как только увидите это, уже не сможете развидеть.",
          "Попробуйте это в своём следующем видео.",
        ],
      },
      errors: {
        emptyUrl: "Вставьте ссылку на видео конкурента, чтобы продолжить.",
        invalidUrl: "Это не похоже на корректную ссылку.",
        unsupportedUrl: "Это не похоже на публичную ссылку YouTube Shorts.",
      },
      apiErrors: {
        rateLimited: "Слишком много запросов. Повторите попытку чуть позже.",
        transcriptNotFound: "Не удалось найти транскрипт для этого видео.",
        transcriptUnavailable: "Транскрипт этого видео недоступен.",
        videoUnavailable: "Это видео недоступно или закрыто для доступа.",
        transcriptRateLimited:
          "Сервис транскрипции сейчас перегружен. Повторите попытку чуть позже.",
        transcriptTimeout:
          "Получение транскрипта заняло слишком много времени. Попробуйте снова.",
        transcriptServiceUnavailable:
          "Сервис транскрипции временно недоступен.",
        invalidTranscriptResponse:
          "Не удалось обработать транскрипт этого видео.",
        networkError:
          "Не удалось подключиться. Проверьте соединение и попробуйте снова.",
        unexpectedError: "Что-то пошло не так. Попробуйте снова.",
        requestInvalid: "Что-то пошло не так. Попробуйте снова.",
      },
    },
    compare: {
      backToSelection: "Назад к выбору",
      heroEyebrow: "Сравнение сценариев",
      headingPrefix: "Сравните их сценарий",
      headingAccent: "со своим",
      pageTitle: "Сравните их сценарий со своим",
      description:
        "Вставьте видео конкурента и свой сценарий. Сравнение работает лучше всего, когда оба сценария на одну и ту же или близкую тему.",
      urlLabel: "Ссылка на видео конкурента",
      urlPlaceholder: "https://www.youtube.com/shorts/...",
      scriptLabel: "Ваш сценарий",
      scriptPlaceholder: "Вставьте свой сценарий здесь...",
      scriptHelper: "Вставляйте только те слова, которые будут произнесены.",
      submitLabel: "Сравнить сценарии",
      comingNextMessage:
        "Настоящее сравнение появится на следующем этапе — спасибо, что заглянули так рано.",
      privacyNote: {
        heading: "Перед сравнением",
        items: [
          "Только публичные YouTube Shorts — доступность транскрипта может отличаться.",
          "Лучше всего работает, когда оба сценария на одну и ту же или близкую тему.",
          "Вставляйте только произнесённый текст своего сценария.",
        ],
      },
      errors: {
        emptyUrl: "Вставьте ссылку на видео конкурента, чтобы продолжить.",
        invalidUrl: "Это не похоже на корректную ссылку.",
        unsupportedUrl: "Это не похоже на публичную ссылку YouTube Shorts.",
        emptyScript: "Вставьте свой сценарий, чтобы продолжить.",
        scriptTooLong: "Ваш сценарий превышает лимит в 1000 символов.",
      },
      workflow: {
        sectionLabel: "Запланированные этапы сравнения",
        stages: [
          {
            title: "Чтение обоих сценариев",
            description: "Изучаем сценарий конкурента и ваш",
          },
          {
            title: "Сопоставление структуры",
            description: "Сравниваем хук, завязку и развязку",
          },
          {
            title: "Сравнение сильных и слабых сторон",
            description: "Смотрим, где какой сценарий выигрывает",
          },
          {
            title: "Формирование улучшений",
            description: "Превращаем сравнение в конкретные шаги",
          },
        ],
      },
      coverage: {
        heading: "Что войдёт в сравнение",
        items: [
          {
            title: "Сила хука",
            description: "Насколько хорошо каждое начало цепляет внимание.",
          },
          {
            title: "Ясность завязки",
            description: "Как быстро становится понятна суть.",
          },
          {
            title: "Структура сценария",
            description: "Как построен каждый сценарий от начала до конца.",
          },
          {
            title: "Механика удержания",
            description: "Что удерживает зрителей в обоих сценариях.",
          },
          {
            title: "Качество развязки",
            description: "Насколько удачно завершается каждый сценарий.",
          },
          {
            title: "Лишняя вода",
            description: "Где любой из сценариев можно сделать короче.",
          },
          {
            title: "Сходства и различия",
            description: "Где сценарии пересекаются, а где расходятся.",
          },
          {
            title: "Конкретные улучшения",
            description: "Какие изменения можно внести.",
          },
        ],
      },
      example: {
        heading: "Пример сравнения",
        disclaimer:
          "Иллюстративный пример — реальный результат зависит от обоих сценариев.",
        competitorLabel: "Сценарий конкурента",
        yourScriptLabel: "Ваш сценарий",
        competitorLines: [
          "Хук — начинается со смелого заявления.",
          "Завязка — быстро вводит в суть.",
          "Развитие — строится вокруг одной идеи.",
          "Развязка — даёт быстрый вывод.",
        ],
        yourScriptLines: [
          "Хук — начинается с вопроса.",
          "Завязка — раскрывается чуть дольше.",
          "Развитие — строится вокруг двух идей.",
          "Развязка — даёт более широкий вывод.",
        ],
        summaryHeading: "В этом примере",
        summaryItems: [
          "Более сильное начало",
          "Более ясное развитие",
          "Более быстрая развязка",
        ],
      },
    },
    analyzeResults: {
      backToAnalyze: "Назад к анализу",
      heroEyebrow: "Результаты анализа",
      pageTitle: "Разбор сценария конкурента",
      headingPrefix: "Разбор сценария",
      headingAccent: "конкурента",
      description: "Просмотрите отправленное видео, транскрипт и анализ сценария.",
      missingState: {
        heading: "Данные анализа не найдены",
        description:
          "Сначала отправьте видео конкурента на странице «Анализировать» — эта страница показывает результаты только для только что отправленного видео.",
        action: "Перейти к анализу конкурента",
      },
      summary: {
        realDataLabel: "Из отправленного вами видео",
        neutralTitle: "Видео конкурента на YouTube",
        embedTitle: "Плеер отправленного видео конкурента",
        openOnYouTube: "Открыть на YouTube",
        platformLabel: "Платформа",
        platform: "YouTube",
        sourceFormatLabel: "Формат",
        durationLabel: "Длительность транскрипта",
        unknownDuration: "Неизвестно",
        languageLabel: "Язык",
        unknownLanguage: "Неизвестно",
        segmentCountLabel: "Сегментов",
        analysisOverviewHeading: "Обзор анализа",
      },
      transcript: {
        heading: "Транскрипт",
        sectionEyebrow: "Транскрипт · Из отправленного вами видео",
        realDataLabel: "Реальный транскрипт",
        languageLabel: "Язык",
        unknownLanguage: "Неизвестно",
        durationLabel: "Длительность транскрипта",
        unknownDuration: "Неизвестно",
        segmentCountLabel: "Сегментов",
        generationLabel: "Источник",
        autoGeneratedLabel: "Автоматически сгенерирован",
        manualLabel: "Создан вручную",
        timestampedHeading: "Сегменты с таймкодами",
        fullTextHeading: "Полный транскрипт",
        showAllSegments: "Показать все сегменты",
        showFewerSegments: "Показать меньше",
        showFullTranscript: "Показать полный транскрипт",
        showLessTranscript: "Показать меньше",
      },
      scores: {
        heading: "Обзор оценок",
        sectionEyebrow: "Анализ сценария",
        scoreSuffix: "/100",
        overall: {
          label: "Общая",
          explanation: "Как сценарий работает в целом.",
        },
        hook: {
          label: "Хук",
          explanation: "Насколько сильно начало захватывает внимание.",
        },
        retention: {
          label: "Удержание",
          explanation: "Насколько хорошо сценарий сохраняет темп и импульс.",
        },
        structure: {
          label: "Структура",
          explanation: "Насколько чётко организован сценарий.",
        },
      },
      verdict: {
        strong: "Сильный",
        mixed: "Смешанный",
        weak: "Слабый",
      },
      whyScores: {
        heading: "Почему такие оценки",
      },
      takeaway: {
        heading: "Главный вывод",
        sectionEyebrow: "Главный вывод",
      },
      structure: {
        heading: "Структура сценария",
        sectionEyebrow: "Структура сценария",
        beatLabels: {
          hook: "Хук",
          setup: "Завязка",
          context: "Контекст",
          escalation: "Эскалация",
          reveal: "Раскрытие",
          payoff: "Развязка",
          cta: "Призыв к действию",
          digression: "Отступление",
          recap: "Резюме",
          other: "Другое",
        },
        showDetails: "Показать детали",
        hideDetails: "Скрыть детали",
        showFullStructure: "Показать всю структуру",
        hideFullStructure: "Скрыть полную структуру",
      },
      strengths: {
        heading: "Что работает",
        sectionEyebrow: "Что работает",
      },
      weaknesses: {
        heading: "Слабые места",
        sectionEyebrow: "Слабые места",
        emptyState: "Существенных слабых мест по транскрипту не выявлено.",
      },
      risks: {
        heading: "Риски удержания",
        sectionEyebrow: "Риски удержания",
        emptyState: "Заметных рисков удержания по транскрипту не выявлено.",
      },
      lessons: {
        heading: "Практические уроки",
        sectionEyebrow: "Практические уроки",
      },
      caution: {
        heading: "Чего не стоит копировать",
        sectionEyebrow: "Чего не стоит копировать",
        description:
          "Адаптируйте паттерн, а не формулировки — копирование точных фраз или заявлений может сработать против вас.",
        emptyState:
          "Особых предостережений не выявлено — всё равно адаптируйте паттерн, а не формулировки.",
      },
      severity: {
        minor: "Незначительная",
        moderate: "Умеренная",
        major: "Серьёзная",
      },
      analysisUnavailable: {
        transcriptTooLong: {
          heading: "Анализ недоступен",
          description: "Этот транскрипт сейчас слишком длинный для анализа.",
        },
        invalidResponse: {
          heading: "Анализ недоступен",
          description:
            "Не удалось сформировать надёжный анализ для этого сценария. Попробуйте проанализировать его ещё раз.",
        },
        unavailable: {
          heading: "Анализ недоступен",
          description:
            "Анализ сценария временно недоступен. Попробуйте снова через некоторое время.",
        },
        legacy: {
          heading: "Анализ недоступен",
          description:
            "Этот результат был сохранён до появления анализа сценария. Отправьте видео заново, чтобы получить полный анализ.",
        },
      },
      actions: {
        backToAnalyze: "Назад к анализу конкурента",
        analyzeAnother: "Проанализировать другого конкурента",
        compareWithMyScript: "Сравнить со своим сценарием",
        backToSelection: "Назад к Сценариям конкурентов",
      },
    },
  },
} satisfies Messages;

export const messagesByLocale = {
  en: enMessages,
  ru: ruMessages,
} satisfies Record<
  (typeof LAUNCHED_LOCALES)[number],
  Messages
>;

function isTranslatedLocale(
  locale: Locale
): locale is keyof typeof messagesByLocale {
  return LAUNCHED_LOCALES.some(
    (availableLocale) => availableLocale === locale
  );
}

export function getMessages(locale: Locale): Messages {
  if (isTranslatedLocale(locale)) {
    return messagesByLocale[locale];
  }

  return messagesByLocale.en;
}
