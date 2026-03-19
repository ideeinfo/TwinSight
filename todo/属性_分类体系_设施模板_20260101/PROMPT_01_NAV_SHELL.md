# Prompt 01: Navigation Shell

以下内容建议作为所有登录后页面的第二段 prompt。

```text
Global application shell requirements:

- Add a top navigation bar that is visible on all authenticated product pages
- The top navigation contains exactly three primary entries:
  - Home
  - Facilities
  - Manage
- Place the product logo on the left
- Place the user menu on the right
- The active top-level navigation item must be visually highlighted

Information architecture:
- Home is the default page after login
- Home is used for system overview and choosing a facility
- Facilities is the page for creating, listing, editing, and managing facilities
- Manage is the page for managing properties, classification schemas, and facility templates
- Manage is not the facility workspace

Layout expectations:
- Desktop-first application shell
- Top navigation is slim and compact
- Main content area below the top navigation
- Use a practical product layout, not a hero-banner layout

Navigation behavior to reflect in the design:
- Home: selected when showing the system home page
- Facilities: selected when showing the facility list or a facility workspace
- Manage: selected when showing properties, classifications, or facility templates
```
