# 修复 n8n 模式下文档引用不可见的问题

## 问题描述
用户反馈在切换到 n8n 模式后，AI 分析界面中看不到资产和房间对应的文档。
经排查，`server/routes/ai-analysis.js` 的 n8n 处理逻辑（n8n branch）存在缺陷：
1.  **来源过滤过严**：仅返回在文本中被显式引用（如 `[1]`）的文档。如果 AI 未引用，则列表为空。
2.  **缺失兜底机制**：Direct 模式在无来源时会将所有“上下文文档”作为相关文档返回，n8n 模式无此逻辑。
3.  **缺失文本扫描**：Direct 模式会扫描文本中出现的文档名称并自动将其加入来源，n8n 模式缺失。

## 涉及变更
### 后端路由 (Server)
#### [MODIFY] [ai-analysis.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/ai-analysis.js)
在 n8n 处理分支（`if (USE_N8N_WORKFLOW)` 块内）同步 Direct 模式的增强逻辑：
1.  **文本扫描 (Text Scanning)**：在返回前，扫描 `analysisText` 匹配 `contextDocs` 中的文件名，若匹配则加入来源。
2.  **兜底逻辑 (Fallback)**：如果最终 `formattedSources` 为空且存在 `contextDocs`，将所有上下文文档作为来源返回。
3.  **名称链接化 (Name Linking)**：对确认为来源的文档，并在文本中出现的纯名称进行 HTML 链接化处理。

## 逻辑详情
1.  保留现有的 `sourceIndexMap` 处理逻辑。
2.  在 `analysisText` 初步处理后，引入与 Direct 模式相同的 `sources` 数组构建逻辑。
3.  确保 `formattedSources` 包含：
    *   n8n 返回并被引用的源。
    *   文本中提及文件名的源。
    *   (若无上述两种) 上下文中的所有文档。

## 验证计划
### 手动验证
1.  再次触发温度报警分析。
2.  确保 n8n 返回分析结果。
3.  检查前端界面的“参考文档”或“来源”部分，确认是否显示了相关文档（即使 AI 未显式引用）。
