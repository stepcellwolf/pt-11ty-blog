/**
 * HTTP/2 Server Push Implementation
 * Predictively pushes related resources to reduce latency
 * Phase 2 Optimization
 */
/**
 * Server Push Manager
 * Manages HTTP/2 server push for predictive resource delivery
 */
export class ServerPushManager {
    config;
    pushRules;
    pushStats;
    activePushes = 0;
    constructor(config) {
        this.config = {
            enabled: config.enabled,
            maxConcurrentPushes: config.maxConcurrentPushes || 5,
            pushDelay: config.pushDelay || 0,
            intelligentPrediction: config.intelligentPrediction !== false
        };
        this.pushRules = new Map();
        this.pushStats = new Map();
    }
    /**
     * Register a push rule
     */
    registerRule(id, rule) {
        this.pushRules.set(id, rule);
    }
    /**
     * Unregister a push rule
     */
    unregisterRule(id) {
        this.pushRules.delete(id);
    }
    /**
     * Perform server push for a stream
     */
    async push(stream, path, headers) {
        if (!this.config.enabled)
            return;
        if (this.activePushes >= this.config.maxConcurrentPushes)
            return;
        // Find matching rules
        const matchingRules = this.findMatchingRules(path, headers);
        for (const rule of matchingRules) {
            for (const resource of rule.resources) {
                await this.pushResource(stream, resource);
            }
        }
    }
    /**
     * Push a single resource
     */
    async pushResource(stream, resource) {
        if (this.activePushes >= this.config.maxConcurrentPushes)
            return;
        return new Promise((resolve, reject) => {
            this.activePushes++;
            const pushHeaders = {
                ':path': resource.path,
                ...resource.headers
            };
            try {
                stream.pushStream(pushHeaders, (err, pushStream) => {
                    if (err) {
                        this.activePushes--;
                        reject(err);
                        return;
                    }
                    // Set priority if specified
                    if (resource.priority !== undefined) {
                        pushStream.priority({
                            weight: resource.priority,
                            exclusive: false
                        });
                    }
                    pushStream.on('finish', () => {
                        this.activePushes--;
                        this.recordPush(resource.path);
                    });
                    pushStream.on('error', () => {
                        this.activePushes--;
                    });
                    // Write the resource (in real implementation, fetch from cache/disk)
                    pushStream.respond({
                        ':status': 200,
                        'content-type': this.getContentType(resource.path)
                    });
                    pushStream.end();
                    resolve();
                });
            }
            catch (error) {
                this.activePushes--;
                reject(error);
            }
        });
    }
    /**
     * Find rules matching the current request
     */
    findMatchingRules(path, headers) {
        const matches = [];
        for (const [, rule] of this.pushRules) {
            // Check trigger match
            const triggerMatch = typeof rule.trigger === 'string'
                ? path.includes(rule.trigger)
                : rule.trigger.test(path);
            if (!triggerMatch)
                continue;
            // Check condition if present
            if (rule.condition && !rule.condition(headers))
                continue;
            matches.push(rule);
        }
        return matches;
    }
    /**
     * Record push statistics
     */
    recordPush(path) {
        const count = this.pushStats.get(path) || 0;
        this.pushStats.set(path, count + 1);
    }
    /**
     * Get content type for a path
     */
    getContentType(path) {
        const ext = path.split('.').pop()?.toLowerCase();
        const types = {
            'js': 'application/javascript',
            'css': 'text/css',
            'json': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'html': 'text/html',
            'txt': 'text/plain'
        };
        return types[ext || ''] || 'application/octet-stream';
    }
    /**
     * Get push statistics
     */
    getStats() {
        return {
            activePushes: this.activePushes,
            totalPushes: Array.from(this.pushStats.values()).reduce((a, b) => a + b, 0),
            pushCounts: new Map(this.pushStats)
        };
    }
    /**
     * Clear statistics
     */
    clearStats() {
        this.pushStats.clear();
    }
}
/**
 * Predefined push rules for common patterns
 */
export const CommonPushRules = {
    /**
     * Push API schema when main API endpoint is accessed
     */
    apiSchema: {
        trigger: /^\/api\/v1\//,
        resources: [
            { path: '/api/v1/schema.json', priority: 10 }
        ]
    },
    /**
     * Push authentication assets
     */
    authAssets: {
        trigger: '/auth',
        resources: [
            { path: '/auth/login.js', priority: 15 },
            { path: '/auth/styles.css', priority: 10 }
        ]
    }
};
/**
 * Intelligent push predictor
 * Learns from access patterns to predict what to push
 */
export class IntelligentPushPredictor {
    accessPatterns = new Map();
    confidence = new Map();
    /**
     * Record an access pattern
     */
    recordAccess(primary, secondary) {
        // Record that secondary was accessed after primary
        if (!this.accessPatterns.has(primary)) {
            this.accessPatterns.set(primary, new Set());
        }
        this.accessPatterns.get(primary).add(secondary);
        // Update confidence scores
        if (!this.confidence.has(primary)) {
            this.confidence.set(primary, new Map());
        }
        const scores = this.confidence.get(primary);
        scores.set(secondary, (scores.get(secondary) || 0) + 1);
    }
    /**
     * Predict resources to push based on confidence
     */
    predict(path, minConfidence = 0.7) {
        const patterns = this.accessPatterns.get(path);
        if (!patterns)
            return [];
        const scores = this.confidence.get(path);
        if (!scores)
            return [];
        const total = Array.from(scores.values()).reduce((a, b) => a + b, 0);
        const predictions = [];
        for (const [resource, count] of scores) {
            const confidence = count / total;
            if (confidence >= minConfidence) {
                predictions.push({
                    path: resource,
                    priority: Math.round(confidence * 20) // 0-20 priority based on confidence
                });
            }
        }
        return predictions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
    /**
     * Get statistics
     */
    getStats() {
        let totalConfidence = 0;
        let count = 0;
        for (const scores of this.confidence.values()) {
            const total = Array.from(scores.values()).reduce((a, b) => a + b, 0);
            for (const score of scores.values()) {
                totalConfidence += score / total;
                count++;
            }
        }
        return {
            totalPatterns: this.accessPatterns.size,
            averageConfidence: count > 0 ? totalConfidence / count : 0
        };
    }
}
