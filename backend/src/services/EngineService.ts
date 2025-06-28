import WebSocket from 'ws';
import { EventEmitter } from 'events';
import db from '../db';

interface AgentStatus {
  agentId: string;
  status: {
    hostname: string;
    uptime: number;
    gitVersion: string;
    cpu: {
      load: number;
      cores: number;
    };
    memory: {
      total: number;
      used: number;
      free: number;
    };
    disk: Array<{
      fs: string;
      size: number;
      used: number;
      available: number;
    }>;
    timestamp: number;
  };
}

interface SiteOperation {
  agentId: string;
  status: string;
  domain: string;
  error?: string;
}

// Add an interface for error tracking
interface ErrorTracking {
  lastErrorTime: number;
  errorCount: number;
  errors: Array<{
    timestamp: number;
    error: string;
    details?: any;
  }>;
}

class EngineService extends EventEmitter {
  private ws: WebSocket | null;
  private db: any;
  private engineUrl: string;
  private commanderId: string;
  private commanderKey: string;
  private baseReconnectTimeout: number = 1000;
  private maxReconnectTimeout: number = 30000;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 50;
  private connected: boolean;
  private agentsMarkedOffline: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private isAlive: boolean = false;
  private terminatingIntentionally: boolean = false;
  private forcedReconnectTimeout: NodeJS.Timeout | null = null;
  private connectionStartTime: number = 0;
  private errorTracking: ErrorTracking = {
    lastErrorTime: 0,
    errorCount: 0,
    errors: []
  };
  private apiKey: string = '';
  private agentMetrics: Map<string, AgentStatus>;

  constructor(db: any) {
    super();
    this.ws = null;
    this.db = db;
    this.engineUrl = process.env.ENGINE_WS_URL || '';
    this.commanderId = process.env.COMMANDER_ID || '';
    this.commanderKey = process.env.COMMANDER_KEY || '';
    this.connected = false;
    this.agentsMarkedOffline = false;
    this.agentMetrics = new Map();

    // Log configuration
    console.log('EngineService initialized with:', {
      engineUrl: this.engineUrl,
      commanderId: this.commanderId,
      hasKey: !!this.commanderKey
    });
  }

  connect(): void {
    // Clear any existing heartbeat
    this.clearHeartbeat();
    
    // Clear existing forced reconnect timeout
    if (this.forcedReconnectTimeout) {
      clearTimeout(this.forcedReconnectTimeout);
      this.forcedReconnectTimeout = null;
    }

    // No need to attempt another connection if we're trying to terminate
    if (this.terminatingIntentionally) {
      return;
    }

    // Don't try to connect if we're already connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('Already connected to Engine hub, skipping reconnect');
      return;
    }

    // Clean up existing connection
    if (this.ws) {
      try {
        // Remove all listeners to prevent memory leaks
        this.ws.removeAllListeners();
        
        // Close if not already closed, using a safer approach
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          try {
            // Use close() instead of terminate() as it's safer
            this.ws.close();
          } catch (err) {
            console.error('Error closing WebSocket connection:', err);
            // Don't let this error crash the application
          }
        }
      } catch (err) {
        console.error('Error cleaning up existing WebSocket connection:', err);
        // Don't let this error crash the application
      } finally {
        // Always null out the reference to prevent issues
        this.ws = null;
      }
    }

    console.log('Attempting to connect to Engine hub...', {
      url: this.engineUrl,
      commanderId: this.commanderId,
      reconnectAttempt: this.reconnectAttempts
    });
    
    try {
      this.connectionStartTime = Date.now();
      this.isAlive = false;
      
      // Don't proceed if we don't have the necessary connection details
      if (!this.engineUrl) {
        console.error('No Engine URL provided. Please set ENGINE_WS_URL environment variable.');
        this.scheduleReconnect();
        return;
      }

      // Create WebSocket with error handling
      try {
        this.ws = new WebSocket(this.engineUrl, {
          headers: {
            'X-Client-Type': 'commander',
            'X-Commander-ID': this.commanderId,
            'X-Commander-Key': this.commanderKey
          },
          // Set a timeout for the connection attempt itself
          handshakeTimeout: 10000
        });
      } catch (wsError) {
        console.error('Failed to create WebSocket instance:', wsError);
        this.scheduleReconnect();
        return;
      }

      // Set up a safety timeout to force reconnection if stuck in CONNECTING state
      let connectionTimeout: NodeJS.Timeout | null = null;
      
      try {
        connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            console.log('Connection attempt timed out, forcing reconnect');
            try {
              // Safely terminate the connection
              if (this.ws) {
                // Instead of terminate(), use close() which is safer
                // or a custom safer termination approach
                try {
                  // First try to close gracefully
                  this.ws.close();
                } catch (closeErr) {
                  console.error('Error closing WebSocket connection:', closeErr);
                  // Continue even if close fails
                }
                
                // Set the reference to null regardless of termination success
                this.ws = null;
              }
            } catch (err) {
              console.error('Error during connection timeout handling:', err);
              // Make sure we don't keep the reference
              this.ws = null;
            }
            // Ensure we schedule a reconnect
            this.scheduleReconnect();
          }
        }, 15000);
      } catch (timeoutError) {
        console.error('Error setting up connection timeout:', timeoutError);
        // Still proceed with connection attempt
      }

      // Set up event handlers with proper error handling
      try {
        this.ws.on('open', () => {
          try {
            if (connectionTimeout) {
              clearTimeout(connectionTimeout);
              connectionTimeout = null;
            }
            
            const connectionTime = Date.now() - this.connectionStartTime;
            console.log(`Successfully connected to Engine hub after ${connectionTime}ms`);
            
            this.connected = true;
            this.isAlive = true;
            this.agentsMarkedOffline = false;
            this.reconnectAttempts = 0; // Reset attempts on successful connection
            
            // Set up heartbeat after connection is established
            this.setupHeartbeat();
            
            // Set up forced reconnect every 24 hours to prevent stale connections
            this.forcedReconnectTimeout = setTimeout(() => {
              console.log('Forcing reconnection after 24 hours of connection');
              this.terminatingIntentionally = true;
              if (this.ws) {
                try {
                  // Use safer close() method instead of terminate()
                  this.ws.close();
                } catch (err) {
                  console.error('Error during forced reconnect:', err);
                  // Don't let this error crash the application
                }
                // Ensure WebSocket reference is cleared
                this.ws = null;
              }
              setTimeout(() => {
                this.terminatingIntentionally = false;
                this.connect();
              }, 1000);
            }, 24 * 60 * 60 * 1000);
            
            this.emit('connected');
          } catch (err) {
            console.error('Error in WebSocket open handler:', err);
          }
        });

        // Add a handler for the WebSocket-level pong event
        this.ws.on('pong', () => {
          this.isAlive = true;
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          try {
            // We still need to parse the message
            const message = JSON.parse(data.toString());
                        
            console.log('Received message from Engine:', message.type);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error handling message:', error);
          }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          try {
            if (connectionTimeout) {
              clearTimeout(connectionTimeout);
              connectionTimeout = null;
            }
            
            // Clear heartbeat checks
            this.clearHeartbeat();
            
            const connectionDuration = (Date.now() - this.connectionStartTime) / 1000;
            console.log('Disconnected from Engine hub:', { 
              code, 
              reason: reason.toString(),
              connectionDuration: `${connectionDuration.toFixed(2)}s`,
              intentional: this.terminatingIntentionally
            });
            
            this.connected = false;
            this.emit('disconnected');

            // Only mark agents offline if we haven't already
            if (!this.agentsMarkedOffline) {
              console.log('Engine hub disconnected - marking all agents as offline');
              this.agentsMarkedOffline = true;
              this.emit('all_agents_offline');
            }

            // Don't increment reconnect attempts for intentional disconnects
            if (!this.terminatingIntentionally) {
              this.scheduleReconnect();
            } else {
              // Reset flag after intentional disconnect
              this.terminatingIntentionally = false;
              setTimeout(() => this.connect(), 1000);
            }
          } catch (err) {
            console.error('Error in WebSocket close handler:', err);
            this.scheduleReconnect();
          }
        });

        this.ws.on('error', (error: Error) => {
          try {
            console.error('WebSocket error:', error);
            
            // Only log stack trace in development
            if (process.env.NODE_ENV === 'development') {
              console.error(error.stack);
            }
            
            // If connection hasn't been established yet, handle error more aggressively
            if (!this.connected) {
              if (connectionTimeout) {
                clearTimeout(connectionTimeout);
                connectionTimeout = null;
              }
              this.scheduleReconnect();
            }
          } catch (err) {
            console.error('Error in WebSocket error handler:', err);
            this.scheduleReconnect();
          }
        });
      } catch (eventSetupError) {
        console.error('Failed to set up WebSocket event handlers:', eventSetupError);
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
        }
        this.scheduleReconnect();
        return;
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  // Setup heartbeat mechanism to detect dead connections
  private setupHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }
    
    // Send a ping every 15 seconds using WebSocket protocol-level ping
    this.heartbeatInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      
      // Mark as not alive until we get a pong response
      this.isAlive = false;
      
      try {
        // Use built-in WebSocket ping instead of application-level message
        this.ws.ping();
        
        // Set timeout to check if we got a pong response
        this.heartbeatTimeout = setTimeout(() => {
          if (!this.isAlive) {
            console.log('Heartbeat failed, terminating connection');
            this.ws?.terminate();
          }
        }, 10000); // Wait 10 seconds for pong
      } catch (err) {
        console.error('Failed to send heartbeat ping:', err);
        this.ws?.terminate();
      }
    }, 15000);
  }
  
  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private scheduleReconnect(): void {
    // Exponential backoff for reconnection
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection attempts.`);
      
      // Emit an event that other parts of the system can listen for
      this.emit('max_reconnect_attempts_reached');
      
      // Instead of giving up completely, set a longer interval to try again
      setTimeout(() => {
        console.log('Retrying connection after cooling down period');
        this.reconnectAttempts = Math.floor(this.maxReconnectAttempts / 2); // Reset to half the max
        this.connect();
      }, 5 * 60 * 1000); // Try again after 5 minutes
      
      return;
    }
    
    const reconnectTimeout = Math.min(
      this.baseReconnectTimeout * Math.pow(1.5, Math.min(this.reconnectAttempts, 15)),
      this.maxReconnectTimeout
    );
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${reconnectTimeout}ms`);
    
    setTimeout(() => this.connect(), reconnectTimeout);
  }

  private async handleMessage(message: any): Promise<void> {
    
    switch (message.type) {
      case 'initial_state':
        this.emit('agents_state', message.agents);
        break;

      case 'agent_connected':
        this.emit('agent_connected', message.agentId);
        break;

      case 'status_update':
        this.handleAgentStatus(message.agentId, message.status);
        break;

      case 'site_operation':
        this.emit('site_update', {
          agentId: message.agentId,
          operation: message.operation,
          status: message.status,
          domain: message.domain,
          error: message.error
        } as SiteOperation);
        break;

      case 'agent_disconnected':
        this.emit('agent_disconnected', message.agentId);
        break;
        
      case 'error':
        // Track the error
        this.trackError(message.error, message);
        
        // Log the error with detail
        console.warn('Received error from Engine:', {
          error: message.error,
          details: message.originalMessage ? message.originalMessage : 'No details available'
        });
        
        // If the error relates to a specific agent command, emit event
        if (message.originalMessage && message.originalMessage.agentId) {
          this.emit('command_error', {
            agentId: message.originalMessage.agentId,
            error: message.error,
            command: message.originalMessage
          });
        } else {
          // Generic engine error
          this.emit('engine_error', message);
        }
        break;
    }
  }
  
  // Add a method to track errors for analysis
  private trackError(errorMessage: string, details?: any): void {
    const now = Date.now();
    
    // Add to error tracking
    this.errorTracking.lastErrorTime = now;
    this.errorTracking.errorCount++;
    
    // Keep a maximum of 50 recent errors in memory
    if (this.errorTracking.errors.length >= 50) {
      this.errorTracking.errors.shift(); // Remove oldest error
    }
    
    this.errorTracking.errors.push({
      timestamp: now,
      error: errorMessage,
      details
    });
    
    // If we're seeing a lot of errors in a short time, log a warning
    if (this.errorTracking.errorCount > 10) {
      const timeWindow = now - this.errorTracking.errors[0].timestamp;
      if (timeWindow < 60000) { // 1 minute
        console.error(`High error rate detected: ${this.errorTracking.errorCount} errors in ${timeWindow/1000}s`);
        
        // Group errors by type for better analysis
        const errorCounts: Record<string, number> = {};
        this.errorTracking.errors.forEach(err => {
          errorCounts[err.error] = (errorCounts[err.error] || 0) + 1;
        });
        
        console.error('Error breakdown:', errorCounts);
      }
    }
  }

  // Add a method to retrieve error metrics for monitoring
  getErrorMetrics(): ErrorTracking {
    return {
      lastErrorTime: this.errorTracking.lastErrorTime,
      errorCount: this.errorTracking.errorCount,
      errors: [...this.errorTracking.errors] // Return a copy
    };
  }

  // Add a method to check if connected to Engine hub
  isConnectedToHub(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private sendToAgent(agentId: string, message: any): void {
    // Check connection status first
    if (!this.isConnectedToHub()) {
      console.warn('Cannot send command to agent - not connected to Engine hub');
      throw new Error('Engine hub is offline');
    }
    
    try {
      this.ws!.send(JSON.stringify({
        ...message,
        agentId
      }));
    } catch (error) {
      console.error('Error sending message to agent:', error);
      throw new Error('Failed to send message to agent');
    }
  }

  async updateAgent(agentId: string): Promise<void> {
    this.sendToAgent(agentId, {
      type: 'update_agent'
    });
  }

  async rollbackAgent(agentId: string, commitId: string): Promise<void> {
    this.sendToAgent(agentId, {
      type: 'rollback_agent',
      commitId
    });
  }

  // Store metrics when receiving agent status
  private async handleAgentStatus(agentId: string, status: any) {
    // Store the latest metrics
    this.agentMetrics.set(agentId, {
      agentId,
      status
    });
    
    try {
      // Mark agent as online since it just sent us a status update
      await this.db.query(`
        UPDATE agents 
        SET status = 'online', last_seen = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [agentId]);

      // Check for any pending operations for this agent
      const pendingOps = await this.db.query(`
        SELECT * FROM pending_operations 
        WHERE agent_id = $1 AND status = 'pending'
        ORDER BY created_at ASC
      `, [agentId]);

      // Log pending operations but don't process them
      for (const op of pendingOps.rows) {
        console.log(`Found pending ${op.operation_type} operation for site ${op.domain}`);
      }
    } catch (error) {
      console.error('Error in handleAgentStatus:', error);
    }
    
    // Emit the event for other handlers
    this.emit('agent_status', { agentId, status });
  }

  // Get the latest metrics for an agent
  getAgentMetrics(agentId: string): AgentStatus | undefined {
    return this.agentMetrics.get(agentId);
  }
}

// Create singleton instance
const engineService = new EngineService(db);

// Export the service instance without auto-connecting
export default engineService; 