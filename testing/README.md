# Agent Load Testing Script

This script simulates multiple agents connecting to your Citrus Host hub simultaneously for load testing and stress testing purposes.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in this directory with your agent credentials:
   ```bash
   # Engine WebSocket URL
   ENGINE_WS_URL=ws://your-hub-url:port
   
   # Option 1: Individual agent credentials (for multiple specific agents)
   AGENT_ID_1=agent-id-1
   AGENT_KEY_1=agent-key-1
   AGENT_ID_2=agent-id-2
   AGENT_KEY_2=agent-key-2
   # ... add more as needed
   
   # Option 2: Single agent credentials (will be used with suffixes)
   AGENT_ID=single-agent-id
   AGENT_KEY=single-agent-key
   ```

3. **Copy environment variables from your web app**: Your web app generates agent credentials that you can copy and paste directly into the `.env` file.

## Usage

### Basic Usage
```bash
# Run with default 10 agents
node agent-load.js

# Run with specific number of agents
node agent-load.js 5

# Use npm scripts
npm run test          # 10 agents (default)
npm run load-test     # 5 agents
npm run stress-test   # 20 agents
```

### Environment Variables

The script supports two methods for agent credentials:

1. **Individual credentials**: `AGENT_ID_1`, `AGENT_KEY_1`, `AGENT_ID_2`, `AGENT_KEY_2`, etc.
2. **Single credentials**: `AGENT_ID` and `AGENT_KEY` (will create numbered variants)

### Configuration

You can modify these constants in `agent-load.js`:

- `DEFAULT_NUM_AGENTS`: Default number of agents (10)
- `RECONNECT_TIMEOUT`: Time to wait before reconnecting (5 seconds)
- `STATUS_UPDATE_INTERVAL`: How often to send status updates (~8.3 hours)

## Features

- **Staggered connections**: Agents connect with 100ms delays to avoid overwhelming the server
- **Automatic reconnection**: Agents will automatically reconnect if disconnected
- **Proper protocol**: Sends `agent_connected` messages and status updates
- **Graceful shutdown**: Press Ctrl+C to disconnect all agents cleanly
- **Test agent identification**: Agents are marked as test agents in status updates

## Output

The script will show:
- Connection attempts and successes
- Message exchanges between agents and hub
- Disconnections and reconnection attempts
- Any errors that occur

## What It Tests

- WebSocket connection handling under load
- Agent authentication with multiple simultaneous connections
- Message processing capacity
- Connection recovery and stability
- Hub performance with multiple active agents

This helps ensure your hub can handle multiple agent connections reliably in production. 