---
description: Scan the entire workspace for code quality issues and show a heatmap
---
Use the avvarre MCP server to audit the entire workspace for code quality.

Call the `avvarre_workspace` tool from the `avvarre` MCP server with:
- `directory`: absolute path of the current workspace root directory
- `language`: detect the dominant programming language in the project and set it accordingly
- `include_trends`: true (to show score history)

Summarize the heatmap results, highlight the lowest-scoring files, note any improving or declining trends, and recommend which files to address first.
