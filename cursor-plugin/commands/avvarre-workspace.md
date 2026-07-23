---
name: avvarre:workspace
description: Scan the entire workspace for code quality violations — returns a heatmap ranked by score with trend history.
---

# /avvarre:workspace

Scan the **entire workspace** for code quality.

## Instructions

1. Determine the workspace root path and detect the dominant programming language
2. Call the `avvarre_workspace` MCP tool with:
   - `directory`: absolute workspace root
   - `language`: the detected language
   - `include_trends`: true
3. Present the results:
   - Show the **overall workspace score** and **grade**
   - List files sorted by score (worst first)
   - Highlight any **critical violations**
   - Note any improving or declining trends
4. Offer to fix the worst-scoring files first, one at a time
