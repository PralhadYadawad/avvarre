/**
 * Claude Code — Full Bootstrap Module
 *
 * Two modes:
 *   avvarre setup-claude --global   → one-time global install (~/.claude/)
 *   avvarre setup-claude            → per-project setup (.avvarre/ + CLAUDE.md + .claude/)
 *
 * Global creates:
 *   ~/.claude/mcp.json         — MCP server available in ALL projects
 *   ~/.claude/settings.json    — permissions auto-allowed everywhere
 *   ~/.claude/commands/*.md    — slash commands available everywhere
 *
 * Per-project creates:
 *   .avvarre/                — project memory (context, conventions, tasks, session-log, skills)
 *   CLAUDE.md                  — project instructions for Claude Code
 *   .claude/mcp.json           — MCP server (project-scoped)
 *   .claude/settings.json      — permissions
 *   .claude/commands/*.md      — slash commands
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { scaffoldavvarre } from './scaffold.js';

export interface ClaudeSetupResult {
    created: string[];
    skipped: string[];
    directory: string;
    mode: 'global' | 'project';
}

/**
 * Global setup: installs avvarre into ~/.claude/ so it's available
 * in every project without per-project config. Run once, works everywhere.
 */
export async function setupClaudeGlobal(): Promise<ClaudeSetupResult> {
    const homeClaudeDir = join(homedir(), '.claude');
    const commandsDir = join(homeClaudeDir, 'commands');
    const created: string[] = [];
    const skipped: string[] = [];

    if (!existsSync(homeClaudeDir)) {
        mkdirSync(homeClaudeDir, { recursive: true });
    }
    if (!existsSync(commandsDir)) {
        mkdirSync(commandsDir, { recursive: true });
    }

    // ── 1. ~/.claude/mcp.json — MCP server for all projects ─────────
    const mcpPath = join(homeClaudeDir, 'mcp.json');
    if (existsSync(mcpPath)) {
        try {
            const existing = JSON.parse(readFileSync(mcpPath, 'utf-8'));
            if (!existing.mcpServers?.avvarre) {
                existing.mcpServers = existing.mcpServers || {};
                existing.mcpServers.avvarre = {
                    command: 'npx',
                    args: ['-y', 'avvarre@latest'],
                    env: {},
                };
                writeFileSync(mcpPath, JSON.stringify(existing, null, 2), 'utf-8');
                created.push('~/.claude/mcp.json (added avvarre server)');
            } else {
                skipped.push('~/.claude/mcp.json (avvarre already registered)');
            }
        } catch {
            skipped.push('~/.claude/mcp.json (could not parse, left untouched)');
        }
    } else {
        writeIfMissing(mcpPath, JSON.stringify({
            mcpServers: {
                avvarre: {
                    command: 'npx',
                    args: ['-y', 'avvarre@latest'],
                    env: {},
                },
            },
        }, null, 2), '~/.claude/mcp.json', created, skipped);
    }

    // ── 2. ~/.claude/settings.json — global permissions ─────────────
    const settingsPath = join(homeClaudeDir, 'settings.json');
    mergePermissions(settingsPath, '~/.claude/settings.json', created, skipped);

    // ── 3. ~/.claude/commands/*.md — global slash commands ──────────
    const commands = getCommandFiles();
    for (const [filename, content] of Object.entries(commands)) {
        const filePath = join(commandsDir, filename);
        writeIfMissing(filePath, content, `~/.claude/commands/${filename}`, created, skipped);
    }

    return { created, skipped, directory: homeClaudeDir, mode: 'global' };
}

/**
 * Per-project setup: creates .claude/, .avvarre/, and CLAUDE.md
 * in the given workspace root. Full bootstrap for a single project.
 */
export async function setupClaudeCode(workspaceRoot: string): Promise<ClaudeSetupResult> {
    const claudeDir = join(workspaceRoot, '.claude');
    const commandsDir = join(claudeDir, 'commands');
    const created: string[] = [];
    const skipped: string[] = [];

    if (!existsSync(claudeDir)) {
        mkdirSync(claudeDir, { recursive: true });
    }
    if (!existsSync(commandsDir)) {
        mkdirSync(commandsDir, { recursive: true });
    }

    // ── 1. .avvarre/ — project memory ─────────────────────────────
    const avvarreDir = join(workspaceRoot, '.avvarre');
    if (!existsSync(avvarreDir)) {
        const scaffoldResult = await scaffoldavvarre(workspaceRoot, {});
        for (const f of scaffoldResult.created) {
            created.push(`.avvarre/${f}`);
        }
        for (const f of scaffoldResult.skipped) {
            skipped.push(`.avvarre/${f}`);
        }
    } else {
        skipped.push('.avvarre/ (already exists)');
    }

    // ── 2. CLAUDE.md — project instructions ─────────────────────────
    writeIfMissing(
        join(workspaceRoot, 'CLAUDE.md'),
        generateClaudeMd(),
        'CLAUDE.md',
        created,
        skipped,
    );

    // ── 3. .claude/mcp.json — MCP server registration ──────────────
    writeIfMissing(join(claudeDir, 'mcp.json'), JSON.stringify({
        mcpServers: {
            avvarre: {
                command: 'npx',
                args: ['-y', 'avvarre@latest'],
                env: {},
            },
        },
    }, null, 2), '.claude/mcp.json', created, skipped);

    // ── 4. .claude/settings.json — permissions ──────────────────────
    const settingsPath = join(claudeDir, 'settings.json');
    mergePermissions(settingsPath, '.claude/settings.json', created, skipped);

    // ── 5. .claude/commands/*.md — slash commands ───────────────────
    const commands = getCommandFiles();
    for (const [filename, content] of Object.entries(commands)) {
        const filePath = join(commandsDir, filename);
        writeIfMissing(filePath, content, `.claude/commands/${filename}`, created, skipped);
    }

    return { created, skipped, directory: claudeDir, mode: 'project' };
}

// ── Helpers ──────────────────────────────────────────────────────────

function writeIfMissing(
    filePath: string,
    content: string,
    label: string,
    created: string[],
    skipped: string[],
): void {
    if (existsSync(filePath)) {
        skipped.push(label);
    } else {
        writeFileSync(filePath, content, 'utf-8');
        created.push(label);
    }
}

function mergePermissions(
    settingsPath: string,
    label: string,
    created: string[],
    skipped: string[],
): void {
    const mcpPerms = getMcpPermissions();
    if (existsSync(settingsPath)) {
        try {
            const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'));
            const perms: string[] = existing.permissions?.allow || [];
            let changed = false;
            for (const perm of mcpPerms) {
                if (!perms.includes(perm)) {
                    perms.push(perm);
                    changed = true;
                }
            }
            if (changed) {
                existing.permissions = { ...existing.permissions, allow: perms };
                writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf-8');
                created.push(`${label} (merged permissions)`);
            } else {
                skipped.push(`${label} (permissions already present)`);
            }
        } catch {
            skipped.push(`${label} (could not parse, left untouched)`);
        }
    } else {
        writeIfMissing(settingsPath, JSON.stringify({
            permissions: {
                allow: mcpPerms,
            },
        }, null, 2), label, created, skipped);
    }
}

function getMcpPermissions(): string[] {
    return [
        'mcp__avvarre__avvarre_file',
        'mcp__avvarre__avvarre_workspace',
        'mcp__avvarre__avvarre_pr',
        'mcp__avvarre__list_rules',
        'mcp__avvarre__scaffold_avvarre',
        'mcp__avvarre__setup_claude_code',
    ];
}

// ── CLAUDE.md Generator ─────────────────────────────────────────────

function generateClaudeMd(): string {
    return `# Avvarre — Claude Code Instructions

## What is Avvarre?
Avvarre is your persistent AI memory + code quality system. It enforces Google Style Guides across 21 languages via an MCP server, and keeps project context alive across sessions so your AI never forgets.

## Available Slash Commands
- \`/avvarre\` — Analyze the current file for quality violations
- \`/avvarre-init\` — Interactively set up project memory (\`.avvarre/\`)
- \`/avvarre-workspace\` — Scan the entire workspace for quality issues
- \`/avvarre-pr\` — Quality gate for git-changed files only
- \`/avvarre-autopilot\` — Autonomous fix loop until Grade A (90+)

## MCP Tools
These tools are available via the avvarre MCP server:
- \`avvarre_file\` — Deep AI-powered analysis + fix generation for a single file
- \`avvarre_workspace\` — Directory scan with heatmap, trends, and badge
- \`avvarre_pr\` — PR quality gate (pass/fail against score threshold)
- \`list_rules\` — Browse all Google Style Guide rules by language
- \`scaffold_avvarre\` — Create/reset the \`.avvarre/\` directory

## Project Memory (\`.avvarre/\`)
- \`context.md\` — Project overview, tech stack, architecture, key decisions
- \`conventions.md\` — Coding rules and AI agent operating instructions
- \`tasks.md\` — Development task tracker (compressed format)
- \`session-log.md\` — Auto-maintained session history
- \`skills/\` — Dynamic skill routing templates (load only what's relevant)

## Conventions
- Read \`.avvarre/conventions.md\` before writing code
- Rule IDs follow \`LANG-CATEGORY-NN\` format (e.g., \`PY-EXC-01\`)
- Max 1500 lines per file — split into smaller modules if exceeded

## On Every Session End
1. **Session log** — Append to \`.avvarre/session-log.md\`: \`## YYYY-MM-DD\` with bullet changes, files modified, next steps
2. **Task sync** — Update \`.avvarre/tasks.md\` using compressed format: \`[x] Summary (steps: a->b->c->d)\` for done, \`[/] Summary (done: a->b | next: c->d)\` for partial
3. **Quality nudge** — If source code was written or changed, end with: "Run /avvarre on changed files?"

## On Picking Up Work
- If no \`.avvarre/\` directory exists, suggest: "Run /avvarre-init to set up project memory."
- Read \`.avvarre/session-log.md\` and \`.avvarre/tasks.md\` first
- Expand step chains from tasks.md into your working memory
- Read \`.avvarre/conventions.md\` before writing code

## Before Building a Feature
- Check \`.avvarre/skills/\` for a matching skill file
- If one exists, read ONLY that skill — don't load all skills at once
- Follow the architectural rules in that skill file while coding
`;
}

// ── Slash Command Templates ─────────────────────────────────────────

function getCommandFiles(): Record<string, string> {
    return {
        'avvarre.md': `---
description: Analyze the currently active file for code quality violations against Google style guides.
---

# /avvarre

Analyze the **currently active file** for code quality.

## Instructions

1. Determine the currently open file
2. Use the \`avvarre_file\` MCP tool with that file path
3. Present the results:
   - Show the **quality score** prominently
   - Group violations by **severity** (critical -> high -> medium -> low)
   - For each violation: show line number, rule ID, message, and suggestion
4. Offer to fix violations starting with the highest severity
`,

        'avvarre-init.md': `---
description: Interactively scope a project and scaffold .avvarre/ directory with context files, conventions, and session tracking.
---

# /avvarre-init

Initialize a **\`.avvarre/\` project directory** in the workspace.

## Instructions

**PHASE 1: Project Discovery (DO THIS FIRST)**
Before creating any files, ask the user 3-4 specific architectural questions:
- What is the primary purpose of the application?
- Do you have a preferred tech stack, database, or specific frameworks?
- How should the user interface or CLI interaction be designed?
- Are you a beginner looking for guidance, or do you have a strict plan?

Wait for the user's response. If they ask you to handle everything, generate a recommended architecture before proceeding.

**PHASE 2: Scaffolding**
1. Use the \`scaffold_avvarre\` MCP tool with the user's answers
2. Report what was created and suggest next steps
`,

        'avvarre-workspace.md': `---
description: Scan the entire workspace for code quality violations across all supported files.
---

# /avvarre-workspace

Scan the **entire workspace** for code quality.

## Instructions

1. Determine the workspace root path
2. Use the \`avvarre_workspace\` MCP tool with the workspace root
3. Present the results:
   - Show the **overall workspace score**
   - List files sorted by score (worst first)
   - Highlight any **critical violations**
4. Offer to fix the worst-scoring files first, one at a time
`,

        'avvarre-pr.md': `---
description: Analyze only the files changed in the current git branch to enforce quality on new code.
---

# /avvarre-pr

Review only **git-changed files** — ideal as a pre-commit quality gate.

## Instructions

1. Determine the workspace root
2. Run \`git diff --name-only HEAD\` (or \`git diff --name-only main..HEAD\`) to get changed files
3. For each changed file with a supported extension:
   - Use the \`avvarre_file\` MCP tool
   - Collect violations
4. Present a summary:
   - Total files checked
   - Files passing (score >= 85) vs failing
   - Top violations across all changed files
5. Flag any **critical or high** violations as blockers
`,

        'avvarre-autopilot.md': `---
description: Autonomous fix-verify loop that keeps fixing violations until the file reaches Grade A (90+).
---

# /avvarre-autopilot

Autonomously fix a file until it reaches **Grade A (score 90+)**.

## Instructions

1. Determine the currently open file
2. Run \`avvarre_file\` on the file — record the initial score
3. **Loop:**
   a. If score >= 90 -> go to step 4
   b. Pick the highest-severity violation
   c. Fix it using the suggested fix
   d. Run \`avvarre_file\` again -> record new score
   e. If score decreased or is unchanged after 3 consecutive iterations -> stop loop, report blocker
   f. Repeat from 3a
4. **Done:** Report before/after scores and total violations fixed

## Guardrails

- **Max 15 iterations** — if not Grade A after 15 fix-verify cycles, stop and report remaining violations
- **Never skip re-verification** — fixes can introduce new violations
- **Preserve semantics** — only fix style violations, never change logic
- **Log progress** — after completion, append summary to \`.avvarre/session-log.md\`
`,
    };
}
