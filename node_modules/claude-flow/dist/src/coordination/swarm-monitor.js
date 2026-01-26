import { EventEmitter } from 'node:events';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Logger } from '../core/logger.js';
export class SwarmMonitor extends EventEmitter {
    logger;
    config;
    agentMetrics = new Map();
    systemMetrics = [];
    alerts = [];
    monitoringInterval;
    startTime;
    taskStartTimes = new Map();
    taskCompletionTimes = [];
    lastThroughputCheck;
    tasksInLastMinute = 0;
    constructor(config){
        super();
        this.logger = new Logger('SwarmMonitor');
        this.config = {
            updateInterval: 1000,
            metricsRetention: 24,
            cpuThreshold: 80,
            memoryThreshold: 85,
            stallTimeout: 300000,
            errorRateThreshold: 10,
            throughputThreshold: 1,
            enableAlerts: true,
            enableHistory: true,
            historyPath: './monitoring/history',
            ...config
        };
        this.startTime = Date.now();
        this.lastThroughputCheck = Date.now();
    }
    async start() {
        this.logger.info('Starting swarm monitoring...');
        if (this.config.enableHistory && this.config.historyPath) {
            await fs.mkdir(this.config.historyPath, {
                recursive: true
            });
        }
        this.monitoringInterval = setInterval(()=>{
            this.collectMetrics();
        }, this.config.updateInterval);
        await this.collectMetrics();
    }
    stop() {
        this.logger.info('Stopping swarm monitoring...');
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
    }
    registerAgent(agentId, name) {
        this.agentMetrics.set(agentId, {
            id: agentId,
            name,
            status: 'idle',
            taskCount: 0,
            successCount: 0,
            failureCount: 0,
            averageTaskDuration: 0,
            lastActivity: Date.now(),
            errorRate: 0
        });
        this.logger.debug(`Registered agent: ${name} (${agentId})`);
    }
    unregisterAgent(agentId) {
        const metrics = this.agentMetrics.get(agentId);
        if (metrics) {
            this.logger.debug(`Unregistered agent: ${metrics.name} (${agentId})`);
            this.agentMetrics.delete(agentId);
        }
    }
    taskStarted(agentId, taskId, taskDescription) {
        const metrics = this.agentMetrics.get(agentId);
        if (metrics) {
            metrics.status = 'running';
            metrics.currentTask = taskDescription || taskId;
            metrics.startTime = Date.now();
            metrics.lastActivity = Date.now();
            metrics.taskCount++;
            this.taskStartTimes.set(taskId, Date.now());
            this.emit('task:started', {
                agentId,
                taskId,
                taskDescription
            });
        }
    }
    taskCompleted(agentId, taskId, outputSize) {
        const metrics = this.agentMetrics.get(agentId);
        const startTime = this.taskStartTimes.get(taskId);
        if (metrics && startTime) {
            const duration = Date.now() - startTime;
            metrics.status = 'completed';
            metrics.endTime = Date.now();
            metrics.duration = duration;
            metrics.lastActivity = Date.now();
            metrics.successCount++;
            metrics.outputSize = outputSize;
            const totalDuration = metrics.averageTaskDuration * (metrics.successCount - 1) + duration;
            metrics.averageTaskDuration = totalDuration / metrics.successCount;
            metrics.errorRate = metrics.failureCount / metrics.taskCount * 100;
            this.taskCompletionTimes.push(Date.now());
            this.tasksInLastMinute++;
            this.taskStartTimes.delete(taskId);
            this.emit('task:completed', {
                agentId,
                taskId,
                duration,
                outputSize
            });
        }
    }
    taskFailed(agentId, taskId, error) {
        const metrics = this.agentMetrics.get(agentId);
        const startTime = this.taskStartTimes.get(taskId);
        if (metrics) {
            const duration = startTime ? Date.now() - startTime : 0;
            metrics.status = 'failed';
            metrics.endTime = Date.now();
            metrics.duration = duration;
            metrics.lastActivity = Date.now();
            metrics.failureCount++;
            metrics.errorRate = metrics.failureCount / metrics.taskCount * 100;
            this.taskStartTimes.delete(taskId);
            this.emit('task:failed', {
                agentId,
                taskId,
                error,
                duration
            });
            if (metrics.errorRate > this.config.errorRateThreshold) {
                this.createAlert('error_rate', 'critical', `Agent ${metrics.name} has high error rate: ${metrics.errorRate.toFixed(1)}%`);
            }
        }
    }
    async collectMetrics() {
        try {
            const cpuUsage = this.getCPUUsage();
            const memInfo = this.getMemoryInfo();
            const loadAvg = os.loadavg();
            const now = Date.now();
            const minuteAgo = now - 60000;
            this.taskCompletionTimes = this.taskCompletionTimes.filter((time)=>time > minuteAgo);
            const throughput = this.taskCompletionTimes.length;
            let totalTasks = 0;
            let completedTasks = 0;
            let failedTasks = 0;
            let activeAgents = 0;
            let totalDuration = 0;
            let durationCount = 0;
            for (const [agentId, metrics] of this.agentMetrics){
                if (metrics.status === 'running') {
                    activeAgents++;
                    const stallTime = now - metrics.lastActivity;
                    if (stallTime > this.config.stallTimeout) {
                        metrics.status = 'stalled';
                        this.createAlert('stalled_agent', 'warning', `Agent ${metrics.name} appears to be stalled (${Math.round(stallTime / 1000)}s inactive)`);
                    }
                }
                totalTasks += metrics.taskCount;
                completedTasks += metrics.successCount;
                failedTasks += metrics.failureCount;
                if (metrics.averageTaskDuration > 0) {
                    totalDuration += metrics.averageTaskDuration * metrics.successCount;
                    durationCount += metrics.successCount;
                }
            }
            const avgDuration = durationCount > 0 ? totalDuration / durationCount : 0;
            const pendingTasks = totalTasks - completedTasks - failedTasks;
            const systemMetrics = {
                timestamp: now,
                cpuUsage,
                memoryUsage: memInfo.usagePercent,
                totalMemory: memInfo.total,
                freeMemory: memInfo.free,
                loadAverage: loadAvg,
                activeAgents,
                totalTasks,
                completedTasks,
                failedTasks,
                pendingTasks,
                averageTaskDuration: avgDuration,
                throughput
            };
            this.systemMetrics.push(systemMetrics);
            if (this.config.enableAlerts) {
                this.checkThresholds(systemMetrics);
            }
            this.cleanOldMetrics();
            if (this.config.enableHistory) {
                await this.saveHistory(systemMetrics);
            }
            this.emit('metrics:updated', {
                system: systemMetrics,
                agents: Array.from(this.agentMetrics.values())
            });
        } catch (error) {
            this.logger.error('Error collecting metrics:', error);
        }
    }
    getCPUUsage() {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;
        cpus.forEach((cpu)=>{
            for(const type in cpu.times){
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        return 100 - Math.floor(totalIdle / totalTick * 100);
    }
    getMemoryInfo() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const usagePercent = used / total * 100;
        return {
            total,
            free,
            used,
            usagePercent
        };
    }
    checkThresholds(metrics) {
        if (metrics.cpuUsage > this.config.cpuThreshold) {
            this.createAlert('high_cpu', 'warning', `High CPU usage detected: ${metrics.cpuUsage}%`);
        }
        if (metrics.memoryUsage > this.config.memoryThreshold) {
            this.createAlert('high_memory', 'warning', `High memory usage detected: ${metrics.memoryUsage.toFixed(1)}%`);
        }
        if (metrics.activeAgents > 0 && metrics.throughput < this.config.throughputThreshold) {
            this.createAlert('low_throughput', 'warning', `Low throughput detected: ${metrics.throughput} tasks/min`);
        }
    }
    createAlert(type, level, message, details) {
        const alert = {
            id: `${type}_${Date.now()}`,
            timestamp: Date.now(),
            level,
            type,
            message,
            details
        };
        this.alerts.push(alert);
        this.emit('alert', alert);
        this.logger[level](message);
    }
    cleanOldMetrics() {
        const retentionTime = this.config.metricsRetention * 60 * 60 * 1000;
        const cutoff = Date.now() - retentionTime;
        this.systemMetrics = this.systemMetrics.filter((m)=>m.timestamp > cutoff);
        this.alerts = this.alerts.filter((a)=>a.timestamp > cutoff);
    }
    async saveHistory(metrics) {
        if (!this.config.historyPath) return;
        try {
            const date = new Date();
            const filename = `metrics_${date.toISOString().split('T')[0]}.jsonl`;
            const filepath = path.join(this.config.historyPath, filename);
            const line = JSON.stringify({
                ...metrics,
                agents: Array.from(this.agentMetrics.values())
            }) + '\n';
            await fs.appendFile(filepath, line);
        } catch (error) {
            this.logger.error('Error saving history:', error);
        }
    }
    getSystemMetrics() {
        return this.systemMetrics[this.systemMetrics.length - 1];
    }
    getAgentMetrics(agentId) {
        if (agentId) {
            return this.agentMetrics.get(agentId);
        }
        return Array.from(this.agentMetrics.values());
    }
    getAlerts(since) {
        if (since) {
            return this.alerts.filter((a)=>a.timestamp > since);
        }
        return this.alerts;
    }
    getHistoricalMetrics(hours = 1) {
        const since = Date.now() - hours * 60 * 60 * 1000;
        return this.systemMetrics.filter((m)=>m.timestamp > since);
    }
    getSummary() {
        const current = this.getSystemMetrics();
        const uptime = Date.now() - this.startTime;
        const totalAgents = this.agentMetrics.size;
        const activeAgents = current?.activeAgents || 0;
        const totalTasks = current?.totalTasks || 0;
        const completedTasks = current?.completedTasks || 0;
        const failedTasks = current?.failedTasks || 0;
        const successRate = totalTasks > 0 ? completedTasks / totalTasks * 100 : 0;
        const averageDuration = current?.averageTaskDuration || 0;
        const currentThroughput = current?.throughput || 0;
        const alerts = this.alerts.filter((a)=>a.timestamp > Date.now() - 3600000).length;
        return {
            uptime,
            totalAgents,
            activeAgents,
            totalTasks,
            completedTasks,
            failedTasks,
            successRate,
            averageDuration,
            currentThroughput,
            alerts
        };
    }
    async exportMetrics(filepath) {
        const data = {
            summary: this.getSummary(),
            systemMetrics: this.systemMetrics,
            agentMetrics: Array.from(this.agentMetrics.values()),
            alerts: this.alerts,
            exported: new Date().toISOString()
        };
        await fs.writeFile(filepath, JSON.stringify(data, null, 2));
        this.logger.info(`Exported metrics to ${filepath}`);
    }
}

//# sourceMappingURL=swarm-monitor.js.map