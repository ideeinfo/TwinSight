# Prompt 06: Manage / Facility Templates

```text
Page to generate: Manage / Facility Templates

Use the existing TwinSight UI design language.

Global application shell requirements:
- Add a top navigation bar with Home, Facilities, and Manage
- Manage is active on this page

Page purpose:
- Central management page for facility templates
- Used to bind properties to classification nodes and manage inheritance

Main layout:
- Top navigation
- Left-side Manage section navigation
- Facility Templates is active
- Main content title
- Template selector or template list
- Page-level workspace layout

Core workspace requirements:
- Use a split-pane layout
- Left side: classification tree
- Right side: property assignment panel
- The classification tree must support:
  - search
  - hierarchical indentation
  - badge counts showing direct assignments and effective totals
  - active or highlighted nodes
  - local actions like Copy to and Edit

Right panel requirements:
- Support an empty state for unassigned nodes
- Show a primary action button like "Assign Parameters"
- Show direct and inherited properties differently
- Support switching to a property-centric reverse assignment view

Assignment dialog requirements:
- Large modal
- Search, grouping, sorting, batch selection
- Feels like a serious enterprise picker, not a basic dropdown

Visual direction:
- Dark engineering workbench
- Dense but readable
- Strong operational clarity
- Compact split view similar to a real BIM or facility management admin console

Important behavior cues:
- Parent-assigned properties are inherited by child nodes
- Reverse property view should show one property assigned to multiple nodes
- Hover details can reveal additional assigned classification codes

Deliverable:
- Desktop-first template management workbench page
```
