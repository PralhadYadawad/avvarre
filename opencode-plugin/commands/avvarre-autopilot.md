---
description: Autonomous fix-verify loop that keeps fixing violations until the file reaches Grade A (90+)
---
Use the avvarre MCP server to autonomously fix a file until it reaches Grade A (score 90+).

1. Determine the currently open file
2. Call `avvarre_file` on the file and record the initial score
3. **Loop:**
   a. If score >= 90, go to step 4
   b. Pick the highest-severity violation
   c. Fix it using the suggested `actionableFix`
   d. Call `avvarre_file` again and record the new score
   e. If score decreased or is unchanged after 3 consecutive iterations, stop and report blocker
   f. Repeat from step 3a
4. **Done:** Report before/after scores and total violations fixed

**Guardrails:**
- Maximum **15 iterations** — if not Grade A after 15 fix-verify cycles, stop and report remaining violations
- Never skip re-verification — fixes can introduce new violations
- Only fix style violations, never change logic
- After completion, update `.avvarre/tasks.md` with results
