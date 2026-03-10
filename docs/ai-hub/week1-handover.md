# AI Hub Week1 交付文档

## 已实现能力

### 1. Atomic API 契约 (`/api/atomic/v1/*`)
6 个标准化端点，统一请求/响应结构：

| 端点 | 功能 | 实现方式 |
|---|---|---|
| `POST /power/trace` | 电源拓扑追溯 | 转发 Logic Engine |
| `POST /timeseries/query` | 时序数据查询 (range/latest/average) | 聚合现有 InfluxDB 接口 |
| `POST /assets/query` | 资产查询 (flat/tree) | 直接查询 PostgreSQL |
| `POST /knowledge/rag-search` | RAG 知识库检索 | 透传 AI context 接口 |
| `POST /ui/command` | UI 控制指令 | WebSocket 定向推送 |
| `POST /alarm/create` | 报警事件创建 | 日志记录 + 返回 ID |

### 2. 安全层
- **M2M 认证** (`service-auth.js`)：`X-Service-Token` 白名单校验
- **作用域守卫** (`scope-guard.js`)：`X-Project-Id` 必填校验 + 审计日志
- **用户认证透传**：复用现有 JWT `authenticate` 中间件

### 3. WebSocket 控制通道 (`/ws/control`)
- JWT 握手鉴权
- Room 定向推送：`user:{id}`, `project:{id}`, `session:{socketId}`
- 前端 composable: `useControlChannel.js`

### 4. 文档与测试
- OpenAPI 规范：`docs/api/atomic-v1.openapi.yaml`
- 冒烟测试：`scripts/smoke/atomic-week1.sh`

---

## 未完成项
- [ ] `scope-guard` 中 project_id/file_id 的数据库级校验（标记为 Week2）
- [ ] `alarm/create` 的数据库持久化（标记为 Week2）
- [ ] `socket.io` / `socket.io-client` 依赖安装（需确认后执行）
- [ ] Nginx WebSocket 代理配置（生产环境）

## 已知风险
1. **socket.io 未安装**：WebSocket 控制通道使用动态导入，未安装时降级为日志模式，不影响 HTTP API。
2. **开发模式豁免**：`service-auth` 和 WS 握手在开发模式下放行无 token 请求，生产环境需确保 `SERVICE_TOKEN` 已配置。

## Week2 输入条件
- [x] Atomic API OpenAPI 文档已创建
- [x] 所有 Atomic 端点代码已实现
- [x] WS 控制通道已按 room 定向
- [x] 最小审计字段可追踪到 user + project
- [ ] 冒烟脚本需在启动服务后实际运行验证
