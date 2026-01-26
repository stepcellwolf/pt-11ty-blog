/**
 * Lazy Authentication with Session Caching
 * Reduces auth overhead by 5-10% through session caching and lazy validation
 * Phase 3 Optimization
 */
/**
 * Lazy Authentication Manager
 * Caches validated sessions to avoid repeated authentication overhead
 */
export class LazyAuthManager {
    config;
    sessions = new Map();
    stats;
    cleanupTimer;
    validationQueue = new Set();
    constructor(config) {
        this.config = {
            enabled: config.enabled,
            ttl: config.ttl || 3600000, // 1 hour default
            maxSessions: config.maxSessions || 1000,
            checkInterval: config.checkInterval || 60000 // 1 minute
        };
        this.stats = {
            totalValidations: 0,
            cacheHits: 0,
            cacheMisses: 0,
            sessionsActive: 0,
            sessionsCleaned: 0,
            avgValidationTime: 0
        };
        if (this.config.enabled) {
            this.startCleanupTimer();
        }
    }
    /**
     * Authenticate a token (lazy validation)
     */
    async authenticate(token, validateFn) {
        if (!this.config.enabled) {
            // No caching, always validate
            const userId = await validateFn(token);
            return this.createSession(token, userId, true);
        }
        // Check cache first
        const cached = this.sessions.get(token);
        if (cached && !this.isExpired(cached)) {
            this.stats.cacheHits++;
            cached.lastAccessedAt = Date.now();
            return cached;
        }
        this.stats.cacheMisses++;
        // Lazy validation: check if already being validated
        if (this.validationQueue.has(token)) {
            // Wait for ongoing validation
            return this.waitForValidation(token);
        }
        // Perform validation
        return this.validateAndCache(token, validateFn);
    }
    /**
     * Validate token and cache the session
     */
    async validateAndCache(token, validateFn) {
        this.validationQueue.add(token);
        try {
            const startTime = Date.now();
            const userId = await validateFn(token);
            const validationTime = Date.now() - startTime;
            // Update average validation time
            this.updateAvgValidationTime(validationTime);
            this.stats.totalValidations++;
            // Create and cache session
            const session = this.createSession(token, userId, true);
            this.cacheSession(session);
            return session;
        }
        catch (error) {
            return null;
        }
        finally {
            this.validationQueue.delete(token);
        }
    }
    /**
     * Wait for ongoing validation
     */
    async waitForValidation(token) {
        // Poll for validation completion (max 5 seconds)
        const maxAttempts = 50;
        let attempts = 0;
        while (this.validationQueue.has(token) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        // Check cache after validation
        const session = this.sessions.get(token);
        return session && !this.isExpired(session) ? session : null;
    }
    /**
     * Create a session object
     */
    createSession(token, userId, validated) {
        const now = Date.now();
        return {
            token,
            userId,
            validated,
            createdAt: now,
            lastAccessedAt: now,
            expiresAt: now + this.config.ttl
        };
    }
    /**
     * Cache a session
     */
    cacheSession(session) {
        // Check max sessions limit
        if (this.sessions.size >= this.config.maxSessions) {
            this.evictOldest();
        }
        this.sessions.set(session.token, session);
        this.stats.sessionsActive = this.sessions.size;
    }
    /**
     * Check if session is expired
     */
    isExpired(session) {
        return Date.now() > session.expiresAt;
    }
    /**
     * Evict oldest session (LRU)
     */
    evictOldest() {
        let oldest = null;
        let oldestToken = null;
        for (const [token, session] of this.sessions) {
            if (!oldest || session.lastAccessedAt < oldest.lastAccessedAt) {
                oldest = session;
                oldestToken = token;
            }
        }
        if (oldestToken) {
            this.sessions.delete(oldestToken);
            this.stats.sessionsCleaned++;
        }
    }
    /**
     * Update average validation time
     */
    updateAvgValidationTime(newTime) {
        const total = this.stats.totalValidations;
        const currentAvg = this.stats.avgValidationTime;
        this.stats.avgValidationTime = (currentAvg * total + newTime) / (total + 1);
    }
    /**
     * Start cleanup timer for expired sessions
     */
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.checkInterval);
    }
    /**
     * Clean up expired sessions
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        for (const [token, session] of this.sessions) {
            if (now > session.expiresAt) {
                this.sessions.delete(token);
                cleaned++;
            }
        }
        this.stats.sessionsCleaned += cleaned;
        this.stats.sessionsActive = this.sessions.size;
    }
    /**
     * Invalidate a session
     */
    invalidate(token) {
        return this.sessions.delete(token);
    }
    /**
     * Invalidate all sessions for a user
     */
    invalidateUser(userId) {
        let count = 0;
        for (const [token, session] of this.sessions) {
            if (session.userId === userId) {
                this.sessions.delete(token);
                count++;
            }
        }
        return count;
    }
    /**
     * Get session if exists and valid
     */
    getSession(token) {
        const session = this.sessions.get(token);
        if (!session || this.isExpired(session)) {
            return null;
        }
        session.lastAccessedAt = Date.now();
        return session;
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Get cache hit rate
     */
    getCacheHitRate() {
        const total = this.stats.cacheHits + this.stats.cacheMisses;
        return total > 0 ? (this.stats.cacheHits / total) * 100 : 0;
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalValidations: 0,
            cacheHits: 0,
            cacheMisses: 0,
            sessionsActive: this.sessions.size,
            sessionsCleaned: 0,
            avgValidationTime: 0
        };
    }
    /**
     * Clear all sessions
     */
    clear() {
        this.sessions.clear();
        this.stats.sessionsActive = 0;
    }
    /**
     * Destroy manager and cleanup
     */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.clear();
    }
}
/**
 * Token-based authentication helper
 */
export class TokenAuth {
    authManager;
    validateFn;
    constructor(authManager, validateFn) {
        this.authManager = authManager;
        this.validateFn = validateFn;
    }
    /**
     * Authenticate a request
     */
    async authenticate(authHeader) {
        // Extract token from header
        const token = this.extractToken(authHeader);
        if (!token) {
            return null;
        }
        return this.authManager.authenticate(token, this.validateFn);
    }
    /**
     * Extract token from Authorization header
     */
    extractToken(authHeader) {
        if (!authHeader) {
            return null;
        }
        // Support "Bearer <token>" and raw token
        if (authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        return authHeader;
    }
    /**
     * Invalidate token
     */
    invalidate(token) {
        return this.authManager.invalidate(token);
    }
    /**
     * Get statistics
     */
    getStats() {
        return this.authManager.getStats();
    }
}
/**
 * Calculate auth overhead reduction
 */
export function calculateAuthSavings(stats) {
    const hitRate = stats.cacheHits / (stats.cacheHits + stats.cacheMisses);
    const savingsPercentage = hitRate * 100;
    const avgSavedTime = stats.avgValidationTime * hitRate;
    const totalSavedTime = stats.avgValidationTime * stats.cacheHits;
    return {
        savingsPercentage,
        avgSavedTime,
        totalSavedTime
    };
}
