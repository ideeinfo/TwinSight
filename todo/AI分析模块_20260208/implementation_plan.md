# TwinSight AI 分析模块 - 架构设计与实施计划

## 1. 现状分析

### 1.1 已有能力
| 组件 | 功能 | 状态 |
|------|------|------|
| `n8n-service.js` | 温度报警触发、手动分析请求 | ✅ 已实现 |
| `openwebui-service.js` | RAG 知识库管理、文档同步、对话接口 | ✅ 已实现 |
| `ai-service.js` | AI 分析逻辑、来源引用解析 | ✅ 已实现 |
| `AIAnalysisModal.vue` | 分析结果弹窗展示 | ✅ 已实现 |
| `isAIAnalysisEnabled` | 温度阈值自动触发开关 | ✅ 已实现 |

### 1.2 待解决问题
- AI 功能零散分布，缺乏统一入口和配置管理
- 触发方式单一（仅温度阈值）
- 输出形式有限（仅文本）
- 缺乏对话交互能力
- 无法与 BIM 模型联动
- 缺乏 MCP 协议接口供外部调用

---

## 2. 架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TwinSight AI 分析模块                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        触发层 (Trigger Layer)                        │   │
│  ├─────────────────┬─────────────────┬─────────────────┬───────────────┤   │
│  │   阈值触发      │   上下文菜单    │   对话触发      │   MCP 调用    │   │
│  │   (IoT/传感器)  │   (资产/空间)   │   (Chat UI)     │   (外部 AI)   │   │
│  └────────┬────────┴────────┬────────┴────────┬────────┴───────┬───────┘   │
│           │                 │                 │                │           │
│  ┌────────▼─────────────────▼─────────────────▼────────────────▼───────┐   │
│  │                    调度层 (Orchestration Layer)                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │              AI Analysis Controller (统一入口)               │    │   │
│  │  │  - 分析任务管理 (队列/调度)                                   │    │   │
│  │  │  - 配置解析 (分析类型 → 执行策略)                             │    │   │
│  │  │  - 上下文构建器 (Context Builder)                            │    │   │
│  │  │  - 结果格式化 (Output Formatter)                             │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│  ┌──────────────────────────────▼──────────────────────────────────────┐   │
│  │                    执行层 (Execution Layer)                          │   │
│  │  选项 A: n8n 工作流模式        │    选项 B: 编码 Agent 模式          │   │
│  │  ┌────────────────────────┐   │   ┌────────────────────────────┐   │   │
│  │  │ n8n Workflow Engine    │   │   │ Python Agent (FastAPI)     │   │
│  │  │ - 低代码配置           │   │   │ - 灵活的工具调用           │   │
│  │  │ - 可视化调试           │   │   │ - Skills 系统              │   │
│  │  │ - 易于维护             │   │   │ - 复杂推理能力             │   │
│  │  └────────────────────────┘   │   └────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                          │
│  ┌──────────────────────────────▼──────────────────────────────────────┐   │
│  │                    能力层 (Capability Layer)                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ RAG 检索 │ │ 文本生成 │ │ 图表生成 │ │ BIM 控制 │ │ 代码执行 │  │   │
│  │  │ OpenWebUI│ │ LLM API  │ │ ECharts  │ │ Forge API│ │ Sandbox  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                          │
│  ┌──────────────────────────────▼──────────────────────────────────────┐   │
│  │                    输出层 (Output Layer)                             │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐            │   │
│  │  │ 文本/MD   │ │ 图表/图像 │ │ BIM 高亮  │ │ 音频 TTS  │            │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 技术选型建议

#### 执行引擎选择：混合模式 (推荐)

| 维度 | n8n 工作流 | 编码 Agent |
|------|-----------|-----------|
| **优势** | 低代码、可视化、易维护 | 灵活、复杂推理、工具丰富 |
| **劣势** | 复杂逻辑难实现 | 需要编码、调试复杂 |
| **适用场景** | 简单触发-响应流程 | 多步推理、动态决策 |

**推荐策略**：
1. **简单分析** (如温度告警建议) → 继续使用 **n8n 工作流**
2. **复杂分析** (如停电影响分析、多步推理) → 使用 **Python Agent + Skills**
3. **对话交互** → **Agent 模式** (支持多轮对话、上下文记忆)
4. **MCP 接口** → 在 **logic-engine (FastAPI)** 中实现

#### 核心框架决策：PydanticAI (Lightweight) vs LangChain (Heavy)

**决策**：采用 **PydanticAI** + **FastAPI**，**不引入** 传统的 LangChain Chains/Agents 模块。

**理由**：
1. **类型安全**：PydanticAI 原生支持 Pydantic 模型，确保 LLM 输出严格符合 JSON Schema，对 BIM 控制指令至关重要。
2. **可控性**：避免 LangChain 的 "Black Box" 抽象，Prompt 和逻辑流完全透明可控。
3. **性能**：轻量级依赖，无额外调用开销。
4. **兼容性**：完美契合现有的 FastAPI 后端架构。

---

## 3. 核心组件设计

### 3.1 UI 设计规范 (简约科技风格)

**设计关键词**：
- **Glassmorphism**: 半透明磨砂玻璃背景，营造深度感。
- **Minimalist**: 无边框设计，仅保留必要元素，图标化操作。
- **Tech Blue/Neon**: 使用科技蓝 (#00f2ff, #2979ff) 作为强调色，配合微发光效果。
- **Theme Adaptive**: 
  - **深色模式**: 深灰/黑半透明背景，白色文字，霓虹光晕。
  - **浅色模式**: 浅灰/白半透明背景，深色文字，柔和阴影。

### 3.2 统一 AI 对话窗口

**设计要点**：
- **悬浮球激活**：平时收起为一个带有微动效的悬浮图标（如脉冲光环）。
- **流畅过渡**：展开/收起具有平滑的缩放和透明度动画。
- **打字机效果**：AI 回复时模拟真实的打字输入感。
- **代码/Markdown 渲染**：支持代码高亮和 Markdown 格式。

```typescript
// 分析类型配置 (存储在数据库或配置文件)
interface AIAnalysisConfig {
  id: string;
  name: string;                      // "温度告警分析"
  description: string;
  enabled: boolean;
  
  // 触发配置
  trigger: {
    type: 'threshold' | 'context_menu' | 'chat' | 'mcp' | 'schedule';
    conditions?: ThresholdCondition[];   // 阈值条件
    targetTypes?: ('asset' | 'space' | 'power_node')[];  // 适用对象
  };
  
  // 上下文配置
  context: {
    scope: 'auto' | 'manual';           // 自动判别或手动指定
    includes: ('properties' | 'documents' | 'relations' | 'history' | 'topology')[];
    maxDepth?: number;                   // 关系遍历深度
  };
  
  // RAG 配置
  rag: {
    enabled: boolean;
    knowledgeBases: 'auto' | string[];   // 自动匹配或指定
    searchMode: 'semantic' | 'hybrid';
    topK: number;
  };
  
  // 处理配置
  processing: {
    engine: 'n8n' | 'agent';
    workflow?: string;                   // n8n workflow ID
    agentSkills?: string[];              // Agent skills
    model: string;                       // LLM 模型
    systemPrompt?: string;
  };
  
  // 输出配置
  output: {
    formats: ('text' | 'markdown' | 'chart' | 'bim_action' | 'audio')[];
    bimActions?: BIMAction[];            // BIM 模型操作
  };
}
```

### 3.2 统一 AI 对话窗口

**设计要点**：
- 浮动可拖拽
- 支持多轮对话
- 支持上下文注入 (当前选中对象)
- 支持多模态输出展示
- 可执行 BIM 模型操作

```vue
<!-- src/components/AIChatPanel.vue 概念设计 -->
<template>
  <div class="ai-chat-panel" :class="{ minimized, maximized }">
    <!-- 标题栏：可拖拽 -->
    <div class="chat-header" @mousedown="startDrag">
      <span>🤖 AI 助手</span>
      <div class="header-actions">
        <button @click="minimized = !minimized">_</button>
        <button @click="maximized = !maximized">□</button>
        <button @click="$emit('close')">×</button>
      </div>
    </div>
    
    <!-- 上下文提示区 -->
    <div v-if="currentContext" class="context-bar">
      <span>📍 当前上下文：{{ currentContext.name }}</span>
      <button @click="clearContext">清除</button>
    </div>
    
    <!-- 消息列表 -->
    <div class="chat-messages" ref="messagesContainer">
      <div v-for="msg in messages" :key="msg.id" :class="['message', msg.role]">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="user-message">
          {{ msg.content }}
        </div>
        
        <!-- AI 回复：支持多模态 -->
        <div v-else class="ai-message">
          <!-- 文本/Markdown -->
          <div v-if="msg.type === 'text'" v-html="renderMarkdown(msg.content)"></div>
          
          <!-- 图表 -->
          <div v-if="msg.type === 'chart'" class="chart-container">
            <EChartsComponent :option="msg.chartData" />
          </div>
          
          <!-- BIM 操作按钮 -->
          <div v-if="msg.bimActions" class="bim-actions">
            <button v-for="action in msg.bimActions" 
                    @click="executeBIMAction(action)">
              {{ action.label }}
            </button>
          </div>
          
          <!-- 来源引用 -->
          <div v-if="msg.sources" class="sources">
            <span v-for="src in msg.sources" @click="openSource(src)">
              📄 {{ src.name }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 输入区 -->
    <div class="chat-input">
      <textarea v-model="inputText" @keydown.enter.ctrl="sendMessage" 
                placeholder="输入问题... (Ctrl+Enter 发送)"></textarea>
      <button @click="sendMessage" :disabled="loading">
        {{ loading ? '思考中...' : '发送' }}
      </button>
    </div>
  </div>
</template>
```

### 3.3 MCP 协议接口

**目的**：允许外部 AI 系统（如桌面 Claude、其他 Agent）调用 TwinSight 能力

**实现位置**：`logic-engine` (FastAPI)

```python
# logic-engine/routers/mcp.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

router = APIRouter(prefix="/mcp", tags=["MCP Protocol"])

# MCP 资源定义
class MCPResource(BaseModel):
    uri: str
    name: str
    description: str
    mimeType: str

# MCP 工具定义
class MCPTool(BaseModel):
    name: str
    description: str
    inputSchema: Dict[str, Any]

# 列出可用资源
@router.get("/resources")
async def list_resources() -> List[MCPResource]:
    """
    返回 TwinSight 可暴露的资源列表
    - 资产列表
    - 空间列表
    - 电源拓扑
    - 文档列表
    """
    return [
        MCPResource(
            uri="twinsight://assets",
            name="资产列表",
            description="获取当前模型的所有资产",
            mimeType="application/json"
        ),
        MCPResource(
            uri="twinsight://spaces",
            name="空间列表",
            description="获取当前模型的所有空间",
            mimeType="application/json"
        ),
        MCPResource(
            uri="twinsight://power-topology",
            name="电源拓扑",
            description="获取电源网络拓扑结构",
            mimeType="application/json"
        ),
    ]

# 列出可用工具
@router.get("/tools")
async def list_tools() -> List[MCPTool]:
    """
    返回 TwinSight 可调用的工具列表
    """
    return [
        MCPTool(
            name="highlight_objects",
            description="在 BIM 模型中高亮指定对象",
            inputSchema={
                "type": "object",
                "properties": {
                    "object_ids": {"type": "array", "items": {"type": "string"}},
                    "color": {"type": "string", "default": "#FF0000"}
                },
                "required": ["object_ids"]
            }
        ),
        MCPTool(
            name="trace_power_upstream",
            description="追溯电源上游拓扑",
            inputSchema={
                "type": "object",
                "properties": {
                    "device_code": {"type": "string"}
                },
                "required": ["device_code"]
            }
        ),
        MCPTool(
            name="analyze_impact",
            description="分析设备故障影响范围",
            inputSchema={
                "type": "object",
                "properties": {
                    "device_code": {"type": "string"},
                    "failure_type": {"type": "string", "enum": ["power_off", "malfunction"]}
                },
                "required": ["device_code"]
            }
        ),
        MCPTool(
            name="query_rag",
            description="使用 RAG 查询知识库",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "knowledge_base_id": {"type": "string", "optional": True}
                },
                "required": ["query"]
            }
        ),
    ]

# 读取资源
@router.post("/resources/read")
async def read_resource(uri: str):
    """根据 URI 读取资源内容"""
    # 解析 URI 并返回对应数据
    ...

# 调用工具
@router.post("/tools/call")
async def call_tool(name: str, arguments: Dict[str, Any]):
    """调用指定工具"""
    # 根据 name 分发到对应处理函数
    ...
```

---

## 4. 实施计划

### 阶段一：基础对话能力 (1-2 周)

**目标**：实现浮动 AI 对话窗口，支持基本的问答和 RAG 检索

| 任务 | 描述 | 工作量 |
|------|------|--------|
| 4.1.1 | 创建 `AIChatPanel.vue` 浮动对话组件 | 2天 |
| 4.1.2 | 实现对话消息管理 (发送/接收/历史) | 1天 |
| 4.1.3 | 集成现有 `ai-service.js` 的 RAG 能力 | 1天 |
| 4.1.4 | 实现上下文注入 (选中对象自动作为上下文) | 1天 |
| 4.1.5 | Markdown 渲染和来源引用点击 | 1天 |

**交付物**：
- [x] 可拖拽的浮动 AI 对话窗口
- [x] 支持多轮对话
- [x] 支持 RAG 知识库检索
- [x] 支持文档来源点击预览

### 阶段二：多模态输出 (1 周)

**目标**：支持图表、BIM 模型操作等多模态输出

| 任务 | 描述 | 工作量 |
|------|------|--------|
| 4.2.1 | 设计统一的 AI 响应格式 (支持多模态) | 0.5天 |
| 4.2.2 | 图表渲染组件 (复用 ECharts) | 1天 |
| 4.2.3 | BIM 操作指令协议设计 | 1天 |
| 4.2.4 | BIM 高亮/隔离/定位执行器 | 1天 |
| 4.2.5 | 前端多模态消息渲染 | 1天 |

**交付物**：
- [x] AI 可返回 ECharts 图表
- [x] AI 可操控 BIM 模型 (高亮、隔离、定位)

### 阶段三：上下文菜单触发 (0.5 周)

**目标**：从资产/空间/电源节点右键菜单触发 AI 分析

| 任务 | 描述 | 工作量 |
|------|------|--------|
| 4.3.1 | 设计通用的上下文菜单 AI 入口 | 0.5天 |
| 4.3.2 | 资产右键菜单 "AI 分析" | 0.5天 |
| 4.3.3 | 空间右键菜单 "AI 分析" | 0.5天 |
| 4.3.4 | RDS 电源节点右键菜单 "AI 分析" | 0.5天 |

**交付物**：
- [x] 右键任意对象可触发 AI 分析

### 阶段四：配置化分析类型 (1 周)

**目标**：将现有温度阈值分析迁移为配置项，并支持新增分析类型

| 任务 | 描述 | 工作量 |
|------|------|--------|
| 4.4.1 | 设计分析配置数据结构和数据库表 | 1天 |
| 4.4.2 | 将温度阈值分析迁移为配置 | 1天 |
| 4.4.3 | 新增 "停电影响分析" 配置 | 1天 |
| 4.4.4 | 系统设置面板：AI 分析配置管理 | 2天 |

**交付物**：
- [x] 温度分析作为可配置项
- [x] 新增停电影响分析能力
- [x] 系统设置中可管理 AI 分析配置

### 阶段五：MCP 协议接口 (1 周)

**目标**：实现 MCP 协议，供外部 AI 系统调用

| 任务 | 描述 | 工作量 |
|------|------|--------|
| 4.5.1 | 在 logic-engine 中实现 MCP 资源接口 | 1天 |
| 4.5.2 | 实现 MCP 工具接口 (高亮/追溯/分析) | 2天 |
| 4.5.3 | WebSocket 实时事件推送 | 1天 |
| 4.5.4 | MCP 接口文档和测试 | 1天 |

**交付物**：
- [x] 外部 AI 可通过 MCP 读取 TwinSight 数据
- [x] 外部 AI 可通过 MCP 调用 TwinSight 工具

---

## 5. 第一阶段详细设计

### 5.1 文件结构

```
src/
├── components/
│   ├── ai/
│   │   ├── AIChatPanel.vue          # 主对话面板
│   │   ├── AIChatMessage.vue        # 消息组件
│   │   ├── AIContextBadge.vue       # 上下文标签
│   │   ├── AIChartOutput.vue        # 图表输出
│   │   └── AIBIMActionButton.vue    # BIM 操作按钮
│   └── viewer/
│       └── AIAnalysisModal.vue       # 现有 (保留)
├── composables/
│   └── useAIChat.js                  # 对话状态管理
├── services/
│   └── ai-chat.js                    # 对话 API 封装

server/
├── routes/
│   └── ai-chat.js                    # 对话 API 路由
├── services/
│   ├── ai-service.js                 # 现有 (扩展)
│   └── ai-context-builder.js         # 上下文构建器 (新增)

logic-engine/
└── routers/
    └── mcp.py                        # MCP 协议接口
```

### 5.2 API 设计

```yaml
# 对话 API
POST /api/ai/chat
Request:
  message: string           # 用户消息
  conversationId?: string   # 对话 ID (多轮)
  context?: {               # 上下文
    type: 'asset' | 'space' | 'power_node'
    id: string
    properties: object
  }
  options?: {
    useRAG: boolean
    knowledgeBaseId?: string
  }

Response:
  conversationId: string
  message: {
    role: 'assistant'
    content: string         # Markdown 文本
    chart?: object          # ECharts option
    bimActions?: [          # BIM 操作
      { action: 'highlight', params: { dbIds: [...] } }
    ]
    sources?: [             # 来源引用
      { id, name, type }
    ]
  }
```

---

## 6. 风险与应对

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| LLM 响应延迟过长 | 中 | 用户体验差 | 流式输出、进度提示 |
| 复杂分析超出 n8n 能力 | 高 | 功能受限 | 采用混合模式，复杂逻辑用 Agent |
| MCP 协议兼容性 | 中 | 外部接入困难 | 严格遵循 MCP 规范 |
| 多模态输出渲染复杂 | 中 | 开发周期延长 | 分阶段交付，先文本后图表 |

---

## 7. 成功指标

| 指标 | 目标值 |
|------|--------|
| 对话响应时间 | < 5s (首个 token) |
| RAG 检索准确率 | > 80% |
| BIM 操作成功率 | > 95% |
| MCP 接口覆盖率 | 核心功能 100% |

---

## 8. 总结

本方案采用 **混合执行引擎** 架构：
- **简单流程** → n8n 工作流（低代码、易维护）
- **复杂推理** → Python Agent（灵活、多工具）
- **外部接入** → MCP 协议（标准化、可扩展）

第一阶段聚焦于 **浮动对话窗口 + RAG 能力**，为后续多模态输出和复杂分析打下基础。

---

*文档版本: v1.0*
*创建日期: 2026-02-08*
*作者: AI Assistant*
