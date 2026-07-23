---
name: avvarre
description: Analyze a single file for Google Style Guide violations and get automatic fixes
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: review
---
Call the `avvarre_file` tool from the `avvarre` MCP server with:
- `code`: the full source code of the target file
- `language`: the programming language (infer from filename extension)
- `filename`: the filename
- `workspaceRoot`: the workspace root directory

Read the returned JSON payload. Present the results prominently:
- Show the quality score at the top
- Group violations by severity (critical, high, medium, low)
- For each violation display: line number, rule ID, message, and the suggested fix
- Offer to fix violations starting with the highest severity

When fixing violations, apply one fix at a time and re-run `avvarre_file` to verify the fix didn't introduce new violations.
