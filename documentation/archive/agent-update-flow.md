# Citrus Agent Update Flow

This document outlines the process for tracking and updating Citrus Agent versions on remote servers.

## System Components

1. **Citrus Commander (Backend)** - Initiates and manages updates
2. **Engine Hub** - Relays update commands to agents
3. **Citrus Agent** - Runs on servers and executes git pull updates

## Update Process Flow

```
┌─────────────────┐         ┌────────────────┐         ┌──────────────┐
│                 │         │                │         │              │
│  Admin Panel    │────────▶│  Commander     │────────▶│  Engine Hub  │
│  (Update Button)│         │  (Backend)     │         │              │
│                 │◀────────│                │◀────────│              │
└─────────────────┘         └────────────────┘         └──────────────┘
                                                               │
                                                               │
                                                               ▼
                                                        ┌──────────────┐
                                                        │              │
                                                        │  Agent       │
                                                        │              │
                                                        └──────────────┘
                                                               │
                                                               │
                                                               ▼
                                                        ┌──────────────┐
                                                        │              │
                                                        │  Git Repo    │
                                                        │              │
                                                        └──────────────┘
```

## Version Tracking

1. **Git Version Checking**
   - Agent runs `git rev-parse HEAD` at startup and with each status update
   - Git commit hash is stored as `gitVersion` in status reports
   - Commander stores this in the `git_version` column of `agents` table

2. **Version Display**
   - Admin panel shows the first 7 characters of the git hash
   - Helps identify which agents need updates

## Update Methods

### 1. Manual Update via Admin Panel

1. **Initiation**
   - Admin clicks the "Update" button next to an agent
   - Frontend sends request to `/api/admin/agents/{id}/update`
   - Backend's `engineService.updateAgent(id)` sends update command

2. **Command Processing**
   - Agent receives `update_agent` command via WebSocket
   - `handleUpdateAgent` method is called
   - Agent sends "update_operation" with "starting" status

3. **Update Execution**
   - Agent runs `git pull` command to get latest code
   - New git version is checked after pull
   - Agent sends update completion status with new git hash
   - Database is updated with new version

### 2. Future Implementation: Automatic Updates

- GitHub webhook to notify of new commits
- Commander broadcasts updates to all agents
- Scheduled maintenance window updates
- Rolling updates to minimize downtime

## Implementation Details

### 1. Agent Update Handler

```javascript
async handleUpdateAgent(message) {
  try {
    this.send({
      type: 'update_operation',
      status: 'starting'
    });
    
    console.log('Updating agent from git...');
    
    // Pull latest changes from git
    const { stdout, stderr } = await execAsync('git pull');
    
    if (stderr && !stderr.includes('Already up to date')) {
      throw new Error(`Git pull error: ${stderr}`);
    }
    
    // Get the new git version
    await this.getGitVersion();
    
    this.send({
      type: 'update_operation',
      status: 'completed',
      gitVersion: this.gitVersion,
      output: stdout
    });
    
    console.log('Agent updated successfully');
  } catch (error) {
    console.error('Error updating agent:', error);
    this.send({
      type: 'update_operation',
      status: 'failed',
      error: error.message
    });
  }
}
```

### 2. Backend Update Endpoint

```typescript
// Update an agent
router.post('/agents/:id/update', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if agent exists
    const agentCheck = await db.query(`
      SELECT id, name FROM agents WHERE id = $1
    `, [id]);
    
    if (agentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Send update command to agent
    engineService.updateAgent(id);
    
    res.json({ success: true, message: 'Update command sent to agent' });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});
```

## Future Enhancements

1. Add pre-update health checks
2. Implement automatic rollback on failed updates
3. Add version tracking beyond git hashes
4. Support for scheduled updates 