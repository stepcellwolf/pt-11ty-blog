import { SharedMemory } from './shared-memory.js';
const SWARM_NAMESPACES = {
    AGENTS: 'swarm:agents',
    TASKS: 'swarm:tasks',
    COMMUNICATIONS: 'swarm:communications',
    CONSENSUS: 'swarm:consensus',
    PATTERNS: 'swarm:patterns',
    METRICS: 'swarm:metrics',
    COORDINATION: 'swarm:coordination'
};
export class SwarmMemory extends SharedMemory {
    constructor(options = {}){
        super({
            directory: options.directory || '.swarm',
            filename: options.filename || 'swarm-memory.db',
            ...options
        });
        this.swarmId = options.swarmId || 'default';
        this.mcpMode = options.mcpMode !== false;
        this.agentCache = new Map();
        this.taskCache = new Map();
        this.patternCache = new Map();
    }
    async initialize() {
        await super.initialize();
        await this._initializeSwarmNamespaces();
        await this._loadSwarmState();
        this.emit('swarm:initialized', {
            swarmId: this.swarmId
        });
    }
    async storeAgent(agentId, agentData) {
        const key = `agent:${agentId}`;
        const enrichedData = {
            ...agentData,
            swarmId: this.swarmId,
            lastUpdated: new Date().toISOString()
        };
        await this.store(key, enrichedData, {
            namespace: SWARM_NAMESPACES.AGENTS,
            tags: [
                'agent',
                agentData.type,
                agentData.status
            ],
            metadata: {
                swarmId: this.swarmId,
                agentType: agentData.type
            }
        });
        this.agentCache.set(agentId, enrichedData);
        this.emit('swarm:agentStored', {
            agentId,
            type: agentData.type
        });
        return {
            agentId,
            stored: true
        };
    }
    async getAgent(agentId) {
        if (this.agentCache.has(agentId)) {
            return this.agentCache.get(agentId);
        }
        const key = `agent:${agentId}`;
        const agent = await this.retrieve(key, SWARM_NAMESPACES.AGENTS);
        if (agent) {
            this.agentCache.set(agentId, agent);
        }
        return agent;
    }
    async listAgents(filter = {}) {
        const agents = await this.list(SWARM_NAMESPACES.AGENTS, {
            limit: filter.limit || 100
        });
        return agents.map((entry)=>entry.value).filter((agent)=>{
            if (filter.type && agent.type !== filter.type) return false;
            if (filter.status && agent.status !== filter.status) return false;
            if (filter.swarmId && agent.swarmId !== filter.swarmId) return false;
            return true;
        });
    }
    async storeTask(taskId, taskData) {
        const key = `task:${taskId}`;
        const enrichedData = {
            ...taskData,
            swarmId: this.swarmId,
            createdAt: taskData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await this.store(key, enrichedData, {
            namespace: SWARM_NAMESPACES.TASKS,
            tags: [
                'task',
                taskData.status,
                taskData.priority
            ],
            metadata: {
                swarmId: this.swarmId,
                assignedAgents: taskData.assignedAgents || []
            }
        });
        this.taskCache.set(taskId, enrichedData);
        this.emit('swarm:taskStored', {
            taskId,
            status: taskData.status
        });
        return {
            taskId,
            stored: true
        };
    }
    async updateTaskStatus(taskId, status, result = null) {
        const task = await this.getTask(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        task.status = status;
        task.updatedAt = new Date().toISOString();
        if (result) {
            task.result = result;
        }
        if (status === 'completed') {
            task.completedAt = new Date().toISOString();
        }
        await this.storeTask(taskId, task);
        this.emit('swarm:taskStatusUpdated', {
            taskId,
            status
        });
        return {
            taskId,
            status,
            updated: true
        };
    }
    async getTask(taskId) {
        if (this.taskCache.has(taskId)) {
            return this.taskCache.get(taskId);
        }
        const key = `task:${taskId}`;
        const task = await this.retrieve(key, SWARM_NAMESPACES.TASKS);
        if (task) {
            this.taskCache.set(taskId, task);
        }
        return task;
    }
    async storeCommunication(fromAgent, toAgent, message) {
        const commId = `comm:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const communication = {
            id: commId,
            fromAgent,
            toAgent,
            message,
            swarmId: this.swarmId,
            timestamp: new Date().toISOString()
        };
        await this.store(commId, communication, {
            namespace: SWARM_NAMESPACES.COMMUNICATIONS,
            ttl: 86400,
            tags: [
                'communication',
                message.type
            ],
            metadata: {
                fromAgent,
                toAgent,
                messageType: message.type
            }
        });
        this.emit('swarm:communication', {
            fromAgent,
            toAgent,
            type: message.type
        });
        return {
            id: commId,
            stored: true
        };
    }
    async storeConsensus(consensusId, decision) {
        const key = `consensus:${consensusId}`;
        const consensusData = {
            ...decision,
            swarmId: this.swarmId,
            timestamp: new Date().toISOString()
        };
        await this.store(key, consensusData, {
            namespace: SWARM_NAMESPACES.CONSENSUS,
            tags: [
                'consensus',
                decision.status
            ],
            metadata: {
                swarmId: this.swarmId,
                taskId: decision.taskId,
                threshold: decision.threshold
            }
        });
        this.emit('swarm:consensus', {
            consensusId,
            status: decision.status
        });
        return {
            consensusId,
            stored: true
        };
    }
    async storePattern(patternId, pattern) {
        const key = `pattern:${patternId}`;
        const patternData = {
            ...pattern,
            swarmId: this.swarmId,
            createdAt: new Date().toISOString(),
            usageCount: 0,
            successRate: 0
        };
        await this.store(key, patternData, {
            namespace: SWARM_NAMESPACES.PATTERNS,
            tags: [
                'pattern',
                pattern.type
            ],
            metadata: {
                swarmId: this.swarmId,
                patternType: pattern.type,
                confidence: pattern.confidence || 0
            }
        });
        if (pattern.type === 'coordination' || pattern.type === 'optimization') {
            this.patternCache.set(patternId, patternData);
        }
        this.emit('swarm:patternStored', {
            patternId,
            type: pattern.type
        });
        return {
            patternId,
            stored: true
        };
    }
    async updatePatternMetrics(patternId, success = true) {
        const pattern = await this.getPattern(patternId);
        if (!pattern) {
            throw new Error(`Pattern ${patternId} not found`);
        }
        pattern.usageCount++;
        pattern.lastUsedAt = new Date().toISOString();
        const alpha = 0.1;
        const currentSuccess = success ? 1 : 0;
        pattern.successRate = alpha * currentSuccess + (1 - alpha) * (pattern.successRate || 0);
        await this.storePattern(patternId, pattern);
        return {
            patternId,
            usageCount: pattern.usageCount,
            successRate: pattern.successRate
        };
    }
    async getPattern(patternId) {
        if (this.patternCache.has(patternId)) {
            return this.patternCache.get(patternId);
        }
        const key = `pattern:${patternId}`;
        return await this.retrieve(key, SWARM_NAMESPACES.PATTERNS);
    }
    async findBestPatterns(context, limit = 5) {
        const patterns = await this.search({
            namespace: SWARM_NAMESPACES.PATTERNS,
            tags: context.tags,
            limit: 100
        });
        const scored = patterns.map((entry)=>{
            const pattern = entry.value;
            const score = pattern.successRate * 0.7 + (pattern.confidence || 0) * 0.2 + (pattern.usageCount > 0 ? 0.1 : 0);
            return {
                ...pattern,
                score
            };
        });
        return scored.sort((a, b)=>b.score - a.score).slice(0, limit);
    }
    async storeCoordination(key, state) {
        await this.store(key, state, {
            namespace: SWARM_NAMESPACES.COORDINATION,
            ttl: 3600,
            metadata: {
                swarmId: this.swarmId,
                timestamp: new Date().toISOString()
            }
        });
        return {
            key,
            stored: true
        };
    }
    async getCoordination(key) {
        return await this.retrieve(key, SWARM_NAMESPACES.COORDINATION);
    }
    async storeMetrics(metricsId, metrics) {
        const key = `metrics:${metricsId}`;
        await this.store(key, metrics, {
            namespace: SWARM_NAMESPACES.METRICS,
            ttl: 86400 * 7,
            tags: [
                'metrics',
                metrics.type
            ],
            metadata: {
                swarmId: this.swarmId,
                agentId: metrics.agentId,
                timestamp: new Date().toISOString()
            }
        });
        this.emit('swarm:metricsStored', {
            metricsId,
            type: metrics.type
        });
        return {
            metricsId,
            stored: true
        };
    }
    async getSwarmStats() {
        const baseStats = await this.getStats();
        const agentCount = await this._countNamespace(SWARM_NAMESPACES.AGENTS);
        const taskCount = await this._countNamespace(SWARM_NAMESPACES.TASKS);
        const patternCount = await this._countNamespace(SWARM_NAMESPACES.PATTERNS);
        const activeAgents = Array.from(this.agentCache.values()).filter((agent)=>agent.status === 'active' || agent.status === 'busy').length;
        const tasks = Array.from(this.taskCache.values());
        const taskStats = {
            total: tasks.length,
            pending: tasks.filter((t)=>t.status === 'pending').length,
            inProgress: tasks.filter((t)=>t.status === 'in_progress').length,
            completed: tasks.filter((t)=>t.status === 'completed').length,
            failed: tasks.filter((t)=>t.status === 'failed').length
        };
        return {
            ...baseStats,
            swarm: {
                swarmId: this.swarmId,
                agents: {
                    total: agentCount,
                    active: activeAgents,
                    cached: this.agentCache.size
                },
                tasks: taskStats,
                patterns: {
                    total: patternCount,
                    cached: this.patternCache.size
                },
                namespaces: Object.values(SWARM_NAMESPACES)
            }
        };
    }
    async cleanupSwarmData(options = {}) {
        const { maxAge = 86400 * 7, keepPatterns = true, keepConsensus = true } = options;
        const cutoffTime = Date.now() - maxAge * 1000;
        let cleaned = 0;
        const comms = await this.list(SWARM_NAMESPACES.COMMUNICATIONS);
        for (const comm of comms){
            if (new Date(comm.value.timestamp).getTime() < cutoffTime) {
                await this.delete(comm.key, SWARM_NAMESPACES.COMMUNICATIONS);
                cleaned++;
            }
        }
        const tasks = await this.list(SWARM_NAMESPACES.TASKS);
        for (const task of tasks){
            if (task.value.status === 'completed' && new Date(task.value.completedAt).getTime() < cutoffTime) {
                await this.delete(task.key, SWARM_NAMESPACES.TASKS);
                this.taskCache.delete(task.value.id);
                cleaned++;
            }
        }
        const metrics = await this.list(SWARM_NAMESPACES.METRICS);
        for (const metric of metrics){
            if (new Date(metric.createdAt).getTime() < cutoffTime) {
                await this.delete(metric.key, SWARM_NAMESPACES.METRICS);
                cleaned++;
            }
        }
        this.emit('swarm:cleanup', {
            cleaned,
            maxAge
        });
        return {
            cleaned
        };
    }
    async exportSwarmState() {
        const agents = await this.listAgents();
        const tasks = Array.from(this.taskCache.values());
        const patterns = await this.list(SWARM_NAMESPACES.PATTERNS);
        return {
            swarmId: this.swarmId,
            exportedAt: new Date().toISOString(),
            agents: agents,
            tasks: tasks,
            patterns: patterns.map((p)=>p.value),
            statistics: await this.getSwarmStats()
        };
    }
    async importSwarmState(state) {
        let imported = {
            agents: 0,
            tasks: 0,
            patterns: 0
        };
        if (state.agents) {
            for (const agent of state.agents){
                await this.storeAgent(agent.id, agent);
                imported.agents++;
            }
        }
        if (state.tasks) {
            for (const task of state.tasks){
                await this.storeTask(task.id, task);
                imported.tasks++;
            }
        }
        if (state.patterns) {
            for (const pattern of state.patterns){
                await this.storePattern(pattern.id, pattern);
                imported.patterns++;
            }
        }
        this.emit('swarm:imported', imported);
        return imported;
    }
    async _initializeSwarmNamespaces() {
        await this.store('swarm:metadata', {
            swarmId: this.swarmId,
            createdAt: new Date().toISOString(),
            version: '1.0.0',
            namespaces: Object.values(SWARM_NAMESPACES)
        }, {
            namespace: 'swarm:system'
        });
    }
    async _loadSwarmState() {
        const agents = await this.list(SWARM_NAMESPACES.AGENTS, {
            limit: 100
        });
        for (const entry of agents){
            if (entry.value.status === 'active' || entry.value.status === 'busy') {
                this.agentCache.set(entry.value.id, entry.value);
            }
        }
        const tasks = await this.search({
            namespace: SWARM_NAMESPACES.TASKS,
            tags: [
                'in_progress'
            ],
            limit: 100
        });
        for (const entry of tasks){
            this.taskCache.set(entry.value.id, entry.value);
        }
        const patterns = await this.list(SWARM_NAMESPACES.PATTERNS, {
            limit: 50
        });
        for (const entry of patterns){
            if (entry.value.confidence > 0.7 || entry.value.successRate > 0.8) {
                this.patternCache.set(entry.value.id, entry.value);
            }
        }
    }
    async _countNamespace(namespace) {
        const stats = await this.getStats();
        return stats.namespaces[namespace]?.count || 0;
    }
}
export function createSwarmMemory(options = {}) {
    return new SwarmMemory(options);
}
export default SwarmMemory;

//# sourceMappingURL=swarm-memory.js.map