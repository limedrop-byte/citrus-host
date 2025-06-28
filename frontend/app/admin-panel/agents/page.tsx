'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface Agent {
    id: string;
    name: string;
    status: string;
    lastSeen: string;
    createdAt: string;
    updatedAt: string;
    gitVersion?: string;
}

interface GeneratedKey {
    id: string;
    name: string;
    key: string;
}

// New interface for batch deployment
interface BatchAgents {
    count: number;
    agents: GeneratedKey[];
}

export default function AgentsPage() {
    const { getAdminToken } = useAdminAuth();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null);
    const [agentName, setAgentName] = useState('');
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [showRollbackModal, setShowRollbackModal] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [commitId, setCommitId] = useState('');
    
    // New state for batch deployment
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchCount, setBatchCount] = useState<number>(10);
    const [batchNamePrefix, setBatchNamePrefix] = useState<string>('test-agent');
    const [batchedAgents, setBatchedAgents] = useState<BatchAgents | null>(null);
    const [showBatchResults, setShowBatchResults] = useState(false);
    const [envVarsText, setEnvVarsText] = useState<string>('');
    const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(false);

    useEffect(() => {
        // Initial fetch on component mount
        fetchAgents();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchAgents = async () => {
        try {
            setLoading(true);
            // Add cache-busting query parameter
            const cacheBuster = new Date().getTime();
            const response = await fetch(`/api/admin/agents?_=${cacheBuster}`, {
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch agents');
            }

            const data = await response.json();
            console.log('Fetched agents data:', data); // Log the data to help debug
            setAgents(data);
            setError(null);
        } catch (err) {
            setError('Failed to load agents');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const generateAgentKey = async () => {
        if (!agentName.trim()) {
            setError('Agent name is required');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch('/api/admin/agents/generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: agentName })
            });

            if (!response.ok) {
                throw new Error('Failed to generate agent key');
            }

            const data = await response.json();
            setGeneratedKey(data);
            setShowKeyModal(true);
            setAgentName('');
            fetchAgents(); // Refresh the list
            setError(null);
        } catch (err) {
            setError('Failed to generate agent key');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const updateAgent = async (agentId: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/agents/${agentId}/update`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to update agent');
            }

            // Success message
            setError(null);
            // Refresh the agents list
            fetchAgents();
        } catch (err) {
            setError('Failed to update agent');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const systemUpdateAgent = async (agentId: string) => {
        try {
            // Confirm the system update action
            if (!confirm('This will run the system-level update script (install.sh) on the agent. Continue?')) {
                return;
            }

            setLoading(true);
            const response = await fetch(`/api/admin/agents/${agentId}/system-update`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to perform system update');
            }

            // Success message
            setError(null);
            // Refresh the agents list
            fetchAgents();
        } catch (err) {
            setError('Failed to perform system update');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const deleteAgent = async (agentId: string) => {
        try {
            // Confirm the delete action
            if (!confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
                return;
            }

            setLoading(true);
            const response = await fetch(`/api/admin/agents/${agentId}/delete`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete agent');
            }

            // Success message
            setError(null);
            // Refresh the agents list
            fetchAgents();
        } catch (err) {
            setError('Failed to delete agent');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAgent = (agentId: string) => {
        const newSelection = new Set(selectedAgents);
        if (newSelection.has(agentId)) {
            newSelection.delete(agentId);
        } else {
            newSelection.add(agentId);
        }
        setSelectedAgents(newSelection);
        setSelectAll(newSelection.size === agents.length && agents.length > 0);
    };

    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedAgents(new Set());
            setSelectAll(false);
        } else {
            const allAgentIds = new Set(agents.map(agent => agent.id));
            setSelectedAgents(allAgentIds);
            setSelectAll(true);
        }
    };

    const batchDeleteAgents = async () => {
        if (selectedAgents.size === 0) {
            setError('Please select agents to delete');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${selectedAgents.size} agents? This action cannot be undone.`)) {
            return;
        }

        try {
            setLoading(true);
            const response = await fetch('/api/admin/agents/batch-delete', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ agentIds: Array.from(selectedAgents) })
            });

            if (!response.ok) {
                throw new Error('Failed to batch delete agents');
            }

            await response.json();
            setError(null);
            setSelectedAgents(new Set());
            setSelectAll(false);
            fetchAgents(); // Refresh the list
        } catch (err) {
            setError('Failed to batch delete agents');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const showRollbackDialog = (agentId: string) => {
        setSelectedAgentId(agentId);
        setCommitId('');
        setShowRollbackModal(true);
    };

    const rollbackAgent = async () => {
        if (!selectedAgentId || !commitId.trim()) {
            setError('Agent ID and Commit ID are required');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`/api/admin/agents/${selectedAgentId}/rollback`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ commitId: commitId.trim() })
            });

            if (!response.ok) {
                throw new Error('Failed to rollback agent');
            }

            // Success
            setError(null);
            setShowRollbackModal(false);
            // Refresh the agents list
            fetchAgents();
        } catch (err) {
            setError('Failed to rollback agent');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // New function for batch deployment
    const batchDeployAgents = async () => {
        if (!batchCount || batchCount < 1) {
            setError('Batch count must be at least 1');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch('/api/admin/agents/batch-deploy', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    count: batchCount,
                    namePrefix: batchNamePrefix
                })
            });

            if (!response.ok) {
                throw new Error('Failed to batch deploy agents');
            }

            const data = await response.json();
            setBatchedAgents(data);
            setShowBatchModal(false);
            setShowBatchResults(true);
            
            // Generate formatted env vars text
            let envText = '# Copy these environment variables to your .env file\n';
            envText += 'ENGINE_WS_URL=ws://localhost:3456\n\n';
            
            data.agents.forEach((agent: GeneratedKey, index: number) => {
                envText += `# Agent ${index + 1}\n`;
                envText += `AGENT_ID_${index + 1}=${agent.id}\n`;
                envText += `AGENT_KEY_${index + 1}=${agent.key}\n\n`;
            });
            
            setEnvVarsText(envText);
            
            // Refresh the agents list
            fetchAgents();
            setError(null);
        } catch (err) {
            setError('Failed to batch deploy agents');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AdminLayout>
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center">
                        <h2 className="text-2xl font-bold">Agents</h2>
                        <button
                            onClick={fetchAgents}
                            className="ml-4 px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center font-medium"
                            disabled={loading}
                            title="Refresh agent status from database"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh Status
                        </button>
                        
                        {/* Add Batch Deploy button */}
                        <button
                            onClick={() => setShowBatchModal(true)}
                            className="ml-4 px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 flex items-center font-medium"
                            disabled={loading}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            Batch Deploy
                        </button>
                        
                        {selectedAgents.size > 0 && (
                            <button
                                onClick={batchDeleteAgents}
                                className="ml-4 px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center font-medium"
                                disabled={loading}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete Selected ({selectedAgents.size})
                            </button>
                        )}
                    </div>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={agentName}
                            onChange={(e) => setAgentName(e.target.value)}
                            placeholder="Agent Name"
                            className="px-4 py-2 border border-gray-300 rounded-md"
                        />
                        <button
                            onClick={generateAgentKey}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            disabled={loading}
                        >
                            Generate New Key
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <>
                        {agents.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No agents found. Generate a new agent key to get started.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <input
                                                    type="checkbox"
                                                    checked={selectAll}
                                                    onChange={toggleSelectAll}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                ID
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Git Version
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Last Seen
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created At
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {agents.map((agent) => (
                                            <tr key={agent.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedAgents.has(agent.id)}
                                                        onChange={() => toggleSelectAgent(agent.id)}
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {agent.id}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {agent.name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        agent.status === 'online' ? 'bg-green-100 text-green-800' : 
                                                        agent.status === 'error' ? 'bg-red-100 text-red-800' : 
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {agent.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                                    {agent.gitVersion ? agent.gitVersion.substring(0, 7) : 'Unknown'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {agent.lastSeen ? new Date(agent.lastSeen).toLocaleString() : 'Never'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(agent.createdAt).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => updateAgent(agent.id)}
                                                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                                                            disabled={loading}
                                                        >
                                                            Git Pull
                                                        </button>
                                                        <button
                                                            onClick={() => systemUpdateAgent(agent.id)}
                                                            className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                                                            disabled={loading}
                                                        >
                                                            System Update
                                                        </button>
                                                        <button
                                                            onClick={() => showRollbackDialog(agent.id)}
                                                            className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200"
                                                            disabled={loading}
                                                        >
                                                            Rollback
                                                        </button>
                                                        <button
                                                            onClick={() => deleteAgent(agent.id)}
                                                            className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                                                            disabled={loading}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* Agent Key Modal */}
                {showKeyModal && generatedKey && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">New Agent Key Generated</h3>
                            <p className="mb-2 text-sm text-gray-600">
                                This key will only be shown once. Please copy it now.
                            </p>
                            
                            <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700">Agent ID:</p>
                                <div className="flex mt-1">
                                    <input
                                        type="text"
                                        readOnly
                                        value={generatedKey.id}
                                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                    />
                                    <button
                                        onClick={() => copyToClipboard(generatedKey.id)}
                                        className="ml-2 px-3 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700">Agent Key:</p>
                                <div className="flex mt-1">
                                    <input
                                        type="text"
                                        readOnly
                                        value={generatedKey.key}
                                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                                    />
                                    <button
                                        onClick={() => copyToClipboard(generatedKey.key)}
                                        className="ml-2 px-3 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                            
                            <p className="text-sm text-gray-500 mb-4">
                                Use these credentials in your agent&apos;s environment variables:<br />
                                <code className="bg-gray-100 px-1 py-0.5">AGENT_ID={generatedKey.id}</code><br />
                                <code className="bg-gray-100 px-1 py-0.5">AGENT_KEY={generatedKey.key}</code>
                            </p>
                            
                            <div className="flex justify-end">
                                <button
                                    onClick={() => {
                                        setShowKeyModal(false);
                                        setGeneratedKey(null);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Rollback Modal */}
                {showRollbackModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Rollback Agent</h3>
                            <p className="mb-2 text-sm text-gray-600">
                                Enter the commit ID you want to rollback to.
                            </p>
                            
                            <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700">Commit ID:</p>
                                <input
                                    type="text"
                                    value={commitId}
                                    onChange={(e) => setCommitId(e.target.value)}
                                    placeholder="Enter full commit hash (e.g., f6e6538ef2ef1cf93e0ad6cf63708f504a200ded)"
                                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md"
                                />
                            </div>
                            
                            <div className="flex justify-end space-x-2 mt-4">
                                <button
                                    onClick={() => setShowRollbackModal(false)}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={rollbackAgent}
                                    className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
                                    disabled={!commitId.trim()}
                                >
                                    Rollback
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Batch Deploy Modal */}
                {showBatchModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Batch Deploy Agents</h3>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Agent Name Prefix
                                </label>
                                <input
                                    type="text"
                                    value={batchNamePrefix}
                                    onChange={(e) => setBatchNamePrefix(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    placeholder="test-agent"
                                />
                            </div>
                            
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Number of Agents
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={batchCount}
                                    onChange={(e) => setBatchCount(parseInt(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowBatchModal(false)}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={batchDeployAgents}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                    disabled={loading}
                                >
                                    {loading ? 'Deploying...' : 'Deploy Agents'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Batch Results Modal */}
                {showBatchResults && batchedAgents && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-2xl w-full h-3/4 flex flex-col">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Batch Deployment Successful</h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Successfully deployed {batchedAgents.count} agents. Copy the environment variables below to use with your testing script.
                            </p>
                            
                            <div className="flex-grow overflow-auto bg-gray-50 rounded-md p-3 border border-gray-200">
                                <pre className="whitespace-pre-wrap text-xs font-mono">{envVarsText}</pre>
                            </div>
                            
                            <div className="mt-4 flex justify-end space-x-3">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(envVarsText);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Copy to Clipboard
                                </button>
                                <button
                                    onClick={() => setShowBatchResults(false)}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
} 