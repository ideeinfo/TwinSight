# Week1 审查遗留问题修复实施计划

## 1. 目标与背景

基于 `week1_pending_issues.md` 的7个待处理问题和 `review_report.md` 确认的4个 P1 未闭环缺陷，本轮聚焦将 WebSocket / UI 指令 / RAG / Timeseries 基础层修到可继续演进的状态。核心原则：**`project` 当前仅为审计兼容字段，`fileId` 是真正的执行目标**。

## 2. 设计规范检查

- [x] 本次变更不涉及前端 UI 展示组件，无需对照 `UI_DESIGN_SPEC.md`
- [x] 后端代码变更复用现有 `modelFileModel.getModelFileById()`、`knowledge_bases` 表等已有基础设施
- [x] 前端变更使用现有 `useModelsStore().activeModelId` 和 `/api/files/active` 接口

## 3. 变更计划

---

### 3.1 WebSocket 控制通道改为按 fileId 绑定（问题 #1 + #2）

#### [MODIFY] [ws-control-channel.js](file:///Volumes/DATA/antigravity/TwinSight/server/services/ws-control-channel.js)

- 握手阶段移除 `socket.handshake.auth.projectId` 的读取
- 新增 `socket.handshake.auth.fileId` 读取
- 校验逻辑：
  - JWT 校验（已有）
  - `fileId` 必须为正整数
  - 通过 `modelFileModel.getModelFileById(fileId)` 校验文件存在性
  - 校验失败 → `next(new Error(...))`，不做匿名降级
- 连接成功后仅加入以下房间：
  - `user:${userId}`
  - `session:${socket.id}`
  - `file:${fileId}`
- 开发模式匿名连接保持，但 projectId → fileId，默认 `dev-file`
- 删除所有 `project:*` 房间逻辑和 `projectId` 日志字段

#### [MODIFY] [ui.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/atomic/v1/ui.js)

- 当 `sessionId` 存在时，投递到 `session:${sessionId}`（不变）
- 当 `sessionId` 不存在时：
  - 优先 `req.scope.fileId`，其次 `req.body.fileId`
  - 两者都不存在 → 返回 `400`
  - 投递到 `file:${resolvedFileId}`
- 删除 `project:${req.scope.projectId}` 的广播逻辑

---

### 3.2 前端控制通道连接目标修复（问题 #5）

#### [MODIFY] [useControlChannel.js](file:///Volumes/DATA/antigravity/TwinSight/src/composables/useControlChannel.js)

- `connect(projectId)` → `connect(fileId)`
- 握手 auth 字段从 `projectId` → `fileId`
- 删除 `switchProject()` 方法，替换为 `switchFile(newFileId)`
  - `switchFile` 实现：`disconnect()` + `connect(newFileId)` 简单断重连
- JSDoc 注释同步更新

#### [MODIFY] [App.vue](file:///Volumes/DATA/antigravity/TwinSight/src/App.vue)

- 引入 `useModelsStore`
- 删除 `connect(authStore.user?.projectId || 'default')`
- 新增 `resolveFileId()` 异步函数：
  1. 优先 `modelsStore.activeModelId`
  2. 若为空 → 调用 `GET /api/files/active` 获取 `fileId`
  3. 取不到 → 不建连，仅 `console.warn`
- `watch(isAuthenticated)` 中调用 `resolveFileId()` → `connect(fileId)`
- `watch(modelsStore.activeModelId)` 做模型切换重连：
  - 新 fileId != 当前连接的 fileId → `disconnect()` + `connect(newFileId)`

---

### 3.3 rag-search fileId→kbId 映射（问题 #3）

#### [MODIFY] [knowledge.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/atomic/v1/knowledge.js)

- 引入 `pool`（db 连接池）
- 解析优先级：
  1. 显式 `kbId` → 直接用
  2. 否则 `fileId || req.scope.fileId` → 查 `knowledge_bases.openwebui_kb_id`
  3. 都没有 → `400`
  4. 有 fileId 但查不到映射 → `404 KNOWLEDGE_BASE_NOT_FOUND`
- `chatWithRAG()` 调用时传入解析后的真实 `kbId`
- 响应中移除 `fileIds: [resolvedFileId]` 伪造字段
- 响应改为 `{ results, kbId: resolvedKbId, query }`
- `topK` 保留为兼容字段，添加注释说明暂不下沉到检索深度

---

### 3.4 timeseries average 改为时间桶平均时序（问题 #4）

#### [MODIFY] [timeseries.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/atomic/v1/timeseries.js)

- `average` 分支新增参数校验：`startMs` 和 `endMs` 必须存在且为有效数字
- 不再透传到 `/api/v1/timeseries/query/average`
- 改为对每个 `roomCode` 并发调用 `/api/v1/timeseries/query/room`
- 在 Atomic 层按 `timestamp` 做时间桶归并：
  - 收集同一时间桶的所有房间数值
  - `avg = sum(values) / values.length`
  - 某房间缺值时不参与该桶平均
- 返回标准时序点列表（与 range 格式一致）

---

### 3.5 Atomic API 文档同步（问题 #6）

#### [MODIFY] [atomic-v1.openapi.yaml](file:///Volumes/DATA/antigravity/TwinSight/docs/api/atomic-v1.openapi.yaml)

- `X-Project-Id` 的 description 增加注释："当前仅作审计/兼容字段，fileId 是执行目标"
- `/ui/command` 新增 `fileId` 作为请求体的可选字段，补充说明投递逻辑
- `/knowledge/rag-search` 补充 `404 KNOWLEDGE_BASE_NOT_FOUND` 响应
- `/timeseries/query` 补充 `average` 类型下 `startMs/endMs` 为必填的说明
- 各端点统一标注 `fileId` 是当前执行目标

---

### 3.6 最小回归验证脚本（问题 #7）

#### [NEW] [test-week1-regression.js](file:///Volumes/DATA/antigravity/TwinSight/tests/test-week1-regression.js)

创建可独立运行的 Node.js 脚本（不依赖测试框架），覆盖以下场景：

1. **WS 握手验证**
   - 有效 JWT + 存在的 fileId → 连接成功
   - 有效 JWT + 不存在的 fileId → 握手失败
   - 有效 JWT + 缺失 fileId → 握手失败
2. **ui/command 路由验证**
   - 不带 sessionId 但带 X-File-Id → 投递到 `file:${fileId}`
   - 不带 sessionId 且缺 fileId → 400
3. **rag-search 映射验证**
   - 仅传 fileId + query → 能查到 kbId 并返回
   - 传不存在映射的 fileId → 404 KNOWLEDGE_BASE_NOT_FOUND
4. **timeseries average 验证**
   - 两个房间 average → 返回时序点数组（非单值）
   - 缺少 startMs/endMs → 400

> **注意**：脚本需要运行中的后端服务和数据库。仅做接口级冒烟测试。

## 4. 验证计划

### 自动化测试

```bash
# 前端构建验证（确保无编译错误）
cd /Volumes/DATA/antigravity/TwinSight && npm run build

# 回归测试脚本（需要先启动后端服务）
node tests/test-week1-regression.js
```

### 手动验证

> [!IMPORTANT]
> 回归测试脚本需要后端服务运行中 + 数据库中有至少一条 `model_files` 记录和对应的 `knowledge_bases` 映射。建议在本地开发环境中测试。

- [ ] 登录系统后观察浏览器控制台，确认 WS 连接日志显示 `file:${fileId}` 而非 `project:*`
- [ ] 切换模型后观察 WS 是否断开旧连接并重连到新 fileId
- [ ] 未获取到有效 fileId 时（无激活模型），确认不建连
