---
name: avvarre:garden
description: Audit Avvarre project memory for stale context, broken conventions, and outdated tasks.
---

# Avvarre memory garden

Use this workflow when the user asks to inspect or refresh `.avvarre/` project memory.

Call the Avvarre MCP tool `avvarre_garden` with the absolute workspace root. Present context drift, convention mismatches, stale tasks (flag in-progress > 7 days, pending > 30 days), session log staleness, and the tool's recommendations. Offer to automatically apply the suggestions to update `.avvarre/` files if the user agrees.
