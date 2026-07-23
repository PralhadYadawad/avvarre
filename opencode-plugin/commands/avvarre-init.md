---
description: Analyse the current workspace, then scaffold .avvarre/ with real project context, conventions, and task tracking
---

Use the avvarre MCP server to set up `.avvarre/` project memory for this workspace.

**Step 0: Check workspace state.** If `.avvarre/` already has non-template content, tell the user it's already initialized and suggest `/avvarre:garden`. If the workspace has existing code (source files, configs, README), follow the Existing Codebase path below. If empty, follow the Greenfield path.

### Existing Codebase

**1. Explore** — Walk the project at a high level. List the top 3 directory levels. Read manifest files (`package.json`, `Cargo.toml`, `pyproject.toml`, etc.) and extract the project name, description, and dependencies. Read `README.md`. Identify entry points and config files. Read 2–3 representative source files from different layers and detect naming conventions, import ordering, error handling, and file organization. Find where tests live and how they're named.

**2. Scaffold** — Call the `scaffold_avvarre` tool from the `avvarre` MCP server with:
- `workspaceRoot`: absolute path of the current workspace root directory
- `projectName`, `description`, `techStack`, `targetAudience`, `keyFeatures`, `externalApis`, `namingConventions`: fill with what you discovered during exploration

**3. Populate** — Overwrite each generated file with real content:
- `context.md`: real project name, detected tech stack, architecture description, key components with file paths, data flow, entry points
- `conventions.md`: naming patterns you observed, test conventions, error handling patterns, import ordering rules
- `tasks.md`: seed with real tasks based on project gaps (missing tests, incomplete features, no CI/CD)
- `session-log.md`: append `## [today's date]\n- Project initialized via /avvarre:init`

Do NOT leave placeholder text like "Not specified" or "My Project".

**4. Enrich** — Ask the user: "Run `avvarre_workspace` and/or `avvarre_get_impact` to seed `tasks.md` with quality issues and dependency warnings?" If yes, run and append findings.

**5. Confirm** — Report a summary of what was created, detected, and seeded.

### Greenfield (empty workspace)

**1. Intent Detection** — Ask ONE question: "Are you **brainstorming** an idea, **planning** something you have in mind, or **ready to build** something specific?" Branch:
- **Brainstorming**: problem/opportunity space only. No tech stack questions.
- **Planning**: scope, rough intent, success criteria.
- **Building**: purpose, preferred stack, UI/CLI design.

**2. Scaffold** — Call `scaffold_avvarre` with `workspaceRoot` and the gathered context.

**3. Confirm** — Summarize what was created and offer a mode-appropriate next step.

**Guardrails:** Never skip phase 1. Never rename `session-log.md`. Never omit `tasks.md`, `ignore`, or `skills/README.md`. Always read actual source files — never invent project details.
