# Websocket Communication Flow: Commander, Engine, and Agents

This document explains the high-level architecture and detailed communication flow between the three main components of the system:

1. **Commander** - The backend server that users interact with
2. **Engine** - The central hub that routes messages between Commanders and Agents
3. **Agents** - The edge servers that execute commands and host websites

## Architecture Overview

The system operates with a central Engine hub that maintains persistent WebSocket connections with both the Commander backend and multiple Agent instances. This architecture enables:

- Real-time bidirectional communication
- Status updates from Agents
- Command execution across distributed infrastructure

```
┌────────────┐         ┌──────────┐         ┌──────────┐
│            │         │          │         │          │
│  Commander │◄────────►  Engine  │◄────────►  Agent 1 │
│            │         │          │         │          │
└────────────┘         └──────────┘         └──────────┘
                            ▲                    
                            │                    
                            │                ┌──────────┐
                            │                │          │
                            └────────────────►  Agent 2 │
                                             │          │
                                             └──────────┘
```

## WebSocket Connection Establishment

### Commander to Engine Connection

The Commander backend establishes a connection to the Engine hub at startup in the `EngineService` class.

```javascript
// backend/src/services/EngineService.ts (lines 58-72)
connect(): void {
  this.ws = new WebSocket(this.engineUrl, {
    headers: {
      'X-Client-Type': 'commander',
      'X-Commander-ID': this.commanderId,
      'X-Commander-Key': this.commanderKey
    }
  });

  this.ws.on('open', () => {
    this.connected = true;
    this.emit('connected');
  });
}
```

### Agent to Engine Connection

Each Agent establishes a connection to the Engine hub at startup:

```javascript
// agent/src/agent.js (lines 23-39)
connect() {
  this.ws = new WebSocket(this.engineUrl, {
    headers: {
      'x-client-type': 'agent',
      'x-agent-id': this.agentId,
      'x-agent-key': this.agentKey
    }
  });

  this.ws.on('open', () => {
    console.log('Connected to Engine');
    this.sendInitialStatus();
  });
}
```

### Engine Hub Implementation

The Engine hub authenticates and manages connections from both Commanders and Agents:

```javascript
// engine/src/server.js (lines 46-57, 70-77)
handleAgentConnection(ws, req) {
  const agentId = req.headers['x-agent-id'];
  const agentKey = req.headers['x-agent-key'];

  try {
    // Verify agent credentials with Commander
    const isValid = await this.verifyAgent(agentId, agentKey);
    if (!isValid) {
      ws.close(4001, 'Invalid credentials');
      return;
    }

    // Store agent connection
    this.agents.set(agentId, ws);
    // Additional setup...
  }
}

handleCommanderConnection(ws, req) {
  const commanderId = req.headers['x-commander-id'];
  const commanderKey = req.headers['x-commander-key'];

  // Verify commander credentials
  if (!this.verifyCommander(commanderId, commanderKey)) {
    ws.close(4001, 'Invalid commander credentials');
    return;
  }

  // Store commander connection
  this.commanders.set(commanderId, ws);
  // Additional setup...
}
```

## Message Flow Patterns

### 1. Commander to Agent Communication

When a Commander needs to send a command to an Agent, the following flow occurs:

1. **Commander invokes engine service method:**

```typescript
// backend/src/services/EngineService.ts (lines 158-164)
async createSite(agentId: string, domain: string, options: Record<string, any> = {}): Promise<void> {
  this.sendToAgent(agentId, {
    type: 'create_site',
    domain,
    options
  });
}
```

2. **Engine forwards message to target Agent:**

```javascript
// engine/src/server.js (lines 156-173)
handleCommanderMessage(commanderId, data) {
  try {
    const message = JSON.parse(data);
    const targetAgentId = message.agentId;
    
    // Find target agent
    const agentWs = this.agents.get(targetAgentId);
    if (!agentWs) {
      this.sendToCommander(commanderId, {
        type: 'error',
        error: 'Agent not found',
        originalMessage: message
      });
      return;
    }
    
    // Forward message to agent
    agentWs.send(JSON.stringify(message));
  } catch (error) {
    console.error('Error handling commander message:', error);
  }
}
```

3. **Agent receives and processes the command:**

```javascript
// agent/src/agent.js (lines 42-52)
this.ws.on('message', async (data) => {
  try {
    const message = JSON.parse(data);
    await this.handleMessage(message);
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

// agent/src/agent.js (lines 95-107)
async handleMessage(message) {
  console.log('Received message:', message.type);

  switch (message.type) {
    case 'create_site':
      await this.handleCreateSite(message);
      break;
    case 'delete_site':
      await this.handleDeleteSite(message);
      break;
    // Other message types...
  }
}
```

### 2. Agent to Commander Communication

Agents send status updates and operation results back to Commanders through the Engine:

1. **Agent sends status update or operation results:**

```javascript
// agent/src/agent.js (lines 124-145)
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

2. **Engine receives message and broadcasts to all Commanders:**

```javascript
// engine/src/server.js (lines 137-147)
handleAgentMessage(agentId, data) {
  try {
    const message = JSON.parse(data);
    
    // Add agent ID to message
    message.agentId = agentId;
    
    // Broadcast to all commanders
    this.broadcastToCommanders(message);
    
  } catch (error) {
    console.error('Error handling agent message:', error);
  }
}
```

3. **Commander receives and processes the message:**

```typescript
// backend/src/services/EngineService.ts (lines 80-105)
this.ws.on('message', (data: WebSocket.RawData) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('Received message from Engine:', message.type);
    this.handleMessage(message);
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

private async handleMessage(message: any): Promise<void> {
  switch (message.type) {
    // Other message types...
    
    case 'site_operation':
      this.emit('site_update', {
        agentId: message.agentId,
        operation: message.operation,
        status: message.status,
        domain: message.domain,
        error: message.error
      } as SiteOperation);
      break;
      
    // Other message types...
  }
}
```

4. **Backend updates the database based on the message:**

```typescript
// backend/src/index.ts (lines 43-74)
// Event handlers for agent status updates

engineService.on('site_update', async (data: SiteOperation) => {
  // Update site status in database
  // This is likely implemented elsewhere in the codebase
});
```

## Agent Status Monitoring

The agent sends periodic status updates to the engine hub:

1. **Agent sends initial status on connection:**

```javascript
// agent/src/agent.js (lines 57-68)
async sendInitialStatus() {
  const status = await this.collectStatus();
  this.send({
    type: 'initial_status',
    status
  });
}
```

2. **Agent sends regular status updates:**

```javascript
// agent/src/agent.js (lines 70-78)
startStatusUpdates() {
  this.statusInterval = setInterval(async () => {
    const status = await this.collectStatus();
    this.send({
      type: 'status_update',
      status
    });
  }, 30000); // Every 30 seconds
}
```

3. **The Commander updates its database with agent status:**

```typescript
// backend/src/index.ts (lines 43-62)
engineService.on('agent_status', async (data: { agentId: string }) => {
  try {
    console.log(`Agent ${data.agentId} sent status update - marking as online`);
    await db.query(`
      UPDATE agents 
      SET status = 'online', last_seen = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [data.agentId]);
  } catch (error) {
    console.error('Error updating agent status:', error);
  }
});
```

## Error Handling and Reconnection

Both the Commander and Agents implement automatic reconnection to the Engine in case of connection loss:

### Commander Reconnection

```typescript
// backend/src/services/EngineService.ts (lines 91-99)
this.ws.on('close', (code: number, reason: Buffer) => {
  console.log('Disconnected from Engine hub:', { 
    code, 
    reason: reason.toString() 
  });
  this.connected = false;
  this.emit('disconnected');
  setTimeout(() => this.connect(), this.reconnectTimeout);
});
```

### Agent Reconnection

```javascript
// agent/src/agent.js (lines 53-57)
this.ws.on('close', () => {
  console.log('Disconnected from Engine, reconnecting...');
  clearInterval(this.statusInterval);
  setTimeout(() => this.connect(), this.reconnectTimeout);
});
```

## Summary

The WebSocket communication flow forms the backbone of real-time operations across the distributed system:

1. **Engine Hub** acts as central message router
2. **Commander** sends commands and receives status updates
3. **Agents** execute operations and report status

This architecture enables:
- Real-time status monitoring
- Command execution across distributed infrastructure
- Resilient connections with automatic reconnection
- Secure authentication between all components 