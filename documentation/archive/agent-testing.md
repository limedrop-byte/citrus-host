# Agent Testing Documentation

## Overview
This document outlines how to use the agent load testing script and recent improvements to ensure proper connection status reporting between agents and the hub.

## Agent Load Testing

The `agent-load.js` script in the `/testing` directory allows you to simulate multiple agents connecting to your hub simultaneously. This is useful for load testing and verifying the hub's ability to handle multiple connections.

### Configuration

The script uses these key configuration values:

```javascript
const DEFAULT_NUM_AGENTS = 10;          // Default number of agents if not specified
const RECONNECT_TIMEOUT = 5000;         // Time to wait before reconnecting (5 seconds)
const STATUS_UPDATE_INTERVAL = 30000000; // Status update interval (~8.3 hours)
```

### Important Update: Explicit Agent Connection Messaging

A critical improvement has been made to ensure that agents properly trigger the "marking as online immediately" message in the hub logs:

```javascript
// When the WebSocket connection opens
this.ws.on('open', () => {
  console.log(`[Agent ${this.agentId}] Connected to Engine`);
  
  // First send an explicit agent_connected message
  this.send({
    type: 'agent_connected',
    agentId: this.agentId
  });
  
  // Wait a brief moment before sending initial status
  setTimeout(() => {
    this.sendInitialStatus();
    this.startStatusUpdates();
  }, 500);
});
```

#### Why This Is Important

1. **Explicit Connection Messaging**: The explicit `agent_connected` message ensures that the hub receives proper notification when an agent connects, triggering the "marking as online immediately" log message.

2. **Connection Status Visibility**: Without this explicit message, the hub might not immediately recognize agent connections, leading to inconsistencies in reported agent status.

3. **Protocol Synchronization**: The 500ms delay before sending the initial status ensures that the connection message is processed first, maintaining the proper sequence of events.

## Usage Instructions

1. Set up your environment variables with agent credentials:
   ```
   # Single agent
   AGENT_ID=your-agent-id
   AGENT_KEY=your-agent-key
   ENGINE_WS_URL=ws://your-hub-url

   # Multiple agents
   AGENT_ID_1=agent-id-1
   AGENT_KEY_1=agent-key-1
   AGENT_ID_2=agent-id-2
   AGENT_KEY_2=agent-key-2
   ...
   ENGINE_WS_URL=ws://your-hub-url
   ```

2. Run the script with the number of agents to simulate:
   ```
   node testing/agent-load.js 5
   ```

3. Verify in your hub logs that agents are properly marked as online with messages like:
   ```
   Agent [id] connected - marking as online immediately
   ```

## Status Update Interval

The current configuration uses a very long status update interval (30000000ms or ~8.3 hours) to minimize unnecessary traffic. This means:

1. Agents will send an initial status message upon connection
2. Status updates will only occur every ~8.3 hours during continuous operation
3. The hub will rely primarily on the connection state rather than regular pings

If you want more frequent status updates, you can modify the `STATUS_UPDATE_INTERVAL` constant to a lower value. 