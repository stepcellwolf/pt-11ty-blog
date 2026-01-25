import { createSessionSerializer, SerializationError, DeserializationError } from './advanced-serializer.js';
export class SessionSerializer {
    constructor(options = {}){
        this.serializer = createSessionSerializer({
            preserveUndefined: true,
            preserveFunctions: false,
            preserveSymbols: true,
            enableCompression: options.enableCompression !== false,
            maxDepth: options.maxDepth || 50,
            ...options
        });
        this.compressionThreshold = options.compressionThreshold || 1024;
        this.enableValidation = options.enableValidation !== false;
        this.enableMigration = options.enableMigration !== false;
    }
    serializeSessionData(sessionData) {
        try {
            const processedData = this._preprocessSessionData(sessionData);
            const enhancedData = {
                ...processedData,
                __session_meta__: {
                    version: '2.0.0',
                    timestamp: new Date().toISOString(),
                    serializer: 'SessionSerializer',
                    nodeVersion: process.version,
                    platform: process.platform,
                    compressionEnabled: this.serializer.options.enableCompression
                }
            };
            return this.serializer.serializeSessionData(enhancedData);
        } catch (error) {
            throw new SerializationError(`Session serialization failed: ${error.message}`, {
                sessionId: sessionData?.id,
                originalError: error
            });
        }
    }
    deserializeSessionData(serializedData, options = {}) {
        try {
            const data = this.serializer.deserializeSessionData(serializedData);
            if (data.__session_meta__) {
                const meta = data.__session_meta__;
                if (this.enableMigration && meta.version !== '2.0.0') {
                    console.log(`[SessionSerializer] Migrating session data from v${meta.version} to v2.0.0`);
                    this._migrateSessionData(data, meta.version);
                }
                delete data.__session_meta__;
            }
            return this._postprocessSessionData(data, options);
        } catch (error) {
            if (options.allowFallback !== false) {
                try {
                    console.warn('[SessionSerializer] Attempting fallback deserialization for legacy format');
                    return this._deserializeLegacySession(serializedData);
                } catch (fallbackError) {
                    console.error('[SessionSerializer] Fallback deserialization also failed:', fallbackError.message);
                }
            }
            throw new DeserializationError(`Session deserialization failed: ${error.message}`, {
                originalError: error
            });
        }
    }
    serializeCheckpointData(checkpointData) {
        try {
            const enhancedCheckpoint = {
                ...checkpointData,
                __checkpoint_meta__: {
                    serializedAt: new Date().toISOString(),
                    version: '2.0.0',
                    type: 'checkpoint'
                }
            };
            return this.serializer.serialize(enhancedCheckpoint);
        } catch (error) {
            throw new SerializationError(`Checkpoint serialization failed: ${error.message}`, {
                checkpointName: checkpointData?.name,
                originalError: error
            });
        }
    }
    deserializeCheckpointData(serializedData) {
        try {
            const data = this.serializer.deserialize(serializedData);
            if (data.__checkpoint_meta__) {
                delete data.__checkpoint_meta__;
            }
            return data;
        } catch (error) {
            try {
                return JSON.parse(serializedData);
            } catch (fallbackError) {
                throw new DeserializationError(`Checkpoint deserialization failed: ${error.message}`, {
                    originalError: error,
                    fallbackError: fallbackError.message
                });
            }
        }
    }
    serializeMetadata(metadata) {
        try {
            if (!metadata || typeof metadata !== 'object') {
                return JSON.stringify(metadata);
            }
            return this.serializer.serialize(metadata);
        } catch (error) {
            console.warn('[SessionSerializer] Metadata serialization failed, using fallback:', error.message);
            return JSON.stringify(this._simplifyMetadata(metadata));
        }
    }
    deserializeMetadata(serializedMetadata) {
        if (!serializedMetadata) return {};
        try {
            return this.serializer.deserialize(serializedMetadata);
        } catch (error) {
            try {
                return JSON.parse(serializedMetadata);
            } catch (fallbackError) {
                console.warn('[SessionSerializer] Metadata deserialization failed:', error.message);
                return {};
            }
        }
    }
    serializeLogData(logData) {
        if (!logData) return null;
        try {
            if (typeof logData === 'string') {
                return logData;
            }
            return this.serializer.serialize(logData);
        } catch (error) {
            console.warn('[SessionSerializer] Log data serialization failed:', error.message);
            return JSON.stringify(this._sanitizeLogData(logData));
        }
    }
    deserializeLogData(serializedLogData) {
        if (!serializedLogData) return null;
        try {
            return this.serializer.deserialize(serializedLogData);
        } catch (error) {
            try {
                return JSON.parse(serializedLogData);
            } catch (fallbackError) {
                return serializedLogData;
            }
        }
    }
    _preprocessSessionData(sessionData) {
        if (!sessionData || typeof sessionData !== 'object') {
            return sessionData;
        }
        const processed = {
            ...sessionData
        };
        if (processed.created_at && !(processed.created_at instanceof Date)) {
            processed.created_at = new Date(processed.created_at);
        }
        if (processed.updated_at && !(processed.updated_at instanceof Date)) {
            processed.updated_at = new Date(processed.updated_at);
        }
        if (processed.paused_at && !(processed.paused_at instanceof Date)) {
            processed.paused_at = new Date(processed.paused_at);
        }
        if (processed.resumed_at && !(processed.resumed_at instanceof Date)) {
            processed.resumed_at = new Date(processed.resumed_at);
        }
        if (processed.agents && Array.isArray(processed.agents)) {
            processed.agents = processed.agents.map((agent)=>this._preprocessAgent(agent));
        }
        if (processed.tasks && Array.isArray(processed.tasks)) {
            processed.tasks = processed.tasks.map((task)=>this._preprocessTask(task));
        }
        if (processed.checkpoints && Array.isArray(processed.checkpoints)) {
            processed.checkpoints = processed.checkpoints.map((checkpoint)=>this._preprocessCheckpoint(checkpoint));
        }
        return processed;
    }
    _postprocessSessionData(sessionData, options = {}) {
        if (!sessionData || typeof sessionData !== 'object') {
            return sessionData;
        }
        const processed = {
            ...sessionData
        };
        const dateFields = [
            'created_at',
            'updated_at',
            'paused_at',
            'resumed_at'
        ];
        for (const field of dateFields){
            if (processed[field] && !(processed[field] instanceof Date)) {
                processed[field] = new Date(processed[field]);
            }
        }
        if (processed.agents && Array.isArray(processed.agents)) {
            processed.agents = processed.agents.map((agent)=>this._postprocessAgent(agent));
        }
        if (processed.tasks && Array.isArray(processed.tasks)) {
            processed.tasks = processed.tasks.map((task)=>this._postprocessTask(task));
        }
        if (processed.checkpoints && Array.isArray(processed.checkpoints)) {
            processed.checkpoints = processed.checkpoints.map((checkpoint)=>this._postprocessCheckpoint(checkpoint));
        }
        return processed;
    }
    _preprocessAgent(agent) {
        if (!agent || typeof agent !== 'object') return agent;
        const processed = {
            ...agent
        };
        if (processed.created_at) processed.created_at = new Date(processed.created_at);
        if (processed.updated_at) processed.updated_at = new Date(processed.updated_at);
        if (processed.last_active) processed.last_active = new Date(processed.last_active);
        if (processed.config && typeof processed.config === 'object') {
            processed.config = {
                ...processed.config
            };
        }
        return processed;
    }
    _preprocessTask(task) {
        if (!task || typeof task !== 'object') return task;
        const processed = {
            ...task
        };
        if (processed.created_at) processed.created_at = new Date(processed.created_at);
        if (processed.updated_at) processed.updated_at = new Date(processed.updated_at);
        if (processed.started_at) processed.started_at = new Date(processed.started_at);
        if (processed.completed_at) processed.completed_at = new Date(processed.completed_at);
        return processed;
    }
    _preprocessCheckpoint(checkpoint) {
        if (!checkpoint || typeof checkpoint !== 'object') return checkpoint;
        const processed = {
            ...checkpoint
        };
        if (processed.created_at) processed.created_at = new Date(processed.created_at);
        return processed;
    }
    _postprocessAgent(agent) {
        return this._preprocessAgent(agent);
    }
    _postprocessTask(task) {
        return this._preprocessTask(task);
    }
    _postprocessCheckpoint(checkpoint) {
        return this._preprocessCheckpoint(checkpoint);
    }
    _migrateSessionData(data, fromVersion) {
        switch(fromVersion){
            case '1.0.0':
                if (!data.version) data.version = '2.0.0';
                if (!data.capabilities) data.capabilities = [];
                break;
            default:
                console.warn(`[SessionSerializer] Unknown session version: ${fromVersion}`);
        }
    }
    _deserializeLegacySession(serializedData) {
        try {
            const data = JSON.parse(serializedData);
            return this._cleanupLegacyData(data);
        } catch (error) {
            throw new DeserializationError(`Legacy session deserialization failed: ${error.message}`);
        }
    }
    _cleanupLegacyData(data) {
        if (!data || typeof data !== 'object') return data;
        const cleaned = {
            ...data
        };
        const dateFields = [
            'created_at',
            'updated_at',
            'paused_at',
            'resumed_at'
        ];
        for (const field of dateFields){
            if (cleaned[field] && typeof cleaned[field] === 'string') {
                try {
                    cleaned[field] = new Date(cleaned[field]);
                } catch (error) {
                    console.warn(`[SessionSerializer] Failed to parse date field ${field}:`, error.message);
                }
            }
        }
        const jsonFields = [
            'metadata',
            'checkpoint_data'
        ];
        for (const field of jsonFields){
            if (cleaned[field] && typeof cleaned[field] === 'string') {
                try {
                    cleaned[field] = JSON.parse(cleaned[field]);
                } catch (error) {
                    console.warn(`[SessionSerializer] Failed to parse JSON field ${field}:`, error.message);
                }
            }
        }
        return cleaned;
    }
    _simplifyMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object') return metadata;
        const simplified = {};
        for (const [key, value] of Object.entries(metadata)){
            try {
                JSON.stringify(value);
                simplified[key] = value;
            } catch (error) {
                simplified[key] = `[Non-serializable: ${typeof value}]`;
            }
        }
        return simplified;
    }
    _sanitizeLogData(logData) {
        if (!logData || typeof logData !== 'object') return logData;
        const sanitized = {};
        for (const [key, value] of Object.entries(logData)){
            if (typeof value === 'function') {
                sanitized[key] = '[Function]';
            } else if (typeof value === 'symbol') {
                sanitized[key] = `[Symbol: ${value.toString()}]`;
            } else if (value instanceof Error) {
                sanitized[key] = {
                    name: value.name,
                    message: value.message,
                    stack: value.stack
                };
            } else {
                try {
                    JSON.stringify(value);
                    sanitized[key] = value;
                } catch (error) {
                    sanitized[key] = `[Non-serializable: ${typeof value}]`;
                }
            }
        }
        return sanitized;
    }
    getStats() {
        return {
            compressionEnabled: this.serializer.options.enableCompression,
            compressionThreshold: this.compressionThreshold,
            maxDepth: this.serializer.options.maxDepth,
            validationEnabled: this.enableValidation,
            migrationEnabled: this.enableMigration
        };
    }
}
export function createEnhancedSessionSerializer(options = {}) {
    return new SessionSerializer(options);
}
export const sessionSerializer = new SessionSerializer();
export default SessionSerializer;

//# sourceMappingURL=enhanced-session-serializer.js.map