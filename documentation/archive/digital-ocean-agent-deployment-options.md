# Digital Ocean Agent Deployment Options

This document outlines strategies for deploying the Citrus Agent to Digital Ocean droplets, including accessing private repositories during provisioning.

## Pulling from Private Repositories

When provisioning new Digital Ocean droplets, accessing private Git repositories requires proper authentication. Here are the approaches available:

### Option 1: SSH Key Method

```bash
#!/bin/bash
# Install dependencies
apt-get update && apt-get install -y git

# Set up SSH key for private repository access
mkdir -p /root/.ssh
cat > /root/.ssh/id_rsa << 'EOL'
-----BEGIN OPENSSH PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END OPENSSH PRIVATE KEY-----
EOL

# Set proper permissions
chmod 600 /root/.ssh/id_rsa

# Add GitHub to known hosts to avoid prompts
ssh-keyscan -t rsa github.com >> /root/.ssh/known_hosts

# Now clone the private repository
git clone git@github.com:yourusername/private-repo.git /opt/citrus-agent
```

### Option 2: Deploy Key Method

```bash
#!/bin/bash
# Install dependencies
apt-get update && apt-get install -y git

# Set up deploy key (read-only access to a single repository)
mkdir -p /root/.ssh
cat > /root/.ssh/id_rsa << 'EOL'
-----BEGIN OPENSSH PRIVATE KEY-----
YOUR_DEPLOY_KEY_HERE
-----END OPENSSH PRIVATE KEY-----
EOL

chmod 600 /root/.ssh/id_rsa
ssh-keyscan -t rsa github.com >> /root/.ssh/known_hosts

# Clone the repository
git clone git@github.com:yourusername/private-repo.git /opt/citrus-agent
```

### Option 3: Personal Access Token Method

```bash
#!/bin/bash
# Install dependencies
apt-get update && apt-get install -y git

# Clone with HTTPS and token authentication
git clone https://YOUR_USERNAME:YOUR_PERSONAL_ACCESS_TOKEN@github.com/yourusername/private-repo.git /opt/citrus-agent
```

### Recommended Approach: Deploy Key

The deploy key method is recommended as it:
- Provides access to only the specific repository needed
- Doesn't grant access to other repositories in your account
- Can be easily revoked without affecting other systems

## Agent Deployment Options

There are two main approaches to deploying the Citrus Agent to Digital Ocean droplets:

### Approach 1: Deploy During Droplet Creation (cloud-init)

```typescript
// Example implementation
async function createServerWithAgent(name: string, agentId: string, agentKey: string) {
  const userData = `#!/bin/bash
# Install dependencies
apt-get update
apt-get install -y git nodejs npm

# Set up deploy key for private repository
mkdir -p /root/.ssh
cat > /root/.ssh/id_rsa << 'EOL'
${process.env.DEPLOY_KEY}
EOL

chmod 600 /root/.ssh/id_rsa
ssh-keyscan -t rsa github.com >> /root/.ssh/known_hosts

# Clone agent repository
git clone git@github.com:citrushost/agent.git /opt/citrus-agent
cd /opt/citrus-agent

# Configure agent
cat > .env << EOL
AGENT_ID=${agentId}
AGENT_KEY=${agentKey}
ENGINE_WS_URL=${process.env.ENGINE_WS_URL}
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
systemctl start citrus-agent`;
  
  const response = await axios.post(
    `${this.baseUrl}/droplets`,
    {
      name: name,
      region: 'sfo3',
      size: 's-1vcpu-512mb-10gb',
      image: 'ubuntu-22-04-x64',
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

  return response.data;
}
```

#### Pros:
- **One-step process**: Server creation and agent installation happen in a single API call
- **Immediate startup**: Agent starts as soon as the server boots, no delay
- **Less state management**: No need to track partially provisioned servers
- **More reliable**: No dependency on your backend being available after server creation
- **Simpler architecture**: Fewer moving parts and API calls

#### Cons:
- **Black box initialization**: Less visibility into the installation process
- **Debugging challenges**: Harder to debug if initialization fails
- **Limited error recovery**: If the script fails, manual intervention is required
- **Script size limitations**: Digital Ocean has a size limit for user-data scripts

### Approach 2: Sequential Deployment (Post-Creation)

```typescript
// Example implementation - Step 1: Create droplet
async function createServer(name: string) {
  const response = await axios.post(
    `${this.baseUrl}/droplets`,
    {
      name: name,
      region: 'sfo3',
      size: 's-1vcpu-512mb-10gb',
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
}

// Example implementation - Step 2: Deploy agent
async function deployAgent(ipAddress: string, agentId: string, agentKey: string) {
  // Wait for server to be fully booted and accessible
  await waitForServerReady(ipAddress);
  
  // SSH into the server and install the agent
  const ssh = new NodeSSH();
  await ssh.connect({
    host: ipAddress,
    username: 'root',
    privateKey: process.env.SSH_PRIVATE_KEY
  });
  
  // Clone repository using deploy key
  await ssh.execCommand('apt-get update && apt-get install -y git nodejs npm');
  await ssh.execCommand(`
    mkdir -p /root/.ssh
    cat > /root/.ssh/id_rsa << 'EOL'
    ${process.env.DEPLOY_KEY}
    EOL
    chmod 600 /root/.ssh/id_rsa
    ssh-keyscan -t rsa github.com >> /root/.ssh/known_hosts
  `);
  
  // Clone and configure agent
  await ssh.execCommand('git clone git@github.com:citrushost/agent.git /opt/citrus-agent');
  await ssh.execCommand(`
    cd /opt/citrus-agent
    cat > .env << EOL
    AGENT_ID=${agentId}
    AGENT_KEY=${agentKey}
    ENGINE_WS_URL=${process.env.ENGINE_WS_URL}
    EOL
    npm install
  `);
  
  // Set up as service
  await ssh.execCommand(`
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
    systemctl enable citrus-agent
    systemctl start citrus-agent
  `);
  
  ssh.dispose();
}
```

#### Pros:
- **Better error handling**: Can retry specific parts of the deployment process
- **Detailed logging**: Can capture and log each step of the installation
- **Flexible timing**: Can wait for appropriate server state before deployment
- **Step-by-step control**: More fine-grained control over the deployment process
- **Easier debugging**: Can inspect server state at each step

#### Cons:
- **Complex state management**: Need to track partially provisioned servers
- **More failure points**: Multiple API calls mean more potential points of failure
- **Backend dependency**: Requires your backend to be running during the entire process
- **Longer deployment time**: Sequential process takes more time overall
- **SSH complexity**: Requires setting up and managing SSH access

## Recommendation

For most use cases, **Approach 1: Deploy During Droplet Creation** is recommended because:

1. It simplifies the architecture and reduces the number of moving parts
2. It eliminates the need for SSH key management for post-deployment configuration
3. It creates a more reliable process that doesn't depend on your backend after server creation
4. It results in faster overall deployment time

However, if you need detailed control over the installation process or want to implement a more sophisticated error recovery system, Approach 2 may be more appropriate.

## Implementation Steps

To implement private repository access during droplet creation:

1. Generate a deploy key specifically for your agent repository
2. Add the public key as a deploy key in your GitHub repository settings
3. Store the private key securely in your backend's environment variables
4. Include the private key in your cloud-init script as shown above
5. Pass the complete script as the `user_data` parameter when creating droplets 