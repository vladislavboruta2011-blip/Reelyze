# Climpy Script Knowledge

This document stores product knowledge for Climpy's script analysis and future rewrite/compare features.

Important rule: do not invent new Climpy script rules from general assistant opinion. New knowledge should come from the user's uploaded materials, creator research, user feedback, real script examples, or direct product decisions.

This file is the source-of-truth notes document before changing prompts, validation, API routes, UI, or tests.

---

## 1. Product scope

Climpy is for YouTube Shorts script review.

Primary use case:
- A creator pastes a Shorts script.
- Climpy reviews whether it is likely to hold attention.
- Climpy identifies weak hooks, slow sections, missing payoff, risky parts, and suggested fixes.
- Future feature: Climpy can rewrite the script using only the material already present.
- Future feature: Climpy can compare the user's script with a competitor/viral script without copying the competitor.

Climpy should help creators improve before recording or publishing.

---

## 2. Knowledge ownership rule

Climpy's rules should be grounded in:
- user-provided files;
- user-provided screenshots;
- creator interviews/transcripts;
- user feedback from real testers;
- real examples of scripts and performance;
- explicit product decisions made by the user.

Climpy should not add new claims, benchmarks, or frameworks unless the user provides them or approves them.

---

## 3. Core Shorts principles

### 3.1 The first 1-2 seconds act like the thumbnail

In Shorts, the viewer does not click a thumbnail first. The first moment of the video becomes the functional thumbnail.

A strong opening should:
- immediately show or state the premise;
- make the viewer understand what the video is about;
- give a reason to keep watching before the viewer swipes;
- avoid slow setup.

Bad pattern:
- "Today we're going to talk about..."
- "In this video..."
- vague intro before the actual idea.

Good pattern:
- first line states the premise;
- first visual supports the premise;
- viewer instantly knows what question/story/comparison they are watching.

Product implication:
- Climpy should punish slow first lines.
- Climpy should reward openings that make the premise clear immediately.
- For visual Shorts, Climpy should care whether the hook is easy to visualize.

---

### 3.2 The hook should be visual, simple, and easy to understand

A strong Shorts hook should be:
- visual;
- concrete;
- simple;
- easy to say out loud;
- understandable without extra context;
- strong enough that it could almost work as a title/thumbnail idea.

The opening should not sound like a documentary introduction or a general essay thesis.

Product implication:
- Climpy should reward concrete objects, people, actions, numbers, contrast, stakes, and visible situations.
- Climpy should penalize abstract hooks, generic advice, vague claims, and slow framing.
- Improve Hook should compress the strongest concrete idea into one punchy opening.

---

### 3.3 Shorts hooks are usually 3-5 seconds

For vertical videos, the hook should usually deliver promise + intrigue quickly.

Product implication:
- Climpy should not treat a long intro as acceptable just because it eventually gets interesting.
- If the first strong moment appears too late, Climpy should mark that as a retention risk.

---

## 4. Expectation matching

The beginning of a video should confirm that the viewer is in the right place.

For long-form this means:
- title/thumbnail set expectations;
- first sentence and first shot confirm those expectations.

For Shorts this becomes:
- the first line and first visual must match the idea/promise of the Short;
- the viewer should not need to wait to understand the topic.

Product implication:
- When title is available, Climpy should check whether the script opens with the same promise.
- If title is unavailable, Climpy should infer the implied promise from the first concrete premise.
- If the hook creates one expectation but the body delivers something else, Climpy should flag mismatch.

---

## 5. First-section structure

A strong opening section should quickly provide:

1. Context
   - What is happening?
   - Who/what is involved?
   - What is the situation?

2. Stakes or payoff
   - Why does this matter?
   - What is surprising, risky, difficult, valuable, or strange?

3. Curiosity gap
   - What question remains unanswered?
   - What does the viewer need to stay to find out?

Product implication:
- Climpy should identify whether the script has context, stakes/payoff, and a curiosity gap.
- If the script only gives context without stakes, it may feel flat.
- If the script gives stakes without clarity, it may feel confusing.
- If the script answers everything too early, retention may drop.

---

## 6. Story, twist, and investment

A Short becomes stronger when the viewer is invested in a story, goal, conflict, or twist.

Strong investment can come from:
- personal reason;
- goal;
- irony;
- contradiction;
- challenge;
- unexpected result;
- clear before/after;
- visible transformation;
- unresolved outcome.

Product implication:
- Climpy should reward scripts where the viewer understands what is at stake.
- Climpy should reward irony or contradiction when it is supported by the script.
- Climpy should not invent a personal reason, story, or goal if it is not already present.

---

## 7. Questions and viewer psychology

A good script anticipates the questions a viewer has after seeing the idea/title/opening.

The script should answer the most important questions in a strong order.

Useful questions:
- What is this about?
- Why should I care?
- How is that possible?
- What happens next?
- What is the payoff?
- Why does this matter now?
- What is the twist?

Product implication:
- Climpy should check whether the script creates and answers viewer questions.
- If a script introduces a question but never pays it off, flag it.
- If a script answers the main question too early and gives no new reason to stay, flag retention risk.
- Future Compare Scripts should compare which script handles viewer questions better.

---

## 8. Loops and rehooks

Loops are open questions or unresolved promises that keep viewers watching.

A loop should:
- create curiosity;
- be connected to the main idea;
- be paid off later;
- not feel like artificial delay.

Rehooks are moments that refresh attention after the opening.

Product implication:
- Climpy should detect scripts that are just a list of facts with no loop.
- Climpy should reward scripts that create a reason to keep watching after the first answer.
- Climpy should warn when the script drags out a payoff without adding useful new information.

---

## 9. Payoff handling

The script must deliver the promised payoff.

However:
- do not pay off the only interesting question too early unless a new question is created;
- do not delay the payoff in a way that annoys the viewer;
- after a payoff, either end cleanly or open a relevant next curiosity.

Product implication:
- Climpy should check if the payoff matches the hook.
- Climpy should flag weak endings that continue after the main payoff with filler.
- Climpy should flag unsupported or missing payoff.

---

## 10. CTA rule

A bad CTA can signal that the video is over and cause drop-off.

For Shorts, often the cleanest ending is:
- deliver the payoff;
- end immediately;
- avoid unnecessary closing filler.

If a CTA exists, it should connect to the viewer's next natural question.

Product implication:
- Climpy should flag generic endings after the payoff.
- Climpy should not recommend adding a CTA by default.
- If the script already ends strongly, do not weaken it with filler.

---

## 11. Idea quality matters

A strong script cannot fully save an idea that viewers do not care about.

Good ideas often come from:
- already viral concepts;
- long-form videos that proved demand;
- strong visual topics;
- celebrities/figures people already care about;
- hidden stories from podcasts/interviews;
- unanswered questions;
- surprising comparisons.

Important: using a proven idea does not mean copying. It means identifying demand, then creating a new short version with original structure and visuals.

Product implication:
- Climpy should not only judge wording; it should also judge premise appeal when possible.
- Future Compare Scripts should compare idea strength and premise clarity.
- Future Improve Script should not invent a better idea if the script lacks one; it should say the script needs stronger source material.

---

## 12. Visual-first rule

If the topic has a natural visual, use it early.

Examples of visual-first logic:
- If the video is about how muscles grow, show/describe the muscle changing early.
- If the video is a comparison, make the comparison visible and immediate.
- If the video is about a surprising physical result, lead with the result or the moment before it.

Product implication:
- Climpy should reward hooks that can be easily shown on screen.
- Climpy should flag openings that explain before showing the interesting visual.
- Future Improve Script should move the strongest visual moment earlier when supported by the script.

---

## 13. Hook types Climpy can recognize

### 13.1 Shock hook

A shock hook breaks expectation with:
- unexpected action;
- bold claim;
- paradox;
- surprising fact;
- specific result.

It needs proof or support quickly.

Rules:
- tell the truth;
- choose the most unexpected true angle;
- use specific stakes when possible;
- avoid empty shock.

Bad:
- big claim with no support;
- slow buildup;
- shock without value.

---

### 13.2 Question hook

A question hook voices a question the target viewer already has or would naturally ask.

Good question hooks:
- are specific;
- feel relevant;
- create an answer gap;
- are not generic.

Bad:
- questions no one cares about;
- questions that are answered instantly with no further reason to stay.

---

### 13.3 Story hook

A story hook drops the viewer into:
- the most chaotic moment;
- the highest-stakes moment;
- a moment of weakness;
- a visible conflict.

It should make the viewer ask what happened or what happens next.

---

### 13.4 Statement hook

A statement hook makes a strong claim right away.

Rules:
- it can be bold;
- it must be backed by the script;
- it should not exaggerate beyond the evidence;
- it should create a clear reason to keep watching.

---

### 13.5 Contrast / contrarian hook

A contrast hook uses a reversal:
- "Most people think X, but Y."
- "You don't need X. You need Y."
- "This looks like X, but it is actually Y."

Rules:
- the contrast must be real;
- the second half must be more interesting than the first;
- avoid generic "most people think" unless it is truly the strongest angle.

---

## 14. Hook psychology formula

One useful hook pattern:

1. Context lean
   - Quickly signal the topic.
   - Make the right viewer lean in.

2. Scroll-stop interjection
   - Use a contrast or interruption.
   - Common tools: but, however, yet, although, the problem is.

3. Contrarian snapback
   - Reveal the deeper or more surprising frame.
   - Give the viewer a reason to continue.

Product implication:
- Climpy can use this as one possible framework, not the only valid structure.
- Do not force every script into this formula.
- Reward it when it naturally fits.

---

## 15. Improve Hook rules

Current Improve Hook behavior should preserve these principles:

- Use the strongest concrete anchor from the script.
- If the script contains an exact number with a unit, preserve it when it is the strongest anchor.
- If the final payoff is stronger than the opening, consider moving the payoff forward.
- The improved hook should be short, punchy, and easy to say.
- The first 5 words should be understandable without previous context.
- Do not start with vague pronouns unless the subject is named immediately.
- Do not return a rewrite that is basically the same as the original.
- Do not rewrite a strong hook unless the rewrite is clearly better.
- Do not invent unsupported stakes, facts, outcomes, or drama.
- If the script is too generic, ask for more concrete material instead of making things up.

---

## 16. Future Improve Script feature

Improve Script should be different from Improve Hook.

Improve Hook:
- rewrites only the first line/opening.

Improve Script:
- rewrites the full Shorts script while preserving the original facts and idea.

Improve Script should:
- keep the user's core idea;
- preserve real facts, numbers, people, claims, and payoff;
- move the strongest visual/concrete anchor earlier;
- cut filler;
- improve pacing;
- add clearer transitions only when supported;
- strengthen curiosity loops;
- improve payoff delivery;
- make the script easier to say out loud;
- avoid adding unsupported new facts.

Improve Script should return:
1. Improved script
2. What changed
3. Why it is stronger
4. Missing material, if the script is too broad

Improve Script should not:
- invent fake statistics;
- invent a stronger payoff;
- add claims the user did not provide;
- turn a weak idea into a fake viral concept;
- copy a competitor's script.

---

## 17. Future Compare Scripts feature

Compare Scripts should let the user paste:

- My script
- Competitor script / viral script

The goal is not to copy the competitor.

The goal is to show:
- why the competitor script may feel stronger;
- what structural advantages it has;
- what the user's script is missing;
- how to improve the user's script while keeping it original.

Compare dimensions:
1. Premise clarity
2. First 1-2 seconds
3. Hook strength
4. Visual clarity
5. Stakes/payoff
6. Curiosity gap
7. Question order
8. Loops/rehooks
9. Pacing
10. Payoff delivery
11. Ending/CTA
12. Concrete anchors
13. Copy risk

Output should include:
- winner by category;
- specific weaknesses in user's script;
- transferable patterns from competitor;
- improved version of user's script;
- warning if competitor's advantage depends on facts/material missing from user's script.

Compare Scripts must not:
- copy competitor wording;
- copy unique story details;
- invent facts for the user's script;
- encourage plagiarism.

---

## 18. Analysis V2 integration notes

Before changing code, compare this document with current files:

- engine/analysis-v2-prompt.ts
- engine/analysis-v2-validation.ts
- engine/improve-hook.ts
- app/api/improve/route.ts
- app/results/page.tsx

Likely safe future additions:
- clearer first-1-second premise check;
- stronger visual-first rule;
- stronger payoff-aftercare rule;
- compare script framework;
- full script rewrite prompt;
- tests for no-invention rewrite.

Do not modify scoring/analysis logic without tests.

---

## 19. Test ideas for future implementation

Add tests for:

1. Slow generic intro
   - "Today I'm going to talk about..."
   - Expected: low hook score, rewrite/refine needed.

2. Strong visual premise
   - First line shows clear comparison/action/result.
   - Expected: strong hook.

3. Exact number anchor
   - Script contains a specific number with a unit.
   - Expected: improved hook preserves the number if it is central.

4. Payoff too early
   - Main question answered immediately, rest is filler.
   - Expected: retention risk.

5. Missing payoff
   - Hook promises a reveal but never delivers.
   - Expected: risky part + suggested fix.

6. Unsupported rewrite risk
   - Script is abstract and lacks concrete material.
   - Expected: diagnostic, not invented rewrite.

7. Competitor comparison
   - Competitor has better hook and loop.
   - Expected: explain pattern without copying.

8. CTA after payoff
   - Script ends with generic subscribe after payoff.
   - Expected: suggest clean ending or relevant next-question CTA.

---

## 20. Current product decision

Near-term priority:
1. Keep current Improve Hook honest in UI.
2. Build knowledge doc first.
3. Then design Improve Script.
4. Then design Compare Scripts.

Do not build Compare Scripts before Improve Script unless user feedback shows competitor comparison is more urgent.
