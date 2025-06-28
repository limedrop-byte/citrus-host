'use client';

import React, { useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';

export default function PingPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; engine_response?: Record<string, unknown> } | null>(null);
    const { getAdminToken } = useAdminAuth();

    const handlePingTest = async () => {
        setLoading(true);
        setResult(null);
        
        try {
            const response = await fetch('/api/admin/engine/ping-test', {
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`
                }
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Connection test failed');
            }

            setResult({
                success: true,
                message: data.message || 'Connection successful!',
                engine_response: data.engine_response
            });
        } catch (err) {
            setResult({
                success: false,
                message: err instanceof Error ? err.message : 'Connection test failed'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AdminLayout>
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Engine Connection Test</h2>
                <p className="text-gray-600 mb-6">
                    Test the connection to the engine server to ensure everything is working properly.
                </p>

                <button
                    onClick={handlePingTest}
                    disabled={loading}
                    className={`px-4 py-2 rounded-md text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        loading
                            ? 'bg-blue-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    {loading ? 'Testing...' : 'Test Connection'}
                </button>

                {result && (
                    <div
                        className={`mt-6 p-4 rounded-md ${
                            result.success
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                        }`}
                    >
                        <p className="font-medium">{result.message}</p>
                        {result.success && result.engine_response && (
                            <div className="mt-2 text-sm">
                                <p>Engine Response:</p>
                                <pre className="mt-1 p-2 bg-green-100 rounded">
                                    {JSON.stringify(result.engine_response, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
} 