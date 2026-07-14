# avvarre — Copilot Instructions

## Project
avvarre is an MCP server + VS Code agent plugin enforcing Google Style Guides across 21 languages/formats (Python, JS, TS, Java, Go, C++, Kotlin, Dart, Swift, ObjC, C#, Shell, R, HTML, CSS, Markdown, JSON, XML, Vimscript, Lisp, Angular). 650+ regex rules + optional AI deep review.

TypeScript, Node.js, ES modules. Build: `npm run build`. Run: `npm start`.

## Key Paths
- Rules: `src/analyzer/rules/` | Engine: `src/analyzer/engine.ts` | Scorer: `src/analyzer/scorer.ts`
- AI clients: `src/ai/` | MCP server: `src/server.ts` | Entry: `src/index.ts`
- Project memory: `.avvarre/` (context.md, tasks.md, conventions.md, session-log.md)
- Plugin: `plugin/` (hooks.json, SKILL.md, agent.md, commands/)

## MCP Tools
| Tool | Purpose |
|------|---------|
| `avvarre_file` | Full AI + regex review with fixes (regex-only fallback if no API key) |
| `avvarre_workspace` | Scan directory → heatmap, trends, optional badge |
| `list_rules` | Browse all 650+ rules by language |
| `scaffold_avvarre` | Create `.avvarre/` ecosystem |
| `avvarre_pr` | PR quality gate on git diff |

No API key = regex-only mode. Never crashes from missing config.

## Conventions
- Read `.avvarre/conventions.md` before writing code
- Rule IDs: `LANG-CATEGORY-NN` (e.g., `PY-EXC-01`)
- Imports use `.js` extensions. Max 1500 lines per file.

## On Every Session End
1. **Session log** — Append to `.avvarre/session-log.md`: `## YYYY-MM-DD` with bullet changes, files modified, next steps.
2. **Task sync** — Update `.avvarre/tasks.md` using compressed format: `[x] Summary (steps: a→b→c→d)` for done, `[/] Summary (done: a→b | next: c→d)` for partial. Never expand subtasks in the .md — the step chain IS the expansion key.
3. **Quality nudge** — If source code was written or changed, end with: "Run /avvarre on changed files?"

## Before Building a Feature
- Check `.avvarre/skills/` for a matching skill file (e.g., `react_ui_guidelines.md`, `authentication_flow.md`)
- If one exists, read ONLY that skill — don't load all skills at once
- Follow the architectural rules in that skill file while coding

## On Picking Up Work
- If no `.avvarre/` directory exists, suggest: "Run /avvarre-init to set up project memory."
- Read `.avvarre/session-log.md` and `.avvarre/tasks.md` first
- Expand step chains from tasks.md into your internal working memory
- Read `.avvarre/conventions.md` before writing code
