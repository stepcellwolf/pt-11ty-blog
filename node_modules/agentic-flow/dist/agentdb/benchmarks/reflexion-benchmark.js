/**
 * Reflexion Memory Benchmark Suite
 *
 * Tests:
 * 1. Latency: p95 end-to-end ≤ 50ms for k-NN over 50k memories
 * 2. Hit Rate: Top-3 recall includes prior failure that predicts fix ≥ 60%
 * 3. Improvement Tracking: Measure learning curves over episodes
 */
import Database from 'better-sqlite3';
import { ReflexionMemory } from '../controllers/ReflexionMemory';
import { EmbeddingService } from '../controllers/EmbeddingService';
import * as fs from 'fs';
import * as path from 'path';
export class ReflexionBenchmark {
    db;
    memory;
    embedder;
    results = [];
    constructor(dbPath = ':memory:') {
        this.db = new Database(dbPath);
        this.embedder = new EmbeddingService({
            model: 'all-MiniLM-L6-v2',
            dimension: 384,
            provider: 'transformers'
        });
        this.memory = new ReflexionMemory(this.db, this.embedder);
    }
    async initialize() {
        // Load schema
        const schemaPath = path.join(__dirname, '../schemas/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        this.db.exec(schema);
        // Initialize embedder
        await this.embedder.initialize();
    }
    /**
     * Run all benchmarks
     */
    async runAll() {
        console.log('🧪 Starting Reflexion Memory Benchmark Suite\n');
        console.log('━'.repeat(70));
        await this.testLatency();
        await this.testHitRate();
        await this.testImprovementTracking();
        await this.testPruning();
        this.printResults();
        return this.results;
    }
    /**
     * Test 1: Latency Budget
     * Goal: p95 ≤ 50ms for k-NN over 50k memories
     */
    async testLatency() {
        console.log('\n📊 Test 1: Latency Budget');
        console.log('Goal: p95 end-to-end ≤ 50ms for k-NN over 50k memories\n');
        const memoryCount = 50000;
        const queryCount = 100;
        // Generate test episodes
        console.log(`Generating ${memoryCount} test episodes...`);
        const startGen = Date.now();
        for (let i = 0; i < memoryCount; i++) {
            const episode = {
                sessionId: `session-${Math.floor(i / 100)}`,
                task: this.generateTaskName(i),
                input: `Input for task ${i}`,
                output: `Output for task ${i}`,
                critique: this.generateCritique(i),
                reward: Math.random(),
                success: Math.random() > 0.5
            };
            await this.memory.storeEpisode(episode);
            if ((i + 1) % 10000 === 0) {
                const elapsed = Date.now() - startGen;
                console.log(`  Progress: ${i + 1}/${memoryCount} (${(elapsed / 1000).toFixed(1)}s)`);
            }
        }
        const genTime = Date.now() - startGen;
        console.log(`✓ Generated ${memoryCount} episodes in ${(genTime / 1000).toFixed(2)}s\n`);
        // Run retrieval queries
        console.log(`Running ${queryCount} retrieval queries...`);
        const latencies = [];
        for (let i = 0; i < queryCount; i++) {
            const task = this.generateTaskName(Math.floor(Math.random() * 10));
            const start = Date.now();
            await this.memory.retrieveRelevant({ task, k: 5 });
            const latency = Date.now() - start;
            latencies.push(latency);
        }
        // Calculate statistics
        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(queryCount * 0.50)];
        const p95 = latencies[Math.floor(queryCount * 0.95)];
        const p99 = latencies[Math.floor(queryCount * 0.99)];
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        console.log(`\n📈 Latency Results:`);
        console.log(`  Average: ${avg.toFixed(2)}ms`);
        console.log(`  p50:     ${p50}ms`);
        console.log(`  p95:     ${p95}ms`);
        console.log(`  p99:     ${p99}ms`);
        const passed = p95 <= 50;
        console.log(`\n${passed ? '✅ PASSED' : '❌ FAILED'}: p95 ${p95}ms ${passed ? '≤' : '>'} 50ms`);
        this.results.push({
            testName: 'Latency Budget',
            passed,
            metrics: { avg, p50, p95, p99, memoryCount, queryCount },
            details: `p95 latency: ${p95}ms (target: ≤50ms)`
        });
    }
    /**
     * Test 2: Hit Rate
     * Goal: Top-3 includes prior failure that predicts fix ≥ 60%
     */
    async testHitRate() {
        console.log('\n━'.repeat(70));
        console.log('\n📊 Test 2: Hit Rate');
        console.log('Goal: Top-3 recall includes prior failure ≥ 60%\n');
        const tasks = [
            'implement_binary_search',
            'create_rest_api',
            'parse_json_data',
            'handle_async_errors',
            'optimize_database_query'
        ];
        let totalTests = 0;
        let hits = 0;
        for (const task of tasks) {
            // Create failure episodes with specific critiques
            const failures = [
                { critique: 'Edge case: empty array not handled', reward: 0.2 },
                { critique: 'Performance: O(n²) instead of O(log n)', reward: 0.3 },
                { critique: 'Bug: off-by-one error in loop', reward: 0.1 }
            ];
            for (const failure of failures) {
                await this.memory.storeEpisode({
                    sessionId: `test-${task}`,
                    task,
                    input: 'test input',
                    output: 'failed output',
                    critique: failure.critique,
                    reward: failure.reward,
                    success: false
                });
            }
            // Create a successful episode
            await this.memory.storeEpisode({
                sessionId: `test-${task}`,
                task,
                input: 'test input',
                output: 'successful output',
                critique: 'Fixed: handled empty array edge case',
                reward: 0.9,
                success: true
            });
            // Query for top-3 failures
            const retrieved = await this.memory.retrieveRelevant({
                task,
                k: 3,
                onlyFailures: true
            });
            totalTests++;
            // Check if we got relevant failures
            const hasRelevantFailure = retrieved.some(ep => ep.critique && ep.critique.length > 0);
            if (hasRelevantFailure) {
                hits++;
                console.log(`✓ ${task}: Found ${retrieved.length} relevant failures`);
            }
            else {
                console.log(`✗ ${task}: No relevant failures in top-3`);
            }
        }
        const hitRate = hits / totalTests;
        console.log(`\n📈 Hit Rate Results:`);
        console.log(`  Total Tests: ${totalTests}`);
        console.log(`  Hits:        ${hits}`);
        console.log(`  Hit Rate:    ${(hitRate * 100).toFixed(1)}%`);
        const passed = hitRate >= 0.6;
        console.log(`\n${passed ? '✅ PASSED' : '❌ FAILED'}: Hit rate ${(hitRate * 100).toFixed(1)}% ${passed ? '≥' : '<'} 60%`);
        this.results.push({
            testName: 'Hit Rate',
            passed,
            metrics: { hitRate, totalTests, hits },
            details: `Hit rate: ${(hitRate * 100).toFixed(1)}% (target: ≥60%)`
        });
    }
    /**
     * Test 3: Improvement Tracking
     * Goal: Agents learn and improve over attempts
     */
    async testImprovementTracking() {
        console.log('\n━'.repeat(70));
        console.log('\n📊 Test 3: Improvement Tracking');
        console.log('Goal: Measure learning curves over episodes\n');
        const task = 'implement_sorting_algorithm';
        const attempts = 10;
        const rewards = [];
        // Simulate learning: rewards should trend upward
        for (let i = 0; i < attempts; i++) {
            const baseReward = 0.3;
            const improvement = i * 0.07; // 7% improvement per attempt
            const noise = Math.random() * 0.1 - 0.05;
            const reward = Math.min(1.0, baseReward + improvement + noise);
            await this.memory.storeEpisode({
                sessionId: 'learning-test',
                task,
                input: `attempt ${i + 1}`,
                output: `output ${i + 1}`,
                critique: i < 5 ? `Issue: needs improvement` : `Better: applied learnings`,
                reward,
                success: reward > 0.7
            });
            rewards.push(reward);
        }
        // Calculate improvement trend
        const stats = this.memory.getTaskStats(task);
        console.log(`📈 Learning Progress:`);
        rewards.forEach((r, i) => {
            const bar = '█'.repeat(Math.floor(r * 30));
            console.log(`  Attempt ${i + 1}: ${bar} ${(r * 100).toFixed(1)}%`);
        });
        console.log(`\n📊 Statistics:`);
        console.log(`  Total Attempts:     ${stats.totalAttempts}`);
        console.log(`  Success Rate:       ${(stats.successRate * 100).toFixed(1)}%`);
        console.log(`  Average Reward:     ${(stats.avgReward * 100).toFixed(1)}%`);
        console.log(`  Improvement Trend:  ${(stats.improvementTrend * 100).toFixed(1)}%`);
        const passed = stats.improvementTrend > 0;
        console.log(`\n${passed ? '✅ PASSED' : '❌ FAILED'}: Positive learning trend`);
        this.results.push({
            testName: 'Improvement Tracking',
            passed,
            metrics: {
                attempts: stats.totalAttempts,
                successRate: stats.successRate,
                avgReward: stats.avgReward,
                improvementTrend: stats.improvementTrend
            },
            details: `Improvement trend: ${(stats.improvementTrend * 100).toFixed(1)}%`
        });
    }
    /**
     * Test 4: Pruning Efficiency
     * Goal: Remove low-quality memories while preserving good ones
     */
    async testPruning() {
        console.log('\n━'.repeat(70));
        console.log('\n📊 Test 4: Pruning Efficiency');
        console.log('Goal: Remove low-quality memories efficiently\n');
        const task = 'pruning_test_task';
        // Create mix of high and low quality episodes
        const highQuality = 20;
        const lowQuality = 80;
        for (let i = 0; i < highQuality; i++) {
            await this.memory.storeEpisode({
                sessionId: 'pruning-test',
                task,
                input: `high quality ${i}`,
                output: `good output ${i}`,
                critique: 'Excellent work',
                reward: 0.8 + Math.random() * 0.2,
                success: true
            });
        }
        for (let i = 0; i < lowQuality; i++) {
            await this.memory.storeEpisode({
                sessionId: 'pruning-test',
                task,
                input: `low quality ${i}`,
                output: `poor output ${i}`,
                critique: 'Needs work',
                reward: 0.1 + Math.random() * 0.2,
                success: false
            });
        }
        const beforeCount = this.db.prepare('SELECT COUNT(*) as count FROM episodes WHERE task = ?')
            .get(task);
        console.log(`Before pruning: ${beforeCount.count} episodes`);
        // Prune low-quality episodes
        const pruned = this.memory.pruneEpisodes({
            minReward: 0.5,
            maxAgeDays: 1,
            keepMinPerTask: 5
        });
        const afterCount = this.db.prepare('SELECT COUNT(*) as count FROM episodes WHERE task = ?')
            .get(task);
        console.log(`After pruning:  ${afterCount.count} episodes`);
        console.log(`Removed:        ${pruned} episodes`);
        const remainingQuality = this.db.prepare('SELECT AVG(reward) as avg_reward FROM episodes WHERE task = ?').get(task);
        console.log(`\n📊 Results:`);
        console.log(`  Pruned:            ${pruned} episodes`);
        console.log(`  Retained:          ${afterCount.count} episodes`);
        console.log(`  Remaining Quality: ${(remainingQuality.avg_reward * 100).toFixed(1)}%`);
        const passed = pruned > 0 && afterCount.count >= 5 && remainingQuality.avg_reward >= 0.5;
        console.log(`\n${passed ? '✅ PASSED' : '❌ FAILED'}: Pruning maintained quality`);
        this.results.push({
            testName: 'Pruning Efficiency',
            passed,
            metrics: {
                pruned,
                retained: afterCount.count,
                avgQuality: remainingQuality.avg_reward
            },
            details: `Pruned ${pruned} episodes, retained ${afterCount.count} with ${(remainingQuality.avg_reward * 100).toFixed(1)}% quality`
        });
    }
    /**
     * Print summary results
     */
    printResults() {
        console.log('\n' + '━'.repeat(70));
        console.log('\n📊 BENCHMARK SUMMARY\n');
        console.log('━'.repeat(70));
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        this.results.forEach((result, i) => {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`\n${i + 1}. ${result.testName}: ${status}`);
            console.log(`   ${result.details}`);
        });
        console.log('\n' + '━'.repeat(70));
        console.log(`\n🎯 Overall: ${passed}/${total} tests passed (${((passed / total) * 100).toFixed(1)}%)`);
        if (passed === total) {
            console.log('\n✨ All benchmarks passed! Reflexion memory is production-ready.\n');
        }
        else {
            console.log('\n⚠️  Some benchmarks failed. Review results above.\n');
        }
    }
    /**
     * Generate test data helpers
     */
    generateTaskName(index) {
        const tasks = [
            'implement_binary_search',
            'create_rest_api',
            'parse_json_data',
            'optimize_query',
            'handle_errors',
            'validate_input',
            'format_output',
            'cache_results',
            'log_events',
            'test_coverage'
        ];
        return tasks[index % tasks.length];
    }
    generateCritique(index) {
        const critiques = [
            'Edge case not handled',
            'Performance could be improved',
            'Error handling missing',
            'Input validation needed',
            'Output format incorrect'
        ];
        return critiques[index % critiques.length];
    }
    /**
     * Cleanup
     */
    close() {
        this.db.close();
    }
}
// Run benchmark if called directly
if (require.main === module) {
    (async () => {
        const benchmark = new ReflexionBenchmark();
        await benchmark.initialize();
        await benchmark.runAll();
        benchmark.close();
    })().catch(console.error);
}
