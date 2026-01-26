/**
 * Skills Manager for agentic-flow
 * Creates and manages Claude Code Skills in proper locations
 */
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Get skills directory paths
 */
export function getSkillsPaths() {
    return {
        personal: join(homedir(), '.claude', 'skills'),
        project: join(process.cwd(), '.claude', 'skills'),
    };
}
/**
 * Initialize skills directories
 */
export function initSkillsDirectories(location = 'both') {
    const paths = getSkillsPaths();
    if (location === 'personal' || location === 'both') {
        if (!existsSync(paths.personal)) {
            mkdirSync(paths.personal, { recursive: true });
            console.log(chalk.green('✓') + ` Created personal skills directory: ${chalk.cyan(paths.personal)}`);
        }
        else {
            console.log(chalk.yellow('→') + ` Personal skills directory exists: ${chalk.cyan(paths.personal)}`);
        }
    }
    if (location === 'project' || location === 'both') {
        if (!existsSync(paths.project)) {
            mkdirSync(paths.project, { recursive: true });
            console.log(chalk.green('✓') + ` Created project skills directory: ${chalk.cyan(paths.project)}`);
        }
        else {
            console.log(chalk.yellow('→') + ` Project skills directory exists: ${chalk.cyan(paths.project)}`);
        }
    }
}
/**
 * Create a skill from template
 */
export function createSkill(template, location = 'personal') {
    const paths = getSkillsPaths();
    const baseDir = location === 'personal' ? paths.personal : paths.project;
    // Claude Code requires skills at top level ~/.claude/skills/[skill-name]
    const skillDir = join(baseDir, template.name);
    // Create skill directory
    if (!existsSync(skillDir)) {
        mkdirSync(skillDir, { recursive: true });
    }
    // Create SKILL.md
    const skillMdPath = join(skillDir, 'SKILL.md');
    writeFileSync(skillMdPath, template.content, 'utf-8');
    console.log(chalk.green('✓') + ` Created SKILL.md: ${chalk.cyan(skillMdPath)}`);
    // Create scripts
    if (template.scripts) {
        const scriptsDir = join(skillDir, 'scripts');
        if (!existsSync(scriptsDir)) {
            mkdirSync(scriptsDir, { recursive: true });
        }
        for (const [filename, content] of Object.entries(template.scripts)) {
            const scriptPath = join(scriptsDir, filename);
            writeFileSync(scriptPath, content, 'utf-8');
            console.log(chalk.green('✓') + ` Created script: ${chalk.cyan(scriptPath)}`);
        }
    }
    // Create resources
    if (template.resources) {
        const resourcesDir = join(skillDir, 'resources');
        if (!existsSync(resourcesDir)) {
            mkdirSync(resourcesDir, { recursive: true });
        }
        for (const [filename, content] of Object.entries(template.resources)) {
            const resourcePath = join(resourcesDir, filename);
            writeFileSync(resourcePath, content, 'utf-8');
            console.log(chalk.green('✓') + ` Created resource: ${chalk.cyan(resourcePath)}`);
        }
    }
    console.log('');
    console.log(chalk.bold.green('✨ Skill created successfully!'));
    console.log('');
    console.log(chalk.white('Location: ') + chalk.cyan(skillDir));
    console.log(chalk.white('Category: ') + chalk.yellow(template.category));
    console.log(chalk.white('Difficulty: ') + chalk.yellow(template.difficulty));
    console.log(chalk.white('Est. Time: ') + chalk.yellow(template.estimatedTime));
    console.log('');
}
/**
 * List installed skills
 */
export function listSkills() {
    const paths = getSkillsPaths();
    console.log('');
    console.log(chalk.bold.white('📚 Installed Claude Code Skills'));
    console.log(chalk.gray('═══════════════════════════════════════════════════════════════'));
    console.log('');
    // Personal skills
    if (existsSync(paths.personal)) {
        const personalSkills = findSkills(paths.personal);
        if (personalSkills.length > 0) {
            console.log(chalk.bold.cyan('Personal Skills') + chalk.gray(' (~/.claude/skills/)'));
            personalSkills.forEach(skill => {
                console.log(chalk.green('  •') + ' ' + chalk.white(skill.name));
                console.log(chalk.gray('     ' + skill.description.slice(0, 80) + '...'));
            });
            console.log('');
        }
    }
    // Project skills
    if (existsSync(paths.project)) {
        const projectSkills = findSkills(paths.project);
        if (projectSkills.length > 0) {
            console.log(chalk.bold.cyan('Project Skills') + chalk.gray(' (.claude/skills/)'));
            projectSkills.forEach(skill => {
                console.log(chalk.green('  •') + ' ' + chalk.white(skill.name));
                console.log(chalk.gray('     ' + skill.description.slice(0, 80) + '...'));
            });
            console.log('');
        }
    }
    console.log(chalk.gray('═══════════════════════════════════════════════════════════════'));
    console.log('');
}
/**
 * Find all skills in a directory
 */
function findSkills(dir) {
    const skills = [];
    function scanDir(currentDir) {
        if (!existsSync(currentDir))
            return;
        const entries = readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const skillMdPath = join(currentDir, entry.name, 'SKILL.md');
                if (existsSync(skillMdPath)) {
                    const content = readFileSync(skillMdPath, 'utf-8');
                    const match = content.match(/---\n([\s\S]*?)\n---/);
                    if (match) {
                        const yaml = match[1];
                        const nameMatch = yaml.match(/name:\s*["']?([^"'\n]+)["']?/);
                        const descMatch = yaml.match(/description:\s*["']?([^"'\n]+)["']?/);
                        if (nameMatch && descMatch) {
                            skills.push({
                                name: nameMatch[1],
                                description: descMatch[1],
                                path: join(currentDir, entry.name),
                            });
                        }
                    }
                }
                else {
                    // Recurse into subdirectories
                    scanDir(join(currentDir, entry.name));
                }
            }
        }
    }
    scanDir(dir);
    return skills;
}
/**
 * Generate skill template
 */
export function generateSkillTemplate(name, description, category) {
    const skillName = name.toLowerCase().replace(/\s+/g, '-');
    return {
        name: skillName,
        description,
        category,
        difficulty: 'beginner',
        estimatedTime: '5 minutes',
        content: `---
name: "${name}"
description: "${description}"
---

# ${name}

## What This Skill Does

${description}

## Prerequisites

- agentic-flow installed (\`npm install -g agentic-flow@latest\`)
- Node.js 18+

## Quick Start

\`\`\`bash
npx agentic-flow ${skillName}
\`\`\`

## Step-by-Step Guide

1. **Step 1**: First action
   \`\`\`bash
   npx agentic-flow ${skillName} --option value
   \`\`\`

2. **Step 2**: Second action
   - Details about this step

3. **Step 3**: Final action
   - Verification steps

## Expected Output

\`\`\`
✓ Operation completed successfully
→ Results: [details]
\`\`\`

## Advanced Options

### Option 1: Advanced Feature
\`\`\`bash
npx agentic-flow ${skillName} --advanced
\`\`\`

### Option 2: Custom Configuration
\`\`\`bash
npx agentic-flow ${skillName} --config path/to/config.json
\`\`\`

## Troubleshooting

### Issue: Common Problem
**Solution**: How to resolve

### Issue: Another Problem
**Solution**: Resolution steps

## Learn More

- Documentation: \`docs/${category}/${skillName}.md\`
- Examples: \`examples/${skillName}/\`
- Related Skills: [list related skills]

## Resources

- [Resource 1]
- [Resource 2]
`,
    };
}
/**
 * Initialize agentic-flow skills
 */
export async function handleSkillsCommand(args) {
    const command = args[0];
    if (!command || command === 'help') {
        printSkillsHelp();
        return;
    }
    switch (command) {
        case 'init':
            await handleSkillsInit(args.slice(1));
            break;
        case 'list':
            listSkills();
            break;
        case 'create':
            await handleSkillsCreate(args.slice(1));
            break;
        case 'init-builder':
            await handleSkillBuilderInit(args.slice(1));
            break;
        default:
            console.log(chalk.red('Unknown command: ' + command));
            printSkillsHelp();
    }
}
/**
 * Handle skills init command
 */
async function handleSkillsInit(args) {
    const location = args[0] || 'both';
    const includeBuilder = args.includes('--with-builder');
    console.log('');
    console.log(chalk.bold.cyan('🎨 Initializing agentic-flow Skills'));
    console.log(chalk.gray('═══════════════════════════════════════════════════════════════'));
    console.log('');
    initSkillsDirectories(location);
    if (includeBuilder) {
        console.log('');
        console.log(chalk.yellow('→') + ' Installing Skill Builder...');
        await installSkillBuilder(location);
    }
    console.log('');
    console.log(chalk.bold.green('✓ Skills directories initialized!'));
    console.log('');
    console.log(chalk.white('Next steps:'));
    if (includeBuilder) {
        console.log(chalk.gray('  1. List skills:    ') + chalk.cyan('npx agentic-flow skills list'));
        console.log(chalk.gray('  2. Create a skill: ') + chalk.cyan('Use Claude Code with "skill-builder" skill'));
        console.log(chalk.gray('  3. Create example: ') + chalk.cyan('npx agentic-flow skills create'));
    }
    else {
        console.log(chalk.gray('  1. Install builder:') + chalk.cyan('npx agentic-flow skills init-builder'));
        console.log(chalk.gray('  2. Create a skill: ') + chalk.cyan('npx agentic-flow skills create'));
        console.log(chalk.gray('  3. List skills:    ') + chalk.cyan('npx agentic-flow skills list'));
    }
    console.log(chalk.gray('  4. Learn more:     ') + chalk.cyan('docs/plans/skills/SKILLS_PLAN.md'));
    console.log('');
}
/**
 * Handle skill-builder init command
 */
async function handleSkillBuilderInit(args) {
    const location = args[0] || 'project';
    console.log('');
    console.log(chalk.bold.cyan('🎨 Installing Skill Builder Framework'));
    console.log(chalk.gray('═══════════════════════════════════════════════════════════════'));
    console.log('');
    await installSkillBuilder(location);
    console.log('');
    console.log(chalk.bold.green('✓ Skill Builder installed successfully!'));
    console.log('');
    console.log(chalk.white('Usage:'));
    console.log(chalk.gray('  • Ask Claude: ') + chalk.cyan('"I want to create a new skill for [task]"'));
    console.log(chalk.gray('  • Use script:  ') + chalk.cyan('.claude/skills/skill-builder/scripts/generate-skill.sh'));
    console.log(chalk.gray('  • Validate:    ') + chalk.cyan('.claude/skills/skill-builder/scripts/validate-skill.sh <path>'));
    console.log('');
    console.log(chalk.white('Documentation:'));
    console.log(chalk.gray('  • README:      ') + chalk.cyan('.claude/skills/skill-builder/README.md'));
    console.log(chalk.gray('  • Spec:        ') + chalk.cyan('.claude/skills/skill-builder/docs/SPECIFICATION.md'));
    console.log('');
}
/**
 * Install skill-builder framework
 */
async function installSkillBuilder(location) {
    const paths = getSkillsPaths();
    const locations = location === 'both' ? ['personal', 'project'] : [location];
    for (const loc of locations) {
        const baseDir = loc === 'personal' ? paths.personal : paths.project;
        // Claude Code requires skills at top level, NOT in namespaces
        const builderDir = join(baseDir, 'skill-builder');
        // Create directory structure
        mkdirSync(join(builderDir, 'scripts'), { recursive: true });
        mkdirSync(join(builderDir, 'resources', 'templates'), { recursive: true });
        mkdirSync(join(builderDir, 'resources', 'schemas'), { recursive: true });
        mkdirSync(join(builderDir, 'docs'), { recursive: true });
        // Try multiple source locations
        const possibleSources = [
            join(process.cwd(), '.claude', 'skills', 'skill-builder'), // Project root
            join(__dirname, '..', '..', '.claude', 'skills', 'skill-builder'), // Package dist
            join(__dirname, '..', '..', '..', '.claude', 'skills', 'skill-builder'), // Monorepo root
        ];
        let sourceDir = null;
        for (const src of possibleSources) {
            if (existsSync(src) && existsSync(join(src, 'SKILL.md'))) {
                sourceDir = src;
                break;
            }
        }
        if (sourceDir) {
            // Copy all files recursively
            copyRecursive(sourceDir, builderDir);
            console.log(chalk.green('✓') + ` Installed skill-builder to ${chalk.cyan(loc)} location`);
        }
        else {
            // Create from templates if source doesn't exist
            createSkillBuilderFromTemplate(builderDir);
            console.log(chalk.green('✓') + ` Created skill-builder in ${chalk.cyan(loc)} location`);
        }
    }
}
/**
 * Copy directory recursively
 */
function copyRecursive(src, dest) {
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);
        if (entry.isDirectory()) {
            mkdirSync(destPath, { recursive: true });
            copyRecursive(srcPath, destPath);
        }
        else {
            const content = readFileSync(srcPath, 'utf-8');
            writeFileSync(destPath, content, 'utf-8');
        }
    }
}
/**
 * Create skill-builder from template (fallback)
 */
function createSkillBuilderFromTemplate(builderDir) {
    // Create minimal SKILL.md
    const skillMd = `---
name: "Skill Builder"
description: "Create new Claude Code Skills with proper YAML frontmatter, progressive disclosure structure, and complete directory organization. Use when you need to build custom skills for specific workflows, generate skill templates, or understand the Claude Skills specification."
---

# Skill Builder

## What This Skill Does

Creates production-ready Claude Code Skills with proper YAML frontmatter, progressive disclosure architecture, and complete file/folder structure.

## Prerequisites

- Claude Code 2.0+ or Claude.ai with Skills support
- Basic understanding of Markdown and YAML
- Text editor or IDE

## Quick Start

### Creating Your First Skill

\`\`\`bash
# 1. Create skill directory (MUST be at top level!)
mkdir -p ~/.claude/skills/my-first-skill

# 2. Create SKILL.md with proper format
cat > ~/.claude/skills/my-first-skill/SKILL.md << 'EOF'
---
name: "My First Skill"
description: "Brief description of what this skill does and when Claude should use it."
---

# My First Skill

## What This Skill Does
[Your instructions here]

## Quick Start
[Basic usage]
EOF
\`\`\`

## Complete Specification

### YAML Frontmatter (REQUIRED)

Every SKILL.md must start with YAML frontmatter:

\`\`\`yaml
---
name: "Skill Name"                    # REQUIRED: Max 64 chars
description: "What this skill does    # REQUIRED: Max 1024 chars
and when Claude should use it."       # Include BOTH what & when
---
\`\`\`

For complete documentation, see: .claude/skills/skill-builder/docs/SPECIFICATION.md
`;
    writeFileSync(join(builderDir, 'SKILL.md'), skillMd, 'utf-8');
    // Create minimal README
    const readme = `# Skill Builder

Meta-skill for creating Claude Code Skills with proper formatting and structure.

## Usage

Ask Claude Code: "I want to create a new skill for [task]"

## Documentation

- Full specification: docs/SPECIFICATION.md
- Templates: resources/templates/
- Scripts: scripts/

## Quick Reference

- Max name length: 64 characters
- Max description: 1024 characters
- Description must include "what" and "when"
- Only name and description are required in YAML
`;
    writeFileSync(join(builderDir, 'README.md'), readme, 'utf-8');
}
/**
 * Handle skills create command
 */
async function handleSkillsCreate(args) {
    console.log('');
    console.log(chalk.bold.cyan('🎨 Creating agentic-flow Skills'));
    console.log(chalk.gray('═══════════════════════════════════════════════════════════════'));
    console.log('');
    // Ensure directories exist
    initSkillsDirectories('project');
    const paths = getSkillsPaths();
    const projectSkillsDir = paths.project;
    // Create 4 agentic-flow specific skills
    const skills = [
        createAgentDBVectorSearchSkill(),
        createAgentDBMemoryPatternsSkill(),
        createSwarmOrchestrationSkill(),
        createReasoningBankSkill()
    ];
    let count = 0;
    for (const skillContent of skills) {
        const skillName = extractSkillName(skillContent);
        // Claude Code requires skills at TOP LEVEL: .claude/skills/[skill-name]/
        // NOT in subdirectories: .claude/skills/namespace/[skill-name]/
        const skillDir = join(projectSkillsDir, skillName);
        mkdirSync(skillDir, { recursive: true });
        writeFileSync(join(skillDir, 'SKILL.md'), skillContent, 'utf-8');
        count++;
        console.log(chalk.green(`  ${count}. ✓`) + ` Created ${chalk.cyan(skillName)} skill`);
    }
    console.log('');
    console.log(chalk.gray('═══════════════════════════════════════════════════════════════'));
    console.log('');
    console.log(chalk.bold.green(`✓ Created ${count} agentic-flow skills!`));
    console.log('');
    console.log(chalk.white('Skills installed:'));
    console.log(chalk.gray('  • AgentDB Vector Search    ') + chalk.dim('- Semantic search with vector embeddings'));
    console.log(chalk.gray('  • AgentDB Memory Patterns  ') + chalk.dim('- Memory management & persistence'));
    console.log(chalk.gray('  • Swarm Orchestration      ') + chalk.dim('- Multi-agent coordination'));
    console.log(chalk.gray('  • ReasoningBank Intelligence') + chalk.dim('- Pattern learning & adaptation'));
    console.log('');
    console.log(chalk.white('Next: ') + chalk.cyan('npx agentic-flow skills list') + chalk.gray(' to see all skills'));
    console.log('');
}
/**
 * Extract skill name from YAML frontmatter
 */
function extractSkillName(content) {
    const match = content.match(/name:\s*["']([^"']+)["']/);
    if (match) {
        return match[1].toLowerCase().replace(/\s+/g, '-');
    }
    return 'unknown-skill';
}
/**
 * Create AgentDB Vector Search skill
 */
function createAgentDBVectorSearchSkill() {
    return `---
name: "AgentDB Vector Search"
description: "Implement semantic vector search with AgentDB for intelligent document retrieval, similarity matching, and context-aware querying. Use when building RAG systems, semantic search engines, or intelligent knowledge bases."
---

# AgentDB Vector Search

## What This Skill Does

Implements vector-based semantic search using AgentDB's high-performance vector database with 150x-12,500x faster operations than traditional solutions. Enables similarity search, hybrid search (vector + metadata), and real-time embedding generation.

## Prerequisites

- agentic-flow v1.5.11+ or agentdb v1.0.4+
- Node.js 18+
- OpenAI API key (for embeddings) or custom embedding model

## Quick Start

\`\`\`typescript
import { AgentDB } from 'agentdb';

// Initialize AgentDB with vector support
const db = new AgentDB({
  persist: true,
  vectorDimensions: 1536, // OpenAI ada-002 dimensions
  enableVectorIndex: true
});

// Store documents with vectors
await db.storeMemory({
  text: "The quantum computer achieved 100 qubits",
  metadata: { category: "technology", date: "2025-01-15" },
  embedding: await generateEmbedding(text) // Your embedding function
});

// Semantic search
const results = await db.searchSimilar(
  queryEmbedding,
  { limit: 10, threshold: 0.7 }
);
\`\`\`

## Core Features

### 1. Vector Storage
\`\`\`typescript
// Store with automatic embedding
await db.storeWithEmbedding({
  content: "Your document text",
  metadata: { source: "docs", page: 42 }
});
\`\`\`

### 2. Similarity Search
\`\`\`typescript
// Find similar documents
const similar = await db.findSimilar("quantum computing", {
  limit: 5,
  minScore: 0.75
});
\`\`\`

### 3. Hybrid Search (Vector + Metadata)
\`\`\`typescript
// Combine vector similarity with metadata filtering
const results = await db.hybridSearch({
  query: "machine learning models",
  filters: {
    category: "research",
    date: { $gte: "2024-01-01" }
  },
  limit: 20
});
\`\`\`

## Advanced Usage

### RAG (Retrieval Augmented Generation)
\`\`\`typescript
// Build RAG pipeline
async function ragQuery(question: string) {
  // 1. Get relevant context
  const context = await db.searchSimilar(
    await embed(question),
    { limit: 5, threshold: 0.7 }
  );

  // 2. Generate answer with context
  const prompt = \`Context: \${context.map(c => c.text).join('\\n')}
Question: \${question}\`;

  return await llm.generate(prompt);
}
\`\`\`

### Batch Operations
\`\`\`typescript
// Efficient batch storage
await db.batchStore(documents.map(doc => ({
  text: doc.content,
  embedding: doc.vector,
  metadata: doc.meta
})));
\`\`\`

## Performance Tips

- **Indexing**: Enable vector index for 10-100x faster searches
- **Batch Size**: Use batch operations for 1000+ documents
- **Dimensions**: Match embedding model (1536 for OpenAI ada-002)
- **Threshold**: Start at 0.7 for quality results

## Troubleshooting

### Issue: Slow search performance
**Solution**: Enable vector index: \`enableVectorIndex: true\`

### Issue: Poor relevance
**Solution**: Adjust similarity threshold or use hybrid search

## Learn More

- AgentDB Docs: packages/agentdb/README.md
- Vector DB API: packages/agentdb/docs/vector-api.md
- Performance Guide: docs/agentdb/performance.md
`;
}
/**
 * Create AgentDB Memory Patterns skill
 */
function createAgentDBMemoryPatternsSkill() {
    return `---
name: "AgentDB Memory Patterns"
description: "Implement persistent memory patterns for AI agents using AgentDB. Includes session memory, long-term storage, pattern learning, and context management. Use when building stateful agents, chat systems, or intelligent assistants."
---

# AgentDB Memory Patterns

## What This Skill Does

Provides memory management patterns for AI agents using AgentDB's persistent storage and ReasoningBank integration. Enables agents to remember conversations, learn from interactions, and maintain context across sessions.

## Prerequisites

- agentic-flow v1.5.11+ or agentdb v1.0.4+
- Node.js 18+
- Understanding of agent architectures

## Quick Start

\`\`\`typescript
import { AgentDB, MemoryManager } from 'agentdb';

// Initialize memory system
const memory = new MemoryManager({
  agentId: 'assistant-001',
  persist: true,
  ttl: 3600 * 24 * 30 // 30 days
});

// Store interaction
await memory.store({
  role: 'user',
  content: 'What is the capital of France?',
  timestamp: Date.now()
});

await memory.store({
  role: 'assistant',
  content: 'The capital of France is Paris.',
  timestamp: Date.now()
});

// Retrieve context
const context = await memory.getRecentContext({ limit: 10 });
\`\`\`

## Memory Patterns

### 1. Session Memory
\`\`\`typescript
class SessionMemory {
  async storeMessage(role: string, content: string) {
    return await db.storeMemory({
      sessionId: this.sessionId,
      role,
      content,
      timestamp: Date.now()
    });
  }

  async getSessionHistory(limit = 20) {
    return await db.query({
      filters: { sessionId: this.sessionId },
      orderBy: 'timestamp',
      limit
    });
  }
}
\`\`\`

### 2. Long-Term Memory
\`\`\`typescript
// Store important facts
await db.storeFact({
  category: 'user_preference',
  key: 'language',
  value: 'English',
  confidence: 1.0,
  source: 'explicit'
});

// Retrieve facts
const prefs = await db.getFacts({
  category: 'user_preference'
});
\`\`\`

### 3. Pattern Learning
\`\`\`typescript
// Learn from successful interactions
await db.storePattern({
  trigger: 'user_asks_time',
  response: 'provide_formatted_time',
  success: true,
  context: { timezone: 'UTC' }
});

// Apply learned patterns
const pattern = await db.matchPattern(currentContext);
\`\`\`

## Advanced Patterns

### Hierarchical Memory
\`\`\`typescript
// Organize memory in hierarchy
await memory.organize({
  immediate: recentMessages,    // Last 10 messages
  shortTerm: sessionContext,    // Current session
  longTerm: importantFacts,     // Persistent facts
  semantic: embeddedKnowledge   // Vector search
});
\`\`\`

### Memory Consolidation
\`\`\`typescript
// Periodically consolidate memories
await memory.consolidate({
  strategy: 'importance',       // Keep important memories
  maxSize: 10000,              // Size limit
  minScore: 0.5                // Relevance threshold
});
\`\`\`

## Integration with ReasoningBank

\`\`\`typescript
import { ReasoningBank } from 'agentic-flow/reasoningbank';

// Connect memory to reasoning
const rb = new ReasoningBank({
  memory: memory,
  learningRate: 0.1
});

// Learn from outcomes
await rb.recordOutcome({
  task: 'summarize_document',
  approach: 'extractive',
  success: true,
  metrics: { accuracy: 0.95 }
});

// Get optimal strategy
const strategy = await rb.getOptimalStrategy('summarize_document');
\`\`\`

## Best Practices

1. **Prune regularly**: Remove outdated or low-value memories
2. **Use TTL**: Set time-to-live for ephemeral data
3. **Index metadata**: Enable fast filtering by sessionId, userId
4. **Compress old data**: Archive infrequently accessed memories

## Troubleshooting

### Issue: Memory growing too large
**Solution**: Enable auto-pruning or set TTL values

### Issue: Context not relevant
**Solution**: Use vector search for semantic memory retrieval

## Learn More

- Memory API: packages/agentdb/docs/memory-api.md
- ReasoningBank: agentic-flow/src/reasoningbank/README.md
`;
}
/**
 * Create Swarm Orchestration skill
 */
function createSwarmOrchestrationSkill() {
    return `---
name: "Swarm Orchestration"
description: "Orchestrate multi-agent swarms with agentic-flow for parallel task execution, dynamic topology, and intelligent coordination. Use when scaling beyond single agents, implementing complex workflows, or building distributed AI systems."
---

# Swarm Orchestration

## What This Skill Does

Orchestrates multi-agent swarms using agentic-flow's advanced coordination system. Supports mesh, hierarchical, and adaptive topologies with automatic task distribution, load balancing, and fault tolerance.

## Prerequisites

- agentic-flow v1.5.11+
- Node.js 18+
- Understanding of distributed systems (helpful)

## Quick Start

\`\`\`bash
# Initialize swarm
npx agentic-flow hooks swarm-init --topology mesh --max-agents 5

# Spawn agents
npx agentic-flow hooks agent-spawn --type coder
npx agentic-flow hooks agent-spawn --type tester
npx agentic-flow hooks agent-spawn --type reviewer

# Orchestrate task
npx agentic-flow hooks task-orchestrate \\
  --task "Build REST API with tests" \\
  --mode parallel
\`\`\`

## Topology Patterns

### 1. Mesh (Peer-to-Peer)
\`\`\`typescript
// Equal peers, distributed decision-making
await swarm.init({
  topology: 'mesh',
  agents: ['coder', 'tester', 'reviewer'],
  communication: 'broadcast'
});
\`\`\`

### 2. Hierarchical (Queen-Worker)
\`\`\`typescript
// Centralized coordination, specialized workers
await swarm.init({
  topology: 'hierarchical',
  queen: 'architect',
  workers: ['backend-dev', 'frontend-dev', 'db-designer']
});
\`\`\`

### 3. Adaptive (Dynamic)
\`\`\`typescript
// Automatically switches topology based on task
await swarm.init({
  topology: 'adaptive',
  optimization: 'task-complexity'
});
\`\`\`

## Task Orchestration

### Parallel Execution
\`\`\`typescript
// Execute tasks concurrently
const results = await swarm.execute({
  tasks: [
    { agent: 'coder', task: 'Implement API endpoints' },
    { agent: 'frontend', task: 'Build UI components' },
    { agent: 'tester', task: 'Write test suite' }
  ],
  mode: 'parallel',
  timeout: 300000 // 5 minutes
});
\`\`\`

### Pipeline Execution
\`\`\`typescript
// Sequential pipeline with dependencies
await swarm.pipeline([
  { stage: 'design', agent: 'architect' },
  { stage: 'implement', agent: 'coder', after: 'design' },
  { stage: 'test', agent: 'tester', after: 'implement' },
  { stage: 'review', agent: 'reviewer', after: 'test' }
]);
\`\`\`

### Adaptive Execution
\`\`\`typescript
// Let swarm decide execution strategy
await swarm.autoOrchestrate({
  goal: 'Build production-ready API',
  constraints: {
    maxTime: 3600,
    maxAgents: 8,
    quality: 'high'
  }
});
\`\`\`

## Memory Coordination

\`\`\`typescript
// Share state across swarm
await swarm.memory.store('api-schema', {
  endpoints: [...],
  models: [...]
});

// Agents read shared memory
const schema = await swarm.memory.retrieve('api-schema');
\`\`\`

## Advanced Features

### Load Balancing
\`\`\`typescript
// Automatic work distribution
await swarm.enableLoadBalancing({
  strategy: 'dynamic',
  metrics: ['cpu', 'memory', 'task-queue']
});
\`\`\`

### Fault Tolerance
\`\`\`typescript
// Handle agent failures
await swarm.setResiliency({
  retry: { maxAttempts: 3, backoff: 'exponential' },
  fallback: 'reassign-task'
});
\`\`\`

### Performance Monitoring
\`\`\`typescript
// Track swarm metrics
const metrics = await swarm.getMetrics();
// { throughput, latency, success_rate, agent_utilization }
\`\`\`

## Integration with Hooks

\`\`\`bash
# Pre-task coordination
npx agentic-flow hooks pre-task --description "Build API"

# Post-task synchronization
npx agentic-flow hooks post-task --task-id "task-123"

# Session restore
npx agentic-flow hooks session-restore --session-id "swarm-001"
\`\`\`

## Best Practices

1. **Start small**: Begin with 2-3 agents, scale up
2. **Use memory**: Share context through swarm memory
3. **Monitor metrics**: Track performance and bottlenecks
4. **Enable hooks**: Automatic coordination and sync
5. **Set timeouts**: Prevent hung tasks

## Troubleshooting

### Issue: Agents not coordinating
**Solution**: Verify memory access and enable hooks

### Issue: Poor performance
**Solution**: Check topology (use adaptive) and enable load balancing

## Learn More

- Swarm Guide: docs/swarm/orchestration.md
- Topology Patterns: docs/swarm/topologies.md
- Hooks Integration: docs/hooks/coordination.md
`;
}
/**
 * Create ReasoningBank skill
 */
function createReasoningBankSkill() {
    return `---
name: "ReasoningBank Intelligence"
description: "Implement adaptive learning with ReasoningBank for pattern recognition, strategy optimization, and continuous improvement. Use when building self-learning agents, optimizing workflows, or implementing meta-cognitive systems."
---

# ReasoningBank Intelligence

## What This Skill Does

Implements ReasoningBank's adaptive learning system for AI agents to learn from experience, recognize patterns, and optimize strategies over time. Enables meta-cognitive capabilities and continuous improvement.

## Prerequisites

- agentic-flow v1.5.11+
- AgentDB v1.0.4+ (for persistence)
- Node.js 18+

## Quick Start

\`\`\`typescript
import { ReasoningBank } from 'agentic-flow/reasoningbank';

// Initialize ReasoningBank
const rb = new ReasoningBank({
  persist: true,
  learningRate: 0.1,
  adapter: 'agentdb' // Use AgentDB for storage
});

// Record task outcome
await rb.recordExperience({
  task: 'code_review',
  approach: 'static_analysis_first',
  outcome: {
    success: true,
    metrics: {
      bugs_found: 5,
      time_taken: 120,
      false_positives: 1
    }
  },
  context: {
    language: 'typescript',
    complexity: 'medium'
  }
});

// Get optimal strategy
const strategy = await rb.recommendStrategy('code_review', {
  language: 'typescript',
  complexity: 'high'
});
\`\`\`

## Core Features

### 1. Pattern Recognition
\`\`\`typescript
// Learn patterns from data
await rb.learnPattern({
  pattern: 'api_errors_increase_after_deploy',
  triggers: ['deployment', 'traffic_spike'],
  actions: ['rollback', 'scale_up'],
  confidence: 0.85
});

// Match patterns
const matches = await rb.matchPatterns(currentSituation);
\`\`\`

### 2. Strategy Optimization
\`\`\`typescript
// Compare strategies
const comparison = await rb.compareStrategies('bug_fixing', [
  'tdd_approach',
  'debug_first',
  'reproduce_then_fix'
]);

// Get best strategy
const best = comparison.strategies[0];
console.log(\`Best: \${best.name} (score: \${best.score})\`);
\`\`\`

### 3. Continuous Learning
\`\`\`typescript
// Enable auto-learning from all tasks
await rb.enableAutoLearning({
  threshold: 0.7,        // Only learn from high-confidence outcomes
  updateFrequency: 100   // Update models every 100 experiences
});
\`\`\`

## Advanced Usage

### Meta-Learning
\`\`\`typescript
// Learn about learning
await rb.metaLearn({
  observation: 'parallel_execution_faster_for_independent_tasks',
  confidence: 0.95,
  applicability: {
    task_types: ['batch_processing', 'data_transformation'],
    conditions: ['tasks_independent', 'io_bound']
  }
});
\`\`\`

### Transfer Learning
\`\`\`typescript
// Apply knowledge from one domain to another
await rb.transferKnowledge({
  from: 'code_review_javascript',
  to: 'code_review_typescript',
  similarity: 0.8
});
\`\`\`

### Adaptive Agents
\`\`\`typescript
// Create self-improving agent
class AdaptiveAgent {
  async execute(task: Task) {
    // Get optimal strategy
    const strategy = await rb.recommendStrategy(task.type, task.context);

    // Execute with strategy
    const result = await this.executeWithStrategy(task, strategy);

    // Learn from outcome
    await rb.recordExperience({
      task: task.type,
      approach: strategy.name,
      outcome: result,
      context: task.context
    });

    return result;
  }
}
\`\`\`

## Integration with AgentDB

\`\`\`typescript
// Persist ReasoningBank data
await rb.configure({
  storage: {
    type: 'agentdb',
    options: {
      database: './reasoning-bank.db',
      enableVectorSearch: true
    }
  }
});

// Query learned patterns
const patterns = await rb.query({
  category: 'optimization',
  minConfidence: 0.8,
  timeRange: { last: '30d' }
});
\`\`\`

## Performance Metrics

\`\`\`typescript
// Track learning effectiveness
const metrics = await rb.getMetrics();
console.log(\`
  Total Experiences: \${metrics.totalExperiences}
  Patterns Learned: \${metrics.patternsLearned}
  Strategy Success Rate: \${metrics.strategySuccessRate}
  Improvement Over Time: \${metrics.improvement}
\`);
\`\`\`

## Best Practices

1. **Record consistently**: Log all task outcomes, not just successes
2. **Provide context**: Rich context improves pattern matching
3. **Set thresholds**: Filter low-confidence learnings
4. **Review periodically**: Audit learned patterns for quality
5. **Use vector search**: Enable semantic pattern matching

## Troubleshooting

### Issue: Poor recommendations
**Solution**: Ensure sufficient training data (100+ experiences per task type)

### Issue: Slow pattern matching
**Solution**: Enable vector indexing in AgentDB

### Issue: Memory growing large
**Solution**: Set TTL for old experiences or enable pruning

## Learn More

- ReasoningBank Guide: agentic-flow/src/reasoningbank/README.md
- AgentDB Integration: packages/agentdb/docs/reasoningbank.md
- Pattern Learning: docs/reasoning/patterns.md
`;
}
/**
 * Print skills help
 */
function printSkillsHelp() {
    console.log(`
${chalk.bold.cyan('🎨 agentic-flow Skills Manager')}

${chalk.white('USAGE:')}
  npx agentic-flow skills <command> [options]

${chalk.white('COMMANDS:')}
  ${chalk.cyan('init')} [location] [--with-builder]
                          Initialize skills directories
                          location: personal | project | both (default: both)
                          --with-builder: Also install skill-builder framework

  ${chalk.cyan('init-builder')} [location]
                          Install skill-builder framework only
                          location: personal | project | both (default: project)

  ${chalk.cyan('list')}                  List all installed skills

  ${chalk.cyan('create')}                Create example agentic-flow skills
                          (AgentDB, swarm orchestration, reasoning bank)

  ${chalk.cyan('help')}                  Show this help message

${chalk.white('SKILLS LOCATIONS:')}
  ${chalk.gray('Personal:')} ~/.claude/skills/              (Available across all projects)
  ${chalk.gray('Project:')}  <project>/.claude/skills/      (Team-shared, version controlled)

${chalk.white('EXAMPLES:')}
  # Initialize with skill-builder
  npx agentic-flow skills init --with-builder

  # Install skill-builder only
  npx agentic-flow skills init-builder

  # Create agentic-flow specific skills
  npx agentic-flow skills create

  # List all installed skills
  npx agentic-flow skills list

${chalk.white('SKILL-BUILDER FEATURES:')}
  • Complete Claude Code Skills specification
  • Interactive skill generator script
  • 10-step validation script
  • Templates (minimal + full-featured)
  • JSON schema for validation
  • Official Anthropic docs included

${chalk.white('DOCUMENTATION:')}
  Plan:     docs/plans/skills/SKILLS_PLAN.md
  Roadmap:  docs/plans/skills/IMPLEMENTATION_ROADMAP.md
  Builder:  .claude/skills/skill-builder/README.md

${chalk.white('HOW IT WORKS:')}
  1. Skills are auto-detected by Claude Code on startup
  2. Claude loads name + description into system prompt
  3. When triggered, Claude reads SKILL.md from filesystem
  4. Only active skill enters context (zero penalty for 100+ skills)
`);
}
