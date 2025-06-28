# Backup Subscription System

## Overview

The backup subscription system has been redesigned to provide better control over backup management. Users can purchase backup subscriptions through the plan page, but backups are not automatically enabled on servers. Instead, users manually enable backups on individual servers.

## Key Features

### 1. **Subscription-Based Backups**
- Users purchase backup subscriptions through the upgrade/plan page
- Backup subscriptions are created in the database but do not auto-enable backups
- Users must manually enable backups on each server they want backed up

### 2. **Server-Level Control**
- New `backups_enabled` column in servers table (boolean, defaults to false)
- Servers are created with backups disabled by default
- Users enable/disable backups per server through the UI

### 3. **Simple Logic Flow**
1. **Purchase**: User buys backup subscription → Database record created
2. **Deploy**: New servers are created with `backups_enabled = false`
3. **Enable**: User manually enables backups → Check subscription → Call Digital Ocean API → Set `backups_enabled = true`

## Database Changes

### New Column: `servers.backups_enabled`
```sql
ALTER TABLE servers 
ADD COLUMN backups_enabled BOOLEAN DEFAULT false;
```

- **Type**: Boolean
- **Default**: false
- **Purpose**: Track if backups are enabled for each individual server

## API Changes

### Server Creation
- All new servers are created with `backups_enabled = false`
- Even if user has backup subscription, servers start disabled

### Backup Toggle Endpoint
**POST** `/api/servers/:id/toggle-backups`

**Logic**:
1. Check if user has active backup subscription for server plan type
2. If enabling and no subscription → Return error
3. Call Digital Ocean API to enable/disable backups
4. Update `backups_enabled` flag in database

**Request**:
```json
{
  "enable": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Backups enabled successfully",
  "server_id": "123",
  "backups_enabled": true
}
```

### Subscription Webhook Changes
- Backup subscription purchases create database records only
- No automatic backup enabling on existing servers
- Users manually enable backups when needed

## User Experience

### 1. **Purchase Backup Subscription**
- User upgrades plan and selects backup addon
- Subscription created in database
- No immediate changes to existing servers

### 2. **Enable Backups on Server**
- User goes to server dashboard
- Clicks "Enable Backups" on server card
- System checks for valid backup subscription
- If valid: Enables backups via Digital Ocean API
- Server shows as "Backups Enabled"

### 3. **New Server Deployment**
- User deploys new server
- Server created with `backups_enabled = false`
- User must manually enable backups if desired

## Benefits

1. **Simple Logic**: Clear separation between subscription and server-level enablement
2. **User Control**: Users decide which servers need backups
3. **Cost Efficiency**: Backups only enabled where needed
4. **Clear Status**: Database accurately reflects backup state per server
5. **No Auto-Enabling**: Prevents unwanted backup costs on test servers

## Implementation Status

✅ **Completed**:
- Added `backups_enabled` column to servers table
- Updated server creation to default backups to false  
- Modified backup toggle logic to check subscription first
- Updated webhook to create subscription records only
- Updated add-backup-addon endpoint

⏳ **Next Steps**:
- Run database migration
- Test backup subscription flow
- Update frontend to show backup status per server 