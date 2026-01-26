import SharedMemory from './shared-memory.js';
import { SwarmMemory, createSwarmMemory } from './swarm-memory.js';
import { AgentDBMemoryAdapter } from './agentdb-adapter.js';
import { AgentDBBackend } from './backends/agentdb.js';
import { LegacyDataBridge } from './migration/legacy-bridge.js';
export { SharedMemory, SwarmMemory, createSwarmMemory, AgentDBMemoryAdapter, AgentDBBackend, LegacyDataBridge };
export const SWARM_NAMESPACES = {
    AGENTS: 'swarm:agents',
    TASKS: 'swarm:tasks',
    COMMUNICATIONS: 'swarm:communications',
    CONSENSUS: 'swarm:consensus',
    PATTERNS: 'swarm:patterns',
    METRICS: 'swarm:metrics',
    COORDINATION: 'swarm:coordination'
};
export function createMemory(options = {}) {
    if (options.type === 'agentdb' || options.mode) {
        return new AgentDBMemoryAdapter(options);
    }
    if (options.type === 'swarm' || options.swarmId) {
        return new SwarmMemory(options);
    }
    return new SharedMemory(options);
}
export default {
    SharedMemory,
    SwarmMemory,
    createMemory,
    SWARM_NAMESPACES,
    AgentDBMemoryAdapter,
    AgentDBBackend,
    LegacyDataBridge
};

//# sourceMappingURL=index.js.map