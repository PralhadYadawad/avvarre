# Avvarre OpenCode Plugin

Extend the OpenCode AI Coding Agent with persistent `.avvarre/` memory, automated style-guide enforcement, downstream AST dependency alerts, and post-session code gardening loggers.

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
 [experimental.chat.system.transform] ──► Injects project conventions,
   (on first LLM call)                     last session summary, pending
                                           tasks, and available skills
                                           into the system prompt.
                                         ► Detects tech stack (package.json,
                                           config files, extensions) and
                                           suggests community skills.
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
                          .avvarre/session-log.md, runs gardening checks for
                          memory drift (context rot, stale tasks, session
                          log staleness), and prompts memory updates.
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
  "version": "0.5.1"
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

## How It Works

### Context Loading (Session Start)
On the first LLM call, the plugin automatically reads and injects into the system prompt:
- **`.avvarre/conventions.md`** — Full project conventions that the AI must follow
- **`.avvarre/session-log.md`** — Last session summary for continuity across sessions
- **`.avvarre/tasks.md`** — Pending and in-progress tasks so the AI knows what to work on
- **`.avvarre/skills/`** — Available skill file listings

### Skill Suggestion (Session Start)
The plugin auto-detects your tech stack by scanning `package.json`, `go.mod`, `Cargo.toml`, config files, and file extensions. If community skills are available for your detected frameworks (react, nextjs, typescript, python, go, etc.) and haven't been fetched or declined, a suggestion is injected into the system prompt.

### Downstream Impact Warnings (Post-Tool)
When the LLM edits a file, the plugin queries the SQLite AST dependency graph to find all downstream callers and subclasses. If impacts are found, a warning is appended to the tool output with:
- The call chain (CALLS / INHERITS edges, up to 3 levels deep)
- Test gap alerts — reports if impacted code is untested

### Session Log & Gardening (Session Idle)
When the session becomes idle, the plugin:
1. Scans `git diff` to find changed files
2. Writes an incremental entry to `.avvarre/session-log.md`
3. Runs gardening checks for memory drift (context rot, stale tasks, log staleness)
4. Prompts the developer to update memory files if code was changed

---

## Under the Hood

*   **Zero-Dependency SQLite:** The dependency graph CTE queries dynamically detect and load either Bun's high-performance native `bun:sqlite` engine or Node's native `node:sqlite` module.
*   **Incremental Session Writer:** Analyzes Git diff states during `session.idle` to append context-rich session logs to `.avvarre/session-log.md`.
*   **Tech Stack Detection:** Scans package.json, language configs, and file extensions to detect frameworks for community skill suggestions.
*   **System Prompt Injection:** Uses `experimental.chat.system.transform` to inject avvarre context directly into the system prompt, with one-shot guards to avoid re-injection.
