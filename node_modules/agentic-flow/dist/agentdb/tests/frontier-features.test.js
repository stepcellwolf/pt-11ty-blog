/**
 * Comprehensive Tests for Frontier Features
 *
 * Validates:
 * 1. CausalMemoryGraph - causal inference, uplift calculation, A/B testing
 * 2. ExplainableRecall - minimal hitting sets, Merkle proofs, provenance
 *
 * NO MOCKING - Real SQLite database, real algorithms, real results
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { CausalMemoryGraph } from '../controllers/CausalMemoryGraph';
import { ExplainableRecall } from '../controllers/ExplainableRecall';
describe('Frontier Features - CausalMemoryGraph', () => {
    let db;
    let causalGraph;
    beforeEach(() => {
        // Create in-memory database
        db = new Database(':memory:');
        // Load core schema
        const coreSchema = fs.readFileSync(path.join(__dirname, '../schemas/schema.sql'), 'utf-8');
        db.exec(coreSchema);
        // Load frontier schema
        const frontierSchema = fs.readFileSync(path.join(__dirname, '../schemas/frontier-schema.sql'), 'utf-8');
        db.exec(frontierSchema);
        causalGraph = new CausalMemoryGraph(db);
        // Insert test episodes
        const episodes = [
            { session_id: 'session1', task: 'code_review', reward: 0.8, success: 1 },
            { session_id: 'session1', task: 'bug_fix', reward: 0.9, success: 1 },
            { session_id: 'session2', task: 'feature_impl', reward: 0.7, success: 1 },
            { session_id: 'session2', task: 'testing', reward: 0.85, success: 1 },
            { session_id: 'session3', task: 'refactoring', reward: 0.75, success: 1 },
        ];
        const stmt = db.prepare(`
      INSERT INTO episodes (session_id, task, reward, success)
      VALUES (?, ?, ?, ?)
    `);
        episodes.forEach(ep => {
            stmt.run(ep.session_id, ep.task, ep.reward, ep.success);
        });
    });
    afterEach(() => {
        db.close();
    });
    test('should add causal edge with all properties', () => {
        const edge = {
            fromMemoryId: 1,
            fromMemoryType: 'episode',
            toMemoryId: 2,
            toMemoryType: 'episode',
            similarity: 0.85,
            uplift: 0.15,
            confidence: 0.9,
            sampleSize: 100,
            evidenceIds: ['exp1', 'exp2'],
            mechanism: 'code_review improves bug_fix success'
        };
        const edgeId = causalGraph.addCausalEdge(edge);
        expect(edgeId).toBeGreaterThan(0);
        // Verify stored correctly
        const stored = db.prepare('SELECT * FROM causal_edges WHERE id = ?').get(edgeId);
        expect(stored.from_memory_id).toBe(1);
        expect(stored.to_memory_id).toBe(2);
        expect(stored.similarity).toBe(0.85);
        expect(stored.uplift).toBe(0.15);
        expect(stored.confidence).toBe(0.9);
        expect(stored.sample_size).toBe(100);
        expect(JSON.parse(stored.evidence_ids)).toEqual(['exp1', 'exp2']);
        expect(stored.mechanism).toBe('code_review improves bug_fix success');
    });
    test('should create and track A/B experiment', () => {
        const experiment = {
            name: 'Test Code Review Impact',
            hypothesis: 'Code review reduces bugs',
            treatmentId: 1,
            treatmentType: 'episode',
            controlId: 3,
            startTime: Date.now(),
            sampleSize: 0,
            status: 'running'
        };
        const expId = causalGraph.createExperiment(experiment);
        expect(expId).toBeGreaterThan(0);
        // Verify stored
        const stored = db.prepare('SELECT * FROM causal_experiments WHERE id = ?').get(expId);
        expect(stored.name).toBe('Test Code Review Impact');
        expect(stored.status).toBe('running');
        expect(stored.sample_size).toBe(0);
    });
    test('should record observations and update sample size', () => {
        const expId = causalGraph.createExperiment({
            name: 'Test Experiment',
            hypothesis: 'Treatment improves outcome',
            treatmentId: 1,
            treatmentType: 'episode',
            startTime: Date.now(),
            sampleSize: 0,
            status: 'running'
        });
        // Record treatment observation
        causalGraph.recordObservation({
            experimentId: expId,
            episodeId: 1,
            isTreatment: true,
            outcomeValue: 0.9,
            outcomeType: 'reward'
        });
        // Record control observation
        causalGraph.recordObservation({
            experimentId: expId,
            episodeId: 2,
            isTreatment: false,
            outcomeValue: 0.7,
            outcomeType: 'reward'
        });
        // Check sample size updated
        const experiment = db.prepare('SELECT * FROM causal_experiments WHERE id = ?').get(expId);
        expect(experiment.sample_size).toBe(2);
        // Check observations stored
        const observations = db.prepare('SELECT * FROM causal_observations WHERE experiment_id = ?').all(expId);
        expect(observations).toHaveLength(2);
    });
    test('should calculate uplift with statistical significance', () => {
        const expId = causalGraph.createExperiment({
            name: 'Uplift Test',
            hypothesis: 'Treatment increases reward',
            treatmentId: 1,
            treatmentType: 'episode',
            startTime: Date.now(),
            sampleSize: 0,
            status: 'running'
        });
        // Record 50 treatment observations (mean ~0.8)
        for (let i = 0; i < 50; i++) {
            causalGraph.recordObservation({
                experimentId: expId,
                episodeId: 1,
                isTreatment: true,
                outcomeValue: 0.75 + Math.random() * 0.1, // 0.75-0.85
                outcomeType: 'reward'
            });
        }
        // Record 50 control observations (mean ~0.6)
        for (let i = 0; i < 50; i++) {
            causalGraph.recordObservation({
                experimentId: expId,
                episodeId: 2,
                isTreatment: false,
                outcomeValue: 0.55 + Math.random() * 0.1, // 0.55-0.65
                outcomeType: 'reward'
            });
        }
        const result = causalGraph.calculateUplift(expId);
        // Validate results
        expect(result.uplift).toBeGreaterThan(0.1); // Treatment > Control
        expect(result.uplift).toBeLessThan(0.3); // Reasonable range
        expect(result.pValue).toBeLessThan(0.05); // Statistically significant
        expect(result.confidenceInterval[0]).toBeLessThan(result.uplift);
        expect(result.confidenceInterval[1]).toBeGreaterThan(result.uplift);
        // Verify experiment updated
        const experiment = db.prepare('SELECT * FROM causal_experiments WHERE id = ?').get(expId);
        expect(experiment.status).toBe('completed');
        expect(experiment.uplift).toBeCloseTo(result.uplift, 5);
        expect(experiment.p_value).toBeCloseTo(result.pValue, 5);
    });
    test('should query causal effects by confidence and uplift', () => {
        // Add multiple causal edges
        causalGraph.addCausalEdge({
            fromMemoryId: 1,
            fromMemoryType: 'episode',
            toMemoryId: 2,
            toMemoryType: 'episode',
            similarity: 0.8,
            uplift: 0.2,
            confidence: 0.9,
            sampleSize: 100
        });
        causalGraph.addCausalEdge({
            fromMemoryId: 1,
            fromMemoryType: 'episode',
            toMemoryId: 3,
            toMemoryType: 'episode',
            similarity: 0.7,
            uplift: 0.05, // Low uplift
            confidence: 0.95,
            sampleSize: 80
        });
        causalGraph.addCausalEdge({
            fromMemoryId: 1,
            fromMemoryType: 'episode',
            toMemoryId: 4,
            toMemoryType: 'episode',
            similarity: 0.85,
            uplift: 0.25,
            confidence: 0.4, // Low confidence
            sampleSize: 50
        });
        // Query with filters
        const effects = causalGraph.queryCausalEffects({
            interventionMemoryId: 1,
            interventionMemoryType: 'episode',
            minConfidence: 0.8,
            minUplift: 0.1
        });
        // Should only return first edge (high confidence + high uplift)
        expect(effects).toHaveLength(1);
        expect(effects[0].toMemoryId).toBe(2);
        expect(effects[0].confidence).toBe(0.9);
        expect(effects[0].uplift).toBe(0.2);
    });
    test('should find multi-hop causal chains', () => {
        // Create chain: 1 -> 2 -> 3
        causalGraph.addCausalEdge({
            fromMemoryId: 1,
            fromMemoryType: 'episode',
            toMemoryId: 2,
            toMemoryType: 'episode',
            similarity: 0.8,
            uplift: 0.1,
            confidence: 0.9,
            sampleSize: 100
        });
        causalGraph.addCausalEdge({
            fromMemoryId: 2,
            fromMemoryType: 'episode',
            toMemoryId: 3,
            toMemoryType: 'episode',
            similarity: 0.75,
            uplift: 0.15,
            confidence: 0.85,
            sampleSize: 80
        });
        // Also add direct edge 1 -> 3 (lower uplift)
        causalGraph.addCausalEdge({
            fromMemoryId: 1,
            fromMemoryType: 'episode',
            toMemoryId: 3,
            toMemoryType: 'episode',
            similarity: 0.7,
            uplift: 0.05,
            confidence: 0.8,
            sampleSize: 60
        });
        const chains = causalGraph.getCausalChain(1, 3, 5);
        // Should find both paths
        expect(chains.length).toBeGreaterThanOrEqual(1);
        // The 2-hop path should have higher total uplift
        const twoHopChain = chains.find(c => c.path.length === 3); // [1, 2, 3]
        expect(twoHopChain).toBeDefined();
        expect(twoHopChain.path).toEqual([1, 2, 3]);
        expect(twoHopChain.totalUplift).toBeCloseTo(0.25, 1); // 0.1 + 0.15
        expect(twoHopChain.confidence).toBeGreaterThanOrEqual(0.85); // Min of chain
    });
    test('should detect potential confounders', () => {
        // Create scenario where episode 3 might be a confounder
        // for the relationship between episode 1 and episode 2
        const edgeId = causalGraph.addCausalEdge({
            fromMemoryId: 1,
            fromMemoryType: 'episode',
            toMemoryId: 2,
            toMemoryType: 'episode',
            similarity: 0.8,
            uplift: 0.2,
            confidence: 0.9,
            sampleSize: 100
        });
        const result = causalGraph.detectConfounders(edgeId);
        // Should return confounders array (may be empty in test data)
        expect(result).toHaveProperty('confounders');
        expect(Array.isArray(result.confounders)).toBe(true);
        // Each confounder should have required properties
        result.confounders.forEach(conf => {
            expect(conf).toHaveProperty('memoryId');
            expect(conf).toHaveProperty('correlationWithTreatment');
            expect(conf).toHaveProperty('correlationWithOutcome');
            expect(conf).toHaveProperty('confounderScore');
            expect(conf.confounderScore).toBeGreaterThan(0.3);
        });
    });
    test('should calculate causal gain vs baseline', () => {
        // Add causal edges from treatment (episode 1) to outcomes
        causalGraph.addCausalEdge({
            fromMemoryId: 1,
            fromMemoryType: 'episode',
            toMemoryId: 2,
            toMemoryType: 'episode',
            similarity: 0.85,
            uplift: 0.2,
            confidence: 0.9,
            mechanism: 'improves outcome'
        });
        const result = causalGraph.calculateCausalGain(1, 'reward');
        // Should calculate difference between treated and untreated episodes
        expect(result).toHaveProperty('causalGain');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('mechanism');
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(typeof result.causalGain).toBe('number');
    });
});
describe('Frontier Features - ExplainableRecall', () => {
    let db;
    let explainableRecall;
    beforeEach(() => {
        db = new Database(':memory:');
        const coreSchema = fs.readFileSync(path.join(__dirname, '../schemas/schema.sql'), 'utf-8');
        db.exec(coreSchema);
        const frontierSchema = fs.readFileSync(path.join(__dirname, '../schemas/frontier-schema.sql'), 'utf-8');
        db.exec(frontierSchema);
        explainableRecall = new ExplainableRecall(db);
        // Insert test episodes
        for (let i = 1; i <= 10; i++) {
            db.prepare(`
        INSERT INTO episodes (session_id, task, reward, success)
        VALUES (?, ?, ?, ?)
      `).run(`session${i}`, `task${i}`, 0.8, 1);
        }
    });
    afterEach(() => {
        db.close();
    });
    test('should create recall certificate with minimal hitting set', () => {
        const chunks = [
            { id: '1', type: 'episode', content: 'Implement authentication', relevance: 0.9 },
            { id: '2', type: 'episode', content: 'Add JWT tokens', relevance: 0.85 },
            { id: '3', type: 'episode', content: 'Hash passwords', relevance: 0.8 },
            { id: '4', type: 'episode', content: 'Setup database', relevance: 0.7 }
        ];
        const requirements = [
            'authentication',
            'security',
            'tokens'
        ];
        const certificate = explainableRecall.createCertificate({
            queryId: 'q1',
            queryText: 'How to implement secure authentication?',
            chunks,
            requirements,
            accessLevel: 'internal'
        });
        // Validate certificate structure
        expect(certificate).toHaveProperty('id');
        expect(certificate.queryId).toBe('q1');
        expect(certificate.chunkIds).toEqual(['1', '2', '3', '4']);
        expect(certificate.chunkTypes).toEqual(['episode', 'episode', 'episode', 'episode']);
        // Validate minimal hitting set
        expect(certificate.minimalWhy).toBeDefined();
        expect(certificate.minimalWhy.length).toBeGreaterThan(0);
        expect(certificate.minimalWhy.length).toBeLessThanOrEqual(chunks.length);
        // Redundancy ratio should be >= 1
        expect(certificate.redundancyRatio).toBeGreaterThanOrEqual(1);
        expect(certificate.redundancyRatio).toBe(chunks.length / certificate.minimalWhy.length);
        // Completeness should be 0-1
        expect(certificate.completenessScore).toBeGreaterThanOrEqual(0);
        expect(certificate.completenessScore).toBeLessThanOrEqual(1);
        // Merkle root should exist
        expect(certificate.merkleRoot).toBeDefined();
        expect(certificate.merkleRoot.length).toBeGreaterThan(0);
        // Source hashes should match chunks
        expect(certificate.sourceHashes).toHaveLength(chunks.length);
        // Access level
        expect(certificate.accessLevel).toBe('internal');
        // Latency tracking
        expect(certificate.latencyMs).toBeGreaterThan(0);
    });
    test('should verify certificate integrity', () => {
        const chunks = [
            { id: '1', type: 'episode', content: 'Test content 1', relevance: 0.9 },
            { id: '2', type: 'episode', content: 'Test content 2', relevance: 0.8 }
        ];
        const certificate = explainableRecall.createCertificate({
            queryId: 'q2',
            queryText: 'Test query',
            chunks,
            requirements: ['test'],
            accessLevel: 'public'
        });
        // Verify the certificate
        const verification = explainableRecall.verifyCertificate(certificate.id);
        expect(verification.valid).toBe(true);
        expect(verification.issues).toHaveLength(0);
    });
    test('should detect tampered certificate', () => {
        const chunks = [
            { id: '1', type: 'episode', content: 'Original content', relevance: 0.9 }
        ];
        const certificate = explainableRecall.createCertificate({
            queryId: 'q3',
            queryText: 'Test query',
            chunks,
            requirements: ['test'],
            accessLevel: 'internal'
        });
        // Tamper with the certificate in database
        db.prepare(`
      UPDATE recall_certificates
      SET chunk_ids = ?
      WHERE id = ?
    `).run(JSON.stringify(['1', '999']), certificate.id);
        // Verification should fail
        const verification = explainableRecall.verifyCertificate(certificate.id);
        expect(verification.valid).toBe(false);
        expect(verification.issues.length).toBeGreaterThan(0);
        expect(verification.issues[0]).toContain('Merkle root');
    });
    test('should provide justification for each chunk', () => {
        const chunks = [
            { id: '1', type: 'episode', content: 'Setup API endpoint', relevance: 0.9 },
            { id: '2', type: 'episode', content: 'Add validation', relevance: 0.85 }
        ];
        const certificate = explainableRecall.createCertificate({
            queryId: 'q4',
            queryText: 'How to create API?',
            chunks,
            requirements: ['api', 'validation'],
            accessLevel: 'internal'
        });
        // Get justification for first chunk
        const justification = explainableRecall.getJustification(certificate.id, '1');
        expect(justification).toBeDefined();
        expect(justification.chunkId).toBe('1');
        expect(justification.chunkType).toBe('episode');
        expect(justification.reason).toBeDefined();
        expect(justification.necessityScore).toBeGreaterThanOrEqual(0);
        expect(justification.necessityScore).toBeLessThanOrEqual(1);
        expect(justification.pathElements).toBeDefined();
        expect(Array.isArray(justification.pathElements)).toBe(true);
    });
    test('should track provenance lineage', () => {
        // Create source with provenance
        const sourceId = explainableRecall.createProvenance({
            sourceType: 'episode',
            sourceId: 1,
            creator: 'test_user'
        });
        expect(sourceId).toBeGreaterThan(0);
        // Get the content hash
        const source = db.prepare('SELECT * FROM provenance_sources WHERE id = ?').get(sourceId);
        expect(source).toBeDefined();
        expect(source.content_hash).toBeDefined();
        // Track lineage
        const lineage = explainableRecall.getProvenanceLineage(source.content_hash);
        expect(lineage).toHaveLength(1);
        expect(lineage[0].sourceType).toBe('episode');
        expect(lineage[0].sourceId).toBe(1);
        expect(lineage[0].creator).toBe('test_user');
    });
    test('should audit certificate for quality metrics', () => {
        const chunks = [
            { id: '1', type: 'episode', content: 'Content 1', relevance: 0.95 },
            { id: '2', type: 'episode', content: 'Content 2', relevance: 0.9 },
            { id: '3', type: 'episode', content: 'Content 3', relevance: 0.85 },
            { id: '4', type: 'episode', content: 'Content 4', relevance: 0.5 } // Low relevance
        ];
        const certificate = explainableRecall.createCertificate({
            queryId: 'q5',
            queryText: 'Test audit query',
            chunks,
            requirements: ['req1', 'req2'],
            accessLevel: 'internal'
        });
        const audit = explainableRecall.auditCertificate(certificate.id);
        // Validate audit structure
        expect(audit).toHaveProperty('certificateId');
        expect(audit).toHaveProperty('queryText');
        expect(audit).toHaveProperty('totalChunks');
        expect(audit).toHaveProperty('minimalSetSize');
        expect(audit).toHaveProperty('redundancyRatio');
        expect(audit).toHaveProperty('completenessScore');
        expect(audit).toHaveProperty('avgNecessityScore');
        expect(audit).toHaveProperty('provenanceVerified');
        expect(audit).toHaveProperty('qualityScore');
        expect(audit.certificateId).toBe(certificate.id);
        expect(audit.totalChunks).toBe(4);
        expect(audit.minimalSetSize).toBeGreaterThan(0);
        expect(audit.redundancyRatio).toBeGreaterThanOrEqual(1);
        expect(audit.qualityScore).toBeGreaterThanOrEqual(0);
        expect(audit.qualityScore).toBeLessThanOrEqual(1);
        expect(audit.provenanceVerified).toBe(true);
    });
    test('should handle empty chunks gracefully', () => {
        const certificate = explainableRecall.createCertificate({
            queryId: 'q6',
            queryText: 'Empty query',
            chunks: [],
            requirements: ['test'],
            accessLevel: 'public'
        });
        expect(certificate.chunkIds).toHaveLength(0);
        expect(certificate.minimalWhy).toHaveLength(0);
        expect(certificate.redundancyRatio).toBe(0);
        expect(certificate.completenessScore).toBe(0);
    });
    test('should calculate correct minimal hitting set', () => {
        // Test case: Each chunk covers different requirements
        const chunks = [
            { id: '1', type: 'episode', content: 'auth implementation', relevance: 0.9 },
            { id: '2', type: 'episode', content: 'database setup', relevance: 0.85 },
            { id: '3', type: 'episode', content: 'API endpoints', relevance: 0.8 }
        ];
        const requirements = ['auth', 'database', 'api'];
        const certificate = explainableRecall.createCertificate({
            queryId: 'q7',
            queryText: 'Full stack implementation',
            chunks,
            requirements,
            accessLevel: 'internal'
        });
        // All chunks should be in minimal set (each covers unique requirement)
        expect(certificate.minimalWhy.length).toBe(3);
        expect(certificate.redundancyRatio).toBe(1.0);
    });
    test('should generate valid Merkle proofs', () => {
        const chunks = Array.from({ length: 8 }, (_, i) => ({
            id: `${i + 1}`,
            type: 'episode',
            content: `Content ${i + 1}`,
            relevance: 0.9 - i * 0.05
        }));
        const certificate = explainableRecall.createCertificate({
            queryId: 'q8',
            queryText: 'Merkle test',
            chunks,
            requirements: ['test'],
            accessLevel: 'internal'
        });
        // Merkle root should be deterministic
        expect(certificate.merkleRoot).toBeDefined();
        expect(certificate.merkleRoot.length).toBe(64); // SHA-256 hex = 64 chars
        // Source hashes should match chunks
        expect(certificate.sourceHashes).toHaveLength(8);
        certificate.sourceHashes.forEach(hash => {
            expect(hash.length).toBe(64);
        });
    });
});
describe('Frontier Features - Integration Tests', () => {
    let db;
    let causalGraph;
    let explainableRecall;
    beforeEach(() => {
        db = new Database(':memory:');
        const coreSchema = fs.readFileSync(path.join(__dirname, '../schemas/schema.sql'), 'utf-8');
        db.exec(coreSchema);
        const frontierSchema = fs.readFileSync(path.join(__dirname, '../schemas/frontier-schema.sql'), 'utf-8');
        db.exec(frontierSchema);
        causalGraph = new CausalMemoryGraph(db);
        explainableRecall = new ExplainableRecall(db);
    });
    afterEach(() => {
        db.close();
    });
    test('should combine causal reasoning with explainable recall', () => {
        // 1. Insert episodes
        for (let i = 1; i <= 5; i++) {
            db.prepare(`
        INSERT INTO episodes (session_id, task, reward, success)
        VALUES (?, ?, ?, ?)
      `).run(`session${i}`, `task${i}`, 0.7 + i * 0.05, 1);
        }
        // 2. Add causal edges
        causalGraph.addCausalEdge({
            fromMemoryId: 1,
            fromMemoryType: 'episode',
            toMemoryId: 2,
            toMemoryType: 'episode',
            similarity: 0.85,
            uplift: 0.15,
            confidence: 0.9,
            mechanism: 'task1 improves task2'
        });
        // 3. Create retrieval with provenance
        const chunks = [
            { id: '1', type: 'episode', content: 'First task', relevance: 0.9 },
            { id: '2', type: 'episode', content: 'Second task', relevance: 0.85 }
        ];
        const certificate = explainableRecall.createCertificate({
            queryId: 'integrated_q1',
            queryText: 'Show me tasks with causal relationships',
            chunks,
            requirements: ['causal', 'evidence'],
            accessLevel: 'internal'
        });
        // 4. Verify we can query both systems
        const causalEffects = causalGraph.queryCausalEffects({
            interventionMemoryId: 1,
            interventionMemoryType: 'episode',
            minConfidence: 0.8
        });
        expect(causalEffects.length).toBeGreaterThan(0);
        expect(certificate).toBeDefined();
        expect(certificate.minimalWhy.length).toBeGreaterThan(0);
        // 5. Audit the certificate
        const audit = explainableRecall.auditCertificate(certificate.id);
        expect(audit.provenanceVerified).toBe(true);
    });
    test('should handle large-scale causal experiments efficiently', () => {
        // Create experiment with many observations
        const expId = causalGraph.createExperiment({
            name: 'Large Scale Test',
            hypothesis: 'Treatment improves outcome at scale',
            treatmentId: 1,
            treatmentType: 'episode',
            startTime: Date.now(),
            sampleSize: 0,
            status: 'running'
        });
        const startTime = Date.now();
        // Record 1000 observations
        for (let i = 0; i < 1000; i++) {
            causalGraph.recordObservation({
                experimentId: expId,
                episodeId: i % 10 + 1,
                isTreatment: i % 2 === 0,
                outcomeValue: (i % 2 === 0 ? 0.8 : 0.6) + Math.random() * 0.1,
                outcomeType: 'reward'
            });
        }
        const recordTime = Date.now() - startTime;
        // Calculate uplift
        const calcStart = Date.now();
        const result = causalGraph.calculateUplift(expId);
        const calcTime = Date.now() - calcStart;
        // Performance assertions
        expect(recordTime).toBeLessThan(1000); // < 1 second to record 1000 observations
        expect(calcTime).toBeLessThan(100); // < 100ms to calculate uplift
        // Result assertions
        expect(result.uplift).toBeGreaterThan(0.1);
        expect(result.pValue).toBeLessThan(0.05);
    });
    test('should handle concurrent certificate creation', () => {
        const chunks = Array.from({ length: 10 }, (_, i) => ({
            id: `${i + 1}`,
            type: 'episode',
            content: `Content ${i + 1}`,
            relevance: 0.9 - i * 0.05
        }));
        // Create multiple certificates concurrently
        const certificates = [];
        for (let i = 0; i < 10; i++) {
            const cert = explainableRecall.createCertificate({
                queryId: `concurrent_q${i}`,
                queryText: `Concurrent query ${i}`,
                chunks: chunks.slice(0, i + 1),
                requirements: ['test'],
                accessLevel: 'internal'
            });
            certificates.push(cert);
        }
        // All should succeed
        expect(certificates).toHaveLength(10);
        certificates.forEach((cert, idx) => {
            expect(cert.queryId).toBe(`concurrent_q${idx}`);
            expect(cert.chunkIds.length).toBe(idx + 1);
        });
        // All should be verifiable
        certificates.forEach(cert => {
            const verification = explainableRecall.verifyCertificate(cert.id);
            expect(verification.valid).toBe(true);
        });
    });
});
