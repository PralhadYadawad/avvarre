---
name: avvarre:init
description: Analyse the current workspace, then scaffold .avvarre/ with real project context, conventions, and task tracking.
---

# Avvarre project initialization

Use this workflow when the user asks to initialize Avvarre, establish project memory, or set up a new project.

First check the workspace state. If `.avvarre/` already has non-template content, tell the user it's initialized and suggest `/avvarre:garden`.

**If the workspace has existing code**, explore it thoroughly before scaffolding:

1. Walk the directory tree and read manifest files, README, and configs to detect the project name, tech stack, and architecture.
2. Read 2–3 representative source files to detect naming conventions, import ordering, error handling, and test patterns.
3. Call `scaffold_avvarre` with the absolute workspace root and all detected values.
4. Overwrite each generated `.avvarre/` file with real content — no placeholder text like "Not specified" or "My Project".
5. Ask the user whether to run `avvarre_workspace` and/or `avvarre_get_impact` to seed `tasks.md` with quality issues. Run if they agree.
6. Summarize what was created, detected, and seeded.

**If the workspace is empty**, first determine whether the user is brainstorming, planning, or ready to build. Ask only the questions needed for that mode, then gather a project name, purpose, stack, audience, key features, external services, and naming conventions when known. Call `scaffold_avvarre` and suggest a mode-appropriate next step.

Never invent project details — always read actual source files. Never rename `session-log.md` or omit `tasks.md`, `ignore`, or `skills/README.md`.
