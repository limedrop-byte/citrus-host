# WordOps Site Operations Reference

This document provides a technical reference for all site creation and SSL operations handled by the agent using WordOps.

## Overview

The Citrus Host platform uses an agent-based architecture with WordOps/EasyEngine as the underlying technology for WordPress site management. This document details how site creation and SSL certificate operations are implemented.

## Site Creation

Site creation is handled by the agent using the WordOps CLI.

### Implementation

**Location**: `agent/src/agent.js:handleCreateSite()`

```javascript
async handleCreateSite(message) {
  const { domain, options } = message;
  
  try {
    this.send({
      type: 'site_operation',
      operation: 'create',
      status: 'starting',
      domain
    });

    const command = `wo site create ${domain} --wp`;
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

### Flow

1. Backend sends a `create_site` message to the agent
2. Agent executes `wo site create <domain> --wp`
3. Agent sends status updates during the process
4. Operation result is sent back to the backend

## SSL Operations

### SSL Deployment

**Location**: `agent/src/agent.js:handleDeploySSL()`

```javascript
async handleDeploySSL(message) {
  const { domain } = message;
  
  try {
    this.send({
      type: 'site_operation',
      operation: 'deploy_ssl',
      status: 'starting',
      domain
    });
    
    // Uses spawn to handle interactive prompts
    const child = spawn('wo', ['site', 'update', domain, '-le'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Handles certificate prompt and responds with '1'
    child.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Please select an option from below') && 
          output.includes('1: Reinstall existing certificate')) {
        child.stdin.write('1\n');
      }
    });
    
    // Sends completion or failure status
  } catch (error) {
    // Error handling
  }
}
```

### SSL Deactivation

**Location**: `agent/src/agent.js:handleTurnOffSSL()`

```javascript
async handleTurnOffSSL(message) {
  const { domain } = message;
  
  try {
    this.send({
      type: 'site_operation',
      operation: 'turn_off_ssl',
      status: 'starting',
      domain
    });
    
    // Uses spawn for command execution
    const child = spawn('wo', ['site', 'update', domain, '--letsencrypt=off'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Sends completion or failure status
  } catch (error) {
    // Error handling
  }
}
```

### SSL Redeployment

**Location**: `agent/src/agent.js:handleRedeploySSL()`

```javascript
async handleRedeploySSL(message) {
  const { domain } = message;
  
  try {
    this.send({
      type: 'site_operation',
      operation: 'redeploy_ssl',
      status: 'ssl_redeploying',
      domain
    });
    
    // First turns off SSL
    const turnOffResult = await new Promise((resolve, reject) => {
      const turnOffChild = spawn('wo', ['site', 'update', domain, '--letsencrypt=off']);
      // Process handling
    });
    
    // Then deploys SSL with force renewal
    const child = spawn('wo', ['site', 'update', domain, '-le']);
    
    // Always chooses option 2 for force renewal when prompted
    child.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Please select an option from below')) {
        child.stdin.write('2\n');
      }
    });
    
    // Sends completion or failure status
  } catch (error) {
    // Error handling
  }
}
```

## API Endpoints

The following backend API endpoints trigger these operations:

### Site Creation

```javascript
// Located in backend/src/routes/engine.ts
router.post('/site', verifyToken, async (req, res) => {
  // Creates a site and sends command to agent
});
```

### SSL Operations

```javascript
// Located in backend/src/routes/engine.ts
router.post('/site/:id/ssl', verifyToken, async (req, res) => {
  // Handles SSL operations based on operation type:
  // - Default: Deploy SSL (wsServer.deploySSL)
  // - Redeploy: Redeploy SSL (wsServer.redeploySSL)
  // - Turn off: Disable SSL (wsServer.turnOffSSL)
});
```

## Retry Mechanism

Failed operations are handled by the `OperationRetryService`:

```javascript
// Located in backend/src/services/OperationRetryService.ts
case 'deploy_ssl':
  this.wsServer.deploySSL(op.agent_id, op.domain);
  console.log(`Retried SSL deployment for ${op.domain}`);
  break;
case 'redeploy_ssl':
  this.wsServer.redeploySSL(op.agent_id, op.domain);
  console.log(`Retried SSL redeployment for ${op.domain}`);
  break;
case 'turn_off_ssl':
  this.wsServer.turnOffSSL(op.agent_id, op.domain);
  console.log(`Retried turning off SSL for ${op.domain}`);
  break;
```

## Future Improvements

Based on references in the codebase, there are plans to replace WordOps/EasyEngine with a custom LAMP stack while maintaining the same agent-based architecture. See `documentation/custom-lamp-stack.md` for details. 