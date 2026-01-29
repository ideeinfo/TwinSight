# N8N 动态 API 地址支持操作指南

## 1. 变更说明
为了解决 n8n 工作流中硬编码后端 IP 的问题，我们实施了以下变更：
1. **后端配置升级**: 在 `server/config/index.js` 中增加了 `baseUrl` 配置，优先读取环境变量 `API_BASE_URL`。
2. **Webhook载荷增强**: 所有触发 n8n 的服务（温度报警、手动分析）现在都会在 Payload 中携带 `apiBaseUrl` 字段。

## 2. 部署配置 (DevOps)
在部署后端服务时，请确保配置环境变量 `API_BASE_URL`，指向当前服务可被 n8n 访问的地址。

**示例 (.env):**
```bash
# 本地开发 (通常不需要改，默认 localhost:3001)
API_BASE_URL=http://localhost:3001

# 生产环境/Docker (示例)
API_BASE_URL=http://192.168.1.100:3001
# 或使用域名
API_BASE_URL=https://api.example.com
```

## 3. n8n 工作流修改指南
您需要登录 n8n 并修改相应的工作流，将原本硬编码的 URL 替换为动态表达式。

### 修改步骤
1. 打开 n8n 工作流编辑器。
2. 找到调用后端 API 的 **HTTP Request** 节点（例如 "Fetch Context"）。
3. 点击 **URL** 输入框旁边的齿轮图标或表达式开关，切换为 **Expression** 模式。
4. 修改 URL 为以下格式：
   ```javascript
   {{ $json.apiBaseUrl }}/api/ai/context
   ```
   *(注：如果之前的节点输出结构不同，可能需要根据实际 JSON 路径调整，例如 `{{ $json.data.apiBaseUrl }}`。请查看上一节点的 Output Data/JSON 确认)*
   
   - 对于 **AI 分析 (ai-service.js)** 触发的流程，字段在根目录: `{{ $json.apiBaseUrl }}`
   - 对于 **温度报警 (n8n-service.js)** 触发的流程，字段在 data 对象内: `{{ $json.data.apiBaseUrl }}` (如果直接使用 webhook 数据)

## 4. 验证
1. 重启后端服务。
2. 触发一次流程（如手动提问或模拟报警）。
3. 查看 n8n 执行日志，确认收到的 JSON 数据包含 `apiBaseUrl`，且 HTTP Request 节点成功解析该地址。
