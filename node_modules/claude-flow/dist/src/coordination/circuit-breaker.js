export var CircuitState = /*#__PURE__*/ function(CircuitState) {
    CircuitState["CLOSED"] = "closed";
    CircuitState["OPEN"] = "open";
    CircuitState["HALF_OPEN"] = "half-open";
    return CircuitState;
}({});
export class CircuitBreaker {
    name;
    config;
    logger;
    eventBus;
    state = "closed";
    failures = 0;
    successes = 0;
    lastFailureTime;
    lastSuccessTime;
    nextAttempt;
    halfOpenRequests = 0;
    totalRequests = 0;
    rejectedRequests = 0;
    constructor(name, config, logger, eventBus){
        this.name = name;
        this.config = config;
        this.logger = logger;
        this.eventBus = eventBus;
    }
    async execute(fn) {
        this.totalRequests++;
        if (!this.canExecute()) {
            this.rejectedRequests++;
            const error = new Error(`Circuit breaker '${this.name}' is OPEN`);
            this.logStateChange('Request rejected');
            throw error;
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    canExecute() {
        switch(this.state){
            case "closed":
                return true;
            case "open":
                if (this.nextAttempt && new Date() >= this.nextAttempt) {
                    this.transitionTo("half-open");
                    return true;
                }
                return false;
            case "half-open":
                return this.halfOpenRequests < this.config.halfOpenLimit;
            default:
                return false;
        }
    }
    onSuccess() {
        this.lastSuccessTime = new Date();
        switch(this.state){
            case "closed":
                this.failures = 0;
                break;
            case "half-open":
                this.successes++;
                this.halfOpenRequests++;
                if (this.successes >= this.config.successThreshold) {
                    this.transitionTo("closed");
                }
                break;
            case "open":
                this.transitionTo("half-open");
                break;
        }
    }
    onFailure() {
        this.lastFailureTime = new Date();
        switch(this.state){
            case "closed":
                this.failures++;
                if (this.failures >= this.config.failureThreshold) {
                    this.transitionTo("open");
                }
                break;
            case "half-open":
                this.transitionTo("open");
                break;
            case "open":
                this.nextAttempt = new Date(Date.now() + this.config.timeout);
                break;
        }
    }
    transitionTo(newState) {
        const oldState = this.state;
        this.state = newState;
        this.logger.info(`Circuit breaker '${this.name}' state change`, {
            from: oldState,
            to: newState,
            failures: this.failures,
            successes: this.successes
        });
        switch(newState){
            case "closed":
                this.failures = 0;
                this.successes = 0;
                this.halfOpenRequests = 0;
                delete this.nextAttempt;
                break;
            case "open":
                this.successes = 0;
                this.halfOpenRequests = 0;
                this.nextAttempt = new Date(Date.now() + this.config.timeout);
                break;
            case "half-open":
                this.successes = 0;
                this.failures = 0;
                this.halfOpenRequests = 0;
                break;
        }
        if (this.eventBus) {
            this.eventBus.emit('circuitbreaker:state-change', {
                name: this.name,
                from: oldState,
                to: newState,
                metrics: this.getMetrics()
            });
        }
    }
    forceState(state) {
        this.logger.warn(`Forcing circuit breaker '${this.name}' to state`, {
            state
        });
        this.transitionTo(state);
    }
    getState() {
        return this.state;
    }
    getMetrics() {
        const metrics = {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            totalRequests: this.totalRequests,
            rejectedRequests: this.rejectedRequests,
            halfOpenRequests: this.halfOpenRequests
        };
        if (this.lastFailureTime !== undefined) {
            metrics.lastFailureTime = this.lastFailureTime;
        }
        if (this.lastSuccessTime !== undefined) {
            metrics.lastSuccessTime = this.lastSuccessTime;
        }
        return metrics;
    }
    reset() {
        this.logger.info(`Resetting circuit breaker '${this.name}'`);
        this.state = "closed";
        this.failures = 0;
        this.successes = 0;
        delete this.lastFailureTime;
        delete this.lastSuccessTime;
        delete this.nextAttempt;
        this.halfOpenRequests = 0;
        this.totalRequests = 0;
        this.rejectedRequests = 0;
    }
    logStateChange(message) {
        this.logger.debug(`Circuit breaker '${this.name}': ${message}`, {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            nextAttempt: this.nextAttempt
        });
    }
}
export class CircuitBreakerManager {
    defaultConfig;
    logger;
    eventBus;
    breakers = new Map();
    constructor(defaultConfig, logger, eventBus){
        this.defaultConfig = defaultConfig;
        this.logger = logger;
        this.eventBus = eventBus;
    }
    getBreaker(name, config) {
        let breaker = this.breakers.get(name);
        if (!breaker) {
            const finalConfig = {
                ...this.defaultConfig,
                ...config
            };
            breaker = new CircuitBreaker(name, finalConfig, this.logger, this.eventBus);
            this.breakers.set(name, breaker);
        }
        return breaker;
    }
    async execute(name, fn, config) {
        const breaker = this.getBreaker(name, config);
        return breaker.execute(fn);
    }
    getAllBreakers() {
        return new Map(this.breakers);
    }
    getAllMetrics() {
        const metrics = {};
        for (const [name, breaker] of this.breakers){
            metrics[name] = breaker.getMetrics();
        }
        return metrics;
    }
    resetBreaker(name) {
        const breaker = this.breakers.get(name);
        if (breaker) {
            breaker.reset();
        }
    }
    resetAll() {
        for (const breaker of this.breakers.values()){
            breaker.reset();
        }
    }
    forceState(name, state) {
        const breaker = this.breakers.get(name);
        if (breaker) {
            breaker.forceState(state);
        }
    }
}

//# sourceMappingURL=circuit-breaker.js.map