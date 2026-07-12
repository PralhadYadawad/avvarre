# Coding Conventions

## Language & Runtime
- TypeScript (strict mode), Node.js, ES modules (`.js` imports in source)
- Build: `tsc` → `dist/`. No bundler.

## Naming
- `camelCase` — functions, variables, parameters
- `PascalCase` — classes, interfaces, types, enums
- `UPPER_SNAKE_CASE` — constants
- `snake_case` — file names for multi-word files (e.g., `pr_scanner.ts`, `skill_generator.ts`)
- Rule IDs: `LANG-CATEGORY-NN` (e.g., `PY-EXC-01`, `TS-TYPE-03`)

## File Organization
- Max **1500 lines** per file — split if exceeded
- One module per file, one responsibility
- Group by layer: `analyzer/`, `ai/`, `ecosystem/`, `workspace/`
- Tests adjacent: `utils.ts` → `test-utils.ts` (in `codebase_test/`)

## Imports
1. Node built-ins (`fs`, `path`)
2. Third-party (`@modelcontextprotocol/sdk`, `openai`)
3. Local project imports
4. Type-only imports (`import type { ... }`)

Separate groups with blank lines. Always use `.js` extension in import paths.

## Error Handling
- Never silently swallow errors — log or re-throw with context
- Graceful degradation: AI fails → fallback to regex, file unreadable → skip
- Validate at boundaries (MCP tool inputs), trust internal code

## Documentation
- Every public function/exported symbol has a JSDoc docstring
- Update docstring BEFORE changing function logic
- Comments explain WHY, not WHAT
- No orphan TODOs — every TODO has a task in `tasks.md`

## Google Style Compliance
- This project enforces Google Style Guides via its own tools (dogfooding)
- Run `/avvarre` before committing to verify compliance

## Distribution Files
- `marketing/awesome-copilot/` mirrors the awesome-copilot repo structure — do not use our `plugin/` format there
- awesome-copilot agent.md must NOT have `mcp-servers` frontmatter — MCP setup goes in the plugin README as a prerequisite
- awesome-copilot plugin.json uses flat `agents`/`skills` arrays, not our `components` wrapper
- awesome-copilot PRs target the `staged` branch, not `main`

## Cross-Plugin Conventions
- Copilot hooks: PascalCase events (`SessionStart`), `{ "type": "command", "command": "..." }` format, relative paths from repo root
- Claude Code hooks: PascalCase events (`SessionStart`, `Stop`), nested `{ matcher, hooks: [{ type, command }] }`, uses `${CLAUDE_PLUGIN_ROOT}`
- Cursor hooks: camelCase events (`sessionStart`, `sessionEnd`), flat `{ "command": "..." }`, self-contained scripts in `cursor-plugin/scripts/`
- OpenCode hooks: `session.created` (bootstrap), `tool.execute.after` (dependency graph warnings), `session.idle` (session logging), `tui.command.execute` (command interception), plugin entry at `plugins/avvarre/index.ts` written in TypeScript and loaded natively by Bun.
- When adding a new hook: add to all 4 plugins + `~/.claude/settings.json` (for local Claude Code)
- When adding a new MCP tool: add to Claude `SKILL.md` tools table + agent `allowed-tools` + Cursor `SKILL.md` tools table + OpenCode custom tools list

## Plugin Distribution Rules
- Plugins MUST be self-contained — no `../` references, no hardcoded paths, no deps on sibling directories
- Hook scripts must be bundled inside the plugin (e.g., `hooks/hook-*.cjs`), not referenced from repo root `scripts/`
- `.mcp.json` must use `npx -y avvarre@latest` for distribution, never local `dist/` paths
- `plugin.json` must include: name (kebab-case), description, version, author, license, homepage, repository, keywords
- Plugin commands are namespaced: `/avvarre:command-name` (not `/command-name`)
- Test locally with `claude --plugin-dir ./claude-plugin` before submitting
