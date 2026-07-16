---
description: Run Avvarre PR quality gate — scan changed files and report pass/fail
---
Use the avvarre MCP server to run a PR quality gate on all files changed in the current git diff.

Call the `avvarre_pr` tool from the `avvarre` MCP server with:
- `workspaceRoot`: absolute path of the current workspace root directory

Report clearly whether the PR **passes** or **fails** the quality threshold. List any files that fell below the score threshold and include their scores. Suggest which files to fix first based on severity.
