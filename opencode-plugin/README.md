# Avvarre OpenCode Plugin

Extend the OpenCode AI Coding Agent with persistent `.avvarre/` memory, automated style-guide enforcement, downsteam AST dependency alerts, and post-session code gardening loggers.

## Architecture

This plugin hooks directly into OpenCode's native event-driven API to coordinate quality control with the LLM context:

```
  OpenCode Client Session Start
              │
              ▼
       [session.created] ──► Checks if .avvarre/ is present; logs diagnostics
                             to the OpenCode app log panel.
              │
              ▼
    LLM executes tool (write/edit/patch)
              │
              ▼
     [tool.execute.after] ──► Parses modified files & queries .avvarre/graph.db.
              │              Appends Downstream AST Warnings + Test Gaps to output.
              ▼
   LLM finishes coding session
              │
              ▼
       [session.idle] ────► Performs Git diff/mod scans, logs changes to
                             .avvarre/session-log.md & prompts gardening checks.
```

---

## Installation

### Automatic Setup (Recommended)
Run the bootstrap installer at your project root:
```bash
npx -y avvarre@latest install --opencode
```
This automatically configures `mcp_config.json`, `plugin.json`, and links the plugin under `.opencode/plugins/avvarre`.

---

## Configuration

The plugin uses the following structures in your local project:

### 1. `plugin.json` (OpenCode Metadata)
Defines the plugin version and identifiers:
```json
{
  "name": "opencode-avvarre",
  "description": "Stop re-explaining everything to your AI. Just Avvarre it.",
  "version": "0.1.0"
}
```

### 2. `mcp_config.json` (MCP tool registrations)
OpenCode automatically exposes all 10 underlying Avvarre tools (`avvarre_file`, `avvarre_workspace`, `avvarre_pr`, `avvarre_get_impact`, `avvarre_garden`, `setup_claude_code`, etc.) to the LLM via standard Model Context Protocol:
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

---

## Intercepted TUI Slash Commands

When you use the OpenCode terminal interface (TUI), the plugin intercepts commands and routes them through the native MCP client:

*   `/avvarre:init` — Automatically setups `.avvarre/` memory guidelines.
*   `/avvarre:pr` — Runs style guide quality gate on git-changed files only.
*   `/avvarre:workspace` — Audits the entire workspace and prints a code score heatmap.
*   `/avvarre:garden` — Audits persistent memory for drift and stale tasks.
*   `/avvarre:autopilot` — Starts an autonomous loop resolving violations in active files until they hit Grade A.

> **Note:** To analyze a single file, ask the LLM directly — it will call the `avvarre_file` MCP tool. The TUI commands cover workspace-wide and lifecycle operations.

---

## Under the Hood

*   **Zero-Dependency SQLite:** The dependency graph CTE queries dynamically detect and load either Bun's high-performance native `bun:sqlite` engine or Node's native `node:sqlite` module.
*   **Incremental Session Writer:** Analyzes Git diff states during `session.idle` to append context-rich session logs to `.avvarre/session-log.md`.
