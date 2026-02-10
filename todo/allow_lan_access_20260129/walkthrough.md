# Walkthrough - Expose Service to LAN

I have updated the configuration files to allow access to the service from other computers on your local network.

## Changes

### 1. Vite Configuration (`vite.config.js`)
- Added `host: true` to the `server` configuration. This tells Vite to listen on all network interfaces (0.0.0.0) instead of just localhost.

### 2. Environment Variables (.env.development / .env.local)
- Commented out `VITE_API_URL`.
- **Reason**: The previous configuration pointed `VITE_API_URL` to `http://localhost:3001` or a specific IP. When accessed from a remote device, `localhost` fails (because the API isn't on the phone!), and a specific IP can be fragile.
- **Fix**: By removing this variable, the frontend defaults to `window.location.origin` (relative paths). The requests are then sent to the Vite Dev Server (e.g., `http://192.168.x.x:5173/api/...`), which proxies them to the backend (`localhost:3001`). This works perfectly for all devices on the LAN.

### 3. Backend CORS (`server/index.js`)
- Updated the CORS configuration for development mode. Instead of checking against a fixed list of `allowedOrigins` (which only included localhost), it now dynamically accepts any origin. This ensures that when you access the app via a LAN IP (e.g., `http://192.168.1.5:5173`), the backend will accept the API requests.

## How to Verify

1.  **Restart Servers**: You must restart your development servers for these changes to take effect.
    - Stop the current `npm run dev` processes (Ctrl+C).
    - Run `npm run dev` again in both the root and `server/` directories.
2.  **Check Terminal Output**: When Vite starts, it should now show a "Network" URL, for example:
    ```
    ➜  Local:   http://localhost:5173/
    ➜  Network: http://192.168.1.10:5173/
    ```
3.  **Access from Another Device**: define
    - Use your phone or another computer connected to the same WiFi.
    - Visit the Network URL shown in your terminal.
    - Verify that the application loads and you can view data (which confirms the backend API connection is working).
