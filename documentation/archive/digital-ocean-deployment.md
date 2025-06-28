# Digital Ocean Server Deployment

This document outlines the complete server deployment process using Digital Ocean within the Citrus Host platform.

## Overview

The Citrus Host platform uses Digital Ocean as its primary cloud provider for deploying and managing servers. The deployment process involves several key steps:

1. Admin initiates server creation through the Admin Panel
2. Backend creates a server record in the database
3. Digital Ocean API is called to provision a new droplet
4. Cloud-init script installs and configures the Citrus Agent
5. Agent connects back to the Engine Hub upon startup

## Architecture Components

```
┌─────────────────┐         ┌────────────────┐         ┌──────────────┐
│                 │         │                │         │              │
│  Admin Panel    │────────▶│  Commander     │────────▶│  Digital     │
│  (Web UI)       │         │  (Backend)     │         │  Ocean API   │
│                 │◀────────│                │◀────────│              │
└─────────────────┘         └────────────────┘         └──────────────┘
                                    │                          │
                                    │                          │
                                    │                          ▼
                                    │                   ┌──────────────┐
                                    │                   │              │
                                    │                   │  New Server  │
                                    │                   │              │
                                    │                   └──────────────┘
                                    │                          │
                                    │                          │
                                    ▼                          ▼
                              ┌────────────────┐        ┌──────────────┐
                              │                │        │              │
                              │  Engine Hub    │◀───────│  Agent       │
                              │                │        │              │
                              └────────────────┘        └──────────────┘
```

## Digital Ocean Configuration

### Server Parameters

Our deployment uses the following standard configuration:

| Parameter | Value | Description |
|-----------|-------|-------------|
| Region    | sfo3  | San Francisco 3 data center |
| Size      | s-1vcpu-512mb-10gb | $4/month droplet (1 vCPU, 512MB RAM, 10GB Disk) |
| Image     | ubuntu-22-04-x64 | Ubuntu 22.04 LTS |
| Backups   | false | Backups disabled by default |
| IPv6      | true  | IPv6 enabled |
| Monitoring | true | Basic monitoring enabled |
| Tags      | citrus-host | Identifying tag for all deployed servers |

## Implementation Details

### 1. Server Deployment API Endpoint

```typescript
// Deploy a new server on Digital Ocean
router.post('/deploy', async (req, res) => {
  try {
    // Get Digital Ocean API key from environment variables
    const apiKey = process.env.DIGITALOCEAN_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Digital Ocean API key not configured'
      });
    }

    // Server configuration for the smallest droplet as specified
    const dropletConfig = {
      name: `citrus-server-${Date.now()}`,
      region: "sfo3",
      size: "s-1vcpu-512mb-10gb",
      image: "ubuntu-22-04-x64",
      backups: false,
      ipv6: true,
      monitoring: true,
      tags: ["citrus-host"]
    };

    // Make the API request to Digital Ocean
    const response = await fetch('https://api.digitalocean.com/v2/droplets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(dropletConfig)
    });
    
    // Return the response data
    res.status(202).json({
      success: true,
      message: 'Server deployment initiated',
      droplet: responseData.droplet
    });
  }
});
```

### 2. Digital Ocean Service

```typescript
class DigitalOceanService {
  private apiKey: string;
  private baseUrl: string = 'https://api.digitalocean.com/v2';

  constructor() {
    this.apiKey = process.env.DO_API_TOKEN || '';
    if (!this.apiKey) {
      console.warn('WARNING: Digital Ocean API token not set. Server deployments will fail.');
    }
  }

  async createServer(name: string): Promise<any> {
    try {
      // Simple implementation with fixed parameters
      const response = await axios.post(
        `${this.baseUrl}/droplets`,
        {
          name: name,
          region: 'sfo3',
          size: 's-1vcpu-512mb-10gb', // $4/mo droplet
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
      console.error('Error fetching Digital Ocean server:', error.response?.data || error.message);
      throw new Error(`Failed to fetch server: ${error.response?.data?.message || error.message}`);
    }
  }
}
```

### 3. Background Deployment Process

```typescript
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
```

### 4. Cloud-Init Script (NOT YET)

This script runs automatically when the new server boots up:

```bash
#!/bin/bash
# This script runs on the newly created server

# Install dependencies
apt-get update
apt-get install -y git nodejs npm

# Clone agent repository
git clone https://github.com/citrushost/agent.git /opt/citrus-agent
cd /opt/citrus-agent

# Configure agent
cat > .env << EOL
AGENT_ID={AGENT_ID}
AGENT_KEY={AGENT_KEY}
ENGINE_WS_URL={ENGINE_WS_URL}
EOL

# Install dependencies
npm install

# Set up as service
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

[Install]
WantedBy=multi-user.target
EOL

# Enable and start service
systemctl enable citrus-agent
systemctl start citrus-agent
```

## Database Schema

Our servers table tracks Digital Ocean servers with the following schema:

```sql
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    digital_ocean_id VARCHAR(255),
    region VARCHAR(50) NOT NULL,
    size VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    status VARCHAR(50) NOT NULL DEFAULT 'creating',
    agent_id UUID REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_digital_ocean_id ON servers(digital_ocean_id);
CREATE INDEX IF NOT EXISTS idx_servers_agent_id ON servers(agent_id);
```

## Deployment Flow States

1. **Creating**: Initial database record created
2. **Provisioning**: Digital Ocean API call made, waiting for droplet to be ready
3. **Initializing**: Droplet is ready, waiting for agent to connect
4. **Active**: Agent has connected and server is operational
5. **Failed**: Error occurred during deployment

## Future Enhancements

1. Implement server health monitoring
2. Add automatic scaling based on load
3. Support deployment to multiple cloud providers
4. Create backup/restore functionality 