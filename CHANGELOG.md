# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-03-21

### Removed
- **`analyze_code` tool** — redundant with `avvarre_file` regex-only fallback
- **`generate_avvarre_badge` tool** — folded into `avvarre_workspace` (`include_badge` flag)
- **`avvarre_trends` tool** — folded into `avvarre_workspace` (`include_trends` flag, on by default)
- **`set_vibe_context` tool** — niche, agents manage context natively
- **`/avvarre-rules` command** — agents call `list_rules` directly
- **2 redundant hooks** — merged Conventions Bridge + Skill Loader into "Context Loader", Session Memory + Task Sync into "Session Sync"

### Changed
- **MCP tools**: 9 → 5 (avvarre_file, avvarre_workspace, list_rules, scaffold_avvarre, avvarre_pr)
- **Hooks**: 6 → 4 (Bootstrap, Context Loader, Session Sync, Score Check)
- **Commands**: 6 → 5 (removed /avvarre-rules)
- **avvarre_workspace**: Now includes score trends (on by default) and optional badge generation
- **avvarre_file**: Updated description — explicitly notes regex-only fallback
- **server.ts**: Version bumped to 0.4.0, removed unused imports

### Added
- **`/avvarre-autopilot` command** — autonomous fix-verify loop until Grade A (90+) using `task_complete` (VS Code 1.111+)
- **`#rename` tool integration** — agent.md and SKILL.md now use native `#rename` for naming violations
- **Conventions Bridge hook** (merged into Context Loader) — reads conventions.md every session
- **CONTRIBUTING.md** — complete rewrite with ecosystem, hooks, skills, compressed task protocol

## [0.4.0] - 2026-03-21

### Changed
- **SKILL.md**: Trimmed from 217 to 72 lines — removed redundant sections, added compressed task protocol
- **agent.md**: Trimmed from 66 to 30 lines — fixed stale "13 languages" to "21 languages/formats"
- **plugin.json**: Fixed wrong agent path reference
- **.avvarre/tasks.md**: 83% smaller — all completed phases compressed to step chains, only pending tasks visible
- **.avvarre/context.md**: 66% smaller — removed MCP schemas, user scenarios, competitive positioning
- **.avvarre/conventions.md**: Replaced generic template with actual project conventions
- **scaffold.ts**: Replaced verbose "Vibe Commits" section with compressed task sync protocol

### Added
- **Compressed Task Protocol**: AI agents compress 3-5 subtasks into 1 line with step chains for handoffs
- **Bootstrap hook**: `onAgentStart` — suggests `/avvarre-init` if no `.avvarre/` exists
- **Cross-platform instructions**: `CLAUDE.md` (Claude Code), `.cursorrules` (Cursor), updated `.github/copilot-instructions.md` (Copilot) — all share the same behaviors
- **README.md**: Complete rewrite — ecosystem-first positioning, accurate 21-language count, marketing-ready

## [0.3.0] - 2026-03-16

### Added
- **Layer 1**: 430+ pattern rules across 21 languages/formats enforcing every Google Style Guide
- **Layer 2**: AI deep review compatible with Google Gemini, OpenAI, Groq, Together AI, Fireworks, Ollama, LM Studio
- **Layer 3**: VS Code agent plugin with 4 hooks, 5 slash commands, custom reviewer agent, skill file
- **Layer 4**: `.avvarre/` ecosystem scaffolding — persistent project memory with context, conventions, tasks, session log, dynamic skills
- **Layer 5**: Score history tracking, PR quality gates, README badge generation, npm publishing, GitHub Actions CI
- **9 MCP tools**: `analyze_code`, `avvarre_file`, `avvarre_workspace`, `list_rules`, `scaffold_avvarre`, `avvarre_trends`, `avvarre_pr`, `generate_avvarre_badge`, `set_vibe_context`
- **21 MCP resources**: `avvarre://rules/{language}` for every supported language
