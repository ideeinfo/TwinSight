# 更新 n8n 工作流以支持设备分类

## 目标
更新 n8n 工作流文件 (`Temperature Alert Analysis Workflow.json`)，使其能够利用后端 API 返回的设备分类 (`category`) 信息。这将防止 AI 在 n8n 模式下将无关设备（如水箱）误认为是传感器。

## 背景
之前已修改后端 `getContextData` 函数，使其在返回设备列表时包含 `category` 字段。n8n 工作流通过调用 `/api/ai/context` 获取此数据，但在构建 Prompt 时尚未利用该字段。

## 变更计划

### n8n 工作流

#### [NEW] [Temperature Alert Analysis Workflow_v2.json](file:///Volumes/DATA/antigravity/TwinSight/n8n-workflows/Temperature%20Alert%20Analysis%20Workflow_v2.json)
*   基于原 `Temperature Alert Analysis Workflow.json` 创建。
*   **修改节点**: "构建 RAG Prompt" (Node ID: `c07ef2c2-9c19-4c27-98c0-3c74fa5141ef`)
*   **修改内容**: 更新 JavaScript 代码，在构建设备列表时包含分类信息。
    *   **Old**: `` `- ${a.name} (${a.asset_code})` ``
    *   **New**: `` `- ${a.name} (${a.asset_code}) [${a.category || '其它设备'}]` ``

## 验证计划
1.  **文件生成**: 确认生成了 `_v2.json` 文件且 JSON 格式有效。
2.  **代码检查**: 检查生成的 JSON 文件中，"构建 RAG Prompt" 节点的 `jsCode` 字段是否包含新的格式化逻辑。
3.  **用户操作**: 用户需手动将此 JSON 文件导入 n8n 进行更新测试。

## 用户审查
此操作将生成一个新的 JSON 文件，不会覆盖原文件。
