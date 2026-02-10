import sys
import os
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import uuid

# 设置路径以便导入 importer (logic-engine 目录下)
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
from services import importer

# 数据库连接
# 尝试从环境变量或 .env 读取，默认 postgres:postgres
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/twinsight')

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def run_import(file_id=6):
    print(f"Importing for file_id={file_id}...")
    
    # 1. 简单读取 Excel 为了获取 power aspects 数据
    # 假设文件就在某处，或者我们直接硬编码路径
    # 由于环境限制，我假设 MC_TEST.xlsx 在 todo/ 下 (Step 874 indicated it is untracked there)
    excel_path = '../todo/RDS实施计划_20260131/MC_TEST.xlsx'
    if not os.path.exists(excel_path):
        excel_path = '/Volumes/DATA/antigravity/TwinSight/todo/RDS实施计划_20260131/MC_TEST.xlsx'
        
    if not os.path.exists(excel_path):
        print(f"Excel file not found at {excel_path}")
        return

    print("Reading Excel...")
    dfs = pd.read_excel(excel_path, sheet_name=None, dtype=str)
    
    db = SessionLocal()
    try:
        # 2. 构建 object_id_map
        print("Building object_id_map from rds_objects...")
        obj_result = db.execute(text("SELECT id, ref_code, name FROM rds_objects"))
        object_id_map = {}
        for row in obj_result:
            if row.ref_code:
                # Map Asset Code -> Object ID
                object_id_map[row.ref_code.strip()] = str(row.id)
        
        print(f"Loaded {len(object_id_map)} objects from DB.")

        # 3. 准备 Power Aspects
        power_aspects = []
        df = dfs[list(dfs.keys())[0]] # First sheet
        for index, row in df.iterrows():
            code = str(row.get('电源功能', '')).strip()
            if code and code.startswith('==='):
                power_aspects.append({
                    'full_code': code,
                    'asset_code': str(row.get('设备编码', '')).strip(),
                    'name': str(row.get('名称', '')).strip() 
                })
        
        if not power_aspects:
            print("No power data found!")
            return

        print(f"Found {len(power_aspects)} power data entries")
        
        # 4. 清理旧数据 (Optional, importer uses upsert but better clean for graph structural changes)
        # 但是为了保留 manual fixes (if any), importer upserts.
        # 不过既然之前的 import 缺少 object_id，我们最好全量覆盖。
        # importer 是基于 full_code 的 UPSERT。
        # 设备节点的 full_code 是 DEVICE:xxx。
        # 如果我们现在有了 object_id，UPSERT 会更新它。
        # 
        # 但是，为了确保关系正确，我们可以先清空 edges。
        # db.execute(text("DELETE FROM rds_power_edges WHERE file_id = :fid"), {'fid': file_id})
        # db.execute(text("DELETE FROM rds_power_nodes WHERE file_id = :fid"), {'fid': file_id})
        # db.commit()
        # 
        # 让我们先试更安全的 UPSERT。
        
        print("Starting power graph creation...")
        stats = importer._create_power_graph_data(db, file_id, power_aspects, object_id_map)
        print(f"Stats: {stats}")
        
        db.commit()
        print("Done!")
    except Exception as e:
        print(f"Error during import: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_import()
