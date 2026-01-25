/**
 * Shared Memory Pool for AgentDB
 *
 * Provides a singleton memory pool that multiple agents can share:
 * - Single SQLite database connection (reduces overhead)
 * - Single embedding model instance (saves ~150MB per agent)
 * - Shared query cache (LRU with TTL)
 * - Shared embedding cache (deduplication)
 *
 * Memory savings: ~300-500MB for 4+ concurrent agents
 *
 * @example
 * ```typescript
 * import { SharedMemoryPool } from 'agentic-flow/memory';
 *
 * const pool = SharedMemoryPool.getInstance();
 * const db = pool.getDatabase();
 * const embedder = pool.getEmbedder();
 * ```
 */
import { EmbeddingService } from 'agentdb/controllers';
import * as path from 'path';
import * as fs from 'fs';
export class SharedMemoryPool {
    static instance;
    db;
    embedder;
    queryCache;
    embeddingCache;
    config;
    initialized = false;
    constructor(config = {}) {
        this.config = {
            dbPath: config.dbPath || './agentdb.db',
            cacheSize: config.cacheSize || 1000,
            embeddingCacheSize: config.embeddingCacheSize || 10000,
            embeddingModel: config.embeddingModel || 'Xenova/all-MiniLM-L6-v2',
            embeddingDimension: config.embeddingDimension || 384
        };
        // Initialize SQLite with optimized settings
        const dbDir = path.dirname(this.config.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        this.db = new Database(this.config.dbPath);
        // Optimize SQLite for performance
        this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging
        this.db.pragma('synchronous = NORMAL'); // Balanced safety/performance
        this.db.pragma('cache_size = -65536'); // 64MB cache
        this.db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O
        this.db.pragma('page_size = 8192'); // 8KB pages
        this.db.pragma('temp_store = MEMORY'); // Keep temp tables in memory
        // Initialize embedding service (will be lazy-loaded)
        this.embedder = new EmbeddingService({
            model: this.config.embeddingModel,
            dimension: this.config.embeddingDimension,
            provider: 'transformers'
        });
        // Initialize caches
        this.queryCache = new Map();
        this.embeddingCache = new Map();
    }
    /**
     * Get singleton instance of SharedMemoryPool
     */
    static getInstance(config) {
        if (!SharedMemoryPool.instance) {
            SharedMemoryPool.instance = new SharedMemoryPool(config);
        }
        return SharedMemoryPool.instance;
    }
    /**
     * Reset singleton instance (for testing)
     */
    static resetInstance() {
        if (SharedMemoryPool.instance) {
            SharedMemoryPool.instance.close();
            SharedMemoryPool.instance = null;
        }
    }
    /**
     * Ensure embedding service is initialized
     */
    async ensureInitialized() {
        if (!this.initialized) {
            await this.embedder.initialize();
            this.initialized = true;
        }
    }
    /**
     * Get shared database connection
     */
    getDatabase() {
        return this.db;
    }
    /**
     * Get shared embedding service
     */
    getEmbedder() {
        return this.embedder;
    }
    /**
     * Get or compute embedding with caching
     *
     * @param text Text to embed
     * @returns Cached or newly computed embedding
     */
    async getCachedEmbedding(text) {
        const cached = this.embeddingCache.get(text);
        if (cached)
            return cached;
        await this.ensureInitialized();
        const embedding = await this.embedder.embed(text);
        // LRU eviction if cache too large
        if (this.embeddingCache.size >= this.config.embeddingCacheSize) {
            const firstKey = this.embeddingCache.keys().next().value;
            if (firstKey) {
                this.embeddingCache.delete(firstKey);
            }
        }
        this.embeddingCache.set(text, embedding);
        return embedding;
    }
    /**
     * Cache query result with TTL
     *
     * @param key Cache key
     * @param result Result to cache
     * @param ttl Time-to-live in milliseconds (default: 60s)
     */
    cacheQuery(key, result, ttl = 60000) {
        // LRU eviction if cache too large
        if (this.queryCache.size >= this.config.cacheSize) {
            const firstKey = this.queryCache.keys().next().value;
            if (firstKey) {
                this.queryCache.delete(firstKey);
            }
        }
        this.queryCache.set(key, {
            result,
            expires: Date.now() + ttl
        });
    }
    /**
     * Get cached query result
     *
     * @param key Cache key
     * @returns Cached result or null if expired/missing
     */
    getCachedQuery(key) {
        const cached = this.queryCache.get(key);
        if (!cached)
            return null;
        if (Date.now() > cached.expires) {
            this.queryCache.delete(key);
            return null;
        }
        return cached.result;
    }
    /**
     * Clear all caches
     */
    clearCaches() {
        this.queryCache.clear();
        this.embeddingCache.clear();
    }
    /**
     * Get memory pool statistics
     */
    getStats() {
        const dbStats = this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM sqlite_master WHERE type='table') as tables,
        (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) as dbSize
    `).get();
        return {
            database: {
                path: this.config.dbPath,
                size: dbStats.dbSize,
                tables: dbStats.tables,
                walMode: this.db.pragma('journal_mode', { simple: true }),
            },
            cache: {
                queryCacheSize: this.queryCache.size,
                queryCacheMax: this.config.cacheSize,
                embeddingCacheSize: this.embeddingCache.size,
                embeddingCacheMax: this.config.embeddingCacheSize,
            },
            embedder: {
                model: this.config.embeddingModel,
                dimension: this.config.embeddingDimension,
                initialized: this.initialized,
            },
            memory: {
                heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                external: Math.round(process.memoryUsage().external / 1024 / 1024),
            }
        };
    }
    /**
     * Close database connection and cleanup
     */
    close() {
        this.clearCaches();
        this.db.close();
        this.initialized = false;
    }
}
// Export singleton getter for convenience
export const getSharedMemoryPool = SharedMemoryPool.getInstance;
//# sourceMappingURL=SharedMemoryPool.js.map