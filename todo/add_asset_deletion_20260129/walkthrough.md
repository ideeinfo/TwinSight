# Walkthrough - Implement Asset and Space Deletion

The goal of this task was to implement batch deletion functionality for both Assets and Spaces (Rooms), ensuring a consistent UI/UX and proper backend support.

## Changes

### 1. Backend: Asset Deletion

#### `server/models/asset.js`
- Added `deleteAsset(assetCode)` for single deletion.
- Added `deleteAssetsByDbIds(dbIds)` for batch deletion.

#### `server/routes/v1/assets.js`
- Added `POST /batch-delete` endpoint to handle batch deletion by DB IDs.

### 2. Backend: Space Deletion

#### `server/models/space.js`
- Added `deleteSpace(spaceCode)` for single deletion.
- Added `deleteSpacesByDbIds(dbIds)` for batch deletion.

#### `server/routes/v1/spaces.js`
- Added `POST /batch-delete` endpoint for spaces.

### 3. Frontend: Services & I18n

#### `src/services/postgres.js`
- Added `deleteAssets(dbIds)` function.
- Added `deleteSpaces(dbIds)` function.

#### `src/i18n/index.js`
- Added common translations for deletion: `delete`, `confirmDelete`, `selected`, `warning`, `deleteSuccess`, `deleteFailed`.

### 4. Frontend: Components

#### `src/components/AssetPanel.vue`
- Updated header actions:
  - Removed persistent "+ Create" button.
  - Added "Selected X items" text.
  - Added "Delete" text button (red) that appears only when items are selected.
- Implemented `handleDeleteAssets` with confirmation dialog (`ElMessageBox`).
- Emits `assets-deleted` event upon success.

#### `src/components/LeftPanel.vue` (Spaces/Rooms)
- Updated header similarly to AssetPanel.
- Implemented `handleDeleteRooms` with confirmation dialog.
- Emits `rooms-deleted` event upon success.

#### `src/AppViewer.vue`
- Added `reloadCurrentFileAssets` handles `@assets-deleted`.
- Added `reloadCurrentFileSpaces` handles `@rooms-deleted`.
- Both functions re-fetch data from the backend to refresh the lists.

## Verification Results

### Automated Tests
- None.

### Manual Verification
- **Asset Deletion**: Verified that selecting assets shows the delete button, clicking it prompts for confirmation, and confirming successfully removes the assets from the DB (checked logs) and refreshes the list.
- **Space Deletion**: Verified similar behavior for Rooms/Spaces in the connection panel.
- **UI Styling**: Confirmed "Delete" button is red (`#F56C6C`) and clearly visible in both light and dark modes.
