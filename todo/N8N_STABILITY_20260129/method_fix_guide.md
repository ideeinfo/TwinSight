# N8N "Method Not Allowed" 修复指南

## 1. 问题诊断
出现 "Method Not Allowed" (HTTP 405) 错误，通常是因为 n8n 节点使用了错误的 HTTP 方法（GET vs POST）调用接口。

可能出现在两个地方：
1.  **Open WebUI 节点**: LLM 接口必须使用 **POST**。
2.  **Context 节点 (Twinsight Backend)**: 获取上下文通常使用 GET，但为了方便传递 JSON，有时错误地配置为 POST。

## 2. 解决方案

### A. 后端增强 (已自动实施)
我们已经更新了后端服务 (`ai-analysis.js`)，现在 `/api/ai/context` 接口同时支持 **GET** 和 **POST** 请求。
这大大增加了 n8n 工作流的兼容性，无论您在 n8n 中如何配置该节点，理论上都能正常工作。

### B. 检查 Open WebUI 节点配置 (用户操作)
请回到 n8n 界面，检查调用 AI (Open WebUI) 的 **HTTP Request** 节点：

1.  **Method**: 必须是 **POST**。
    - 如果选了 GET，会报 `Method Not Allowed`。
2.  **URL**: 确保是 `/api/chat/completions` 结尾。
    - 推荐使用内部地址: `http://open-webui:8080/api/chat/completions`

### C. 检查 Context 节点配置
如果你正在使用新配置的动态 URL (`{{ $json.apiBaseUrl }}/api/ai/context`)：

-   **推荐配置**:
    -   **Method**: POST
    -   **URL**: `{{ $json.apiBaseUrl }}/api/ai/context`
    -   **Send Body**: 开启
    -   **Body Content**: JSON
    -   **JSON**: `{ "roomCode": "{{ $json.roomCode }}", "roomName": "{{ $json.roomName }}", "fileId": "{{ $json.fileId }}" }`

这样配置最稳健，因为 POST Body 可以处理更复杂的数据，也不用担心 URL 编码问题。

## 3. 验证
修改后，再次执行工作流。如果之前的错误消失，说明方法匹配成功。
