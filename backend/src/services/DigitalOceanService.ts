import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';
import db from '../db';

// Load environment variables
dotenv.config();

class DigitalOceanService {
  private apiKey: string;
  private baseUrl: string = 'https://api.digitalocean.com/v2';

  constructor() {
    this.apiKey = process.env.DO_API_TOKEN || '';
    if (!this.apiKey) {
      console.warn('WARNING: Digital Ocean API token not set. Server deployments will fail.');
    }
  }

  /**
   * Create a new Digital Ocean droplet (server)
   * This implementation is kept simple with fixed parameters
   */
  async createServer(name: string, size: string = 's-1vcpu-1gb', region: string = 'sfo3'): Promise<any> {
    try {
      // Simple implementation with fixed parameters
      const response = await axios.post(
        `${this.baseUrl}/droplets`,
        {
          name: name,
          region: region,
          size: size, // Now uses the provided size parameter
          image: 'ubuntu-22-04-x64',
          backups: false,
          ipv6: true,
          monitoring: true,
          tags: ['citrus-host']
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error creating Digital Ocean server:', error.response?.data || error.message);
      throw new Error(`Failed to create server: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create a Digital Ocean droplet with Citrus Agent pre-installed
   * Uses cloud-init to install and configure the agent during server provisioning
   */
  async createServerWithAgent(name: string, size: string = 's-1vcpu-1gb', region: string = 'sfo3'): Promise<any> {
    try {
      // Generate unique agent ID and key
      const agentId = crypto.randomUUID();
      const agentKey = crypto.randomBytes(32).toString('hex');
      
      // Save agent credentials to the database with a name
      const agentName = `agent-${name || new Date().getTime()}`;
      const agentResult = await db.query(`
        INSERT INTO agents (id, key, status, name)
        VALUES ($1, $2, 'offline', $3)
        RETURNING id
      `, [agentId, agentKey, agentName]);
      
      if (!agentResult.rows.length) {
        throw new Error('Failed to create agent record in database');
      }
      
      // Create cloud-init script to set up the agent only
      const userData = `#!/bin/bash
# Log all output for debugging
exec > >(tee /var/log/citrus-init.log) 2>&1
echo "Starting Citrus Agent installation at $(date)"

# Set DEBIAN_FRONTEND to prevent interactive prompts
export DEBIAN_FRONTEND=noninteractive

# Update system and install dependencies
echo "Updating system and installing dependencies..."
apt-get update 
apt-get install -y git nodejs npm curl

# Setup automatic security updates
echo "Setting up automatic security updates..."
apt-get install -y unattended-upgrades
echo 'unattended-upgrades unattended-upgrades/enable_auto_updates boolean true' | debconf-set-selections
dpkg-reconfigure -f noninteractive unattended-upgrades
systemctl enable unattended-upgrades.service
systemctl start unattended-upgrades.service
echo "Automatic security updates configured successfully"

echo "Cloning Citrus Agent repository using HTTPS..."
# Use HTTPS with token - much more reliable than SSH for automated scripts
git clone https://${process.env.GITHUB_TOKEN || 'ghp_YOUR_GITHUB_TOKEN_HERE'}@github.com/limedrop-byte/citrus-agent.git /opt/citrus-agent || {
  echo "Failed to clone repository. Please check your GitHub token."
  exit 1
}

cd /opt/citrus-agent || {
  echo "Failed to enter agent directory, installation failed."
  exit 1
}

# Configure agent with unique credentials
echo "Configuring agent..."
cat > .env << EOL
AGENT_ID=${agentId}
AGENT_KEY=${agentKey}
ENGINE_WS_URL=${process.env.ENGINE_WS_URL || 'wss://engine.citrushost.io'}
EOL

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Create log directory and setup log rotation
echo "Setting up logging with daily rotation..."
mkdir -p /var/log/citrus-agent
touch /var/log/citrus-agent/agent.log
chmod 644 /var/log/citrus-agent/agent.log
chown root:root /var/log/citrus-agent/agent.log

# Create logrotate configuration for daily rotation with 30-day retention
cat > /etc/logrotate.d/citrus-agent << EOL
/var/log/citrus-agent/agent.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        systemctl reload citrus-agent 2>/dev/null || true
    endscript
}
EOL

echo "Log rotation configured: daily rotation, 30-day retention"

# Set up systemd service
echo "Setting up systemd service..."
cat > /etc/systemd/system/citrus-agent.service << EOL
[Unit]
Description=Citrus Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/citrus-agent
ExecStart=/usr/bin/node src/agent.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=append:/var/log/citrus-agent/agent.log
StandardError=append:/var/log/citrus-agent/agent.log

[Install]
WantedBy=multi-user.target
EOL

# Enable and start service
echo "Enabling and starting Citrus Agent service..."
systemctl enable citrus-agent
systemctl start citrus-agent

echo "Citrus Agent installation completed at $(date)"
`;
      
      // Create the droplet with WordPress LiteSpeed Cache marketplace image
      const response = await axios.post(
        `${this.baseUrl}/droplets`,
        {
          name: name,
          region: region,
          size: size,
          image: 'litespeedtechnol-openlitespeedwor-20-04', // OpenLiteSpeed WordPress marketplace image
          backups: false,
          ipv6: true,
          monitoring: true,
          tags: ['citrus-host'],
          user_data: userData
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return {
        ...response.data,
        agent: {
          id: agentId,
          key: agentKey
        }
      };
    } catch (error: any) {
      console.error('Error creating server with agent:', error.response?.data || error.message);
      throw new Error(`Failed to create server with agent: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get droplet information
   */
  async getServer(dropletId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/droplets/${dropletId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.droplet;
    } catch (error: any) {
      // Check for specific 404 error
      if (error.response && error.response.status === 404) {
        throw new Error(`Droplet ${dropletId} not found on Digital Ocean`);
      }
      
      console.error('Error fetching Digital Ocean server:', error.response?.data || error.message);
      throw new Error(`Failed to fetch server: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Resize a Digital Ocean droplet
   * @param dropletId The ID of the droplet to resize
   * @param size The new size of the droplet
   * @param disk Whether to resize the disk
   */
  async resizeServer(dropletId: string, size: string, disk: boolean = true): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/droplets/${dropletId}/actions`,
        {
          type: "resize",
          disk: disk,
          size: size
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error resizing Digital Ocean server:', error.response?.data || error.message);
      throw new Error(`Failed to resize server: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get the status of a Digital Ocean action for a specific droplet
   * @param dropletId The ID of the droplet
   * @param actionId The ID of the action to check
   */
  async getDropletAction(dropletId: string, actionId: number): Promise<any> {
    try {
      console.log(`Fetching Digital Ocean action status for droplet ${dropletId}, action ${actionId}`);
      
      const response = await axios.get(
        `${this.baseUrl}/droplets/${dropletId}/actions/${actionId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error fetching Digital Ocean droplet action status:', error.response?.data || error.message);
      throw new Error(`Failed to fetch droplet action status: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Power on a Digital Ocean droplet
   * @param dropletId The ID of the droplet to power on
   */
  async powerOnServer(dropletId: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/droplets/${dropletId}/actions`,
        {
          type: "power_on"
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error powering on Digital Ocean server:', error.response?.data || error.message);
      throw new Error(`Failed to power on server: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Enable daily backups for a Digital Ocean droplet
   * @param dropletId The ID of the droplet to enable backups for
   * @param hour The hour of the day to run backups (0-23, UTC)
   */
  async enableBackups(dropletId: string, hour: number = 20): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/droplets/${dropletId}/actions`,
        {
          type: "enable_backups",
          backup_policy: {
            plan: "daily",
            hour: hour
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error enabling backups for Digital Ocean server:', error.response?.data || error.message);
      throw new Error(`Failed to enable backups: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Disable backups for a Digital Ocean droplet
   * @param dropletId The ID of the droplet to disable backups for
   */
  async disableBackups(dropletId: string): Promise<any> {
    try {
      // Log the exact request for debugging
      console.log(`Sending disable_backups request for droplet ${dropletId}`);
      
      const response = await axios.post(
        `${this.baseUrl}/droplets/${dropletId}/actions`,
        { type: "disable_backups" },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      // Log the response for debugging
      console.log(`Disable backups response:`, JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error: any) {
      console.error('Error disabling backups for Digital Ocean server:', 
        error.response ? {
          status: error.response.status,
          data: error.response.data
        } : error.message);
      throw new Error(`Failed to disable backups: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get available backups for a Digital Ocean droplet
   * @param dropletId The ID of the droplet to get backups for
   */
  async getBackups(dropletId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/droplets/${dropletId}/backups`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.backups || [];
    } catch (error: any) {
      console.error('Error fetching backups for Digital Ocean server:', error.response?.data || error.message);
      throw new Error(`Failed to fetch backups: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Restore a Digital Ocean droplet from a backup
   * @param dropletId The ID of the droplet to restore
   * @param backupId The ID of the backup to restore from
   */
  async restoreBackup(dropletId: string, backupId: string): Promise<any> {
    try {
      // First, validate that the backup belongs to this droplet
      const backups = await this.getBackups(dropletId);
      const backupIdNumber = parseInt(backupId, 10);
      
      if (isNaN(backupIdNumber)) {
        throw new Error(`Invalid backup ID format: ${backupId}`);
      }
      
      const validBackup = backups.find((backup: any) => backup.id === backupIdNumber);
      if (!validBackup) {
        throw new Error(`Backup ${backupIdNumber} not found for droplet ${dropletId}`);
      }
      
      console.log(`Restoring Digital Ocean droplet ${dropletId} from backup ${backupIdNumber}`);
      console.log(`Request payload:`, { type: "restore", image: backupIdNumber });
      
      const response = await axios.post(
        `${this.baseUrl}/droplets/${dropletId}/actions`,
        {
          type: "restore",
          image: backupIdNumber
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      console.log(`Successfully initiated restore for droplet ${dropletId}:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error restoring Digital Ocean server:', error.response?.data || error.message);
      console.error('Full error details:', error);
      throw new Error(`Failed to restore backup: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Delete a Digital Ocean droplet
   * @param dropletId The ID of the droplet to delete
   */
  async deleteServer(dropletId: string): Promise<any> {
    try {
      console.log(`Deleting Digital Ocean droplet ${dropletId}`);
      
      const response = await axios.delete(
        `${this.baseUrl}/droplets/${dropletId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      console.log(`Successfully deleted Digital Ocean droplet ${dropletId}`);
      return response.data;
    } catch (error: any) {
      // Check for specific 404 error - droplet might already be deleted
      if (error.response && error.response.status === 404) {
        console.log(`Droplet ${dropletId} was already deleted or not found`);
        return { message: 'Droplet not found or already deleted' };
      }
      
      console.error('Error deleting Digital Ocean server:', error.response?.data || error.message);
      throw new Error(`Failed to delete server: ${error.response?.data?.message || error.message}`);
    }
  }
}

export default new DigitalOceanService(); 