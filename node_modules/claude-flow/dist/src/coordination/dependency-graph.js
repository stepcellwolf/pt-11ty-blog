import { TaskDependencyError } from '../utils/errors.js';
export class DependencyGraph {
    logger;
    nodes = new Map();
    completedTasks = new Set();
    constructor(logger){
        this.logger = logger;
    }
    addTask(task) {
        if (this.nodes.has(task.id)) {
            this.logger.warn('Task already exists in dependency graph', {
                taskId: task.id
            });
            return;
        }
        const node = {
            taskId: task.id,
            dependencies: new Set(task.dependencies),
            dependents: new Set(),
            status: 'pending'
        };
        for (const depId of task.dependencies){
            if (!this.nodes.has(depId) && !this.completedTasks.has(depId)) {
                throw new TaskDependencyError(task.id, [
                    depId
                ]);
            }
        }
        this.nodes.set(task.id, node);
        for (const depId of task.dependencies){
            const depNode = this.nodes.get(depId);
            if (depNode) {
                depNode.dependents.add(task.id);
            }
        }
        if (this.isTaskReady(task.id)) {
            node.status = 'ready';
        }
    }
    removeTask(taskId) {
        const node = this.nodes.get(taskId);
        if (!node) {
            return;
        }
        for (const depId of node.dependencies){
            const depNode = this.nodes.get(depId);
            if (depNode) {
                depNode.dependents.delete(taskId);
            }
        }
        for (const depId of node.dependents){
            const depNode = this.nodes.get(depId);
            if (depNode) {
                depNode.dependencies.delete(taskId);
                if (this.isTaskReady(depId)) {
                    depNode.status = 'ready';
                }
            }
        }
        this.nodes.delete(taskId);
    }
    markCompleted(taskId) {
        const node = this.nodes.get(taskId);
        if (!node) {
            this.logger.warn('Task not found in dependency graph', {
                taskId
            });
            return [];
        }
        node.status = 'completed';
        this.completedTasks.add(taskId);
        const readyTasks = [];
        for (const dependentId of node.dependents){
            const dependent = this.nodes.get(dependentId);
            if (dependent && dependent.status === 'pending' && this.isTaskReady(dependentId)) {
                dependent.status = 'ready';
                readyTasks.push(dependentId);
            }
        }
        this.removeTask(taskId);
        return readyTasks;
    }
    markFailed(taskId) {
        const node = this.nodes.get(taskId);
        if (!node) {
            return [];
        }
        node.status = 'failed';
        const toCancelIds = this.getAllDependents(taskId);
        for (const depId of toCancelIds){
            const depNode = this.nodes.get(depId);
            if (depNode) {
                depNode.status = 'failed';
            }
        }
        return toCancelIds;
    }
    isTaskReady(taskId) {
        const node = this.nodes.get(taskId);
        if (!node) {
            return false;
        }
        for (const depId of node.dependencies){
            if (!this.completedTasks.has(depId)) {
                return false;
            }
        }
        return true;
    }
    getReadyTasks() {
        const ready = [];
        for (const [taskId, node] of this.nodes){
            if (node.status === 'ready' || node.status === 'pending' && this.isTaskReady(taskId)) {
                ready.push(taskId);
                node.status = 'ready';
            }
        }
        return ready;
    }
    getAllDependents(taskId) {
        const visited = new Set();
        const dependents = [];
        const visit = (id)=>{
            if (visited.has(id)) {
                return;
            }
            visited.add(id);
            const node = this.nodes.get(id);
            if (!node) {
                return;
            }
            for (const depId of node.dependents){
                if (!visited.has(depId)) {
                    dependents.push(depId);
                    visit(depId);
                }
            }
        };
        visit(taskId);
        return dependents;
    }
    detectCycles() {
        const cycles = [];
        const visited = new Set();
        const recursionStack = new Set();
        const currentPath = [];
        const hasCycle = (taskId)=>{
            visited.add(taskId);
            recursionStack.add(taskId);
            currentPath.push(taskId);
            const node = this.nodes.get(taskId);
            if (!node) {
                currentPath.pop();
                recursionStack.delete(taskId);
                return false;
            }
            for (const depId of node.dependencies){
                if (!visited.has(depId)) {
                    if (hasCycle(depId)) {
                        return true;
                    }
                } else if (recursionStack.has(depId)) {
                    const cycleStart = currentPath.indexOf(depId);
                    const cycle = currentPath.slice(cycleStart);
                    cycle.push(depId);
                    cycles.push(cycle);
                    return true;
                }
            }
            currentPath.pop();
            recursionStack.delete(taskId);
            return false;
        };
        for (const taskId of this.nodes.keys()){
            if (!visited.has(taskId)) {
                hasCycle(taskId);
            }
        }
        return cycles;
    }
    topologicalSort() {
        const cycles = this.detectCycles();
        if (cycles.length > 0) {
            this.logger.error('Cannot perform topological sort due to cycles', {
                cycles
            });
            return null;
        }
        const sorted = [];
        const visited = new Set();
        const visit = (taskId)=>{
            if (visited.has(taskId)) {
                return;
            }
            visited.add(taskId);
            const node = this.nodes.get(taskId);
            if (!node) {
                return;
            }
            for (const depId of node.dependencies){
                if (!visited.has(depId)) {
                    visit(depId);
                }
            }
            sorted.push(taskId);
        };
        for (const taskId of this.nodes.keys()){
            if (!visited.has(taskId)) {
                visit(taskId);
            }
        }
        return sorted;
    }
    findCriticalPath() {
        const paths = [];
        const sources = Array.from(this.nodes.entries()).filter(([_, node])=>node.dependencies.size === 0).map(([id])=>id);
        const sinks = Array.from(this.nodes.entries()).filter(([_, node])=>node.dependents.size === 0).map(([id])=>id);
        for (const source of sources){
            for (const sink of sinks){
                const path = this.findPath(source, sink);
                if (path) {
                    paths.push({
                        from: source,
                        to: sink,
                        path
                    });
                }
            }
        }
        if (paths.length === 0) {
            return null;
        }
        return paths.reduce((longest, current)=>current.path.length > longest.path.length ? current : longest);
    }
    findPath(from, to) {
        if (from === to) {
            return [
                from
            ];
        }
        const visited = new Set();
        const queue = [
            {
                taskId: from,
                path: [
                    from
                ]
            }
        ];
        while(queue.length > 0){
            const { taskId, path } = queue.shift();
            if (visited.has(taskId)) {
                continue;
            }
            visited.add(taskId);
            const node = this.nodes.get(taskId);
            if (!node) {
                continue;
            }
            for (const depId of node.dependents){
                if (depId === to) {
                    return [
                        ...path,
                        to
                    ];
                }
                if (!visited.has(depId)) {
                    queue.push({
                        taskId: depId,
                        path: [
                            ...path,
                            depId
                        ]
                    });
                }
            }
        }
        return null;
    }
    getStats() {
        const stats = {
            totalTasks: this.nodes.size,
            completedTasks: this.completedTasks.size,
            readyTasks: 0,
            pendingTasks: 0,
            runningTasks: 0,
            failedTasks: 0,
            avgDependencies: 0,
            maxDependencies: 0,
            cycles: this.detectCycles()
        };
        let totalDeps = 0;
        for (const node of this.nodes.values()){
            totalDeps += node.dependencies.size;
            stats.maxDependencies = Math.max(stats.maxDependencies, node.dependencies.size);
            switch(node.status){
                case 'ready':
                    stats.readyTasks++;
                    break;
                case 'pending':
                    stats.pendingTasks++;
                    break;
                case 'running':
                    stats.runningTasks++;
                    break;
                case 'failed':
                    stats.failedTasks++;
                    break;
            }
        }
        stats.avgDependencies = this.nodes.size > 0 ? totalDeps / this.nodes.size : 0;
        return stats;
    }
    toDot() {
        let dot = 'digraph TaskDependencies {\n';
        dot += '  rankdir=LR;\n';
        dot += '  node [shape=box];\n\n';
        for (const [taskId, node] of this.nodes){
            let color = 'white';
            switch(node.status){
                case 'ready':
                    color = 'lightgreen';
                    break;
                case 'running':
                    color = 'yellow';
                    break;
                case 'completed':
                    color = 'green';
                    break;
                case 'failed':
                    color = 'red';
                    break;
            }
            dot += `  "${taskId}" [style=filled, fillcolor=${color}];\n`;
        }
        dot += '\n';
        for (const [taskId, node] of this.nodes){
            for (const depId of node.dependencies){
                dot += `  "${depId}" -> "${taskId}";\n`;
            }
        }
        dot += '}\n';
        return dot;
    }
}

//# sourceMappingURL=dependency-graph.js.map