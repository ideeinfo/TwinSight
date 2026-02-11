# Fix n8n Webhook Trigger (HTTP -> HTTPS Redirect)

## Goal Description
The low temperature alarm is failing to trigger the n8n workflow because the system is configured with an `http://` URL for n8n, but the server redirects to `https://`. This 301 redirect causes the `POST` request (with payload) to be converted to a `GET` request (without payload), which the n8n webhook rejects.

This change will update the `N8N_WEBHOOK_URL` configuration to use `https://` directly, avoiding the redirect and preserving the `POST` method and payload.

## User Review Required
> [!NOTE]
> This change updates a system configuration value in the database.

## Proposed Changes

### Server Configuration

#### [UPDATE] System Configuration
- Update the `value` of `N8N_WEBHOOK_URL` in the `system_config` table from `http://n8n.twinsight.cn` to `https://n8n.twinsight.cn`.

### 后端服务 (Backend Services)

#### [MODIFY] [ai-service.js](file:///Volumes/DATA/antigravity/TwinSight/server/services/ai-service.js)
- 将 `USE_N8N_WORKFLOW`、`N8N_BASE_URL` 等静态配置改为在 `processTemperatureAlert` 内部通过 `getConfig` 动态获取。
- 确保手动触发分析时也能正确使用数据库配置的 n8n 工作流。

#### [MODIFY] [iot-triggers.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/iot-triggers.js)
- 重新排列路由顺序，确保 `/enabled` 和 `/types` 等固定路径路由在 `/:id` 变量路径路由之前定义，解决路由冲突导致 404/500 的问题。

#### [MODIFY] [iot-trigger-service.js](file:///Volumes/DATA/antigravity/TwinSight/server/services/iot-trigger-service.js)
- 保留或清理调试日志。

## Verification Plan

### Automated Tests
- Run `node scripts/debug-n8n-trigger-final.js` again.
- Expect output `✅ 温度报警已触发 n8n 工作流` instead of `❌ n8n Webhook 调用失败`.
- Expect n8n to return a success response (likely JSON).

### Manual Verification
- N/A (Automated script covers the scenario).
