/**
 * Scorer module for avvarre.
 *
 * Calculates scores and grades from a list of violations.
 * Scoring formula:
 *   Score = max(0, 100 - sum(penalties))
 *   Grade: A (90-100) | B (80-89) | C (70-79) | D (60-69) | F (0-59)
 */

import { Violation, Severity, CategoryScore, SEVERITY_PENALTIES, Language } from '../types.js';

/** Map language codes to their style guide display names. */
export const LANGUAGE_GUIDE_NAMES: Record<Language, string> = {
    python: "Google's Python Style Guide",
    javascript: "Google's JavaScript Style Guide",
    typescript: "Google's TypeScript Style Guide",
    java: "Google's Java Style Guide",
    go: "Google's Go Style Guide",
    cpp: "Google's C++ Style Guide",
    kotlin: "Google's Kotlin Style Guide",
    shell: "Google's Shell Style Guide",
    swift: "Google's Swift Style Guide",
    objc: "Google's Objective-C Style Guide",
    csharp: "Google's C# Style Guide",
    dart: "Effective Dart Style Guide",
    r: "Google's R Style Guide",
    html: "Google's HTML/CSS Style Guide",
    css: "Google's HTML/CSS Style Guide",
    markdown: "Google Developer Documentation Style Guide",
    json: "Google's JSON Style Guide",
    xml: "Google's XML Document Format Style Guide",
    vimscript: "Google's Vimscript Style Guide",
    lisp: "Google's Common Lisp Style Guide",
    angular: "Google's AngularJS Style Guide"
};


/**
 * Calculate the overall score from a list of violations, scaled by file size.
 * 
 * To ensure fairness:
 * 1. Calculate raw penalty points.
 * 2. If the file is very large (e.g. > 100 lines), we apply a dampening factor
 *    so a 1000-line file isn't unfairly punished compared to a 50-line file.
 * 3. Base normalized divisor represents "expected" penalty per N lines.
 * 
 * We use `Math.log10` to gently scale the deduction.
 * 
 * Score starts at 100 and deducts structured penalty points.
 */
export function calculateScore(violations: Violation[], totalLines: number): number {
    const rawPenalty = violations.reduce((sum, v) => sum + SEVERITY_PENALTIES[v.severity], 0);

    if (rawPenalty === 0) return 100;

    // Normalization factor: Assume 100 lines is the "standard" baseline
    // Files < 100 lines get full, strict penalties.
    // Files > 100 lines get a logarithmic dampening factor.
    let dampingFactor = 1.0;
    if (totalLines > 100) {
        // e.g., 1000 lines -> log10(1000/100) = log10(10) = 1 (meaning factor is 1 + 1 = 2)
        // Penalty is halved for a file 10x the size.
        dampingFactor = 1 + Math.log10(totalLines / 100);
    }

    const normalizedPenalty = rawPenalty / dampingFactor;
    return Math.max(0, Math.round(100 - normalizedPenalty));
}

/**
 * Convert a numeric score (0-100) to a letter grade.
 */
export function calculateGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
}

/**
 * Calculate per-category scores from violations.
 *
 * Categories are derived from the rule ID prefix.
 * E.g., "PY-IMP-01" → category "Imports"
 *        "PY-EXC-01" → category "Exceptions"
 */
export function calculateCategoryScores(violations: Violation[], totalLines: number): CategoryScore[] {
    // Map rule ID prefixes to human-readable category names
    const categoryNames: Record<string, string> = {
        'IMP': 'Imports',
        'EXC': 'Exceptions',
        'BOOL': 'Booleans',
        'NAME': 'Naming',
        'COMP': 'Comprehensions',
        'ITER': 'Iterators',
        'DOC': 'Documentation',
        'MAIN': 'Structure',
        'LEN': 'Length',
        'MUT': 'Mutability',
        'GLOB': 'Global State',
        'PWR': 'Power Features',
        'FMT': 'Formatting',
        'STR': 'Strings',
        'RES': 'Resources',
        'STMT': 'Statements',
        'TYPE': 'Type Annotations',
        'DEC': 'Decorators',
        'CMT': 'Comments',
        'CLS': 'Classes',
        'FUNC': 'Functions',
        'PTR': 'Pointers',
        'LANG': 'Language Features',
        'HDR': 'Headers',
        'VAR': 'Variables',
        'CAST': 'Casting',
        'PROP': 'Properties',
        'INTF': 'Interfaces',
        'LAMBDA': 'Lambdas',
    };

    // Group violations by category
    const categoryViolations = new Map<string, Violation[]>();

    for (const violation of violations) {
        // Extract category from rule ID: "PY-EXC-01" → "EXC"
        const parts = violation.ruleId.split('-');
        const categoryKey = parts.length >= 2 ? parts[1] : 'OTHER';
        const categoryName = categoryNames[categoryKey] || categoryKey;

        if (!categoryViolations.has(categoryName)) {
            categoryViolations.set(categoryName, []);
        }
        categoryViolations.get(categoryName)!.push(violation);
    }

    // Length normalization factor (same logic as calculateScore)
    let dampingFactor = 1.0;
    if (totalLines > 100) {
        dampingFactor = 1 + Math.log10(totalLines / 100);
    }

    // Calculate score per category
    const categoryScores: CategoryScore[] = [];
    for (const [category, catViolations] of categoryViolations) {
        const rawPenalty = catViolations.reduce((sum, v) => {
            return sum + SEVERITY_PENALTIES[v.severity];
        }, 0);

        const normalizedPenalty = rawPenalty / dampingFactor;

        categoryScores.push({
            category,
            score: Math.max(0, Math.round(100 - normalizedPenalty)),
            violationCount: catViolations.length,
        });
    }

    // Sort by score ascending (worst first)
    categoryScores.sort((a, b) => a.score - b.score);

    return categoryScores;
}

/**
 * Generate a human-readable summary of the analysis.
 */
export function generateSummary(
    score: number,
    grade: string,
    violations: Violation[],
    totalLines: number,
    language?: Language,
): string {
    if (violations.length === 0) {
        const guideName = language ? LANGUAGE_GUIDE_NAMES[language] : "Google's Style Guide";
        return `Perfect score! No violations found in ${totalLines} lines of code. Your code follows ${guideName}.`;
    }

    const critical = violations.filter(v => v.severity === 'critical').length;
    const high = violations.filter(v => v.severity === 'high').length;
    const medium = violations.filter(v => v.severity === 'medium').length;
    const low = violations.filter(v => v.severity === 'low').length;

    const parts: string[] = [
        `Score: ${score}/100 (Grade ${grade}).`,
        `Found ${violations.length} violation${violations.length === 1 ? '' : 's'} in ${totalLines} lines.`,
    ];

    const breakdown: string[] = [];
    if (critical > 0) breakdown.push(`${critical} critical`);
    if (high > 0) breakdown.push(`${high} high`);
    if (medium > 0) breakdown.push(`${medium} medium`);
    if (low > 0) breakdown.push(`${low} low`);

    if (breakdown.length > 0) {
        parts.push(`Breakdown: ${breakdown.join(', ')}.`);
    }

    return parts.join(' ');
}
