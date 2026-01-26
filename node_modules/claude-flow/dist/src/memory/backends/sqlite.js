import { promises as fs } from 'fs';
import path from 'path';
import { MemoryBackendError } from '../../utils/errors.js';
let createDatabase;
let isSQLiteAvailable;
export class SQLiteBackend {
    dbPath;
    logger;
    db;
    sqliteLoaded = false;
    constructor(dbPath, logger){
        this.dbPath = dbPath;
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('Initializing SQLite backend', {
            dbPath: this.dbPath
        });
        try {
            if (!this.sqliteLoaded) {
                const module = await import('../sqlite-wrapper.js');
                createDatabase = module.createDatabase;
                isSQLiteAvailable = module.isSQLiteAvailable;
                this.sqliteLoaded = true;
            }
            const sqliteAvailable = await isSQLiteAvailable();
            if (!sqliteAvailable) {
                throw new Error('SQLite module not available');
            }
            const dir = path.dirname(this.dbPath);
            await fs.mkdir(dir, {
                recursive: true
            });
            this.db = await createDatabase(this.dbPath);
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 1000');
            this.db.pragma('temp_store = memory');
            this.createTables();
            this.createIndexes();
            this.logger.info('SQLite backend initialized');
        } catch (error) {
            throw new MemoryBackendError('Failed to initialize SQLite backend', {
                error
            });
        }
    }
    async shutdown() {
        this.logger.info('Shutting down SQLite backend');
        if (this.db) {
            this.db.close();
            delete this.db;
        }
    }
    async store(entry) {
        if (!this.db) {
            throw new MemoryBackendError('Database not initialized');
        }
        const sql = `
      INSERT OR REPLACE INTO memory_entries (
        id, agent_id, session_id, type, content, 
        context, timestamp, tags, version, parent_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
        const params = [
            entry.id,
            entry.agentId,
            entry.sessionId,
            entry.type,
            entry.content,
            JSON.stringify(entry.context),
            entry.timestamp.toISOString(),
            JSON.stringify(entry.tags),
            entry.version,
            entry.parentId || null,
            entry.metadata ? JSON.stringify(entry.metadata) : null
        ];
        try {
            const stmt = this.db.prepare(sql);
            stmt.run(...params);
        } catch (error) {
            throw new MemoryBackendError('Failed to store entry', {
                error
            });
        }
    }
    async retrieve(id) {
        if (!this.db) {
            throw new MemoryBackendError('Database not initialized');
        }
        const sql = 'SELECT * FROM memory_entries WHERE id = ?';
        try {
            const stmt = this.db.prepare(sql);
            const row = stmt.get(id);
            if (!row) {
                return undefined;
            }
            return this.rowToEntry(row);
        } catch (error) {
            throw new MemoryBackendError('Failed to retrieve entry', {
                error
            });
        }
    }
    async update(id, entry) {
        await this.store(entry);
    }
    async delete(id) {
        if (!this.db) {
            throw new MemoryBackendError('Database not initialized');
        }
        const sql = 'DELETE FROM memory_entries WHERE id = ?';
        try {
            const stmt = this.db.prepare(sql);
            stmt.run(id);
        } catch (error) {
            throw new MemoryBackendError('Failed to delete entry', {
                error
            });
        }
    }
    async query(query) {
        if (!this.db) {
            throw new MemoryBackendError('Database not initialized');
        }
        const conditions = [];
        const params = [];
        if (query.agentId) {
            conditions.push('agent_id = ?');
            params.push(query.agentId);
        }
        if (query.sessionId) {
            conditions.push('session_id = ?');
            params.push(query.sessionId);
        }
        if (query.type) {
            conditions.push('type = ?');
            params.push(query.type);
        }
        if (query.startTime) {
            conditions.push('timestamp >= ?');
            params.push(query.startTime.toISOString());
        }
        if (query.endTime) {
            conditions.push('timestamp <= ?');
            params.push(query.endTime.toISOString());
        }
        if (query.search) {
            conditions.push('(content LIKE ? OR tags LIKE ?)');
            params.push(`%${query.search}%`, `%${query.search}%`);
        }
        if (query.tags && query.tags.length > 0) {
            const tagConditions = query.tags.map(()=>'tags LIKE ?');
            conditions.push(`(${tagConditions.join(' OR ')})`);
            query.tags.forEach((tag)=>params.push(`%"${tag}"%`));
        }
        let sql = 'SELECT * FROM memory_entries';
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY timestamp DESC';
        if (query.limit) {
            sql += ' LIMIT ?';
            params.push(query.limit);
        }
        if (query.offset) {
            if (!query.limit) {
                sql += ' LIMIT -1';
            }
            sql += ' OFFSET ?';
            params.push(query.offset);
        }
        try {
            const stmt = this.db.prepare(sql);
            const rows = stmt.all(...params);
            return rows.map((row)=>this.rowToEntry(row));
        } catch (error) {
            throw new MemoryBackendError('Failed to query entries', {
                error
            });
        }
    }
    async getAllEntries() {
        if (!this.db) {
            throw new MemoryBackendError('Database not initialized');
        }
        const sql = 'SELECT * FROM memory_entries ORDER BY timestamp DESC';
        try {
            const stmt = this.db.prepare(sql);
            const rows = stmt.all();
            return rows.map((row)=>this.rowToEntry(row));
        } catch (error) {
            throw new MemoryBackendError('Failed to get all entries', {
                error
            });
        }
    }
    async getHealthStatus() {
        if (!this.db) {
            return {
                healthy: false,
                error: 'Database not initialized'
            };
        }
        try {
            this.db.prepare('SELECT 1').get();
            const countResult = this.db.prepare('SELECT COUNT(*) as count FROM memory_entries').get();
            const entryCount = countResult.count;
            const sizeResult = this.db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get();
            const dbSize = sizeResult.size;
            return {
                healthy: true,
                metrics: {
                    entryCount,
                    dbSizeBytes: dbSize
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    createTables() {
        const sql = `
      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        context TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        tags TEXT NOT NULL,
        version INTEGER NOT NULL,
        parent_id TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
        this.db.exec(sql);
    }
    createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_agent_id ON memory_entries(agent_id)',
            'CREATE INDEX IF NOT EXISTS idx_session_id ON memory_entries(session_id)',
            'CREATE INDEX IF NOT EXISTS idx_type ON memory_entries(type)',
            'CREATE INDEX IF NOT EXISTS idx_timestamp ON memory_entries(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_parent_id ON memory_entries(parent_id)'
        ];
        for (const sql of indexes){
            this.db.exec(sql);
        }
    }
    rowToEntry(row) {
        const entry = {
            id: row.id,
            agentId: row.agent_id,
            sessionId: row.session_id,
            type: row.type,
            content: row.content,
            context: JSON.parse(row.context),
            timestamp: new Date(row.timestamp),
            tags: JSON.parse(row.tags),
            version: row.version
        };
        if (row.parent_id) {
            entry.parentId = row.parent_id;
        }
        if (row.metadata) {
            entry.metadata = JSON.parse(row.metadata);
        }
        return entry;
    }
}

//# sourceMappingURL=sqlite.js.map