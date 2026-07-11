# Climpy Improve Hook Evaluation Corpus

## 1. Purpose

This document stores editorial ground truth for the Climpy Improve Hook feature.

Its purpose is to prevent development from becoming:

- output-specific patching;
- threshold chasing;
- template enforcement;
- regex accumulation without an editorial model;
- acceptance of cosmetic rewriting as improvement.

The corpus should be used before changing:

- the Improve Hook prompt;
- response parsing;
- deterministic guards;
- score thresholds;
- fallback generation;
- UI explanations.

The examples are intentionally spread across different topics. They test universal editorial behavior, not niche-specific writing rules.

---

## 2. Current product contract

The current Improve Hook API represents editorial decisions as follows.

### Preserve

Expected response behavior:

- `status: "good"`;
- return the exact trimmed original opening in `improvedHook`;
- provide a specific reason explaining why replacement is not justified.

The current implementation may also return `mode: "rewrite"` for compatibility. That value does not mean the original was actually rewritten.

### Meaningful rewrite

Expected response behavior:

- `status: "improved"`;
- `mode: "rewrite"`;
- return one materially stronger supported opening;
- explain the observable editorial operation.

### Diagnostic

Expected response behavior:

- `status: "improved"`;
- `mode: "diagnostic"`;
- do not manufacture a stronger hook;
- explain what concrete source material, payoff, proof, or clarity is missing.

### Error

`status: "error"` is reserved for request, provider, parsing, timeout, rate-limit, or other execution failures.

An editorial diagnostic is not an error.

---

## 3. Evaluation principles

### 3.1 Do not require exact wording by default

Most cases should evaluate properties rather than one exact sentence.

A valid rewrite may use different wording when it performs the required editorial operation and preserves the supported meaning.

Exact output should be required only when testing:

- preservation of the original;
- exact facts, numbers, measurements, or qualifiers;
- response-contract behavior;
- a confirmed deterministic fallback;
- a previously observed production failure where exact preservation matters.

### 3.2 Evaluate the viewer experience

The main question is not whether the text looks different.

The main question is whether the candidate creates a materially better opening experience through an observable editorial decision.

### 3.3 Preserve facts and scope

No accepted candidate may strengthen or invent:

- facts;
- numbers;
- measurements;
- people;
- events;
- causes;
- outcomes;
- comparisons;
- certainty;
- timeframes;
- frequency;
- scale;
- stakes;
- claims.

### 3.4 Separate source weakness from opening weakness

Use a rewrite when the script contains sufficient supported value and the opening fails to use it effectively.

Use a diagnostic when a stronger hook would require information the title and script do not contain.

### 3.5 Do not let one signal become a universal strategy

The presence of a number, question, contradiction, consequence, visual detail, or final payoff does not automatically make it the best hook anchor.

The best material is the supported material that contributes most to:

- topic clarity;
- title confirmation;
- relevant curiosity;
- payoff alignment;
- immediate viewer value.

---

## 4. Case format

Each corpus case should contain:

- ID;
- category;
- title or topic;
- complete script;
- current opening;
- adversarial or proposed candidate when relevant;
- expected decision;
- primary diagnosis;
- required assertions;
- forbidden behavior.

Cases may later be implemented as:

- parser unit tests;
- API tests with mocked provider output;
- prompt regression tests;
- manual production evaluations.

---

## 4.1 Corpus approval map

Not every entry in this document has the same implementation status.

This distinction prevents exploratory editorial ideas from becoming mandatory product rules before they are validated.

### Approved first implementation set

Implement these cases first:

- `IH-P01` — confirmed production cosmetic rewrite;
- `IH-P02` — preserve an already-strong numeric scenario;
- `IH-R01` — remove generic delay;
- `IH-R02` — resolve an unclear subject;
- `IH-R05` — allow a meaningful high-overlap clarification;
- `IH-R06` — do not make every number the automatic anchor;
- `IH-D01` — diagnose generic motivational material;
- `IH-D02` — diagnose a title claim unsupported by the script;
- `IH-S01` — reject an unsupported replacement number;
- `IH-Q01` — do not claim that a question was added when one already existed.

This first set intentionally covers:

- preservation;
- meaningful rewriting;
- diagnostic behavior;
- anchor selection;
- factual safety;
- reason truthfulness;
- both high-overlap and low-value rewriting risks.

Passing this set must not require one universal hook formula.

### Approved later evaluation cases

The remaining preserve, rewrite, diagnostic, safety, alignment, and reason-quality cases may be implemented after the first set is working without regressions.

They remain useful evaluation material, but they should not all be converted into deterministic guards.

### Exploratory cases

These cases express useful editorial concerns but do not yet define one mandatory product decision:

- `IH-R07` — title repetition may or may not justify rewriting depending on the value added;
- `IH-R08` — revealing an answer early may be correct or incorrect depending on the remaining viewer value;
- `IH-A03` — a concrete payoff should not automatically be moved forward, but the best decision still depends on the complete script.

Exploratory cases should be used for manual evaluation until their expected decisions and assertions are made precise.

They must not be used as strict automated pass/fail tests yet.

### Cross-cutting controls

`IH-L01` and `IH-L02` are not standalone scenario cases.

They are universal controls applied across other cases:

- high lexical overlap does not automatically prove a cosmetic rewrite;
- low lexical overlap does not automatically prove meaningful improvement.

They should be implemented through representative cases such as `IH-R05`, `IH-P01`, and `IH-P05`, rather than treated as separate exact-output tests.

---

## 5. Preserve cases

### IH-P01 — Strong question versus cosmetic production rewrite

Category: preserve, cosmetic paraphrase, confirmed production failure

Title:

> If Messi Had Ronaldo's Jump

Script:

> If Messi had Ronaldo's vertical jump, how high would he actually reach?
>
> Messi is around 5 feet 7, while Ronaldo is around 6 feet 2.
>
> So even with Ronaldo's jump, Messi still wouldn't reach as high as Ronaldo.
>
> But he'd probably score far more headers and be jumping high enough to challenge almost any defender.

Adversarial candidate:

> Imagine if Messi had Ronaldo's incredible vertical jump.

Expected decision:

- preserve.

Primary diagnosis:

- the original already names the subject, scenario, comparison, and intended question;
- the candidate changes the framing but does not improve title confirmation, curiosity, or payoff alignment.

Required assertions:

- return the exact original first line;
- do not describe the candidate as clearer or more specific;
- do not claim that a question was added;
- do not treat `incredible` as editorial value.

Forbidden behavior:

- accepting the candidate because it uses different words;
- converting the question into `Imagine if...` only to create visible difference.

---

### IH-P02 — Strong numeric scenario already uses its central value

Category: preserve, strong supported anchor

Title:

> What If Earth Suddenly Stopped?

Script:

> If Earth stopped spinning, your body would still be moving at over 1,000 miles per hour.
>
> Everything not firmly attached would keep moving east.
>
> The atmosphere and oceans would continue moving too, causing the greatest immediate destruction.

Adversarial candidate:

> Imagine Earth stopping while your body keeps flying forward at incredible speed.

Expected decision:

- preserve.

Primary diagnosis:

- the original already combines the scenario, named subject, exact supported scale, and immediate consequence;
- the candidate removes the most useful specificity.

Required assertions:

- preserve `over 1,000 miles per hour`;
- do not replace the number with `incredible speed`;
- do not force different wording because the original already uses the strongest material.

---

### IH-P03 — Strong visual mystery already creates one question

Category: preserve, visual mystery

Title:

> The Ship Found With Nobody On Board

Script:

> A ship was found drifting in the ocean — food still on the table, but every person gone.
>
> The cargo was untouched and the lifeboats were still there.
>
> Investigators had to explain how the entire crew disappeared without taking either.

Adversarial candidate:

> This abandoned ship hides a shocking mystery nobody can explain.

Expected decision:

- preserve.

Primary diagnosis:

- the original provides the concrete scene and one clear unresolved question;
- the candidate replaces evidence with generic hype.

Required assertions:

- preserve the concrete physical details;
- reject `shocking mystery` as a substitute for supported value.

---

### IH-P04 — Clear title-aligned consequence hook

Category: preserve, title alignment

Title:

> Why Your Phone at Night Ruins Tomorrow Morning

Script:

> Your phone at night is ruining tomorrow morning.
>
> Bright light and constant novelty delay the moment your brain starts preparing for sleep.
>
> That makes waking up harder before the next day even begins.

Adversarial candidate:

> Most people think mornings start when they wake up, but the real problem begins much earlier.

Expected decision:

- preserve.

Primary diagnosis:

- the original confirms the title immediately and expresses the supported cause-and-consequence relationship;
- the candidate delays the subject behind a generic belief contrast.

---

### IH-P05 — Low lexical overlap does not prove improvement

Category: preserve, low-overlap cosmetic rewrite

Title:

> Could a Human Outrun a Bear?

Script:

> Could a human outrun a bear over 100 meters?
>
> Even elite sprinters reach a lower top speed than several bear species.
>
> The human advantage only appears over much longer distances.

Adversarial candidate:

> Picture the fastest person alive racing one of nature's most terrifying predators.

Expected decision:

- preserve.

Primary diagnosis:

- the candidate replaces a clear comparison and distance with decorative language;
- low word overlap does not create editorial value.

Required assertions:

- retain the actual comparison;
- retain the 100-meter condition when it is used;
- do not invent fear-based stakes.

---

## 6. Meaningful rewrite cases

### IH-R01 — Remove generic delay before supported material

Category: rewrite, delayed topic

Title:

> The 12-Second Delay That Changed the Test

Script:

> Before we start, you need to understand one important thing.
>
> The valve stayed closed for 12 seconds before pressure forced it open.
>
> That delay changed the final test result.

Expected decision:

- meaningful rewrite.

Primary diagnosis:

- the original spends the first line delaying the exact topic;
- the body contains a clear supported event and consequence.

Required operation:

- remove the generic preamble;
- name the valve, 12-second delay, test result, or a clear supported combination.

Forbidden behavior:

- adding an unsupported explosion, failure, or injury;
- preserving the filler introduction.

---

### IH-R02 — Resolve an unclear subject

Category: rewrite, subject ambiguity

Title:

> How Noah Broke the School Sprint Record

Script:

> He broke the record after changing one part of his start.
>
> Noah moved his hips higher in the blocks before the final race.
>
> He cut 0.18 seconds from his previous time.

Expected decision:

- meaningful rewrite.

Primary diagnosis:

- `He` has no standalone reference in the opening.

Required operation:

- name Noah or clearly identify the athlete immediately;
- preserve the supported change and result when used.

Forbidden behavior:

- inventing a training duration;
- claiming that the hip position alone is scientifically proven to cause every improvement.

---

### IH-R03 — Confirm the title instead of opening generically

Category: rewrite, title alignment

Title:

> Why Bad Sleep Slows Your Sprint Start

Script:

> Most athletes miss this.
>
> Poor sleep can slow reaction time before the first step.
>
> That delay can affect the entire acceleration phase.

Expected decision:

- meaningful rewrite.

Primary diagnosis:

- the opening does not identify sleep, sprinting, or the relevant consequence.

Required operation:

- confirm the title topic quickly;
- create curiosity about the supported effect on the start or acceleration.

Forbidden behavior:

- claiming that one bad night guarantees a slower race;
- adding a numerical reaction-time change not present in the script.

---

### IH-R04 — Replace vague suspense with a supported scene

Category: rewrite, vague suspense

Title:

> The Cargo Ship With No Crew

Script:

> You won't believe what happened next.
>
> A cargo ship was found moving with meals still prepared and no crew on board.
>
> Its lifeboats and cargo were untouched.

Expected decision:

- meaningful rewrite.

Primary diagnosis:

- the opening creates generic suspense without naming the event.

Required operation:

- introduce the ship or the concrete scene;
- leave the disappearance unresolved.

Forbidden behavior:

- calling the event supernatural;
- inventing the crew's fate.

---

### IH-R05 — High lexical overlap may still be meaningful

Category: rewrite, high-overlap clarification

Title:

> Could Messi Reach Ronaldo's Height With Ronaldo's Jump?

Script:

> Could Messi reach Ronaldo's height if he had his jump?
>
> Messi is around 5 feet 7, while Ronaldo is around 6 feet 2.
>
> Even with the same vertical jump, their different heights would still affect the final reach.

Candidate:

> Could Messi reach Ronaldo's height with Ronaldo's jump?

Expected decision:

- meaningful rewrite is allowed.

Primary diagnosis:

- `his jump` has an ambiguous reference;
- the candidate resolves the ambiguity while preserving the useful original structure.

Required assertions:

- do not reject the candidate only because most words are shared;
- recognize the observable clarification;
- preserve the question and comparison.

---

### IH-R06 — A number exists but is not the best automatic anchor

Category: rewrite, anchor selection

Title:

> The Missing Pin That Collapsed the Bridge

Script:

> The bridge had stood for 80 years.
>
> One missing pin allowed a joint to twist under load.
>
> That movement triggered the collapse.

Adversarial candidate:

> This bridge stood for 80 years before everything changed.

Expected decision:

- rewrite, but do not require the 80-year fact as the central anchor.

Primary diagnosis:

- the missing pin and causal mechanism are more relevant to the title and payoff than the age of the bridge.

Required operation:

- focus on the supported missing pin, joint movement, or collapse mechanism;
- preserve causal scope accurately.

Forbidden behavior:

- declaring that every bridge can collapse from one missing pin;
- choosing `80 years` solely because it is a number with a unit.

---

### IH-R07 — Replace a title repetition with supported additional value

Category: rewrite, title repetition

Title:

> Why the Deep Ocean Is So Dangerous

Script:

> Why is the deep ocean so dangerous?
>
> At extreme depths, pressure increases enough to crush structures that survive near the surface.
>
> The danger comes from a force people cannot see.

Expected decision:

- meaningful rewrite may be appropriate.

Primary diagnosis:

- the opening merely repeats the title;
- the body contains a supported invisible-force mechanism.

Required operation:

- add useful supported framing without revealing more than the script can deliver.

Forbidden behavior:

- inventing an exact pressure measurement;
- describing monsters, darkness, or temperature unless supported.

---

### IH-R08 — Preserve curiosity instead of moving the complete payoff forward

Category: rewrite, premature answer prevention

Title:

> Which Material Survived the Heat Test?

Script:

> The steel sample was the only one that survived the final temperature.
>
> Aluminum bent first, and the plastic sample failed almost immediately.
>
> Steel lasted because its structure remained stable longer under heat.

Expected decision:

- meaningful rewrite may be required because the opening gives the complete answer immediately.

Required operation:

- establish the comparison or heat-test stakes;
- preserve a reason to learn which material survived;
- remain honest about the available result.

Forbidden behavior:

- inventing additional materials;
- claiming an explosion or record temperature;
- forcing the complete final answer into the hook merely because it is a payoff.

---

## 7. Diagnostic cases

### IH-D01 — Generic motivational advice

Category: diagnostic, insufficient concrete material

Title:

> How to Become Successful

Script:

> Success is possible for anyone.
>
> You need to work hard every day.
>
> Stay focused and never give up.
>
> Consistency is the key.

Expected decision:

- diagnostic.

Required explanation:

- the script needs a specific example, result, mechanism, consequence, number, or real situation.

Forbidden behavior:

- rearranging the same advice into a dramatic hook;
- inventing a success story.

---

### IH-D02 — Title promises evidence the script does not contain

Category: diagnostic, missing proof

Title:

> The Study That Proves Cold Showers Double Focus

Script:

> Cold showers can make people feel more awake.
>
> Some people use them before work.
>
> They may help someone feel ready to begin.

Expected decision:

- diagnostic.

Primary diagnosis:

- the title promises a study and a doubling effect;
- the script supplies neither.

Forbidden behavior:

- repeating the unsupported title claim;
- inventing research, participants, percentages, or causal certainty.

---

### IH-D03 — No rewarding payoff is available

Category: diagnostic, missing payoff

Title:

> What Happened After the Door Opened?

Script:

> The door stayed closed for several minutes.
>
> Everyone watched it.
>
> Then it opened.

Expected decision:

- diagnostic.

Primary diagnosis:

- the script contains setup but no meaningful result after the promised event.

Forbidden behavior:

- inventing what was behind the door;
- manufacturing a reaction or consequence.

---

### IH-D04 — Requested visual improvement lacks visual information

Category: diagnostic, unsupported visual

Title:

> Watch What Happens to This Glass

Script:

> Watch this.
>
> Something changes when the test begins.
>
> The result looks different at the end.

Expected decision:

- diagnostic.

Primary diagnosis:

- the script depends on an unseen visual but does not describe the starting state, action, or result.

Required explanation:

- request the concrete visual change or result.

Forbidden behavior:

- claiming that the glass shatters, melts, bends, freezes, or changes color.

---

### IH-D05 — Hook promises a winner the body never chooses

Category: diagnostic, payoff mismatch

Title:

> Ronaldo vs LeBron: Who Jumps Higher?

Script:

> Ronaldo and LeBron are both explosive athletes.
>
> They compete in different sports and use different jumping techniques.
>
> Their listed measurements also come from different testing situations.

Expected decision:

- diagnostic.

Primary diagnosis:

- the title promises a winner;
- the script does not contain a comparable result or conclusion.

Forbidden behavior:

- selecting a winner;
- treating incompatible measurements as definitive proof.

---

## 8. Factual and scope safety cases

### IH-S01 — Reject an unsupported new number

Category: safety, number preservation

Title:

> The Valve Test

Script:

> Most people miss this detail.
>
> The test lasted 12 seconds before the valve opened.
>
> That delay changed the final result.

Adversarial candidate:

> The result changed after 30 seconds because the valve failed.

Required assertions:

- reject `30 seconds`;
- preserve `12 seconds` when the number is used;
- do not introduce `failed` unless supported.

---

### IH-S02 — Preserve possibility versus certainty

Category: safety, certainty

Title:

> Could This Training Improve Your Start?

Script:

> This drill could improve the first step by helping the athlete hold a better position.
>
> The result depends on technique and repeated practice.

Adversarial candidate:

> This drill will make every athlete faster from the first step.

Required assertions:

- reject `will`;
- reject `every athlete`;
- preserve conditional scope.

---

### IH-S03 — Preserve timeframe

Category: safety, timeframe

Title:

> What Your Phone Can Record Today

Script:

> One recording made today could later be shared with millions of people.
>
> The risk comes from how quickly a private moment can spread.

Adversarial candidate:

> Everything you have ever said could be played to millions.

Required assertions:

- reject `everything`;
- reject `ever`;
- preserve the one-recording and today scope.

---

### IH-S04 — Preserve one example versus universal scope

Category: safety, generalization

Title:

> The Feature That Hurt This App

Script:

> One app lost users after adding a complicated feature.
>
> Removing that feature was followed by better weekly retention.

Adversarial candidate:

> Complicated features always destroy app retention.

Required assertions:

- reject universal scope;
- do not convert one case into a general law;
- do not strengthen correlation into universal causation.

---

### IH-S05 — Do not strengthen causal claims

Category: safety, causality

Title:

> What Changed After the New Routine?

Script:

> The athlete changed the warm-up before the final race.
>
> The next sprint was 0.2 seconds faster.
>
> Other parts of the training plan also changed that week.

Adversarial candidate:

> This warm-up alone cut 0.2 seconds from the athlete's sprint.

Required assertions:

- reject `alone`;
- preserve the existence of other changed factors;
- do not claim proven exclusive causation.

---

## 9. Title and payoff alignment cases

### IH-A01 — Name the title subject instead of using an empty reference

Category: rewrite, title confirmation

Title:

> Can Ronaldo Jump Higher Than NBA Players?

Script:

> This athlete can challenge basketball players in the air.
>
> Ronaldo's recorded football jumps place his head unusually high.
>
> The comparison changes depending on which NBA player is used.

Expected decision:

- meaningful rewrite.

Required operation:

- name Ronaldo immediately;
- keep the comparison conditional rather than claiming he beats all NBA players.

---

### IH-A02 — Do not create unrelated curiosity

Category: preserve or rewrite away from misalignment

Title:

> Why Ice Floats on Water

Script:

> Ice floats because solid water is less dense than liquid water.
>
> Its molecular structure takes up more space when it freezes.
>
> That unusual expansion keeps ice at the surface.

Adversarial candidate:

> This strange object breaks one of nature's biggest rules.

Required assertions:

- reject the unrelated generic mystery;
- keep curiosity connected to ice, density, freezing, or floating;
- do not imply that a physical law is broken.

---

### IH-A03 — Do not reveal the complete destination merely because it is concrete

Category: payoff alignment, premature answer

Title:

> Which Runner Won After the Slowest Start?

Script:

> The runner in lane four won despite leaving the blocks last.
>
> He recovered during the middle of the race.
>
> His final 30 meters changed the result.

Adversarial candidate:

> The runner in lane four won after the slowest start.

Expected behavior:

- do not automatically accept the complete answer as the best hook;
- consider a comparison or unresolved comeback framing that the body can fulfill.

Required assertions:

- preserve the supported lane and comeback facts if used;
- do not invent the time gap or race level.

---

## 10. Reason truthfulness cases

### IH-Q01 — Do not claim that a question was added

Category: reason quality

Original opening:

> Could Messi reach Ronaldo's height with Ronaldo's jump?

Candidate:

> Imagine Messi jumping with Ronaldo's vertical leap.

Adversarial reason:

> The rewrite creates a clear question that the original was missing.

Required assertions:

- reject or replace the reason;
- recognize that the original already contained a direct question.

---

### IH-Q02 — Do not claim that material moved when it did not

Category: reason quality

Original opening:

> The valve stayed closed for 12 seconds before it opened.

Candidate:

> The valve remained shut for 12 seconds before opening.

Adversarial reason:

> The rewrite moves the 12-second result to the beginning.

Required assertions:

- reject the claimed operation;
- the number already occupied the same role;
- likely preserve because only wording changed.

---

### IH-Q03 — Do not claim an unsupported visual improvement

Category: reason quality

Title:

> Why the Method Works

Script:

> The method removes one decision before work begins.
>
> That makes it easier to start the first task.

Candidate:

> Remove one decision before work, and starting becomes easier.

Adversarial reason:

> The new hook creates a much stronger opening visual.

Required assertions:

- reject the visual claim unless a visual was provided;
- any accepted reason must describe wording, clarity, mechanism, or progression visible in the text.

---

### IH-Q04 — Do not describe adjectives as specificity

Category: reason quality, cosmetic rewrite

Original opening:

> Could Ronaldo score from this angle?

Candidate:

> Could the incredible Ronaldo score from this impossible angle?

Adversarial reason:

> The rewrite is more specific and creates stronger stakes.

Required assertions:

- reject `incredible` and `impossible` unless supported;
- do not describe unsupported adjectives as specificity;
- preserve the original when no other improvement exists.

---

## 11. Cross-cutting lexical similarity controls — not standalone cases

### IH-L01 — High overlap can be valid

A candidate must not fail solely because it shares 80 percent or more of its words with the original.

It may still be meaningful when it:

- resolves a real ambiguity;
- corrects a factual qualifier;
- names an unclear subject;
- removes one misleading phrase;
- aligns the opening with the title while preserving strong wording.

Reference case:

- IH-R05.

### IH-L02 — Low overlap can still be cosmetic

A candidate must not pass solely because it replaces most words.

It may still be cosmetic when it:

- preserves the same subject, question, promise, and payoff relationship;
- adds hype instead of information;
- changes a question into `Imagine...`;
- removes useful specificity;
- changes voice without solving a problem.

Reference cases:

- IH-P01;
- IH-P05.

---

## 12. Initial coverage matrix

| Area | Cases |
|---|---|
| Preserve strong opening | IH-P01 to IH-P05 |
| Remove delay | IH-R01 |
| Resolve subject ambiguity | IH-R02 |
| Title confirmation | IH-R03, IH-A01 |
| Replace vague suspense | IH-R04 |
| High-overlap meaningful edit | IH-R05, IH-L01 |
| Number is not automatically best | IH-R06 |
| Title repetition | IH-R07 |
| Prevent premature payoff | IH-R08, IH-A03 |
| Insufficient source material | IH-D01 to IH-D05 |
| Number safety | IH-S01 |
| Certainty and scope safety | IH-S02 to IH-S04 |
| Causal safety | IH-S05 |
| Payoff alignment | IH-D03, IH-D05, IH-A03 |
| Reason truthfulness | IH-Q01 to IH-Q04 |
| Low-overlap cosmetic edit | IH-P01, IH-P05, IH-L02 |

---

## 13. Implementation order

The corpus should be implemented in this order:

1. preserve cases that expose cosmetic rewriting;
2. diagnostic cases where invention would otherwise be required;
3. factual and scope safety cases;
4. meaningful rewrite cases with observable editorial operations;
5. title and payoff alignment;
6. reason-truthfulness validation;
7. lexical-similarity controls;
8. manual production checks;
9. blind evaluation.

Do not change production behavior merely to make every case pass through one deterministic rule.

Use:

- prompt changes for editorial decision hierarchy;
- parser validation for reliable contract and factual checks;
- deterministic guards only for confirmed, objectively verifiable failures.

---

## 14. Blind evaluation set

At least 20 percent of future evaluation cases should remain outside the prompt examples and outside the initial deterministic rules.

The blind set should include:

- already-strong hooks;
- weak hooks with useful body material;
- scripts with numbers that are not central;
- scripts with no safe rewrite;
- high-overlap meaningful edits;
- low-overlap cosmetic edits;
- title/body mismatches;
- subtle scope and certainty changes.

Blind cases should be evaluated only after the implementation has been designed from the main corpus.

Their purpose is to detect overfitting to:

- exact examples;
- specific topics;
- lexical patterns;
- one anchor hierarchy;
- one score threshold;
- one hook formula.
