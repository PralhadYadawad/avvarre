---
name: avvarre:autopilot
description: Run autonomous fix-verify loops. Automatically resolves violations until the file reaches Grade A (90+).
---

# avvarre:autopilot — Autonomous Refactoring Autopilot

Enables the agent to systematically run fix-verify loops on a target file until Grade A (score 90+) is reached.

## Autopilot Workflow

1. **Scan**: Run `avvarre_file` on the target file and record the initial score.
2. **Loop**:
   a. If score >= 90, report success.
   b. Pick the highest-severity violation.
   c. Fix it using the suggested fix. For naming violations, use the `#rename` tool for safe project-wide renames instead of manual find-replace.
   d. Re-run `avvarre_file` to verify the new score.
   e. If score decreased or is unchanged after 3 consecutive iterations, stop and report blocker.
   f. Repeat from step 2a.
3. **Done**: Report before/after scores and total violations fixed. Update `.avvarre/tasks.md` with results.

## Guardrails

- Maximum **15 iterations** — stop and report remaining violations if not Grade A after 15 cycles.
- Never skip re-verification — fixes can introduce new violations.
- Preserve semantics — only fix style violations, never change logic.
