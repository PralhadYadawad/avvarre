---
name: avvarre
description: Analyze the currently active file for code quality violations against Google style guides.
---

# /avvarre

Analyze the **currently active file** for code quality.

## Instructions

1. Determine the currently open file
2. Use the `avvarre_file` MCP tool with that file path
3. Present the results:
   - Show the **quality score** prominently
   - Group violations by **severity** (critical → high → medium → low)
   - For each violation: show line number, rule ID, message, and suggestion
4. Offer to fix violations starting with the highest severity
