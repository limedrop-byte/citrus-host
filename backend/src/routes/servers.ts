import express from 'express';
import db from '../db';
import DigitalOceanService from '../services/DigitalOceanService';
import StripeSubscriptionService from '../services/StripeSubscriptionService';
import { Pool } from 'pg';
import crypto from 'crypto';
import Stripe from 'stripe';

const router = express.Router();

// Constants
const SERVER_TIMEOUT_SECONDS = 60; // Consider server offline after 1 minute without heartbeat

interface Server {
  id: number;
  status: string;
  seconds_since_last_heartbeat?: number;
}

// Heartbeat endpoint - very lightweight
router.post('/heartbeat', async (req, res) => {
  try {
    const { client_id, ip_address } = req.body;
    
    if (!client_id || !ip_address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: client_id and ip_address' 
      });
    }

    // Simple upsert with ON CONFLICT using the unique constraint
    await db.query(`
      INSERT INTO servers (client_id, ip_address, last_seen, status)
      VALUES ($1, $2, NOW(), 'online')
      ON CONFLICT (ip_address, client_id) 
      DO UPDATE SET 
        last_seen = NOW(),
        status = 'online'
    `, [client_id, ip_address]);

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Server heartbeat error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get server status
router.get('/status', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, client_id, ip_address, 
        last_seen, status,
        EXTRACT(EPOCH FROM (NOW() - last_seen)) AS seconds_since_last_heartbeat
      FROM servers
      ORDER BY last_seen DESC
    `);
    
    // Update status for any servers that haven't sent a heartbeat
    const serversToUpdate: number[] = [];
    const servers = result.rows.map((server: Server) => {
      // If server hasn't sent heartbeat in the timeout period, mark as offline
      if (server.status === 'online' && server.seconds_since_last_heartbeat! > SERVER_TIMEOUT_SECONDS) {
        server.status = 'offline';
        serversToUpdate.push(server.id);
      }
      return server;
    });
    
    // Batch update servers that are now offline
    if (serversToUpdate.length > 0) {
      await db.query(`
        UPDATE servers 
        SET status = 'offline' 
        WHERE id = ANY($1)
      `, [serversToUpdate]);
    }
    
    res.json({ servers });
  } catch (error: any) {
    console.error('Server status error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Deploy a server for an authenticated user
router.post('/deploy', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { name } = req.body;
    
    // Generate a name if not provided
    const serverName = name || `server-${Date.now()}`;
    
    // Get the server type for 'Shared' type
    const serverTypeResult = await db.query(`
      SELECT id, max_sites, subscription_plan_type FROM server_types 
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
    
    // Get the user's active subscription for this server type's plan
    let stripeSubscriptionId = null;
    if (serverType.subscription_plan_type) {
      console.log(`Looking up active subscription for user ${userId} with plan type: ${serverType.subscription_plan_type}`);
      const subscriptionResult = await db.query(`
        SELECT stripe_subscription_id 
        FROM subscriptions 
        WHERE user_id = $1 AND plan_type = $2 AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId, serverType.subscription_plan_type]);
      
      if (subscriptionResult.rows.length > 0) {
        stripeSubscriptionId = subscriptionResult.rows[0].stripe_subscription_id;
        console.log(`Found active subscription: ${stripeSubscriptionId} for Shared server type`);
      } else {
        console.log(`No active subscription found for user ${userId} with plan type: ${serverType.subscription_plan_type}`);
      }
    }
    
    // Create the server record in the database with owner set to the user and subscription ID
    const serverResult = await db.query(`
      INSERT INTO servers (
        name, region, size, status, 
        max_sites, active_sites, server_type_id, owner, stripe_subscription_id, backups_enabled
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      serverName,
      'sfo3',
      's-1vcpu-1gb',
      'creating',
      serverType.max_sites,
      0,
      serverType.id,
      userId,
      stripeSubscriptionId,
      false  // Always start with backups disabled
    ]);
    
    const serverId = serverResult.rows[0].id;
    
    // Deploy the server to Digital Ocean in the background
    // Start the server deployment process
    deployServer(serverId.toString(), serverName, userId.toString()).catch(error => {
      console.error(`Error deploying server ${serverId} for user ${userId}:`, error);
    });
    
    res.status(202).json({
      success: true,
      message: 'Server deployment initiated',
      server: {
        id: serverId,
        name: serverName,
        status: 'creating'
      }
    });
  } catch (error: any) {
    console.error('Error deploying server for user:', error);
    res.status(500).json({
      success: false,
      message: `Failed to deploy server: ${error.message}`
    });
  }
});

// Get available server types
router.get('/server-types', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const serverTypesResult = await db.query(`
      SELECT st.id, st.name, st.size, st.region, st.max_sites, 
             st.subscription_plan_type, pp.amount as price
      FROM server_types st
      LEFT JOIN plan_prices pp ON st.subscription_plan_type = pp.plan_type
      ORDER BY st.name
    `);
    
    res.json({
      success: true,
      serverTypes: serverTypesResult.rows
    });
  } catch (error: any) {
    console.error('Error fetching server types:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Deploy a server with agent for authenticated user
router.post('/deploy-with-agent', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const { name, domain, serverTypeId, subscriptionId } = req.body;
    
    // Generate a name if not provided
    const serverName = name || `server-${Date.now()}`;
    
    // Validate domain if provided
    const domainToUse = domain || null;
    
    // Get the selected server type or default to 'Standard'
    let serverTypeQuery = `
      SELECT id, name, size, region, max_sites, subscription_plan_type
      FROM server_types 
      WHERE id = $1
      LIMIT 1
    `;
    let queryParams = [serverTypeId];
    
    // If no server type ID provided, get the Standard type
    if (!serverTypeId) {
      serverTypeQuery = `
        SELECT id, name, size, region, max_sites, subscription_plan_type
        FROM server_types 
        WHERE name = 'Standard'
        LIMIT 1
      `;
      queryParams = [];
    }
    
    const serverTypeResult = await db.query(serverTypeQuery, queryParams);
    
    if (serverTypeResult.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Server type not found. Please ensure a valid server type exists.'
      });
    }

    const serverType = serverTypeResult.rows[0];
    
    // Get the user's active subscription for this server type's plan
    let stripeSubscriptionId = null;
    if (serverType.subscription_plan_type) {
      if (subscriptionId) {
        // Use the specific subscription provided by the user
        console.log(`Using user-selected subscription: ${subscriptionId}`);
        
        // Verify the subscription belongs to the user and is active
        const subscriptionResult = await db.query(`
          SELECT stripe_subscription_id 
          FROM subscriptions 
          WHERE user_id = $1 AND stripe_subscription_id = $2 AND plan_type = $3 AND status = 'active'
        `, [userId, subscriptionId, serverType.subscription_plan_type]);
        
        if (subscriptionResult.rows.length > 0) {
          stripeSubscriptionId = subscriptionId;
          console.log(`Verified user-selected subscription: ${stripeSubscriptionId} for server type: ${serverType.name}`);
        } else {
          return res.status(400).json({
            success: false,
            message: `Selected subscription not found or not active for ${serverType.subscription_plan_type} plan`
          });
        }
      } else {
        // Use the default logic (most recent subscription)
        console.log(`Looking up active subscription for user ${userId} with plan type: ${serverType.subscription_plan_type}`);
        const subscriptionResult = await db.query(`
          SELECT stripe_subscription_id 
          FROM subscriptions 
          WHERE user_id = $1 AND plan_type = $2 AND status = 'active'
          ORDER BY created_at DESC
          LIMIT 1
        `, [userId, serverType.subscription_plan_type]);
        
        if (subscriptionResult.rows.length > 0) {
          stripeSubscriptionId = subscriptionResult.rows[0].stripe_subscription_id;
          console.log(`Found active subscription: ${stripeSubscriptionId} for server type: ${serverType.name}`);
        } else {
          console.log(`No active subscription found for user ${userId} with plan type: ${serverType.subscription_plan_type}`);
        }
      }
    }
    
    // Check if this is a local-business plan
    if (serverType.subscription_plan_type === 'local-business') {
      console.log(`Local business plan detected. Creating static site record instead of deploying to Digital Ocean.`);
      
      // For local-business plans, create a site record directly without server deployment
      if (domainToUse) {
        try {
          // Insert a record into the sites table linked to subscription instead of server
          const siteResult = await db.query(`
            INSERT INTO sites (name, url, user_id, deploy_status, subscription_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
          `, [domainToUse, `https://${domainToUse}`, userId, 'active', stripeSubscriptionId]);
          
          const siteId = siteResult.rows[0].id;
          console.log(`Created local business site record for domain ${domainToUse} with subscription ${stripeSubscriptionId}`);
          
          res.status(200).json({
            success: true,
            message: 'Local business site created successfully',
            site: {
              id: siteId,
              name: domainToUse,
              url: `https://${domainToUse}`,
              deploy_status: 'active',
              plan_type: 'local-business'
            }
          });
          return;
        } catch (error) {
          console.error(`Failed to create local business site record for ${domainToUse}:`, error);
          return res.status(500).json({
            success: false,
            message: 'Failed to create local business site'
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Domain name is required for local business plans'
        });
      }
    }
    
    // For non-local-business plans, proceed with normal server deployment
    // Create the server record in the database with owner set to the user and subscription ID
    const serverResult = await db.query(`
      INSERT INTO servers (
        name, region, size, status, 
        max_sites, active_sites, server_type_id, owner, stripe_subscription_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      serverName,
      serverType.region,
      serverType.size,
      'creating',
      serverType.max_sites,
      0,
      serverType.id,
      userId,
      stripeSubscriptionId
    ]);
    
    const serverId = serverResult.rows[0].id;
    
    // If domain is provided, create a website record
    if (domainToUse) {
      try {
        // Insert a record into the sites table if it exists
        await db.query(`
          INSERT INTO sites (name, url, user_id, deploy_status, server_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [domainToUse, `https://${domainToUse}`, userId, 'starting', serverId]);
        
        console.log(`Created website record for domain ${domainToUse} on server ${serverId}`);
      } catch (error) {
        // Log but don't fail if there's an issue with site creation
        console.error(`Failed to create site record for ${domainToUse}:`, error);
      }
    }
    
    // Deploy the server with agent to Digital Ocean in the background
    deployServerWithAgent(serverId.toString(), serverName, serverType.size, serverType.region).catch(error => {
      console.error(`Error deploying server ${serverId} for user ${userId}:`, error);
    });
    
    res.status(202).json({
      success: true,
      message: 'Server deployment initiated',
      server: {
        id: serverId,
        name: serverName,
        status: 'creating',
        server_type: serverType.name
      }
    });
  } catch (error: any) {
    console.error('Error deploying server for user:', error);
    res.status(500).json({
      success: false,
      message: `Failed to deploy server: ${error.message}`
    });
  }
});

// Get servers for authenticated user
router.get('/', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // First, check for any servers with Digital Ocean IDs that need verification
    const checkServers = await db.query(`
      SELECT id, digital_ocean_id 
      FROM servers 
      WHERE owner = $1 
      AND digital_ocean_id IS NOT NULL
      AND status NOT IN ('failed', 'not_found')
    `, [userId]);
    
    console.log(`Checking ${checkServers.rows.length} servers for user ${userId}`);
    
    // Validate servers in parallel
    if (checkServers.rows.length > 0) {
      for (const server of checkServers.rows) {
        try {
          // Check if the DigitalOcean droplet still exists
          await DigitalOceanService.getServer(server.digital_ocean_id);
        } catch (error) {
          if (error instanceof Error && 
              error.message && 
              (error.message.includes('404') || error.message.includes('not found'))) {
            console.log(`Server ${server.id} with droplet ${server.digital_ocean_id} no longer exists. Marking as not_found.`);
            
            // Update status to not_found since the droplet doesn't exist
            await db.query(`
              UPDATE servers
              SET status = 'not_found'
              WHERE id = $1
            `, [server.id]);
          }
        }
      }
    }
    
    // Get all servers owned by this user, including agent information and backups status
    const result = await db.query(`
      SELECT s.*, st.name as server_type_name, 
             a.id as agent_id, a.status as agent_status,
             s.stripe_subscription_id,
             s.backups_enabled,
             sub.plan_type
      FROM servers s
      LEFT JOIN server_types st ON s.server_type_id = st.id
      LEFT JOIN agents a ON s.agent_id = a.id
      LEFT JOIN subscriptions sub ON s.stripe_subscription_id = sub.stripe_subscription_id
      WHERE s.owner = $1
      ORDER BY s.created_at DESC
    `, [userId]);

    // Also get subscription-based sites that are not tied to servers (includes upgraded local business sites)
    const subscriptionBasedSites = await db.query(`
      SELECT sites.*, 
             sub.plan_type,
             CASE 
               WHEN sub.plan_type = 'local-business' THEN 'Local Business'
               WHEN sub.plan_type = 'standard' THEN 'Standard'
               WHEN sub.plan_type = 'performance' THEN 'Performance'
               WHEN sub.plan_type = 'scale' THEN 'Scale'
               ELSE INITCAP(sub.plan_type)
             END as server_type_name,
             NULL as agent_id,
             NULL as agent_status,
             sites.subscription_id as stripe_subscription_id,
             false as backups_enabled
      FROM sites
      LEFT JOIN subscriptions sub ON sites.subscription_id = sub.stripe_subscription_id
      WHERE sites.user_id = $1 
      AND sites.server_id IS NULL 
      AND sites.subscription_id IS NOT NULL
      AND sub.status = 'active'
      ORDER BY sites.created_at DESC
    `, [userId]);

    // Combine servers and subscription-based sites
    const allItems = [
      ...result.rows,
      ...subscriptionBasedSites.rows.map((site: any) => ({
        ...site,
        // Map site fields to server-like structure for frontend compatibility
        id: `site-${site.id}`, // Prefix to distinguish from servers
        name: site.name,
        status: site.deploy_status === 'active' ? 'active' : site.deploy_status,
        deploy_status: site.deploy_status, // Explicitly include deploy_status
        digital_ocean_id: null,
        ip_address: null,
        region: null,
        size: null,
        max_sites: 1,
        active_sites: 1,
        server_type_id: null,
        owner: site.user_id,
        is_local_business_site: true // Flag to identify these as sites
      }))
    ];
    
    res.json({
      success: true,
      servers: allItems
    });
  } catch (error: any) {
    console.error('Error fetching user servers:', error);
    res.status(500).json({
      success: false,
      message: `Failed to fetch servers: ${error.message}`
    });
  }
});

// Delete a server or local business site owned by the authenticated user
router.delete('/:id', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const itemId = req.params.id;
    
    // Check if this is a local business site (prefixed with 'site-')
    if (itemId.startsWith('site-')) {
      const siteId = itemId.replace('site-', '');
      
      // Check if site exists and belongs to the user
      const siteCheck = await db.query(`
        SELECT id, name, subscription_id
        FROM sites
        WHERE id = $1 AND user_id = $2 AND server_id IS NULL
      `, [siteId, userId]);
      
      if (siteCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Local business site not found or does not belong to you'
        });
      }
      
      const site = siteCheck.rows[0];
      
      // Delete the local business site from the database
      await db.query(`
        DELETE FROM sites
        WHERE id = $1
      `, [siteId]);
      
      res.json({
        success: true,
        message: `Local business site "${site.name}" has been deleted`
      });
      return;
    }
    
    // Handle regular server deletion
    const serverId = itemId;
    
    // Check if server exists and belongs to the user
    const serverCheck = await db.query(`
      SELECT id, name, status, digital_ocean_id
      FROM servers
      WHERE id = $1 AND owner = $2
    `, [serverId, userId]);
    
    if (serverCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Server not found or does not belong to you'
      });
    }
    
    const server = serverCheck.rows[0];
    
    // If the server has a Digital Ocean droplet, delete it
    if (server.digital_ocean_id) {
      console.log(`User ${userId} requested deletion of server ${serverId} with Digital Ocean droplet ${server.digital_ocean_id}`);
      
      try {
        await DigitalOceanService.deleteServer(server.digital_ocean_id);
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
    
    // Get the agent ID for this server before deleting
    const agentResult = await db.query(`
      SELECT agent_id FROM servers WHERE id = $1
    `, [serverId]);
    
    const agentId = agentResult.rows[0]?.agent_id;
    
    // Then delete the server from the database
    await db.query(`
      DELETE FROM servers
      WHERE id = $1
    `, [serverId]);
    
    // If there was an agent associated with this server, delete it
    if (agentId) {
      console.log(`Deleting agent ${agentId} associated with server ${serverId}`);
      await db.query(`
        DELETE FROM agents
        WHERE id = $1
      `, [agentId]);
      console.log(`Successfully deleted agent ${agentId}`);
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

// Reset active_sites count for a server (admin only)
router.post('/:id/reset-sites', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user is an admin
    const userCheck = await db.query(`
      SELECT is_admin FROM users WHERE id = $1
    `, [userId]);
    
    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const serverId = req.params.id;
    
    // Check if server exists
    const serverCheck = await db.query(`
      SELECT id, name FROM servers WHERE id = $1
    `, [serverId]);
    
    if (serverCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }
    
    const server = serverCheck.rows[0];
    
    // Reset the server's active_sites count to 0
    await db.query(`
      UPDATE servers
      SET active_sites = 0
      WHERE id = $1
    `, [serverId]);
    
    res.json({
      success: true,
      message: `Active sites count for server "${server.name}" has been reset to 0`
    });
  } catch (error: any) {
    console.error(`Error resetting active sites count:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to reset active sites count: ${error.message}`
    });
  }
});

// Upsize a server to a larger size
router.post('/:id/upsize', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const serverId = req.params.id;
    const { serverTypeId } = req.body;
    
    if (!serverTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Server type ID is required'
      });
    }
    
    // Check if server exists and belongs to the user
    const serverCheck = await db.query(`
      SELECT s.id, s.name, s.status, s.digital_ocean_id, s.server_type_id, s.size,
             s.stripe_subscription_id, st.size as current_size, st.subscription_plan_type as current_plan
      FROM servers s
      JOIN server_types st ON s.server_type_id = st.id
      WHERE s.id = $1 AND s.owner = $2
    `, [serverId, userId]);
    
    if (serverCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Server not found or does not belong to you'
      });
    }
    
    const server = serverCheck.rows[0];
    
    // Check if the server is in a state where it can be upsized
    if (server.status !== 'running') {
      return res.status(400).json({
        success: false,
        message: 'Server must be running to upsize'
      });
    }
    
    // Get the new server type
    const serverTypeCheck = await db.query(`
      SELECT id, name, size, max_sites, subscription_plan_type
      FROM server_types
      WHERE id = $1
    `, [serverTypeId]);
    
    if (serverTypeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Server type not found'
      });
    }
    
    const newServerType = serverTypeCheck.rows[0];
    
    // Prevent downsizing - only allow upgrading to larger sizes
    const sizeRanking: Record<string, number> = {
      's-1vcpu-512mb-10gb': 1,  // Light
      's-1vcpu-1gb': 2,         // Standard
      's-1vcpu-2gb': 3,         // Performance
      's-2vcpu-2gb': 4          // Scale
    };
    
    if (!server.digital_ocean_id) {
      return res.status(400).json({
        success: false,
        message: 'Server cannot be upsized (missing Digital Ocean ID)'
      });
    }
    
    const currentSizeRank = sizeRanking[server.current_size as string];
    const newSizeRank = sizeRanking[newServerType.size as string];
    
    if (!currentSizeRank || !newSizeRank) {
      return res.status(400).json({
        success: false,
        message: 'Current or new server size not recognized'
      });
    }
    
    if (newSizeRank <= currentSizeRank) {
      return res.status(400).json({
        success: false,
        message: 'Downgrading is not allowed to prevent data loss'
      });
    }

    // Check if subscription upgrade is required
    const currentPlan = server.current_plan;
    const newPlan = newServerType.subscription_plan_type;
    let subscriptionUpgraded = false;
    let chargedAmount = '0.00';
    
    if (currentPlan !== newPlan && server.stripe_subscription_id) {
      console.log(`[UPSIZE] Subscription upgrade required: ${currentPlan} → ${newPlan}`);
      
      // Validate upgrade eligibility
      const eligibility = await StripeSubscriptionService.validateUpgradeEligibility(
        server.stripe_subscription_id,
        currentPlan,
        newPlan
      );
      
      if (!eligibility.eligible) {
        return res.status(400).json({
          success: false,
          message: `Subscription upgrade not allowed: ${eligibility.reason}`
        });
      }
      
      // Upgrade the main Stripe subscription
      const upgradeResult = await StripeSubscriptionService.upgradeSubscription(
        server.stripe_subscription_id,
        newPlan
      );
      
      if (!upgradeResult.success) {
        return res.status(400).json({
          success: false,
          message: `Failed to upgrade subscription: ${upgradeResult.error}`
        });
      }
      
      // Update local main subscription record
      await db.query(`
        UPDATE subscriptions 
        SET plan_type = $1, updated_at = NOW()
        WHERE stripe_subscription_id = $2
      `, [newPlan, server.stripe_subscription_id]);
      
      // Set initial charge amount from main subscription upgrade
      chargedAmount = upgradeResult.invoice ? (upgradeResult.invoice.amount_paid / 100).toFixed(2) : '0.00';
      
      // Check if there's a backup addon to upgrade
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-05-28.basil',
      });
      
      try {
        // Get the subscription to check for backup addon
        const stripeSubscription = await stripe.subscriptions.retrieve(server.stripe_subscription_id);

        // Map server tiers directly to backup price IDs
        const backupPriceIds: Record<string, string> = {
          'local-business': 'price_1RZPABDBpWxtVXcSw7npIZRh',  // $5
          'standard': 'price_1RZP9rDBpWxtVXcS592ZOX6V',        // $15
          'performance': 'price_1RZP9zDBpWxtVXcSMFlHdwIk',     // $30
          'scale': 'price_1RZPA6DBpWxtVXcSXOyQqm8w'           // $45
        };

        // Find the backup item by current price ID
        const currentBackupPriceId = backupPriceIds[currentPlan];
        const backupItem = stripeSubscription.items.data.find(item => 
          item.price.id === currentBackupPriceId
        );

        console.log(`[UPSIZE] Found backup item:`, backupItem ? {
          id: backupItem.id,
          currentPrice: backupItem.price.id,
          currentPlan,
          newPlan,
          expectedNewPrice: backupPriceIds[newPlan]
        } : 'No backup item found');
        
        if (backupItem) {
          console.log(`[UPSIZE] Found backup item to upgrade:`, {
            id: backupItem.id,
            currentPrice: backupItem.price.id,
            currentPlan,
            newPlan,
            expectedNewPrice: backupPriceIds[newPlan]
          });
          
          // Upgrade the backup addon using the direct price ID mapping
          const backupUpgradeResult = await StripeSubscriptionService.upgradeBackupAddon(
            server.stripe_subscription_id,
            currentPlan,  // The server tier is the same as the backup tier
            newPlan,      // The new server tier is the same as the new backup tier
            userId.toString()
          );
          
          if (backupUpgradeResult.success) {
            console.log(`[UPSIZE] Successfully upgraded backup addon:`, backupUpgradeResult);
            
            // Add backup upgrade cost to total charged amount
            if (backupUpgradeResult.invoice) {
              const backupChargeAmount = backupUpgradeResult.invoice.amount_paid / 100;
              chargedAmount = (parseFloat(chargedAmount) + backupChargeAmount).toFixed(2);
            }
          } else {
            console.error(`[UPSIZE] Failed to upgrade backup addon: ${backupUpgradeResult.error}`);
            // Don't fail the entire operation for backup upgrade failure
          }
        }
      } catch (stripeError) {
        console.error(`[UPSIZE] Error checking/upgrading backup addon:`, stripeError);
        // Don't fail the entire operation for backup errors
      }
      
      subscriptionUpgraded = true;
      console.log(`[UPSIZE] Subscription successfully upgraded from ${currentPlan} to ${newPlan}, total charged $${chargedAmount}`);
    }
    
    // Update server status to indicate it's being upsized
    await db.query(`
      UPDATE servers
      SET status = 'resizing'
      WHERE id = $1
    `, [serverId]);
    
    try {
      // Resize the server on Digital Ocean
      console.log(`[UPSIZE] Resizing server ${serverId} (DO ID: ${server.digital_ocean_id}) from ${server.current_size} to ${newServerType.size}`);
      const resizeResponse = await DigitalOceanService.resizeServer(
        server.digital_ocean_id,
        newServerType.size,
        true  // Always resize disk to ensure enough space
      );
      
      console.log('[UPSIZE] DigitalOcean resize response:', JSON.stringify(resizeResponse, null, 2));
      
      // Update the server type in the database
      await db.query(`
        UPDATE servers
        SET server_type_id = $1, size = $2, max_sites = $3
        WHERE id = $4
      `, [newServerType.id, newServerType.size, newServerType.max_sites, serverId]);
      
      // Start checking the server status regularly
      checkServerStatus(serverId, server.digital_ocean_id);
      
      // Set up a check to power on the droplet if needed after resize is complete
      monitorResizeCompletion(server.digital_ocean_id, resizeResponse.action.id)
        .catch(error => {
          console.error(`[UPSIZE] Error monitoring resize completion for server ${serverId}:`, error);
        });
      
      // Return the full response along with subscription upgrade info
      res.json({
        success: true,
        message: `Server "${server.name}" is being upsized to ${newServerType.name}${subscriptionUpgraded ? ` and subscription upgraded (charged $${chargedAmount})` : ''}`,
        server: {
          id: serverId,
          name: server.name,
          status: 'resizing',
          newType: newServerType.name
        },
        subscriptionUpgraded,
        chargedAmount: subscriptionUpgraded ? chargedAmount : undefined,
        action: resizeResponse.action
      });
      
    } catch (digitalOceanError: any) {
      console.error('[UPSIZE] DigitalOcean resize failed, rolling back subscription:', digitalOceanError);
      
      // If DigitalOcean fails and we upgraded the subscription, rollback
      if (subscriptionUpgraded && server.stripe_subscription_id) {
        console.log(`[UPSIZE] Rolling back main subscription from ${newPlan} to ${currentPlan}`);
        
        const rollbackResult = await StripeSubscriptionService.upgradeSubscription(
          server.stripe_subscription_id,
          currentPlan
        );
        
        if (rollbackResult.success) {
          // Update local main subscription record back
          await db.query(`
            UPDATE subscriptions 
            SET plan_type = $1, updated_at = NOW()
            WHERE stripe_subscription_id = $2
          `, [currentPlan, server.stripe_subscription_id]);
          console.log(`[UPSIZE] Main subscription rollback successful`);
        } else {
          console.error(`[UPSIZE] Failed to rollback main subscription: ${rollbackResult.error}`);
        }
        
        // Check if we need to rollback backup addon
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2025-05-28.basil',
          });
          
          // Get the subscription to check for backup addon
          const stripeSubscription = await stripe.subscriptions.retrieve(server.stripe_subscription_id);

          // Map server tiers directly to backup price IDs
          const backupPriceIds: Record<string, string> = {
            'local-business': 'price_1RZPABDBpWxtVXcSw7npIZRh',  // $5
            'standard': 'price_1RZP9rDBpWxtVXcS592ZOX6V',        // $15
            'performance': 'price_1RZP9zDBpWxtVXcSMFlHdwIk',     // $30
            'scale': 'price_1RZPA6DBpWxtVXcSXOyQqm8w'           // $45
          };

          // Find the backup item by current price ID
          const currentBackupPriceId = backupPriceIds[currentPlan];
          const backupItem = stripeSubscription.items.data.find(item => 
            item.price.id === currentBackupPriceId
          );

          console.log(`[UPSIZE] Found backup item:`, backupItem ? {
            id: backupItem.id,
            currentPrice: backupItem.price.id,
            currentPlan,
            newPlan,
            expectedNewPrice: backupPriceIds[newPlan]
          } : 'No backup item found');
          
          if (backupItem) {
            console.log(`[UPSIZE] Found backup item to rollback:`, {
              id: backupItem.id,
              currentPrice: backupItem.price.id,
              currentPlan,
              newPlan,
              expectedNewPrice: backupPriceIds[newPlan]
            });
            
            // Rollback the backup addon
            const backupRollbackResult = await StripeSubscriptionService.upgradeBackupAddon(
              server.stripe_subscription_id,
              newPlan,  // Current plan during rollback
              currentPlan,  // Target plan to rollback to
              userId.toString()
            );
            
            if (backupRollbackResult.success) {
              console.log(`[UPSIZE] Successfully rolled back backup addon`);
            } else {
              console.error(`[UPSIZE] Failed to rollback backup addon: ${backupRollbackResult.error}`);
            }
          }
        } catch (stripeError) {
          console.error(`[UPSIZE] Error checking/rolling back backup addon:`, stripeError);
        }
      }
      
      // Reset server status
      await db.query(`
        UPDATE servers
        SET status = 'running'
        WHERE id = $1
      `, [serverId]);
      
      throw digitalOceanError;
    }
    
  } catch (error: any) {
    console.error(`[UPSIZE] Error upsizing server:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to upsize server: ${error.message}`
    });
  }
});

// Toggle backups for a server
router.post('/:id/toggle-backups', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const serverId = req.params.id;
    const { enable = true } = req.body; // Default to enabling backups
    
    console.log(`Toggle backups request for server ${serverId} with enable=${enable}`);
    
    // Check if server exists and belongs to the user
    const serverCheck = await db.query(`
      SELECT s.id, s.name, s.status, s.digital_ocean_id, s.backups_enabled, st.subscription_plan_type, s.stripe_subscription_id
      FROM servers s
      JOIN server_types st ON s.server_type_id = st.id
      WHERE s.id = $1 AND s.owner = $2
    `, [serverId, userId]);
    
    if (serverCheck.rows.length === 0) {
      console.log(`Server ${serverId} not found or does not belong to user ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'Server not found or does not belong to you'
      });
    }
    
    const server = serverCheck.rows[0];
    console.log(`Found server: ${JSON.stringify(server)}`);
    
    // Check if the server is in a state where backups can be configured
    if (server.status !== 'running') {
      console.log(`Server ${serverId} status is ${server.status}, must be running to configure backups`);
      return res.status(400).json({
        success: false,
        message: 'Server must be running to configure backups'
      });
    }
    
    if (!server.digital_ocean_id) {
      console.log(`Server ${serverId} has no Digital Ocean ID`);
      return res.status(400).json({
        success: false,
        message: 'Server cannot have backups configured (missing Digital Ocean ID)'
      });
    }

    // If enabling backups, check if this server's specific subscription has backup addon
    if (enable) {
      if (!server.stripe_subscription_id) {
        return res.status(400).json({
          success: false,
          message: 'Server has no associated subscription. Cannot enable backups.'
        });
      }
      
      const backupSubscriptionResult = await db.query(`
        SELECT id, backup_id FROM subscriptions 
        WHERE user_id = $1 
        AND stripe_subscription_id = $2 
        AND plan_type = $3 
        AND status = 'active'
      `, [userId, server.stripe_subscription_id, server.subscription_plan_type]);
      
      console.log(`[BACKUP CHECK] Found ${backupSubscriptionResult.rows.length} subscriptions for user ${userId}, subscription_id ${server.stripe_subscription_id}, plan ${server.subscription_plan_type}`);
      if (backupSubscriptionResult.rows.length > 0) {
        console.log(`[BACKUP CHECK] Subscription details:`, backupSubscriptionResult.rows[0]);
      }
      
      if (backupSubscriptionResult.rows.length === 0 || !backupSubscriptionResult.rows[0].backup_id) {
        console.log(`[BACKUP CHECK] No backup subscription found - returning error`);
        return res.status(400).json({
          success: false,
          message: 'You need a backup subscription to enable backups. Please upgrade your plan first.'
        });
      }
    }

    // Enable or disable backups via Digital Ocean API
    let actionResponse;
    try {
      if (enable) {
        console.log(`Enabling backups for Digital Ocean droplet ${server.digital_ocean_id}`);
        // Enable backups (default to 8PM UTC)
        actionResponse = await DigitalOceanService.enableBackups(server.digital_ocean_id, 20);
      } else {
        console.log(`Disabling backups for Digital Ocean droplet ${server.digital_ocean_id}`);
        // Disable backups
        actionResponse = await DigitalOceanService.disableBackups(server.digital_ocean_id);
      }
      
      console.log(`Digital Ocean API response: ${JSON.stringify(actionResponse)}`);
    } catch (doError) {
      console.error(`Error from Digital Ocean API:`, doError);
      throw doError;
    }

    // Update the backups_enabled flag in the database
    await db.query(`
      UPDATE servers 
      SET backups_enabled = $1 
      WHERE id = $2
    `, [enable, serverId]);
    
    console.log(`Updated server ${serverId} backups_enabled to ${enable}`);

    res.json({
      success: true,
      message: enable ? 'Backups enabled successfully' : 'Backups disabled successfully',
      server_id: serverId,
      backups_enabled: enable,
      action: actionResponse
    });
    
  } catch (error: any) {
    console.error(`Error toggling backups for server:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to ${req.body.enable ? 'enable' : 'disable'} backups: ${error.message}`
    });
  }
});

// Get available backups for a server
router.get('/:id/backups', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const serverId = req.params.id;
    
    // Check if server exists and belongs to the user
    const serverCheck = await db.query(`
      SELECT s.id, s.name, s.status, s.digital_ocean_id
      FROM servers s
      WHERE s.id = $1 AND s.owner = $2
    `, [serverId, userId]);
    
    if (serverCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Server not found or does not belong to you'
      });
    }
    
    const server = serverCheck.rows[0];
    
    if (!server.digital_ocean_id) {
      return res.status(400).json({
        success: false,
        message: 'Server cannot have backups (missing Digital Ocean ID)'
      });
    }

    // Get backups from Digital Ocean API
    const backups = await DigitalOceanService.getBackups(server.digital_ocean_id);
    
    // Format backups for response
    const formattedBackups = backups.map((backup: any) => ({
      id: backup.id,
      name: backup.name,
      date: backup.created_at,
      size: `${Math.round(backup.size_gigabytes)}GB`, // Convert to GB format
      status: backup.status
    }));
    
    res.json({
      success: true,
      server_id: serverId,
      backups: formattedBackups
    });
    
  } catch (error: any) {
    console.error(`Error fetching backups for server:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to fetch backups: ${error.message}`
    });
  }
});

// Restore a server from a backup
router.post('/:id/restore', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const serverId = req.params.id;
    const { backupId } = req.body;
    
    if (!backupId) {
      return res.status(400).json({
        success: false,
        message: 'Backup ID is required'
      });
    }
    
    // Check if server exists and belongs to the user
    const serverCheck = await db.query(`
      SELECT s.id, s.name, s.status, s.digital_ocean_id
      FROM servers s
      WHERE s.id = $1 AND s.owner = $2
    `, [serverId, userId]);
    
    if (serverCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Server not found or does not belong to you'
      });
    }
    
    const server = serverCheck.rows[0];
    
    if (!server.digital_ocean_id) {
      return res.status(400).json({
        success: false,
        message: 'Server cannot be restored (missing Digital Ocean ID)'
      });
    }
    
    // Initiate restore via Digital Ocean API
    console.log(`Starting restore for server ${serverId} from backup ${backupId}`);
    const restoreResponse = await DigitalOceanService.restoreBackup(server.digital_ocean_id, backupId);
    
    // Update server status to indicate restoration in progress
    await db.query(`
      UPDATE servers 
      SET status = 'restoring'
      WHERE id = $1
    `, [serverId]);
    
    // Update all sites on this server to show restoring status
    await db.query(`
      UPDATE sites 
      SET deploy_status = 'restoring'
      WHERE server_id = $1
    `, [serverId]);
    
    // Start monitoring restore completion in the background (don't await)
    monitorRestoreCompletion(serverId, restoreResponse.action.id, server.digital_ocean_id);
    
    res.json({
      success: true,
      message: 'Backup restore initiated successfully',
      action_id: restoreResponse.action?.id,
      server_id: serverId
    });
    
  } catch (error: any) {
    console.error(`Error restoring backup for server:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to restore backup: ${error.message}`
    });
  }
});

// Function to monitor restore completion
async function monitorRestoreCompletion(serverId: string, actionId: number, digitalOceanId: string) {
  const maxAttempts = 40; // Monitor for up to 20 minutes (40 attempts * 30 seconds)
  let attempts = 0;
  
  const checkActionStatus = async (): Promise<boolean> => {
    try {
      attempts++;
      console.log(`[RESTORE MONITOR] Checking restore action ${actionId} status (attempt ${attempts}/${maxAttempts})`);
      
      const actionStatus = await DigitalOceanService.getDropletAction(digitalOceanId, actionId);
      const status = actionStatus.action.status;
      
      console.log(`[RESTORE MONITOR] Action ${actionId} status: ${status}`);
      
      if (status === 'completed') {
        console.log(`[RESTORE MONITOR] Restore completed successfully for server ${serverId}`);
        
        // Update server status to running
        await db.query(`
          UPDATE servers 
          SET status = 'running'
          WHERE id = $1
        `, [serverId]);
        
        // Update all sites on this server back to active status
        await db.query(`
          UPDATE sites 
          SET deploy_status = 'active'
          WHERE server_id = $1
        `, [serverId]);
        
        console.log(`[RESTORE MONITOR] Successfully updated server ${serverId} status to running`);
        return true; // Stop monitoring
        
      } else if (status === 'errored') {
        console.log(`[RESTORE MONITOR] Restore failed for server ${serverId}`);
        
        // Update server status to failed
        await db.query(`
          UPDATE servers 
          SET status = 'failed'
          WHERE id = $1
        `, [serverId]);
        
        // Update all sites on this server to failed status
        await db.query(`
          UPDATE sites 
          SET deploy_status = 'failed'
          WHERE server_id = $1
        `, [serverId]);
        
        console.log(`[RESTORE MONITOR] Updated server ${serverId} status to failed`);
        return true; // Stop monitoring
        
      } else if (attempts >= maxAttempts) {
        console.log(`[RESTORE MONITOR] Timeout reached for server ${serverId} restore monitoring`);
        
        // Update server status to unknown if we can't determine the final status
        await db.query(`
          UPDATE servers 
          SET status = 'unknown'
          WHERE id = $1
        `, [serverId]);
        
        return true; // Stop monitoring
        
      } else {
        console.log(`[RESTORE MONITOR] Restore still in progress for server ${serverId}, will check again in 30 seconds`);
        return false; // Continue monitoring
      }
      
    } catch (error) {
      console.error(`[RESTORE MONITOR] Error checking action status for server ${serverId}:`, error);
      
      if (attempts >= maxAttempts) {
        console.log(`[RESTORE MONITOR] Max attempts reached, stopping monitoring for server ${serverId}`);
        return true; // Stop monitoring
      }
      
      return false; // Continue monitoring despite error
    }
  };
  
  // Start monitoring with 30-second intervals
  const monitorInterval = setInterval(async () => {
    const shouldStop = await checkActionStatus();
    
    if (shouldStop) {
      clearInterval(monitorInterval);
      console.log(`[RESTORE MONITOR] Stopped monitoring for server ${serverId}`);
    }
  }, 30000); // Check every 30 seconds
  
  // Initial check after 10 seconds
  setTimeout(async () => {
    const shouldStop = await checkActionStatus();
    if (shouldStop) {
      clearInterval(monitorInterval);
      console.log(`[RESTORE MONITOR] Stopped monitoring for server ${serverId} after initial check`);
    }
  }, 10000);
}

// Check restore action status
router.get('/:id/restore-status/:actionId', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const serverId = req.params.id;
    const actionId = req.params.actionId;
    
    // Check if server exists and belongs to the user
    const serverCheck = await db.query(`
      SELECT s.id, s.name, s.status, s.digital_ocean_id
      FROM servers s
      WHERE s.id = $1 AND s.owner = $2
    `, [serverId, userId]);
    
    if (serverCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Server not found or does not belong to you'
      });
    }
    
    const server = serverCheck.rows[0];
    
    if (!server.digital_ocean_id) {
      return res.status(400).json({
        success: false,
        message: 'Server does not have a Digital Ocean ID'
      });
    }
    
    // Get action status from Digital Ocean API
    console.log(`Checking restore action status ${actionId} for server ${serverId}`);
    const actionStatus = await DigitalOceanService.getDropletAction(server.digital_ocean_id, parseInt(actionId));
    
    console.log(`Action ${actionId} status:`, JSON.stringify(actionStatus, null, 2));
    
    // If action is completed, update server status back to running
    if (actionStatus.action.status === 'completed') {
      await db.query(`
        UPDATE servers 
        SET status = 'running'
        WHERE id = $1
      `, [serverId]);
      
      // Update all sites on this server back to active status
      await db.query(`
        UPDATE sites 
        SET deploy_status = 'active'
        WHERE server_id = $1
      `, [serverId]);
      
      console.log(`Restore completed for server ${serverId} - updated status to running`);
    } else if (actionStatus.action.status === 'errored') {
      await db.query(`
        UPDATE servers 
        SET status = 'failed'
        WHERE id = $1
      `, [serverId]);
      
      console.log(`Restore failed for server ${serverId} - updated status to failed`);
    }
    
    res.json({
      success: true,
      action: actionStatus.action,
      server_id: serverId
    });
    
  } catch (error: any) {
    console.error(`Error checking restore status:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to check restore status: ${error.message}`
    });
  }
});

// Get agent metrics for a specific server (customer-accessible)
router.get('/:id/agent-metrics', async (req, res) => {
  try {
    const serverId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // First, verify that the user owns this server
    const serverResult = await db.query(`
      SELECT s.*, a.id as agent_id, a.status as agent_status, a.last_seen, a.service_status, a.git_version
      FROM servers s
      LEFT JOIN agents a ON s.agent_id = a.id
      WHERE s.id = $1 AND s.owner = $2
    `, [serverId, userId]);

    if (serverResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Server not found or access denied'
      });
    }

    const server = serverResult.rows[0];

    if (!server.agent_id) {
      return res.status(404).json({
        success: false,
        message: 'Server does not have an agent installed'
      });
    }

    // Check if we have recent status data
    if (!server.last_seen) {
      return res.status(404).json({
        success: false,
        message: 'No agent status data available'
      });
    }

    const lastSeen = new Date(server.last_seen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (lastSeen < fiveMinutesAgo) {
      return res.status(404).json({
        success: false,
        message: 'Agent has not sent status updates in the last 5 minutes'
      });
    }

    // Parse service status if available
    let fullStatus = null;
    if (server.service_status) {
      // If it's already an object (JSONB column), use it directly
      if (typeof server.service_status === 'object') {
        fullStatus = server.service_status;
      } else {
        // If it's a string, parse it
        try {
          fullStatus = JSON.parse(server.service_status);
        } catch (error) {
          console.error('Error parsing service status:', error);
        }
      }
    }

    // Return metrics in the expected format
    const metrics = {
      agentId: server.agent_id,
      status: fullStatus || {
        hostname: server.name,
        services: null,
        gitVersion: server.git_version,
        timestamp: new Date(server.last_seen).getTime(),
        lastSeen: server.last_seen
      }
    };

    res.json({ 
      success: true, 
      metrics 
    });
  } catch (error) {
    console.error('Error fetching server agent metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agent metrics'
    });
  }
});

// Helper function to deploy a server
async function deployServer(serverId: string, serverName: string, userId: string) {
  try {
    // Call Digital Ocean API to create a droplet
    const doResponse = await DigitalOceanService.createServer(serverName);
    
    // Update the server record with Digital Ocean ID
    await db.query(`
      UPDATE servers
      SET digital_ocean_id = $1, status = 'provisioning'
      WHERE id = $2
    `, [doResponse.droplet.id.toString(), serverId]);
    
    // Poll for server status
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

// Helper function to deploy a server with agent
async function deployServerWithAgent(serverId: string, serverName: string, size: string, region: string) {
  try {
    console.log(`Starting deployment of server ${serverId} with name ${serverName}, size: ${size}, region: ${region}`);
    
    // Create a Digital Ocean droplet with agent installed
    const result = await DigitalOceanService.createServerWithAgent(serverName, size, region);
    
    // Store the droplet ID in the database
    await db.query(`
      UPDATE servers
      SET digital_ocean_id = $1, agent_id = $2, status = 'provisioning'
      WHERE id = $3
    `, [result.droplet.id, result.agent.id, serverId]);
    
    // Update agent status only (server_id column doesn't exist)
    await db.query(`
      UPDATE agents
      SET status = 'offline'
      WHERE id = $1
    `, [result.agent.id]);
    
    console.log(`Server ${serverId} deployed successfully. Droplet ID: ${result.droplet.id}`);
    
    // Start checking the status of the server periodically
    checkServerStatus(serverId, result.droplet.id.toString());
    
  } catch (error) {
    console.error(`Error deploying server ${serverId}:`, error);
    
    // Get the agent ID for this server
    const serverInfo = await db.query(`
      SELECT agent_id FROM servers WHERE id = $1
    `, [serverId]);
    
    const agentId = serverInfo.rows[0]?.agent_id;
    
    // Update server status to failed
    await db.query(`
      UPDATE servers
      SET status = 'failed'
      WHERE id = $1
    `, [serverId]);
    
    // Also update the agent status if one was assigned
    if (agentId) {
      await db.query(`
        UPDATE agents
        SET status = 'error'
        WHERE id = $1
      `, [agentId]);
    }
  }
}

// Helper function to check server status
async function checkServerStatus(serverId: string, dropletId: string) {
  try {
    console.log(`Checking status for server ${serverId} with droplet ID ${dropletId}`);
    const droplet = await DigitalOceanService.getServer(dropletId);
    
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
    
    console.log(`Updating server ${serverId} with status ${status}, IP: ${ipAddress || 'none'}`);
    
    // Update server in database
    await db.query(`
      UPDATE servers
      SET status = $1, ip_address = $2
      WHERE id = $3
    `, [status, ipAddress, serverId]);
    
    // If still provisioning, check again later
    if (status === 'provisioning') {
      console.log(`Server ${serverId} still provisioning, will check again in 30 seconds`);
      setTimeout(() => {
        checkServerStatus(serverId, dropletId);
      }, 30000); // Check every 30 seconds
    }
  } catch (error) {
    console.error(`Error checking server status for ${serverId}:`, error);
    
    // Update status to error
    await db.query(`
      UPDATE servers
      SET status = 'error'
      WHERE id = $1
    `, [serverId]);
  }
}


// Helper function to monitor resize completion and power on the droplet if needed
async function monitorResizeCompletion(dropletId: string, actionId: number) {
  try {
    console.log(`Monitoring resize action ${actionId} for droplet ${dropletId}`);
    
    // Function to check the action status
    const checkActionStatus = async (): Promise<boolean> => {
      try {
        const response = await DigitalOceanService.getDropletAction(dropletId, actionId);
        console.log(`Action ${actionId} status: ${response.action.status}`);
        
        if (response.action.status === 'completed') {
          return true;
        } else if (response.action.status === 'errored') {
          throw new Error(`Resize action failed: ${JSON.stringify(response.action)}`);
        }
        
        return false;
      } catch (error) {
        console.error(`Error checking action status:`, error);
        throw error;
      }
    };
    
    // Poll the action status every 30 seconds until it's complete
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 20; // 10 minutes maximum (20 * 30 seconds)
    
    while (!isComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      attempts++;
      
      isComplete = await checkActionStatus();
    }
    
    if (!isComplete) {
      console.warn(`Resize monitoring timed out after ${attempts} attempts for droplet ${dropletId}`);
      return;
    }
    
    // Verify droplet status and power on if needed
    const droplet = await DigitalOceanService.getServer(dropletId);
    
    if (droplet.status !== 'active') {
      console.log(`Droplet ${dropletId} is not active after resize (status: ${droplet.status}). Powering on...`);
      
      // Power on the droplet
      const powerOnResponse = await DigitalOceanService.powerOnServer(dropletId);
      console.log(`Power-on response:`, JSON.stringify(powerOnResponse, null, 2));
    } else {
      console.log(`Droplet ${dropletId} is already active after resize.`);
    }
    
  } catch (error) {
    console.error(`Error in monitorResizeCompletion:`, error);
    throw error;
  }
}

// Manual refresh server status from Digital Ocean
router.post('/:id/refresh-status', async (req, res) => {
  try {
    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const serverId = req.params.id;
    
    // Check if server exists and belongs to the user
    const serverCheck = await db.query(`
      SELECT s.id, s.name, s.digital_ocean_id, s.status
      FROM servers s
      WHERE s.id = $1 AND s.owner = $2
    `, [serverId, userId]);
    
    if (serverCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Server not found or does not belong to you'
      });
    }
    
    const server = serverCheck.rows[0];
    
    if (!server.digital_ocean_id) {
      return res.status(400).json({
        success: false,
        message: 'Server has no Digital Ocean ID - cannot refresh status'
      });
    }
    
    // Get current status from Digital Ocean
    const droplet = await DigitalOceanService.getServer(server.digital_ocean_id);
    
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
      status = 'offline';
    }
    
    console.log(`Refreshing server ${serverId} status: ${server.status} -> ${status}`);
    
    // Update server in database
    await db.query(`
      UPDATE servers
      SET status = $1, ip_address = $2
      WHERE id = $3
    `, [status, ipAddress, serverId]);
    
    res.json({
      success: true,
      message: 'Server status refreshed successfully',
      server_id: serverId,
      old_status: server.status,
      new_status: status,
      ip_address: ipAddress,
      droplet_status: droplet.status
    });
    
  } catch (error: any) {
    console.error(`Error refreshing server status:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to refresh server status: ${error.message}`
    });
  }
});

export default router; 