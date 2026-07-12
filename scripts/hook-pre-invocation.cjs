#!/usr/bin/env node
// Avvarre PreInvocation hook — combines bootstrap, context loading, and stack detection for Antigravity 2.0
const fs = require('fs');
const path = require('path');

const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
    let data = {};
    try {
        data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (e) {}

    // Only run on the very first model invocation of the conversation/loop
    if (data.invocationNum !== undefined && data.invocationNum !== 1) {
        console.log(JSON.stringify({}));
        process.exit(0);
    }

    const cwd = data.cwd || (data.workspacePaths && data.workspacePaths[0]) || process.cwd();
    const avvarreDir = path.join(cwd, '.avvarre');

    // Case 1: No .avvarre directory found
    if (!fs.existsSync(avvarreDir)) {
        const msg = [
            '[Avvarre] No .avvarre/ directory found in this project.',
            'Run /avvarre-init (or use the avvarre-init skill) to set up project memory (context, tasks, conventions, session log).',
            'This gives your AI agents persistent memory across sessions, machines, and developers.'
        ].join('\n');

        console.log(JSON.stringify({
            injectSteps: [
                {
                    ephemeralMessage: msg
                }
            ]
        }));
        process.exit(0);
    }

    // Case 2: Load context & detect stack
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
                line.match(/^\s*\[[ /]\]/)
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
            context.push('\n[Avvarre] Available local skills: ' + skills.join(', '));
            context.push('Load ONLY the relevant skill before building a feature.');
        }
    }

    // Detect Stack
    const detected = {};
    const add = (fw, source) => {
        if (!detected[fw]) detected[fw] = source;
    };

    // package.json dependencies
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
            if (deps.includes('next')) add('nextjs', 'package.json');
            if (deps.includes('react') || deps.includes('react-dom')) add('react', 'package.json');
            if (deps.includes('vue') || deps.includes('@vue/core')) add('vue', 'package.json');
            if (deps.includes('svelte') || deps.includes('@sveltejs/kit')) add('svelte', 'package.json');
            if (deps.includes('tailwindcss')) add('tailwind', 'package.json');
            if (deps.includes('express')) add('express', 'package.json');
            if (deps.includes('typescript')) add('typescript', 'package.json');
            add('node', 'package.json');
        } catch (e) {}
    }

    // Python files
    for (const pyFile of ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py']) {
        const pyPath = path.join(cwd, pyFile);
        if (fs.existsSync(pyPath)) {
            add('python', pyFile);
            try {
                const content = fs.readFileSync(pyPath, 'utf-8').toLowerCase();
                if (content.includes('fastapi')) add('fastapi', pyFile);
            } catch (e) {}
            break;
        }
    }

    if (fs.existsSync(path.join(cwd, 'go.mod'))) add('go', 'go.mod');
    if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) add('rust', 'Cargo.toml');
    if (fs.existsSync(path.join(cwd, 'pubspec.yaml'))) add('dart', 'pubspec.yaml');

    // Config files
    const configMap = {
        'next.config.js': 'nextjs', 'next.config.ts': 'nextjs', 'next.config.mjs': 'nextjs',
        'tailwind.config.js': 'tailwind', 'tailwind.config.ts': 'tailwind',
        'svelte.config.js': 'svelte', 'svelte.config.ts': 'svelte',
        'tsconfig.json': 'typescript',
        'CMakeLists.txt': 'cpp',
    };
    for (const [file, fw] of Object.entries(configMap)) {
        if (fs.existsSync(path.join(cwd, file))) add(fw, file);
    }

    // File extensions fallback
    const extMap = { '.go': 'go', '.rs': 'rust', '.swift': 'swift', '.dart': 'dart', '.cpp': 'cpp', '.cc': 'cpp' };
    for (const scanDir of [cwd, path.join(cwd, 'src')]) {
        try {
            for (const entry of fs.readdirSync(scanDir, { withFileTypes: true })) {
                if (!entry.isFile()) continue;
                for (const [ext, fw] of Object.entries(extMap)) {
                    if (entry.name.endsWith(ext)) add(fw, entry.name + ' (file extension)');
                }
            }
        } catch (e) {}
    }

    const fetchable = new Set([
        'nextjs', 'react', 'vue', 'svelte', 'tailwind',
        'node', 'express', 'python', 'fastapi',
        'typescript', 'rust', 'cpp',
    ]);

    const detectedFrameworks = Object.keys(detected).filter(fw => fetchable.has(fw));
    if (detectedFrameworks.length > 0) {
        // Filter out already fetched or declined skills
        const alreadyFetched = new Set();
        if (fs.existsSync(skillsDir)) {
            try {
                for (const file of fs.readdirSync(skillsDir)) {
                    const match = file.match(/^(.+)_community_rules\.md$/);
                    if (match) alreadyFetched.add(match[1]);
                }
            } catch (e) {}
        }

        const declinedSet = new Set();
        const declinedPath = path.join(skillsDir, '.declined.json');
        if (fs.existsSync(declinedPath)) {
            try {
                const state = JSON.parse(fs.readFileSync(declinedPath, 'utf-8'));
                for (const fw of (state.declined || [])) declinedSet.add(fw);
            } catch (e) {}
        }

        const newSuggestions = detectedFrameworks.filter(fw =>
            !alreadyFetched.has(fw) && !declinedSet.has(fw)
        );

        if (newSuggestions.length > 0) {
            context.push(`\n[Avvarre] Detected stack frameworks: ${newSuggestions.join(', ')}`);
            context.push(`Community best-practice skills are available for these frameworks.`);
            context.push(`Ask the developer: "I detected ${newSuggestions.join(', ')} in your project. Community skills are available. Want me to fetch them?"`);
            context.push(`To fetch: call suggest_skills tool with action "fetch"`);
            context.push(`To skip: call suggest_skills tool with action "decline"`);
        }
    }

    if (context.length > 0) {
        console.log(JSON.stringify({
            injectSteps: [
                {
                    ephemeralMessage: context.join('\n')
                }
            ]
        }));
    } else {
        console.log(JSON.stringify({}));
    }
    process.exit(0);
});
