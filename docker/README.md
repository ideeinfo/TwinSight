# n8n + Qdrant 智能分析服务

本目录包含用于 AI 智能分析功能的 Docker 容器配置。

## 服务说明

| 服务 | 端口 | 用途 |
|------|------|------|
| n8n | 5678 | 工作流自动化平台，处理报警触发、LLM 调用、通知发送 |
| Qdrant | 6333/6334 | 向量数据库，存储文档的语义向量用于 RAG 检索 |

## 快速开始

### 1. 配置环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑 .env 文件，填写实际配置
# 至少需要配置:
# - N8N_BASIC_AUTH_PASSWORD (n8n 登录密码)
# - GEMINI_API_KEY (Gemini Pro API Key)
```

### 2. 启动服务

```bash
# 进入 docker 目录
cd docker

# 启动 n8n 和 Qdrant
docker-compose -f docker-compose.ai.yml up -d

# 查看运行状态
docker-compose -f docker-compose.ai.yml ps

# 查看日志
docker-compose -f docker-compose.ai.yml logs -f
```

### 3. 访问服务

- **n8n 控制台**: http://localhost:5678
  - 用户名: `admin` (或 .env 中配置的值)
  - 密码: `twinsight123` (或 .env 中配置的值)
  
- **Qdrant API**: http://localhost:6333
  - Dashboard: http://localhost:6333/dashboard

## 停止服务

```bash
docker-compose -f docker-compose.ai.yml down
```

## 数据持久化

所有数据都存储在 Docker volumes 中：
- `n8n_data`: n8n 工作流和配置
- `qdrant_storage`: Qdrant 向量数据

## 与现有服务集成

本配置使用 `host.docker.internal` 访问宿主机服务，可以直接调用：
- 后端 API: `http://host.docker.internal:3001`
- PostgreSQL: `host.docker.internal:5432`
- InfluxDB: `host.docker.internal:8086`

## 常用 n8n 节点

创建工作流时可以使用以下节点：

1. **Webhook** - 接收来自 Twinsight 的报警事件
2. **HTTP Request** - 调用后端 API 获取资产/房间信息
3. **Google Gemini Chat Model** - 调用 Gemini Pro 进行分析
4. **Send Email** - 发送邮件通知
5. **HTTP Request** - 调用短信/微信 API

## 故障排查

### n8n 无法启动

```bash
# 查看详细日志
docker logs twinsight-n8n

# 检查端口占用
netstat -an | findstr 5678
```

### Qdrant 无法启动

```bash
# 查看详细日志
docker logs twinsight-qdrant

# 检查端口占用
netstat -an | findstr 6333
```

### n8n 无法访问宿主机服务

确保使用 `host.docker.internal` 而非 `localhost` 访问宿主机服务。
