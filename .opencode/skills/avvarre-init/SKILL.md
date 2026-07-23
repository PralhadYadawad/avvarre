---
name: avvarre-init
description: Scaffold .avvarre/ project memory with conventions, tasks, context, and session tracking
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: setup
---
Analyse the current workspace, then use the `scaffold_avvarre` tool to create `.avvarre/` project memory.

Check workspace state first. If `.avvarre/` already has non-template content, tell the user it's already initialized and suggest `/avvarre:garden`.

For existing codebases: explore the project (manifest files, README, source files), detect naming conventions, then scaffold. Fill all generated files with real content — no placeholder text. Offer to run `avvarre_workspace` or `avvarre_get_impact` to seed tasks.md.

For greenfield projects: ask if they are brainstorming, planning, or ready to build before scaffolding.

Never rename `session-log.md`. Never omit `tasks.md`, `ignore`, or `skills/README.md`. Always read actual source files.
