import { SqliteMemoryStore } from './sqlite-store.js';
import { InMemoryStore } from './in-memory-store.js';
import { isSQLiteAvailable, getLoadError, isWindows } from './sqlite-wrapper.js';
let FallbackMemoryStore = class FallbackMemoryStore {
    constructor(options = {}){
        this.options = options;
        this.primaryStore = null;
        this.fallbackStore = null;
        this.useFallback = false;
        this.initializationAttempted = false;
    }
    async initialize() {
        if (this.initializationAttempted) return;
        this.initializationAttempted = true;
        const sqliteAvailable = await isSQLiteAvailable();
        if (!sqliteAvailable) {
            const loadError = getLoadError();
            console.error(`[${new Date().toISOString()}] WARN [fallback-store] SQLite module not available:`, loadError?.message || 'Unknown error');
            this.fallbackStore = new InMemoryStore(this.options);
            await this.fallbackStore.initialize();
            this.useFallback = true;
            this._logFallbackUsage();
            return;
        }
        try {
            this.primaryStore = new SqliteMemoryStore(this.options);
            await this.primaryStore.initialize();
            console.error(`[${new Date().toISOString()}] INFO [fallback-store] Successfully initialized SQLite store`);
            this.useFallback = false;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] WARN [fallback-store] SQLite initialization failed:`, error.message);
            this.fallbackStore = new InMemoryStore(this.options);
            await this.fallbackStore.initialize();
            this.useFallback = true;
            this._logFallbackUsage();
        }
    }
    _logFallbackUsage() {
        console.error(`[${new Date().toISOString()}] INFO [fallback-store] Using in-memory store (data will not persist across sessions)`);
        if (isWindows()) {
            console.error(`[${new Date().toISOString()}] INFO [fallback-store] Windows detected. For persistent storage options, see: https://github.com/ruvnet/claude-code-flow/docs/windows-installation.md`);
        } else {
            console.error(`[${new Date().toISOString()}] INFO [fallback-store] To enable persistent storage, install the package locally: npm install claude-flow@alpha`);
        }
    }
    get activeStore() {
        return this.useFallback ? this.fallbackStore : this.primaryStore;
    }
    async store(key, value, options = {}) {
        await this.initialize();
        return this.activeStore.store(key, value, options);
    }
    async retrieve(key, options = {}) {
        await this.initialize();
        return this.activeStore.retrieve(key, options);
    }
    async list(options = {}) {
        await this.initialize();
        return this.activeStore.list(options);
    }
    async delete(key, options = {}) {
        await this.initialize();
        return this.activeStore.delete(key, options);
    }
    async search(pattern, options = {}) {
        await this.initialize();
        return this.activeStore.search(pattern, options);
    }
    async cleanup() {
        await this.initialize();
        return this.activeStore.cleanup();
    }
    close() {
        if (this.primaryStore) {
            this.primaryStore.close();
        }
        if (this.fallbackStore) {
            this.fallbackStore.close();
        }
    }
    isUsingFallback() {
        return this.useFallback;
    }
};
export const memoryStore = new FallbackMemoryStore();
export { FallbackMemoryStore };
export default FallbackMemoryStore;

//# sourceMappingURL=fallback-store.js.map