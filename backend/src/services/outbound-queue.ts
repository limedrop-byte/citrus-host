import { EventEmitter } from 'events';

export class OutboundMessageQueue extends EventEmitter {
    private agentQueues: Map<string, any[]>;
    private agentBusy: Map<string, boolean>;
    private agentCurrentCommand: Map<string, any>;
    private commandStartTimes: Map<string, number>;
    private processingIntervalMs: number;
    private commandTimeoutMs: number;
    private isProcessingEnabled: boolean;
    private processingInterval: NodeJS.Timeout | null;
    private timeoutCheckInterval: NodeJS.Timeout | null;
    private lastProcessedTime: number | null;
    private consecutiveErrors: number;
    private maxConsecutiveErrors: number;

    constructor(processingIntervalMs = 1000, commandTimeoutMs = 300000) {
        super();
        this.agentQueues = new Map(); // Map of agent ID to its queue of pending messages
        this.agentBusy = new Map(); // Map of agent ID to boolean indicating if agent is processing a command
        this.agentCurrentCommand = new Map(); // Map of agent ID to current command being processed
        this.commandStartTimes = new Map(); // Map of agent ID to timestamp when current command started
        this.processingIntervalMs = processingIntervalMs;
        this.commandTimeoutMs = commandTimeoutMs; // Default 5 minutes timeout for commands
        this.isProcessingEnabled = true;
        this.processingInterval = null;
        this.timeoutCheckInterval = null;
        this.lastProcessedTime = null;
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 3;
        this.startProcessing();
        this.startTimeoutCheck();
    }

    // Add a message to an agent's queue
    enqueue(message: any, agentId: string, priority = 1) {
        const queuedMessage = {
            id: Math.random().toString(36).substring(7),
            content: message,
            priority,
            timestamp: Date.now(),
            agentId
        };

        // Initialize agent queue if it doesn't exist
        if (!this.agentQueues.has(agentId)) {
            this.agentQueues.set(agentId, []);
            this.agentBusy.set(agentId, false);
        }

        // Add message to agent's queue
        const agentQueue = this.agentQueues.get(agentId);
        if (agentQueue) {
            agentQueue.push(queuedMessage);
            
            // Sort by priority (higher number = higher priority) and then by timestamp
            agentQueue.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return b.priority - a.priority;
                }
                return a.timestamp - b.timestamp;
            });
        }

        console.log(`Enqueued message for agent ${agentId}, queue length: ${this.getQueueLength(agentId)}`);
    }

    // Process next message for each agent that isn't busy
    async processNextMessages() {
        for (const [agentId, queue] of this.agentQueues.entries()) {
            // Skip if agent is busy or has no messages
            if (this.agentBusy.get(agentId) || queue.length === 0) {
                continue;
            }

            try {
                // Mark agent as busy
                this.agentBusy.set(agentId, true);
                
                // Get next message for this agent
                const message = queue.shift();
                
                // Track command start time and current command
                this.commandStartTimes.set(agentId, Date.now());
                this.agentCurrentCommand.set(agentId, message);
                
                // Emit the message for processing
                await this.emit('message', message);
                
                // Update success metrics
                this.lastProcessedTime = Date.now();
                this.consecutiveErrors = 0;

            } catch (error) {
                console.error(`Error processing message for agent ${agentId}:`, error);
                this.consecutiveErrors++;
                
                // If too many consecutive errors, pause processing temporarily
                if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                    console.error(`Too many consecutive errors (${this.consecutiveErrors}), pausing queue processing for 5 seconds`);
                    this.stop();
                    setTimeout(() => {
                        console.log('Resuming queue processing after error pause');
                        this.consecutiveErrors = 0;
                        this.startProcessing();
                    }, 5000);
                    break; // Exit the loop
                }
            }
        }
    }

    // Check for commands that have been running too long
    checkCommandTimeouts() {
        const now = Date.now();
        
        this.commandStartTimes.forEach((startTime, agentId) => {
            if (!this.agentBusy.get(agentId)) {
                // Agent not busy, clean up tracking
                this.commandStartTimes.delete(agentId);
                this.agentCurrentCommand.delete(agentId);
                return;
            }
            
            const elapsedTime = now - startTime;
            
            // If command has been running longer than timeout
            if (elapsedTime > this.commandTimeoutMs) {
                const currentCommand = this.agentCurrentCommand.get(agentId);
                console.warn(`Command timeout for agent ${agentId}:`, {
                    commandType: currentCommand?.content?.type,
                    elapsedTimeMs: elapsedTime,
                    timeoutMs: this.commandTimeoutMs
                });
                
                // Emit timeout event
                this.emit('command_timeout', {
                    agentId,
                    command: currentCommand,
                    startTime,
                    elapsedTimeMs: elapsedTime
                });
                
                // Reset agent and mark as available
                this.markAgentAvailable(agentId);
                
                // Clean up tracking
                this.commandStartTimes.delete(agentId);
                this.agentCurrentCommand.delete(agentId);
            }
        });
    }

    // Mark an agent as finished processing a command
    markAgentAvailable(agentId: string) {
        if (this.agentBusy.has(agentId)) {
            console.log(`Marking agent ${agentId} as available`);
            this.agentBusy.set(agentId, false);
            
            // Clean up tracking for this agent
            this.commandStartTimes.delete(agentId);
            this.agentCurrentCommand.delete(agentId);
        }
    }

    // Get the current command for an agent
    getCurrentCommand(agentId: string) {
        return this.agentCurrentCommand.get(agentId);
    }

    // Get how long the current command has been running
    getCommandRunningTime(agentId: string) {
        const startTime = this.commandStartTimes.get(agentId);
        if (!startTime) return null;
        return Date.now() - startTime;
    }

    // Check if an agent has any pending messages
    hasMessages(agentId: string) {
        const queue = this.agentQueues.get(agentId);
        return queue && queue.length > 0;
    }

    // Get the number of pending messages for an agent
    getQueueLength(agentId: string) {
        const queue = this.agentQueues.get(agentId);
        return queue ? queue.length : 0;
    }

    // Start the queue processing interval
    startProcessing() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }

        this.isProcessingEnabled = true;
        this.processingInterval = setInterval(() => {
            this.processNextMessages().catch(error => {
                console.error('Unhandled error in processNextMessages:', error);
            });
        }, this.processingIntervalMs);
    }

    // Start the timeout checking interval
    startTimeoutCheck() {
        if (this.timeoutCheckInterval) {
            clearInterval(this.timeoutCheckInterval);
        }

        // Check for timeouts every minute
        this.timeoutCheckInterval = setInterval(() => {
            this.checkCommandTimeouts();
        }, 60000); // Every minute
    }

    // Set the processing interval
    setProcessingInterval(intervalMs: number) {
        if (intervalMs < 1) {
            throw new Error('Processing interval must be at least 1ms');
        }
        this.processingIntervalMs = intervalMs;
        this.startProcessing(); // Restart processing with new interval
    }

    // Set command timeout
    setCommandTimeout(timeoutMs: number) {
        if (timeoutMs < 1000) {
            throw new Error('Command timeout must be at least 1000ms');
        }
        this.commandTimeoutMs = timeoutMs;
    }

    // Get processing interval
    getProcessingInterval() {
        return this.processingIntervalMs;
    }

    // Get command timeout
    getCommandTimeout() {
        return this.commandTimeoutMs;
    }

    // Stop processing
    stop() {
        this.isProcessingEnabled = false;
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }
} 