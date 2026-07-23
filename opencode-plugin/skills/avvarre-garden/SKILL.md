---
name: avvarre-garden
description: Audit .avvarre/ project memory for context drift, stale tasks, and conventions mismatches
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: maintenance
---
Call the `avvarre_garden` tool from the `avvarre` MCP server with:
- `workspaceRoot`: absolute path of the current workspace root directory

Report all alerts found, grouped by category:
1. Context drift — directories not described in `context.md`
2. Broken conventions — files violating the conventions in `.avvarre/conventions.md`
3. Stale tasks — in-progress tasks older than 7 days or pending tasks older than 30 days
4. Session log freshness — whether the session log is outdated

For each alert, suggest a concrete action to resolve it. Offer to automatically apply the suggestions to update the files in `.avvarre/` if requested.
