# Avvarre Antigravity Plugin

The official Google Antigravity integration for the Avvarre coding assistant.

This plugin extends your Antigravity agent with a persistent memory block (`.avvarre/`), automated code quality enforcement via MCP tools, and a unified pre-invocation hook.

## Features

- **Unified Pre-Invocation Hook**: Unlike other plugins that use separate hooks for bootstrapping, context loading, and skill suggestion, the Antigravity plugin combines all 3 into a single, high-performance `PreInvocation` hook (`hook-pre-invocation.cjs`). This hook runs before the agent takes action, ensuring `.avvarre/` is scaffolded, context is loaded, and community skills are detected and fetched dynamically.
- **MCP Tools Integration**: Exposes all 9 core Avvarre tools (including `avvarre_file`, `avvarre_workspace`, `avvarre_pr`, `setup_claude_code`, and `avvarre_garden`) directly to the Antigravity agent.
- **Rule Resources**: Exposes 21 MCP resources (`avvarre://rules/{language}`) so the agent can read Google Style Guide rule rationale on the fly without web scraping.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `avvarre_file` | Full AI + regex review with fixes (regex-only fallback). Pass `workspaceRoot` for history. |
| `avvarre_workspace` | Scan directory → heatmap, score trends, optional badge |
| `list_rules` | Browse all 650+ rules by language |
| `scaffold_avvarre` | Create `.avvarre/` ecosystem + dynamic skills |
| `setup_claude_code` | Bootstraps `.claude/`, `.avvarre/`, and `CLAUDE.md` in one command |
| `avvarre_pr` | PR quality gate on git diff. Takes `minScoreThreshold`. |
| `suggest_skills` | Auto-detect stack, fetch/decline community skills |
| `avvarre_get_impact` | Analyze changed files to compute blast radius, risk scores, and test gaps |
| `avvarre_garden` | Audits `.avvarre/` persistent memory for drift and stale tasks |

## Hooks

The `hooks.json` file defines:
- **`PreInvocation`**: Triggers `scripts/hook-pre-invocation.cjs` to validate context, bootstrap missing files, and fetch relevant skills before the LLM begins its turn.
- **`Impact Warn`**: Custom hook to warn the LLM if they are modifying a highly depended-upon function without adding tests.
