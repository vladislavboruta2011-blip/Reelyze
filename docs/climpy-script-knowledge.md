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
- Improve Script should not invent a better idea if the script lacks one; it should say the script needs stronger source material.

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
- Improve Script should move the strongest visual moment earlier when supported by the script.

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

## 15. Improve Hook editorial decision framework

Improve Hook should act as an opening editor, not as a hook-template generator or paraphrasing tool.

Its goal is not to make the opening look different. Its goal is to produce the strongest honest opening supported by the video title and original script, or to preserve the original when no meaningful improvement is available.

These rules are universal. They must not depend on a specific topic, niche, creator, person, story type, or hook template.

### 15.1 Scope

Improve Hook edits only the first spoken line or opening beat.

It may use:

- the video title or topic;
- the complete original script;
- supported facts, comparisons, causes, consequences, questions, and payoff material from the script.

It should not:

- rewrite the body of the script;
- repair a weak body by making the opening overpromise;
- invent a visual, sound, edit, reaction, proof, or scene that was not provided;
- claim that a hook creates a stronger visual merely because the wording sounds more dramatic.

Climpy can evaluate whether supported wording creates a concrete mental image. It cannot assume what will actually appear on screen unless that information is present in the title or script.

### 15.2 Core decision principle

Before rewriting, Improve Hook should determine:

1. What promise or expectation the title creates.
2. What the current opening tells the viewer.
3. What subject, situation, or outcome the viewer should understand immediately.
4. What main question or expectation should remain open after the hook.
5. What payoff or destination the complete script can honestly deliver.
6. What single problem most limits the current opening.
7. Whether that problem can be meaningfully solved using only supported material.
8. Whether a candidate creates real editorial value or only different wording.

Improve Hook should solve the most important limiting problem instead of applying the same formula to every opening.

### 15.3 Possible primary problems

The main limiting problem may be:

- delayed topic introduction;
- weak title confirmation;
- unclear subject;
- vague or overly broad framing;
- an unresolved pronoun or reference;
- no clear reason to continue;
- multiple competing curiosity paths;
- curiosity that is unrelated to the actual payoff;
- a complete answer revealed before the viewer has a reason to continue;
- unsupported stakes, certainty, drama, or escalation;
- generic hype instead of concrete value;
- awkward or difficult spoken wording;
- dependence on visual context that Climpy has not been given;
- already-strong execution.

This list describes universal editorial diagnoses. It is not a set of mandatory hook templates.

Improve Hook should not assume that every opening needs:

- a question;
- a contradiction;
- a number;
- a pattern interrupt;
- a threat;
- a twist;
- a payoff-first structure;
- shorter wording;
- different wording.

### 15.4 Available actions and current response contract

Improve Hook should choose the action that is most honest and useful.

#### A. Preserve the existing hook

Preserve the original opening when:

- it already confirms the topic clearly;
- it creates an appropriate reason to continue;
- it points toward the script's supported payoff;
- a generated alternative is only cosmetic or equally effective;
- the proposed change would weaken clarity, voice, accuracy, or curiosity;
- no candidate creates enough editorial value to justify replacement.

Under the current API contract, preservation is represented by:

- `status: "good"`;
- the exact trimmed original opening in `improvedHook`;
- a specific reason explaining why the original already works.

The current implementation may also return `mode: "rewrite"` for compatibility. That value must not be interpreted as evidence that the original was rewritten.

Improve Hook should not replace a strong opening merely to make the output look new.

#### B. Meaningful rewrite

Return a rewritten hook when:

- the source material is sufficient;
- the script contains a usable promise and payoff;
- the primary weakness is in the opening's execution;
- the weakness can be solved without inventing or strengthening information;
- the candidate creates a materially better first viewer experience.

Under the current API contract, a successful rewrite is represented by:

- `status: "improved"`;
- `mode: "rewrite"`;
- one best rewritten opening;
- a reason tied to the actual editorial change.

A meaningful rewrite may:

- remove delay before the topic;
- name an unclear subject;
- replace vague suspense with specific supported curiosity;
- bring forward a supported consequence, comparison, mechanism, or question;
- clarify what the viewer is waiting to learn;
- align the opening more closely with the title;
- preserve strong original wording that already works.

None of these changes is mandatory by itself.

#### C. Diagnostic

Return a diagnostic instead of a rewrite when:

- the title and script do not contain enough concrete or useful material;
- the body does not contain a payoff capable of supporting the promised curiosity;
- a stronger opening would require a new fact, result, example, consequence, or visual;
- the video's core idea is too broad or predictable to support a meaningful hook;
- the source is too incomplete to identify one honest viewer question;
- meaningful improvement would require changing a supported claim.

Under the current API contract, a diagnostic is represented by:

- `status: "improved"`;
- `mode: "diagnostic"`;
- diagnostic guidance in the existing response fields;
- a reason identifying the missing material.

The diagnostic should explain what is missing instead of giving generic advice such as:

- make it more engaging;
- create more curiosity;
- add stronger words;
- make the hook viral;
- use a pattern interrupt.

#### D. Error

Use `status: "error"` only for request, provider, parsing, or other execution failures.

An editorial diagnostic is not an error.

### 15.5 Definition of a successful hook rewrite

A successful hook rewrite should:

- preserve the video's core idea;
- preserve all supported facts and claims;
- solve the opening's main editorial problem;
- confirm the title or topic quickly;
- make the subject and situation understandable;
- create one clear, relevant reason to continue;
- point toward a payoff the script can actually deliver;
- remain concise, natural, understandable, and easy to say aloud;
- preserve the creator's voice when it already works;
- provide a reason tied to an observable change.

A rewrite is not successful merely because:

- different words were used;
- fewer words were used;
- more dramatic words were used;
- a statement became a question;
- a question became a statement;
- a number was moved into the first line;
- a contrast word was added;
- the output received a higher model-generated score;
- the model claims that clarity, curiosity, or pacing improved.

### 15.6 Title alignment and click confirmation

The title creates the viewer's initial expectation.

The hook should quickly confirm that the viewer is watching the promised video.

A strong opening may:

- name the same subject or situation as the title;
- make the title's central question more concrete;
- add a supported consequence, condition, comparison, or implication;
- clarify what remains unresolved.

The hook should not:

- introduce a different main promise;
- delay the title topic behind generic suspense;
- merely repeat the title without adding useful framing;
- exaggerate the title beyond what the script supports.

When no title is provided, Improve Hook should infer the core promise from the original script without inventing one.

### 15.7 Topic clarity and the intended viewer question

After the opening, the viewer should understand:

- what or who the video is about;
- what situation, change, problem, or outcome is being examined;
- what main question or expectation remains unresolved.

The hook does not need to contain a grammatical question.

A statement can create a strong intended question when the next thing the viewer naturally wants to know is clear.

Improve Hook should avoid openings where different viewers are likely to wonder about unrelated things because the subject or promise is ambiguous.

It should also avoid vague suspense such as:

- something crazy happened;
- you will not believe this;
- this changes everything;
- the real secret is;
- wait until you see what happened.

These phrases do not create strong curiosity unless the supported subject and value are also clear.

### 15.8 Honest curiosity, foreshadowing, and payoff alignment

A Shorts opening has two connected jobs:

1. earn immediate attention;
2. establish an honest expectation that gives the viewer a reason to continue.

Curiosity should be on-target. It should point toward the actual value or payoff of the script.

Improve Hook may foreshadow:

- a supported result;
- an unanswered comparison;
- a consequence;
- a causal explanation;
- a reversal;
- a concrete outcome;
- a scenario whose result remains unresolved.

It should not promise:

- a twist that does not exist;
- stronger stakes than the script contains;
- proof the script does not provide;
- a result that is never delivered;
- a mystery unrelated to the final payoff.

Improve Hook should not automatically move the complete final payoff into the opening.

It may bring forward enough supported material to clarify the value while preserving a reason to continue.

The correct balance depends on what the script actually delivers.

### 15.9 Choosing supported hook material

Numbers, measurements, concrete objects, physical details, named references, comparisons, consequences, contradictions, causal mechanisms, and final-payoff material are all possible hook anchors.

No anchor type should automatically outrank every other type.

A specific number is valuable when it:

- expresses the video's scale;
- changes the viewer's understanding;
- sharpens the central comparison;
- creates or supports the main question;
- contributes directly to the payoff.

A number should not be forced into the hook merely because it exists somewhere in the script.

The strongest anchor is the supported material that contributes most to:

- topic clarity;
- relevant curiosity;
- title confirmation;
- payoff alignment;
- immediate viewer value.

When a number or measurement is used, its value and unit must be preserved accurately.

When the script contains a cause and a consequence, Improve Hook may combine them only when doing so:

- remains clear and natural;
- does not overstate causality;
- does not reveal the entire answer too early;
- is stronger than preserving the original opening.

The original opening itself may already contain the strongest available material.

### 15.10 Spoken wording and author voice

The improved hook should sound natural when spoken aloud.

It should generally be:

- concise;
- easy to understand on first hearing;
- free from unnecessary setup;
- specific enough to stand on its own;
- consistent with the user's existing tone.

No universal word count is mandatory.

A five-word hook is not automatically stronger than a fifteen-word hook.

Question hooks, statement hooks, scenario hooks, comparisons, consequences, and contradictions can all work when they fit the source material.

Improve Hook should not replace natural wording with generic AI language such as:

- incredible;
- shocking;
- insane;
- game-changing;
- towers over;
- imagine this;
- here is the secret;
- what nobody tells you.

These expressions may be used only when they are genuinely supported, natural to the author's voice, and editorially necessary. They should never serve as substitutes for real value.

### 15.11 Light paraphrase and decorative rewrite rule

Light paraphrasing must not be presented as a successful hook improvement.

A likely cosmetic rewrite:

- keeps the same subject, question, promise, and payoff relationship;
- mainly replaces words with synonyms;
- adds decorative adjectives or hype;
- changes a direct question into `Imagine if...` without improving its function;
- inserts `but`, `however`, or another contrast word without creating real contrast;
- changes the tone from natural speech to generic AI polish;
- describes improvements that are not visible in the text.

Structural or lexical similarity is not automatically wrong.

A meaningful clarification may retain most original words.

Low word overlap is also not proof of improvement. A rewrite can replace nearly every word while preserving the same weakness.

The correct question is:

> Does this version create a materially better opening experience using only supported material?

If not, preserve the original.

### 15.12 Factual, claim, and scope preservation

Improve Hook must not invent or strengthen:

- facts;
- numbers;
- measurements;
- people;
- events;
- comparisons;
- causes;
- outcomes;
- consequences;
- certainty;
- timeframes;
- frequency;
- scale;
- stakes;
- claims.

It must preserve distinctions such as:

- could versus will;
- might versus does;
- today versus always;
- one example versus every case;
- a possibility versus a confirmed outcome.

A stronger hook should be more effective, not less accurate.

If the desired hook requires unsupported information, Improve Hook should return a diagnostic.

### 15.13 Reason quality and observable editorial change

The returned reason must be specific to the current title, original opening, script, and result.

It should identify:

1. the original opening's real weakness or existing strength;
2. the supported material relevant to the decision;
3. the observable editorial operation that was performed;
4. why that operation improves the viewer experience.

Valid observable operations may include:

- removed generic delay before the topic;
- named the previously unclear subject;
- introduced a supported consequence earlier;
- replaced vague suspense with one specific unresolved question;
- aligned the opening with the title;
- preserved the original because the candidate added no meaningful value;
- returned a diagnostic because the required payoff material was missing.

The reason must not make a claim contradicted by the text.

For example, it must not say:

- a question was added when the original was already a question;
- the progression changed when only synonyms changed;
- the payoff became clearer when the same payoff remained in the same role;
- the visual became stronger when no visual information was provided;
- the hook became more specific when specific material was removed.

Generic reasons such as `improved clarity and curiosity` are insufficient.

### 15.14 Scores, thresholds, and deterministic guards

A hook score may assist the decision, but it must not determine the result by itself.

A numeric threshold is not a substitute for evaluating:

- title alignment;
- topic clarity;
- intended viewer question;
- payoff alignment;
- factual safety;
- meaningful editorial change.

Deterministic validation is appropriate for failures that can be verified reliably, such as:

- malformed response contracts;
- unsupported numbers;
- changed measurements;
- exact original preservation;
- forbidden claim strengthening;
- obvious missing diagnostic material;
- repeated confirmed failure modes.

Deterministic validation should not assume universally that:

- one anchor category is always strongest;
- a specific lexical-overlap percentage proves success or failure;
- every strong hook contains a number;
- every rewrite must use different words;
- every question hook is stronger or weaker than a statement hook.

The prompt, response parser, tests, and guards should work together. No single regex or threshold should act as the complete editorial judge.

### 15.15 Final editorial self-check

Before returning a result, Improve Hook should verify:

- Does the opening confirm the title or core topic?
- Is the subject understandable immediately?
- Is there one clear and relevant reason to continue?
- Is the curiosity connected to the script's real payoff?
- Was the complete answer revealed too early?
- Was any fact, comparison, cause, result, certainty, scope, or timeframe changed?
- Does the rewrite preserve the creator's natural voice?
- Is the candidate meaningfully better rather than merely different?
- Does the reason describe an observable change that actually occurred?
- Would preserving the original be more honest?
- Would a diagnostic be more useful?

### 15.16 MVP implementation principle

For the MVP, use the simplest architecture that can reliably follow this framework.

Do not add:

- niche-specific hook rules;
- topic-specific templates;
- a mandatory hook formula;
- a required number;
- a required contradiction;
- a required question;
- a required twist;
- a separate model judge;
- multiple AI calls;
- embeddings;
- complex similarity scoring;

unless tests and real user examples prove that the simpler implementation is insufficient.

The implementation order should be:

1. store approved product knowledge;
2. create regression cases for confirmed failures;
3. update the Improve Hook prompt and decision structure;
4. update parsing and deterministic guards only where necessary;
5. manually test real hooks in production;
6. add further guards only for failures that remain proven.

---

## 16. Improve Hook and Improve Script responsibilities

Improve Hook and Improve Script solve related but different editorial problems.

### Improve Hook

Improve Hook:

- receives the title or topic when available;
- receives the complete script as supporting context;
- evaluates the current opening against the full script;
- edits only the first spoken line or opening beat;
- preserves the body;
- may preserve, rewrite, or return a diagnostic under the current response contract.

Improve Hook should not hide a weak script body behind an overpromising opening.

If the body cannot fulfill a stronger hook, the correct action is preservation or diagnostic guidance.

### Improve Script

Improve Script:

- evaluates the complete script as one connected viewer experience;
- may preserve or change the opening;
- may change information order, compression, progression, transitions, and payoff delivery;
- must preserve the supported core idea, facts, claims, and author voice;
- may return a meaningful rewrite, diagnostic, or preservation result.

### Shared principles

Both functions must:

- create real editorial value rather than cosmetic difference;
- preserve supported facts, claims, scope, certainty, and meaning;
- avoid niche-specific templates;
- avoid unsupported invention;
- preserve already-strong material;
- return reasons tied to observable editorial decisions.

Improve Hook should not attempt to perform the full job of Improve Script.

Improve Script should not assume that the hook must change when another part of the script is the real limiting problem.

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

---

## 21. Improve Script editorial decision framework

Improve Script should act as an editor, not as a paraphrasing tool.

Its goal is not to make the script look different. Its goal is to make the strongest useful improvement possible using only the material supported by the title and original script.

These rules are universal. They must not depend on a specific topic, niche, creator, person, story type, or script category.

### 21.1 Core decision principle

Before rewriting, Improve Script should evaluate the full script as one connected viewer experience.

It should determine:

1. What the script promises the viewer.
2. What facts, claims, examples, consequences, visuals, and payoff material are actually supported.
3. What single problem most limits the script.
4. Whether that problem can be meaningfully solved using only the available material.
5. Whether a rewrite would create real editorial value or only different wording.

Improve Script should solve the most important limiting problem instead of applying the same set of changes to every script.

### 21.2 Possible primary problems

The main limiting problem may be:

- weak core idea;
- insufficient source material;
- weak opening;
- unclear promise;
- predictable progression;
- payoff revealed too early;
- weak or predictable payoff;
- summary-style ending;
- repetitive explanation;
- filler or slow setup;
- unsupported claim;
- already-strong execution.

This list describes possible universal editorial diagnoses. It is not a set of fixed script templates.

Improve Script should not assume that every script needs a new hook, reordered sentences, more suspense, or a twist.

### 21.3 Available actions

Improve Script should choose the action that is most honest and useful.

#### A. Meaningful rewrite

Return a full rewrite when:

- the source material is sufficient;
- the core idea is usable;
- the main weakness is execution;
- the script can become meaningfully stronger without inventing information.

A meaningful rewrite may:

- reframe the opening;
- change the information order;
- compress context;
- remove filler or repetition;
- improve progression;
- delay or reposition supported payoff material;
- strengthen sentence-level value;
- improve natural spoken rhythm;
- preserve strong original lines that already work.

None of these changes is mandatory by itself.

The correct rewrite is the version that best improves the full viewer experience while preserving the supported meaning.

#### B. Diagnostic

Return a diagnostic instead of a full rewrite when:

- the core idea is too weak to support a strong script;
- the script lacks enough concrete material;
- a stronger opening, progression, or payoff would require invention;
- the available material does not contain a rewarding ending;
- the source itself is too weak or incomplete to support a meaningful rewrite;
- meaningful improvement would require changing a supported claim.

The diagnostic should identify the real limiting problem.

It should explain what material or value is missing instead of giving generic advice such as:

- make it more engaging;
- improve the flow;
- add more detail;
- use stronger language.

#### C. Preserve the original

Return preserve when the generated rewrite does not create a meaningful editorial improvement over the original.

This includes cases where:

- the original already uses its available material effectively;
- the candidate rewrite is only a light sentence-by-sentence paraphrase;
- the candidate preserves the same weakness, progression, and payoff while mainly replacing words;
- the proposed changes do not justify presenting the result as an improved script.

The preserve response should:

- return the exact trimmed original script;
- return an empty changes list;
- explain honestly that the generated rewrite was not a meaningful editorial improvement.

Improve Script should not:

- replace strong wording only to make the output look new;
- change a strong information order without a reason;
- weaken a strong ending;
- describe minor wording edits as a major improvement.

### 21.4 Definition of a successful rewrite

A successful rewrite should:

- preserve the original core idea;
- preserve supported facts, people, numbers, measurements, comparisons, causes, outcomes, uncertainty, and scope;
- solve the main editorial problem;
- improve how the full script fulfills its promise;
- make each sentence add information, tension, context, consequence, progression, or payoff;
- remove unnecessary filler and repetition;
- remain concise, natural, understandable, and easy to say aloud;
- use the strongest supported material at the most effective moment;
- provide a reason and change list tied to the actual script.

A rewrite is not successful merely because:

- different words were used;
- sentence order changed;
- the script became more dramatic;
- the output sounds more polished;
- the model claims that pacing or clarity improved.

### 21.5 Light paraphrase rule

Light sentence-by-sentence paraphrasing must not be presented as a successful Improve Script result.

A likely light paraphrase:

- keeps the same sentence functions in the same order;
- replaces words mainly with synonyms;
- preserves the same weak opening, progression, and ending;
- does not solve the script's main limiting problem;
- describes generic improvements without identifying concrete editorial decisions.

Structural similarity is not automatically wrong.

The original order, wording, or sentence structure may remain when they are already effective.

The important question is not whether the rewrite looks different. The important question is whether it creates real editorial improvement.

When a generated candidate is only a light paraphrase, Climpy should preserve the original rather than label the candidate as improved.

A diagnostic remains appropriate when the source itself lacks enough supported material for a safe meaningful rewrite.

### 21.6 Factual and claim preservation

Improve Script must not invent or strengthen:

- facts;
- numbers or measurements;
- people or events;
- examples;
- causes;
- outcomes;
- comparisons;
- certainty;
- consequences;
- claims.

A rewrite must not turn a supported claim into a stronger unsupported claim.

For example, changing the ability to reach the ball into a claim about jumping higher than a defender changes the meaning and is not allowed unless the original material supports it.

If the desired improvement requires unsupported information, Improve Script should return a diagnostic.

### 21.7 Progression and sentence value

Improve Script should treat the script as one connected sequence, not as isolated sentences.

Each sentence should add at least one useful element:

- new information;
- context;
- tension;
- a consequence;
- a question;
- progression;
- payoff.

A sentence that only repeats, summarizes, or rephrases information the viewer already understood should usually be removed or replaced.

Improve Script should not change the order merely to create visible difference.

It should change the order only when another sequence delivers the supported material more effectively.

### 21.8 Ending decision

The ending should provide the strongest supported final value available in the source material.

A strong ending may deliver:

- a reveal;
- a reversal;
- an unexpected consequence;
- a supported number;
- a strong final image;
- a punchline;
- a fulfilled promise;
- a final escalation.

No specific ending type is mandatory.

Improve Script must not invent a twist, reveal, consequence, number, or escalation.

The ending should not merely summarize what the viewer already understood.

Summary starters such as:

- That is why...
- That's how...
- So this means...
- In conclusion...
- Which is why...

are weak when the sentence only restates the preceding explanation.

They are acceptable when the sentence immediately adds genuinely new supported information.

If the source material does not contain a strong final reward, Improve Script should:

1. place the strongest supported detail at the most effective moment; or
2. return a diagnostic explaining that stronger payoff material is missing.

### 21.9 Final editorial self-check

Before returning a result, Improve Script should verify:

- Did the result solve the biggest actual problem?
- Is the complete script meaningfully stronger?
- Did the edit improve the viewer experience rather than only replace words?
- Were all supported facts and claims preserved?
- Was any claim, comparison, cause, outcome, or certainty strengthened?
- Does every sentence add value?
- Is the ending the strongest supported final reward available?
- Is a light paraphrase being presented as an improvement?
- Would a diagnostic be more honest?

### 21.10 MVP implementation principle

For the MVP, use the simplest architecture that can reliably follow this framework.

Do not add:

- niche-specific rules;
- topic-specific templates;
- a required twist;
- mandatory sentence reordering;
- embeddings;
- a separate model judge;
- multiple AI calls;
- automatic retries;
- complex similarity scoring;

unless tests and real user examples show that the simpler implementation is insufficient.

The implementation order should be:

1. store approved product knowledge;
2. add regression tests for confirmed failure modes;
3. update the Improve Script prompt and parsing behavior;
4. manually test real scripts;
5. add deterministic guards only for failures that remain proven.
