# 修复 AI 分析未调用 n8n 服务的问题

## 问题描述
用户反馈本地 AI 分析功能未调用配置的 n8n 服务 (192.168.2.183:5678)。
经排查发现：
1. 后端服务启动时仅加载 `.env` 文件，而用户配置在 `.env.local` 中。
2. 控制是否使用 n8n 的环境变量 `USE_N8N_WORKFLOW` 未在配置文件中定义/启用，导致系统回退到直接调用 Open WebUI 的模式。

## 涉及变更
### 后端配置 (Server)
#### [MODIFY] [index.js](file:///Volumes/DATA/antigravity/TwinSight/server/config/index.js)
- 修改 `dotenv` 加载逻辑，增加对 `.env.local` 的支持，确保本地开发配置生效。

### 环境变量
#### [MODIFY] [.env.local](file:///Volumes/DATA/antigravity/TwinSight/.env.local)
- 添加 `USE_N8N_WORKFLOW=true` 以启用 n8n 工作流模式。

## 验证计划
### 自动化测试
- 无

### 手动验证
1. 重启后端服务。
2. 触发 AI 分析功能（如温度报警）。
3. 观察后端控制台日志，确认输出 `🔧 AI 分析模式: n8n 工作流`。
4. 检查 n8n 服务端是否有请求记录。
