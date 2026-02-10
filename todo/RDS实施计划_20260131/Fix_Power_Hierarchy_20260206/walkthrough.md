# Walkthrough - Fix Power Hierarchy and Tracing

## Context
The user identified that the power network graph was missing connections, causing upstream tracing to stop prematurely. Specifically, the path from downstream devices (like pumps) back to the transformer and high-voltage incomers (DY2) was broken.

## Changes

### 1. `logic-engine/services/importer.py`

**Key Change**: Fixed the edge creation logic for existing nodes.

```python
# Before
if current_full_code in created_nodes:
    # ... set parent_node_id ...
    continue

# After
if current_full_code in created_nodes:
    existing_node_id = created_nodes[current_full_code]
    
    # Check and create edge if parent exists
    if parent_node_id:
        # ... logic to determine valid parent (handle entity refs) ...
        # INSERT INTO rds_power_edges ... ON CONFLICT DO NOTHING
```

**Key Change**: Handled Entity References (Trailing Dots).

-   Added `entity_reference_map` to map logical codes (e.g., `===DY2`) to their physical device nodes (e.g., `DEVICE:HSC0402`).
-   When creating a child node (e.g., `===DY2.AH12`), the code now looks up the parent in this map. If found, it connects the child to the **device node** instead of the logical node.
-   This creates a chain: `Source -> Device -> Child Logical Node -> Child Device ...`

### 2. `server/routes/rds.js`

**Key Change**: Increased Trace Default Depth.

```javascript
// Before
const { direction = 'upstream', maxDepth = 10 } = req.query;

// After
const { direction = 'upstream', maxDepth = 100 } = req.query;
```
This ensures that the deeper hierarchy resulting from the inserted device nodes is fully traversed.

## Verification

### 1. Data Import
Perfromed a manual import using the `MC_TEST.xlsx` file.
-   **Method**: Ran `importer._create_power_graph_data` via a local script (`run_import_manual.py`) connected to the **remote database** (192.168.2.183).
-   **Result**: 383 Nodes, 538 Edges created.

### 2. Path Verification (`server/scripts/check_dy2_path.js`)
Verified the critical path for `DY2`:

```
===DY2 -> DEVICE:HSC0402 [power_supply]
DEVICE:HSC0402 -> ===DY2.AH12 [hierarchy]
===DY2.AH12 -> DEVICE:HSC0202 [power_supply]
DEVICE:HSC0202 -> ===DY2.AH12.H02 [hierarchy]
...
===DY2.AH12.H02.ZB2.D1DP12 -> ...
```

The output confirms that the hierarchy is now fully connected via alternating `power_supply` and `hierarchy` edges, linking logical nodes to their physical counterparts.

## Conclusion
The power hierarchy is now correctly established in the database, and the tracing logic has been updated to handle the increased depth. A browser refresh should reflect these changes.
