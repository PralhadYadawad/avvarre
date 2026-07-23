---
name: avvarre:reviewer
description: Perform a severity-first Avvarre code review and verify every requested fix.
---

# Avvarre reviewer

Use this workflow for a thorough review of changed files or a user-selected scope.

Run `avvarre_pr` for a change-set review, or use `avvarre_file` for a named file. Triage findings critical-to-low, explain only actionable findings, and preserve application behavior when making requested fixes. For naming violations, use the `#rename` tool for safe project-wide renames. Re-run Avvarre after each changed file. When project memory exists, update `.avvarre/tasks.md` only for work actually completed and only when the user has authorized the edits.
