# IoT 报警与 AI 对话窗口集成 (V2)

## 目标

将温度报警功能统一移植到 AI 机器人对话窗口，支持**每个报警独立配置**分析引擎（n8n 工作流 / 内置分析模块），并预留扩展接口以支持未来新增的 IoT 触发事件。

## 现状分析

当前实现：
- `MainView.vue` 触发温度报警 → `triggerTemperatureAlert` → 后端 `ai-service.js`
- **全局** `USE_N8N` 开关控制是否走 n8n
- 固定 webhook 路径：`/webhook/temperature-alert`
- 结果显示在独立的 `AIAnalysisModal.vue` 弹窗

**问题**：
1. 全局 n8n 开关无法为不同报警类型配置不同工作流
2. 无法从 n8n 动态获取可用工作流列表
3. 报警弹窗与 AI 对话窗口分离

---

## 阶段一：IoT 触发器配置系统

### 数据库

#### [NEW] [20xx-iot-triggers.cjs](file:///Volumes/DATA/antigravity/TwinSight/server/migrations/20xx-iot-triggers.cjs)

```sql
CREATE TABLE iot_triggers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,           -- 触发器名称
  type VARCHAR(50) NOT NULL,            -- 类型: temperature, humidity, energy...
  enabled BOOLEAN DEFAULT true,
  
  -- 触发条件
  condition_field VARCHAR(50) NOT NULL,
  condition_operator VARCHAR(20) NOT NULL, -- gt, lt, eq, gte, lte
  condition_value DECIMAL(10,2) NOT NULL,
  
  -- 分析配置（每个触发器独立设置）
  analysis_engine VARCHAR(20) DEFAULT 'builtin', -- builtin | n8n
  n8n_workflow_id VARCHAR(100),         -- n8n 工作流 ID（从 API 获取）
  n8n_webhook_path VARCHAR(200),        -- webhook 路径
  
  -- UI 配置
  severity VARCHAR(20) DEFAULT 'warning',
  auto_open_chat BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 默认触发器
INSERT INTO iot_triggers (name, type, condition_field, condition_operator, condition_value, analysis_engine)
VALUES 
  ('高温报警', 'temperature', 'temperature', 'gt', 26, 'builtin'),
  ('低温报警', 'temperature', 'temperature', 'lt', 10, 'builtin');
```

---

### 后端

#### [NEW] [iot-triggers.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/iot-triggers.js)

触发器 CRUD + n8n 工作流列表 API：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/iot-triggers` | GET | 获取所有触发器 |
| `/api/iot-triggers/:id` | PUT | 更新触发器 |
| `/api/iot-triggers` | POST | 创建触发器 |
| `/api/iot-triggers/:id` | DELETE | 删除触发器 |
| `/api/iot-triggers/n8n/workflows` | GET | **从 n8n 获取可用工作流列表** |

**n8n 工作流列表 API 实现**：

```javascript
router.get('/n8n/workflows', async (req, res) => {
  const n8nBaseUrl = await getConfig('N8N_WEBHOOK_URL');
  const n8nApiKey = await getConfig('N8N_API_KEY'); // 新增配置项

  const response = await fetch(`${n8nBaseUrl}/api/v1/workflows?active=true`, {
    headers: { 'X-N8N-API-KEY': n8nApiKey }
  });
  
  const { data } = await response.json();
  // 返回工作流列表：{ id, name, active, nodes }
  // 过滤出包含 Webhook 触发器的工作流
  const webhookWorkflows = data.filter(w => 
    w.nodes?.some(n => n.type === 'n8n-nodes-base.webhook')
  );
  
  res.json({ success: true, data: webhookWorkflows });
});
```

---

#### [MODIFY] [system-config.js](file:///Volumes/DATA/antigravity/TwinSight/server/routes/v1/system-config.js)

1. **保留** n8n Webhook 地址配置（作为 n8n 服务器基础地址）
2. **新增** `N8N_API_KEY` 配置项（用于调用 n8n API）
3. **移除或降级** 全局 `USE_N8N` 开关（改为每个触发器独立设置）

---

### 前端

#### [MODIFY] [SystemConfigPanel.vue](file:///Volumes/DATA/antigravity/TwinSight/src/components/SystemConfigPanel.vue)

**修改 "AI 工作流" Tab**：
- 移除全局 "启用 n8n 工作流" 开关
- 新增 n8n API Key 输入框
- 保留 n8n 服务器地址（作为基础 URL）

**新增 "IoT 触发器" Tab**：
- 触发器列表表格
- 新增/编辑触发器对话框：
  - 基本信息：名称、类型、启用状态
  - 触发条件：字段、运算符、阈值
  - **分析引擎选择**：
    - 内置分析（默认）
    - n8n 工作流（选择时显示工作流下拉列表）
  - **n8n 工作流选择**：
    - 点击"获取工作流"按钮从 n8n 加载
    - 下拉选择包含 Webhook 触发器的工作流
  - UI 行为：严重程度、是否自动打开对话

---

## 阶段二：AI 对话窗口报警集成

#### [MODIFY] [AIChatPanel.vue](file:///Volumes/DATA/antigravity/TwinSight/src/components/ai/AIChatPanel.vue)

新增报警消息支持：

```javascript
defineExpose({
  addMessage,
  addAlertMessage(alertData, analysisResult) {
    messages.value.push({
      role: 'system',
      type: 'alert',
      alertData,
      content: analysisResult.analysis,
      sources: analysisResult.sources,
      timestamp: Date.now()
    });
    scrollToBottom();
  },
  setLoading,
  open: () => isOpen.value = true
});
```

新增报警消息样式（带警告图标、严重程度颜色标识）。

---

#### [MODIFY] [MainView.vue](file:///Volumes/DATA/antigravity/TwinSight/src/components/MainView.vue)

1. **加载 IoT 触发器配置**：移除硬编码阈值
2. **修改报警处理逻辑**：根据触发器配置选择分析引擎
3. **推送到 AIChatPanel**：替代 AIAnalysisModal

```javascript
// 替换原有的 aiAnalysisModal 弹窗逻辑
aiChatPanelRef.value?.open();
aiChatPanelRef.value?.addAlertMessage(alertData, analysisResult);
```

---

## 阶段三：分析引擎统一服务

#### [MODIFY] [ai-service.js](file:///Volumes/DATA/antigravity/TwinSight/server/services/ai-service.js)

重构为通用 IoT 报警处理：

```javascript
async function processIoTAlert(alertData, triggerConfig) {
  // 根据触发器配置选择引擎
  if (triggerConfig.analysisEngine === 'n8n' && triggerConfig.n8nWebhookPath) {
    const n8nBaseUrl = await getConfig('N8N_WEBHOOK_URL');
    return await executeN8nWorkflow({
      url: `${n8nBaseUrl}${triggerConfig.n8nWebhookPath}`,
      payload: alertData
    });
  } else {
    return await executeBuiltinAnalysis(alertData);
  }
}
```

---

## 阶段四：扩展性设计

#### [NEW] [iot-trigger-registry.js](file:///Volumes/DATA/antigravity/TwinSight/server/services/iot-trigger-registry.js)

触发器类型注册表，便于未来扩展：

```javascript
const triggerTypes = {
  temperature: { name: '温度监控', fields: ['temperature'], operators: ['gt', 'lt', 'gte', 'lte'] },
  humidity: { name: '湿度监控', fields: ['humidity'], operators: ['gt', 'lt'] },
  energy: { name: '能耗监控', fields: ['power', 'current'], operators: ['gt', 'lt'] }
};
```

---

## 用户审核事项

> [!IMPORTANT]
> 请确认以下设计决策：

1. **全局 n8n 开关**：
   - 方案 A（推荐）：移除全局开关，改为每个触发器独立设置
   - 方案 B：保留全局开关作为"总开关"，触发器级别设置作为覆盖

2. **n8n API Key**：
   - 新增系统配置项用于调用 n8n API 获取工作流列表

3. **默认触发器**：
   - 数据库迁移时自动创建高温（26°C）和低温（10°C）报警，默认使用内置分析

---

## 实施顺序

| 阶段 | 主要工作 | 预估工时 |
|------|---------|---------|
| 阶段一 | 数据库 + API + n8n 工作流列表 + 配置界面 | 2 天 |
| 阶段二 | AIChatPanel 报警集成 + MainView 改造 | 1 天 |
| 阶段三 | ai-service 重构 | 0.5 天 |
| 阶段四 | 扩展性设计 | 0.5 天 |
