# 文档自动关联逻辑优化 - 实施计划

## 目标
优化文档上传时的自动关联逻辑。目前的逻辑主要依赖严格的正则表达式提取编码，导致匹配率过低。
根据用户反馈，将引入宽松的匹配策略：**只要资产/空间/规格的编码、编号或名称与文件名有连续 4 个及以上字符的重合，即判定为关联。**

## 变更分析

### 现有逻辑
- `server/services/document-matching-service.js`
- `matchFileName` -> `extractCodes` (正则) -> `matchByCode` (全等查询)
- `matchByName` 目前返回空数组 (已禁用)

### 提议变更
1.  **启用并重写 `matchByName`**:
    - 接收预处理后的文件名 tokens。
    - 筛选长度 >= 4 的 tokens。
    - 在数据库中搜索 `Code` 或 `Name` 包含这些 tokens 的记录 (ILIKE 查询)。
    - 计算置信度 (基于重合长度，给予 60-85 分，低于精确匹配)。
    - 限制返回结果数量，避免匹配过多无关对象。

2.  **调整 `matchFileName`**:
    - 在调用 `matchByCode` 之后，调用 `matchByName`。
    - 合并两者结果。

## 详细设计

### 1. Token 提取与筛选
复用 `preprocessFileName`。
在 `matchByName` 中过滤：`const searchTokens = tokens.filter(t => t.length >= 4);`

### 2. 数据库查询
对每个 token (或批量)，执行类似以下的查询：

```sql
SELECT ... FROM assets 
WHERE asset_code ILIKE '%token%' OR name ILIKE '%token%'
```

为提高性能，可以限制 LIMIT，比如每个 token 最多匹配 5 个结果。

### 3. 置信度计算
- 精确代码匹配: 90-100 (现有)
- 模糊子串匹配:
    - 这里的逻辑比较简单，统一给一个较低但有效的置信度，例如 70。
    - 如果 token 长度非常长 (e.g. > 8)，可以提高置信度。

## 验证计划

### 自动化测试 (脚本)
编写一个简单的测试脚本 `scripts/test-matching.js`：
1.  模拟文件名列表 (e.g. "AHU001_维保记录.pdf", "会议室MeetingRoom_01.jpg").
2.  调用 `matchFileNames`.
3.  打印匹配结果，验证是否命中预期目标。

### 手动验证
1.  上传一个文件名仅包含部分名称的文件 (e.g. "消防泵房巡检.pdf"，对应空间名 "消防泵房")。
2.  确认关联推荐中出现了 "消防泵房"。
