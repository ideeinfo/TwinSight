# Week1 代码审核报告

## 背景

本次审核对象为 Week1 交付中的 Atomic API、鉴权链路、WebSocket 控制通道及其前端接入相关实现，重点检查实现是否与周计划、接口契约和可部署性保持一致。

参考文档：

- `week1_execution_plan.md`
- `week1_walkthrough.md`

## 审核范围

- Atomic API 路由与契约
- WebSocket 控制通道
- 前端控制通道接入
- 部署/依赖完整性

## 审核结论摘要

本次 Week1 实现主体已经落地，相关代码、文档和脚本均已提交，前端执行 `npm run build` 也已通过。但当前实现仍存在 4 个高优先级问题和 1 个中优先级问题，主要集中在权限边界、接口语义一致性、真实链路闭环以及生产部署完整性上。基于现状，不建议按“已完成联调并可上线”结论验收。

## 主要发现

### 1. P1: WebSocket 项目房间越权订阅

- 级别：P1
- 问题：`server/services/ws-control-channel.js` 信任客户端提供的 `projectId`，并允许 `join:project` 任意切换。
- 影响：任意持有有效 JWT 的客户端可订阅其他项目的 `project:*` 指令，项目级 UI 控制消息存在越权接收风险。
- 证据：`server/services/ws-control-channel.js`
- 建议：room 绑定必须基于服务端可验证项目权限，禁止客户端自报任意项目。

### 2. P1: 生产镜像缺少 `socket.io`

- 级别：P1
- 问题：Docker 构建只安装 `server/package.json` 中依赖，而该文件未声明 `socket.io`。
- 影响：部署后控制通道动态导入失败，`ui/command` 无法真正投递，运行时只能退化为日志或 `delivered: false`。
- 证据：`Dockerfile`、`server/package.json`
- 建议：将后端运行时依赖放入 `server/package.json`，并验证容器内启动日志。

### 3. P1: `/api/atomic/v1/timeseries/query` 与契约不一致

- 级别：P1
- 问题：`range` 仅取第一个 `roomCodes`，`average` 未真正按房间过滤，且 `startMs/endMs` 未严格校验。
- 影响：返回结果与 OpenAPI 语义不一致，部分请求会错误返回 500，AI Hub 难以稳定依赖该接口。
- 证据：`server/routes/atomic/v1/timeseries.js`、`docs/api/atomic-v1.openapi.yaml`
- 建议：先统一契约，再决定是支持多房间还是限制单房间，并补参数校验。

### 4. P1: `rag-search` 实际不是 RAG 检索

- 级别：P1
- 问题：实现调用 `/api/ai/context`，返回的是上下文资产/文档，不是真正检索结果，`topK` 未使用。
- 影响：AI Hub 若按“搜索接口”接入，会得到错误语义和错误数据结构，接口名与实际行为不匹配。
- 证据：`server/routes/atomic/v1/knowledge.js`、`server/routes/ai-analysis.js`
- 建议：明确改成真实检索接口，或修改文档与端点命名，避免伪装成 `rag-search`。

### 5. P2: 前端控制通道未真正接入

- 级别：P2
- 问题：`src/composables/useControlChannel.js` 引用了不存在的 `@/stores/authStore`，且没有在入口挂载。
- 影响：即使后端发送 `ui:command`，前端默认也不会连接和消费，控制链路未形成闭环。
- 证据：`src/composables/useControlChannel.js`、`src/main.js`、`src/App.vue`
- 建议：修正 store 引用并在主入口完成接线，再补最小联调验证。

## 验证情况

- 已执行：`npm run build`
- 结果：通过
- 未执行：端到端冒烟、控制通道联调、容器内部署验证
- 原因：当前发现的问题主要是权限、契约和部署完整性缺陷，静态审查已足以判定存在风险

## 总体建议

- 先修 P1，再做联调回归
- 为 Atomic API 和 WS 权限链补自动化测试
- 修复后更新 `week1_walkthrough.md`，避免“已完成”结论与实际状态不符
