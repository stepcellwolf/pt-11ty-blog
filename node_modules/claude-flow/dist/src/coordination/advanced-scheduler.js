import { SystemEvents } from '../utils/types.js';
import { TaskScheduler } from './scheduler.js';
import { WorkStealingCoordinator } from './work-stealing.js';
import { DependencyGraph } from './dependency-graph.js';
import { CircuitBreakerManager } from './circuit-breaker.js';
export class CapabilitySchedulingStrategy {
    name = 'capability';
    selectAgent(task, agents, context) {
        const capableAgents = agents.filter((agent)=>{
            const capabilities = context.agentCapabilities.get(agent.id) || agent.capabilities;
            return task.type === 'any' || capabilities.includes(task.type) || capabilities.includes('*');
        });
        if (capableAgents.length === 0) {
            return null;
        }
        capableAgents.sort((a, b)=>{
            const loadA = context.taskLoads.get(a.id) || 0;
            const loadB = context.taskLoads.get(b.id) || 0;
            if (loadA !== loadB) {
                return loadA - loadB;
            }
            const priorityA = context.agentPriorities.get(a.id) || a.priority;
            const priorityB = context.agentPriorities.get(b.id) || b.priority;
            return priorityB - priorityA;
        });
        return capableAgents[0].id;
    }
}
export class RoundRobinSchedulingStrategy {
    name = 'round-robin';
    lastIndex = 0;
    selectAgent(task, agents, context) {
        if (agents.length === 0) {
            return null;
        }
        this.lastIndex = (this.lastIndex + 1) % agents.length;
        return agents[this.lastIndex].id;
    }
}
export class LeastLoadedSchedulingStrategy {
    name = 'least-loaded';
    selectAgent(task, agents, context) {
        if (agents.length === 0) {
            return null;
        }
        let minLoad = Infinity;
        let selectedAgent = null;
        for (const agent of agents){
            const load = context.taskLoads.get(agent.id) || 0;
            if (load < minLoad) {
                minLoad = load;
                selectedAgent = agent.id;
            }
        }
        return selectedAgent;
    }
}
export class AffinitySchedulingStrategy {
    name = 'affinity';
    selectAgent(task, agents, context) {
        const taskStats = context.taskHistory.get(task.type);
        if (taskStats?.lastAgent) {
            const lastAgent = agents.find((a)=>a.id === taskStats.lastAgent);
            if (lastAgent) {
                const load = context.taskLoads.get(lastAgent.id) || 0;
                if (load < lastAgent.maxConcurrentTasks * 0.8) {
                    return lastAgent.id;
                }
            }
        }
        return new CapabilitySchedulingStrategy().selectAgent(task, agents, context);
    }
}
export class AdvancedTaskScheduler extends TaskScheduler {
    strategies = new Map();
    activeAgents = new Map();
    taskStats = new Map();
    workStealing;
    dependencyGraph;
    circuitBreakers;
    defaultStrategy = 'capability';
    constructor(config, eventBus, logger){
        super(config, eventBus, logger);
        this.workStealing = new WorkStealingCoordinator({
            enabled: true,
            stealThreshold: 3,
            maxStealBatch: 2,
            stealInterval: 5000
        }, eventBus, logger);
        this.dependencyGraph = new DependencyGraph(logger);
        const cbConfig = {
            failureThreshold: 3,
            successThreshold: 2,
            timeout: 30000,
            halfOpenLimit: 1
        };
        this.circuitBreakers = new CircuitBreakerManager(cbConfig, logger, eventBus);
        this.registerStrategy(new CapabilitySchedulingStrategy());
        this.registerStrategy(new RoundRobinSchedulingStrategy());
        this.registerStrategy(new LeastLoadedSchedulingStrategy());
        this.registerStrategy(new AffinitySchedulingStrategy());
        this.setupAdvancedEventHandlers();
    }
    async initialize() {
        await super.initialize();
        await this.workStealing.initialize();
        this.logger.info('Advanced task scheduler initialized');
    }
    async shutdown() {
        await this.workStealing.shutdown();
        await super.shutdown();
    }
    registerStrategy(strategy) {
        this.strategies.set(strategy.name, strategy);
        this.logger.info('Registered scheduling strategy', {
            name: strategy.name
        });
    }
    setDefaultStrategy(name) {
        if (!this.strategies.has(name)) {
            throw new Error(`Strategy not found: ${name}`);
        }
        this.defaultStrategy = name;
    }
    registerAgent(profile) {
        this.activeAgents.set(profile.id, profile);
        this.workStealing.updateAgentWorkload(profile.id, {
            agentId: profile.id,
            taskCount: 0,
            avgTaskDuration: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            priority: profile.priority,
            capabilities: profile.capabilities
        });
    }
    unregisterAgent(agentId) {
        this.activeAgents.delete(agentId);
    }
    async assignTask(task, agentId) {
        this.dependencyGraph.addTask(task);
        if (!agentId) {
            const selectedAgent = await this.selectAgentForTask(task);
            if (!selectedAgent) {
                throw new Error('No suitable agent found for task');
            }
            agentId = selectedAgent;
        }
        await this.circuitBreakers.execute(`assign-${agentId}`, async ()=>{
            await super.assignTask(task, agentId);
        });
        const taskCount = await this.getAgentTaskCount(agentId);
        this.workStealing.updateAgentWorkload(agentId, {
            taskCount
        });
    }
    async selectAgentForTask(task) {
        const availableAgents = Array.from(this.activeAgents.values());
        if (availableAgents.length === 0) {
            return null;
        }
        const context = {
            taskLoads: new Map(),
            agentCapabilities: new Map(),
            agentPriorities: new Map(),
            taskHistory: this.taskStats,
            currentTime: new Date()
        };
        for (const agent of availableAgents){
            const taskCount = await this.getAgentTaskCount(agent.id);
            context.taskLoads.set(agent.id, taskCount);
            context.agentCapabilities.set(agent.id, agent.capabilities);
            context.agentPriorities.set(agent.id, agent.priority);
        }
        const workStealingAgent = this.workStealing.findBestAgent(task, availableAgents);
        if (workStealingAgent) {
            return workStealingAgent;
        }
        const strategy = this.strategies.get(this.defaultStrategy);
        if (!strategy) {
            throw new Error(`Strategy not found: ${this.defaultStrategy}`);
        }
        return strategy.selectAgent(task, availableAgents, context);
    }
    async completeTask(taskId, result) {
        const task = await this.getTask(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        const duration = task.startedAt ? new Date().getTime() - task.startedAt.getTime() : 0;
        this.updateTaskStats(task.type, true, duration);
        if (task.assignedAgent) {
            this.workStealing.recordTaskDuration(task.assignedAgent, duration);
        }
        const readyTasks = this.dependencyGraph.markCompleted(taskId);
        await super.completeTask(taskId, result);
        for (const readyTaskId of readyTasks){
            const readyTask = await this.getTask(readyTaskId);
            if (readyTask) {
                this.eventBus.emit(SystemEvents.TASK_CREATED, {
                    task: readyTask
                });
            }
        }
    }
    async failTask(taskId, error) {
        const task = await this.getTask(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        this.updateTaskStats(task.type, false, 0);
        const toCancelIds = this.dependencyGraph.markFailed(taskId);
        await super.failTask(taskId, error);
        for (const cancelId of toCancelIds){
            await this.cancelTask(cancelId, 'Parent task failed');
        }
    }
    async getTask(taskId) {
        return null;
    }
    updateTaskStats(taskType, success, duration) {
        const stats = this.taskStats.get(taskType) || {
            totalExecutions: 0,
            avgDuration: 0,
            successRate: 0
        };
        stats.totalExecutions++;
        if (success) {
            const successCount = Math.round(stats.successRate * (stats.totalExecutions - 1));
            stats.successRate = (successCount + 1) / stats.totalExecutions;
            if (duration > 0) {
                const totalDuration = stats.avgDuration * (stats.totalExecutions - 1);
                stats.avgDuration = (totalDuration + duration) / stats.totalExecutions;
            }
        } else {
            const successCount = Math.round(stats.successRate * (stats.totalExecutions - 1));
            stats.successRate = successCount / stats.totalExecutions;
        }
        this.taskStats.set(taskType, stats);
    }
    setupAdvancedEventHandlers() {
        this.eventBus.on('workstealing:request', async (data)=>{
            const { sourceAgent, targetAgent, taskCount } = data;
            try {
                const tasks = await this.getAgentTasks(sourceAgent);
                const tasksToSteal = tasks.filter((t)=>t.status === 'queued' || t.status === 'assigned').slice(0, taskCount);
                for (const task of tasksToSteal){
                    await this.reassignTask(task.id, targetAgent);
                }
                this.logger.info('Work stealing completed', {
                    from: sourceAgent,
                    to: targetAgent,
                    stolenCount: tasksToSteal.length
                });
            } catch (error) {
                this.logger.error('Work stealing failed', {
                    error
                });
            }
        });
        this.eventBus.on(SystemEvents.TASK_ASSIGNED, async (data)=>{
            const { agentId } = data;
            const taskCount = await this.getAgentTaskCount(agentId);
            this.workStealing.updateAgentWorkload(agentId, {
                taskCount
            });
        });
        this.eventBus.on(SystemEvents.TASK_COMPLETED, async (data)=>{
            const { taskId } = data;
        });
    }
    async reassignTask(taskId, newAgentId) {
        await this.cancelTask(taskId, 'Reassigning to different agent');
        const task = await this.getTask(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        await this.assignTask(task, newAgentId);
    }
    async getSchedulingMetrics() {
        const baseMetrics = await this.getHealthStatus();
        const workloadStats = this.workStealing.getWorkloadStats();
        const depGraphStats = this.dependencyGraph.getStats();
        const cbMetrics = this.circuitBreakers.getAllMetrics();
        return {
            ...baseMetrics.metrics,
            workStealing: workloadStats,
            dependencies: depGraphStats,
            circuitBreakers: cbMetrics,
            taskStats: Object.fromEntries(this.taskStats),
            activeStrategies: Array.from(this.strategies.keys()),
            defaultStrategy: this.defaultStrategy
        };
    }
}

//# sourceMappingURL=advanced-scheduler.js.map