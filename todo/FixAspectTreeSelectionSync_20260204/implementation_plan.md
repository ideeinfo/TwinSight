# Implementation Plan - Fix Aspect Tree Selection Sync

## Task Description
Fix a bug in the Aspect Tree (RDS) where selecting a node in one system (e.g., "Weak Current Fire System") automatically selects a corresponding node in another system (e.g., "Lighting System"). This happens because the nodes share the same underlying object ID, and the tree component uses this ID as the unique key, causing unintended state synchronization.

## User Review Required
> [!IMPORTANT]
> The fix involves generating a unique `uitreeId` for each node in the frontend tree structure. This strictly separates the UI selection state of nodes even if they represent the same physical asset.

## Proposed Changes

### Frontend components

#### [AspectTreePanel.vue]
- Modify `loadTreeData` -> `processNodes` function:
    - Generate a unique `uitreeId` for every node using a combination of the original ID and a random string.
- Update `<el-tree-v2>` configuration:
    - Change `node-key` from `id` to `uitreeId`.
    - Update `treeProps` to use `uitreeId` as the value key (if applicable, though `node-key` is primary for selection).
- Update `handleNodeClick`:
    - Use `data.uitreeId` instead of `data.id` to toggle check state.
- `handleCheckChange`:
    - Keep collecting `node.id` for business logic (highlighting/tracing) to ensure downstream functions work with real object IDs.

## Verification Plan

### Manual Verification
1.  **Selection Independence**:
    - Open the RDS panel and switch to "Function" aspect.
    - Expand "Weak Current Fire System" and check a node (e.g., a detector).
    - Verify that the same detector under "Lighting System" is NOT automatically checked.
2.  **Highlighting Functionality**:
    - Select a node.
    - Click "Highlight in Model".
    - Verify that the correct component is highlighted in the viewer.
3.  **Search Functionality**:
    - Search for a specific code.
    - Verify filtering still works.
