# Citrus Host: WebSocket Architecture and Scaling

## Overview

Citrus Host relies on a real-time communication architecture using WebSockets to facilitate communication between:
- **Agents**: Deployed on customer servers
- **Engine Hub**: Central WebSocket server that routes messages 
- **Commander/Backend**: Main application server that manages business logic

This document provides an in-depth overview of the current WebSocket implementation, potential bottlenecks at scale, and recommendations for implementing queuing mechanisms as the system grows.

## Current Architecture

### Communication Flow

```
Agents ⟷ Engine Hub ⟷ Commander/Backend
```

1. **Agents** connect to the **Engine Hub** using WebSocket connections
2. The **Engine Hub** acts as a message router/broker
3. **Commander/Backend** connects to the **Engine Hub** as a privileged client
4. Messages flow bidirectionally between all components

### Message Types and Frequency

- **Status Updates**: Sent from agents to commander every 30 seconds
- **Command Messages**: Sent from commander to specific agents as needed
- **Operation Results**: Sent from agents to commander after command completion

## Potential Bottlenecks at Scale

With 100+ concurrent agents, several potential bottlenecks emerge:

### 1. Connection Management

Each WebSocket connection maintains a persistent TCP connection, consuming resources on the Engine Hub server:
- Memory used per connection (~50-100KB depending on buffer sizes)
- File descriptors (each connection requires a socket descriptor)
- CPU usage for heartbeat and keepalive mechanisms

### 2. Message Processing Overhead

When all agents send status updates simultaneously:
- **Thundering Herd Problem**: Every 30 seconds, 100+ messages arrive simultaneously
- **Processing Backlog**: The Hub must process and route all messages quickly
- **Database Contention**: Commander must update all agent statuses in the database

### 3. Network Traffic Spikes

Status update cycles create predictable network traffic spikes:
- 100 agents × 2KB status payload = ~200KB burst traffic every 30 seconds
- Additional overhead from WebSocket framing and TCP/IP headers

## Recommended Queuing Strategies

### Option 1: Engine Hub Message Queue

Implement a message queue within the Engine Hub to buffer messages between components:

```
Agents → [Engine Hub Queue] → Commander
Commander → [Engine Hub Queue] → Agents
```

**Implementation Steps:**
1. Add an internal message queue in the Engine Hub (using a library like `async-queue`)
2. Process messages with controlled concurrency
3. Implement priority levels for different message types

#### Detailed Message Flow

Without a queue system, the message flow during agent status updates works like this:

1. All agents (potentially 100+) send status updates around the same time (every 30 seconds)
2. The Engine Hub receives these updates simultaneously, creating a sudden spike in incoming messages
3. The Engine Hub immediately forwards each update to the Commander as it arrives
4. The Commander processes each status update sequentially, updating the database
5. During peak times, this can cause processing delays and potential database bottlenecks

With an Engine Hub Message Queue system, the flow changes to:

1. All agents send status updates every 30 seconds (creating the same message flood)
2. The Engine Hub **receives all messages** but instead of immediately processing them:
   - Each message is placed in a priority queue based on message type
   - Status updates are given lower priority than critical operations
   - Messages are timestamped on arrival for monitoring
3. The Engine Hub **processes messages from the queue** at a controlled rate:
   - Higher priority messages are processed first
   - A limited number of messages are processed concurrently (e.g., 10 at a time)
   - This prevents overwhelming the Commander or database
4. The Commander receives a steady, controlled stream of messages rather than a flood
5. The Commander can process these updates more efficiently, with less risk of timeouts or failures

#### Queue Implementation Details

The Engine Hub would implement two main queues:

1. **Inbound Queue (Agent → Commander)**
   - Buffers messages from agents before forwarding to Commander
   - Processes in priority order (errors first, status updates last)
   - Controls concurrency to prevent Commander overload

2. **Outbound Queue (Commander → Agent)**
   - Buffers commands sent from Commander to agents
   - Processes based on command priority
   - Ensures rate limiting per agent (prevents flooding any single agent)

**Code Example (Expanded):**
```javascript
// In Engine Hub
const Queue = require('async-queue');

class MessageProcessor {
  constructor() {
    // Create queues with concurrency limits
    this.agentToCommanderQueue = new Queue({ concurrency: 10 });
    this.commanderToAgentQueue = new Queue({ concurrency: 20 });
    
    // Different priorities for different message types (lower number = higher priority)
    this.messagePriorities = {
      'status_update': 3,      // Lowest priority
      'site_operation': 2,
      'initial_status': 2,
      'error': 1               // Highest priority
    };
    
    // Track metrics for monitoring
    this.metrics = {
      queueDepth: 0,
      processedCount: 0,
      avgProcessingTime: 0
    };
  }
  
  // Handle message from an agent
  handleAgentMessage(agentId, message) {
    // Instead of immediately forwarding to Commander
    // Add to queue with appropriate priority
    this.enqueueAgentMessage(message, agentId);
    
    // Update metrics
    this.metrics.queueDepth = this.agentToCommanderQueue.length;
  }
  
  // Add message to queue with priority
  enqueueAgentMessage(message, agentId) {
    const priority = this.messagePriorities[message.type] || 2;
    const timestamp = Date.now();
    
    // Add to processing queue
    this.agentToCommanderQueue.push({
      task: async () => {
        await this.processAndForwardToCommander(message, agentId, timestamp);
      },
      priority
    });
    
    console.log(`Enqueued message from agent ${agentId} type: ${message.type}, priority: ${priority}, queue depth: ${this.agentToCommanderQueue.length}`);
  }
  
  // Process and forward message to Commander
  async processAndForwardToCommander(message, agentId, enqueuedAt) {
    const startTime = Date.now();
    const queueTime = startTime - enqueuedAt;
    
    try {
      // Add agent ID to message
      message.agentId = agentId;
      
      // Forward to commander
      this.sendToCommander(message);
      
      // Update metrics
      this.metrics.processedCount++;
      const processingTime = Date.now() - startTime;
      this.metrics.avgProcessingTime = 
        (this.metrics.avgProcessingTime * (this.metrics.processedCount - 1) + processingTime) / 
        this.metrics.processedCount;
      
      console.log(`Processed message from agent ${agentId}, type: ${message.type}, queue time: ${queueTime}ms, processing time: ${processingTime}ms`);
    } catch (error) {
      console.error(`Error processing message from agent ${agentId}:`, error);
    }
  }
  
  // Similar methods for Commander → Agent direction
  // ...
  
  // Expose metrics for monitoring
  getMetrics() {
    return { 
      ...this.metrics,
      agentToCommanderQueueDepth: this.agentToCommanderQueue.length,
      commanderToAgentQueueDepth: this.commanderToAgentQueue.length 
    };
  }
}
```

#### Memory Considerations

The queue system adds memory overhead to the Engine Hub:

- **Queue Size**: Each queued message consumes memory until processed
- **Peak Memory Usage**: During status update floods, queue memory usage spikes
- **Memory Management**: Consider implementing:
  - Maximum queue size limits
  - Message expiration for old status updates
  - Backpressure mechanisms when queues grow too large

#### Monitoring and Alerting

With queues implemented, monitoring should track:

- **Queue Depth Over Time**: Graph showing queue size fluctuations
- **Queue Processing Rate**: Messages processed per second
- **Time in Queue**: How long messages wait before processing
- **Processing Time**: How long it takes to handle each message type
- **Alerts on Queue Growth**: Notify when queues exceed certain thresholds

#### Benefits of Queue-Based Processing

1. **Smoothed Processing Load**: Converts bursty traffic into steady stream
2. **Priority Handling**: Critical messages processed first
3. **Controlled Database Load**: Prevents database connection pool exhaustion
4. **Improved Reliability**: Less likely to miss messages during peak loads
5. **Better Error Handling**: Failed messages can be retried or logged
6. **System Visibility**: Queue metrics provide insights into system health

### Option 2: External Message Queue System

For larger scale (1000+ agents), implement an external message broker:

```
Agents → Engine Hub → [RabbitMQ/Kafka] → Commander Workers
Commander → [RabbitMQ/Kafka] → Engine Hub → Agents
```

**Benefits:**
- Horizontally scalable message processing
- Persistent messages during component restarts
- Advanced routing capabilities
- Better backpressure handling

### Option 3: Staggered Status Updates

Distribute agent status update intervals to avoid thundering herds:

```javascript
// In Agent code
constructor() {
  // Add random offset (0-15 seconds) to the update interval
  this.updateOffset = Math.floor(Math.random() * 15000);
  // ...
}

startStatusUpdates() {
  // Wait for the random offset before starting the interval
  setTimeout(() => {
    this.statusInterval = setInterval(() => {
      const status = this.collectStatus();
      this.send({
        type: 'status_update', 
        status
      });
    }, STATUS_UPDATE_INTERVAL);
  }, this.updateOffset);
}
```

## Queue Management Responsibilities

### Engine Hub Responsibilities

The Engine Hub should handle:
- **Connection management**: Track active connections
- **Message buffering**: Temporary storage for in-flight messages
- **Flow control**: Detect and respond to backpressure
- **Basic routing**: Direct messages to appropriate destinations

### Commander Responsibilities

The Commander should handle:
- **Message prioritization**: Which operations take precedence
- **Rate limiting**: How many commands per agent
- **Database transaction management**: Processing agent updates efficiently
- **High-level orchestration**: Coordinating multi-step operations

## Implementation Recommendations for 100+ Agents

For your current scale of 100+ agents, we recommend:

1. **Implement staggered status updates** (Option 3) immediately - simplest solution with minimal changes
2. **Add a basic message queue in the Engine Hub** (Option 1) for better message handling
3. **Optimize database operations** for batch processing status updates

### Database Optimization Example

```javascript
// Instead of individual updates
agents.forEach(agent => {
  db.query("UPDATE agents SET status = ? WHERE id = ?", [agent.status, agent.id]);
});

// Use batch updates
db.query(`
  UPDATE agents 
  SET status = CASE 
    ${agents.map((a, i) => `WHEN id = ? THEN ?`).join(' ')}
    ELSE status 
  END
  WHERE id IN (${agents.map(() => '?').join(',')})
`, [
  ...agents.flatMap(a => [a.id, a.status]),
  ...agents.map(a => a.id)
]);
```

### Batch Processing in Commander

When the Engine Hub queues status updates, it creates an opportunity for the Commander to process them in batches rather than individually. This approach significantly reduces database load and improves overall system performance.

#### Batch Update Implementation

Instead of processing each status update as it arrives, the Commander can:

1. Collect incoming status updates in a buffer
2. Process them in batches at regular intervals or when a certain count is reached
3. Perform a single database transaction for multiple updates

**Code Example (Commander-side):**
```javascript
class CommanderStatusProcessor {
  constructor(db) {
    this.db = db;
    this.pendingStatusUpdates = [];
    this.batchSize = 10;
    this.maxWaitTimeMs = 1000; // Maximum time to wait before processing
    this.processingTimer = null;
  }

  // Called when a status update is received from Engine Hub
  handleStatusUpdate(agentStatus) {
    // Add to pending updates
    this.pendingStatusUpdates.push({
      agentId: agentStatus.agentId,
      status: agentStatus.status,
      timestamp: agentStatus.timestamp
    });

    // If we've reached batch size, process immediately
    if (this.pendingStatusUpdates.length >= this.batchSize) {
      this.processBatch();
    } 
    // Otherwise set a timer to ensure updates don't wait too long
    else if (!this.processingTimer) {
      this.processingTimer = setTimeout(() => this.processBatch(), this.maxWaitTimeMs);
    }
  }

  async processBatch() {
    // Clear any pending timer
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }

    // Get the current batch and reset for next round
    const batch = [...this.pendingStatusUpdates];
    this.pendingStatusUpdates = [];
    
    if (batch.length === 0) return;
    
    console.log(`Processing batch of ${batch.length} status updates`);
    
    try {
      // Perform batch update in a single transaction
      await this.db.transaction(async (trx) => {
        // Build query for batch update
        const query = `
          UPDATE agents 
          SET 
            status = CASE 
              ${batch.map(() => `WHEN id = ? THEN ?`).join('\n              ')}
              ELSE status 
            END,
            last_seen = CASE 
              ${batch.map(() => `WHEN id = ? THEN ?`).join('\n              ')}
              ELSE last_seen 
            END
          WHERE id IN (${batch.map(() => '?').join(',')})
        `;
        
        // Build parameters array
        const params = [
          // For status CASE
          ...batch.flatMap(update => [update.agentId, JSON.stringify(update.status)]),
          // For last_seen CASE
          ...batch.flatMap(update => [update.agentId, new Date(update.timestamp)]),
          // For WHERE IN clause
          ...batch.map(update => update.agentId)
        ];
        
        // Execute query
        await trx.raw(query, params);
      });
      
      console.log(`Successfully updated ${batch.length} agent statuses`);
    } catch (error) {
      console.error('Error performing batch update:', error);
      // In case of error, you might want to retry or handle failures
    }
  }
}
```

#### Efficiency Benefits

Batch processing provides several efficiency benefits:

1. **Reduced Database Load**:
   - Fewer database transactions (one per batch instead of one per update)
   - Lower connection pool utilization
   - Reduced database lock contention

2. **Better Performance**:
   - Modern databases optimize batch operations better than individual queries
   - Fewer network roundtrips between Commander and database
   - Lower overall CPU and memory usage

3. **Improved Throughput**:
   - The system can handle more status updates per second
   - More consistent performance during peak update times

#### Security Considerations

While batch processing improves efficiency, some security aspects need consideration:

1. **Parameter Sanitization**:
   - All user data must still be properly parameterized
   - Batch queries use more complex parameter structures but should maintain security

2. **Transaction Isolation**:
   - Use appropriate transaction isolation level (usually READ COMMITTED)
   - Ensure batch operations don't lock tables for extended periods

3. **Error Handling**:
   - Failed batch updates need careful handling
   - Consider whether to retry the entire batch or just failed entries
   - Implement logging for audit trails

4. **Authentication Verification**:
   - Verify all agents in a batch are legitimate before processing
   - Consider implementing periodic re-verification even for connected agents

#### Batch Size Tuning

Finding the optimal batch size requires balancing:

- **Too small**: Loses efficiency benefits
- **Too large**: Increases transaction time and memory usage

Recommended approach:
1. Start with moderate batch sizes (10-20 updates)
2. Measure performance metrics
3. Adjust based on system behavior
4. Consider dynamic batch sizing based on system load

### Database Indexes

To support efficient batch updates, ensure proper indexes exist:

```sql
-- Essential index for agent status lookups
CREATE INDEX idx_agents_id ON agents(id);

-- Additional helpful indexes
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_last_seen ON agents(last_seen);
```

## Monitoring Queue Health

Implement monitoring to detect queue bottlenecks:

1. **Queue Depth**: Track how many messages are waiting
2. **Processing Latency**: Measure time from enqueue to complete processing
3. **Message Rate**: Track messages per second in each direction
4. **Error Rates**: Monitor failed message processing attempts






------------------------------------------------------------------------------


## Live Scaling Test:

1. Simulating 100k actions per minute with 5k agents

// Configuration
const DEFAULT_NUM_AGENTS = 5000;
const RECONNECT_TIMEOUT = 5000;
const STATUS_UPDATE_INTERVAL = 3000;  // Every 3 seconds

// Queue Configuration
const QUEUE_BATCH_SIZE = 50;  // Number of messages to process in each batch
const QUEUE_PROCESS_INTERVAL = 30;  // Milliseconds between batch processing

Notes: Doesn't work, the agent list slowly adds up, not in a realistic timerame either. It works.. but slow. The queue stays below 30 at all times, but the agent count takes roughly 1 second to gain 3 agents. 

Update: as the agent count gets higher the queue get rises to around 150. Signalling a flood.

At 5k agents the floods are real.

{"status":"ok","agents":2278,"commanders":1,"queue":{"queueLength":27,"isProcessing":false,"batchSize":50,"processingIntervalMs":30}}

2. Simulating 50k actions per minute with 5k agents


2. Simulating 10k actions per minute with 5k agents

// Configuration
const DEFAULT_NUM_AGENTS = 5000;
const RECONNECT_TIMEOUT = 5000;
const STATUS_UPDATE_INTERVAL = 30000;

// Queue Configuration
const QUEUE_BATCH_SIZE = 50;  // Number of messages to process in each batch
const QUEUE_PROCESS_INTERVAL = 100;  // Milliseconds between batch processing

Notes: Works well. just takes a while to add all agents at once. This would only happen in event of hub restart. After processing queue stays under 30

{"status":"ok","agents":5000,"commanders":1,"queue":{"queueLength":20,"isProcessing":false,"batchSize":50,"processingIntervalMs":100}}


## Future Scaling to 1000+ Agents

As you approach 1000+ agents:

1. Split the Engine Hub into specialized services:
   - AgentConnectionService: Manages agent WebSockets
   - CommanderConnectionService: Handles commander connection
   - MessageRoutingService: Routes messages between services

2. Implement full external message queue (Option 2) with RabbitMQ or Kafka

3. Consider sharding agents by region or customer group:
   ```
   US-Agents → US-Engine → Queue → Workers
   EU-Agents → EU-Engine → Queue → Workers
   ```

## Conclusion

At your current scale of 100+ agents, a combination of staggering status updates and implementing an internal message queue in the Engine Hub should address the immediate concerns. The more advanced solutions involving external message brokers should be considered as you scale beyond 500 agents.

The key insight is that WebSocket connections themselves aren't the primary bottleneck, but rather the simultaneous processing of messages at regular intervals. By addressing this synchronization issue through queuing and staggering, you can significantly improve the system's scalability while maintaining real-time communication capabilities. 