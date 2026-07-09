# Reelyze MVP Test Checklist

## Goal

Check if Reelyze is stable enough for MVP testing.

MVP is ready if:

* New Analysis works.
* Results page works.
* Mobile layout works.
* Desktop layout still works.
* Improve Hook works.
* Suggested Fixes work.
* View all suggestions works.
* Feedback works.
* Share works or copies link.
* Build passes.

---

## 1. New Analysis Page

### Mobile

* [ ] Page opens correctly on 390px width.
* [ ] Title input works.
* [ ] Script textarea works.
* [ ] Character counter updates.
* [ ] Empty script shows error.
* [ ] Analyze button shows loading state.
* [ ] Analyze button does not break on double click.
* [ ] Valid script redirects to `/results`.
* [ ] Bottom nav does not change size.

### Desktop

* [ ] Desktop layout looks unchanged.
* [ ] Analyze button works.
* [ ] Error message works.
* [ ] Navigation works.

---

## 2. Results Page

### Mobile

* [ ] Header looks clean.
* [ ] Back button works.
* [ ] Share button works or copies link.
* [ ] Score cards show rings.
* [ ] Each ring shows score + `/100`.
* [ ] Main takeaways card appears.
* [ ] Risky Parts appears.
* [ ] Suggested Fixes appears.
* [ ] View all suggestions works.
* [ ] Show fewer suggestions works.
* [ ] Your Script accordion opens.
* [ ] Your Script starts from the first line.
* [ ] Your Script can scroll if long.
* [ ] Scene Breakdown accordion opens.
* [ ] Scene Breakdown legend looks clean.
* [ ] Rate this analysis looks clean.
* [ ] Helpful button works.
* [ ] Not helpful opens feedback modal.
* [ ] Bottom nav does not cover content.

### Desktop

* [ ] Desktop Results layout looks unchanged.
* [ ] Score cards work.
* [ ] Your Script works.
* [ ] Risky Parts works.
* [ ] Suggested Fixes works.
* [ ] Improve Hook modal works.
* [ ] Feedback modal works.

---

## 3. Improve Hook / Refine Script

Test on weak script:

* [ ] Improve Hook button appears.
* [ ] Modal opens.
* [ ] Modal fits mobile screen.
* [ ] Copy Hook works.
* [ ] Close works.
* [ ] Hook does not invent fake facts.

Test on stronger script:

* [ ] Refine Script appears when hook score is 70–79.
* [ ] Modal title says Refine Script.
* [ ] Output still uses script details.

Test on very generic script:

* [ ] Diagnostic mode appears.
* [ ] It does not invent a fake hook.
* [ ] Button says Copy Advice.

---

## 4. Required Test Scripts

### Test A — Weak Generic Motivation

Title:
Why Motivation Fails

Script:
Motivation is important.
Everyone wants to stay motivated.
But sometimes motivation disappears.
That is why you need discipline.
You should work hard every day.
If you keep going, you can succeed.
Never give up.

Expected:

* Low/medium score.
* Risky Parts found.
* Suggested Fixes found.
* Improve Hook appears.
* View all suggestions works.

---

### Test B — Stronger Habits Script

Title:
Tiny Habits

Script:
Most people think habits fail because they are lazy.
But the real problem is friction.
If your shoes are hidden in the closet, running feels harder.
If your phone is on your desk, focusing feels impossible.
If healthy food is hard to reach, junk food wins.
Tiny habits are not about motivation.
They are about making the right action easier than the wrong one.

Expected:

* Higher score.
* Refine Script or Improve Hook depending on score.
* Concrete details should be used.
* Your Script and Scene Breakdown should work.

---

### Test C — Generic Success Script

Title:
Why Success Is Possible

Script:
Success is very important in life.
Everyone wants to be successful.
Hard work is the key.
Never give up.
Stay focused.
You can do it.
That is why success is possible for anyone.

Expected:

* Diagnostic mode.
* No fake hook.
* Needs More Specific Material.
* Copy Advice.

---

### Test D — Ocean / Everest

Title:
How Deep Is the Ocean?

Script:
The ocean looks calm from above.
But if you dropped the tallest building on Earth into its deepest point, it would disappear completely.
Mount Everest would still have more than a mile of water above it.
That is how deep the Mariana Trench is.
Most of the ocean is not blue paradise.
It is a dark, crushing world we have barely seen.

Expected:

* Improve Hook or Refine Script.
* Hook should use Mount Everest / more than a mile.
* No awkward fake physical action.

---

### Test E — Silence

Title:
What If The World Went Silent?

Script:
Imagine the whole world went silent for one minute.
No cars.
No planes.
No people talking.
At first, it would feel peaceful.
But then you would notice something terrifying.
The world is never truly quiet.
Even silence has a sound.

Expected:

* Hook should combine one minute + silence has a sound.
* Scene Breakdown should work.
* Modal should fit mobile.

---

## 5. Final Build

Run:

npm run build

Expected:

* Build passes.
* No TypeScript errors.
* No route errors.

---

## 6. MVP Ready Decision

MVP is ready for first testing if:

* [ ] Mobile `/` works.
* [ ] Mobile `/results` works.
* [ ] Desktop `/` works.
* [ ] Desktop `/results` works.
* [ ] Improve Hook works.
* [ ] View all suggestions works.
* [ ] Feedback works.
* [ ] Share works or copies link.
* [ ] Build passes.

If all are checked, Reelyze is ready for small MVP testing.
