/**
 * Workspace Scanner for avvarre
 *
 * Scans an entire directory of source files:
 *   1. Discovers all files matching the target language (e.g., .py)
 *   2. Runs instant regex analysis on ALL discovered files
 *   3. Produces a "heatmap" ranking files by violation severity
 *   4. Optionally sends the top-N worst files for AI deep analysis
 *   5. Returns a combined result with clear user notifications
 *
 * Design decisions:
 *   - Regex scan is ALWAYS run on every file (it's instant).
 *   - AI scan is run only on the top N worst files (configurable via ai_depth).
 *   - Large files within the AI scan use the chunking system automatically.
 *   - Directories like __pycache__, .venv, node_modules, .git are skipped.
 */

import * as fs from 'fs';
import * as path from 'path';
import { analyze } from '../analyzer/engine.js';
import { createAiClientFromEnv, IAiClient } from '../ai/client.js';
import type { Language } from '../types.js';
import type { avvarreFileResult } from '../ai/types.js';

// ── Types ──────────────────────────────────────────────────────────────

/** Score summary for one file in the heatmap */
export interface FileScore {
    /** Relative file path from the scanned directory */
    filepath: string;
    /** Total lines in the file */
    lines: number;
    /** Number of regex violations found */
    regexViolations: number;
    /** Score (0-100) from regex analysis */
    score: number;
    /** Grade (A-F) */
    grade: string;
    /** Whether this file was sent for AI deep analysis */
    deepAnalyzed: boolean;
}

/** The complete result of a workspace scan */
export interface WorkspaceResult {
    /** The directory that was scanned */
    directory: string;
    /** Language scanned */
    language: Language;
    /** Total number of files found and scanned */
    scannedFiles: number;
    /** Number of files skipped (binary, too large, etc.) */
    skippedFiles: number;
    /** Total regex violations across all files */
    totalRegexViolations: number;
    /** The heatmap: ALL files ranked by violations (worst first) */
    heatmap: FileScore[];
    /** Deep AI analysis results for only for the top-N worst files */
    deepAnalysisResults: avvarreFileResult[];
    /** How many files were selected for AI deep analysis */
    aiDepth: number;
    /** Plain-language explanation for the user */
    userNote: string;
}

// ── Configuration ──────────────────────────────────────────────────────

/** Directories to always skip */
const SKIP_DIRS = new Set([
    'node_modules', '__pycache__', '.git', '.svn', '.hg',
    'venv', '.venv', 'env', '.env', '.tox',
    'dist', 'build', '.eggs', '*.egg-info',
    '.mypy_cache', '.pytest_cache', '.ruff_cache',
]);

/** File extension mapping by language */
const LANGUAGE_EXTENSIONS: Record<Language, string[]> = {
    python: ['.py'],
    javascript: ['.js', '.jsx', '.mjs', '.cjs'],
    typescript: ['.ts', '.tsx', '.mts', '.cts'],
    java: ['.java'],
    go: ['.go'],
    cpp: ['.cc', '.cpp', '.cxx', '.h', '.hpp'],
    kotlin: ['.kt', '.kts'],
    shell: ['.sh'],
    swift: ['.swift'],
    objc: ['.m', '.h', '.mm'],
    csharp: ['.cs'],
    dart: ['.dart'],
    r: ['.R', '.r', '.Rmd', '.rmd'],
    html: ['.html', '.htm'],
    css: ['.css'],
    markdown: ['.md', '.markdown'],
    json: ['.json', '.jsonc'],
    xml: ['.xml'],
    vimscript: ['.vim'],
    lisp: ['.lisp', '.cl', '.lsp'],
    angular: ['.ng.js', '.ng.ts'] // AngularJS specifically - standard JS/TS files are handled by their own parsers unless asked to run 'angular' mode
};

/** Maximum file size to analyze (skip very large generated files) */
const MAX_FILE_SIZE_BYTES = 500_000; // 500KB

/**
 * Returns the supported Language enum for a given filename or path.
 * Returns null if the file extension is not supported by avvarre.
 */
export function getLanguageForFile(filePath: string): Language | null {
    // Extract extension (e.g., ".ts" from "src/utils.ts")
    const match = filePath.match(/\.[0-9a-z]+$/i);
    if (!match) return null;

    const ext = match[0].toLowerCase();

    for (const [lang, extensions] of Object.entries(LANGUAGE_EXTENSIONS)) {
        if (extensions.includes(ext) || extensions.includes(ext.toLowerCase())) {
            return lang as Language;
        }
    }
    return null;
}


// ── .avvarre/ignore Support ──────────────────────────────────────────

/**
 * Parse a .avvarre/ignore file into a list of glob patterns.
 * Strips comments (#), blank lines, and trailing whitespace.
 */
function parseIgnoreFile(filePath: string): string[] {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));
    } catch {
        return [];
    }
}

/**
 * Load ignore patterns from .avvarre/ignore in the given directory,
 * plus any runtime context masking from .avvarre/.vibe_context.
 * Falls back to an empty list if neither file exists.
 */
function loadIgnorePatterns(workspaceRoot: string): string[] {
    const ignorePath = path.join(workspaceRoot, '.avvarre', 'ignore');
    const contextPath = path.join(workspaceRoot, '.avvarre', '.vibe_context');
    return [...parseIgnoreFile(ignorePath), ...parseIgnoreFile(contextPath)];
}

/**
 * Check if a path (relative to workspace root) matches any ignore pattern.
 * Supports simple gitignore-style patterns:
 *   - 'node_modules/' matches any directory named node_modules
 *   - '*.min.js' matches any file ending in .min.js
 *   - '*.generated.*' matches files with .generated. in the name
 *   - 'dist/' matches the dist directory
 */
function matchesIgnorePattern(relativePath: string, patterns: string[]): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    const parts = normalized.split('/');

    for (const pattern of patterns) {
        // Directory pattern (ends with /)
        if (pattern.endsWith('/')) {
            const dirName = pattern.slice(0, -1);
            if (parts.some(part => part === dirName)) return true;
        }
        // Glob with * (simple wildcard matching)
        else if (pattern.includes('*')) {
            const regex = new RegExp(
                '^' + pattern
                    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape special regex chars
                    .replace(/\*/g, '.*')                    // * → .*
                + '$'
            );
            // Match against filename only
            const filename = parts[parts.length - 1];
            if (regex.test(filename)) return true;
            // Also match against full relative path
            if (regex.test(normalized)) return true;
        }
        // Exact match (file or directory name)
        else {
            if (parts.some(part => part === pattern)) return true;
            if (normalized === pattern) return true;
        }
    }
    return false;
}

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Recursively discover all files matching the target language in a directory.
 * Applies both the hardcoded SKIP_DIRS and any .avvarre/ignore patterns.
 */
function discoverFiles(
    dir: string,
    language: Language,
    ignorePatterns: string[] = [],
): { found: string[], skipped: number } {
    const extensions = LANGUAGE_EXTENSIONS[language];
    if (!extensions) {
        throw new Error(`Unsupported language: ${language}`);
    }

    const found: string[] = [];
    let skipped = 0;

    function walk(currentDir: string) {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
            // Permission denied or other FS error — skip silently
            skipped++;
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const relativePath = path.relative(dir, fullPath);

            if (entry.isDirectory()) {
                // Skip known non-source directories
                if (SKIP_DIRS.has(entry.name)) continue;
                // Skip directories matching .avvarre/ignore patterns
                if (ignorePatterns.length > 0 && matchesIgnorePattern(relativePath, ignorePatterns)) {
                    skipped++;
                    continue;
                }
                walk(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!extensions.includes(ext)) continue;

                // Skip files matching .avvarre/ignore patterns
                if (ignorePatterns.length > 0 && matchesIgnorePattern(relativePath, ignorePatterns)) {
                    skipped++;
                    continue;
                }

                // Skip very large files
                try {
                    const stats = fs.statSync(fullPath);
                    if (stats.size > MAX_FILE_SIZE_BYTES) {
                        skipped++;
                        continue;
                    }
                } catch {
                    skipped++;
                    continue;
                }

                found.push(fullPath);
            }
        }
    }

    walk(dir);
    return { found, skipped };
}

/**
 * Scan an entire workspace directory.
 *
 * @param directory - Absolute path to the directory to scan
 * @param language - Language to scan for
 * @param aiDepth - Number of worst files to send for AI deep analysis (0 = regex only)
 */
export async function scanWorkspace(
    directory: string,
    language: Language,
    aiDepth: number = 5,
): Promise<WorkspaceResult> {

    // ── Step 1: Validate the directory ────────────────────────────────
    if (!fs.existsSync(directory)) {
        throw new Error(`Directory not found: ${directory}`);
    }

    const stats = fs.statSync(directory);
    if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${directory}`);
    }

    // ── Step 2: Load ignore patterns & discover files ─────────────────
    const ignorePatterns = loadIgnorePatterns(directory);
    const { found: files, skipped: skippedCount } = discoverFiles(directory, language, ignorePatterns);

    if (files.length === 0) {
        return {
            directory,
            language,
            scannedFiles: 0,
            skippedFiles: skippedCount,
            totalRegexViolations: 0,
            heatmap: [],
            deepAnalysisResults: [],
            aiDepth,
            userNote: `No ${language} files found in ${directory}.`,
        };
    }

    // ── Step 3: Regex-scan ALL files (instant) ────────────────────────
    const heatmap: FileScore[] = [];
    let totalRegexViolations = 0;

    for (const filePath of files) {
        try {
            const code = fs.readFileSync(filePath, 'utf-8');
            const result = analyze(code, language);
            const relativePath = path.relative(directory, filePath);

            heatmap.push({
                filepath: relativePath,
                lines: result.totalLines,
                regexViolations: result.violations.length,
                score: result.score,
                grade: result.grade,
                deepAnalyzed: false,
            });

            totalRegexViolations += result.violations.length;
        } catch {
            // If a file can't be read/parsed, skip it
            continue;
        }
    }

    // ── Step 4: Sort by violations (worst files first) ────────────────
    heatmap.sort((a, b) => b.regexViolations - a.regexViolations);

    // ── Step 5: AI deep analysis on the top-N worst files ─────────────
    const deepAnalysisResults: avvarreFileResult[] = [];
    const effectiveAiDepth = Math.min(aiDepth, heatmap.length);

    if (effectiveAiDepth > 0) {
        const aiClient = createAiClientFromEnv();

        if (aiClient) {
            const filesToAnalyze = heatmap.slice(0, effectiveAiDepth);

            for (const fileScore of filesToAnalyze) {
                try {
                    const fullPath = path.join(directory, fileScore.filepath);
                    const code = fs.readFileSync(fullPath, 'utf-8');

                    const result = await aiClient.analyzeFile(code, language, fileScore.filepath);
                    deepAnalysisResults.push(result);

                    // Mark as deep-analyzed in the heatmap
                    fileScore.deepAnalyzed = true;
                } catch (error) {
                    // If AI fails for one file, continue with the rest
                    console.error(`[avvarre Workspace] AI analysis failed for ${fileScore.filepath}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
    }

    // ── Step 6: Build the user-facing notification ────────────────────
    const deepAnalyzedNames = heatmap
        .filter(f => f.deepAnalyzed)
        .map(f => f.filepath);

    let userNote = `Scanned ${heatmap.length} ${language} files in "${path.basename(directory)}". Found ${totalRegexViolations} total regex violations.`;

    if (skippedCount > 0) {
        userNote += ` ${skippedCount} files were skipped (too large, unreadable, or in excluded directories).`;
    }

    if (deepAnalyzedNames.length > 0) {
        userNote += ` Deep AI analysis was performed on the ${deepAnalyzedNames.length} worst files: ${deepAnalyzedNames.join(', ')}.`;
    } else if (effectiveAiDepth > 0) {
        userNote += ` No AI analysis was performed (API key not configured or AI unavailable). Set AI_BASE_URL + AI_API_KEY + AI_MODEL for deep analysis.`;
    } else {
        userNote += ` AI analysis was disabled (ai_depth=0). Set ai_depth to a positive number to enable deep analysis on worst files.`;
    }

    if (heatmap.length > effectiveAiDepth && effectiveAiDepth > 0) {
        userNote += ` To analyze more files, call avvarre_workspace again with a higher ai_depth value.`;
    }

    return {
        directory,
        language,
        scannedFiles: heatmap.length,
        skippedFiles: skippedCount,
        totalRegexViolations,
        heatmap,
        deepAnalysisResults,
        aiDepth: effectiveAiDepth,
        userNote,
    };
}
