# AI 能力中心重构实施方案（v4）

> 目标：基于 TwinSight 当前真实状态，先修复 Week1 遗留问题，再建立最小可用的 facility 层作为当前授权边界，随后分阶段完成 TwinSight Core 工具化、AI Hub 编排层和 MCP 接入。`project` 暂时只作为预留与展示字段，不先承担真实权限语义。

---

## 0. 本版方案的核心调整

相对 `implementation_plan_v3_1.md`，本版做以下关键修正：

1. 不再以“先实现完整 project 层”为前提推进 AI 重构。
2. 明确当前系统真实锚点是 `model_files.id`，资产、空间、知识库、时序、视图都围绕 `fileId`。
3. 明确当前权限边界应落在 `facility`，而不是直接把 `fileId` 当最终授权边界。
4. 明确 `project` 当前只保留为设施字段与审计上下文，不做独立主数据与授权校验。
5. 明确实施顺序必须是：
   - 先关闭 Week1 遗留 P1
   - 再落最小 facility 层
   - 再做 Atomic API 收敛与 AI 能力重构
   - 最后引入 AI Hub / MCP / Admin / Rules

---

## 1. 当前系统现状

### 1.1 已有基础

- `model_files` 已是系统核心对象。
- `assets`、`spaces`、`knowledge_bases`、`views`、`influx_configs` 等均已与 `fileId` 建立关联。
- TwinSight 已有一版 `Atomic API`、`service-auth`、`scope-guard`、`/ws/control`。
- RAG 侧已有 `knowledge_bases(file_id -> openwebui_kb_id)` 映射能力。
- 前端已有模型管理、激活模型、按 `fileId` 查询业务数据的基础设施。

### 1.2 当前缺口

- `facility` 仅有类型定义、权限常量和零散预留字段，没有真实表与路由。
- `project` 仅存在于规划和请求头中，没有稳定业务定义，也没有实体模型。
- 权限仍是全局 permission，尚未实现对象级访问控制。
- Week1 遗留问题尚未全部闭环：
  - WS 房间鉴权不稳定
  - `rag-search(fileId)` 未真正命中 KB
  - `timeseries average(roomCodes)` 契约不完整
  - 前端控制通道连接目标不稳定

### 1.3 当前阶段的正确边界

当前阶段建议采用以下语义：

- `facility`：当前真实授权边界
- `fileId`：当前执行目标
- `project`：预留展示字段、审计字段、未来层级字段

未来再平滑升级为：

`project -> facility -> model file -> assets/spaces/documents/timeseries/kb`

---

## 2. 总体架构原则

### 2.1 系统分层

- TwinSight Core（现有 3001）
  - 继续承载原子能力
  - 管理模型、设施、资产、空间、文档、时序、控制通道
  - 提供可被 AI 调用的稳定工具接口

- AI Hub（后续新建）
  - 聊天编排
  - 工具调度
  - MCP Server
  - 审计与规则执行

- AI Admin（后续新建）
  - 规则管理
  - Prompt 管理
  - 工具开关与调试
  - 审计检索

### 2.2 能力分层

- 产品运行时能力：`Atomic API + AI Hub + MCP`
- 研发辅助能力：`Skills`
- 本地调试与运维：`CLI`

### 2.3 当前阶段的技术路线

- 继续沿用 Node.js 20 + ESM
- TwinSight Core 内部先把工具能力稳定为 Atomic API
- AI Hub 后续只调用 TwinSight Atomic API，不直接依赖历史业务端点
- MCP 作为 AI Hub 对外暴露工具能力的协议层，不替代底层业务 API

---

## 3. facility 数据模型设计

### 3.1 设计目标

facility 是当前阶段最小可用的真实业务边界，用来承接：

- 用户访问权限
- 模型文件归属
- 后续设施模板扩展
- 未来 project 层级上卷

### 3.2 facility 字段

建议新增 `facilities` 表，字段如下：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | BIGSERIAL / SERIAL | 主键 |
| `code` | VARCHAR(100) | 设施编码，唯一 |
| `name` | VARCHAR(200) | 设施名称，必填 |
| `template_id` | VARCHAR(100) / BIGINT / NULL | 设施模板，预留 |
| `project_name` | VARCHAR(200) | 项目名称 |
| `owner_name` | VARCHAR(200) | 业主 |
| `address` | VARCHAR(500) | 地址 |
| `thumbnail_path` | VARCHAR(1000) / NULL | 缩略图存储路径 |
| `thumbnail_size` | INT / NULL | 缩略图大小，字节 |
| `thumbnail_mime` | VARCHAR(100) / NULL | 缩略图 MIME |
| `status` | VARCHAR(20) | 默认 `active` |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |

### 3.3 关联关系

#### 模型文件归属

给 `model_files` 增加：

- `facility_id INTEGER NULL REFERENCES facilities(id)`

说明：

- 当前一个 `model_file` 只归属一个 `facility`
- 一个 `facility` 可拥有多个 `model_file`

#### 用户访问关系

新增 `user_facility_access`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | BIGSERIAL / SERIAL | 主键 |
| `user_id` | BIGINT / INTEGER | 用户 ID |
| `facility_id` | BIGINT / INTEGER | 设施 ID |
| `access_level` | VARCHAR(20) | `viewer` / `editor` / `admin` |
| `created_at` | TIMESTAMPTZ | 创建时间 |

### 3.4 缩略图规则

- 仅允许 `jpg/jpeg/png/webp`
- 文件大小必须 `<= 200 KB`
- 上传后保存在现有 uploads 体系中，例如 `uploads/facilities/`
- 数据库只保存路径与元数据，不保存二进制

### 3.5 当前不做的事

- 不建立独立 `projects` 主表
- 不实现 facility template 的真实业务逻辑
- 不做 facility 树级结构
- 不做 per-file ACL，当前统一通过 `file -> facility -> access` 推导

---

## 4. 权限与作用域模型

### 4.1 当前权限原则

当前阶段的对象访问统一走以下链路：

`user -> facility access -> fileId -> assets/spaces/documents/kb/timeseries/ui command`

也就是说：

- 用户是否能访问某个 `fileId`
- 不再直接由 `fileId` 本身判断
- 而是通过 `fileId` 归属的 `facility_id` 来决定

### 4.2 统一授权服务

建议在 TwinSight Core 中新增统一授权服务，至少提供：

- `canAccessFacility(userId, facilityId, permission?)`
- `canAccessFile(userId, fileId, permission?)`

其中 `canAccessFile` 的逻辑固定为：

1. 根据 `fileId` 查询 `model_files.facility_id`
2. 若无 facility 归属，则按兼容策略处理
3. 校验当前用户是否拥有该 facility 的访问权

### 4.3 兼容策略

为了平滑迁移旧数据，建议：

- 管理员拥有全部 facility 访问权
- 未绑定 `facility_id` 的旧 `model_file`，在迁移期内只允许管理员访问，或统一绑定到默认 facility
- 待全量数据迁移完成后，逐步取消空 facility fallback

### 4.4 Atomic API 作用域语义

本阶段将请求头语义明确为：

- `X-Project-Id`
  - 继续保留
  - 当前只用于审计、兼容、未来扩展
  - 不承担真实权限校验

- `X-Facility-Id`
  - 当前主要业务作用域
  - 启用后应参与业务校验

- `X-File-Id`
  - 当前执行目标
  - 必须与 `facility` 关系一致

---

## 5. 分阶段实施方案

## Phase 0：关闭 Week1 遗留问题

### 目标

在不引入新架构层的前提下，修完当前基础层的 4 个 P1，使后续 facility 和 AI 重构有稳定出发点。

### 工作项

1. 修正 WebSocket 控制通道
- 不再信任客户端自报 `projectId`
- 改为按 `fileId` 连接与投递
- 前端连接来源稳定化

2. 修正 `ui/command`
- 明确非 `sessionId` 场景必须有 `fileId`
- 投递目标改为 `file:${fileId}`

3. 修正 `rag-search`
- `fileId -> knowledge_bases.openwebui_kb_id`
- 未找到映射时返回明确错误

4. 修正 `timeseries/query`
- `average(roomCodes)` 改成真实的多房间平均时序
- `range` 和 `average` 补足参数校验

### 验收标准

- 上一轮复核中的 4 个 P1 全部关闭
- `scripts/smoke/atomic-week1.sh` 可扩展后通过
- 前端 `npm run build` 通过

---

## Phase 1：落地最小 facility 层

### 目标

让 facility 从“预留概念”变成真实对象，为权限和 AI 能力提供稳定边界。

### 后端工作项

1. 数据库
- 新增 `facilities`
- 新增 `user_facility_access`
- 给 `model_files` 增加 `facility_id`
- 增加索引和迁移脚本

2. Model 层
- 新增 `server/models/facility.js`
- 扩展 `server/models/model-file.js`

3. API
- 新增 `server/routes/v1/facilities.js`
- 在 `server/routes/v1/index.js` 挂载 `/facilities`

### 建议接口

- `GET /api/v1/facilities`
- `GET /api/v1/facilities/:id`
- `POST /api/v1/facilities`
- `PUT /api/v1/facilities/:id`
- `POST /api/v1/facilities/:id/thumbnail`
- `GET /api/v1/facilities/:id/models`

### 前端工作项

- 新增 facility 类型和 API 服务
- 增加设施列表与详情基础页
- 模型列表支持按 facility 过滤
- 模型上传/编辑支持绑定 facility

### 验收标准

- 可创建和编辑 facility
- 可上传 200 KB 内缩略图
- 可将 model file 绑定到 facility
- 可按 facility 过滤模型文件

---

## Phase 2：将权限边界切换到 facility

### 目标

让系统从“全局权限 + fileId 直用”切换到“facility 授权 + fileId 执行”。

### 工作项

1. 新增统一授权服务
- `canAccessFacility`
- `canAccessFile`

2. 改造以下入口统一接入授权层
- Atomic API
- `rag-search`
- `ui/command`
- WS 握手
- 关键模型查询接口

3. 迁移旧逻辑
- 不再把“file 存在”视为“file 可访问”
- 所有 file 访问均先查 facility

### 验收标准

- 用户访问任意 file 时均经过 facility 校验
- WS、RAG、UI Command 三条链路授权方式统一
- 管理员/普通用户行为差异正确

---

## Phase 3：重构 Atomic API 契约

### 目标

将 TwinSight Core 的 AI 原子能力收敛为稳定、清晰、facility-aware 的契约层。

### 调整原则

- AI Hub 未来只调用 Atomic API
- 历史路由继续兼容，但不再作为新能力依赖目标
- OpenAPI 必须更新为当前真实语义

### 端点策略

#### `POST /api/atomic/v1/assets/query`
- 支持 `fileId`
- 支持 `facilityId`
- 若同时传，校验一致性

#### `POST /api/atomic/v1/power/trace`
- 以 `fileId` 为必需执行目标
- 访问权限通过 facility 推导

#### `POST /api/atomic/v1/timeseries/query`
- `fileId` 为主要执行目标
- `roomCodes` + 时间范围为必需输入

#### `POST /api/atomic/v1/knowledge/rag-search`
- 以 `fileId` 为主要业务输入
- 内部自动映射 KB

#### `POST /api/atomic/v1/ui/command`
- 以 `fileId` 或 `sessionId` 为投递目标

### 文档要求

- 更新 `docs/api/atomic-v1.openapi.yaml`
- 在 handover 文档中注明：
  - `project` 当前仅用于审计/兼容
  - `facility` 是当前业务作用域
  - `fileId` 是执行对象

### 验收标准

- Atomic API 文档与实现一致
- AI 调用方不再依赖历史业务路由
- 所有核心能力都可在 `facility + file` 语义下稳定使用

---

## Phase 4：TwinSight Core 内部 AI 能力工具化

### 目标

在引入 AI Hub 前，先把 TwinSight 内的 AI 可调用能力稳定成一组“工具”。

### 工具集合

- `assets.query`
- `power.trace`
- `timeseries.query`
- `knowledge.rag_search`
- `ui.command`
- `alarm.create`

### 每个工具至少要定义

- 工具 ID
- 输入 schema
- 输出 schema
- 作用域要求
- 权限要求
- 错误码

### 结果

这一阶段结束后，TwinSight Core 将具备“可直接被 AI 编排层调用”的标准工具接口，但编排逻辑仍在 Core 外。

### 验收标准

- 工具能力可直接被内部服务调用
- 工具输入输出结构稳定
- 工具日志和错误码统一

---

## Phase 5：AI Hub MVP

### 目标

在 TwinSight Core 契约稳定后，再引入独立 AI Hub 作为编排与协议层。

### AI Hub 职责

- 聊天编排
- 工具调度
- MCP Server
- 审计落库
- Prompt 模板管理
- 会话上下文管理

### AI Hub 与 TwinSight Core 的边界

- AI Hub 不直接操作资产、空间、文档表
- AI Hub 只调用 Atomic API
- TwinSight Core 继续负责实际业务执行和前端控制通道

### MVP 能力

- `/api/chat`
- `/api/tools/invoke`
- `/mcp`
- execution log
- 最小工具注册中心

### 验收标准

- 通过 AI Hub 调用 Atomic 工具成功完成对话与工具执行
- 审计日志可查
- MCP 能暴露核心工具

---

## Phase 6：AI Admin、规则与 IoT 接入

### 目标

在 AI Hub MVP 稳定后，再引入运营与可配置能力。

### 包含内容

- Rule 管理 UI
- Tool 开关与参数配置
- Prompt 模板管理
- 审计检索界面
- Shadow run / 灰度 / 回滚
- IoT 事件到 AI Hub 规则评估链路

### 当前阶段不提前做的理由

- 这些能力依赖稳定的作用域模型和 Atomic 契约
- 若在 facility 和 Atomic 未稳定前推进，会产生大量返工

### 验收标准

- 可在 Admin UI 中管理规则与工具
- 可基于 IoT 事件触发 AI 规则
- 可查看完整审计与执行链路

---

## 6. 建议的数据迁移策略

### 6.1 先引入默认 facility

为避免历史数据阻塞，建议：

- 先创建一个默认 facility
- 将未归属的历史 `model_files` 统一挂到默认 facility
- 后续再逐步人工或脚本迁移到真实 facility

### 6.2 缩略图迁移

- facility 缩略图是新增能力，不需要历史迁移
- 首期只支持上传与替换，不做批量导入

### 6.3 project 名称

- 当前先保存在 `facilities.project_name`
- 等未来 `projects` 真正落地后，再做规范化迁移

---

## 7. MCP、Skills、CLI 的使用建议

### 7.1 MCP

用于产品运行时 AI 集成：

- 由 AI Hub 提供
- 面向外部 Agent / Claude / 其他智能体
- 底层调用 TwinSight Atomic API

### 7.2 Skills

用于研发与运维工作流：

- 代码审查
- 回归检查
- 规则生成辅助
- 数据修复辅助

不作为 TwinSight 产品运行时接口层。

### 7.3 CLI

用于本地和运维工具链：

- 冒烟测试
- 批量同步
- 迁移执行
- 联调排错

---

## 8. 最终推荐实施顺序

1. 关闭 Week1 遗留 P1
2. 新增 facility 表、访问关系表、模型归属字段
3. 将权限边界切换到 facility
4. 更新 Atomic API 契约与 OpenAPI
5. 完成 TwinSight Core 内部工具化
6. 建立 AI Hub MVP
7. 最后落 AI Admin、Rules、IoT 接入、灰度与回滚

---

## 9. 一句话结论

当前最合理的路线不是“先做完整 project，再做 AI 重构”，而是：

**先修 Week1 遗留问题，再实现最小 facility 层作为当前真实权限边界，然后继续推进 Atomic API 收敛、TwinSight Core 工具化、AI Hub 与 MCP。**

在这一阶段，`project` 仅保留为字段和未来层级预留，不应先承担当前真实授权职责。
