---
description: Analyze the currently active file for code quality violations against Google style guides
---
Use the avvarre MCP server to analyze the currently active file for code quality.

Call the `avvarre_file` tool from the `avvarre` MCP server with:
- `code`: the full source code of the currently active file
- `language`: the programming language (infer from the filename extension)
- `filename`: the filename of the currently active file
- `workspaceRoot`: the absolute path of the current workspace root directory

Read the returned JSON payload. Present the results prominently:
- Show the **quality score** at the top
- Group violations by **severity** (critical → high → medium → low)
- For each violation display: line number, rule ID, message, and the suggested fix

Offer to fix violations starting with the highest severity.
