# Citrus Host - Comprehensive Documentation

## Application Overview

Citrus Host is a web hosting and domain management platform built with a modern tech stack. The application enables users to manage domains, web hosting, and subscriptions through an intuitive interface.

## Architecture

### Core Components

1. **Frontend (Next.js Application)**
   - Built with Next.js and TailwindCSS
   - Implements both server-side and client-side rendering
   - Responsive design for all device types

2. **Backend (Express.js API)**
   - RESTful API architecture
   - JWT-based authentication
   - Comprehensive security measures

3. **Database (PostgreSQL)**
   - Relational database for all application data
   - Optimized schema for performance
   - Support for complex queries and relationships

4. **Engine Service**
   - Handles site deployment operations
   - Manages server configuration
   - Executes system-level commands

## Frontend Structure

### Public Layer
- **Landing Page**: Introduction to the platform
- **Login**: User authentication
- **Registration**: New user signup

### Protected Layer (Dashboard)
- **Domain Management**: Register, transfer, and manage domains
- **Web Hosting**: Deploy and manage web hosting
- **Subscriptions**: Manage subscription plans and billing

### Global Components
- **Authentication Context**: User session management
- **Layout Components**: Consistent UI structure
- **UI Components**: Reusable interface elements

## Backend Structure

### API Routes
- **Authentication**: User login/logout, registration, password reset
- **User Management**: Profile updates, settings management
- **Domain Operations**: Domain registration, configuration, DNS management
- **Hosting Management**: Website creation, configuration, deployment
- **Admin Panel**: Administrative functions and system management

### Middleware Layer
- **Authentication**: JWT validation and session management
- **Request Validation**: Input sanitization and validation
- **Error Handling**: Standardized error responses
- **Rate Limiting**: Prevention of abuse and DOS attacks

### Database Layer
- **PostgreSQL Connection**: Database connection pooling
- **Models**: Data schemas and relationships
- **Migrations**: Database structure versioning

## Security Architecture

### Multi-Layered Security

1. **Frontend → Backend Authentication**
   - JWT-based token system
   - Session validation
   - Input sanitization

2. **Backend → Engine Communication**
   - API key authentication
   - Request signing with timestamps
   - Rate limiting and IP restrictions

3. **Engine → Backend Callbacks**
   - Secure callback URLs
   - Site ID verification
   - Status updates with authentication

### Security Features

- CORS validation with domain allowlisting
- Rate limiting for API endpoints
- JWT authentication with proper expiration
- Request signing for sensitive operations
- SSL/TLS encryption for all communications
- Bcrypt password hashing
- Environment variable protection
- HTTP security headers
- Input validation on all endpoints
- Comprehensive error handling

## Data Flow

1. **Site Creation Process**
   - User initiates site creation through dashboard
   - Backend validates request and creates database record
   - Engine server receives secure request to create site
   - Engine executes creation and reports back to backend
   - Backend updates status and notifies user

What needs to happen: 

1. **Site Creation Process**
   - User initiates site creation through dashboard
   - Backend validates request and creates database record
   - Engine server receives secure request to create site
   - Engine server validates request and sends to hosting server (engine client)
   - Engine client executes creation and reports back to engine server
   - Engine server reports back to backend
   - Backend updates status and notifies user


2. **Authentication Flow**
   - User submits credentials
   - Backend validates and issues JWT token
   - Token stored in client browser
   - Token included in subsequent API requests
   - Token validation on protected endpoints

3. **Domain Management**
   - User selects domain operation
   - Backend processes request with appropriate provider API
   - Database updated with domain information
   - User notified of operation status

## Scalability Design

### Horizontal Scaling

1. **Frontend Scaling**
   - Deployment to CDN or serverless platform
   - Static site generation where possible
   - Edge caching for API responses

2. **Backend Scaling**
   - Multiple instances behind load balancer
   - Containerization with Docker
   - Orchestration with Kubernetes

3. **Database Scaling**
   - Primary instance with read replicas
   - Connection pooling
   - Query optimization and indexing

### Advanced Scaling Strategies

1. **Caching Layer**
   - Redis for frequent data caching
   - API response caching
   - Session storage

2. **Microservices Architecture**
   - Authentication Service
   - Domains Service
   - Hosting Service
   - Subscription Service

## External Integrations

- **Payment Processing**: Stripe integration for subscription billing
- **Domain Registrars**: API integration with domain registration services
- **Email Services**: Transactional email delivery
- **Monitoring**: Performance and error tracking tools

## Application Features

### Domain Management
- Domain registration with various TLDs
- DNS management interface
- Domain transfer functionality
- Domain settings and configuration

### Web Hosting
- One-click site deployment
- Site configuration management
- SSL certificate installation
- Performance monitoring
- Backup and restore functionality

### User Management
- User registration and authentication
- Profile management
- Team and role-based permissions
- Activity logging

### Subscription and Billing
- Plan selection and management
- Billing history
- Payment method management
- Usage tracking and limits

## Development Architecture

### Local Development
- Frontend (Port 3000)
- Backend API (Port 5001)
- PostgreSQL (Port 5432)

### Production Environment
- Web Server with load balancing
- Multiple Backend instances
- Replicated Database
- Redis caching layer
- Monitoring and logging systems 