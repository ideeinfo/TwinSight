# n8n 工作流模板

本目录包含可导入到 n8n 的工作流模板文件。

## 工作流列表

| 文件 | 说明 | Webhook 路径 |
|------|------|-------------|
| `temperature-alert-workflow.json` | 完整 RAG 工作流（含上下文查询和引用格式化） | `/webhook/temperature-alert` |

## 切换到 n8n 工作流模式

后端支持两种 AI 分析模式：

1. **直接调用 Open WebUI**（默认）- 在 `ai-analysis.js` 中直接调用
2. **n8n 工作流**- 通过 n8n webhook 调用

### 启用 n8n 工作流模式

设置环境变量：

```bash
# 在 server/.env 中添加
USE_N8N_WORKFLOW=true
N8N_WEBHOOK_URL=http://localhost:5678/webhook/temperature-alert
```

或者在启动时设置：

```bash
USE_N8N_WORKFLOW=true npm run dev
```

## 导入工作流

1. 打开 n8n 控制台: http://localhost:5678
2. 点击左侧菜单的 **Workflows**
3. 点击右上角 **Import from File**
4. 选择 `temperature-alert-workflow.json`
5. 导入后需配置 Open WebUI API 凭据

## 配置 n8n 环境变量

在 n8n 中配置以下环境变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| `API_BASE_URL` | 后端 API 地址 | `http://host.docker.internal:3001` |
| `OPENWEBUI_URL` | Open WebUI 地址 | `http://host.docker.internal:3000` |

## 配置 API 凭据

1. 在 n8n 中点击左侧菜单的 **Credentials**
2. 点击 **Add Credential**
3. 选择 **Header Auth**
4. 设置名称为 `Open WebUI API Key`
5. Header Name: `Authorization`
6. Header Value: `Bearer sk-xxxxxxxx`（您的 Open WebUI API Key）

## 工作流节点说明

### 1. Webhook 接收温度报警
接收后端发送的温度报警请求

### 2. 查询上下文
调用 `GET /api/ai/context` 获取：
- 房间内的设备列表
- 相关文档列表
- 知识库 ID
- Open WebUI 文件 IDs

### 3. 构建 RAG Prompt
使用与直接调用相同的 Prompt 模板

### 4. 调用 Open WebUI RAG
发送请求到 Open WebUI `/api/chat/completions`

### 5. 解析 AI 回复
提取分析文本和 sources，构建 sourceIndexMap

### 6. 格式化引用和来源
调用 `POST /api/ai/format-citations` 处理：
- 将 `[source X]`、`[id: X]`、`[X]` 引用转换为可点击链接
- 自动生成"参考的文档"部分

### 7. 组装最终结果
组装标准响应格式

### 8. 返回结果
返回 JSON 响应给后端

## 请求格式

**触发方式**: HTTP POST `/webhook/temperature-alert`

```json
{
  "roomCode": "BF02US01",
  "roomName": "配电间",
  "temperature": 28.5,
  "threshold": 23,
  "alertType": "high",
  "fileId": 1
}
```

## 响应格式

```json
{
  "analysis": "### 1. 可能原因分析\n...",
  "sources": [
    {
      "name": "配电间操作手册.pdf",
      "url": "/api/documents/101/preview",
      "downloadUrl": "/api/documents/101/download",
      "docId": 101
    }
  ],
  "alert": {
    "roomCode": "BF02US01",
    "roomName": "配电间",
    "temperature": 28.5,
    "threshold": 23,
    "alertType": "high"
  }
}
```

## 测试工作流

启用工作流后，可以使用以下命令测试：

```bash
curl -X POST http://localhost:5678/webhook/temperature-alert \
  -H "Content-Type: application/json" \
  -d '{
    "roomCode": "BF02US01",
    "roomName": "配电间",
    "temperature": 28.5,
    "threshold": 23,
    "alertType": "high",
    "fileId": 1
  }'
```

## 扩展工作流

您可以在现有工作流基础上添加：

1. **邮件通知节点** - 发送报警邮件
2. **HTTP Request 节点** - 调用短信/微信 API
3. **If 条件节点** - 根据严重程度选择不同处理逻辑
4. **数据库节点** - 存储分析结果到数据库
