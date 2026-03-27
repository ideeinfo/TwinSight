# RDS (Reference Designation System) API

## 概述

RDS API 实现 IEC 81346-12 工程数据管理接口，提供：
- 方面树数据查询（功能/位置/电源）
- 编码解析代理
- 拓扑追溯代理
- BIM 模型联动
- 电源网络图分析

## 核心概念

### 方面 (Aspects)

IEC 81346-12 定义了三种主要方面：

| 方面类型 | 代码 | 用途 |
|----------|------|------|
| 功能方面 | `=` | 按功能分解系统 |
| 位置方面 | `+` | 按物理位置分解 |
| 电源方面 | `-` | 按电源连接分解 |

### 对象与编码

- **Object** - 物理或逻辑设备/组件
- **Aspect** - 对象在特定方面的编码表示
- **Full Code** - 完整层级编码，如 `=A1.B2.C3`
- **Parent Code** - 父级编码，用于构建树形结构

## API 端点

### 方面树查询

#### GET `/api/rds/tree/:fileId`

获取指定文件的方面树数据。

**参数:**
- `aspectType` - 方面类型 (`function`/`location`/`power`)
- `level` - 最大层级深度（可选）

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "=A1",
      "parent_code": null,
      "aspect_type": "function",
      "level": 1,
      "name": "主配电系统",
      "bim_guid": "xxx-xxx",
      "has_children": true
    }
  ],
  "total": 100
}
```

#### GET `/api/rds/tree/:fileId/hierarchy`

获取层级化的方面树结构（已构建父子关系）。

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "=A1",
      "name": "主配电系统",
      "level": 1,
      "aspectType": "function",
      "bimGuid": "xxx",
      "mcCode": "MC-A1",
      "refCode": "REF-A1",
      "children": [
        {
          "id": 2,
          "code": "=A1.B1",
          "name": "变压器",
          "children": []
        }
      ]
    }
  ],
  "total": 100
}
```

### 编码解析

#### POST `/api/rds/parse/code`

解析单个 RDS 编码。

**请求体:**
```json
{
  "code": "=A1.B2.C3"
}
```

代理转发到 Logic Engine 服务。

#### POST `/api/rds/parse/hierarchy`

展开编码层级。

**请求体:**
```json
{
  "code": "=A1",
  "maxLevel": 3
}
```

### 拓扑追溯

#### POST `/api/rds/topology/trace`

执行拓扑追溯查询。

**请求体:**
```json
{
  "startNode": "=A1.B1",
  "direction": "upstream",
  "maxDepth": 5
}
```

### BIM 联动

#### GET `/api/rds/bim/:fileId/lookup/:guid`

通过 BIM GUID 反向查找 RDS 对象。

**响应:**
```json
{
  "success": true,
  "data": {
    "object_id": 1,
    "ref_code": "MC-A1",
    "object_type": "transformer",
    "name": "变压器",
    "aspects": [
      { "aspectType": "function", "fullCode": "=A1", "level": 1 },
      { "aspectType": "location", "fullCode": "+B1", "level": 1 }
    ]
  }
}
```

#### GET `/api/rds/bim/:fileId/guids`

获取指定方面编码下的所有 BIM GUID。

**参数:**
- `code` - 方面编码
- `aspectType` - 方面类型（可选）
- `includeChildren` - 是否包含子节点 (`true`/`false`)

**用途:**
- 模型高亮
- 模型隔离
- 选择集联动

### 数据导入

#### POST `/api/rds/import/:fileId`

上传 Excel 并导入到数据库。

**参数:**
- `clearExisting` - 是否清除现有数据 (`true`/`false`)
- `createRelations` - 是否创建关系 (`true`/`false`)

**请求:**
- Content-Type: `multipart/form-data`
- Body: 文件字段 `file`

#### DELETE `/api/rds/import/:fileId`

清除指定文件的 RDS 数据。

#### GET `/api/rds/import/:fileId/stats`

获取 RDS 数据统计信息。

## 电源网络图

### GET `/api/rds/power-graph/:fileId`

获取电源网络图数据（AntV G6 格式）。

**参数:**
- `nodeType` - 过滤节点类型 (`source`/`bus`/`feeder`/`device`)
- `maxLevel` - 最大层级深度
- `noCache` - 跳过缓存 (`true`/`false`)

**响应:**
```json
{
  "success": true,
  "nodes": [
    {
      "id": 1,
      "label": "主电源",
      "code": "-PS1",
      "shortCode": "PS1",
      "level": 1,
      "nodeType": "source",
      "style": { "fill": "#ff6b6b" }
    }
  ],
  "edges": [
    {
      "id": 1,
      "source": 1,
      "target": 2,
      "type": "power_supply"
    }
  ],
  "stats": {
    "totalNodes": 50,
    "totalEdges": 48
  }
}
```

**节点类型颜色:**
- `source` - 红色 (#ff6b6b) - 电源
- `bus` - 橙色 (#ffa94d) - 母线
- `feeder` - 绿色 (#69db7c) - 馈线柜
- `device` - 蓝色 (#74c0fc) - 设备

### GET `/api/rds/power-trace/:fileId/:nodeCode`

追溯电源路径（上游或下游）。

**参数:**
- `direction` - `upstream` (供电来源) 或 `downstream` (供电目标)
- `maxDepth` - 最大追溯深度（默认 100）

**响应:**
```json
{
  "success": true,
  "startNode": { "id": 10, "full_code": "-B1", "label": "母线" },
  "direction": "upstream",
  "path": [10, 5, 1],
  "nodes": [...],
  "edges": [...]
}
```

**用途:**
- 故障定位
- 影响范围分析
- 供电可靠性评估

## 缓存策略

电源图数据使用内存缓存：

```javascript
// 缓存配置
const POWER_GRAPH_CACHE_TTL_MS = 60000; // 60 秒

// 缓存键：fileId（仅缓存完整图）
// 带过滤条件（nodeType/maxLevel）的查询不走缓存
```

## 依赖服务

### Logic Engine

编码解析和拓扑追溯功能代理到 Python Logic Engine：

```bash
LOGIC_ENGINE_URL=http://localhost:8000
```

Logic Engine 提供：
- IEC 81346-12 编码解析
- 层级展开算法
- 拓扑追溯算法

## 数据库表

### rds_objects
存储 RDS 对象信息。

### rds_aspects
存储对象的方面编码。

### rds_power_nodes
电源网络图节点（冗余表，优化查询性能）。

### rds_power_edges
电源网络图边关系。
