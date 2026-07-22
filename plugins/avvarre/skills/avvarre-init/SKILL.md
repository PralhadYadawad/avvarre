---
name: avvarre-init
description: Set up Avvarre persistent project memory for the current workspace.
---

# Avvarre project initialization

Use this workflow when the user asks to initialize Avvarre, establish project memory, or set up a new project.

First determine whether the user is brainstorming, planning, or ready to build. Ask only the questions needed for that mode, then gather a project name, purpose, stack, audience, key features, external services, and naming conventions when known.

Call the Avvarre MCP tool `scaffold_avvarre` with the absolute workspace root and the gathered details. It creates only missing `.avvarre/` files, so never overwrite existing project memory. Summarize created and skipped files, then suggest the appropriate next step for the user's mode.
