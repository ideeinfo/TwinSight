# N8N 动态 API 地址支持实施计划

## 1. 背景与目标
目前 n8n 工作流中调用后端 API 的地址（IP）是固化的。当部署多个后端服务共享同一个 n8n 服务，或者后端 IP 发生变化时，工作流会失效。
**目标**：解耦 n8n 工作流与后端服务的具体地址，通过在触发工作流（Webhook）时传递回调地址（Base URL），实现动态调用。

## 2. 变更范围

### 2.1 后端配置 (server/config/index.js)
- 新增 `server.baseUrl` 配置项。
- 优先读取环境变量 `API_BASE_URL`。
- 默认回退到 `http://localhost:{port}`（仅适用于本地单机调试）。

### 2.2 AI 服务 (server/services/ai-service.js)
- 在 `executeN8nWorkflow` 函数中，向 n8n Webhook Payload 添加 `apiBaseUrl` 字段。
- 使用配置中的 `server.baseUrl`。

### 2.3 n8n 服务 (server/services/n8n-service.js)
- 在 `triggerTemperatureAlert` 和 `triggerManualAnalysis` 函数中，同样添加 `apiBaseUrl` 字段。
- 确保所有相关 n8n 触发点都具备此上下文。

## 3. 分步实施

### 步骤 1: 更新配置文件
修改 `server/config/index.js`，增加 `baseUrl` 逻辑。

### 步骤 2: 更新 n8n 调用逻辑
修改 `server/services/ai-service.js` 和 `server/services/n8n-service.js`，引入配置并传递参数。

### 步骤 3: 验证与文档
- 本地验证调用 Payload 中是否包含正确的 URL。
- 提供对应 n8n 工作流的修改指南（告知用户需将 HTTP Request 节点的 URL 改为 Expression）。

## 4. 风险评估
- **风险**: 用户如果没有配置 `API_BASE_URL` 且处于跨容器/跨机器环境，默认的 `localhost` 可能会导致 n8n 回调失败。
- **缓解**: 在文档中明确要求在 `.env` 中配置 `API_BASE_URL`，并在日志中打印当前的 `apiBaseUrl` 以便调试。
