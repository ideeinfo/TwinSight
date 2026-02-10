# Implementation Plan - Frontend URL Hardcoding Removal

## Problem
The frontend codebase currently contains hardcoded references to `http://localhost:3001` (and potentially other local URLs) as fallback values for API endpoints. This limits the application's ability to be deployed in different environments (e.g., staging, production, or accessing via LAN IP) without strictly setting environment variables at build time, and makes the code less robust.

## Proposed Changes
1.  **Identify Hardcoded URLs**: Search the codebase for `http://localhost:3001`, `http://127.0.0.1:3001`, and `http://localhost`.
2.  **Refactor API Base URL Logic**: Replace the hardcoded string `'http://localhost:3001'` with `window.location.origin` in strict fallback scenarios where `import.meta.env.VITE_API_URL` is falsy.
    -   This ensures that if the environment variable is missing, the app defaults to the origin it is served from, which is the correct behavior for relative API paths or same-origin deployments.
3.  **Update Services and Components**: Apply this change consistently across all identified files:
    -   `src/services/http.ts`
    -   `src/services/auth.ts`
    -   `src/services/ai-analysis.ts`
    -   `src/services/postgres.js`
    -   `src/services/influx.ts`
    -   `src/api/llm-config.ts`
    -   `src/AppViewer.vue`
    -   `src/components/*.vue` (where applicable)
4.  **Verify Configuration**: Ensure `.env.local` remains correctly configured for local development (`VITE_API_URL=http://localhost:3001`) to support the proxy setup.

## Verification Plan
### Automated Verification
-   Run `grep` searches to ensure no instances of `http://localhost:3001` remain in the `src` directory (excluding comments/placeholders if strictly necessary).
-   Verify code compilation (run `npm run dev` check if possible, though currently running).

### Manual Verification
-   **Local Dev**: Ensure the app still connects to the backend (via `.env.local` or proxy).
-   **Build/Deploy**: If `VITE_API_URL` is unset, the app should try to connect to `window.location.origin/api/...`.
