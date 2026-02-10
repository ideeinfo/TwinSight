
import pandas as pd
import sys

def analyze():
    file_path = "todo/RDS实施计划_20260131/MC数据20230620_NEW.xlsx"
    print(f"Reading file: {file_path}")
    
    try:
        # Load Excel
        dfs = pd.read_excel(file_path, sheet_name=None)
    except FileNotFoundError:
        # Try alternate path if running from root vs server
        file_path = "../" + file_path
        try:
             dfs = pd.read_excel(file_path, sheet_name=None)
        except Exception as e:
            print(f"Error loading file: {e}")
            return

    column_mapping = {
        '工艺功能': 'function',
        '位置': 'location', 
        '电源功能': 'power',
        'ProcessFunction': 'function',
        'Location': 'location',
        'PowerFunction': 'power'
    }

    print("\n--- Analzying '1回路' and 'AH1' for Multi-Column Data ---")
    
    for sheet_name, df in dfs.items():
        print(f"\nSheet: {sheet_name}")
        # Normalize columns (strip whitespace)
        df.columns = df.columns.str.strip()
        
        # Filter for target rows
        # Assumes Name column is '名称' or 'Name'
        name_col = '名称' if '名称' in df.columns else 'Name'
        if name_col not in df.columns:
            print(f"Skipping (No Name column found). Columns: {pd.Series(df.columns).tolist()}")
            continue
            
        target_rows = df[df[name_col].astype(str).str.contains('1回路|AH1', na=False)]
        
        if target_rows.empty:
            print("No matching rows found.")
            continue
            
        for idx, row in target_rows.iterrows():
            print(f"\nRow {idx} [{row[name_col]}]:")
            found_codes = []
            for col, type_ in column_mapping.items():
                if col in df.columns:
                    val = row[col]
                    if pd.notna(val) and str(val).strip():
                        print(f"  - Column '{col}' (Type: {type_}) = '{val}'")
                        found_codes.append((col, type_, str(val)))
            
            # Check for duplicates per type
            power_codes = [c for c in found_codes if c[1] == 'power']
            if len(power_codes) > 1:
                 print(f"  [ALERT] MULTIPLE POWER CODES FOUND! -> {power_codes}")

if __name__ == "__main__":
    try:
        analyze()
    except Exception as e:
        print(f"Fatal Error: {e}")
