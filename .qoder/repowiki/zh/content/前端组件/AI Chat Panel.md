# AI Chat Panel 组件

## 概述

TwinSight AI 是一个智能运维助手组件，提供对话式交互界面，支持：
- 自然语言查询资产、空间和报警信息
- 报警卡片展示和快捷操作
- 可拖拽的浮动面板
- 深色模式适配

## 组件结构

```
AIChatPanel.vue
├── AI FAB (浮动按钮)
├── AI Panel (对话面板)
│   ├── Header (标题栏)
│   ├── Messages Area (消息区)
│   │   ├── Empty State (空状态)
│   │   ├── Alert Message (报警消息)
│   │   ├── Normal Message (普通消息)
│   │   └── Action Message (操作消息)
│   └── Input Area (输入区)
```

## 功能特性

### 1. 浮动按钮 (FAB)

- 玻璃态效果设计
- 脉冲动画吸引注意
- 点击展开对话面板

### 2. 可拖拽面板

- 支持拖拽移动位置
- 记忆上次位置（localStorage）
- 自动边界检测

### 3. 消息类型

#### 普通消息

用户和 AI 的文本对话。

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'normal';
}
```

#### 报警消息

展示报警信息和快捷操作。

```typescript
interface AlertMessage {
  role: 'assistant';
  type: 'alert';
  title: string;
  content: string;
  timestamp: number;
  sources?: Source[];
  actions?: Action[];
}
```

#### 操作消息

展示可执行的快捷操作。

```typescript
interface Action {
  label: string;
  type: 'navigate' | 'highlight' | 'acknowledge';
  payload: any;
}
```

### 4. 智能提示

空状态显示建议问题：
- "今天的报警有哪些？"
- "显示所有温度异常的房间"
- "帮我找到变压器的位置"

### 5. 源码引用

AI 回答可以包含引用来源：

```typescript
interface Source {
  type: 'space' | 'asset' | 'document';
  id: string;
  title: string;
  snippet?: string;
}
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `isDark` | `boolean` | `false` | 是否深色模式 |

## Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `open-source` | `Source` | 打开引用来源 |
| `execute-action` | `Action` | 执行操作 |

## 使用示例

```vue
<template>
  <AIChatPanel 
    :is-dark="isDarkMode"
    @open-source="handleOpenSource"
    @execute-action="handleExecuteAction"
  />
</template>

<script setup>
import AIChatPanel from '@/components/ai/AIChatPanel.vue';

const handleOpenSource = (source) => {
  // 跳转到对应资产/空间
  router.push(`/asset/${source.id}`);
};

const handleExecuteAction = (action) => {
  switch (action.type) {
    case 'navigate':
      router.push(action.payload.path);
      break;
    case 'highlight':
      highlightInViewer(action.payload.guids);
      break;
  }
};
</script>
```

## 样式特性

### 玻璃态效果

```css
.glass-effect {
  background: rgba(30, 30, 35, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### 动画效果

- **FAB 脉冲**: 呼吸动画吸引注意
- **面板展开**: 缩放过渡动画
- **消息进入**: 淡入 + 上滑
- **加载状态**: 打字机动画

### 响应式

- 面板最小宽度: 360px
- 面板最大宽度: 600px
- 适配移动端（全屏模式）

## 状态管理

组件内部使用以下响应式状态：

```typescript
const isOpen = ref(false);           // 面板开关
const loading = ref(false);          // 加载状态
const messages = ref<Message[]>([]); // 消息列表
const inputText = ref('');           // 输入文本
const panelPosition = ref({ x: 0, y: 0 }); // 面板位置
```

## 本地存储

- `ai-chat-position`: 面板位置
- `ai-chat-history`: 对话历史（最近 50 条）

## 深色模式适配

自动根据 `isDark` prop 切换主题色：

```css
.ai-chat-container.dark-mode-active {
  --bg-primary: rgba(20, 20, 25, 0.95);
  --text-primary: #e0e0e0;
  --accent-color: #00f2ff;
}
```
