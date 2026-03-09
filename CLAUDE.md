# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TwinSight is an AI-native Digital Twin platform. Vue 3 + Vite + TypeScript frontend with Autodesk Forge Viewer integration, Express.js backend with PostgreSQL (pgvector) and InfluxDB for IoT time-series data. Uses Element Plus for UI components and vue-i18n for internationalization (zh/en).

## Development Commands

### Frontend
```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint (flat config)
npm run lint:fix     # Auto-fix linting issues
```

### Backend
```bash
cd server
npm install          # Install dependencies
npm run dev          # Development mode with hot reload (--watch)
npm run start        # Production mode (runs migrations first)
npm run db:init      # Initialize database schema
npm run db:seed      # Seed database with sample data
```

### Docker (Infrastructure)
```bash
docker-compose up -d           # Start PostgreSQL, InfluxDB, Node-RED, n8n, OpenWebUI, Logic Engine
docker compose logs -f         # View logs
docker compose down            # Stop services
```

Service ports: PostgreSQL (5432), InfluxDB (8086), Node-RED (1880), n8n (5678), OpenWebUI (3080), Logic Engine (8000)

## Architecture

### Frontend (src/)
- **Entry:** `index.html` loads Forge Viewer CDN → `src/main.js` → `src/App.vue`
- **Router:** Vue Router with routes: `/` (Home), `/viewer` (AppViewer), `/assets`, `/theme-debug`, `/chart-view`
- **Main view:** `src/AppViewer.vue` handles layout, panels, and Forge Viewer initialization
- **State:** Pinia stores in `src/stores/` (auth, ui, models, assets, spaces, iot)
- **Composables:** `src/composables/` exports: useAppState, useViewer, useIoTData, useSelection, useTimeline
- **Components:** Feature-based in `src/components/` (ai/, config/, viewer/, icons/)
- **Types:** TypeScript interfaces in `src/types/` (asset, model, space, property, auth, api)
- **i18n:** `src/i18n/` for Chinese/English translations

### Backend (server/)
- **Entry:** `server/index.js` (Express app on port 3001)
- **Routes v1:** `server/routes/v1/` - assets, spaces, models, documents, ai, auth, users, timeseries, system-config
- **Routes v2:** `server/routes/v2/` - documents (extended document management)
- **Legacy routes:** `server/routes/` for backwards compatibility
- **Services:** Business logic in `server/services/` (asset-service, space-service, auth-service, config-service, etc.)
- **Models:** Database CRUD in `server/models/`
- **Config:** Environment-driven in `server/config/` (supports DATABASE_URL for cloud deployment)

### API Pattern
- v1 Endpoints: `/api/v1/{resource}` (assets, spaces, models, documents, ai, auth, users, timeseries, system-config)
- v2 Endpoints: `/api/v2/documents`
- Health check: `/api/v1/health` (includes DB connection test)
- Routes delegate to services, services use models for DB access
- JWT authentication via middleware

### Key Integrations
- **Autodesk Forge Viewer:** 3D model visualization (CDN-loaded in index.html)
- **InfluxDB 2.x:** Time-series IoT data
- **Node-RED:** IoT data flows (port 1880)
- **n8n:** Workflow automation and AI analysis (port 5678)
- **OpenWebUI:** LLM interface with RAG support (port 3080)
- **Logic Engine:** IEC 81346 encoding parser and topology analysis (port 8000)

## Code Conventions

### Frontend
- Vue 3 `<script setup>` syntax (TypeScript optional but recommended)
- Path alias: `@/` maps to `src/`
- Element Plus components wrapped with el-config-provider for i18n
- Local scoped CSS in components

### Forge Viewer
- Material caching: Store original materials in `roomFragData[fragId]` before modifications, restore with original object (never set to null)
- Resize handling: Use `window.dispatchEvent(new Event('resize'))` after panel changes
- Model path: `MODEL_URL` constant in viewer components points to `public/models/...`
- CDN globals: `Autodesk` and `THREE` are readonly globals (configured in eslint.config.js)

### Backend
- Service layer pattern: `getResource()`, `getResourceById(id)`, `createResource(data)`, `updateResource(id, data)`, `deleteResource(id)`
- Database tables use snake_case, fields include `id`, `uuid`, `created_at`, `updated_at`
- ESM modules (`"type": "module"` in package.json)

## Environment Setup

Development requires `.env.local` or `.env.development` with:
- `VITE_API_URL=http://localhost:3001`
- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` or `DATABASE_URL`
- InfluxDB: `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG`, `INFLUX_BUCKET`

Backend config auto-detects `DATABASE_URL` (Railway/cloud) or individual env vars.

## Proxy Configuration

Vite dev server proxies:
- `/api` → `http://127.0.0.1:3001`
- `/influx` → `http://localhost:8086`

## File Storage

- Models: `public/models/`
- Documents: `public/docs/`
- Uploads: `public/files/`
- Avatars: `public/avatars/`
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
1. Add SQL file to `server/db/migrations/` or script to `server/scripts/`
2. Run via `psql` or add to init script

## Documentation

Detailed project documentation is available in `.qoder/repowiki/zh/content/` covering:
- System overview and architecture
- API reference (all endpoints documented)
- Frontend architecture and component system
- Backend architecture and middleware
- Database design and migrations
- Deployment guides
