# Implementation Plan - RDS Dot Syntax Hierarchy

## Goal
Update the RDS code parsing logic to correctly handle the IEC 81346 dot syntax, where a trailing dot (e.g., `A.`) represents a container node that is the parent of `A.B` and the child of `A`.

## User Review Required
> [!NOTE]
> This change affects how the RDS tree is built. Existing data might need to be re-imported to reflect correct hierarchy if the hierarchy logic was previously different.

## Proposed Changes

### Logic Engine (Python)

#### [MODIFY] [logic-engine/services/iec_parser.py](file:///Volumes/DATA/antigravity/TwinSight/logic-engine/services/iec_parser.py)
- Update `parse_code` method:
    - Change `parent_code` logic:
        - If code ends with `.`: parent is code minus `.`.
        - If code does not end with `.`: parent is code up to last segment + `.`.
    - Change `hierarchy_level` logic:
        - `level = count('.') * 2 + 1`
        - If trailing dot, `level -= 1`.
- Update `expand_hierarchy` method:
    - Update iteration to generate intermediate dot-ending nodes.

#### [MODIFY] [logic-engine/services/importer.py](file:///Volumes/DATA/antigravity/TwinSight/logic-engine/services/importer.py)
- Update `_get_parent_power_code` function to match the new parent logic.
    - `A.B` -> Parent `A.`
    - `A.` -> Parent `A`

### Documentation
#### [MODIFY] [todo/RDS实施计划_20260131/IEC-81346.md](file:///Volumes/DATA/antigravity/TwinSight/todo/RDS实施计划_20260131/IEC-81346.md)
- Update documentation to reflect the correct understanding of dot syntax and hierarchy.

## Verification Plan
1.  **Unit Test (Manual)**: Run a python script to verify `parse_code` outputs correct parent and level for `...3`, `...3.`, and `...3.DP8O`.
2.  **Import Test**: Re-import usage data (if available) or verify code logic correctness.
