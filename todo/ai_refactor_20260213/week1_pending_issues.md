# Week1 待处理问题（重生成版）

## 背景

基于前面的多轮审查、整改复核和架构讨论，Week1 现在应重新定义为“把 Atomic API / WebSocket / RAG 基础层修到可继续演进”，而不是继续扩展到完整的 `project` 或 `facility` 架构。

当前共识如下：

- `project` 目前只是预留概念，不是当前真实权限边界
- 当前系统真实执行对象仍是 `fileId`
- 后续应引入最小 `facility` 层作为权限边界
- 但这不应阻塞 Week1 收尾
- 因此 Week1 待处理问题应聚焦于当前基础层遗留的闭环问题

## 待处理问题

### 1. WebSocket 控制通道鉴权未闭环

- 问题：当前仍不能信任客户端自报的 `projectId`
- 调整方向：本阶段改为按 `fileId` 建连和投递
- 处理要求：
  - 握手不再接受 `projectId` 作为可信作用域
  - 服务端校验 `fileId` 是否存在
  - 服务端只加入 `file:${fileId}`、`user:${userId}`、`session:${socket.id}`
- 验收标准：
  - 伪造房间标识不能越权订阅
  - 指向某个 `fileId` 的 UI 指令只会投递给对应连接

### 2. `ui/command` 路由目标仍不明确

- 问题：当前仍按 `project` 房间投递，不符合现状
- 调整方向：改为 `sessionId` 或 `fileId` 二选一
- 处理要求：
  - 有 `sessionId` 时投递到 `session:${sessionId}`
  - 无 `sessionId` 时必须解析出 `fileId`
  - 缺失 `fileId` 时返回 `400`
- 验收标准：
  - 非 session 模式下不再走 `project:*`
  - 接口返回与实际投递目标一致

### 3. `rag-search(fileId)` 仍未真正命中知识库

- 问题：只传 `fileId` 时没有稳定映射到 `kbId`
- 调整方向：固定走 `fileId -> knowledge_bases.openwebui_kb_id`
- 处理要求：
  - 若显式传 `kbId`，优先用 `kbId`
  - 否则必须用 `fileId` 查 KB 映射
  - 查不到映射时返回明确错误，不做伪检索
- 验收标准：
  - `query + fileId` 能稳定命中对应知识库
  - 不再返回伪造的 `fileIds: [fileId]`

### 4. `timeseries/query` 的 `average(roomCodes)` 契约仍不成立

- 问题：当前 `average` 仍未真正按 `roomCodes` 聚合
- 调整方向：在 Atomic 层自行做多房间平均时序
- 处理要求：
  - 不再透传到底层旧 `/average`
  - 对每个 `roomCode` 拉取房间时序
  - 按时间桶做算术平均
- 验收标准：
  - 返回值仍是时序点数组，不是单值
  - 两个房间输入时，结果等于每个时间桶的平均值

### 5. 前端控制通道连接目标不稳定

- 问题：当前不能再用不存在的 `user.projectId`
- 调整方向：前端只围绕“当前有效 `fileId`”连接
- 处理要求：
  - 优先使用当前激活模型 `activeModelId`
  - 若没有，则查 `/api/files/active`
  - 没拿到有效 `fileId` 时不建连
- 验收标准：
  - 不再连接到 `default`
  - 模型切换后能重连到新的 `fileId`

### 6. Atomic API 文档与代码语义需要同步

- 问题：实现方向已从 `project` 预期转向 `fileId` 执行目标，但文档未完全反映
- 调整方向：更新 Week1 范围内的契约说明
- 处理要求：
  - 明确 `project` 当前仅作审计/兼容字段
  - 明确 `fileId` 是当前执行目标
  - 对 `ui/command`、`rag-search`、`timeseries/query` 更新说明
- 验收标准：
  - OpenAPI 和实际行为一致
  - 不再误导 AI Hub 接入方

### 7. Week1 缺少最小回归验证

- 问题：当前仍缺少覆盖这些闭环问题的最小自动化验证
- 调整方向：补最小冒烟/回归用例
- 处理要求：
  - WS 握手与房间隔离验证
  - `rag-search(fileId)` 命中 KB 验证
  - `timeseries average(roomCodes)` 聚合验证
- 验收标准：
  - 至少有可重复执行的脚本或接口测试
  - 修复后可用于下一轮复核

## 不属于 Week1 收尾范围的内容

以下内容不应混入当前 Week1 收尾：

- 完整 `project` 主数据建模
- 完整 `facility` 层上线
- AI Hub 独立服务
- MCP Server
- AI Admin / Rules / IoT 编排

## 结论

Week1 当前还剩 7 件事，其中核心是 5 个功能闭环问题：

- WebSocket 控制通道
- `ui/command`
- `rag-search`
- `timeseries average`
- 前端控制通道连接目标

此外，还需要补齐：

- 文档同步
- 最小回归验证

只有这些问题收尾后，才适合进入 facility 层和后续 AI 重构阶段。
