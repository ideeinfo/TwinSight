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

          <div v-for="(msg, index) in messages" :key="index" class="message-row" :class="[msg.role, msg.type]">
            
            <!-- Alert Message -->
            <template v-if="msg.type === 'alert'">
              <div class="alert-card glass-effect-danger">
                <div class="alert-header">
                  <div class="alert-icon-wrapper">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </div>
                  <span class="alert-title">{{ msg.title }}</span>
                  <span class="alert-time">{{ new Date(msg.timestamp).toLocaleTimeString() }}</span>
                </div>
                <div class="alert-body markdown-body" v-html="renderMarkdown(msg.content, msg.sources)"></div>
                <AISourceList 
                   :sources="msg.sources" 
                   @open-source="$emit('open-source', $event)" 
                />
                <div class="alert-footer" v-if="msg.actions && msg.actions.length">
                   <button v-for="action in msg.actions" :key="action.label" class="alert-action-btn" @click="$emit('execute-action', action)">
                     {{ action.label }}
                   </button>
                </div>
              </div>
            </template>

            <!-- Normal Message -->
            <template v-else>
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
                <div class="content markdown-body" v-html="renderMarkdown(msg.content, msg.sources)"></div>
                <AISourceList 
                   :sources="msg.sources" 
                   @open-source="$emit('open-source', $event)" 
                />
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
            </template>
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
import AISourceList from './AISourceList.vue';

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

const renderMarkdown = (text, sources) => {
  if (!text) return '';
  
  // 1. Build a map of Index -> Source Object
  const indexToSourceMap = new Map();
  let hasNameMatch = false;

  if (sources && sources.length) {
    // Strategy A: Parse "[N] filename" lines
    const lines = text.split(/\r?\n/);
    lines.forEach(line => {
      const match = line.match(/^\s*\[(\d+)\]\s+(.+)$/);
      if (match) {
        const idxStr = match[1];
        const filename = match[2].trim();
        const src = sources.find(s => {
           const sName = s.name || s.fileName || '';
           return sName && filename && (sName.toLowerCase().includes(filename.toLowerCase()) || filename.toLowerCase().includes(sName.toLowerCase()));
        });
        if (src) {
           indexToSourceMap.set(idxStr, src);
           hasNameMatch = true;
        }
      }
    });

    // Strategy B: Fallback to 1-based array indexing
    if (!hasNameMatch) {
       sources.forEach((s, i) => {
          indexToSourceMap.set(String(i + 1), s);
       });
    }
  }

  return text
    // A. Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // B. Headers (from AIAnalysisModal)
    .replace(/^### (.*?)$/gm, '<h4>$1</h4>')
    .replace(/^## (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^# (.*?)$/gm, '<h2>$1</h2>')
    // C. Lists (from AIAnalysisModal)
    .replace(/^- (.*?)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    // D. Images
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width:100%; border-radius:4px;">')
    // E. Links
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
    // F. Newlines (handle double newlines as paragraphs)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    /* 
      G. Citation Markers: [123]
    */
    .replace(/\[(\d+)\]/g, (match, p1) => {
        const src = indexToSourceMap.get(p1);
        if (src) {
            const realId = src.id || src.documentId;
            const name = src.name || '';
            if (realId) {
                return `<span class="ai-doc-link" data-id="${realId}" data-name="${name}">[${p1}]</span>`;
            }
        }
        return match;
    });
};

defineExpose({
  addMessage: (msg) => {
    messages.value.push(msg);
    scrollToBottom();
  },
  addAlertMessage: (alert) => {
    messages.value.push({
      role: 'system',
      type: 'alert',
      title: alert.title || '系统报警',
      content: alert.message || alert.content,
      timestamp: Date.now(),
      level: alert.level || 'warning',
      actions: alert.actions,
      sources: alert.sources // 添加 sources 支持
    });
    isOpen.value = true;
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

  // Handle click on citations
  const attachClickListener = () => {
    if (!messagesContainer.value) return;
    
    // Remove if exists to avoid duplicates (though ref change implies new element usually)
    // We can just rely on the fact that if the element is destroyed (v-if false), the listener dies with it.
    // When v-if true, we get a new element.
    
    messagesContainer.value.addEventListener('click', handleMessageClick);
  };

  const handleMessageClick = (e) => {
      const target = e.target.closest('.ai-doc-link');
      if (target) {
        const id = target.getAttribute('data-id');
        const name = target.getAttribute('data-name');
        
        if (id) {
          const fileType = name ? name.split('.').pop().toLowerCase() : '';
          
          emit('open-source', { 
            id, // Keep for backward compatibility
            documentId: id,
            name: name || `Document ${id}`,
            isInternal: true,
            fileType,
            title: name || `Document ${id}`,
            url: `/api/documents/${id}/preview`,
            downloadUrl: `/api/documents/${id}/download`
          });
        }
      }
  };

  // Watch for container availability (since it's inside v-if)
  watch(messagesContainer, (newVal) => {
    if (newVal) {
      // Small delay to ensure DOM is strictly ready if needed, 
      // but Vue sets ref after mount/patch so it should be fine.
      attachClickListener(); 
    }
  });

  onMounted(() => {
    scrollToBottom();
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


/* Alert Styles */
.message-row.alert {
  display: block;
  max-width: 100%;
  padding: 0 8px;
  margin-bottom: 16px;
}

.glass-effect-danger {
  background: rgba(40, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 50, 50, 0.3);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
}

.alert-card {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  animation: slide-up 0.3s ease-out;
}

.alert-header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: rgba(255, 50, 50, 0.15);
  border-bottom: 1px solid rgba(255, 50, 50, 0.1);
  gap: 10px;
}

.alert-icon-wrapper {
  color: #ff6b6b;
  display: flex;
  align-items: center;
}

.alert-title {
  font-weight: 600;
  color: #ff8787;
  flex: 1;
  font-size: 14px;
}

.alert-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.alert-body {
  padding: 16px;
  font-size: 14px;
  color: #fff;
  line-height: 1.6;
}

.alert-footer {
  padding: 8px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.1);
}

.alert-action-btn {
  background: rgba(255, 100, 100, 0.1);
  border: 1px solid rgba(255, 100, 100, 0.2);
  color: #ff8787;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}


.alert-action-btn:hover {
  background: rgba(255, 100, 100, 0.2);
  border-color: #ff6b6b;
  color: #ff6b6b;
}

.ai-chart-window .chart-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  padding: 10px;
}

/* Deep selecors for v-html content links */
:deep(.ai-doc-link) {
  color: var(--accent-color);
  cursor: pointer;
  text-decoration: underline;
  margin: 0 2px;
  font-weight: 600;
  transition: all 0.2s;
  padding: 0 2px;
}

:deep(.ai-doc-link:hover) {
  opacity: 0.8;
  background: var(--tag-bg);
  border-radius: 4px;
  text-decoration: none;
}
</style>
