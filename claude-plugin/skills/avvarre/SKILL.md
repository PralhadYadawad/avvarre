---
name: avvarre
description: Analyze code quality against Google style guides for 21 languages/formats. Fix-verify loops, compressed task sync, workspace heatmaps.
---

# avvarre — Code Quality Skill

Enforces **Google style guides** across 21 languages/formats via regex + optional AI deep analysis.

**Languages:** Python, JavaScript, TypeScript, Java, Go, C++, Kotlin, Dart, Swift, Objective-C, C#, Shell, R
**Formats:** HTML, CSS, Markdown, JSON, XML, Vimscript, Lisp, Angular

---

## Tools Reference

| Tool | When to Use |
|------|-------------|
| `avvarre_file` | Analyze a single file — returns score, violations, fix suggestions. Falls back to regex-only if no API key. Pass `workspaceRoot` to auto-log to history. |
| `avvarre_workspace` | Scan all files in a directory — returns heatmap, score trends, and optional badge. Configurable via `ai_depth`, `include_badge`, `include_trends`. |
| `list_rules` | Show all active rules for a language |
| `avvarre_pr` | Scan only git-changed files (quality gate). Takes optional `minScoreThreshold` (default 80). |
| `scaffold_avvarre` | Initialize `.avvarre/` directory with project memory templates |
| `setup_claude_code` | Bootsrap Claude Code — creates `.claude/`, `.avvarre/`, and `CLAUDE.md` in one command |
| `suggest_skills` | Auto-detect stack, fetch community skills. Use detect/fetch/decline actions; declines are saved to `.declined.json`. |
| `avvarre_get_impact` | Queries AST graph. Returns `riskScore`, `reviewPriorities`, `testGaps`, and impacted files. |
| `avvarre_garden` | Audits workspace persistent memory folders for drift and stale tasks |

---

## Core Workflow: Fix-Verify Loop

1. **Scan** — run `avvarre_file` on the target file
2. **Fix by severity** — critical → high → medium → low
3. **Re-verify** — run `avvarre_file` again after fixes
4. **Iterate** — repeat until score reaches 85+ (good) or 95+ (excellent)

**Never skip re-verification.** Fixes can introduce new violations.

### Fix Priority

| Priority | Severity | Examples |
|:--------:|:--------:|---------|
| 1st | `critical` | Missing public class match, exported without doc |
| 2nd | `high` | Empty catch blocks, wildcard imports, force-unwrap |
| 3rd | `medium` | Naming violations (use `#rename` for safe renames), missing braces, wrong casing |
| 4th | `low` | Line length, indentation, whitespace |

---

## Compressed Task Protocol

Tasks in `.avvarre/tasks.md` use **compressed format** — one line per feature, with a step chain.

### Writing (after completing work)
Compress 3-5 internal subtasks into 1 line:
```
[x] Built user auth flow (steps: schema→routes→middleware→tests→docs)
[/] Refactoring payments (done: extract-service→add-types | next: update-routes→tests)
[ ] Add rate limiting to API endpoints
```

### Reading (picking up someone else's work)
Expand the step chain into your internal memory:
- `(steps: a→b→c→d→e)` → 5 completed subtasks
- `(done: a→b | next: c→d)` → resume from c
- No chain = atomic task

---

## Autopilot Mode

Use `/avvarre:autopilot` for autonomous fix-verify loops:
- Scans → fixes highest-severity violation → re-verifies → repeats until score 90+
- Uses `#rename` for naming violations instead of manual find-replace
- Max 15 iterations safety cap.

---

## Proactive Triggers

- **File size** — if a file approaches **1500 lines**, suggest splitting before `UNI-SIZE-01` fires
- **No .avvarre/ dir** — suggest `scaffold_avvarre` when starting on a new project
- **Read conventions first** — if `.avvarre/conventions.md` exists, read it before writing code
