# Projects Feature for Citrus Host

## Overview
The Projects feature would allow users to organize their servers and sites into logical groups. This would help users manage infrastructure for different clients, applications, or environments (dev, staging, production).

## Database Structure

### Projects Table
```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(20), -- For UI differentiation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
```

### Project-Server Relationship
```sql
CREATE TABLE project_servers (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  server_id VARCHAR(50) NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_project_servers_unique ON project_servers(project_id, server_id);
CREATE INDEX idx_project_servers_server_id ON project_servers(server_id);
```

### Project-Site Relationship
```sql
CREATE TABLE project_sites (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_project_sites_unique ON project_sites(project_id, site_id);
CREATE INDEX idx_project_sites_site_id ON project_sites(site_id);
```

## API Endpoints

### Projects

```
GET /api/projects
```
List all projects for the authenticated user.

```
POST /api/projects
```
Create a new project.
```json
{
  "name": "Client XYZ",
  "description": "All infrastructure for Client XYZ",
  "color": "#4f46e5"
}
```

```
GET /api/projects/:id
```
Get details for a specific project.

```
PUT /api/projects/:id
```
Update a project.

```
DELETE /api/projects/:id
```
Delete a project.

### Project Resources

```
POST /api/projects/:id/servers
```
Add servers to a project.
```json
{
  "server_ids": ["server-123", "server-456"]
}
```

```
DELETE /api/projects/:id/servers/:server_id
```
Remove a server from a project.

```
POST /api/projects/:id/sites
```
Add sites to a project.
```json
{
  "site_ids": [123, 456]
}
```

```
DELETE /api/projects/:id/sites/:site_id
```
Remove a site from a project.

```
GET /api/projects/:id/resources
```
Get all servers and sites associated with a project.

## Frontend Implementation

### Navigation
- Add a "Projects" item to the main navigation menu.

### Projects Page
- List view of all projects with:
  - Project name
  - Description
  - Number of servers/sites
  - Color indicator
  - Created date
  - Actions (Edit, Delete)
- "Create Project" button

### Project Details Page
- Project header with name, description, and color
- Tabs for:
  - Overview (summary stats)
  - Servers (list of servers in the project)
  - Sites (list of sites in the project)
  - Settings (edit project details)

### Server/Site Assignment
- In the Project Details page:
  - "Add Server" button that opens a modal with checkboxes for unassigned servers
  - "Add Site" button that opens a modal with checkboxes for unassigned sites
- In the Servers list:
  - Add a project dropdown in each server's row
- In the Sites list:
  - Add a project dropdown in each site's row

### Filtering
- Add project filter to the Servers page
- Add project filter to the Web Hosting page

## User Experience Enhancements

### Dashboard
- Update dashboard to show projects summary
- Group server/site metrics by project

### Resource Creation
- When creating a server or site, add an option to assign it to a project
- Provide a "Create new project" option in the dropdown

### Search and Filter
- Enable search functionality across projects
- Add project-based filtering to logs and monitoring

## Implementation Phases

### Phase 1: Core Functionality
- Database tables
- Basic API endpoints for CRUD operations
- Projects list page
- Project details page with servers and sites tabs

### Phase 2: Integration
- Update server and site creation forms to include project assignment
- Add project filters to server and site lists
- Implement project assignment modals

### Phase 3: UX Enhancements
- Dashboard integration
- Search functionality
- Bulk operations for project assignments

## Business Value
- Improved organization for users with many resources
- Better client management for agencies and hosting providers
- Clearer separation of development, staging, and production environments
- Ability to assign team members to specific projects (future feature) 