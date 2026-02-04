# Fix Duplicate Nodes in RDS Aspect Tree

## Goal Description
The "Power Function Tree" currently displays the same object multiple times (e.g., "AH5柜出线" appears 3 times). This is because the data import logic assigns not just the object's specific code (e.g., `===OY1.AH1.H01`) to the object, but also all its generated ancestor codes (e.g., `===OY1.AH1`, `===OY1.AH1.`) if they are not already claimed by other objects.

This change ensures that an imported object is **only** associated with the exact aspect code defined in the Excel file. It prevents the object from "masquerading" as its own ancestors or structural container nodes.

## User Review Required
> [!IMPORTANT]
> **Re-import Required**: This fix applies to **new** imports. To fix existing data (like "AH5柜出线"), you must re-import the Excel file after applying this patch (using the "Clear Existing" option).
>
> **Tree Structure**: If your Excel file is missing rows for parent objects (e.g., you have `===A.B` but no row defining `===A`), the tree might appear flat or fragmented because the intermediate node `===A` will no longer be automatically created and linked to the child. To ensure a proper tree, ensure parent objects are defined in the Excel file.

## Proposed Changes

### Logic Engine

#### [MODIFY] [parse.py](file:///Volumes/DATA/antigravity/TwinSight/logic-engine/routers/parse.py)
- Change `import_excel` function.
- Replace `parser.expand_hierarchy(str(code))` loop with `parser.parse_code(str(code))`.
- Only append the single, specific aspect code to `obj.aspects`.

## Verification Plan

### Automated Tests
- None valid for this specific data logic without the source Excel.

### Manual Verification
1. **User Action**: Re-import the `@MC数据20230620_NEW.xlsx` file.
2. **Check**: Open the "Power" ("电源") tab in the RDS Tree.
3. **Expectation**: "AH5柜出线" should appear **only once** (under its correct parent if the parent exists).
4. **Database Check**: Run `node server/scripts/debug_ah5.js` again. It should show only 1 row for 'power' aspect (the leaf code).
