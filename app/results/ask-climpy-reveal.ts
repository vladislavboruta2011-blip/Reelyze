// Pure, framework-free reveal-timing logic for Ask Climpy's assistant-answer
// animation — deliberately has no React/DOM dependency so it can be unit
// tested directly and reused by the actual ticking effect in
// ask-climpy-panel.tsx. This module never mutates or stores the message
// itself; it only computes how to progressively DISPLAY text that already
// lives, complete and unaltered, in app/results/page.tsx's askClimpyMessages
// state.

export const ASK_CLIMPY_REVEAL_MIN_DURATION_MS = 450;
export const ASK_CLIMPY_REVEAL_MAX_DURATION_MS = 1200;

// A local, client-synthesized reply (a bounded conversational intent reply,
// or the post-error technical explanation — see
// app/results/ask-climpy-local-intents.ts) never made a model round trip, so
// it uses a deliberately shorter, snappier window than a real model answer
// — it should read as "Climpy replying quickly", not as a static, instantly-
// dumped block of text, while still being visually distinct from the slower
// model-answer pacing.
export const ASK_CLIMPY_LOCAL_REVEAL_MIN_DURATION_MS = 300;
export const ASK_CLIMPY_LOCAL_REVEAL_MAX_DURATION_MS = 650;

// ~6ms per character gives a brisk, readable reveal for typical short
// answers while the min/max clamp keeps both very short and very long
// answers within the approved window for the given speed.
const ASK_CLIMPY_REVEAL_MS_PER_CHARACTER = 6;

// Distinguishes the two approved timing windows — never inferred from
// message text/content, always passed explicitly by the caller based on the
// message's own role ("assistant" -> "model", "local" -> "local"; see
// ask-climpy-panel.tsx).
export type AskClimpyRevealSpeed = "model" | "local";

export function calculateAskClimpyRevealDurationMs(
  totalCharacters: number,
  speed: AskClimpyRevealSpeed = "model"
): number {
  const estimated = Math.max(0, totalCharacters) * ASK_CLIMPY_REVEAL_MS_PER_CHARACTER;

  const [minDurationMs, maxDurationMs] =
    speed === "local"
      ? [ASK_CLIMPY_LOCAL_REVEAL_MIN_DURATION_MS, ASK_CLIMPY_LOCAL_REVEAL_MAX_DURATION_MS]
      : [ASK_CLIMPY_REVEAL_MIN_DURATION_MS, ASK_CLIMPY_REVEAL_MAX_DURATION_MS];

  return Math.min(maxDurationMs, Math.max(minDurationMs, estimated));
}

export type AskClimpyRevealSourceMessage = {
  answer: string;
  action?: string;
  example?: string;
};

export type AskClimpyRevealPlan = {
  answerWords: string[];
  actionWords: string[];
  exampleWords: string[];
  totalWords: number;
  durationMs: number;
};

function splitIntoWords(text: string): string[] {
  const trimmed = text.trim();
  return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
}

// answer -> action -> example is a fixed order: action only ever starts
// after every answer word has revealed, and example only ever starts after
// every action word has revealed (or immediately after answer when action
// is absent) — see sliceAskClimpyRevealPlan below, which is what actually
// enforces this ordering during ticking. A local reply only ever populates
// `answer` (its single content string) — action/example stay empty, so it
// naturally reveals as one continuous block of words.
export function buildAskClimpyRevealPlan(
  message: AskClimpyRevealSourceMessage,
  speed: AskClimpyRevealSpeed = "model"
): AskClimpyRevealPlan {
  const answerWords = splitIntoWords(message.answer);
  const actionWords = message.action ? splitIntoWords(message.action) : [];
  const exampleWords = message.example ? splitIntoWords(message.example) : [];

  const totalCharacters =
    message.answer.length +
    (message.action?.length ?? 0) +
    (message.example?.length ?? 0);

  return {
    answerWords,
    actionWords,
    exampleWords,
    totalWords: answerWords.length + actionWords.length + exampleWords.length,
    durationMs: calculateAskClimpyRevealDurationMs(totalCharacters, speed),
  };
}

export type AskClimpyRevealSlice = {
  answer: string;
  action: string;
  example: string;
};

// Given how many words have been "revealed" so far (a single monotonically
// increasing counter spanning all three fields), returns the partial text
// for each field. Fully deterministic and side-effect-free — the ticking
// timer in ask-climpy-panel.tsx only ever advances this counter.
export function sliceAskClimpyRevealPlan(
  plan: AskClimpyRevealPlan,
  revealedWordCount: number
): AskClimpyRevealSlice {
  const clamped = Math.max(0, Math.min(revealedWordCount, plan.totalWords));

  const answerCount = Math.min(clamped, plan.answerWords.length);
  const remainingAfterAnswer = Math.max(0, clamped - plan.answerWords.length);

  const actionCount = Math.min(remainingAfterAnswer, plan.actionWords.length);
  const remainingAfterAction = Math.max(
    0,
    remainingAfterAnswer - plan.actionWords.length
  );

  const exampleCount = Math.min(remainingAfterAction, plan.exampleWords.length);

  return {
    answer: plan.answerWords.slice(0, answerCount).join(" "),
    action: plan.actionWords.slice(0, actionCount).join(" "),
    example: plan.exampleWords.slice(0, exampleCount).join(" "),
  };
}
