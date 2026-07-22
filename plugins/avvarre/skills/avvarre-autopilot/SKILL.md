---
name: avvarre-autopilot
description: Autonomously apply and verify style fixes until a source file reaches Grade A or progress stops.
---

# Avvarre autopilot

Use this workflow only when the user authorizes autonomous remediation of a specific file.

1. Read the target file, infer its language, and call `avvarre_file`.
2. If the score is at least 90, report success without editing.
3. Otherwise fix the highest-severity actionable finding with the smallest semantics-preserving change.
4. Re-read the file and call `avvarre_file` after every edit.
5. Stop at Grade A, after 15 edit/verify iterations, or after three consecutive non-improving scores. Report before/after score, fixes made, and remaining blockers.

Never make speculative logic changes merely to raise a style score.
