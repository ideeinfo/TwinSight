<template>
  <div class="document-section">
    <div class="section-header">
      <span class="section-title">{{ $t('document.title') }}</span>
      <button 
        class="btn-text" 
        @click="triggerFileInput"
        :disabled="!relatedCode"
        :title="$t('document.upload')"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        {{ $t('document.upload') }}
      </button>
      <input 
        ref="fileInput" 
        type="file" 
        accept=".pdf,.jpg,.jpeg,.png,.svg,.mp4"
        multiple
        @change="handleFileSelect"
        style="display: none"
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
            <input 
              v-model="editingTitle"
              class="edit-input"
              @keydown.enter="saveTitle(doc.id)"
              @keydown.esc="cancelEdit"
              @blur="saveTitle(doc.id)"
            />
          </div>
          <div 
            v-else 
            class="doc-title clickable" 
            @click="openPreview(doc)"
            @dblclick.stop="startEdit(doc)"
            :title="$t('document.preview')"
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
            @click="downloadDocument(doc)"
            :title="$t('document.download')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button 
            class="btn-icon btn-delete" 
            @click="confirmDelete(doc)"
            :title="$t('document.delete')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
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
          @click="cancelUpload(item.id)"
          :title="$t('common.cancel')"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <span v-else-if="item.status === 'success'" class="upload-status-icon success">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
        <span v-else-if="item.status === 'error'" class="upload-status-icon error">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
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
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import DocumentPreview from './DocumentPreview.vue';

const { t } = useI18n();
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

// 文件图标 - 根据文件类型返回 SVG 字符串（低可视度设计）
const getFileIcon = (doc) => {
  const fileType = doc?.file_type?.toLowerCase();
  
  // 检查是否是全景图（长宽比接近 2:1）
  const isPanorama = () => {
    if (!['jpg', 'jpeg', 'png'].includes(fileType)) return false;
    const width = doc.image_width;
    const height = doc.image_height;
    if (!width || !height || height === 0) return false;
    const ratio = width / height;
    return ratio >= 1.9 && ratio <= 2.1;
  };

  // 全景图图标 - 青灰色
  if (isPanorama()) {
    return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="8" rx="1" fill="#4a5568"/><ellipse cx="8" cy="8" rx="5" ry="2.5" stroke="#718096" stroke-width="1" fill="none"/></svg>';
  }

  const icons = {
    pdf: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 1h5l4 4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" fill="#4a5568"/><path d="M9 1v4h4" fill="#2d3748"/></svg>',
    jpg: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1" fill="#4a5568"/><circle cx="5.5" cy="5.5" r="1.5" fill="#718096"/><path d="M14 10l-3-3-5 5" stroke="#718096" stroke-width="1.5" stroke-linecap="round"/></svg>',
    jpeg: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1" fill="#4a5568"/><circle cx="5.5" cy="5.5" r="1.5" fill="#718096"/><path d="M14 10l-3-3-5 5" stroke="#718096" stroke-width="1.5" stroke-linecap="round"/></svg>',
    png: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1" fill="#4a5568"/><circle cx="5.5" cy="5.5" r="1.5" fill="#718096"/><path d="M14 10l-3-3-5 5" stroke="#718096" stroke-width="1.5" stroke-linecap="round"/></svg>',
    svg: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1" fill="#4a5568"/><path d="M4 10l2-3 2 2 3-4" stroke="#718096" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mp4: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1" fill="#4a5568"/><polygon points="6.5,5.5 6.5,10.5 10.5,8" fill="#718096"/></svg>'
  };

  return icons[fileType] || '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 1h5l4 4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" fill="#4a5568"/><path d="M9 1v4h4" fill="#2d3748"/></svg>';
};

// 加载文档列表
const loadDocuments = async () => {
  if (!relatedCode.value) {
    documents.value = [];
    return;
  }

  try {
    const params = new URLSearchParams();
    if (props.assetCode) params.append('assetCode', props.assetCode);
    if (props.spaceCode) params.append('spaceCode', props.spaceCode);
    if (props.specCode) params.append('specCode', props.specCode);

    const response = await fetch(`${API_BASE}/api/documents?${params}`);
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
  
  // 立即清空input（无论是否选择了文件）
  event.target.value = '';
  
  if (files.length === 0) return;

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
    alert(t('document.fileTooLarge') + ': ' + invalidFiles.join(', '));
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

  // 确保 UI 更新后再开始上传
  nextTick(() => {
    for (const uploadItem of uploadItems) {
      uploadFile(uploadItem);
    }
  });
};

// 上传单个文件
const uploadFile = (uploadItem) => {
  const formData = new FormData();
  formData.append('file', uploadItem.file);
  if (props.assetCode) formData.append('assetCode', props.assetCode);
  if (props.spaceCode) formData.append('spaceCode', props.spaceCode);
  if (props.specCode) formData.append('specCode', props.specCode);

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
      } catch (e) {
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

  xhr.open('POST', `${API_BASE}/api/documents/upload`);
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
      headers: { 'Content-Type': 'application/json' },
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
  if (!confirm(t('document.deleteConfirm', { title: doc.title }))) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/documents/${doc.id}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      await loadDocuments();
    }
  } catch (error) {
    console.error('删除文档失败:', error);
    alert(t('document.deleteFailed'));
  }
};

// 下载文档
const downloadDocument = (doc) => {
  window.open(`${API_BASE}/api/documents/${doc.id}/download`, '_blank');
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
  background: #252526;
  border-radius: 4px;
  border: 1px solid #3e3e42;
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
  color: #ccc;
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
  color: #00b0ff;
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
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 3px;
  transition: all 0.2s;
}

.document-item:hover {
  background: #2a2a2a;
  border-color: #555;
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
  color: #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-title.clickable {
  cursor: pointer;
  color: #00b0ff;
  transition: color 0.2s;
}

.doc-title.clickable:hover {
  color: #4fc3f7;
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
  background: #1e1e1e;
  border: 1px solid #0078d4;
  border-radius: 2px;
  color: #eee;
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
  border: 1px solid #444;
  border-radius: 3px;
  color: #aaa;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: #333;
  border-color: #666;
  color: #fff;
}

.btn-delete:hover {
  background: #4442;
  border-color: #e74c3c;
  color: #e74c3c;
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
