<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
        <div class="ai-analysis-modal">
          <div class="ai-modal-header">
            <div class="ai-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span class="ai-header-title">🤖 AI 智能分析</span>
            <button class="ai-close-btn" @click="$emit('close')">×</button>
          </div>
          
          <div class="ai-modal-body">
            <div v-if="loading" class="ai-loading">
              <div class="ai-spinner"></div>
              <span>AI 正在分析中...</span>
            </div>
            <div v-else class="ai-content">
              <div class="ai-alert-info">
                <div class="alert-badge" :class="severity">
                  {{ severity === 'critical' ? '严重' : '警告' }}
                </div>
                <span class="alert-location">{{ roomName }}</span>
                <span class="alert-temp">{{ temperature }}°C</span>
              </div>
              <div class="ai-analysis-text" @click="handleTextClick" v-html="formattedAnalysis"></div>
              
              <!-- 参考文档列表 -->
              <div v-if="sources && sources.length > 0" class="ai-sources">
                <div class="sources-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <span>参考文档 ({{ sources.length }})</span>
                </div>
                <ul class="sources-list">
                  <li v-for="(source, idx) in sources" :key="idx" class="source-item">
                    <a 
                      v-if="source.documentId" 
                      class="source-link internal" 
                      href="#" 
                      @click.prevent="emit('openSource', source)"
                    >
                      <span class="source-icon">📄</span>
                      <span>[{{ idx + 1 }}] {{ source.name || source.fileName }}</span>
                    </a>
                    <span v-else class="source-text">
                      <span class="source-icon">📝</span>
                      <span>[{{ idx + 1 }}] {{ source.name || source.fileName || '未知来源' }}</span>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="ai-modal-footer">
            <button class="ai-btn-secondary" @click="$emit('close')">关闭</button>
            <button class="ai-btn-primary" @click="$emit('acknowledge')">已了解</button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  severity: {
    type: String,
    default: 'warning', // 'warning' | 'critical'
  },
  roomName: {
    type: String,
    default: '',
  },
  temperature: {
    type: [Number, String],
    default: '',
  },
  analysis: {
    type: String,
    default: '',
  },
  sources: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'acknowledge', 'openSource']);

/**
 * 处理分析文本中的点击事件
 * 捕获 .ai-doc-link 的点击
 */
const handleTextClick = (e) => {
  const link = e.target.closest('.ai-doc-link');
  if (link) {
    const id = link.dataset.id;
    const name = link.dataset.name;
    if (id && name) {
      // 从文件名推断文件类型
      const fileType = name.split('.').pop().toLowerCase();
      
      emit('openSource', { 
        documentId: id, 
        name, 
        isInternal: true,
        fileType, // 传递文件类型
        // 添加额外信息以便 DocumentPreview 知道如何处理
        title: name,
        url: `/api/documents/${id}/preview`,
        downloadUrl: `/api/documents/${id}/download`
      });
    }
  }
};

/**
 * 格式化分析文本
 * 将 markdown 风格的标题转换为 HTML
 */
const formattedAnalysis = computed(() => {
  if (!props.analysis) return '';
  
  return props.analysis
    // 处理 **粗体**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // 处理标题
    .replace(/^### (.*?)$/gm, '<h4>$1</h4>')
    .replace(/^## (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^# (.*?)$/gm, '<h2>$1</h2>')
    // 处理列表
    .replace(/^- (.*?)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    // 处理换行
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.ai-analysis-modal {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ai-modal-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.ai-header-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.ai-header-icon svg {
  color: #fff;
}

.ai-header-title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.ai-close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  transition: background 0.2s;
}

.ai-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.ai-modal-body {
  padding: 20px;
  max-height: 50vh;
  overflow-y: auto;
}

.ai-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #fff;
}

.ai-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ai-content {
  color: #fff;
}

.ai-alert-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.alert-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.alert-badge.warning {
  background: #ff9800;
  color: #000;
}

.alert-badge.critical {
  background: #f44336;
  color: #fff;
}

.alert-location {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.alert-temp {
  margin-left: auto;
  font-size: 18px;
  font-weight: 600;
  color: #4fc3f7;
}

.ai-analysis-text {
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.85);
}

.ai-analysis-text :deep(h2),
.ai-analysis-text :deep(h3),
.ai-analysis-text :deep(h4) {
  color: #fff;
  margin: 16px 0 8px;
}

.ai-analysis-text :deep(ul) {
  padding-left: 20px;
  margin: 8px 0;
}

.ai-analysis-text :deep(li) {
  margin: 4px 0;
}

.ai-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.ai-btn-secondary,
.ai-btn-primary {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-btn-secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
}

.ai-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

.ai-btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #fff;
}

.ai-btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 参考来源样式 */
.ai-sources {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sources-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 500;
}

.sources-header svg {
  stroke: rgba(255, 255, 255, 0.6);
}

.sources-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-item {
  display: flex;
  align-items: center;
}

.source-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  text-decoration: none;
  transition: all 0.2s;
  width: 100%;
}

.source-link.internal {
  background: rgba(102, 126, 234, 0.15);
  color: #a8b8ff;
}

.source-link.internal:hover {
  background: rgba(102, 126, 234, 0.25);
  color: #c8d4ff;
}

.source-link.external {
  background: rgba(76, 175, 80, 0.15);
  color: #a5d6a7;
}

.source-link.external:hover {
  background: rgba(76, 175, 80, 0.25);
  color: #c8d6c9;
}

.source-text {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  width: 100%;
}

.source-icon {
  font-size: 16px;
}

.ai-modal-footer {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.ai-btn-primary, .ai-btn-secondary {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.ai-btn-primary {
  background: #667eea;
  color: #fff;
}

.ai-btn-primary:hover {
  background: #5a6fd6;
  transform: translateY(-1px);
}

.ai-btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.ai-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* 深度选择器以应用样式到 v-html 内容 */
:deep(.ai-doc-link) {
  color: #4fc3f7;
  text-decoration: underline;
  cursor: pointer;
  font-weight: 500;
  transition: color 0.2s;
  padding: 0 4px;
}

:deep(.ai-doc-link:hover) {
  color: #81d4fa;
  background: rgba(79, 195, 247, 0.1);
  border-radius: 4px;
}

.source-text {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
}

.source-icon {
  font-size: 14px;
}
</style>
