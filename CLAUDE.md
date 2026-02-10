# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TwinSight is an AI-native Digital Twin platform. Vue 3 + Vite frontend with Autodesk Forge Viewer integration, Express.js backend with PostgreSQL and InfluxDB for IoT time-series data.

## Development Commands

### Frontend
```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Production build
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix linting issues
```

### Backend
```bash
cd server
npm install          # Install dependencies
npm run dev          # Development mode with hot reload
npm run start        # Production mode
npm run db:init      # Initialize database schema
npm run db:seed      # Seed database with sample data
```

### Docker (Database & Services)
```bash
docker-compose up -d           # Start PostgreSQL, InfluxDB, Node-RED, n8n, OpenWebUI
docker compose logs -f         # View logs
docker compose down            # Stop services
```

## Architecture

### Frontend (src/)
- **Entry:** `index.html` loads Forge Viewer CDN → `src/main.js` → `src/App.vue`
- **Main view:** `src/AppViewer.vue` handles layout, panels, and Forge Viewer initialization
- **State:** Pinia stores in `src/stores/` (auth, assets, spaces, models, theme, iot, ui)
- **Composables:** `src/composables/` for viewer, IoT data, heatmap, timeline hooks
- **Components:** Feature-based in `src/components/` (layout, viewer, assets, charts, modals)
- **Services:** API clients in `src/services/` (postgres.js for backend calls)

### Backend (server/)
- **Entry:** `server/index.js` (Express app on port 3001)
- **Routes:** Use `server/routes/v1/` (preferred), legacy routes in `server/routes/` for compatibility
- **Services:** Business logic in `server/services/` (asset-service, space-service, auth-service, etc.)
- **Models:** Database CRUD in `server/models/`
- **Config:** Environment-driven in `server/config/` (supports DATABASE_URL for cloud deployment)
- **Schema:** `server/db/schema.sql` defines PostgreSQL tables

### API Pattern
- Endpoints: `/api/v1/{resource}` (assets, spaces, models, documents, ai, auth, users, timeseries)
- Routes delegate to services, services use models for DB access
- JWT authentication via middleware

### Key Integrations
- **Autodesk Forge Viewer:** 3D model visualization (CDN-loaded in index.html)
- **InfluxDB:** Time-series IoT data
- **Node-RED:** IoT data flows
- **n8n:** Workflow automation and AI analysis
- **OpenWebUI:** LLM interface

## Code Conventions

### Vue Components
- Use `<script setup>` syntax
- Local scoped CSS
- Follow existing component patterns in `src/components/`

### Forge Viewer
- Material caching: Store original materials in `roomFragData[fragId]` before modifications, restore with original object (never set to null)
- Resize handling: Use `window.dispatchEvent(new Event('resize'))` after panel changes
- Model path: `MODEL_URL` constant in viewer components points to `public/models/...`

### Backend
- Service layer pattern: `getResource()`, `getResourceById(id)`, `createResource(data)`, `updateResource(id, data)`, `deleteResource(id)`
- Database tables use snake_case, fields include `id`, `uuid`, `created_at`, `updated_at`

## Environment Setup

Development requires `.env.local` with:
- `VITE_API_URL=http://localhost:3001`
- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- InfluxDB: `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG`, `INFLUX_BUCKET`

Backend config in `server/config/` auto-detects `DATABASE_URL` (Railway) or individual env vars.

## Proxy Configuration

Vite dev server proxies:
- `/api` → `http://localhost:3001`
- `/influx` → `http://localhost:8086`

## File Storage

- Models: `public/models/`
- Documents: `public/docs/`
- Uploads: `public/files/`
- Time-series data: `public/data/`

## Adding Features

**New API endpoint:**
1. Create route in `server/routes/v1/{resource}.js`
2. Create service in `server/services/{resource}-service.js`
3. Create model in `server/models/{resource}.js`
4. Add route to `server/routes/v1/index.js`

**New Vue component:**
1. Create in `src/components/{feature}/`
2. Use `<script setup>` with TypeScript optional
3. Import in parent component or route

**Database migration:**
1. Add SQL file to `server/db/migrations/`
2. Run via `psql` or add to init script
