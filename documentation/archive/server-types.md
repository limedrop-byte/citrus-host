# Server Types Management System

This document outlines the design and implementation of the server types management system for Citrus Host. The system allows for flexible configuration of different server types with varying capacities and pricing.

## Overview

Citrus Host supports multiple server configurations to accommodate different customer needs. Each server type has specific resources (CPU, memory, disk) and a maximum number of sites it can host.

## Server Type Configuration

### Database Schema

Server types are managed through a hybrid approach using both code-based defaults and database overrides.

```sql
-- Base server types table
CREATE TABLE server_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) NOT NULL UNIQUE,  -- e.g., 's-1vcpu-1gb'
    name VARCHAR(100) NOT NULL,        -- e.g., 'Basic 1GB'
    description TEXT,
    cpu_cores INTEGER NOT NULL,        -- e.g., 1
    memory_mb INTEGER NOT NULL,        -- e.g., 1024
    disk_gb INTEGER NOT NULL,          -- e.g., 25
    max_sites INTEGER NOT NULL,        -- e.g., 5
    price_monthly DECIMAL(10,2),       -- e.g., 6.00
    region VARCHAR(20) NOT NULL,       -- e.g., 'sfo3'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_server_types_slug ON server_types(slug);
CREATE INDEX idx_server_types_active ON server_types(is_active);

-- Optional overrides table for dynamic adjustments
CREATE TABLE server_type_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_slug VARCHAR(50) NOT NULL UNIQUE,
    max_sites INTEGER,
    is_active BOOLEAN DEFAULT true,
    price_override DECIMAL(10,2),
    override_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Base Configuration in Code

For type safety and version control, base configurations are defined in code:

```typescript
// backend/src/config/baseServerTypes.ts
export const BASE_SERVER_TYPES = {
    'basic-1gb': {
        slug: 's-1vcpu-1gb',
        name: 'Basic 1GB',
        description: 'Ideal for small sites',
        cpuCores: 1,
        memoryMb: 1024,
        diskGb: 25,
        baseMaxSites: 5,
        priceMonthly: 6.00,
        region: 'sfo3'
    },
    'standard-2gb': {
        slug: 's-1vcpu-2gb',
        name: 'Standard 2GB',
        description: 'Perfect for medium traffic sites',
        cpuCores: 1,
        memoryMb: 2048,
        diskGb: 50,
        baseMaxSites: 10,
        priceMonthly: 12.00,
        region: 'sfo3'
    },
    'performance-4gb': {
        slug: 's-2vcpu-4gb',
        name: 'Performance 4GB',
        description: 'For high traffic sites and applications',
        cpuCores: 2,
        memoryMb: 4096,
        diskGb: 80,
        baseMaxSites: 20,
        priceMonthly: 24.00,
        region: 'sfo3'
    }
} as const;
```

## Implementation

### ServerTypeService

The `ServerTypeService` manages server type operations:

```typescript
// backend/src/services/ServerTypeService.ts
import { BASE_SERVER_TYPES } from '../config/baseServerTypes';
import db from '../db';

export interface ServerTypeConfig {
    slug: string;
    name: string;
    description: string;
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
    maxSites: number;
    priceMonthly: number;
    region: string;
    isActive: boolean;
}

export class ServerTypeService {
    /**
     * Get all available server types
     */
    async getAvailableTypes(): Promise<ServerTypeConfig[]> {
        // Query active server types from database
        const dbTypes = await db.query(`
            SELECT * FROM server_types 
            WHERE is_active = true 
            ORDER BY price_monthly ASC
        `);
        
        // For each type, check for overrides
        return Promise.all(dbTypes.rows.map(async (type) => {
            const override = await this.getTypeOverride(type.slug);
            return this.mergeTypeWithOverride(type, override);
        }));
    }

    /**
     * Get configuration for a specific server type
     */
    async getServerTypeConfig(slug: string): Promise<ServerTypeConfig> {
        // Get base configuration (first from DB, fallback to code)
        const baseConfigQuery = await db.query(`
            SELECT * FROM server_types 
            WHERE slug = $1 AND is_active = true
        `, [slug]);
        
        const baseConfig = baseConfigQuery.rows[0] || BASE_SERVER_TYPES[slug];
        if (!baseConfig) throw new Error(`Invalid server type: ${slug}`);

        // Check for overrides
        const override = await this.getTypeOverride(slug);
        
        // Merge base config with any overrides
        return this.mergeTypeWithOverride(baseConfig, override);
    }
    
    /**
     * Check if a server can handle an additional site
     */
    async validateServerCapacity(serverId: string): Promise<boolean> {
        const result = await db.query(`
            SELECT s.*, st.slug as type_slug, COUNT(si.id) as site_count
            FROM servers s
            LEFT JOIN sites si ON s.id = si.server_id
            JOIN server_types st ON s.size = st.slug
            WHERE s.id = $1
            GROUP BY s.id, st.slug
        `, [serverId]);
        
        if (result.rows.length === 0) {
            throw new Error(`Server not found: ${serverId}`);
        }
        
        const server = result.rows[0];
        const serverType = await this.getServerTypeConfig(server.type_slug);
        
        return parseInt(server.site_count) < serverType.maxSites;
    }
    
    // Private helper methods
    private async getTypeOverride(slug: string) {
        const overrideQuery = await db.query(`
            SELECT * FROM server_type_overrides 
            WHERE type_slug = $1 AND is_active = true
        `, [slug]);
        
        return overrideQuery.rows[0];
    }
    
    private mergeTypeWithOverride(baseConfig: any, override: any): ServerTypeConfig {
        return {
            slug: baseConfig.slug,
            name: baseConfig.name,
            description: baseConfig.description,
            cpuCores: baseConfig.cpu_cores || baseConfig.cpuCores,
            memoryMb: baseConfig.memory_mb || baseConfig.memoryMb,
            diskGb: baseConfig.disk_gb || baseConfig.diskGb,
            maxSites: override?.max_sites ?? (baseConfig.max_sites || baseConfig.baseMaxSites),
            priceMonthly: override?.price_override ?? baseConfig.price_monthly || baseConfig.priceMonthly,
            region: baseConfig.region,
            isActive: baseConfig.is_active ?? true
        };
    }
}

export default new ServerTypeService();
```

## Server Deployment

When deploying a new server, the server type is specified:

```typescript
// backend/src/routes/servers.ts
import serverTypeService from '../services/ServerTypeService';

// Deploy a new server
router.post('/deploy', async (req, res) => {
    try {
        const { serverType = 'basic-1gb' } = req.body;
        
        // Get server type configuration
        const typeConfig = await serverTypeService.getServerTypeConfig(serverType);
        
        // Configure the droplet based on server type
        const dropletConfig = {
            name: `citrus-server-${Date.now()}`,
            region: typeConfig.region,
            size: typeConfig.slug,
            image: "ubuntu-22-04-x64",
            backups: false,
            ipv6: true,
            monitoring: true,
            tags: ["citrus-host"]
        };

        // Create server record in database
        const dbResult = await db.query(`
            INSERT INTO servers (name, region, size, status, max_sites)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name
        `, [
            dropletConfig.name,
            typeConfig.region,
            typeConfig.slug,
            'creating',
            typeConfig.maxSites
        ]);
        
        // ... rest of deployment logic
        
        res.status(202).json({
            success: true,
            message: 'Server deployment initiated',
            server: {
                id: dbResult.rows[0].id,
                name: dbResult.rows[0].name,
                type: serverType,
                status: 'creating'
            }
        });
    } catch (error) {
        // ... error handling
    }
});
```

## Server Capacity Checks

Before creating a new site, the system checks if the selected server has capacity:

```typescript
// When creating a new site
async function createSite(domain: string, serverId: string) {
    // Check if server has capacity
    const hasCapacity = await serverTypeService.validateServerCapacity(serverId);
    
    if (!hasCapacity) {
        throw new Error('Server has reached maximum site capacity');
    }
    
    // Proceed with site creation...
}
```

## Administration

The admin interface allows authorized users to:

1. View all server types and their configurations
2. Create new server type overrides
3. Adjust max_sites values for existing server types
4. Enable/disable specific server types

## Migration and Data Seeding

When deploying this system, the database should be seeded with initial server types:

```sql
-- Seed initial server types
INSERT INTO server_types 
(slug, name, description, cpu_cores, memory_mb, disk_gb, max_sites, price_monthly, region)
VALUES
('s-1vcpu-1gb', 'Basic 1GB', 'Ideal for small sites', 1, 1024, 25, 5, 6.00, 'sfo3'),
('s-1vcpu-2gb', 'Standard 2GB', 'Perfect for medium traffic sites', 1, 2048, 50, 10, 12.00, 'sfo3'),
('s-2vcpu-4gb', 'Performance 4GB', 'For high traffic sites and applications', 2, 4096, 80, 20, 24.00, 'sfo3');
```

## Benefits of This Approach

1. **Flexibility**: Easy to add or modify server types without code changes
2. **Type Safety**: Base configurations provide TypeScript type safety
3. **Dynamic Adjustments**: Capacity and pricing can be adjusted without deployments
4. **Versioning**: Changes to server types can be tracked over time
5. **Testing**: New server configurations can be tested before being made generally available

## Future Enhancements

- Region-specific pricing and configurations
- Custom server types for enterprise customers
- Automatic capacity optimization based on usage patterns
- Seasonal promotions with temporary server type offerings 