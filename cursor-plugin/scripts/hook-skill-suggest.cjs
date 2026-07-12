#!/usr/bin/env node
// Avvarre sessionStart hook — auto-detects tech stack and suggests community skills
//
// Detection layers:
//   1. Manifest files (package.json, go.mod, Cargo.toml, etc.)
//   2. Config files (next.config.js, tailwind.config.js, etc.)
//   3. File extensions (fallback)
//
// Respects .avvarre/skills/.declined.json — never re-asks for declined skills.

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
    const skillsDir = path.join(avvarreDir, 'skills');

    // Only run if .avvarre/ exists (bootstrap hook handles the missing case)
    if (!fs.existsSync(avvarreDir)) {
        process.exit(0);
    }

    // ── Detect Stack ───────────────────────────────────────────────
    const detected = {};

    function add(fw, source) {
        if (!detected[fw]) detected[fw] = source;
    }

    // Layer 1: Manifests
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

    // Python manifests
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

    // Layer 2: Config files
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

    // Layer 3: File extensions (scan top-level and src/)
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

    // ── Filter: only frameworks with community skills ──────────────
    const fetchable = new Set([
        'nextjs', 'react', 'vue', 'svelte', 'tailwind',
        'node', 'express', 'python', 'fastapi',
        'typescript', 'rust', 'cpp',
    ]);

    const detectedFrameworks = Object.keys(detected).filter(fw => fetchable.has(fw));

    if (detectedFrameworks.length === 0) {
        process.exit(0);
    }

    // ── Check already fetched ──────────────────────────────────────
    const alreadyFetched = new Set();
    if (fs.existsSync(skillsDir)) {
        try {
            for (const file of fs.readdirSync(skillsDir)) {
                const match = file.match(/^(.+)_community_rules\.md$/);
                if (match) alreadyFetched.add(match[1]);
            }
        } catch (e) {}
    }

    // ── Check declined ─────────────────────────────────────────────
    const declinedSet = new Set();
    const declinedPath = path.join(skillsDir, '.declined.json');
    if (fs.existsSync(declinedPath)) {
        try {
            const state = JSON.parse(fs.readFileSync(declinedPath, 'utf-8'));
            for (const fw of (state.declined || [])) declinedSet.add(fw);
        } catch (e) {}
    }

    // ── Compute new suggestions ────────────────────────────────────
    const newSuggestions = detectedFrameworks.filter(fw =>
        !alreadyFetched.has(fw) && !declinedSet.has(fw)
    );

    if (newSuggestions.length === 0) {
        process.exit(0);
    }

    // ── Output suggestion to AI ────────────────────────────────────
    const fwList = newSuggestions.map(fw => `${fw} (from ${detected[fw]})`).join(', ');
    const msg = [
        `[Avvarre] Detected stack: ${newSuggestions.join(', ')}`,
        `Community best-practice skills are available for these frameworks.`,
        `Ask the developer: "I detected ${newSuggestions.join(', ')} in your project. Community skills are available. Want me to fetch them?"`,
        `To fetch: call suggest_skills tool with action "fetch"`,
        `To skip: call suggest_skills tool with action "decline"`,
        `Declined skills are remembered and never suggested again.`,
    ].join('\n');

    console.log(JSON.stringify({
        systemMessage: `[Avvarre] New community skills available: ${newSuggestions.join(', ')}`,
        hookSpecificOutput: {
            hookEventName: 'sessionStart',
            additionalContext: msg
        }
    }));

    process.exit(0);
});
