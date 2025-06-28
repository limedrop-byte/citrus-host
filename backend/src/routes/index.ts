import express from 'express';
import db from '../db';
import { verifyToken } from '../middleware/auth';
import serverRoutes from './servers';

const router = express.Router();

// Mount server routes with auth middleware
router.use('/servers', verifyToken, serverRoutes);

// Verify agent endpoint
router.post('/verify-agent', async (req, res) => {
  try {
    const { agentId, agentKey } = req.body;
    
    if (!agentId || !agentKey) {
      return res.status(400).json({ 
        valid: false,
        error: 'Missing required parameters: agentId and agentKey'
      });
    }
    
    // Check if the agent exists and the key matches
    const result = await db.query(`
      SELECT id FROM agents 
      WHERE id = $1 AND key = $2
    `, [agentId, agentKey]);
    
    if (result.rows.length === 0) {
      console.log(`Agent verification failed for ID: ${agentId}`);
      return res.status(401).json({ valid: false });
    }
    
    // Update last_seen timestamp
    await db.query(`
      UPDATE agents
      SET last_seen = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [agentId]);
    
    console.log(`Agent verified successfully: ${agentId}`);
    return res.json({ valid: true });
  } catch (error) {
    console.error('Error verifying agent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 