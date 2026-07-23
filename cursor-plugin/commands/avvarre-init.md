---
name: avvarre:init
description: Analyse the current workspace, then scaffold .avvarre/ with real project context, conventions, and task tracking.
---

# /avvarre:init

Set up the **`.avvarre/` project memory directory**.

## Instructions

### Step 0: Detect Workspace State

Check what state the workspace is in:

If `.avvarre/` already exists with non-template content → "Already initialized. Run `/avvarre:garden` to audit context drift and stale tasks." and stop.

If the workspace has existing code (source files, configs, README) → follow the **Existing Codebase** path below.

If the workspace is empty or near-empty → follow the **Greenfield** path below.

---

### Existing Codebase Path

**Phase 1 — Explore the Workspace**

Walk the project at a high level to understand it thoroughly:

1. **Directory tree** — list the top 3 levels of the directory structure.
2. **Manifest files** — read `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, or any framework-specific configs. Extract project name, description, and dependencies.
3. **README** — read it for purpose, features, and setup instructions.
4. **Entry points** — identify `src/index.ts`, `main.py`, `app/` structure, etc.
5. **Config files** — scan `tsconfig.json`, `.eslintrc`, `.prettierrc`, `Dockerfile`, `docker-compose.yml`, etc.
6. **Source samples** — read 2–3 representative files from different layers (e.g., a controller, a model, a utility). Detect:
   - Naming conventions (camelCase, snake_case, PascalCase)
   - Import ordering patterns
   - Error handling approach
   - Comment/docstring style
   - File organization
7. **Test patterns** — find where tests live, naming convention, framework used.

Build a mental model: architecture style, data flow, key components with file paths, tech stack.

**Phase 2 — Scaffold**

Call the `scaffold_avvarre` MCP tool with `workspaceRoot` and all detected values: `projectName`, `description`, `techStack`, `targetAudience`, `keyFeatures`, `externalApis`, and `namingConventions`. This creates the `.avvarre/` directory structure with template files.

**Phase 3 — Populate with Real Content**

Overwrite each generated file by editing it directly with your file-editing tools:

- **`context.md`** — write the real project name, detected tech stack, architecture description, key components with file paths, data flow, entry points. Fill every section with actual information discovered during exploration.
- **`conventions.md`** — write the naming patterns you observed in the code, test file conventions, error handling patterns, max file lengths, import ordering rules that match the actual codebase.
- **`tasks.md`** — seed with real tasks based on project gaps (e.g., missing tests, incomplete features, missing CI/CD, documentation gaps).
- **`session-log.md`** — append: `## [today's date]\n- Project initialized via /avvarre:init`

Do NOT leave placeholder text like "Not specified" or "My Project". Every field must contain real detected content.

**Phase 4 — Optional Enrichment**

Ask the user: "Would you like me to run `avvarre_workspace` and/or `avvarre_get_impact` to populate `tasks.md` with actual code quality issues and dependency warnings?"

If yes, run the tool(s) and append findings to `tasks.md`. If no, skip.

**Phase 5 — Confirm**

Report a summary: `.avvarre/` directory created, what was detected (tech stack, architecture), how many tasks seeded, and any enrichment performed.

---

### Greenfield Path

**Phase 1 — Intent Detection**

Before asking anything about tech stack or architecture, ask ONE question:

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

**Phase 2 — Scaffold**

Call the `scaffold_avvarre` MCP tool with `workspaceRoot` and all gathered context: `projectName`, `description`, `techStack`, `targetAudience`, `keyFeatures`, `externalApis`, and `namingConventions`. If the tool is available, use it and skip the manual steps below.

If the MCP tool is NOT available, create the following files manually in the workspace root. **Do NOT skip any file. Do NOT rename any file.**

```
.avvarre/
├── context.md       ← project name, purpose, and decisions captured in Phase 1
├── conventions.md   ← coding conventions: naming, style, framework-specific rules
├── tasks.md         ← seed based on mode (see below)
├── session-log.md   ← start with: "## [today's date]\n- Project initialized via /avvarre:init"
├── ignore           ← one glob per line: node_modules/, dist/, .git/, *.min.js, .env
└── skills/
    └── README.md    ← "# Skills\nPlace skill-specific guideline files here."
```

**Seed `tasks.md` based on mode:**
- Brainstorming → `[ ] Define problem statement`
- Planning → `[ ] Finalize scope and tech decisions`
- Building → `[ ] Initial project scaffold`

**Phase 3 — Confirm**

Tell the user what was created, then offer a mode-appropriate next step:
- Brainstorming → "Want to keep exploring, or ready to start shaping a plan?"
- Planning → "Want to break this into tasks and pick a stack?"
- Building → "Ready to start building."

---

## Guardrails

- **NEVER skip Phase 1 (Explore or Intent Detection)**
- **NEVER rename `session-log.md`**
- **NEVER omit `tasks.md`, `ignore`, or `skills/README.md`**
- **Always read actual source files in Phase 1** — never invent project details. If files cannot be read (permissions, empty project), fall back to the greenfield path.
