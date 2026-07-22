#!/usr/bin/env node

// Codex PreToolUse hook: warn about downstream callers before an apply_patch edit.
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

function getPatch(input) {
    if (typeof input === 'string') return input;
    if (!input || typeof input !== 'object') return '';
    for (const key of ['command', 'patch', 'input']) {
        if (typeof input[key] === 'string') return input[key];
    }
    return '';
}

function getChangedFiles(patch, cwd) {
    const files = new Set();
    for (const match of patch.matchAll(/^\*\*\* (?:Update|Delete|Add) File: (.+)$/gm)) {
        const filePath = match[1].trim();
        files.add(path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(cwd, filePath));
    }
    return [...files].filter((filePath) => fs.existsSync(filePath));
}

function getImpactedNodes(db, filePath) {
    const query = db.prepare(`
        WITH RECURSIVE impacted(node_qn, depth) AS (
            SELECT qualified_name, 0
            FROM nodes
            WHERE file_path = ? AND kind IN ('Function', 'Class', 'Test')
            UNION
            SELECT e.source_qualified, impacted.depth + 1
            FROM impacted
            JOIN edges e ON e.target_qualified = impacted.node_qn
            WHERE impacted.depth < 3 AND e.kind = 'CALLS'
        )
        SELECT DISTINCT n.name, n.file_path, n.line_start, impacted.depth
        FROM impacted
        JOIN nodes n ON n.qualified_name = impacted.node_qn
        WHERE impacted.depth > 0
        ORDER BY impacted.depth, n.file_path, n.line_start
        LIMIT 10
    `);
    return query.all(filePath);
}

readInput((input) => {
    const cwd = input.cwd || process.cwd();
    const patch = getPatch(input.tool_input);
    const changedFiles = getChangedFiles(patch, cwd);
    const dbPath = path.join(cwd, '.avvarre', 'graph.db');

    if (changedFiles.length === 0 || !fs.existsSync(dbPath)) return;

    let db;
    try {
        const { DatabaseSync } = require('node:sqlite');
        db = new DatabaseSync(dbPath);
        const warnings = [];
        for (const changedFile of changedFiles) {
            const impacted = getImpactedNodes(db, changedFile);
            if (impacted.length === 0) continue;
            const relativeChanged = path.relative(cwd, changedFile) || path.basename(changedFile);
            const targets = impacted.map((node) =>
                `${path.relative(cwd, node.file_path)}:${node.line_start} (${node.name})`
            );
            warnings.push(`${relativeChanged} has downstream callers: ${targets.join(', ')}`);
        }

        if (warnings.length > 0) {
            const additionalContext = `[Avvarre impact warning]\n${warnings.join('\n')}\nReview affected callers and tests after this edit.`;
            console.log(JSON.stringify({
                systemMessage: '[Avvarre] This edit may have downstream impact.',
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    additionalContext
                }
            }));
        }
    } catch {
        // Impact hints must never prevent an edit.
    } finally {
        if (db && typeof db.close === 'function') db.close();
    }
});
