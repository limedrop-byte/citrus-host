'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface TableStructure {
    column_name: string;
    data_type: string;
    is_nullable: string;
}

const REFRESH_INTERVAL = 30000; // 30 seconds

export default function TablesPage() {
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [structure, setStructure] = useState<TableStructure[]>([]);
    const [data, setData] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { getAdminToken } = useAdminAuth();

    const fetchTables = async () => {
        try {
            const response = await fetch('/api/admin/tables', {
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch tables');
            }

            const data = await response.json();
            setTables(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTables();
        
        // Set up periodic refresh
        const intervalId = setInterval(fetchTables, REFRESH_INTERVAL);
        
        // Cleanup interval on unmount
        return () => clearInterval(intervalId);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchTableDetails = async (tableName: string) => {
        setLoading(true);
        setError(null);
        try {
            // Fetch structure
            const structureResponse = await fetch(`/api/admin/tables/${tableName}/structure`, {
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`
                }
            });

            if (!structureResponse.ok) {
                throw new Error('Failed to fetch table structure');
            }

            const structureData = await structureResponse.json();
            setStructure(structureData);

            // Fetch data
            const dataResponse = await fetch(`/api/admin/tables/${tableName}/data`, {
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`
                }
            });

            if (!dataResponse.ok) {
                throw new Error('Failed to fetch table data');
            }

            const tableData = await dataResponse.json();
            setData(tableData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleTableSelect = (tableName: string) => {
        setSelectedTable(tableName);
        if (tableName) {
            fetchTableDetails(tableName);
        } else {
            setStructure([]);
            setData([]);
        }
    };

    const handleDeleteData = async () => {
        if (!selectedTable || !confirm('Are you sure you want to delete all data from this table?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/tables/${selectedTable}/data`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete table data');
            }

            // Refresh table data
            fetchTableDetails(selectedTable);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
    };

    return (
        <AdminLayout>
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Database Tables</h2>

                <div className="mb-6">
                    <select
                        className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={selectedTable}
                        onChange={(e) => handleTableSelect(e.target.value)}
                    >
                        <option value="">Select a table</option>
                        {tables.map((table) => (
                            <option key={table} value={table}>{table}</option>
                        ))}
                    </select>
                </div>

                {loading && (
                    <div className="flex justify-center items-center py-8">
                        <div className="flex justify-center items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0s' }}></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6">
                        {error}
                    </div>
                )}

                {selectedTable && !loading && !error && (
                    <>
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold mb-4">Table Structure</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead>
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Column</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Type</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nullable</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {structure.map((column, index) => (
                                            <tr key={index}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{column.column_name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{column.data_type}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{column.is_nullable}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">Table Data</h3>
                                <button
                                    onClick={handleDeleteData}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                                >
                                    Delete All Data
                                </button>
                            </div>
                            {data.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead>
                                            <tr>
                                                {Object.keys(data[0]).map((key) => (
                                                    <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        {key}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {data.map((row, rowIndex) => (
                                                <tr key={rowIndex}>
                                                    {Object.values(row).map((value: unknown, colIndex) => (
                                                        <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {value === null ? 'NULL' : String(value)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-500">No data in this table</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
} 