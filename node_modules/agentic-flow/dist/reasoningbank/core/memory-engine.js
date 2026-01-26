/**
 * ReasoningBank Memory Engine
 * Implements the 4-phase learning loop: RETRIEVE → JUDGE → DISTILL → CONSOLIDATE
 */
import { ReasoningBankDB } from './database.js';
import { createEmbeddingProvider, cosineSimilarity } from '../utils/embeddings.js';
import { piiScrubber } from '../utils/pii-scrubber.js';
export class ReasoningBankEngine {
    db;
    embeddings;
    piiEnabled;
    weights;
    defaultK;
    minConfidence;
    consolidationThreshold;
    memoriesSinceConsolidation = 0;
    constructor(config) {
        this.db = new ReasoningBankDB(config.dbPath);
        this.embeddings = createEmbeddingProvider(config.embeddings?.provider || 'hash', {
            apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
            model: config.embeddings?.model
        });
        this.piiEnabled = config.piiScrub?.enabled !== false;
        this.weights = {
            alpha: config.retrieval?.weights?.alpha || 0.65, // Similarity
            beta: config.retrieval?.weights?.beta || 0.15, // Recency
            gamma: config.retrieval?.weights?.gamma || 0.20, // Reliability
            delta: config.retrieval?.weights?.delta || 0.10 // Diversity penalty
        };
        this.defaultK = config.retrieval?.k || 3;
        this.minConfidence = config.retrieval?.minConfidence || 0.3;
        this.consolidationThreshold = config.consolidation?.scheduleEvery || 20;
    }
    /**
     * Phase 1: RETRIEVE - Get relevant memories using 4-factor scoring
     */
    async retrieve(options) {
        const k = options.k || this.defaultK;
        const lambda = options.lambda || 0.9;
        // Generate query embedding
        const queryEmbedding = await this.embeddings.generate(options.query);
        // Get all memories
        const allMemories = this.db.getAllMemories();
        const embeddings = this.db.getAllEmbeddings();
        // Filter by domain if specified
        let candidates = allMemories;
        if (options.domain) {
            candidates = candidates.filter(m => m.pattern_data.domain === options.domain ||
                m.pattern_data.domain?.startsWith(options.domain + '.'));
        }
        // Calculate scores for each candidate
        const scoredCandidates = [];
        for (const memory of candidates) {
            const embedding = embeddings.get(memory.id);
            if (!embedding)
                continue;
            // 1. Similarity score (cosine similarity)
            const similarity = cosineSimilarity(queryEmbedding, embedding);
            // 2. Recency score (exponential decay, 30-day half-life)
            const ageDays = (Date.now() - new Date(memory.created_at).getTime()) / (1000 * 60 * 60 * 24);
            const recency = Math.exp(-ageDays / 30);
            // 3. Reliability score (confidence × sqrt(usage/10))
            const reliability = Math.min(memory.confidence * Math.sqrt(memory.usage_count / 10), 1.0);
            // Combined score (before diversity penalty)
            const score = this.weights.alpha * similarity +
                this.weights.beta * recency +
                this.weights.gamma * reliability;
            scoredCandidates.push({
                ...memory,
                score,
                similarity,
                recency,
                reliability,
                diversityPenalty: 0 // Will be calculated in MMR
            });
        }
        // Sort by score
        scoredCandidates.sort((a, b) => b.score - a.score);
        // Apply MMR for diversity
        const selected = this.selectWithMMR(scoredCandidates, queryEmbedding, k, lambda);
        // Update usage counts
        for (const memory of selected) {
            this.db.updateMemoryUsage(memory.id);
        }
        // Filter by minimum confidence
        return selected.filter(m => m.confidence >= this.minConfidence);
    }
    /**
     * MMR (Maximal Marginal Relevance) Selection
     * Balances relevance and diversity
     */
    selectWithMMR(candidates, queryEmbedding, k, lambda) {
        const selected = [];
        const remaining = [...candidates];
        const embeddings = this.db.getAllEmbeddings();
        while (selected.length < k && remaining.length > 0) {
            let bestScore = -Infinity;
            let bestIndex = -1;
            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                const candidateEmbedding = embeddings.get(candidate.id);
                if (!candidateEmbedding)
                    continue;
                // Relevance to query
                const relevance = candidate.score;
                // Maximum similarity to already selected
                let maxSimilarity = 0;
                if (selected.length > 0) {
                    for (const selectedMemory of selected) {
                        const selectedEmbedding = embeddings.get(selectedMemory.id);
                        if (selectedEmbedding) {
                            const sim = cosineSimilarity(candidateEmbedding, selectedEmbedding);
                            maxSimilarity = Math.max(maxSimilarity, sim);
                        }
                    }
                }
                // MMR score
                const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;
                if (mmrScore > bestScore) {
                    bestScore = mmrScore;
                    bestIndex = i;
                }
            }
            if (bestIndex >= 0) {
                selected.push(remaining[bestIndex]);
                remaining.splice(bestIndex, 1);
            }
            else {
                break;
            }
        }
        return selected;
    }
    /**
     * Phase 2: JUDGE - Evaluate task outcome
     */
    async judge(trajectory) {
        // Simple heuristic judge (can be upgraded to LLM)
        const scrubbed = this.piiEnabled ? piiScrubber.scrub(trajectory) : trajectory;
        // Heuristics for success/failure
        const errorKeywords = ['error', 'failed', 'exception', 'timeout', 'unauthorized', 'forbidden'];
        const successKeywords = ['success', 'completed', 'ok', '200', 'done'];
        const lowerTrajectory = scrubbed.toLowerCase();
        const hasError = errorKeywords.some(kw => lowerTrajectory.includes(kw));
        const hasSuccess = successKeywords.some(kw => lowerTrajectory.includes(kw));
        if (hasSuccess && !hasError) {
            return { label: 'Success', confidence: 0.8, rationale: 'Success keywords found' };
        }
        else if (hasError && !hasSuccess) {
            return { label: 'Failure', confidence: 0.8, rationale: 'Error keywords found' };
        }
        else if (hasSuccess && hasError) {
            return { label: 'Success', confidence: 0.5, rationale: 'Mixed signals' };
        }
        else {
            return { label: 'Failure', confidence: 0.5, rationale: 'No clear indicators' };
        }
    }
    /**
     * Phase 3: DISTILL - Extract patterns from trajectory
     */
    async distill(taskId, trajectory, verdict, domain) {
        const scrubbed = this.piiEnabled ? piiScrubber.scrub(trajectory) : trajectory;
        // Store trajectory
        this.db.insertTrajectory({
            task_id: taskId,
            trajectory: scrubbed,
            verdict: verdict.label,
            confidence: verdict.confidence
        });
        // Extract pattern based on verdict
        const pattern = verdict.label === 'Success'
            ? this.extractSuccessPattern(scrubbed, domain)
            : this.extractFailureGuardrail(scrubbed, domain);
        // Store as memory
        const memoryId = this.db.insertMemory({
            title: pattern.title,
            description: pattern.description,
            content: pattern.content,
            confidence: verdict.confidence,
            usage_count: 0,
            pattern_data: {
                domain,
                success_pattern: verdict.label === 'Success',
                failure_guardrail: verdict.label === 'Failure'
            }
        });
        // Generate and store embedding
        const embedding = await this.embeddings.generate(pattern.content);
        this.db.insertEmbedding(memoryId, embedding);
        this.memoriesSinceConsolidation++;
        return memoryId;
    }
    extractSuccessPattern(trajectory, domain) {
        // Extract key steps from successful execution
        const lines = trajectory.split('\n').filter(l => l.trim());
        const keySteps = lines.slice(0, 5).join('\n');
        return {
            title: `Success pattern for ${domain}`,
            description: `Successful execution strategy`,
            content: `Successful approach:\n${keySteps}`
        };
    }
    extractFailureGuardrail(trajectory, domain) {
        // Extract error information
        const lines = trajectory.split('\n').filter(l => l.trim());
        const errorInfo = lines.find(l => l.toLowerCase().includes('error') ||
            l.toLowerCase().includes('failed')) || 'Unknown error';
        return {
            title: `Failure guardrail for ${domain}`,
            description: `Prevention strategy for common failures`,
            content: `Avoid: ${errorInfo}\nRecommend: Check prerequisites and retry with backoff`
        };
    }
    /**
     * Phase 4: CONSOLIDATE - Deduplicate and prune
     */
    async consolidate(options) {
        const startTime = Date.now();
        const dedupeThreshold = options?.dedupeThreshold || 0.95;
        const maxAgeDays = options?.prune?.maxAgeDays || 90;
        const minConfidence = options?.prune?.minConfidence || 0.3;
        const unusedDays = options?.prune?.unusedDays || 30;
        // Find and merge duplicates
        const duplicates = this.db.findDuplicates(dedupeThreshold);
        for (const [id1, id2] of duplicates) {
            const mem1 = this.db.getMemory(id1);
            const mem2 = this.db.getMemory(id2);
            if (mem1 && mem2) {
                // Keep the one with higher confidence and usage
                const keepId = mem1.confidence > mem2.confidence ||
                    (mem1.confidence === mem2.confidence && mem1.usage_count > mem2.usage_count)
                    ? id1 : id2;
                const deleteId = keepId === id1 ? id2 : id1;
                this.db.deleteMemory(deleteId);
            }
        }
        // Prune old or low-quality memories
        const allMemories = this.db.getAllMemories();
        let pruned = 0;
        for (const memory of allMemories) {
            const ageDays = (Date.now() - new Date(memory.created_at).getTime()) / (1000 * 60 * 60 * 24);
            const lastUsedDays = ageDays; // Simplified: assume last used = created
            const shouldPrune = ageDays > maxAgeDays ||
                memory.confidence < minConfidence ||
                (memory.usage_count === 0 && lastUsedDays > unusedDays);
            if (shouldPrune) {
                this.db.deleteMemory(memory.id);
                pruned++;
            }
        }
        // Detect contradictions (simplified)
        const contradictions = 0; // TODO: Implement semantic contradiction detection
        this.memoriesSinceConsolidation = 0;
        return {
            processed: allMemories.length,
            duplicates: duplicates.length,
            contradictions,
            pruned,
            durationMs: Date.now() - startTime
        };
    }
    /**
     * High-level task execution with full learning loop
     */
    async runTask(options) {
        // Phase 1: RETRIEVE
        const memories = await this.retrieve({
            query: options.query,
            domain: options.domain
        });
        // EXECUTE
        const result = await options.executeFn(memories);
        // Phase 2: JUDGE
        const verdict = await this.judge(result.log);
        // Phase 3: DISTILL
        await this.distill(options.taskId, result.log, verdict, options.domain);
        // Phase 4: CONSOLIDATE (if threshold reached)
        if (this.memoriesSinceConsolidation >= this.consolidationThreshold) {
            await this.consolidate();
        }
        return {
            success: result.success,
            summary: `Task ${options.taskId}: ${verdict.label} (confidence: ${verdict.confidence})`,
            memories,
            verdict
        };
    }
    /**
     * MaTTS: Memory-aware Test-Time Scaling (Parallel)
     */
    async mattsParallel(options) {
        const runs = await Promise.all(Array.from({ length: options.k }, async (_, i) => {
            const memories = await this.retrieve({
                query: options.query,
                domain: options.domain
            });
            const result = await options.executeFn(memories);
            const verdict = await this.judge(result.log);
            this.db.insertMattsRun({
                task_id: options.taskId,
                run_index: i,
                result: result.log,
                verdict: verdict.label,
                confidence: verdict.confidence
            });
            return { result, verdict };
        }));
        // Calculate consensus
        const successes = runs.filter(r => r.verdict.label === 'Success').length;
        const avgConfidence = runs.reduce((sum, r) => sum + r.verdict.confidence, 0) / runs.length;
        const consensusVerdict = {
            label: successes > runs.length / 2 ? 'Success' : 'Failure',
            confidence: avgConfidence
        };
        return {
            success: consensusVerdict.label === 'Success',
            summary: `MaTTS Parallel: ${successes}/${runs.length} successes, consensus: ${consensusVerdict.label}`,
            memories: [],
            verdict: consensusVerdict
        };
    }
    /**
     * Get statistics
     */
    getStats() {
        return this.db.getStats();
    }
    /**
     * Close database connection
     */
    close() {
        this.db.close();
    }
}
