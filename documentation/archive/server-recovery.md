# Server Recovery Process

## Overview

This document outlines what happens when the Citrus hosting server experiences a crash or restart, and how our agent system handles the recovery process automatically.

## Boot Sequence

When the server restarts (either planned or after a crash), the following sequence occurs:

1. **System Initialization**: The operating system loads and initializes core services
2. **Agent Activation**: The Citrus Agent starts automatically via systemd
   ```365:368:agent/src/agent.js
   // Start the agent if this file is run directly
   if (require.main === module) {
       const agent = new CitrusAgent();
       agent.start();
   }
   ```

3. **WebSocket Connection**: Agent establishes connection to the Engine at the configured URL
   ```22:24:agent/src/agent.js
   async start() {
     console.log('Starting Citrus Agent...');
     await this.getGitVersion();
     this.connect();
   }
   ```
   
   ```26:34:agent/src/agent.js
   connect() {
     console.log(`Connecting to Engine at ${this.engineUrl}`);
     
     this.ws = new WebSocket(this.engineUrl, {
       headers: {
         'x-client-type': 'agent',
         'x-agent-id': this.agentId,
         'x-agent-key': this.agentKey
       }
     });
   ```

4. **Initial Status Report**: Agent sends an `agent_connected` message with its ID
   ```36:42:agent/src/agent.js
   this.ws.on('open', () => {
     console.log('Connected to Engine');
     
     // Send immediate agent_connected message
     this.send({
       type: 'agent_connected',
       agentId: this.agentId
     });
   ```

5. **Regular Monitoring**: Agent begins sending status updates every 60 seconds
   ```43:44:agent/src/agent.js
   // Start sending status updates with 1-minute interval
   this.startStatusUpdates();
   ```
   
   ```60:68:agent/src/agent.js
   // Start new interval with 1-minute updates
   this.statusInterval = setInterval(async () => {
     const status = await this.collectStatus();
     this.send({
       type: 'status_update',
       status
     });
   }, 60000); // Every 1 minute
   ```

## Agent Status Monitoring

The agent continuously collects and reports the following metrics:

```78:104:agent/src/agent.js
async collectStatus() {
  await this.getGitVersion();
  
  const [cpu, mem, disk] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize()
  ]);

  return {
    hostname: os.hostname(),
    uptime: os.uptime(),
    gitVersion: this.gitVersion,
    cpu: {
      load: cpu.currentLoad,
      cores: os.cpus().length
    },
    memory: {
      total: mem.total,
      used: mem.used,
      free: mem.free
    },
    disk: disk.map(d => ({
      fs: d.fs,
      size: d.size,
      used: d.used,
      available: d.available
    })),
    timestamp: Date.now()
  };
}
```

## Reconnection Handling

If the connection to the Engine is lost:

```51:55:agent/src/agent.js
this.ws.on('close', () => {
  console.log('Disconnected from Engine, reconnecting...');
  clearInterval(this.statusInterval);
  setTimeout(() => this.connect(), this.reconnectTimeout);
});
```

The reconnection timeout is set to 5 seconds during initialization:

```14:14:agent/src/agent.js
this.reconnectTimeout = 5000;
```

## Agent Update Protocol

The agent can be updated remotely through two mechanisms:

### Standard Update
When an `update_agent` message is received:

```171:221:agent/src/agent.js
async handleUpdateAgent(message) {
  try {
    this.send({
      type: 'update_operation',
      status: 'starting'
    });
    
    console.log('Updating agent from git with force reset...');
    
    // Fetch all changes first
    await execAsync('git fetch --all');
    
    // Force reset to origin/main (or whatever your branch is)
    const { stdout, stderr } = await execAsync('git reset --hard origin/main');
    
    // Check for errors in stderr
    const errorIndicators = [
      'fatal:', 'error:', 'cannot', 'denied', 'Could not', 'not found', 
      'failed', 'unable to', 'unresolved', 'Permission denied'
    ];
    
    const hasRealError = errorIndicators.some(indicator => 
      stderr.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (hasRealError) {
      throw new Error(`Git update error: ${stderr}`);
    }
    
    // Get the new git version
    await this.getGitVersion();
    
    // Successful update
    this.send({
      type: 'update_operation',
      status: 'completed',
      gitVersion: this.gitVersion,
      output: stdout + (stderr ? `\n${stderr}` : '')
    });
    
    console.log('Agent updated successfully, restarting service...');
    
    // Restart the service using systemctl
    try {
      await execAsync('systemctl restart citrus-agent');
      console.log('Restart command sent. Service will restart shortly.');
    } catch (restartError) {
      console.error('Error restarting service:', restartError);
      // We don't throw here because the update itself was successful
    }
```

### Rollback Procedure
When a `rollback_agent` message is received:

```223:278:agent/src/agent.js
async handleRollbackAgent(message) {
  try {
    const { commitId } = message;
    
    if (!commitId) {
      throw new Error('No commit ID provided for rollback');
    }
    
    this.send({
      type: 'rollback_operation',
      status: 'starting',
      commitId
    });
    
    console.log(`Rolling back agent to commit: ${commitId}`);
    
    // Fetch all remote changes first to ensure we have the commit
    await execAsync('git fetch --all');
    
    // Reset to the specific commit with force
    const { stdout, stderr } = await execAsync(`git reset --hard ${commitId}`);
    
    // Check for errors in stderr
    const errorIndicators = [
      'fatal:', 'error:', 'cannot', 'denied', 'Could not', 'not found', 
      'failed', 'unable to', 'unresolved', 'Permission denied', 'unknown revision'
    ];
    
    const hasRealError = errorIndicators.some(indicator => 
      stderr.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (hasRealError) {
      throw new Error(`Git rollback error: ${stderr}`);
    }
    
    // Get the new git version to confirm rollback
    await this.getGitVersion();
    
    // Successful rollback
    this.send({
      type: 'rollback_operation',
      status: 'completed',
      gitVersion: this.gitVersion,
      output: stdout + (stderr ? `\n${stderr}` : '')
    });
    
    console.log(`Agent successfully rolled back to ${commitId}, restarting service...`);
    
    // Restart the service using systemctl
    try {
      await execAsync('systemctl restart citrus-agent');
      console.log('Restart command sent. Service will restart shortly.');
    } catch (restartError) {
      console.error('Error restarting service:', restartError);
      // We don't throw here because the rollback itself was successful
    }
```

## Site Operations

The agent can handle the following operations even after a restart:

1. **Site Creation**: Creates WordPress sites with caching enabled
   ```106:132:agent/src/agent.js
   async handleCreateSite(message) {
     const { domain, options } = message;
     
     try {
       this.send({
         type: 'site_operation',
         operation: 'create',
         status: 'starting',
         domain
       });

       const command = `ee site create ${domain} --type=wp --cache`;
       const { stdout, stderr } = await execAsync(command);

       this.send({
         type: 'site_operation',
         operation: 'create',
         status: 'completed',
         domain,
         output: stdout
       });
     } catch (error) {
       this.send({
         type: 'site_operation',
         operation: 'create',
         status: 'failed',
         domain,
         error: error.message
       });
     }
   }
   ```

2. **Site Deletion**: Removes sites when instructed
   ```134:158:agent/src/agent.js
   async handleDeleteSite(message) {
     const { domain } = message;
     
     try {
       this.send({
         type: 'site_operation',
         operation: 'delete',
         status: 'starting',
         domain
       });

       const command = `ee site delete ${domain} --yes`;
       const { stdout } = await execAsync(command);

       this.send({
         type: 'site_operation',
         operation: 'delete',
         status: 'completed',
         domain,
         output: stdout
       });
     } catch (error) {
       this.send({
         type: 'site_operation',
         operation: 'delete',
         status: 'failed',
         domain,
         error: error.message
       });
     }
   }
   ```

3. **Key Rotation**: Updates authentication credentials securely
   ```160:179:agent/src/agent.js
   async handleKeyRotation(message) {
     const { newKey } = message;
     
     try {
       // Update the key file
       await this.updateKeyFile(newKey);
       this.agentKey = newKey;
       
       this.send({
         type: 'key_rotation',
         status: 'completed'
       });
     } catch (error) {
       this.send({
         type: 'key_rotation',
         status: 'failed',
         error: error.message
       });
     }
   }
   ```

## Error Handling

The agent implements several error handling mechanisms:

```45:50:agent/src/agent.js
this.ws.on('message', async (data) => {
  try {
    const message = JSON.parse(data);
    await this.handleMessage(message);
  } catch (error) {
    console.error('Error handling message:', error);
  }
});
```

```56:58:agent/src/agent.js
this.ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

## Manual Intervention

While the agent handles most recovery scenarios automatically, certain situations may require manual intervention:

1. Hardware failures beyond software control
2. Network issues preventing Engine connection
3. Git repository corruption or access problems

In these cases, server administrators should check the agent logs and may need to manually restart the service. 