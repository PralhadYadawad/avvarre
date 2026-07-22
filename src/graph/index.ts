import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { parseFile, ParsedNode, ParsedEdge } from './parser.js';
import { setMetadata } from '../db/connection.js';

export interface GraphNode {
    id: number;
    kind: string;
    name: string;
    qualified_name: string;
    file_path: string;
    line_start: number;
    line_end: number;
    language?: string;
    parent_name?: string;
    params?: string;
    return_type?: string;
    is_test: boolean;
    file_hash?: string;
    extra: Record<string, any>;
}

export interface GraphEdge {
    id: number;
    kind: string;
    source_qualified: string;
    target_qualified: string;
    file_path: string;
    line: number;
    extra: Record<string, any>;
}

export interface ImpactRadiusResult {
    changed_nodes: GraphNode[];
    impacted_nodes: GraphNode[];
    impacted_files: string[];
    edges: GraphEdge[];
    truncated: boolean;
    total_impacted: number;
}

/**
 * Computes SHA-256 hash of a string content.
 */
export function getHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

/**
 * Removes all nodes and edges belonging to a file path.
 */
export function removeFileData(db: DatabaseSync, filePath: string): void {
    const deleteNodes = db.prepare('DELETE FROM nodes WHERE file_path = ?');
    deleteNodes.run(filePath);

    const deleteEdges = db.prepare('DELETE FROM edges WHERE file_path = ?');
    deleteEdges.run(filePath);
}

/**
 * Indexes a file if its content hash has changed, updating the code review database.
 * Returns true if the file was re-indexed, false if it was skipped (up to date).
 */
export async function indexFile(db: DatabaseSync, filePath: string): Promise<boolean> {
    if (!existsSync(filePath)) {
        removeFileData(db, filePath);
        return true;
    }

    let content = '';
    try {
        content = readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`[Avvarre Indexer] Failed to read file ${filePath}:`, error);
        return false;
    }

    const currentHash = getHash(content);

    // Check if file is already up to date
    const checkStmt = db.prepare("SELECT file_hash FROM nodes WHERE file_path = ? AND kind = 'File' LIMIT 1");
    const existing = checkStmt.get(filePath) as { file_hash: string } | undefined;

    if (existing && existing.file_hash === currentHash) {
        return false; // Skip, no changes
    }

    // Parse AST
    const { nodes, edges } = await parseFile(filePath, content);

    // Apply database updates atomically
    db.exec('BEGIN IMMEDIATE;');
    try {
        removeFileData(db, filePath);

        const insertNode = db.prepare(`
            INSERT INTO nodes 
            (kind, name, qualified_name, file_path, line_start, line_end, parent_name, params, return_type, is_test, file_hash, extra, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const node of nodes) {
            insertNode.run(
                node.kind,
                node.name,
                node.qualifiedName,
                filePath,
                node.lineStart,
                node.lineEnd,
                node.parentName || null,
                node.params || null,
                node.returnType || null,
                node.isTest ? 1 : 0,
                currentHash,
                JSON.stringify({}),
                Date.now() / 1000
            );
        }

        const insertEdge = db.prepare(`
            INSERT INTO edges 
            (kind, source_qualified, target_qualified, file_path, line, extra, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const edge of edges) {
            insertEdge.run(
                edge.kind,
                edge.sourceQualified,
                edge.targetQualified,
                filePath,
                edge.line,
                JSON.stringify({}),
                Date.now() / 1000
            );
        }

        db.exec('COMMIT;');

        // Resolve simple calls and update TESTED_BY links
        resolveQualifiedCallees(db);
        updateTestedByEdges(db);

        // Update indexing metadata
        setMetadata(db, 'last_index_time', new Date().toISOString());
        setMetadata(db, 'last_indexed_file', filePath);
    } catch (error) {
        db.exec('ROLLBACK;');
        console.error(`[Avvarre Indexer] Transaction failed for ${filePath}:`, error);
        throw error;
    }

    return true;
}

/**
 * Executes a recursive CTE query to find all impacted nodes within a given depth.
 */
export function getImpactRadius(
    db: DatabaseSync,
    changedFiles: string[],
    maxDepth: number = 5,
    maxNodes: number = 200
): ImpactRadiusResult {
    if (changedFiles.length === 0) {
        return {
            changed_nodes: [],
            impacted_nodes: [],
            impacted_files: [],
            edges: [],
            truncated: false,
            total_impacted: 0
        };
    }

    // Resolve seed nodes belonging to the changed files
    const seeds: string[] = [];
    const getFileNodes = db.prepare('SELECT qualified_name FROM nodes WHERE file_path = ?');
    for (const file of changedFiles) {
        const rows = getFileNodes.all(file) as { qualified_name: string }[];
        for (const row of rows) {
            seeds.push(row.qualified_name);
        }
    }

    if (seeds.length === 0) {
        return {
            changed_nodes: [],
            impacted_nodes: [],
            impacted_files: [],
            edges: [],
            truncated: false,
            total_impacted: 0
        };
    }

    // Create a temporary table for the seed nodes to ensure efficient joining and avoid SQLite variable limits
    db.exec('CREATE TEMP TABLE IF NOT EXISTS _impact_seeds (qn TEXT PRIMARY KEY);');
    db.exec('DELETE FROM _impact_seeds;');

    const insertSeed = db.prepare('INSERT OR IGNORE INTO _impact_seeds (qn) VALUES (?)');
    db.exec('BEGIN TRANSACTION;');
    for (const seed of seeds) {
        insertSeed.run(seed);
    }
    db.exec('COMMIT;');

    // Recursive CTE Query
    const cteSql = `
        WITH RECURSIVE impacted(node_qn, depth) AS (
            SELECT qn, 0 FROM _impact_seeds
            UNION
            -- Forward traversal (callees of the node)
            SELECT n.qualified_name, i.depth + 1
            FROM impacted i
            JOIN edges e ON (e.source_qualified = i.node_qn OR i.node_qn LIKE '%::' || e.source_qualified)
            JOIN nodes n ON (n.qualified_name = e.target_qualified OR n.qualified_name LIKE '%::' || e.target_qualified)
            WHERE i.depth < ?
            UNION
            -- Backward traversal (callers of the node)
            SELECT e.source_qualified, i.depth + 1
            FROM impacted i
            JOIN edges e ON (e.target_qualified = i.node_qn OR i.node_qn LIKE '%::' || e.target_qualified)
            WHERE i.depth < ?
        )
        SELECT DISTINCT node_qn, MIN(depth) AS min_depth
        FROM impacted
        GROUP BY node_qn
        LIMIT ?
    `;

    const cteStmt = db.prepare(cteSql);
    // Limit variables set to depth, depth, and max nodes limit + seed count
    const rows = cteStmt.all(maxDepth, maxDepth, maxNodes + seeds.length) as { node_qn: string; min_depth: number }[];

    const impactedQns = new Set<string>();
    const seedSet = new Set(seeds);

    for (const row of rows) {
        if (!seedSet.has(row.node_qn)) {
            impactedQns.add(row.node_qn);
        }
    }

    // Resolve details for changed and impacted nodes
    const changedNodes: GraphNode[] = [];
    const getNodeInfo = db.prepare('SELECT * FROM nodes WHERE qualified_name = ?');

    for (const seed of seeds) {
        const row = getNodeInfo.get(seed) as any;
        if (row) {
            changedNodes.push({
                ...row,
                extra: JSON.parse(row.extra || '{}'),
                is_test: row.is_test === 1
            });
        }
    }

    const impactedNodes: GraphNode[] = [];
    const totalImpacted = impactedQns.size;
    const truncated = totalImpacted > maxNodes;

    let count = 0;
    for (const qn of impactedQns) {
        if (count >= maxNodes) break;
        const row = getNodeInfo.get(qn) as any;
        if (row) {
            impactedNodes.push({
                ...row,
                extra: JSON.parse(row.extra || '{}'),
                is_test: row.is_test === 1
            });
            count++;
        }
    }

    const impactedFiles = Array.from(new Set(impactedNodes.map(n => n.file_path)));

    // Fetch related connecting edges
    const edges: GraphEdge[] = [];
    const allQns = [...seeds, ...impactedNodes.map(n => n.qualified_name)];
    
    if (allQns.length > 0) {
        db.exec('CREATE TEMP TABLE IF NOT EXISTS _all_qns (qn TEXT PRIMARY KEY);');
        db.exec('DELETE FROM _all_qns;');
        
        const insertQn = db.prepare('INSERT OR IGNORE INTO _all_qns (qn) VALUES (?)');
        db.exec('BEGIN TRANSACTION;');
        for (const qn of allQns) {
            insertQn.run(qn);
        }
        db.exec('COMMIT;');

        const edgeQuery = `
            SELECT * FROM edges 
            WHERE source_qualified IN (SELECT qn FROM _all_qns)
              AND target_qualified IN (SELECT qn FROM _all_qns)
        `;
        const edgeStmt = db.prepare(edgeQuery);
        const edgeRows = edgeStmt.all() as any[];

        for (const row of edgeRows) {
            edges.push({
                ...row,
                extra: JSON.parse(row.extra || '{}')
            });
        }
    }

    return {
        changed_nodes: changedNodes,
        impacted_nodes: impactedNodes,
        impacted_files: impactedFiles,
        edges,
        truncated,
        total_impacted: totalImpacted
    };
}

/**
 * Resolves unresolved simple/suffix callee names in CALLS edges to their
 * fully qualified node representations.
 */
export function resolveQualifiedCallees(db: DatabaseSync): void {
    const getUnresolvedEdges = db.prepare(`
        SELECT id, source_qualified, target_qualified, file_path 
        FROM edges 
        WHERE kind = 'CALLS' AND target_qualified NOT LIKE '%::%'
    `);
    
    const findCandidateNodes = db.prepare(`
        SELECT qualified_name, file_path 
        FROM nodes 
        WHERE name = ? AND kind IN ('Function', 'Class', 'Test')
    `);

    const updateEdgeTarget = db.prepare(`
        UPDATE edges 
        SET target_qualified = ? 
        WHERE id = ?
    `);

    const unresolved = getUnresolvedEdges.all() as Array<{
        id: number;
        source_qualified: string;
        target_qualified: string;
        file_path: string;
    }>;

    if (unresolved.length === 0) return;

    db.exec('BEGIN IMMEDIATE;');
    try {
        for (const edge of unresolved) {
            const candidates = findCandidateNodes.all(edge.target_qualified) as Array<{
                qualified_name: string;
                file_path: string;
            }>;

            if (candidates.length === 0) continue;

            // Find best candidate:
            // 1. Same file
            let best = candidates.find(c => c.file_path === edge.file_path);
            
            // 2. Imported file (check if there's an IMPORTS_FROM edge from edge.file_path to candidate's file)
            if (!best) {
                const importsStmt = db.prepare(`
                    SELECT target_qualified FROM edges 
                    WHERE source_qualified = ? AND kind = 'IMPORTS_FROM'
                `);
                const imports = importsStmt.all(edge.file_path) as Array<{ target_qualified: string }>;
                
                best = candidates.find(c => {
                    return imports.some(imp => c.file_path.includes(imp.target_qualified));
                });
            }

            // 3. Fallback to first candidate
            if (!best) {
                best = candidates[0];
            }

            updateEdgeTarget.run(best.qualified_name, edge.id);
        }
        db.exec('COMMIT;');
    } catch (error) {
        db.exec('ROLLBACK;');
        console.error('[Avvarre Indexer] Failed to resolve qualified callees:', error);
    }
}

/**
 * Creates TESTED_BY edges by connecting Test nodes to the target nodes they cover,
 * using both resolved call dependencies and naming heuristics.
 */
export function updateTestedByEdges(db: DatabaseSync): void {
    db.prepare("DELETE FROM edges WHERE kind = 'TESTED_BY'").run();

    const getTestNodes = db.prepare("SELECT qualified_name, name, file_path, line_start FROM nodes WHERE is_test = 1");
    const testNodes = getTestNodes.all() as Array<{ qualified_name: string; name: string; file_path: string; line_start: number }>;

    if (testNodes.length === 0) return;

    const insertEdge = db.prepare(`
        INSERT OR IGNORE INTO edges 
        (kind, source_qualified, target_qualified, file_path, line, extra, updated_at)
        VALUES ('TESTED_BY', ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN IMMEDIATE;');
    try {
        for (const testNode of testNodes) {
            // Find all functions/methods called by this test node
            const getCalls = db.prepare(`
                SELECT target_qualified, line FROM edges 
                WHERE source_qualified = ? AND kind = 'CALLS'
            `);
            const calls = getCalls.all(testNode.qualified_name) as Array<{ target_qualified: string; line: number }>;

            for (const call of calls) {
                const checkNode = db.prepare(`
                    SELECT qualified_name FROM nodes 
                    WHERE qualified_name = ? AND is_test = 0 AND kind IN ('Function', 'Class')
                `);
                const match = checkNode.get(call.target_qualified) as { qualified_name: string } | undefined;

                if (match) {
                    insertEdge.run(
                        testNode.qualified_name,
                        match.qualified_name,
                        testNode.file_path,
                        call.line,
                        JSON.stringify({}),
                        Date.now() / 1000
                    );
                }
            }

            // Heuristic fallback matching:
            const cleanNames = getHeuristicTargetNames(testNode.name);
            for (const targetName of cleanNames) {
                const findNodes = db.prepare(`
                    SELECT qualified_name FROM nodes 
                    WHERE name = ? AND is_test = 0 AND kind IN ('Function', 'Class')
                `);
                const matches = findNodes.all(targetName) as Array<{ qualified_name: string }>;
                for (const match of matches) {
                    insertEdge.run(
                        testNode.qualified_name,
                        match.qualified_name,
                        testNode.file_path,
                        testNode.line_start || 1,
                        JSON.stringify({}),
                        Date.now() / 1000
                    );
                }
            }
        }
        db.exec('COMMIT;');
    } catch (error) {
        db.exec('ROLLBACK;');
        console.error('[Avvarre Indexer] Failed to update TESTED_BY edges:', error);
    }
}

function getHeuristicTargetNames(testName: string): string[] {
    const targets: string[] = [];
    let clean = testName.replace(/^(test|Test|benchmark|Benchmark|spec|Spec)_?/, '');
    if (clean && clean !== testName) {
        targets.push(clean);
        const decap = clean.charAt(0).toLowerCase() + clean.slice(1);
        if (decap !== clean) {
            targets.push(decap);
        }
    }
    let cleanSuffix = testName.replace(/_?(test|Test|spec|Spec|benchmark|Benchmark)$/, '');
    if (cleanSuffix && cleanSuffix !== testName) {
        targets.push(cleanSuffix);
        const decap = cleanSuffix.charAt(0).toLowerCase() + cleanSuffix.slice(1);
        if (decap !== cleanSuffix) {
            targets.push(decap);
        }
    }
    return Array.from(new Set(targets));
}
