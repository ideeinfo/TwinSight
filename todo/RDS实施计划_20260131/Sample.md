```python
import pandas as pd

# Read the CSV file to inspect its content
df = pd.read_csv('MC数据20230620.csv')

# Display the first few rows and column information
print(df.head())
print(df.info())



```

```text
                      名称                      工艺功能                                     电源功能 设备编码
0                弱电桥架3配件  =TA001.EY01.TY01.RF.UN08                                      NaN  NaN
1                  弱电桥架3      =TA001.EY01.TY01.QJ3                                      NaN  NaN
2        DP4-1 水泵软启柜 RQ1                       NaN        ===DY1.AH1.H01.ZB1.C1DP1.3.DP4O.1  NaN
3                 5#水泵电机                       NaN  ===DY2.AH12.H02.ZB2.D1DP12.3.DP9O.1.1.1  NaN
4  管理房双电源切换照明配电箱（常） SMX1                       NaN        ===DY1.AH1.H01.ZB1.C1DP1.3.DP3O.1  NaN
<class 'pandas.core.frame.DataFrame'>
RangeIndex: 838 entries, 0 to 837
Data columns (total 4 columns):
 #   Column  Non-Null Count  Dtype 
---  ------  --------------  ----- 
 0   名称      838 non-null    object
 1   工艺功能    626 non-null    object
 2   电源功能    449 non-null    object
 3   设备编码    358 non-null    object
dtypes: object(4)
memory usage: 26.3+ KB
None


```

```python
# Check non-null values for '设备编码'
print("Non-null '设备编码' examples:")
print(df[df['设备编码'].notnull()]['设备编码'].head(10))

# Sample rows where all columns might be populated
print("\nSample rows with multiple columns populated:")
print(df.dropna(subset=['工艺功能', '电源功能'], how='all').head(10))


```

```text
Non-null '设备编码' examples:
6     CCTV0103
17     AVA0101
19    BF01US06
21      WL0102
22     SDB0101
27      CP0105
29     SSL0202
30     EEL0101
31    MFAB0105
34      AF0102
Name: 设备编码, dtype: object

Sample rows with multiple columns populated:
                      名称                      工艺功能                                     电源功能      设备编码
0                弱电桥架3配件  =TA001.EY01.TY01.RF.UN08                                      NaN       NaN
1                  弱电桥架3      =TA001.EY01.TY01.QJ3                                      NaN       NaN
2        DP4-1 水泵软启柜 RQ1                       NaN        ===DY1.AH1.H01.ZB1.C1DP1.3.DP4O.1       NaN
3                 5#水泵电机                       NaN  ===DY2.AH12.H02.ZB2.D1DP12.3.DP9O.1.1.1       NaN
4  管理房双电源切换照明配电箱（常） SMX1                       NaN        ===DY1.AH1.H01.ZB1.C1DP1.3.DP3O.1       NaN
5           1#进水电动闸门 ZM1                       NaN   ===DY2.AH12.H02.ZB2.D1DP12.3.DP10O.1.1       NaN
6                   室内半球     =TA001.TB01.VS01.AF11                                      NaN  CCTV0103
7                     备用                       NaN     ===DY1.AH1.H01.ZB1.C1DP1.3.DP3O.6.N3       NaN
8               高压配电室照明1                       NaN     ===DY1.AH1.H01.ZB1.C1DP1.3.DP3O.1.N4       NaN
9                2#变温控电源                       NaN             ===DY2.AH12.H02.ZB2.D1DP12.2       NaN


```

```python
import pandas as pd
import json
import re

def build_hierarchy_from_csv(file_path):
    df = pd.read_csv(file_path)
    
    # Process Logic Tree
    process_tree = {}
    # Power Logic Tree
    power_tree = {}

    def add_to_tree(tree, code_str, row_info, prefix_len=1):
        if pd.isna(code_str):
            return
        
        # Remove prefix symbols (e.g., '=', '===')
        clean_code = code_str[prefix_len:]
        parts = clean_code.split('.')
        
        current = tree
        for i, part in enumerate(parts):
            if part not in current:
                current[part] = {"_data": {"full_code": code_str, "part": part}, "children": {}}
            
            # If it's the leaf node, add metadata
            if i == len(parts) - 1:
                current[part]["_data"].update({
                    "name": row_info['名称'],
                    "device_id": row_info['设备编码'] if pd.notna(row_info['设备编码']) else None
                })
            
            current = current[part]["children"]

    for _, row in df.iterrows():
        # Process Logic (starts with '=')
        if pd.notna(row['工艺功能']):
            add_to_tree(process_tree, str(row['工艺功能']), row, prefix_len=1)
        
        # Power Logic (starts with '===')
        if pd.notna(row['电源功能']):
            add_to_tree(power_tree, str(row['电源功能']), row, prefix_len=3)

    return {"process_logic": process_tree, "power_logic": power_tree}

# Generate the hierarchical structure
hierarchy = build_hierarchy_from_csv('MC数据20230620.csv')

# Save a sample to check structure
with open('logic_hierarchy.json', 'w', encoding='utf-8') as f:
    json.dump(hierarchy, f, ensure_ascii=False, indent=2)

print("Hierarchy built and saved to logic_hierarchy.json")
# Print a small snippet of the process logic tree
print(json.dumps(list(hierarchy['process_logic'].keys())[:5]))



```

```text
Hierarchy built and saved to logic_hierarchy.json
["TA001", "VALUE!", ""]


```

以下是为你定制的补充文档和 Python 转换脚本。

### 1. 补充文档：IEC/ISO 81346-12 编码规格与实例解析

这份文档可作为 AI Agent 的 `README_ENCODING.md` 或上下文 Prompt。

---

# 开发者参考：工程编码规格与逻辑映射 (IEC/ISO 81346-12)

## 1. 编码实例分析 (基于测试数据)

根据 `MC数据20230620.csv` 提取的真实编码示例，AI 代理在解析时应遵循以下逻辑：

### A. 工艺功能视图 (Process Function Aspect)

* **符号前缀：** `=` (单等号)
* **示例：** `=TA001.TB01.VS01.AF11` (名称：室内半球)
* **层级逻辑：** 采用 `.` 作为层级分隔符。
* `TA001`: 顶层设施/场站
* `TB01`: 子系统（如：安防系统）
* `VS01`: 功能单元（如：视频监控）
* `AF11`: 末端设备



### B. 电源逻辑视图 (Power Logic Aspect)

* **符号前缀：** `===` (三等号，项目特定变体)
* **示例：** `===DY1.AH1.H01.ZB1.C1DP1.3.DP3O.1.N4` (名称：高压配电室照明)
* **追溯逻辑：**
* `DY1`: 电源总入口
* `AH1`: 高压/低压配电柜
* `DP3O`: 馈线回路或分电箱
* 末端的 `.1.N4` 通常表示具体的接线端子或极数。



## 2. 核心关联逻辑

AI Agent 需要实现以下关联：

1. **交叉索引 (Cross-Referencing):** 当一个物理构件（BIM Model）被选中时，必须同时拉取其对应的 `=` 工艺编码和 `===` 电源编码，以展示其在工艺流程和供电网络中的双重位置。
2. **数据质量预警：** 原始数据中可能存在 `VALUE!` 或空值，Agent 在构建图谱时应跳过非法节点并输出异常报告。

---

### 2. Python 脚本：CSV 转 JSON 知识图谱

该脚本将扁平的 CSV 数据转换为层级嵌套的 JSON 结构，方便 AI Agent 进行递归查询和路径搜索。

```python
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

```

### 3. 如何给 AI Agent 使用？

1. **提供 JSON 文件：** 将生成的 `engineering_logic_map.json` 上传给 Agent。
2. **设定角色：** “你是一个精通 IEC 81346 的系统架构师。请参考 `engineering_logic_map.json` 中的树状结构，编写一个查询 API，输入设备编码 `CCTV0103`，返回其在工艺树和电源树中的完整路径。”

我已为你处理了 `MC数据20230620.csv` 并在后台生成了结构化映射。如果需要针对特定 BIM 软件（如 Revit/Navisworks）的插件逻辑，请告诉我。