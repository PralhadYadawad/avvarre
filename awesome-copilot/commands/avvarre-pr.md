---
name: avvarre:pr
description: Analyze only the files changed in the current git branch to enforce quality on new code.
---

# /avvarre:pr

Review only **git-changed files** — ideal as a pre-commit quality gate.

## Instructions

1. Determine the workspace root
2. Call the `avvarre_pr` MCP tool with the workspace root. You may optionally pass `minScoreThreshold` (default is 80).
3. The tool will automatically run `git diff`, scan the changed files, and return a pass/fail report.
4. Present the tool's output to the user.
5. Flag any **critical or high** violations as blockers and offer to fix them with `/avvarre:autopilot`.
