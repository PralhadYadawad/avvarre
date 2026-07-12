import * as fs from 'fs';
import * as path from 'path';

export interface HistoryEntry {
    date: string;
    file: string;
    language: string;
    score: number;
    grade: string;
    violations: number;
}

/**
 * Appends a score to the project's .avvarre/history.json if the directory exists.
 */
export function appendHistory(
    workspaceRoot: string,
    fileRelativePath: string,
    language: string,
    score: number,
    grade: string,
    violations: number
): void {
    const avvarreDir = path.join(workspaceRoot, '.avvarre');
    if (!fs.existsSync(avvarreDir)) {
        return; // Silent bypass if ecosystem scaffolding isn't active
    }

    const historyFile = path.join(avvarreDir, 'history.json');
    let history: HistoryEntry[] = [];

    if (fs.existsSync(historyFile)) {
        try {
            const content = fs.readFileSync(historyFile, 'utf-8');
            history = JSON.parse(content);
            if (!Array.isArray(history)) history = [];
        } catch {
            // If file is corrupted, start fresh
            history = [];
        }
    }

    // Append new entry
    history.push({
        date: new Date().toISOString(),
        file: fileRelativePath,
        language,
        score,
        grade,
        violations
    });

    // Write back, pretty printed
    try {
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf-8');
    } catch {
        // Silent fail on write error
    }
}

/**
 * Returns a summary of score trends for a specific file or the whole project.
 */
export function getHistoryTrends(workspaceRoot: string, targetFile?: string): string {
    const historyFile = path.join(workspaceRoot, '.avvarre', 'history.json');
    if (!fs.existsSync(historyFile)) {
        return 'No history tracking found. Score history requires .avvarre/history.json to exist.';
    }

    try {
        const content = fs.readFileSync(historyFile, 'utf-8');
        const history: HistoryEntry[] = JSON.parse(content);

        if (!Array.isArray(history) || history.length === 0) {
            return 'No historical records found.';
        }

        if (targetFile) {
            // File-specific trend
            const fileHistory = history.filter(h => h.file === targetFile);
            if (fileHistory.length === 0) {
                return `No history for file: ${targetFile}`;
            }

            // Sort chronically
            fileHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const first = fileHistory[0];
            const last = fileHistory[fileHistory.length - 1];
            const change = last.score - first.score;

            return `Trend for ${targetFile}:\n` +
                `- First scan (${first.date.split('T')[0]}): ${first.score}/100 (${first.grade})\n` +
                `- Latest scan (${last.date.split('T')[0]}): ${last.score}/100 (${last.grade})\n` +
                `- Net change: ${change >= 0 ? '+' : ''}${change} points across ${fileHistory.length} scans.`;
        } else {
            // Project overview trend (latest scan per file)
            const latestScores = new Map<string, HistoryEntry>();
            for (const entry of history) {
                // Relying on chronological append order, last seen is latest
                latestScores.set(entry.file, entry);
            }

            if (latestScores.size === 0) return 'No file scores recorded yet.';

            let totalScore = 0;
            let aGrades = 0, fGrades = 0;

            for (const entry of latestScores.values()) {
                totalScore += entry.score;
                if (entry.grade === 'A') aGrades++;
                if (entry.grade === 'F') fGrades++;
            }

            const avgScore = Math.round(totalScore / latestScores.size);

            return `Project Quality Trends:\n` +
                `- Files tracked: ${latestScores.size}\n` +
                `- Average score: ${avgScore}/100\n` +
                `- 'A' grade files: ${aGrades}\n` +
                `- 'F' grade files: ${fGrades}\n` +
                `Total historical scans performed: ${history.length}`;
        }
    } catch {
        return 'Failed to read tracking history.';
    }
}

export interface ProjectMetrics {
    totalFiles: number;
    averageScore: number;
    grade: string;
}

export function getProjectQualityMetrics(workspaceRoot: string): ProjectMetrics | null {
    const historyFile = path.join(workspaceRoot, '.avvarre', 'history.json');
    if (!fs.existsSync(historyFile)) return null;

    try {
        const content = fs.readFileSync(historyFile, 'utf-8');
        const history: HistoryEntry[] = JSON.parse(content);

        if (!Array.isArray(history) || history.length === 0) return null;

        const latestScores = new Map<string, HistoryEntry>();
        for (const entry of history) {
            latestScores.set(entry.file, entry);
        }

        if (latestScores.size === 0) return null;

        let totalScore = 0;
        for (const entry of latestScores.values()) {
            totalScore += entry.score;
        }

        const averageScore = Math.round(totalScore / latestScores.size);

        let grade = "F";
        if (averageScore >= 90) grade = "A";
        else if (averageScore >= 80) grade = "B";
        else if (averageScore >= 70) grade = "C";
        else if (averageScore >= 60) grade = "D";

        return {
            totalFiles: latestScores.size,
            averageScore,
            grade
        };
    } catch {
        return null;
    }
}
