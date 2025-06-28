const express = require('express');
const router = express.Router();
const { Agent } = require('../../models');

// Verify agent credentials
router.post('/verify-agent', async (req, res) => {
  try {
    const { agentId, agentKey } = req.body;

    const agent = await Agent.findOne({
      where: { id: agentId, key: agentKey }
    });

    res.json({
      valid: !!agent
    });
  } catch (error) {
    console.error('Agent verification error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Create new agent
router.post('/', async (req, res) => {
  try {
    const { name, serverId } = req.body;

    // Generate random key
    const key = require('crypto').randomBytes(32).toString('hex');

    const agent = await Agent.create({
      name,
      serverId,
      key
    });

    res.json({
      id: agent.id,
      name: agent.name,
      key: agent.key // Only returned on creation
    });
  } catch (error) {
    console.error('Agent creation error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// List all agents
router.get('/', async (req, res) => {
  try {
    const agents = await Agent.findAll({
      attributes: ['id', 'name', 'serverId', 'createdAt', 'updatedAt']
    });

    res.json(agents);
  } catch (error) {
    console.error('Agent list error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Delete agent
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await Agent.destroy({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Agent deletion error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router; 