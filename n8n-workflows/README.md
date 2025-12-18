# n8n 工作流模板

本目录包含可导入到 n8n 的工作流模板文件。

## 工作流列表

| 文件 | 说明 | Webhook 路径 |
|------|------|-------------|
| `temperature-alert.json` | 温度报警分析工作流 | `/webhook/temperature-alert` |

## 导入工作流

1. 打开 n8n 控制台: http://localhost:5678
2. 点击左侧菜单的 **Workflows**
3. 点击右上角 **Import from File**
4. 选择对应的 `.json` 文件
5. 导入后需配置 Gemini API 凭据

## 配置 Gemini API 凭据

1. 在 n8n 中点击左侧菜单的 **Credentials**
2. 点击 **Add Credential**
3. 搜索 **Google Gemini**
4. 填入您的 Gemini API Key
5. 保存后返回工作流，将凭据绑定到 Gemini 节点

## 工作流说明

### 温度报警分析工作流

**触发方式**: HTTP POST `/webhook/temperature-alert`

**请求格式**:
```json
{
  "eventType": "temperature_alert",
  "data": {
    "roomCode": "ROOM-001",
    "roomName": "办公室",
    "temperature": 35.5,
    "threshold": 30,
    "timestamp": "2024-12-18T14:00:00Z",
    "fileId": 1
  }
}
```

**处理流程**:
1. Webhook 接收报警数据
2. 解析并格式化数据
3. 调用 Gemini Pro 分析原因并生成处置方案
4. 返回分析结果

**响应格式**:
```json
{
  "success": true,
  "alert": { ... },
  "analysis": "分析结果文本...",
  "processedAt": "2024-12-18T14:00:01Z"
}
```

## 测试工作流

启用工作流后，可以使用以下命令测试：

```bash
curl -X POST http://localhost:5678/webhook/temperature-alert \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "temperature_alert",
    "data": {
      "roomCode": "OFFICE-01",
      "roomName": "一楼办公室",
      "temperature": 35.5,
      "threshold": 30,
      "timestamp": "2024-12-18T14:00:00Z"
    }
  }'
```

## 扩展工作流

您可以在现有工作流基础上添加：

1. **邮件通知节点** - 发送报警邮件
2. **HTTP Request 节点** - 调用短信/微信 API
3. **If 条件节点** - 根据严重程度选择不同处理逻辑
4. **RAG 检索节点** - 检索相关操作手册（需配合 Qdrant）
