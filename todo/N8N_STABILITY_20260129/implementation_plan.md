# N8N 调用 Open WebUI 稳定性优化方案

## 1. 问题分析
用户反馈 n8n 调用 Open WebUI 接口时出现 "The connection was aborted" 错误。
**主要原因**：
1.  **超时 (Timeout)**: LLM 生成长文本通常需要 30~60 秒以上，n8n 默认 HTTP 请求超时时间较短，导致连接被客户端主动断开。
2.  **网络路由回环**: 使用宿主机 IP (192.168.x.x) 进行通信，虽然可行，但增加了网络跳数和 NAT 开销。在同 Docker 网络下，使用服务名 (Service Discovery) 更稳定。

## 2. 解决方案

### 2.1 增加超时时间 (环境变量)
在 `docker-compose.lan.yml` 中为 n8n 容器添加全局默认超时配置。
- 变量: `N8N_DEFAULT_HTTP_REQUEST_TIMEOUT`
- 值: `300` (5分钟)

### 2.2 n8n 节点级超时设置 (操作指南)
即使用户修改了环境变量，已存在的 HTTP Request 节点可能仍需手动调整。
- 在 HTTP Request 节点 -> Settings -> Timeout 设置为 300s。

### 2.3 使用内部 Docker 网络路由
建议将 n8n 中的调用 URL 从宿主机 IP 改为 Docker 容器服务名。
- 从: `http://192.168.2.183:3080/api/chat/completions`
- 改为: `http://open-webui:8080/api/chat/completions`
*(注意：Open WebUI 内部端口是 8080，外部映射才是 3080)*

## 3. 实施步骤

1.  **修改 Docker 配置**: 更新 `docker-compose.lan.yml`。
2.  **生成操作文档**: 编写 `walkthrough.md` 指导用户在界面上修改节点设置。
3.  **用户验证**: 重启容器并测试。
