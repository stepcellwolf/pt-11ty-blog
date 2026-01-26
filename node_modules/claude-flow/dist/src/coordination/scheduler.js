import { SystemEvents } from '../utils/types.js';
import { TaskError, TaskTimeoutError, TaskDependencyError } from '../utils/errors.js';
export class TaskScheduler {
    config;
    eventBus;
    logger;
    tasks = new Map();
    agentTasks = new Map();
    taskDependencies = new Map();
    completedTasks = new Set();
    constructor(config, eventBus, logger){
        this.config = config;
        this.eventBus = eventBus;
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('Initializing task scheduler');
        setInterval(()=>this.cleanup(), 60000);
    }
    async shutdown() {
        this.logger.info('Shutting down task scheduler');
        const taskIds = Array.from(this.tasks.keys());
        await Promise.all(taskIds.map((id)=>this.cancelTask(id, 'Scheduler shutdown')));
        this.tasks.clear();
        this.agentTasks.clear();
        this.taskDependencies.clear();
        this.completedTasks.clear();
    }
    async assignTask(task, agentId) {
        this.logger.info('Assigning task', {
            taskId: task.id,
            agentId
        });
        if (task.dependencies.length > 0) {
            const unmetDependencies = task.dependencies.filter((depId)=>!this.completedTasks.has(depId));
            if (unmetDependencies.length > 0) {
                throw new TaskDependencyError(task.id, unmetDependencies);
            }
        }
        const scheduledTask = {
            task: {
                ...task,
                status: 'assigned',
                assignedAgent: agentId
            },
            agentId,
            attempts: 0
        };
        this.tasks.set(task.id, scheduledTask);
        if (!this.agentTasks.has(agentId)) {
            this.agentTasks.set(agentId, new Set());
        }
        this.agentTasks.get(agentId).add(task.id);
        for (const depId of task.dependencies){
            if (!this.taskDependencies.has(depId)) {
                this.taskDependencies.set(depId, new Set());
            }
            this.taskDependencies.get(depId).add(task.id);
        }
        this.startTask(task.id);
    }
    async completeTask(taskId, result) {
        const scheduled = this.tasks.get(taskId);
        if (!scheduled) {
            throw new TaskError(`Task not found: ${taskId}`);
        }
        this.logger.info('Task completed', {
            taskId,
            agentId: scheduled.agentId
        });
        scheduled.task.status = 'completed';
        scheduled.task.output = result;
        scheduled.task.completedAt = new Date();
        if (scheduled.timeout) {
            clearTimeout(scheduled.timeout);
        }
        this.tasks.delete(taskId);
        this.agentTasks.get(scheduled.agentId)?.delete(taskId);
        this.completedTasks.add(taskId);
        const dependents = this.taskDependencies.get(taskId);
        if (dependents) {
            for (const dependentId of dependents){
                const dependent = this.tasks.get(dependentId);
                if (dependent && this.canStartTask(dependent.task)) {
                    this.startTask(dependentId);
                }
            }
        }
    }
    async failTask(taskId, error) {
        const scheduled = this.tasks.get(taskId);
        if (!scheduled) {
            throw new TaskError(`Task not found: ${taskId}`);
        }
        this.logger.error('Task failed', {
            taskId,
            agentId: scheduled.agentId,
            attempt: scheduled.attempts,
            error
        });
        if (scheduled.timeout) {
            clearTimeout(scheduled.timeout);
        }
        scheduled.attempts++;
        scheduled.lastAttempt = new Date();
        if (scheduled.attempts < this.config.maxRetries) {
            this.logger.info('Retrying task', {
                taskId,
                attempt: scheduled.attempts,
                maxRetries: this.config.maxRetries
            });
            const retryDelay = this.config.retryDelay * Math.pow(2, scheduled.attempts - 1);
            setTimeout(()=>{
                this.startTask(taskId);
            }, retryDelay);
        } else {
            scheduled.task.status = 'failed';
            scheduled.task.error = error;
            scheduled.task.completedAt = new Date();
            this.tasks.delete(taskId);
            this.agentTasks.get(scheduled.agentId)?.delete(taskId);
            await this.cancelDependentTasks(taskId, 'Parent task failed');
        }
    }
    async cancelTask(taskId, reason) {
        const scheduled = this.tasks.get(taskId);
        if (!scheduled) {
            return;
        }
        this.logger.info('Cancelling task', {
            taskId,
            reason
        });
        if (scheduled.timeout) {
            clearTimeout(scheduled.timeout);
        }
        scheduled.task.status = 'cancelled';
        scheduled.task.completedAt = new Date();
        this.eventBus.emit(SystemEvents.TASK_CANCELLED, {
            taskId,
            reason
        });
        this.tasks.delete(taskId);
        this.agentTasks.get(scheduled.agentId)?.delete(taskId);
        await this.cancelDependentTasks(taskId, 'Parent task cancelled');
    }
    async cancelAgentTasks(agentId) {
        const taskIds = this.agentTasks.get(agentId);
        if (!taskIds) {
            return;
        }
        this.logger.info('Cancelling all tasks for agent', {
            agentId,
            taskCount: taskIds.size
        });
        const promises = Array.from(taskIds).map((taskId)=>this.cancelTask(taskId, 'Agent terminated'));
        await Promise.all(promises);
        this.agentTasks.delete(agentId);
    }
    async rescheduleAgentTasks(agentId) {
        const taskIds = this.agentTasks.get(agentId);
        if (!taskIds || taskIds.size === 0) {
            return;
        }
        this.logger.info('Rescheduling tasks for agent', {
            agentId,
            taskCount: taskIds.size
        });
        for (const taskId of taskIds){
            const scheduled = this.tasks.get(taskId);
            if (scheduled && scheduled.task.status === 'running') {
                scheduled.task.status = 'queued';
                scheduled.attempts = 0;
                this.eventBus.emit(SystemEvents.TASK_CREATED, {
                    task: scheduled.task
                });
            }
        }
    }
    getAgentTaskCount(agentId) {
        return this.agentTasks.get(agentId)?.size || 0;
    }
    async getHealthStatus() {
        const activeTasks = this.tasks.size;
        const completedTasks = this.completedTasks.size;
        const agentsWithTasks = this.agentTasks.size;
        const tasksByStatus = {
            pending: 0,
            queued: 0,
            assigned: 0,
            running: 0,
            completed: completedTasks,
            failed: 0,
            cancelled: 0
        };
        for (const scheduled of this.tasks.values()){
            tasksByStatus[scheduled.task.status]++;
        }
        return {
            healthy: true,
            metrics: {
                activeTasks,
                completedTasks,
                agentsWithTasks,
                ...tasksByStatus
            }
        };
    }
    async getAgentTasks(agentId) {
        const taskIds = this.agentTasks.get(agentId);
        if (!taskIds) {
            return [];
        }
        const tasks = [];
        for (const taskId of taskIds){
            const scheduled = this.tasks.get(taskId);
            if (scheduled) {
                tasks.push(scheduled.task);
            }
        }
        return tasks;
    }
    async performMaintenance() {
        this.logger.debug('Performing task scheduler maintenance');
        this.cleanup();
        const now = new Date();
        for (const [taskId, scheduled] of this.tasks){
            if (scheduled.task.status === 'running' && scheduled.task.startedAt) {
                const runtime = now.getTime() - scheduled.task.startedAt.getTime();
                if (runtime > this.config.resourceTimeout * 2) {
                    this.logger.warn('Found stuck task', {
                        taskId,
                        runtime,
                        agentId: scheduled.agentId
                    });
                    await this.failTask(taskId, new TaskTimeoutError(taskId, runtime));
                }
            }
        }
    }
    startTask(taskId) {
        const scheduled = this.tasks.get(taskId);
        if (!scheduled) {
            return;
        }
        scheduled.task.status = 'running';
        scheduled.task.startedAt = new Date();
        this.eventBus.emit(SystemEvents.TASK_STARTED, {
            taskId,
            agentId: scheduled.agentId
        });
        const timeoutMs = this.config.resourceTimeout;
        scheduled.timeout = setTimeout(()=>{
            this.failTask(taskId, new TaskTimeoutError(taskId, timeoutMs));
        }, timeoutMs);
    }
    canStartTask(task) {
        return task.dependencies.every((depId)=>this.completedTasks.has(depId));
    }
    async cancelDependentTasks(taskId, reason) {
        const dependents = this.taskDependencies.get(taskId);
        if (!dependents) {
            return;
        }
        for (const dependentId of dependents){
            await this.cancelTask(dependentId, reason);
        }
    }
    cleanup() {
        if (this.completedTasks.size > 1000) {
            const toRemove = this.completedTasks.size - 1000;
            const iterator = this.completedTasks.values();
            for(let i = 0; i < toRemove; i++){
                const result = iterator.next();
                if (!result.done && result.value) {
                    this.completedTasks.delete(result.value);
                    this.taskDependencies.delete(result.value);
                }
            }
        }
    }
}

//# sourceMappingURL=scheduler.js.map