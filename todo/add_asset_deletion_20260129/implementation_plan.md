# Implementation Plan - Asset Batch Deletion

The user wants to add a feature to delete assets from the Asset Panel. This involves batch deletion of selected assets.

## Proposed Changes

### Backend Model (`server/models/asset.js`)
- Add `deleteAssetsByDbIds(dbIds)` function to delete multiple assets by their `db_id`.
- Add `deleteAsset(assetCode)` function (it was missing but referenced in routes).
- Export these new functions.

### Backend Route (`server/routes/v1/assets.js`)
- Add POST `/batch-delete` endpoint to handle batch deletion requests.
    - Expects `{ dbIds: [...] }` in body.
    - Calls `deleteAssetsByDbIds`.

### Frontend Service (`src/services/postgres.js`)
- Add `deleteAssets(dbIds)` function to call the new API endpoint.

### Frontend Component (`src/components/AssetPanel.vue`)
- Track selected assets count/presence.
- In the panel header:
    - If assets are selected, show a "Delete" button (replacing "+ Create").
- Implement `handleDelete`:
    - Show confirmation dialog.
    - Call `deleteAssets`.
    - On success, emit `refresh` event (and clear selection).
    - Parent component needs to handle `refresh` to reload the list? Or `AssetPanel` manages its own loading?
    - `AssetPanel` receives `assets` as props (Step 190 Line 62). So it relies on Parent to update data.
    - I need to check `MainView.vue` or whoever uses `AssetPanel` to ensure it re-fetches data upon an event. I'll add an event emitting like `refresh-data`.

## Verification
- Select assets -> Verify "Delete" button appears.
- Click "Delete" -> Verify Confirmation Dialog.
- Confirm -> Verify API call and list refresh.
