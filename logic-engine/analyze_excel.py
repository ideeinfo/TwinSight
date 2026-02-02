
import pandas as pd
import os

file_path = "/Volumes/DATA/antigravity/TwinSight/todo/RDS实施计划_20260131/MC数据20230620_完整.xlsx"

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

print(f"Analyzing {file_path}...")

try:
    df = pd.read_excel(file_path)
    print(f"Total rows: {len(df)}")
    print("Columns:", df.columns.tolist())
    
    # Inspect specific row 814 (adjust for 0-index: 812 or 813?)
    # iloc is 0-indexed. Row 814 in metadata usually means 0-indexed if I saved idx.
    # Let's check a range around 814.
    print("\n--- Inspecting Row 814 ---")
    if len(df) > 814:
        print(df.iloc[814])

    func_col = next((c for c in df.columns if '工艺功能' in str(c) or 'Process' in str(c) or 'Function' in str(c)), None)
    
    if name_col and func_col:
        switches = df[df[name_col].astype(str).str.contains("一位单控暗开关", na=False)]
        print(f"\nFound {len(switches)} switches.")
        print("Sample Data (Name | Function | DeviceCode):")
        # Ensure columns exist
        cols = [name_col, func_col]
        dev_col = next((c for c in df.columns if '设备编码' in str(c) or 'Device' in str(c)), None)
        if dev_col: cols.append(dev_col)
        print(switches[cols].head(10))
        
        # Check if codes are actually short
        short_codes = switches[switches[func_col].astype(str).str.strip() == '=TA001.EY01']
        print(f"\nSwitches with EXACT code '=TA001.EY01': {len(short_codes)}")
    
    # 3. Analyze potential RefCode collisions
    print("\nRefCode Analysis:")
    # Replicate logic
    ref_codes = []
    
    for idx, row in df.iterrows():
        # raw value logic simulation
        def clean(val):
            return str(val).strip() if pd.notna(val) else ""

        name = clean(row.get('名称', ''))
        code = clean(row.get('设备编码', ''))
        
        if code.lower() == 'nan': code = ""
        if name.lower() == 'nan': name = ""
        
        if code:
            ref = code
        elif name:
            ref = f"{name}_Sheet1_{idx}"
        else:
            ref = None
            
        if ref:
            ref_codes.append(ref)
            
    print(f"Total processed refs: {len(ref_codes)}")
    unique_refs = set(ref_codes)
    print(f"Unique refs: {len(unique_refs)}")
    if len(ref_codes) - len(unique_refs) > 0:
        from collections import Counter
        print(f"Total Duplicate count: {len(ref_codes) - len(unique_refs)}")
        c = Counter(ref_codes)
        print("Duplicate details (Code: Count):")
        for k, v in c.items():
            if v > 1:
                print(f"  {k}: {v}")

            
except Exception as e:
    print(f"Error: {e}")
