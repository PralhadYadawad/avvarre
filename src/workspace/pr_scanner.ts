import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { analyze } from '../analyzer/engine.js';
import { getLanguageForFile } from './scanner.js';

export interface PrCheckResult {
    file: string;
    score: number;
    grade: string;
    violations: number;
    language: string;
    passed: boolean;
}

export interface PrQualityReport {
    summary: string;
    pass: boolean;
    results: PrCheckResult[];
}

/**
 * Scans all modified files in the current git repository.
 * Compares against HEAD by default, or unstaged/staged changes if no HEAD.
 * Returns a pass/fail report based on the provided score threshold.
 */
export function scanGitDiff(workspaceRoot: string, minScoreThreshold: number = 80): PrQualityReport {
    let diffFiles: string[] = [];
    try {
        // Try getting diff against HEAD (files changed in working tree or matched to next commit)
        const stdout = execSync('git diff --name-only HEAD', { cwd: workspaceRoot, encoding: 'utf-8' });
        diffFiles = stdout.split('\n').map(f => f.trim()).filter(f => f.length > 0);

        // Also check cached/staged files if HEAD diff is empty or missing something just added
        const cachedStdout = execSync('git diff --cached --name-only', { cwd: workspaceRoot, encoding: 'utf-8' });
        const cachedFiles = cachedStdout.split('\n').map(f => f.trim()).filter(f => f.length > 0);

        // Merge and deduplicate
        diffFiles = Array.from(new Set([...diffFiles, ...cachedFiles]));
    } catch (e) {
        // Fallback: perhaps no HEAD yet (first commit). Get all tracked/untracked
        try {
            const statusOut = execSync('git status --porcelain', { cwd: workspaceRoot, encoding: 'utf-8' });
            diffFiles = statusOut.split('\n')
                .filter(line => line.length > 3)
                .map(line => line.substring(3).trim())
                .filter(f => f.length > 0);
        } catch {
            throw new Error(`Failed to execute git commands in ${workspaceRoot}. Ensure it is a git repository.`);
        }
    }

    if (diffFiles.length === 0) {
        return {
            summary: "No changed files detected by git.",
            pass: true,
            results: []
        };
    }

    const results: PrCheckResult[] = [];
    let allPassed = true;

    for (const relFile of diffFiles) {
        const lang = getLanguageForFile(relFile);
        if (!lang) continue; // Skip unsupported files

        const absolutePath = path.join(workspaceRoot, relFile);
        if (!fs.existsSync(absolutePath)) continue; // Skip deleted files

        try {
            const code = fs.readFileSync(absolutePath, 'utf8');
            const result = analyze(code, lang, absolutePath);

            const passed = result.score >= minScoreThreshold;
            if (!passed) allPassed = false;

            results.push({
                file: relFile,
                language: lang,
                score: result.score,
                grade: result.grade,
                violations: result.violations.length,
                passed
            });
        } catch (e) {
            // Skip unreadable files
        }
    }

    if (results.length === 0) {
        return {
            summary: "Changed files detected, but none are in supported languages.",
            pass: true,
            results: []
        };
    }

    const avgScore = Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length);
    const passCount = results.filter(r => r.passed).length;

    let summary = `PR Quality Gate: ${allPassed ? '✅ PASSED' : '❌ FAILED'}\n`;
    summary += `- Files analyzed: ${results.length}\n`;
    summary += `- Average Score: ${avgScore}/100\n`;
    summary += `- Passed threshold (${minScoreThreshold}+): ${passCount}/${results.length}\n\n`;

    if (!allPassed) {
        summary += `The following files failed the quality gate (score < ${minScoreThreshold}):\n`;
        for (const failure of results.filter(r => !r.passed)) {
            summary += `  - ${failure.file}: Score ${failure.score} (${failure.grade}) — ${failure.violations} violations\n`;
        }
        summary += `\nPlease run '/avvarre' on these files and apply the suggested fixes before merging.`;
    } else {
        summary += `All changed files meet the minimum quality standard!`;
    }

    return {
        summary,
        pass: allPassed,
        results
    };
}
