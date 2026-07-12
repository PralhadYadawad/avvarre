---
name: avvarre-pr
description: Quality gate scanning for git-changed files. Enforces style guides prior to commits or PR submissions.
---

# avvarre-pr — Pull Request Quality Gate

Analyzes only the files modified in the current branch compared to main/staging, or the unstaged files in the working tree.

## PR Scanning Workflow

1.  **Detect Changes**: Execute `avvarre_pr` to scan git-changed files.
2.  **Verify Score**: Ensure all modified files score **85+** (good) or **95+** (excellent).
3.  **Fix Blockers**: Rectify any critical or high violations before attempting to commit or open a pull request.
4.  **Confirm**: Re-run `avvarre_pr` to ensure the quality gate passes.
