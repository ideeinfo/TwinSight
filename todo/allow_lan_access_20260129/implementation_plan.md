# Implementation Plan - Expose Service to LAN

The user wants to access the locally running service from other computers on the LAN. Currently, the Vite frontend server defaults to `localhost`, and the backend CORS configuration restricts access to specific local origins.

## User Review Required

> [!IMPORTANT]
> This change will expose your development server to the local network. Ensure your network is trusted.

- **Complexity**: 3 (Routine configuration change)
- **Manual Action**: You will need to restart your terminal processes (`npm run dev`) for the changes to take effect.

## Proposed Changes

### Frontend (`vite.config.js`)

#### [Updated] `vite.config.js`
- Set `server.host` to `0.0.0.0` (via `host: true`) to listen on all network interfaces.

### Environment Configuration (`.env.development`, `.env.local`)

#### [Updated] `.env.development`
- Comment out `VITE_API_URL` to ensure the frontend uses the Vite Dev Server proxy (avoiding direct calls to `localhost:3001` which fail on remote devices).

#### [Updated] `.env.local`
- Comment out `VITE_API_URL` to avoid overriding the proxy behavior with a hardcoded IP.

### Backend (`server/index.js`)

#### [Updated] `server/index.js`
- Update `cors` configuration in development mode to allow dynamic origins (Reflect Origin), ensuring browsers on other devices can make API requests without CORS errors.

## Verification Plan

### Automated Tests
- None applicable for network binding.

### Manual Verification
1. Restart both frontend and backend servers.
2. Check the terminal output for the Network URL (e.g., `http://192.168.x.x:5173`).
3. Access this URL from another device.
4. Verify the login page loads AND login is successful (no CORS/connection errors).
