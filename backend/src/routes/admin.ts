import express from 'express';
import db from '../db';
import { verifyToken } from '../middleware/auth';
import { verifyAdmin } from '../middleware/adminAuth';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import engineService from '../services/EngineService';
import digitalOceanService from '../services/DigitalOceanService';

const router = express.Router();

// Apply both token and admin verification to all admin routes
router.use(verifyToken);
router.use(verifyAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, password, is_admin, stripe_customer_id, created_at FROM users ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new user
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, is_admin, stripe_customer_id } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    
    // Check if email already exists
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // New users cannot be created as admin via API for security reasons
    if (is_admin === true) {
      return res.status(403).json({ error: 'Cannot create admin users via API for security reasons' });
    }
    
    // Insert the new user (always as regular user)
    const result = await db.query(`
      INSERT INTO users (name, email, password, is_admin, stripe_customer_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, password, is_admin, stripe_customer_id, created_at
    `, [name, email, hashedPassword, false, stripe_customer_id || null]);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get specific user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT id, name, email, password, is_admin, stripe_customer_id, created_at FROM users WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user by ID
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, is_admin, stripe_customer_id, created_at } = req.body;
    
    // Check if user exists
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build dynamic update query
    let updateFields = [];
    let values = [];
    let paramCounter = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCounter}`);
      values.push(name);
      paramCounter++;
    }

    if (email !== undefined) {
      // Check if email is already taken by another user
      const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use by another user' });
      }
      
      updateFields.push(`email = $${paramCounter}`);
      values.push(email);
      paramCounter++;
    }

    if (password !== undefined && password !== '') {
      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      updateFields.push(`password = $${paramCounter}`);
      values.push(hashedPassword);
      paramCounter++;
    }

    // Admin status cannot be changed via API for security reasons
    if (is_admin !== undefined) {
      return res.status(403).json({ error: 'Admin status cannot be modified via API for security reasons' });
    }

    if (stripe_customer_id !== undefined) {
      updateFields.push(`stripe_customer_id = $${paramCounter}`);
      values.push(stripe_customer_id || null);
      paramCounter++;
    }

    if (created_at !== undefined) {
      updateFields.push(`created_at = $${paramCounter}`);
      values.push(created_at);
      paramCounter++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add user ID as the last parameter
    values.push(id);

    // Update user in database
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCounter} 
      RETURNING id, name, email, password, is_admin, stripe_customer_id, created_at
    `;

    const result = await db.query(updateQuery, values);
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Update user password (admin override)
router.patch('/users/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password || password.trim() === '') {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // Check if user exists
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Update password
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
    
    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Batch delete users (must come before /users/:id route)
router.delete('/users/batch', async (req, res) => {
  try {
    const { userIds } = req.body;
    
    console.log('Received batch delete request with userIds:', userIds);
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'User IDs array is required' });
    }
    
    // Validate that all IDs are numbers
    const validIds = userIds.filter(id => typeof id === 'number' && id > 0);
    
    if (validIds.length === 0) {
      return res.status(400).json({ error: 'No valid user IDs provided' });
    }
    
    console.log('Valid IDs to delete:', validIds);
    
    // Check if any of the users are admins - prevent admin deletion
    const placeholders = validIds.map((_, index) => `$${index + 1}`).join(',');
    const adminCheck = await db.query(`
      SELECT id, name, is_admin FROM users 
      WHERE id IN (${placeholders})
    `, validIds);
    
    const adminUsers = adminCheck.rows.filter(user => user.is_admin);
    
    if (adminUsers.length > 0) {
      console.log('Cannot delete admin users:', adminUsers.map(u => u.name));
      return res.status(400).json({ 
        error: 'Cannot delete admin users',
        adminUsers: adminUsers.map(u => ({ id: u.id, name: u.name }))
      });
    }
    
    // Delete the users from database using IN clause
    const result = await db.query(`
      DELETE FROM users 
      WHERE id IN (${placeholders}) AND is_admin = false
      RETURNING id, name, email
    `, validIds);
    
    console.log(`Batch deleted ${result.rows.length} users:`, result.rows.map(u => u.name));
    res.json({ 
      success: true, 
      message: `Successfully deleted ${result.rows.length} users`,
      deletedUsers: result.rows
    });
  } catch (error) {
    console.error('Error batch deleting users:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to batch delete users' });
  }
});

// Delete user by ID
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists and get their admin status
    const userCheck = await db.query('SELECT id, name, is_admin FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Absolutely prevent deleting ANY admin user for security
    if (userCheck.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin users cannot be deleted via API for security reasons' });
    }
    
    // Delete the user (only non-admin users can be deleted)
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get all table names in the database
router.get('/tables', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    res.json(result.rows.map(row => row.table_name));
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// Get table structure
router.get('/tables/:tableName/structure', async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Validate table name - only allow alphanumeric and underscore
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);
    
    res.json(result.rows);
  } catch (error) {
    console.error(`Error fetching structure for table ${req.params.tableName}:`, error);
    res.status(500).json({ error: 'Failed to fetch table structure' });
  }
});

// Get table data
router.get('/tables/:tableName/data', async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Validate table name - only allow alphanumeric and underscore
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    const result = await db.query(`SELECT * FROM "${tableName}" LIMIT 100`);
    res.json(result.rows);
  } catch (error) {
    console.error(`Error fetching data for table ${req.params.tableName}:`, error);
    res.status(500).json({ error: 'Failed to fetch table data' });
  }
});

// Delete all data from a table
router.delete('/tables/:tableName/data', async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Validate table name - only allow alphanumeric and underscore
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    // Extra protection for critical tables
    if (tableName === 'users' && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        error: 'Cannot delete all users in production environment'
      });
    }
    
    // Delete all data from the table
    await db.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
    
    res.json({ success: true, message: `All data deleted from ${tableName}` });
  } catch (error) {
    console.error(`Error deleting data from table ${req.params.tableName}:`, error);
    res.status(500).json({ error: 'Failed to delete table data' });
  }
});

// Get all agents
router.get('/agents', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, status, last_seen as "lastSeen", created_at as "createdAt", 
             updated_at as "updatedAt", git_version as "gitVersion"
      FROM agents
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Generate a new agent key
router.post('/agents/generate', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }
    
    // Generate a random key
    const key = crypto.randomBytes(32).toString('hex');
    
    // Insert the new agent
    const result = await db.query(`
      INSERT INTO agents (name, key)
      VALUES ($1, $2)
      RETURNING id, name, key
    `, [name, key]);
    
    // Return the new agent with the key
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error generating agent key:', error);
    res.status(500).json({ error: 'Failed to generate agent key' });
  }
});

// Batch deploy multiple agents
router.post('/agents/batch-deploy', async (req, res) => {
  try {
    const { count, namePrefix } = req.body;
    
    if (!count || count < 1) {
      return res.status(400).json({ error: 'Count must be at least 1' });
    }

    const generatedAgents = [];
    
    // Generate agents sequentially
    for (let i = 0; i < count; i++) {
      const name = `${namePrefix || 'batch-agent'}-${Date.now()}-${i}`;
      const key = crypto.randomBytes(32).toString('hex');
      
      // Insert the new agent
      const result = await db.query(`
        INSERT INTO agents (name, key)
        VALUES ($1, $2)
        RETURNING id, name, key
      `, [name, key]);
      
      generatedAgents.push(result.rows[0]);
    }
    
    res.json({
      count: generatedAgents.length,
      agents: generatedAgents
    });
  } catch (error) {
    console.error('Error in batch agent deployment:', error);
    res.status(500).json({ error: 'Failed to generate batch agents' });
  }
});

// Update an agent
router.post('/agents/:id/update', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if agent exists
    const agentCheck = await db.query(`
      SELECT id, name FROM agents WHERE id = $1
    `, [id]);
    
    if (agentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Use the wsServer to update the agent
    const { wsServer } = require('../index');
    
    // Check if agent is connected
    if (!wsServer.isAgentConnected(id)) {
      return res.status(503).json({ 
        error: 'Agent is not connected',
        message: 'Cannot update agent because it is not currently connected'
      });
    }
    
    // Send update command
    wsServer.updateAgent(id);
    
    res.json({ success: true, message: 'Update command sent to agent' });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// System update an agent (runs install.sh)
router.post('/agents/:id/system-update', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if agent exists
    const agentCheck = await db.query(`
      SELECT id, name FROM agents WHERE id = $1
    `, [id]);
    
    if (agentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Use the wsServer to send system update command
    const { wsServer } = require('../index');
    
    // Check if agent is connected
    if (!wsServer.isAgentConnected(id)) {
      return res.status(503).json({ 
        error: 'Agent is not connected',
        message: 'Cannot perform system update because agent is not currently connected'
      });
    }
    
    // Send system update command
    wsServer.sendToAgent(id, { 
      type: 'system_update',
      priority: 1
    });
    
    res.json({ success: true, message: 'System update command sent to agent' });
  } catch (error) {
    console.error('Error sending system update to agent:', error);
    res.status(500).json({ error: 'Failed to send system update command' });
  }
});



// Batch delete agents (must come before /agents/:id route)
router.delete('/agents/batch', async (req, res) => {
  try {
    const { agentIds } = req.body;
    
    console.log('Received batch delete request with agentIds:', agentIds);
    
    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ error: 'Agent IDs array is required' });
    }
    
    // Validate that all IDs are strings
    const validIds = agentIds.filter(id => typeof id === 'string' && id.trim().length > 0);
    
    if (validIds.length === 0) {
      return res.status(400).json({ error: 'No valid agent IDs provided' });
    }
    
    console.log('Valid IDs to delete:', validIds);
    
    // Delete the agents from database using IN clause instead of ANY
    const placeholders = validIds.map((_, index) => `$${index + 1}`).join(',');
    const result = await db.query(`
      DELETE FROM agents 
      WHERE id IN (${placeholders})
      RETURNING id, name
    `, validIds);
    
    console.log(`Batch deleted ${result.rows.length} agents:`, result.rows.map(a => a.name));
    res.json({ 
      success: true, 
      message: `Successfully deleted ${result.rows.length} agents`,
      deletedAgents: result.rows
    });
  } catch (error) {
    console.error('Error batch deleting agents:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to batch delete agents' });
  }
});

// Delete an agent
router.delete('/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if agent exists
    const agentCheck = await db.query(`
      SELECT id, name FROM agents WHERE id = $1
    `, [id]);
    
    if (agentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Delete the agent from database
    await db.query(`DELETE FROM agents WHERE id = $1`, [id]);
    
    console.log(`Agent ${id} deleted from database`);
    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// Get agent metrics
router.get('/agents/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get agent data including service status from database
    const agentResult = await db.query(`
      SELECT id, name, status, last_seen, git_version, service_status
      FROM agents 
      WHERE id = $1
    `, [id]);
    
    if (agentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const agent = agentResult.rows[0];
    
    // Check if we have recent status data
    const lastSeen = new Date(agent.last_seen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    if (lastSeen < fiveMinutesAgo) {
      return res.status(404).json({ 
        error: 'No recent metrics available', 
        message: 'Agent has not sent status updates in the last 5 minutes'
      });
    }
    
    // Parse service status if available
    let fullStatus = null;
    if (agent.service_status) {
      console.log('Raw service_status from database:', agent.service_status);
      console.log('Type of service_status:', typeof agent.service_status);
      
      // If it's already an object (JSONB column), use it directly
      if (typeof agent.service_status === 'object') {
        fullStatus = agent.service_status;
        console.log('Using JSONB object directly:', fullStatus);
      } else {
        // If it's a string, parse it
        try {
          fullStatus = JSON.parse(agent.service_status);
          console.log('Parsed status successfully:', fullStatus);
        } catch (error) {
          console.error('Error parsing service status:', error);
          console.log('Failed to parse this value:', agent.service_status);
        }
      }
    }
    
    // Return metrics in the expected format
    const metrics = {
      agentId: agent.id,
      status: fullStatus || {
        hostname: agent.name,
        services: null,
        gitVersion: agent.git_version,
        timestamp: new Date(agent.last_seen).getTime(),
        lastSeen: agent.last_seen
      }
    };
    
    res.json({ success: true, metrics });
  } catch (error) {
    console.error('Error fetching agent metrics:', error);
    res.status(500).json({ error: 'Failed to fetch agent metrics' });
  }
});

// Rollback an agent to a specific commit
router.post('/agents/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;
    const { commitId } = req.body;
    
    if (!commitId) {
      return res.status(400).json({ error: 'Commit ID is required' });
    }
    
    // Check if agent exists
    const agentCheck = await db.query(`
      SELECT id, name FROM agents WHERE id = $1
    `, [id]);
    
    if (agentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Use the wsServer to rollback the agent
    const { wsServer } = require('../index');
    
    // Check if agent is connected
    if (!wsServer.isAgentConnected(id)) {
      return res.status(503).json({ 
        error: 'Agent is not connected',
        message: 'Cannot rollback agent because it is not currently connected'
      });
    }
    
    // Send rollback command
    wsServer.rollbackAgent(id, commitId);
    
    res.json({ 
      success: true, 
      message: `Rollback command sent to agent (commit: ${commitId})` 
    });
  } catch (error) {
    console.error('Error rolling back agent:', error);
    res.status(500).json({ error: 'Failed to rollback agent' });
  }
});

// Deploy a new server
router.post('/servers/deploy', async (req, res) => {
  try {
    const { name } = req.body;
    
    // Use a default name if not provided
    const serverName = name || `server-${Date.now()}`;
    
    // Get the server type id for 'Shared' server type
    const serverTypeResult = await db.query(`
      SELECT id, max_sites FROM server_types 
      WHERE size = 's-1vcpu-1gb' AND name = 'Shared'
      LIMIT 1
    `);
    
    if (serverTypeResult.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Server type not found. Please ensure the Shared server type exists.'
      });
    }
    
    const serverType = serverTypeResult.rows[0];
    
    // Create server record in database
    const dbResult = await db.query(`
      INSERT INTO servers (name, region, size, status, max_sites, active_sites, server_type_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name
    `, [serverName, 'sfo3', 's-1vcpu-1gb', 'creating', serverType.max_sites, 0, serverType.id]);
    
    const server = dbResult.rows[0];
    
    // Deploy the server to Digital Ocean asynchronously
    // We don't await this to provide a faster response to the client
    deployServer(server.id, serverName).catch(error => {
      console.error(`Error in background deployment of server ${server.id}:`, error);
    });
    
    res.json({ 
      success: true, 
      message: 'Server deployment initiated',
      server: {
        id: server.id,
        name: server.name,
        status: 'creating',
        max_sites: serverType.max_sites,
        server_type_id: serverType.id
      }
    });
  } catch (error: any) {
    console.error('Error deploying server:', error);
    res.status(500).json({ error: 'Failed to deploy server' });
  }
});

// Deploy a new server with agent pre-installed
router.post('/servers/deploy-with-agent', async (req, res) => {
  try {
    const { name } = req.body;
    
    // Use a default name if not provided
    const serverName = name || `server-${Date.now()}`;
    
    // Get the server type id for 'Shared' server type
    const serverTypeResult = await db.query(`
      SELECT id, max_sites FROM server_types 
      WHERE size = 's-1vcpu-1gb' AND name = 'Shared'
      LIMIT 1
    `);
    
    if (serverTypeResult.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Server type not found. Please ensure the Shared server type exists.'
      });
    }
    
    const serverType = serverTypeResult.rows[0];
    
    // Create server record in database with 'creating' status
    const dbResult = await db.query(`
      INSERT INTO servers (name, region, size, status, max_sites, active_sites, server_type_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name
    `, [serverName, 'sfo3', 's-1vcpu-1gb', 'creating', serverType.max_sites, 0, serverType.id]);
    
    const server = dbResult.rows[0];
    
    // Deploy the server with agent to Digital Ocean asynchronously
    // We don't await this to provide a faster response to the client
    deployServerWithAgent(server.id, serverName).catch(error => {
      console.error(`Error in background deployment of server with agent ${server.id}:`, error);
    });
    
    res.json({ 
      success: true, 
      message: 'Server with agent deployment initiated',
      server: {
        id: server.id,
        name: server.name,
        status: 'creating',
        max_sites: serverType.max_sites,
        server_type_id: serverType.id
      }
    });
  } catch (error: any) {
    console.error('Error deploying server with agent:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to deploy server with agent', 
      message: error.message 
    });
  }
});

// Get all servers
router.get('/servers', async (req, res) => {
  try {
    console.log('GET /servers - User:', req.user?.id, 'Is Admin:', req.user?.is_admin);
    
    const result = await db.query(`
      SELECT 
        id, name, digital_ocean_id, region, size, ip_address, status,
        agent_id, created_at, updated_at
      FROM servers
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${result.rows.length} servers`);
    res.json({ servers: result.rows });
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Refresh server statuses from Digital Ocean
router.post('/servers/refresh-status', async (req, res) => {
  try {
    console.log('⚡ Refresh server statuses endpoint called by user:', req.user?.id);
    
    // Get all servers with digital_ocean_id
    const serverResult = await db.query(`
      SELECT id, digital_ocean_id 
      FROM servers 
      WHERE digital_ocean_id IS NOT NULL
    `);
    
    const servers = serverResult.rows;
    console.log(`Found ${servers.length} servers with digital_ocean_id to refresh`);
    
    let refreshedCount = 0;
    
    // Process each server asynchronously
    const refreshPromises = servers.map(async (server) => {
      try {
        // Skip servers without a DO ID
        if (!server.digital_ocean_id) return;
        
        console.log(`Checking status for server ${server.id} with droplet ${server.digital_ocean_id}`);
        // Check status with Digital Ocean
        await checkServerStatus(server.id, server.digital_ocean_id);
        refreshedCount++;
      } catch (error) {
        console.error(`Error refreshing server ${server.id}:`, error);
      }
    });
    
    // Wait for all refresh operations to complete
    await Promise.all(refreshPromises);
    
    console.log(`✅ Successfully refreshed ${refreshedCount} servers`);
    res.json({ 
      success: true, 
      message: `Refreshed status for ${refreshedCount} servers`
    });
  } catch (error) {
    console.error('Error refreshing server statuses:', error);
    res.status(500).json({ error: 'Failed to refresh server statuses' });
  }
});

// Helper function to deploy a server in the background
async function deployServer(serverId: string, serverName: string) {
  try {
    // Call Digital Ocean API to create a droplet
    const doResponse = await digitalOceanService.createServer(serverName);
    
    // Update the server record with Digital Ocean ID
    await db.query(`
      UPDATE servers
      SET digital_ocean_id = $1, status = 'provisioning'
      WHERE id = $2
    `, [doResponse.droplet.id.toString(), serverId]);
    
    // Poll for server status (simplified implementation)
    setTimeout(() => {
      checkServerStatus(serverId, doResponse.droplet.id.toString());
    }, 30000); // Check after 30 seconds
    
  } catch (error) {
    console.error(`Deployment failed for server ${serverId}:`, error);
    
    // Update status to failed
    await db.query(`
      UPDATE servers
      SET status = 'failed'
      WHERE id = $1
    `, [serverId]);
  }
}

// Helper function to check server status
async function checkServerStatus(serverId: string, dropletId: string) {
  try {
    const droplet = await digitalOceanService.getServer(dropletId);
    
    // Get IPv4 address if available
    let ipAddress = null;
    if (droplet.networks && droplet.networks.v4) {
      const publicIp = droplet.networks.v4.find((net: any) => net.type === 'public');
      if (publicIp) {
        ipAddress = publicIp.ip_address;
      }
    }
    
    // Set status based on droplet status
    let status;
    if (droplet.status === 'active') {
      status = 'running';
    } else if (droplet.status === 'new' || droplet.status === 'provisioning') {
      status = 'provisioning';
    } else {
      // For all other statuses (off, archive, etc.) mark as offline
      status = 'offline';
    }
    
    // Update server in database
    await db.query(`
      UPDATE servers
      SET status = $1, ip_address = $2
      WHERE id = $3
    `, [status, ipAddress, serverId]);
    
    // If still provisioning, check again later
    if (status === 'provisioning') {
      setTimeout(() => {
        checkServerStatus(serverId, dropletId);
      }, 30000); // Check every 30 seconds
    }
  } catch (error) {
    console.error(`Error checking server status for ${serverId}:`, error);
    
    // Check if the error indicates the droplet no longer exists (404)
    if (error instanceof Error && error.message && (error.message.includes('404') || error.message.includes('not found'))) {
      console.log(`Server ${serverId} with droplet ${dropletId} no longer exists on Digital Ocean`);
      await db.query(`
        UPDATE servers
        SET status = 'not_found'
        WHERE id = $1
      `, [serverId]);
    } else {
      // Other errors
      await db.query(`
        UPDATE servers
        SET status = 'error'
        WHERE id = $1
      `, [serverId]);
    }
  }
}

// Helper function to deploy a server with agent in the background
async function deployServerWithAgent(serverId: string, serverName: string) {
  try {
    // Call Digital Ocean API to create a droplet with agent
    const result = await digitalOceanService.createServerWithAgent(serverName);
    
    // Update the server record with Digital Ocean ID and agent ID
    await db.query(`
      UPDATE servers
      SET digital_ocean_id = $1, status = 'provisioning', agent_id = $2
      WHERE id = $3
    `, [result.droplet.id.toString(), result.agentId, serverId]);
    
    // Poll for server status (simplified implementation)
    setTimeout(() => {
      checkServerStatus(serverId, result.droplet.id.toString());
    }, 30000); // Check after 30 seconds
    
  } catch (error) {
    console.error(`Deployment failed for server ${serverId}:`, error);
    
    // Update status to failed
    await db.query(`
      UPDATE servers
      SET status = 'failed'
      WHERE id = $1
    `, [serverId]);
  }
}

// Delete a server (admin only)
router.delete('/servers/:id', async (req, res) => {
  try {
    console.log(`[Admin] Delete server ${req.params.id} requested by user ${req.user?.id}`);
    
    const serverId = req.params.id;
    
    // Check if server exists
    const serverCheck = await db.query(`
      SELECT id, name, status, digital_ocean_id
      FROM servers
      WHERE id = $1
    `, [serverId]);
    
    if (serverCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }
    
    const server = serverCheck.rows[0];
    
    // If the server has a Digital Ocean droplet, delete it
    if (server.digital_ocean_id) {
      console.log(`Admin user ${req.user?.id} requested deletion of server ${serverId} with Digital Ocean droplet ${server.digital_ocean_id}`);
      
      try {
        const DigitalOceanServiceModule = await import('../services/DigitalOceanService');
        const digitalOceanService = DigitalOceanServiceModule.default;
        await digitalOceanService.deleteServer(server.digital_ocean_id);
        console.log(`Successfully deleted Digital Ocean droplet ${server.digital_ocean_id} for server ${serverId}`);
      } catch (error) {
        console.error(`Failed to delete Digital Ocean droplet ${server.digital_ocean_id}:`, error);
        // Continue with database deletion even if Digital Ocean deletion fails
      }
    }
    
    // First, delete all sites associated with the server from the database table
    await db.query(`
      DELETE FROM sites
      WHERE server_id = $1
    `, [serverId]);
    
    // Get the agent ID for this server
    const agentResult = await db.query(`
      SELECT agent_id FROM servers WHERE id = $1
    `, [serverId]);
    
    const agentId = agentResult.rows[0]?.agent_id;
    
    // Then delete the server from the database
    await db.query(`
      DELETE FROM servers
      WHERE id = $1
    `, [serverId]);
    
    // If there was an agent associated with this server, update its status
    if (agentId) {
      await db.query(`
        UPDATE agents
        SET status = 'unassigned'
        WHERE id = $1
      `, [agentId]);
    }
    
    res.json({
      success: true,
      message: `Server "${server.name}" has been deleted`
    });
  } catch (error: any) {
    console.error(`Error deleting server:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to delete server: ${error.message}`
    });
  }
});



// Export the router
export default router;