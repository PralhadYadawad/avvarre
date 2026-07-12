/**
 * avvarre Stack Detector
 *
 * Auto-detects project tech stack by scanning manifest files, config files,
 * and file extensions. Manages per-skill decline tracking so users are never
 * re-prompted for skills they rejected.
 *
 * Detection priority:
 *   1. Manifest files (package.json, go.mod, Cargo.toml, etc.)
 *   2. Config files (next.config.js, tailwind.config.js, etc.)
 *   3. File extensions (fallback for projects without manifests)
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

/** Frameworks that map directly to community skill keys in community_fetcher.ts. */
const KNOWN_FRAMEWORKS = [
    'nextjs', 'react', 'vue', 'svelte', 'tailwind',
    'node', 'express', 'python', 'fastapi',
    'typescript', 'rust', 'cpp',
] as const;

type Framework = typeof KNOWN_FRAMEWORKS[number];

/** Result of auto-detecting the project's tech stack. */
export interface DetectedStack {
    /** Frameworks detected, using community_fetcher keys. */
    frameworks: string[];
    /** Map of framework → which file it was detected from. */
    detectedFrom: Record<string, string>;
}

/** A single skill suggestion for the user. */
export interface SkillSuggestion {
    framework: string;
    detectedFrom: string;
    alreadyFetched: boolean;
    declined: boolean;
}

/** Shape of .avvarre/skills/.declined.json */
interface DeclinedState {
    declined: string[];
    declinedAt: Record<string, string>;
}

// ── Detection Logic ────────────────────────────────────────────────────

/**
 * Detects the project tech stack by scanning manifest, config, and extension signals.
 */
export function detectStack(projectDir: string): DetectedStack {
    const frameworks: string[] = [];
    const detectedFrom: Record<string, string> = {};

    function add(fw: string, source: string): void {
        if (!frameworks.includes(fw)) {
            frameworks.push(fw);
            detectedFrom[fw] = source;
        }
    }

    // Layer 1: Manifest files
    detectFromPackageJson(projectDir, add);
    detectFromPythonManifests(projectDir, add);
    detectFromGoMod(projectDir, add);
    detectFromCargoToml(projectDir, add);
    detectFromPubspecYaml(projectDir, add);

    // Layer 2: Config files (catch frameworks that manifests miss)
    detectFromConfigFiles(projectDir, add);

    // Layer 3: File extension fallback
    detectFromExtensions(projectDir, add);

    return { frameworks, detectedFrom };
}

type AddFn = (fw: string, source: string) => void;

/** Parse package.json dependencies for JS/TS frameworks. */
function detectFromPackageJson(dir: string, add: AddFn): void {
    const pkgPath = join(dir, 'package.json');
    if (!existsSync(pkgPath)) return;

    try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
        };

        const depNames = Object.keys(allDeps);

        if (depNames.some(d => d === 'next')) add('nextjs', 'package.json');
        if (depNames.some(d => d === 'react' || d === 'react-dom')) add('react', 'package.json');
        if (depNames.some(d => d === 'vue' || d === '@vue/core')) add('vue', 'package.json');
        if (depNames.some(d => d === 'svelte' || d === '@sveltejs/kit')) add('svelte', 'package.json');
        if (depNames.some(d => d === 'tailwindcss')) add('tailwind', 'package.json');
        if (depNames.some(d => d === 'express')) add('express', 'package.json');
        if (depNames.some(d => d === 'typescript')) add('typescript', 'package.json');

        // Generic node detection if package.json exists but no specific framework matched
        if (existsSync(pkgPath)) add('node', 'package.json');
    } catch {
        // Malformed package.json — skip silently
    }
}

/** Check for Python manifests: requirements.txt, pyproject.toml, Pipfile. */
function detectFromPythonManifests(dir: string, add: AddFn): void {
    const files = ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py', 'setup.cfg'];
    for (const file of files) {
        const filePath = join(dir, file);
        if (!existsSync(filePath)) continue;

        add('python', file);

        try {
            const content = readFileSync(filePath, 'utf-8').toLowerCase();
            if (content.includes('fastapi')) add('fastapi', file);
        } catch {
            // Skip unreadable files
        }
        break; // One Python manifest is enough
    }
}

/** Check for go.mod. */
function detectFromGoMod(dir: string, add: AddFn): void {
    if (existsSync(join(dir, 'go.mod'))) {
        add('go' as string, 'go.mod');
    }
}

/** Check for Cargo.toml (Rust). */
function detectFromCargoToml(dir: string, add: AddFn): void {
    if (existsSync(join(dir, 'Cargo.toml'))) add('rust', 'Cargo.toml');
}

/** Check for pubspec.yaml (Dart/Flutter). */
function detectFromPubspecYaml(dir: string, add: AddFn): void {
    if (existsSync(join(dir, 'pubspec.yaml'))) {
        add('dart' as string, 'pubspec.yaml');
    }
}

/** Detect frameworks from config files that might not appear in manifests. */
function detectFromConfigFiles(dir: string, add: AddFn): void {
    const configMap: Record<string, string> = {
        'next.config.js': 'nextjs',
        'next.config.ts': 'nextjs',
        'next.config.mjs': 'nextjs',
        'tailwind.config.js': 'tailwind',
        'tailwind.config.ts': 'tailwind',
        'tailwind.config.cjs': 'tailwind',
        'svelte.config.js': 'svelte',
        'svelte.config.ts': 'svelte',
        'vite.config.ts': 'vite' as string,
        'vite.config.js': 'vite' as string,
        'tsconfig.json': 'typescript',
        'CMakeLists.txt': 'cpp',
    };

    for (const [file, fw] of Object.entries(configMap)) {
        if (existsSync(join(dir, file))) add(fw, file);
    }
}

/** Fallback: scan top-level and src/ for dominant file extensions. */
function detectFromExtensions(dir: string, add: AddFn): void {
    const extensionMap: Record<string, string> = {
        '.go': 'go' as string,
        '.rs': 'rust',
        '.swift': 'swift' as string,
        '.dart': 'dart' as string,
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.hpp': 'cpp',
    };

    const dirsToScan = [dir];
    const srcDir = join(dir, 'src');
    if (existsSync(srcDir)) dirsToScan.push(srcDir);

    for (const scanDir of dirsToScan) {
        try {
            const entries = readdirSync(scanDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile()) continue;
                for (const [ext, fw] of Object.entries(extensionMap)) {
                    if (entry.name.endsWith(ext)) {
                        add(fw, `${entry.name} (file extension)`);
                    }
                }
            }
        } catch {
            // Directory unreadable — skip
        }
    }
}

// ── Declined Skills Persistence ────────────────────────────────────────

/** Path to the declined skills JSON file. */
function declinedPath(projectDir: string): string {
    return join(projectDir, '.avvarre', 'skills', '.declined.json');
}

/** Read the list of frameworks the user has declined. */
export function getDeclinedSkills(projectDir: string): string[] {
    const p = declinedPath(projectDir);
    if (!existsSync(p)) return [];

    try {
        const data: DeclinedState = JSON.parse(readFileSync(p, 'utf-8'));
        return data.declined || [];
    } catch {
        return [];
    }
}

/** Persist frameworks the user has declined. Merges with existing declines. */
export function declineSkills(projectDir: string, frameworks: string[]): void {
    const p = declinedPath(projectDir);
    let state: DeclinedState = { declined: [], declinedAt: {} };

    if (existsSync(p)) {
        try {
            state = JSON.parse(readFileSync(p, 'utf-8'));
        } catch {
            // Start fresh if corrupted
        }
    }

    const today = new Date().toISOString().split('T')[0];
    for (const fw of frameworks) {
        if (!state.declined.includes(fw)) {
            state.declined.push(fw);
            state.declinedAt[fw] = today;
        }
    }

    writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}

// ── Suggestion Engine ──────────────────────────────────────────────────

/**
 * Returns actionable skill suggestions: detected frameworks that are
 * not yet fetched and not declined by the user.
 */
export function getSuggestedSkills(projectDir: string): SkillSuggestion[] {
    const { frameworks, detectedFrom } = detectStack(projectDir);
    const declined = getDeclinedSkills(projectDir);

    const skillsDir = join(projectDir, '.avvarre', 'skills');
    const existingSkills = new Set<string>();
    if (existsSync(skillsDir)) {
        try {
            for (const file of readdirSync(skillsDir)) {
                // Community skills are named {framework}_community_rules.md
                const match = file.match(/^(.+)_community_rules\.md$/);
                if (match) existingSkills.add(match[1]);
            }
        } catch {
            // Directory unreadable
        }
    }

    // Only include frameworks that have known community rules
    const fetchable = new Set(KNOWN_FRAMEWORKS as readonly string[]);

    return frameworks
        .filter(fw => fetchable.has(fw))
        .map(fw => ({
            framework: fw,
            detectedFrom: detectedFrom[fw],
            alreadyFetched: existingSkills.has(fw),
            declined: declined.includes(fw),
        }));
}

/**
 * Returns only the NEW suggestions — frameworks that are detected,
 * not yet fetched, and not declined. This is what the hook and tool
 * use to decide whether to prompt the user.
 */
export function getNewSuggestions(projectDir: string): SkillSuggestion[] {
    return getSuggestedSkills(projectDir).filter(s => !s.alreadyFetched && !s.declined);
}
