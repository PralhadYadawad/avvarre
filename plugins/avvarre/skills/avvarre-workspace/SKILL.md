---
name: avvarre-workspace
description: Audit a workspace with Avvarre and prioritize the files that need attention.
---

# Avvarre workspace audit

Use this workflow when the user asks for a repository-wide quality audit.

1. Determine the absolute workspace root and the language to scan. If the workspace has several languages, ask the user which language to begin with or run focused scans one language at a time.
2. Call `avvarre_workspace` with `directory`, `language`, and an appropriate `ai_depth`. Use `ai_depth: 0` only when the user requests offline or regex-only analysis.
3. Present the heatmap worst-first, highlight critical and high-severity issues, and identify the first file worth fixing.
4. Only edit after the user asks, then use the `avvarre` skill to fix and verify each selected file.
