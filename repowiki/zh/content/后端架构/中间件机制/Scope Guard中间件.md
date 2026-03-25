# Scope Guard 中间件

<cite>
**本文档引用文件**
- [server/middleware/scope-guard.js](../../../../../../server/middleware/scope-guard.js)
- [server/routes/atomic/v1/index.js](../../../../../../server/routes/atomic/v1/index.js)
</cite>

## 目录
1. [概述](#概述)
2. [功能职责](#功能职责)
3. [请求头规范](#请求头规范)
4. [Scope 挂载结构](#scope-挂载结构)
5. [审计追踪](#审计追踪)
6. [错误处理](#错误处理)
7. [使用方式](#使用方式)

## 概述

Scope Guard 中间件是 Atomic API 的核心安全组件，负责校验和解析所有 Atomic API 调用的作用域参数。它确保每个请求都携带必要的上下文信息（如项目 ID），并将这些信息标准化后挂载到请求对象，供后续路由和中间件使用。

```mermaid
flowchart LR
    A[请求进入] --> B[service-auth<br/>服务认证]
    B --> C[scope-guard<br/>作用域校验]
    C --> D{检查<br/>X-Project-Id}
    D -->|缺失| E[返回 400<br/>MISSING_PROJECT_ID]
    D -->|存在| F[解析 Scope<br/>挂载到 req]
    F --> G[记录审计日志]
    G --> H[进入路由处理]
```

**Section sources**
- [server/middleware/scope-guard.js](../../../../../../server/middleware/scope-guard.js)

## 功能职责

Scope Guard 中间件承担以下职责：

1. **必填字段校验**：确保 `X-Project-Id` 请求头存在
2. **可选字段解析**：解析 `X-Facility-Id`、`X-File-Id` 等可选头
3. **追踪信息提取**：提取 `X-Request-Id` 和 `X-Trace-Id` 用于分布式追踪
4. **Scope 挂载**：将解析后的作用域信息挂载到 `req.scope`
5. **审计日志**：记录最小可审计日志，支持操作追踪

## 请求头规范

### 必填头字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `X-Project-Id` | string | 是 | 项目唯一标识，用于数据隔离 |

### 可选头字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `X-Facility-Id` | string | 设施标识，预留用于多设施场景 |
| `X-File-Id` | number | 模型文件 ID，用于关联具体 BIM 模型 |
| `X-Request-Id` | string | 请求追踪 ID，用于日志关联 |
| `X-Trace-Id` | string | 分布式追踪 ID，用于跨服务追踪 |

### 请求示例

```http
POST /api/atomic/v1/assets/query HTTP/1.1
Host: api.twin sight.local
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
X-Service-Token: ai_hub_token_xxx
X-Project-Id: project_123
X-Facility-Id: facility_001
X-File-Id: 456
X-Request-Id: req_abc123def456
X-Trace-Id: trace_xyz789uvw012
Content-Type: application/json

{
  "aspectType": "function",
  "format": "tree"
}
```

## Scope 挂载结构

经过 Scope Guard 处理后，请求对象会被挂载以下属性：

### req.scope

```javascript
req.scope = {
    projectId: 'project_123',      // string, 来自 X-Project-Id
    facilityId: 'facility_001',    // string | null, 来自 X-Facility-Id
    fileId: 456                    // number | null, 来自 X-File-Id（已解析为整数）
};
```

### req.tracing

```javascript
req.tracing = {
    requestId: 'req_abc123def456', // string | null, 来自 X-Request-Id
    traceId: 'trace_xyz789uvw012'  // string | null, 来自 X-Trace-Id
};
```

### 在路由中使用

```javascript
router.post('/query', async (req, res) => {
    const { projectId, fileId } = req.scope;
    const { requestId } = req.tracing;

    // 使用 scope 信息查询数据
    const result = await db.query(
        'SELECT * FROM assets WHERE project_id = $1 AND file_id = $2',
        [projectId, fileId]
    );

    res.json({
        success: true,
        data: result.rows,
        meta: { request_id: requestId }
    });
});
```

## 审计追踪

Scope Guard 会记录每个 Atomic API 调用的最小可审计日志：

```
📡 [atomic] POST /api/atomic/v1/assets/query | project=project_123 | user=admin | request_id=req_abc123def456 | trace_id=trace_xyz789uvw012
```

### 日志格式

| 字段 | 说明 |
|------|------|
| `[atomic]` | 标识这是 Atomic API 调用 |
| `METHOD PATH` | HTTP 方法和请求路径 |
| `project` | 项目 ID |
| `user` | 用户 ID（来自 `req.user.id`）或 `unknown` |
| `request_id` | 请求追踪 ID |
| `trace_id` | 分布式追踪 ID |

### 日志用途

- **安全审计**：追踪谁访问了哪些项目的数据
- **故障排查**：通过 request_id 关联完整请求链路
- **性能监控**：结合时间戳分析请求处理时间
- **合规要求**：满足数据访问审计需求

## 错误处理

当缺少必填的 `X-Project-Id` 头时，中间件会返回 400 错误：

```json
{
  "success": false,
  "error": {
    "code": "MISSING_PROJECT_ID",
    "message": "X-Project-Id header is required for all Atomic API calls",
    "request_id": null
  }
}
```

### 错误码说明

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `MISSING_PROJECT_ID` | 400 | 缺少 X-Project-Id 请求头 |

### 未来扩展（TODO）

根据代码注释，未来版本将增加以下校验：

1. **Project 存在性校验**：验证 `project_id` 是否存在于 `ai_hub.projects` 表中
2. **File 归属校验**：如果提供了 `file_id`，验证其是否属于该 `project_id`

## 使用方式

### 在路由中启用

```javascript
import { Router } from 'express';
import { scopeGuard } from '../middleware/scope-guard.js';

const router = Router();

// 为所有路由启用 scope guard
router.use(scopeGuard);

// 或仅为特定路由启用
router.post('/query', scopeGuard, async (req, res) => {
    // 处理请求
});
```

### 在 Atomic API 中的集成

在 Atomic API 路由入口中，Scope Guard 作为中间件链的一环：

```javascript
// server/routes/atomic/v1/index.js
import { authenticate } from '../../../middleware/auth.js';
import { serviceAuth } from '../../../middleware/service-auth.js';
import { scopeGuard } from '../../../middleware/scope-guard.js';

const router = Router();

// 全局中间件链：用户认证 -> 服务间认证 -> 作用域校验
router.use(authenticate);
router.use(serviceAuth);
router.use(scopeGuard);
```

### 测试建议

在开发环境中测试时，确保请求包含必要的头字段：

```bash
curl -X POST http://localhost:3001/api/atomic/v1/assets/query \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "X-Service-Token: $SERVICE_TOKEN" \
  -H "X-Project-Id: test_project" \
  -H "X-File-Id: 123" \
  -H "Content-Type: application/json" \
  -d '{"format": "flat"}'
```

**Section sources**
- [server/routes/atomic/v1/index.js](../../../../../../server/routes/atomic/v1/index.js)
