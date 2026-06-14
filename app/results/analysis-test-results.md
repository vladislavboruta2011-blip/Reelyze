# Reelyze Test Results

## 1. Strong Mystery Hook — D.B. Cooper

Script:
A man disappeared from an airplane without opening a door.

In 1971, a passenger named D.B. Cooper hijacked a plane and jumped into the night with $200,000.

No body was ever found.

No parachute was ever recovered.

More than 50 years later, nobody knows what really happened to him.

Expected:
- Overall: 80+
- Hook: 85–95
- Risky Parts: 0–1
- Suggested Fixes: 0–2

Actual:
- Overall:
- Hook:
- Risk:
- Risky Parts:
- Suggested Fixes:

Status:
PASS / FAIL

---

## 2. Titanic History Fact

Script:
The Titanic received six iceberg warnings before the collision.

Several nearby ships warned the crew about dangerous ice ahead.

Yet the ship continued at high speed.

Just hours later, the Titanic struck an iceberg and sank.

More than 1,500 people lost their lives.

Expected:
- Overall: 80+
- Hook: 85–92
- Risky Parts: 0–1
- Suggested Fixes: 0–2

Actual:
- Overall:
- Hook:
- Risk:
- Risky Parts:
- Suggested Fixes:

Status:
PASS / FAIL

---

## 3. NASA Consequence Hook

Script:
One mistake cost NASA over $125 million.

Engineers ignored a small warning during development.

The problem seemed insignificant at first.

But after launch, the product failed.

The company lost millions and its reputation suffered for years.

Expected:
- Overall: 78+
- Hook: 85+
- Risky Parts: 0–1
- Suggested Fixes: 0–2

Actual:
- Overall:
- Hook:
- Risk:
- Risky Parts:
- Suggested Fixes:

Status:
PASS / FAIL

---

## 4. Weak Generic Script

Script:
Dogs are animals.

Many people have dogs.

Dogs can run.

Some dogs are big.

Dogs are popular pets.

Expected:
- Overall: below 65
- Hook: below 70
- Risky Parts: 1+
- Suggested Fixes: 2+

Actual:
- Overall:
- Hook:
- Risk:
- Risky Parts:
- Suggested Fixes:

Status:
PASS / FAIL

---

## 5. Wedding Mystery Hook

Script:
A woman vanished just hours before her wedding.

Her dress was ready.

The guests had already arrived.

But one person knew something nobody else did.

And by the next morning, the entire celebration had turned into a crime scene.

Expected:
- Overall: 70+
- Hook: 80+
- Risky Parts: 0–2
- Suggested Fixes: 0–3

Actual:
- Overall:
- Hook:
- Risk:
- Risky Parts:
- Suggested Fixes:

Status:
PASS / FAIL

---

## 6. Gravity What If

Script:
What if gravity suddenly became twice as strong?

At first, walking would feel almost impossible.

Buildings would crack under their own weight.

Planes would fall from the sky.

And the human body would struggle just to stay alive.

Expected:
- Overall: 70+
- Hook: 80+
- No “No reason to wait” issue

Actual:
- Overall:
- Hook:
- Risk:
- Risky Parts:
- Suggested Fixes:

Status:
PASS / FAIL

---

## 7. Rolex Business Story

Script:
Most people think Rolex sells watches.

But that is not the real reason people buy them.

A Rolex tells the same time as much cheaper watches.

What people are really buying is status.

And that strategy helped Rolex become one of the most valuable luxury brands in the world.

Expected:
- Overall: 75+
- Hook: 80+
- Risky Parts: 0–2
- Suggested Fixes: 0–3

Actual:
- Overall:
- Hook:
- Risk:
- Risky Parts:
- Suggested Fixes:

Status:
PASS / FAIL

---

## 8. Weak Factual Script

Script:
The Eiffel Tower was completed in 1889.

It was built for the World's Fair.

Millions of people visit it every year.

Today it is one of the most famous landmarks in the world.

Expected:
- Overall: 60–75
- Hook: 65–80
- Risky Parts: 1+
- Suggested Fixes: 2+

Actual:
- Overall:
- Hook:
- Risk:
- Risky Parts:
- Suggested Fixes:

Status:
PASS / FAIL

## Analysis Engine v2 — Stable Calibration

Status: stable MVP version  
TypeScript errors: 0  
UI changed: no  
Return format changed: no  

### Test 1 — Weak script
Expected:
- Overall: 25–35
- Hook: 18–30
- Risk: 65–80

Result:
- Overall: [insert result]
- Hook: [insert result]
- Risk: [insert result]

Notes:
Weak script stays weak. Hook score has a safe floor so generic weak openings are not scored near zero.

### Test 2 — Medium script
Expected:
- Overall: 70–77
- Hook: 65–78
- Risk: 25–40

Result:
- Overall: 76
- Hook: 77
- Risk: 26

Notes:
Medium script is calibrated well. It scores good but not 90+.

### Test 3 — Strong script
Expected:
- Overall: 78–85
- Hook: 82–90
- Risk: 20–35

Result:
- Overall: 83
- Hook: 86
- Risk: 20

Notes:
Strong script is calibrated well. It scores strong but not 100.

## Analysis Engine v2 — Stable MVP Calibration

Status: Stable MVP version  
TypeScript errors: 0  
UI changed: No  
Return format changed: No  

### Test Results

| Script Type | Overall | Hook | Retention Risk | Notes |
|---|---:|---:|---:|---|
| Weak | 32 | 26 | 61 | Correctly weak. Risky parts and fixes shown. |
| Medium Creator | 78 | 77 | 20 | Slightly high, but acceptable for MVP. |
| Strong Creator | 84 | 88 | 20 | Good calibration. Strong but not 95–100. |
| Sports / Comparison | 78 | 77 | 20 | Good. Real usable script is no longer underrated. |
| What If | 87 | 92 | 20 | Slightly high, but acceptable for now. |
| True Crime / Mystery | 87 | 92 | 20 | Slightly high, but acceptable for now. |
| Business / Brand | 73 | 67 | 20 | Acceptable. Hook could be slightly higher later. |

### Current Conclusion

Analysis Engine v2 now works well enough for MVP.

It correctly keeps weak scripts weak, gives strong scripts strong scores, and no longer underrates real story-driven scripts as heavily as before.

Remaining known issues:
- Retention Risk often bottoms out at 20.
- What If and True Crime scripts may score slightly too high.
- Business hooks may score slightly low.
- Suggested fixes can still feel generic in some cases.

Decision:
Do not keep rewriting the engine now. Move forward with the MVP and return to calibration later after testing more real user scripts.

## Analysis Engine v2 — Stable MVP

Status: Stable MVP version  
TypeScript errors: 0  
UI changed: No  
Return format changed: No  

### Final Test Results

| Script Type | Overall | Hook | Retention Risk | Notes |
|---|---:|---:|---:|---|
| Weak | 32 | 26 | 61 | Correctly weak. Shows risky parts and fixes. |
| Medium Creator | 78 | 77 | 20 | Slightly high, but acceptable for MVP. |
| Strong Creator | 84 | 88 | 20 | Strong but not 95–100. Good. |
| Sports / Comparison | 78 | 77 | 20 | Good. No longer underrated. |
| What If | 87 | 92 | 20 | Slightly high, but acceptable for now. |
| True Crime / Mystery | 87 | 92 | 20 | Slightly high, but acceptable for now. |
| Business / Brand | 73 | 67 | 20 | Acceptable. Hook could be improved later. |

### Known Issues

- Retention Risk often bottoms out at 20.
- What If and True Crime scripts can score slightly high.
- Business hooks can score slightly low.
- Suggested fixes can still feel generic in some cases.

### Decision

Do not rewrite the engine now. This version is good enough for MVP.  
Future improvements should be based on more real user scripts, not endless manual calibration.