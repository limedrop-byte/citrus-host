# Custom LAMP Stack Architecture

## Overview

This document outlines our approach to building a custom LAMP stack for WordPress hosting that replaces WordOps/EasyEngine while maintaining the same agent-based architecture we currently use.

## Architecture Components

### 1. Agent Infrastructure

We'll keep our existing agent architecture but extend its capabilities:

```
┌───────────────┐           ┌───────────────┐
│               │           │               │
│  Central Hub  │◄─────────►│  LAMP Agent   │
│               │           │               │
└───────────────┘           └───────────────┘
```

#### Agent Responsibilities
- Server provisioning
- WordPress site management
- SSL certificate management
- Security updates
- Performance optimization
- Monitoring & reporting

### 2. Core Stack Components

| Component | Implementation | Update Strategy |
|-----------|----------------|-----------------|
| **Linux** | Ubuntu 22.04 LTS | Unattended security updates |
| **Nginx** | Custom compiled | Agent-managed binary updates |
| **MySQL/MariaDB** | MariaDB 10.6+ | Semi-automatic with failsafes |
| **PHP** | PHP-FPM 8.1/8.2 | Version-switchable via symlinks |
| **Redis** | Redis Server | Auto-updated with distro |
| **Let's Encrypt** | Certbot | Scheduled renewal jobs |

## Implementation Strategy

### 1. Server Provisioning

Replace WordOps installation with direct configuration:

```javascript
async function setupServer() {
  // Install core packages
  await execAsync('apt-get update && apt-get install -y nginx mariadb-server php8.1-fpm redis-server certbot');
  
  // Configure components with our optimized configs
  await execAsync('cp /opt/citrus-agent/configs/nginx/nginx.conf /etc/nginx/nginx.conf');
  await execAsync('cp /opt/citrus-agent/configs/mariadb/my.cnf /etc/mysql/mariadb.conf.d/90-citrus-optimized.cnf');
  
  // Ensure MariaDB binds to all interfaces
  await execAsync('echo "[mysqld]\nbind-address = 0.0.0.0" > /etc/mysql/mariadb.conf.d/99-citrus-bind-address.cnf');
  
  // Set up PHP versions
  await setupPhpVersions(['7.4', '8.0', '8.1', '8.2']);
  
  // Configure firewall
  await execAsync('ufw allow "Nginx Full" && ufw allow ssh');
}
```

### 2. Site Creation Process

Replace `wo site create` with our own implementation:

```javascript
async function createSite(domain) {
  try {
    // 1. Create nginx config
    await execAsync(`envsubst < /opt/citrus-agent/templates/nginx-site.conf > /etc/nginx/sites-available/${domain}`);
    
    // 2. Create web root and set permissions
    await execAsync(`mkdir -p /var/www/${domain}/htdocs`);
    await execAsync(`chown -R www-data:www-data /var/www/${domain}`);
    
    // 3. Create database and user
    const dbName = domain.replace(/[.-]/g, '_');
    const dbPass = crypto.randomBytes(16).toString('hex');
    await execAsync(`mysql -e "CREATE DATABASE ${dbName};"`);
    await execAsync(`mysql -e "CREATE USER '${dbName}'@'localhost' IDENTIFIED BY '${dbPass}';"`);
    await execAsync(`mysql -e "GRANT ALL PRIVILEGES ON ${dbName}.* TO '${dbName}'@'localhost';"`);
    
    // 4. Download and configure WordPress
    await execAsync(`wp core download --path=/var/www/${domain}/htdocs`);
    await execAsync(`wp config create --dbname=${dbName} --dbuser=${dbName} --dbpass=${dbPass} --path=/var/www/${domain}/htdocs`);
    
    // 5. Enable site
    await execAsync(`ln -s /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/`);
    await execAsync(`nginx -t && systemctl reload nginx`);
    
    return { status: 'success', database: { name: dbName, user: dbName, password: dbPass } };
  } catch (error) {
    await cleanupFailedInstall(domain);
    throw error;
  }
}
```

### 3. Auto-Update System

Implement a secure and controlled update process:

```javascript
async function performUpdates() {
  // 1. OS security updates (unattended-upgrades)
  await execAsync('unattended-upgrade -v');
  
  // 2. PHP security updates
  for (const version of ['7.4', '8.0', '8.1', '8.2']) {
    await execAsync(`apt-get install -y --only-upgrade php${version}-*`);
  }
  
  // 3. WordPress core updates (for all sites)
  const sites = await getSitesList();
  for (const site of sites) {
    await execAsync(`wp core update --path=/var/www/${site}/htdocs`);
  }
  
  // 4. MariaDB minor version updates (with backup first)
  await backupAllDatabases();
  await execAsync('apt-get install -y --only-upgrade mariadb-server');
  
  // 5. Report update results to central hub
  reportUpdateStatus();
}
```

## Security Considerations

1. **Firewall Configuration**
   - UFW with restricted access
   - Fail2ban for brute force protection

2. **Database Hardening**
   - Automated secure password generation
   - Remote access restrictions
   - Regular security audits

3. **File Permissions**
   - WordPress hardened file ownership
   - PHP executed as restricted user

4. **SSL Implementation**
   - Auto-renewal of certificates
   - HSTS headers enabled
   - Strong cipher suites

## Monitoring & Maintenance

1. **Resource Monitoring**
   - CPU, memory, disk usage reporting
   - Process monitoring
   - Network traffic analysis

2. **WordPress Health**
   - Site availability checks
   - Database performance metrics
   - Plugin compatibility monitoring

3. **Log Management**
   - Centralized logging
   - Error pattern detection
   - Automated anomaly alerts

## Advantages Over WordOps/EasyEngine

1. **Predictable Updates**
   - Control exactly what gets updated when
   - Test updates in staging before production
   - Rollback capability for all components

2. **Better Performance Tuning**
   - Custom-optimized Nginx configs
   - PHP-FPM pool optimization
   - Database performance tuning

3. **Enhanced Security**
   - Reduced attack surface
   - Regular security audits
   - Controlled dependency management

4. **Simpler Maintenance**
   - Direct control over all components
   - No black-box management
   - Easier troubleshooting

## Implementation Timeline

1. **Phase 1: Core Infrastructure** (2 weeks)
   - Develop server provisioning scripts
   - Create site management commands
   - Build configuration templates

2. **Phase 2: Testing & Validation** (2 weeks)
   - Test on fresh servers
   - Performance benchmarking
   - Security testing

3. **Phase 3: Migration Plan** (2 weeks)
   - Develop migration process from WordOps
   - Create rollback procedures
   - Document operational processes

4. **Phase 4: Deployment** (1 week)
   - Deploy to production
   - Monitor and optimize
   - Train team on new procedures 