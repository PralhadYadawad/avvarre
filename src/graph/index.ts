import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { parseFile, ParsedNode, ParsedEdge } from './parser.js';

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
