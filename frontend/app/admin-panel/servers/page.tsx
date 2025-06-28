'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface Server {
    id: string;
    name: string;
    digital_ocean_id: string | null;
    region: string;
    size: string;
    ip_address: string | null;
    status: string;
    agent_id: string | null;
    created_at: string;
    updated_at: string;
    max_sites: number;
    active_sites: number;
    server_type_id: string | null;
}

export default function ServersPage() {
    const { getAdminToken, isAdmin } = useAdminAuth();
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deploying, setDeploying] = useState(false);
    const [deployingAgent, setDeployingAgent] = useState(false);
    const [serverName, setServerName] = useState('');
    const [resettingServer, setResettingServer] = useState<string | null>(null);
    const [deletingServer, setDeletingServer] = useState<string | null>(null);

    useEffect(() => {
        // Check admin auth first
        if (!isAdmin) {
            console.log('User is not an admin, redirecting...');
            return;
        }
        fetchServers();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchServers = async () => {
        try {
            setLoading(true);
            // Add cache-busting query parameter
            const cacheBuster = new Date().getTime();
            
            // Get admin token and log its presence (not the actual token)
            const token = getAdminToken();
            console.log('Admin token available:', !!token);
            
            const response = await fetch(`/api/admin/servers?_=${cacheBuster}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response error:', response.status, errorText);
                throw new Error(`Failed to fetch servers: ${response.status}`);
            }

            const data = await response.json();
            console.log('Server data received:', data);
            setServers(data.servers || []);
            setError(null);
        } catch (err) {
            setError('Failed to load servers');
            console.error('Error fetching servers:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshStatus = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Get admin token
            const token = getAdminToken();
            if (!token) {
                setError('Authentication error. Please try logging in again.');
                return;
            }
            
            console.log('Refreshing server statuses from Digital Ocean...');
            const response = await fetch('/api/admin/servers/refresh-status', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Refresh status error:', response.status, errorText);
                throw new Error(`Failed to refresh server statuses: ${response.status}`);
            }

            const data = await response.json();
            console.log('Refresh status response:', data);
            
            // Fetch updated server list
            fetchServers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to refresh server statuses');
            console.error('Error refreshing server statuses:', err);
            setLoading(false);
        }
    };

    const deployServer = async () => {
        try {
            // Verify token exists
            const token = getAdminToken();
            if (!token) {
                setError('Authentication error. Please try logging in again.');
                return;
            }
            
            setDeploying(true);
            setError(null);
            
            // Create server name if not provided
            const name = serverName.trim() || `server-${new Date().getTime()}`;
            
            const response = await fetch('/api/admin/servers/deploy', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });

            const responseText = await response.text();
            console.log('Deploy server response:', response.status, responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                throw new Error(`Invalid JSON response: ${responseText}`);
            }

            if (!response.ok) {
                throw new Error(data?.error || `Failed to deploy server: ${response.status}`);
            }

            // Clear the input field and refresh the list
            setServerName('');
            fetchServers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to deploy server');
            console.error('Error deploying server:', err);
        } finally {
            setDeploying(false);
        }
    };

    const deployServerWithAgent = async () => {
        try {
            // Verify token exists
            const token = getAdminToken();
            if (!token) {
                setError('Authentication error. Please try logging in again.');
                return;
            }
            
            setDeployingAgent(true);
            setError(null);
            
            // Create server name if not provided
            const name = serverName.trim() || `server-${new Date().getTime()}`;
            
            const response = await fetch('/api/admin/servers/deploy-with-agent', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });

            const responseText = await response.text();
            console.log('Deploy server with agent response:', response.status, responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                throw new Error(`Invalid JSON response: ${responseText}`);
            }

            if (!response.ok) {
                throw new Error(data?.error || `Failed to deploy server with agent: ${response.status}`);
            }

            // Clear the input field and refresh the list
            setServerName('');
            fetchServers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to deploy server with agent');
            console.error('Error deploying server with agent:', err);
        } finally {
            setDeployingAgent(false);
        }
    };

    const resetSites = async (serverId: string) => {
        try {
            // Verify token exists
            const token = getAdminToken();
            if (!token) {
                setError('Authentication error. Please try logging in again.');
                return;
            }
            
            setResettingServer(serverId);
            setError(null);
            
            const response = await fetch(`/api/admin/servers/reset-sites`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ serverId })
            });

            const responseText = await response.text();
            console.log('Reset sites response:', response.status, responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                throw new Error(`Invalid JSON response: ${responseText}`);
            }

            if (!response.ok) {
                throw new Error(data?.error || `Failed to reset sites count: ${response.status}`);
            }

            // Refresh the list
            fetchServers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset sites count');
            console.error('Error resetting sites count:', err);
        } finally {
            setResettingServer(null);
        }
    };

    const deleteServer = async (serverId: string) => {
        try {
            setDeletingServer(serverId);
            setError(null);
            
            // Get admin token using the hook function
            const token = getAdminToken();
            
            if (!token) {
                throw new Error('Authentication error. Please try logging in again.');
            }
            
            // Call the backend API to delete the server through the admin route
            const response = await fetch(`/api/admin/servers/${serverId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const responseText = await response.text();
            console.log('Delete server response:', response.status, responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                throw new Error(`Invalid JSON response: ${responseText}`);
            }

            if (!response.ok) {
                throw new Error(data?.error || `Failed to delete server: ${response.status}`);
            }

            // Refresh the list
            fetchServers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete server');
            console.error('Error deleting server:', err);
        } finally {
            setDeletingServer(null);
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'running':
                return 'bg-green-100 text-green-800';
            case 'creating':
            case 'provisioning':
                return 'bg-yellow-100 text-yellow-800';
            case 'offline':
                return 'bg-red-50 text-red-600';
            case 'failed':
            case 'error':
            case 'not_found':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <AdminLayout>
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center">
                        <h2 className="text-2xl font-bold">Servers</h2>
                        <button
                            onClick={refreshStatus}
                            className="ml-4 px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center font-medium"
                            disabled={loading}
                            title="Refresh server status"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh Status
                        </button>
                    </div>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={serverName}
                            onChange={(e) => setServerName(e.target.value)}
                            placeholder="Server Name (optional)"
                            className="px-4 py-2 border border-gray-300 rounded-md"
                        />
                        <button
                            onClick={deployServer}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
                            disabled={deploying || deployingAgent || loading}
                        >
                            {deploying ? 'Deploying...' : 'Deploy $4/mo Server'}
                        </button>
                        <button
                            onClick={deployServerWithAgent}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed"
                            disabled={deployingAgent || deploying || loading}
                        >
                            {deployingAgent ? 'Deploying...' : 'Deploy Agent'}
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
                        {servers.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No servers found. Deploy a new server to get started.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Region
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Size
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Sites
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                IP Address
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Agent
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {servers.map((server) => (
                                            <tr key={server.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {server.name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {server.region}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {server.size}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {server.active_sites !== undefined ? `${server.active_sites} / ${server.max_sites || '?'}` : 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {server.ip_address || 'Not assigned yet'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(server.status)}`}>
                                                        {server.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {server.agent_id || 'Not assigned'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(server.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => resetSites(server.id)}
                                                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                                                            disabled={resettingServer === server.id}
                                                        >
                                                            {resettingServer === server.id ? 'Resetting...' : 'Reset Sites'}
                                                        </button>
                                                        <button
                                                            onClick={() => deleteServer(server.id)}
                                                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                                                            disabled={deletingServer === server.id}
                                                        >
                                                            {deletingServer === server.id ? 'Deleting...' : 'Delete'}
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
            </div>
        </AdminLayout>
    );
} 