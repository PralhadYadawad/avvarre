#!/usr/bin/env node
// Avvarre sessionStart hook — checks if .avvarre/ exists, suggests init if not
const fs = require('fs');
const path = require('path');

const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
    let cwd = process.cwd();
    try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (data.cwd) cwd = data.cwd;
    } catch (e) {}

    const avvarreDir = path.join(cwd, '.avvarre');

    if (!fs.existsSync(avvarreDir)) {
        const msg = [
            '[Avvarre] No .avvarre/ directory found in this project.',
            'Run /avvarre-init to set up project memory (context, tasks, conventions, session log).',
            'This gives AI persistent memory across sessions, machines, and developers.'
        ].join('\n');

        console.log(JSON.stringify({
            systemMessage: msg,
            hookSpecificOutput: {
                hookEventName: 'sessionStart',
                additionalContext: msg
            }
        }));
    }
    process.exit(0);
});
