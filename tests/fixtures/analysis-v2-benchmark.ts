import type {
  AnalysisV2HookDecision,
  AnalysisV2ScriptType,
  AnalysisV2Verdict,
} from "../../engine/analysis-v2-schema";

export type AnalysisV2ScoreRange = {
  min?: number;
  max?: number;
};

export type AnalysisV2BenchmarkExpectation = {
  scriptTypes: AnalysisV2ScriptType[];
  verdicts: AnalysisV2Verdict[];
  overall?: AnalysisV2ScoreRange;
  hook?: AnalysisV2ScoreRange;
  retentionRisk?: AnalysisV2ScoreRange;
  hookDecisions?: AnalysisV2HookDecision[];
  maxRiskyParts?: number;
  minRiskyParts?: number;
  minSuggestedFixes?: number;
  maxSuggestedFixes?: number;
  forbiddenFeedback?: string[];
  forbiddenHookFeedback?: string[];
};

export type AnalysisV2BenchmarkCase = {
  id: string;
  category:
    | "positive"
    | "negative"
    | "adversarial";
  title: string;
  script: string;
  expected: AnalysisV2BenchmarkExpectation;
};

export const ANALYSIS_V2_BENCHMARK_CASES:
  AnalysisV2BenchmarkCase[] = [
  {
    id: "positive-eyelid-explanation",
    category: "positive",
    title: "Why some people have an eyelid fold",
    script:
      "Some people are born with an extra fold of skin over the inner corner of their eye. It is called the epicanthic fold. It forms because of how skin and tissue develop around the eyelid before birth. The fold changes the visible shape of the eye. It is a normal structural trait, not a flaw.",
    expected: {
      scriptTypes: ["explanation"],
      verdicts: ["strong", "mixed"],
      overall: { min: 55 },
      hook: { min: 55 },
      retentionRisk: { max: 50 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
      forbiddenFeedback: [
        "cultural perceptions",
        "genetic distribution",
        "impact on appearance",
        "cultural, genetic, or evolutionary context",
        "needs more mystery",
        "no reason to keep watching",
      ],
    },
  },
  {
    id: "positive-diet-soda-warning",
    category: "positive",
    title: "Diet soda health warning",
    script:
      "Drinking several cans of diet soda every day has been linked in some studies to a higher risk of metabolic problems. Artificial sweeteners may affect how the body responds to sweetness even when the drink contains no sugar. Researchers are still studying the mechanism. Cutting back or replacing some cans with water is the safer practical takeaway.",
    expected: {
      scriptTypes: ["warning", "advertorial"],
      verdicts: ["strong", "mixed"],
      overall: { min: 55 },
      hook: { min: 58 },
      retentionRisk: { max: 52 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
      forbiddenFeedback: [
        "introduces uncertainty without providing a clear explanation",
        "advice is vague and lacks a strong call to action",
        "needs a mystery",
        "answer is revealed too early",
        "no curiosity gap",
      ],
    },
  },
  {
    id: "positive-stabbing-how-to",
    category: "positive",
    title: "What to do if someone is stabbed",
    script:
      "If someone is stabbed, do not remove the object because that can increase the bleeding. First, call emergency services. Second, apply firm pressure around the wound without pressing directly on the object. Third, keep the person still and monitor their breathing until help arrives. Following these steps can reduce further harm before paramedics take over.",
    expected: {
      scriptTypes: ["how_to"],
      verdicts: ["strong", "mixed"],
      overall: { min: 55 },
      hook: { min: 58 },
      retentionRisk: { max: 52 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
      forbiddenFeedback: [
        "needs more mystery",
        "no open loop",
        "weak payoff",
      ],
    },
  },
  {
    id: "positive-hypnic-jerk-explanation",
    category: "positive",
    title: "Why your body jolts while falling asleep",
    script:
      "That sudden jolt you feel while falling asleep is called a hypnic jerk. It happens when your brain briefly misreads your muscles relaxing as a sign that you are falling. The brain responds by firing a reflex that tightens the muscles. This is why the movement feels sudden even though you are already drifting into sleep.",
    expected: {
      scriptTypes: ["explanation"],
      verdicts: ["strong", "mixed"],
      overall: { min: 55 },
      hook: { min: 55 },
      retentionRisk: { max: 50 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
      forbiddenFeedback: [
        "no reason to keep watching",
        "weak payoff",
        "needs a twist",
      ],
    },
  },
  {
    id: "positive-president-chronology",
    category: "positive",
    title: "The 1981 presidential shooting",
    script:
      "In 1981, a gunman opened fire outside a hotel in Washington. The first shot missed. Another struck a press secretary. A police officer and a Secret Service agent were also hit. One bullet ricocheted off the presidential car and entered the president's chest, missing his heart by inches. Every person who was wounded survived.",
    expected: {
      scriptTypes: ["narrative_event"],
      verdicts: ["strong", "mixed"],
      overall: { min: 58 },
      hook: { min: 60 },
      retentionRisk: { max: 48 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
      forbiddenFeedback: [
        "changes in security measures",
        "no narrative arc",
        "weak payoff",
        "needs a mystery",
      ],
    },
  },
  {
    id: "positive-super-glue-how-to",
    category: "positive",
    title: "How to remove super glue from skin",
    script:
      "If super glue gets stuck to your skin, do not pull it apart because you can tear the skin. First, soak the area in warm soapy water. Second, gently roll or peel the skin apart instead of pulling straight. If it is still stuck, use a small amount of acetone-based remover. Moisturize the area afterward. The skin should separate without force.",
    expected: {
      scriptTypes: ["how_to"],
      verdicts: ["strong", "mixed"],
      overall: { min: 58 },
      hook: { min: 60 },
      retentionRisk: { max: 48 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
      forbiddenFeedback: [
        "needs a curiosity gap",
        "weak payoff",
        "no reason to keep watching",
      ],
    },
  },
  {
    id: "positive-list-escalation",
    category: "positive",
    title: "The luckiest man alive",
    script:
      "A man survived a train derailment. Later, he was thrown from a plane and landed in a haystack. He survived a bus crash, two car explosions, and a car rolling off a cliff. After surviving all of those disasters, he bought a lottery ticket and won. The final event turned an already unbelievable life into a complete reversal.",
    expected: {
      scriptTypes: [
        "list_escalation",
        "narrative_event",
      ],
      verdicts: ["strong", "mixed"],
      overall: { min: 58 },
      hook: { min: 55 },
      retentionRisk: { max: 48 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
      forbiddenFeedback: [
        "no narrative turn",
        "weak payoff",
        "needs an explicit contrast",
      ],
    },
  },
  {
    id: "positive-mystery",
    category: "positive",
    title: "The abandoned cargo ship",
    script:
      "A cargo ship was found drifting with no one on board. The engine was still running. Food remained on the table. The lifeboats were untouched, and there were no signs of a struggle. Investigators searched the surrounding area but found no trace of the crew. What happened to them remains unexplained.",
    expected: {
      scriptTypes: ["mystery"],
      verdicts: ["strong", "mixed"],
      overall: { min: 62 },
      hook: { min: 62 },
      retentionRisk: { max: 45 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
    },
  },
  {
    id: "positive-comparison",
    category: "positive",
    title: "Which laptop lasts longest",
    script:
      "We tested four budget laptops side by side. The first lasted four hours. The second lasted six. The third reached eight. The final laptop lasted thirteen hours on one charge and also recorded the fastest benchmark score. That made it the clear winner.",
    expected: {
      scriptTypes: ["comparison"],
      verdicts: ["strong", "mixed"],
      overall: { min: 58 },
      hook: { min: 55 },
      retentionRisk: { max: 48 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
      forbiddenFeedback: [
        "needs emotional stakes",
        "needs a narrative twist",
        "weak payoff",
      ],
    },
  },
  {
    id: "positive-transformation",
    category: "positive",
    title: "From one minute to a marathon",
    script:
      "Three years ago, she could not run for one minute without stopping. She began by walking before work, then added short jogs and eventually completed a 5K. Last month, she finished her first marathon in under four hours. The final result shows the full scale of the transformation.",
    expected: {
      scriptTypes: ["narrative_event"],
      verdicts: ["strong", "mixed"],
      overall: { min: 58 },
      hook: { min: 55 },
      retentionRisk: { max: 48 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
    },
  },
  {
    id: "negative-generic-motivation",
    category: "negative",
    title: "Success motivation",
    script:
      "Success is possible for anyone who works hard. You need to stay focused and never give up. Motivation is important. Keep going and you will eventually succeed.",
    expected: {
      scriptTypes: [
        "generic_advice",
        "other",
      ],
      verdicts: ["weak"],
      overall: { max: 45 },
      hook: { max: 50 },
      retentionRisk: { min: 55 },
      hookDecisions: ["diagnostic", "rewrite"],
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
    },
  },
  {
    id: "negative-topic-announcement",
    category: "negative",
    title: "Productivity",
    script:
      "Today I want to talk about productivity. Productivity is important in everyday life. In this video I will explain why it matters and how you can improve it.",
    expected: {
      scriptTypes: [
        "explanation",
        "generic_advice",
        "other",
      ],
      verdicts: ["weak", "mixed"],
      overall: { max: 50 },
      hook: { max: 50 },
      retentionRisk: { min: 50 },
      hookDecisions: [
        "diagnostic",
        "rewrite",
      ],
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
    },
  },
  {
    id: "negative-incomplete-explanation",
    category: "negative",
    title: "Why the sky is blue",
    script:
      "There is a reason the sky looks blue. It has something to do with sunlight and the atmosphere. The explanation becomes interesting when you think about it.",
    expected: {
      scriptTypes: ["explanation"],
      verdicts: ["weak", "mixed"],
      overall: { max: 55 },
      retentionRisk: { min: 50 },
      hookDecisions: [
        "diagnostic",
        "rewrite",
        "refine",
      ],
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
    },
  },
  {
    id: "negative-dramatic-flat-script",
    category: "negative",
    title: "The secret that changes everything",
    script:
      "This one secret could change your entire life forever. Things are important. People make choices. Some choices are good and some are bad. That is basically everything you need to know.",
    expected: {
      scriptTypes: [
        "generic_advice",
        "other",
      ],
      verdicts: ["weak"],
      overall: { max: 45 },
      retentionRisk: { min: 58 },
      hookDecisions: [
        "diagnostic",
        "rewrite",
      ],
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
    },
  },
  {
    id: "negative-no-concrete-anchor",
    category: "negative",
    title: "Life choices",
    script:
      "Life is full of choices. Some choices are good, and some choices are bad. It is up to you to decide which path to take.",
    expected: {
      scriptTypes: [
        "generic_advice",
        "other",
      ],
      verdicts: ["weak"],
      overall: { max: 45 },
      retentionRisk: { min: 55 },
      hookDecisions: ["diagnostic"],
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
    },
  },
  {
    id: "negative-specific-steps-overpromise",
    category: "negative",
    title: "Morning routine",
    script:
      "This morning routine will change your life. Wake up early, drink water, exercise, read, and stay consistent. If you do this every day, success becomes inevitable.",
    expected: {
      scriptTypes: [
        "how_to",
        "generic_advice",
      ],
      verdicts: ["weak", "mixed"],
      overall: { max: 58 },
      hook: { max: 62 },
      retentionRisk: { min: 45 },
      hookDecisions: [
        "diagnostic",
        "rewrite",
        "refine",
      ],
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
      forbiddenFeedback: [
        "hook is clear and specific",
        "hook is strong",
      ],
    },
  },
  {
    id: "negative-habit-guarantees-success",
    category: "negative",
    title: "Success habit",
    script:
      "This one habit guarantees success. Do it every morning before checking your phone. Write down your goal, read it out loud, and take one small action. If you stay consistent, you cannot fail.",
    expected: {
      scriptTypes: [
        "how_to",
        "generic_advice",
      ],
      verdicts: ["weak", "mixed"],
      overall: { max: 65 },
      hook: { max: 70 },
      retentionRisk: { min: 40 },
      hookDecisions: [
        "diagnostic",
        "rewrite",
        "refine",
      ],
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
      forbiddenFeedback: [
        "hook is clear and specific",
        "hook is strong",
      ],
    },
  },
  {
    id: "negative-book-millionaire-overpromise",
    category: "negative",
    title: "Millionaire book",
    script:
      "This book will make you a millionaire. It teaches discipline, focus, money habits, and how to think bigger. Read ten pages every day and your financial life will completely change.",
    expected: {
      scriptTypes: [
        "how_to",
        "generic_advice",
        "advertorial",
      ],
      verdicts: ["weak", "mixed"],
      overall: { max: 60 },
      hook: { max: 62 },
      retentionRisk: { min: 45 },
      hookDecisions: [
        "diagnostic",
        "rewrite",
        "refine",
      ],
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
      forbiddenFeedback: [
        "hook is clear and specific",
        "hook is strong",
      ],
    },
  },
  {
    id: "negative-unrevealed-specific-promise",
    category: "negative",
    title: "Hidden phone setting not revealed",
    script:
      "Your phone battery dies faster because of one hidden setting. Most people never turn it off. It runs quietly in the background. Once you understand it, your phone usage makes more sense.",
    expected: {
      scriptTypes: ["explanation"],
      verdicts: ["weak", "mixed"],
      overall: { max: 65 },
      hook: { max: 80 },
      retentionRisk: { min: 40 },
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
      forbiddenHookFeedback: [
        "strong hook",
        "hook is clear and specific",
      ],
    },
  },
  {
    id: "negative-polished-tautological-feedback",
    category: "negative",
    title: "The three-step feedback loop",
    script:
      "Top performers use a three-step feedback loop: review, reflect, and refine. Reviewing shows you what happened. Reflecting helps you understand it. Refining helps you improve the next attempt. Repeat this loop consistently, and your results will continue getting better.",
    expected: {
      scriptTypes: [
        "generic_advice",
        "explanation",
        "how_to",
      ],
      verdicts: ["weak", "mixed"],
      overall: { max: 70 },
      retentionRisk: { min: 35 },
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
      forbiddenFeedback: [
        "structurally strong",
      ],
    },
  },
  {
    id: "negative-polished-focus-framework",
    category: "negative",
    title: "The FOCUS productivity method",
    script:
      "The FOCUS method can help you get more done. Find your priority, organize your time, cut distractions, use your energy wisely, and stay consistent. Each step keeps you focused and makes productivity easier. Follow the method every day to improve your results.",
    expected: {
      scriptTypes: [
        "generic_advice",
        "how_to",
        "explanation",
      ],
      verdicts: ["weak", "mixed"],
      overall: { max: 70 },
      retentionRisk: { min: 35 },
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
      forbiddenFeedback: [
        "structurally strong",
      ],
    },
  },
  {
    id: "negative-polished-wealth-habits",
    category: "negative",
    title: "Habits that build wealth",
    script:
      "Building wealth is less about one big decision and more about consistent habits. Track your spending, save a fixed amount, avoid unnecessary debt, and invest regularly. Each habit seems small on its own, but together they create a stronger financial foundation over time.",
    expected: {
      scriptTypes: [
        "generic_advice",
        "how_to",
        "explanation",
      ],
      verdicts: ["weak", "mixed"],
      overall: { max: 72 },
      retentionRisk: { min: 35 },
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
      forbiddenFeedback: [
        "structurally strong",
      ],
    },
  },
  {
    id: "negative-concrete-but-predictable-productivity",
    category: "negative",
    title: "Three simple productivity habits",
    script:
      "To be more productive, put your phone away, write down your most important task, and work on it for 25 minutes without stopping. These three habits reduce distractions and help you get more done. Repeat them every day to improve your focus.",
    expected: {
      scriptTypes: [
        "generic_advice",
        "how_to",
      ],
      verdicts: ["weak", "mixed"],
      overall: { max: 74 },
      retentionRisk: { min: 32 },
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
      forbiddenFeedback: [
        "structurally strong",
        "fresh angle",
        "original angle",
      ],
    },
  },
  {
    id: "negative-unfulfilled-originality-promise",
    category: "negative",
    title: "Three overlooked productivity habits",
    script:
      "These are three overlooked productivity habits that almost nobody talks about. Put your phone in another room because notifications pull your attention away. Write down one priority because a long task list splits your focus. Then work for 25 minutes because a short timer makes starting feel easier.",
    expected: {
      scriptTypes: [
        "how_to",
        "generic_advice",
      ],
      verdicts: ["weak", "mixed"],
      overall: { max: 75 },
      retentionRisk: { min: 32 },
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
      forbiddenFeedback: [
        "structurally strong",
        "fresh angle",
        "original insight",
        "unique habits",
      ],
    },
  },
  {
    id: "positive-familiar-topic-fresh-mechanism",
    category: "positive",
    title: "Why moving money first makes saving easier",
    script:
      "Saving often fails because money left in your main account still looks available to spend. Moving a fixed amount into a separate account on payday removes that visual permission before you make daily choices. The habit works by changing what your brain sees as spendable, not by relying on willpower later.",
    expected: {
      scriptTypes: [
        "explanation",
        "how_to",
        "generic_advice",
      ],
      verdicts: ["strong", "mixed"],
      overall: { min: 60 },
      hook: { min: 55 },
      retentionRisk: { max: 48 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
      forbiddenFeedback: [
        "too common",
        "unoriginal because saving is a common topic",
        "needs a completely new topic",
      ],
    },
  },
  {
    id: "positive-familiar-how-to-practical-value",
    category: "positive",
    title: "How to stop checking your phone while working",
    script:
      "If you keep checking your phone while working, place it in another room before you begin. Turning it face down is often not enough because the phone is still within reach. Adding physical distance creates a pause between the urge and the action, which makes the distraction easier to resist.",
    expected: {
      scriptTypes: [
        "how_to",
        "explanation",
      ],
      verdicts: ["strong", "mixed"],
      overall: { min: 60 },
      hook: { min: 55 },
      retentionRisk: { max: 48 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
      forbiddenFeedback: [
        "too common",
        "unoriginal topic",
        "needs more novelty",
      ],
    },
  },
  {
    id: "negative-polished-low-appeal-himalayas",
    category: "negative",
    title: "The Himalayas are still growing",
    script:
      "The Himalayas are growing every year. The Indian tectonic plate is still pushing into the Eurasian plate, raising parts of the mountain range by a few millimeters annually. Erosion removes some of that growth, so the final change is small.",
    expected: {
      scriptTypes: ["explanation"],
      verdicts: ["weak", "mixed"],
      overall: { max: 79 },
      minRiskyParts: 1,
      maxRiskyParts: 2,
      minSuggestedFixes: 1,
      maxSuggestedFixes: 2,
      forbiddenFeedback: [
        "such as its impact",
        "impact on geography",
        "climate",
        "seismic activity",
        "strong and clear premise",
        "clear and interesting premise",
        "good initial viewer appeal",
        "which is engaging",
        "expand on how erosion",
        "affects the environment",
        "local populations",
        "without material Shorts performance problems",
      ],
    },
  },
  {
    id: "positive-himalayas-stronger-angle",
    category: "positive",
    title: "Why Everest does not grow steadily",
    script:
      "Mount Everest is still growing, but an earthquake can change its height faster than centuries of tectonic movement. The plates below the Himalayas raise the mountain only a few millimeters each year, while a major earthquake can shift the crust almost instantly. So the mountain's height is not a steady climb.",
    expected: {
      scriptTypes: ["explanation"],
      verdicts: ["strong", "mixed"],
      overall: { min: 60 },
      hook: { min: 55 },
      retentionRisk: { max: 50 },
      hookDecisions: ["keep", "refine"],
      maxRiskyParts: 1,
      maxSuggestedFixes: 1,
      forbiddenFeedback: [
        "topic is too niche",
        "educational topic is weak",
      ],
    },
  },
  {
    id: "adversarial-lowercase-how-to",
    category: "adversarial",
    title: "fish hook removal",
    script:
      "if a fish hook gets stuck in your finger do not pull it backward first cut the barb then push the smooth end through the skin and remove it from the other side this reduces additional tearing",
    expected: {
      scriptTypes: ["how_to"],
      verdicts: ["strong", "mixed"],
      overall: { min: 52 },
      maxRiskyParts: 2,
      maxSuggestedFixes: 2,
    },
  },
  {
    id: "adversarial-no-punctuation-explanation",
    category: "adversarial",
    title: "why hands shake",
    script:
      "your hands can shake after a stressful moment because the body releases adrenaline the hormone raises heart rate and prepares the muscles for action once the adrenaline level falls the shaking usually stops",
    expected: {
      scriptTypes: ["explanation"],
      verdicts: ["strong", "mixed"],
      overall: { min: 52 },
      maxRiskyParts: 2,
      maxSuggestedFixes: 2,
    },
  },
  {
    id: "adversarial-auto-caption",
    category: "adversarial",
    title: "adrenaline response",
    script:
      "so basically [music] your body releases adrenaline when it senses danger and that is why your hands shake [music] the response normally fades after the danger has passed",
    expected: {
      scriptTypes: ["explanation"],
      verdicts: ["strong", "mixed"],
      overall: { min: 50 },
      maxRiskyParts: 2,
      maxSuggestedFixes: 2,
    },
  },
];
