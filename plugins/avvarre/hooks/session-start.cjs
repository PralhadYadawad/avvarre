#!/usr/bin/env node

// Codex SessionStart hook: load the minimum useful Avvarre project memory.
const fs = require('node:fs');
const path = require('node:path');

function readInput(callback) {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => {
        try {
            callback(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
            callback({});
        }
    });
}

function readTrimmed(filePath, maxLength) {
    if (!fs.existsSync(filePath)) return '';
    try {
        return fs.readFileSync(filePath, 'utf8').trim().slice(0, maxLength);
    } catch {
        return '';
    }
}

readInput((input) => {
    const cwd = input.cwd || process.cwd();
    const avvarreDir = path.join(cwd, '.avvarre');

    if (!fs.existsSync(avvarreDir)) {
        const message = [
            '[Avvarre] This workspace has no .avvarre/ project memory.',
            'Use the avvarre-init skill to create context, conventions, tasks, and session notes.'
        ].join('\n');
        console.log(JSON.stringify({
            systemMessage: message,
            hookSpecificOutput: {
                hookEventName: 'SessionStart',
                additionalContext: message
            }
        }));
        return;
    }

    const context = [];
    const conventions = readTrimmed(path.join(avvarreDir, 'conventions.md'), 6000);
    if (conventions) context.push(`[Avvarre] Project conventions:\n${conventions}`);

    const tasks = readTrimmed(path.join(avvarreDir, 'tasks.md'), 4000)
        .split('\n')
        .filter((line) => /^\s*\[[ /]\]/.test(line));
    if (tasks.length > 0) context.push(`[Avvarre] Pending tasks:\n${tasks.join('\n')}`);

    const sessionLog = readTrimmed(path.join(avvarreDir, 'session-log.md'), 8000);
    if (sessionLog) {
        const entries = sessionLog.split(/^## /m).filter(Boolean);
        const lastEntry = entries.at(-1);
        if (lastEntry) context.push(`[Avvarre] Last session:\n## ${lastEntry.trim().slice(0, 3000)}`);
    }

    const skillsDir = path.join(avvarreDir, 'skills');
    if (fs.existsSync(skillsDir)) {
        const skills = fs.readdirSync(skillsDir)
            .filter((name) => name.endsWith('.md') && name !== 'README.md');
        if (skills.length > 0) context.push(`[Avvarre] Available project skills: ${skills.join(', ')}`);
    }

    if (context.length === 0) return;
    const additionalContext = context.join('\n\n');
    console.log(JSON.stringify({
        systemMessage: '[Avvarre] Project context loaded.',
        hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext
        }
    }));
});
