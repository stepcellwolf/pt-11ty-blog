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
export interface SharedMemoryPoolConfig {
    dbPath?: string;
    cacheSize?: number;
    embeddingCacheSize?: number;
    embeddingModel?: string;
    embeddingDimension?: number;
}
export declare class SharedMemoryPool {
    private static instance;
    private db;
    private embedder;
    private queryCache;
    private embeddingCache;
    private config;
    private initialized;
    private constructor();
    /**
     * Get singleton instance of SharedMemoryPool
     */
    static getInstance(config?: SharedMemoryPoolConfig): SharedMemoryPool;
    /**
     * Reset singleton instance (for testing)
     */
    static resetInstance(): void;
    /**
     * Ensure embedding service is initialized
     */
    ensureInitialized(): Promise<void>;
    /**
     * Get shared database connection
     */
    getDatabase(): Database.Database;
    /**
     * Get shared embedding service
     */
    getEmbedder(): EmbeddingService;
    /**
     * Get or compute embedding with caching
     *
     * @param text Text to embed
     * @returns Cached or newly computed embedding
     */
    getCachedEmbedding(text: string): Promise<Float32Array>;
    /**
     * Cache query result with TTL
     *
     * @param key Cache key
     * @param result Result to cache
     * @param ttl Time-to-live in milliseconds (default: 60s)
     */
    cacheQuery(key: string, result: any, ttl?: number): void;
    /**
     * Get cached query result
     *
     * @param key Cache key
     * @returns Cached result or null if expired/missing
     */
    getCachedQuery(key: string): any | null;
    /**
     * Clear all caches
     */
    clearCaches(): void;
    /**
     * Get memory pool statistics
     */
    getStats(): {
        database: {
            path: string;
            size: any;
            tables: any;
            walMode: any;
        };
        cache: {
            queryCacheSize: number;
            queryCacheMax: number;
            embeddingCacheSize: number;
            embeddingCacheMax: number;
        };
        embedder: {
            model: string;
            dimension: number;
            initialized: boolean;
        };
        memory: {
            heapUsed: number;
            external: number;
        };
    };
    /**
     * Close database connection and cleanup
     */
    close(): void;
}
export declare const getSharedMemoryPool: typeof SharedMemoryPool.getInstance;
//# sourceMappingURL=SharedMemoryPool.d.ts.map