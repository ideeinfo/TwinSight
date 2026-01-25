# 优化 AI 分析中的设备上下文以防止误分类

## 目标
解决 AI 在分析时将无关设备（如 "WT..." 开头的设备）错误识别为温度传感器的问题。原因是 Prompt 中只提供了设备名称和编码，缺乏明确的设备类型/分类信息，导致 LLM 根据编码猜测（Hallucination）。

## 问题分析
1.  **现状**：
    *   `getContextData` 函数只查询 `assets` 表，获取 `name` 和 `asset_code`。
    *   Prompt 中生成的设备列表格式为：`- 设备名 (编码)`。
    *   对于 n8n 模式，虽然 Node.js 后端不发送设备列表，但用户反馈暗示 n8n 侧存在类似问题（可能是 n8n 查询了类似的上下文）。
2.  **原因**：
    *   缺乏设备类型信息。例如 `WT0153` 可能是水箱 (Water Tank)，但 LLM 看到 "温度报警" 上下文，容易将其猜为 "Wireless Temperature"。
3.  **解决方案**：
    *   修改 `getContextData` 查询，关联 `asset_specs` 表获取 `category` (分类) 或 `family` (族) 信息。
    *   在 Prompt 中显式包含分类信息：`- 设备名 (编码) [分类]`。

## 变更计划

### 后端 (Server)

#### [MODIFY] [ai-analysis.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/ai-analysis.js)
1.  **`getContextData` 函数**：
    *   修改 SQL 查询，使用 `LEFT JOIN asset_specs` 获取 `category` 字段。
    *   列别名优化。

2.  **Prompt 构建逻辑 (Direct Open WebUI 模式)**：
    *   更新 `context.assets.map` 逻辑，在设备列表中追加 `[category]` 信息。

## 验证计划
1.  **直接模式验证**：
    *   切换 `USE_N8N_WORKFLOW=false` (临时)。
    *   触发温度报警。
    *   观察控制台输出的 Prompt，确认包含 `[分类]`。
    *   查看 AI 回复，确认不再将非传感器设备列为传感器。
2.  **n8n 模式建议**：
    *   由于 n8n 逻辑在外部，我将通知用户：如果在 n8n 中遇到此问题，需要在 n8n 的 SQL 节点中应用同样的 JOIN 逻辑，并在 Prompt 中提供分类信息。

## 用户审查
*   **注意**：此修复直接改进 Direct Mode。对于 n8n 模式，如果 n8n 是独立查询数据的，用户需要手动更新 n8n 工作流。如果 n8n 是依赖此 API 的（虽然目前看不是），则会自动生效。根据分析，n8n 极有可能是独立查询，因此将作为"建议"告知用户。
