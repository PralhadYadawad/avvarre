---
name: avvarre:pr
description: Run Avvarre's quality gate on files changed in the current Git workspace.
---

# Avvarre PR quality gate

Use this workflow before a commit, pull request, or merge.

Call the Avvarre MCP tool `avvarre_pr` with the absolute workspace root. Optionally pass `minScoreThreshold` (default is 80). Report the pass/fail result, affected files, scores, and violations. Treat critical and high findings as blockers and offer to fix them with `/avvarre:autopilot`. Re-run `avvarre_pr` after fixes to confirm the gate passes.
