// Admin panel configuration
export const ADMIN_API_CONFIG = {
    // Base URL for admin API endpoints
    // In production, this would be changed to the remote API URL
    baseUrl: process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:5000/api/admin',
    
    // Frontend URL for redirects
    frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
    
    // API endpoints
    endpoints: {
        users: '/users',
        tables: '/tables',
        tableStructure: (tableName: string) => `/tables/${tableName}/structure`,
        tableData: (tableName: string) => `/tables/${tableName}/data`,
        agents: '/agents',
        generateAgentKey: '/agents/generate',
        updateAgent: (agentId: string) => `/agents/${agentId}/update`,
        rollbackAgent: (agentId: string) => `/agents/${agentId}/rollback`,
        agentMetrics: (agentId: string) => `/agents/${agentId}/metrics`,
        servers: '/servers',
        deployServer: '/servers/deploy'
    }
};

// Authentication configuration
export const AUTH_CONFIG = {
    tokenKey: 'admin_token',
    userKey: 'admin_user'
}; 