#!/usr/bin/env node
// Avvarre PreToolUse hook — analyzes downstream dependency impacts and test gaps
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
    let data = {};
    try {
        data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (e) {
        // Silent failure if input is invalid JSON
        console.log(JSON.stringify({ continue: true }));
        process.exit(0);
    }

    const cwd = data.cwd || process.cwd();
    const dbPath = path.join(cwd, '.avvarre', 'graph.db');

    if (!fs.existsSync(dbPath)) {
        console.log(JSON.stringify({ continue: true }));
        process.exit(0);
    }

    // Extract changed files from tool input
    const toolInput = data.tool_input || {};
    const rawFiles = [];

    if (Array.isArray(toolInput.files)) {
        rawFiles.push(...toolInput.files);
    }
    if (typeof toolInput.filePath === 'string') rawFiles.push(toolInput.filePath);
    if (typeof toolInput.file_path === 'string') rawFiles.push(toolInput.file_path);
    if (typeof toolInput.path === 'string') rawFiles.push(toolInput.path);
    if (typeof toolInput.TargetFile === 'string') rawFiles.push(toolInput.TargetFile);
    if (typeof toolInput.targetFile === 'string') rawFiles.push(toolInput.targetFile);
    if (typeof toolInput.target_file === 'string') rawFiles.push(toolInput.target_file);
    if (typeof toolInput.AbsolutePath === 'string') rawFiles.push(toolInput.AbsolutePath);
    if (typeof toolInput.absolute_path === 'string') rawFiles.push(toolInput.absolute_path);

    const changedFiles = Array.from(new Set(rawFiles))
        .map(f => path.isAbsolute(f) ? f : path.resolve(cwd, f))
        .filter(f => fs.existsSync(f));

    if (changedFiles.length === 0) {
        console.log(JSON.stringify({ continue: true }));
        process.exit(0);
    }

    let db;
    try {
        db = new DatabaseSync(dbPath);
    } catch (e) {
        console.log(JSON.stringify({ continue: true }));
        process.exit(0);
    }

    try {
        const warningLines = [];
        const testGapLines = [];

        // CTE Query to find downstream impacts
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

        // Check if node is tested
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

                    // Check for test coverage
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
                ''
            ];

            if (testGapLines.length > 0) {
                warningMessage.push(
                    `[Avvarre] TEST GAP ALERTS (Untested downstream components):`,
                    ...testGapLines,
                    ''
                );
            }

            warningMessage.push(`Please review the above impacts to ensure changes do not break downstream callers.`);

            const fullWarning = warningMessage.join('\n');

            console.log(JSON.stringify({
                systemMessage: `[Avvarre] Code Review Graph warning injected.`,
                hookSpecificOutput: {
                    hookEventName: data.hookEventName || 'PreToolUse',
                    permissionDecision: 'allow',
                    additionalContext: fullWarning
                }
            }));
            process.exit(0);
        }

    } catch (err) {
        // Fallback silently if query fails
    }

    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
});
