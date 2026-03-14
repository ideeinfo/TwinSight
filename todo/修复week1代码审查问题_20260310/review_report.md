# Week1 代码审查问题修复复核报告

## 背景

本次复核针对 `todo/修复week1代码审查问题_20260310` 中的整改实现，目标是确认上一轮 `week1_code_review_report.md` 指出的 5 个问题是否真正修复完成，而不是仅检查是否存在代码改动。

参考文档：

- `todo/修复week1代码审查问题_20260310/implementation_plan.md`
- `todo/修复week1代码审查问题_20260310/walkthrough.md`
- `todo/ai_refactor_20260213/week1_code_review_report.md`

## 复核范围

- WebSocket 控制通道权限边界
- Atomic API 契约一致性
- RAG 检索链路有效性
- 前端控制通道接入
- 生产部署依赖完整性

## 复核结论摘要

本轮整改中，`socket.io` 依赖补齐和前端控制通道挂载这两项有实质推进，前端执行 `npm run build` 也已通过。但上一轮 4 个 P1 问题中，仍有 4 个没有真正闭环，分别是 WebSocket 项目订阅越权、`rag-search` 在仅传 `fileId` 时退化为普通聊天、前端默认连接错误项目房间，以及 `timeseries/query` 的 `average` 路径仍不符合契约。因此当前版本仍不建议按“问题已修复完成”结论验收。

## 仍存在的问题

### 1. P1: WebSocket 握手阶段仍信任客户端传入的 `projectId`

- 级别：P1
- 问题：虽然移除了 `join:project` 事件，但 `server/services/ws-control-channel.js` 仍直接读取 `socket.handshake.auth.projectId`，并在连接建立后加入对应 `project:*` room。
- 影响：客户端只要在握手时伪造任意项目 ID，仍可订阅其他项目的广播消息，项目级越权风险未消除。
- 证据：`server/services/ws-control-channel.js`
- 建议：项目 room 必须由服务端根据可验证权限或后端映射关系决定，不能继续接受前端传值。

### 2. P1: `rag-search` 在只传 `fileId` 时不会真正走知识库检索

- 级别：P1
- 问题：`server/routes/atomic/v1/knowledge.js` 虽然改为调用 `chatWithRAG`，但只传了 `kbId`，没有把 `fileId` 解析成 `knowledge_bases.openwebui_kb_id`，也没有把 `fileIds` 传给底层服务。
- 影响：最常见的 `query + fileId` 调用会退化成不带知识库上下文的普通聊天，返回结果可能与目标模型文档无关，但响应看起来仍像已经执行了 RAG。
- 证据：`server/routes/atomic/v1/knowledge.js`、`server/services/openwebui-service.js`
- 建议：优先根据 `fileId` 查询 `knowledge_bases.openwebui_kb_id`，并将解析后的 `kbId` 或可用 `fileIds` 真正传给 `chatWithRAG`。

### 3. P1: 前端默认连接到 `project:default`，项目广播仍无法闭环

- 级别：P1
- 问题：`src/App.vue` 调用 `connect(authStore.user?.projectId || 'default')`，但当前前端 `auth` store 和 `/api/v1/auth/me` 返回结构都没有 `projectId` 字段。
- 影响：登录用户通常会连接到 `project:default`，而后端 UI 指令仍按真实 `projectId` 广播，导致项目级消息无法送达实际用户。
- 证据：`src/App.vue`、`src/stores/auth.ts`、`server/routes/v1/auth.js`
- 建议：补齐真实项目标识来源，并保证前端连接参数与后端投递规则使用同一套项目标识。

### 4. P1: `timeseries/query` 的 `average` 路径仍未按 `roomCodes` 过滤

- 级别：P1
- 问题：`server/routes/atomic/v1/timeseries.js` 只修复了 `range` 的多房间拼接，`average` 仍然把 `roomCodes` 转发给底层旧接口；而底层 `/api/v1/timeseries/query/average` 实际并不消费该参数。
- 影响：调用方以为拿到的是指定房间集合的平均值，实际拿到的是全局平均值，Atomic API 与 OpenAPI 契约仍然不一致。
- 证据：`server/routes/atomic/v1/timeseries.js`、`server/routes/timeseries.js`
- 建议：在 Atomic 层自行实现按 `roomCodes` 的平均值聚合，或先下调契约，明确当前仅支持全局平均值。

## 已确认修复的项

### 1. 生产部署依赖补齐

- `server/package.json` 和 `server/package-lock.json` 已补充 `socket.io`
- 根目录 `package.json` 和 `package-lock.json` 已补充 `socket.io-client`
- 上一轮“容器内缺少 Socket.IO 依赖”的问题已得到实质修复

### 2. 前端控制通道已挂入应用入口

- `src/composables/useControlChannel.js` 的 store 引用已从不存在的 `@/stores/authStore` 修正为 `@/stores/auth`
- `src/App.vue` 已开始初始化控制通道连接
- 该问题已从“完全未接线”改善为“已接线但项目绑定仍错误”

## 验证情况

- 已执行：`npm run build`
- 结果：通过
- 已执行：整改代码静态复核
- 结果：确认有 2 项实质修复，4 项 P1 问题仍未闭环
- 未执行：端到端 WebSocket 联调、容器内部署验证、真实知识库检索回归
- 原因：当前剩余问题主要是权限、契约和参数绑定逻辑缺陷，静态审查已经足以确认风险继续存在

## 总体建议

- 不要将本轮整改标记为“全部修复完成”
- 先继续处理剩余 4 个 P1 问题，再做联调验收
- 下一轮复核前补最小自动化用例，至少覆盖 WebSocket 项目鉴权、`rag-search(fileId)`、`timeseries average(roomCodes)` 三条关键路径
