# Walkthrough - Frontend URL Hardcoding Removal

## Overview
This refactor replaced hardcoded `http://localhost:3001` fallback URLs with `window.location.origin` throughout the frontend codebase. This change improves the application's portability and allows it to function correctly when deployed to environments where the backend is hosted on the same origin but potentially different domains or IPs, without relying solely on build-time environment variables.

## Changes

### Services Refactor
The following service files were updated to use `window.location.origin` as the default `API_BASE`:

-   `src/services/http.ts`: Central HTTP service.
-   `src/services/auth.ts`: Authentication service.
-   `src/services/ai-analysis.ts`: AI analysis service.
-   `src/services/influx.ts`: InfluxDB integration service.
-   `src/services/postgres.js`: PostgreSQL data service.
-   `src/api/llm-config.ts`: LLM configuration API.

**Before:**
```javascript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

**After:**
```javascript
const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
```

### Components Refactor
Several Vue components that defined their own local `API_BASE` constant were also updated:

-   `src/AppViewer.vue`: Main application viewer.
-   `src/components/MainView.vue`: 3D viewer integration.
-   `src/components/RightPanel.vue`: Properties panel.
-   `src/components/ViewsPanel.vue`: Saved views management.
-   `src/components/PanoCompareView.vue`: Panorama comparison view.
-   `src/components/FilePanel.vue`: File management panel.
-   `src/components/InfluxConfigPanel.vue`: InfluxDB configuration.
-   `src/components/DocumentManager.vue`: Document management system.
-   `src/components/DocumentList.vue`: Document listing.
-   `src/components/DocumentPreview.vue`: Document preview modal.
-   `src/components/DocumentAssociationDialog.vue`: Document association dialog.

### Configuration Verification
-   Verified that `.env.local` is correctly configured for local development:
    ```properties
    VITE_API_URL=http://localhost:3001
    ```
    This ensures that local development continues to work via the Vite proxy as intended.

### Code Quality
-   Cleaned up an empty CSS ruleset in `src/components/DocumentManager.vue`.

## Verification Results
-   **Static Analysis**: `grep` search for `http://localhost:3001` in strictly source code files returns no results.
-   **Linting**: Fixed a minor CSS linting issue found during the process.
