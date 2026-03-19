# Prompt 05: Manage / Classifications

```text
Page to generate: Manage / Classifications

Use the existing TwinSight UI design language.

Global application shell requirements:
- Add a top navigation bar with Home, Facilities, and Manage
- Manage is active on this page

Page purpose:
- Central management page for classification schemas
- Used to import, preview, browse, and manage classification systems

Main layout:
- Top navigation
- Left-side Manage section navigation
- Classifications is active
- Main content header with page title
- Primary action button such as "Import Classification"
- Search and filter controls
- Main content supports two possible views:
  - schema list
  - schema detail

Schema list requirements:
- Show schema name
- version number
- node count
- template reference count
- update time

Schema detail requirements:
- Support a tree view and a flat table view
- Show import preview and validation results
- Include clear row-level error presentation for invalid uploads

Design direction:
- Enterprise admin page
- Dense and structured
- Strong hierarchy between list level and detail level
- Tree view should feel compact and operational, not decorative

Important interaction cues:
- Import is a two-step flow: preview first, then confirm
- Uploaded classification data should feel auditable and structured

Deliverable:
- Desktop-first admin page for managing classification schemas
```
