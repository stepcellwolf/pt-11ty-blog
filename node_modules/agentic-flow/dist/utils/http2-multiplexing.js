/**
 * HTTP/2 Multiplexing Optimization
 * Stream prioritization and flow control for concurrent request optimization
 * Phase 2 Optimization
 */
/**
 * HTTP/2 Multiplexing Manager
 * Manages stream prioritization and concurrent request handling
 */
export class HTTP2MultiplexingManager {
    config;
    activeStreams = new Map();
    priorityQueues = new Map();
    stats;
    constructor(config) {
        this.config = {
            enabled: config.enabled,
            maxConcurrentStreams: config.maxConcurrentStreams || 100,
            defaultPriority: config.defaultPriority || 16,
            enableFlowControl: config.enableFlowControl !== false,
            initialWindowSize: config.initialWindowSize || 65535
        };
        this.stats = {
            totalStreams: 0,
            activeStreams: 0,
            completedStreams: 0,
            averageDuration: 0,
            priorityChanges: 0
        };
        this.initializePriorityQueues();
    }
    /**
     * Initialize priority queues (1-256)
     */
    initializePriorityQueues() {
        for (let i = 1; i <= 256; i++) {
            this.priorityQueues.set(i, new Set());
        }
    }
    /**
     * Register a new stream
     */
    registerStream(stream, priority) {
        if (!this.config.enabled)
            return;
        const streamId = stream.id || 0;
        const streamPriority = priority?.weight || this.config.defaultPriority;
        const info = {
            stream,
            priority: streamPriority,
            bytesReceived: 0,
            bytesSent: 0,
            startTime: Date.now(),
            state: 'open'
        };
        this.activeStreams.set(streamId, info);
        this.priorityQueues.get(streamPriority)?.add(streamId);
        this.stats.totalStreams++;
        this.stats.activeStreams++;
        // Set stream priority
        if (priority) {
            this.setPriority(stream, priority);
        }
        // Setup event handlers
        this.setupStreamHandlers(stream, streamId);
    }
    /**
     * Set stream priority
     */
    setPriority(stream, priority) {
        try {
            stream.priority(priority);
            const streamId = stream.id || 0;
            const info = this.activeStreams.get(streamId);
            if (info) {
                // Move to new priority queue
                const oldPriority = info.priority;
                const newPriority = priority.weight;
                this.priorityQueues.get(oldPriority)?.delete(streamId);
                info.priority = newPriority;
                this.priorityQueues.get(newPriority)?.add(streamId);
                this.stats.priorityChanges++;
            }
        }
        catch (error) {
            // Stream may be closed
        }
    }
    /**
     * Adjust stream priority based on load
     */
    adjustPriority(streamId, adjustment) {
        const info = this.activeStreams.get(streamId);
        if (!info)
            return;
        const newPriority = Math.max(1, Math.min(256, info.priority + adjustment));
        this.setPriority(info.stream, {
            weight: newPriority,
            exclusive: false
        });
    }
    /**
     * Get next stream to process based on priority
     */
    getNextStream() {
        // Process highest priority streams first (256 is highest)
        for (let priority = 256; priority >= 1; priority--) {
            const queue = this.priorityQueues.get(priority);
            if (queue && queue.size > 0) {
                const streamId = queue.values().next().value;
                if (streamId !== undefined) {
                    const info = this.activeStreams.get(streamId);
                    if (info && info.state === 'open') {
                        return info.stream;
                    }
                }
            }
        }
        return null;
    }
    /**
     * Setup stream event handlers
     */
    setupStreamHandlers(stream, streamId) {
        stream.on('data', (chunk) => {
            const info = this.activeStreams.get(streamId);
            if (info) {
                info.bytesReceived += chunk.length;
            }
        });
        stream.on('end', () => {
            this.updateStreamState(streamId, 'half-closed');
        });
        stream.on('close', () => {
            this.handleStreamClose(streamId);
        });
        stream.on('error', () => {
            this.handleStreamClose(streamId);
        });
    }
    /**
     * Update stream state
     */
    updateStreamState(streamId, state) {
        const info = this.activeStreams.get(streamId);
        if (info) {
            info.state = state;
        }
    }
    /**
     * Handle stream closure
     */
    handleStreamClose(streamId) {
        const info = this.activeStreams.get(streamId);
        if (!info)
            return;
        // Remove from priority queue
        this.priorityQueues.get(info.priority)?.delete(streamId);
        // Update statistics
        const duration = Date.now() - info.startTime;
        this.updateStats(duration);
        // Remove from active streams
        this.activeStreams.delete(streamId);
        this.stats.activeStreams--;
        this.stats.completedStreams++;
    }
    /**
     * Update statistics
     */
    updateStats(duration) {
        const currentAvg = this.stats.averageDuration;
        const total = this.stats.completedStreams;
        this.stats.averageDuration = (currentAvg * (total - 1) + duration) / total;
    }
    /**
     * Get stream statistics
     */
    getStreamStats(streamId) {
        const info = this.activeStreams.get(streamId);
        if (!info)
            return null;
        return {
            streamId,
            priority: info.priority,
            bytesReceived: info.bytesReceived,
            bytesSent: info.bytesSent,
            duration: Date.now() - info.startTime,
            state: info.state
        };
    }
    /**
     * Get all statistics
     */
    getStats() {
        const priorityDistribution = new Map();
        for (const [priority, queue] of this.priorityQueues) {
            if (queue.size > 0) {
                priorityDistribution.set(priority, queue.size);
            }
        }
        return {
            ...this.stats,
            priorityDistribution
        };
    }
    /**
     * Check if can accept more streams
     */
    canAcceptStream() {
        return this.stats.activeStreams < this.config.maxConcurrentStreams;
    }
    /**
     * Get load percentage
     */
    getLoad() {
        return (this.stats.activeStreams / this.config.maxConcurrentStreams) * 100;
    }
}
/**
 * Flow Control Manager
 * Manages HTTP/2 flow control for optimal throughput
 */
export class FlowControlManager {
    windowSizes = new Map();
    config;
    constructor(config) {
        this.config = {
            initialWindowSize: config?.initialWindowSize || 65535,
            maxWindowSize: config?.maxWindowSize || 16777215, // 16MB
            minWindowSize: config?.minWindowSize || 16384 // 16KB
        };
    }
    /**
     * Initialize window size for a stream
     */
    initializeWindow(streamId) {
        this.windowSizes.set(streamId, this.config.initialWindowSize);
    }
    /**
     * Update window size
     */
    updateWindow(streamId, delta) {
        const current = this.windowSizes.get(streamId) || this.config.initialWindowSize;
        const newSize = Math.max(this.config.minWindowSize, Math.min(this.config.maxWindowSize, current + delta));
        this.windowSizes.set(streamId, newSize);
        return newSize;
    }
    /**
     * Get current window size
     */
    getWindowSize(streamId) {
        return this.windowSizes.get(streamId) || this.config.initialWindowSize;
    }
    /**
     * Calculate optimal window size based on throughput
     */
    calculateOptimalWindow(throughputBps, rttMs) {
        // Bandwidth-Delay Product
        const bdp = (throughputBps / 8) * (rttMs / 1000);
        return Math.max(this.config.minWindowSize, Math.min(this.config.maxWindowSize, Math.ceil(bdp * 2)));
    }
    /**
     * Clean up closed stream
     */
    cleanup(streamId) {
        this.windowSizes.delete(streamId);
    }
}
/**
 * Priority scheduler for optimal stream processing
 */
export class PriorityScheduler {
    queues = new Map();
    /**
     * Add stream to priority queue
     */
    enqueue(streamId, priority) {
        if (!this.queues.has(priority)) {
            this.queues.set(priority, []);
        }
        this.queues.get(priority).push(streamId);
    }
    /**
     * Get next stream to process
     */
    dequeue() {
        // Process highest priority first
        for (let priority = 256; priority >= 1; priority--) {
            const queue = this.queues.get(priority);
            if (queue && queue.length > 0) {
                return queue.shift();
            }
        }
        return null;
    }
    /**
     * Remove stream from all queues
     */
    remove(streamId) {
        for (const queue of this.queues.values()) {
            const index = queue.indexOf(streamId);
            if (index !== -1) {
                queue.splice(index, 1);
            }
        }
    }
    /**
     * Get queue sizes
     */
    getStats() {
        const stats = new Map();
        for (const [priority, queue] of this.queues) {
            if (queue.length > 0) {
                stats.set(priority, queue.length);
            }
        }
        return stats;
    }
}
