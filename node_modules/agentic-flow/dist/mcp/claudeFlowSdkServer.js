// In-SDK MCP server for claude-flow tools (no subprocess required)
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { execSync } from 'child_process';
import { logger } from '../utils/logger.js';
/**
 * Create an in-SDK MCP server that provides claude-flow memory and coordination tools
 * This runs in-process without spawning Claude Code CLI subprocess
 */
export const claudeFlowSdkServer = createSdkMcpServer({
    name: 'claude-flow-sdk',
    version: '1.0.0',
    tools: [
        // Memory storage tool
        tool('memory_store', 'Store a value in persistent memory with optional namespace and TTL', {
            key: z.string().describe('Memory key'),
            value: z.string().describe('Value to store'),
            namespace: z.string().optional().default('default').describe('Memory namespace'),
            ttl: z.number().optional().describe('Time-to-live in seconds')
        }, async ({ key, value, namespace, ttl }) => {
            try {
                logger.info('Storing memory', { key, namespace });
                const cmd = `npx claude-flow@alpha memory store "${key}" "${value}" --namespace "${namespace}"${ttl ? ` --ttl ${ttl}` : ''}`;
                const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
                logger.info('Memory stored successfully', { key });
                return {
                    content: [{
                            type: 'text',
                            text: `✅ Stored successfully\n📝 Key: ${key}\n📦 Namespace: ${namespace}\n💾 Size: ${value.length} bytes`
                        }]
                };
            }
            catch (error) {
                logger.error('Failed to store memory', { error: error.message });
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Failed to store: ${error.message}`
                        }],
                    isError: true
                };
            }
        }),
        // Memory retrieval tool
        tool('memory_retrieve', 'Retrieve a value from persistent memory', {
            key: z.string().describe('Memory key'),
            namespace: z.string().optional().default('default').describe('Memory namespace')
        }, async ({ key, namespace }) => {
            try {
                const cmd = `npx claude-flow@alpha memory retrieve "${key}" --namespace "${namespace}"`;
                const result = execSync(cmd, { encoding: 'utf-8' });
                return {
                    content: [{
                            type: 'text',
                            text: `✅ Retrieved:\n${result}`
                        }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Failed to retrieve: ${error.message}`
                        }],
                    isError: true
                };
            }
        }),
        // Memory search tool
        tool('memory_search', 'Search for keys matching a pattern in memory', {
            pattern: z.string().describe('Search pattern (supports wildcards)'),
            namespace: z.string().optional().describe('Memory namespace to search in'),
            limit: z.number().optional().default(10).describe('Maximum results to return')
        }, async ({ pattern, namespace, limit }) => {
            try {
                const cmd = `npx claude-flow@alpha memory search "${pattern}"${namespace ? ` --namespace "${namespace}"` : ''} --limit ${limit}`;
                const result = execSync(cmd, { encoding: 'utf-8' });
                return {
                    content: [{
                            type: 'text',
                            text: `🔍 Search results:\n${result}`
                        }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Search failed: ${error.message}`
                        }],
                    isError: true
                };
            }
        }),
        // Swarm initialization tool
        tool('swarm_init', 'Initialize a multi-agent swarm with specified topology', {
            topology: z.enum(['mesh', 'hierarchical', 'ring', 'star']).describe('Swarm topology'),
            maxAgents: z.number().optional().default(8).describe('Maximum number of agents'),
            strategy: z.enum(['balanced', 'specialized', 'adaptive']).optional().default('balanced').describe('Agent distribution strategy')
        }, async ({ topology, maxAgents, strategy }) => {
            try {
                const cmd = `npx claude-flow@alpha swarm init --topology ${topology} --max-agents ${maxAgents} --strategy ${strategy}`;
                const result = execSync(cmd, { encoding: 'utf-8' });
                return {
                    content: [{
                            type: 'text',
                            text: `🚀 Swarm initialized:\n${result}`
                        }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Swarm init failed: ${error.message}`
                        }],
                    isError: true
                };
            }
        }),
        // Agent spawn tool
        tool('agent_spawn', 'Spawn a new agent in the swarm', {
            type: z.enum(['researcher', 'coder', 'analyst', 'optimizer', 'coordinator']).describe('Agent type'),
            capabilities: z.array(z.string()).optional().describe('Agent capabilities'),
            name: z.string().optional().describe('Custom agent name')
        }, async ({ type, capabilities, name }) => {
            try {
                const capStr = capabilities ? ` --capabilities "${capabilities.join(',')}"` : '';
                const nameStr = name ? ` --name "${name}"` : '';
                const cmd = `npx claude-flow@alpha agent spawn --type ${type}${capStr}${nameStr}`;
                const result = execSync(cmd, { encoding: 'utf-8' });
                return {
                    content: [{
                            type: 'text',
                            text: `🤖 Agent spawned:\n${result}`
                        }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Agent spawn failed: ${error.message}`
                        }],
                    isError: true
                };
            }
        }),
        // Task orchestration tool
        tool('task_orchestrate', 'Orchestrate a complex task across the swarm', {
            task: z.string().describe('Task description or instructions'),
            strategy: z.enum(['parallel', 'sequential', 'adaptive']).optional().default('adaptive').describe('Execution strategy'),
            priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium').describe('Task priority'),
            maxAgents: z.number().optional().describe('Maximum agents to use for this task')
        }, async ({ task, strategy, priority, maxAgents }) => {
            try {
                const maxStr = maxAgents ? ` --max-agents ${maxAgents}` : '';
                const cmd = `npx claude-flow@alpha task orchestrate "${task}" --strategy ${strategy} --priority ${priority}${maxStr}`;
                const result = execSync(cmd, { encoding: 'utf-8' });
                return {
                    content: [{
                            type: 'text',
                            text: `⚡ Task orchestrated:\n${result}`
                        }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Task orchestration failed: ${error.message}`
                        }],
                    isError: true
                };
            }
        }),
        // Swarm status tool
        tool('swarm_status', 'Get current swarm status and metrics', {
            verbose: z.boolean().optional().default(false).describe('Include detailed metrics')
        }, async ({ verbose }) => {
            try {
                const cmd = `npx claude-flow@alpha swarm status${verbose ? ' --verbose' : ''}`;
                const result = execSync(cmd, { encoding: 'utf-8' });
                return {
                    content: [{
                            type: 'text',
                            text: `📊 Swarm status:\n${result}`
                        }]
                };
            }
            catch (error) {
                return {
                    content: [{
                            type: 'text',
                            text: `❌ Status check failed: ${error.message}`
                        }],
                    isError: true
                };
            }
        })
    ]
});
//# sourceMappingURL=claudeFlowSdkServer.js.map