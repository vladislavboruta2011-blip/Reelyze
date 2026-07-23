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
      scriptOverLimit: (count: number) =>
        `Your script is ${count} ${
          count === 1 ? "character" : "characters"
        } over the current limit. Shorten it to enable Analyze Script.`,
      analyzing: "Analyzing...",
      analyzeScript: "Analyze Script",
      privacy:
        "Your script is only used to generate this analysis.",
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
      scriptOverLimit: (count: number) =>
        `Ваш сценарий превышает текущий лимит на ${count} ${formatRussianCharacterCount(
          count
        )}. Сократите его, чтобы включить кнопку «Анализировать сценарий».`,
      analyzing: "Анализируем...",
      analyzeScript: "Анализировать сценарий",
      privacy:
        "Сценарий используется только для создания этого анализа.",
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
