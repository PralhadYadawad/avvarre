import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let dbInstance: DatabaseSync | null = null;

/**
 * Initializes and returns the SQLite database connection for the workspace.
 * Sets up journal mode to WAL and executes the schema migration if tables do not exist.
 * 
 * @param workspaceRoot - The absolute path to the workspace root directory.
 */
export function getDatabase(workspaceRoot: string): DatabaseSync {
    if (dbInstance) {
        return dbInstance;
    }

    const dbDir = join(workspaceRoot, '.avvarre');
    if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = join(dbDir, 'graph.db');
    const db = new DatabaseSync(dbPath);

    // Enable WAL journal mode for performance and concurrency
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');

    // Load and run the schema.sql file
    try {
        const schemaPath = join(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf8');
        db.exec(schema);
    } catch (error) {
        console.error('[Avvarre DB] Failed to apply schema migrations:', error);
    }

    dbInstance = db;
    return dbInstance;
}

/**
 * Close the current database connection if open.
 */
export function closeDatabase(): void {
    if (dbInstance) {
        dbInstance = null;
    }
}
