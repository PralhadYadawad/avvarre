---
name: avvarre-init
description: Initialize .avvarre/ directory with project memory templates (context, tasks, conventions, session log).
---

# avvarre-init — Project Memory Bootstrapper

This skill scaffolds the persistent AI memory ecosystem for the active project workspace.

## Scaffolding Workflow

1.  **Run Tool**: Execute `scaffold_avvarre` tool in the workspace root.
2.  **Generate Templates**: Creates `.avvarre/` directory containing:
    *   `context.md` — Project architecture, features, and key decisions.
    *   `tasks.md` — Active subtask tracking lists in compressed format.
    *   `conventions.md` — Custom, codebase-specific formatting rules.
    *   `session-log.md` — Record of recent developer-agent sessions.
3.  **Read First**: Check `.avvarre/conventions.md` and `.avvarre/tasks.md` before coding to establish immediate context.
