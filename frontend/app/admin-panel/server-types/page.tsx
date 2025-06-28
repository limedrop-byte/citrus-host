'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface ServerType {
    id: string;
    name: string;
    size: string;
    region: string;
    max_sites: number;
    created_at: string;
    updated_at: string;
}

export default function ServerTypesPage() {
    const { getAdminToken } = useAdminAuth();
    const [serverTypes, setServerTypes] = useState<ServerType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editingType, setEditingType] = useState<ServerType | null>(null);
    const [newMaxSites, setNewMaxSites] = useState<number>(0);

    useEffect(() => {
        fetchServerTypes();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchServerTypes = async () => {
        try {
            setLoading(true);
            // Add cache-busting query parameter
            const cacheBuster = new Date().getTime();
            
            const response = await fetch(`/api/admin/tables/server_types/data?_=${cacheBuster}`, {
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response error:', response.status, errorText);
                throw new Error(`Failed to fetch server types: ${response.status}`);
            }

            const data = await response.json();
            console.log('Server types data received:', data);
            setServerTypes(data);
            setError(null);
        } catch (err) {
            setError('Failed to load server types');
            console.error('Error fetching server types:', err);
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (serverType: ServerType) => {
        setEditingType(serverType);
        setNewMaxSites(serverType.max_sites);
        setEditMode(true);
    };

    const cancelEdit = () => {
        setEditingType(null);
        setEditMode(false);
    };

    const saveEdit = async () => {
        if (!editingType) return;

        try {
            setLoading(true);
            const response = await fetch(`/api/admin/server-types/${editingType.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ max_sites: newMaxSites })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update server type: ${errorText}`);
            }

            // Refresh the list
            fetchServerTypes();
            setEditMode(false);
            setEditingType(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update server type');
            console.error('Error updating server type:', err);
        } finally {
            setLoading(false);
        }
    };

    // Helper to format date/time
    const formatDateTime = (dateString: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    return (
        <AdminLayout>
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Server Types</h2>
                    <button
                        onClick={fetchServerTypes}
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center font-medium"
                        disabled={loading}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
                                        Size
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Region
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Max Sites
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Updated
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {serverTypes.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                                            No server types found
                                        </td>
                                    </tr>
                                ) : (
                                    serverTypes.map((serverType) => (
                                        <tr key={serverType.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {serverType.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {serverType.size}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {serverType.region}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {editMode && editingType?.id === serverType.id ? (
                                                    <input
                                                        type="number"
                                                        value={newMaxSites}
                                                        onChange={(e) => setNewMaxSites(parseInt(e.target.value) || 0)}
                                                        className="border border-gray-300 rounded-md px-2 py-1 w-16 text-center"
                                                        min="1"
                                                        max="100"
                                                    />
                                                ) : (
                                                    serverType.max_sites
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDateTime(serverType.created_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDateTime(serverType.updated_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {editMode && editingType?.id === serverType.id ? (
                                                    <div className="flex space-x-2 justify-end">
                                                        <button
                                                            onClick={saveEdit}
                                                            className="text-indigo-600 hover:text-indigo-900"
                                                            disabled={loading}
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={cancelEdit}
                                                            className="text-gray-500 hover:text-gray-700"
                                                            disabled={loading}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => startEdit(serverType)}
                                                        className="text-indigo-600 hover:text-indigo-900"
                                                        disabled={editMode}
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
} 