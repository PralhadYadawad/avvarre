---
name: avvarre:pr
description: Quality gate scanning for git-changed files. Enforces style guides prior to commits or PR submissions.
---

# avvarre:pr — Pull Request Quality Gate

Analyzes only the files modified in the git diff against the current branch.

## PR Scanning Workflow

1. **Scan Changes**: Execute `avvarre_pr` with the workspace root. Optionally pass `minScoreThreshold` (default 80).
2. **Report Results**: Show whether the PR **passes** or **fails**. List files below threshold with their scores.
3. **Flag Blockers**: Flag any critical or high violations as blockers and offer to fix them with `/avvarre:autopilot`.
4. **Confirm**: Re-run `avvarre_pr` after fixes to ensure the quality gate passes.
