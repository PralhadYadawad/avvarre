---
name: avvarre-init
description: Interactively scope a project and scaffold .avvarre/ directory with context files, conventions, and session tracking.
---

# /avvarre-init

Initialize a **`.avvarre/` project directory** in the workspace.

## Instructions

**PHASE 1: Intent Detection (DO THIS FIRST)**

Before asking anything about tech stack or architecture, ask ONE question to understand where the user is:

> "Are you **brainstorming** an idea, **planning** something you have in mind, or **ready to build** something specific?"

Then branch based on their answer:

**Brainstorming** — Ask about the problem/opportunity space only:
- What problem or opportunity are you exploring?
- Any constraints, inspirations, or non-starters you already know?
- Do NOT ask about stack, UI, or architecture yet — those decisions come later.

**Planning** — Ask about scope and rough intent:
- What's the rough idea and what should it do?
- Do you have any tech preferences, or is that still open?
- What does success look like for v1?

**Building** — Ask architectural specifics:
- What is the primary purpose of the application?
- Do you have a preferred tech stack, database, or specific frameworks?
- How should the user interface or CLI interaction be designed?
- Are you a beginner looking for guidance, or do you have a strict plan?

Wait for the user's response. If they ask you to handle everything, generate a recommended approach appropriate to their mode before proceeding.

**PHASE 2: Scaffolding (MANDATORY — DO THIS BEFORE WRITING ANY CODE)**

First, try to call the `scaffold_avvarre` MCP tool. Pass the gathered context into its parameters: `projectName`, `description`, `techStack`, `targetAudience`, `keyFeatures`, `externalApis`, and `namingConventions`. If the tool is available, use it and skip the manual steps below.

If the MCP tool is NOT available, create the following files manually in the workspace root. **Do NOT skip any file. Do NOT rename any file.**

```
.avvarre/
├── context.md       ← project name, purpose, and decisions captured in Phase 1
├── conventions.md   ← coding conventions: naming, style, framework-specific rules
├── tasks.md         ← seed based on mode (see below)
├── session-log.md   ← start with: "## [today's date]\n- Project initialized via /avvarre-init"
├── ignore           ← one glob per line: node_modules/, dist/, .git/, *.min.js, .env
└── skills/
    └── README.md    ← "# Skills\nPlace skill-specific guideline files here."
```

**Seed `tasks.md` based on mode:**
- Brainstorming → `[ ] Define problem statement`
- Planning → `[ ] Finalize scope and tech decisions`
- Building → `[ ] Initial project scaffold`

After all 6 files/dirs are created, confirm them to the user with a mode-appropriate next step:
- Brainstorming → "Want to keep exploring, or ready to start shaping a plan?"
- Planning → "Want to break this into tasks and pick a stack?"
- Building → "Ready to start building."

**NEVER skip Phase 2. NEVER rename session-log.md. NEVER omit tasks.md, ignore, or skills/README.md.**
