# Automatic Agent Deployment with Digital Ocean

This document explains how the Citrus platform automatically deploys agents when provisioning new Digital Ocean servers.

## Overview

When a new server is created through the `/admin/servers/deploy-with-agent` endpoint, the system performs a one-step deployment that:

1. Generates unique agent credentials
2. Records them in the database
3. Creates a Digital Ocean droplet
4. Installs and configures the Citrus Agent during the initial server boot

## Implementation Details

### 1. Agent Credential Generation

```typescript
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
```

- Each agent receives a unique UUID and a 64-character hexadecimal key
- These credentials are stored in the database with an 'offline' status
- The credentials will be used by the agent to authenticate with the Engine Hub

### 2. Cloud-Init Script

The Digital Ocean droplet is created with a `user_data` parameter containing a bash script that runs on first boot:

```bash
#!/bin/bash
# Log all output for debugging
exec > >(tee /var/log/citrus-init.log) 2>&1

# Install dependencies
apt-get update && apt-get install -y git nodejs npm

# Clone the repository using HTTPS with token authentication
git clone https://GITHUB_TOKEN@github.com/limedrop-byte/citrus-agent.git /opt/citrus-agent

# Configure agent with unique credentials
cat > .env << EOL
AGENT_ID=${agentId}
AGENT_KEY=${agentKey}
ENGINE_WS_URL=${process.env.ENGINE_WS_URL}
EOL

# Install dependencies, set up as service, etc.
```

### 3. Server Record Creation

After the droplet creation API call, a server record is created in the database:

```typescript
// Create a server record linked to the agent
await db.query(`
  INSERT INTO servers (name, digital_ocean_id, region, size, status, agent_id)
  VALUES ($1, $2, $3, $4, $5, $6)
`, [
  name, 
  response.data.droplet.id.toString(), 
  'sfo3', 
  's-1vcpu-512mb-10gb', 
  'provisioning',
  agentId
]);
```

- The server is linked to the agent through the `agent_id` field
- The status is set to 'provisioning' initially

### 4. Agent Connection Flow

Once the server boots and the agent starts:

1. The agent reads its credentials from the `.env` file
2. It connects to the Engine Hub using the WebSocket URL
3. It authenticates using the agent ID and key
4. Upon successful connection, its status is updated to 'online' in the database

## GitHub Token Setup

To access the private repository, we use a GitHub Personal Access Token:

1. **Create a GitHub Personal Access Token**:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Create a token with `repo` scope (read-only access is sufficient)
   - Copy the generated token

2. **Set the environment variable**:
   ```bash
   GITHUB_TOKEN="your_github_personal_access_token"
   ```

This token is used in the cloud-init script to clone the private repository.

## Error Handling

The cloud-init process logs all output to `/var/log/citrus-init.log` on the server for debugging purposes.

If the agent fails to connect within 10 minutes, the system should mark it as failed in the database. This requires a separate background job to check agent status periodically.

## API Endpoint

To deploy a server with an agent, use the following endpoint:

```
POST /admin/servers/deploy-with-agent
```

Request body:
```json
{
  "name": "optional-custom-name"
}
```

Response:
```json
{
  "success": true,
  "message": "Server with agent deployment initiated",
  "server": {
    "id": "12345678",
    "name": "server-name",
    "status": "provisioning",
    "agent": {
      "id": "uuid-of-agent"
    }
  }
}
```

## Environment Variables

The following environment variables must be set for this feature to work:

| Variable | Description |
|----------|-------------|
| DO_API_TOKEN | Digital Ocean API token |
| GITHUB_TOKEN | GitHub personal access token for repository access |
| ENGINE_WS_URL | WebSocket URL for agent connection (e.g., wss://engine.citrushost.io) | 