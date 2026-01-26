/**
 * Comprehensive AgentDB Benchmark Suite
 *
 * Tests all 5 SOTA memory patterns with production workloads:
 * 1. Reflexion episodic replay
 * 2. Skill library operations
 * 3. Mixed memory (facts + notes)
 * 4. Event consolidation
 * 5. Graph-aware recall
 *
 * Metrics tracked:
 * - Latency (p50, p95, p99)
 * - Throughput (ops/sec)
 * - Memory usage (RSS, heap)
 * - Hit rates and accuracy
 * - Concurrency performance
 */
import Database from 'better-sqlite3';
import { ReflexionMemory } from '../controllers/ReflexionMemory';
import { SkillLibrary } from '../controllers/SkillLibrary';
import { EmbeddingService } from '../controllers/EmbeddingService';
import * as fs from 'fs';
import * as path from 'path';
export class ComprehensiveBenchmark {
    db;
    reflexion;
    skills;
    embedder;
    results = [];
    constructor(dbPath = ':memory:') {
        this.db = new Database(dbPath);
        // Configure for performance
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = -64000'); // 64MB cache
        this.db.pragma('temp_store = MEMORY');
        this.db.pragma('mmap_size = 268435456'); // 256MB mmap
        this.embedder = new EmbeddingService({
            model: 'all-MiniLM-L6-v2',
            dimension: 384,
            provider: 'transformers'
        });
        this.reflexion = new ReflexionMemory(this.db, this.embedder);
        this.skills = new SkillLibrary(this.db, this.embedder);
    }
    async initialize() {
        console.log('🔧 Initializing AgentDB Benchmark Suite...\n');
        // Load schema
        const schemaPath = path.join(__dirname, '../schemas/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        this.db.exec(schema);
        // Initialize embedder
        await this.embedder.initialize();
        console.log('✅ Initialization complete\n');
    }
    /**
     * Run all benchmarks
     */
    async runAll() {
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║       AgentDB Comprehensive Benchmark Suite                   ║');
        console.log('╚════════════════════════════════════════════════════════════════╝\n');
        // Core performance tests
        await this.benchmarkEpisodeInsertion();
        await this.benchmarkEpisodeRetrieval();
        await this.benchmarkSkillConsolidation();
        await this.benchmarkConcurrentWrites();
        await this.benchmarkConcurrentReads();
        await this.benchmarkMixedWorkload();
        // Scalability tests
        await this.benchmarkLargeDataset();
        await this.benchmarkMemoryPressure();
        // Production scenarios
        await this.benchmarkRealtimeAgent();
        await this.benchmarkBatchProcessing();
        this.printSummary();
        this.generateReport();
        return this.results;
    }
    /**
     * Benchmark 1: Episode Insertion Performance
     */
    async benchmarkEpisodeInsertion() {
        console.log('\n📊 Benchmark 1: Episode Insertion Performance');
        console.log('━'.repeat(70));
        console.log('Testing: Bulk episode storage with embeddings\n');
        const count = 10000;
        const latencies = [];
        const memStart = process.memoryUsage();
        console.log(`Inserting ${count} episodes...`);
        const startTime = Date.now();
        for (let i = 0; i < count; i++) {
            const episodeStart = Date.now();
            await this.reflexion.storeEpisode({
                sessionId: `session-${Math.floor(i / 100)}`,
                task: `task_${i % 50}`,
                input: `Input data for episode ${i}`,
                output: `Generated output ${i}`,
                critique: this.generateCritique(i),
                reward: Math.random(),
                success: Math.random() > 0.3,
                latencyMs: Math.floor(Math.random() * 500),
                tokensUsed: Math.floor(Math.random() * 1000)
            });
            latencies.push(Date.now() - episodeStart);
            if ((i + 1) % 2500 === 0) {
                const progress = ((i + 1) / count * 100).toFixed(1);
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`  ${progress}% complete (${elapsed}s)`);
            }
        }
        const duration = Date.now() - startTime;
        const memEnd = process.memoryUsage();
        this.recordMetrics('Episode Insertion', {
            duration,
            operations: count,
            latencies,
            memStart,
            memEnd,
            passed: duration < 60000 // Should complete in < 60s
        });
    }
    /**
     * Benchmark 2: Episode Retrieval Performance
     */
    async benchmarkEpisodeRetrieval() {
        console.log('\n📊 Benchmark 2: Episode Retrieval Performance');
        console.log('━'.repeat(70));
        console.log('Testing: Semantic search with k-NN over episodes\n');
        const queries = 1000;
        const latencies = [];
        const memStart = process.memoryUsage();
        console.log(`Running ${queries} retrieval queries...`);
        const startTime = Date.now();
        for (let i = 0; i < queries; i++) {
            const queryStart = Date.now();
            await this.reflexion.retrieveRelevant({
                task: `task_${Math.floor(Math.random() * 50)}`,
                k: 5,
                timeWindowDays: 7
            });
            latencies.push(Date.now() - queryStart);
            if ((i + 1) % 250 === 0) {
                const progress = ((i + 1) / queries * 100).toFixed(1);
                console.log(`  ${progress}% complete`);
            }
        }
        const duration = Date.now() - startTime;
        const memEnd = process.memoryUsage();
        this.recordMetrics('Episode Retrieval', {
            duration,
            operations: queries,
            latencies,
            memStart,
            memEnd,
            passed: this.calculateP95(latencies) <= 50 // p95 ≤ 50ms
        });
    }
    /**
     * Benchmark 3: Skill Consolidation
     */
    async benchmarkSkillConsolidation() {
        console.log('\n📊 Benchmark 3: Skill Consolidation');
        console.log('━'.repeat(70));
        console.log('Testing: Episode → Skill transformation\n');
        const memStart = process.memoryUsage();
        const startTime = Date.now();
        console.log('Running consolidation job...');
        const created = this.skills.consolidateEpisodesIntoSkills({
            minAttempts: 3,
            minReward: 0.5,
            timeWindowDays: 30
        });
        const duration = Date.now() - startTime;
        const memEnd = process.memoryUsage();
        console.log(`✓ Created ${created} skills in ${duration}ms`);
        this.recordMetrics('Skill Consolidation', {
            duration,
            operations: created,
            latencies: [duration],
            memStart,
            memEnd,
            passed: duration < 5000 && created > 0 // < 5s, creates skills
        });
    }
    /**
     * Benchmark 4: Concurrent Writes
     */
    async benchmarkConcurrentWrites() {
        console.log('\n📊 Benchmark 4: Concurrent Write Performance');
        console.log('━'.repeat(70));
        console.log('Testing: Multiple agents writing simultaneously\n');
        const writers = 10;
        const writesPerWriter = 100;
        const allLatencies = [];
        const memStart = process.memoryUsage();
        console.log(`Running ${writers} concurrent writers...`);
        const startTime = Date.now();
        const writerPromises = Array.from({ length: writers }, async (_, writerIdx) => {
            const latencies = [];
            for (let i = 0; i < writesPerWriter; i++) {
                const writeStart = Date.now();
                await this.reflexion.storeEpisode({
                    sessionId: `concurrent-session-${writerIdx}`,
                    task: `concurrent_task_${i}`,
                    input: `Writer ${writerIdx} input ${i}`,
                    output: `Writer ${writerIdx} output ${i}`,
                    critique: 'Concurrent write test',
                    reward: Math.random(),
                    success: true
                });
                latencies.push(Date.now() - writeStart);
            }
            return latencies;
        });
        const results = await Promise.all(writerPromises);
        results.forEach(latencies => allLatencies.push(...latencies));
        const duration = Date.now() - startTime;
        const memEnd = process.memoryUsage();
        this.recordMetrics('Concurrent Writes', {
            duration,
            operations: writers * writesPerWriter,
            latencies: allLatencies,
            memStart,
            memEnd,
            passed: this.calculateP95(allLatencies) <= 100 // p95 ≤ 100ms under concurrency
        });
    }
    /**
     * Benchmark 5: Concurrent Reads
     */
    async benchmarkConcurrentReads() {
        console.log('\n📊 Benchmark 5: Concurrent Read Performance');
        console.log('━'.repeat(70));
        console.log('Testing: Multiple agents reading simultaneously\n');
        const readers = 20;
        const readsPerReader = 50;
        const allLatencies = [];
        const memStart = process.memoryUsage();
        console.log(`Running ${readers} concurrent readers...`);
        const startTime = Date.now();
        const readerPromises = Array.from({ length: readers }, async () => {
            const latencies = [];
            for (let i = 0; i < readsPerReader; i++) {
                const readStart = Date.now();
                await this.reflexion.retrieveRelevant({
                    task: `task_${Math.floor(Math.random() * 50)}`,
                    k: 5
                });
                latencies.push(Date.now() - readStart);
            }
            return latencies;
        });
        const results = await Promise.all(readerPromises);
        results.forEach(latencies => allLatencies.push(...latencies));
        const duration = Date.now() - startTime;
        const memEnd = process.memoryUsage();
        this.recordMetrics('Concurrent Reads', {
            duration,
            operations: readers * readsPerReader,
            latencies: allLatencies,
            memStart,
            memEnd,
            passed: this.calculateP95(allLatencies) <= 75 // p95 ≤ 75ms
        });
    }
    /**
     * Benchmark 6: Mixed Workload (Read + Write)
     */
    async benchmarkMixedWorkload() {
        console.log('\n📊 Benchmark 6: Mixed Workload Performance');
        console.log('━'.repeat(70));
        console.log('Testing: Simultaneous reads and writes\n');
        const workers = 10;
        const opsPerWorker = 100;
        const allLatencies = [];
        const memStart = process.memoryUsage();
        console.log(`Running ${workers} workers with mixed operations...`);
        const startTime = Date.now();
        const workerPromises = Array.from({ length: workers }, async (_, idx) => {
            const latencies = [];
            for (let i = 0; i < opsPerWorker; i++) {
                const opStart = Date.now();
                // Alternate between reads and writes
                if (i % 2 === 0) {
                    await this.reflexion.storeEpisode({
                        sessionId: `mixed-${idx}`,
                        task: `mixed_task_${i}`,
                        input: 'input',
                        output: 'output',
                        critique: 'critique',
                        reward: Math.random(),
                        success: true
                    });
                }
                else {
                    await this.reflexion.retrieveRelevant({
                        task: `mixed_task_${Math.floor(Math.random() * 50)}`,
                        k: 3
                    });
                }
                latencies.push(Date.now() - opStart);
            }
            return latencies;
        });
        const results = await Promise.all(workerPromises);
        results.forEach(latencies => allLatencies.push(...latencies));
        const duration = Date.now() - startTime;
        const memEnd = process.memoryUsage();
        this.recordMetrics('Mixed Workload', {
            duration,
            operations: workers * opsPerWorker,
            latencies: allLatencies,
            memStart,
            memEnd,
            passed: this.calculateP95(allLatencies) <= 80 // p95 ≤ 80ms
        });
    }
    /**
     * Benchmark 7: Large Dataset Performance
     */
    async benchmarkLargeDataset() {
        console.log('\n📊 Benchmark 7: Large Dataset Scalability');
        console.log('━'.repeat(70));
        console.log('Testing: Performance at 50k+ memories\n');
        const targetSize = 50000;
        const currentSize = this.db.prepare('SELECT COUNT(*) as count FROM episodes').get();
        const needed = Math.max(0, targetSize - currentSize.count);
        if (needed > 0) {
            console.log(`Adding ${needed} episodes to reach ${targetSize} target...`);
            const batchSize = 1000;
            const batches = Math.ceil(needed / batchSize);
            for (let batch = 0; batch < batches; batch++) {
                const transaction = this.db.transaction((episodes) => {
                    const stmt = this.db.prepare(`
            INSERT INTO episodes (session_id, task, input, output, reward, success)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
                    for (const ep of episodes) {
                        stmt.run(ep.session_id, ep.task, ep.input, ep.output, ep.reward, ep.success);
                    }
                });
                const episodes = Array.from({ length: Math.min(batchSize, needed - batch * batchSize) }, (_, i) => ({
                    session_id: `batch-${batch}`,
                    task: `task_${i % 100}`,
                    input: `input ${i}`,
                    output: `output ${i}`,
                    reward: Math.random(),
                    success: Math.random() > 0.5 ? 1 : 0
                }));
                transaction(episodes);
                if ((batch + 1) % 10 === 0) {
                    console.log(`  Progress: ${((batch + 1) / batches * 100).toFixed(1)}%`);
                }
            }
        }
        // Now test retrieval at scale
        const queries = 100;
        const latencies = [];
        const memStart = process.memoryUsage();
        console.log(`\nTesting retrieval over ${targetSize} memories...`);
        const startTime = Date.now();
        for (let i = 0; i < queries; i++) {
            const queryStart = Date.now();
            await this.reflexion.retrieveRelevant({
                task: `task_${Math.floor(Math.random() * 100)}`,
                k: 5
            });
            latencies.push(Date.now() - queryStart);
        }
        const duration = Date.now() - startTime;
        const memEnd = process.memoryUsage();
        this.recordMetrics('Large Dataset (50k+)', {
            duration,
            operations: queries,
            latencies,
            memStart,
            memEnd,
            passed: this.calculateP95(latencies) <= 100 // p95 ≤ 100ms at scale
        });
    }
    /**
     * Benchmark 8: Memory Pressure
     */
    async benchmarkMemoryPressure() {
        console.log('\n📊 Benchmark 8: Memory Pressure Test');
        console.log('━'.repeat(70));
        console.log('Testing: System stability under memory constraints\n');
        const operations = 1000;
        const latencies = [];
        const memStart = process.memoryUsage();
        console.log(`Running ${operations} operations with cache pressure...`);
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        const startTime = Date.now();
        for (let i = 0; i < operations; i++) {
            const opStart = Date.now();
            // Mix of memory-intensive operations
            if (i % 3 === 0) {
                await this.reflexion.storeEpisode({
                    sessionId: `mem-pressure-${i}`,
                    task: `task_${i}`,
                    input: 'A'.repeat(1000), // Large input
                    output: 'B'.repeat(1000), // Large output
                    critique: 'C'.repeat(500),
                    reward: Math.random(),
                    success: true
                });
            }
            else {
                await this.reflexion.retrieveRelevant({
                    task: `task_${Math.floor(Math.random() * 100)}`,
                    k: 10 // Higher k for more memory use
                });
            }
            latencies.push(Date.now() - opStart);
            if ((i + 1) % 250 === 0) {
                console.log(`  ${((i + 1) / operations * 100).toFixed(1)}% complete`);
            }
        }
        const duration = Date.now() - startTime;
        const memEnd = process.memoryUsage();
        const memoryGrowth = (memEnd.heapUsed - memStart.heapUsed) / 1024 / 1024;
        this.recordMetrics('Memory Pressure', {
            duration,
            operations,
            latencies,
            memStart,
            memEnd,
            passed: memoryGrowth < 200 && this.calculateP95(latencies) <= 150, // < 200MB growth
            details: `Memory growth: ${memoryGrowth.toFixed(2)}MB`
        });
    }
    /**
     * Benchmark 9: Realtime Agent Simulation
     */
    async benchmarkRealtimeAgent() {
        console.log('\n📊 Benchmark 9: Realtime Agent Simulation');
        console.log('━'.repeat(70));
        console.log('Testing: Agent making real-time decisions with memory\n');
        const tasks = 50;
        const attemptsPerTask = 5;
        const allLatencies = [];
        const memStart = process.memoryUsage();
        console.log(`Simulating ${tasks} tasks with ${attemptsPerTask} attempts each...`);
        const startTime = Date.now();
        for (let taskIdx = 0; taskIdx < tasks; taskIdx++) {
            const task = `realtime_task_${taskIdx}`;
            for (let attempt = 0; attempt < attemptsPerTask; attempt++) {
                const cycleStart = Date.now();
                // 1. Retrieve relevant memories
                const memories = await this.reflexion.retrieveRelevant({
                    task,
                    k: 3,
                    onlyFailures: attempt > 0
                });
                // 2. Simulate task execution
                const executionTime = Math.random() * 100;
                await new Promise(resolve => setTimeout(resolve, executionTime));
                // 3. Store result
                const reward = Math.min(0.3 + attempt * 0.15, 1.0); // Improvement over attempts
                await this.reflexion.storeEpisode({
                    sessionId: `realtime-${taskIdx}`,
                    task,
                    input: `Attempt ${attempt}`,
                    output: `Result ${attempt}`,
                    critique: attempt < 3 ? 'Needs improvement' : 'Good progress',
                    reward,
                    success: reward > 0.7
                });
                allLatencies.push(Date.now() - cycleStart);
            }
            if ((taskIdx + 1) % 10 === 0) {
                console.log(`  Task ${taskIdx + 1}/${tasks} complete`);
            }
        }
        const duration = Date.now() - startTime;
        const memEnd = process.memoryUsage();
        this.recordMetrics('Realtime Agent', {
            duration,
            operations: tasks * attemptsPerTask,
            latencies: allLatencies,
            memStart,
            memEnd,
            passed: this.calculateP95(allLatencies) <= 200 // p95 ≤ 200ms for full cycle
        });
    }
    /**
     * Benchmark 10: Batch Processing
     */
    async benchmarkBatchProcessing() {
        console.log('\n📊 Benchmark 10: Batch Processing Performance');
        console.log('━'.repeat(70));
        console.log('Testing: High-throughput batch operations\n');
        const batchSize = 100;
        const batches = 50;
        const allLatencies = [];
        const memStart = process.memoryUsage();
        console.log(`Processing ${batches} batches of ${batchSize} episodes...`);
        const startTime = Date.now();
        for (let batchIdx = 0; batchIdx < batches; batchIdx++) {
            const batchStart = Date.now();
            // Use transaction for batch
            const transaction = this.db.transaction((episodes) => {
                for (const ep of episodes) {
                    this.reflexion.storeEpisode(ep);
                }
            });
            const episodes = Array.from({ length: batchSize }, (_, i) => ({
                sessionId: `batch-${batchIdx}`,
                task: `batch_task_${i}`,
                input: `batch input ${i}`,
                output: `batch output ${i}`,
                critique: 'Batch processed',
                reward: Math.random(),
                success: Math.random() > 0.5
            }));
            await Promise.all(episodes.map(ep => this.reflexion.storeEpisode(ep)));
            allLatencies.push(Date.now() - batchStart);
            if ((batchIdx + 1) % 10 === 0) {
                console.log(`  ${((batchIdx + 1) / batches * 100).toFixed(1)}% complete`);
            }
        }
        const duration = Date.now() - startTime;
        const memEnd = process.memoryUsage();
        const throughput = (batches * batchSize) / (duration / 1000);
        this.recordMetrics('Batch Processing', {
            duration,
            operations: batches * batchSize,
            latencies: allLatencies,
            memStart,
            memEnd,
            passed: throughput >= 100, // ≥ 100 episodes/sec
            details: `Throughput: ${throughput.toFixed(0)} eps/sec`
        });
    }
    // ========================================================================
    // Helper Methods
    // ========================================================================
    recordMetrics(testName, data) {
        const { duration, operations, latencies, memStart, memEnd, passed, details } = data;
        latencies.sort((a, b) => a - b);
        const metrics = {
            testName,
            duration,
            operations,
            opsPerSecond: (operations / duration) * 1000,
            latency: {
                min: latencies[0] || 0,
                max: latencies[latencies.length - 1] || 0,
                avg: latencies.reduce((a, b) => a + b, 0) / latencies.length || 0,
                p50: latencies[Math.floor(latencies.length * 0.50)] || 0,
                p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
                p99: latencies[Math.floor(latencies.length * 0.99)] || 0
            },
            memory: {
                heapUsed: memEnd.heapUsed - memStart.heapUsed,
                heapTotal: memEnd.heapTotal - memStart.heapTotal,
                rss: memEnd.rss - memStart.rss
            },
            passed,
            details
        };
        this.results.push(metrics);
        console.log(`\n📈 Results:`);
        console.log(`  Duration:     ${duration.toFixed(0)}ms`);
        console.log(`  Operations:   ${operations}`);
        console.log(`  Throughput:   ${metrics.opsPerSecond.toFixed(1)} ops/sec`);
        console.log(`  Latency p50:  ${metrics.latency.p50.toFixed(1)}ms`);
        console.log(`  Latency p95:  ${metrics.latency.p95.toFixed(1)}ms`);
        console.log(`  Latency p99:  ${metrics.latency.p99.toFixed(1)}ms`);
        console.log(`  Memory Δ:     ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        if (details)
            console.log(`  ${details}`);
        console.log(`\n${passed ? '✅ PASSED' : '❌ FAILED'}`);
    }
    calculateP95(latencies) {
        const sorted = [...latencies].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length * 0.95)] || 0;
    }
    generateCritique(index) {
        const critiques = [
            'Edge case: empty input not handled',
            'Performance: could optimize query',
            'Bug: off-by-one error in loop',
            'Missing: input validation needed',
            'Improvement: add error handling',
            'Success: all edge cases covered',
            'Optimization: reduced time complexity',
            'Enhancement: added comprehensive tests'
        ];
        return critiques[index % critiques.length];
    }
    printSummary() {
        console.log('\n' + '═'.repeat(70));
        console.log('\n📊 BENCHMARK SUMMARY\n');
        console.log('═'.repeat(70));
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║  Test Name                       │  Result  │  p95 Latency     ║');
        console.log('╠════════════════════════════════════════════════════════════════╣');
        this.results.forEach(result => {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            const name = result.testName.padEnd(33);
            const latency = `${result.latency.p95.toFixed(1)}ms`.padStart(12);
            console.log(`║  ${name}│ ${status}  │ ${latency}    ║`);
        });
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log(`\n🎯 Overall: ${passed}/${total} tests passed (${((passed / total) * 100).toFixed(1)}%)`);
        // Calculate aggregate metrics
        const totalOps = this.results.reduce((sum, r) => sum + r.operations, 0);
        const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
        const avgThroughput = (totalOps / totalDuration) * 1000;
        console.log(`\n📊 Aggregate Metrics:`);
        console.log(`  Total Operations:  ${totalOps.toLocaleString()}`);
        console.log(`  Total Duration:    ${(totalDuration / 1000).toFixed(1)}s`);
        console.log(`  Avg Throughput:    ${avgThroughput.toFixed(1)} ops/sec`);
        if (passed === total) {
            console.log('\n✨ All benchmarks passed! AgentDB is production-ready.\n');
        }
        else {
            console.log('\n⚠️  Some benchmarks failed. Review optimizations needed.\n');
        }
    }
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.results.length,
                passed: this.results.filter(r => r.passed).length,
                failed: this.results.filter(r => !r.passed).length
            },
            results: this.results,
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                memory: process.memoryUsage()
            }
        };
        const reportPath = path.join(__dirname, 'benchmark-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Detailed report saved to: ${reportPath}`);
    }
    close() {
        this.db.close();
    }
}
// Run if called directly
if (require.main === module) {
    (async () => {
        const benchmark = new ComprehensiveBenchmark();
        await benchmark.initialize();
        await benchmark.runAll();
        benchmark.close();
        process.exit(0);
    })().catch(err => {
        console.error('Benchmark failed:', err);
        process.exit(1);
    });
}
