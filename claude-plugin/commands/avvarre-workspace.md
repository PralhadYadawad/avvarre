---
name: avvarre-workspace
description: Scan the entire workspace for code quality violations across all supported files.
---

# /avvarre-workspace

Scan the **entire workspace** for code quality.

## Instructions

1. Determine the workspace root path
2. Use the `avvarre_workspace` MCP tool with the workspace root
3. Present the results:
   - Show the **overall workspace score**
   - List files sorted by score (worst first)
   - Highlight any **critical violations**
4. Offer to fix the worst-scoring files first, one at a time
