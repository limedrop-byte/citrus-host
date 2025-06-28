import express from 'express';
import { verifyToken } from '../middleware/auth';
import { Pool } from 'pg';
import { wsServer } from '../index';

const router = express.Router();

// Initialize PostgreSQL pool with explicit configuration
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    return;
  }
  console.log('Successfully connected to database');
  release();
});

// Get sites for a user
router.get('/sites', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const showDeleted = req.query.show_deleted === 'true';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    let query = `
      SELECT 
        sites.*,
        subscriptions.plan_type,
        subscriptions.custom_email,
        subscriptions.email_marketing_tier
      FROM sites 
      LEFT JOIN subscriptions ON sites.stripe_subscription_id = subscriptions.stripe_subscription_id
      WHERE sites.user_id = $1
    `;
    
    if (!showDeleted) {
      query += ` AND sites.deploy_status != 'deleted'`;
    }
    
    query += ` ORDER BY sites.created_at DESC`;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      sites: result.rows
    });
  } catch (error: any) {
    console.error('Error fetching sites:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get a single site by ID
router.get('/site/:id', verifyToken, async (req, res) => {
  try {
    const siteId = req.params.id;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    const result = await pool.query(
      'SELECT * FROM sites WHERE id = $1 AND user_id = $2',
      [siteId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Site not found'
      });
    }
    
    res.json({
      success: true,
      site: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error fetching site:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get a list of agents
router.get('/agents', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Check if user is admin
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view agents'
      });
    }
    
    // Get all agents with their connected status from the WebSocketServer
    const result = await pool.query('SELECT * FROM agents ORDER BY created_at DESC');
    
    // Enhance with connected status
    const agents = result.rows.map(agent => {
      const isConnected = wsServer.isAgentConnected(agent.id);
      
      return {
        ...agent,
        is_connected: !!isConnected
      };
    });
    
    res.json({
      success: true,
      agents
    });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;