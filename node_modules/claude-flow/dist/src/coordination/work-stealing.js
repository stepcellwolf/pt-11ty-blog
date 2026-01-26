export class WorkStealingCoordinator {
    config;
    eventBus;
    logger;
    workloads = new Map();
    stealInterval;
    taskDurations = new Map();
    constructor(config, eventBus, logger){
        this.config = config;
        this.eventBus = eventBus;
        this.logger = logger;
    }
    async initialize() {
        if (!this.config.enabled) {
            this.logger.info('Work stealing is disabled');
            return;
        }
        this.logger.info('Initializing work stealing coordinator');
        this.stealInterval = setInterval(()=>this.checkAndSteal(), this.config.stealInterval);
    }
    async shutdown() {
        if (this.stealInterval) {
            clearInterval(this.stealInterval);
        }
        this.workloads.clear();
        this.taskDurations.clear();
    }
    updateAgentWorkload(agentId, workload) {
        const existing = this.workloads.get(agentId) || {
            agentId,
            taskCount: 0,
            avgTaskDuration: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            priority: 0,
            capabilities: []
        };
        this.workloads.set(agentId, {
            ...existing,
            ...workload
        });
    }
    recordTaskDuration(agentId, duration) {
        if (!this.taskDurations.has(agentId)) {
            this.taskDurations.set(agentId, []);
        }
        const durations = this.taskDurations.get(agentId);
        durations.push(duration);
        if (durations.length > 100) {
            durations.shift();
        }
        const avg = durations.reduce((sum, d)=>sum + d, 0) / durations.length;
        this.updateAgentWorkload(agentId, {
            avgTaskDuration: avg
        });
    }
    async checkAndSteal() {
        const workloads = Array.from(this.workloads.values());
        if (workloads.length < 2) {
            return;
        }
        workloads.sort((a, b)=>a.taskCount - b.taskCount);
        const minLoaded = workloads[0];
        const maxLoaded = workloads[workloads.length - 1];
        const difference = maxLoaded.taskCount - minLoaded.taskCount;
        if (difference < this.config.stealThreshold) {
            return;
        }
        const tasksToSteal = Math.min(Math.floor(difference / 2), this.config.maxStealBatch);
        this.logger.info('Initiating work stealing', {
            from: maxLoaded.agentId,
            to: minLoaded.agentId,
            tasksToSteal,
            difference
        });
        this.eventBus.emit('workstealing:request', {
            sourceAgent: maxLoaded.agentId,
            targetAgent: minLoaded.agentId,
            taskCount: tasksToSteal
        });
    }
    findBestAgent(task, agents) {
        const candidates = [];
        for (const agent of agents){
            const workload = this.workloads.get(agent.id);
            if (!workload) {
                continue;
            }
            let score = 100;
            score -= workload.taskCount * 10;
            score -= workload.cpuUsage * 0.5;
            score -= workload.memoryUsage * 0.3;
            score += agent.priority * 5;
            const taskType = task.type;
            if (agent.capabilities.includes(taskType)) {
                score += 20;
            }
            const predictedLoad = workload.avgTaskDuration * workload.taskCount;
            score -= predictedLoad / 1000;
            candidates.push({
                agentId: agent.id,
                score
            });
        }
        if (candidates.length === 0) {
            return null;
        }
        candidates.sort((a, b)=>b.score - a.score);
        this.logger.debug('Agent selection scores', {
            taskId: task.id,
            candidates: candidates.slice(0, 5)
        });
        return candidates[0].agentId;
    }
    getWorkloadStats() {
        const stats = {
            totalAgents: this.workloads.size,
            workloads: {}
        };
        let totalTasks = 0;
        let minTasks = Infinity;
        let maxTasks = 0;
        for (const [agentId, workload] of this.workloads){
            totalTasks += workload.taskCount;
            minTasks = Math.min(minTasks, workload.taskCount);
            maxTasks = Math.max(maxTasks, workload.taskCount);
            stats.workloads[agentId] = {
                taskCount: workload.taskCount,
                avgTaskDuration: workload.avgTaskDuration,
                cpuUsage: workload.cpuUsage,
                memoryUsage: workload.memoryUsage
            };
        }
        stats.totalTasks = totalTasks;
        stats.avgTasksPerAgent = totalTasks / this.workloads.size;
        stats.minTasks = minTasks === Infinity ? 0 : minTasks;
        stats.maxTasks = maxTasks;
        stats.imbalance = maxTasks - (minTasks === Infinity ? 0 : minTasks);
        return stats;
    }
}

//# sourceMappingURL=work-stealing.js.map