---
name: avvarre:workspace
description: Scan all files in the workspace. Generates score heatmaps and prioritized files for review.
---

# avvarre:workspace — Workspace Health Scanner

Analyzes the overall quality score of all source files in the codebase, highlighting areas of high complexity or low style-guide compliance.

## Workspace Review Workflow

1. **Scan Workspace**: Execute `avvarre_workspace` with the workspace directory, detected language, and `include_trends: true`.
2. **Analyze Heatmap**: Show the overall score and grade. Identify files with scores **under 70** (high risk / priority for refactoring).
3. **Flag Trends**: Note any improving or declining score trends.
4. **Offer Fixes**: Offer to fix the worst-scoring files first, one at a time.
