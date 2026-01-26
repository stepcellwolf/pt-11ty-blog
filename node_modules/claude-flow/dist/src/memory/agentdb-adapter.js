import { EnhancedMemory } from './enhanced-memory.js';
import { AgentDBBackend } from './backends/agentdb.js';
export class AgentDBMemoryAdapter extends EnhancedMemory {
    constructor(options = {}){
        super(options);
        this.mode = options.mode || 'hybrid';
        this.agentdb = null;
        this.agentdbInitialized = false;
        this.agentdbError = null;
    }
    async initialize() {
        await super.initialize();
        if (this.mode !== 'legacy') {
            try {
                this.agentdb = new AgentDBBackend({
                    dbPath: this.options.agentdbPath || '.agentdb/claude-flow.db',
                    quantization: this.options.quantization || 'scalar',
                    enableHNSW: this.options.enableHNSW !== false
                });
                await this.agentdb.initialize();
                this.agentdbInitialized = true;
                console.error(`[${new Date().toISOString()}] INFO [agentdb-adapter] AgentDB initialized in ${this.mode} mode`);
            } catch (error) {
                this.agentdbError = error;
                if (this.mode === 'agentdb') {
                    throw new Error(`AgentDB initialization failed in agentdb-only mode: ${error.message}`);
                }
                console.error(`[${new Date().toISOString()}] WARN [agentdb-adapter] AgentDB initialization failed, using legacy mode: ${error.message}`);
            }
        }
    }
    isAgentDBAvailable() {
        return this.agentdbInitialized && this.agentdb !== null;
    }
    async storeWithEmbedding(key, value, options = {}) {
        const legacyResult = await this.store(key, value, options);
        if (options.embedding && this.isAgentDBAvailable()) {
            try {
                await this.agentdb.storeVector(key, options.embedding, {
                    value,
                    metadata: options.metadata,
                    namespace: options.namespace,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error(`[${new Date().toISOString()}] WARN [agentdb-adapter] Vector storage failed: ${error.message}`);
            }
        }
        return legacyResult;
    }
    async vectorSearch(query, options = {}) {
        if (!this.isAgentDBAvailable()) {
            console.error(`[${new Date().toISOString()}] WARN [agentdb-adapter] AgentDB unavailable, falling back to legacy search`);
            const pattern = typeof query === 'string' ? query : '*';
            return this.search(pattern, {
                namespace: options.namespace,
                limit: options.k || 10
            });
        }
        try {
            return await this.agentdb.search(query, {
                k: options.k || 10,
                namespace: options.namespace,
                filter: options.filter
            });
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ERROR [agentdb-adapter] Vector search failed: ${error.message}`);
            if (this.mode === 'hybrid') {
                const pattern = typeof query === 'string' ? query : '*';
                return this.search(pattern, {
                    namespace: options.namespace,
                    limit: options.k || 10
                });
            }
            throw error;
        }
    }
    async semanticRetrieve(query, options = {}) {
        if (!this.isAgentDBAvailable()) {
            return this.retrieve(query, options);
        }
        try {
            const results = await this.vectorSearch(query, {
                k: 1,
                namespace: options.namespace,
                filter: options.filter
            });
            if (results.length === 0) {
                return null;
            }
            return results[0].value || results[0].metadata?.value;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] WARN [agentdb-adapter] Semantic retrieve failed: ${error.message}`);
            return this.retrieve(query, options);
        }
    }
    async storeKnowledgeWithEmbedding(domain, key, value, metadata = {}, embedding = null) {
        const legacyResult = await this.storeKnowledge(domain, key, value, metadata);
        if (embedding && this.isAgentDBAvailable()) {
            try {
                await this.agentdb.storeVector(`knowledge:${domain}:${key}`, embedding, {
                    domain,
                    key,
                    value,
                    metadata,
                    createdAt: Date.now()
                });
            } catch (error) {
                console.error(`[${new Date().toISOString()}] WARN [agentdb-adapter] Knowledge vector storage failed: ${error.message}`);
            }
        }
        return legacyResult;
    }
    async searchKnowledgeSemantic(domain, queryEmbedding, options = {}) {
        if (!this.isAgentDBAvailable()) {
            return this.searchKnowledge(domain, '*');
        }
        try {
            return await this.agentdb.search(queryEmbedding, {
                k: options.limit || 50,
                filter: {
                    domain
                }
            });
        } catch (error) {
            console.error(`[${new Date().toISOString()}] WARN [agentdb-adapter] Semantic knowledge search failed: ${error.message}`);
            return this.searchKnowledge(domain, '*');
        }
    }
    async getAgentDBStats() {
        if (!this.isAgentDBAvailable()) {
            return {
                available: false,
                error: this.agentdbError?.message || 'AgentDB not initialized'
            };
        }
        try {
            return await this.agentdb.getStats();
        } catch (error) {
            return {
                available: true,
                error: error.message
            };
        }
    }
    async optimizeAgentDB() {
        if (!this.isAgentDBAvailable()) {
            throw new Error('AgentDB not available for optimization');
        }
        return this.agentdb.optimize();
    }
    async exportDataWithVectors(namespace = null) {
        const legacyData = await this.exportData(namespace);
        if (!this.isAgentDBAvailable()) {
            return {
                legacy: legacyData,
                vectors: null,
                agentdbAvailable: false
            };
        }
        try {
            const vectorData = await this.agentdb.exportVectors(namespace);
            return {
                legacy: legacyData,
                vectors: vectorData,
                agentdbAvailable: true
            };
        } catch (error) {
            console.error(`[${new Date().toISOString()}] WARN [agentdb-adapter] Vector export failed: ${error.message}`);
            return {
                legacy: legacyData,
                vectors: null,
                agentdbAvailable: true,
                error: error.message
            };
        }
    }
    async cleanupAll() {
        const legacyCleanup = await this.cleanupExpired();
        if (!this.isAgentDBAvailable()) {
            return {
                legacy: legacyCleanup,
                agentdb: null
            };
        }
        try {
            const agentdbCleanup = await this.agentdb.cleanup();
            return {
                legacy: legacyCleanup,
                agentdb: agentdbCleanup
            };
        } catch (error) {
            console.error(`[${new Date().toISOString()}] WARN [agentdb-adapter] AgentDB cleanup failed: ${error.message}`);
            return {
                legacy: legacyCleanup,
                agentdb: null,
                error: error.message
            };
        }
    }
    async close() {
        await super.close?.();
        if (this.isAgentDBAvailable()) {
            try {
                await this.agentdb.close();
            } catch (error) {
                console.error(`[${new Date().toISOString()}] WARN [agentdb-adapter] AgentDB close failed: ${error.message}`);
            }
        }
    }
}
export default AgentDBMemoryAdapter;

//# sourceMappingURL=agentdb-adapter.js.map