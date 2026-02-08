# AI Chat Module Implementation Walkthrough

## 1. 概述
本次更新实现了 TwinSight 的浮动 AI 对话窗口模块，支持以下核心能力：
- **浮动对话 UI**: 可拖拽、支持最小化/展开的对话面板。
- **上下文感知**: 自动识别当前选中的资产或空间，并作为 AI 上下文注入。
- **RAG 知识库**: 集成 Open WebUI 的 RAG 能力，支持基于上下文文档的问答。
- **多轮对话**: 支持携带历史消息进行连续对话。

## 2. 文件变更

### 2.1 新增组件
- `src/components/ai/AIChatPanel.vue`: 
  - 核心 UI 组件。
  - 使用 `@vueuse/core` 实现拖拽。
  - 支持 Markdown 渲染和来源引用展示。
  - 内部管理消息状态 (`messages`)。

### 2.2 后端服务更新
- `server/services/ai-service.js`:
  - 新增 `processChat` 方法：构建系统提示词、解析 KB ID、调用 RAG。
  - 优化 `formatAnalysisResult` 以支持通用文本格式化。
- `server/services/openwebui-service.js`:
  - 更新 `chatWithRAG` 方法：支持 `messages` 数组参数，适配 Open WebUI 的多轮对话接口。
- `server/routes/ai-analysis.js`:
  - 新增 `POST /api/ai/chat` 路由。

### 2.3 主视图集成
- `src/AppViewer.vue`:
  - 引入 `<AIChatPanel>` 组件。
  - 监听 `onModelSelectionChanged` 更新 `aiContext`。
  - 实现 `handleAIChatMessage` 方法，负责与后端通信传输消息和历史记录。

## 3. 使用说明

### 3.1 开启对话
1. 页面右下角新增 AI 悬浮球。
2. 点击悬浮球展开对话面板。

### 3.2 上下文注入
1. 在 3D 视图中点击任意资产或空间。
2. 对话面板上方会出现 "📍 正在讨论: [对象名称]" 的提示。
3. 此时发送的问题将优先基于该对象的属性和关联文档回答。

### 3.3 文档引用
1. AI 回复中引用的文档（如 `[1]`）支持点击。
2. 点击后可触发文档预览（需对接文档预览路由）。

## 4. 后续计划 (Phase 2)
- 图表多模态输出 (ECharts)。
- BIM 模型操作指令 (Highlighter)。
- 上下文菜单集成。

## 5. Phase 2 更新：时序数据与图表集成
本次更新实现了 AI 对接 InfluxDB 数据的能力：

### 5.1 后端服务
- 创建 ，封装了  和  方法。
- 更新 ，增加了工具调用（Tool Calling）机制：
  - System Prompt 增加工具调用指令说明。
  -  中解析  指令，自动执行查询。
  - 查询结果注入回 LLM 进行二次总结。
  - 返回数据中包含  对象。

### 5.2 前端可视化
- 更新 ：
  - 集成 。
  - 当消息包含  时，自动渲染迷你图表。
  - 移除了无用的  依赖。

### 5.3 交互流程
1. 用户提问：“显示最近一周的温度趋势”。
2. AI 识别意图，输出 。
3. 后端执行 InfluxDB 查询。
4. 后端生成统计摘要和图表数据。
5. AI 根据统计摘要生成文本回复。
6. 前端同时展示文本回复和温度趋势图。
