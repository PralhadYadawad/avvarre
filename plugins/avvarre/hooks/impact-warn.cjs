#!/usr/bin/env node
// Codex PreToolUse hook — warns about downstream callers, inheritors, and test gaps.
const fs = require('node:fs');
const path = require('node:path');

function readInput(callback) {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => {
        try {
            callback(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
            callback({});
        }
    });
}

function getChangedFiles(input, cwd) {
    const files = new Set();

    if (typeof input === 'string') {
        for (const match of input.matchAll(/^\*\*\* (?:Update|Delete|Add|Move) File: (.+)$/gm)) {
            const filePath = match[1].trim();
            files.add(path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(cwd, filePath));
        }
    } else if (input && typeof input === 'object') {
        for (const key of ['command', 'patch', 'input']) {
            if (typeof input[key] === 'string') {
                for (const match of input[key].matchAll(/^\*\*\* (?:Update|Delete|Add|Move) File: (.+)$/gm)) {
                    const filePath = match[1].trim();
                    files.add(path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(cwd, filePath));
                }
            }
        }
        for (const key of ['filePath', 'file_path', 'path', 'TargetFile', 'targetFile', 'target_file', 'AbsolutePath', 'absolute_path']) {
            if (typeof input[key] === 'string') {
                const fp = input[key];
                files.add(path.isAbsolute(fp) ? path.normalize(fp) : path.resolve(cwd, fp));
            }
        }
        if (Array.isArray(input.files)) {
            for (const f of input.files) {
                files.add(path.isAbsolute(f) ? path.normalize(f) : path.resolve(cwd, f));
            }
        }
    }

    return [...files].filter((filePath) => fs.existsSync(filePath));
}

function isNodeSqliteAvailable() {
    try { require('node:sqlite'); return true; } catch (e) { return false; }
}

readInput((input) => {
    const cwd = input.cwd || process.cwd();
    const toolInput = input.tool_input || input;
    const changedFiles = getChangedFiles(toolInput, cwd);
    const dbPath = path.join(cwd, '.avvarre', 'graph.db');

    if (changedFiles.length === 0 || !fs.existsSync(dbPath) || !isNodeSqliteAvailable()) {
        process.exit(0);
    }

    let db;
    try {
        const { DatabaseSync } = require('node:sqlite');
        db = new DatabaseSync(dbPath);

        const warningLines = [];
        const testGapLines = [];

        const cteQuery = db.prepare(`
            WITH RECURSIVE impacted(node_qn, depth, relation_path) AS (
                SELECT qualified_name, 0, name FROM nodes WHERE file_path = ? AND (kind = 'Function' OR kind = 'Class' OR kind = 'Type')
                UNION
                SELECT e.source_qualified, i.depth + 1, e.source_qualified || ' -> ' || i.relation_path
                FROM impacted i
                JOIN edges e ON (e.target_qualified = i.node_qn OR i.node_qn LIKE '%::' || e.target_qualified)
                WHERE i.depth < 3 AND e.kind = 'CALLS'
                UNION
                SELECT e.source_qualified, i.depth + 1, e.source_qualified || ' -> ' || i.relation_path
                FROM impacted i
                JOIN edges e ON (e.target_qualified = i.node_qn OR i.node_qn LIKE '%::' || e.target_qualified)
                WHERE i.depth < 3 AND e.kind = 'INHERITS'
            )
            SELECT DISTINCT i.node_qn, i.depth, i.relation_path, n.name, n.file_path, n.line_start, n.kind
            FROM impacted i
            JOIN nodes n ON n.qualified_name = i.node_qn
            WHERE n.file_path != ?
            ORDER BY i.depth ASC
            LIMIT 30
        `);

        const testCheckQuery = db.prepare(`
            SELECT COUNT(*) as cnt FROM edges WHERE target_qualified = ? AND kind = 'TESTED_BY'
        `);

        for (const file of changedFiles) {
            const relativeFile = path.relative(cwd, file);
            const rows = cteQuery.all(file, file);

            if (rows.length > 0) {
                warningLines.push(`- Modifying \`${relativeFile}\` has potential downstream impacts:`);
                for (const row of rows) {
                    const relativeImpactedFile = path.relative(cwd, row.file_path);
                    warningLines.push(`  * ${row.kind} \`${row.name}\` in \`${relativeImpactedFile}\` (Line ${row.line_start})`);
                    warningLines.push(`    Path: ${row.relation_path}`);

                    if (row.kind === 'Function' || row.kind === 'Class') {
                        const testCheck = testCheckQuery.get(row.node_qn);
                        const hasTest = (testCheck && testCheck.cnt > 0);
                        if (!hasTest) {
                            testGapLines.push(`  * ${row.kind} \`${row.name}\` in \`${relativeImpactedFile}\` (untested)`);
                        }
                    }
                }
            }
        }

        if (warningLines.length > 0) {
            const warningMessage = [
                `[Avvarre] DOWNSTREAM IMPACT WARNING:`,
                ...warningLines,
                '',
            ];

            if (testGapLines.length > 0) {
                warningMessage.push(
                    `[Avvarre] TEST GAP ALERTS (Untested downstream components):`,
                    ...testGapLines,
                    '',
                );
            }

            warningMessage.push(`Please review the above impacts to ensure changes do not break downstream callers.`);

            console.log(JSON.stringify({
                systemMessage: `[Avvarre] This edit may have downstream impact.`,
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    additionalContext: warningMessage.join('\n'),
                }
            }));
        }
    } catch {
        // Impact hints must never prevent an edit.
    } finally {
        if (db && typeof db.close === 'function') db.close();
    }
});
