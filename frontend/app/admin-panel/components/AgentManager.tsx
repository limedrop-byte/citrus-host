import React, { useState } from 'react';

interface Agent {
  id: string;
  name: string;
  key: string;
  status: 'online' | 'offline' | 'error';
  lastSeen: string;
}

interface AgentManagerProps {
  serverId: number;
}

export default function AgentManager({ serverId }: AgentManagerProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [newAgentData, setNewAgentData] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createAgent = async () => {
    setIsCreatingAgent(true);
    setError(null);
    setNewAgentData(null);

    try {
      const response = await fetch(`/api/admin/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          name: `agent-${serverId}-${Date.now()}`,
          serverId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create agent');
      }

      setNewAgentData(data);
      setAgents(prev => [...prev, data]);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsCreatingAgent(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Server Agents</h2>
        <button
          onClick={createAgent}
          disabled={isCreatingAgent}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50 transition-colors"
        >
          {isCreatingAgent ? 'Creating...' : 'Create New Agent'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {newAgentData && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-md mb-6">
          <h3 className="text-lg font-medium text-green-800 mb-2">New Agent Created!</h3>
          <div className="space-y-2">
            <p><span className="font-semibold">ID:</span> {newAgentData.id}</p>
            <p><span className="font-semibold">Name:</span> {newAgentData.name}</p>
            <div>
              <p className="font-semibold mb-1">Agent Key (copy this now, it won&apos;t be shown again):</p>
              <div className="bg-white p-2 rounded border border-green-200 font-mono text-sm break-all">
                {newAgentData.key}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-green-700">
                Use these credentials in your agent&apos;s .env file:
              </p>
              <pre className="bg-white p-3 rounded border border-green-200 text-sm mt-2">
{`AGENT_ID=${newAgentData.id}
AGENT_KEY=${newAgentData.key}
ENGINE_WS_URL=ws://localhost:3456`}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {agents.map(agent => (
          <div
            key={agent.id}
            className="border rounded-md p-4 flex justify-between items-center"
          >
            <div>
              <h3 className="font-medium">{agent.name}</h3>
              <p className="text-sm text-gray-500">ID: {agent.id}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  agent.status === 'online'
                    ? 'bg-green-100 text-green-800'
                    : agent.status === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {agent.status}
              </span>
            </div>
          </div>
        ))}

        {agents.length === 0 && !newAgentData && (
          <p className="text-gray-500 text-center py-4">
            No agents found. Create one to get started.
          </p>
        )}
      </div>
    </div>
  );
} 