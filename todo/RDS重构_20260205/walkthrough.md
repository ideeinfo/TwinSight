# RDS 电源功能网络化重构 - 完成概要

## 变更内容

### 数据库迁移
#### [NEW] [009_rds_power_graph.sql](file:///Volumes/DATA/antigravity/TwinSight/server/migrations/009_rds_power_graph.sql)
- `rds_power_nodes` 表：存储电源网络节点
- `rds_power_edges` 表：存储节点间层级/供电关系

---

### 后端 Python (Logic Engine)
#### [MODIFY] [importer.py](file:///Volumes/DATA/antigravity/TwinSight/logic-engine/services/importer.py)

render_diffs(file:///Volumes/DATA/antigravity/TwinSight/logic-engine/services/importer.py)

**关键变更：**
- 新增 `_create_power_graph_data()` 函数 - 将电源编码层级化为图节点和边
- 修改 `import_excel_data()` - 调用图数据生成逻辑
- 修改 `clear_file_rds_data()` - 清理时同时删除新表数据

---

### 后端 Node.js
#### [MODIFY] [rds.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/rds.js)

render_diffs(file:///Volumes/DATA/antigravity/TwinSight/server/routes/rds.js)

**新增 API：**
- `GET /api/rds/power-graph/:fileId` - 获取 G6 格式图数据
- `GET /api/rds/power-trace/:fileId/:nodeCode` - 路径追溯

---

### 前端 Vue
#### [NEW] [PowerNetworkGraph.vue](file:///Volumes/DATA/antigravity/TwinSight/src/components/PowerNetworkGraph.vue)
- AntV G6 集成
- 支持 dagre/force/compactBox 布局
- 节点点击事件发射

#### [MODIFY] [rds.js](file:///Volumes/DATA/antigravity/TwinSight/src/api/rds.js)
- 新增 `getPowerGraph()` 和 `tracePowerPath()` API 函数

---

## 验证步骤

### 1. 执行数据库迁移
```bash
# 连接到 PostgreSQL 并执行
psql -h localhost -U postgres -d twinsight -f server/migrations/009_rds_power_graph.sql
```

### 2. 重建 Docker (如使用 Docker)
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### 3. 重新导入 Excel
在前端重新上传 RDS Excel 文件，验证 Logic Engine 日志输出包含：
```
[INFO] 电源图: N 节点, M 边
```

### 4. 验证 API
```bash
# 获取电源图数据
curl http://localhost:3000/api/rds/power-graph/<FILE_ID>

# 路径追溯
curl http://localhost:3000/api/rds/power-trace/<FILE_ID>/<ENCODED_CODE>
```

### 5. 前端组件测试
在 `AspectTreePanel.vue` 中引入 `PowerNetworkGraph` 组件进行测试（需要后续集成）。

---

## 后续工作

1. **集成 AspectTreePanel**：修改 `AspectTreePanel.vue`，当 `aspectType === 'power'` 时渲染 `PowerNetworkGraph`
2. **BIM 联动**：在节点点击时调用 BIM 高亮接口
3. **双路供电**：增加备用电源列的导入逻辑
