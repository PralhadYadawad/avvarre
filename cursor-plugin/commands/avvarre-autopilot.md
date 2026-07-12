---
name: avvarre-autopilot
description: Autonomous fix-verify loop that keeps fixing violations until the file reaches Grade A (90+).
---

# /avvarre-autopilot

Autonomously fix a file until it reaches **Grade A (score 90+)**.

## Instructions

1. Determine the currently open file
2. Run `avvarre_file` on the file — record the initial score
3. **Loop:**
   a. If score >= 90 → go to step 4
   b. Pick the highest-severity violation
   c. Fix it using the suggested fix
   d. Run `avvarre_file` again → record new score
   e. If score decreased or is unchanged after 3 consecutive iterations → stop loop, report blocker
   f. Repeat from 3a
4. **Done:** Report before/after scores and total violations fixed

## Guardrails

- **Max 15 iterations** — if not Grade A after 15 fix-verify cycles, stop and report remaining violations
- **Never skip re-verification** — fixes can introduce new violations
- **Preserve semantics** — only fix style violations, never change logic
- **Log progress** — after completion, update `.avvarre/tasks.md` with results
