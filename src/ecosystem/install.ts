/**
 * avvarre install — Multi-IDE Bootstrap
 *
 * Detects all installed IDEs and writes MCP configs + copies the matching
 * agent plugin (hooks + slash commands + skills) for each.
 *
 * Usage:
 *   npx -y avvarre@latest install              — auto-detect all IDEs (global by default)
 *   npx -y avvarre@latest install --local      — write project-local configs only
 *   npx -y avvarre@latest install --cursor     — Cursor only
 *   npx -y avvarre@latest install --claude     — Claude Code only
 *   npx -y avvarre@latest install --vscode     — VS Code + GitHub Copilot + Copilot only
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir, platform } from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { setupClaudeGlobal, setupClaudeCode } from './claude_setup.js';

// ── Package root (for finding bundled plugin files) ──────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, '..', '..');

// ── Types ─────────────────────────────────────────────────────────────

export interface IdeDetection {
    name: string;
    detected: boolean;
    configPath: string;
    reason: string;
}

export interface InstallResult {
    created: string[];
    skipped: string[];
    detected: IdeDetection[];
    mode: 'local' | 'global' | 'both';
}

/** IDE names accepted as filter flags (--cursor, --claude, --vscode) */
export const IDE_FLAGS: Record<string, string> = {
    '--cursor':   'Cursor',
    '--claude':   'Claude Code',
    '--antigravity': 'Antigravity',
    '--vscode':   'VS Code + GitHub Copilot',
    '--zed':      'Zed',
    '--continue': 'Continue',
    '--opencode': 'OpenCode',
};

// ── MCP server config block (shared across IDEs) ─────────────────────

const MCP_SERVER_ENTRY = {
    command: 'npx',
    args: ['-y', 'avvarre@latest'],
    env: {},
};

// ── IDE Detection ─────────────────────────────────────────────────────

/**
 * Detects which IDEs are installed by checking home directories,
 * config directories, and PATH executables.
 */
export function detectInstalledIDEs(): IdeDetection[] {
    const home = homedir();
    const isWin = platform() === 'win32';

    const results: IdeDetection[] = [];

    // Claude Code
    const claudeDir = join(home, '.claude');
    results.push({
        name: 'Claude Code',
        detected: existsSync(claudeDir) || commandExists('claude'),
        configPath: join(claudeDir, 'mcp.json'),
        reason: existsSync(claudeDir) ? '~/.claude/ found' : 'claude in PATH',
    });

    // Antigravity
    const geminiDir = join(home, '.gemini');
    results.push({
        name: 'Antigravity',
        detected: existsSync(geminiDir),
        configPath: join(geminiDir, 'antigravity-cli', 'mcp.json'),
        reason: existsSync(geminiDir) ? '~/.gemini/ found' : 'not found',
    });

    // Cursor
    const cursorDir = isWin
        ? join(home, 'AppData', 'Roaming', 'Cursor')
        : join(home, '.cursor');
    results.push({
        name: 'Cursor',
        detected: existsSync(cursorDir) || commandExists('cursor'),
        configPath: join(cursorDir, 'mcp.json'),
        reason: existsSync(cursorDir) ? `${cursorDir} found` : 'cursor in PATH',
    });

    // VS Code + GitHub Copilot
    const vscodeDir = isWin
        ? join(home, 'AppData', 'Roaming', 'Code', 'User')
        : platform() === 'darwin'
            ? join(home, 'Library', 'Application Support', 'Code', 'User')
            : join(home, '.config', 'Code', 'User');
    results.push({
        name: 'VS Code + GitHub Copilot',
        detected: existsSync(vscodeDir) || commandExists('code'),
        configPath: join(vscodeDir, 'mcp.json'),
        reason: existsSync(vscodeDir) ? `${vscodeDir} found` : 'code in PATH',
    });



    // Zed
    const zedDir = isWin
        ? join(home, 'AppData', 'Roaming', 'Zed')
        : platform() === 'darwin'
            ? join(home, 'Library', 'Application Support', 'Zed')
            : join(home, '.config', 'zed');
    results.push({
        name: 'Zed',
        detected: existsSync(zedDir) || commandExists('zed'),
        configPath: join(zedDir, 'settings.json'),
        reason: existsSync(zedDir) ? `${zedDir} found` : 'zed in PATH',
    });

    // Continue
    const continueDir = join(home, '.continue');
    results.push({
        name: 'Continue',
        detected: existsSync(continueDir),
        configPath: join(continueDir, 'config.json'),
        reason: existsSync(continueDir) ? '~/.continue/ found' : 'not found',
    });

    // OpenCode
    const opencodeDir = join(home, '.opencode');
    results.push({
        name: 'OpenCode',
        detected: existsSync(opencodeDir) || commandExists('opencode'),
        configPath: join(opencodeDir, 'config.json'),
        reason: existsSync(opencodeDir) ? '~/.opencode/ found' : 'opencode in PATH',
    });

    return results;
}

function commandExists(cmd: string): boolean {
    try {
        const check = platform() === 'win32' ? `where ${cmd}` : `which ${cmd}`;
        execSync(check, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

// ── Install ───────────────────────────────────────────────────────────

/**
 * Runs the full multi-IDE install. Detects IDEs, writes MCP configs,
 * injects rule files, and copies the matching agent plugin for each IDE.
 *
 * @param workspaceRoot - Project directory to write local configs into
 * @param opts.global   - Write to global IDE dirs instead of project-local
 * @param opts.filter   - If set, only install for these IDE names (e.g. ['Cursor'])
 */
export async function runInstall(
    workspaceRoot: string,
    opts: { global?: boolean; mode?: 'global' | 'local' | 'both'; filter?: string[] } = {},
): Promise<InstallResult> {
    const created: string[] = [];
    const skipped: string[] = [];
    const detected = detectInstalledIDEs();
    
    // Default to 'both' unless specified otherwise. Keep global flag support.
    let mode: InstallResult['mode'] = opts.mode || (opts.global !== undefined ? (opts.global ? 'global' : 'local') : 'both');

    for (const ide of detected) {
        // If a filter is set, only process matching IDEs
        if (opts.filter && opts.filter.length > 0 && !opts.filter.includes(ide.name)) continue;
        // Without filter, only process detected IDEs
        if (!opts.filter && !ide.detected) continue;

        if (ide.name === 'Claude Code') {
            if (mode === 'global' || mode === 'both') {
                const claudeResult = await setupClaudeGlobal();
                created.push(...claudeResult.created);
                skipped.push(...claudeResult.skipped);
                installClaudeHooks(created, skipped);
            }
            if (mode === 'local' || mode === 'both') {
                const claudeResult = await setupClaudeCode(workspaceRoot);
                created.push(...claudeResult.created);
                skipped.push(...claudeResult.skipped);
            }
        } else if (ide.name === 'Antigravity') {
            if (mode === 'global' || mode === 'both') {
                installAntigravityGlobal(created, skipped);
            }
            if (mode === 'local' || mode === 'both') {
                installAntigravityLocal(workspaceRoot, created, skipped);
            }
        } else if (ide.name === 'Cursor') {
            if (mode === 'global' || mode === 'both') {
                writeMcpConfig(ide.configPath, 'Cursor (global)', created, skipped);
                installCursorGlobal(created, skipped);
            }
            if (mode === 'local' || mode === 'both') {
                const localDir = join(workspaceRoot, '.cursor');
                if (!existsSync(localDir)) mkdirSync(localDir, { recursive: true });
                writeMcpConfig(join(localDir, 'mcp.json'), 'Cursor', created, skipped);
                installCursorLocal(workspaceRoot, created, skipped);
            }
        } else if (ide.name === 'VS Code + GitHub Copilot') {
            const vscodeUserDir = dirname(ide.configPath);
            if (mode === 'global' || mode === 'both') {
                writeMcpConfig(ide.configPath, 'VS Code + GitHub Copilot (global)', created, skipped);
                installVSCodeGlobal(vscodeUserDir, created, skipped);
            }
            if (mode === 'local' || mode === 'both') {
                const localDir = join(workspaceRoot, '.vscode');
                if (!existsSync(localDir)) mkdirSync(localDir, { recursive: true });
                writeMcpConfig(join(localDir, 'mcp.json'), 'VS Code + GitHub Copilot', created, skipped);
                installVSCodeLocal(workspaceRoot, created, skipped);
            }

        } else if (ide.name === 'Zed') {
            writeZedConfig(ide.configPath, created, skipped);
        } else if (ide.name === 'Continue') {
            writeContinueConfig(ide.configPath, created, skipped);
        } else if (ide.name === 'OpenCode') {
            writeMcpConfig(ide.configPath, 'OpenCode', created, skipped);
            if (mode === 'global' || mode === 'both') {
                installOpenCodeGlobal(created, skipped);
            }
        }
    }

    if (mode === 'local' || mode === 'both') {
        injectCursorRules(workspaceRoot, created, skipped);
        injectClaudeMd(workspaceRoot, created, skipped);

        // Copy agent plugins from npm package for each detected (or filtered) IDE
        const targetNames = opts.filter ?? detected.filter(d => d.detected).map(d => d.name);
        if (targetNames.includes('Cursor')) {
            copyPlugin(workspaceRoot, 'cursor-plugin', 'cursor-plugin', 'Cursor', created, skipped);
        }
        if (targetNames.includes('Claude Code')) {
            copyPlugin(workspaceRoot, 'claude-plugin', 'claude-plugin', 'Claude Code', created, skipped);
        }
        if (targetNames.includes('VS Code + GitHub Copilot')) {
            copyPlugin(workspaceRoot, 'awesome-copilot', 'awesome-copilot', 'VS Code + GitHub Copilot', created, skipped);
        }
        if (targetNames.includes('Antigravity')) {
            copyPlugin(workspaceRoot, 'antigravity-plugin', '.agents/plugins/avvarre', 'Antigravity', created, skipped);
        }
        if (targetNames.includes('OpenCode')) {
            copyPlugin(workspaceRoot, 'opencode-plugin', '.opencode', 'OpenCode', created, skipped);
        }
    }

    return { created, skipped, detected, mode };
}

// ── MCP Config Writers ────────────────────────────────────────────────

/**
 * Writes or merges a standard mcpServers config for Claude Code, Cursor,
 * VS Code + GitHub Copilot, and OpenCode (all share the same JSON schema).
 */
function writeMcpConfig(
    configPath: string,
    label: string,
    created: string[],
    skipped: string[],
): void {
    const configDir = dirname(configPath);
    if (!existsSync(configDir)) {
        try {
            mkdirSync(configDir, { recursive: true });
        } catch {
            skipped.push(`${label}: could not create directory ${configDir}`);
            return;
        }
    }

    if (existsSync(configPath)) {
        try {
            const existing = JSON.parse(readFileSync(configPath, 'utf-8'));
            if (existing.mcpServers?.avvarre) {
                skipped.push(`${configPath} (avvarre already registered)`);
                return;
            }
            existing.mcpServers = existing.mcpServers || {};
            existing.mcpServers.avvarre = MCP_SERVER_ENTRY;
            writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf-8');
            created.push(`${configPath} (added avvarre)`);
        } catch {
            skipped.push(`${configPath} (could not parse, left untouched)`);
        }
    } else {
        writeFileSync(configPath, JSON.stringify({
            mcpServers: { avvarre: MCP_SERVER_ENTRY },
        }, null, 2), 'utf-8');
        created.push(configPath);
    }
}

/**
 * Writes or merges Zed's context_servers config format.
 * Zed uses a different key and nested command structure.
 */
function writeZedConfig(
    settingsPath: string,
    created: string[],
    skipped: string[],
): void {
    const zedEntry = {
        command: { path: 'npx', args: ['-y', 'avvarre@latest'] },
    };

    if (existsSync(settingsPath)) {
        try {
            const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'));
            if (existing.context_servers?.avvarre) {
                skipped.push(`${settingsPath} (avvarre already registered)`);
                return;
            }
            existing.context_servers = existing.context_servers || {};
            existing.context_servers.avvarre = zedEntry;
            writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf-8');
            created.push(`${settingsPath} (added avvarre)`);
        } catch {
            skipped.push(`${settingsPath} (could not parse, left untouched)`);
        }
    } else {
        writeFileSync(settingsPath, JSON.stringify({
            context_servers: { avvarre: zedEntry },
        }, null, 2), 'utf-8');
        created.push(settingsPath);
    }
}

/**
 * Writes or merges Continue's mcpServers array format.
 * Continue uses an array rather than an object for MCP servers.
 */
function writeContinueConfig(
    configPath: string,
    created: string[],
    skipped: string[],
): void {
    const continueEntry = {
        name: 'avvarre',
        command: 'npx',
        args: ['-y', 'avvarre@latest'],
    };

    if (existsSync(configPath)) {
        try {
            const existing = JSON.parse(readFileSync(configPath, 'utf-8'));
            const servers: Array<{ name: string }> = existing.mcpServers || [];
            if (servers.some(s => s.name === 'avvarre')) {
                skipped.push(`${configPath} (avvarre already registered)`);
                return;
            }
            existing.mcpServers = [...servers, continueEntry];
            writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf-8');
            created.push(`${configPath} (added avvarre)`);
        } catch {
            skipped.push(`${configPath} (could not parse, left untouched)`);
        }
    } else {
        writeFileSync(configPath, JSON.stringify({
            mcpServers: [continueEntry],
        }, null, 2), 'utf-8');
        created.push(configPath);
    }
}

// ── Rule File Injection ───────────────────────────────────────────────

const AVVARRE_RULES_BLOCK = `
# avvarre — AI Code Quality
# MCP server: npx -y avvarre@latest
# Run /avvarre to analyze the current file
# Run /avvarre-init to set up .avvarre/ project memory
# Run /avvarre-autopilot for autonomous Grade A fixes
`.trim();

function injectCursorRules(root: string, created: string[], skipped: string[]): void {
    injectRuleFile(join(root, '.cursorrules'), '.cursorrules', created, skipped);
}



function injectRuleFile(
    filePath: string,
    label: string,
    created: string[],
    skipped: string[],
): void {
    const marker = '# avvarre — AI Code Quality';
    if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        if (content.includes(marker)) {
            skipped.push(`${label} (avvarre block already present)`);
            return;
        }
        writeFileSync(filePath, content + '\n\n' + AVVARRE_RULES_BLOCK + '\n', 'utf-8');
        created.push(`${label} (appended avvarre block)`);
    } else {
        writeFileSync(filePath, AVVARRE_RULES_BLOCK + '\n', 'utf-8');
        created.push(label);
    }
}

function injectClaudeMd(root: string, created: string[], skipped: string[]): void {
    const filePath = join(root, 'CLAUDE.md');
    const marker = 'avvarre';
    if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        if (content.includes(marker)) {
            skipped.push('CLAUDE.md (avvarre already mentioned)');
            return;
        }
        const block = `\n## avvarre — AI Code Quality\n\nRun \`/avvarre\` to analyze files. Run \`/avvarre-init\` to set up \`.avvarre/\` project memory.\nMCP server: \`npx -y avvarre@latest\`\n`;
        writeFileSync(filePath, content + block, 'utf-8');
        created.push('CLAUDE.md (appended avvarre block)');
    } else {
        skipped.push('CLAUDE.md (not found, skipped)');
    }
}

// ── Cursor Full Install ───────────────────────────────────────────────

/**
 * Global Cursor install: copies the .mdc rules file to ~/.cursor/rules/
 * and the full plugin (hooks + commands + agent + skills) to ~/.cursor/avvarre/.
 */
function installCursorGlobal(created: string[], skipped: string[]): void {
    const home = homedir();
    const cursorHome = platform() === 'win32'
        ? join(home, 'AppData', 'Roaming', 'Cursor')
        : join(home, '.cursor');

    // Rules file → ~/.cursor/rules/avvarre.mdc (always-on for all projects)
    const rulesDir = join(cursorHome, 'rules');
    if (!existsSync(rulesDir)) mkdirSync(rulesDir, { recursive: true });
    const srcMdc = join(PACKAGE_ROOT, 'cursor-plugin', 'rules', 'avvarre.mdc');
    const destMdc = join(rulesDir, 'avvarre.mdc');
    if (existsSync(srcMdc)) {
        if (existsSync(destMdc)) {
            skipped.push('~/.cursor/rules/avvarre.mdc (already exists)');
        } else {
            cpSync(srcMdc, destMdc);
            created.push('~/.cursor/rules/avvarre.mdc');
        }
    }

    // Full plugin → ~/.cursor/avvarre/ (hooks + commands + agent + skills)
    const destPlugin = join(cursorHome, 'avvarre');
    const srcPlugin = join(PACKAGE_ROOT, 'cursor-plugin');
    if (existsSync(srcPlugin)) {
        if (existsSync(destPlugin)) {
            skipped.push('~/.cursor/avvarre/ (already exists)');
        } else {
            cpSync(srcPlugin, destPlugin, { recursive: true });
            created.push('~/.cursor/avvarre/ (Cursor plugin)');
        }
    }
}

/**
 * Local Cursor install: copies the .mdc rules file to .cursor/rules/.
 * The plugin folder itself is handled by copyPlugin() at the end of runInstall.
 */
function installCursorLocal(workspaceRoot: string, created: string[], skipped: string[]): void {
    const rulesDir = join(workspaceRoot, '.cursor', 'rules');
    if (!existsSync(rulesDir)) mkdirSync(rulesDir, { recursive: true });
    const srcMdc = join(PACKAGE_ROOT, 'cursor-plugin', 'rules', 'avvarre.mdc');
    const destMdc = join(rulesDir, 'avvarre.mdc');
    if (existsSync(srcMdc)) {
        if (existsSync(destMdc)) {
            skipped.push('.cursor/rules/avvarre.mdc (already exists)');
        } else {
            cpSync(srcMdc, destMdc);
            created.push('.cursor/rules/avvarre.mdc');
        }
    }
}

// ── VS Code + GitHub Copilot / Copilot Full Install ────────────────────────────────────

/**
 * Global VS Code + GitHub Copilot install: copies the plugin to ~/.vscode/avvarre/ and
 * adds it to chat.plugins.paths in the global VS Code + GitHub Copilot settings.json.
 */
function installVSCodeGlobal(vscodeUserDir: string, created: string[], skipped: string[]): void {
    // Copy plugin globally
    const destPlugin = join(vscodeUserDir, '..', 'avvarre');
    const srcPlugin = join(PACKAGE_ROOT, 'awesome-copilot');
    if (existsSync(srcPlugin)) {
        if (existsSync(destPlugin)) {
            skipped.push('VS Code + GitHub Copilot avvarre plugin dir (already exists)');
        } else {
            cpSync(srcPlugin, destPlugin, { recursive: true });
            created.push(`${destPlugin} (VS Code + GitHub Copilot + Copilot plugin)`);
        }
    }

    // Wire into VS Code + GitHub Copilot settings.json → chat.plugins.paths
    const settingsPath = join(vscodeUserDir, 'settings.json');
    mergeVSCodePluginPath(settingsPath, destPlugin, 'VS Code + GitHub Copilot settings.json (global)', created, skipped);
}

/**
 * Local VS Code + GitHub Copilot install: adds the local awesome-copilot/ path to
 * chat.plugins.paths in .vscode/settings.json.
 * The plugin folder itself is handled by copyPlugin() at the end of runInstall.
 */
function installVSCodeLocal(workspaceRoot: string, created: string[], skipped: string[]): void {
    const settingsPath = join(workspaceRoot, '.vscode', 'settings.json');
    const pluginPath = join(workspaceRoot, 'awesome-copilot');
    mergeVSCodePluginPath(settingsPath, pluginPath, '.vscode/settings.json', created, skipped);
}

function mergeVSCodePluginPath(
    settingsPath: string,
    pluginPath: string,
    label: string,
    created: string[],
    skipped: string[],
): void {
    try {
        const existing = existsSync(settingsPath)
            ? JSON.parse(readFileSync(settingsPath, 'utf-8'))
            : {};

        const pluginPaths: Record<string, boolean> = existing['chat.plugins.paths'] || {};
        if (pluginPaths[pluginPath]) {
            skipped.push(`${label} chat.plugins.paths (already registered)`);
            return;
        }

        existing['chat.plugins.paths'] = { ...pluginPaths, [pluginPath]: true };
        const settingsDir = dirname(settingsPath);
        if (!existsSync(settingsDir)) mkdirSync(settingsDir, { recursive: true });
        writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf-8');
        created.push(`${label} (added chat.plugins.paths)`);
    } catch {
        skipped.push(`${label} (could not update settings)`);
    }
}

// ── Claude Code Hooks ─────────────────────────────────────────────────

/**
 * Copies bundled hook scripts to ~/.claude/hooks/ and registers them
 * in ~/.claude/settings.json so they fire on SessionStart and Stop.
 */
function installClaudeHooks(created: string[], skipped: string[]): void {
    const hooksDir = join(homedir(), '.claude', 'hooks');
    const srcHooksDir = join(PACKAGE_ROOT, 'claude-plugin', 'hooks');

    if (!existsSync(srcHooksDir)) {
        skipped.push('~/.claude/hooks/ (claude-plugin/hooks/ not found in package)');
        return;
    }

    if (!existsSync(hooksDir)) {
        mkdirSync(hooksDir, { recursive: true });
    }

    // Copy every .cjs script from claude-plugin/hooks/ → ~/.claude/hooks/
    const scripts = readdirSync(srcHooksDir).filter(f => f.endsWith('.cjs'));
    for (const script of scripts) {
        const dest = join(hooksDir, script);
        if (existsSync(dest)) {
            skipped.push(`~/.claude/hooks/${script} (already exists)`);
        } else {
            cpSync(join(srcHooksDir, script), dest);
            created.push(`~/.claude/hooks/${script}`);
        }
    }

    // Register hooks in ~/.claude/settings.json
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    const hookEntries = {
        SessionStart: [
            { hooks: [{ type: 'command', command: `node "${join(hooksDir, 'hook-bootstrap.cjs')}"` }] },
            { hooks: [{ type: 'command', command: `node "${join(hooksDir, 'hook-context-loader.cjs')}"` }] },
            { hooks: [{ type: 'command', command: `node "${join(hooksDir, 'hook-skill-suggest.cjs')}"` }] },
        ],
        Stop: [
            { hooks: [{ type: 'command', command: `node "${join(hooksDir, 'hook-session-end.cjs')}"` }] },
        ],
    };

    try {
        const existing = existsSync(settingsPath)
            ? JSON.parse(readFileSync(settingsPath, 'utf-8'))
            : {};

        if (existing.hooks?.SessionStart?.length > 0) {
            skipped.push('~/.claude/settings.json hooks (already registered)');
            return;
        }

        existing.hooks = { ...existing.hooks, ...hookEntries };
        writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf-8');
        created.push('~/.claude/settings.json (registered 4 hooks)');
    } catch {
        skipped.push('~/.claude/settings.json (could not register hooks)');
    }
}

// ── Plugin Copy ───────────────────────────────────────────────────────

/**
 * Copies a bundled plugin folder from the npm package into the project.
 *
 * @param root     - Project root directory
 * @param srcDir   - Source folder name inside PACKAGE_ROOT (e.g. 'plugin', 'claude-plugin')
 * @param destDir  - Destination folder name in the project root
 * @param label    - Human-readable IDE label for output messages
 * @param created  - Accumulator for created file paths
 * @param skipped  - Accumulator for skipped file paths
 */
function copyPlugin(
    root: string,
    srcDir: string,
    destDir: string,
    label: string,
    created: string[],
    skipped: string[],
): void {
    const src = join(PACKAGE_ROOT, srcDir);
    const dest = join(root, destDir);

    if (!existsSync(src)) {
        skipped.push(`${destDir}/ (not found in package — download from https://github.com/PralhadYadawad/avvarre)`);
        return;
    }

    if (existsSync(dest)) {
        skipped.push(`${destDir}/ (already exists in project)`);
        return;
    }

    try {
        cpSync(src, dest, { recursive: true });
        created.push(`${destDir}/ (${label} plugin copied from npm package)`);
    } catch {
        skipped.push(`${destDir}/ (copy failed — download from https://github.com/PralhadYadawad/avvarre)`);
    }
}

/**
 * Global Antigravity install: copies the plugin to ~/.gemini/config/plugins/avvarre
 * and ~/.gemini/antigravity-cli/plugins/avvarre.
 */
function installAntigravityGlobal(created: string[], skipped: string[]): void {
    const home = homedir();
    const geminiDir = join(home, '.gemini');
    const srcPlugin = join(PACKAGE_ROOT, 'antigravity-plugin');

    if (!existsSync(srcPlugin)) {
        skipped.push('antigravity-plugin/ (not found in package)');
        return;
    }

    // Copy to ~/.gemini/config/plugins/avvarre
    const destIdePlugin = join(geminiDir, 'config', 'plugins', 'avvarre');
    if (!existsSync(destIdePlugin)) {
        mkdirSync(dirname(destIdePlugin), { recursive: true });
        cpSync(srcPlugin, destIdePlugin, { recursive: true });
        created.push('~/.gemini/config/plugins/avvarre/ (Antigravity IDE plugin)');
    } else {
        skipped.push('~/.gemini/config/plugins/avvarre/ (already exists)');
    }

    // Copy to ~/.gemini/antigravity-cli/plugins/avvarre
    const destCliPlugin = join(geminiDir, 'antigravity-cli', 'plugins', 'avvarre');
    if (!existsSync(destCliPlugin)) {
        mkdirSync(dirname(destCliPlugin), { recursive: true });
        cpSync(srcPlugin, destCliPlugin, { recursive: true });
        created.push('~/.gemini/antigravity-cli/plugins/avvarre/ (Antigravity CLI plugin)');
    } else {
        skipped.push('~/.gemini/antigravity-cli/plugins/avvarre/ (already exists)');
    }
}

/**
 * Local Antigravity install: handled via copyPlugin in runInstall.
 */
function installAntigravityLocal(workspaceRoot: string, created: string[], skipped: string[]): void {
    // Handled by copyPlugin inside runInstall
}

/**
 * Global OpenCode install: copies the plugin (hooks + package.json) to ~/.config/opencode/plugins/avvarre/
 */
function installOpenCodeGlobal(created: string[], skipped: string[]): void {
    const home = homedir();
    const destPlugin = join(home, '.config', 'opencode', 'plugins', 'avvarre');
    const srcPlugin = join(PACKAGE_ROOT, 'opencode-plugin');

    if (existsSync(srcPlugin)) {
        if (existsSync(destPlugin)) {
            skipped.push('~/.config/opencode/plugins/avvarre/ (already exists)');
        } else {
            try {
                mkdirSync(dirname(destPlugin), { recursive: true });
                cpSync(srcPlugin, destPlugin, { recursive: true });
                created.push('~/.config/opencode/plugins/avvarre/ (OpenCode global plugin)');
            } catch {
                skipped.push('~/.config/opencode/plugins/avvarre/ (global copy failed)');
            }
        }
    }
}
