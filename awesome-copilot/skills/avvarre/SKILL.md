---
name: avvarre
description: 'Analyze code quality against 650+ Google Style Guide rules across 21 languages. Fix-verify loops, workspace heatmaps, persistent AI memory.'
---

# avvarre -- Code Quality Skill

Enforces **Google Style Guides** across 21 languages/formats via regex + optional AI deep analysis.

**Languages:** Python, JavaScript, TypeScript, Java, Go, C++, Kotlin, Dart, Swift, Objective-C, C#, Shell, R
**Formats:** HTML, CSS, Markdown, JSON, XML, Vimscript, Lisp, Angular

## Prerequisites

This skill requires the avvarre MCP server. Add to your MCP config:

```json
{
  "mcpServers": {
    "avvarre": {
      "command": "npx",
      "args": ["-y", "avvarre@latest"]
    }
  }
}
```

No API key needed for regex analysis. For optional AI deep review, add env vars:

```json
{
  "env": {
    "AI_BASE_URL": "https://api.groq.com/openai/v1",
    "AI_API_KEY": "your-key",
    "AI_MODEL": "llama-3.3-70b-versatile"
  }
}
```

---

## Tools Reference

| Tool | When to Use |
|------|-------------|
| `avvarre_file` | Analyze a single file -- returns score, violations, fix suggestions. Falls back to regex-only if no API key. Pass `workspaceRoot` to auto-log to history. |
| `avvarre_workspace` | Scan all files in a directory -- returns heatmap, score trends, and optional badge. Configurable via `ai_depth`, `include_badge`, `include_trends`. |
| `list_rules` | Show all active rules for a language |
| `avvarre_pr` | Scan only git-changed files (quality gate). Takes optional `minScoreThreshold` (default 80). |
| `scaffold_avvarre` | Initialize `.avvarre/` directory with project memory templates |
| `setup_claude_code` | Bootsrap Claude Code — creates `.claude/`, `.avvarre/`, and `CLAUDE.md` in one command |
| `suggest_skills` | Auto-detect stack, fetch community skills. Use detect/fetch/decline actions; declines are saved to `.declined.json`. |
| `avvarre_get_impact` | Queries AST graph. Returns `riskScore`, `reviewPriorities`, `testGaps`, and impacted files. |
| `avvarre_garden` | Audits workspace persistent memory folders for drift and stale tasks |

---

## Core Workflow: Fix-Verify Loop

1. **Scan** -- run `avvarre_file` on the target file
2. **Fix by severity** -- critical -> high -> medium -> low
3. **Re-verify** -- run `avvarre_file` again after fixes
4. **Iterate** -- repeat until score reaches 85+ (good) or 95+ (excellent)

**Never skip re-verification.** Fixes can introduce new violations.

### Fix Priority

| Priority | Severity | Examples |
|:--------:|:--------:|---------|
| 1st | `critical` | Missing public class match, exported without doc |
| 2nd | `high` | Empty catch blocks, wildcard imports, force-unwrap |
| 3rd | `medium` | Naming violations (use `#rename` for safe renames), missing braces, wrong casing |
| 4th | `low` | Line length, indentation, whitespace |

---

## Scoring

| Grade | Score | Meaning |
|:-----:|:-----:|---------|
| A | 90-100 | Production-ready, Google-grade quality |
| B | 80-89 | Good -- minor issues only |
| C | 70-79 | Needs attention -- medium-severity violations |
| D | 60-69 | Poor -- significant style violations |
| F | 0-59 | Critical -- major structural/naming issues |

---

## Persistent AI Memory

avvarre creates a `.avvarre/` directory in your project (committed to git) that gives your AI long-term memory:

- **`context.md`** -- what the project is, tech stack, architecture
- **`conventions.md`** -- how to write code here, naming rules, patterns
- **`tasks.md`** -- what's done and what's next (compressed step chains)
- **`session-log.md`** -- what happened in each coding session

Run `scaffold_avvarre` to set it up. Switch machines, switch developers, switch IDEs -- the AI picks up where the last session left off.

---

## Proactive Triggers

- **File size** -- if a file approaches 1500 lines, suggest splitting
- **No .avvarre/ dir** -- before calling `scaffold_avvarre`, ask ONE question: "Are you **brainstorming** an idea, **planning** something you have in mind, or **ready to build** something specific?" Branch your discovery questions accordingly: brainstorming → explore the problem space only (no stack/UI questions yet); planning → rough scope + optional tech preferences; building → full architecture questions. Seed `tasks.md` to match: brainstorming → `[ ] Define problem statement`, planning → `[ ] Finalize scope and tech decisions`, building → `[ ] Initial project scaffold`
- **Read conventions first** -- if `.avvarre/conventions.md` exists, read it before writing code
