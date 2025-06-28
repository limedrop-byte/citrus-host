'use client';

import React, { useState, useEffect } from 'react';
import AdminLayout from './components/AdminLayout';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  database: {
    status: string;
    latency_ms: number;
    current_time: string;
  };
  agents: {
    total: number;
    online: number;
    offline: number;
    recent_activity: number;
  };
  servers: {
    total: number;
    running: number;
    provisioning: number;
    failed: number;
  };
  websockets: {
    connected_agents: number;
    status: string;
  };
  queues: {
    inbound: {
      queueLength: number;
      batchSize: number;
      processingIntervalMs: number;
      isProcessing: boolean;
      lastProcessedTime: number | null;
    };
    outbound: {
      totalQueueLength: number;
      processingIntervalMs: number;
      commandTimeoutMs: number;
      busyAgents: number;
      totalAgents: number;
      lastProcessedTime: number | null;
    };
    agents: Array<{
      agentId: string;
      queueLength: number;
      isBusy: boolean;
      currentCommand: string | null;
      runningTimeMs: number | null;
    }>;
  };
  memory: {
    used_mb: number;
    total_mb: number;
    external_mb: number;
  };
}

export default function AdminPanel() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${backendUrl}/health`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();
      setHealthData(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'connected':
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'unhealthy':
      case 'failed':
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'idle':
      case 'provisioning':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const StatCard = ({ title, value, status, icon }: { title: string; value: string | number; status?: string; icon?: React.ReactNode }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {status && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
              {status}
            </span>
          )}
        </div>
        {icon && (
          <div className="text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">System Health</h2>
              <p className="text-gray-600">Monitor system health and queue status</p>
            </div>
            <div className="flex items-center space-x-4">
              {lastRefresh && (
                <span className="text-sm text-gray-500">
                  Last refresh: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchHealthData}
                disabled={loading}
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center font-medium disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-1 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {loading && !healthData ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : healthData ? (
          <>
            {/* Overall Status */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Overall Status</h3>
                  <div className="mt-2 flex items-center space-x-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(healthData.status)}`}>
                      {healthData.status.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500">
                      Uptime: {formatUptime(healthData.uptime)}
                    </span>
                    <span className="text-sm text-gray-500">
                      Version: {healthData.version}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(healthData.timestamp).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Database"
                value={`${healthData.database.latency_ms}ms`}
                status={healthData.database.status}
                icon={
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                }
              />
              
              <StatCard
                title="Connected Agents"
                value={healthData.websockets.connected_agents}
                status={healthData.websockets.status}
                icon={
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
              />
              
              <StatCard
                title="Memory Usage"
                value={`${healthData.memory.used_mb}MB`}
                icon={
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                }
              />
              
              <StatCard
                title="Inbound Queue"
                value={healthData.queues.inbound.queueLength}
                status={healthData.queues.inbound.isProcessing ? 'processing' : 'idle'}
                icon={
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                }
              />
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Agents */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Agents</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Total</span>
                    <span className="font-medium text-black">{healthData.agents.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Online</span>
                    <span className="font-medium text-green-600">{healthData.agents.online}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Offline</span>
                    <span className="font-medium text-red-600">{healthData.agents.offline}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Recent Activity</span>
                    <span className="font-medium text-black">{healthData.agents.recent_activity}</span>
                  </div>
                </div>
              </div>

              {/* Servers */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Servers</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Total</span>
                    <span className="font-medium text-black">{healthData.servers.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Running</span>
                    <span className="font-medium text-green-600">{healthData.servers.running}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Provisioning</span>
                    <span className="font-medium text-yellow-600">{healthData.servers.provisioning}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Failed</span>
                    <span className="font-medium text-red-600">{healthData.servers.failed}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Queue Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Inbound Queue */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <svg className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  Inbound Queue
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Queue Length</span>
                    <span className={`font-bold text-lg ${healthData.queues.inbound.queueLength > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {healthData.queues.inbound.queueLength}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Batch Size</span>
                    <span className="font-medium text-black">{healthData.queues.inbound.batchSize}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Processing Interval</span>
                    <span className="font-medium text-black">{healthData.queues.inbound.processingIntervalMs}ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Status</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      healthData.queues.inbound.isProcessing 
                        ? 'text-green-600 bg-green-100' 
                        : 'text-gray-600 bg-gray-100'
                    }`}>
                      {healthData.queues.inbound.isProcessing ? 'Processing' : 'Idle'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Last Processed</span>
                    <span className="font-medium text-sm text-black">
                      {healthData.queues.inbound.lastProcessedTime 
                        ? new Date(healthData.queues.inbound.lastProcessedTime).toLocaleTimeString()
                        : 'Never'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Outbound Queue */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <svg className="h-5 w-5 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8V4m0 0l4 4m-4-4l-4 4m-6 0v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  Outbound Queue
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Total Queue Length</span>
                    <span className={`font-bold text-lg ${healthData.queues.outbound.totalQueueLength > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {healthData.queues.outbound.totalQueueLength}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Busy Agents</span>
                    <span className="font-medium text-blue-600">{healthData.queues.outbound.busyAgents}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Idle Agents</span>
                    <span className="font-medium text-green-600">
                      {healthData.queues.outbound.totalAgents - healthData.queues.outbound.busyAgents}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Processing Interval</span>
                    <span className="font-medium text-black">{healthData.queues.outbound.processingIntervalMs}ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Command Timeout</span>
                    <span className="font-medium text-black">{Math.round(healthData.queues.outbound.commandTimeoutMs / 1000 / 60)}min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-black">Last Processed</span>
                    <span className="font-medium text-sm text-black">
                      {healthData.queues.outbound.lastProcessedTime 
                        ? new Date(healthData.queues.outbound.lastProcessedTime).toLocaleTimeString()
                        : 'Never'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Agents with Queue Activity */}
            {healthData.queues.agents.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Active Agents ({healthData.queues.agents.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Agent ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Queue Length</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Current Command</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Running Time</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {healthData.queues.agents.map((agent) => (
                        <tr key={agent.agentId}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-black">
                            {agent.agentId.substring(0, 8)}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              agent.isBusy 
                                ? 'text-orange-600 bg-orange-100' 
                                : 'text-green-600 bg-green-100'
                            }`}>
                              {agent.isBusy ? 'Busy' : 'Idle'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                            {agent.queueLength}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                            {agent.currentCommand || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                            {agent.runningTimeMs 
                              ? `${Math.round(agent.runningTimeMs / 1000)}s`
                              : '-'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Memory Details */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Memory Usage</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-black">{healthData.memory.used_mb}MB</p>
                  <p className="text-sm text-black">Used</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-black">{healthData.memory.total_mb}MB</p>
                  <p className="text-sm text-black">Total Heap</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-black">{healthData.memory.external_mb}MB</p>
                  <p className="text-sm text-black">External</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((healthData.memory.used_mb / healthData.memory.total_mb) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round((healthData.memory.used_mb / healthData.memory.total_mb) * 100)}% used
                </p>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
} 