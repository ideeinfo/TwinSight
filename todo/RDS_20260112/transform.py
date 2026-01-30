import pandas as pd
import json
import os

def csv_to_hierarchy(file_path, output_json):
    """
    将包含 IEC 81346 编码的 CSV 转换为层级 JSON 结构
    """
    df = pd.read_csv(file_path)
    
    # 初始化树结构
    hierarchy = {
        "process_tree": {}, # 存储 = 开头的工艺逻辑
        "power_tree": {}    # 存储 === 开头的电源逻辑
    }

    def add_to_tree(root, code_str, name, device_id, prefix_len):
        if pd.isna(code_str) or code_str == "VALUE!":
            return
        
        # 移除前缀并按点号拆分层级
        clean_code = str(code_str)[prefix_len:]
        parts = clean_code.split('.')
        
        current = root
        for i, part in enumerate(parts):
            if not part: continue # 跳过空部分
            
            if part not in current:
                current[part] = {
                    "metadata": {"part": part, "depth": i},
                    "children": {}
                }
            
            # 在叶子节点挂载详细信息
            if i == len(parts) - 1:
                current[part]["metadata"].update({
                    "full_code": code_str,
                    "name": name,
                    "device_id": device_id if pd.notna(device_id) else None
                })
            
            current = current[part]["children"]

    # 遍历 CSV 数据
    for _, row in df.iterrows():
        # 处理工艺功能 (=)
        if pd.notna(row['工艺功能']):
            add_to_tree(hierarchy["process_tree"], row['工艺功能'], row['名称'], row.get('设备编码'), 1)
        
        # 处理电源功能 (===)
        if pd.notna(row['电源功能']):
            add_to_tree(hierarchy["power_tree"], row['电源功能'], row['名称'], row.get('设备编码'), 3)

    # 保存为 JSON
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(hierarchy, f, ensure_ascii=False, indent=2)
    
    print(f"转换完成！层级数据已保存至: {output_json}")

if __name__ == "__main__":
    csv_to_hierarchy('MC数据20230620.csv', 'engineering_logic_map.json')