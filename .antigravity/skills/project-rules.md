---
name: project-rules
description: Enforces user-specific project rules, naming conventions, and environment constraints. MUST be used for every code generation or modification task.
---
# Project Rules & Standards

## 1. Environment & OS
- **OS**: Windows 11
- **Shell**: PowerShell (pwsh)
  - Use `$env:VAR = 'val'` for env vars.
  - Use `Get-ChildItem` etc.
  - Path separator: `\` (backward slash) or properly quoted strings.

## 2. Language & Interactions
- **Output Language**: Simplified Chinese (简体中文) for ALL responses, comments, docs, and commit messages.
- **Thinking Process**: You MUST display your thinking process in `<thought>` tags before acting.

## 3. Naming Conventions
### Frontend (JS/Vue)
- **Variables/Functions**: camelCase (e.g., `parentId`, `folderId`)
- **Components**: PascalCase (e.g., `DocumentManager`, `FilePanel`)

### Backend (Node.js)
- **Route Params/Body**: camelCase (e.g., `req.body.folderId`)
- **DB Interactions**: Convert to snake_case when talking to DB.

### Database (PostgreSQL)
- **Tables/Columns**: snake_case (e.g., `parent_id`, `file_name`)

## 4. Coding Standards
- **File Encoding**: UTF-8 always.
- **Frontend Libs**: Prefer **Element Plus** for UI.
- **Plan First**: Always update `implementation_plan.md` before major changes.
