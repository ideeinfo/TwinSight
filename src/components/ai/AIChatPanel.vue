<template>
  <div class="ai-chat-container" :class="{ 'dark-mode-active': isDark }">
    <transition name="fade">
      <div 
        v-if="!isOpen" 
        class="ai-fab glass-effect"
        @click="isOpen = true"
        title="AI Assistant"
      >
        <div class="pulse-ring"></div>
        <div class="fab-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <rect x="3" y="11" width="18" height="10" rx="5" ry="5"></rect>
             <circle cx="12" cy="5" r="2.5"></circle>
             <path d="M12 7.5v3.5"></path>
             <circle cx="8" cy="16" r="1.5" fill="currentColor"></circle>
             <circle cx="16" cy="16" r="1.5" fill="currentColor"></circle>
          </svg>
        </div>
      </div>
    </transition>

    <transition name="panel-scale">
      <div 
        v-if="isOpen" 
        ref="panelRef"
        class="ai-panel glass-effect"
        :style="panelStyle"
      >
        <div class="panel-header" ref="headerRef">
          <div class="header-left">
            <div class="status-indicator" :class="{ active: !loading }"></div>
            <span class="title">TwinSight AI</span>
          </div>
          <div class="header-right">
            <button class="icon-btn" @click="clearHistory" title="清空会话">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"></path>
              </svg>
            </button>
            <button class="icon-btn" @click="isOpen = false" title="最小化">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="messages-area" ref="messagesContainer">
          <div v-if="messages.length === 0" class="empty-state">
             <!-- Empty State SVG & Content -->
             <svg class="cute-robot-large" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="25" y="35" width="50" height="40" rx="12" ry="12" stroke="var(--accent-color)" stroke-width="3" fill="rgba(0, 242, 255, 0.05)"/>
                  <line x1="50" y1="35" x2="50" y2="20" stroke="var(--accent-color)" stroke-width="3"/>
                  <circle cx="50" cy="15" r="6" fill="var(--accent-color)">
                    <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <ellipse cx="40" cy="50" rx="5" ry="7" fill="var(--text-primary)" />
                  <ellipse cx="60" cy="50" rx="5" ry="7" fill="var(--text-primary)" />
                  <circle cx="42" cy="48" r="1.5" fill="white" />
                  <circle cx="62" cy="48" r="1.5" fill="white" />
                  <path d="M42 63 Q50 68 58 63" stroke="var(--text-primary)" stroke-width="2.5" fill="none"/>
                  <circle cx="33" cy="58" r="3" fill="rgba(255,100,100,0.3)" stroke="none" />
                  <circle cx="67" cy="58" r="3" fill="rgba(255,100,100,0.3)" stroke="none" />
               </svg>
            <p>我是您的智能运维助手，您可以问我关于资产、空间或报警的问题。</p>
            <div class="suggestions">
              <button v-for="s in suggestions" :key="s" @click="inputText = s" class="suggestion-pill">
                {{ s }}
              </button>
            </div>
          </div>

          <div v-for="(msg, index) in messages" :key="index" class="message-row" :class="msg.role">
            <div class="avatar" :class="msg.role">
              <span v-if="msg.role === 'user'">👤</span>
              <svg v-else class="bot-avatar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                 <rect x="4" y="8" width="16" height="12" rx="4" ry="4" fill="rgba(0, 242, 255, 0.1)" stroke="var(--accent-color)"/>
                 <line x1="12" y1="8" x2="12" y2="4" stroke="var(--accent-color)"/>
                 <circle cx="12" cy="3" r="1.5" fill="var(--accent-color)"/>
                 <circle cx="9" cy="13" r="1.5" fill="var(--text-primary)"/>
                 <circle cx="15" cy="13" r="1.5" fill="var(--text-primary)"/>
              </svg>
            </div>
            <div class="message-bubble glass-effect">
              <div v-if="msg.context" class="msg-context">
                <span>📍 {{ msg.context.name }}</span>
              </div>
              <div class="content markdown-body" v-html="renderMarkdown(msg.content)"></div>
              <div v-if="msg.sources && msg.sources.length" class="sources">
                <div v-for="src in msg.sources" :key="src.id" class="source-tag" @click="$emit('open-source', src)">
                  📄 {{ src.name }}
                </div>
              </div>
              <!-- Chart Wrapper -->
              <div v-if="msg.chartData" class="chart-wrapper">
                <ChartPanel 
                   v-if="msg.chartData.type === 'temperature'"
                   :data="msg.chartData.data" 
                   :label-text="msg.chartData.title"
                   class="ai-mini-chart"
                />
                <button class="open-chart-btn" @click="openChartModal(msg.chartData)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                  </svg>
                  放大查看
                </button>
              </div>
            </div>
          </div>

          <div v-if="loading" class="message-row assistant">
            <div class="avatar assistant">
               <svg class="bot-avatar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                 <rect x="4" y="8" width="16" height="12" rx="4" ry="4" fill="rgba(0, 242, 255, 0.1)" stroke="var(--accent-color)"/>
                 <line x1="12" y1="8" x2="12" y2="4" stroke="var(--accent-color)"/>
                 <circle cx="12" cy="3" r="1.5" fill="var(--accent-color)"/>
                 <circle cx="9" cy="13" r="1.5" fill="var(--text-primary)"/>
                 <circle cx="15" cy="13" r="1.5" fill="var(--text-primary)"/>
              </svg>
            </div>
            <div class="message-bubble glass-effect typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>

        <div class="input-area glass-effect-light">
          <transition name="slide-up">
            <div v-if="currentContext" class="context-bar">
              <span class="context-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                正在讨论: {{ currentContext.name }}
              </span>
              <button class="clear-context" @click="$emit('clear-context')">×</button>
            </div>
          </transition>

          <div class="input-wrapper">
            <textarea
              v-model="inputText"
              placeholder="输入您的问题 (Enter 发送, Shift+Enter 换行)..."
              @keydown.enter.prevent="handleEnter"
              :disabled="loading"
              rows="1"
              ref="inputRef"
            ></textarea>
            <button class="send-btn" @click="sendMessage" :disabled="!isValidInput || loading">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="resize-handle" @mousedown.prevent="startResize"></div>
      </div>
    </transition>

    <!-- Floating Chart Modal -->
    <transition name="panel-scale">
      <div 
        v-if="isChartOpen" 
        ref="chartPanelRef"
        class="ai-chart-window glass-effect"
        :style="chartPanelStyle"
      >
        <div class="panel-header" ref="chartHeaderRef">
          <div class="header-left">
            <span class="title">{{ currentChartData?.title || '数据图表' }}</span>
          </div>
          <div class="header-right">
             <button class="icon-btn" @click="isChartOpen = false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="chart-content">
           <ChartPanel 
               v-if="currentChartData"
               :data="currentChartData.data" 
               :label-text="currentChartData.title"
               :range="currentChartData.range"
            />
        </div>
        <div class="resize-handle" @mousedown.prevent="startChartResize"></div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useDraggable } from '@vueuse/core';
import ChartPanel from '../ChartPanel.vue';

const props = defineProps({
  currentContext: { type: Object, default: null }
});

const emit = defineEmits(['send-message', 'clear-context', 'open-source', 'execute-action']);

// State
const isOpen = ref(false);
const isChartOpen = ref(false);
const currentChartData = ref(null);
const inputText = ref('');
const loading = ref(false);
const messages = ref([]);
const panelRef = ref(null);
const headerRef = ref(null);
// Chart Modal Refs
const chartPanelRef = ref(null);
const chartHeaderRef = ref(null);

const messagesContainer = ref(null);
const inputRef = ref(null);

const isDark = ref(false);
let themeObserver = null;

const suggestions = [
  "这个房间有什么告警吗？",
  "显示最近一周的温度趋势",
  "高亮所有供电设备",
  "查找空调的维修手册"
];

// 1. Draggable Logic (Main Panel)
const { x, y } = useDraggable(panelRef, {
  initialValue: { x: window.innerWidth - 420, y: window.innerHeight - 620 },
  handle: headerRef,
  preventDefault: true,
});

// 2. Draggable Logic (Chart Modal)
const { x: chartX, y: chartY } = useDraggable(chartPanelRef, {
  initialValue: { x: 100, y: 100 },
  handle: chartHeaderRef,
  preventDefault: true,
});

// 3. Resizable Logic (Main Panel)
const panelWidth = ref(420);
const panelHeight = ref(600);

const panelStyle = computed(() => {
  return {
    left: `${x.value}px`,
    top: `${y.value}px`,
    width: `${panelWidth.value}px`,
    height: `${panelHeight.value}px`
  };
});

const startResize = (e) => {
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = panelWidth.value;
  const startH = panelHeight.value;

  const onMouseMove = (ev) => {
    panelWidth.value = Math.max(300, startW + (ev.clientX - startX));
    panelHeight.value = Math.max(400, startH + (ev.clientY - startY));
  };
  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

// 4. Resizable Logic (Chart Modal)
const chartWidth = ref(800);
const chartHeight = ref(500);

const chartPanelStyle = computed(() => ({
  left: `${chartX.value}px`,
  top: `${chartY.value}px`,
  width: `${chartWidth.value}px`,
  height: `${chartHeight.value}px`
}));

const startChartResize = (e) => {
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = chartWidth.value;
  const startH = chartHeight.value;

  const onMouseMove = (ev) => {
    chartWidth.value = Math.max(400, startW + (ev.clientX - startX));
    chartHeight.value = Math.max(300, startH + (ev.clientY - startY));
  };
  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

// Methods
const openChartModal = (data) => {
  currentChartData.value = data;
  isChartOpen.value = true;
  // Center chart if first open
  if (chartX.value < 0 || chartY.value < 0) {
      chartX.value = window.innerWidth / 2 - 400;
      chartY.value = window.innerHeight / 2 - 250;
  }
};

const clearHistory = () => {
  if (confirm('确定要清空当前对话记录吗？')) {
    messages.value = [];
  }
};

const isValidInput = computed(() => inputText.value.trim().length > 0);

const sendMessage = async () => {
  // ... (send logic)
  if (!isValidInput.value || loading.value) return;
  const text = inputText.value.trim();
  inputText.value = '';
  
  if (inputRef.value) inputRef.value.style.height = 'auto';

  messages.value.push({ role: 'user', content: text, timestamp: Date.now() });
  scrollToBottom();
  loading.value = true;

  emit('send-message', {
    text,
    context: props.currentContext,
    history: messages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
  }, (response) => {
    loading.value = false;
    messages.value.push(response);
    
    // Trigger Actions if present
    if (response.actions && Array.isArray(response.actions)) {
        response.actions.forEach(action => {
             console.log('🤖 Trigger AI Action:', action);
             emit('execute-action', action);
        });
    }

    // Auto open chart if available in response
    if (response.chartData) {
        // Optional: openChartModal(response.chartData);
    }
    
    scrollToBottom();
  });
};

const handleEnter = (e) => {
  if (e.shiftKey) return;
  sendMessage();
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

watch(inputText, () => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto';
      inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 120) + 'px';
    }
  });
});

const renderMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
};

defineExpose({
  addMessage: (msg) => {
    messages.value.push(msg);
    scrollToBottom();
  },
  setLoading: (status) => loading.value = status,
  open: () => isOpen.value = true
});

onMounted(() => {
  x.value = window.innerWidth - 420;
  y.value = window.innerHeight - 650;
  
  // Initialize and observe theme
  const updateTheme = () => {
    isDark.value = document.documentElement.classList.contains('dark');
  };
  updateTheme();
  
  themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        updateTheme();
      }
    });
  });
  
  themeObserver.observe(document.documentElement, {
    attributes: true, 
    attributeFilter: ['class']
  });
});

onUnmounted(() => {
  if (themeObserver) themeObserver.disconnect();
});
</script>

<style scoped>
/* CSS Variables */
.ai-chat-container {
  /* CSS Variables - Default Light Theme */
  --glass-bg: rgba(255, 255, 255, 0.9);
  --panel-bg-solid: rgba(255, 255, 255, 0.98);
  --glass-border: rgba(0, 0, 0, 0.1);
  --panel-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.15);

  --accent-color: #0078d4;
  --accent-glow: rgba(0, 120, 212, 0.3);
  
  --text-primary: #333333;
  --text-secondary: #666666;
  
  --msg-user-bg: rgba(0, 120, 212, 0.1);
  --msg-ai-bg: rgba(0, 0, 0, 0.03);
  
  --input-bg: rgba(0, 0, 0, 0.03);
  --tag-bg: rgba(0, 0, 0, 0.05);
  --pill-bg: rgba(0, 0, 0, 0.05);
  --avatar-bg: rgba(0, 0, 0, 0.05);
  --btn-bg: rgba(0, 0, 0, 0.05);
  --input-area-bg: rgba(255, 255, 255, 0.6);

  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  z-index: 9999;
  
  /* Ensure container doesn't block layout or clicks */
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

/* Dark Mode Overrides */
.ai-chat-container.dark-mode-active {
  --glass-bg: rgba(18, 18, 24, 0.75);
  --panel-bg-solid: rgba(18, 18, 24, 0.95);
  --glass-border: rgba(255, 255, 255, 0.08);
  --panel-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);

  --accent-color: #00f2ff;
  --accent-glow: rgba(0, 242, 255, 0.4);
  
  --text-primary: #ededed;
  --text-secondary: #a1a1aa;
  
  --msg-user-bg: rgba(0, 242, 255, 0.15);
  --msg-ai-bg: rgba(255, 255, 255, 0.05);
  
  --input-bg: rgba(0, 0, 0, 0.2);
  --tag-bg: rgba(0, 0, 0, 0.2);
  --pill-bg: rgba(255, 255, 255, 0.05);
  --avatar-bg: rgba(255, 255, 255, 0.1);
  --btn-bg: rgba(0, 0, 0, 0.3);
  --input-area-bg: rgba(30, 30, 35, 0.6);
}

/* Glass Effect */
.glass-effect {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--panel-shadow);
}
.glass-effect-light {
  background: var(--input-area-bg);
  backdrop-filter: blur(10px);
}

/* FAB */
.ai-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10000;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  color: var(--accent-color);
  pointer-events: auto;
}
.ai-fab:hover {
  transform: scale(1.1);
  box-shadow: 0 0 20px var(--accent-glow);
  border-color: var(--accent-color);
}
.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid var(--accent-color);
  opacity: 0;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0% { transform: scale(0.9); opacity: 0.7; }
  100% { transform: scale(1.5); opacity: 0; }
}

/* Panel */
.ai-panel {
  position: fixed;
  min-width: 300px;
  min-height: 400px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10001;
  pointer-events: auto;
}

/* Header */
.panel-header {
  height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--glass-border);
  cursor: grab;
  user-select: none;
}
.panel-header:active {
  cursor: grabbing;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-secondary);
  transition: all 0.3s;
}
.status-indicator.active {
  background: var(--accent-color);
  box-shadow: 0 0 8px var(--accent-glow);
}
.title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
}
.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s;
}
.icon-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.1);
}

/* Messages */
.messages-area {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scroll-behavior: smooth;
}
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  text-align: center;
  padding: 20px;
}
.cute-robot-large {
  width: 120px;
  height: 120px;
  filter: drop-shadow(0 0 15px rgba(0, 242, 255, 0.3));
  animation: float 6s ease-in-out infinite;
}
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}
.bot-avatar-icon {
  width: 20px;
  height: 20px;
}
.suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
}
.suggestion-pill {
  background: var(--pill-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.suggestion-pill:hover {
  background: var(--msg-user-bg);
  color: var(--accent-color);
  border-color: var(--accent-color);
}

/* Rows */
.message-row {
  display: flex;
  gap: 12px;
  max-width: 90%;
}
.message-row.user {
  margin-left: auto;
  flex-direction: row-reverse;
}
.message-row.assistant {
  margin-right: auto;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--avatar-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  word-break: break-word;
}
.user .message-bubble {
  background: var(--msg-user-bg);
  border-top-right-radius: 2px;
  border-color: rgba(0, 242, 255, 0.2);
}
.assistant .message-bubble {
  background: var(--msg-ai-bg);
  border-top-left-radius: 2px;
}

/* Context & Sources */
.msg-context {
  font-size: 11px;
  color: var(--accent-color);
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-weight: 500;
}
.sources {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.source-tag {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--tag-bg);
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.2s;
}
.source-tag:hover {
  color: var(--accent-color);
  text-decoration: underline;
}

/* Typing Indicator */
.typing-indicator span {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: var(--text-secondary);
  border-radius: 50%;
  margin: 0 2px;
  animation: bounce 1.4s infinite ease-in-out both;
}
.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Input Area */
.input-area {
  padding: 12px 16px;
  border-top: 1px solid var(--glass-border);
}
.context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 4px 8px;
  background: rgba(0, 242, 255, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(0, 242, 255, 0.2);
}
.context-label {
  font-size: 12px;
  color: var(--accent-color);
  display: flex;
  align-items: center;
  gap: 6px;
}
.clear-context {
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}
.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--input-bg);
  border-radius: 8px;
  padding: 8px;
  border: 1px solid var(--glass-border);
  transition: border-color 0.2s;
}
.input-wrapper:focus-within {
  border-color: var(--accent-color);
}
textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  resize: none;
  outline: none;
  max-height: 120px;
  padding: 4px;
  font-family: inherit;
}
textarea::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}
.send-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--accent-color);
  color: #000;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}
.send-btn:disabled {
  background: var(--text-secondary);
  opacity: 0.3;
  cursor: not-allowed;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.panel-scale-enter-active, .panel-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: bottom right;
}
.panel-scale-enter-from, .panel-scale-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(20px);
}

/* Open Chart Btn */
.chart-wrapper {
  margin-top: 10px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  padding: 8px;
  border: 1px solid rgba(255,255,255,0.05);
}
.ai-mini-chart {
  width: 100%;
  height: 160px; /* Essential for ChartPanel to render */
  margin-bottom: 8px;
}
.open-chart-btn {
  margin-top: 8px;
  background: var(--btn-bg);
  border: 1px solid var(--glass-border);
  color: var(--accent-color);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  width: fit-content;
}
.open-chart-btn:hover {
  background: rgba(0, 242, 255, 0.1);
}

/* Resize Handle */
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background: linear-gradient(135deg, transparent 50%, var(--text-secondary) 50%);
  opacity: 0.5;
  cursor: se-resize;
  z-index: 10002;
}
.resize-handle:hover {
  opacity: 1;
  background: linear-gradient(135deg, transparent 50%, var(--accent-color) 50%);
}

/* Floating Chart Window */
.ai-chart-window {
  position: fixed;
  display: flex;
  flex-direction: column;
  z-index: 10005; /* Higher than chat panel */
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--panel-shadow);
  border: 1px solid var(--glass-border);
  background: var(--panel-bg-solid); /* Slightly more opaque */
  pointer-events: auto;
}

.ai-chart-window .panel-header {
  background: var(--input-bg);
}

.ai-chart-window .chart-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  padding: 10px;
}
</style>
