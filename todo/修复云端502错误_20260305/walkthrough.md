# 修复云端部署“追溯上游供电”时报错 502 的详细说明

## 🔍 问题分析

用户在阿里云部署的系统上点击或发送“追溯上游供电”时，AI 聊天接口 `/api/ai/chat` 返回了 `502 Bad Gateway` 错误。

经过详细调查与代码分析：
1. `502 Bad Gateway` 意味着 Nginx (或阿里云 SLB) 在与后端的 Node.js Express 服务器（端口 3001）通信时，连接被意外断开或拒绝。
2. 我们的 Nginx 配置（`nginx-cloud.conf`）已经设置了极长的 `proxy_read_timeout 86400s;`，排除了 Nginx 主动超时的可能。
3. 从 `ai-service.js` 和 `openwebui-service.js` 来看，任何由外部 API（例如 DeepSeek / OpenWebUI）返回的错误都会被 `try/catch` 捕获拦截，并通过 HTTP 500 返回给前端。因此前端看到 502 一定是底层网络连接层面的切断。
4. **核心原因：** 现代 Node.js（v18 以上，当前 Docker 基础镜像为 `node:20-alpine`）默认的 HTTP 取保活超时（`keepAliveTimeout`）时间是 **5秒**。如果外部 API 处理时间过长，或者阿里云 SLB（默认空闲超时 60秒）复用了一个快要到期的连接，而 Node.js 刚好在这个时刻由于达到 5 秒超时主动关闭了底层 TCP Socket，就会发生被称为 **HTTP keep-alive 竞争** 的经典问题，导致用户立刻或在一定时间后收到 502 错误。
5. 追溯上游供电时，LLM 推理时间经常在 10 ~ 60 秒内波动，极其容易与负载均衡器的超时设置引发冲突。

## 💡 解决方案

我们修改了后端入口文件 `server/index.js`，为 Express 应用挂载的 `server` 实例手动设置了更高的超时时间（必须大于 Nginx 代理超时或 SLB 默认的 60 秒超时）：

- **`server.keepAliveTimeout = 75000`** (75秒)
- **`server.headersTimeout = 76000`** (76秒) 
- 防止 Node.js 过早强杀业务代码：`server.timeout = 300000` (5分钟)

这能确保哪怕是耗时很久的大模型推理查询，底层的 Node.js HTTP 服务器也不会提前断开连接，而是耐心等待应用层的返回（或由 Nginx/SLB 的超时策略接管）。

## 📝 涉及修改的文件

- **[MODIFY]** `server/index.js` - 修改了底部 `app.listen` 返回的 Server 实例配置，增加了防止 502 竞争错误的超时设定。
