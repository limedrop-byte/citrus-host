const WebSocket = require('ws');
require('dotenv').config();

// Configuration
const DEFAULT_NUM_AGENTS = 1000;          // Default number of agents if not specified
const RECONNECT_TIMEOUT = 5000;         // Time to wait before reconnecting (5 seconds)
const STATUS_UPDATE_INTERVAL = 60000;    // Status update interval (1 minute)

class TestAgent {
    constructor(agentId, agentKey, engineUrl) {
        this.agentId = agentId;
        this.agentKey = agentKey;
        this.engineUrl = engineUrl;
        this.ws = null;
        this.isConnected = false;
        this.statusUpdateTimer = null;
        this.reconnectTimer = null;
    }

    connect() {
        console.log(`[Agent ${this.agentId}] Attempting to connect to ${this.engineUrl}`);
        
        try {
            this.ws = new WebSocket(this.engineUrl, {
                headers: {
                    'x-client-type': 'agent',
                    'x-agent-id': this.agentId,
                    'x-agent-key': this.agentKey
                }
            });

            this.ws.on('open', () => {
                console.log(`[Agent ${this.agentId}] Connected to Engine`);
                this.isConnected = true;
                
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

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log(`[Agent ${this.agentId}] Received:`, message.type || 'unknown');
                    this.handleMessage(message);
                } catch (error) {
                    console.error(`[Agent ${this.agentId}] Error parsing message:`, error);
                }
            });

            this.ws.on('close', (code, reason) => {
                console.log(`[Agent ${this.agentId}] Disconnected: ${code} - ${reason}`);
                this.isConnected = false;
                this.cleanup();
                this.scheduleReconnect();
            });

            this.ws.on('error', (error) => {
                console.error(`[Agent ${this.agentId}] WebSocket error:`, error.message);
                this.isConnected = false;
                this.cleanup();
                this.scheduleReconnect();
            });

        } catch (error) {
            console.error(`[Agent ${this.agentId}] Connection error:`, error);
            this.scheduleReconnect();
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error(`[Agent ${this.agentId}] Error sending message:`, error);
            }
        }
    }

    sendInitialStatus() {
        const status = {
            type: 'status_update',
            agentId: this.agentId,
            timestamp: new Date().toISOString(),
            status: 'online',
            systemInfo: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                platform: process.platform,
                nodeVersion: process.version
            },
            testAgent: true
        };

        this.send(status);
        console.log(`[Agent ${this.agentId}] Sent initial status`);
    }

    startStatusUpdates() {
        this.statusUpdateTimer = setInterval(() => {
            if (this.isConnected) {
                this.sendInitialStatus();
            }
        }, STATUS_UPDATE_INTERVAL);
    }

    handleMessage(message) {
        switch (message.type) {
            case 'ping':
                this.send({ type: 'pong', agentId: this.agentId });
                break;
            case 'command':
                console.log(`[Agent ${this.agentId}] Received command: ${message.command}`);
                // Simulate command execution
                this.send({
                    type: 'command_result',
                    agentId: this.agentId,
                    commandId: message.commandId,
                    result: 'Test agent - command simulated',
                    success: true
                });
                break;
            default:
                console.log(`[Agent ${this.agentId}] Unhandled message type: ${message.type}`);
        }
    }

    cleanup() {
        if (this.statusUpdateTimer) {
            clearInterval(this.statusUpdateTimer);
            this.statusUpdateTimer = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    scheduleReconnect() {
        if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
                console.log(`[Agent ${this.agentId}] Attempting to reconnect...`);
                this.reconnectTimer = null;
                this.connect();
            }, RECONNECT_TIMEOUT);
        }
    }

    disconnect() {
        console.log(`[Agent ${this.agentId}] Manually disconnecting`);
        this.cleanup();
        if (this.ws) {
            this.ws.close();
        }
    }
}

function loadAgentCredentials(numAgents) {
    const agents = [];
    const engineUrl = process.env.ENGINE_WS_URL;

    if (!engineUrl) {
        throw new Error('ENGINE_WS_URL environment variable is required');
    }

    // Try to load individual agent credentials
    for (let i = 1; i <= numAgents; i++) {
        const agentId = process.env[`AGENT_ID_${i}`];
        const agentKey = process.env[`AGENT_KEY_${i}`];

        if (agentId && agentKey) {
            agents.push({ agentId, agentKey });
        } else {
            // If we don't have numbered credentials, fall back to single agent credentials
            const singleAgentId = process.env.AGENT_ID;
            const singleAgentKey = process.env.AGENT_KEY;

            if (singleAgentId && singleAgentKey) {
                // Use single credentials with a suffix for multiple agents
                agents.push({
                    agentId: `${singleAgentId}-${i}`,
                    agentKey: singleAgentKey
                });
            } else {
                throw new Error(`Missing credentials for agent ${i}. Need AGENT_ID_${i} and AGENT_KEY_${i}, or AGENT_ID and AGENT_KEY`);
            }
        }
    }

    return { agents, engineUrl };
}

function main() {
    const numAgents = parseInt(process.argv[2]) || DEFAULT_NUM_AGENTS;
    
    console.log(`Starting agent load test with ${numAgents} agents...`);
    console.log(`Reconnect timeout: ${RECONNECT_TIMEOUT}ms`);
    console.log(`Status update interval: ${STATUS_UPDATE_INTERVAL}ms (~${Math.round(STATUS_UPDATE_INTERVAL / 1000 / 60 / 60)} hours)`);

    try {
        const { agents: agentCredentials, engineUrl } = loadAgentCredentials(numAgents);
        const testAgents = [];

        // Create and connect agents
        agentCredentials.forEach(({ agentId, agentKey }, index) => {
            const agent = new TestAgent(agentId, agentKey, engineUrl);
            testAgents.push(agent);
            
            // Stagger connections to avoid overwhelming the server
            setTimeout(() => {
                agent.connect();
            }, index * 100);
        });

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\nShutting down agents...');
            testAgents.forEach(agent => agent.disconnect());
            setTimeout(() => {
                console.log('Agents disconnected. Exiting.');
                process.exit(0);
            }, 1000);
        });

        console.log(`\nConnecting ${numAgents} test agents...`);
        console.log('Press Ctrl+C to stop all agents\n');

    } catch (error) {
        console.error('Error starting load test:', error.message);
        process.exit(1);
    }
}

// Run the load test
main(); 