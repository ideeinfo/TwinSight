# 电源拓扑节点悬浮面板增强 - 实施计划

## 1. 目标与背景

### 目标
增强电源拓扑图节点的悬浮面板（Tooltip），在鼠标悬停时显示该节点关联对象的**所有方面编码**（工艺功能、位置、电源功能），而不仅仅是当前的电源编码。

### 背景
当前悬浮面板仅显示：
- 节点标签/短码
- 电源编码（fullCode）
- 节点类型

用户需要在一个节点上快速查看其关联对象的完整 IEC 81346-12 多维度编码信息。

### 预期效果
```
┌─────────────────────────────────────┐
│  💡 AH5柜出线                        │
├─────────────────────────────────────┤
│  类型：设备                          │
│  设备编码：HSC0101                   │
├─────────────────────────────────────┤
│  = 功能编码：=TA001.BJ01.GP02        │
│  ++ 位置编码：++B1-1F.R01.C05        │
│  === 电源编码：===DY1.AH1.H01.ZB1... │
└─────────────────────────────────────┘
```

---

## 2. 用户审查事项

> [!NOTE]
> **数据来源说明**
> - 电源图节点通过 `object_id` 字段关联到 `rds_objects` 表
> - 方面编码存储在 `rds_aspects` 表中，通过 `object_id` 关联
> - 部分层级节点（如母线、馈线）可能没有关联的 `rds_objects`，这些节点将只显示电源编码

> [!IMPORTANT]
> **性能考虑**
> - 方案 A（推荐）：在加载电源图时一次性查询所有节点的方面编码，存入节点数据
> - 方案 B（备选）：悬浮时 API 动态查询（会有延迟，用户体验较差）
> - 本计划采用方案 A

---

## 3. 变更计划

### 阶段一：后端 API 增强

---

#### [MODIFY] [server/routes/rds.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/rds.js)

修改 `GET /api/rds/power-graph/:fileId` 接口，为关联了 `object_id` 的节点查询并返回所有方面编码。

**修改内容**：

在节点查询语句中添加子查询，获取关联对象的所有方面编码：

```javascript
// 位置：约第 524-540 行，修改节点查询

let nodeQuery = `
    SELECT 
        pn.id,
        pn.full_code as code,
        pn.short_code,
        pn.parent_code,
        pn.label,
        pn.level,
        pn.node_type as type,
        pn.object_id,
        o.bim_guid,
        o.ref_code as mc_code,
        o.name as object_name,
        -- 新增：查询关联对象的所有方面编码
        (
            SELECT json_agg(json_build_object(
                'aspectType', a.aspect_type,
                'fullCode', a.full_code,
                'prefix', a.prefix,
                'level', a.hierarchy_level
            ) ORDER BY a.aspect_type, a.hierarchy_level DESC)
            FROM rds_aspects a 
            WHERE a.object_id = pn.object_id
        ) as aspects
    FROM rds_power_nodes pn
    LEFT JOIN rds_objects o ON pn.object_id = o.id
    WHERE pn.file_id = $1
`;
```

**修改节点格式化输出**（约第 574-589 行）：

```javascript
const nodes = nodeResult.rows.map(row => ({
    id: row.id,
    label: row.label || row.short_code,
    code: row.code,
    shortCode: row.short_code,
    parentCode: row.parent_code,
    level: row.level,
    nodeType: row.type,
    objectId: row.object_id,
    bimGuid: row.bim_guid,
    mcCode: row.mc_code,
    objectName: row.object_name,
    // 新增：方面编码数组
    aspects: row.aspects || [],
    // G6 特有属性
    style: {
        fill: getNodeColor(row.type),
    }
}));
```

---

### 阶段二：前端 Tooltip 增强

---

#### [MODIFY] [src/components/PowerNetworkGraph.vue](file:///Volumes/DATA/antigravity/TwinSight/src/components/PowerNetworkGraph.vue)

**修改 1：增强模板中的 Tooltip 结构**（约第 28-33 行）

```vue
<!-- 悬浮提示 -->
<div v-show="tooltip.show" class="graph-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
  <div class="tooltip-header">
    <span class="tooltip-icon">{{ getNodeIcon(tooltip.data?.nodeType) }}</span>
    <span class="tooltip-title">{{ tooltip.data?.label || tooltip.data?.shortCode }}</span>
  </div>
  
  <div class="tooltip-section">
    <div class="tooltip-row" v-if="tooltip.data?.nodeType">
      <span class="label">类型:</span> {{ getNodeTypeLabel(tooltip.data.nodeType) }}
    </div>
    <div class="tooltip-row" v-if="tooltip.data?.mcCode">
      <span class="label">设备编码:</span> {{ tooltip.data.mcCode }}
    </div>
  </div>
  
  <!-- 新增：方面编码区域 -->
  <div class="tooltip-section aspects" v-if="tooltip.data?.aspects?.length">
    <div class="section-title">方面编码</div>
    <div class="tooltip-row aspect-row" v-for="aspect in getGroupedAspects(tooltip.data.aspects)" :key="aspect.fullCode">
      <span class="aspect-prefix" :class="aspect.aspectType">{{ aspect.prefix }}</span>
      <span class="aspect-code">{{ aspect.fullCode }}</span>
    </div>
  </div>
  
  <!-- 如果没有方面编码但有电源编码，显示电源编码 -->
  <div class="tooltip-section" v-else-if="tooltip.data?.code">
    <div class="tooltip-row">
      <span class="label">电源编码:</span> {{ tooltip.data.code }}
    </div>
  </div>
</div>
```

**修改 2：添加辅助方法**（在 script 部分添加）

```javascript
// 获取节点图标
const getNodeIcon = (type) => {
    return NODE_ICONS[type] || NODE_ICONS.default;
};

// 获取分组后的方面编码（每种类型只取最具体的一个）
const getGroupedAspects = (aspects) => {
    if (!aspects || !Array.isArray(aspects)) return [];
    
    // 按 aspectType 分组，每组取 hierarchy_level 最高的（最具体的）
    const grouped = {};
    aspects.forEach(a => {
        const type = a.aspectType;
        if (!grouped[type] || a.level > grouped[type].level) {
            grouped[type] = a;
        }
    });
    
    // 按固定顺序返回：function, location, power
    const order = ['function', 'location', 'power'];
    return order
        .filter(t => grouped[t])
        .map(t => grouped[t]);
};
```

**修改 3：添加 Tooltip 样式**（在 style 部分添加）

```css
/* 增强 Tooltip 样式 */
.tooltip-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #444;
}

.tooltip-icon {
    font-size: 16px;
}

.tooltip-title {
    font-weight: bold;
    color: #40a9ff;
    font-size: 13px;
}

.tooltip-section {
    margin-top: 6px;
}

.tooltip-section.aspects {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px dashed #333;
}

.section-title {
    font-size: 11px;
    color: #666;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.aspect-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 3px 0;
}

.aspect-prefix {
    font-family: monospace;
    font-weight: bold;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
    min-width: 28px;
    text-align: center;
}

.aspect-prefix.function {
    background: rgba(82, 196, 26, 0.2);
    color: #52C41A;
}

.aspect-prefix.location {
    background: rgba(250, 173, 20, 0.2);
    color: #FAAD14;
}

.aspect-prefix.power {
    background: rgba(255, 77, 79, 0.2);
    color: #FF4D4F;
}

.aspect-code {
    font-family: monospace;
    color: #ccc;
    font-size: 12px;
    /* 过长时截断 */
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
```

---

## 4. 验证计划

### 手动验证

1. **启动服务**
   ```bash
   cd server && npm run dev
   cd .. && npm run dev
   ```

2. **打开电源拓扑图页面**
   - 导航到 RDS 面板
   - 切换到电源拓扑视图

3. **验证 Tooltip 显示**

   | 节点类型 | 预期显示 |
   |---------|----------|
   | 末端设备节点 | 应显示设备编码 + 所有方面编码（功能、位置、电源） |
   | 层级节点（无 object_id） | 应只显示电源编码 |
   | 母线节点 | 应显示类型 + 电源编码 |

4. **验证样式**
   - 方面编码前缀应有对应颜色标识
   - 长编码应正确截断显示省略号

### API 验证

```bash
# 检查 API 返回的节点数据是否包含 aspects 字段
curl "http://localhost:3000/api/rds/power-graph/1" | jq '.nodes[0]'
```

预期输出示例：
```json
{
  "id": "xxx",
  "label": "AH5柜出线",
  "nodeType": "device",
  "mcCode": "HSC0101",
  "aspects": [
    { "aspectType": "function", "fullCode": "=TA001.BJ01", "prefix": "=", "level": 2 },
    { "aspectType": "location", "fullCode": "++B1-1F.R01", "prefix": "++", "level": 2 },
    { "aspectType": "power", "fullCode": "===DY1.AH1.H01", "prefix": "===", "level": 3 }
  ]
}
```

---

## 5. 时间估算

| 阶段 | 任务 | 预估工时 |
|------|------|----------|
| 1 | 后端 API 修改 | 15 分钟 |
| 2 | 前端 Tooltip 增强 | 30 分钟 |
| 3 | 样式调整与测试 | 15 分钟 |
| **总计** | | **1 小时** |

---

## 6. 回滚方案

如需回滚，只需：
1. 移除 SQL 查询中的 `aspects` 子查询
2. 恢复原有的 Tooltip 模板

不涉及数据库结构变更，风险较低。
