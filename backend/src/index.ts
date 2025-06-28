import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import engineRoutes from './routes/engine';
import indexRoutes from './routes/index';  // Import the new routes
import subscriptionRoutes from './routes/subscription'; // Import subscription routes
import postsRoutes from './routes/posts'; // Import posts routes
import db from './db';  // Import database connection
import { SiteOperation } from './types';
import { WebSocketServer } from './services/WebSocketServer';  // Import our new WebSocket server

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 5000;

// Create HTTP server (required for WebSocket)
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: [
    'https://citrushost.io', 
    'http://localhost:3000',
    'https://citrus-frontend.ngrok.io',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Timestamp', 'X-Signature', 'Cache-Control'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));

// Special handling for Stripe webhooks - must come before express.json()
app.use('/api/subscription/webhook', express.raw({type: 'application/json'}));

// JSON body parser for all other routes
app.use(express.json());

// Pre-flight requests
app.options('*', cors(corsOptions));

// Initialize WebSocket server
export const wsServer = new WebSocketServer(server);
wsServer.initialize();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/engine', engineRoutes);
app.use('/api/subscription', subscriptionRoutes); // Add subscription routes
app.use('/api', indexRoutes);  // Add the new routes

// Queue stats endpoint - detailed queue statistics
app.get('/api/queue/stats', async (req, res) => {
  try {
    const queueStats = wsServer.getQueueStats();
    const connectedAgents = wsServer.getConnectedAgents().length;
    
    res.json({
      timestamp: new Date().toISOString(),
      connected_agents: connectedAgents,
      ...queueStats,
      summary: {
        total_inbound_messages: queueStats.inbound.queueLength,
        total_outbound_messages: queueStats.outbound.totalQueueLength,
        busy_agents: queueStats.outbound.busyAgents,
        idle_agents: connectedAgents - queueStats.outbound.busyAgents,
        agents_with_pending_work: queueStats.agents.length
      }
    });
  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Health endpoint - system health and queue status
app.get('/api/health', async (req, res) => {
  try {
    // Get database status
    const dbStart = Date.now();
    const dbResult = await db.query('SELECT NOW() as current_time');
    const dbLatency = Date.now() - dbStart;
    
    // Get agent status counts
    const agentStats = await db.query(`
      SELECT 
        COUNT(*) as total_agents,
        COUNT(CASE WHEN status = 'online' THEN 1 END) as online_agents,
        COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_agents,
        COUNT(CASE WHEN last_seen > NOW() - INTERVAL '5 minutes' THEN 1 END) as recent_agents
      FROM agents
    `);

    // Get server status counts  
    const serverStats = await db.query(`
      SELECT 
        COUNT(*) as total_servers,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_servers,
        COUNT(CASE WHEN status = 'provisioning' THEN 1 END) as provisioning_servers,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_servers
      FROM servers
    `);

    // Get WebSocket and queue metrics
    const connectedAgents = wsServer.getConnectedAgents();
    const wsConnections = connectedAgents.length;

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      
      // Database health
      database: {
        status: 'connected',
        latency_ms: dbLatency,
        current_time: dbResult.rows[0].current_time
      },

      // Agent status
      agents: {
        total: parseInt(agentStats.rows[0].total_agents),
        online: parseInt(agentStats.rows[0].online_agents), 
        offline: parseInt(agentStats.rows[0].offline_agents),
        recent_activity: parseInt(agentStats.rows[0].recent_agents)
      },

      // Server status
      servers: {
        total: parseInt(serverStats.rows[0].total_servers),
        running: parseInt(serverStats.rows[0].running_servers),
        provisioning: parseInt(serverStats.rows[0].provisioning_servers),
        failed: parseInt(serverStats.rows[0].failed_servers)
      },

      // WebSocket and queue status
      websockets: {
        connected_agents: wsConnections,
        status: wsConnections > 0 ? 'active' : 'idle'
      },

      // Queue metrics - detailed info
      queues: wsServer.getQueueStats(),

      // Memory usage
      memory: {
        used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external_mb: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    };

    res.json(healthData);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Log routes for debugging
console.log('Admin routes initialized at /api/admin');

// Create an API endpoint to verify agent credentials
app.post('/api/verify-agent', async (req, res) => {
  try {
    const { agentId, agentKey } = req.body;
    
    // Query database to verify agent credentials
    const result = await db.query(`
      SELECT * FROM agents 
      WHERE id = $1 AND agent_key = $2
    `, [agentId, agentKey]);
    
    const isValid = result.rows.length > 0;
    
    res.json({ valid: isValid });
  } catch (error) {
    console.error('Error verifying agent:', error);
    res.status(500).json({ valid: false, error: 'Server error' });
  }
});

// Event handlers for WebSocketServer

// Mark agent as online when connected
wsServer.on('agent_connected', async (agentId: string) => {
  try {
    console.log(`Agent ${agentId} connected - marking as online immediately`);
    await db.query(`
      UPDATE agents 
      SET status = 'online', last_seen = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [agentId]);
  } catch (error) {
    console.error('Error updating agent connected status:', error);
  }
});

// Mark agent as offline when disconnected
wsServer.on('agent_disconnected', async (agentId: string) => {
  try {
    console.log(`Agent ${agentId} disconnected - marking as offline`);
    await db.query(`
      UPDATE agents 
      SET status = 'offline' 
      WHERE id = $1
    `, [agentId]);
  } catch (error) {
    console.error('Error updating agent offline status:', error);
  }
});

// Update last_seen timestamp when receiving status updates
wsServer.on('agent_message', async (message: any) => {
  try {
    if (message.type === 'status_update') {
      const agentId = message.agentId;
      const status = message.status;
      
      console.log('Received status update from agent:', agentId);
      console.log('Status object:', JSON.stringify(status, null, 2));
      
      // Store the complete status object as JSON
      const fullStatus = JSON.stringify(status);
      console.log('Storing status as:', fullStatus);
      
      await db.query(`
        UPDATE agents 
        SET status = 'online',
            last_seen = CURRENT_TIMESTAMP,
            git_version = $2,
            service_status = $3
        WHERE id = $1
      `, [agentId, status.gitVersion, fullStatus]);
      
      console.log('Successfully stored status for agent:', agentId);
    }
    
    // Handle site operation updates
    if (message.type === 'site_operation') {
      const data = message as SiteOperation;
      
      console.log('Received site operation update:', {
        domain: data.domain,
        status: data.status,
        operation: data.operation,
        agentId: data.agentId
      });
      
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        
        // Find the site and its server
        const siteResult = await client.query(`
          SELECT s.id, s.name, s.deploy_status, s.server_id, s.ssl_status
          FROM sites s
          WHERE s.name = $1
        `, [data.domain]);

        if (siteResult.rows.length === 0) {
          console.error(`No site found with domain ${data.domain} to update status`);
          await client.query('ROLLBACK');
          return;
        }

        const site = siteResult.rows[0];

        // If a delete operation completes successfully, actually delete the site
        if (data.operation === 'delete' && data.status === 'completed') {
          console.log(`Delete operation completed for ${data.domain}, removing from database`);
          
          // Delete the site from the database
          await client.query(`
            DELETE FROM sites
            WHERE id = $1
          `, [site.id]);
          
          // If the site has a server, decrement active_sites
          if (site.server_id) {
            await client.query(`
              UPDATE servers 
              SET active_sites = GREATEST(active_sites - 1, 0)
              WHERE id = $1
            `, [site.server_id]);
          }
        } else {
          // Determine which fields to update based on the operation type
          let isSSLOperation = data.operation === 'deploy_ssl' || 
                              data.operation === 'redeploy_ssl' || 
                              data.operation === 'turn_off_ssl';

          if (isSSLOperation) {
            // For SSL operations, only update ssl_status
            let newSslStatus = site.ssl_status;
            
            if (data.operation === 'deploy_ssl' || data.operation === 'redeploy_ssl') {
              if (data.status === 'completed') {
                newSslStatus = 'active';
              } else if (data.status === 'failed') {
                newSslStatus = 'failed';
              }
            } else if (data.operation === 'turn_off_ssl') {
              if (data.status === 'completed') {
                newSslStatus = 'inactive';
              } else if (data.status === 'failed') {
                // Keep existing SSL status on failure
                newSslStatus = site.ssl_status;
              }
            }
            
            await client.query(`
              UPDATE sites 
              SET ssl_status = $1,
                  last_deploy_date = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [newSslStatus, site.id]);
          } else {
            // For non-SSL operations, only update deploy_status
            await client.query(`
              UPDATE sites 
              SET deploy_status = $1,
                  last_deploy_date = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [data.status, site.id]);
          }
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error('Error handling agent message:', error);
  }
});

// Periodic cleanup job to mark disconnected agents as offline
const CLEANUP_INTERVAL = 60000; // 1 minute

async function cleanupStaleAgentConnections() {
  try {
    console.log('Running agent connection cleanup...');
    
    // Get all agents marked as online in the database
    const result = await db.query(`
      SELECT id, name, status 
      FROM agents 
      WHERE status = 'online'
    `);
    
    const onlineAgents = result.rows;
    let staleCount = 0;
    
    for (const agent of onlineAgents) {
      // Check if the agent is actually connected via websocket
      const isActuallyConnected = wsServer.isAgentConnected(agent.id);
      
      if (!isActuallyConnected) {
        // Agent is marked as online but not actually connected - mark as offline
        console.log(`Marking stale agent ${agent.id} (${agent.name}) as offline`);
        await db.query(`
          UPDATE agents 
          SET status = 'offline' 
          WHERE id = $1
        `, [agent.id]);
        staleCount++;
      }
    }
    
    if (staleCount > 0) {
      console.log(`Cleaned up ${staleCount} stale agent connections`);
    } else {
      console.log('No stale agent connections found');
    }
  } catch (error) {
    console.error('Error during agent connection cleanup:', error);
  }
}

// Run cleanup immediately on startup, then every minute
cleanupStaleAgentConnections();
setInterval(cleanupStaleAgentConnections, CLEANUP_INTERVAL);

// Start the server
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`WebSocket server initialized and accepting connections`);
  console.log(`Agent connection cleanup running every ${CLEANUP_INTERVAL / 1000} seconds`);
}); 