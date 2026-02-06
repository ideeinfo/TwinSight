# RDS 电源功能 (Power) 网络化重构方案

## 目标
将 **电源功能 (Power Aspect, `===`)** 从当前"以对象为中心的树结构"重构为"以网络为中心的图结构"，以支持：
1.  双路供电等复杂拓扑
2.  单线图/拓扑图可视化
3.  供电路径追溯

**保持不变**：工艺功能 (`=`) 和位置 (`++`) 仍使用现有树结构逻辑。

---

## 用户审核项

> [!IMPORTANT]
> **破坏性变更**：电源功能将使用全新数据表 (`rds_power_nodes`, `rds_power_edges`)，与现有 `rds_aspects` 解耦。
> **导入逻辑分叉**：Excel 导入将对电源列使用图逻辑，对其他列使用树逻辑。
> **前端新增组件**：需要引入 AntV G6 并开发新的 `PowerNetworkGraph.vue`。

---

## 一、数据库层变更

### 新增迁移文件
#### [NEW] [009_rds_power_graph.sql](file:///Volumes/DATA/antigravity/TwinSight/server/migrations/009_rds_power_graph.sql)

创建电源网络专用图表：

```sql
-- 1. 电源网络节点表
CREATE TABLE IF NOT EXISTS rds_power_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,
    object_id UUID REFERENCES rds_objects(id) ON DELETE SET NULL, -- 关联物理设备 (可空)
    
    full_code VARCHAR(255) NOT NULL,       -- 完整编码 (===DY1.AH1)
    short_code VARCHAR(50) NOT NULL,       -- 短码 (AH1)
    label VARCHAR(255),                    -- 显示名称 (如 "10KV进线1 AH1")
    level INTEGER NOT NULL DEFAULT 1,      -- 层级深度
    node_type VARCHAR(50) DEFAULT 'device', -- 'source' | 'bus' | 'feeder' | 'device'
    
    properties JSONB,                      -- 扩展属性 (额定电流、电压等级等)
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(file_id, full_code)
);

-- 2. 电源网络边表 (关系)
CREATE TABLE IF NOT EXISTS rds_power_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id INTEGER REFERENCES model_files(id) ON DELETE CASCADE,
    source_node_id UUID REFERENCES rds_power_nodes(id) ON DELETE CASCADE,
    target_node_id UUID REFERENCES rds_power_nodes(id) ON DELETE CASCADE,
    
    relation_type VARCHAR(50) NOT NULL DEFAULT 'hierarchy', 
    -- 'hierarchy': 编码层级关系 (DY1 -> DY1.AH1)
    -- 'powers':    供电关系 (馈线柜 -> 水泵)
    
    properties JSONB,                      -- 边属性 (电缆规格、回路编号)
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_node_id, target_node_id, relation_type)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_power_nodes_file ON rds_power_nodes(file_id);
CREATE INDEX IF NOT EXISTS idx_power_nodes_code ON rds_power_nodes(full_code);
CREATE INDEX IF NOT EXISTS idx_power_edges_file ON rds_power_edges(file_id);
CREATE INDEX IF NOT EXISTS idx_power_edges_source ON rds_power_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_power_edges_target ON rds_power_edges(target_node_id);
```

---

## 二、后端 Logic Engine (Python)

### 修改导入服务
#### [MODIFY] [importer.py](file:///Volumes/DATA/antigravity/TwinSight/logic-engine/services/importer.py)

1.  **分叉处理**：`_create_aspects` 中判断 `aspect_type == 'power'` 时，调用新的 `_create_power_graph_data()` 方法。
2.  **新增方法 `_create_power_graph_data()`**：
    - 解析电源编码层级 (`===DY1.AH1.H01`)
    - 为每个层级创建 `rds_power_nodes` 记录
    - 创建 `rds_power_edges` (`hierarchy` 类型) 连接父子节点
    - 只有叶子节点关联 `object_id`

### 新增 Power 专用 API
#### [NEW] [power.py](file:///Volumes/DATA/antigravity/TwinSight/logic-engine/routers/power.py)

```python
@router.get("/graph/{file_id}")
async def get_power_graph(file_id: int, db: Session = Depends(get_db)):
    """获取电源网络图数据 (G6 格式)"""
    # 返回 { nodes: [...], edges: [...] } 格式
    pass

@router.get("/trace/{file_id}/{node_id}")
async def trace_power_path(file_id: int, node_id: str, direction: str = 'upstream'):
    """追溯供电路径 (上游或下游)"""
    pass
```

---

## 三、后端 Node.js Server

### 新增路由代理
#### [MODIFY] [rds.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/rds.js)

新增 API 端点：

```javascript
// GET /api/rds/power-graph/:fileId - 获取 G6 格式图数据
router.get('/power-graph/:fileId', async (req, res) => {
    // 直接查询 rds_power_nodes 和 rds_power_edges
    // 返回 { nodes: [...], edges: [...] }
});

// GET /api/rds/power-trace/:fileId/:nodeCode - 路径追溯
router.get('/power-trace/:fileId/:nodeCode', async (req, res) => {
    // 递归 CTE 或代理到 Logic Engine
});
```

---

## 四、前端 Vue

### 新增组件
#### [NEW] [PowerNetworkGraph.vue](file:///Volumes/DATA/antigravity/TwinSight/src/components/PowerNetworkGraph.vue)

使用 AntV G6 实现电源拓扑图：

```vue
<template>
  <div ref="graphContainer" class="power-network-graph"></div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import G6 from '@antv/g6';

// Props: fileId
// Emit: node-click

const graphContainer = ref(null);
let graph = null;

onMounted(() => {
  graph = new G6.Graph({
    container: graphContainer.value,
    layout: { type: 'dagre', rankdir: 'LR' },
    defaultNode: { type: 'rect' },
    defaultEdge: { type: 'polyline' },
    modes: { default: ['drag-canvas', 'zoom-canvas', 'click-select'] },
  });
});
</script>
```

### 修改 RDS 面板
#### [MODIFY] [AspectTreePanel.vue](file:///Volumes/DATA/antigravity/TwinSight/src/components/AspectTreePanel.vue)

1.  当 `aspectType === 'power'` 时，切换渲染 `<PowerNetworkGraph>` 而不是 `<el-tree>`。
2.  或：在 Tab 栏增加"电源拓扑"视图，与"电源树"并列。

### 新增依赖
#### [MODIFY] [package.json](file:///Volumes/DATA/antigravity/TwinSight/package.json)

```json
{
  "dependencies": {
    "@antv/g6": "^5.0.0"
  }
}
```

---

## 五、验证计划

### 自动化测试
1.  **数据库**：运行迁移 `009_rds_power_graph.sql`，验证表创建。
2.  **导入**：重新导入 Excel，验证 `rds_power_nodes` 和 `rds_power_edges` 数据正确。
3.  **API**：调用 `/api/rds/power-graph/:fileId`，验证返回 G6 格式数据。

### 手动验证
1.  打开前端，切换到"电源功能"。
2.  验证拓扑图正确渲染，层次清晰。
3.  点击节点，验证联动（如高亮 BIM 模型）。

---

## 六、实施步骤（时间线）

| 阶段 | 任务 | 预估时间 |
|------|------|----------|
| 1 | 创建 `009_rds_power_graph.sql` 并执行 | 30 分钟 |
| 2 | 修改 `importer.py`，新增图数据生成逻辑 | 2 小时 |
| 3 | 修改 `rds.js`，新增 `/power-graph` API | 1 小时 |
| 4 | 安装 G6，创建 `PowerNetworkGraph.vue` | 3 小时 |
| 5 | 修改 `AspectTreePanel.vue` 集成新组件 | 1 小时 |
| 6 | 测试验证 | 1 小时 |

**总计：约 8-10 小时**

---

## 后续扩展 (可选)

1.  **双路供电**：在 Excel 中增加"备用电源"列，导入时生成 `powers` 类型的边。
2.  **拓扑搜索**：实现 Dijkstra 或 BFS 算法查找任意两点间的供电路径。
3.  **实时状态**：集成 InfluxDB，在拓扑图上显示实时电流/电压。
