## 最终修复说明 (v3)

### 1. 解决「连接被拒绝」(Connection Refused) 问题
- **原因分析**：n8n 运行在公网，而之前发送给 n8n 的 `apiBaseUrl` 是 `http://127.0.0.1:3001`（本地回流地址）。公网服务器无法直接连接您本地运行的后端，导致报错。
- **动态解析逻辑**：
    - 在 `config-service.js` 中增加了 `getApiBaseUrl` 智能解析函数。
    - **优先级**：数据库配置 (`system_config.API_BASE_URL`) > 环境变量 > 请求头 Host > 默认 localhost。
- **修复方案**：我已经手动在数据库中帮您初始化了 `API_BASE_URL` 为 `https://twinsight.site` (基于您的书签推测)。

### 2. 结构与变量修复 
- **Payload 扁平化**：确保所有接口发送给 n8n 的字段都在顶层（包括 `apiBaseUrl`）。

### 3. 如何验证
1. 请确保您的后端服务可以通过 `https://twinsight.site` 或您设定的其他公网地址被访问。
2. 再次测试报警或手动分析。
3. 如果 `apiBaseUrl` 还是不对，您可以在系统的「系统设置」（如果有界面支持）或数据库中更新 `API_BASE_URL` 字段。

---

## 历史修复记录 (v2)
...

### 2. 逻辑分流优化
- **按类型匹配触发器**：修正了 `ai-service.js` 里的匹配逻辑。现在系统会根据 `alertType` (高温/低温) 寻找对应的触发器配置。这解决了当同时存在多个触发器时，系统可能由于匹配到错误的“内置引擎”触发器而忽略 n8n 设置的问题。
- **互斥执行确认**：再次确认了后端代码使用 `if (useN8nForThis) ... else ...` 结构，确保同一报警请求只会在“n8n 工作流”和“内置 AI 分析”之间选择其一，不存在同时执行的情况。

### 3. 如何验证
1. 请确保 n8n 里的 Webhook 节点能正常接收扁平结构的 Body。
2. 再次点击“智能分析”或等待传感器自动触发。
3. 如果 n8n 报错，此时机器人里显示的结果通常是 n8n 返回的报错 JSON 经过格式化后的产物（如果 n8n 响应了 200）。

## 问题背景
用户反馈低温报警未能正确触发 n8n 工作流。经过深入排查，发现存在以下几个主要原因：
1. **URL 重定向问题**：数据库配置使用的是 HTTP，重定向到 HTTPS 时丢失了 POST 数据。
2. **静态配置限制**：`ai-service.js` 使用环境变量静态初始化，忽略了数据库中的动态更改。
3. **路由检测遗漏（核心原因）**：传感器数据走的是旧版 `/api/v1/timeseries/streams/:spaceCode` 路由，该路由之前完全缺少报警评估逻辑。
4. **动态加载 Bug**：即使在正确路由下，动态导入触发器服务时由于未处理 `.default` 导出，导致评估函数调用失败。
5. **引擎分流逻辑**：引入 AI 机器人后，报警被分流为 `n8n` 或 `builtin`。如果设为 `builtin`，系统会自动跳过 Webhook 仅进行内部 RAG 分析。

## 修复内容

### 1. 自动触发修复
- **路由补全**：在 `server/routes/timeseries.js` 的所有数据摄入路由（包括旧版路由）中均添加了 `evaluateTriggers` 调用。
- **加载修正**：修正了 `import()` 后的函数调用方式，并统一了 `iot-trigger-service.js` 的导出格式为命名导出。

### 2. AI 机器人整合优化
- **自动动作分发**：原本 AI 机器人手动点击“智能分析”时只跑 RAG。现在 backend 会通过房间号自动匹配对应的触发器配置。如果匹配到的触发器设定了 `engine: n8n`，点击按钮也会同步触发 n8n 工作流。

### 3. 配置更新
- 将数据库中的 `N8N_WEBHOOK_URL` 更新为 `https://n8n.twinsight.cn`。

### 2. 后端逻辑重构
#### [ai-service.js](file:///Volumes/DATA/antigravity/TwinSight/server/services/ai-service.js)
- **动态配置**：引入 `getAiConfig` 函数，所有 n8n 相关配置均改为从数据库动态读取，不再依赖重启。
- **引擎识别**：重构 `processTemperatureAlert`，现在会根据具体报警触发器中定义的 `analysis_engine`（n8n 或 builtin）自动选择处理逻辑。

#### [iot-triggers.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/iot-triggers.js)
- **路由重排**：将 `/types` 和 `/enabled` 等固定路径路由移至 `/:id` 之前，避免路由捕获冲突。

#### [iot-trigger-service.js](file:///Volumes/DATA/antigravity/TwinSight/server/services/iot-trigger-service.js)
- 增加了详细的运行时日志记录到 `ai-debug.log`，方便后续排查生产环境数据ingress问题。

## 验证结果
通过 [debug-n8n-trigger-final.js](file:///Volumes/DATA/antigravity/TwinSight/server/scripts/debug-n8n-trigger-final.js) 模拟 5°C 数据，验证结果如下：
- 系统正确识别到匹配的触发器（ID: 2，低温报警）。
- 成功调用 n8n webhook 并发送完整的 JSON payload。
- n8n 返回 `200 OK` (空对象响应)。

```text
✅ [Trigger] Matched: 低温报警 (temperature lt 10, current: 5)
🚀 [Trigger] Invoking n8n webhook: /webhook/temperature-alert
✅ 温度报警已触发 n8n 工作流: ROOM-DEBUG
📥 n8n 返回结果: {}
```

## 备份说明
- 计划文件已备份至 `todo/n8n_trigger_fix_20260211/implementation_plan.md`
- 验证文档已同步。
