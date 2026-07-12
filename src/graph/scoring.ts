import { DatabaseSync } from 'node:sqlite';
import { GraphNode } from './index.js';

// Keywords to detect security-sensitive components
const SECURITY_KEYWORDS = [
    'auth', 'login', 'sign', 'crypt', 'key', 'pass', 'token', 
    'secr', 'admin', 'cred', 'jwt', 'pay', 'wallet', 'session',
    'db', 'sql', 'db_connection', 'hash', 'encrypt', 'decrypt'
];

/**
 * Computes a risk score between 0.0 and 1.0 for a given node.
 */
export function computeRiskScore(db: DatabaseSync, node: GraphNode): number {
    let score = 0.0;

    // 1. Test Coverage factor (0.30 if untested, 0.05 if tested)
    const testedStmt = db.prepare("SELECT COUNT(*) as cnt FROM edges WHERE target_qualified = ? AND kind = 'TESTED_BY'");
    const testCountRow = testedStmt.get(node.qualified_name) as { cnt: number } | undefined;
    const hasTest = (testCountRow?.cnt || 0) > 0;
    score += hasTest ? 0.05 : 0.30;

    // 2. Security Sensitivity factor (0.20 if matches keywords)
    const nameLower = node.name.toLowerCase();
    const qnLower = node.qualified_name.toLowerCase();
    const isSecuritySensitive = SECURITY_KEYWORDS.some(kw => nameLower.includes(kw) || qnLower.includes(kw));
    if (isSecuritySensitive) {
        score += 0.20;
    }

    // 3. Caller count / Fan-in factor (cap at 0.10)
    const callersStmt = db.prepare("SELECT COUNT(*) as cnt FROM edges WHERE target_qualified = ? AND kind = 'CALLS'");
    const callersRow = callersStmt.get(node.qualified_name) as { cnt: number } | undefined;
    const callerCount = callersRow?.cnt || 0;
    score += Math.min(callerCount / 20.0, 0.10);

    // Round to 3 decimal places and clamp between 0.0 and 1.0
    return Math.round(Math.min(Math.max(score, 0.0), 1.0) * 1000) / 1000;
}

export interface ChangeAnalysisResult {
    summary: string;
    risk_score: number;
    changed_functions: Array<GraphNode & { risk_score: number }>;
    test_gaps: Array<{ name: string; qualified_name: string; file: string; line_start: number }>;
    review_priorities: Array<GraphNode & { risk_score: number }>;
}

/**
 * Analyzes workspace changes by calculating risk scores and test gaps for modified nodes.
 */
export function analyzeChanges(db: DatabaseSync, changedFiles: string[]): ChangeAnalysisResult {
    const changedNodes: GraphNode[] = [];
    const getFileNodes = db.prepare('SELECT * FROM nodes WHERE file_path = ?');

    for (const file of changedFiles) {
        const rows = getFileNodes.all(file) as any[];
        for (const row of rows) {
            changedNodes.push({
                ...row,
                extra: JSON.parse(row.extra || '{}'),
                is_test: row.is_test === 1
            });
        }
    }

    // Filter to functions/classes for scoring
    const changedFuncs = changedNodes.filter(n => n.kind === 'Function' || n.kind === 'Class' || n.kind === 'Test');

    // Score changed functions
    const scoredFuncs = changedFuncs.map(node => {
        const risk = computeRiskScore(db, node);
        return {
            ...node,
            risk_score: risk
        };
    });

    // Overall risk score is the maximum of individual risks
    const overallRisk = scoredFuncs.reduce((max, n) => Math.max(max, n.risk_score), 0.0);

    // Detect test gaps (changed functions without TESTED_BY edges)
    const testGaps: Array<{ name: string; qualified_name: string; file: string; line_start: number }> = [];
    const testedStmt = db.prepare("SELECT COUNT(*) as cnt FROM edges WHERE target_qualified = ? AND kind = 'TESTED_BY'");

    for (const node of scoredFuncs) {
        if (node.is_test || node.kind === 'Test') {
            continue;
        }
        const testCountRow = testedStmt.get(node.qualified_name) as { cnt: number } | undefined;
        const hasTest = (testCountRow?.cnt || 0) > 0;

        if (!hasTest) {
            testGaps.push({
                name: node.name,
                qualified_name: node.qualified_name,
                file: node.file_path,
                line_start: node.line_start
            });
        }
    }

    // Review priorities: top 5 by risk score
    const reviewPriorities = [...scoredFuncs]
        .sort((a, b) => b.risk_score - a.risk_score)
        .slice(0, 5);

    // Build summary text
    const summaryLines = [
        `Analyzed ${changedFiles.length} changed file(s):`,
        `  - ${changedFuncs.length} changed function(s)/class(es)`,
        `  - ${testGaps.length} test gap(s) identified`,
        `  - Overall risk score: ${overallRisk.toFixed(2)}`
    ];

    if (testGaps.length > 0) {
        const gapNames = testGaps.slice(0, 3).map(g => g.name);
        summaryLines.push(`  - Untested changes in: ${gapNames.join(', ')}`);
    }

    return {
        summary: summaryLines.join('\n'),
        risk_score: overallRisk,
        changed_functions: scoredFuncs,
        test_gaps: testGaps,
        review_priorities: reviewPriorities
    };
}
