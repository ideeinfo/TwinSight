# 二次整改实施计划（修订版）

## 背景

复核报告确认：上一轮整改只解决了依赖补齐和前端基础接线，剩余 4 个 P1 问题仍未闭环。当前仓库里不存在真正的“用户-项目-文件”细粒度授权模型，因此本轮整改不引入新的租户系统，而是在现有能力范围内完成以下目标：

- 不再信任客户端自报的房间标识
- 让 UI 控制通道按 `fileId` 闭环
- 让 `rag-search(fileId)` 真的命中知识库
- 让 `timeseries average(roomCodes)` 返回与契约一致的平均时序

## 实施变更

### 1. WebSocket 控制通道改为按 `fileId` 绑定

#### 修改文件

- `server/services/ws-control-channel.js`
- `server/routes/atomic/v1/ui.js`
- `src/composables/useControlChannel.js`
- `src/App.vue`

#### 服务端规则

- 移除 `socket.handshake.auth.projectId` 的读取与所有 `project:*` room 逻辑。
- 握手只接收两个字段：
  - `token`
  - `fileId`
- 服务端在握手阶段执行以下校验：
  - 必须通过现有 JWT 校验
  - `fileId` 必须是正整数
  - 当前用户必须具备 `model:read` 权限
  - `fileId` 必须对应真实存在的模型文件，复用现有 `modelFileModel.getModelFileById()` 或等价查询
- 校验通过后只加入以下房间：
  - `user:${userId}`
  - `session:${socket.id}`
  - `file:${fileId}`
- 校验失败时直接拒绝握手，不做匿名降级到任意文件房间。
- 删除旧的 `projectId` 注释、日志字段和 room 命名，统一替换为 `fileId`。

#### UI 指令路由规则

- `POST /api/atomic/v1/ui/command` 保留 `sessionId` 定向投递能力。
- 当请求体带 `sessionId` 时：
  - 继续投递到 `session:${sessionId}`
- 当请求体未带 `sessionId` 时：
  - 优先读取 `req.scope.fileId`
  - 如果 `req.scope.fileId` 不存在，再读取 `req.body.fileId`
  - 两者都不存在时返回 `400`
  - 广播目标统一为 `file:${resolvedFileId}`
- 为避免契约漂移，本轮不移除 `X-Project-Id` 头要求；`scope-guard` 继续保留 `X-Project-Id` 必填，只把 `X-File-Id`/`body.fileId` 用于 WS 路由选择。

#### 前端连接规则

- `useControlChannel.connect()` 入参从“项目标识”改为“当前文件 ID”。
- 握手时发送：
  - `token`
  - `fileId`
- 删除或重命名 `switchProject()`，避免残留误导性 API；如保留能力，改名为 `switchFile(fileId)`，并在服务端实现对应的安全重连/换房逻辑。若本轮不做动态切换，则直接移除该方法。

### 2. `App.vue` 只使用一个可验证的 `fileId` 来源

#### 修改文件

- `src/App.vue`

#### 数据来源约定

- 根组件只使用以下顺序解析当前连接文件：
  1. `useModelsStore().activeModelId`
  2. 若为空，则调用现有 `GET /api/files/active`
- 不再使用不存在的 `user.projectId`
- 不从当前路由 query 中直接取 `fileId` 作为控制通道真相源

#### 生命周期规则

- 当 `authStore.isAuthenticated === false` 时：
  - 调用 `disconnect()`
- 当用户登录后：
  - 先尝试读取 `modelsStore.activeModelId`
  - 如果为空，发一次 `/api/files/active` 请求补齐
  - 只有拿到有效 `fileId` 后才调用 `connect(fileId)`
- 当激活模型发生变化时：
  - 若新 `fileId` 与当前连接不同，则先断开再按新 `fileId` 重连
- 当最终仍拿不到有效 `fileId` 时：
  - 不建立 WS 连接
  - 仅记录可诊断日志，不回退到 `default` 或其他伪标识

### 3. `rag-search` 自动将 `fileId` 映射为知识库

#### 修改文件

- `server/routes/atomic/v1/knowledge.js`

#### 解析规则

- 入口参数保持：
  - `query`
  - `fileId?`
  - `kbId?`
  - `topK?`
- 解析优先级固定为：
  1. 如果显式传入 `kbId`，直接使用
  2. 否则使用 `fileId || req.scope.fileId`
  3. 通过 `SELECT openwebui_kb_id FROM knowledge_bases WHERE file_id = $1` 查询映射
- 若既没有 `kbId` 也没有可用 `fileId`，返回 `400`
- 若有 `fileId` 但查询不到 `openwebui_kb_id`，返回 `404`，错误码固定为 `KNOWLEDGE_BASE_NOT_FOUND`

#### 调用规则

- `chatWithRAG()` 必须接收解析后的真实 `kbId`
- 不再返回伪造的 `fileIds: [fileId]`
- 响应中返回：
  - `results`
  - `kbId`
  - `query`
- `results` 保持当前“单条综合摘录”模式：
  - 命中时返回单条 `[{ content, score: 1.0 }]`
  - 未命中时返回 `[]`
- `topK` 本轮仅保留为兼容字段，不驱动多条结果切分；在代码中显式注释说明该字段暂未下沉到底层 Open WebUI 检索深度控制

### 4. `timeseries average(roomCodes)` 改为时间桶平均时序

#### 修改文件

- `server/routes/atomic/v1/timeseries.js`

#### 目标语义

- `queryType === 'average'` 时，返回值仍是“平均温度时序点列表”，不是单个标量。
- 平均值定义固定为：
  - 先按统一时间桶得到每个房间自己的聚合点
  - 再在同一时间桶上，对所有有值的房间做算术平均
- 这与旧 `/api/v1/timeseries/query/average` 的“按 `_time` 聚合后求 mean”语义保持一致，只是范围从“全局所有房间”收敛为“请求中的 `roomCodes`”

#### 实现规则

- 不再透传到底层 `/api/v1/timeseries/query/average`
- 统一走底层 `/api/v1/timeseries/query/room`
- 对每个 `roomCode` 并发请求：
  - 传入 `fileId`
  - 传入 `startMs`
  - 传入 `endMs`
  - 传入固定 `windowMs=60000`
- 每个房间返回值应是该房间的聚合点数组
- 在 Atomic 层按 `timestamp` 做归并：
  - 同一时间桶收集所有房间的数值
  - 平均值 = `sum(values) / values.length`
  - 某房间在该时间桶缺值时，不参与该桶平均
- 返回结构保持与当前 timeseries 查询一致，即点列表数组

#### 参数校验

- `roomCodes` 必须为非空数组
- `fileId` 必须存在
- `startMs` 与 `endMs` 在 `average` 和 `range` 两个分支都必须同时提供
- `startMs`、`endMs` 必须为有效数字
- `startMs <= endMs`
- 任一条件不满足时返回 `400`，不允许再落到底层触发 `500`

## 验证计划

### 1. WebSocket

- 使用有效 JWT + 存在的 `fileId` 建立连接，应成功加入 `file:${fileId}`
- 使用有效 JWT + 不存在的 `fileId` 建立连接，应握手失败
- 使用有效 JWT + 缺失 `fileId` 建立连接，应握手失败
- 发送不带 `sessionId` 且带 `X-File-Id` 的 `/api/atomic/v1/ui/command`，只有对应 `file:${fileId}` 连接能收到
- 发送带 `sessionId` 的 `/api/atomic/v1/ui/command`，只有对应 `session:${sessionId}` 连接能收到

### 2. RAG

- 仅传 `fileId` + `query`，应能查到 `knowledge_bases.openwebui_kb_id` 并把真实 `kbId` 传给 `chatWithRAG`
- 传不存在映射的 `fileId`，应返回 `404 KNOWLEDGE_BASE_NOT_FOUND`
- 同时传 `kbId` 和 `fileId` 时，应优先使用显式 `kbId`

### 3. Timeseries

- `average` 传两个房间，返回结果应为时序点数组，而非单值
- 对同一时间桶，结果值应等于该桶内各房间值的算术平均
- 缺少 `startMs/endMs` 的 `average` 请求应返回 `400`
- 多房间 `range` 请求仍应返回拼接后的点列表，且不再因单个房间失败导致整体 `500`

### 4. Frontend

- 登录后若 `modelsStore.activeModelId` 已存在，应直接连接对应 `fileId`
- 登录后若 `activeModelId` 不存在，应通过 `/api/files/active` 获取后再连接
- 模型切换后应重连到新的 `file:${fileId}`
- 未获取到有效 `fileId` 时不应建立 WS 连接，也不应连接到 `default`

## 假设与边界

- 本轮只解决“按文件隔离的控制通道闭环”，不引入新的多租户/多项目授权模型
- 当前系统的文件访问权限仍基于现有 `model:read` 能力，不新增 per-file ACL
- `X-Project-Id` 仍保留为 Atomic API 作用域头，不在本轮移除或重命名
- `topK` 保留兼容，但不在本轮实现真正的多结果检索切分
