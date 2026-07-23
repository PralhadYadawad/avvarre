---
name: avvarre
description: Analyze active file code quality against Google style guides for 21 languages/formats. Runs fix-verify loops.
---

# avvarre — Code Quality Skill

Enforces **Google style guides** across 21 languages/formats via regex + optional AI deep analysis.

**Languages:** Python, JavaScript, TypeScript, Java, Go, C++, Kotlin, Dart, Swift, Objective-C, C#, Shell, R
**Formats:** HTML, CSS, Markdown, JSON, XML, Vimscript, Lisp, Angular

## Tools Reference

| Tool | When to Use |
|------|-------------|
| `avvarre_file` | Analyze a single file — returns score, violations, fix suggestions. Pass code, language, filename, and workspaceRoot. Falls back to regex-only if no API key. |
| `avvarre_workspace` | Scan all files in a directory — returns heatmap, score trends, and optional badge. Pass directory, language, include_trends. |
| `list_rules` | Show all active rules for a language |
| `avvarre_pr` | Scan only git-changed files (quality gate). Pass workspaceRoot, optional minScoreThreshold (default 80). |
| `scaffold_avvarre` | Initialize `.avvarre/` directory with project memory templates |
| `setup_claude_code` | Bootstrap Claude Code — creates `.claude/`, `.avvarre/`, and `CLAUDE.md` |
| `suggest_skills` | Auto-detect stack, fetch community skills |
| `avvarre_get_impact` | Query AST graph for blast radius, risk scores, and test gaps |
| `avvarre_garden` | Audit workspace persistent memory for drift and stale tasks |

---

## Core Workflow: Fix-Verify Loop

1. **Scan** — run `avvarre_file` on the target file.
2. **Present** — show the quality score prominently, group violations by severity.
3. **Offer to fix** — starting with the highest severity.
4. **Re-verify** — run `avvarre_file` again after fixes.
5. **Iterate** — repeat until score reaches 90+ (Grade A).

**Never skip re-verification.** Fixes can introduce new violations.

### Fix Priority

| Priority | Severity | Examples |
|:--------:|:--------:|---------|
| 1st | `critical` | Missing public class match, exported without doc |
| 2nd | `high` | Empty catch blocks, wildcard imports, force-unwrap |
| 3rd | `medium` | Naming violations (use `#rename` for safe renames), missing braces, wrong casing |
| 4th | `low` | Line length, indentation, whitespace |
