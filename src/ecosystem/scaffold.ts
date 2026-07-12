/**
 * avvarre Ecosystem — Scaffolding Module
 *
 * Generates the `.avvarre/` directory structure with template files
 * that provide persistent project memory for AI-assisted development.
 *
 * Generated files:
 *   - context.md       — project overview, tech stack, architecture, decisions
 *   - conventions.md   — coding style rules, naming, patterns
 *   - tasks.md         — development task tracker
 *   - session-log.md   — auto-maintained session history
 *   - ignore           — glob patterns for files/dirs to skip
 *   - skills/          — directory for dynamic skill routing templates
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as path from 'path';
import { generateDynamicSkills } from './skill_generator.js';
import { fetchDynamicCommunitySkills } from './community_fetcher.js';

/**
 * Options for scaffolding, populated from discovery questions.
 */
export interface ScaffoldOptions {
    projectName?: string;
    description?: string;
    techStack?: string;
    targetAudience?: string;
    keyFeatures?: string[];
    externalApis?: string;
    namingConventions?: string;
    maxFileLines?: number;
}

/**
 * Result of a scaffold operation.
 */
export interface ScaffoldResult {
    created: string[];
    skipped: string[];
    directory: string;
}

/**
 * Scaffold the `.avvarre/` directory at the given workspace root.
 * Skips files that already exist to avoid overwriting user customizations.
 */
export async function scaffoldavvarre(
    workspaceRoot: string,
    options: ScaffoldOptions = {},
): Promise<ScaffoldResult> {
    const avvarreDir = join(workspaceRoot, '.avvarre');
    const created: string[] = [];
    const skipped: string[] = [];

    // Create directory if it doesn't exist
    if (!existsSync(avvarreDir)) {
        mkdirSync(avvarreDir, { recursive: true });
    }

    const files: Record<string, string> = {
        'context.md': generateContext(options),
        'conventions.md': generateConventions(options),
        'tasks.md': generateTasks(options),
        'session-log.md': generateSessionLog(),
        'ignore': generateIgnore(),
        'skills/README.md': generateSkillsReadme(),
        'skills/.declined.json': JSON.stringify({ declined: [], declinedAt: {} }, null, 2),
    };

    // Dynamically inject tailored skills based on the user's tech stack
    const dynamicSkills = generateDynamicSkills(options);
    Object.assign(files, dynamicSkills);

    // Fetch and inject external community skills
    const communitySkills = await fetchDynamicCommunitySkills(options.techStack || '');
    Object.assign(files, communitySkills);

    for (const [filename, content] of Object.entries(files)) {
        const filePath = join(avvarreDir, filename);
        
        // Ensure parent directories (like skills/) exist
        const fileDir = path.dirname(filePath);
        if (!existsSync(fileDir)) {
            mkdirSync(fileDir, { recursive: true });
        }

        if (existsSync(filePath)) {
            skipped.push(filename);
        } else {
            writeFileSync(filePath, content, 'utf-8');
            created.push(filename);
        }
    }

    return { created, skipped, directory: avvarreDir };
}

// ── Template Generators ─────────────────────────────────────────────────

function generateContext(opts: ScaffoldOptions): string {
    const name = opts.projectName || 'My Project';
    const desc = opts.description || 'A brief description of what this project does.';
    const stack = opts.techStack || 'Not specified — update this with your tech stack.';
    const audience = opts.targetAudience || 'Not specified.';
    const apis = opts.externalApis || 'None specified.';

    return `# ${name} — Project Context

> This file is read by AI agents to understand your project. Keep it updated as the project evolves.

## What This Project Does

${desc}

## Tech Stack

${stack}

## Target Audience

${audience}

## Key Decisions

- <!-- Add architectural decisions here, e.g. "Chose PostgreSQL over MongoDB for relational data" -->
- <!-- Add framework decisions, e.g. "Using Next.js App Router for SSR" -->

## External APIs & Services

${apis}

## Repository Structure

\`\`\`
<!-- Update this when the file structure changes significantly -->
src/
├── ...
\`\`\`

## Architecture

\`\`\`
<!-- Draw your component relationships here -->
┌──────────────┐     ┌──────────────┐
│   Frontend   │────→│   Backend    │
└──────────────┘     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │   Database   │
                     └──────────────┘
\`\`\`

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| <!-- Name --> | \`src/...\` | <!-- What it does --> |

### Data Flow

1. <!-- Describe the main data flow through the system -->

### Entry Points

- **Main**: \`src/index.ts\` (or equivalent)
- **API**: \`src/routes/\` (or equivalent)
- **Config**: \`.env\` / \`config/\`

## Style Guide

This project follows **Google Style Guides** for all supported languages. Quality is enforced via avvarre.

---
*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
}

function generateConventions(opts: ScaffoldOptions): string {
    const maxLines = opts.maxFileLines || 1500;
    const naming = opts.namingConventions || `- **Functions/methods**: lowerCamelCase (JS/TS/Java/Kotlin/Dart/Swift) or snake_case (Python/Go/C++/R/Shell)
- **Classes/types**: UpperCamelCase
- **Constants**: SCREAMING_SNAKE_CASE (Java/C++/Python) or camelCase (JS/TS/Dart)
- **Files**: Match the language convention (snake_case for Python, camelCase for JS/TS)
- **Boolean variables**: Prefix with is/has/should/can (e.g., isActive, hasPermission)`;

    return `# Coding Conventions & AI Agent Routines

> This file defines the explicit operating instructions for AI coding agents. If you are an LLM reading this, you MUST follow these functional loops to prevent context amnesia, hallucination, and standard regressions.

## 1. Proactive Context Management (CRITICAL)
Amateur developers will forget to manage your context window, leading you to hallucinate or break unrelated code. You must manage it for them.
- **Before starting work on any large feature**, ask the developer: *"Would you like me to focus only on this feature so I don't break other parts of the app?"*
- If they agree, only read files relevant to that feature. Use \`.avvarre/ignore\` patterns and skill files to stay focused.

## 2. The Executable Memory Rule
This project uses Dynamic Skill Routing (\`.avvarre/skills/\`) to prevent context bloat.
- **Before you write code**, explicitly check if a corresponding skill file exists in \`.avvarre/skills/\`.
- READ that specific skill file completely to understand the required architecture.
- NEVER load all skill files at once. Only load the skill actively related to your current task.

## 3. The Comment-Driven Dev Loop
Docstrings are the ultimate Source of Truth.
- **Before modifying any function's logic**, you MUST update its JSDoc/Docstring to explain what you are about to do.
- Only after the comment accurately reflects the new intent may you write the core logic. 

## 4. Agent Auto-Fixes
When the developer asks you to "Run avvarre", you must:
1. Call the \`avvarre_workspace\` or \`avvarre_file\` MCP tool.
2. Read the resulting JSON Violation Array.
3. **DO NOT ask the user for permission to fix every single line.** You are an autonomous agent. Immediately use your file editing tools to apply the fixes natively, then report back with a summary of what you healed.

## 5. Compressed Task Sync & Vibe Commits
- **Compressed writes:** When updating \`tasks.md\`, compress 3-5 internal subtasks into 1 line: \`[x] Summary (steps: a→b→c→d)\`. For partial work: \`[/] Summary (done: a→b | next: c→d)\`.
- **Expanded reads:** When picking up a task with a step chain, expand it back into your internal working memory as subtasks.
- **Vibe Commit:** Before session end, append a handoff block to \`session-log.md\` with changes, modified files, and next steps.

## Naming Standards 

${naming}

## File Organization

- Maximum file size: **${maxLines} lines** (split into smaller modules if exceeded)
- One component/class per file
- Group related files in feature directories
- Keep test files adjacent to source files (e.g., \`utils.ts\` → \`utils.test.ts\`)

## Comment Rules

- Every public function/method **must have a docstring**
- When modifying a function's behavior, **update its docstring FIRST**
- When adding/removing parameters, update the @param list immediately
- Comments should describe **WHY**, not WHAT
- Inline comments only for non-obvious logic
- Do not leave TODO comments without an associated task in \`.avvarre/tasks.md\`

## Import Ordering

1. Standard library / built-in imports
2. Third-party / framework imports
3. Local / project imports
4. Type-only imports (TypeScript)

Separate each group with a blank line.

## Error Handling

- Never silently catch and ignore exceptions
- Always log or re-throw with context
- Use typed errors where the language supports it
- Validate inputs at function boundaries

## Testing

- Test file naming: \`<module>.test.<ext>\` or \`<module>_test.<ext>\`
- Minimum coverage goal: 80% for critical paths
- Tests should be independent and idempotent
- Use descriptive test names: \`should_return_error_when_input_is_null\`

## Code Formatting

- Follow Google Style Guide for the language in use
- avvarre enforces formatting rules automatically
- Run \`/avvarre\` before committing to verify compliance

---
*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
}

function generateTasks(opts: ScaffoldOptions): string {
    let features = '';
    if (opts.keyFeatures && opts.keyFeatures.length > 0) {
        features = opts.keyFeatures.map(f => `- [ ] ${f}`).join('\n');
    } else {
        features = `- [ ] Feature 1 — describe what needs to be built \\
  *(Reference Skill Required: see \`.avvarre/skills/example_skill.md\`)*
- [ ] Feature 2 — describe what needs to be built \\
  *(Reference Skill Required: see \`.avvarre/skills/example_skill.md\`)*
- [ ] Feature 3 — describe what needs to be built`;
    }

    return `# Development Tasks

> Track what's done, what's in progress, and what's next.
> AI agents update this file as they work. Use \`[x]\` for done, \`[/]\` for in progress, \`[ ]\` for pending.

## Current Sprint

${features}

## Backlog

- [ ] <!-- Add future tasks here -->

## Completed

<!-- Completed tasks move here automatically -->

---
*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
}

function generateSessionLog(): string {
    return `# Session Log

> Auto-maintained by avvarre. Records what was done in each AI coding session.
> Each session block is appended — never overwrite previous entries.

---

<!-- Sessions will be appended below this line -->
`;
}

function generateIgnore(): string {
    return `# avvarre Ignore
# Files and directories matching these patterns will be skipped during workspace scans.
# Uses gitignore-style glob syntax.

# Dependencies
node_modules/
vendor/
.venv/
__pycache__/

# Build output
dist/
build/
out/
.next/
.nuxt/

# Version control
.git/

# Generated files
*.generated.*
*.min.js
*.min.css
*.map

# IDE files
.idea/
.vscode/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Test coverage
coverage/
.nyc_output/
`;
}

function generateSkillsReadme(): string {
    return `# avvarre Skills Directory

> **AI Agents**: This directory acts as your "Executable Memory".

Instead of injecting massive, generalized architectural documents into your context window—which wastes tokens and causes hallucinations—we break complex design patterns into individual \`.md\` files here.

### How to use this:
1. When asked to build a feature (e.g., "User Login"), look in this folder for a matching skill (e.g., \`auth_flow.md\`).
2. Read ONLY that specific skill file.
3. Follow the exact implementation steps, commands, and dependencies outlined in that skill file.
4. When finished, drop the skill from your context memory and move on to the next task.

*(Hint: Link these skills directly to your \`tasks.md\` items so you always know which skill to load!)*
`;
}
