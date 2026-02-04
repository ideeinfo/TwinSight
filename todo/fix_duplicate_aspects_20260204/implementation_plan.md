# Fix Broken Tree Structure (Missing Container Nodes)

## Goal Description
The previous fix for duplicate nodes was too aggressive. It prevented an object from claiming its ancestors (good) but also prevented it from creating its own "Container" aspect (bad). In the RDS hierarchy, `===A.B` (Child) links to `===A.` (Parent Container), which is owned by Object A.
By removing the expansion logic, Object A only created `===A` (Entity) and not `===A.` (Container). Thus, Object B's link to `===A.` became invalid (orphan), causing the tree to break or nodes to go missing.

This fix ensures every imported object creates both its **Entity Aspect** (e.g., `===A`) and **Container Aspect** (e.g., `===A.`), restoring the ability for children to link to it.

## User Review Required
> [!IMPORTANT]
> **Re-import Required**: As with the previous fix, you must **re-import** the Excel file (Clear Existing Data) for these structural changes to take effect.

## Proposed Changes

### Logic Engine

#### [MODIFY] [parse.py](file:///Volumes/DATA/antigravity/TwinSight/logic-engine/routers/parse.py)
- Update `import_excel` logic.
- After parsing the code (Step 1), check if it's an Entity (no trailing dot).
- If so, synthetically generate the corresponding **Container Aspect** (append `.`) and add it to the object's aspects.
- Ensure the Container Aspect points to the Entity Aspect as its parent.

## Verification
1. **Re-import**.
2. **Check Database**: Object "10KV..." should own `===OY1.AH1` AND `===OY1.AH1.`.
3. **Check Tree**: "AH5..." (owns `===...H01`) should successfully link to `===...AH1.` (owned by parent), and thus appear as a child of "10KV...".
