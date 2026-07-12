#!/usr/bin/env node

/**
 * avvarre MCP Server — Entry Point
 *
 * Starts the MCP server over stdio transport.
 * This is what runs when a user does: npx avvarre
 *
 * CLI subcommands:
 *   (default)       — Start the MCP server
 *   install         — Detect all IDEs, write MCP configs, inject rule files
 *   check           — Quick CLI analysis of a single file (used by hooks)
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { setupClaudeCode, setupClaudeGlobal, type ClaudeSetupResult } from './ecosystem/claude_setup.js';
import { runInstall, detectInstalledIDEs, IDE_FLAGS } from './ecosystem/install.js';
import { resolve, extname } from 'path';
import { readFileSync } from 'fs';
import { analyze } from './analyzer/engine.js';
import type { Language } from './types.js';

function printResult(result: ClaudeSetupResult): void {
    if (result.created.length > 0) {
        console.log('  Created:');
        for (const f of result.created) {
            console.log(`    + ${f}`);
        }
    }
    if (result.skipped.length > 0) {
        console.log('');
        console.log('  Skipped (already exist):');
        for (const f of result.skipped) {
            console.log(`    - ${f}`);
        }
    }
    console.log('');
}

const subcommand = process.argv[2];
const flags = process.argv.slice(3);

// ── Extension map for detecting language from file extension ─────────
const EXT_TO_LANG: Record<string, Language> = {
    '.py': 'python', '.js': 'javascript', '.ts': 'typescript', '.jsx': 'javascript',
    '.tsx': 'typescript', '.java': 'java', '.go': 'go', '.cpp': 'cpp', '.cc': 'cpp',
    '.h': 'cpp', '.kt': 'kotlin', '.dart': 'dart', '.swift': 'swift', '.m': 'objc',
    '.cs': 'csharp', '.sh': 'shell', '.bash': 'shell', '.r': 'r', '.R': 'r',
    '.html': 'html', '.htm': 'html', '.css': 'css', '.md': 'markdown',
    '.json': 'json', '.xml': 'xml', '.vim': 'vimscript', '.el': 'lisp',
    '.lisp': 'lisp', '.component.ts': 'angular',
};

function detectLanguage(filePath: string): Language | null {
    const ext = extname(filePath).toLowerCase();
    return EXT_TO_LANG[ext] || null;
}

if (subcommand === 'install') {
    const isGlobal = !flags.includes('--local');
    const targetDir = resolve(flags.find(f => !f.startsWith('--')) || '.');

    // Collect per-IDE filters from flags like --cursor, --claude, --vscode
    const ideFilter: string[] = flags
        .filter(f => f in IDE_FLAGS)
        .map(f => IDE_FLAGS[f]);

    console.log('');
    console.log('  Avvarre — Multi-IDE Install');
    console.log('  ═════════════════════════════');
    console.log('');

    // Show detection results first
    const ides = detectInstalledIDEs();
    console.log('  Detected IDEs:');
    for (const ide of ides) {
        const icon = ide.detected ? '✓' : '✗';
        const note = ide.detected ? `  (${ide.reason})` : '';
        console.log(`    ${icon} ${ide.name}${note}`);
    }
    console.log('');

    const detected = ides.filter(i => i.detected);
    if (detected.length === 0) {
        console.log('  No supported IDEs detected. Install one of:');
        console.log('  Claude Code, Cursor, VS Code, Zed, Continue, OpenCode');
        console.log('');
        process.exit(0);
    }

    runInstall(targetDir, { global: isGlobal, filter: ideFilter.length > 0 ? ideFilter : undefined }).then((result) => {
        if (result.created.length > 0) {
            console.log('  Configured:');
            for (const f of result.created) {
                console.log(`    + ${f}`);
            }
            console.log('');
        }
        if (result.skipped.length > 0) {
            console.log('  Skipped:');
            for (const f of result.skipped) {
                console.log(`    - ${f}`);
            }
            console.log('');
        }
        console.log('  Done! Open any detected IDE and run /avvarre-init to set up project memory.');
        console.log('');
        if (!result.created.some(f => f.includes('cursor-plugin/') || f.includes('claude-plugin/') || f.includes('antigravity-plugin/') || f.includes('awesome-copilot/'))) {
            console.log('  To install agent plugins (hooks + slash commands + skills):');
            console.log('    Claude Code: copy claude-plugin/ → https://github.com/PralhadYadawad/avvarre');
            console.log('    Copilot:     copy awesome-copilot/ → https://github.com/PralhadYadawad/avvarre');
            console.log('    Antigravity: copy antigravity-plugin/ → https://github.com/PralhadYadawad/avvarre');
            console.log('');
        }
    }).catch((error) => {
        console.error('Error during install:', error);
        process.exit(1);
    });
} else if (subcommand === 'check') {
    // CLI quick-check mode: node dist/index.js check --file <path> [--format score-only]
    const fileIdx = flags.indexOf('--file');
    const filePath = fileIdx !== -1 ? flags[fileIdx + 1] : undefined;
    const format = flags.includes('--format') ? flags[flags.indexOf('--format') + 1] : 'full';

    if (!filePath) {
        console.error('Usage: avvarre check --file <path> [--format score-only|full]');
        process.exit(1);
    }

    const resolvedPath = resolve(filePath);
    const lang = detectLanguage(resolvedPath);

    if (!lang) {
        console.error(`Unsupported file type: ${extname(resolvedPath)}`);
        process.exit(0); // exit 0 so hooks don't break
    }

    try {
        const code = readFileSync(resolvedPath, 'utf-8');
        const result = analyze(code, lang);

        if (format === 'score-only') {
            console.log(`[Avvarre] ${resolvedPath} — Score: ${result.score}/100 (${result.grade})`);
            if (result.score < 60) {
                console.log(`[Avvarre] WARNING: Score below 60. Run /avvarre to fix.`);
            }
        } else {
            console.log(JSON.stringify({
                file: resolvedPath,
                score: result.score,
                grade: result.grade,
                violations: result.violations.length,
                details: result.violations.map(v => ({
                    rule: v.ruleId,
                    severity: v.severity,
                    line: v.line,
                    message: v.message,
                })),
            }, null, 2));
        }
    } catch (err) {
        console.error(`Could not read file: ${resolvedPath}`);
        process.exit(0);
    }
} else {
    // Default: start MCP server
    async function main(): Promise<void> {
        const server = createServer();
        const transport = new StdioServerTransport();

        await server.connect(transport);

        // Log to stderr (not stdout, which is used for MCP communication)
        console.error('avvarre MCP Server started (stdio transport)');
    }

    main().catch((error) => {
        console.error('Fatal error starting avvarre:', error);
        process.exit(1);
    });
}
