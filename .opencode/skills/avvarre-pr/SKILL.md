---
name: avvarre-pr
description: Run a PR quality gate on git-changed files and report pass or fail
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: review
---
Call the `avvarre_pr` tool from the `avvarre` MCP server with:
- `workspaceRoot`: absolute path of the current workspace root directory
- `minScoreThreshold`: optionally pass a custom threshold (default is 80)

Report clearly whether the PR passes or fails the quality threshold. List any files that fell below the score threshold and include their scores. Flag critical or high violations as blockers and offer to fix them with the avvarre skill.
