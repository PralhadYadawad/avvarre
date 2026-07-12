#!/usr/bin/env node
// Avvarre sessionStart hook — loads conventions, last session, pending tasks into AI context
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
        process.exit(0);
    }

    const context = [];

    // Load conventions
    const conventionsPath = path.join(avvarreDir, 'conventions.md');
    if (fs.existsSync(conventionsPath)) {
        const conventions = fs.readFileSync(conventionsPath, 'utf-8').trim();
        if (conventions) {
            context.push('[Avvarre] Project conventions loaded. Follow these rules:');
            context.push(conventions);
        }
    }

    // Load session log (last entry for continuity)
    const sessionLogPath = path.join(avvarreDir, 'session-log.md');
    if (fs.existsSync(sessionLogPath)) {
        const log = fs.readFileSync(sessionLogPath, 'utf-8').trim();
        if (log) {
            const sections = log.split(/^## /m).filter(Boolean);
            if (sections.length > 0) {
                const lastSession = sections[sections.length - 1].trim();
                context.push('\n[Avvarre] Last session:');
                context.push('## ' + lastSession);
            }
        }
    }

    // Load pending tasks
    const tasksPath = path.join(avvarreDir, 'tasks.md');
    if (fs.existsSync(tasksPath)) {
        const tasks = fs.readFileSync(tasksPath, 'utf-8').trim();
        if (tasks) {
            const pending = tasks.split('\n').filter(line =>
                line.match(/^\s*-?\s*\[[ /]\]/)
            );
            if (pending.length > 0) {
                context.push('\n[Avvarre] Pending tasks:');
                context.push(pending.join('\n'));
            }
        }
    }

    // Check for skills directory
    const skillsDir = path.join(avvarreDir, 'skills');
    if (fs.existsSync(skillsDir)) {
        const skills = fs.readdirSync(skillsDir).filter(f =>
            f.endsWith('.md') && f !== 'README.md'
        );
        if (skills.length > 0) {
            context.push('\n[Avvarre] Available skills: ' + skills.join(', '));
            context.push('Load ONLY the relevant skill before building a feature.');
        }
    }

    if (context.length > 0) {
        const fullContext = context.join('\n');
        console.log(JSON.stringify({
            systemMessage: '[Avvarre] Project context loaded (conventions, last session, pending tasks).',
            hookSpecificOutput: {
                hookEventName: 'sessionStart',
                additionalContext: fullContext
            }
        }));
    }
    process.exit(0);
});
