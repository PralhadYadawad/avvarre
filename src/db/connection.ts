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

        // Write initial schema metadata
        setMetadata(db, 'schema_version', '1');
        if (!getMetadata(db, 'initialized_at')) {
            setMetadata(db, 'initialized_at', new Date().toISOString());
        }
    } catch (error) {
        console.error('[Avvarre DB] Failed to apply schema migrations:', error);
    }

    dbInstance = db;
    return dbInstance;
}

/**
 * Set a key-value pair in the metadata table.
 */
export function setMetadata(db: DatabaseSync, key: string, value: string): void {
    const stmt = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
    stmt.run(key, value);
}

/**
 * Get a value by key from the metadata table.
 */
export function getMetadata(db: DatabaseSync, key: string): string | null {
    try {
        const stmt = db.prepare('SELECT value FROM metadata WHERE key = ?');
        const row = stmt.get(key) as { value: string } | undefined;
        return row ? row.value : null;
    } catch {
        return null;
    }
}

/**
 * Close the current database connection if open.
 * Releases the underlying SQLite handle (and its WAL files) before
 * dropping the singleton reference.
 */
export function closeDatabase(): void {
    if (dbInstance) {
        try {
            dbInstance.close();
        } catch (error) {
            console.error('[Avvarre DB] Failed to close database handle:', error);
        }
        dbInstance = null;
    }
}
