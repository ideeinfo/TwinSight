# Implementation Plan - Fix Power Hierarchy and Tracing

## Problem Analysis

The user reported issues with the power node hierarchy and upstream tracing:
1.  **Broken Hierarchy**: Intermediate edges were missing in the power graph (e.g., between `===DY2` and `===DY2.AH12`), preventing full path visualization.
2.  **Incomplete Trace**: Upstream tracing for "5#雨水泵 GK5" stopped at "0.4KV供电1" and did not reach the transformer or high-voltage components.
3.  **Remote Environment Sync**: The Logic Engine running on a remote server (192.168.2.183) seemed to be running outdated code, as fixes applied locally were not reflected in the data.

## Proposed Changes

### 1. Fix Edge Creation Logic (`logic-engine/services/importer.py`)
-   **Issue**: When processing hierarchical codes (e.g., `===DY2.AH12`), if the node already exists (from a previous partial import or order of operations), the code skipped creating the edge from the parent node.
-   **Fix**: Modified the loop to explicitly check for and create edges even if the node itself already exists. Prioritize `hierarchy` edges.

### 2. Handle Entity References (`logic-engine/services/importer.py`)
-   **Issue**: Codes ending with a dot (e.g., `===DY2.`) represent entity references (devices) rather than logical nodes. The hierarchy should connect to these devices where appropriate.
-   **Fix**: Introduced `entity_reference_map` to track the relationship between logical codes and their device node IDs. When creating children nodes, check this map to connect to the device node instead of the logical node if a mapping exists.

### 3. Increase Trace Depth (`server/routes/rds.js`)
-   **Issue**: Complex hierarchies with intermediate device nodes (injected via `entity_reference_map`) increased the path depth significantly. The default recursion depth (10) in the trace query was insufficient.
-   **Fix**: Increased the default `maxDepth` for power tracing from 10 to 100.

### 4. Data Remediation
-   **Issue**: Remote database contained incomplete graph data.
-   **Action**: Manually triggered a re-import of the `MC_TEST.xlsx` data using the local Logic Engine (with fixes) connected to the remote PostgreSQL database. This rebuilt the graph with correct edges.

## Verification Plan

### Automated Verification
-   **Script**: `server/scripts/check_dy2_path.js`
-   **Checks**:
    -   Verify existence of nodes along the `DY2` path.
    -   Verify existence of edges between these nodes.
    -   **Result**: Confirmed complex chain: `===DY2` -> `DEVICE:HSC0402` -> `===DY2.AH12` -> `DEVICE:HSC0202` -> ... -> `ZB2`.

### Manual Verification
-   **UI Trace**:
    -   Open the Power Network Graph in the frontend.
    -   Select "5#雨水泵 GK5" (or associated node).
    -   Click "Trace Upstream".
    -   **Expected**: The graph should now expand all the way to `===DY2` / `HSC0402` (High Voltage Incomer), passing through the transformer `ZB2`.

## Execution Status
-   [x] Code fixes applied to `importer.py`
-   [x] Code fixes applied to `rds.js`
-   [x] Remote data re-imported via local proxy
-   [x] Verification script confirmed edge existence
