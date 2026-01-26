import { EventEmitter } from 'events';
import { generateId } from '../utils/helpers.js';
export class HiveCommunicationProtocol extends EventEmitter {
    channels = new Map();
    messageQueue = new Map();
    knowledgeBase = new Map();
    consensusThreshold;
    constructor(options = {}){
        super();
        this.consensusThreshold = options.consensusThreshold || 0.6;
        this.initializeChannels();
    }
    initializeChannels() {
        this.createChannel('broadcast', 'broadcast', 'General announcements and updates');
        this.createChannel('consensus', 'consensus', 'Voting and decision making');
        this.createChannel('coordination', 'coordination', 'Task assignment and progress');
        this.createChannel('knowledge', 'knowledge', 'Knowledge sharing and learning');
    }
    createChannel(name, type, description) {
        const channel = {
            id: generateId('channel'),
            name,
            type,
            members: new Set(),
            messages: []
        };
        this.channels.set(channel.id, channel);
        this.emit('channel:created', {
            channel,
            description
        });
        return channel;
    }
    joinChannel(channelId, agentId) {
        const channel = this.channels.get(channelId);
        if (!channel) throw new Error(`Channel ${channelId} not found`);
        channel.members.add(agentId);
        this.emit('channel:joined', {
            channelId,
            agentId
        });
    }
    sendMessage(message) {
        const fullMessage = {
            ...message,
            id: generateId('msg'),
            timestamp: Date.now()
        };
        this.routeMessage(fullMessage);
        const channelType = this.getChannelTypeForMessage(fullMessage.type);
        const channel = Array.from(this.channels.values()).find((c)=>c.type === channelType);
        if (channel) {
            channel.messages.push(fullMessage);
        }
        if (fullMessage.to === 'broadcast') {
            for (const channel of this.channels.values()){
                for (const member of channel.members){
                    this.queueMessage(member, fullMessage);
                }
            }
        } else {
            this.queueMessage(fullMessage.to, fullMessage);
        }
        this.emit('message:sent', fullMessage);
        return fullMessage;
    }
    routeMessage(message) {
        switch(message.type){
            case 'vote_request':
                this.handleVoteRequest(message);
                break;
            case 'knowledge_share':
                this.handleKnowledgeShare(message);
                break;
            case 'consensus_check':
                this.handleConsensusCheck(message);
                break;
            case 'quality_report':
                this.handleQualityReport(message);
                break;
        }
    }
    getChannelTypeForMessage(messageType) {
        switch(messageType){
            case 'vote_request':
            case 'vote_response':
            case 'consensus_check':
                return 'consensus';
            case 'task_proposal':
            case 'status_update':
            case 'coordination_sync':
                return 'coordination';
            case 'knowledge_share':
                return 'knowledge';
            default:
                return 'broadcast';
        }
    }
    queueMessage(agentId, message) {
        if (!this.messageQueue.has(agentId)) {
            this.messageQueue.set(agentId, []);
        }
        this.messageQueue.get(agentId).push(message);
    }
    getMessages(agentId) {
        const messages = this.messageQueue.get(agentId) || [];
        this.messageQueue.set(agentId, []);
        return messages;
    }
    handleVoteRequest(message) {
        const { proposal, deadline } = message.payload;
        this.emit('vote:requested', {
            messageId: message.id,
            proposal,
            deadline,
            from: message.from
        });
        if (deadline) {
            setTimeout(()=>{
                this.collectVotes(message.id);
            }, deadline - Date.now());
        }
    }
    submitVote(requestId, agentId, vote, confidence = 1.0) {
        const voteMessage = this.sendMessage({
            from: agentId,
            to: 'consensus',
            type: 'vote_response',
            payload: {
                requestId,
                vote,
                confidence,
                reasoning: this.generateVoteReasoning(vote, confidence)
            },
            priority: 'high'
        });
        this.emit('vote:submitted', {
            requestId,
            agentId,
            vote,
            confidence
        });
        return voteMessage;
    }
    generateVoteReasoning(vote, confidence) {
        if (vote && confidence > 0.8) {
            return 'Strong alignment with objectives and capabilities';
        } else if (vote && confidence > 0.5) {
            return 'Moderate alignment, some concerns but manageable';
        } else if (!vote && confidence > 0.8) {
            return 'Significant concerns or misalignment detected';
        } else {
            return 'Insufficient information or capability mismatch';
        }
    }
    collectVotes(requestId) {
        const votes = new Map();
        for (const channel of this.channels.values()){
            for (const message of channel.messages){
                if (message.type === 'vote_response' && message.payload.requestId === requestId) {
                    votes.set(message.from, {
                        vote: message.payload.vote,
                        confidence: message.payload.confidence
                    });
                }
            }
        }
        const consensus = this.calculateConsensus(votes);
        this.emit('consensus:reached', {
            requestId,
            consensus,
            votes: Array.from(votes.entries())
        });
    }
    calculateConsensus(votes) {
        if (votes.size === 0) {
            return {
                approved: false,
                confidence: 0
            };
        }
        let totalWeight = 0;
        let approvalWeight = 0;
        for (const [_, { vote, confidence }] of votes){
            totalWeight += confidence;
            if (vote) {
                approvalWeight += confidence;
            }
        }
        const approvalRate = approvalWeight / totalWeight;
        const approved = approvalRate >= this.consensusThreshold;
        return {
            approved,
            confidence: approvalRate
        };
    }
    handleKnowledgeShare(message) {
        const { key, value, metadata } = message.payload;
        this.knowledgeBase.set(key, {
            value,
            metadata,
            contributor: message.from,
            timestamp: message.timestamp
        });
        this.emit('knowledge:shared', {
            key,
            contributor: message.from,
            timestamp: message.timestamp
        });
    }
    queryKnowledge(pattern) {
        const results = [];
        for (const [key, data] of this.knowledgeBase){
            if (key.includes(pattern)) {
                results.push({
                    key,
                    ...data
                });
            }
        }
        return results;
    }
    handleConsensusCheck(message) {
        const { topic, options } = message.payload;
        const voteRequest = this.sendMessage({
            from: 'consensus-system',
            to: 'broadcast',
            type: 'vote_request',
            payload: {
                topic,
                options,
                deadline: Date.now() + 30000
            },
            priority: 'urgent',
            requiresResponse: true
        });
        this.emit('consensus:initiated', {
            topic,
            options,
            requestId: voteRequest.id
        });
    }
    handleQualityReport(message) {
        const { taskId, metrics, issues } = message.payload;
        this.knowledgeBase.set(`quality/${taskId}`, {
            metrics,
            issues,
            reporter: message.from,
            timestamp: message.timestamp
        });
        if (metrics.score < 0.7) {
            this.emit('quality:alert', {
                taskId,
                score: metrics.score,
                issues,
                reporter: message.from
            });
        }
    }
    getStatistics() {
        const stats = {
            totalMessages: 0,
            messagesByType: new Map(),
            messagesByPriority: new Map(),
            activeChannels: this.channels.size,
            knowledgeEntries: this.knowledgeBase.size,
            avgResponseTime: 0
        };
        for (const channel of this.channels.values()){
            stats.totalMessages += channel.messages.length;
            for (const message of channel.messages){
                const typeCount = stats.messagesByType.get(message.type) || 0;
                stats.messagesByType.set(message.type, typeCount + 1);
                const priorityCount = stats.messagesByPriority.get(message.priority) || 0;
                stats.messagesByPriority.set(message.priority, priorityCount + 1);
            }
        }
        return stats;
    }
    exportLog() {
        const log = {
            channels: Array.from(this.channels.values()).map((channel)=>({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type,
                    memberCount: channel.members.size,
                    messageCount: channel.messages.length
                })),
            messages: [],
            knowledge: Array.from(this.knowledgeBase.entries()).map(([key, value])=>({
                    key,
                    ...value
                }))
        };
        for (const channel of this.channels.values()){
            log.messages.push(...channel.messages);
        }
        log.messages.sort((a, b)=>a.timestamp - b.timestamp);
        return log;
    }
}

//# sourceMappingURL=hive-protocol.js.map