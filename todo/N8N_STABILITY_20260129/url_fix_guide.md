# 修复 "Method Not Allowed" 的最终解决方案

## 1. 根本原因发现
经过详细检查，您遇到的报错 `Method Not Allowed` 虽然通常指 HTTP 方法错误，但在这里是因为 **URL 拼写错误** 导致的。

- **错误的 URL** (您当前使用的): `/api/chat/completion` (单数)
- **正确的 URL**: `/api/chat/completions` (复数)

*注意: OpenAI 标准协议和 Open WebUI 都严格要求使用复数形式 `completions`。如果写成单数，服务器不仅找不到路径，有时还会因为路由匹配机制报出 "Method Not Allowed" 这种误导性的错误。*

## 2. 修正步骤

请回到 n8n 界面，找到 **调用 Open WebUI RAG** (HTTP Request) 节点：

1.  **检查 URL 字段**:
    -   ❌ `http://open-webui:8080/api/chat/completion`
    -   ✅ `http://open-webui:8080/api/chat/completions`
    
    **关键动作**：请务必在 URL 末尾加上一个 **`s`**。

2.  **确认其他设置**:
    -   Method: **POST** (保持不变)
    -   Timeout: 300 (建议值)

## 3. 验证
修改 URL 后，再次执行节点。应该就能收到正常的 JSON 响应了。
