#!/usr/bin/env node

// Codex Stop hook: remind the agent to preserve durable project memory.
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

readInput((input) => {
    if (input.stop_hook_active) return;
    const cwd = input.cwd || process.cwd();
    const avvarreDir = path.join(cwd, '.avvarre');
    if (!fs.existsSync(avvarreDir)) return;

    const message = '[Avvarre] Before ending implementation work, record durable scope, convention, or task changes in .avvarre/ when applicable.';
    console.log(JSON.stringify({
        systemMessage: message,
        hookSpecificOutput: {
            hookEventName: 'Stop',
            additionalContext: message
        }
    }));
});
