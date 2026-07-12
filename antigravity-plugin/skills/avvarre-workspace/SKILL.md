---
name: avvarre-workspace
description: Scan all files in the workspace. Generates score heatmaps and prioritized files for review.
---

# avvarre-workspace — Workspace Health Scanner

Analyzes the overall quality score of all source files in the codebase, highlighting areas of high complexity or low style-guide compliance.

## Workspace Review Workflow

1.  **Scan Workspace**: Execute `avvarre_workspace` to index files and scores.
2.  **Analyze Heatmap**: Identify files with scores **under 70** (high risk / priority for refactoring).
3.  **Run Quality Checks**: Prioritize refactoring using the `/avvarre` file checker on the flagged components.
4.  **Track Score Trends**: Generate and monitor workspace trend badges.
