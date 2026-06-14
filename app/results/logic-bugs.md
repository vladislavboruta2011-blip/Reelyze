# Reelyze Logic Bugs

## Fixed Issues

### ✅ Strong mystery hooks undervalued

Fixed by improving mystery and open-loop detection.

### ✅ Strong historical facts undervalued

Fixed by improving consequence and specificity scoring.

### ✅ Hook score compression

Improved score calibration and exceptional hook handling.

### ✅ Open loops underweighted

Improved open-loop scoring and signal detection.

### ✅ Contrast underweighted

Improved contrast weighting and scoring.

### ✅ Consequences underweighted

Improved consequence detection and scoring.

### ✅ Medium scripts returning no feedback

Fixed fallback logic for scripts scoring 75–79.

### ✅ Rehook / Contrast overlap

Separated rehook and contrast signals.

### ✅ Open-loop signal inflation

Removed overly generic signals such as:

* next
* before
* later
* actually
* finally

### ✅ Line-length risky detection

Removed automatic risky classification based only on long lines.

### ✅ Number-only result inflation

Dates and numbers alone no longer automatically count as strong results.

---

# Active Issues

## 1. Suggested Fixes quality

Problem:
Suggested fixes can still feel generic and repetitive.

Examples:

* "Add a stronger hook."
* "Increase curiosity."
* "Add a contrast line."

Expected:
Fixes should explain the specific weakness of the script.

Examples:

* Add a concrete number or example in the first line.
* Reveal the consequence earlier.
* Introduce a stronger contrast after the setup.
* End with a clearer payoff.

Priority:
High

---

## 2. Payoff detection accuracy

Problem:
Strong payoff lines are not always recognized correctly.

Examples:

* "And what happened next affected millions of people."
* "That decision changed history forever."
* "The mission was lost forever."

Expected:
Strong endings should improve payoff quality and avoid risky classification.

Priority:
High

---

## 3. startsWithWeakIntro scope issue

Status:
Deferred until after MVP.

Reason:
Requires structural refactoring and carries higher risk of breaking existing scoring logic.

Current behavior is acceptable for MVP.

---

## 4. Score inflation edge cases

Problem:
Some combinations of signals can still produce unexpectedly high scores.

Examples:

* Strong contrast + open loop + specificity
* Multiple overlapping signals in short scripts

Expected:
95 should remain rare and reserved for exceptional hooks.

Priority:
Medium

---

## 5. Scoring architecture limitations

Problem:
Current scoring is based on many additive bonuses.

Risk:
Future updates may create score inflation and unpredictable interactions between signals.

Potential future solution:
Move toward a pillar-based system:

* Hook Strength
* Retention Structure
* Payoff Clarity

Priority:
Post-MVP

---

# Current MVP Priorities

1. Improve Suggested Fixes quality.
2. Improve Payoff detection.
3. Fix startsWithWeakIntro scope issue.
4. Stress-test scoring with 20–30 real scripts.
5. Launch MVP.

## 12. Business payoffs are underdetected

Example:

Rolex became one of the most valuable luxury brands in the world.

Expected:
Payoff detected.

Actual:
Payoff could be stronger.

Cause:
containsPayoffSignal does not recognize business outcome patterns.

## 13. Money-loss hooks are underweighted

Example:

One mistake cost NASA over $125 million.

Expected:
Hook 85+

Actual:
Hook ~79

Cause:
Financial loss + named entity signals are not rewarded enough.

## Universal Signals Underweighted

Current analyzer does not sufficiently reward:

- Mystery
- Unexplained events
- High stakes
- Large consequences
- Contrast
- Curiosity gaps
- Strong payoff outcomes

Examples can come from any niche:
History, Business, Sports, Science, True Crime, Mystery, What If.

The solution should be signal-based, not niche-based.

## Payoff Detection Is Keyword-Based

Problem:

containsPayoffSignal() currently detects specific phrases instead of detecting whether the script actually delivers a consequence, resolution, answer, or outcome.

Examples:

Strong payoff:

"What if gravity suddenly became twice as strong?

Buildings would crack.
Planes would fall.
The human body would struggle just to stay alive."

Result:
Payoff could be stronger.

Reason:
The payoff exists structurally, but no keyword matches.

Expected:

Payoff detection should analyze:

- consequence
- outcome
- resolution
- answer to opening question
- final result

instead of relying primarily on phrase matching.

## Main Architecture Problem

Current analysis logic is patch-based.

Problem:
The analyzer reacts to specific failed examples instead of using a universal scoring model.

Expected:
Move toward a signal-based model:

- Hook Strength
- Retention Structure
- Payoff Strength

Status:
Planned for Analysis V2.