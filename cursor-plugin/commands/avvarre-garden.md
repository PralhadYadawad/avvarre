---
name: avvarre-garden
description: Audit the workspace persistent memory folders (.avvarre/) to detect context drift, conventions mismatch, and stalled task lists.
---

# /avvarre-garden

Audit the workspace persistent memory folders (`.avvarre/`) to detect context drift, conventions mismatch, and stalled task lists.

## Instructions

1. Use the `avvarre_garden` MCP tool with the current workspace directory.
2. Present the results:
   - If there is **stale context**, show the mismatches found in `context.md` (e.g. tech stack drift, directory mismatches).
   - If there are **broken conventions**, show the files violating conventions.
   - If there are **stale tasks**, list the tasks that need updating or archiving.
   - Show the **gardening suggestions** directly to the user.
3. Offer to automatically apply the suggestions to update the files in `.avvarre/` if requested.
