/**
 * Dynamic Compression based on CPU
 * Adaptive compression levels based on CPU availability
 * Phase 3 Optimization
 */
import * as zlib from 'zlib';
import { performance } from 'perf_hooks';
/**
 * Compression levels with CPU costs
 */
export const COMPRESSION_LEVELS = {
    gzip: [
        { level: 1, name: 'fastest', cpuCost: 1, compressionRatio: 3 },
        { level: 3, name: 'fast', cpuCost: 3, compressionRatio: 5 },
        { level: 6, name: 'default', cpuCost: 6, compressionRatio: 7 },
        { level: 9, name: 'best', cpuCost: 10, compressionRatio: 9 }
    ],
    brotli: [
        { level: 1, name: 'fastest', cpuCost: 2, compressionRatio: 4 },
        { level: 4, name: 'fast', cpuCost: 4, compressionRatio: 6 },
        { level: 6, name: 'default', cpuCost: 7, compressionRatio: 8 },
        { level: 11, name: 'best', cpuCost: 10, compressionRatio: 10 }
    ]
};
/**
 * Dynamic Compression Manager
 * Adjusts compression levels based on CPU load
 */
export class DynamicCompressionManager {
    config;
    stats;
    currentLevelIndex = 1; // Start with 'fast'
    cpuSamples = [];
    monitorInterval;
    constructor(config) {
        this.config = {
            enabled: config.enabled,
            minSize: config.minSize || 1024,
            algorithm: config.algorithm || 'gzip',
            adaptive: config.adaptive !== false,
            cpuThresholdHigh: config.cpuThresholdHigh || 70,
            cpuThresholdLow: config.cpuThresholdLow || 30,
            checkInterval: config.checkInterval || 5000
        };
        this.stats = {
            totalBytes: 0,
            compressedBytes: 0,
            compressionRatio: 1,
            avgCompressionTime: 0,
            currentLevel: this.getCurrentLevel().level,
            levelChanges: 0,
            cpuAdjustments: 0
        };
        if (this.config.adaptive) {
            this.startCPUMonitoring();
        }
    }
    /**
     * Compress data with adaptive level
     */
    async compress(data) {
        if (!this.config.enabled || data.length < this.config.minSize) {
            return data;
        }
        const startTime = performance.now();
        const level = this.getCurrentLevel();
        let compressed;
        try {
            if (this.config.algorithm === 'brotli') {
                compressed = await this.compressBrotli(data, level.level);
            }
            else if (this.config.algorithm === 'deflate') {
                compressed = await this.compressDeflate(data, level.level);
            }
            else {
                compressed = await this.compressGzip(data, level.level);
            }
            // Update statistics
            const compressionTime = performance.now() - startTime;
            this.updateStats(data.length, compressed.length, compressionTime);
            return compressed;
        }
        catch (error) {
            // Fallback to uncompressed
            return data;
        }
    }
    /**
     * Compress with gzip
     */
    compressGzip(data, level) {
        return new Promise((resolve, reject) => {
            zlib.gzip(data, { level }, (err, result) => {
                if (err)
                    reject(err);
                else
                    resolve(result);
            });
        });
    }
    /**
     * Compress with brotli
     */
    compressBrotli(data, level) {
        return new Promise((resolve, reject) => {
            zlib.brotliCompress(data, {
                params: {
                    [zlib.constants.BROTLI_PARAM_QUALITY]: level
                }
            }, (err, result) => {
                if (err)
                    reject(err);
                else
                    resolve(result);
            });
        });
    }
    /**
     * Compress with deflate
     */
    compressDeflate(data, level) {
        return new Promise((resolve, reject) => {
            zlib.deflate(data, { level }, (err, result) => {
                if (err)
                    reject(err);
                else
                    resolve(result);
            });
        });
    }
    /**
     * Get current compression level
     */
    getCurrentLevel() {
        const levels = COMPRESSION_LEVELS[this.config.algorithm];
        return levels[this.currentLevelIndex] || levels[1];
    }
    /**
     * Adjust compression level based on CPU
     */
    adjustLevel(cpuUsage) {
        const levels = COMPRESSION_LEVELS[this.config.algorithm];
        const oldIndex = this.currentLevelIndex;
        if (cpuUsage > this.config.cpuThresholdHigh && this.currentLevelIndex > 0) {
            // CPU high, reduce compression level
            this.currentLevelIndex--;
            this.stats.cpuAdjustments++;
        }
        else if (cpuUsage < this.config.cpuThresholdLow && this.currentLevelIndex < levels.length - 1) {
            // CPU low, increase compression level
            this.currentLevelIndex++;
            this.stats.cpuAdjustments++;
        }
        if (oldIndex !== this.currentLevelIndex) {
            this.stats.levelChanges++;
            this.stats.currentLevel = this.getCurrentLevel().level;
        }
    }
    /**
     * Start CPU monitoring
     */
    startCPUMonitoring() {
        this.monitorInterval = setInterval(() => {
            const cpuUsage = this.getCPUUsage();
            this.cpuSamples.push(cpuUsage);
            // Keep last 10 samples
            if (this.cpuSamples.length > 10) {
                this.cpuSamples.shift();
            }
            // Calculate average CPU
            const avgCPU = this.cpuSamples.reduce((a, b) => a + b, 0) / this.cpuSamples.length;
            // Adjust compression level
            this.adjustLevel(avgCPU);
        }, this.config.checkInterval);
    }
    /**
     * Get CPU usage percentage
     */
    getCPUUsage() {
        const cpus = require('os').cpus();
        let totalIdle = 0;
        let totalTick = 0;
        for (const cpu of cpus) {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        }
        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        const usage = 100 - ~~(100 * idle / total);
        return Math.max(0, Math.min(100, usage));
    }
    /**
     * Update statistics
     */
    updateStats(originalSize, compressedSize, time) {
        this.stats.totalBytes += originalSize;
        this.stats.compressedBytes += compressedSize;
        this.stats.compressionRatio = this.stats.totalBytes / this.stats.compressedBytes;
        // Update average compression time
        const totalCompressions = this.stats.totalBytes / (originalSize || 1);
        this.stats.avgCompressionTime =
            (this.stats.avgCompressionTime * (totalCompressions - 1) + time) / totalCompressions;
    }
    /**
     * Get statistics
     */
    getStats() {
        const level = this.getCurrentLevel();
        const avgCPU = this.cpuSamples.length > 0
            ? this.cpuSamples.reduce((a, b) => a + b, 0) / this.cpuSamples.length
            : 0;
        return {
            ...this.stats,
            currentLevelName: level.name,
            cpuUsage: avgCPU
        };
    }
    /**
     * Get compression savings
     */
    getSavings() {
        const byteSavings = this.stats.totalBytes - this.stats.compressedBytes;
        const percentSavings = (byteSavings / this.stats.totalBytes) * 100;
        const mbSaved = byteSavings / (1024 * 1024);
        return {
            byteSavings,
            percentSavings,
            mbSaved
        };
    }
    /**
     * Manually set compression level
     */
    setLevel(levelName) {
        const levels = COMPRESSION_LEVELS[this.config.algorithm];
        const index = levels.findIndex(l => l.name === levelName);
        if (index !== -1) {
            this.currentLevelIndex = index;
            this.stats.currentLevel = levels[index].level;
            this.stats.levelChanges++;
            return true;
        }
        return false;
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalBytes: 0,
            compressedBytes: 0,
            compressionRatio: 1,
            avgCompressionTime: 0,
            currentLevel: this.getCurrentLevel().level,
            levelChanges: 0,
            cpuAdjustments: 0
        };
    }
    /**
     * Stop CPU monitoring
     */
    destroy() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
    }
}
/**
 * Content-type aware compression
 */
export function shouldCompress(contentType, size, minSize = 1024) {
    if (size < minSize) {
        return false;
    }
    const compressibleTypes = [
        'text/',
        'application/json',
        'application/javascript',
        'application/xml',
        'application/x-www-form-urlencoded'
    ];
    return compressibleTypes.some(type => contentType.startsWith(type));
}
/**
 * Calculate compression efficiency
 */
export function calculateCompressionEfficiency(stats) {
    const timePerMB = stats.avgCompressionTime / ((stats.totalBytes / (1024 * 1024)) || 1);
    const ratioScore = Math.min(100, (stats.compressionRatio - 1) * 10);
    const efficiency = (ratioScore * 0.7) + ((100 - Math.min(100, timePerMB)) * 0.3);
    return {
        efficiency,
        timePerMB,
        ratioScore
    };
}
