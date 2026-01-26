let SimpleIndex = class SimpleIndex {
    index = new Map();
    get(key) {
        return this.index.get(key) || new Set();
    }
    add(key, entryId) {
        if (!this.index.has(key)) {
            this.index.set(key, new Set());
        }
        this.index.get(key).add(entryId);
    }
    remove(key, entryId) {
        const set = this.index.get(key);
        if (set) {
            set.delete(entryId);
            if (set.size === 0) {
                this.index.delete(key);
            }
        }
    }
    clear() {
        this.index.clear();
    }
    keys() {
        return Array.from(this.index.keys());
    }
};
export class MemoryIndexer {
    logger;
    entries = new Map();
    agentIndex = new SimpleIndex();
    sessionIndex = new SimpleIndex();
    typeIndex = new SimpleIndex();
    tagIndex = new SimpleIndex();
    timeIndex = new Map();
    constructor(logger){
        this.logger = logger;
    }
    async buildIndex(entries) {
        this.logger.info('Building memory index', {
            entries: entries.length
        });
        this.clear();
        for (const entry of entries){
            this.addEntry(entry);
        }
        this.logger.info('Memory index built', {
            totalEntries: this.entries.size,
            agents: this.agentIndex.keys().length,
            sessions: this.sessionIndex.keys().length,
            types: this.typeIndex.keys().length,
            tags: this.tagIndex.keys().length
        });
    }
    addEntry(entry) {
        this.entries.set(entry.id, entry);
        this.agentIndex.add(entry.agentId, entry.id);
        this.sessionIndex.add(entry.sessionId, entry.id);
        this.typeIndex.add(entry.type, entry.id);
        for (const tag of entry.tags){
            this.tagIndex.add(tag, entry.id);
        }
        this.timeIndex.set(entry.id, entry.timestamp.getTime());
    }
    updateEntry(entry) {
        const existing = this.entries.get(entry.id);
        if (existing) {
            this.removeEntry(entry.id);
        }
        this.addEntry(entry);
    }
    removeEntry(id) {
        const entry = this.entries.get(id);
        if (!entry) {
            return;
        }
        this.agentIndex.remove(entry.agentId, id);
        this.sessionIndex.remove(entry.sessionId, id);
        this.typeIndex.remove(entry.type, id);
        for (const tag of entry.tags){
            this.tagIndex.remove(tag, id);
        }
        this.timeIndex.delete(id);
        this.entries.delete(id);
    }
    search(query) {
        let resultIds;
        if (query.agentId) {
            resultIds = this.intersectSets(resultIds, this.agentIndex.get(query.agentId));
        }
        if (query.sessionId) {
            resultIds = this.intersectSets(resultIds, this.sessionIndex.get(query.sessionId));
        }
        if (query.type) {
            resultIds = this.intersectSets(resultIds, this.typeIndex.get(query.type));
        }
        if (query.tags && query.tags.length > 0) {
            const tagSets = query.tags.map((tag)=>this.tagIndex.get(tag));
            const unionSet = this.unionSets(...tagSets);
            resultIds = this.intersectSets(resultIds, unionSet);
        }
        if (!resultIds) {
            resultIds = new Set(this.entries.keys());
        }
        const results = [];
        for (const id of resultIds){
            const entry = this.entries.get(id);
            if (entry) {
                results.push(entry);
            }
        }
        results.sort((a, b)=>b.timestamp.getTime() - a.timestamp.getTime());
        return results;
    }
    getMetrics() {
        return {
            totalEntries: this.entries.size,
            indexSizes: {
                agents: this.agentIndex.keys().length,
                sessions: this.sessionIndex.keys().length,
                types: this.typeIndex.keys().length,
                tags: this.tagIndex.keys().length
            }
        };
    }
    clear() {
        this.entries.clear();
        this.agentIndex.clear();
        this.sessionIndex.clear();
        this.typeIndex.clear();
        this.tagIndex.clear();
        this.timeIndex.clear();
    }
    intersectSets(set1, set2) {
        if (!set1) {
            return new Set(set2);
        }
        const result = new Set();
        for (const item of set1){
            if (set2.has(item)) {
                result.add(item);
            }
        }
        return result;
    }
    unionSets(...sets) {
        const result = new Set();
        for (const set of sets){
            for (const item of set){
                result.add(item);
            }
        }
        return result;
    }
}

//# sourceMappingURL=indexer.js.map