import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Logger } from '../core/logger.js';
import { generateId } from '../utils/helpers.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
export class BackgroundExecutor extends EventEmitter {
    logger;
    config;
    tasks;
    processes;
    queue;
    isRunning = false;
    checkTimer;
    cleanupTimer;
    constructor(config = {}){
        super();
        this.logger = new Logger('BackgroundExecutor');
        this.config = {
            maxConcurrentTasks: 5,
            defaultTimeout: 300000,
            logPath: './background-tasks',
            enablePersistence: true,
            checkInterval: 1000,
            cleanupInterval: 60000,
            maxRetries: 3,
            ...config
        };
        this.tasks = new Map();
        this.processes = new Map();
        this.queue = [];
    }
    async start() {
        if (this.isRunning) return;
        this.logger.info('Starting background executor...');
        this.isRunning = true;
        if (this.config.enablePersistence) {
            await fs.mkdir(this.config.logPath, {
                recursive: true
            });
        }
        this.checkTimer = setInterval(()=>{
            this.processQueue();
            this.checkRunningTasks();
        }, this.config.checkInterval);
        this.cleanupTimer = setInterval(()=>{
            this.cleanupCompletedTasks();
        }, this.config.cleanupInterval);
        this.emit('executor:started');
    }
    async stop() {
        if (!this.isRunning) return;
        this.logger.info('Stopping background executor...');
        this.isRunning = false;
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = undefined;
        }
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
        for (const [taskId, process] of this.processes){
            this.logger.warn(`Killing process for task ${taskId}`);
            process.kill('SIGTERM');
        }
        this.emit('executor:stopped');
    }
    async submitTask(type, command, args = [], options = {}) {
        const taskId = generateId('bgtask');
        const task = {
            id: taskId,
            type,
            command,
            args,
            options: {
                timeout: this.config.defaultTimeout,
                retries: this.config.maxRetries,
                ...options
            },
            status: 'pending',
            retryCount: 0
        };
        this.tasks.set(taskId, task);
        this.queue.push(taskId);
        if (this.config.enablePersistence) {
            await this.saveTaskState(task);
        }
        this.logger.info(`Submitted background task: ${taskId} - ${command}`);
        this.emit('task:submitted', task);
        this.processQueue();
        return taskId;
    }
    async submitClaudeTask(prompt, tools = [], options = {}) {
        const args = [
            '-p',
            prompt
        ];
        if (tools.length > 0) {
            args.push('--allowedTools', tools.join(','));
        }
        if (options.model) {
            args.push('--model', options.model);
        }
        if (options.maxTokens) {
            args.push('--max-tokens', options.maxTokens.toString());
        }
        args.push('--dangerously-skip-permissions');
        return this.submitTask('claude-spawn', 'claude', args, {
            ...options,
            detached: true
        });
    }
    async processQueue() {
        if (!this.isRunning) return;
        const runningTasks = Array.from(this.tasks.values()).filter((t)=>t.status === 'running').length;
        const availableSlots = this.config.maxConcurrentTasks - runningTasks;
        for(let i = 0; i < availableSlots && this.queue.length > 0; i++){
            const taskId = this.queue.shift();
            if (!taskId) continue;
            const task = this.tasks.get(taskId);
            if (!task || task.status !== 'pending') continue;
            await this.executeTask(task);
        }
    }
    async executeTask(task) {
        try {
            task.status = 'running';
            task.startTime = new Date();
            this.logger.info(`Executing task ${task.id}: ${task.command} ${task.args.join(' ')}`);
            const logDir = path.join(this.config.logPath, task.id);
            if (this.config.enablePersistence) {
                await fs.mkdir(logDir, {
                    recursive: true
                });
            }
            const process = spawn(task.command, task.args, {
                cwd: task.options?.cwd,
                env: {
                    ...process.env,
                    ...task.options?.env
                },
                detached: task.options?.detached,
                stdio: [
                    'ignore',
                    'pipe',
                    'pipe'
                ]
            });
            task.pid = process.pid;
            this.processes.set(task.id, process);
            let stdout = '';
            let stderr = '';
            process.stdout?.on('data', (data)=>{
                stdout += data.toString();
                this.emit('task:output', {
                    taskId: task.id,
                    data: data.toString()
                });
            });
            process.stderr?.on('data', (data)=>{
                stderr += data.toString();
                this.emit('task:error', {
                    taskId: task.id,
                    data: data.toString()
                });
            });
            process.on('close', async (code)=>{
                task.endTime = new Date();
                task.output = stdout;
                task.error = stderr;
                if (code === 0) {
                    task.status = 'completed';
                    this.logger.info(`Task ${task.id} completed successfully`);
                    this.emit('task:completed', task);
                } else {
                    task.status = 'failed';
                    this.logger.error(`Task ${task.id} failed with code ${code}`);
                    if (task.retryCount < (task.options?.retries || 0)) {
                        task.retryCount++;
                        task.status = 'pending';
                        this.queue.push(task.id);
                        this.logger.info(`Retrying task ${task.id} (${task.retryCount}/${task.options?.retries})`);
                        this.emit('task:retry', task);
                    } else {
                        this.emit('task:failed', task);
                    }
                }
                this.processes.delete(task.id);
                if (this.config.enablePersistence) {
                    await this.saveTaskOutput(task);
                }
            });
            if (task.options?.timeout) {
                setTimeout(()=>{
                    if (this.processes.has(task.id)) {
                        this.logger.warn(`Task ${task.id} timed out after ${task.options?.timeout}ms`);
                        process.kill('SIGTERM');
                    }
                }, task.options.timeout);
            }
            if (task.options?.detached) {
                process.unref();
            }
            this.emit('task:started', task);
            if (this.config.enablePersistence) {
                await this.saveTaskState(task);
            }
        } catch (error) {
            task.status = 'failed';
            task.error = String(error);
            task.endTime = new Date();
            this.logger.error(`Failed to execute task ${task.id}:`, error);
            this.emit('task:failed', task);
            if (this.config.enablePersistence) {
                await this.saveTaskState(task);
            }
        }
    }
    checkRunningTasks() {
        const now = Date.now();
        for (const [taskId, task] of this.tasks){
            if (task.status !== 'running' || !task.startTime) continue;
            const runtime = now - task.startTime.getTime();
            const timeout = task.options?.timeout || this.config.defaultTimeout;
            if (runtime > timeout) {
                const process = this.processes.get(taskId);
                if (process) {
                    this.logger.warn(`Killing timed out task ${taskId}`);
                    process.kill('SIGTERM');
                    setTimeout(()=>{
                        if (this.processes.has(taskId)) {
                            process.kill('SIGKILL');
                        }
                    }, 5000);
                }
            }
        }
    }
    cleanupCompletedTasks() {
        const cutoffTime = Date.now() - 3600000;
        for (const [taskId, task] of this.tasks){
            if (task.status === 'completed' || task.status === 'failed') {
                if (task.endTime && task.endTime.getTime() < cutoffTime) {
                    this.tasks.delete(taskId);
                    this.logger.debug(`Cleaned up old task: ${taskId}`);
                }
            }
        }
    }
    async saveTaskState(task) {
        if (!this.config.enablePersistence) return;
        try {
            const taskFile = path.join(this.config.logPath, task.id, 'task.json');
            await fs.writeFile(taskFile, JSON.stringify(task, null, 2));
        } catch (error) {
            this.logger.error(`Failed to save task state for ${task.id}:`, error);
        }
    }
    async saveTaskOutput(task) {
        if (!this.config.enablePersistence) return;
        try {
            const logDir = path.join(this.config.logPath, task.id);
            if (task.output) {
                await fs.writeFile(path.join(logDir, 'stdout.log'), task.output);
            }
            if (task.error) {
                await fs.writeFile(path.join(logDir, 'stderr.log'), task.error);
            }
            await this.saveTaskState(task);
        } catch (error) {
            this.logger.error(`Failed to save task output for ${task.id}:`, error);
        }
    }
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    getTasks(status) {
        const tasks = Array.from(this.tasks.values());
        return status ? tasks.filter((t)=>t.status === status) : tasks;
    }
    async waitForTask(taskId, timeout) {
        return new Promise((resolve, reject)=>{
            const task = this.tasks.get(taskId);
            if (!task) {
                reject(new Error('Task not found'));
                return;
            }
            if (task.status === 'completed' || task.status === 'failed') {
                resolve(task);
                return;
            }
            const timeoutHandle = timeout ? setTimeout(()=>{
                reject(new Error('Wait timeout'));
            }, timeout) : undefined;
            const checkTask = ()=>{
                const currentTask = this.tasks.get(taskId);
                if (!currentTask) {
                    if (timeoutHandle) clearTimeout(timeoutHandle);
                    reject(new Error('Task disappeared'));
                    return;
                }
                if (currentTask.status === 'completed' || currentTask.status === 'failed') {
                    if (timeoutHandle) clearTimeout(timeoutHandle);
                    resolve(currentTask);
                } else {
                    setTimeout(checkTask, 100);
                }
            };
            checkTask();
        });
    }
    async killTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error('Task not found');
        }
        const process = this.processes.get(taskId);
        if (process) {
            this.logger.info(`Killing task ${taskId}`);
            process.kill('SIGTERM');
            setTimeout(()=>{
                if (this.processes.has(taskId)) {
                    process.kill('SIGKILL');
                }
            }, 5000);
        }
        task.status = 'failed';
        task.error = 'Task killed by user';
        task.endTime = new Date();
        this.emit('task:killed', task);
    }
    getStatus() {
        const tasks = Array.from(this.tasks.values());
        return {
            running: tasks.filter((t)=>t.status === 'running').length,
            pending: tasks.filter((t)=>t.status === 'pending').length,
            completed: tasks.filter((t)=>t.status === 'completed').length,
            failed: tasks.filter((t)=>t.status === 'failed').length,
            queueLength: this.queue.length
        };
    }
}

//# sourceMappingURL=background-executor.js.map