# AI 能力中心重构规划 (v3.1 修订稿)

> 版本目标：在 v3.0 基础上补齐**用户级审计**、**单租户多项目隔离（预留 facility 层）**、**统一接口契约**、**鉴权与回滚机制**，确保方案可直接落地实施。

---

## 0. 版本变更摘要（相对 v3.0）

1. 新增统一 API 契约：AI Hub 仅调用 TwinSight `Atomic API`，不再混用历史端点。
2. 新增完整鉴权模型：用户身份透传 + 服务间认证（M2M）+ WebSocket 握手鉴权。
3. 新增用户级审计：所有聊天、工具、规则、Webhook 执行均落审计日志。
4. 新增单租户多项目数据模型：强制 `project_id` 作用域，预留 `facility_id`。
5. 新增可靠性策略：规则评估队列、幂等、重试、超时、熔断、降级。
6. 新增灰度发布与回滚：影子运行、双跑比对、分阶段切流、可一键回退。
7. 修正 WebSocket 设计：禁止广播，改为 user/project/session room 定向推送。
8. 修正实施口径：统一采用 TypeScript（Node.js 20 + ESM）。

---

## 1. 目标与范围

### 1.1 核心目标

- 将 TwinSight AI 能力重构为「TwinSight Core（原子能力）」+「AI Hub（编排/规则/MCP）」。
- 让业务规则从硬编码迁移到可配置规则引擎（json-rules-engine）。
- 对外通过 MCP 标准化暴露能力；对内通过 Atomic API 和控制通道调用。
- 实现可审计、可回滚、可灰度发布的生产级架构。

### 1.2 范围边界

**本期包含：**
- 聊天编排迁移、规则引擎落地、工具注册中心、MCP Server、Admin UI。
- 用户级审计、项目级作用域隔离、规则执行日志与可观测性。
- IoT 事件接入 AI Hub 规则评估链路。

**本期不包含：**
- 多租户（tenant）隔离（当前为单租户）。
- 跨项目联邦检索。
- 规则 DSL 自定义脚本执行（仅 JSON 规则，不开放任意脚本）。

---

## 2. 架构与职责

### 2.1 角色分工

- TwinSight Core（现有 3001）：
  - 提供原子 API（数据查询、拓扑追溯、RAG 检索、UI 指令转发）。
  - 管理前端会话与 WebSocket 控制通道。
- AI Hub（新建 4000）：
  - 聊天编排、工具调度、规则评估、MCP 服务、审计落库。
- AI Admin（新建 4001）：
  - 规则/工具可视化管理、AI 生成、沙箱模拟、日志查询。

### 2.2 数据作用域（单租户多项目）

全链路必须携带作用域：
- `project_id`：必填。
- `facility_id`：可选（预留，后续启用）。
- `file_id`：可选（项目下具体模型）。

### 2.3 上下文统一信封（Context Envelope）

所有 AI Hub 入站请求统一结构：

```json
{
  "actor": {
    "user_id": "u_123",
    "email": "ops@demo.com",
    "roles": ["admin"]
  },
  "scope": {
    "project_id": "proj_001",
    "facility_id": "fac_001",
    "file_id": 12
  },
  "request": {
    "request_id": "req_xxx",
    "trace_id": "trace_xxx",
    "source": "chat|mcp|rule|webhook"
  },
  "payload": {}
}
```

---

## 3. 统一接口契约（必须先落地）

> AI Hub 不允许直接依赖 TwinSight 历史业务路由；统一走 Atomic API。

### 3.1 Atomic API 目录（TwinSight）

| 能力 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 资产查询 | POST | `/api/atomic/v1/assets/query` | 按 code/name/classification/project/file 查询 |
| 电源追溯 | POST | `/api/atomic/v1/power/trace` | 输入节点与方向，返回 nodes/edges |
| 时序查询 | POST | `/api/atomic/v1/timeseries/query` | roomCodes + timeRange + fileId |
| RAG 检索 | POST | `/api/atomic/v1/knowledge/rag-search` | query + fileId/kbId |
| UI 指令 | POST | `/api/atomic/v1/ui/command` | navigate/highlight/isolate |
| 报警写入 | POST | `/api/atomic/v1/alarm/create` | 标准报警事件 |

### 3.2 历史端点映射（兼容期）

| 旧端点 | 新端点 | 策略 |
|---|---|---|
| `/api/rds/topology/trace` | `/api/atomic/v1/power/trace` | 内部转发，保留 2 个版本周期 |
| `/api/v1/timeseries/query/*` | `/api/atomic/v1/timeseries/query` | 先并行，后收敛 |
| `/api/ai/chat` | `AI Hub /api/chat` | TwinSight 仅做代理 + 鉴权透传 |

### 3.3 统一错误码规范

- `400` 参数错误
- `401` 未认证
- `403` 无权限或越权作用域
- `404` 资源不存在
- `409` 幂等冲突
- `429` 限流
- `502/504` 下游依赖错误/超时

统一返回：

```json
{
  "success": false,
  "error": {
    "code": "SCOPE_DENIED",
    "message": "project scope not allowed",
    "request_id": "req_xxx"
  }
}
```

---

## 4. 鉴权与安全模型

### 4.1 双层认证

1. 用户认证（User JWT）
- 前端/Claude 发起请求时携带 `Authorization: Bearer <user_jwt>`。
- AI Hub 验证 JWT（或通过 TwinSight introspection endpoint 校验）。

2. 服务认证（M2M）
- AI Hub -> TwinSight 调用携带 `X-Service-Token`。
- TwinSight 仅信任白名单服务令牌。

### 4.2 作用域授权

- 每次调用必须校验 `actor.user_id` 对 `scope.project_id` 的访问权。
- `file_id` 必须属于 `project_id`。
- 预留：`facility_id` 启用后，`file_id` 还需属于 facility。

### 4.3 MCP 访问安全

- `/mcp` 不得匿名暴露。
- 最低要求：API Key + 用户 token 绑定会话。
- 推荐：反向代理层限制来源 IP + TLS + 速率限制。

### 4.4 WebSocket 安全

- 握手鉴权：必须携带 JWT。
- 连接后加入 rooms：
  - `user:{user_id}`
  - `project:{project_id}`
  - `session:{session_id}`
- 严禁 `io.emit` 全局广播业务指令。

---

## 5. 用户级审计设计（新增）

### 5.1 审计目标

覆盖以下事件：
- 聊天请求（chat）
- MCP 工具调用（mcp_tool_call）
- 规则评估与触发（rule_eval/rule_fire）
- Webhook 调用（webhook_in/webhook_out）
- UI 控制指令（ui_command）

### 5.2 审计表结构

```sql
CREATE SCHEMA IF NOT EXISTS ai_hub;

CREATE TABLE ai_hub.execution_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       VARCHAR(64) NOT NULL,
  trace_id         VARCHAR(64) NOT NULL,
  source           VARCHAR(32) NOT NULL,          -- chat|mcp|rule|webhook|api
  action           VARCHAR(64) NOT NULL,          -- tool_call|rule_eval|ui_command|...

  actor_user_id    VARCHAR(64) NOT NULL,
  actor_email      VARCHAR(255),
  actor_roles      JSONB,

  project_id       VARCHAR(64) NOT NULL,
  facility_id      VARCHAR(64),                   -- 预留
  file_id          BIGINT,

  tool_id          VARCHAR(100),
  rule_id          VARCHAR(100),
  status           VARCHAR(20) NOT NULL,          -- success|error|timeout|skipped
  duration_ms      INT,

  input            JSONB,
  output           JSONB,
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exec_created_at ON ai_hub.execution_log(created_at DESC);
CREATE INDEX idx_exec_actor_time ON ai_hub.execution_log(actor_user_id, created_at DESC);
CREATE INDEX idx_exec_project_time ON ai_hub.execution_log(project_id, created_at DESC);
CREATE INDEX idx_exec_trace ON ai_hub.execution_log(trace_id);
CREATE INDEX idx_exec_rule ON ai_hub.execution_log(rule_id);
CREATE INDEX idx_exec_tool ON ai_hub.execution_log(tool_id);
```

### 5.3 审计保留策略

- 在线明细保留 90 天。
- 90 天后归档到冷表（按月分区）或对象存储。

---

## 6. 多项目数据模型（单租户）

### 6.1 建议新增表

```sql
CREATE TABLE ai_hub.projects (
  project_id    VARCHAR(64) PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  status        VARCHAR(20) DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_hub.facilities (
  facility_id   VARCHAR(64) PRIMARY KEY,
  project_id    VARCHAR(64) NOT NULL REFERENCES ai_hub.projects(project_id),
  name          VARCHAR(200) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_hub.project_files (
  project_id    VARCHAR(64) NOT NULL REFERENCES ai_hub.projects(project_id),
  file_id       BIGINT NOT NULL,
  facility_id   VARCHAR(64),
  PRIMARY KEY (project_id, file_id)
);
```

### 6.2 规则与工具的作用域

- 规则与自定义工具必须至少绑定到 `project_id`。
- 可选绑定 `file_id`（模型专属规则）。
- 禁止“无作用域规则”。

---

## 7. 规则引擎与可靠性

### 7.1 执行模型

- IoT 事件进入 AI Hub 后，先入队再评估。
- 队列消费并发可配置（默认 `concurrency=10`）。
- 同一规则+同一对象在 cooldown 窗口内去重。

### 7.2 幂等与去重

幂等键：
- `idempotency_key = hash(rule_id + project_id + object_code + time_bucket)`

### 7.3 超时与重试

- Tool 调用默认超时 5s（可配置）。
- 可重试错误最多 2 次（指数退避）。
- 下游连续失败触发熔断（30s）。

### 7.4 降级策略

- AI Hub 不可用：TwinSight 保留最小 fallback（仅关键报警阈值）。
- Open WebUI 不可用：规则继续执行，RAG 能力降级。

---

## 8. Tool 安全与 NL 生成约束

### 8.1 NL2Tool 安全门禁（必须）

- endpoint 域名白名单（仅 `api:3001` 等内部服务）。
- method 白名单（GET/POST）。
- 禁止任意 headers 注入（仅允许声明字段）。
- 参数必须通过 JSON Schema 校验。
- AI 生成结果必须“人审确认 + 二次校验”才可发布。

### 8.2 Tool 生命周期

- `draft` -> `review` -> `active` -> `disabled`。
- 只有 `active` 才对 MCP 暴露。

---

## 9. WebSocket 控制通道修订

### 9.1 服务端要求

- 路径：`/ws/control`
- 鉴权：JWT 握手
- 推送：仅 `to(room).emit`，禁用全局广播

### 9.2 客户端要求

- 使用 `io(baseUrl, { path: '/ws/control', auth: { token } })`
- 收到指令后二次校验作用域（project/file）再执行 UI 操作。

---

## 10. 代码结构与技术栈（统一为 TS）

### 10.1 AI Hub

- Runtime: Node.js 20 + TypeScript + ESM
- 依赖：
  - `@modelcontextprotocol/sdk`
  - `json-rules-engine`
  - `express`
  - `socket.io-client`
  - `zod`（请求/响应 schema 校验）
  - `pino`（结构化日志）

### 10.2 TwinSight 需补充依赖

- `socket.io`（后端控制通道）

### 10.3 目录（保持 v3.0 思路，统一 `.ts`）

- `ai-hub/src/**/*.ts`
- `ai-admin/src/**/*.{vue,ts}`

---

## 11. 分阶段实施计划（修订）

### 阶段 0（3-4 天）：契约与安全先行

- 冻结 Atomic API 契约（OpenAPI + JSON Schema）
- 定义 JWT 透传与 M2M 验证机制
- 建立审计字段标准（request_id/trace_id/actor/scope）

**验收**
- 契约评审通过；mock 测试通过；安全评审通过。

### 阶段 1（Week 1）：TwinSight 原子化与控制通道

- 新增 `/api/atomic/v1/*` 路由
- 新增 `/ws/control`（JWT + room 定向）
- 新增 `/api/ai/rag-search` 透传

**验收**
- 原子 API 联调通过
- WS 指令仅影响目标用户/项目会话

### 阶段 2（Week 2）：AI Hub 核心与审计落库

- MCP Server + Tool Registry + Rule Engine
- execution_log 全量落库
- AI Hub -> TwinSight 采用 M2M + user scope

**验收**
- Claude 可发现工具并调用
- 每次调用都有完整审计记录

### 阶段 3（Week 3）：Admin UI + NL2Rule/NL2Tool

- 规则/工具 CRUD
- NL 生成 + 人审确认 + 沙箱模拟
- 执行日志与 Trace 查询

**验收**
- 管理端可完成“自然语言 -> 发布规则 -> 沙箱验证”闭环

### 阶段 4（Week 4）：IoT 接入、双跑与切流

- IoT 事件转 AI Hub 评估队列
- 与旧 `iot-trigger-service.js` 双跑比对
- 按项目灰度切流

**验收**
- 双跑一致性 >= 99%
- 关键链路错误率 < 1%

### 阶段 5（Week 5，可与阶段 4 重叠）：清理与收敛

- 废弃旧硬编码逻辑
- 下线旧 AI 路由分支
- 更新运维手册与应急手册

---

## 12. 灰度发布与回滚

### 12.1 灰度策略

- 按 `project_id` 灰度，而非全量切换。
- 配置开关：
  - `AI_HUB_CHAT_ENABLED`
  - `AI_HUB_RULES_ENABLED`
  - `AI_HUB_UI_CONTROL_ENABLED`

### 12.2 双跑比对

- 新旧规则同时执行，仅旧链路生效；新链路只记录结果。
- 每日输出差异报告（规则命中、动作 payload、延迟）。

### 12.3 回滚路径

- 关闭上述 3 个开关即可回退旧链路。
- 保留旧 `iot-trigger-service.js` 至阶段 5 完成后一周再删除。

---

## 13. 测试与验收清单

### 13.1 功能测试

- MCP 工具发现、参数校验、执行结果。
- 规则评估（阈值、组合条件、cooldown）。
- UI 导航/高亮定向推送。

### 13.2 安全测试

- 无 token 调用、越权 project 调用、伪造 service token。
- NL2Tool 恶意 endpoint 注入（SSRF）拦截。

### 13.3 性能测试

- IoT 高频事件：1k/5k events/min。
- 规则评估 p95 延迟。
- 审计写入吞吐与查询性能。

### 13.4 可运维性测试

- 依赖故障（Open WebUI/n8n/Postgres）降级。
- 熔断、重试、回滚开关有效性。

---

## 14. 里程碑定义（DoD）

1. M1：Atomic API + WS 控制通道上线（含鉴权）。
2. M2：AI Hub MCP 与规则引擎上线（含用户级审计）。
3. M3：Admin UI 可完成规则/工具闭环发布。
4. M4：IoT 双跑稳定，项目级灰度切流完成。
5. M5：旧硬编码逻辑下线，文档与监控齐全。

---

## 15. 关键决策记录（本次确认）

- 审计：**需要用户级审计**（已纳入 execution_log 强制字段）。
- 隔离模型：**单租户多项目**（project 必填，facility 预留，file 属于 project）。
- 架构原则：AI Hub 调用仅通过 Atomic API，禁止继续扩散历史路由依赖。

