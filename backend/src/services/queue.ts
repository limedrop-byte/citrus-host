import { EventEmitter } from 'events';

export class MessageQueue extends EventEmitter {
    private queue: any[];
    private batchSize: number;
    private processingIntervalMs: number;
    private isProcessing: boolean;
    private isProcessingEnabled: boolean;
    private processingInterval: NodeJS.Timeout | null;
    private lastProcessedTime: number | null;
    private processingStartTime: number | null;
    private consecutiveErrors: number;
    private maxConsecutiveErrors: number;

    constructor(batchSize = 10, processingIntervalMs = 100) {
        super();
        this.queue = [];
        this.batchSize = batchSize;
        this.processingIntervalMs = processingIntervalMs;
        this.isProcessing = false;
        this.isProcessingEnabled = false;
        this.processingInterval = null;
        this.lastProcessedTime = null;
        this.processingStartTime = null;
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 3;
        this.startProcessing();
    }

    enqueue(message: any, agentId: string, priority = 1) {
        const queuedMessage = {
            id: Math.random().toString(36).substring(7),
            content: message,
            priority,
            timestamp: Date.now(),
            agentId
        };

        this.queue.push(queuedMessage);
        // Sort by priority (higher number = higher priority) and then by timestamp
        this.queue.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return a.timestamp - b.timestamp;
        });
    }

    async processNextBatch() {
        // Don't process if already processing or queue is empty
        if (this.isProcessing || this.queue.length === 0) return;

        let batch;
        try {
            // Set processing state and start time
            this.isProcessing = true;
            this.processingStartTime = Date.now();
            
            const batchSize = Math.min(this.batchSize, this.queue.length);
            batch = this.queue.splice(0, batchSize);

            // Emit the batch for processing
            await this.emit('batch', batch);
            
            // Update success metrics
            this.lastProcessedTime = Date.now();
            this.consecutiveErrors = 0;

        } catch (error) {
            console.error('Error processing message batch:', error);
            this.consecutiveErrors++;
            
            // Put failed messages back in queue
            if (batch) {
                this.queue.unshift(...batch);
            }

            // If too many consecutive errors, pause processing temporarily
            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                console.error(`Too many consecutive errors (${this.consecutiveErrors}), pausing queue processing for 5 seconds`);
                this.stop();
                setTimeout(() => {
                    console.log('Resuming queue processing after error pause');
                    this.consecutiveErrors = 0;
                    this.startProcessing();
                }, 5000);
            }

        } finally {
            // Always reset processing state
            this.isProcessing = false;
            this.processingStartTime = null;
        }
    }

    startProcessing() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }

        this.isProcessingEnabled = true;
        this.processingInterval = setInterval(() => {
            this.processNextBatch().catch(error => {
                console.error('Unhandled error in processNextBatch:', error);
            });
        }, this.processingIntervalMs);
    }

    setProcessingInterval(intervalMs: number) {
        if (intervalMs < 1) {
            throw new Error('Processing interval must be at least 1ms');
        }
        this.processingIntervalMs = intervalMs;
        this.startProcessing(); // Restart processing with new interval
    }

    getProcessingInterval() {
        return this.processingIntervalMs;
    }

    setBatchSize(size: number) {
        if (size < 1) {
            throw new Error('Batch size must be at least 1');
        }
        this.batchSize = size;
    }

    getBatchSize() {
        return this.batchSize;
    }

    getQueueLength() {
        return this.queue.length;
    }

    stop() {
        this.isProcessingEnabled = false;
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }
} 