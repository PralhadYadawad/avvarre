---
name: avvarre-pr
description: Run Avvarre's quality gate on files changed in the current Git workspace.
---

# Avvarre PR quality gate

Use this workflow before a commit, pull request, or merge.

Call the Avvarre MCP tool `avvarre_pr` with the absolute workspace root. Use its default score threshold of 80 unless the user provides another threshold. Report the pass/fail result, affected files, scores, and violations. Treat critical and high findings as blockers; offer a focused fix-and-reverify pass for the failing files.
