# Citrus Host: Scaling Strategy

**Date: August 20, 2024**

This document outlines the scaling considerations for Citrus Host, focusing on potential bottlenecks and recommended strategies for handling increased load across all system components.

## Current Architecture Overview

The current Citrus Host system consists of:

1. **Frontend**: Next.js application serving the user interface
2. **Backend**: Express.js API handling business logic and database operations
3. **Engine Hub**: WebSocket server facilitating real-time communication
4. **Agents**: Distributed node.js applications running on customer servers

## WebSocket Scaling Considerations

### Current Implementation

The Engine Hub currently uses a single WebSocket server instance to handle all connections from:
- Backend/Commander (as a client)
- Multiple Agents (as clients)

### Potential Scaling Issues

1. **Connection Limits**:
   - Each WebSocket server has practical limits on concurrent connections
   - Single point of failure if the Engine Hub server goes down
   - Memory consumption increases with each connection

2. **Message Throughput**:
   - High message volumes may cause processing delays
   - No built-in message queue for handling traffic spikes

### Scaling Solutions for WebSockets

1. **Horizontal Scaling with Sticky Sessions**:
   ```
   Client/Agent --> Load Balancer (Sticky Sessions) --> Multiple Engine Instances
   ```

2. **Redis Adapter for WebSocket Clustering**:
   - Implement a Redis adapter for the WebSocket server
   - Allow multiple Engine instances to share connection state
   - Enable broadcasting messages across all instances

3. **Nginx Configuration for WebSocket Load Balancing**:
   ```nginx
   upstream engine_websocket {
     hash $remote_addr consistent;  # Sticky sessions based on IP
     server engine1.internal:8080;
     server engine2.internal:8080;
     server engine3.internal:8080;
   }

   server {
     listen 443 ssl;
     server_name engine.citrushost.io;

     location /socket.io/ {
       proxy_pass http://engine_websocket;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       
       # WebSocket specific settings
       proxy_read_timeout 86400s;    # 24h timeout
       proxy_send_timeout 86400s;    # 24h timeout
       proxy_buffering off;          # Disable buffering for WebSocket
     }
   }
   ```

4. **Heartbeat Mechanisms**:
   - Implement proper heartbeat checks to detect stale connections
   - Configure timeouts appropriate for long-lived connections

## Agent Scaling

### Current Implementation

Agents are deployed on individual customer servers and connect directly to the Engine Hub.

### Potential Scaling Issues

1. **Connection Management**:
   - Large number of agents may overwhelm a single Engine Hub
   - Reconnection storms if Engine Hub restarts

2. **Command Throughput**:
   - Peak operation times may cause command processing delays
   - No prioritization for critical operations

### Scaling Solutions for Agents

1. **Sharding by Region or Customer Group**:
   - Deploy multiple Engine Hubs
   - Route agents to specific Engine instances based on region or customer ID
   - Reduce connection count per hub instance

2. **Agent Connection Pooling**:
   - Implement exponential backoff for reconnection attempts
   - Add connection rate limiting to prevent reconnection storms
   - Batch non-critical updates to reduce message frequency

3. **Command Prioritization**:
   - Add priority levels to different operation types
   - Process critical operations (e.g., security updates) before routine tasks

4. **Agent Status Updates Optimization**:
   - Reduce status update frequency during high-load periods
   - Implement differential updates to minimize message size

## Frontend/Backend Scaling

### Current Implementation

The frontend and backend are deployed as monolithic applications.

### Potential Scaling Issues

1. **Request Volume**:
   - High traffic could overwhelm a single instance
   - Long-running operations block request threads

2. **Database Bottlenecks**:
   - Connection pool limitations
   - Query performance under high load

### Scaling Solutions

1. **Horizontal Scaling with Stateless Design**:
   - Ensure frontend and backend are fully stateless
   - Deploy multiple instances behind load balancer
   - Scale independently based on demand

2. **Nginx Configuration for API Load Balancing**:
   ```nginx
   upstream backend_api {
     least_conn;                    # Least connections algorithm
     server backend1.internal:5000;
     server backend2.internal:5000;
     server backend3.internal:5000;
   }

   server {
     listen 443 ssl;
     server_name api.citrushost.io;

     location /api/ {
       proxy_pass http://backend_api;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       
       # Cache common responses
       proxy_cache api_cache;
       proxy_cache_valid 200 5m;   # Cache successful responses for 5 minutes
       proxy_cache_key "$request_uri$http_authorization";  # Include auth in cache key
     }
   }
   ```

3. **Database Scaling**:
   - Implement read replicas for query-heavy operations
   - Add connection pooling with proper sizing
   - Consider sharding for very large datasets

4. **Caching Layer**:
   - Add Redis/Memcached for frequently accessed data
   - Implement cache invalidation strategies
   - Use response caching for static or semi-static content

## Future Microservices Architecture

As the system grows, transitioning to a microservices architecture will provide better scalability and isolation.

### Recommended Service Decomposition

1. **Authentication Service**
   - Handle user authentication and authorization
   - Manage JWT issuance and validation
   - Provide centralized user management

2. **Server Provisioning Service**
   - Manage server creation and configuration
   - Handle interactions with cloud providers (Digital Ocean, etc.)
   - Process provisioning queue with appropriate rate limiting

3. **Agent Management Service**
   - Handle agent registration and updates
   - Process agent status updates
   - Manage agent communication independently from other services

4. **Monitoring & Metrics Service**
   - Collect system-wide metrics
   - Process alerts and notifications
   - Store historical performance data

### Microservices Implementation Approach

1. **Gradual Extraction**:
   - Start by extracting the authentication service first
   - Move to API Gateway pattern for routing
   - Extract additional services based on domain boundaries

2. **Inter-Service Communication**:
   - Use REST for synchronous request/response patterns
   - Implement message queues (RabbitMQ, Kafka) for asynchronous communication
   - Maintain event-driven architecture for real-time updates

3. **Service Discovery**:
   - Implement service registry (Consul, etcd)
   - Add health checks for each service
   - Enable dynamic routing based on service health

## Database Scaling Strategy

### Current Implementation

PostgreSQL database for all application data.

### Scaling Recommendations

1. **Vertical Scaling (Initial Approach)**
   - Upgrade server resources (CPU, Memory)
   - Optimize database configuration for available resources
   - Implement proper indexing and query optimization

2. **Read Replicas (Intermediate)**
   - Add read-only database replicas
   - Route read queries to replicas, writes to primary
   - Implement connection pooling with PgBouncer

3. **Sharding (Advanced)**
   - Shard data by customer or geographical region
   - Implement appropriate routing logic in application
   - Consider database proxy solutions for transparent sharding

## Deployment and Infrastructure Scaling

1. **Container Orchestration**
   - Migrate to Kubernetes for automated scaling
   - Implement horizontal pod autoscaling based on CPU/memory metrics
   - Add custom metrics for WebSocket connections or message throughput

2. **Multi-Region Deployment**
   - Deploy to multiple geographical regions
   - Implement global load balancing
   - Consider data replication requirements

3. **CDN Integration**
   - Use CDN for static assets
   - Implement edge caching for API responses where appropriate
   - Reduce origin server load for frequent requests

## Monitoring for Scaling Decisions

To make informed scaling decisions, implement comprehensive monitoring:

1. **Key Metrics to Track**
   - WebSocket connection count and message throughput
   - API request latency and error rates
   - Database query performance and connection utilization
   - Memory and CPU usage across all components

2. **Alerting Thresholds**
   - Set alerts at 70% of capacity to allow time for scaling
   - Implement predictive scaling based on usage patterns
   - Monitor rate of growth for each component

## Conclusion

Citrus Host's architecture has good foundations for scaling with its separation of concerns between Frontend, Backend, Engine Hub, and Agents. The WebSocket-based communication requires special attention for scaling, particularly with connection management and message routing.

By implementing the strategies outlined in this document, Citrus Host can scale to handle thousands of concurrent users and agents while maintaining performance and reliability.

The gradual transition to microservices will further enhance scalability by allowing independent scaling of system components based on their specific resource requirements.

*Note: This scaling strategy should be revisited periodically as the system evolves and actual usage patterns emerge.* 