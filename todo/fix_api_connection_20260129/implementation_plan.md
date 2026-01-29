# Implementation Plan - Fix API Connection Issues

The user reports that the "Test Connection" functionality in the Data Export Panel is failing. This is likely due to the recent network configuration changes where `VITE_API_URL` was removed, relying on the Vite proxy.

## Proposed Changes

### Vite Configuration (`vite.config.js`)

#### [Updated] `vite.config.js`
- Change proxy target from `http://localhost:3001` to `http://127.0.0.1:3001`.
- **Reason**: Node.js v17+ may resolve `localhost` to IPv6 (`::1`), while the backend server listens on IPv4 (`0.0.0.0`). This mismatch causes the proxy to fail with `ECONNREFUSED`. Using the explicit IPv4 loopback address fixes this.

### Frontend Service (`src/services/postgres.js`)

#### [Updated] `src/services/postgres.js`
- Update `checkApiHealth` function to:
    1.  Log specific errors to the console (instead of silently catching).
    2.  Add a fallback mechanism to check `/api/health` if `/api/v1/health` fails.

## Verification

### Manual Verification
1.  Save changes.
2.  Wait for Vite to auto-restart (or manually restart `npm run dev` if needed).
3.  Refresh the Data Export Panel page.
4.  Verify that the connection status badge shows "Connected" (green).
5.  Check browser console for any "API Health Check" logs.
