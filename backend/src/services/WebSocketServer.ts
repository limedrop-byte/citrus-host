import WebSocket from 'ws';
import { Server } from 'http';
import axios from 'axios';
import { MessageQueue } from './queue';
import { OutboundMessageQueue } from './outbound-queue';
import { EventEmitter } from 'events';

// Queue Configuration
const QUEUE_BATCH_SIZE = 50;  // Number of messages to process in each batch
const QUEUE_PROCESS_INTERVAL = 300;  // Milliseconds between batch processing
const OUTBOUND_QUEUE_INTERVAL = 1000; // Milliseconds between outbound message processing

export class WebSocketServer extends EventEmitter {
  private wss: WebSocket.Server;
  private agents: Map<string, WebSocket>;
  private inboundQueue: MessageQueue;
  private outboundQueue: OutboundMessageQueue;
  private apiUrl: string;
  private _processedMessages: Set<string>;

  constructor(server: Server) {
    super();
    this.wss = new WebSocket.Server({ server });
    this.agents = new Map();  // agentId -> WebSocket
    this.inboundQueue = new MessageQueue(QUEUE_BATCH_SIZE, QUEUE_PROCESS_INTERVAL);
    this.outboundQueue = new OutboundMessageQueue(OUTBOUND_QUEUE_INTERVAL);
    this.apiUrl = process.env.API_URL || 'http://localhost:5000/api';
    this._processedMessages = new Set();

    // Set up inbound queue processing
    this.inboundQueue.on('batch', (batch) => {
      this.processBatch(batch);
    });

    // Set up outbound queue processing
    this.outboundQueue.on('message', (queuedMessage) => {
      this.sendMessageToAgent(queuedMessage);
    });

    // Handle command timeouts
    this.outboundQueue.on('command_timeout', (timeoutInfo) => {
      this.handleCommandTimeout(timeoutInfo);
    });

    console.log('WebSocket Server initialized with:', {
      queueBatchSize: this.inboundQueue.getBatchSize(),
      queueProcessingInterval: this.inboundQueue.getProcessingInterval(),
      outboundQueueInterval: this.outboundQueue.getProcessingInterval()
    });
  }

  initialize() {
    this.wss.on('connection', async (ws, req) => {
      const clientType = req.headers['x-client-type'];
      console.log('New connection attempt:', {
        clientType,
        headers: {
          ...req.headers,
          'x-agent-key': req.headers['x-agent-key'] ? '***' : undefined
        }
      });
      
      if (clientType === 'agent') {
        await this.handleAgentConnection(ws, req);
      } else {
        console.log('Rejecting connection - invalid client type:', clientType);
        ws.close(4000, 'Invalid client type');
      }
    });
  }

  async handleAgentConnection(ws: WebSocket, req: any) {
    const agentId = req.headers['x-agent-id'];
    const agentKey = req.headers['x-agent-key'];

    try {
      // Verify agent credentials
      const isValid = await this.verifyAgent(agentId, agentKey);
      if (!isValid) {
        ws.close(4001, 'Invalid credentials');
        return;
      }

      // Check if this agent was previously busy - might indicate a reconnect after update
      const wasBusy = this.getAgentBusyState(agentId);
      const previousCommand = this.outboundQueue.getCurrentCommand(agentId);
      
      // Reset agent status if was previously busy
      if (wasBusy) {
        console.log(`Agent ${agentId} reconnected while previously marked as busy`, {
          previousCommand: previousCommand?.content?.type
        });
        
        // If previous command was update_agent, this is likely a successful update
        if (previousCommand?.content?.type === 'update_agent') {
          console.log(`Agent ${agentId} appears to have reconnected after update, marking as available`);
          this.outboundQueue.markAgentAvailable(agentId);
          
          // Emit update success event
          this.emit('agent_updated', {
            agentId,
            status: 'success',
            details: {
              reconnected: true,
              timestamp: Date.now()
            }
          });
        } else {
          // For other commands, just reset the busy state
          this.outboundQueue.markAgentAvailable(agentId);
        }
      }

      // Store agent connection
      this.agents.set(agentId, ws);
      console.log(`Agent ${agentId} connected`);
      
      // Emit connection event
      this.emit('agent_connected', agentId);

      // Handle agent messages
      ws.on('message', (data) => {
        this.handleAgentMessage(agentId, data);
      });

      // Handle disconnection
      ws.on('close', () => {
        this.agents.delete(agentId);
        console.log(`Agent ${agentId} disconnected`);
        this.emit('agent_disconnected', agentId);
      });

    } catch (error) {
      console.error('Agent connection error:', error);
      ws.close(4002, 'Connection error');
    }
  }
  
  private getAgentBusyState(agentId: string): boolean {
    // Safely access the private agentBusy field in OutboundMessageQueue
    // This is a workaround for the TypeScript limitation
    return (this.outboundQueue as any).agentBusy?.get(agentId) || false;
  }

  async verifyAgent(agentId: string, agentKey: string) {
    try {
      // Check credentials against the database
      const response = await axios.post(`${this.apiUrl}/verify-agent`, {
        agentId,
        agentKey
      });
      return response.data.valid;
    } catch (error) {
      console.error('Agent verification failed:', error);
      // If API is not available, we can implement a fallback in-memory verification 
      // using environment variables
      if (process.env.AGENT_ID === agentId && process.env.AGENT_KEY === agentKey) {
        console.log('Using fallback verification for agent');
        return true;
      }
      return false;
    }
  }

  handleAgentMessage(agentId: string, data: WebSocket.Data) {
    try {
      const message = JSON.parse(data.toString());
      
      // Skip initial_status messages
      if (message.type === 'initial_status') {
        return;
      }
      
      // Extract core message fields while preserving enhanced logging fields
      // First, ensure agentId is set (if somehow missing)
      message.agentId = agentId;
      
      // Use a message ID or sequence number to prevent duplicate processing
      // Create a unique key for message deduplication
      let messageKey = '';
      if (message.messageId) {
        messageKey = message.messageId.toString();
      } else {
        messageKey = `${agentId}-${message.sequence || message.messageSequence || Date.now()}`;
      }
      
      // Check if we've already processed this message using a Set or Map
      // We'll create and use a private property for tracking processed messages
      if (!this._processedMessages) {
        this._processedMessages = new Set();
      }
      
      // If we've already processed this message, skip it
      if (this._processedMessages.has(messageKey)) {
        return;
      }
      
      // Add to processed messages set
      this._processedMessages.add(messageKey);
      
      // Implement a simple cleanup to prevent memory leaks - keep only the last 1000 message IDs
      if (this._processedMessages.size > 1000) {
        const iterator = this._processedMessages.values();
        const firstValue = iterator.next().value;
        if (firstValue) {
          this._processedMessages.delete(firstValue);
        }
      }
      
      // Log enhanced message details if they exist
      if (message.messageId || message.sentAt || message.sequence || message.messageSequence) {
        console.log(`Received enhanced message from agent ${agentId}:`, {
          type: message.type,
          messageId: message.messageId,
          sentAt: message.sentAt,
          sequence: message.sequence || message.messageSequence,
          timestamp: message.timestamp
        });
      }
      
      // Set message priority based on type
      let priority = 1; // default priority
      if (message.type === 'error' || (message.type && message.type.includes('error'))) {
        priority = 3; // high priority for errors
      } else if (message.type === 'site_operation') {
        priority = 2; // medium priority for operations
      }
      
      // Check if this is a specific update_agent related message
      // This explicitly handles the case where an agent has restarted after update
      if (
        (message.type === 'connected' && message.restarted) || 
        message.type === 'agent_updated' ||
        (message.type && message.type.includes('restart')) ||
        (message.type === 'status' && message.operation === 'update_agent')
      ) {
        console.log(`Detected agent restart or update status message from ${agentId}:`, {
          type: message.type,
          restarted: message.restarted,
          status: message.status
        });
        // Force mark the agent as available to prevent stuck isBusy state
        this.outboundQueue.markAgentAvailable(agentId);
      }
      // General check for completion messages
      else if (this.isCompletionMessage(message)) {
        console.log(`Received completion message from agent ${agentId}:`, {
          type: message.type,
          status: message.status,
          operation: message.operation
        });
        
        // Mark the agent as available for more commands
        this.outboundQueue.markAgentAvailable(agentId);
      }
      
      // Add to inbound queue - but ensure we don't include any potentially 
      // problematic fields that the backend might not expect
      const coreMessage: Record<string, any> = {
        type: message.type,
        agentId: message.agentId,
        status: message.status,
        operation: message.operation,
        domain: message.domain,
        error: message.error,
        output: message.output
      };
      
      // Copy any other standard fields from the original message
      // This ensures we include regular fields but filter out the enhanced logging fields
      for (const key in message) {
        if (!['messageId', 'sentAt', 'sequence', 'messageSequence'].includes(key) && 
            message[key] !== undefined && coreMessage[key] === undefined) {
          coreMessage[key] = message[key];
        }
      }
      
      // Add to inbound queue
      this.inboundQueue.enqueue(coreMessage, agentId, priority);
      
    } catch (error) {
      const err = error as Error;
      console.error('Error handling agent message:', err.message);
    }
  }

  // Method to determine if a message indicates command completion
  isCompletionMessage(message: any) {
    // Consider the following as completion messages:
    // 1. site_operation messages with status 'completed' or 'failed'
    // 2. Messages with type completion_*
    // 3. Error messages (they indicate the command has failed)
    // 4. Agent update messages that indicate success
    
    if (message.type === 'site_operation' && 
        (message.status === 'completed' || message.status === 'failed')) {
      return true;
    }
    
    if (message.type && message.type.startsWith('completion_')) {
      return true;
    }
    
    if (message.type === 'error' || (message.type && message.type.includes('error'))) {
      return true;
    }

    // Check for agent update success messages
    if (message.type === 'agent_updated' || 
        (message.type === 'status' && message.operation === 'update_agent' && 
         (message.status === 'success' || message.status === 'completed')) ||
        (message.type === 'update_agent_complete') ||
        (message.type === 'restart_complete' && message.previousOperation === 'update_agent')) {
      console.log(`Recognized update_agent completion message from agent ${message.agentId}`);
      return true;
    }
    
    return false;
  }

  // New method to send messages to agents from the outbound queue
  sendMessageToAgent(queuedMessage: any) {
    const agentId = queuedMessage.agentId;
    const message = queuedMessage.content;
    
    const agentWs = this.agents.get(agentId);
    if (!agentWs || agentWs.readyState !== WebSocket.OPEN) {
      console.error(`Cannot send message to agent ${agentId}: Connection not open`);
      
      // Mark agent as available since we couldn't send the message
      this.outboundQueue.markAgentAvailable(agentId);
      
      // Emit error event
      this.emit('command_error', {
        agentId,
        error: 'Agent not connected',
        command: message
      });
      
      return;
    }
    
    console.log(`Sending queued message to agent ${agentId}:`, {
      type: message.type,
      priority: queuedMessage.priority
    });
    
    try {
      agentWs.send(JSON.stringify(message));
    } catch (error) {
      const err = error as Error;
      console.error(`Error sending message to agent ${agentId}:`, err.message);
      this.outboundQueue.markAgentAvailable(agentId);
      
      // Emit error event
      this.emit('command_error', {
        agentId,
        error: `Failed to send message: ${err.message}`,
        command: message
      });
    }
  }

  processBatch(batch: any[]) {
    try {
      // Process each message in the batch
      batch.forEach(queuedMessage => {
        console.log('Processing queued message:', {
          type: queuedMessage.content.type,
          agentId: queuedMessage.content.agentId,
          status: queuedMessage.content.status,
          operation: queuedMessage.content.operation,
          domain: queuedMessage.content.domain
        });
        
        // Emit the message for other listeners to process
        this.emit('agent_message', queuedMessage.content);
      });
    } catch (error) {
      console.error('Error processing message batch:', error);
    }
  }

  // Method to handle command timeouts
  handleCommandTimeout(timeoutInfo: any) {
    const { agentId, command, elapsedTimeMs } = timeoutInfo;
    const originalMessage = command.content;
    const commandType = originalMessage.type;

    console.warn(`Command timeout detected for agent ${agentId}`, {
      messageType: commandType,
      elapsedTimeMs,
      commandTimeout: this.outboundQueue.getCommandTimeout()
    });

    // Special handling for update_agent commands - they might actually succeed
    // but fail to report back due to restart
    if (commandType === 'update_agent') {
      console.log(`Special handling for timed out update_agent command for agent ${agentId}`);
      
      // Force mark the agent as available
      this.outboundQueue.markAgentAvailable(agentId);
      
      // Emit agent status event
      this.emit('agent_status', {
        agentId,
        status: 'restarting',
        details: {
          originalCommand: 'update_agent',
          reason: 'Assumed successful update and restart after timeout',
          timestamp: Date.now()
        }
      });
      
      return;
    }

    // Emit timeout event
    this.emit('command_timeout', {
      agentId,
      originalType: originalMessage.type,
      message: `Command timed out after ${Math.round(elapsedTimeMs / 1000)} seconds`,
      originalMessage
    });
  }

  // Methods to send commands to agents
  sendToAgent(agentId: string, message: any) {
    console.log(`Queueing message for agent ${agentId}:`, message);
    
    // Set priority based on message type
    let priority = 1; // default priority
    
    // Add to outbound queue with appropriate priority
    this.outboundQueue.enqueue(message, agentId, priority);
  }

  // Public API methods for sending commands to agents
  updateAgent(agentId: string): void {
    this.sendToAgent(agentId, {
      type: 'update_agent'
    });
  }

  rollbackAgent(agentId: string, commitId: string): void {
    this.sendToAgent(agentId, {
      type: 'rollback_agent',
      commitId
    });
  }

  // Method to check if an agent is connected
  isAgentConnected(agentId: string): boolean {
    const ws = this.agents.get(agentId);
    return !!ws && ws.readyState === WebSocket.OPEN;
  }

  // Get list of connected agent IDs
  getConnectedAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  // Get detailed queue statistics
  getQueueStats() {
    // Get total outbound queue lengths across all agents
    const connectedAgents = this.getConnectedAgents();
    let totalOutboundLength = 0;
    let busyAgents = 0;
    const agentStats = [];

    for (const agentId of connectedAgents) {
      const queueLength = this.outboundQueue.getQueueLength(agentId);
      const isBusy = this.getAgentBusyState(agentId);
      const currentCommand = this.outboundQueue.getCurrentCommand(agentId);
      const runningTime = this.outboundQueue.getCommandRunningTime(agentId);

      totalOutboundLength += queueLength;
      if (isBusy) busyAgents++;

      agentStats.push({
        agentId,
        queueLength,
        isBusy,
        currentCommand: currentCommand?.content?.type || null,
        runningTimeMs: runningTime
      });
    }

    return {
      inbound: {
        queueLength: this.inboundQueue.getQueueLength(),
        batchSize: this.inboundQueue.getBatchSize(),
        processingIntervalMs: this.inboundQueue.getProcessingInterval(),
        isProcessing: (this.inboundQueue as any).isProcessing || false,
        lastProcessedTime: (this.inboundQueue as any).lastProcessedTime || null
      },
      outbound: {
        totalQueueLength: totalOutboundLength,
        processingIntervalMs: this.outboundQueue.getProcessingInterval(),
        commandTimeoutMs: this.outboundQueue.getCommandTimeout(),
        busyAgents,
        totalAgents: connectedAgents.length,
        lastProcessedTime: (this.outboundQueue as any).lastProcessedTime || null
      },
      agents: agentStats.filter(agent => agent.queueLength > 0 || agent.isBusy).slice(0, 20) // Show top 20 agents with activity
    };
  }
} 