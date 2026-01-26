<template>
  <div class="document-section">
    <div class="section-header">
      <span class="section-title">{{ $t('document.title') }}</span>
      <button 
        v-if="authStore.hasPermission('document:create')"
        class="btn-text" 
        :disabled="!relatedCode"
        :title="$t('document.upload')"
        @click="triggerFileInput"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {{ $t('document.upload') }}
      </button>
      <input 
        ref="fileInput" 
        type="file" 
        accept=".pdf,.jpg,.jpeg,.png,.svg,.mp4"
        multiple
        style="display: none"
        @change="handleFileSelect"
      />
    </div>

    <!-- 文档列表 -->
    <div v-if="documents.length > 0" class="document-list">
      <div 
        v-for="doc in documents" 
        :key="doc.id" 
        class="document-item"
      >
        <div class="doc-icon">
          <span v-html="getFileIcon(doc)"></span>
        </div>
        
        <div class="doc-info">
          <div v-if="editingId === doc.id" class="doc-edit">
            <el-input 
              v-model="editingTitle"
              size="small"
              @keydown.enter="saveTitle(doc.id)"
              @keydown.esc="cancelEdit"
              @blur="saveTitle(doc.id)"
            />
          </div>
          <div 
            v-else 
            class="doc-title clickable" 
            :title="$t('document.preview')"
            @click="openPreview(doc)"
            @dblclick.stop="authStore.hasPermission('document:update') ? startEdit(doc) : null"
          >
            {{ doc.title }}
          </div>
          <div class="doc-meta">
            {{ formatFileSize(doc.file_size) }} · 
            {{ formatDate(doc.created_at) }}
          </div>
        </div>

        <div class="doc-actions">
          <button 
            class="btn-icon" 
            :title="$t('document.download')"
            @click="downloadDocument(doc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button 
            v-if="authStore.hasPermission('document:delete')"
            class="btn-icon btn-delete" 
            :title="$t('document.delete')"
            @click="confirmDelete(doc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="13 2 13 9 20 9" />
      </svg>
      <p>{{ $t('document.noDocuments') }}</p>
      <small>{{ $t('document.supportedFormats') }}</small>
    </div>

    <!-- 上传队列 -->
    <div v-if="uploadQueue.length > 0" class="upload-queue">
      <div 
        v-for="item in uploadQueue" 
        :key="item.id" 
        class="upload-item"
        :class="{ 'upload-error': item.status === 'error', 'upload-success': item.status === 'success' }"
      >
        <div class="upload-item-info">
          <span class="upload-item-name">{{ item.name }}</span>
          <span class="upload-item-size">{{ formatFileSize(item.size) }}</span>
        </div>
        <div class="upload-item-progress">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :class="{ 'progress-error': item.status === 'error', 'progress-success': item.status === 'success' }"
              :style="{ width: item.progress + '%' }"
            ></div>
          </div>
          <span class="progress-percent">{{ item.progress }}%</span>
        </div>
        <button 
          v-if="item.status === 'uploading'" 
          class="btn-cancel" 
          :title="$t('common.cancel')"
          @click="cancelUpload(item.id)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span v-else-if="item.status === 'success'" class="upload-status-icon success">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span v-else-if="item.status === 'error'" class="upload-status-icon error">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
      </div>
    </div>

    <!-- 文档预览 -->
    <DocumentPreview 
      :visible="previewVisible" 
      :document="previewDocument" 
      @close="closePreview"
    />

    <!-- Confirm Dialog removed, using ElMessageBox -->
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import DocumentPreview from './DocumentPreview.vue';


import { useAuthStore } from '../stores/auth';
const { t } = useI18n();
const authStore = useAuthStore();
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const props = defineProps({
  assetCode: { type: String, default: null },
  spaceCode: { type: String, default: null },
  specCode: { type: String, default: null }
});

const documents = ref([]);
const uploadQueue = ref([]);  // 上传队列
const fileInput = ref(null);
const editingId = ref(null);
const uploadXhrMap = new Map(); // 存储 XHR 对象用于取消上传
const editingTitle = ref('');

// 预览状态
const previewVisible = ref(false);
const previewDocument = ref(null);

// 计算关联代码
const relatedCode = computed(() => {
  return props.assetCode || props.spaceCode || props.specCode;
});

// Helper to show confirm dialog using ElMessageBox
const showDialog = async (options) => {
  try {
    await ElMessageBox.confirm(
      options.message || '',
      options.title || t('common.confirm'),
      {
        confirmButtonText: options.confirmText || t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: options.danger ? 'warning' : 'info',
        dangerouslyUseHTMLString: false
      }
    );
    return true;
  } catch {
    return false;
  }
};

// Helper to show alert using ElMessageBox
const showAlert = async (message, title = '') => {
  await ElMessageBox.alert(message, title || t('common.alert'), {
    confirmButtonText: t('common.confirm'),
    type: 'warning'
  });
};

// 文件图标 - 正方形线形设计，不同文件类型使用不同颜色
const getFileIcon = (doc) => {
  const fileType = doc?.file_type?.toLowerCase();
  
  /**
   * 检查是否是全景图 (混合判断方案)
   * 优先级: 1.标签 > 2.auto_detected_type > 3.图片尺寸
   */
  const isPanorama = () => {
    if (!['jpg', 'jpeg', 'png'].includes(fileType)) return false;
    
    // 1. 优先检查标签 (用户可编辑, LLM可增强)
    const tags = doc.tags || [];
    const panoramaTags = ['全景图', '全景', 'panorama', '360'];
    if (tags.some(tag => panoramaTags.includes(tag.name?.toLowerCase?.() || tag.name))) {
      return true;
    }
    
    // 2. 检查系统自动检测的类型
    const autoType = doc.auto_detected_type;
    if (autoType && autoType.includes('panorama')) {
      return true;
    }
    
    // 3. Fallback: 使用图片尺寸判断 (宽高比 2:1)
    const width = doc.image_width;
    const height = doc.image_height;
    if (!width || !height || height === 0) return false;
    const ratio = width / height;
    return ratio >= 1.9 && ratio <= 2.1;
  };

  // 全景图图标 - 紫色
  if (isPanorama()) {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <ellipse cx="12" cy="12" rx="6" ry="3"/>
      <line x1="12" y1="9" x2="12" y2="15"/>
    </svg>`;
  }

  // 线形图标定义 - 正方形 20x20，不同颜色
  const icons = {
    // PDF - 红色
    pdf: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9 13h6"/>
      <path d="M9 17h6"/>
    </svg>`,
    
    // JPG/JPEG - 蓝色
    jpg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>`,
    
    jpeg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>`,
    
    // PNG - 绿色
    png: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>`,
    
    // SVG - 橙色
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M7 14l3-3 2 2 4-4"/>
      <circle cx="17" cy="10" r="1"/>
    </svg>`,
    
    // MP4 视频 - 青色
    mp4: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <polygon points="10 8 16 12 10 16 10 8"/>
    </svg>`
  };

  // 默认文件图标 - 灰色
  return icons[fileType] || `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>`;
};

// 加载文档列表 (使用 V2 API, 从 document_associations 表查询)
const loadDocuments = async () => {
  if (!relatedCode.value) {
    documents.value = [];
    return;
  }

  try {
    const params = new URLSearchParams();
    // V2 API 使用 objectType + objectCode 参数
    if (props.assetCode) {
      params.append('objectType', 'asset');
      params.append('objectCode', props.assetCode);
    } else if (props.spaceCode) {
      params.append('objectType', 'space');
      params.append('objectCode', props.spaceCode);
    } else if (props.specCode) {
      params.append('objectType', 'spec');
      params.append('objectCode', props.specCode);
    }

    const response = await fetch(`${API_BASE}/api/v2/documents?${params}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });
    const data = await response.json();

    if (data.success) {
      documents.value = data.data;
    }
  } catch (error) {
    console.error('加载文档列表失败:', error);
  }
};

// 监听关联代码changes
watch(() => relatedCode.value, () => {
  loadDocuments();
}, { immediate: true });

// 触发文件选择
const triggerFileInput = () => {
  // 使用 setTimeout 确保不阻塞 UI
  setTimeout(() => {
    fileInput.value?.click();
  }, 0);
};

// 处理文件选择（支持多文件）
const handleFileSelect = (event) => {
  const files = Array.from(event.target.files);
  
  // 立即清空input
  event.target.value = '';
  
  if (files.length === 0) return;

  // 使用 setTimeout 确保在干净的事件循环中处理
  // 增加延迟以绕过可能的浏览器阻塞操作
  setTimeout(() => {
    processFiles(files);
  }, 100);
};

// 实际处理文件的函数
const processFiles = (files) => {

  // 过滤超过200MB的文件
  const validFiles = [];
  const invalidFiles = [];
  
  for (const file of files) {
    if (file.size > 200 * 1024 * 1024) {
      invalidFiles.push(file.name);
    } else {
      validFiles.push(file);
    }
  }

  if (invalidFiles.length > 0) {
    showAlert(t('document.fileTooLarge') + ': ' + invalidFiles.join(', '));
  }

  if (validFiles.length === 0) {
    return;
  }

  // 立即将所有文件添加到上传队列
  const uploadItems = validFiles.map(file => ({
    id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: file.name,
    size: file.size,
    progress: 0,
    status: 'uploading',
    file: file
  }));
  
  uploadQueue.value.push(...uploadItems);

  // 强制 DOM 重排，确保进度条立即显示
  nextTick(() => {
    // 读取 offsetHeight 强制浏览器计算布局
    const container = document.querySelector('.upload-queue');
    if (container) {
      void container.offsetHeight;
    }
    
    // 开始上传
    for (const uploadItem of uploadItems) {
      uploadFile(uploadItem);
    }
  });
};

// 上传单个文件
const uploadFile = (uploadItem) => {
  const formData = new FormData();
  formData.append('file', uploadItem.file);
  
  // 构建关联数组 (v2 API 格式)
  const associations = [];
  if (props.assetCode) associations.push({ type: 'asset', code: props.assetCode });
  if (props.spaceCode) associations.push({ type: 'space', code: props.spaceCode });
  if (props.specCode) associations.push({ type: 'spec', code: props.specCode });
  if (associations.length > 0) {
    formData.append('associations', JSON.stringify(associations));
  }

  const xhr = new XMLHttpRequest();
  uploadXhrMap.set(uploadItem.id, xhr);

  // 上传进度
  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      const item = uploadQueue.value.find(i => i.id === uploadItem.id);
      if (item) {
        item.progress = Math.round((event.loaded / event.total) * 100);
      }
    }
  });

  // 上传完成
  xhr.addEventListener('load', async () => {
    const item = uploadQueue.value.find(i => i.id === uploadItem.id);
    if (!item) return;

    uploadXhrMap.delete(uploadItem.id);

    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.success) {
          item.status = 'success';
          item.progress = 100;
          await loadDocuments();
          
          // 2秒后从队列中移除成功项
          setTimeout(() => {
            removeFromQueue(uploadItem.id);
          }, 2000);
        } else {
          item.status = 'error';
          item.errorMessage = data.error;
        }
      } catch {
        item.status = 'error';
        item.errorMessage = '解析响应失败';
      }
    } else {
      item.status = 'error';
      item.errorMessage = `HTTP ${xhr.status}`;
    }
  });

  // 上传错误
  xhr.addEventListener('error', () => {
    const item = uploadQueue.value.find(i => i.id === uploadItem.id);
    if (item) {
      item.status = 'error';
      item.errorMessage = '网络错误';
    }
    uploadXhrMap.delete(uploadItem.id);
  });

  // 上传取消
  xhr.addEventListener('abort', () => {
    removeFromQueue(uploadItem.id);
    uploadXhrMap.delete(uploadItem.id);
  });

  xhr.open('POST', `${API_BASE}/api/v2/documents`);
  
  if (authStore.token) {
    xhr.setRequestHeader('Authorization', `Bearer ${authStore.token}`);
  }
  
  xhr.send(formData);
};

// 取消上传
const cancelUpload = (id) => {
  const xhr = uploadXhrMap.get(id);
  if (xhr) {
    xhr.abort();
  }
};

// 从队列中移除
const removeFromQueue = (id) => {
  const index = uploadQueue.value.findIndex(i => i.id === id);
  if (index > -1) {
    uploadQueue.value.splice(index, 1);
  }
};

// 打开文档预览
const openPreview = (doc) => {
  previewDocument.value = doc;
  previewVisible.value = true;
};

// 关闭文档预览
const closePreview = () => {
  previewVisible.value = false;
  previewDocument.value = null;
};

// 开始编辑标题
const startEdit = (doc) => {
  editingId.value = doc.id;
  editingTitle.value = doc.title;
};

// 保存标题
const saveTitle = async (id) => {
  if (!editingTitle.value.trim()) {
    cancelEdit();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/documents/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ title: editingTitle.value.trim() })
    });

    const data = await response.json();

    if (data.success) {
      await loadDocuments();
    }
  } catch (error) {
    console.error('更新标题失败:', error);
  }

  cancelEdit();
};

// 取消编辑
const cancelEdit = () => {
  editingId.value = null;
  editingTitle.value = '';
};

// 删除文档
const confirmDelete = async (doc) => {
  const confirmed = await showDialog({
    type: 'confirm',
    title: t('document.delete'),
    message: t('document.deleteConfirm', { title: doc.title }),
    danger: true,
    confirmText: t('document.delete')
  });

  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE}/api/documents/${doc.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });

    const data = await response.json();

    if (data.success) {
      await loadDocuments();
    }
  } catch (error) {
    console.error('删除文档失败:', error);
    await showAlert(t('document.deleteFailed'));
  }
};

// 下载文档
const downloadDocument = async (doc) => {
  try {
    const response = await fetch(`${API_BASE}/api/documents/${doc.id}/download`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.title;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      await showAlert(t('document.downloadFailed') || '下载失败');
    }
  } catch (error) {
    console.error('Download error', error);
    await showAlert(t('document.downloadFailed') || '下载失败');
  }
};

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return t('document.today');
  if (days === 1) return t('document.yesterday');
  if (days < 7) return `${days} ${t('document.daysAgo')}`;

  return date.toLocaleDateString();
};
</script>

<style scoped>
.document-section {
  margin-top: 16px;
  padding: 12px;
  background: var(--md-sys-color-surface);
  border-radius: 4px;
  border: 1px solid var(--md-sys-color-outline-variant);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 纯文本按钮样式 - 与右侧面板"添加"按钮一致 */
.btn-text {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  background: transparent;
  color: var(--md-sys-color-primary);
  border: none;
  font-size: 11px;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-text:hover:not(:disabled) {
  color: #4fc3f7;
}

.btn-text:disabled {
  color: #555;
  cursor: not-allowed;
}

.document-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.document-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: var(--md-sys-color-surface-container-low);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 3px;
  transition: all 0.2s;
}

.document-item:hover {
  background: var(--md-sys-color-surface-container-high);
  border-color: var(--md-sys-color-on-surface-variant);
}

.doc-icon {
  flex-shrink: 0;
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-title {
  font-size: 11px;
  color: var(--md-sys-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-title.clickable {
  cursor: pointer;
  color: var(--md-sys-color-primary);
  transition: color 0.2s;
}

.doc-title.clickable:hover {
  color: var(--md-sys-color-primary);
  text-decoration: underline;
}

.doc-meta {
  font-size: 10px;
  color: #888;
  margin-top: 2px;
}

.doc-edit {
  display: flex;
}

.edit-input {
  width: 100%;
  padding: 2px 6px;
  background: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-primary);
  border-radius: 2px;
  color: var(--md-sys-color-on-surface);
  font-size: 11px;
  outline: none;
}

.doc-actions {
  display: flex;
  gap: 4px;
}

.btn-icon {
  padding: 4px;
  background: transparent;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 3px;
  color: var(--md-sys-color-secondary);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: var(--md-sys-color-surface-container-high);
  border-color: var(--md-sys-color-outline);
  color: var(--md-sys-color-on-surface);
}

.btn-delete:hover {
  background: var(--md-sys-color-error-container);
  border-color: var(--md-sys-color-error);
  color: var(--md-sys-color-error);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #888;
  text-align: center;
}

.empty-state p {
  margin: 8px 0 4px;
  font-size: 12px;
}

.empty-state small {
  font-size: 10px;
  color: #666;
}

/* 上传队列样式 */
.upload-queue {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  position: relative;
}

.upload-item.upload-error {
  border-color: #e74c3c;
  background: rgba(231, 76, 60, 0.1);
}

.upload-item.upload-success {
  border-color: #27ae60;
  background: rgba(39, 174, 96, 0.1);
}

.upload-item-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.upload-item-name {
  font-size: 11px;
  color: #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.upload-item-size {
  font-size: 10px;
  color: #888;
  flex-shrink: 0;
}

.upload-item-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.upload-item-progress .progress-bar {
  flex: 1;
}

.progress-bar {
  height: 4px;
  background: #333;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0078d4, #106ebe);
  transition: width 0.2s ease;
}

.progress-fill.progress-error {
  background: linear-gradient(90deg, #e74c3c, #c0392b);
}

.progress-fill.progress-success {
  background: linear-gradient(90deg, #27ae60, #2ecc71);
}

.progress-percent {
  font-size: 10px;
  color: #888;
  min-width: 32px;
  text-align: right;
}

.btn-cancel {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  transition: color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-cancel:hover {
  color: #e74c3c;
}

.upload-status-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-status-icon.success {
  color: #27ae60;
}

.upload-status-icon.error {
  color: #e74c3c;
}
</style>
