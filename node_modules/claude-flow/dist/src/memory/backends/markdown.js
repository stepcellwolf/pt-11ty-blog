import { promises as fs } from 'fs';
import path from 'path';
import { MemoryBackendError } from '../../utils/errors.js';
export class MarkdownBackend {
    baseDir;
    logger;
    entries = new Map();
    indexPath;
    constructor(baseDir, logger){
        this.baseDir = baseDir;
        this.logger = logger;
        this.indexPath = path.join(this.baseDir, 'index.json');
    }
    async initialize() {
        this.logger.info('Initializing Markdown backend', {
            baseDir: this.baseDir
        });
        try {
            await fs.mkdir(this.baseDir, {
                recursive: true
            });
            await fs.mkdir(path.join(this.baseDir, 'agents'), {
                recursive: true
            });
            await fs.mkdir(path.join(this.baseDir, 'sessions'), {
                recursive: true
            });
            await this.loadIndex();
            this.logger.info('Markdown backend initialized');
        } catch (error) {
            throw new MemoryBackendError('Failed to initialize Markdown backend', {
                error
            });
        }
    }
    async shutdown() {
        this.logger.info('Shutting down Markdown backend');
        await this.saveIndex();
        this.entries.clear();
    }
    async store(entry) {
        try {
            this.entries.set(entry.id, entry);
            await this.writeEntryToFile(entry);
            await this.saveIndex();
        } catch (error) {
            throw new MemoryBackendError('Failed to store entry', {
                error
            });
        }
    }
    async retrieve(id) {
        return this.entries.get(id);
    }
    async update(id, entry) {
        if (!this.entries.has(id)) {
            throw new MemoryBackendError(`Entry not found: ${id}`);
        }
        await this.store(entry);
    }
    async delete(id) {
        const entry = this.entries.get(id);
        if (!entry) {
            return;
        }
        try {
            this.entries.delete(id);
            const filePath = this.getEntryFilePath(entry);
            await fs.unlink(filePath);
            await this.saveIndex();
        } catch (error) {
            throw new MemoryBackendError('Failed to delete entry', {
                error
            });
        }
    }
    async query(query) {
        let results = Array.from(this.entries.values());
        if (query.agentId) {
            results = results.filter((e)=>e.agentId === query.agentId);
        }
        if (query.sessionId) {
            results = results.filter((e)=>e.sessionId === query.sessionId);
        }
        if (query.type) {
            results = results.filter((e)=>e.type === query.type);
        }
        if (query.tags && query.tags.length > 0) {
            results = results.filter((e)=>query.tags.some((tag)=>e.tags.includes(tag)));
        }
        if (query.startTime) {
            results = results.filter((e)=>e.timestamp.getTime() >= query.startTime.getTime());
        }
        if (query.endTime) {
            results = results.filter((e)=>e.timestamp.getTime() <= query.endTime.getTime());
        }
        if (query.search) {
            const searchLower = query.search.toLowerCase();
            results = results.filter((e)=>e.content.toLowerCase().includes(searchLower) || e.tags.some((tag)=>tag.toLowerCase().includes(searchLower)));
        }
        results.sort((a, b)=>b.timestamp.getTime() - a.timestamp.getTime());
        const start = query.offset || 0;
        const limit = query.limit || results.length;
        results = results.slice(start, start + limit);
        return results;
    }
    async getAllEntries() {
        return Array.from(this.entries.values());
    }
    async getHealthStatus() {
        try {
            await fs.stat(this.baseDir);
            const entryCount = this.entries.size;
            let totalSizeBytes = 0;
            for (const entry of this.entries.values()){
                const filePath = this.getEntryFilePath(entry);
                try {
                    const stat = await fs.stat(filePath);
                    totalSizeBytes += stat.size;
                } catch  {}
            }
            return {
                healthy: true,
                metrics: {
                    entryCount,
                    totalSizeBytes
                }
            };
        } catch (error) {
            return {
                healthy: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async loadIndex() {
        try {
            const content = await fs.readFile(this.indexPath, 'utf-8');
            const index = JSON.parse(content);
            for (const [id, entry] of Object.entries(index)){
                entry.timestamp = new Date(entry.timestamp);
                this.entries.set(id, entry);
            }
            this.logger.info('Loaded memory index', {
                entries: this.entries.size
            });
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.logger.warn('Failed to load index', {
                    error
                });
            }
        }
    }
    async saveIndex() {
        const index = {};
        for (const [id, entry] of this.entries){
            index[id] = entry;
        }
        const content = JSON.stringify(index, null, 2);
        await fs.writeFile(this.indexPath, content, 'utf-8');
    }
    async writeEntryToFile(entry) {
        const filePath = this.getEntryFilePath(entry);
        const dirPath = path.dirname(filePath);
        await fs.mkdir(dirPath, {
            recursive: true
        });
        const content = this.entryToMarkdown(entry);
        await fs.writeFile(filePath, content, 'utf-8');
    }
    getEntryFilePath(entry) {
        const date = entry.timestamp.toISOString().split('T')[0];
        const time = entry.timestamp.toISOString().split('T')[1].replace(/:/g, '-').split('.')[0];
        return path.join(this.baseDir, 'agents', entry.agentId, date, `${time}_${entry.id}.md`);
    }
    entryToMarkdown(entry) {
        const lines = [
            `# Memory Entry: ${entry.id}`,
            '',
            `**Agent**: ${entry.agentId}`,
            `**Session**: ${entry.sessionId}`,
            `**Type**: ${entry.type}`,
            `**Timestamp**: ${entry.timestamp.toISOString()}`,
            `**Version**: ${entry.version}`,
            ''
        ];
        if (entry.parentId) {
            lines.push(`**Parent**: ${entry.parentId}`, '');
        }
        if (entry.tags.length > 0) {
            lines.push(`**Tags**: ${entry.tags.join(', ')}`, '');
        }
        lines.push('## Content', '', entry.content, '');
        if (Object.keys(entry.context).length > 0) {
            lines.push('## Context', '', '```json');
            lines.push(JSON.stringify(entry.context, null, 2));
            lines.push('```', '');
        }
        if (entry.metadata && Object.keys(entry.metadata).length > 0) {
            lines.push('## Metadata', '', '```json');
            lines.push(JSON.stringify(entry.metadata, null, 2));
            lines.push('```', '');
        }
        return lines.join('\n');
    }
}

//# sourceMappingURL=markdown.js.map