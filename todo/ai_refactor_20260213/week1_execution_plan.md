# Week 1 执行拆解（基于 v3.1）

> 目标：在不引入 AI Hub 复杂逻辑前，先把 TwinSight 侧的**契约、鉴权、原子 API、控制通道、RAG 透传**打通，形成可被 AI Hub 稳定调用的基础层。

---

## 0. 本周交付物（DoD）

1. `Atomic API v1` 契约冻结（OpenAPI + JSON Schema）。
2. TwinSight 新增 `/api/atomic/v1/*` 路由并联调通过。
3. 服务间认证（M2M）与用户 token 透传规则可用。
4. `/ws/control` 控制通道上线（JWT 握手 + room 定向推送）。
5. `/api/ai/rag-search` 透传端点可用。
6. 冒烟测试脚本与最小回归脚本可复用。

---

## 1. 任务分解（按天）

## Day 1：契约冻结 + 安全骨架

### 1.1 定义 Atomic API OpenAPI

- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/docs/api/atomic-v1.openapi.yaml`
- [ ] 覆盖端点：
  - `POST /api/atomic/v1/assets/query`
  - `POST /api/atomic/v1/power/trace`
  - `POST /api/atomic/v1/timeseries/query`
  - `POST /api/atomic/v1/knowledge/rag-search`
  - `POST /api/atomic/v1/ui/command`
  - `POST /api/atomic/v1/alarm/create`
- [ ] 为每个端点定义：`request schema`、`response schema`、`error schema`。

### 1.2 定义统一上下文头（先用 Header，后续可换 Envelope）

- [ ] 约定并文档化请求头：
  - `X-Request-Id`
  - `X-Trace-Id`
  - `X-Project-Id`（必填）
  - `X-Facility-Id`（可选）
  - `X-File-Id`（可选）
  - `X-Service-Token`（AI Hub -> TwinSight）

### 1.3 安全中间件草案

- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/server/middleware/service-auth.js`
- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/server/middleware/scope-guard.js`
- [ ] 行为：
  - `service-auth` 校验 `X-Service-Token`。
  - `scope-guard` 校验 `project_id` 必填与 file/project 关联合法性（先 stub，Week2 接 DB 实表）。

**Day 1 验收**
- [ ] API 文档评审通过。
- [ ] 缺失 `X-Project-Id` 返回 `400`。
- [ ] 缺失/错误 `X-Service-Token` 返回 `401/403`。

---

## Day 2：Atomic API 路由骨架与端点映射

### 2.1 新建路由入口

- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/server/routes/atomic/v1/index.js`
- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/server/routes/atomic/index.js`
- [ ] 修改：`/Volumes/DATA/antigravity/TwinSight/server/index.js`
  - 挂载：`app.use('/api/atomic', atomicRouter)`

### 2.2 实现 power-trace 映射

- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/server/routes/atomic/v1/power.js`
- [ ] 内部转发到现有：`/api/rds/topology/trace`

### 2.3 实现 timeseries query 映射

- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/server/routes/atomic/v1/timeseries.js`
- [ ] 聚合现有：
  - `/api/v1/timeseries/query/room`
  - `/api/v1/timeseries/query/latest`
  - `/api/v1/timeseries/query/average`
- [ ] 返回统一结构：`{ success, data, meta }`

### 2.4 实现 assets query 映射

- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/server/routes/atomic/v1/assets.js`
- [ ] 先调用现有 RDS/资产查询接口，封成统一返回。

**Day 2 验收**
- [ ] 三个 Atomic 端点可用。
- [ ] 与旧接口输出字段映射表确认完成。

---

## Day 3：RAG 透传 + UI 命令入口

### 3.1 新增 RAG 透传端点

- [ ] 修改：`/Volumes/DATA/antigravity/TwinSight/server/routes/ai-analysis.js`
  - 新增 `POST /api/ai/rag-search`
- [ ] 新建（可选）：`/Volumes/DATA/antigravity/TwinSight/server/routes/atomic/v1/knowledge.js`
  - `POST /api/atomic/v1/knowledge/rag-search` -> 调用 `/api/ai/rag-search`

### 3.2 增加 UI 命令接收端点（HTTP -> WS）

- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/server/routes/atomic/v1/ui.js`
- [ ] 提供 `POST /api/atomic/v1/ui/command`
- [ ] 支持 `navigate/highlight/isolate` 指令。

### 3.3 报警原子端点

- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/server/routes/atomic/v1/alarm.js`
- [ ] 提供 `POST /api/atomic/v1/alarm/create`
- [ ] 先落数据库基础表或日志（本周最小实现可仅记录并返回 id）。

**Day 3 验收**
- [ ] RAG 透传可返回结果。
- [ ] UI 指令可入站并进入 WS 分发层。

---

## Day 4：WebSocket 控制通道（安全版）

### 4.1 服务端实现

- [ ] 安装依赖：`socket.io`
- [ ] 修改：`/Volumes/DATA/antigravity/TwinSight/server/package.json`
- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/server/services/ws-control-channel.js`
- [ ] 修改：`/Volumes/DATA/antigravity/TwinSight/server/index.js`
  - 用现有 HTTP server 初始化 WS。

### 4.2 握手鉴权与 room 管理

- [ ] 握手读取 JWT，解析出 `user_id`。
- [ ] 加入 rooms：
  - `user:{user_id}`
  - `project:{project_id}`
  - `session:{socket.id}`
- [ ] 禁止 `io.emit`，仅允许 `io.to(room).emit`。

### 4.3 前端监听

- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/src/composables/useControlChannel.js`
- [ ] 在主入口挂载：`/Volumes/DATA/antigravity/TwinSight/src/main.js` 或 `App.vue`
- [ ] 客户端连接方式：
  - `io(baseUrl, { path: '/ws/control', auth: { token, projectId } })`

**Day 4 验收**
- [ ] 仅目标用户/项目收到指令。
- [ ] 非法 token 无法建立连接。

---

## Day 5：联调、回归、交付

### 5.1 冒烟测试脚本

- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/scripts/smoke/atomic-week1.sh`
- [ ] 覆盖：assets、timeseries、power、rag-search、ui-command。

### 5.2 回归清单

- [ ] 旧接口仍可用（兼容期不破坏）。
- [ ] `api/health` 与 `api/v1/health` 正常。
- [ ] 鉴权失败路径返回码符合规范。

### 5.3 交付文档

- [ ] 新建：`/Volumes/DATA/antigravity/TwinSight/docs/ai-hub/week1-handover.md`
  - 已实现能力
  - 未完成项
  - 已知风险
  - Week2 输入条件

**Day 5 验收（总验收）**
- [ ] AI Hub 可以仅通过 Atomic API 调用核心能力（使用 curl/脚本验证）。
- [ ] 控制通道实现定向推送。
- [ ] 契约、测试脚本、交付文档齐全。

---

## 2. 关键实现细节（避免返工）

### 2.1 不要混用旧路径

AI Hub 只认 `/api/atomic/v1/*`。历史路由仅供兼容。

### 2.2 先做“最小可审计”字段

本周即使不建完整 `ai_hub.execution_log`，也要在 TwinSight 侧日志打印：
- `request_id`
- `trace_id`
- `user_id`
- `project_id`
- `action`

### 2.3 鉴权链必须贯通

- 外部请求：`Bearer user_jwt`
- 服务间请求：`X-Service-Token`
- 两者缺一不可（除本地 dev 明确豁免）。

---

## 3. 冒烟命令模板（可直接替换变量）

```bash
# 0) 环境
API=http://localhost:3001
TOKEN="<user_jwt>"
SVC="<service_token>"
PID="proj_001"

# 1) power trace
curl -X POST "$API/api/atomic/v1/power/trace" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Service-Token: $SVC" \
  -H "X-Project-Id: $PID" \
  -H "Content-Type: application/json" \
  -d '{"mcCode":"CP0101","direction":"upstream"}'

# 2) timeseries query
curl -X POST "$API/api/atomic/v1/timeseries/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Service-Token: $SVC" \
  -H "X-Project-Id: $PID" \
  -H "Content-Type: application/json" \
  -d '{"roomCodes":["R001"],"startMs":1730000000000,"endMs":1730003600000,"fileId":1}'

# 3) rag-search
curl -X POST "$API/api/atomic/v1/knowledge/rag-search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Service-Token: $SVC" \
  -H "X-Project-Id: $PID" \
  -H "Content-Type: application/json" \
  -d '{"query":"机房温度异常处理建议","fileId":1}'

# 4) ui command
curl -X POST "$API/api/atomic/v1/ui/command" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Service-Token: $SVC" \
  -H "X-Project-Id: $PID" \
  -H "Content-Type: application/json" \
  -d '{"type":"highlight","target":"=A1.FAN01","sessionId":"<session_id>"}'
```

---

## 4. 风险与缓解

1. **风险：历史接口字段不一致导致 AI Hub 适配复杂**
- 缓解：Atomic API 返回统一 DTO，本周锁定 schema。

2. **风险：WS 指令误广播**
- 缓解：代码层禁止 `io.emit`；CI 检查关键文件禁用全局广播。

3. **风险：服务 token 泄漏**
- 缓解：仅容器内网络可访问；token 轮换；日志脱敏。

4. **风险：scope 校验晚于功能实现**
- 缓解：本周至少完成 header 强校验与 file/project 基础关联校验。

---

## 5. Week2 前置条件（Gate）

满足以下条件才进入 Week2：

- [ ] Atomic API OpenAPI 文档已冻结。
- [ ] 所有 Atomic 端点通过冒烟脚本。
- [ ] WS 控制通道已按 room 定向。
- [ ] 最小审计字段可追踪到 user + project。
- [ ] 回归报告已确认无核心功能回退。

