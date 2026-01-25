import { enhancedMemory } from './enhanced-memory.js';
await enhancedMemory.initialize();
async function exampleSessionManagement() {
    console.log('\n=== Session Management ===');
    const sessionId = `session-${Date.now()}`;
    await enhancedMemory.saveSessionState(sessionId, {
        state: 'active',
        context: {
            currentTask: 'Implementing authentication',
            openFiles: [
                'src/auth.js',
                'src/middleware/auth.js'
            ],
            cursorPositions: {
                'src/auth.js': {
                    line: 45,
                    column: 12
                }
            },
            activeAgents: [
                'AuthExpert',
                'SecurityReviewer'
            ],
            completedSteps: [
                'Design API',
                'Create models'
            ],
            nextSteps: [
                'Implement JWT',
                'Add tests'
            ]
        }
    });
    console.log('Session saved:', sessionId);
    const resumed = await enhancedMemory.resumeSession(sessionId);
    console.log('Resumed context:', resumed.context);
}
async function exampleToolTracking() {
    console.log('\n=== Tool Usage Tracking ===');
    const startTime = Date.now();
    await enhancedMemory.trackToolUsage('memory_usage', {
        action: 'store',
        key: 'test',
        value: 'data'
    }, {
        success: true,
        stored: true
    }, Date.now() - startTime, true);
    await enhancedMemory.trackToolUsage('swarm_init', {
        topology: 'invalid'
    }, null, 150, false, 'Invalid topology specified');
    const stats = await enhancedMemory.getToolStats();
    console.log('Tool effectiveness:', stats);
}
async function exampleTrainingData() {
    console.log('\n=== Training Data ===');
    await enhancedMemory.recordTrainingExample('error_fix', {
        error: 'TypeError: Cannot read property of undefined',
        code: 'const result = user.profile.name;',
        context: 'User object might be null'
    }, {
        fix: 'const result = user?.profile?.name || "Anonymous";',
        explanation: 'Added optional chaining and default value'
    }, {
        errorResolved: true,
        testsPass: true
    }, 0.95, 'Good defensive programming practice');
    const examples = await enhancedMemory.getTrainingData('error_fix', 5);
    console.log('Training examples:', examples.length);
}
async function exampleCodePatterns() {
    console.log('\n=== Code Patterns ===');
    await enhancedMemory.recordCodePattern('src/utils/api.js', 'error_handler', `
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw new ApiError(error.message, error.status);
    }
    `, "javascript");
    const patterns = await enhancedMemory.findSimilarPatterns("javascript", 5);
    console.log('Found patterns:', patterns.map((p)=>p.pattern_name));
}
async function exampleAgentCollaboration() {
    console.log('\n=== Agent Collaboration ===');
    const taskId = 'task-auth-001';
    await enhancedMemory.recordAgentInteraction('Coordinator', 'AuthExpert', 'request', {
        action: 'design',
        component: 'JWT middleware'
    }, taskId);
    await enhancedMemory.recordAgentInteraction('AuthExpert', 'Coordinator', 'response', {
        design: 'JWT with refresh tokens',
        estimatedTime: '2 hours',
        dependencies: [
            'jsonwebtoken',
            'bcrypt'
        ]
    }, taskId);
    const conversation = await enhancedMemory.getAgentConversation(taskId);
    console.log('Agent conversation:', conversation.length, 'messages');
}
async function exampleKnowledgeGraph() {
    console.log('\n=== Knowledge Graph ===');
    await enhancedMemory.addKnowledgeEntity('module', 'AuthModule', 'src/auth/index.js', [
        'UserModel',
        'JWTService',
        'AuthMiddleware'
    ], {
        exports: [
            'authenticate',
            'authorize',
            'refreshToken'
        ],
        dependencies: 4,
        complexity: 'medium'
    });
    await enhancedMemory.addKnowledgeEntity('service', 'JWTService', 'src/auth/jwt.service.js', [
        'AuthModule',
        'ConfigService'
    ], {
        methods: [
            'sign',
            'verify',
            'decode'
        ],
        tokenExpiry: '1h'
    });
    const related = await enhancedMemory.findRelatedEntities('AuthModule');
    console.log('Related entities:', related.map((e)=>e.entity_name));
}
async function exampleErrorLearning() {
    console.log('\n=== Error Learning ===');
    await enhancedMemory.recordError('DatabaseError', 'Connection timeout', 'at Database.connect (db.js:45)', {
        operation: 'startup',
        config: {
            host: 'localhost',
            port: 5432
        }
    }, 'Increased connection timeout to 30s and added retry logic');
    const solutions = await enhancedMemory.getErrorSolutions('DatabaseError');
    console.log('Known solutions:', solutions.map((s)=>s.resolution));
}
async function examplePerformanceTracking() {
    console.log('\n=== Performance Tracking ===');
    await enhancedMemory.recordPerformance('file_analysis', {
        files: 150,
        totalSize: '45MB'
    }, 3420, 125.5, 45.2);
    const trends = await enhancedMemory.getPerformanceTrends('file_analysis', 7);
    console.log('Performance trends:', trends);
}
async function examplePreferenceLearning() {
    console.log('\n=== Preference Learning ===');
    await enhancedMemory.learnPreference('indent_style', 'spaces', 'coding_style', 'inferred', 0.95);
    await enhancedMemory.learnPreference('test_framework', 'jest', 'tool_usage', 'explicit', 1.0);
    const codingPrefs = await enhancedMemory.getPreferences('coding_style');
    console.log('Coding preferences:', codingPrefs);
}
async function exampleSessionExport() {
    console.log('\n=== Session Export ===');
    const sessionId = 'session-example';
    const exportData = await enhancedMemory.exportSessionData(sessionId);
    console.log('Exported data includes:');
    console.log('- Session state:', exportData.session ? 'Yes' : 'No');
    console.log('- Tool usage:', exportData.tools.length, 'records');
    console.log('- Performance:', exportData.performance.length, 'benchmarks');
    console.log('- Interactions:', exportData.interactions.length, 'messages');
}
async function runAllExamples() {
    await exampleSessionManagement();
    await exampleToolTracking();
    await exampleTrainingData();
    await exampleCodePatterns();
    await exampleAgentCollaboration();
    await exampleKnowledgeGraph();
    await exampleErrorLearning();
    await examplePerformanceTracking();
    await examplePreferenceLearning();
    await exampleSessionExport();
    const stats = await enhancedMemory.getDatabaseStats();
    console.log('\n=== Database Statistics ===');
    console.log(stats);
    enhancedMemory.close();
}
export { exampleSessionManagement, exampleToolTracking, exampleTrainingData, exampleCodePatterns, exampleAgentCollaboration, exampleKnowledgeGraph, exampleErrorLearning, examplePerformanceTracking, examplePreferenceLearning, exampleSessionExport, runAllExamples };

//# sourceMappingURL=enhanced-examples.js.map