基于我们刚才的深度讨论，我为您重新修订了实施计划。

**核心变更点：**

1. **架构确立**：明确了 **TwinSight (原子能力提供者)** + **AI Hub (智能编排中心)** 的双容器架构。
2. **规则引擎选型**：锁定 **`json-rules-engine`**，确立了 "AI 生成 JSON -> 引擎执行" 的技术路线。
3. **交互升级**：增加了 **AI Hub Admin** 独立管理界面，支持自然语言生成规则和 n8n Webhook 适配。
4. **通信协议**：明确了 **MCP** 用于对外（AI 客户端），**WebSocket** 用于对内（控制前端导航）。

---

# AI 能力中心 (AI Hub) 重构实施计划 v3.0

> **核心目标**：解耦业务代码与 AI 逻辑，实现用户“零代码”配置规则，并通过 MCP 协议将 TwinSight 能力标准化暴露给外部世界。

## 1. 系统架构概览

### 1.1 核心设计理念

* **TwinSight (现有)**：退化为“手脚”。只提供原子 API（查数据、查资产）和执行指令（页面跳转、高亮构件）。
* **AI Hub (新建)**：升级为“大脑”。负责语义理解（MCP）、逻辑判断（规则引擎）和任务分发。

### 1.2 架构拓扑

```mermaid
graph TD
    %% 外部交互层
    subgraph External [外部接入]
        User[用户 / 管理员]
        Claude[Claude Desktop / AI Agent]
        N8N[n8n 自动化平台]
    end

    %% 新建容器
    subgraph AI_Hub_Container [Docker: AI Hub Service (:4000)]
        MCPServer[MCP Server Interface]
        RuleEngine[JSON Rules Engine]
        AdminAPI[Admin REST API]
        AIGen[Claude Generator (生成规则)]
    end

    %% 现有容器
    subgraph TwinSight_Container [Docker: TwinSight Core (:3001)]
        TS_API[API Gateway]
        TS_WS[WebSocket Service]
        
        subgraph Atomic_Modules [原子能力模块]
            Nav[导航控制]
            Power[电源追溯]
            Asset[资产查询]
            Alarm[报警执行]
        end
    end

    %% 浏览器端
    subgraph Frontend [浏览器 / 终端]
        AdminUI[AI Hub 管理后台 (Vue3)]
        TS_UI[TwinSight 主界面]
    end

    %% 连线关系
    Claude -- MCP 协议 --> MCPServer
    User -- HTTP --> AdminUI
    AdminUI -- REST --> AdminAPI
    N8N -- Webhook --> AdminAPI
    
    MCPServer -- 语义映射 --> TS_API
    RuleEngine -- 触发指令 --> TS_WS
    TS_WS -- 实时控制 --> TS_UI
    
    AdminAPI -- 调用 --> AIGen
    AIGen -- 生成配置 --> RuleEngine

```

---

## 2. 技术选型与栈

| 模块 | 选型 | 理由 |
| --- | --- | --- |
| **规则引擎** | **json-rules-engine** | Node.js 原生，JSON 格式对 LLM 极其友好，支持事实 (Fact) 动态加载。 |
| **对外协议** | **Model Context Protocol (MCP)** | 标准化 AI 接口，支持 Claude Desktop 直接连接，未来扩展性强。 |
| **管理前端** | **Vue 3 + Element Plus** | 快速开发，与 TwinSight 技术栈统一，易于集成可视化组件。 |
| **AI 生成** | **Claude 3.5 Sonnet API** | 用于将用户的自然语言需求转换为 json-rules-engine 的配置。 |
| **通信管道** | **WebSocket (Socket.io)** | 实现 AI Hub 对 TwinSight 前端界面的实时控制（如导航跳转）。 |

---

## 3. 详细实施步骤

### 阶段一：TwinSight 原子化改造 (现有系统清理)

**目标**：剥离复杂的判断逻辑，暴露纯粹的“原子”能力。

1. **原子 API 封装**：
* `GET /api/atomic/assets`: 暴露基于 81346 编码的精准查询。
* `GET /api/atomic/power-trace`: 纯粹的电源路径计算，不带任何业务描述。
* `POST /api/atomic/alarm`: 纯粹的报警写入接口。


2. **WebSocket 控制通道建设**：
* 在 TwinSight 后端建立专用 WebSocket 频道。
* **前端监听器**：在 `App.vue` 或全局 Store 中挂载监听，响应 `Maps_TO` (页面跳转)、`HIGHLIGHT_DEVICE` (构件高亮) 指令。


3. **清理旧代码**：
* 逐步废弃庞大的 `ai-service.js`。
* 移除硬编码的温度报警逻辑 (`if temp > 30...`)。



### 阶段二：AI Hub 核心构建 (新容器)

**目标**：搭建独立 Docker 服务，跑通 MCP 和规则引擎。

1. **环境搭建**：
* 初始化 Node.js TypeScript 项目。
* 配置 `docker-compose.yml`，映射端口 4000。


2. **MCP Server 实现**：
* 引入 `@modelcontextprotocol/sdk`。
* 注册 Tools：`search_asset`, `trace_power`, `control_navigation`。
* 实现 Tool Handler：收到指令后，通过 HTTP 请求调用 TwinSight 原子 API。


3. **规则引擎集成**：
* 安装 `json-rules-engine`。
* **事实适配器 (Almanac)**：编写适配层，当规则需要 `gearbox_temp` 时，自动调用 TwinSight API 获取实时数据。
* **事件发射器**：当规则满足时，触发 Webhook 或 WebSocket 推送。



### 阶段三：可视化配置中心 (Admin UI)

**目标**：实现“自然语言 -> 规则上线”的闭环。

1. **管理界面开发**：
* **技能注册页**：查看当前暴露了哪些 MCP 工具。
* **规则配置页**：
* 输入框：“当 1 号风机温度超过 75 度时报警”。
* 按钮：“AI 生成”。
* 展示区：使用 `vue-json-pretty` 或简易表单展示生成的 JSON。




2. **AI 生成服务 (Backend)**：
* 编写 System Prompt，注入数据字典（包含有哪些传感器、哪些 API）。
* 调用 Claude API，输出符合 `json-rules-engine` Schema 的 JSON。


3. **模拟测试沙箱**：
* 提供“模拟运行”按钮。
* 用户输入模拟数据（如 `temp=80`），后端跑一遍引擎，返回结果（True/False），无需等待真实 IoT 数据。



### 阶段四：集成与 N8N 适配

1. **N8N Webhook 适配器**：
* 在 AI Hub 暴露 `/webhook/n8n/trigger`。
* 将收到的 N8N 请求标准化为规则引擎的一个 Fact，纳入统一评估。


2. **端到端联调**：
* **场景测试**：在 Claude Desktop 输入“带我去故障点”，验证：
* Claude -> MCP -> AI Hub -> WebSocket -> TwinSight 前端跳转。





---

## 4. 数据结构规范

### 4.1 规则存储结构 (PostgreSQL: `ai_rules`)

```json
{
  "rule_id": "rule_001",
  "name": "齿轮箱高温报警",
  "description": "自然语言描述：当齿轮箱温度>75且风机运行中...",
  "enabled": true,
  "priority": 10,
  "engine_config": {
    "conditions": {
      "all": [
        {
          "fact": "sensor_reading",
          "path": "$.value",
          "operator": "greaterThan",
          "value": 75,
          "params": { "sensor_code": "=A1.GR1.Temp" } // 81346 编码
        }
      ]
    },
    "event": {
      "type": "dispatch_alert",
      "params": { "level": "critical", "msg": "过热风险" }
    }
  }
}

```

### 4.2 MCP Tool 定义示例

```typescript
{
  name: "navigate_system",
  description: "控制前端界面跳转到指定模块或设备",
  inputSchema: {
    type: "object",
    properties: {
      target: { type: "string", description: "模块名称或设备81346编码" },
      action: { type: "string", enum: ["view", "highlight", "isolate"] }
    }
  }
}

```

---

## 5. 进度里程碑

* **Week 1**: TwinSight 原子 API 剥离，WebSocket 控制通道打通。
* **Week 2**: AI Hub 容器跑通，实现基础 MCP Server (可被 Claude Desktop 连接)。
* **Week 3**: 集成 `json-rules-engine`，实现后台 Admin UI 及 AI 规则生成功能。
* **Week 4**: 迁移现有硬编码逻辑（温度报警、电源追踪）至新架构，全面上线。