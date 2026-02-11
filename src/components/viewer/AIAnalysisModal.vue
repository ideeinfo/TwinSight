<template>
  <el-dialog
    :model-value="visible"
    :show-close="false"
    width="600px"
    :close-on-click-modal="true"
    destroy-on-close
    class="ai-analysis-dialog"
    @update:model-value="$emit('close')"
    @close="$emit('close')"
  >
    <template #header>
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
    </template>

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
        
        <!-- 参考来源列表 -->
        <div v-if="sources && sources.length > 0" class="ai-sources">
          <div class="sources-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>参考文档列表</span>
          </div>
          <ul class="sources-list">
            <li v-for="(source, index) in sources" :key="index" class="source-item">
              <a 
                v-if="source.docId" 
                href="javascript:void(0)" 
                class="source-link internal"
                @click="emit('openSource', { 
                  documentId: source.docId, 
                  name: source.fileName || source.name,
                  fileType: (source.fileName || '').split('.').pop().toLowerCase(),
                  url: source.url,
                  downloadUrl: source.downloadUrl
                })"
              >
                <span class="source-icon">📄</span>
                <span class="source-name">{{ source.fileName || source.name }}</span>
              </a>
              <div v-else class="source-text">
                <span class="source-icon">🔗</span>
                <span class="source-name">{{ source.name }}</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
    
    <template #footer>
      <div class="ai-modal-footer">
        <button class="ai-btn-secondary" @click="$emit('close')">关闭</button>
        <button class="ai-btn-primary" @click="$emit('acknowledge')">已了解</button>
      </div>
    </template>
  </el-dialog>
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
/* 模态框样式移除 */
/* 
.modal-overlay {
  position: fixed;
  ... 
}
*/

/* 自定义类 ai-analysis-dialog 的样式需要全局或通过 deep 覆盖 */
:global(.ai-analysis-dialog) {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%) !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 16px !important;
  overflow: hidden !important;
  --el-dialog-bg-color: transparent;
}

:global(.ai-analysis-dialog .el-dialog__header),
:global(.ai-analysis-dialog .el-dialog__body),
:global(.ai-analysis-dialog .el-dialog__footer) {
  padding: 0 !important;
  background: transparent !important;
}

:global(.ai-analysis-dialog .el-dialog__headerbtn) {
  display: none !important; /* Hide default close button */
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
