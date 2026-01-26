/**
 * SQLite Database Layer for ReasoningBank
 * Handles memory storage, retrieval, and consolidation
 */
import Database from 'better-sqlite3';
import { ulid } from 'ulid';
export class ReasoningBankDB {
    db;
    constructor(dbPath) {
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL'); // Enable Write-Ahead Logging for concurrency
        this.initSchema();
    }
    initSchema() {
        // Main memory table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS reasoning_memory (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        content TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        pattern_data JSON NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memory_confidence ON reasoning_memory(confidence);
      CREATE INDEX IF NOT EXISTS idx_memory_created_at ON reasoning_memory(created_at);
      CREATE INDEX IF NOT EXISTS idx_memory_domain ON reasoning_memory(json_extract(pattern_data, '$.domain'));
    `);
        // Pattern embeddings table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS pattern_embeddings (
        pattern_id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        FOREIGN KEY (pattern_id) REFERENCES reasoning_memory(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_embeddings_pattern ON pattern_embeddings(pattern_id);
    `);
        // Task trajectory table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_trajectory (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        trajectory TEXT NOT NULL,
        verdict TEXT NOT NULL CHECK(verdict IN ('Success', 'Failure')),
        confidence REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_trajectory_task ON task_trajectory(task_id);
      CREATE INDEX IF NOT EXISTS idx_trajectory_verdict ON task_trajectory(verdict);
    `);
        // MaTTS runs table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS matts_runs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        run_index INTEGER NOT NULL,
        result TEXT NOT NULL,
        verdict TEXT NOT NULL CHECK(verdict IN ('Success', 'Failure')),
        confidence REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_matts_task ON matts_runs(task_id);
    `);
    }
    // Memory operations
    insertMemory(memory) {
        const id = ulid();
        const stmt = this.db.prepare(`
      INSERT INTO reasoning_memory (id, title, description, content, confidence, usage_count, pattern_data)
      VALUES (?, ?, ?, ?, ?, ?, json(?))
    `);
        stmt.run(id, memory.title, memory.description, memory.content, memory.confidence, memory.usage_count, JSON.stringify(memory.pattern_data));
        return id;
    }
    getMemory(id) {
        const stmt = this.db.prepare(`
      SELECT id, title, description, content, confidence, usage_count,
             datetime(created_at) as created_at, pattern_data
      FROM reasoning_memory
      WHERE id = ?
    `);
        const row = stmt.get(id);
        if (!row)
            return null;
        return {
            ...row,
            pattern_data: JSON.parse(row.pattern_data)
        };
    }
    getAllMemories() {
        const stmt = this.db.prepare(`
      SELECT id, title, description, content, confidence, usage_count,
             datetime(created_at) as created_at, pattern_data
      FROM reasoning_memory
      ORDER BY created_at DESC
    `);
        const rows = stmt.all();
        return rows.map(row => ({
            ...row,
            pattern_data: JSON.parse(row.pattern_data)
        }));
    }
    updateMemoryUsage(id) {
        const stmt = this.db.prepare(`
      UPDATE reasoning_memory
      SET usage_count = usage_count + 1
      WHERE id = ?
    `);
        stmt.run(id);
    }
    updateMemoryConfidence(id, confidence) {
        const stmt = this.db.prepare(`
      UPDATE reasoning_memory
      SET confidence = ?
      WHERE id = ?
    `);
        stmt.run(confidence, id);
    }
    deleteMemory(id) {
        const stmt = this.db.prepare('DELETE FROM reasoning_memory WHERE id = ?');
        stmt.run(id);
    }
    // Embedding operations
    insertEmbedding(patternId, embedding) {
        const buffer = Buffer.from(new Float64Array(embedding).buffer);
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO pattern_embeddings (pattern_id, embedding)
      VALUES (?, ?)
    `);
        stmt.run(patternId, buffer);
    }
    getEmbedding(patternId) {
        const stmt = this.db.prepare('SELECT embedding FROM pattern_embeddings WHERE pattern_id = ?');
        const row = stmt.get(patternId);
        if (!row)
            return null;
        const buffer = row.embedding;
        return Array.from(new Float64Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 8));
    }
    getAllEmbeddings() {
        const stmt = this.db.prepare('SELECT pattern_id, embedding FROM pattern_embeddings');
        const rows = stmt.all();
        const embeddings = new Map();
        for (const row of rows) {
            const buffer = row.embedding;
            const embedding = Array.from(new Float64Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 8));
            embeddings.set(row.pattern_id, embedding);
        }
        return embeddings;
    }
    // Trajectory operations
    insertTrajectory(trajectory) {
        const id = ulid();
        const stmt = this.db.prepare(`
      INSERT INTO task_trajectory (id, task_id, trajectory, verdict, confidence)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(id, trajectory.task_id, trajectory.trajectory, trajectory.verdict, trajectory.confidence);
        return id;
    }
    getTrajectories(taskId) {
        const stmt = this.db.prepare(`
      SELECT id, task_id, trajectory, verdict, confidence, datetime(created_at) as created_at
      FROM task_trajectory
      WHERE task_id = ?
      ORDER BY created_at DESC
    `);
        return stmt.all(taskId);
    }
    // MaTTS operations
    insertMattsRun(run) {
        const id = ulid();
        const stmt = this.db.prepare(`
      INSERT INTO matts_runs (id, task_id, run_index, result, verdict, confidence)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, run.task_id, run.run_index, run.result, run.verdict, run.confidence);
        return id;
    }
    getMattsRuns(taskId) {
        const stmt = this.db.prepare(`
      SELECT id, task_id, run_index, result, verdict, confidence, datetime(created_at) as created_at
      FROM matts_runs
      WHERE task_id = ?
      ORDER BY run_index ASC
    `);
        return stmt.all(taskId);
    }
    // Statistics
    getStats() {
        const memoryStats = this.db.prepare(`
      SELECT COUNT(*) as total, AVG(confidence) as avg_conf, SUM(usage_count) as total_usage
      FROM reasoning_memory
    `).get();
        const trajectoryStats = this.db.prepare(`
      SELECT
        SUM(CASE WHEN verdict = 'Success' THEN 1 ELSE 0 END) as successes,
        COUNT(*) as total
      FROM task_trajectory
    `).get();
        return {
            totalMemories: memoryStats.total || 0,
            avgConfidence: memoryStats.avg_conf || 0,
            totalUsage: memoryStats.total_usage || 0,
            successRate: trajectoryStats.total > 0
                ? trajectoryStats.successes / trajectoryStats.total
                : 0
        };
    }
    // Consolidation helpers
    findDuplicates(threshold = 0.95) {
        // Returns pairs of memory IDs that are likely duplicates
        const memories = this.getAllMemories();
        const embeddings = this.getAllEmbeddings();
        const duplicates = [];
        for (let i = 0; i < memories.length; i++) {
            for (let j = i + 1; j < memories.length; j++) {
                const emb1 = embeddings.get(memories[i].id);
                const emb2 = embeddings.get(memories[j].id);
                if (emb1 && emb2) {
                    const similarity = this.cosineSimilarity(emb1, emb2);
                    if (similarity >= threshold) {
                        duplicates.push([memories[i].id, memories[j].id]);
                    }
                }
            }
        }
        return duplicates;
    }
    cosineSimilarity(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
    close() {
        this.db.close();
    }
}
