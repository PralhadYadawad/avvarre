import { getProjectQualityMetrics } from './history.js';

export interface BadgeDetails {
    score: number;
    grade: string;
    markdown: string;
    message: string;
}

/**
 * Generates a Shields.io badge based on the average score
 * of all supported files in the workspace recorded in history.json.
 */
export function generateavvarreBadge(workspaceRoot: string): BadgeDetails {
    const metrics = getProjectQualityMetrics(workspaceRoot);

    if (!metrics) {
        return {
            score: 0,
            grade: 'N/A',
            markdown: '![avvarre Quality](https://img.shields.io/badge/avvarre-No%20Data-lightgrey)',
            message: 'No avvarre scan history found. Run a full workspace scan first to generate a badge.'
        };
    }

    const score = metrics.averageScore;
    const grade = metrics.grade;

    let color = "red";
    if (grade === "A") color = "brightgreen";
    else if (grade === "B") color = "green";
    else if (grade === "C") color = "yellow";
    else if (grade === "D") color = "orange";

    // URL encode the label and message
    const label = encodeURIComponent("avvarre");
    const msg = encodeURIComponent(`${grade} (${score}/100)`);

    const badgeUrl = `https://img.shields.io/badge/${label}-${msg}-${color}`;
    const markdown = `![avvarre Quality](${badgeUrl})`;

    return {
        score,
        grade,
        markdown,
        message: `Badge generated based on ${metrics.totalFiles} tracked files in history.json. Average score: ${score} (${grade}).\n\n${markdown}`
    };
}
