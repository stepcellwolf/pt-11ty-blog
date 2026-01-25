import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
export class LegacyDataBridge {
    constructor(options = {}){
        this.backupDir = options.backupDir || '.agentdb/backups';
        this.verbose = options.verbose || false;
    }
    async migrateToAgentDB(sourceStore, targetAdapter, options = {}) {
        const startTime = Date.now();
        const results = {
            success: false,
            migrated: 0,
            errors: 0,
            skipped: 0,
            backupPath: null,
            duration: 0
        };
        try {
            this._log('Creating backup of legacy data...');
            const backupPath = await this.createBackup(sourceStore);
            results.backupPath = backupPath;
            this._log(`Backup created at: ${backupPath}`);
            this._log('Exporting legacy data...');
            const legacyData = await sourceStore.exportData();
            for (const [namespace, items] of Object.entries(legacyData)){
                this._log(`Migrating namespace: ${namespace} (${items.length} items)`);
                for (const item of items){
                    try {
                        const shouldEmbed = this._shouldEmbed(item, namespace, options);
                        if (shouldEmbed && options.generateEmbedding) {
                            const embedding = await options.generateEmbedding(item.value);
                            await targetAdapter.storeWithEmbedding(item.key, item.value, {
                                embedding,
                                metadata: item.metadata,
                                namespace,
                                ttl: item.ttl
                            });
                        } else {
                            await targetAdapter.store(item.key, item.value, {
                                metadata: item.metadata,
                                namespace,
                                ttl: item.ttl
                            });
                        }
                        results.migrated++;
                    } catch (error) {
                        results.errors++;
                        this._log(`Error migrating ${item.key}: ${error.message}`, 'error');
                        if (options.stopOnError) {
                            throw error;
                        }
                    }
                }
            }
            this._log('Validating migration...');
            const validation = await this.validateMigration(sourceStore, targetAdapter);
            if (!validation.isValid && options.strictValidation) {
                throw new Error(`Migration validation failed: ${validation.errors.join(', ')}`);
            }
            results.success = true;
            results.duration = Date.now() - startTime;
            this._log(`Migration completed in ${results.duration}ms`);
            this._log(`Migrated: ${results.migrated}, Errors: ${results.errors}, Skipped: ${results.skipped}`);
            return results;
        } catch (error) {
            results.success = false;
            results.duration = Date.now() - startTime;
            results.error = error.message;
            this._log(`Migration failed: ${error.message}`, 'error');
            return results;
        }
    }
    async validateMigration(sourceStore, targetAdapter) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            stats: {
                sourceCount: 0,
                targetCount: 0,
                matched: 0,
                mismatched: 0
            }
        };
        try {
            const sourceData = await sourceStore.exportData();
            const targetData = await targetAdapter.exportData();
            for (const items of Object.values(sourceData)){
                validation.stats.sourceCount += items.length;
            }
            for (const items of Object.values(targetData)){
                validation.stats.targetCount += items.length;
            }
            for (const [namespace, sourceItems] of Object.entries(sourceData)){
                const targetItems = targetData[namespace] || [];
                const targetKeys = new Set(targetItems.map((item)=>item.key));
                for (const sourceItem of sourceItems){
                    if (targetKeys.has(sourceItem.key)) {
                        const targetItem = targetItems.find((item)=>item.key === sourceItem.key);
                        if (JSON.stringify(sourceItem.value) === JSON.stringify(targetItem.value)) {
                            validation.stats.matched++;
                        } else {
                            validation.stats.mismatched++;
                            validation.warnings.push(`Value mismatch for key: ${sourceItem.key} in namespace: ${namespace}`);
                        }
                    } else {
                        validation.errors.push(`Missing key in target: ${sourceItem.key} in namespace: ${namespace}`);
                        validation.isValid = false;
                    }
                }
            }
            if (validation.stats.sourceCount !== validation.stats.targetCount) {
                validation.warnings.push(`Count mismatch: source=${validation.stats.sourceCount}, target=${validation.stats.targetCount}`);
            }
            return validation;
        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Validation error: ${error.message}`);
            return validation;
        }
    }
    async rollback(backupPath, targetStore) {
        const startTime = Date.now();
        const results = {
            success: false,
            restored: 0,
            errors: 0,
            duration: 0
        };
        try {
            if (!existsSync(backupPath)) {
                throw new Error(`Backup file not found: ${backupPath}`);
            }
            this._log(`Reading backup from: ${backupPath}`);
            const backupData = JSON.parse(readFileSync(backupPath, 'utf-8'));
            this._log('Restoring data from backup...');
            await targetStore.importData(backupData);
            results.success = true;
            results.duration = Date.now() - startTime;
            this._log(`Rollback completed in ${results.duration}ms`);
            return results;
        } catch (error) {
            results.success = false;
            results.duration = Date.now() - startTime;
            results.error = error.message;
            this._log(`Rollback failed: ${error.message}`, 'error');
            return results;
        }
    }
    async createBackup(sourceStore) {
        try {
            const fs = await import('fs');
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, {
                    recursive: true
                });
            }
            const data = await sourceStore.exportData();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = join(this.backupDir, `backup-${timestamp}.json`);
            writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf-8');
            return backupPath;
        } catch (error) {
            throw new Error(`Backup creation failed: ${error.message}`);
        }
    }
    _shouldEmbed(item, namespace, options) {
        const skipNamespaces = options.skipEmbedding || [
            'metrics',
            'performance',
            'coordination'
        ];
        if (skipNamespaces.includes(namespace)) {
            return false;
        }
        if (typeof item.value !== 'object' && typeof item.value !== 'string') {
            return false;
        }
        const embedNamespaces = options.embedNamespaces || [
            'knowledge',
            'learning',
            'sessions',
            'workflows'
        ];
        return embedNamespaces.includes(namespace);
    }
    _log(message, level = 'info') {
        if (!this.verbose && level !== 'error') {
            return;
        }
        const timestamp = new Date().toISOString();
        const prefix = level === 'error' ? 'ERROR' : 'INFO';
        console.error(`[${timestamp}] ${prefix} [legacy-bridge] ${message}`);
    }
    generateReport(results) {
        const lines = [];
        lines.push('='.repeat(60));
        lines.push('AgentDB Migration Report');
        lines.push('='.repeat(60));
        lines.push('');
        lines.push(`Status: ${results.success ? 'SUCCESS' : 'FAILED'}`);
        lines.push(`Duration: ${results.duration}ms`);
        lines.push('');
        lines.push('Statistics:');
        lines.push(`  Migrated: ${results.migrated}`);
        lines.push(`  Errors: ${results.errors}`);
        lines.push(`  Skipped: ${results.skipped}`);
        if (results.backupPath) {
            lines.push('');
            lines.push(`Backup Location: ${results.backupPath}`);
        }
        if (results.error) {
            lines.push('');
            lines.push(`Error: ${results.error}`);
        }
        lines.push('='.repeat(60));
        return lines.join('\n');
    }
}
export default LegacyDataBridge;

//# sourceMappingURL=legacy-bridge.js.map