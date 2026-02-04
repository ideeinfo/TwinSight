# Duplicate Aspect Fix Walkthrough

## Changes Implemented
I have modified the Logic Engine's Excel import parser to prevent duplicate aspect entries.

### Backend Logic
- **File**: `logic-engine/routers/parse.py`
- **Change**: Replaced `expand_hierarchy` with `parse_code` during object import.
- **Effect**: Now, when an object is imported from Excel, it is ONLY assigned the specific aspect code defined in the cell (e.g., `===OY1.AH1.H01`), rather than generating and assigning all its parent codes (e.g., `===OY1.AH1`) to the same object ID.

## Verification Steps

### 1. Re-import Excel Data (Required)
The fix only applies to *new* imports. You must re-import your data to clean up the existing duplicates.
1. Go to the **Model Management** or **Data Import** page in your application.
2. Select the file, e.g., `@MC数据20230620_NEW.xlsx`.
3. Ensure the option **Clear Existing Data** (or similar) is checked.
4. Click **Import**.

### 2. Verify in UI
1. Open the **Reference Designation System (RDS)** panel.
2. Switch to the **Power** (===) view.
3. Search for "AH5".
4. **Success Criteria**: "AH5柜出线" should appear **only once** in the tree structure.

### 3. Verify in Database (Optional)
I have created a debug script to verify the data in the database.

Run the following command in your terminal:
```bash
node server/scripts/debug_ah5.js
```

**Expected Output (After Re-import):**
- **Objects**: Should find 1 object for "AH5柜出线".
- **Aspects**: Should verify that the object has only *one* Power aspect (e.g., `===DY1.AH1.H01`), and potentially one Location aspect, but *not* multiple Power aspects representing the parent hierarchy.

> [!NOTE]
> If you run the script *before* re-importing, you will still see the duplicate aspects (multiple 'power' rows for the same object ID).
