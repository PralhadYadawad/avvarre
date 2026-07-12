---
name: avvarre-autopilot
description: Run autonomous fix-verify loops. Automatically resolves high-severity violations until target quality scores are met.
---

# avvarre-autopilot — Autonomous Refactoring Autopilot

Enables the agent to systematically run fix-verify loops on a target file without requiring manual developer input for each step.

## Autopilot Workflow

1.  **Scan**: Run initial analysis using `avvarre_file` on the target file.
2.  **Sort & Select**: Identify the highest-severity violation (critical/high).
3.  **Fix Naming Safely**: If the violation is naming-casing, use the `#rename` tool to perform a project-wide refactor instead of find-replace.
4.  **Auto-Verify**: Make edits, then immediately re-run `avvarre_file` to verify the new score.
5.  **Stop Condition**: Repeat steps 2-4 until the score is **90+** or the safety cap of **15 iterations** is reached.
