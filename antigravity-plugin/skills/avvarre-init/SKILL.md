---
name: avvarre:init
description: Analyse the current workspace, then scaffold .avvarre/ with real project context, conventions, and task tracking.
---

# avvarre:init — Project Memory Bootstrapper

Sets up the `.avvarre/` persistent memory directory. Detects whether the workspace has existing code and either explores + populates with real content, or walks a greenfield user through intent detection.

## Detect Workspace State

If `.avvarre/` already has non-template content, tell the user it's initialized and suggest `/avvarre:garden`. If the workspace has existing code, follow the Existing Codebase path. If empty, follow the Greenfield path.

## Existing Codebase Workflow

1. **Explore** — Walk directory tree (top 3 levels). Read manifest files (`package.json`, `Cargo.toml`, etc.), `README.md`, config files. Read 2–3 representative source files from different layers. Detect naming conventions, import ordering, error handling, file organization, and test patterns.

2. **Scaffold** — Execute `scaffold_avvarre` MCP tool in the workspace root with all detected values: `projectName`, `description`, `techStack`, `targetAudience`, `keyFeatures`, `externalApis`, `namingConventions`.

3. **Populate** — Overwrite each generated file with real detected content. `context.md` gets actual architecture, components with file paths, and data flow. `conventions.md` gets observed naming and patterns. `tasks.md` gets real TODOs from project gaps. `session-log.md` gets an init entry.

4. **Enrich** — Ask the user if they want `avvarre_workspace` and/or `avvarre_get_impact` to seed quality issues into `tasks.md`. Run if they agree.

5. **Confirm** — Summarize what was created, detected, and seeded.

## Greenfield Workflow

1. **Intent Detection** — Ask "Are you brainstorming, planning, or ready to build?" Branch questions by mode. Never ask about stack during brainstorming. Gather project name, purpose, stack, audience, key features, external services, and naming conventions.

2. **Scaffold** — Execute `scaffold_avvarre` with gathered context and workspace root.

3. **Confirm** — Summarize created files and offer a mode-appropriate next step.
