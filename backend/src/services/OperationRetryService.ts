import { Pool } from 'pg';
import { WebSocketServer } from './WebSocketServer';
import { EventEmitter } from 'events';

type OperationType = string;

interface PendingOperation {
  id: number;
  type: OperationType;
  siteId: number;
  domain: string;
  agentId: string;
  timestamp: Date;
}

export default class OperationRetryService {
  private db: Pool;
  private wsServer: WebSocketServer;
  private retryInterval: NodeJS.Timeout | null = null;
  private isRetrying: boolean = false;

  constructor(db: Pool, wsServer: WebSocketServer) {
    this.db = db;
    this.wsServer = wsServer;
    
    console.log('OperationRetryService initialized with WebSocketServer');
    
    // Set up event listener for agent connections
    this.wsServer.on('agent_connected', (agentId: string) => this.onAgentConnected(agentId));
  }

  /**
   * Start the retry service - should be called during app initialization
   */
  public start(): void {
    console.log('Starting Operation Retry Service');
    // Check for pending operations every 30 seconds
    this.retryInterval = setInterval(() => this.checkPendingOperations(), 30000);
  }

  /**
   * Stop the retry service
   */
  public stop(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  /**
   * Called when an agent connects
   */
  private onAgentConnected(agentId: string): void {
    console.log(`Agent ${agentId} connected - checking for pending operations to retry`);
    this.retryOperationsForAgent(agentId);
  }

  /**
   * Check for all pending operations that need to be retried
   */
  private async checkPendingOperations(): Promise<void> {
    if (this.isRetrying) {
      return; // Prevent concurrent retries
    }

    this.isRetrying = true;
    
    try {
      // Fetch all pending operations from the database
      const pendingOpsResult = await this.db.query(`
        SELECT po.id, po.operation_type, po.site_id, po.agent_id, po.domain, po.created_at, 
               po.retry_count, po.last_retry_at, a.status as agent_status
        FROM pending_operations po
        LEFT JOIN agents a ON po.agent_id = a.id
        WHERE po.status = 'pending'
        ORDER BY po.created_at ASC
      `);

      const pendingOps = pendingOpsResult.rows;
      console.log(`Found ${pendingOps.length} pending operations to check`);

      // Retry operations for agents that are connected
      for (const op of pendingOps) {
        const agentId = op.agent_id;
        const isConnected = this.wsServer.isAgentConnected(agentId);
        
        if (isConnected) {
          await this.retryOperation(op);
        } else {
          console.log(`Agent ${agentId} not connected, skipping operation retry for ${op.domain}`);
        }
      }
    } catch (error) {
      console.error('Error checking for pending operations:', error);
    } finally {
      this.isRetrying = false;
    }
  }

  /**
   * Retry operations specifically for a given agent that just connected
   */
  private async retryOperationsForAgent(agentId: string): Promise<void> {
    if (this.isRetrying) {
      return; // Prevent concurrent retries
    }

    this.isRetrying = true;
    
    try {
      // Fetch pending operations for this agent
      const pendingOpsResult = await this.db.query(`
        SELECT po.id, po.operation_type, po.site_id, po.agent_id, po.domain, po.created_at, 
               po.retry_count, po.last_retry_at
        FROM pending_operations po
        WHERE po.status = 'pending' AND po.agent_id = $1
        ORDER BY po.created_at ASC
      `, [agentId]);

      const pendingOps = pendingOpsResult.rows;
      console.log(`Agent ${agentId} reconnected - found ${pendingOps.length} pending operations`);

      // Retry each pending operation
      for (const op of pendingOps) {
        await this.retryOperation(op);
      }
    } catch (error) {
      console.error(`Error retrying operations for agent ${agentId}:`, error);
    } finally {
      this.isRetrying = false;
    }
  }

  /**
   * Retry a pending operation based on its type
   */
  private async retryOperation(op: any): Promise<void> {
    try {
      console.log(`Retrying ${op.operation_type} operation for ${op.domain} (ID: ${op.id})`);

      // Update retry count and last_retry_at
      await this.db.query(`
        UPDATE pending_operations
        SET retry_count = $1,
            last_retry_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [op.retry_count + 1, op.id]);
      
      // Execute the appropriate operation based on type
      console.warn(`Unknown operation type: ${op.operation_type}`);
    } catch (error) {
      console.error(`Error retrying operation for ${op.domain}:`, error);
    }
  }
} 