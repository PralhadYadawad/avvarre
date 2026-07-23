---
description: Audit .avvarre/ project memory for context drift, stale tasks, and conventions mismatches
---
Use the avvarre MCP server to audit the project memory folder for staleness and drift.

Call the `avvarre_garden` tool from the `avvarre` MCP server with:
- `workspaceRoot`: absolute path of the current workspace root directory

Report all alerts found, grouped by category:
1. **Context drift** — directories not described in `context.md`
2. **Broken conventions** — files violating the conventions in `.avvarre/conventions.md`
3. **Stale tasks** — in-progress tasks older than 7 days or pending tasks older than 30 days
4. **Session log freshness** — whether the session log is outdated

For each alert, suggest a concrete action to resolve it. Offer to automatically apply the suggestions to update the files in `.avvarre/` if requested.
