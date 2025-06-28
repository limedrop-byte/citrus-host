# Operation Retry Service

## Overview

The Operation Retry Service is a background service that automatically retries pending site operations (SSL deployments, site deployments) when connections are restored. It addresses scenarios where operations fail due to network interruptions or agent disconnections by maintaining persistent operation state and automatically retrying when conditions improve.

## Key Features

- Automatic retrying of SSL and site deployment operations
- Connection-aware retry mechanism that triggers on agent reconnection
- Periodic background checks for pending operations
- Tracking of retry counts and statistics

## How It Works

### Initialization and Connection Monitoring

The service initializes by connecting to the database and the Engine Service, setting up event listeners for connection events:

```typescript
constructor(db: Pool, engineService: IEngineService) {
  this.db = db;
  this.engineService = engineService;

  // Listen for connection events from the engine service
  this.engineService.on('connected', () => this.onEngineConnected());
  this.engineService.on('agent_connected', (agentId: string) => this.onAgentConnected(agentId));
}
```

### Periodic Operation Checks

The service runs a background check every 30 seconds to identify and retry pending operations:

```typescript
public start(): void {
  console.log('Starting Operation Retry Service');
  // Check for pending operations every 30 seconds
  this.retryInterval = setInterval(() => this.checkPendingOperations(), 30000);
}
```

### Connection Event Handling

When the Engine Hub reconnects or a specific agent connects, the service immediately checks for pending operations:

```typescript
private onEngineConnected(): void {
  console.log('Engine connected - checking for pending operations to retry');
  this.checkPendingOperations();
}

private onAgentConnected(agentId: string): void {
  console.log(`Agent ${agentId} connected - checking for pending operations to retry`);
  this.retryOperationsForAgent(agentId);
}
```

### Pending Operation Detection

The service identifies pending operations by querying the database for:
1. Sites with pending SSL status and online agents
2. Sites with in-progress deployment status and online agents

```typescript
// Fetch all sites with pending ssl status
const sslPendingResult = await this.db.query(`
  SELECT s.id, s.name, s.ssl_status, s.server_id, srv.agent_id
  FROM sites s
  JOIN servers srv ON s.server_id = srv.id
  LEFT JOIN agents a ON srv.agent_id = a.id
  WHERE s.ssl_status = 'pending'
  AND a.status = 'online'
`);
```

### Operation Retry Logic

For each pending operation, the service:
1. Checks the operation history from the `pending_operations` table
2. Updates retry counts and timestamps
3. Executes the appropriate operation via the Engine Service

```typescript
// Retry the appropriate operation
if (operationType === 'deploy_ssl') {
  this.engineService.deploySSL(site.agent_id, site.name);
  console.log(`Retried SSL deployment for site ${site.name}`);
} else if (operationType === 'turn_off_ssl') {
  this.engineService.turnOffSSL(site.agent_id, site.name);
  console.log(`Retried turning off SSL for site ${site.name}`);
} else if (operationType === 'redeploy_ssl') {
  this.engineService.redeploySSL(site.agent_id, site.name);
  console.log(`Retried SSL redeployment for site ${site.name}`);
}
```

## Operation Types

The service currently handles the following operation types:
- `deploy_ssl`: Initial SSL certificate deployment
- `turn_off_ssl`: Disabling SSL for a site
- `redeploy_ssl`: Renewing or redeploying SSL certificates
- `create`: Site creation (placeholder for future implementation)
- `delete`: Site deletion (placeholder for future implementation)

## Database Integration

Operations are tracked in the `pending_operations` table with the following structure:
- `id`: Unique identifier
- `site_id`: The site ID the operation applies to
- `operation_type`: Type of operation (deploy_ssl, turn_off_ssl, etc.)
- `status`: Current status (pending, completed, failed)
- `retry_count`: Number of retry attempts
- `created_at`: When the operation was created
- `last_retry_at`: When the operation was last retried

## Usage

The service is automatically started during application initialization:

```typescript
// Initialize operation retry service
const operationRetryService = new OperationRetryService(db.pool, engineService);
operationRetryService.start();
```

## Concurrency Control

The service prevents concurrent retries through the `isRetrying` flag:

```typescript
if (this.isRetrying) {
  return; // Prevent concurrent retries
}

this.isRetrying = true;
try {
  // Retry operations...
} finally {
  this.isRetrying = false;
}
```

## Error Handling

All operations are wrapped in try-catch blocks to prevent service interruption:

```typescript
try {
  // Operation logic...
} catch (error) {
  console.error('Error checking for pending operations:', error);
} finally {
  this.isRetrying = false;
}
``` 