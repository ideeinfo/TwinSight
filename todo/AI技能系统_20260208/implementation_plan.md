# AI 技能系统 - 电源追溯原型实施计划

## 1. 背景与目标

### 1.1 目标
实现 AI 对话系统与现有系统功能的集成，使用户可以通过自然语言指令触发系统操作。以"电源追溯"功能作为原型，验证整体架构设计。

### 1.2 用户场景
用户在 AI 对话中说："帮我查看 30-50.10.10.10 的上游供电"

系统应该：
1. AI 识别意图为"电源追溯"
2. 提取参数 `mcCode = "30-50.10.10.10"`
3. 自动切换到 RDS 模块的电源面板
4. 定位到该节点并执行上游追溯
5. 用红色箭头高亮显示供电路径

---

## 2. 现有系统能力分析

### 2.1 前端组件能力

| 组件 | 暴露方法 | 功能说明 |
|------|----------|----------|
| `AspectTreePanel.vue` | `selectByMcCodes(mcCodes[])` | 根据 MC 编码选中树节点 |
| | `refreshData()` | 刷新树数据 |
| | `expandAndScrollToCode()` | 展开并滚动到指定编码 |
| | (内部) `traceUpstream()` | 追溯选中节点的上游电源 |
| `PowerNetworkGraph.vue` | `refresh: loadData` | 刷新电源拓扑图 |
| | (内部) `traceUpstream()` | 追溯上游电源并更新图形 |
| | (内部) `clearTrace()` | 清除追溯状态 |
| `AppViewer.vue` | `switchView(view)` | 切换模块视图 |
| | `aspectTreePanelRef.value.xxx()` | 调用 RDS 面板方法 |

### 2.2 API 能力 (`src/api/rds.js`)

| 方法 | 参数 | 返回值 |
|------|------|--------|
| `tracePowerPath(fileId, nodeCode, options)` | `fileId`: 模型ID, `nodeCode`: 节点编码, `options.direction`: 'upstream'/'downstream' | `{ path: [], nodes: [], edges: [] }` |
| `traceTopology(objectId, direction)` | `objectId`: RDS对象ID, `direction`: 'upstream'/'downstream' | `{ nodes: [], total: N }` |
| `getPowerGraph(fileId, options)` | `fileId`: 模型ID | `{ nodes: [], edges: [], stats: {} }` |

### 2.3 需要增强的能力

| 组件 | 需要增加 | 说明 |
|------|----------|------|
| `AspectTreePanel.vue` | `switchToPower()` | 切换到电源方面 |
| | `locateAndTraceByMcCode(mcCode)` | 定位节点并自动追溯 |
| `PowerNetworkGraph.vue` | `locateNode(mcCode)` | 定位并选中指定节点 |
| | `selectNodeByMcCode(mcCode)` | 根据 MC 编码选中节点 |
| `AppViewer.vue` | `executeAIAction(action)` | 执行 AI 返回的动作指令 |

---

## 3. 技术架构设计

### 3.1 整体流程

```
┌─────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│  用户输入   │ ───▶ │   后端 AI Service    │ ───▶ │     前端执行器      │
│ "查看上游   │      │ 1. 加载技能注册表    │      │ 1. 解析 action 块   │
│  供电"      │      │ 2. 注入 System Prompt│      │ 2. 调用组件方法     │
└─────────────┘      │ 3. LLM 识别意图      │      │ 3. 更新 UI 状态     │
                     │ 4. 返回 action JSON  │      └─────────────────────┘
                     └──────────────────────┘
```

### 3.2 文件结构

```
server/
├── skills/                          # 技能注册目录
│   ├── skill-registry.js            # 技能加载器
│   └── power-trace.skill.json       # 电源追溯技能定义
├── services/
│   └── ai-service.js                # 修改: 注入技能到 System Prompt

src/
├── components/
│   ├── ai/
│   │   └── AIChatPanel.vue          # 修改: 解析并转发 action 指令
│   ├── AspectTreePanel.vue          # 修改: 增加 locateAndTraceByMcCode
│   └── PowerNetworkGraph.vue        # 修改: 增加 selectNodeByMcCode
├── AppViewer.vue                    # 修改: 增加 executeAIAction
```

---

## 4. 详细实施步骤

### 阶段 1: 后端技能注册 (预计 1h)

#### 4.1.1 创建技能定义文件

**文件**: `server/skills/power-trace.skill.json`

```json
{
  "id": "power_trace_upstream",
  "name": "电源上游追溯",
  "description": "在电源网络拓扑中定位设备并追溯其上游供电路径，用红色箭头高亮显示供电关系",
  "version": "1.0.0",
  "triggers": [
    "上游供电",
    "供电来源", 
    "电源追溯",
    "谁给它供电",
    "查看供电",
    "追溯电源"
  ],
  "parameters": [
    {
      "name": "mc_code",
      "type": "string",
      "description": "BIM构件的MC编码 (设备编码)",
      "required": true,
      "extractFrom": ["context", "query"],
      "examples": ["30-50.10.10.10", "AHU-001", "=TA001.BJ01"]
    }
  ],
  "action": {
    "type": "frontend_command",
    "command": "POWER_TRACE_UPSTREAM",
    "module": "rds",
    "panel": "power",
    "payload": {
      "mcCode": "${mc_code}",
      "direction": "upstream",
      "highlightColor": "red",
      "showArrows": true
    }
  },
  "responseTemplate": "正在为您追溯 **${mc_code}** 的上游供电路径。\n\n请查看右侧电源网络拓扑图，供电路径将以 🔴 红色箭头 标注。"
}
```

#### 4.1.2 创建模块导航技能

**文件**: `server/skills/navigate-module.skill.json`

```json
{
  "id": "navigate_module",
  "name": "切换功能模块",
  "description": "切换到指定的系统功能模块（如资产、空间、文档、RDS等）",
  "version": "1.0.0",
  "triggers": [
    "打开",
    "切换到",
    "进入",
    "显示",
    "查看模块",
    "跳转到"
  ],
  "parameters": [
    {
      "name": "module",
      "type": "string",
      "description": "目标模块名称",
      "required": true,
      "enum": ["connect", "spaces", "assets", "rds", "models", "documents"]
    },
    {
      "name": "view_name",
      "type": "string",
      "description": "模块的中文名称（用于回复）",
      "required": false
    }
  ],
  "action": {
    "type": "frontend_command",
    "command": "NAVIGATE_TO_MODULE",
    "payload": {
      "module": "${module}"
    }
  },
  "responseTemplate": "已为您切换到 **${view_name}** 模块。"
}

#### 4.1.3 创建技能加载器

**文件**: `server/skills/skill-registry.js`

```javascript
/**
 * AI 技能注册表
 * 动态加载技能定义并生成 System Prompt 片段
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 缓存已加载的技能
let skillsCache = null;

/**
 * 加载所有技能定义
 */
export async function loadSkills() {
  if (skillsCache) return skillsCache;
  
  const skills = [];
  const skillFiles = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.skill.json'));
  
  for (const file of skillFiles) {
    try {
      const content = fs.readFileSync(path.join(__dirname, file), 'utf-8');
      const skill = JSON.parse(content);
      skills.push(skill);
      console.log(`✅ 加载技能: ${skill.name} (${skill.id})`);
    } catch (err) {
      console.error(`❌ 加载技能失败: ${file}`, err);
    }
  }
  
  skillsCache = skills;
  return skills;
}

/**
 * 生成技能相关的 System Prompt 片段
 */
export function generateSkillPrompt(skills) {
  if (!skills || skills.length === 0) return '';
  
  let prompt = `\n## 可用系统操作\n`;
  prompt += `当用户请求执行以下操作时，你应该在回复末尾附上一个特殊的 JSON 指令块。\n\n`;
  
  for (const skill of skills) {
    prompt += `### ${skill.name}\n`;
    prompt += `- **触发词**: ${skill.triggers.join('、')}\n`;
    prompt += `- **描述**: ${skill.description}\n`;
    prompt += `- **必需参数**:\n`;
    
    for (const param of skill.parameters) {
      prompt += `  - \`${param.name}\`: ${param.description}`;
      if (param.examples) {
        prompt += ` (例如: ${param.examples.join(', ')})`;
      }
      prompt += '\n';
    }
    
    prompt += `- **调用格式**:\n`;
    prompt += '```action\n';
    prompt += JSON.stringify({
      action: skill.id,
      params: skill.parameters.reduce((acc, p) => {
        acc[p.name] = `<从用户输入或上下文提取>`;
        return acc;
      }, {})
    }, null, 2);
    prompt += '\n```\n\n';
  }
  
  prompt += `**重要提示**:\n`;
  prompt += `1. 只有当用户明确请求执行操作时才返回 action 块\n`;
  prompt += `2. 如果无法从用户输入中提取必需参数，应该询问用户\n`;
  prompt += `3. action 块必须放在回复的末尾，用三个反引号包裹，语言标识为 \`action\`\n`;
  prompt += `4. 回复正文应该自然地告诉用户你将要执行什么操作\n`;
  
  return prompt;
}

/**
 * 根据技能 ID 获取响应模板
 */
export function getResponseTemplate(skillId, params) {
  const skill = skillsCache?.find(s => s.id === skillId);
  if (!skill) return null;
  
  let response = skill.responseTemplate;
  for (const [key, value] of Object.entries(params)) {
    response = response.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }
  return response;
}

export default {
  loadSkills,
  generateSkillPrompt,
  getResponseTemplate
};
```

#### 4.1.3 修改 AI Service

**文件**: `server/services/ai-service.js`

**修改点**:
1. 在启动时加载技能
2. 将技能注入 System Prompt
3. 在响应中识别 action 块并结构化返回

```javascript
// 新增导入
import { loadSkills, generateSkillPrompt } from '../skills/skill-registry.js';

// 在模块顶层初始化技能
let skillsPrompt = '';
(async () => {
  const skills = await loadSkills();
  skillsPrompt = generateSkillPrompt(skills);
  console.log(`🤖 AI 技能系统已加载 ${skills.length} 个技能`);
})();

// 修改 buildSystemPrompt 函数，追加技能 Prompt
function buildSystemPrompt(context) {
  let basePrompt = `你是 TwinSight 智能运维助手...`; // 现有内容
  
  // 追加技能能力描述
  basePrompt += skillsPrompt;
  
  return basePrompt;
}

// 修改响应解析，提取 action 块
function parseAIResponse(content) {
  const actionRegex = /```action\n([\s\S]*?)\n```/g;
  let match;
  let actions = [];
  let cleanContent = content;
  
  while ((match = actionRegex.exec(content)) !== null) {
    try {
      actions.push(JSON.parse(match[1]));
      // 从显示内容中移除 action 块（可选）
      cleanContent = cleanContent.replace(match[0], '');
    } catch (e) {
      console.warn('解析 action 块失败:', e);
    }
  }
  
  return {
    content: cleanContent.trim(),
    actions: actions.length > 0 ? actions : undefined
  };
}
```

---

### 阶段 2: 前端组件增强 (预计 2h)

#### 4.2.1 PowerNetworkGraph.vue 增强

**新增方法**: `selectNodeByMcCode(mcCode)`

```javascript
/**
 * 根据 MC 编码选中节点并触发追溯
 * @param {string} mcCode - 设备 MC 编码
 * @param {boolean} autoTrace - 是否自动追溯上游
 */
const selectNodeByMcCode = async (mcCode, autoTrace = true) => {
  if (!graphInstance.value || !fullGraphData.value) return false;
  
  // 在全图数据中查找匹配的节点
  const targetNode = fullGraphData.value.nodes.find(n => 
    n.mcCode === mcCode || 
    n.shortCode === mcCode || 
    n.fullCode === mcCode ||
    n.code === mcCode
  );
  
  if (!targetNode) {
    console.warn(`⚠️ [PowerGraph] 未找到 MC 编码对应的节点: ${mcCode}`);
    return false;
  }
  
  console.log(`🎯 [PowerGraph] 定位到节点:`, targetNode);
  
  // 选中节点
  selectedNode.value = targetNode;
  
  // 高亮节点
  graphInstance.value.setItemState(targetNode.id, 'selected', true);
  
  // 居中显示
  graphInstance.value.focusItem(targetNode.id, true);
  
  // 自动追溯
  if (autoTrace) {
    await traceUpstream();
  }
  
  return true;
};

// 更新 defineExpose
defineExpose({ 
  refresh: loadData,
  selectNodeByMcCode,
  clearTrace 
});
```

#### 4.2.2 AspectTreePanel.vue 增强

**新增方法**: `switchToPowerAndTrace(mcCode)`

```javascript
/**
 * 切换到电源方面并追溯指定设备
 * @param {string} mcCode - 设备 MC 编码
 */
async function switchToPowerAndTrace(mcCode) {
  console.log(`⚡ [AspectTree] AI 触发电源追溯: ${mcCode}`);
  
  // 1. 切换到电源方面
  activeAspect.value = 'power';
  
  // 2. 等待图形组件渲染
  await nextTick();
  
  // 3. 调用图形组件的定位追溯方法
  // 需要通过 ref 访问子组件
  const powerGraphRef = getCurrentInstance()?.refs?.powerGraphRef;
  if (powerGraphRef?.selectNodeByMcCode) {
    const found = await powerGraphRef.selectNodeByMcCode(mcCode, true);
    return found;
  }
  
  console.warn('⚠️ [AspectTree] PowerNetworkGraph 组件未就绪');
  return false;
}

// 更新 defineExpose
defineExpose({
  refreshData,
  expandAndScrollToCode,
  selectByMcCodes,
  switchToPowerAndTrace  // 新增
});
```

#### 4.2.3 AIChatPanel.vue 增强

**新增**: Action 解析和事件发送

```javascript
// 新增 emit
const emit = defineEmits([
  'send-message', 
  'clear-context', 
  'open-source',
  'execute-action'  // 新增
]);

// 解析 AI 响应中的 action 块
const parseActions = (response) => {
  if (response.actions && response.actions.length > 0) {
    return response.actions;
  }
  
  // 兜底: 尝试从 content 中解析
  const actionRegex = /```action\n([\s\S]*?)\n```/g;
  const actions = [];
  let match;
  
  while ((match = actionRegex.exec(response.content)) !== null) {
    try {
      actions.push(JSON.parse(match[1]));
    } catch (e) { /* ignore */ }
  }
  
  return actions;
};

// 修改 sendMessage 回调处理
emit('send-message', payload, (response) => {
  loading.value = false;
  
  // 解析并执行 actions
  const actions = parseActions(response);
  if (actions.length > 0) {
    console.log('🤖 [AI] 检测到系统操作指令:', actions);
    actions.forEach(action => {
      emit('execute-action', action);
    });
  }
  
  // 清理 content 中的 action 块再显示
  const cleanContent = response.content.replace(/```action\n[\s\S]*?\n```/g, '').trim();
  
  messages.value.push({
    ...response,
    content: cleanContent
  });
  
  scrollToBottom();
});
```

#### 4.2.4 AppViewer.vue 增强

**新增**: Action 执行器

```javascript
// 模板修改
<AIChatPanel
  :current-context="aiContext"
  @send-message="handleAIChatMessage"
  @execute-action="executeAIAction"  // 新增
/>

// 脚本新增
/**
 * 执行 AI 返回的操作指令
 */
const executeAIAction = async (action) => {
  console.log('🚀 [AppViewer] 执行 AI 操作:', action);
  
  switch (action.action) {
    case 'navigate_module':
      await handleNavigateModule(action.params);
      break;

    case 'power_trace_upstream':
      await handlePowerTraceAction(action.params);
      break;
    
    default:
      console.warn(`⚠️ 未知的 AI 操作: ${action.action}`);
  }
};

/**
 * 处理模块导航
 */
const handleNavigateModule = async (params) => {
  const { module } = params;
  if (module) {
    switchView(module);
  }
};

/**
 * 处理电源追溯操作
 */
const handlePowerTraceAction = async (params) => {
  const { mcCode } = params;
  
  if (!mcCode) {
    console.error('❌ 电源追溯缺少 mcCode 参数');
    return;
  }
  
  console.log(`⚡ [AppViewer] 开始电源追溯: ${mcCode}`);
  
  // 1. 切换到 RDS 模块
  if (currentView.value !== 'rds') {
    switchView('rds');
    await nextTick();
  }
  
  // 2. 调用 AspectTreePanel 的方法
  if (aspectTreePanelRef.value?.switchToPowerAndTrace) {
    const success = await aspectTreePanelRef.value.switchToPowerAndTrace(mcCode);
    
    if (!success) {
      // 可以考虑显示一个提示
      console.warn(`⚠️ 未找到设备: ${mcCode}`);
    }
  } else {
    console.error('❌ AspectTreePanel 组件未就绪');
  }
};
```

---

### 阶段 3: 测试与优化 (预计 1h)

#### 4.3.1 测试用例

| 测试场景 | 用户输入 | 预期结果 |
|----------|----------|----------|
| 基础追溯 | "帮我查看 30-50.10.10.10 的上游供电" | 切换到 RDS 电源面板，定位节点，显示上游路径 |
| 上下文推断 | (选中某个设备后) "追溯它的电源" | 从 context 获取设备编码，执行追溯 |
| 参数缺失 | "追溯上游供电" | AI 应该询问用户具体追溯哪个设备 |
| 无效编码 | "追溯 NOT-EXIST-001 的供电" | 执行追溯，提示未找到设备 |

#### 4.3.2 优化项

1. **错误处理**: 增加用户友好的错误提示
2. **加载状态**: 在执行操作时显示加载动画
3. **操作反馈**: 操作完成后在聊天中显示结果摘要
4. **参数验证**: 前端执行前验证参数格式

---

## 5. 风险与注意事项

### 5.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM 参数提取不准确 | 错误的设备编码 | 增加参数验证和用户确认 |
| 组件未就绪 | 操作失败 | 增加重试机制和状态检查 |
| 技能文件格式错误 | 加载失败 | JSON Schema 验证 |

### 5.2 安全考虑

1. **操作白名单**: 只允许执行预定义的技能操作
2. **参数清洗**: 防止注入攻击
3. **权限检查**: 确保用户有权执行对应操作

---

## 6. 未来扩展

### 6.1 更多技能示例

```json
// highlight-objects.skill.json
{
  "id": "highlight_objects",
  "name": "高亮显示对象",
  "triggers": ["高亮", "显示", "定位"],
  "parameters": [
    { "name": "object_type", "type": "enum", "values": ["asset", "space", "device"] },
    { "name": "filter_text", "type": "string" }
  ],
  "action": { "command": "HIGHLIGHT_OBJECTS", ... }
}

// navigate-space.skill.json  
{
  "id": "navigate_to_space",
  "name": "导航到空间",
  "triggers": ["去到", "定位到", "找到房间"],
  ...
}
```

### 6.2 复合操作

支持多步骤操作序列:

```json
{
  "id": "diagnose_power_issue",
  "name": "电源问题诊断",
  "steps": [
    { "action": "power_trace_upstream", "params": {...} },
    { "action": "query_alarm_history", "params": {...} },
    { "action": "generate_report", "params": {...} }
  ]
}
```

---

## 7. 验收标准

- [ ] AI 能够正确识别"电源追溯"意图
- [ ] AI 能够从用户输入中提取设备编码
- [ ] 点击发送后，系统自动切换到 RDS 电源面板
- [ ] 目标节点被选中并高亮
- [ ] 上游供电路径以红色箭头显示
- [ ] 整个过程无需用户额外操作

---

## 8. 时间评估

| 阶段 | 预计时间 |
|------|----------|
| 阶段 1: 后端技能注册 | 1 小时 |
| 阶段 2: 前端组件增强 | 2 小时 |
| 阶段 3: 测试与优化 | 1 小时 |
| **总计** | **4 小时** |
