/**
 * AgentDB Adapter for ReasoningBank
 *
 * This module integrates the AgentDB vector database as a drop-in replacement
 * for the legacy ReasoningBank implementation.
 *
 * Features:
 * - 150x-12,500x faster than legacy implementation
 * - HNSW vector indexing for O(log n) search
 * - Learning plugins (Decision Transformer, Q-Learning, etc.)
 * - Reasoning agents (Pattern Matching, Context Synthesis, etc.)
 * - QUIC synchronization for multi-agent coordination
 * - 100% backward compatible API
 */
/**
 * Create AgentDB ReasoningBank adapter
 *
 * @param config - Configuration options
 * @returns Initialized AgentDB adapter
 *
 * @example
 * ```typescript
 * import { createAgentDBAdapter } from 'agentic-flow/reasoningbank/agentdb';
 *
 * const adapter = await createAgentDBAdapter({
 *   dbPath: '.agentdb/reasoningbank.db',
 *   enableLearning: true,
 *   enableReasoning: true,
 * });
 *
 * // Insert pattern
 * const id = await adapter.insertPattern({
 *   id: '',
 *   type: 'pattern',
 *   domain: 'example',
 *   pattern_data: JSON.stringify({
 *     embedding: [0.1, 0.2, ...],
 *     pattern: { code: 'example' }
 *   }),
 *   confidence: 0.9,
 *   usage_count: 0,
 *   success_count: 0,
 *   created_at: Date.now(),
 *   last_used: Date.now(),
 * });
 *
 * // Retrieve with reasoning
 * const result = await adapter.retrieveWithReasoning(queryEmbedding, {
 *   domain: 'example',
 *   synthesizeContext: true,
 *   k: 10,
 * });
 * ```
 */
export async function createAgentDBAdapter(config) {
    // Dynamic import to avoid loading AgentDB unless explicitly used
    const { AgentDBReasoningBankAdapter } = await import('agentdb/reasoningbank/adapter/agentdb-adapter');
    const adapter = new AgentDBReasoningBankAdapter({
        dbPath: config?.dbPath || '.agentdb/reasoningbank.db',
        enableLearning: config?.enableLearning ?? true,
        enableReasoning: config?.enableReasoning ?? true,
        enableQUICSync: config?.enableQUICSync ?? false,
        quantizationType: config?.quantizationType || 'scalar',
        cacheSize: config?.cacheSize || 1000,
        syncPort: config?.syncPort || 4433,
        syncPeers: config?.syncPeers || [],
    });
    await adapter.initialize();
    return adapter;
}
/**
 * Create AgentDB adapter with default configuration
 *
 * @example
 * ```typescript
 * import { createDefaultAgentDBAdapter } from 'agentic-flow/reasoningbank/agentdb';
 *
 * const adapter = await createDefaultAgentDBAdapter();
 * ```
 */
export async function createDefaultAgentDBAdapter() {
    return createAgentDBAdapter({
        dbPath: '.agentdb/reasoningbank.db',
        enableLearning: true,
        enableReasoning: true,
        enableQUICSync: false,
        quantizationType: 'scalar',
        cacheSize: 1000,
    });
}
/**
 * Migrate from legacy ReasoningBank to AgentDB
 *
 * @param sourcePath - Path to legacy database
 * @param destinationPath - Path for AgentDB database
 * @returns Migration result with statistics
 *
 * @example
 * ```typescript
 * import { migrateToAgentDB } from 'agentic-flow/reasoningbank/agentdb';
 *
 * const result = await migrateToAgentDB(
 *   '.swarm/memory.db',
 *   '.agentdb/reasoningbank.db'
 * );
 *
 * console.log(`Migrated ${result.patternsMigrated} patterns`);
 * console.log(`Backup: ${result.backupPath}`);
 * ```
 */
export async function migrateToAgentDB(sourcePath, destinationPath) {
    const { migrateLegacyDatabase } = await import('agentdb/reasoningbank/migration/migrate');
    return migrateLegacyDatabase(sourcePath, destinationPath || '.agentdb/reasoningbank.db');
}
/**
 * Validate migration from legacy to AgentDB
 *
 * @param sourcePath - Path to legacy database
 * @param destinationPath - Path to AgentDB database
 * @returns Validation result
 */
export async function validateMigration(sourcePath, destinationPath) {
    const { validateMigration: validate } = await import('agentdb/reasoningbank/migration/migrate');
    return validate(sourcePath, destinationPath);
}
