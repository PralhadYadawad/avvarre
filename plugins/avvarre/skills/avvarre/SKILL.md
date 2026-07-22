---
name: avvarre
description: Analyze a source file with Avvarre and present actionable code-quality fixes.
---

# Avvarre file review

Use this workflow when the user asks to review, score, lint, or improve a source file.

1. Determine the target file from the user's request or active workspace context. If it is ambiguous, ask which file to analyze.
2. Read the file and infer its Avvarre language from its extension.
3. Call the Avvarre MCP tool `avvarre_file` with the complete source, language, filename, and absolute workspace root.
4. Lead with the score and grade. Group findings by severity, then provide rule ID, line, explanation, and actionable fix.
5. If the user asks to fix findings, make the smallest semantics-preserving edits, then re-run `avvarre_file` to verify the result.

Do not claim a file passes until the verification result is returned.
