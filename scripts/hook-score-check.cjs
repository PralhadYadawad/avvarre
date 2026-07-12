#!/usr/bin/env node
// Avvarre PostToolUse hook — scores file after every file write/edit
// Works with both Claude Code and VS Code Copilot:
//   Claude Code: tool_input.file_path, tool names Write/Edit
//   Copilot:     tool_input.filePath, tool names create_file/replace_string_in_file/editFiles
const { execSync } = require('child_process');
const path = require('path');

const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
    let filePath = '';
    try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const ti = data.tool_input || {};
        // Claude Code uses snake_case, Copilot uses camelCase
        filePath = ti.file_path || ti.filePath || ti.path || '';
        // For Copilot editFiles tool, files may be an array
        if (!filePath && Array.isArray(ti.files) && ti.files.length > 0) {
            filePath = ti.files[0];
        }
    } catch (e) {
        process.exit(0);
    }

    if (!filePath) process.exit(0);

    // Only score source files, skip config/lock files
    const skip = ['.json', '.lock', '.log', '.md', '.env', '.gitignore', '.yaml', '.yml', '.toml'];
    const ext = path.extname(filePath).toLowerCase();
    if (skip.includes(ext) || !ext) process.exit(0);

    try {
        const dist = path.resolve(__dirname, '../dist/index.js');
        const out = execSync(
            `node "${dist}" check --file "${filePath}" --format score-only`,
            { timeout: 10000 }
        ).toString().trim();

        if (out) {
            console.log(JSON.stringify({ systemMessage: out }));
        }
    } catch (e) {
        // Silently fail — never block the user
    }
    process.exit(0);
});
