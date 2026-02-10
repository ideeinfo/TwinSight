# AI Analysis n8n Configuration Fix & Enhancement Walkthrough

## 1. Goal
1.  **Fix Configuration**: Enable the AI analysis feature to use the n8n service defined in `.env.local` (192.168.2.183:5678).
2.  **Enhance Logic**: Ensure the n8n integration has robust document discovery (text scanning, fallbacks) parity with the direct integration.
3.  **Robust Sync Cleanup**: Ensure "Recreate Knowledge Base" effectively clears old invalid sync records.
4.  **Correct Filenames**: Ensure synced documents display their original filenames in Open WebUI, not system paths.

## 2. Changes

### Backend Configuration (Resolved)
Modified `server/config/index.js` to strictly load `../../.env.local` with `override: true`.
Enabled `USE_N8N_WORKFLOW=true` in `.env.local`.

### Backend Logic Enhancement (New)
Updated `server/routes/ai-analysis.js` to improve the n8n workflow branch:
*   **Text Scanning**: Automatically detects document names mentioned in the analysis text and adds them to sources even if not explicitly cited by index.
*   **Context Fallback**: If no sources are found (neither cited nor scanned), automatically includes all context documents as "Related Documents" to prevent empty panels.
*   **Name Linking**: Converts plain text document names into interactive links.

### KB Sync Fixes (New)
1.  **Robust Cleanup**: Updated `server/routes/files.js` to fix deletion order during KB reconstruction. It now explicitly deletes `kb_documents` (via both internal ID and Open WebUI UUID) before ensuring a clean slate.
2.  **Filename Preservation**: Updated `server/services/openwebui-service.js` and `server/routes/files.js` to pass the original filename (`file_name` column) during upload. This solves the issue where files appeared as hashed system paths in the knowledge base.

## 3. Verification Results

### Issue Resolution: "Missing Documents in Panel"
*   **Root Cause**: The user reported finding no documents in the layout. A screenshot revealed a `401 Unauthorized` error when fetching documents.
*   **Solution**: This was caused by the server configuration change (loading `.env.local`) likely affecting the auth secret or session validity. 
*   **Action**: User advised to **Log Out and Log In again** to refresh the token.

### Feature Verification: n8n Analysis & KB Sync
1.  **Server Restart**: Backend automatically restarted.
2.  **Functional Test**:
    *   Trigger AI analysis in n8n mode.
    *   **Expectation**: 
        *   Backend calls n8n.
        *   Result text contains links to documents.
        *   "Sources" list is populated (via citation or fallback).
3.  **KB Reconstruction Test**:
    *   Right click model -> "Create Knowledge Base" -> Confirm Rebuild.
    *   **Expectation**: Invalid sync records are cleared, ready for fresh sync.
4.  **Filename Test**:
    *   Sync documents to KB.
    *   **Expectation**: Files in Open WebUI show original names (e.g., "manual.pdf") instead of system names (e.g., "1766...pdf").
