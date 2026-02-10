import pandas as pd
import json
import os

# 设定输入和输出文件名
input_csv = 'MC数据20230620_完整.csv'
output_json = 'engineering_data_full.json'

def build_full_hierarchy(csv_path, json_path):
    print(f"正在读取文件: {csv_path} ...")
    
    # 读取CSV文件
    try:
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        print(f"❌ 错误: 找不到文件 '{csv_path}'")
        print("请确认 CSV 文件和本脚本在同一个文件夹内。")
        return

    # 初始化三个视图的根节点
    hierarchy = {
        "process_aspect": {},   # 工艺视图 (=)
        "location_aspect": {},  # 位置视图 (++)
        "power_aspect": {}      # 电源视图 (===)
    }

    # 递归构建树函数
    def add_to_tree(root, code_str, name, device_id, prefix_len):
        # 数据清洗
        if pd.isna(code_str) or str(code_str).strip() == "" or "VALUE!" in str(code_str):
            return
        
        # 移除前缀并处理层级
        clean_code = str(code_str).strip()[prefix_len:].strip('.')
        if not clean_code: return
        
        parts = clean_code.split('.')
        current = root
        
        for i, part in enumerate(parts):
            if not part: continue
            
            if part not in current:
                current[part] = {
                    "metadata": {"part": part, "depth": i},
                    "children": {}
                }
            
            # 叶子节点写入详细信息
            if i == len(parts) - 1:
                current[part]["metadata"].update({
                    "full_code": code_str,
                    "name": name,
                    "device_id": device_id if pd.notna(device_id) else None
                })
            
            current = current[part]["children"]

    # 遍历数据
    count = 0
    for _, row in df.iterrows():
        count += 1
        # 工艺功能 (=)
        if pd.notna(row.get('工艺功能')):
            add_to_tree(hierarchy["process_aspect"], row['工艺功能'], row['名称'], row.get('设备编码'), 1)
        
        # 位置 (++, +)
        if pd.notna(row.get('位置')):
            loc_str = str(row['位置'])
            p_len = 2 if loc_str.startswith('++') else (1 if loc_str.startswith('+') else 0)
            add_to_tree(hierarchy["location_aspect"], row['位置'], row['名称'], row.get('设备编码'), p_len)
            
        # 电源功能 (===)
        if pd.notna(row.get('电源功能')):
            add_to_tree(hierarchy["power_aspect"], row['电源功能'], row['名称'], row.get('设备编码'), 3)

    # 写入 JSON
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(hierarchy, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 转换完成！处理了 {count} 行数据。")
    print(f"📄 文件已保存为: {os.path.abspath(json_path)}")

if __name__ == "__main__":
    build_full_hierarchy(input_csv, output_json)