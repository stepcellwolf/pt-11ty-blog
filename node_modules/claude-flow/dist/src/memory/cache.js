export class MemoryCache {
    maxSize;
    logger;
    cache = new Map();
    currentSize = 0;
    hits = 0;
    misses = 0;
    constructor(maxSize, logger){
        this.maxSize = maxSize;
        this.logger = logger;
    }
    get(id) {
        const entry = this.cache.get(id);
        if (!entry) {
            this.misses++;
            return undefined;
        }
        entry.lastAccessed = Date.now();
        this.hits++;
        return entry.data;
    }
    set(id, data, dirty = true) {
        const size = this.calculateSize(data);
        if (this.currentSize + size > this.maxSize) {
            this.evict(size);
        }
        const entry = {
            data,
            size,
            lastAccessed: Date.now(),
            dirty
        };
        const existing = this.cache.get(id);
        if (existing) {
            this.currentSize -= existing.size;
        }
        this.cache.set(id, entry);
        this.currentSize += size;
    }
    delete(id) {
        const entry = this.cache.get(id);
        if (entry) {
            this.currentSize -= entry.size;
            this.cache.delete(id);
        }
    }
    getByPrefix(prefix) {
        const results = [];
        for (const [id, entry] of this.cache){
            if (id.startsWith(prefix)) {
                entry.lastAccessed = Date.now();
                results.push(entry.data);
            }
        }
        return results;
    }
    getDirtyEntries() {
        const dirtyEntries = [];
        for (const entry of this.cache.values()){
            if (entry.dirty) {
                dirtyEntries.push(entry.data);
            }
        }
        return dirtyEntries;
    }
    markClean(ids) {
        for (const id of ids){
            const entry = this.cache.get(id);
            if (entry) {
                entry.dirty = false;
            }
        }
    }
    getAllEntries() {
        return Array.from(this.cache.values()).map((entry)=>entry.data);
    }
    getMetrics() {
        const totalRequests = this.hits + this.misses;
        const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
        return {
            size: this.currentSize,
            entries: this.cache.size,
            hitRate,
            maxSize: this.maxSize
        };
    }
    clear() {
        this.cache.clear();
        this.currentSize = 0;
        this.hits = 0;
        this.misses = 0;
    }
    performMaintenance() {
        const metrics = this.getMetrics();
        this.logger.debug('Cache maintenance', metrics);
    }
    calculateSize(entry) {
        let size = 0;
        size += entry.id.length * 2;
        size += entry.agentId.length * 2;
        size += entry.sessionId.length * 2;
        size += entry.type.length * 2;
        size += entry.content.length * 2;
        size += entry.tags.reduce((sum, tag)=>sum + tag.length * 2, 0);
        size += JSON.stringify(entry.context).length * 2;
        if (entry.metadata) {
            size += JSON.stringify(entry.metadata).length * 2;
        }
        size += 8;
        size += 4;
        size += 100;
        return size;
    }
    evict(requiredSpace) {
        this.logger.debug('Cache eviction triggered', {
            requiredSpace,
            currentSize: this.currentSize
        });
        const entries = Array.from(this.cache.entries()).sort((a, b)=>a[1].lastAccessed - b[1].lastAccessed);
        let freedSpace = 0;
        const evicted = [];
        for (const [id, entry] of entries){
            if (freedSpace >= requiredSpace) {
                break;
            }
            if (entry.dirty && evicted.length > 0) {
                continue;
            }
            this.cache.delete(id);
            this.currentSize -= entry.size;
            freedSpace += entry.size;
            evicted.push(id);
        }
        this.logger.debug('Cache entries evicted', {
            count: evicted.length,
            freedSpace
        });
    }
}

//# sourceMappingURL=cache.js.map