import { SharedMemory, SwarmMemory, createMemory } from './index.js';
async function testSharedMemory() {
    console.log('=== Testing SharedMemory ===\n');
    const memory = new SharedMemory({
        directory: '.hive-mind',
        cacheSize: 100,
        cacheMemoryMB: 10
    });
    try {
        await memory.initialize();
        console.log('✓ Initialized SharedMemory');
        await memory.store('test-key', {
            message: 'Hello, World!'
        });
        console.log('✓ Stored test data');
        const retrieved = await memory.retrieve('test-key');
        console.log('✓ Retrieved:', retrieved);
        await memory.store('temp-key', 'Temporary data', {
            ttl: 60,
            tags: [
                'temp',
                'test'
            ]
        });
        console.log('✓ Stored temporary data with TTL');
        const entries = await memory.list('default', {
            limit: 10
        });
        console.log(`✓ Found ${entries.length} entries`);
        const stats = await memory.getStats();
        console.log('✓ Statistics:', stats);
        await memory.close();
        console.log('✓ Closed SharedMemory\n');
    } catch (error) {
        console.error('✗ Error:', error);
    }
}
async function testSwarmMemory() {
    console.log('=== Testing SwarmMemory ===\n');
    const swarm = new SwarmMemory({
        swarmId: 'test-swarm',
        directory: '.swarm'
    });
    try {
        await swarm.initialize();
        console.log('✓ Initialized SwarmMemory');
        await swarm.storeAgent('agent-1', {
            id: 'agent-1',
            name: 'Test Agent',
            type: 'coder',
            status: 'active',
            capabilities: [
                "javascript",
                'python'
            ]
        });
        console.log('✓ Stored agent');
        await swarm.storeTask('task-1', {
            id: 'task-1',
            description: 'Test task',
            priority: 'high',
            status: 'pending',
            assignedAgents: [
                'agent-1'
            ]
        });
        console.log('✓ Stored task');
        await swarm.updateTaskStatus('task-1', 'in_progress');
        console.log('✓ Updated task status');
        await swarm.storePattern('pattern-1', {
            id: 'pattern-1',
            type: 'optimization',
            confidence: 0.85,
            data: {
                strategy: 'parallel'
            }
        });
        console.log('✓ Stored pattern');
        const stats = await swarm.getSwarmStats();
        console.log('✓ Swarm statistics:', {
            agents: stats.swarm.agents,
            tasks: stats.swarm.tasks,
            patterns: stats.swarm.patterns
        });
        await swarm.close();
        console.log('✓ Closed SwarmMemory\n');
    } catch (error) {
        console.error('✗ Error:', error);
    }
}
async function testMemoryFactory() {
    console.log('=== Testing Memory Factory ===\n');
    const shared = createMemory({
        type: 'shared'
    });
    console.log('✓ Created SharedMemory via factory');
    const swarm = createMemory({
        type: 'swarm',
        swarmId: 'factory-test'
    });
    console.log('✓ Created SwarmMemory via factory\n');
}
async function runTests() {
    await testSharedMemory();
    await testSwarmMemory();
    await testMemoryFactory();
    console.log('=== All tests completed ===');
}
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().catch(console.error);
}
export { testSharedMemory, testSwarmMemory, testMemoryFactory };

//# sourceMappingURL=test-example.js.map