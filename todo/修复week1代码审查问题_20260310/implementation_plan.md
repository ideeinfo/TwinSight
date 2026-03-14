# 修复 Week1 代码审查问题

本次计划旨在修复 `week1_code_review_report.md` 中指出的 5 个核心问题（4 个 P1，1 个 P2），包括 WebSocket 房间越权、控制通道前端未挂载、缺少 Socket.IO 依赖、Timeseries 接口契约不符以及 RAG 伪检索问题。

## Proposed Changes

### 前后端依赖与配置 (Dependencies)
- **修复**: 在 `server/package.json` 的 `dependencies` 中添加 `socket.io`，确保容器化部署时能够正常启动 WebSocket 服务。
- **修复**: 在前端根目录 `package.json` 的 `dependencies` 中添加 `socket.io-client`，防止动态导入失败。
#### [MODIFY] package.json(file:///Volumes/DATA/antigravity/TwinSight/server/package.json)
#### [MODIFY] package.json(file:///Volumes/DATA/antigravity/TwinSight/package.json)

### WebSocket 控制通道 (WebSocket Control Channel)
- **修复**: 修改 `server/services/ws-control-channel.js`，移除客户端任意发送 `join:project` 切换房间的机制，改由在握手建立（`connection`）时，严格校验 `socket.user` 的所属权限，仅让后端为合法的 `projectId` 执行 `socket.join()` 绑定，从根源上防止越权订阅广播数据。
#### [MODIFY] ws-control-channel.js(file:///Volumes/DATA/antigravity/TwinSight/server/services/ws-control-channel.js)

### 时序查询路由 (Timeseries API)
- **修复**: 重构 `server/routes/atomic/v1/timeseries.js` 对 `roomCodes` 数组的处理策略：
  - 对传入的 `startMs` / `endMs` 增加类型和极值校验（如保证 start < end）。
  - 对于 `queryType: 'range'`（现底层实现仅支持单房间），若 `roomCodes` 大于 1，通过 `Promise.all` 循环查询并拼接多个房间结果，以此符合 OpenAPI 的数组语义。
  - 对于 `queryType: 'average'`，将 `roomCodes` 真正应用于底层服务，保障过滤的粒度和精度。
#### [MODIFY] timeseries.js(file:///Volumes/DATA/antigravity/TwinSight/server/routes/atomic/v1/timeseries.js)

### AI RAG 知识检索 (RAG Knowledge API)
- **业务定位细化**：`/rag-search` 接口作为供外界（如 AI Hub 中的大模型或其它大模型智能体）调用的工具，它的核心职责是“提供准确的业务领域知识上下文”，而不是直接给最终用户的闲聊答案。
- **修复与深化方案 (True RAG Search)**：
  1. **废弃旧逻辑**：彻底移除原来调用 `/api/ai/context`（获取资产台账字典）的伪检索代码。
  2. **检索请求组装**：在 `routes/atomic/v1/knowledge.js` 中，提取请求体中的 `query`（检索词）、`kbId`（指定的知识库编号）或 `fileId`（由模型文件推导绑定的默认知识库）。
  3. **调用底层大模型引擎**：引入并复用 `server/services/openwebui-service.js` 的 `chatWithRAG(options)` 方法。
  4. **定制化摘要 Prompt (实现深度)**：
     - 不采用普通的聊天 Prompt。我们会向 `chatWithRAG` 注入系统级指令，例如：“*你是一个精准的知识库内容提取引擎。请基于用户输入的问题，从提供的文档知识库中提取核心事实、维修步骤或参数指标。不要包含任何闲聊和客套话，以高度结构化的条目列表直接返回客观事实；如果在文档中找不到相关内容，请仅返回 `NO_MATCH`。*”
     - 这种“**大模型摘要化检索（LLM-Synthesized Retrieval）**”能极大减轻调用端 Agent 的上下文负担并过滤干扰项，不需要开发复杂的纯向量 Chunking 回调与重排（Rerank）逻辑，充分利用现有 Open WebUI 全封闭的黑盒检索增强优势。
  5. **响应封装回 AI Hub**：捕获结果并包装为标准的 `SuccessResponse`（含结构化的知识文段），或者在遇到 `NO_MATCH` 时返回空数组，供上游 AI 决定下一步（查其他库或回答用户不知道）。

### 前端控制通道接入 (Frontend Control Channel)
- **修复**: 修正 `src/composables/useControlChannel.js` 中第 12 行。将 `@/stores/authStore` 为实际存在的 `@/stores/auth`。
- **修复**: 在全局 `src/App.vue` 或 `src/main.js`（鉴权成功后的初始化阶段）实例化调用 `connect()` 方法，完成客户端从建立连接到挂载全局监听状态的最后一块拼图。并在回调中抛发交互或给相关 `stores` 切出 `ui:command`。
#### [MODIFY] useControlChannel.js(file:///Volumes/DATA/antigravity/TwinSight/src/composables/useControlChannel.js)
#### [MODIFY] App.vue(file:///Volumes/DATA/antigravity/TwinSight/src/App.vue)

## Verification Plan
1. **依赖重建验证**：Docker build 是否顺利加入 `socket.io`，控制台是否有其启动日志。
2. **WebSocket 验证**：写脚本构建恶意的非隶属 JWT 进行越权 `join:project` 尝试，校验能否拦截。
3. **接口契约验证**：使用 cURL 对 `api/atomic/v1/timeseries/query` 包含两个及其以上的 `roomCodes` 的 JSON 发起 `range` 请求，不报 500 且正常返回组合序列。
4. **前端闭环联调**：重新编译跑起 `npm run dev` 前端。在控制台观察是否正确连上 `ws://` 协议通道，同时从后端 AI 推送一条 UI Command 确保画面弹窗动作发生。
