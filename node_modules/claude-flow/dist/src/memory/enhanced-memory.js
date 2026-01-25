import { FallbackMemoryStore } from './fallback-store.js';
export class EnhancedMemory extends FallbackMemoryStore {
    constructor(options = {}){
        super(options);
    }
    async initialize() {
        await super.initialize();
        if (!this.isUsingFallback() && this.primaryStore?.db) {
            try {
                const { readFileSync } = await import('fs');
                const schemaPath = new URL('./enhanced-schema.sql', import.meta.url);
                const schema = readFileSync(schemaPath, 'utf-8');
                this.primaryStore.db.exec(schema);
                console.error(`[${new Date().toISOString()}] INFO [enhanced-memory] Applied enhanced schema to SQLite`);
            } catch (error) {
                console.error(`[${new Date().toISOString()}] WARN [enhanced-memory] Could not apply enhanced schema:`, error.message);
            }
        }
    }
    async saveSessionState(sessionId, state) {
        const sessionData = {
            sessionId,
            userId: state.userId || process.env.USER,
            projectPath: state.projectPath || process.cwd(),
            activeBranch: state.activeBranch || 'main',
            lastActivity: Date.now(),
            state: state.state || 'active',
            context: state.context || {},
            environment: state.environment || process.env
        };
        return this.store(`session:${sessionId}`, sessionData, {
            namespace: 'sessions',
            metadata: {
                type: 'session_state'
            }
        });
    }
    async resumeSession(sessionId) {
        return this.retrieve(`session:${sessionId}`, {
            namespace: 'sessions'
        });
    }
    async getActiveSessions() {
        const sessions = await this.list({
            namespace: 'sessions',
            limit: 100
        });
        return sessions.map((item)=>item.value).filter((session)=>session.state === 'active');
    }
    async trackWorkflow(workflowId, data) {
        const workflowData = {
            workflowId,
            name: data.name,
            steps: data.steps || [],
            status: data.status || 'pending',
            progress: data.progress || 0,
            startTime: data.startTime || Date.now(),
            endTime: data.endTime,
            results: data.results || {}
        };
        return this.store(`workflow:${workflowId}`, workflowData, {
            namespace: 'workflows',
            metadata: {
                type: 'workflow'
            }
        });
    }
    async getWorkflowStatus(workflowId) {
        return this.retrieve(`workflow:${workflowId}`, {
            namespace: 'workflows'
        });
    }
    async recordMetric(metricName, value, metadata = {}) {
        const timestamp = Date.now();
        const metricKey = `metric:${metricName}:${timestamp}`;
        return this.store(metricKey, {
            name: metricName,
            value,
            timestamp,
            metadata
        }, {
            namespace: 'metrics',
            ttl: 86400
        });
    }
    async getMetrics(metricName, timeRange = 3600000) {
        const cutoff = Date.now() - timeRange;
        const metrics = await this.search(`metric:${metricName}`, {
            namespace: 'metrics',
            limit: 1000
        });
        return metrics.map((item)=>item.value).filter((metric)=>metric.timestamp >= cutoff).sort((a, b)=>a.timestamp - b.timestamp);
    }
    async registerAgent(agentId, config) {
        const agentData = {
            agentId,
            type: config.type,
            capabilities: config.capabilities || [],
            status: 'active',
            createdAt: Date.now(),
            lastHeartbeat: Date.now(),
            metrics: {
                tasksCompleted: 0,
                successRate: 1.0,
                avgResponseTime: 0
            }
        };
        return this.store(`agent:${agentId}`, agentData, {
            namespace: 'agents',
            metadata: {
                type: 'agent_registration'
            }
        });
    }
    async updateAgentStatus(agentId, status, metrics = {}) {
        const agent = await this.retrieve(`agent:${agentId}`, {
            namespace: 'agents'
        });
        if (!agent) return null;
        agent.status = status;
        agent.lastHeartbeat = Date.now();
        if (metrics) {
            Object.assign(agent.metrics, metrics);
        }
        return this.store(`agent:${agentId}`, agent, {
            namespace: 'agents',
            metadata: {
                type: 'agent_update'
            }
        });
    }
    async getActiveAgents() {
        const agents = await this.list({
            namespace: 'agents',
            limit: 100
        });
        const cutoff = Date.now() - 300000;
        return agents.map((item)=>item.value).filter((agent)=>agent.lastHeartbeat > cutoff && agent.status === 'active');
    }
    async storeKnowledge(domain, key, value, metadata = {}) {
        return this.store(`knowledge:${domain}:${key}`, {
            domain,
            key,
            value,
            metadata,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }, {
            namespace: 'knowledge',
            metadata: {
                domain
            }
        });
    }
    async retrieveKnowledge(domain, key) {
        return this.retrieve(`knowledge:${domain}:${key}`, {
            namespace: 'knowledge'
        });
    }
    async searchKnowledge(domain, pattern) {
        const results = await this.search(`knowledge:${domain}:${pattern}`, {
            namespace: 'knowledge',
            limit: 50
        });
        return results.map((item)=>item.value);
    }
    async recordLearning(agentId, learning) {
        const learningData = {
            agentId,
            timestamp: Date.now(),
            type: learning.type,
            input: learning.input,
            output: learning.output,
            feedback: learning.feedback,
            improvement: learning.improvement
        };
        return this.store(`learning:${agentId}:${Date.now()}`, learningData, {
            namespace: 'learning',
            ttl: 604800
        });
    }
    async getLearnings(agentId, limit = 100) {
        const learnings = await this.search(`learning:${agentId}`, {
            namespace: 'learning',
            limit
        });
        return learnings.map((item)=>item.value).sort((a, b)=>b.timestamp - a.timestamp);
    }
    async trackPerformance(operation, duration, success = true, metadata = {}) {
        const perfData = {
            operation,
            duration,
            success,
            timestamp: Date.now(),
            metadata
        };
        await this.store(`perf:${operation}:${Date.now()}`, perfData, {
            namespace: 'performance',
            ttl: 86400
        });
        const statsKey = `stats:${operation}`;
        const stats = await this.retrieve(statsKey, {
            namespace: 'performance'
        }) || {
            count: 0,
            successCount: 0,
            totalDuration: 0,
            avgDuration: 0,
            minDuration: Infinity,
            maxDuration: 0
        };
        stats.count++;
        if (success) stats.successCount++;
        stats.totalDuration += duration;
        stats.avgDuration = stats.totalDuration / stats.count;
        stats.minDuration = Math.min(stats.minDuration, duration);
        stats.maxDuration = Math.max(stats.maxDuration, duration);
        stats.successRate = stats.successCount / stats.count;
        return this.store(statsKey, stats, {
            namespace: 'performance'
        });
    }
    async getPerformanceStats(operation) {
        return this.retrieve(`stats:${operation}`, {
            namespace: 'performance'
        });
    }
    async cacheCoordination(key, value, ttl = 300) {
        return this.store(`cache:${key}`, value, {
            namespace: 'coordination',
            ttl
        });
    }
    async getCachedCoordination(key) {
        return this.retrieve(`cache:${key}`, {
            namespace: 'coordination'
        });
    }
    async cleanupExpired() {
        const cleaned = await this.cleanup();
        if (!this.isUsingFallback()) {}
        return cleaned;
    }
    async exportData(namespace = null) {
        const namespaces = namespace ? [
            namespace
        ] : [
            'sessions',
            'workflows',
            'metrics',
            'agents',
            'knowledge',
            'learning',
            'performance',
            'coordination'
        ];
        const exportData = {};
        for (const ns of namespaces){
            exportData[ns] = await this.list({
                namespace: ns,
                limit: 10000
            });
        }
        return exportData;
    }
    async importData(data) {
        for (const [namespace, items] of Object.entries(data)){
            for (const item of items){
                await this.store(item.key, item.value, {
                    namespace,
                    metadata: item.metadata
                });
            }
        }
    }
}
export default EnhancedMemory;

//# sourceMappingURL=enhanced-memory.js.map